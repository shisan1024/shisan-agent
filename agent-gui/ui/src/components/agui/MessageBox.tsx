import { useEffect, useRef, useState } from "react";
import angelinaIcon from "../../assets/icon.png";
import ComponentRenderer from "./registry";
import type { ChatMessage, ComponentAction } from "../chat/types";

export type { ChatMessage } from "../chat/types";

export type MessageBoxProps = {
  messages: ChatMessage[];
  className?: string;
  // run 已发起但还没有任何 assistant entry 时显示输入中指示
  pending?: boolean;
  // 整轮 run 未结束（模型仍在输出）时为 true，用于禁用卡片上的交互按钮
  busy?: boolean;
  // 组件卡片上的确认/取消：由上层负责落定状态并决定是否回传模型
  onComponentAction?: (entry: ChatMessage, action: ComponentAction) => void;
};

const COPY_FEEDBACK_MS = 1500;

async function copyTextToClipboard(text: string): Promise<boolean> {
  // Primary path: async clipboard API.
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    console.error("[message-box] navigator.clipboard.writeText failed", error);
  }

  // Fallback for webview contexts without the async clipboard API:
  // hidden textarea + execCommand("copy").
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const succeeded = document.execCommand("copy");
    document.body.removeChild(textarea);
    return succeeded;
  } catch (error) {
    console.error("[message-box] execCommand copy fallback failed", error);
    return false;
  }
}

function ThinkingDots({ className }: { className?: string }) {
  return (
    <span
      aria-label="正在输入"
      className={`inline-flex items-center gap-[3px] ${className ?? ""}`}
    >
      <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
      <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:140ms]" />
      <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:280ms]" />
    </span>
  );
}

// 思考气泡图标：用内联 SVG 而不是 💭。
// 💭(U+1F4AD) 在补充平面，依赖彩色 emoji 字体，Windows WebView2 上会渲染成乱码；
// ✓ ⚙ 这类 BMP 符号由 Segoe UI Symbol 覆盖，所以只有 emoji 会出问题。
// 图标一律走 SVG + currentColor，与工具箱、窗口按钮的既有做法保持一致。
function ThoughtIcon({ className }: { className?: string }) {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 ${className ?? ""}`}
    >
      <path
        d="M8 3c2.9 0 5.25 1.9 5.25 4.25S10.9 11.5 8 11.5c-.62 0-1.21-.09-1.76-.25L3.5 12.6l.73-2.08A4.06 4.06 0 0 1 2.75 7.25C2.75 4.9 5.1 3 8 3Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ReasoningFold({ entry }: { entry: ChatMessage }) {
  const streaming = entry.status === "streaming";
  return (
    <details
      open={streaming}
      className="group/think mb-1.5 rounded-xl border border-dashed border-[#C08469]/45 bg-[#FBEFE7]/80 px-2.5 py-1.5 text-[11px] text-[#A0715A]"
    >
      <summary className="flex cursor-pointer list-none select-none items-center gap-1.5 [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden="true"
          className="inline-block text-[9px] transition-transform duration-200 group-open/think:rotate-90"
        >
          ▶
        </span>
        <span className="flex items-center gap-1 font-semibold tracking-wide">
          <ThoughtIcon />
          {streaming ? "思考中" : "思考过程"}
        </span>
        {streaming && <ThinkingDots className="text-[#C08469]" />}
      </summary>
      <div className="mt-1.5 whitespace-pre-wrap break-words border-t border-dashed border-[#C08469]/25 pt-1.5 leading-relaxed opacity-90">
        {entry.text}
      </div>
    </details>
  );
}

function ToolChip({ entry }: { entry: ChatMessage }) {
  const running = entry.status === "streaming";
  const tooltip = entry.output ?? entry.args ?? "执行中…";
  return (
    <span
      title={tooltip}
      className={`mb-1.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
        running
          ? "border-[#C08469]/50 bg-[#FFF4EE] text-[#B98070]"
          : "border-[#C08469]/35 bg-[#F3E3D8] text-[#8C5B4F]"
      }`}
    >
      <span
        aria-hidden="true"
        className={running ? "inline-block animate-spin [animation-duration:2.2s]" : ""}
      >
        {running ? "⚙" : "✓"}
      </span>
      {entry.name}
    </span>
  );
}

type Group = {
  key: string;
  author: "user" | "assistant";
  entries: ChatMessage[];
};

function buildGroups(messages: ChatMessage[]): Group[] {
  const groups: Group[] = [];
  for (const message of messages) {
    const isUser = message.kind === "user";
    const key = isUser ? message.id : message.runId ?? message.id;
    const last = groups[groups.length - 1];
    if (!isUser && last && last.author === "assistant" && last.key === key) {
      last.entries.push(message);
      continue;
    }
    groups.push({
      key,
      author: isUser ? "user" : "assistant",
      entries: [message],
    });
  }
  return groups;
}

function MessageBox({
  messages,
  className,
  pending = false,
  busy = false,
  onComponentAction,
}: MessageBoxProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyResetTimer = useRef<number | undefined>(undefined);
  const isMounted = useRef(true);

  // Keep the newest message in view.
  useEffect(() => {
    const container = scrollRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, pending]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (copyResetTimer.current !== undefined) {
        window.clearTimeout(copyResetTimer.current);
      }
    };
  }, []);

  const handleCopy = async (entry: ChatMessage) => {
    const succeeded = await copyTextToClipboard(entry.text ?? "");
    if (!succeeded || !isMounted.current) {
      return;
    }

    setCopiedId(entry.id);
    if (copyResetTimer.current !== undefined) {
      window.clearTimeout(copyResetTimer.current);
    }
    copyResetTimer.current = window.setTimeout(() => {
      if (!isMounted.current) {
        return;
      }
      setCopiedId(null);
    }, COPY_FEEDBACK_MS);
  };

  const groups = buildGroups(messages);

  const renderTextBubble = (entry: ChatMessage, isUser: boolean) => {
    const streaming = entry.status === "streaming";
    const copied = copiedId === entry.id;

    return (
      <div
        className={`group/msg relative w-fit whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 leading-relaxed shadow-[0_2px_10px_rgba(147,94,72,0.10)] ${
          isUser
            ? "rounded-tr-md bg-gradient-to-br from-[#C08469] to-[#A96B52] text-[#FFF4EE]"
            : "rounded-tl-md border border-[#C08469]/25 bg-[#FFF8F3] text-[#5C3A33]"
        }`}
      >
        {entry.text ? (
          <span
            className={`cursor-text ${
              entry.status === "error" ? "text-[#B3402A]" : ""
            }`}
          >
            {entry.status === "error" && (
              <span aria-hidden="true" className="mr-1">
                ⚠
              </span>
            )}
            {entry.text}
            {streaming && (
              <span
                aria-hidden="true"
                className="ml-1 inline-block h-3.5 w-[3px] animate-pulse rounded-full bg-[#C08469] align-middle"
              />
            )}
          </span>
        ) : (
          streaming && <ThinkingDots className="px-0.5 py-1 text-[#B98070]" />
        )}

        {!streaming && entry.text && (
          <button
            type="button"
            aria-label={copied ? "已复制" : "复制消息"}
            onClick={() => void handleCopy(entry)}
            className={`absolute -top-2 ${
              isUser ? "-left-2" : "-right-2"
            } rounded-full border border-[#B98070]/40 bg-[#F0DAD3] px-2 text-[10px] leading-4 text-[#8C5B4F] opacity-0 shadow-sm transition-opacity hover:bg-[#E8CDC4] focus-visible:opacity-100 group-hover/msg:opacity-100`}
          >
            {copied ? "✓ 已复制" : "复制"}
          </button>
        )}
      </div>
    );
  };

  return (
    <div
      ref={scrollRef}
      className={`flex-1 select-text space-y-3 overflow-y-auto px-4 py-3 text-sm text-[#5C3A33] ${className ?? ""}`}
    >
      {groups.map((group) => {
        const isUser = group.author === "user";

        return (
          <div
            key={group.key}
            className={`flex animate-[msg-in_0.26s_ease-out] ${
              isUser ? "justify-end pl-12" : "items-start gap-2 pr-12"
            }`}
          >
            {!isUser && (
              <img
                src={angelinaIcon}
                alt=""
                draggable={false}
                className="mt-0.5 h-7 w-7 shrink-0 rounded-xl border border-[#C08469]/40 bg-[#FFF4EE] object-cover shadow-sm"
              />
            )}

            <div
              className={`flex min-w-0 max-w-[min(78%,40rem)] flex-col gap-0.5 ${
                isUser ? "items-end" : "items-start"
              }`}
            >
              {!isUser && (
                <span className="px-1 text-[10px] font-semibold tracking-wider text-[#A97C64]">
                  Angelina
                </span>
              )}

              {group.entries.map((entry) => {
                if (entry.kind === "user" || entry.kind === "text") {
                  return (
                    <div key={entry.id}>
                      {renderTextBubble(entry, entry.kind === "user")}
                    </div>
                  );
                }
                if (entry.kind === "reasoning") {
                  return <ReasoningFold key={entry.id} entry={entry} />;
                }
                if (entry.kind === "component" && entry.component) {
                  // 组件卡片由 registry 按 type 分发；确认/取消回到 ChatWindow 处理
                  return (
                    <ComponentRenderer
                      key={entry.id}
                      spec={entry.component}
                      state={entry.componentState ?? "pending"}
                      busy={busy}
                      onResolve={(action) => onComponentAction?.(entry, action)}
                    />
                  );
                }
                return <ToolChip key={entry.id} entry={entry} />;
              })}
            </div>
          </div>
        );
      })}

      {pending && (
        <div className="flex animate-[msg-in_0.26s_ease-out] items-start gap-2 pr-12">
          <img
            src={angelinaIcon}
            alt=""
            draggable={false}
            className="mt-0.5 h-7 w-7 shrink-0 rounded-xl border border-[#C08469]/40 bg-[#FFF4EE] object-cover shadow-sm"
          />
          <div className="flex min-w-0 max-w-[min(78%,40rem)] flex-col gap-0.5 items-start">
            <span className="px-1 text-[10px] font-semibold tracking-wider text-[#A97C64]">
              Angelina
            </span>
            <div className="rounded-2xl rounded-tl-md border border-[#C08469]/25 bg-[#FFF8F3] px-3.5 py-2 shadow-[0_2px_10px_rgba(147,94,72,0.10)]">
              <ThinkingDots className="text-[#B98070]" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MessageBox;

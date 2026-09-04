import { useEffect, useRef, useState } from "react";
import angelinaIcon from "../../assets/icon.png";

export type ToolRun = {
  id: string;
  name: string;
  output?: string;
  done: boolean;
};

export type ChatMessage = {
  id: number;
  author: "user" | "assistant";
  text: string;
  reasoning?: string;
  toolRuns?: ToolRun[];
  status?: "streaming" | "done" | "error"; // 缺省视为 done（兼容旧 localStorage 数据）
};

export type MessageBoxProps = {
  messages: ChatMessage[];
  className?: string;
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

function ReasoningFold({ message }: { message: ChatMessage }) {
  const streaming = message.status === "streaming";
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
        <span className="font-semibold tracking-wide">
          💭 {streaming ? "思考中" : "思考过程"}
        </span>
        {streaming && <ThinkingDots className="text-[#C08469]" />}
      </summary>
      <div className="mt-1.5 whitespace-pre-wrap break-words border-t border-dashed border-[#C08469]/25 pt-1.5 leading-relaxed opacity-90">
        {message.reasoning}
      </div>
    </details>
  );
}

function ToolChips({ runs }: { runs: ToolRun[] }) {
  return (
    <div className="mb-1.5 flex flex-wrap gap-1">
      {runs.map((run) => (
        <span
          key={run.id}
          title={run.output ?? "执行中…"}
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
            run.done
              ? "border-[#C08469]/35 bg-[#F3E3D8] text-[#8C5B4F]"
              : "border-[#C08469]/50 bg-[#FFF4EE] text-[#B98070]"
          }`}
        >
          <span
            aria-hidden="true"
            className={run.done ? "" : "inline-block animate-spin [animation-duration:2.2s]"}
          >
            {run.done ? "✓" : "⚙"}
          </span>
          {run.name}
        </span>
      ))}
    </div>
  );
}

function MessageBox({ messages, className }: MessageBoxProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const copyResetTimer = useRef<number | undefined>(undefined);
  const isMounted = useRef(true);

  // Keep the newest message in view.
  useEffect(() => {
    const container = scrollRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (copyResetTimer.current !== undefined) {
        window.clearTimeout(copyResetTimer.current);
      }
    };
  }, []);

  const handleCopy = async (message: ChatMessage) => {
    const succeeded = await copyTextToClipboard(message.text);
    if (!succeeded || !isMounted.current) {
      return;
    }

    setCopiedId(message.id);
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

  return (
    <div
      ref={scrollRef}
      className={`flex-1 select-text space-y-3 overflow-y-auto px-4 py-3 text-sm text-[#5C3A33] ${className ?? ""}`}
    >
      {messages.map((message) => {
        const isUser = message.author === "user";
        const streaming = message.status === "streaming";
        const copied = copiedId === message.id;

        return (
          <div
            key={message.id}
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

              <div
                className={`group/msg relative w-fit whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 leading-relaxed shadow-[0_2px_10px_rgba(147,94,72,0.10)] ${
                  isUser
                    ? "rounded-tr-md bg-gradient-to-br from-[#C08469] to-[#A96B52] text-[#FFF4EE]"
                    : "rounded-tl-md border border-[#C08469]/25 bg-[#FFF8F3] text-[#5C3A33]"
                }`}
              >
                {!isUser && message.reasoning && <ReasoningFold message={message} />}
                {!isUser && message.toolRuns && message.toolRuns.length > 0 && (
                  <ToolChips runs={message.toolRuns} />
                )}

                {message.text ? (
                  <span
                    className={`cursor-text ${
                      message.status === "error" ? "text-[#B3402A]" : ""
                    }`}
                  >
                    {message.status === "error" && (
                      <span aria-hidden="true" className="mr-1">
                        ⚠
                      </span>
                    )}
                    {message.text}
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

                {!streaming && message.text && (
                  <button
                    type="button"
                    aria-label={copied ? "已复制" : "复制消息"}
                    onClick={() => void handleCopy(message)}
                    className={`absolute -top-2 ${
                      isUser ? "-left-2" : "-right-2"
                    } rounded-full border border-[#B98070]/40 bg-[#F0DAD3] px-2 text-[10px] leading-4 text-[#8C5B4F] opacity-0 shadow-sm transition-opacity hover:bg-[#E8CDC4] focus-visible:opacity-100 group-hover/msg:opacity-100`}
                  >
                    {copied ? "✓ 已复制" : "复制"}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default MessageBox;

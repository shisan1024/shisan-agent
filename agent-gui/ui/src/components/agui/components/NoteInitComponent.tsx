import type { ComponentRenderProps } from "../../chat/types";

// 关键词圆点配色，沿用右上角工具箱的暖色阶梯
const KEYWORD_COLORS = ["#935E48", "#AA684C", "#C08469", "#D09E78"];

const MAX_KEYWORDS = 12;

export type NoteInitProps = {
  content: string;
  keywords: string[];
};

/**
 * 校验模型给出的 props。返回 null 表示无法安全渲染，
 * 调用方会保持原样显示工具气泡——模型输出永远不能把整段对话搞崩。
 */
export function parseNoteInitProps(raw: unknown): NoteInitProps | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const { content, keywords } = raw as { content?: unknown; keywords?: unknown };
  if (typeof content !== "string" || content.trim() === "") {
    return null;
  }
  const list = Array.isArray(keywords)
    ? keywords
        .filter((keyword): keyword is string => typeof keyword === "string")
        .map((keyword) => keyword.trim())
        .filter((keyword) => keyword !== "")
        .slice(0, MAX_KEYWORDS)
    : [];

  return { content, keywords: list };
}

const BADGES: Record<string, { label: string; className: string }> = {
  pending: {
    label: "待确认",
    className: "border-[#C08469]/40 bg-[#FFF4EE] text-[#B98070]",
  },
  confirmed: {
    label: "已确认",
    className: "border-[#935E48]/35 bg-[#F3E3D8] text-[#8C5B4F]",
  },
  cancelled: {
    label: "已取消",
    className: "border-[#A97C64]/30 bg-[#F1DDD2] text-[#A97C64]",
  },
};

function NoteInitComponent({ props, state, busy, onResolve }: ComponentRenderProps) {
  // props 已由 parseNoteInitProps 校验，这里的断言只是把宽类型收窄回组件自己的形状
  const { content, keywords } = props as NoteInitProps;
  const badge = BADGES[state] ?? BADGES.pending;
  const resolved = state !== "pending";
  // 取消后整张卡片降噪，但仍留在历史里可回看
  const cancelled = state === "cancelled";

  return (
    <div
      role="group"
      aria-label="灵感速记"
      className={`w-[24rem] max-w-full select-text overflow-hidden rounded-2xl bg-[#FFF8F3] shadow-[0_2px_10px_rgba(147,94,72,0.10)] ${
        cancelled
          ? "border border-dashed border-[#C08469]/30 opacity-70"
          : "border border-[#C08469]/35"
      }`}
    >
      <div className="flex items-center gap-2 border-b border-[#C08469]/20 bg-[#F1DDD2]/70 px-3 py-2">
        <span
          aria-hidden="true"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#C08469] to-[#935E48] text-[#FFF4EE]"
        >
          {/* 📝(U+1F4DD) 在补充平面，Windows WebView2 上会渲染成乱码；改用 SVG + currentColor */}
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <path
              d="M9.2 2.5H4.5A1.5 1.5 0 0 0 3 4v8a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 13 12V6.3L9.2 2.5Z"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
            <path
              d="M9 2.8v3.7h3.7"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
            <path
              d="M5.6 9.2h4.8M5.6 11.4h3.2"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <span className="text-[11px] font-bold tracking-widest text-[#935E48]">
          灵感速记
        </span>
        <span
          className={`ml-auto shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${badge.className}`}
        >
          {badge.label}
        </span>
      </div>

      <div className="space-y-2.5 px-3 py-2.5">
        <section>
          <div className="mb-1 text-[10px] font-semibold tracking-wider text-[#A97C64]">
            内容主体
          </div>
          <p className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-[#C08469]/20 bg-[#FFF4EE] px-2.5 py-2 text-[13px] leading-relaxed text-[#5C3A33]">
            {content}
          </p>
        </section>

        <section>
          <div className="mb-1 text-[10px] font-semibold tracking-wider text-[#A97C64]">
            提取的关键词
          </div>
          {keywords.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {keywords.map((keyword, index) => (
                <span
                  key={`${keyword}-${index}`}
                  className="inline-flex items-center gap-1 rounded-full border border-[#C08469]/30 bg-[#F3E3D8] px-2 py-0.5 text-[11px] font-medium text-[#8C5B4F]"
                >
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: KEYWORD_COLORS[index % KEYWORD_COLORS.length],
                    }}
                  />
                  {keyword}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-[#A97C64]">没有提取到关键词</p>
          )}
        </section>
      </div>

      <div className="flex items-center gap-2 border-t border-[#C08469]/20 bg-[#F1DDD2]/50 px-3 py-2">
        {resolved ? (
          <span className="ml-auto text-[11px] text-[#8C5B4F]">
            {state === "confirmed" ? "✓ 已确认保存" : "已取消，这条灵感没有保存"}
          </span>
        ) : (
          <>
            <button
              type="button"
              disabled={busy}
              title={busy ? "模型还在回复，请稍等一下" : undefined}
              onClick={() => onResolve("cancel")}
              className="ml-auto rounded-lg border border-[#935E48]/40 bg-[#FFF4EE] px-3 py-1.5 text-xs font-medium text-[#935E48] transition-colors hover:bg-[#F1DDD2] disabled:cursor-not-allowed disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              disabled={busy}
              title={busy ? "模型还在回复，请稍等一下" : undefined}
              onClick={() => onResolve("confirm")}
              className="rounded-lg bg-[#C08469] px-3.5 py-1.5 text-xs font-medium text-[#FFF4EE] transition-colors hover:bg-[#935E48] disabled:cursor-not-allowed disabled:opacity-50"
            >
              确认保存
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default NoteInitComponent;

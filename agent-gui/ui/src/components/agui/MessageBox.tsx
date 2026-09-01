import { useEffect, useRef, useState } from "react";

export type ChatMessage = {
  id: number;
  author: "user" | "assistant";
  text: string;
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
      className={`flex-1 select-text space-y-2 overflow-y-auto p-3 text-sm text-[#5C3A33] ${className ?? ""}`}
    >
      {messages.map((message) => {
        const isUser = message.author === "user";
        const copied = copiedId === message.id;

        return (
          <div
            key={message.id}
            className={`group relative max-w-[85%] rounded-lg px-3 py-1.5 ${
              isUser
                ? "ml-auto bg-[#B98070] text-[#FFF2EE]"
                : "mr-auto bg-[#E8CDC4] text-[#5C3A33]"
            }`}
          >
            <span className="cursor-text">{message.text}</span>
            <button
              type="button"
              aria-label={copied ? "Copied" : "Copy message"}
              onClick={() => void handleCopy(message)}
              className={`absolute -top-2 ${
                isUser ? "-left-2" : "-right-2"
              } rounded border border-[#B98070]/40 bg-[#F0DAD3] px-1.5 text-[10px] leading-4 text-[#8C5B4F] opacity-0 shadow-sm transition-opacity hover:bg-[#E8CDC4] focus-visible:opacity-100 group-hover:opacity-100`}
            >
              {copied ? "✓ Copied" : "Copy"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default MessageBox;

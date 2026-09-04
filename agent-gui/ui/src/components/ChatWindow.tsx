import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { Image } from "@tauri-apps/api/image";
import MessageBox from "./agui/MessageBox";
import Sidebar from "./chat/Sidebar";
import { useAgentChat } from "./chat/useAgentChat";
import { useConversationHistory } from "./chat/useConversationHistory";
import {
  backgrounds,
  GIF_CHANGED_EVENT,
  INITIAL_KEY,
  resolveBackground,
} from "../lib/backgrounds";
import iconUrl from "../assets/icon.png";

const appWindow = getCurrentWindow();

// Initial gif key handed over by the main pet window via URL query param.
const initialGifKey = (() => {
  const param = new URLSearchParams(window.location.search).get("gif");
  return param && backgrounds[param] ? param : INITIAL_KEY;
})();

type ToolboxItem = {
  id: string;
  label: string;
  icon: ReactNode;
};

// Static placeholder toolbox; structured so it can be fed dynamic data later.
const TOOLBOX_ITEMS: ToolboxItem[] = [
  {
    id: "web-search",
    label: "网页搜索",
    icon: (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
        <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "code-gen",
    label: "代码生成",
    icon: (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M5.5 4.5 2 8l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10.5 4.5 14 8l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "file-manage",
    label: "文件管理",
    icon: (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M2 4.5A1.5 1.5 0 0 1 3.5 3h3l1.5 1.8h4.5A1.5 1.5 0 0 1 14 6.3v5.2a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5v-7Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: "scheduled-task",
    label: "定时任务",
    icon: (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 4.5V8l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

// Warm ladder derived from the base palette, used for the rank-style badges.
const BADGE_COLORS = ["#935E48", "#AA684C", "#C08469", "#D09E78"];

function PillHeader({ children }: { children: string }) {
  return (
    <div className="rounded-full bg-gradient-to-r from-[#C08469] to-[#935E48] px-4 py-1.5 text-center text-sm font-bold tracking-widest text-[#FFF4EE] shadow-sm">
      {children}
    </div>
  );
}

type ChatWindowProps = {
  onClose: () => void;
  standalone?: boolean;
};

function ChatWindow({ onClose, standalone = false }: ChatWindowProps) {
  useEffect(() => {
    if (!standalone) {
      return;
    }

    console.log("[chat] current window label:", appWindow.label);

    void appWindow.isVisible().then((visible) => {
      console.log("[chat] visible:", visible);
    }).catch((error) => {
      console.error("[chat] isVisible failed", error);
    });

    void appWindow.isClosable().then((closable) => {
      console.log("[chat] closable:", closable);
    }).catch((error) => {
      console.error("[chat] isClosable failed", error);
    });

    void fetch(iconUrl)
      .then((response) => response.arrayBuffer())
      .then((buffer) => Image.fromBytes(new Uint8Array(buffer)))
      .then((icon) => appWindow.setIcon(icon))
      .catch((error) => {
        console.error("Failed to set chat window icon", error);
      });
  }, [standalone]);

  const {
    conversations,
    activeId,
    messages,
    startNewConversation,
    switchConversation,
    updateConversation,
  } = useConversationHistory();
  const { send, cancel } = useAgentChat(activeId, updateConversation);
  const isStreaming = messages.some((message) => message.status === "streaming");
  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [gifKey, setGifKey] = useState(initialGifKey);

  // Stay in sync with the main pet window's current gif.
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void listen<string>(GIF_CHANGED_EVENT, (event) => {
      if (backgrounds[event.payload]) {
        setGifKey(event.payload);
      }
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch((error) => {
        console.error("[chat] failed to listen gif-changed", error);
      });

    return () => {
      unlisten?.();
    };
  }, []);

  const closingRef = useRef(false);

  const handleClose = () => {
    if (closingRef.current) {
      return;
    }
    closingRef.current = true;
    onClose();
  };

  const handleMinimize = () => {
    void appWindow.minimize().catch((error) => {
      console.error("[chat] minimize failed", error);
    });
  };

  const handleToggleMaximize = () => {
    void appWindow.toggleMaximize().catch((error) => {
      console.error("[chat] toggleMaximize failed", error);
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const text = input.trim();
    if (!text || isStreaming) {
      return;
    }

    send(text);
    setInput("");
  };

  const controlButtonClass =
    "flex h-6 w-6 items-center justify-center rounded text-[#935E48] transition-colors hover:bg-[#C08469]/20";

  return (
    <div
      className={
        standalone
          ? "flex h-screen w-screen items-center justify-center text-[#5F3D30]"
          : "fixed inset-0 z-[60] flex items-center justify-center bg-[#5F3D30]/30"
      }
    >
      <div
        className={
          standalone
            ? "flex h-full w-full flex-col overflow-hidden rounded-xl border border-[#C08469]/50 bg-[#F1DDD2]/90 backdrop-blur-md"
            : "flex h-[min(800px,92vh)] w-[min(1280px,94vw)] flex-col overflow-hidden rounded-xl border border-[#C08469]/50 bg-[#F1DDD2]/95 backdrop-blur-md"
        }
        onMouseDown={(event) => event.stopPropagation()}
      >
        {/* Draggable top strip with sidebar toggle + custom window controls */}
        <header
          onMouseDown={(event) => {
            if (event.button === 0) {
              event.preventDefault();
              void appWindow.startDragging();
            }
          }}
          className="flex shrink-0 cursor-grab items-center justify-between px-3 pb-1.5 pt-2 text-sm active:cursor-grabbing"
        >
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="切换侧边栏"
              aria-expanded={sidebarOpen}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={() => setSidebarOpen((open) => !open)}
              className="rounded px-1.5 py-1 text-[#935E48] transition-colors hover:bg-[#C08469]/20"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="2" y1="12" x2="14" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <span className="text-xs font-bold tracking-wide text-[#935E48]/80">Angelina</span>
          </div>
          <div className="flex items-center gap-1">
            {standalone && (
              <>
                <button
                  type="button"
                  aria-label="最小化窗口"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onClick={handleMinimize}
                  className={controlButtonClass}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
                <button
                  type="button"
                  aria-label="最大化窗口"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onClick={handleToggleMaximize}
                  className={controlButtonClass}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <rect x="2.5" y="2.5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </button>
              </>
            )}
            <button
              type="button"
              aria-label="关闭聊天"
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleClose();
              }}
              onClick={handleClose}
              className={controlButtonClass}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="m3 3 6 6M9 3 3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </header>

        {/* Body: left column (messages + input bar) | separator | info sidebar */}
        <div className="flex min-h-0 flex-1 gap-3 px-3 pb-3">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
            <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-2xl border border-[#C08469]/30 bg-[#FFF4EE]/70">
              <div
                inert={!sidebarOpen}
                className={`shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out ${
                  sidebarOpen ? "w-56" : "w-0"
                }`}
              >
                <Sidebar
                  conversations={conversations}
                  activeId={activeId}
                  onNewConversation={() => {
                    startNewConversation();
                    setSidebarOpen(false);
                  }}
                  onSelectConversation={(id) => {
                    switchConversation(id);
                    setSidebarOpen(false);
                  }}
                />
              </div>
              <MessageBox messages={messages} />
            </div>

            {/* Bottom chat bar: highlighted chip + input + send (left column only) */}
            <form
              onSubmit={handleSubmit}
              className="flex shrink-0 items-stretch gap-2 rounded-xl border border-[#C08469]/30 bg-[#FFF4EE]/80 p-1.5 shadow-sm"
            >
              <span className="flex shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#C08469] to-[#935E48] px-3 text-sm font-bold text-[#FFF4EE]">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M2 4.5A2.5 2.5 0 0 1 4.5 2h7A2.5 2.5 0 0 1 14 4.5v4a2.5 2.5 0 0 1-2.5 2.5H7l-3.2 2.6a.5.5 0 0 1-.8-.4V11A2.5 2.5 0 0 1 2 8.5v-4Z"
                    fill="currentColor"
                  />
                </svg>
                对话
              </span>
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="输入消息…"
                className="min-w-0 flex-1 rounded-lg bg-[#EAD1C2]/70 px-3 py-2 text-sm text-[#5F3D30] outline-none placeholder:text-[#AD8D7A] transition-colors focus:bg-[#EAD1C2]"
              />
              {isStreaming ? (
                <button
                  type="button"
                  onClick={cancel}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#935E48]/40 bg-[#FFF4EE] px-4 text-sm font-medium text-[#935E48] transition-colors hover:bg-[#F1DDD2]"
                >
                  <span
                    aria-hidden="true"
                    className="inline-block h-2 w-2 rounded-[3px] bg-[#935E48]"
                  />
                  停止
                </button>
              ) : (
                <button
                  type="submit"
                  className="shrink-0 rounded-lg bg-[#C08469] px-4 text-sm font-medium text-[#FFF4EE] transition-colors hover:bg-[#935E48]"
                >
                  发送
                </button>
              )}
            </form>
          </div>

          {/* Full-height vertical separator between the two columns */}
          <div
            aria-hidden="true"
            className="w-px shrink-0 self-stretch rounded-full bg-gradient-to-b from-[#C08469]/10 via-[#C08469]/50 to-[#C08469]/10"
          />

          <aside className="flex w-48 shrink-0 flex-col gap-2.5 overflow-y-auto pb-1">
            <PillHeader>Angelina</PillHeader>

            {/* Avatar card mirroring the pet window's current gif */}
            <div className="rounded-2xl border border-[#C08469]/30 bg-[#FFF4EE]/90 p-2 shadow-sm">
              <div className="overflow-hidden rounded-xl bg-[#EAD1C2]/60">
                <img
                  src={resolveBackground(gifKey)}
                  alt="Angelina 当前动画"
                  draggable={false}
                  className="aspect-square w-full object-cover"
                />
              </div>
            </div>

            <PillHeader>工具箱</PillHeader>

            <ul className="space-y-1.5">
              {TOOLBOX_ITEMS.map((item, index) => (
                <li key={item.id}>
                  <div className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#C08469]/20 bg-[#FFF4EE]/80 py-1.5 pl-1.5 pr-2 shadow-sm transition-colors hover:border-[#C08469]/40 hover:bg-[#FFF4EE]">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold text-[#FFF4EE]"
                      style={{ backgroundColor: BADGE_COLORS[index % BADGE_COLORS.length] }}
                    >
                      {index + 1}
                    </span>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#C08469]/30 bg-[#F1DDD2] text-[#935E48]">
                      {item.icon}
                    </span>
                    <span className="truncate text-xs font-medium text-[#5F3D30]">
                      {item.label}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default ChatWindow;

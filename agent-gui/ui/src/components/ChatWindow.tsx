import { useEffect, useRef, useState, type FormEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Image } from "@tauri-apps/api/image";
import MessageBox from "./agui/MessageBox";
import Sidebar from "./chat/Sidebar";
import { useConversationHistory } from "./chat/useConversationHistory";
import iconUrl from "../assets/icon.png";

const appWindow = getCurrentWindow();

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
    setMessages,
    startNewConversation,
    switchConversation,
  } = useConversationHistory();
  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const closingRef = useRef(false);

  const handleClose = () => {
    if (closingRef.current) {
      return;
    }
    closingRef.current = true;
    onClose();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const text = input.trim();
    if (!text) {
      return;
    }

    setMessages((current) => [
      ...current,
      {
        id: Date.now(),
        author: "user",
        text,
      },
    ]);
    setInput("");
  };

  return (
    <div
      className={
        standalone
          ? "flex h-screen w-screen items-center justify-center text-[#5C3A33]"
          : "fixed inset-0 z-[60] flex items-center justify-center bg-[#5C3A33]/30"
      }
    >
      <div
        className={
          standalone
            ? "flex h-full w-full flex-col overflow-hidden rounded-xl border border-[#B98070]/50 bg-[#F0DAD3]/90 backdrop-blur-md"
            : "flex h-[min(600px,90vh)] w-[min(800px,90vw)] flex-col overflow-hidden rounded-xl border border-[#B98070]/50 bg-[#F0DAD3]/95 backdrop-blur-md"
        }
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header
          onMouseDown={(event) => {
            if (event.button === 0) {
              event.preventDefault();
              void appWindow.startDragging();
            }
          }}
          className="flex cursor-grab items-center justify-between border-b border-[#B98070]/30 bg-[#E8CDC4]/60 px-3 py-2 text-sm active:cursor-grabbing"
        >
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Toggle sidebar"
              aria-expanded={sidebarOpen}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={() => setSidebarOpen((open) => !open)}
              className="rounded px-1.5 py-1 text-[#8C5B4F] transition-colors hover:bg-[#B98070]/20"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="2" y1="12" x2="14" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <span className="font-bold text-[#8C5B4F]">Angelina</span>
          </div>
          <button
            type="button"
            aria-label="Close chat"
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              handleClose();
            }}
            onClick={handleClose}
            className="rounded px-2 py-1 text-[#8C5B4F] transition-colors hover:bg-[#B98070]/20"
          >
            ✕
          </button>
        </header>

        <div className="flex min-h-0 flex-1 overflow-hidden">
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
          <div className="flex min-w-0 flex-1 flex-col">
            <MessageBox messages={messages} />

            <form
              onSubmit={handleSubmit}
              className="flex gap-2 border-t border-[#B98070]/30 p-2"
            >
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Type a message..."
                className="min-w-0 flex-1 rounded-md bg-[#E8CDC4]/70 px-2 py-1.5 text-sm text-[#5C3A33] outline-none placeholder:text-[#A98A7E] focus:bg-[#E8CDC4]"
              />
              <button
                type="submit"
                className="rounded-md bg-[#B98070] px-3 py-1.5 text-sm font-medium text-[#FFF2EE] transition-colors hover:bg-[#8C5B4F]"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatWindow;

import { useEffect, useRef, useState, type FormEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Image } from "@tauri-apps/api/image";
import iconUrl from "../assets/icon.png";

const appWindow = getCurrentWindow();

type ChatMessage = {
  id: number;
  author: "user" | "assistant";
  text: string;
};

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

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      author: "assistant",
      text: "Hello! This is the Angelina chat window.",
    },
  ]);
  const [input, setInput] = useState("");

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
          ? "flex h-screen w-screen items-center justify-center text-white"
          : "fixed inset-0 z-[60] flex items-center justify-center bg-black/30"
      }
    >
      <div
        className={
          standalone
            ? "flex h-full w-full flex-col overflow-hidden rounded-xl border border-white/10 bg-neutral-900/80 backdrop-blur-md"
            : "flex h-[min(300px,90vh)] w-[min(280px,90vw)] flex-col overflow-hidden rounded-xl border border-white/10 bg-neutral-900/95 backdrop-blur-md"
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
          className="flex cursor-grab items-center justify-between border-b border-white/10 px-3 py-2 text-sm active:cursor-grabbing"
        >
          <span className="font-bold text-[#FF2215]">Angelina</span>
          <button
            type="button"
            aria-label="Close chat"
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              handleClose();
            }}
            onClick={handleClose}
            className="rounded px-2 py-1 text-white transition-colors hover:bg-white/10"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 space-y-2 overflow-y-auto p-3 text-sm text-neutral-100">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`max-w-[85%] rounded-lg px-3 py-1.5 ${
                message.author === "user"
                  ? "ml-auto bg-[#0078d7] text-white"
                  : "mr-auto bg-white/10 text-neutral-100"
              }`}
            >
              {message.text}
            </div>
          ))}
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex gap-2 border-t border-white/10 p-2"
        >
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Type a message..."
            className="min-w-0 flex-1 rounded-md bg-white/10 px-2 py-1.5 text-sm text-white outline-none placeholder:text-neutral-400 focus:bg-white/15"
          />
          <button
            type="submit"
            className="rounded-md bg-[#0078d7] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#005a9e]"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

export default ChatWindow;

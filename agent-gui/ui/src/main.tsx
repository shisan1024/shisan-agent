import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow, type Window } from "@tauri-apps/api/window";
import { emitTo } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import App from "./App";
import ChatWindow from "./components/ChatWindow";
import "./index.css";

const isChatWindow =
  new URLSearchParams(window.location.search).get("window") === "chat";

// Primary path: destroy the chat window directly. This is the same API that
// the main window uses for its working Exit button.
async function destroyChatWindowDirectly(
  chatWindow: Window,
): Promise<boolean> {
  try {
    await chatWindow.destroy();
    console.log("[chat] destroy() succeeded");
    return true;
  } catch (error) {
    console.error("[chat] destroy() failed:", error);
    return false;
  }
}

// Fallback 1: ask the Rust backend to destroy the chat window.
async function destroyChatWindowViaBackend(): Promise<boolean> {
  try {
    await invoke("close_chat_window");
    console.log("[chat] Rust close_chat_window invoked successfully");
    return true;
  } catch (error) {
    console.error("[chat] Rust close_chat_window failed:", error);
    return false;
  }
}

// Fallback 2: ask the main window to destroy the chat window.
async function requestCloseFromMainWindow(): Promise<boolean> {
  try {
    await emitTo("main", "chat-request-close");
    console.log("[chat] chat-request-close emitted to main");
    return true;
  } catch (error) {
    console.error("[chat] failed to emit chat-request-close", error);
    return false;
  }
}

// Last resort: hide the window so it at least disappears from the screen.
async function hideChatWindowAsLastResort(
  chatWindow: Window,
): Promise<boolean> {
  try {
    await chatWindow.hide();
    console.log("[chat] hide() succeeded");
    return true;
  } catch (error) {
    console.error("[chat] hide() failed", error);
    return false;
  }
}

const closeChatWindow = async () => {
  const chatWindow = getCurrentWindow();
  console.log("[chat] close requested, window label:", chatWindow.label);

  // Primary path: destroy the current chat window directly.
  if (await destroyChatWindowDirectly(chatWindow)) {
    return;
  }

  // Fallback 1: ask the Rust backend to destroy the chat window.
  if (await destroyChatWindowViaBackend()) {
    return;
  }

  // Fallback 2: ask the main window to destroy the chat window. The main
  // window handles the event asynchronously, so fall through to the hide()
  // last resort below instead of returning here.
  await requestCloseFromMainWindow();

  // Last resort: hide the window so it at least disappears from the screen.
  await hideChatWindowAsLastResort(chatWindow);
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {isChatWindow ? (
      <ChatWindow standalone onClose={closeChatWindow} />
    ) : (
      <App />
    )}
  </React.StrictMode>,
);

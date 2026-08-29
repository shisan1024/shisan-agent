import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { emitTo } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import App from "./App";
import ChatWindow from "./components/ChatWindow";
import "./index.css";

const isChatWindow =
  new URLSearchParams(window.location.search).get("window") === "chat";

const closeChatWindow = async () => {
  const chatWindow = getCurrentWindow();
  console.log("[chat] close requested, window label:", chatWindow.label);

  // Primary path: destroy the current chat window directly. This is the same
  // API that the main window uses for its working Exit button.
  try {
    await chatWindow.destroy();
    console.log("[chat] destroy() succeeded");
    return;
  } catch (error) {
    console.error("[chat] destroy() failed:", error);
  }

  // Fallback 1: ask the Rust backend to destroy the chat window.
  try {
    await invoke("close_chat_window");
    console.log("[chat] Rust close_chat_window invoked successfully");
    return;
  } catch (error) {
    console.error("[chat] Rust close_chat_window failed:", error);
  }

  // Fallback 2: ask the main window to destroy the chat window.
  try {
    await emitTo("main", "chat-request-close");
    console.log("[chat] chat-request-close emitted to main");
  } catch (error) {
    console.error("[chat] failed to emit chat-request-close", error);
  }

  // Last resort: hide the window so it at least disappears from the screen.
  try {
    await chatWindow.hide();
    console.log("[chat] hide() succeeded");
  } catch (hideError) {
    console.error("[chat] hide() failed", hideError);
  }
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

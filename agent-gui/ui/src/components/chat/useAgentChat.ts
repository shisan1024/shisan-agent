import { useCallback } from "react";
import { Channel, invoke } from "@tauri-apps/api/core";
import type { ChatMessage, ToolRun } from "../agui/MessageBox";

// 与 agent-core AgentEvent 的 serde 契约一一对应（tag = "type"，snake_case）。
export type AgentEvent =
  | { type: "reasoning_delta"; text: string }
  | { type: "text_delta"; text: string }
  | { type: "tool_started"; id: string; name: string }
  | { type: "tool_finished"; id: string; name: string; output: string }
  | { type: "done"; text: string };

type UpdateConversation = (
  id: string,
  updater: (messages: ChatMessage[]) => ChatMessage[],
) => void;

export function useAgentChat(
  activeId: string,
  updateConversation: UpdateConversation,
): { send: (text: string) => void; cancel: () => void } {
  const cancel = useCallback(() => {
    void invoke("cancel_chat", { conversationId: activeId }).catch((error) => {
      console.error("[agent-chat] cancel_chat failed", error);
    });
  }, [activeId]);
  const send = useCallback(
    (text: string) => {
      // 捕获发送时的会话 id：流式回包期间用户切换会话也不会串台。
      const conversationId = activeId;
      const userMessage: ChatMessage = { id: Date.now(), author: "user", text };
      const assistantId = userMessage.id + 1;
      const placeholder: ChatMessage = {
        id: assistantId,
        author: "assistant",
        text: "",
        status: "streaming",
      };
      updateConversation(conversationId, (messages) => [
        ...messages,
        userMessage,
        placeholder,
      ]);

      const patchAssistant = (patch: (message: ChatMessage) => ChatMessage) => {
        updateConversation(conversationId, (messages) =>
          messages.map((message) =>
            message.id === assistantId ? patch(message) : message,
          ),
        );
      };

      const channel = new Channel<AgentEvent>();
      channel.onmessage = (event) => {
        switch (event.type) {
          case "reasoning_delta":
            patchAssistant((m) => ({
              ...m,
              reasoning: (m.reasoning ?? "") + event.text,
            }));
            break;
          case "text_delta":
            patchAssistant((m) => ({ ...m, text: m.text + event.text }));
            break;
          case "tool_started": {
            const run: ToolRun = { id: event.id, name: event.name, done: false };
            patchAssistant((m) => ({
              ...m,
              toolRuns: [
                ...(m.toolRuns ?? []).filter((t) => t.id !== event.id),
                run,
              ],
            }));
            break;
          }
          case "tool_finished":
            patchAssistant((m) => ({
              ...m,
              toolRuns: (m.toolRuns ?? []).map((t) =>
                t.id === event.id ? { ...t, done: true, output: event.output } : t,
              ),
            }));
            break;
          case "done":
            patchAssistant((m) => ({ ...m, text: event.text, status: "done" }));
            break;
        }
      };

      void invoke("chat", {
        conversationId,
        prompt: text,
        onEvent: channel,
      }).catch((error) => {
        patchAssistant((m) => ({
          ...m,
          status: "error",
          text: m.text ? `${m.text}\n[错误] ${String(error)}` : String(error),
        }));
      });
    },
    [activeId, updateConversation],
  );

  return { send, cancel };
}

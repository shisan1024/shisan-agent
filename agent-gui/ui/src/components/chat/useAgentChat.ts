import { useCallback, useState } from "react";
import { Channel, invoke } from "@tauri-apps/api/core";
import type { AguiEvent, ChatMessage } from "./types";

type UpdateConversation = (
  id: string,
  updater: (messages: ChatMessage[]) => ChatMessage[],
) => void;

function newUserMessage(text: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    kind: "user",
    status: "done",
    text,
  };
}

function errorNote(code: string, message: string): string {
  if (code === "CANCELLED") {
    return "[已停止]";
  }
  return `[错误] ${message}`;
}

function findLastTextIndex(messages: ChatMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].kind === "text") {
      return i;
    }
  }
  return -1;
}

export function useAgentChat(
  activeId: string,
  updateConversation: UpdateConversation,
): { send: (text: string) => void; cancel: () => void; awaitingRun: boolean } {
  // 发送后到 run 终态（RUN_FINISHED/RUN_ERROR/IPC 失败）之间为 true，
  // 堵住 RUN_STARTED 尚未到达、也还没有任何 streaming entry 时的连点双发。
  const [awaitingRun, setAwaitingRun] = useState(false);

  const cancel = useCallback(() => {
    void invoke("cancel_chat", { conversationId: activeId }).catch((error) => {
      console.error("[agent-chat] cancel_chat failed", error);
    });
  }, [activeId]);

  const send = useCallback(
    (text: string) => {
      // 捕获发送时的会话 id：流式回包期间用户切换会话也不会串台。
      const conversationId = activeId;
      updateConversation(conversationId, (messages) => [
        ...messages,
        newUserMessage(text),
      ]);
      setAwaitingRun(true);

      // runId 从 RUN_STARTED 事件抄，绝不本地生成（与 Rust 侧保持一致）。
      let runId: string | null = null;

      const appendEntry = (entry: ChatMessage) => {
        updateConversation(conversationId, (messages) => [...messages, entry]);
      };

      const patchEntry = (
        id: string,
        patch: (entry: ChatMessage) => ChatMessage,
      ) => {
        updateConversation(conversationId, (messages) =>
          messages.map((entry) => (entry.id === id ? patch(entry) : entry)),
        );
      };

      const applyRunError = (code: string, message: string) => {
        updateConversation(conversationId, (messages) => {
          // runId 未知（select! 抢先取消）也能命中：收尾所有仍 streaming 的 entry。
          let next = messages.map((entry) =>
            entry.status === "streaming"
              ? { ...entry, status: "done" as const }
              : entry,
          );
          const note = errorNote(code, message);
          const lastTextIndex = findLastTextIndex(next);
          if (lastTextIndex >= 0) {
            const target = next[lastTextIndex];
            const text = target.text ? `${target.text}\n${note}` : note;
            next = next.map((entry, index) =>
              index === lastTextIndex
                ? { ...entry, status: "error" as const, text }
                : entry,
            );
          } else {
            next = [
              ...next,
              {
                id: crypto.randomUUID(),
                kind: "text",
                runId: runId ?? undefined,
                status: "error" as const,
                text: note,
              },
            ];
          }
          return next;
        });
        setAwaitingRun(false);
      };

      const channel = new Channel<AguiEvent>();
      channel.onmessage = (event) => {
        switch (event.type) {
          case "RUN_STARTED":
            runId = event.runId;
            break;
          case "TEXT_MESSAGE_START":
            appendEntry({
              id: event.messageId,
              kind: "text",
              runId: runId ?? undefined,
              status: "streaming",
              text: "",
            });
            break;
          case "TEXT_MESSAGE_CONTENT":
            patchEntry(event.messageId, (entry) => ({
              ...entry,
              text: (entry.text ?? "") + event.delta,
            }));
            break;
          case "TEXT_MESSAGE_END":
            patchEntry(event.messageId, (entry) => ({
              ...entry,
              status: "done",
            }));
            break;
          case "REASONING_MESSAGE_START":
            appendEntry({
              id: event.messageId,
              kind: "reasoning",
              runId: runId ?? undefined,
              status: "streaming",
              text: "",
            });
            break;
          case "REASONING_MESSAGE_CONTENT":
            patchEntry(event.messageId, (entry) => ({
              ...entry,
              text: (entry.text ?? "") + event.delta,
            }));
            break;
          case "REASONING_MESSAGE_END":
            patchEntry(event.messageId, (entry) => ({
              ...entry,
              status: "done",
            }));
            break;
          case "TOOL_CALL_START":
            appendEntry({
              id: event.toolCallId,
              kind: "tool",
              runId: runId ?? undefined,
              status: "streaming",
              name: event.toolCallName,
              args: "",
            });
            break;
          case "TOOL_CALL_ARGS":
            patchEntry(event.toolCallId, (entry) => ({
              ...entry,
              args: (entry.args ?? "") + event.delta,
            }));
            break;
          case "TOOL_CALL_END":
            patchEntry(event.toolCallId, (entry) => ({
              ...entry,
              status: "done",
            }));
            break;
          case "TOOL_CALL_RESULT":
            patchEntry(event.toolCallId, (entry) => ({
              ...entry,
              status: "done",
              output: event.content,
            }));
            break;
          case "RUN_FINISHED":
            // 兜底扫尾：该 run 内仍 streaming 的 entry 全部定稿
            updateConversation(conversationId, (messages) =>
              messages.map((entry) =>
                entry.runId === event.runId && entry.status === "streaming"
                  ? { ...entry, status: "done" }
                  : entry,
              ),
            );
            setAwaitingRun(false);
            break;
          case "RUN_ERROR":
            applyRunError(event.code, event.message);
            break;
        }
      };

      void invoke("chat", {
        conversationId,
        prompt: text,
        onEvent: channel,
      }).catch((error) => {
        // IPC 层基础设施错误（事件通道之外）唯一兜底路径
        applyRunError("IPC", String(error));
      });
    },
    [activeId, updateConversation],
  );

  return { send, cancel, awaitingRun };
}

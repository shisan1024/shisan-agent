// 与 agent-core AguiEvent 的 serde 契约一一对应
// （tag = "type" SCREAMING_SNAKE_CASE，字段 camelCase）。

export type MessageStatus = "streaming" | "done" | "error";

export type ChatMessage = {
  id: string;
  kind: "user" | "text" | "reasoning" | "tool";
  runId?: string;
  status: MessageStatus;
  text?: string;
  name?: string;
  args?: string;
  output?: string;
};

export type AguiEvent =
  | { type: "RUN_STARTED"; threadId: string; runId: string }
  | { type: "RUN_FINISHED"; threadId: string; runId: string }
  | {
      type: "RUN_ERROR";
      threadId: string;
      runId: string;
      message: string;
      code: string;
    }
  | { type: "TEXT_MESSAGE_START"; messageId: string; role: "assistant" }
  | { type: "TEXT_MESSAGE_CONTENT"; messageId: string; delta: string }
  | { type: "TEXT_MESSAGE_END"; messageId: string }
  | { type: "REASONING_MESSAGE_START"; messageId: string; role: "reasoning" }
  | { type: "REASONING_MESSAGE_CONTENT"; messageId: string; delta: string }
  | { type: "REASONING_MESSAGE_END"; messageId: string }
  | { type: "TOOL_CALL_START"; toolCallId: string; toolCallName: string }
  | { type: "TOOL_CALL_ARGS"; toolCallId: string; delta: string }
  | { type: "TOOL_CALL_END"; toolCallId: string }
  | {
      type: "TOOL_CALL_RESULT";
      messageId: string;
      toolCallId: string;
      content: string;
    };

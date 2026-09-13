// 与 agent-core AguiEvent 的 serde 契约一一对应
// （tag = "type" SCREAMING_SNAKE_CASE，字段 camelCase）。

export type MessageStatus = "streaming" | "done" | "error";

// 组件卡片的生命周期：pending 等待用户点击，click 之后落定为终态并随历史持久化
export type ComponentState = "pending" | "confirmed" | "cancelled";

export type ComponentAction = "confirm" | "cancel";

// 前端组件描述：type 是 registry 的键，props 已由该组件自己的 parse 校验并规整过
export type ComponentSpec = {
  type: string;
  props: Record<string, unknown>;
};

// registry 交给具体组件的渲染参数
export type ComponentRenderProps = {
  props: Record<string, unknown>;
  state: ComponentState;
  // 整轮 run 未结束（模型仍在输出）时为 true，用来禁用卡片上的交互按钮
  busy: boolean;
  onResolve: (action: ComponentAction) => void;
};

export type ChatMessage = {
  id: string;
  kind: "user" | "text" | "reasoning" | "tool" | "component";
  runId?: string;
  status: MessageStatus;
  text?: string;
  name?: string;
  args?: string;
  output?: string;
  // 仅 kind === "component" 时有值
  component?: ComponentSpec;
  componentState?: ComponentState;
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

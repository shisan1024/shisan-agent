use serde::Serialize;

/// AG-UI 消息角色子集，序列化为小写字符串："assistant" / "reasoning"。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum AguiRole {
    Assistant,
    Reasoning,
}

/// AG-UI 协议事件子集（transport 为 Tauri IPC Channel，非 SSE）。
/// 序列化形态：{"type":"RUN_STARTED","threadId":"...","runId":"..."}
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(
    tag = "type",
    rename_all = "SCREAMING_SNAKE_CASE",
    rename_all_fields = "camelCase"
)]
pub enum AguiEvent {
    RunStarted {
        thread_id: String,
        run_id: String,
    },
    RunFinished {
        thread_id: String,
        run_id: String,
    },
    RunError {
        thread_id: String,
        run_id: String,
        message: String,
        code: String,
    },
    TextMessageStart {
        message_id: String,
        role: AguiRole,
    },
    TextMessageContent {
        message_id: String,
        delta: String,
    },
    TextMessageEnd {
        message_id: String,
    },
    ReasoningMessageStart {
        message_id: String,
        role: AguiRole,
    },
    ReasoningMessageContent {
        message_id: String,
        delta: String,
    },
    ReasoningMessageEnd {
        message_id: String,
    },
    ToolCallStart {
        tool_call_id: String,
        tool_call_name: String,
    },
    ToolCallArgs {
        tool_call_id: String,
        delta: String,
    },
    ToolCallEnd {
        tool_call_id: String,
    },
    ToolCallResult {
        message_id: String,
        tool_call_id: String,
        content: String,
    },
}

impl AguiEvent {
    pub fn text_message_start(message_id: impl Into<String>) -> Self {
        Self::TextMessageStart {
            message_id: message_id.into(),
            role: AguiRole::Assistant,
        }
    }

    pub fn reasoning_message_start(message_id: impl Into<String>) -> Self {
        Self::ReasoningMessageStart {
            message_id: message_id.into(),
            role: AguiRole::Reasoning,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn roundtrip(event: AguiEvent) -> serde_json::Value {
        serde_json::to_value(&event).expect("serializable")
    }

    #[test]
    fn lifecycle_events_use_upper_snake_tag_and_camel_fields() {
        assert_eq!(
            roundtrip(AguiEvent::RunStarted {
                thread_id: "t".into(),
                run_id: "r".into()
            }),
            json!({ "type": "RUN_STARTED", "threadId": "t", "runId": "r" })
        );
        assert_eq!(
            roundtrip(AguiEvent::RunFinished {
                thread_id: "t".into(),
                run_id: "r".into()
            }),
            json!({ "type": "RUN_FINISHED", "threadId": "t", "runId": "r" })
        );
        assert_eq!(
            roundtrip(AguiEvent::RunError {
                thread_id: "t".into(),
                run_id: "r".into(),
                message: "boom".into(),
                code: "CHAT_ERROR".into()
            }),
            json!({
                "type": "RUN_ERROR", "threadId": "t", "runId": "r",
                "message": "boom", "code": "CHAT_ERROR"
            })
        );
    }

    #[test]
    fn text_and_reasoning_events_pin_roles() {
        assert_eq!(
            roundtrip(AguiEvent::text_message_start("m1")),
            json!({ "type": "TEXT_MESSAGE_START", "messageId": "m1", "role": "assistant" })
        );
        assert_eq!(
            roundtrip(AguiEvent::TextMessageContent {
                message_id: "m1".into(),
                delta: "hi".into()
            }),
            json!({ "type": "TEXT_MESSAGE_CONTENT", "messageId": "m1", "delta": "hi" })
        );
        assert_eq!(
            roundtrip(AguiEvent::TextMessageEnd { message_id: "m1".into() }),
            json!({ "type": "TEXT_MESSAGE_END", "messageId": "m1" })
        );
        assert_eq!(
            roundtrip(AguiEvent::reasoning_message_start("m2")),
            json!({ "type": "REASONING_MESSAGE_START", "messageId": "m2", "role": "reasoning" })
        );
        assert_eq!(
            roundtrip(AguiEvent::ReasoningMessageContent {
                message_id: "m2".into(),
                delta: "think".into()
            }),
            json!({ "type": "REASONING_MESSAGE_CONTENT", "messageId": "m2", "delta": "think" })
        );
        assert_eq!(
            roundtrip(AguiEvent::ReasoningMessageEnd { message_id: "m2".into() }),
            json!({ "type": "REASONING_MESSAGE_END", "messageId": "m2" })
        );
    }

    #[test]
    fn tool_call_events_use_camel_fields() {
        assert_eq!(
            roundtrip(AguiEvent::ToolCallStart {
                tool_call_id: "c1".into(),
                tool_call_name: "get_time".into()
            }),
            json!({ "type": "TOOL_CALL_START", "toolCallId": "c1", "toolCallName": "get_time" })
        );
        assert_eq!(
            roundtrip(AguiEvent::ToolCallArgs {
                tool_call_id: "c1".into(),
                delta: "{}".into()
            }),
            json!({ "type": "TOOL_CALL_ARGS", "toolCallId": "c1", "delta": "{}" })
        );
        assert_eq!(
            roundtrip(AguiEvent::ToolCallEnd {
                tool_call_id: "c1".into()
            }),
            json!({ "type": "TOOL_CALL_END", "toolCallId": "c1" })
        );
        assert_eq!(
            roundtrip(AguiEvent::ToolCallResult {
                message_id: "m3".into(),
                tool_call_id: "c1".into(),
                content: "12:00".into()
            }),
            json!({
                "type": "TOOL_CALL_RESULT", "messageId": "m3",
                "toolCallId": "c1", "content": "12:00"
            })
        );
    }
}

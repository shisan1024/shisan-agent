#[derive(Debug, Clone, serde::Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AgentEvent {
    ReasoningDelta {
        text: String,
    },
    TextDelta {
        text: String,
    },
    ToolStarted {
        id: String,
        name: String,
    },
    ToolFinished {
        id: String,
        name: String,
        output: String,
    },
    Done {
        text: String,
    },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn events_serialize_with_snake_case_type_tag() {
        let json = serde_json::to_value(AgentEvent::TextDelta { text: "hi".into() })
            .expect("serializable");
        assert_eq!(
            json,
            serde_json::json!({ "type": "text_delta", "text": "hi" })
        );

        let json = serde_json::to_value(AgentEvent::ToolStarted {
            id: "c1".into(),
            name: "get_time".into(),
        })
        .expect("serializable");
        assert_eq!(
            json,
            serde_json::json!({ "type": "tool_started", "id": "c1", "name": "get_time" })
        );
    }
}


use async_openai::types::chat::ChatCompletionTools;
use chrono::{DateTime, Utc};
use serde_json::{Value, json, value};


use crate::agent::tool::{RunnableTool, tool_fn, tool_param::Field};

use super::AgentTool;

pub struct  SystemAgentTool {
}

impl SystemAgentTool {

    pub fn get_time() -> AgentTool {
        AgentTool {
            name: String::from("get_time"),
            description: Some(String::from("get current time")),
            parameters: Some(Field::empty()),
            strict: Some(true),
            f: tool_fn(|_: Value| async move {
                let now: DateTime<Utc> = Utc::now();
                now.to_rfc3339()  // 输出: "2026‑09‑04T09:12:30.123456Z"
            })
        }
    }
}
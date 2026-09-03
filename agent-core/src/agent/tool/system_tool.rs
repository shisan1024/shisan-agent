
use async_openai::types::chat::ChatCompletionTools;
use serde_json::json;


use super::AgentTool;

pub struct SystemAgentTool {

}

impl SystemAgentTool {

    pub fn get_time() -> ChatCompletionTools {
        AgentTool {
            name: String::from("get_time"),
            description: Some(String::from("get current time")),
            parameters: Some(json!({})),
            strict: Some(true)
        }.as_tool()
    }
}
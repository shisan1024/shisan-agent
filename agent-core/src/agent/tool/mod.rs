use async_openai::types::chat::{ChatCompletionTool, ChatCompletionTools, FunctionObject};
use serde_json::{Value};

pub mod system_tool;

pub use system_tool::SystemAgentTool;


pub struct AgentTool {
    name: String,
    description: Option<String>,
    parameters: Option<Value>,
    strict: Option<bool>,
}

impl AgentTool {
    
    pub fn as_tool(&self) -> ChatCompletionTools {
        ChatCompletionTools::Function(ChatCompletionTool {
            function: FunctionObject {
                name: self.name.clone(),
                description: self.description.clone(),
                parameters: self.parameters.clone(),
                strict: self.strict.clone()
            }
        })
    }
}
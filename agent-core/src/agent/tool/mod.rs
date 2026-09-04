use async_openai::types::chat::{ChatCompletionTool, ChatCompletionTools, FunctionObject};
use async_trait::async_trait;
use serde_json::{Value, map::Values};

pub mod system_tool;
pub mod tool_runnable;
pub mod tool_param;

pub use system_tool::SystemAgentTool;
pub use tool_runnable::{tool_fn, RunnableTool};

pub struct AgentTool {
    name: String,
    description: Option<String>,
    parameters: Option<Value>,
    strict: Option<bool>,
    f: Box<dyn RunnableTool>
}

impl AgentTool {

    pub fn tool_name(&self) -> String {
        self.name.clone()
    }

    pub fn get_fn(&self) -> &Box<dyn RunnableTool> {
        &self.f
    }
    
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
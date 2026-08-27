//! Chat message types used in chat completion requests and responses.

use serde::{Deserialize, Serialize};

use super::content::MessageContent;

/// System message.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemMessage {
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub name: Option<String>,
}

/// User message.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserMessage {
    pub content: MessageContent,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub name: Option<String>,
}

/// Assistant message.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssistantMessage {
    #[serde(default)]
    pub role: Option<String>,
    #[serde(default)]
    pub content: Option<String>,
    #[serde(default)]
    pub reasoning_content: Option<String>,
    #[serde(default)]
    pub tool_calls: Vec<super::tool::ToolCall>,
}

/// Tool message.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolMessage {
    pub content: String,
    pub tool_call_id: String,
}

/// A message in an OpenAI-compatible chat completion request.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "role", rename_all = "snake_case")]
pub enum Message {
    System {
        content: String,
        #[serde(skip_serializing_if = "Option::is_none", default)]
        name: Option<String>,
    },
    User {
        content: MessageContent,
        #[serde(skip_serializing_if = "Option::is_none", default)]
        name: Option<String>,
    },
    Assistant {
        content: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none", default)]
        name: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none", default)]
        prefix: Option<bool>,
        #[serde(skip_serializing_if = "Option::is_none", default)]
        reasoning_content: Option<String>,
    },
    Tool {
        content: String,
        tool_call_id: String,
    },
}

/// Backwards-compatible alias for [`Message`], previously named for DeepSeek.
pub type DeepSeekMessage = Message;

impl From<SystemMessage> for Message {
    fn from(message: SystemMessage) -> Self {
        Self::System {
            content: message.content,
            name: message.name,
        }
    }
}

impl From<UserMessage> for Message {
    fn from(message: UserMessage) -> Self {
        Self::User {
            content: message.content,
            name: message.name,
        }
    }
}

impl From<AssistantMessage> for Message {
    fn from(message: AssistantMessage) -> Self {
        Self::Assistant {
            content: message.content,
            name: None,
            prefix: None,
            reasoning_content: message.reasoning_content,
        }
    }
}

impl From<ToolMessage> for Message {
    fn from(message: ToolMessage) -> Self {
        Self::Tool {
            content: message.content,
            tool_call_id: message.tool_call_id,
        }
    }
}

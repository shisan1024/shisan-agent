//! Streaming chunk types.

use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::response::Usage;

/// One SSE streaming chunk.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatCompletionChunk {
    pub id: String,
    pub choices: Vec<ChunkChoice>,
    pub created: u64,
    pub model: String,
    #[serde(default)]
    pub system_fingerprint: Option<String>,
    pub object: String,
    #[serde(default)]
    pub usage: Option<Usage>,
}

/// One choice inside a streaming chunk.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChunkChoice {
    pub delta: ChatCompletionDelta,
    #[serde(default)]
    pub finish_reason: Option<String>,
    pub index: u64,
    #[serde(default)]
    pub logprobs: Option<Value>,
}

/// Delta content inside a streaming chunk.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ChatCompletionDelta {
    #[serde(default)]
    pub role: Option<String>,
    #[serde(default)]
    pub content: Option<String>,
    #[serde(default)]
    pub reasoning_content: Option<String>,
}

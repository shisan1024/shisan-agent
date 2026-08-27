//! Common request options shared by chat completion providers.

use serde::{Deserialize, Serialize};

/// Response format object.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ResponseFormat {
    /// `text` or `json_object`.
    #[serde(default = "default_response_format_type")]
    pub r#type: String,
}

fn default_response_format_type() -> String {
    "text".to_owned()
}

/// Streaming options.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamOptions {
    /// Include `usage` on every chunk.
    pub include_usage: bool,
}

/// `stop` field: either a single string or a list of strings.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Stop {
    Single(String),
    Multiple(Vec<String>),
}

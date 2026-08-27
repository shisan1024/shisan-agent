//! Multimodal message content parts.

use serde::{Deserialize, Serialize};

/// User message content: plain text or an array of content parts.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum MessageContent {
    Text(String),
    Parts(Vec<ContentPart>),
}

impl From<String> for MessageContent {
    fn from(value: String) -> Self {
        Self::Text(value)
    }
}

impl From<&str> for MessageContent {
    fn from(value: &str) -> Self {
        Self::Text(value.to_owned())
    }
}

/// A single multimodal content part.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ContentPart {
    Text {
        text: String,
    },
    ImageUrl {
        image_url: ImageUrl,
    },
    File {
        #[serde(skip_serializing_if = "Option::is_none", default)]
        file_id: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none", default)]
        file_data: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none", default)]
        filename: Option<String>,
    },
}

/// Image URL content part.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageUrl {
    /// http(s) URL or base64 data URL.
    pub url: String,
    /// `low`, `high`, `original`, or `auto`.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub detail: Option<String>,
}

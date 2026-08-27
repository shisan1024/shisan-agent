//! DeepSeek Chat Completions API integration.
//!
//! This module provides typed request/response structures and a small client
//! for calling DeepSeek's OpenAI-compatible chat completions endpoint.
//!
//! Reference: <https://api-docs.deepseek.com/zh-cn/>

use reqwest::{Client, Response, StatusCode};
use serde::{Deserialize, Serialize};
use std::time::Duration;

pub use super::types::*;

/// Standard DeepSeek chat completions base URL.
pub const DEFAULT_BASE_URL: &str = "https://api.deepseek.com";

/// Beta base URL used for beta features such as prefix continuation.
pub const BETA_BASE_URL: &str = "https://api.deepseek.com/beta";

/// DeepSeek chat completions endpoint path.
pub const CHAT_COMPLETIONS_PATH: &str = "/chat/completions";

/// Default number of retries after the initial request for retryable failures.
pub const DEFAULT_RETRY_TIMES: u32 = 3;

/// Base delay between retries in milliseconds. The delay increases linearly.
const RETRY_DELAY_BASE_MS: u64 = 500;

/// Model IDs documented by DeepSeek.
pub mod model {
    pub const V4_FLASH: &str = "deepseek-v4-flash";
    pub const V4_PRO: &str = "deepseek-v4-pro";
    pub const V4_FLASH_VISION_EXP: &str = "deepseek-v4-flash-vision-exp";
}

/// A helper enum for commonly used DeepSeek models.
///
/// Kept separate from `ChatCompletionRequest.model` so callers can still pass
/// arbitrary model strings when DeepSeek releases a new model.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DeepSeekModel {
    Flash,
    Pro,
    FlashVisionExp,
}

impl DeepSeekModel {
    /// Returns the DeepSeek model ID string.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Flash => model::V4_FLASH,
            Self::Pro => model::V4_PRO,
            Self::FlashVisionExp => model::V4_FLASH_VISION_EXP,
        }
    }
}

impl Default for DeepSeekModel {
    fn default() -> Self {
        Self::Pro
    }
}

impl From<DeepSeekModel> for String {
    fn from(value: DeepSeekModel) -> Self {
        value.as_str().to_owned()
    }
}

/// Errors returned by the DeepSeek API client.
#[derive(Debug, thiserror::Error)]
pub enum DeepSeekError {
    /// HTTP transport error.
    #[error("HTTP request failed: {0}")]
    Http(#[from] reqwest::Error),

    /// JSON serialization/deserialization error.
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    /// DeepSeek returned a non-success HTTP status.
    #[error("DeepSeek API error (HTTP {status}): {body}")]
    Api { status: u16, body: String },
}

/// Convenience result type for DeepSeek operations.
pub type DeepSeekResult<T> = Result<T, DeepSeekError>;

/// Client for DeepSeek Chat Completions API.
#[derive(Debug, Clone)]
pub struct DeepSeekClient {
    client: Client,
    base_url: String,
    api_key: String,
}

impl DeepSeekClient {
    /// Creates a client using the standard DeepSeek base URL.
    pub fn new(api_key: impl Into<String>) -> Self {
        Self::with_base_url(DEFAULT_BASE_URL, api_key)
    }

    /// Creates a client with a custom base URL (for example the beta URL).
    pub fn with_base_url(base_url: impl Into<String>, api_key: impl Into<String>) -> Self {
        Self {
            client: Client::new(),
            base_url: base_url.into(),
            api_key: api_key.into(),
        }
    }

    /// Creates a client using the beta DeepSeek base URL.
    pub fn with_beta_base_url(api_key: impl Into<String>) -> Self {
        Self::with_base_url(BETA_BASE_URL, api_key)
    }

    /// Creates a client with a pre-configured [`reqwest::Client`].
    pub fn with_client(
        client: Client,
        base_url: impl Into<String>,
        api_key: impl Into<String>,
    ) -> Self {
        Self {
            client,
            base_url: base_url.into(),
            api_key: api_key.into(),
        }
    }

    /// Creates a client with a pre-configured [`reqwest::Client`] and the
    /// standard DeepSeek base URL.
    pub fn with_http_client(client: Client, api_key: impl Into<String>) -> Self {
        Self::with_client(client, DEFAULT_BASE_URL, api_key)
    }

    /// Returns the current base URL.
    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    /// Returns the configured API key.
    pub fn api_key(&self) -> &str {
        &self.api_key
    }

    fn endpoint(&self) -> String {
        format!(
            "{}/{}",
            self.base_url.trim_end_matches('/'),
            CHAT_COMPLETIONS_PATH.trim_start_matches('/')
        )
    }

    /// Calls the non-streaming DeepSeek chat completions endpoint.
    ///
    /// Retries are controlled by `request.retry_times`.
    /// Retryable failures are transport errors and HTTP 408/429/5xx responses.
    pub async fn chat_completion(
        &self,
        request: &ChatCompletionRequest,
    ) -> DeepSeekResult<ChatCompletionResponse> {
        let body = serde_json::to_vec(request)?;
        let response = self.send_with_retry(body, request.retry_times).await?;

        Self::parse_response(response).await
    }

    /// Calls DeepSeek's SSE streaming chat completions endpoint.
    ///
    /// Retries are controlled by `request.retry_times`.
    /// Retryable failures are transport errors and HTTP 408/429/5xx responses.
    ///
    /// The returned [`reqwest::Response`] body is `text/event-stream` and can be
    /// consumed by the caller (for example via `response.bytes_stream()`).
    pub async fn chat_completion_stream(
        &self,
        request: &ChatCompletionRequest,
    ) -> DeepSeekResult<Response> {
        let mut stream_request = request.clone();
        stream_request.stream = Some(true);

        let body = serde_json::to_vec(&stream_request)?;
        let response = self.send_with_retry(body, request.retry_times).await?;

        if !response.status().is_success() {
            let status = response.status().as_u16();
            let body = response.text().await?;
            return Err(DeepSeekError::Api { status, body });
        }

        Ok(response)
    }

    async fn send_with_retry(&self, body: Vec<u8>, retry_times: u32) -> DeepSeekResult<Response> {
        let mut attempt = 0;

        loop {
            let result = self
                .client
                .post(self.endpoint())
                .bearer_auth(&self.api_key)
                .header(reqwest::header::CONTENT_TYPE, "application/json")
                .body(body.clone())
                .send()
                .await;

            match result {
                Ok(response)
                    if Self::is_retryable_status(response.status()) && attempt < retry_times =>
                {
                    attempt += 1;
                    tokio::time::sleep(Duration::from_millis(RETRY_DELAY_BASE_MS * attempt as u64))
                        .await;
                }
                Ok(response) => return Ok(response),
                Err(_error) if attempt < retry_times => {
                    attempt += 1;
                    tokio::time::sleep(Duration::from_millis(RETRY_DELAY_BASE_MS * attempt as u64))
                        .await;
                }
                Err(error) => return Err(DeepSeekError::Http(error)),
            }
        }
    }

    async fn parse_response(response: Response) -> DeepSeekResult<ChatCompletionResponse> {
        let status = response.status();
        let body = response.bytes().await?;

        if !status.is_success() {
            return Err(DeepSeekError::Api {
                status: status.as_u16(),
                body: String::from_utf8_lossy(&body).to_string(),
            });
        }

        Ok(serde_json::from_slice(&body)?)
    }

    fn is_retryable_status(status: StatusCode) -> bool {
        status == StatusCode::REQUEST_TIMEOUT
            || status == StatusCode::TOO_MANY_REQUESTS
            || status.is_server_error()
    }
}

/// Request body for DeepSeek chat completions.
///
/// All optional fields are omitted when set to `None`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatCompletionRequest {
    /// Model ID, for example `deepseek-v4-pro`.
    pub model: String,

    /// Conversation messages. Must contain at least one message.
    pub messages: Vec<Message>,

    /// Thinking mode switch.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub thinking: Option<Thinking>,

    /// Reasoning effort: `low`, `high`, or `max`.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub reasoning_effort: Option<String>,

    /// Maximum number of tokens to generate.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub max_tokens: Option<u64>,

    /// Response format, defaults to text if omitted.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub response_format: Option<ResponseFormat>,

    /// Stop sequence(s).
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub stop: Option<Stop>,

    /// When `true`, the API uses SSE streaming.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub stream: Option<bool>,

    /// Streaming options, only used when `stream=true`.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub stream_options: Option<StreamOptions>,

    /// Sampling temperature, 0–2.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub temperature: Option<f32>,

    /// Nucleus sampling probability, ≤ 1.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub top_p: Option<f32>,

    /// Callable tools.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub tools: Option<Vec<Tool>>,

    /// Controls tool call behavior.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub tool_choice: Option<ToolChoice>,

    /// Whether to return log probabilities.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub logprobs: Option<bool>,

    /// Number of top candidate tokens to return (0–20).
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub top_logprobs: Option<u8>,

    /// Business-side user identifier.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub user_id: Option<String>,

    /// Number of retries after the initial request for retryable failures.
    ///
    /// This is a local client setting and is not serialized to the provider API.
    #[serde(skip_serializing, default = "default_retry_times")]
    pub retry_times: u32,
}

impl Default for ChatCompletionRequest {
    fn default() -> Self {
        Self {
            model: model::V4_PRO.to_owned(),
            messages: Vec::new(),
            thinking: None,
            reasoning_effort: None,
            max_tokens: None,
            response_format: None,
            stop: None,
            stream: None,
            stream_options: None,
            temperature: None,
            top_p: None,
            tools: None,
            tool_choice: None,
            logprobs: None,
            top_logprobs: None,
            user_id: None,
            retry_times: DEFAULT_RETRY_TIMES,
        }
    }
}

impl ChatCompletionRequest {
    /// Creates a chat completion request with a single user message.
    pub fn new(model: impl Into<String>, user_message: impl Into<String>) -> Self {
        Self {
            model: model.into(),
            messages: vec![Message::User {
                content: MessageContent::Text(user_message.into()),
                name: None,
            }],
            ..Self::default()
        }
    }
}

/// Thinking mode switch.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Thinking {
    /// `enabled` or `disabled`.
    #[serde(default = "default_thinking_type")]
    pub r#type: String,
}

fn default_thinking_type() -> String {
    "enabled".to_owned()
}

fn default_retry_times() -> u32 {
    DEFAULT_RETRY_TIMES
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn request_serializes_with_expected_shape() {
        let request = ChatCompletionRequest::new(model::V4_PRO, "Hello!");

        let json = serde_json::to_value(&request).unwrap();

        assert_eq!(json["model"], model::V4_PRO);
        assert_eq!(json["messages"][0]["role"], "user");
        assert_eq!(json["messages"][0]["content"], "Hello!");
    }

    #[test]
    fn non_stream_response_deserializes() {
        let sample = r#"
        {
            "id": "1",
            "object": "chat.completion",
            "created": 1700000000,
            "model": "deepseek-v4-pro",
            "choices": [{
                "index": 0,
                "finish_reason": "stop",
                "message": {
                    "role": "assistant",
                    "content": "Hello!",
                    "reasoning_content": null,
                    "tool_calls": []
                }
            }],
            "usage": {
                "prompt_tokens": 10,
                "completion_tokens": 5,
                "total_tokens": 15
            }
        }"#;

        let response: ChatCompletionResponse = serde_json::from_str(sample).unwrap();
        assert_eq!(response.choices.len(), 1);
        assert_eq!(
            response.choices[0].message.content.as_deref(),
            Some("Hello!")
        );
        assert_eq!(response.usage.unwrap().total_tokens, 15);
    }

    #[test]
    fn stream_chunk_deserializes() {
        let sample = r#"
        {
            "id": "1",
            "object": "chat.completion.chunk",
            "created": 1700000000,
            "model": "deepseek-v4-pro",
            "choices": [{
                "index": 0,
                "delta": {
                    "role": "assistant",
                    "content": "Hello"
                },
                "finish_reason": null
            }]
        }"#;

        let chunk: ChatCompletionChunk = serde_json::from_str(sample).unwrap();
        assert_eq!(chunk.choices[0].delta.content.as_deref(), Some("Hello"));
    }
}

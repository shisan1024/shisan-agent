//! Provider call helpers.

use reqwest::{Client, Response, StatusCode};
use std::time::Duration;

/// Number of retries used by helper request functions.
pub const DEFAULT_RETRY_TIMES: u32 = 3;

/// Base delay between retries in milliseconds. The delay increases linearly.
const RETRY_DELAY_BASE_MS: u64 = 500;

/// Performs a non-streaming call to a provider endpoint.
///
/// The request body is sent as the POST body. This helper is intentionally
/// generic so each provider implementation can supply its own payload.
///
/// `retry_times` is the number of retries after the initial request.
/// Retryable failures are transport errors and HTTP 408/429/5xx responses.
pub async fn call(
    client: &Client,
    url: &str,
    body: impl Into<reqwest::Body> + Clone,
    retry_times: u32,
) -> Result<Response, reqwest::Error> {
    post_with_retry(client, url, body, retry_times).await
}

/// Performs a streaming call to a provider endpoint.
///
/// This returns the [`Response`] so the caller can choose to consume it as a
/// stream (for example with [`Response::bytes_stream`](reqwest::Response::bytes_stream)).
///
/// `retry_times` is the number of retries after the initial request.
/// Retryable failures are transport errors and HTTP 408/429/5xx responses.
pub async fn call_stream(
    client: &Client,
    url: &str,
    body: impl Into<reqwest::Body> + Clone,
    retry_times: u32,
) -> Result<Response, reqwest::Error> {
    post_with_retry(client, url, body, retry_times).await
}

async fn post_with_retry(
    client: &Client,
    url: &str,
    body: impl Into<reqwest::Body> + Clone,
    retry_times: u32,
) -> Result<Response, reqwest::Error> {
    let mut attempt = 0;

    loop {
        let result = client.post(url).body(body.clone()).send().await;

        match result {
            Ok(response) if is_retryable_status(response.status()) && attempt < retry_times => {
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
            Err(error) => return Err(error),
        }
    }
}

fn is_retryable_status(status: StatusCode) -> bool {
    status == StatusCode::REQUEST_TIMEOUT
        || status == StatusCode::TOO_MANY_REQUESTS
        || status.is_server_error()
}

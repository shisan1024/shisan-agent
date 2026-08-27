use agent_provider::provider_calling::model;
use agent_provider::{ChatCompletionRequest, DeepSeekClient};

const DEEPSEEK_API_KEY: &str = "sk-c220530eece94e7fbf61d04c4c6ccaed";

#[tokio::main]
async fn main() {
    // Smoke-test the exposed DeepSeek client with both non-streaming and streaming calls.
    let api_key = std::env::var("DEEPSEEK_API_KEY").unwrap_or_else(|_| DEEPSEEK_API_KEY.to_owned());
    let client = DeepSeekClient::new(api_key);
    let request = ChatCompletionRequest::new(model::V4_PRO, "Hello, DeepSeek!");

    println!("DeepSeekClient base URL: {}", client.base_url());
    println!("Chat request model: {}", request.model);
    println!("test main");

    // Non-streaming chat completion case.
    match client.chat_completion(&request).await {
        Ok(response) => {
            println!(
                "Non-stream response id: {}, model: {}",
                response.id, response.model
            );
            for choice in response.choices {
                println!(
                    "Non-stream choice: finish_reason={:?}, content={:?}",
                    choice.finish_reason, choice.message.content
                );
            }
        }
        Err(error) => eprintln!("Non-stream call failed: {error}"),
    }

    // Streaming chat completion case.
    match client.chat_completion_stream(&request).await {
        Ok(mut response) => {
            println!("Stream response status: {}", response.status());
            loop {
                match response.chunk().await {
                    Ok(Some(chunk)) => {
                        let text = String::from_utf8_lossy(&chunk);
                        if !text.trim().is_empty() {
                            println!("{}", text.trim_end());
                        }
                    }
                    Ok(None) => break,
                    Err(error) => {
                        eprintln!("Stream read error: {error}");
                        break;
                    }
                }
            }
        }
        Err(error) => eprintln!("Stream call failed: {error}"),
    }
}

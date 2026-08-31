use agent_provider::provider_calling::model;
use agent_provider::{ChatCompletionRequest, DeepSeekClient};

#[tokio::main]
async fn main() {
    // Smoke-test the exposed DeepSeek client with both non-streaming and streaming calls.
    // Load the API key from src/.env.
    dotenv::from_path(concat!(env!("CARGO_MANIFEST_DIR"), "/src/.env")).ok();
    let api_key = std::env::var("DEEPSEEK_API_KEY")
        .expect("DEEPSEEK_API_KEY must be defined in src/.env");
    let client = DeepSeekClient::new(api_key);
    let request = ChatCompletionRequest::new(model::V4_FLASH, "Hello, DeepSeek!");

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

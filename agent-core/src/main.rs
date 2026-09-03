use std::error::Error;


use agent_core::{agent::{Agent, Callable}, provider::Provider};
use futures_util::StreamExt;
use openai_api_rs::v1::chat_completion::chat_completion_stream::ChatCompletionStreamResponse;


#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    // create client, reads OPENAI_API_KEY environment variable for API key.
    let agent = Agent::new(Provider::OpenRouter, "inclusionai/ling-3.0-flash-fin:free".to_string());

    let mut result = agent.call_stream("hello").await?;
    
    while let Some(chunk) = result.next().await {
        match chunk {
            ChatCompletionStreamResponse::Content(content) => println!("content: {}", content),
            ChatCompletionStreamResponse::Reasoning(reason) => println!("reason: {}", reason),
            ChatCompletionStreamResponse::ToolCall(tools) => println!("tools: {:?}", tools),
            ChatCompletionStreamResponse::Done => {
                println!("done!");
                break;
            }
        }
    }

    Ok(())
}

use std::error::Error;

use openai_api_rs::v1::{api::OpenAIClient, 
    chat_completion::{self, ChatCompletionMessage, chat_completion::ChatCompletionRequest}
};


#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    // create client, reads OPENAI_API_KEY environment variable for API key.
    dotenv::from_path(concat!(env!("CARGO_MANIFEST_DIR"), "/src/.env")).ok();
    let api_key = std::env::var("DEEPSEEK_API_KEY")
        .expect("DEEPSEEK_API_KEY must be defined in src/.env");
    let mut client = OpenAIClient::builder()
                                    .with_endpoint("https://api.deepseek.com")
                                    .with_api_key(api_key).build()?;

    let req = ChatCompletionRequest::new(
        "deepseek-v4-flash".to_string(),
        vec![chat_completion::ChatCompletionMessage {
            role: chat_completion::MessageRole::user,
            content: chat_completion::Content::Text(String::from("What is bitcoin?")),
            name: None,
            tool_calls: None,
            tool_call_id: None,
        }],
    );

    let result = client.chat_completion(req).await?;
    println!("Content: {:?}", result.inner.choices[0].message.content);

    Ok(())
}

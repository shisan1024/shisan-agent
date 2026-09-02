use std::error::Error;

use openai_api_rs::v1::{
    chat_completion::{self, chat_completion::ChatCompletionRequest}
};

use agent_core::provider::{Agent, Provider};


#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    // create client, reads OPENAI_API_KEY environment variable for API key.
    let agent = Agent::new(Provider::Deepseek, "deepseek-v4-flash".to_string());

    let result = agent.call("hello").await?;
    println!("Content: {:?}", result.inner.choices[0].message.content);

    Ok(())
}

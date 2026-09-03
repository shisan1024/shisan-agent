use async_openai::{Client, config::OpenAIConfig, error::OpenAIError, 
    types::chat::{ChatCompletionRequestMessage, ChatCompletionRequestUserMessage, ChatCompletionRequestUserMessageContent, ChatCompletionResponseStream, CreateChatCompletionRequestArgs, CreateChatCompletionResponse}, 
};
use async_trait::async_trait;
use crate::agent::tool;

use super::Agent;

#[async_trait]
pub trait Callable {

    async fn call(self, message: &str) -> Result<CreateChatCompletionResponse, OpenAIError>;

    async fn call_stream(&self, message: &str) -> Result<ChatCompletionResponseStream, OpenAIError>;

}


#[async_trait]
impl Callable for Agent {

    async fn call(self, message: &str) -> Result<CreateChatCompletionResponse, OpenAIError> {
        let client: &Client<OpenAIConfig> = self.get_client();
        let model = self.get_model();
        let session = self.get_session();

        session.add_message(ChatCompletionRequestMessage::User(ChatCompletionRequestUserMessage {
                                            content: ChatCompletionRequestUserMessageContent::Text(message.to_string()),
                                            name: None
                                        })).await;
        let tools = vec![
            tool::SystemAgentTool::get_time()
        ];
        let req = CreateChatCompletionRequestArgs::default()
                                        .model(model.clone())
                                        .n(1)
                                        .messages(session.get_messages().await)
                                        .stream(true)
                                        .max_tokens(1024_u32)
                                        .tools(tools)
                                        .build()?;

        Ok(client.chat().create(req).await?)
    }

    async fn call_stream(&self, message: &str) -> Result<ChatCompletionResponseStream, OpenAIError> {
        
        let client: &Client<OpenAIConfig> = self.get_client();
        let model = self.get_model();
        let session = self.get_session();

        session.add_message(ChatCompletionRequestMessage::User(ChatCompletionRequestUserMessage {
                                            content: ChatCompletionRequestUserMessageContent::Text(message.to_string()),
                                            name: None
                                        })).await;
        let tools = vec![
            tool::SystemAgentTool::get_time()
        ];
        let req = CreateChatCompletionRequestArgs::default()
                                        .model(model.clone())
                                        .n(1)
                                        .messages(session.get_messages().await)
                                        .stream(true)
                                        .max_tokens(1024_u32)
                                        .tools(tools)
                                        .build()?;
        client.chat().create_stream(req).await
    }
}
use std::sync::Arc;

use openai_api_rs::v1::{
    api::OpenAIClient, 
    chat_completion::{self, ChatCompletionMessage, 
        chat_completion::{ChatCompletionRequest, ChatCompletionResponse}, 
        chat_completion_stream::{ChatCompletionStreamRequest, ChatCompletionStreamResponse}}, 
        error::APIError, responses::responses::CallResponse, 
};
use tokio::sync::Mutex;
use futures_util::Stream;
use async_trait::async_trait;

use crate::provider::Provider;
use super::call::Callable;

pub struct Agent {
    client: OpenAIClient,
    model: String,
    messages: Arc<Mutex<Vec<ChatCompletionMessage>>>
}


impl Agent {

    pub fn new(provider: Provider, model: String) -> Agent {
        Agent {
            client: Agent::client(provider).unwrap_or_else(|x| {
                panic!("Fail to create a agent client: {}", x);
            }),
            model,
            messages: Arc::new(Mutex::new(vec![]))
        }
    }

    fn client(provider: Provider) -> Result<OpenAIClient, Box<dyn std::error::Error>> {
        OpenAIClient::builder()
            .with_endpoint(provider.endpoint())
            .with_api_key(provider.api_key_from_env())
            .build()
    }
}

#[async_trait]
impl Callable for Agent {

    async fn call(self, message: &str) -> Result<CallResponse<ChatCompletionResponse>, APIError> {
        let client = &self.client;
        let mut messages = self.messages.lock().await;
        let user_msg = ChatCompletionMessage {
                role: chat_completion::MessageRole::user,
                content: chat_completion::Content::Text(String::from(message)),
                name: None,
                tool_calls: None,
                tool_call_id: None,
            };
        messages.push(user_msg);
        let req = ChatCompletionRequest::new(
            self.model.clone(), messages.clone(),
        );
        client.chat_completion(req).await
    }

    async fn call_stream(self, message: &str) -> Result<impl Stream<Item = ChatCompletionStreamResponse>, APIError> {
                let client = &self.client;
        let mut messages = self.messages.lock().await;
        let user_msg = ChatCompletionMessage {
                role: chat_completion::MessageRole::user,
                content: chat_completion::Content::Text(String::from(message)),
                name: None,
                tool_calls: None,
                tool_call_id: None,
            };
        messages.push(user_msg);
        let req = ChatCompletionStreamRequest::new(
            self.model.clone(), messages.clone(),
        );
        client.chat_completion_stream(req).await
    }
}
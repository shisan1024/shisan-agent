use openai_api_rs::v1::{chat_completion::{chat_completion::ChatCompletionResponse, chat_completion_stream::ChatCompletionStreamResponse}, error::APIError, responses::responses::CallResponse};
use futures_util::Stream;
use async_trait::async_trait;

#[async_trait]
pub trait Callable {

    async fn call(self, message: &str) -> Result<CallResponse<ChatCompletionResponse>, APIError>;

    async fn call_stream(self, message: &str) -> Result<impl Stream<Item = ChatCompletionStreamResponse>, APIError>;

}
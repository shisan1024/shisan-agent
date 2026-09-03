use std::sync::Arc;

use async_openai::types::chat::ChatCompletionRequestMessage;
use futures_util::lock::Mutex;
use uuid::Uuid;


pub struct Session {
    id: String,
    messages: Arc<Mutex<Vec<ChatCompletionRequestMessage>>>
}

impl Default for Session {
    fn default() -> Self {
        Session { 
            id: Uuid::new_v4().to_string(),
            messages: Arc::new(Mutex::new(vec![])) 
        }
    }
}

impl Session {

    pub async fn get_messages(&self) -> Vec<ChatCompletionRequestMessage> {
        let current_messages = self.messages.lock().await;
        current_messages.clone()
    }

    pub async fn add_message(&self, message: ChatCompletionRequestMessage) {
        let mut current_messages = self.messages.lock().await;
        current_messages.push(message);
    }
}
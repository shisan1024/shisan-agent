use genai::chat::{ChatMessage, Usage};
use uuid::Uuid;

pub struct Session {
    id: Uuid,
    messages: Vec<ChatMessage>,
    usage: Usage,
}

impl Default for Session {
    fn default() -> Self {
        Self {
            id: Uuid::new_v4(),
            messages: Vec::new(),
            usage: Usage::default(),
        }
    }
}

impl Session {
    pub fn id(&self) -> Uuid {
        self.id
    }

    pub fn messages(&self) -> &[ChatMessage] {
        &self.messages
    }

    pub fn usage(&self) -> &Usage {
        &self.usage
    }

    pub fn push(&mut self, message: ChatMessage) {
        self.messages.push(message);
    }

    pub fn record_usage(&mut self, usage: &Usage) {
        accumulate(&mut self.usage.prompt_tokens, usage.prompt_tokens);
        accumulate(&mut self.usage.completion_tokens, usage.completion_tokens);
        accumulate(&mut self.usage.total_tokens, usage.total_tokens);
    }
}

fn accumulate(acc: &mut Option<i32>, delta: Option<i32>) {
    if let Some(delta) = delta {
        *acc = Some(acc.unwrap_or(0) + delta);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn push_keeps_message_order() {
        let mut session = Session::default();
        session.push(ChatMessage::user("hi"));
        session.push(ChatMessage::assistant("hello"));
        assert_eq!(session.messages().len(), 2);
    }

    #[test]
    fn record_usage_accumulates_across_turns() {
        let mut session = Session::default();

        let first = Usage {
            prompt_tokens: Some(10),
            completion_tokens: Some(5),
            total_tokens: Some(15),
            ..Default::default()
        };

        let second = Usage {
            prompt_tokens: Some(3),
            completion_tokens: Some(2),
            total_tokens: Some(5),
            ..Default::default()
        };

        session.record_usage(&first);
        session.record_usage(&second);

        assert_eq!(session.usage().prompt_tokens, Some(13));
        assert_eq!(session.usage().completion_tokens, Some(7));
        assert_eq!(session.usage().total_tokens, Some(20));
    }
}

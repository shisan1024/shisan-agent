use uuid::Uuid;

use super::event::AguiEvent;

enum OpenMsg {
    None,
    Reasoning(String),
    Text(String),
}

fn new_message_id() -> String {
    Uuid::new_v4().to_string()
}

/// 单轮 LLM 流的分帧器：把交错的 Chunk/ReasoningChunk 切成
/// 若干条完整消息（START/CONTENT…/END），空 delta 不产生事件。
pub(super) struct TurnFramer {
    open: OpenMsg,
    text: String,
}

impl TurnFramer {
    pub(super) fn new() -> Self {
        Self {
            open: OpenMsg::None,
            text: String::new(),
        }
    }

    pub(super) fn push_text(&mut self, delta: &str) -> Vec<AguiEvent> {
        if delta.is_empty() {
            return Vec::new();
        }
        let mut events = Vec::new();
        if !matches!(self.open, OpenMsg::Text(_)) {
            events.extend(self.close());
            let id = new_message_id();
            events.push(AguiEvent::text_message_start(id.clone()));
            self.open = OpenMsg::Text(id);
        }
        let OpenMsg::Text(id) = &self.open else {
            unreachable!("open was just set to Text");
        };
        events.push(AguiEvent::TextMessageContent {
            message_id: id.clone(),
            delta: delta.to_string(),
        });
        self.text.push_str(delta);
        events
    }

    pub(super) fn push_reasoning(&mut self, delta: &str) -> Vec<AguiEvent> {
        if delta.is_empty() {
            return Vec::new();
        }
        let mut events = Vec::new();
        if !matches!(self.open, OpenMsg::Reasoning(_)) {
            events.extend(self.close());
            let id = new_message_id();
            events.push(AguiEvent::reasoning_message_start(id.clone()));
            self.open = OpenMsg::Reasoning(id);
        }
        let OpenMsg::Reasoning(id) = &self.open else {
            unreachable!("open was just set to Reasoning");
        };
        events.push(AguiEvent::ReasoningMessageContent {
            message_id: id.clone(),
            delta: delta.to_string(),
        });
        events
    }

    /// 关闭当前打开的消息；对未打开状态幂等。
    pub(super) fn close(&mut self) -> Vec<AguiEvent> {
        match std::mem::replace(&mut self.open, OpenMsg::None) {
            OpenMsg::None => Vec::new(),
            OpenMsg::Reasoning(id) => vec![AguiEvent::ReasoningMessageEnd { message_id: id }],
            OpenMsg::Text(id) => vec![AguiEvent::TextMessageEnd { message_id: id }],
        }
    }

    /// 本轮正文累计（不含 reasoning），供 session 回灌。
    pub(super) fn text(&self) -> &str {
        &self.text
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn message_ids(events: &[AguiEvent]) -> Vec<(&str, &str)> {
        events
            .iter()
            .filter_map(|event| match event {
                AguiEvent::TextMessageStart { message_id, .. } => Some(("text", message_id.as_str())),
                AguiEvent::ReasoningMessageStart { message_id, .. } => {
                    Some(("reasoning", message_id.as_str()))
                }
                _ => None,
            })
            .collect()
    }

    #[test]
    fn consecutive_text_chunks_share_one_message() {
        let mut framer = TurnFramer::new();
        let mut events = framer.push_text("你");
        events.extend(framer.push_text("好"));
        events.extend(framer.close());

        assert_eq!(events.len(), 4);
        let starts = message_ids(&events);
        assert_eq!(starts.len(), 1);
        assert_eq!(starts[0].0, "text");
        assert!(matches!(&events[3], AguiEvent::TextMessageEnd { .. }));
        assert_eq!(framer.text(), "你好");
    }

    #[test]
    fn interleaved_chunks_split_into_three_messages() {
        let mut framer = TurnFramer::new();
        let mut events = framer.push_text("answer");
        events.extend(framer.push_reasoning("wait"));
        events.extend(framer.push_text(" more"));
        events.extend(framer.close());

        assert_eq!(events.len(), 9);
        let starts = message_ids(&events);
        assert_eq!(starts.len(), 3);
        assert_eq!(starts[0].0, "text");
        assert_eq!(starts[1].0, "reasoning");
        assert_eq!(starts[2].0, "text");
        assert_ne!(starts[0].1, starts[2].1);
        // 交错处：旧消息先 END，新消息再 START
        assert!(matches!(&events[2], AguiEvent::TextMessageEnd { .. }));
        assert!(matches!(&events[3], AguiEvent::ReasoningMessageStart { .. }));
        assert!(matches!(&events[5], AguiEvent::ReasoningMessageEnd { .. }));
        assert!(matches!(&events[6], AguiEvent::TextMessageStart { .. }));
        assert_eq!(framer.text(), "answer more");
    }

    #[test]
    fn empty_deltas_emit_nothing() {
        let mut framer = TurnFramer::new();
        assert!(framer.push_text("").is_empty());
        assert!(framer.push_reasoning("").is_empty());
        assert!(framer.close().is_empty());
        assert_eq!(framer.text(), "");
    }

    #[test]
    fn close_is_idempotent() {
        let mut framer = TurnFramer::new();
        framer.push_text("hi");
        assert_eq!(framer.close().len(), 1);
        assert!(framer.close().is_empty());
        // close 后继续 push 会开新消息
        let events = framer.push_text("again");
        assert_eq!(message_ids(&events).len(), 1);
    }

    #[test]
    fn reasoning_does_not_count_into_text() {
        let mut framer = TurnFramer::new();
        framer.push_reasoning("deep thought");
        framer.push_text("done");
        assert_eq!(framer.text(), "done");
    }
}

use futures_util::{Stream, StreamExt};
use genai::Client;
use genai::chat::{ChatMessage, ChatRequest, ChatStreamEvent, ToolCall, ToolResponse, Usage};
use uuid::Uuid;

use crate::error::AgentError;
use crate::provider::Provider;
use crate::tool::{AgentTool, ToolSet};

use super::event::AguiEvent;
use super::framing::TurnFramer;
use super::session::Session;

const DEFAULT_MAX_TURNS: usize = 8;

pub struct Agent {
    client: Client,
    model: String,
    thread_id: String,
    session: Session,
    tools: ToolSet,
    max_turns: usize,
}

pub struct AgentBuilder {
    provider: Provider,
    model: String,
    system: Option<String>,
    thread_id: Option<String>,
    max_turns: usize,
    tools: ToolSet,
}

fn run_error_code(error: &AgentError) -> &'static str {
    match error {
        AgentError::MissingApiKey(_) => "MISSING_API_KEY",
        AgentError::Chat(_) => "CHAT_ERROR",
        AgentError::MaxTurnsExceeded(_) => "MAX_TURNS_EXCEEDED",
    }
}

impl Agent {
    pub fn builder(provider: Provider, model: impl Into<String>) -> AgentBuilder {
        AgentBuilder {
            provider,
            model: model.into(),
            system: None,
            thread_id: None,
            max_turns: DEFAULT_MAX_TURNS,
            tools: ToolSet::default(),
        }
    }

    pub fn model(&self) -> &str {
        &self.model
    }

    pub fn session(&self) -> &Session {
        &self.session
    }

    pub async fn run(&mut self, prompt: &str) -> Result<String, AgentError> {
        let mut stream = std::pin::pin!(self.run_stream_inner(prompt));
        let mut answer = String::new();
        while let Some(item) = stream.next().await {
            match item? {
                AguiEvent::TextMessageContent { delta, .. } => answer.push_str(&delta),
                AguiEvent::ToolCallResult { .. } => answer.clear(),
                _ => {}
            }
        }
        Ok(answer)
    }

    /// AG-UI 事件流：RUN_STARTED → 内容事件 → RUN_FINISHED / RUN_ERROR。
    /// 基础设施错误以 RUN_ERROR 事件收流，Item 不含 Result。
    pub fn run_stream(&mut self, prompt: &str) -> impl Stream<Item = AguiEvent> + '_ {
        let thread_id = self.thread_id.clone();
        let run_id = Uuid::new_v4().to_string();
        let inner = self.run_stream_inner(prompt);
        async_stream::stream! {
            yield AguiEvent::RunStarted {
                thread_id: thread_id.clone(),
                run_id: run_id.clone(),
            };
            let mut inner = std::pin::pin!(inner);
            loop {
                match inner.next().await {
                    Some(Ok(event)) => yield event,
                    Some(Err(error)) => {
                        yield AguiEvent::RunError {
                            thread_id,
                            run_id,
                            message: error.to_string(),
                            code: run_error_code(&error).to_string(),
                        };
                        break;
                    }
                    None => {
                        yield AguiEvent::RunFinished { thread_id, run_id };
                        break;
                    }
                }
            }
        }
    }

    fn run_stream_inner(
        &mut self,
        prompt: &str,
    ) -> impl Stream<Item = Result<AguiEvent, AgentError>> + '_ {
        let prompt = prompt.to_string();
        async_stream::try_stream! {
            self.session.push(ChatMessage::user(prompt));

            for _ in 0..self.max_turns {
                // ChatRequest 需要所有权，会话仍是唯一事实源，这里做一次边界拷贝
                let mut request = ChatRequest::new(self.session.messages().to_vec());
                if !self.tools.is_empty() {
                    request = request.with_tools(self.tools.definitions());
                }

                let response = self.client.exec_chat_stream(&self.model, request, None).await?;
                let mut stream = response.stream;

                let mut framer = TurnFramer::new();
                let mut tool_calls: Vec<ToolCall> = Vec::new();
                let mut usage = Usage::default();

                while let Some(event) = stream.next().await {
                    match event? {
                        ChatStreamEvent::Chunk(chunk) => {
                            for event in framer.push_text(&chunk.content) {
                                yield event;
                            }
                        }
                        ChatStreamEvent::ReasoningChunk(chunk) => {
                            for event in framer.push_reasoning(&chunk.content) {
                                yield event;
                            }
                        }
                        ChatStreamEvent::End(end) => {
                            if let Some(captured) = end.captured_tool_calls() {
                                tool_calls = captured.into_iter().cloned().collect();
                            }
                            if let Some(captured) = end.captured_usage {
                                usage = captured;
                            }
                        }
                        _ => {}
                    }
                }

                self.session.record_usage(&usage);

                for event in framer.close() {
                    yield event;
                }

                if tool_calls.is_empty() {
                    self.session.push(ChatMessage::assistant(framer.text().to_string()));
                    return;
                }

                self.session.push(ChatMessage::from(tool_calls.clone()));
                for call in tool_calls {
                    let ToolCall {
                        call_id,
                        fn_name,
                        fn_arguments,
                        ..
                    } = call;
                    let args_json = fn_arguments.to_string();
                    yield AguiEvent::ToolCallStart {
                        tool_call_id: call_id.clone(),
                        tool_call_name: fn_name.clone(),
                    };
                    yield AguiEvent::ToolCallArgs {
                        tool_call_id: call_id.clone(),
                        delta: args_json,
                    };
                    yield AguiEvent::ToolCallEnd {
                        tool_call_id: call_id.clone(),
                    };
                    let output = self.tools.dispatch(&fn_name, fn_arguments).await;
                    yield AguiEvent::ToolCallResult {
                        message_id: Uuid::new_v4().to_string(),
                        tool_call_id: call_id.clone(),
                        content: output.clone(),
                    };
                    self.session.push(ChatMessage::from(ToolResponse::new(call_id, output)));
                }
            }

            Err(AgentError::MaxTurnsExceeded(self.max_turns))?;
        }
    }
}

impl AgentBuilder {
    pub fn system(mut self, system: impl Into<String>) -> Self {
        self.system = Some(system.into());
        self
    }

    pub fn thread_id(mut self, thread_id: impl Into<String>) -> Self {
        self.thread_id = Some(thread_id.into());
        self
    }

    pub fn max_turns(mut self, max_turns: usize) -> Self {
        self.max_turns = max_turns;
        self
    }

    pub fn tool<T: AgentTool>(mut self, tool: T) -> Self {
        self.tools.register(tool);
        self
    }

    pub fn build(self) -> Result<Agent, AgentError> {
        let client = self.provider.build_client()?;
        let mut session = Session::default();
        if let Some(system) = self.system {
            session.push(ChatMessage::system(system));
        }
        Ok(Agent {
            client,
            model: self.model,
            thread_id: self.thread_id.unwrap_or_else(|| Uuid::new_v4().to_string()),
            session,
            tools: self.tools,
            max_turns: self.max_turns,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn run_error_code_maps_every_variant() {
        assert_eq!(
            run_error_code(&AgentError::MissingApiKey("OPENROUTER_API_KEY")),
            "MISSING_API_KEY"
        );
        let serde_err = serde_json::from_str::<serde_json::Value>("not json").unwrap_err();
        assert_eq!(
            run_error_code(&AgentError::Chat(genai::Error::SerdeJson(serde_err))),
            "CHAT_ERROR"
        );
        assert_eq!(
            run_error_code(&AgentError::MaxTurnsExceeded(8)),
            "MAX_TURNS_EXCEEDED"
        );
    }

    #[test]
    fn thread_id_defaults_to_uuid_and_builder_overrides() {
        let agent = Agent::builder(Provider::OpenRouter, "m").build().unwrap();
        assert_eq!(agent.thread_id.len(), 36);

        let agent = Agent::builder(Provider::OpenRouter, "m")
            .thread_id("conv-42")
            .build()
            .unwrap();
        assert_eq!(agent.thread_id, "conv-42");
    }
}

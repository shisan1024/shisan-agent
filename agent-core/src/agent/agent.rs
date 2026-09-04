use futures_util::{Stream, StreamExt};
use genai::Client;
use genai::chat::{ChatMessage, ChatRequest, ChatStreamEvent, ToolCall, ToolResponse, Usage};

use crate::error::AgentError;
use crate::provider::Provider;
use crate::tool::{AgentTool, ToolSet};

use super::event::AgentEvent;
use super::session::Session;

const DEFAULT_MAX_TURNS: usize = 8;

pub struct Agent {
    client: Client,
    model: String,
    session: Session,
    tools: ToolSet,
    max_turns: usize,
}

pub struct AgentBuilder {
    provider: Provider,
    model: String,
    system: Option<String>,
    max_turns: usize,
    tools: ToolSet,
}

impl Agent {
    pub fn builder(provider: Provider, model: impl Into<String>) -> AgentBuilder {
        AgentBuilder {
            provider,
            model: model.into(),
            system: None,
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
        let mut stream = std::pin::pin!(self.run_stream(prompt));
        let mut answer = String::new();
        while let Some(event) = stream.next().await {
            if let AgentEvent::Done { text } = event? {
                answer = text;
            }
        }
        Ok(answer)
    }

    pub fn run_stream(
        &mut self,
        prompt: &str,
    ) -> impl Stream<Item = Result<AgentEvent, AgentError>> + '_ {
        let prompt = prompt.to_string();
        async_stream::try_stream! {
            self.session.push(ChatMessage::user(prompt));
            let mut finished = false;

            for _ in 0..self.max_turns {
                // ChatRequest 需要所有权，会话仍是唯一事实源，这里做一次边界拷贝
                let mut request = ChatRequest::new(self.session.messages().to_vec());
                if !self.tools.is_empty() {
                    request = request.with_tools(self.tools.definitions());
                }

                let response = self.client.exec_chat_stream(&self.model, request, None).await?;
                let mut stream = response.stream;

                let mut text = String::new();
                let mut tool_calls: Vec<ToolCall> = Vec::new();
                let mut usage = Usage::default();

                while let Some(event) = stream.next().await {
                    match event? {
                        ChatStreamEvent::Chunk(chunk) => {
                            text.push_str(&chunk.content);
                            yield AgentEvent::TextDelta { text: chunk.content };
                        }
                        ChatStreamEvent::ReasoningChunk(chunk) => {
                            yield AgentEvent::ReasoningDelta { text: chunk.content };
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

                if tool_calls.is_empty() {
                    self.session.push(ChatMessage::assistant(text.clone()));
                    yield AgentEvent::Done { text };
                    finished = true;
                    break;
                }

                self.session.push(ChatMessage::from(tool_calls.clone()));
                for call in tool_calls {
                    let ToolCall {
                        call_id,
                        fn_name,
                        fn_arguments,
                        ..
                    } = call;
                    yield AgentEvent::ToolStarted {
                        id: call_id.clone(),
                        name: fn_name.clone(),
                    };
                    let output = self.tools.dispatch(&fn_name, fn_arguments).await;
                    yield AgentEvent::ToolFinished {
                        id: call_id.clone(),
                        name: fn_name,
                        output: output.clone(),
                    };
                    self.session.push(ChatMessage::from(ToolResponse::new(call_id, output)));
                }
            }

            if !finished {
                Err(AgentError::MaxTurnsExceeded(self.max_turns))?;
            }
        }
    }
}

impl AgentBuilder {
    pub fn system(mut self, system: impl Into<String>) -> Self {
        self.system = Some(system.into());
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
            session,
            tools: self.tools,
            max_turns: self.max_turns,
        })
    }
}

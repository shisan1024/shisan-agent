use std::collections::HashMap;

use async_openai::config::OpenAIConfig;
use async_openai::types::chat::FinishReason;
use async_openai::{Client};
use futures_util::StreamExt;


use crate::agent::{Callable, tool};
use crate::provider::Provider;
use super::session::Session;

pub struct Agent {
    client: Client<OpenAIConfig>,
    model: String,
    session: Session,
}

impl Agent {

    pub async fn run(&self, message: &str) {
        loop {
            // key: tool_call_id, value: 累加后的 arguments 字符串
            let mut tool_call_map: HashMap<String, String> = HashMap::new();
            let mut cur_tool_name = String::new();
            if let Ok(mut stream) = self.call_stream(message).await {
                while let Some(Ok(chunk)) = stream.next().await {
                    
                    
                    if let Some(tool_calls) = &chunk.choices[0].delta.tool_calls {
                        println!("{:?}", tool_calls);
                        for tool_call in tool_calls {
                            if let Some(func_stream) = &tool_call.function {
                                if let Some(tool_name) = &func_stream.name {
                                    cur_tool_name = tool_name.clone();
                                } else {
                                    let params = func_stream.arguments.as_deref().unwrap_or("");
                                    tool_call_map.entry(cur_tool_name.clone())
                                                .and_modify(|cur_param| cur_param.push_str(params))
                                                .or_insert(String::from(params));
                                }
                            }
                        }
                        if let Some(stop_reason) = chunk.choices[0].finish_reason {
                            // record current session.
                            match stop_reason {
                                FinishReason::Stop => {
                                    println!("stop");
                                    break
                                }
                                FinishReason::Length => {
                                    println!("length");
                                    break
                                }
                                FinishReason::ContentFilter => {
                                    println!("content filter");
                                    break
                                }
                                FinishReason::ToolCalls => {
                                    println!("tool calls");
                                    break
                                }
                                FinishReason::FunctionCall => {
                                    println!("function call");
                                    break
                                }
                            }
                        }
                        if let Some(content) = &chunk.choices[0].delta.content && content != "" {
                            // print!("{},", content);
                        }
                    }
                }
            println!("current tool_call: {:?}", tool_call_map);
            break
            }
        }
    }

    pub fn new(provider: Provider, model: String) -> Agent {
        Agent {
            client: Agent::client(provider).unwrap_or_else(|x| {
                panic!("Fail to create a agent client: {}", x);
            }),
            model,
            session: Session::default()
        }
    }

    pub fn get_client<'a>(&'a self) -> &'a Client<OpenAIConfig> {
        &self.client
    }

    pub fn get_model(&self) -> String {
        self.model.clone()
    }

    pub fn get_session<'a>(&'a self) -> &'a Session {
        &self.session
    }

    fn client(provider: Provider) -> Result<Client<OpenAIConfig>, Box<dyn std::error::Error>> {
        let config = OpenAIConfig::new();
        Ok(Client::with_config(config.with_api_base(provider.endpoint())
            .with_api_key(provider.api_key_from_env())
            .with_project_id("shisan-agent")))
    }
}
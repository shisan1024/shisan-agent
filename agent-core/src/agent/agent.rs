use async_openai::config::OpenAIConfig;
use async_openai::{Client};


use crate::provider::Provider;
use super::session::Session;

pub struct Agent {
    client: Client<OpenAIConfig>,
    model: String,
    session: Session,
}

impl Agent {

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
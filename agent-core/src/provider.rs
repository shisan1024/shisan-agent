use openai_api_rs::v1::{
    api::OpenAIClient, chat_completion::{self, ChatCompletionMessage, 
        chat_completion::{ChatCompletionRequest, ChatCompletionResponse}}, error::APIError, responses::responses::CallResponse, 
};


pub struct Agent {
    client: OpenAIClient,
    model: String,
    messages: Vec<ChatCompletionMessage>
}

pub enum Provider {
    Deepseek,
}

impl Agent {

    pub async fn call(self, message: &str) -> Result<CallResponse<ChatCompletionResponse>, APIError> {
        let client = &self.client;
        client.chat_completion(ChatCompletionRequest::new(
            self.model.clone(), vec![ChatCompletionMessage {
                role: chat_completion::MessageRole::user,
                content: chat_completion::Content::Text(String::from(message)),
                name: None,
                tool_calls: None,
                tool_call_id: None,
            }],
        )).await
    }

    pub fn new(provider: Provider, model: String) -> Agent {
        Agent {
            client: Agent::client(provider).unwrap_or_else(|x| {
                panic!("Fail to create a agent client: {}", x);
            }),
            model,
            messages: vec![]
        }
    }

    fn client(provider: Provider) -> Result<OpenAIClient, Box<dyn std::error::Error>> {
        OpenAIClient::builder()
            .with_endpoint(Agent::endpoint(&provider))
            .with_api_key(Agent::api_key_from_env(&provider))
            .build()
    }

    fn endpoint(provider: &Provider) -> String {
        match provider {
            Provider::Deepseek => String::from("https://api.deepseek.com"),
        }
    }

    fn api_key_from_env(provider: &Provider) -> String{
        dotenv::from_path(concat!(env!("CARGO_MANIFEST_DIR"), "/src/.env")).ok();
        let api_key = std::env::var(match provider {
            Provider::Deepseek => "DEEPSEEK_API_KEY"
        })
            .expect("API_KEY must be defined in env");
        api_key
    }
}
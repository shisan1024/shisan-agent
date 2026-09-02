

pub enum Provider {
    Deepseek,
    OpenRouter
}

impl Provider {

    pub fn endpoint(&self) -> String {
        String::from(match self {
            Provider::Deepseek => "https://api.deepseek.com",
            Provider::OpenRouter => "https://openrouter.ai/api/v1"
        })
    }

    pub fn api_key_from_env(&self) -> String{
        dotenv::from_path(concat!(env!("CARGO_MANIFEST_DIR"), "/src/.env")).ok();
        let api_key = std::env::var(match self {
            Provider::Deepseek => "DEEPSEEK_API_KEY",
            Provider::OpenRouter => "OPENROUTER_API_KEY",
        })
            .expect("API_KEY must be defined in env");
        api_key
    }
}
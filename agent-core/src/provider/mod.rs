use genai::adapter::AdapterKind;
use genai::chat::ChatOptions;
use genai::resolver::{AuthData, Endpoint, ServiceTargetResolver};
use genai::{Client, ModelIden, ServiceTarget};

use crate::error::AgentError;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Provider {
    Deepseek,
    OpenRouter,
}

impl Provider {
    pub fn key_env_var(self) -> &'static str {
        match self {
            Self::Deepseek => "DEEPSEEK_API_KEY",
            Self::OpenRouter => "OPENROUTER_API_KEY",
        }
    }

    // genai 在 endpoint 后直接拼 "chat/completions"，尾斜杠不能省
    pub fn endpoint(self) -> &'static str {
        match self {
            Self::Deepseek => "https://api.deepseek.com/",
            Self::OpenRouter => "https://openrouter.ai/api/v1/",
        }
    }

    pub fn ensure_api_key(self) -> Result<(), AgentError> {
        dotenv::from_path(concat!(env!("CARGO_MANIFEST_DIR"), "/src/.env")).ok();
        let var = self.key_env_var();
        std::env::var(var)
            .map(|_| ())
            .map_err(|_| AgentError::MissingApiKey(var))
    }

    pub(crate) fn build_client(self) -> Result<Client, AgentError> {
        self.ensure_api_key()?;
        let builder = Client::builder().with_chat_options(default_chat_options());
        let client = match self {
            Self::Deepseek => builder.build(),
            Self::OpenRouter => builder
                .with_service_target_resolver(openrouter_resolver())
                .build(),
        };
        Ok(client)
    }
}

fn default_chat_options() -> ChatOptions {
    ChatOptions::default()
        .with_capture_usage(true)
        .with_capture_tool_calls(true)
        .with_normalize_reasoning_content(true)
}

fn openrouter_resolver() -> ServiceTargetResolver {
    ServiceTargetResolver::from_resolver_fn(
        |target: ServiceTarget| -> Result<ServiceTarget, genai::resolver::Error> {
            let ServiceTarget { model, .. } = target;
            Ok(ServiceTarget {
                endpoint: Endpoint::from_static(Provider::OpenRouter.endpoint()),
                auth: AuthData::from_env(Provider::OpenRouter.key_env_var()),
                model: ModelIden::new(AdapterKind::OpenAI, model.model_name),
            })
        },
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn endpoints_keep_trailing_slash_for_genai_path_join() {
        assert!(Provider::Deepseek.endpoint().ends_with('/'));
        assert!(Provider::OpenRouter.endpoint().ends_with('/'));
    }

    #[test]
    fn key_env_vars_match_providers() {
        assert_eq!(Provider::Deepseek.key_env_var(), "DEEPSEEK_API_KEY");
        assert_eq!(Provider::OpenRouter.key_env_var(), "OPENROUTER_API_KEY");
    }
}

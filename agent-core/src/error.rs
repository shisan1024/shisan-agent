#[derive(Debug, thiserror::Error)]
pub enum AgentError {
    #[error("missing API key env var `{0}`")]
    MissingApiKey(&'static str),
    #[error(transparent)]
    Chat(#[from] genai::Error),
    #[error("agent exceeded max turns ({0})")]
    MaxTurnsExceeded(usize),
}

#[derive(Debug, thiserror::Error)]
pub enum ToolError {
    #[error("invalid arguments: {0}")]
    InvalidArgs(#[from] serde_json::Error),
    #[error("{0}")]
    Execution(String),
}

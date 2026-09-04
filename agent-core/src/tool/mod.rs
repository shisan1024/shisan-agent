mod erased;

pub mod builtin;

pub(crate) use erased::ToolSet;

use schemars::JsonSchema;
use serde::de::DeserializeOwned;

use crate::error::ToolError;

pub trait AgentTool: Send + Sync + 'static {
    const NAME: &'static str;
    const DESCRIPTION: &'static str;
    type Args: DeserializeOwned + JsonSchema + Send;

    fn call(&self, args: Self::Args) -> impl Future<Output = Result<String, ToolError>> + Send;
}

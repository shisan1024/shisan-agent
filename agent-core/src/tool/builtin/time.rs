use chrono::Utc;
use schemars::JsonSchema;
use serde::Deserialize;

use crate::error::ToolError;
use crate::tool::AgentTool;

#[derive(Deserialize, JsonSchema)]
pub struct GetTimeArgs {}

pub struct GetTime;

impl AgentTool for GetTime {
    const NAME: &'static str = "get_time";
    const DESCRIPTION: &'static str = "get current time (UTC, RFC3339)";
    type Args = GetTimeArgs;

    async fn call(&self, _args: GetTimeArgs) -> Result<String, ToolError> {
        Ok(Utc::now().to_rfc3339())
    }
}

#[cfg(test)]
mod tests {
    use chrono::DateTime;

    use super::*;

    #[tokio::test]
    async fn get_time_returns_rfc3339() {
        let out = GetTime
            .call(GetTimeArgs {})
            .await
            .expect("get_time never fails");
        DateTime::parse_from_rfc3339(&out).expect("output is RFC3339");
    }
}

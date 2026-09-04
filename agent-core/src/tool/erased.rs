use std::collections::HashMap;
use std::pin::Pin;

use genai::chat::Tool;
use serde_json::Value;

use crate::error::ToolError;

use super::AgentTool;

trait ErasedTool: Send + Sync {
    fn definition(&self) -> Tool;
    fn call_json(
        &self,
        args: Value,
    ) -> Pin<Box<dyn Future<Output = Result<String, ToolError>> + Send + '_>>;
}

impl<T: AgentTool> ErasedTool for T {
    fn definition(&self) -> Tool {
        let schema = serde_json::to_value(schemars::schema_for!(T::Args))
            .expect("derived JsonSchema serializes to JSON");
        Tool::new(T::NAME)
            .with_description(T::DESCRIPTION)
            .with_schema(schema)
    }

    fn call_json(
        &self,
        args: Value,
    ) -> Pin<Box<dyn Future<Output = Result<String, ToolError>> + Send + '_>> {
        Box::pin(async move {
            let args: T::Args = serde_json::from_value(args)?;
            self.call(args).await
        })
    }
}

#[derive(Default)]
pub(crate) struct ToolSet {
    tools: HashMap<&'static str, Box<dyn ErasedTool>>,
}

impl ToolSet {
    pub(crate) fn register<T: AgentTool>(&mut self, tool: T) {
        self.tools.insert(T::NAME, Box::new(tool));
    }

    pub(crate) fn definitions(&self) -> Vec<Tool> {
        self.tools.values().map(|tool| tool.definition()).collect()
    }

    pub(crate) fn is_empty(&self) -> bool {
        self.tools.is_empty()
    }

    pub(crate) async fn dispatch(&self, name: &str, args: Value) -> String {
        let Some(tool) = self.tools.get(name) else {
            return format!("Error: unknown tool `{name}`");
        };
        // 部分模型对无参工具会发 null 而非 {}
        let args = if args.is_null() {
            Value::Object(Default::default())
        } else {
            args
        };
        tool.call_json(args)
            .await
            .unwrap_or_else(|err| format!("Error: {err}"))
    }
}

#[cfg(test)]
mod tests {
    use schemars::JsonSchema;
    use serde::Deserialize;
    use serde_json::json;

    use super::*;

    #[derive(Deserialize, JsonSchema)]
    struct EchoArgs {
        message: String,
    }

    struct Echo;

    impl AgentTool for Echo {
        const NAME: &'static str = "echo";
        const DESCRIPTION: &'static str = "echo the message back";
        type Args = EchoArgs;

        async fn call(&self, args: EchoArgs) -> Result<String, ToolError> {
            Ok(args.message)
        }
    }

    fn echo_set() -> ToolSet {
        let mut set = ToolSet::default();
        set.register(Echo);
        set
    }

    #[test]
    fn definition_exposes_name_description_and_object_schema() {
        let defs = echo_set().definitions();
        assert_eq!(defs.len(), 1);
        let def = &defs[0];
        assert_eq!(def.name, "echo".into());
        assert_eq!(def.description.as_deref(), Some("echo the message back"));
        let schema = def.schema.as_ref().expect("schema generated from Args");
        assert_eq!(schema["type"], "object");
        assert!(schema["properties"]["message"].is_object());
    }

    #[tokio::test]
    async fn dispatch_runs_tool_with_typed_args() {
        let out = echo_set().dispatch("echo", json!({"message": "hi"})).await;
        assert_eq!(out, "hi");
    }

    #[tokio::test]
    async fn dispatch_reports_invalid_args_as_text() {
        let out = echo_set().dispatch("echo", json!({"message": 42})).await;
        assert!(out.starts_with("Error:"), "got: {out}");
    }

    #[tokio::test]
    async fn dispatch_reports_unknown_tool_as_text() {
        let out = echo_set().dispatch("nope", json!({})).await;
        assert!(out.contains("unknown tool"), "got: {out}");
    }

    #[tokio::test]
    async fn dispatch_normalizes_null_args_to_empty_object() {
        #[derive(Deserialize, JsonSchema)]
        struct NoArgs {}

        struct Nullary;

        impl AgentTool for Nullary {
            const NAME: &'static str = "nullary";
            const DESCRIPTION: &'static str = "no-arg tool";
            type Args = NoArgs;

            async fn call(&self, _: NoArgs) -> Result<String, ToolError> {
                Ok("ok".into())
            }
        }

        let mut set = ToolSet::default();
        set.register(Nullary);
        let out = set.dispatch("nullary", Value::Null).await;
        assert_eq!(out, "ok");
    }
}

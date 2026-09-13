use schemars::JsonSchema;
use serde::Deserialize;

use crate::error::ToolError;
use crate::tool::AgentTool;

/// `note_init` 的入参：字段顺序即卡片上的展示顺序，schema 描述会随工具定义发给模型，
/// 是约束模型输出形状的唯一手段。
#[derive(Deserialize, JsonSchema)]
pub struct NoteInitArgs {
    /// 灵感主体：剥掉"帮我记录一下""我有个想法""I have an idea"这类开场白和指令后剩下的内容，
    /// 逐字保留用户用词，不要改写、润色、补充标点或翻译。
    /// 例：用户说"帮我记一下，我有个想法，做一个只给自己用的 app" → 取"做一个只给自己用的 app"
    pub content: String,
    /// 从内容里提炼的 2-5 个关键词，名词或短语，不要整句
    pub keywords: Vec<String>,
}

pub struct NoteInit;

impl AgentTool for NoteInit {
    const NAME: &'static str = "note_init";
    const DESCRIPTION: &'static str =
        "在聊天窗口展示一张灵感速记卡片，等待用户确认或取消。卡片由前端渲染，调用后不要复述卡片内容";
    type Args = NoteInitArgs;

    async fn call(&self, args: NoteInitArgs) -> Result<String, ToolError> {
        if args.content.trim().is_empty() {
            return Err(ToolError::Execution("content 不能为空".to_string()));
        }
        // 卡片由前端依据本次调用的参数渲染，工具本身不持有 UI 状态。
        // 回执只报状态、不回显内容：让模型知道轮次可以收尾，且不会照着回执重复朗读一遍。
        Ok(format!(
            "draft card shown with {} keywords, pending user confirmation",
            args.keywords.len()
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(content: &str, keywords: &[&str]) -> NoteInitArgs {
        NoteInitArgs {
            content: content.to_string(),
            keywords: keywords.iter().map(|k| k.to_string()).collect(),
        }
    }

    #[tokio::test]
    async fn note_init_acknowledges_without_echoing_content() {
        let out = NoteInit
            .call(args("做一个会记灵感的桌面宠物", &["桌面宠物", "灵感记录"]))
            .await
            .expect("non-empty content never fails");

        assert!(out.contains("2 keywords"), "got: {out}");
        assert!(
            !out.contains("桌面宠物"),
            "回执不应复述卡片内容，否则模型会重复朗读: {out}"
        );
    }

    #[tokio::test]
    async fn note_init_rejects_blank_content() {
        let result = NoteInit.call(args("   \n ", &[])).await;
        assert!(result.is_err());
    }

    /// 字段的 doc 注释是模型唯一的取词依据：它必须真的进到发给模型的 schema 里，
    /// 否则模型只会把用户整句话照抄下来，抽取规则形同虚设。
    #[test]
    fn schema_carries_the_extraction_rule_to_the_model() {
        let schema = serde_json::to_value(schemars::schema_for!(NoteInitArgs))
            .expect("derived JsonSchema serializes to JSON");
        let content = schema["properties"]["content"]["description"]
            .as_str()
            .expect("content 字段必须有 description");

        assert!(content.contains("灵感主体"), "got: {content}");
        assert!(content.contains("开场白"), "got: {content}");
        // keywords 仍需保留，避免回归成"只抽正文、不抽关键词"
        assert!(schema["properties"]["keywords"]["description"].is_string());
    }
}

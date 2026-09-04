use async_trait::async_trait;
use serde_json::Value;

#[async_trait]
pub trait RunnableTool: Send + Sync + 'static {
    async fn run(&self, value: Value) -> String;
}

// 适配器结构体，把闭包包起来，然后实现 RunnableTool
pub struct AsyncToolWrapper<F, Fut>
where
    F: Fn(Value) -> Fut + Send + Sync + 'static,
    Fut: Future<Output = String> + Send + 'static,
{
    func: F,
}

#[async_trait]
impl<F, Fut> RunnableTool for AsyncToolWrapper<F, Fut>
where
    F: Fn(Value) -> Fut + Send + Sync + 'static,
    Fut: Future<Output = String> + Send + 'static,
{
    async fn run(&self, value: Value) -> String {
        (self.func)(value).await
    }
}

// 构造辅助函数，方便快速创建匿名工具
pub fn tool_fn<F, Fut>(f: F) -> Box<dyn RunnableTool>
where
    F: Fn(Value) -> Fut + Send + Sync + 'static,
    Fut: Future<Output = String> + Send + 'static,
{
    Box::new(AsyncToolWrapper { func: f })
}
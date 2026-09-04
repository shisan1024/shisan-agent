use agent_core::tool::builtin::GetTime;
use agent_core::{Agent, AgentError, Provider};

#[tokio::main]
async fn main() -> Result<(), AgentError> {
    let mut agent = Agent::builder(Provider::OpenRouter, "z-ai/glm-5.3-flash")
        .tool(GetTime)
        .build()?;

    let answer = agent.run("hello, what time is it now?").await?;

    println!("{answer}");
    println!("usage: {:?}", agent.session().usage());
    Ok(())
}

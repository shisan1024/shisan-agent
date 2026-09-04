use std::error::Error;


use agent_core::{agent::{Agent, Callable}, provider::Provider};
use futures_util::StreamExt;


#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    // create client, reads OPENAI_API_KEY environment variable for API key.
    let mut agent = Agent::new(Provider::OpenRouter, "inclusionai/ling-3.0-flash-fin:free".to_string());

    // let mut result = agent.call_stream("what time is it now?").await?;
    
    
    // while let Some(response) = result.next().await {
    //     match response {
    //         Ok(ccr) => {
    //             println!("{:?}", ccr);
    //             ccr.choices.iter().for_each(|c| {
    //                 if let Some(ref content) = c.delta.content {
    //                     println!("{}", content);
    //                 }
    //             })
    //         },
    //         Err(e) => eprintln!("{e:?}"),
    //     }
    // }
    agent.run("hello, use all the tools you can use!").await;

    Ok(())
}

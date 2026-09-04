#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use agent_core::tool::builtin::GetTime;
use agent_core::{Agent, AgentError, AgentEvent, Provider};
use futures_util::StreamExt;
use tauri::Manager;
use tauri::State;
use tauri::ipc::Channel;
use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;

// 事件间隔超时：模型/网关挂起时不再永久卡住会话
const CHAT_IDLE_TIMEOUT: Duration = Duration::from_secs(90);

const ANGELINA_SYSTEM_PROMPT: &str = r#"你是 Angelina（安琪莉娜），住在用户桌面上的元气少女伙伴。

# 性格
- 极度积极乐观：任何话题都能找到闪光点，遇到困难第一反应是"我们一定有办法！"
- 永远快乐热情：对用户说的每件事都抱有真诚的好奇心，情绪稳定地保持高能量，不会突然冷淡
- 真诚不敷衍：热情是真的，帮忙也是真的——答案必须准确，不知道就大方承认，然后拉着用户一起想办法

# 语气与用词
- 说话活泼生动、节奏轻快，多用短句，少用书面腔
- 自然使用语气词（"呀""啦""哦""诶嘿""哇"）和感叹号，但一句话最多一个感叹号，不堆砌
- 偶尔用一个表情符号或颜文字点缀（✨、(＾▽＾)），一条回复不超过两个
- 喜欢用生动的比喻和有画面感的说法，代替干巴巴的说明
- 称呼用户亲切自然，不谄媚、不装嗲

# 互动方式
- 先接住用户的情绪，再解决问题：用户开心就一起开心，用户沮丧就先打打气再帮忙
- 回答简洁有重点，长内容拆成轻快的小段，别一口气糊一大坨
- 主动一点：办完事可以顺手补一个贴心的小提示或轻巧的追问，但绝不啰嗦
- 需要查时间等信息时自然地使用工具，拿到结果后用自己的话开心地转告
- 涉及事实、代码、数据时保持严谨——人设永远不能牺牲正确性

# 输出格式
- 只输出纯文本，禁止任何 Markdown 语法（如 **加粗**、`代码`、# 标题、- 列表、> 引用）——聊天窗口按纯文本渲染，这些符号会原样显示出来
- 需要分点时用简短的自然语言句子或"1. 2. 3."这样的朴素编号，需要强调时靠语气和用词，不靠符号

# 语言
- 默认用中文回复；用户换语言时跟随对方语言，元气不变"#;

struct AgentHub {
    // 外层锁只护 map 插入/查找，拿到 Arc 立刻释放；内层锁护单会话的流。
    agents: Mutex<HashMap<String, Arc<Mutex<Agent>>>>,
    // 进行中的会话流取消令牌，cancel_chat 据此中断
    cancels: Mutex<HashMap<String, CancellationToken>>,
}

impl AgentHub {
    fn new() -> Self {
        Self {
            agents: Mutex::new(HashMap::new()),
            cancels: Mutex::new(HashMap::new()),
        }
    }

    async fn get_or_create(&self, id: &str) -> Result<Arc<Mutex<Agent>>, AgentError> {
        let mut agents = self.agents.lock().await;
        if let Some(agent) = agents.get(id) {
            return Ok(Arc::clone(agent));
        }
        let agent = Agent::builder(Provider::OpenRouter, "z-ai/glm-5.3-flash")
            .system(ANGELINA_SYSTEM_PROMPT)
            .tool(GetTime)
            .build()?;
        let agent = Arc::new(Mutex::new(agent));
        agents.insert(id.to_string(), Arc::clone(&agent));
        Ok(agent)
    }
}

#[tauri::command]
async fn chat(
    state: State<'_, AgentHub>,
    conversation_id: String,
    prompt: String,
    on_event: Channel<AgentEvent>,
) -> Result<(), String> {
    let agent = state
        .get_or_create(&conversation_id)
        .await
        .map_err(|e| e.to_string())?;

    let token = CancellationToken::new();
    state
        .cancels
        .lock()
        .await
        .insert(conversation_id.clone(), token.clone());

    let result = forward_chat_stream(agent, &prompt, &on_event, &token).await;

    state.cancels.lock().await.remove(&conversation_id);
    result
}

async fn forward_chat_stream(
    agent: Arc<Mutex<Agent>>,
    prompt: &str,
    on_event: &Channel<AgentEvent>,
    token: &CancellationToken,
) -> Result<(), String> {
    let mut agent = agent.lock().await;
    let mut stream = std::pin::pin!(agent.run_stream(prompt));
    loop {
        // cancelled 分支胜出时整个 future 返回，run_stream 随之 drop，
        // 挂起的网络请求/工具执行一并取消。
        let next = tokio::select! {
            _ = token.cancelled() => return Err("已停止".to_string()),
            next = tokio::time::timeout(CHAT_IDLE_TIMEOUT, stream.next()) => next,
        };
        match next {
            Err(_) => {
                return Err(format!(
                    "模型 {} 秒无响应，已中断",
                    CHAT_IDLE_TIMEOUT.as_secs()
                ));
            }
            Ok(None) => return Ok(()),
            Ok(Some(event)) => {
                let event = event.map_err(|e| e.to_string())?;
                on_event.send(event).map_err(|e| e.to_string())?;
            }
        }
    }
}

#[tauri::command]
async fn cancel_chat(state: State<'_, AgentHub>, conversation_id: String) -> Result<(), String> {
    if let Some(token) = state.cancels.lock().await.get(&conversation_id) {
        token.cancel();
    }
    Ok(())
}

#[tauri::command]
fn close_chat_window(app: tauri::AppHandle) -> Result<(), String> {
    let chat_window = app
        .get_webview_window("chat")
        .ok_or_else(|| "chat window not found".to_string())?;
    chat_window.destroy().map_err(|error| error.to_string())
}

#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    // 先隐藏全部窗口（main + chat），视觉上立即消失
    for (_label, window) in app.webview_windows() {
        let _ = window.hide();
    }
    // 后台优雅退出：request_exit 为非阻塞消息投递，
    // 事件循环按 FIFO 先处理 Hide 再处理 ExitRequested，清理全程窗口不可见
    app.exit(0);
}

#[tokio::main]
async fn main() {
    tauri::async_runtime::set(tokio::runtime::Handle::current());
    tauri::Builder::default()
        .manage(AgentHub::new())
        .invoke_handler(tauri::generate_handler![
            close_chat_window,
            exit_app,
            chat,
            cancel_chat
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event
                && window.label() == "main"
            {
                window.app_handle().exit(0);
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

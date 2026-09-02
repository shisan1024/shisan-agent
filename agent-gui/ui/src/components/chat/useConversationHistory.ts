import {
  useCallback,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { ChatMessage } from "../agui/MessageBox";

export type ConversationMeta = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
};

const INDEX_KEY = "agui.sessions.index.v1";
const SESSION_KEY_PREFIX = "agui.session.v1.";
const MAX_SESSIONS = 50;

const DEFAULT_MESSAGES: ChatMessage[] = [
  {
    id: 1,
    author: "assistant",
    text: "你好！这里是 Angelina 聊天窗口。",
  },
];

function readIndex(): ConversationMeta[] | null {
  try {
    const raw = window.localStorage.getItem(INDEX_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return null;
    }
    return parsed as ConversationMeta[];
  } catch {
    return null;
  }
}

function readMessages(id: string): ChatMessage[] | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY_PREFIX + id);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }
    return parsed as ChatMessage[];
  } catch {
    return null;
  }
}

function writeIndex(index: ConversationMeta[]) {
  try {
    window.localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch {
    // localStorage unavailable/full: degrade to in-memory only.
  }
}

function writeMessages(id: string, messages: ChatMessage[]) {
  try {
    window.localStorage.setItem(SESSION_KEY_PREFIX + id, JSON.stringify(messages));
  } catch {
    // localStorage unavailable/full: degrade to in-memory only.
  }
}

function removeMessages(id: string) {
  try {
    window.localStorage.removeItem(SESSION_KEY_PREFIX + id);
  } catch {
    // ignore
  }
}

function computeTitle(messages: ChatMessage[]): string {
  const firstUserMessage = messages.find((message) => message.author === "user");
  if (!firstUserMessage) {
    return "新会话";
  }
  const chars = Array.from(firstUserMessage.text);
  if (chars.length > 20) {
    return chars.slice(0, 20).join("") + "…";
  }
  return firstUserMessage.text;
}

function createConversation(): ConversationMeta {
  const now = Date.now();
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : "conv-" + now + "-" + Math.random().toString(16).slice(2);
  return {
    id,
    title: "新会话",
    createdAt: now,
    updatedAt: now,
  };
}

type HistoryState = {
  index: ConversationMeta[];
  activeId: string;
  messages: ChatMessage[];
};

function initState(): HistoryState {
  const stored = readIndex();
  if (stored) {
    const sorted = [...stored].sort((a, b) => b.updatedAt - a.updatedAt);
    const active = sorted[0];
    return {
      index: stored,
      activeId: active.id,
      messages: readMessages(active.id) ?? DEFAULT_MESSAGES,
    };
  }

  const fresh = createConversation();
  writeIndex([fresh]);
  writeMessages(fresh.id, DEFAULT_MESSAGES);
  return { index: [fresh], activeId: fresh.id, messages: DEFAULT_MESSAGES };
}

export function useConversationHistory(): {
  conversations: ConversationMeta[];
  activeId: string;
  messages: ChatMessage[];
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  startNewConversation: () => void;
  switchConversation: (id: string) => void;
} {
  const [state, setState] = useState<HistoryState>(initState);

  const setMessages = useCallback<Dispatch<SetStateAction<ChatMessage[]>>>(
    (action) => {
      setState((current) => {
        const nextMessages =
          typeof action === "function" ? action(current.messages) : action;
        const nextIndex = current.index.map((meta) =>
          meta.id === current.activeId
            ? {
                ...meta,
                title: computeTitle(nextMessages),
                updatedAt: Date.now(),
              }
            : meta,
        );
        writeMessages(current.activeId, nextMessages);
        writeIndex(nextIndex);
        return { ...current, index: nextIndex, messages: nextMessages };
      });
    },
    [],
  );

  const startNewConversation = useCallback(() => {
    setState((current) => {
      const hasUserMessage = current.messages.some(
        (message) => message.author === "user",
      );
      if (!hasUserMessage) {
        // Active session is still empty: don't stack up blank conversations.
        return current;
      }

      const fresh = createConversation();
      const previousActiveId = current.activeId;
      let nextIndex = [
        fresh,
        ...current.index.map((meta) =>
          meta.id === previousActiveId
            ? {
                ...meta,
                title: computeTitle(current.messages),
                updatedAt: Date.now(),
              }
            : meta,
        ),
      ];

      if (nextIndex.length > MAX_SESSIONS) {
        // Never evict the just-archived conversation or the fresh one.
        const keptIds = new Set([previousActiveId, fresh.id]);
        const sorted = [...nextIndex].sort((a, b) => b.updatedAt - a.updatedAt);
        for (const meta of sorted) {
          if (keptIds.size >= MAX_SESSIONS) {
            break;
          }
          keptIds.add(meta.id);
        }
        for (const meta of nextIndex) {
          if (!keptIds.has(meta.id)) {
            removeMessages(meta.id);
          }
        }
        nextIndex = nextIndex.filter((meta) => keptIds.has(meta.id));
      }

      writeMessages(current.activeId, current.messages);
      writeMessages(fresh.id, DEFAULT_MESSAGES);
      writeIndex(nextIndex);
      return { index: nextIndex, activeId: fresh.id, messages: DEFAULT_MESSAGES };
    });
  }, []);

  const switchConversation = useCallback((id: string) => {
    setState((current) => {
      if (id === current.activeId) {
        return current;
      }
      if (!current.index.some((meta) => meta.id === id)) {
        return current;
      }
      writeMessages(current.activeId, current.messages);
      return {
        ...current,
        activeId: id,
        messages: readMessages(id) ?? DEFAULT_MESSAGES,
      };
    });
  }, []);

  const conversations = useMemo(
    () => [...state.index].sort((a, b) => b.updatedAt - a.updatedAt),
    [state.index],
  );

  return {
    conversations,
    activeId: state.activeId,
    messages: state.messages,
    setMessages,
    startNewConversation,
    switchConversation,
  };
}

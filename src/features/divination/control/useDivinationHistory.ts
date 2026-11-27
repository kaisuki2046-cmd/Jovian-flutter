import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { emptyChatHistory, parseChatHistory, serializeChatHistory, threadTitle } from '../model/chat-history';
import type { ChatHistory, ChatThread } from '../model/chat-history';
import type { ChatMessage } from '../model/conversation';
import { readHistoryStorage, writeHistoryStorage } from '../model/history-storage';

function readHistory(owner: string | null) {
  try { return { history: owner ? parseChatHistory(readHistoryStorage(owner)) : emptyChatHistory(), storageError: false }; }
  catch { return { history: emptyChatHistory(), storageError: true }; }
}

export function useDivinationHistory(owner: string | null) {
  const [state, setState] = useState(() => readHistory(owner));
  const current = useRef(state.history);
  const [opened, setOpened] = useState(() => [state.history.activeId]);
  const mounted = useRef(false);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const commit = useCallback((activeId: string, updated?: ChatThread, removedId?: string) => {
    if (!mounted.current) return;
    const next: ChatHistory = { activeId, threads: current.current.threads.filter(thread => thread.id !== updated?.id && thread.id !== removedId) };
    if (updated) next.threads.push(updated);
    current.current = next;
    if (!owner) {
      setState({ history: next, storageError: false });
      return;
    }
    try {
      // An update from an open chat should not overwrite unrelated conversations saved by another tab.
      const saved = parseChatHistory(readHistoryStorage(owner));
      const threads = saved.threads.filter(thread => thread.id !== updated?.id && thread.id !== removedId);
      if (updated) threads.push(updated);
      writeHistoryStorage(owner, serializeChatHistory({ activeId, threads }));
      setState({ history: next, storageError: false });
    } catch {
      setState({ history: next, storageError: true });
    }
  }, [owner]);

  const updateThread = useCallback((id: string, messages: ChatMessage[]) => {
    const { activeId, threads } = current.current;
    const previous = threads.find(thread => thread.id === id);
    if (previous?.messages === messages || (!previous && !messages.length)) return;
    if (!messages.length) { commit(activeId, undefined, id); return; }
    const lastSentAt = messages.reduce((latest, item) => Math.max(latest, item.sentAt ?? 0), previous?.updatedAt ?? 0);
    commit(activeId, { id, messages, updatedAt: lastSentAt || Date.now(), title: previous?.title ?? threadTitle(messages) });
  }, [commit]);

  function select(id: string) {
    if (id !== current.current.activeId) commit(id);
    setOpened(previous => previous.includes(id) ? previous : [...previous, id]);
  }

  function startNew() {
    const { activeId, threads } = current.current;
    const id = globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
    const keepCurrent = threads.some(thread => thread.id === activeId);
    commit(id);
    // An unsent draft has no history entry. Replace its open view when starting fresh.
    setOpened(previous => [...previous.filter(openId => keepCurrent || openId !== activeId), id]);
  }

  return { ...state, opened, updateThread, select, startNew };
}

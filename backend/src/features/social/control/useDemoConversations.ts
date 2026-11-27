import { useRef, useState } from 'react';
import { appendMessage, createDemoConversations, maxMessageLength, parseDemoConversations, withWerewolfGame, type DemoConversation, type MessageContent } from '../model/conversations';
import { readDemoStorage, writeDemoStorage } from '../model/demo-storage';

function readConversations(scope: string | null) {
  try {
    const raw = scope ? readDemoStorage(scope) : null;
    return raw ? parseDemoConversations(raw) : createDemoConversations();
  } catch {
    return createDemoConversations();
  }
}

export function useDemoConversations(scope: string | null) {
  const [conversations, setConversations] = useState(() => withWerewolfGame(readConversations(scope)));
  const [storageError, setStorageError] = useState(false);
  const current = useRef(conversations);

  function commit(next: DemoConversation[]) {
    current.current = next;
    setConversations(next);
    if (!scope) return;
    try {
      writeDemoStorage(scope, JSON.stringify(next));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }

  function markRead(id: string) {
    if (!current.current.find(item => item.id === id)?.unread) return;
    commit(current.current.map(item => item.id === id ? { ...item, unread: 0 } : item));
  }

  function send(id: string, content: MessageContent) {
    if (!current.current.some(item => item.id === id)) return false;
    if (content.kind === 'text' && (!content.text.trim() || content.text.length > maxMessageLength)) return false;
    const sentAt = Date.now();
    commit(current.current.map(item => item.id === id ? appendMessage(item, content, sentAt) : item));
    return true;
  }

  function createGroup(name: string, memberIds: readonly string[]) {
    const members = current.current.filter(item => item.kind === 'friend' && memberIds.includes(item.id)).map(item => item.id);
    const title = name.trim();
    if (!title || title.length > 24 || members.length < 2) return null;
    const now = Date.now();
    const id = 'group-' + now + '-' + current.current.length;
    commit([{ id, name: title, kind: 'group', createdAt: now, members, unread: 0, thread: [] }, ...current.current]);
    return id;
  }

  return { conversations, storageError, markRead, send, createGroup };
}

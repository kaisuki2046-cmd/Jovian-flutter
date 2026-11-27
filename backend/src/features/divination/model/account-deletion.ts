import { chatOwnerKey } from './chat-owner';
import { originalChatId, parseChatHistory } from './chat-history';
import { clearHistoryStorage, readHistoryStorage } from './history-storage';
import { clearTaskStorage, readTaskRecovery } from './task-session';

function memberOwner(id: string) {
  const owner = chatOwnerKey({ kind: 'member', id });
  if (!owner) throw new Error('Missing account identity');
  return owner;
}

function chatIds(owner: string) {
  const raw = readHistoryStorage(owner);
  try {
    const { threads, activeId } = parseChatHistory(raw);
    return [...new Set([activeId, originalChatId, ...threads.map(({ id }) => id)])];
  } catch {
    return [originalChatId];
  }
}

export async function listDeletionReadingTokens(id: string) {
  const owner = memberOwner(id);
  const sessions = await Promise.all(chatIds(owner).map((chatId) => readTaskRecovery(owner, chatId)));
  return [...new Set(sessions.flatMap((item) => Object.values(item?.tokens ?? {}))
    .filter((token) => /^[A-Za-z0-9_-]{43}$/.test(token)))].slice(-100);
}

export async function clearDeletedReadingHistory(id: string) {
  const owner = memberOwner(id);
  await Promise.all(chatIds(owner).map((chatId) => clearTaskStorage(owner, chatId)));
  clearHistoryStorage(owner);
}

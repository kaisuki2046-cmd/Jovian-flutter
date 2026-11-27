import { historyStorageKey } from './chat-owner';

export function clearHistoryStorage(owner: string) { window.localStorage.removeItem(historyStorageKey(owner)); }

export function readHistoryStorage(owner: string) { return window.localStorage.getItem(historyStorageKey(owner)); }
export function writeHistoryStorage(owner: string, content: string) {
  window.localStorage.setItem(historyStorageKey(owner), content);
}

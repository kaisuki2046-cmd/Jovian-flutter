import type { ChatMessage } from './conversation';

export const originalChatId = 'original';
export type ChatThread = { id: string; updatedAt: number; title?: string; messages: ChatMessage[] };
export type ChatHistory = { activeId: string; threads: ChatThread[] };

export function emptyChatHistory(): ChatHistory {
  return { activeId: originalChatId, threads: [] };
}

function messageText(message: ChatMessage) {
  if (message.kind === 'readingQuestion') return message.question;
  if (message.kind === 'readingSession') return message.snapshot.question;
  return message.text;
}

export function threadTitle(messages: readonly ChatMessage[]) {
  for (const message of messages) {
    if (message.kind !== 'user' && message.kind !== 'readingSession') continue;
    const text = messageText(message).trim() || (message.kind === 'user' ? message.attachments?.[0]?.name : undefined);
    if (text) return Array.from(text.replace(/\s+/g, ' ')).slice(0, 60).join('');
  }
}

export function searchChatHistory(threads: readonly ChatThread[], query: string) {
  const needle = query.trim().toLocaleLowerCase();
  const matches = (text: string) => text.toLocaleLowerCase().includes(needle);
  return threads.filter(thread => !needle || matches(thread.title ?? '') || thread.messages.some(message =>
    matches(messageText(message)) || (message.kind === 'user' && message.attachments?.some(file => matches(file.name))),
  )).sort((left, right) => right.updatedAt - left.updatedAt);
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validMessage(value: unknown): value is ChatMessage {
  if (!record(value) || !Number.isSafeInteger(value.id)) return false;
  if (value.sentAt !== undefined && (typeof value.sentAt !== 'number' || !Number.isFinite(value.sentAt))) return false;
  if (value.kind === 'readingQuestion') return typeof value.question === 'string' && record(value.understanding);
  if (value.kind === 'readingSession') return record(value.snapshot) && typeof value.snapshot.question === 'string'
    && Array.isArray(value.snapshot.followUps) && Array.isArray(value.snapshot.evidence);
  if (typeof value.text !== 'string') return false;
  if (value.kind !== 'user') return value.kind === 'guidance' || value.kind === 'prompt' || value.kind === 'preview';
  const files = value.attachments;
  return files === undefined || (Array.isArray(files) && files.every(item => record(item)
    && typeof item.id === 'string' && typeof item.name === 'string' && (item.kind === 'image' || item.kind === 'file')
    && (item.uri === undefined || typeof item.uri === 'string')));
}

export function parseChatHistory(raw: string | null): ChatHistory {
  if (raw === null) return emptyChatHistory();
  const value: unknown = JSON.parse(raw);
  if (!record(value) || typeof value.activeId !== 'string' || !Array.isArray(value.threads)) throw new Error('Invalid chat history');
  const threads = value.threads.filter((thread): thread is ChatThread => record(thread)
    && typeof thread.id === 'string' && /^[a-z0-9-]+$/.test(thread.id)
    && typeof thread.updatedAt === 'number' && Number.isFinite(thread.updatedAt)
    && (thread.title === undefined || typeof thread.title === 'string')
    && Array.isArray(thread.messages) && thread.messages.length > 0 && thread.messages.every(validMessage));
  return { activeId: /^[a-z0-9-]+$/.test(value.activeId) ? value.activeId : originalChatId, threads };
}

export function serializeChatHistory(history: ChatHistory) {
  // The browser keeps the chosen File objects alive in the running chat. Persist their labels, not their bytes.
  return JSON.stringify(history, (key, value) => key === 'file' ? undefined : value);
}

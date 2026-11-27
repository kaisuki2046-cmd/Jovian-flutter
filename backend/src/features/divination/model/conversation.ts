import type { ReadingTask } from './reading';
import type { ChatAttachment } from './chat-draft';

export type TaskKind = 'divination' | 'compatibility' | 'naming';

export type ChatReply =
  | { kind: 'guidance'; text: string }
  | { kind: 'prompt'; task: TaskKind | null; text: string }
  | { kind: 'preview'; task: Exclude<TaskKind, 'divination'>; text: string };

export type ChatRoute = ChatReply | { kind: 'confirmReading' };

export type UserMessage = { id: number; kind: 'user'; text: string; attachments?: ChatAttachment[] };
export type ChatMessage = (
  | UserMessage
  | ({ id: number } & ChatReply)
  | ReadingTask
) & { sentAt?: number };

export type ChatStatus = 'idle' | 'classifying' | 'previewing' | 'failed' | 'cancelled';

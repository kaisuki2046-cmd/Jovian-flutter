import { getItemAsync, setItemAsync, deleteItemAsync } from 'expo-secure-store';
import { Platform } from 'react-native';
import type { CardEvent, RitualEvent } from './reading';

function scopeKey(kind: 'recovery' | 'pending-ritual', owner: string, chatId: string) {
  return 'jovian.divination.' + kind + '.v2.' + owner + '.' + chatId;
}

async function readStored(key: string) {
  return Platform.OS === 'web' ? globalThis.sessionStorage.getItem(key) : getItemAsync(key);
}

async function writeStored(key: string, data: string | null) {
  if (Platform.OS === 'web') {
    if (data === null) globalThis.sessionStorage.removeItem(key);
    else globalThis.sessionStorage.setItem(key, data);
  } else if (data === null) await deleteItemAsync(key);
  else await setItemAsync(key, data);
}

let writes = Promise.resolve();
function serializeWrite(action: () => Promise<void>) {
  const next = writes.then(action);
  writes = next.catch(() => {});
  return next;
}
export type PendingRitual = { token: string; action: { pick: CardEvent } | { toss: RitualEvent } };
export type TaskRecovery = { latest: number; tokens: Record<number, string> };

export function clearTaskStorage(owner: string, chatId: string) {
  return serializeWrite(async () => {
    await writeStored(scopeKey('recovery', owner, chatId), null);
    await writeStored(scopeKey('pending-ritual', owner, chatId), null);
  });
}

export async function readPendingRitual(owner: string | null, chatId: string): Promise<PendingRitual | null> {
  if (!owner) return null;
  const data = await readStored(scopeKey('pending-ritual', owner, chatId));
  return data ? JSON.parse(data) : null;
}

export async function writePendingRitual(owner: string | null, chatId: string, value: PendingRitual | null) {
  if (!owner) return;
  return serializeWrite(() => writeStored(scopeKey('pending-ritual', owner, chatId), value && JSON.stringify(value)));
}

export async function readTaskRecovery(owner: string | null, chatId: string): Promise<TaskRecovery | null> {
  if (!owner) return null;
  try {
    const data = await readStored(scopeKey('recovery', owner, chatId));
    if (!data) return null;
    const parsed: TaskRecovery = JSON.parse(data);
    if (!Number.isSafeInteger(parsed.latest) || !parsed.tokens || typeof parsed.tokens !== 'object' || Array.isArray(parsed.tokens)) return null;
    const entries = Object.entries(parsed.tokens);
    return entries.every(([id, token]) => /^\d+$/.test(id) && typeof token === 'string' && token.length > 0) ? parsed : null;
  } catch {
    return null;
  }
}

export async function writeTaskRecovery(owner: string | null, chatId: string, value: TaskRecovery | null) {
  if (!owner) return;
  return serializeWrite(async () => {
    try {
      await writeStored(scopeKey('recovery', owner, chatId), value && JSON.stringify(value));
    } catch {
      // The current task can still continue without device storage.
    }
  });
}

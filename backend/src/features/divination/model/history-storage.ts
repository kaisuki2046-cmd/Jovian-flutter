import { File, Paths } from 'expo-file-system';
import { historyStorageKey } from './chat-owner';

function historyFile(owner: string) { return new File(Paths.document, historyStorageKey(owner) + '.json'); }

export function readHistoryStorage(owner: string) {
  const file = historyFile(owner);
  return file.exists ? file.textSync() : null;
}

export function writeHistoryStorage(owner: string, content: string) {
  const pending = new File(Paths.document, historyStorageKey(owner) + '.tmp');
  pending.writeSync(content);
  pending.moveSync(historyFile(owner), { overwrite: true });
}

export function clearHistoryStorage(owner: string) {
  for (const file of [historyFile(owner), new File(Paths.document, historyStorageKey(owner) + '.tmp')]) {
    if (file.exists) file.delete();
  }
}

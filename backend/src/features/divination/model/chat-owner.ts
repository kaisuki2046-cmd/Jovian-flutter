import type { ArchiveIdentity } from '../../account';

export function chatOwnerKey(identity: ArchiveIdentity | null): string | null {
  if (!identity?.id) return null;
  const id = Array.from(identity.id, character => character.codePointAt(0)!.toString(16)).join('_');
  return identity.kind + '.' + id;
}

export function historyStorageKey(owner: string) {
  return 'jovian.divination.history.v2.' + owner;
}

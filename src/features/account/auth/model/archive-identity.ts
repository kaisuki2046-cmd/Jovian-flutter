export type ArchiveIdentity = { kind: 'member' | 'guest'; id: string };

export type GuestSession = { id: string; expiresAt: number };

export function parseGuestSession(value: unknown): GuestSession {
  const guest = value as Partial<GuestSession> | null;
  if (!guest || typeof guest.id !== 'string' || !guest.id || typeof guest.expiresAt !== 'number' ||
      !Number.isSafeInteger(guest.expiresAt)) throw new Error('Invalid guest session.');
  return { id: guest.id, expiresAt: guest.expiresAt };
}

import { createHash } from 'node:crypto';

export const sessionSeconds = 7 * 24 * 60 * 60;
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

export function tokenHash(token) {
  return token && tokenPattern.test(token)
    ? createHash('sha256').update(token).digest('hex')
    : undefined;
}

import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt);
const settings = { N: 2 ** 17, r: 8, p: 1, maxmem: 160 * 1024 * 1024 };
const dummySalt = randomBytes(16).toString('hex');
const dummyHash = randomBytes(64);

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await derive(password, Buffer.from(salt, 'hex'), 64, settings);
  return { salt, passwordHash: hash.toString('hex') };
}

export async function verifyPassword(password, user) {
  const hasPassword = Boolean(user?.password_hash && user?.password_salt);
  const salt = user?.password_salt ?? dummySalt;
  const expected = hasPassword ? Buffer.from(user.password_hash, 'hex') : dummyHash;
  const hash = await derive(password, Buffer.from(salt, 'hex'), 64, settings);
  return timingSafeEqual(hash, expected) && hasPassword;
}

import { createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';

const expiresIn = 300;
const resendMs = 30_000;
const maxAttempts = 5;

export function createVerificationCodes({ deliver, now }) {
  const challenges = new Map();
  const key = randomBytes(32);
  const digest = (id, code) => createHmac('sha256', key).update(id + ':' + code).digest();

  return {
    async issue(scope, recipient, purpose, subject) {
      if (!deliver) return { status: 503 };
      const time = now();
      for (const [entry, challenge] of challenges) {
        if (challenge.expiresAt <= time) challenges.delete(entry);
      }
      const old = challenges.get(scope);
      if (old && old.resendAt > time) return { status: 429 };
      if (!old && challenges.size >= 5000) return { status: 429 };
      const code = String(randomInt(1_000_000)).padStart(6, '0');
      const id = randomUUID();
      const challenge = {
        id, subject, hash: digest(id, code), expiresAt: time + expiresIn * 1000,
        resendAt: time + resendMs, remaining: maxAttempts, ready: false,
      };
      challenges.set(scope, challenge);
      try {
        const result = await deliver({ recipient, purpose, code, expiresIn });
        if (challenges.get(scope) !== challenge || challenge.expiresAt <= now()) return { status: 410 };
        challenge.ready = true;
        const developmentCode = result?.developmentCode;
        return { status: 200, body: {
          challengeId: id, expiresIn,
          ...(developmentCode ? { developmentCode } : {}),
          ...(result?.delivery === 'local-inbox' ? { delivery: result.delivery } : {}),
        } };
      } catch {
        if (challenges.get(scope) === challenge) challenges.delete(scope);
        return { status: 503 };
      }
    },
    consume(...proofs) {
      const verified = [];
      for (const { scope, id, code } of proofs) {
        const challenge = challenges.get(scope);
        if (!challenge || !challenge.ready || challenge.id !== id || challenge.expiresAt <= now() || challenge.remaining === 0) {
          return { status: 410 };
        }
        if (!timingSafeEqual(challenge.hash, digest(id, code))) {
          challenge.remaining -= 1;
          return { status: challenge.remaining === 0 ? 410 : 422 };
        }
        verified.push(challenge);
      }
      for (const challenge of verified) challenge.remaining = 0;
      return { status: 200, subject: verified[0].subject };
    },
  };
}

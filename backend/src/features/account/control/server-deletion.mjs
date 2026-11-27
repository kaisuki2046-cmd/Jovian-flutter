import { randomBytes } from 'node:crypto';
import { tokenHash } from '../auth/model/session-secret.mjs';
import { fail } from './account-failure.mjs';

export function createDeletionControl({ store, auth, now, eraseReadings }) {
  function tryCleanup(job) {
    try {
      eraseReadings(job.ownerId, JSON.parse(job.tokens));
      store.completeDeletion(job.receiptHash, now());
    } catch (error) {
      console.error('Account deletion cleanup pending', error.name);
    }
  }

  function readStatus(receiptHash) {
    const record = store.getDeletionReceipt(receiptHash);
    if (!record) fail(404);
    const { requestedAt, completedAt } = record;
    return { status: completedAt === null ? 'pending' : 'completed', requestedAt, completedAt };
  }

  return {
    retryPending() {
      for (const job of store.getPendingDeletions()) tryCleanup(job);
      store.purgeDeletionReceipts(now());
    },
    prepare(token) {
      const user = auth.requireSession(token);
      return { receipt: randomBytes(32).toString('base64url'), method: auth.deletionMethod(user) };
    },
    issueCode(input) {
      return auth.issueDeletionCode(auth.requireSession(input.token), input);
    },
    async submit({ token, readInput }) {
      const user = auth.requireSession(token);
      const body = await readInput();
      const receiptHash = typeof body.receipt === 'string' && tokenHash(body.receipt);
      const legacy = body.legacyReadingTokens ?? [];
      if (!receiptHash || body.confirm !== true || !Array.isArray(legacy) || legacy.length > 100 ||
          legacy.some((value) => typeof value !== 'string' || !tokenHash(value))) fail(400);
      if (store.getDeletionReceipt(receiptHash)) fail(409);
      await auth.verifyDeletion(user, token, body);
      const tokens = [...new Set(legacy.map(tokenHash))];
      if (!store.beginDeletion(user.id, token, receiptHash, tokens, now())) fail(401);
      tryCleanup(store.getDeletionReceipt(receiptHash));
      return { status: 200, clearSession: true, body: readStatus(receiptHash) };
    },
    async status({ ip, readInput }) {
      auth.limit('deletion-status-ip:' + ip, 90);
      const { receipt } = await readInput();
      const hash = typeof receipt === 'string' && tokenHash(receipt);
      if (!hash) fail(400);
      return readStatus(hash);
    },
  };
}

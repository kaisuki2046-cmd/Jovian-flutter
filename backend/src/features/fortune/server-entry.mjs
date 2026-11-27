import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export function fortuneDeletionMarker(directory, ownerId) {
  const hash = createHash('sha256').update(ownerId).digest('hex');
  return join(directory, '.deleted-' + hash);
}

export function eraseFortuneAccount(ownerId, directories = process.env.FORTUNE_FACT_DIRECTORY
  ? [process.env.FORTUNE_FACT_DIRECTORY] : ['.local/fortune', '.local/fortune-preview']) {
  for (const root of new Set(directories.map((directory) => resolve(directory)))) {
    mkdirSync(root, { recursive: true, mode: 0o700 });
    writeFileSync(fortuneDeletionMarker(root, ownerId), '', { mode: 0o600 });
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isFile() || !/^(?:(?:advice|interpretation)-)?[a-f0-9]{64}\.json$/.test(entry.name)) continue;
      const path = join(root, entry.name);
      try {
        const record = JSON.parse(readFileSync(path, 'utf8'));
        if (record.ownerId === ownerId) unlinkSync(path);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
  }
}

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const frontendRoot = resolve(fileURLToPath(new URL('../../', import.meta.url)));

const parent = dirname(frontendRoot);
export const legacyRoot = [parent, join(parent, 'app')].find((candidate) =>
  existsSync(join(candidate, 'src', 'features', 'destiny', 'control', 'local-reading.ts')));

if (!legacyRoot) {
  throw new Error(`Original Jovian app source is missing beside ${dirname(frontendRoot)}.`);
}

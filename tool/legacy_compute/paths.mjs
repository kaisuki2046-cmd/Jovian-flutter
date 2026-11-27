import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const frontendRoot = resolve(fileURLToPath(new URL('../../', import.meta.url)));

const parent = dirname(frontendRoot);
const configured = process.env.JOVIAN_LEGACY_SOURCE_ROOT?.trim();
const candidates = configured ? [resolve(configured)] : [parent, join(parent, 'app')];
export const legacyRoot = candidates.find((candidate) =>
  existsSync(join(candidate, 'src', 'features', 'destiny', 'control', 'local-reading.ts')));

if (!legacyRoot) {
  throw new Error('Set JOVIAN_LEGACY_SOURCE_ROOT to a checkout of the original Jovian source. ' +
    'Checked: ' + candidates.join(', '));
}

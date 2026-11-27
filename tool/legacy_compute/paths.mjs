import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const frontendRoot = resolve(fileURLToPath(new URL('../../', import.meta.url)));
export const legacyRoot = join(frontendRoot, 'backend');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { claimCatalogDigest } from '../claim-compat.mjs';

const claims = new URL('../claims/', import.meta.url);

export function assertCurrentClaimSourceDigests(methods) {
  const manifest = JSON.parse(readFileSync(new URL('upgrade-manifest.json', claims), 'utf8'));
  for (const method of methods) {
    const source = readFileSync(new URL(method + '.json', claims));
    assert.equal(claimCatalogDigest(source), manifest.catalogs[method].sha256, method);
  }
}

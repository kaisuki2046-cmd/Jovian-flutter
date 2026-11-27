import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { after, test } from 'node:test';
import { gunzipSync } from 'node:zlib';
import { claimCatalogDirectory, claimSourceDirectory } from '../claims-sqlite.mjs';
import { createClaimsCatalog } from '../claims.mjs';
import { createReportLookup } from '../report-lookup.mjs';

const localReview = new URL('../.local/knowledge-review/', import.meta.url);
const archiveFile = new URL('tieban-retired-research.json.gz', localReview);
const hasArchive = [archiveFile, ...['bazi.json', 'ziwei.json', 'western.json', 'report-knowledge.json', 'report-knowledge-ids.json']
  .map(name => new URL(name, localReview))].every(file => existsSync(file));
export const historicalTest = hasArchive ? test : (name, run) => test(name, { skip: 'Local Tieban research archive is unavailable' }, run);
const catalogs = new Map();

function prepareSources() {
  const prefix = 'destiny-tieban-research-';
  const root = mkdtempSync(join(tmpdir(), prefix));
  after(() => {
    if (!resolve(root).startsWith(resolve(tmpdir()) + sep + prefix)) throw new Error('Invalid Tieban test directory');
    rmSync(root, { recursive: true, force: true });
  });
  const sources = join(root, 'sources');
  mkdirSync(sources);
  const archive = JSON.parse(gunzipSync(readFileSync(archiveFile)));
  const read = name => JSON.parse(readFileSync(join(claimSourceDirectory, name), 'utf8'));
  const readLocal = name => JSON.parse(readFileSync(new URL(name, localReview), 'utf8'));
  const merge = (current, local) => [...new Map([...local, ...current].map(row => [row.id, row])).values()];
  for (const file of ['upgrade-manifest.json', 'branch-interpretations.json', 'report-knowledge.schema.json']) {
    copyFileSync(join(claimSourceDirectory, file), join(sources, file));
  }
  const files = {
    'bazi.json': merge(read('bazi.json'), [...readLocal('bazi.json'), ...archive.raw.map(([, row]) => row)]),
    'ziwei.json': merge(read('ziwei.json'), readLocal('ziwei.json')),
    'western.json': merge(read('western.json'), readLocal('western.json')),
    'report-knowledge.json': merge(read('report-knowledge.json'), [...readLocal('report-knowledge.json'), ...archive.report.map(([, row]) => row)]),
    'report-knowledge-ids.json': { ...archive.ids, ...readLocal('report-knowledge-ids.json'), ...read('report-knowledge-ids.json') },
  };
  for (const [name, data] of Object.entries(files)) writeFileSync(join(sources, name), JSON.stringify(data));
  return { sources, runtime: join(root, 'runtime') };
}

const fixture = hasArchive ? prepareSources() : null;
const sourceDirectory = fixture?.sources ?? claimSourceDirectory;
const runtimeDirectory = fixture?.runtime ?? claimCatalogDirectory;

// Only historical arithmetic regressions opt in. The app and catalog tests use live sources.
export function historicalTiebanSource(name) {
  return join(sourceDirectory, name);
}

export function historicalTiebanCatalog(directory) {
  const key = resolve(directory ?? runtimeDirectory);
  if (!catalogs.has(key)) catalogs.set(key, createClaimsCatalog({ directory: key, sourceDirectory }));
  return catalogs.get(key);
}

export function createHistoricalTiebanLookup(directory) {
  const catalog = historicalTiebanCatalog(directory);
  return createReportLookup(directory ?? runtimeDirectory, catalog);
}

import assert from 'node:assert/strict';
import test from 'node:test';
import { createAppUpdateCheck } from './app-update-check.ts';
import { androidDownloadOrigin, parseAndroidReleaseResponse } from '../model/app-update.ts';

const current = { applicationId: 'com.jovian.preview', versionName: '0.1.8', versionCode: 8 };
const origin = 'https://updates.example.test';
const release = {
  applicationId: current.applicationId, versionName: '0.1.9', versionCode: 9,
  notes: ['改进底栏水滴拖动。'], downloadUrl: origin + '/jovian-preview-9.apk',
};

test('offers a newer release once and fetches again only after the automatic check cooldown', async () => {
  let time = 0;
  let reads = 0;
  let latest = release;
  const check = createAppUpdateCheck(current, async () => {
    reads++;
    return { release: latest };
  }, () => time);
  assert.deepEqual(await check(false), { status: 'available', release, show: true });
  time += 899_999;
  assert.equal(await check(false), undefined);
  assert.equal(reads, 1);
  time++;
  assert.deepEqual(await check(false), { status: 'available', release, show: false });
  assert.deepEqual(await check(true), { status: 'available', release, show: true });
  time += 900_000;
  latest = { ...release, versionCode: 10, versionName: '0.1.10' };
  assert.deepEqual(await check(false), { status: 'available', release: latest, show: true });
});

test('only offers newer builds for the installed package and recovers after failures', async () => {
  let latest = null;
  let offline = false;
  const check = createAppUpdateCheck(current, async () => {
    if (offline) throw new Error('offline');
    return { release: latest };
  });
  assert.deepEqual(await check(true), { status: 'unpublished' });
  latest = { ...release, applicationId: 'com.jovian.other' };
  assert.deepEqual(await check(true), { status: 'unpublished' });
  latest = { ...release, versionCode: current.versionCode };
  assert.deepEqual(await check(true), { status: 'current' });
  latest = { ...release, versionCode: current.versionCode - 1 };
  assert.deepEqual(await check(true), { status: 'current' });
  offline = true;
  assert.deepEqual(await check(false), { status: 'failed' });
  offline = false;
  latest = release;
  assert.deepEqual(await check(true), { status: 'available', release, show: true });
});

test('a manual check can share the in-progress launch request', async () => {
  let reads = 0;
  let respond;
  const check = createAppUpdateCheck(current, () => {
    reads++;
    return new Promise(resolve => { respond = resolve; });
  });
  const automatic = check(false);
  const manual = check(true);
  await Promise.resolve();
  respond({ release });
  assert.deepEqual((await automatic).release, release);
  assert.equal((await manual).show, true);
  assert.equal(reads, 1);
});

test('validates the release notes, build number and HTTPS download origin', () => {
  assert.equal(androidDownloadOrigin(origin + '/'), origin);
  assert.equal(androidDownloadOrigin(origin + '/path'), undefined);
  assert.equal(androidDownloadOrigin('http://updates.example.test'), undefined);
  assert.deepEqual(parseAndroidReleaseResponse({ release }, origin), { release });
  assert.deepEqual(parseAndroidReleaseResponse({ release: null }, undefined), { release: null });
  assert.throws(() => parseAndroidReleaseResponse({ release }, undefined));
  for (const downloadUrl of [
    'http://updates.example.test/jovian.apk', 'https://updates.example.test.attacker.test/jovian.apk',
    'https://user:password@updates.example.test/jovian.apk', 'file:///jovian.apk', '/jovian.apk',
  ]) {
    assert.throws(() => parseAndroidReleaseResponse({ release: { ...release, downloadUrl } }, origin));
  }
  for (const fields of [{ versionCode: '9' }, { versionCode: 9.5 }, { notes: [] }, { notes: ['  '] }]) {
    assert.throws(() => parseAndroidReleaseResponse({ release: { ...release, ...fields } }, origin));
  }
});

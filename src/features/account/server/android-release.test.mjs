import assert from 'node:assert/strict';
import { mkdtemp, rm, rmdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { openAccountStore } from '../storage/account-store.mjs';
import { createAndroidReleaseReader } from './android-release.mjs';
import { createAccountHandler } from './handler.mjs';

test('the standalone account API publishes only valid Android releases', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'jovian-android-release-'));
  const path = join(directory, 'release.json');
  const origin = 'http://localhost:8081';
  const downloadOrigin = 'https://downloads.example.test';
  const store = openAccountStore(':memory:');
  const handler = createAccountHandler({
    store, webOrigin: origin,
    readAndroidRelease: createAndroidReleaseReader({ file: path, downloadOrigin }),
  });
  const server = createServer(handler);
  try {
    await new Promise((ready, reject) => server.once('error', reject).listen(0, '127.0.0.1', ready));
    const url = 'http://127.0.0.1:' + server.address().port + '/app-updates/android/latest';
    const noFile = await fetch(url);
    assert.equal(noFile.status, 503);
    assert.deepEqual(await noFile.json(), { code: 'APP_RELEASE_UNAVAILABLE' });

    await writeFile(path, JSON.stringify({ release: null }));
    const unpublished = await fetch(url);
    assert.equal(unpublished.status, 200);
    assert.deepEqual(await unpublished.json(), { release: null });

    const release = {
      applicationId: 'com.jovian.preview',
      versionCode: 12,
      versionName: '1.2.0',
      notes: ['更新记录'],
      downloadUrl: downloadOrigin + '/jovian.apk',
    };
    await writeFile(path, JSON.stringify({ release: { ...release, privateField: 'server only' } }));
    const published = await fetch(url, { headers: { Origin: origin } });
    assert.equal(published.status, 200);
    assert.equal(published.headers.get('cache-control'), 'no-store');
    assert.equal(published.headers.get('access-control-allow-origin'), origin);
    assert.deepEqual(await published.json(), { release });

    await writeFile(path, JSON.stringify({ release: { ...release, downloadUrl: 'https://other.example.test/jovian.apk' } }));
    const invalid = await fetch(url);
    assert.equal(invalid.status, 503);
    assert.deepEqual(await invalid.json(), { code: 'APP_RELEASE_UNAVAILABLE' });
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    store.close();
    await rm(path, { force: true });
    await rmdir(directory);
  }
});

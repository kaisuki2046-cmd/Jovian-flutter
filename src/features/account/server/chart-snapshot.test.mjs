import { withSignInAgreement } from './sign-in-fixture.mjs';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test from 'node:test';
import { openAccountStore } from '../storage/account-store.mjs';
import { createAccountHandler } from './handler.mjs';

const history = '/destiny-history';
const snapshots = '/synastry-chart-snapshots/';
const expected = (ownerId) => '?expectedOwnerId=' + ownerId;
const timestamp = (offset = 0) => new Date(Date.UTC(2000, 0, 1, 0, offset)).toISOString();

function reportAt(offset, timeKnown) {
  return {
    version: 1, calculatedAt: timestamp(offset), timeKnown, mode: 'local', overview: '私人报告正文',
    charts: ['bazi', 'ziwei', 'western'].map((method) => ({ method, engine: 'test', rows: [] })),
  };
}

function snapshot(timeKnown) {
  const pillars = ['year', 'month', 'day', 'hour'];
  const planets = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
  const chart = (rawResult, rulesetVersion = 'test') => ({ engineName: 'test', engineVersion: '1', rulesetVersion, rawResult });
  const baZi = (index) => ({
    utc: timestamp(index), year: '甲子', month: '乙丑', day: '丙寅', hour: index === 0 ? '丁卯' : '戊辰',
    shenShaRulesetVersion: 'test',
    tenGods: Object.fromEntries(pillars.map((position) => [position, {
      heavenlyStem: '正印', hiddenStems: [{ stem: position === 'hour' && index > 0 ? '戊' : '甲', tenGod: '正印' }],
    }])),
    shenSha: Object.fromEntries(pillars.map((position) => [position,
      position === 'year' ? [{ name: '桃花', sourcePillars: ['day'] }] : []])),
  });
  const ziwei = (index) => ({
    timeIndex: index, solarDate: '2000-01-01',
    palaces: Array.from('子丑寅卯辰巳午未申酉戌亥', (earthlyBranch, position) => ({
      name: position === 0 ? '命宫' : '宫' + position,
      earthlyBranch, isBodyPalace: position === index,
      majorStars: position === 0 ? [{ name: '紫微', mutagen: '科', brightness: '旺' }] : [],
      minorStars: [], adjectiveStars: [],
    })),
  });
  const western = (index) => ({
    utc: timestamp(index), julianDay: 2451544.5 + index / 1440, ascendant: index, midheaven: 86.123456789,
    positions: planets.map((planet) => ({
      planet, longitude: planet === 'Moon' && index ? 31 : 29.123456789, latitude: -2.12, house: 1,
    })),
    houses: Array.from({ length: 12 }, (_, house) => house * 30), aspects: [],
  });
  const candidates = timeKnown ? [0] : [0, 1];
  return {
    version: 1, timeKnown, samplingVersion: 'test',
    bazi: chart(candidates.map(baZi)),
    ziwei: chart(candidates.map(ziwei)),
    western: chart(candidates.map(western), 'tropical-whole-sign-v1'),
  };
}

// Drive the production handler with a request stream and isolated SQLite.
function makeRequest(store, now) {
  const handler = createAccountHandler({
    store, webOrigin: 'http://localhost:8081', now,
    authProvider: {
      namespace: 'test',
      async exchangeSocial({ authorizationCode }) {
        return { subject: authorizationCode, displayName: '测试会员' };
      },
    },
  });
  return async (path, token, body, method = body === undefined ? 'GET' : 'POST') => {
    const request = Object.assign(Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(withSignInAgreement(path, body)))]), {
      url: '/account' + path,
      method,
      socket: { remoteAddress: '127.0.0.1' },
      headers: { 'x-app-client': 'native', 'content-type': 'application/json', authorization: 'Bearer ' + token },
    });
    const response = {
      setHeader() {},
      writeHead(status) {
        this.status = status;
        return this;
      },
      end(body) {
        this.body = body === undefined ? undefined : JSON.parse(body);
      },
    };
    await handler(request, response);
    return { status: response.status, body: response.body };
  };
}

test('chart snapshots round trip and expose only comparable facts to the owning member', async () => {
  const store = openAccountStore(':memory:');
  let now = Date.now();
  const send = makeRequest(store, () => now);
  try {
    const { body: owner } = await send('/auth/social/wechat', '', { authorizationCode: 'owner' });
    const { body: other } = await send('/auth/social/wechat', '', { authorizationCode: 'other' });
    const { body: guest } = await send('/auth/guest', '', {});
    const ownerId = owner.user.id;
    const query = expected(ownerId);
    const latest = snapshots + 'latest' + query;
    const save = (report) => send(history, owner.token, { expectedOwnerId: ownerId, report });
    assert.deepEqual(await send(latest, owner.token), { status: 200, body: { status: 'no_archive' } });
    const legacy = await save(reportAt(0, true));
    assert.equal(legacy.status, 200);
    assert.equal(legacy.body.chartSnapshotSaved, undefined);
    assert.deepEqual((await send(latest, owner.token)).body, {
      status: 'missing_snapshot', archiveId: legacy.body.id, calculatedAt: legacy.body.calculatedAt,
    });

    const exact = { ...reportAt(1, true), chartSnapshot: snapshot(true) };
    exact.chartSnapshot.birthContext = {
      precision: 'minute', birthInstant: timestamp(), latitude: 39.907123, longitude: 116.397456,
      timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1',
    };
    const [natal] = exact.chartSnapshot.bazi.rawResult;
    natal.luckPeriods = Array.from({ length: 10 }, (_, index) => ({
      ganZhi: '甲子', startAge: 5 + 10 * index, endAge: 14 + 10 * index,
    }));
    natal.luckContext = {
      profile: 'lunar-javascript-beijing-jie-sect2-v1', gender: 'female', direction: 'backward',
      periods: natal.luckPeriods.map((period, index) => ({ ...period,
        start: new Date(Date.UTC(2005 + 10 * index, 0)).toISOString(),
        endExclusive: new Date(Date.UTC(2015 + 10 * index, 0)).toISOString(),
      })),
    };
    const [palace] = exact.chartSnapshot.ziwei.rawResult[0].palaces;
    Object.assign(palace.majorStars[0], { mutagenOrigin: 'birth_year', brightnessProfile: 'test-brightness-v1' });
    palace.heavenlyStem = '甲';
    palace.minorStars = ['廉贞', '破军', '武曲', '太阳'].map((name) => ({ name }));
    palace.stemTransformations = ['禄', '权', '科', '忌'].map((marker, index) => ({
      marker, star: palace.minorStars[index].name,
    }));
    const invalid = structuredClone(exact);
    invalid.chartSnapshot.ziwei.rawResult[0].palaces[0].stemTransformations[0].star = '缺失星曜';
    assert.equal((await save(invalid)).status, 400);
    for (const change of [{ birthInstant: timestamp(1) }, { latitude: 91 }, { timeZone: '+08:00' }]) {
      assert.equal((await save({ ...exact, chartSnapshot: { ...exact.chartSnapshot,
        birthContext: { ...exact.chartSnapshot.birthContext, ...change } } })).status, 400);
    }
    const badLuck = structuredClone(exact);
    badLuck.chartSnapshot.bazi.rawResult[0].luckContext.periods[1].start = timestamp();
    assert.equal((await save(badLuck)).status, 400);
    const first = await save(exact);
    assert.equal(first.status, 200);
    assert.equal(first.body.chartSnapshotSaved, true);
    now++;
    assert.deepEqual(await save(exact), first);
    const fixed = snapshots + first.body.id + query;
    const { body: projected } = await send(fixed, owner.token);
    assert.equal(projected.snapshot.snapshotId, first.body.id);
    assert.equal(projected.snapshot.western.positions.find(({ planet }) => planet === 'Venus').longitude, 29.123456789);
    assert.deepEqual(projected.snapshot.ziwei.palaces[0].majorStars, palace.majorStars);
    assert.equal(projected.snapshot.ziwei.palaces[0].heavenlyStem, '甲');
    assert.deepEqual(projected.snapshot.ziwei.palaces[0].stemTransformations, palace.stemTransformations);
    assert.doesNotMatch(JSON.stringify(projected), /"(utc|julianDay|overview|solarDate|rawResult|timeIndex)"/u);
    assert.equal(projected.snapshot.birthContext, undefined);
    assert.equal(projected.snapshot.bazi.luckContext, undefined);
    const optedIn = fixed + '&calculationContext=1';
    const { body: { snapshot: enriched } } = await send(optedIn, owner.token);
    assert.deepEqual(enriched.birthContext, exact.chartSnapshot.birthContext);
    assert.deepEqual(enriched.bazi.luckContext, natal.luckContext);
    assert.equal((await send(optedIn, other.token)).status, 403);

    const partial = { ...reportAt(2, false), chartSnapshot: snapshot(false) };
    assert.equal((await save({ ...partial, chartSnapshot: { ...partial.chartSnapshot,
      birthContext: exact.chartSnapshot.birthContext } })).status, 400);
    partial.chartSnapshot.ziwei.rawResult[0].privateEngineData = '值'.repeat(24_000);
    assert.ok(Buffer.byteLength(JSON.stringify(partial)) > 64 * 1024);
    const second = await save(partial);
    assert.equal(second.status, 200);
    assert.equal(second.body.chartSnapshotSaved, true);
    assert.deepEqual((await send(history + '/latest' + query, owner.token)).body.report, partial);
    assert.deepEqual((await send(history + '/' + first.body.id + query, owner.token)).body.report, exact);
    assert.deepEqual((await send(fixed, owner.token)).body, projected);
    assert.equal((await send(latest + '&calculationContext=1', owner.token)).body.snapshot.birthContext, undefined);
    const { body: { snapshot: comparison } } = await send(latest, owner.token);
    assert.equal(comparison.bazi.status, 'partial');
    assert.deepEqual(comparison.bazi.pillars.find(({ position }) => position === 'hour'), {
      position: 'hour', stem: null, branch: null, hiddenStems: null, shenSha: [], shenShaComplete: true,
    });
    assert.equal(comparison.ziwei.reason, 'ambiguous_time');
    assert.equal(comparison.western.status, 'partial');
    assert.equal(comparison.western.ascendant, undefined);
    assert.equal(comparison.western.positions.some(({ planet }) => planet === 'Moon'), false);
    assert.deepEqual(comparison.western.positions.find(({ planet }) => planet === 'Venus'), { planet: 'Venus', signIndex: 0 });
    assert.ok((await send(history + query, owner.token)).body.entries.every((entry) => !('chartSnapshotSaved' in entry)));

    assert.equal((await send(fixed, other.token)).status, 403);
    assert.equal((await send(snapshots + first.body.id + expected(other.user.id), other.token)).status, 404);
    assert.equal((await send(snapshots + first.body.id + expected(guest.id), guest.token)).status, 403);
    assert.equal((await send(fixed, '')).status, 401);
    assert.equal((await save({ ...exact, chartSnapshot: { ...exact.chartSnapshot, timeKnown: false } })).status, 400);
    assert.equal((await save({ ...exact, chartSnapshot: { ...partial.chartSnapshot, timeKnown: true } })).status, 400);
    assert.equal((await save({ ...exact, overview: '字'.repeat(180_000) })).status, 400);
    now += 7 * 24 * 60 * 60 * 1000;
    assert.equal((await send(fixed, owner.token)).status, 401);
  } finally {
    store.close();
  }
});

test('shared reading APIs return selected birth fields and owned snapshots without report text', async () => {
  const store = openAccountStore(':memory:');
  const send = makeRequest(store, Date.now);
  try {
    const { body: owner } = await send('/auth/social/wechat', '', { authorizationCode: 'reading-owner' });
    const { body: other } = await send('/auth/social/wechat', '', { authorizationCode: 'reading-other' });
    const { body: guest } = await send('/auth/guest', '', {});
    const query = expected(owner.user.id);
    const birth = '/reading-profile/birth-profile';
    const birthFields = '&fields=birthDate,birthTime,birthPlace,gender';
    assert.deepEqual((await send(birth + query + birthFields, owner.token)).body, {
      birthDate: '', birthTime: '', birthPlace: '', gender: '',
    });
    const profile = {
      birthDate: '2000-01-01', birthTime: '', birthPlace: '私人地点', gender: 'other',
      visibility: { birthDate: false, birthTime: false, birthPlace: false, gender: false },
    };
    assert.equal((await send('/reading-profile', owner.token, profile, 'PATCH')).status, 200);
    assert.deepEqual((await send(birth + query + birthFields, owner.token)).body, {
      birthDate: profile.birthDate, birthTime: '', birthPlace: profile.birthPlace, gender: profile.gender,
    });
    assert.deepEqual((await send(birth + query + '&fields=birthDate', owner.token)).body, { birthDate: profile.birthDate });
    assert.equal((await send(birth + query + '&fields=visibility', owner.token)).status, 400);
    assert.equal((await send(birth + query + '&fields=birthTime,birthTime', owner.token)).status, 400);
    assert.equal((await send(birth + query + birthFields, other.token)).status, 403);
    assert.equal((await send(birth + expected(guest.id) + birthFields, guest.token)).status, 401);

    const chart = '/chart-snapshots/';
    const latest = chart + 'latest' + query;
    const save = (report) => send(history, owner.token, { expectedOwnerId: owner.user.id, report });
    assert.deepEqual((await send(latest, owner.token)).body, { status: 'no_archive' });
    const { body: old } = await save(reportAt(0, true));
    assert.deepEqual((await send(latest, owner.token)).body, {
      status: 'missing_snapshot', archiveId: old.id, calculatedAt: old.calculatedAt,
    });
    const report = { ...reportAt(1, false), chartSnapshot: snapshot(false) };
    const { body: saved } = await save(report);
    const available = { status: 'available', archiveId: saved.id, calculatedAt: saved.calculatedAt, chartSnapshot: report.chartSnapshot };
    assert.deepEqual((await send(latest, owner.token)).body, available);
    assert.deepEqual((await send(chart + saved.id + query, owner.token)).body, available);
    assert.equal((await send(chart + saved.id + query, other.token)).status, 403);
    assert.equal((await send(chart + saved.id + expected(other.user.id), other.token)).status, 404);
    assert.equal((await send(chart + saved.id + expected(guest.id), guest.token)).status, 404);
    const { body: guestSaved } = await send(history, guest.token, { expectedOwnerId: guest.id, report });
    assert.deepEqual((await send(chart + 'latest' + expected(guest.id), guest.token)).body, {
      ...available, archiveId: guestSaved.id,
    });
  } finally {
    store.close();
  }
});

test('confirmed birth profiles sync in both directions and protect privacy and concurrent edits', async () => {
  const store = openAccountStore(':memory:');
  const send = makeRequest(store, Date.now);
  try {
    const { body: owner } = await send('/auth/social/wechat', '', { authorizationCode: 'sync-owner' });
    const { body: guest } = await send('/auth/guest', '', {});
    const expectedOwnerId = owner.user.id;
    const birth = '/reading-profile/birth-profile';
    const readBirth = birth + expected(expectedOwnerId) + '&fields=birthDate,birthTime,birthPlace,gender';
    const { body: empty } = await send(readBirth, owner.token);
    const profile = { birthDate: '2000-02-29', birthTime: '09:??', birthPlace: '中国 · 北京市', gender: 'female' };
    const sync = { expectedOwnerId, expected: empty, profile };
    assert.equal((await send(birth, guest.token, sync, 'PATCH')).status, 401);
    assert.equal((await send(birth, owner.token, { ...sync, expectedOwnerId: guest.id }, 'PATCH')).status, 403);
    assert.deepEqual(await send(birth, owner.token, sync, 'PATCH'), { status: 200, body: profile });
    assert.equal((await send(birth, owner.token, sync, 'PATCH')).status, 200);
    const { body: { reading } } = await send('/reading-profile', owner.token);
    assert.deepEqual(reading, {
      ...profile, visibility: { birthDate: false, birthTime: false, birthPlace: false, gender: false },
    });

    const edited = { ...reading, birthTime: '??:30', visibility: { ...reading.visibility, birthDate: true } };
    assert.equal((await send('/reading-profile', owner.token,
      { ...edited, expectedOwnerId, expectedReading: reading }, 'PATCH')).status, 200);
    assert.deepEqual((await send(readBirth, owner.token)).body, { ...profile, birthTime: '??:30' });
    assert.equal((await send(birth, owner.token, sync, 'PATCH')).status, 409);
    const next = { ...profile, birthTime: '', birthPlace: '中国 · 上海市' };
    assert.equal((await send(birth, owner.token,
      { expectedOwnerId, expected: { ...profile, birthTime: '??:30' }, profile: next }, 'PATCH')).status, 200);
    const staleEdit = { ...edited, gender: 'male', expectedOwnerId, expectedReading: edited };
    assert.equal((await send('/reading-profile', owner.token, staleEdit, 'PATCH')).status, 409);
    assert.deepEqual((await send('/reading-profile', owner.token)).body, {
      reading: { ...next, visibility: edited.visibility }, visible: { birthDate: next.birthDate },
    });
    assert.equal((await send(birth, owner.token,
      { ...sync, expected: next, profile: { ...next, birthTime: '99:??' } }, 'PATCH')).status, 400);
  } finally {
    store.close();
  }
});

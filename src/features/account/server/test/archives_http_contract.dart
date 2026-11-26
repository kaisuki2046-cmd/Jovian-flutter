import 'dart:convert';
import 'dart:io';

import 'package:jovian_account_server/jovian_account_server.dart';

const owner = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const guest = '00000000-0000-4000-8000-000000000003';
const _when = '2000-01-01T00:00:00.000Z';
const _destinyPath = 'destiny-history';
const _readingPath = 'reading-history';

const _oracle = r'''
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { openAccountStore } from './src/features/account/storage/account-store.mjs';
import { tokenHash } from './src/features/account/auth/model/session-secret.mjs';
import { parseReadingArchive } from './src/features/account/history/model/reading-archive.mjs';
import { parseDestinyArchive } from './src/features/account/history/model/destiny-archive.mjs';
import { projectSynastrySnapshot } from './src/features/account/history/model/synastry-projection.mjs';
const x = JSON.parse(readFileSync(0, 'utf8'));
const db = openAccountStore(x.path);
try {
  const member = { id: x.owner, kind: 'member' };
  if (x.mode === 'seed') {
    for (const [index, id, token] of [[1, x.owner, x.first], [2, x.other, x.second]]) {
      db.register({id, email: index+'@example.test', displayName: 'Fixture '+index, salt: 'ab'.repeat(16),
        passwordHash: 'cd'.repeat(64), tokenHash: tokenHash(token), expiresAt: x.now + 60000, now: x.now});
    }
    db.startGuest({ id: x.guest, token: tokenHash(x.guestToken), expiresAt: x.now + 60000 });
    const hash = value => createHash('sha256').update(value).digest('hex');
    const fortune = parseReadingArchive(x.fortune);
    const data = JSON.stringify(fortune);
    const fortuneId = hash(data);
    db.saveReadingArchive(member, tokenHash(x.first), x.now, fortuneId, fortune, data);
    const legacyId = hash('legacy-with-sections');
    db.saveDestinyArchive(member, tokenHash(x.first), x.now, legacyId, x.oldDestiny, JSON.stringify(x.oldDestiny));
    const expectations = x.snapshots.map(input => {
      const report = parseDestinyArchive(input);
      const { charts, chartSnapshot, ...meta } = report;
      const id = hash(JSON.stringify({ ...meta, sections: [], charts, chartSnapshot }));
      const record = { id, calculatedAt: input.calculatedAt, report };
      return {id, projection: projectSynastrySnapshot(record), extended: projectSynastrySnapshot(record,true)};
    });
    process.stdout.write(JSON.stringify({fortuneId, legacyId, expectations}));
  } else {
    process.stdout.write(JSON.stringify({
      fortune: db.getReadingArchive(member,'fortune',x.fortuneId),
      synastry: db.getReadingArchive(member,'synastry',x.synastryId),
      destiny: db.getDestinyArchive(member,x.destinyId),
      guest: db.getReadingArchive({kind:'guest',id:x.guest},'fortune',x.fortuneId) ?? null,
    }));
  }
} finally { db.close(); }
''';

Future<Map<String, Object?>> _node(Map<String, Object?> input) async {
  final node = await Process.start(
    'node',
    ['--input-type=module', '--eval', _oracle],
    workingDirectory: Platform.script
        .resolve('../../../../../../')
        .toFilePath(),
  );
  final stdout = utf8.decoder.bind(node.stdout).join();
  final stderr = utf8.decoder.bind(node.stderr).join();
  node.stdin.encoding = utf8;
  node.stdin.write(jsonEncode(input));
  await node.stdin.close();
  if (await node.exitCode != 0) throw StateError(await stderr);
  return jsonDecode(await stdout) as Map<String, Object?>;
}

Map<String, Object?> _reading(String kind, int index) => {
  'version': 1,
  'kind': kind,
  'title': '完整解读 $index',
  'contextKey': 'context:$index',
  'calculatedAt': _when,
  'sections': [
    for (final name
        in kind == 'fortune'
            ? ['overall', 'wealth', 'romance']
            : ['family', 'friendship', 'romance', 'collaboration'])
      {'id': name, 'title': name, 'body': '原始解读包含完整内容。' * 900},
  ],
  'context': kind == 'fortune'
      ? {
          'snapshotId': 'a' * 64,
          'reportId': 'b' * 64,
          'calculationRunId': 'c' * 64,
          'periodType': 'month',
          'displayTimezone': 'Asia/Shanghai',
          'windowStart': 1.0,
          'windowEnd': 2.0,
        }
      : <String, Object?>{},
};

Map<String, Object?> _destiny(bool exact) => {
  'version': 1,
  'calculatedAt': _when,
  'timeKnown': exact,
  'mode': 'local',
  'overview': exact ? '命理报告，含出生时刻。' : '命理报告，时刻有候选。',
  'charts': [
    for (final name in ['bazi', 'ziwei', 'western'])
      {'method': name, 'engine': 'fixture', 'rows': []},
  ],
};

Map<String, Object?> _snapshot(bool exact) {
  const pillars = ['year', 'month', 'day', 'hour'];
  const planets = [
    'Sun',
    'Moon',
    'Mercury',
    'Venus',
    'Mars',
    'Jupiter',
    'Saturn',
    'Uranus',
    'Neptune',
    'Pluto',
  ];
  String timestamp(int i) => DateTime.utc(2000, 1, 1, 0, i).toIso8601String();
  Map<String, Object?> chart(String rules, List<Object?> raw) => {
    'engineName': 'fixture',
    'engineVersion': '1',
    'rulesetVersion': rules,
    'rawResult': raw,
  };
  final times = exact ? [0] : [0, 1];
  return {
    'version': 1,
    'timeKnown': exact,
    'samplingVersion': 'fixture',
    'bazi': chart('fixture', [
      for (final i in times)
        {
          'utc': timestamp(i),
          'year': '甲子',
          'month': '乙丑',
          'day': '丙寅',
          'hour': i == 0 ? '丁卯' : '戊辰',
          'shenShaRulesetVersion': 'natal-shensha-v1',
          'tenGods': {
            for (final p in pillars)
              p: {
                'heavenlyStem': '正印',
                'hiddenStems': [
                  {'stem': '甲', 'tenGod': '正印'},
                ],
              },
          },
          'shenSha': {
            for (final p in pillars)
              p: [
                if (p == 'year')
                  {
                    'name': '桃花',
                    'sourcePillars': ['day'],
                  },
              ],
          },
          'engineDetails': {
            '10': 1e-7,
            '2': -0.0,
            '0x2': 1e-6,
            'precision': 7.25e21,
          },
        },
    ]),
    'ziwei': chart('fixture', [
      for (final i in times)
        {
          'timeIndex': i,
          'palaces': [
            for (final (index, branch) in '子丑寅卯辰巳午未申酉戌亥'.split('').indexed)
              {
                'name': index == 0 ? '命宫' : '宫$index',
                'earthlyBranch': branch,
                'isBodyPalace': index == i,
                'majorStars': [
                  if (index == 0)
                    {
                      'name': '紫微',
                      'brightness': '旺',
                      'brightnessProfile': 'fixture',
                    },
                ],
                'minorStars': [],
                'adjectiveStars': [],
              },
          ],
        },
    ]),
    'western': chart('tropical-whole-sign-v1', [
      for (final i in times)
        {
          'utc': timestamp(i),
          'julianDay': 2451544.5 + i / 1440,
          'ascendant': 0.0,
          'midheaven': 86.123,
          'positions': [
            for (final planet in planets)
              {
                'planet': planet,
                'longitude': planet == 'Moon' && i > 0 ? 31 : 29.12,
                'latitude': -0.0,
                'house': 1,
              },
          ],
          'houses': [for (var j = 0; j < 12; j++) j * 30],
          'aspects': [],
        },
    ]),
    if (exact)
      'birthContext': {
        'precision': 'minute',
        'birthInstant': _when,
        'latitude': 30.0,
        'longitude': 110.25,
        'timeZone': 'Asia/Shanghai',
        'clockVersion': 'gregory-iana-intl-v1',
      },
  };
}

void _expect(bool test, String message) {
  if (!test) throw StateError(message);
}

Future<void> main() async {
  final dir = Directory.systemTemp.createTempSync('jovian-archive-');
  final file = File.fromUri(dir.uri.resolve('account.sqlite'));
  final first = createSessionSecret(),
      second = createSessionSecret(),
      guestToken = createSessionSecret();
  final now = DateTime.utc(2026, 11, 25);
  final exact = {..._destiny(true), 'chartSnapshot': _snapshot(true)};
  final partial = {..._destiny(false), 'chartSnapshot': _snapshot(false)};
  final input = {
    'path': file.path,
    'owner': owner,
    'other': other,
    'guest': guest,
    'first': first,
    'second': second,
    'guestToken': guestToken,
    'now': now.millisecondsSinceEpoch,
    'fortune': _reading('fortune', 0),
    'oldDestiny': {
      ..._destiny(true),
      'sections': [
        {
          'title': '旧版标题',
          'angle': '测试方向',
          'uncertain': false,
          'paragraphs': ['第一段', '第二段', '第三段'],
          'evidence': [],
        },
      ],
    },
    'snapshots': [exact, partial],
  };
  try {
    final baseline = await _node({...input, 'mode': 'seed'});
    final oldFortune = baseline['fortuneId'] as String;
    final oldDestiny = baseline['legacyId'] as String;
    final service = await serveAccount(
      databasePath: file.path,
      webOrigin: Uri.parse('http://localhost:8114'),
      port: 0,
      now: () => now,
    );
    final client = HttpClient();
    Future<Object?> send(
      String path, {
      String? token,
      String? id = owner,
      String? kind,
      String? cursor,
      String? context,
      Object? report,
      int status = 200,
      bool extended = false,
    }) async {
      final uri = Uri(
        scheme: 'http',
        host: '127.0.0.1',
        port: service.port,
        path: '/account/$path',
        queryParameters: {
          if (id != null) 'expectedOwnerId': id,
          if (kind != null) 'kind': kind,
          if (cursor != null) 'before': cursor,
          if (context != null) 'contextKey': context,
          if (extended) 'calculationContext': '1',
        },
      );
      final request = await client.openUrl(
        report == null ? 'GET' : 'POST',
        uri,
      );
      request.headers.set('X-App-Client', 'native');
      if (token != '')
        request.headers.set('Authorization', 'Bearer ${token ?? first}');
      if (report != null) {
        request.headers.contentType = ContentType.json;
        request.write(jsonEncode({'expectedOwnerId': id, 'report': report}));
      }
      final response = await request.close();
      final data = await utf8.decoder.bind(response).join();
      _expect(
        response.statusCode == status,
        '$path responded ${response.statusCode}, expected $status.',
      );
      return data.isEmpty ? null : jsonDecode(data);
    }

    late String synastryId, destinyId;
    try {
      _expect(
        await send('$_readingPath/latest', kind: 'synastry') == null,
        'Missing archive is not JSON null.',
      );
      final fortune =
          await send('$_readingPath/$oldFortune', kind: 'fortune') as Map;
      final duplicate =
          await send(_readingPath, report: input['fortune']) as Map;
      _expect(
        duplicate['id'] == oldFortune &&
            duplicate['savedAt'] == fortune['savedAt'],
        'Old archive was duplicated.',
      );
      final old = await send('$_destinyPath/$oldDestiny') as Map;
      final oldReport = old['report'] as Map;
      _expect(
        !oldReport.containsKey('sections') &&
            (oldReport['overview'] as String).contains('## 旧版标题\n\n第一段'),
        'Legacy report prose changed.',
      );
      for (var i = 1; i <= 21; i++) {
        await send(_readingPath, report: _reading('fortune', i));
      }
      final page = await send(_readingPath, kind: 'fortune') as Map;
      final next =
          await send(
                _readingPath,
                kind: 'fortune',
                cursor: page['nextCursor'] as String,
              )
              as Map;
      _expect(
        (page['entries'] as List).length == 20 &&
            (next['entries'] as List).length == 2 &&
            (next['entries'] as List).last['id'] == oldFortune,
        'Pagination missed equal-time rows.',
      );
      final matching =
          await send(
                '$_readingPath/latest',
                kind: 'fortune',
                context: 'context:0',
              )
              as Map;
      _expect(
        matching['id'] == oldFortune,
        'Context lookup returned the wrong result.',
      );
      await send(
        '$_readingPath/$oldFortune',
        kind: 'fortune',
        token: second,
        status: 403,
      );
      await send(
        '$_readingPath/$oldFortune',
        kind: 'fortune',
        token: second,
        id: other,
        status: 404,
      );
      await send(
        _readingPath,
        kind: 'fortune',
        token: second,
        id: other,
        cursor: oldFortune,
        status: 404,
      );
      await send('$_readingPath/$oldFortune', kind: 'synastry', status: 404);
      await send(_readingPath, kind: 'fortune', token: '', status: 401);
      await send(
        _readingPath,
        report: {..._reading('fortune', 99), 'sections': []},
        status: 400,
      );
      await send(
        _readingPath,
        report: input['fortune'],
        token: guestToken,
        id: guest,
      );
      await send(
        'synastry-chart-snapshots/latest',
        token: guestToken,
        id: guest,
        status: 403,
      );
      final logout = await client.postUrl(
        Uri.parse('http://127.0.0.1:${service.port}/account/auth/logout'),
      );
      logout.headers.set('X-App-Client', 'native');
      logout.headers.set('Authorization', 'Bearer $guestToken');
      await (await logout.close()).drain<void>();
      await send(
        _readingPath,
        kind: 'fortune',
        token: guestToken,
        id: guest,
        status: 401,
      );
      final synastry =
          await send(_readingPath, report: _reading('synastry', 31)) as Map;
      synastryId = synastry['id'] as String;
      await send(
        _destinyPath,
        report: {...exact, 'chartSnapshot': {}},
        status: 400,
      );
      for (final (index, report) in [exact, partial].indexed) {
        final expected = (baseline['expectations'] as List)[index] as Map;
        final receipt = await send(_destinyPath, report: report) as Map;
        final id = receipt['id'] as String;
        _expect(
          id == expected['id'] && receipt['chartSnapshotSaved'] == true,
          'Node/Dart snapshot ID differs.',
        );
        final full = await send('chart-snapshots/$id') as Map;
        _expect(
          full['status'] == 'available' && full['archiveId'] == id,
          'Full snapshot did not resume.',
        );
        for (final extended in [false, true]) {
          final projection = await send(
            'synastry-chart-snapshots/$id',
            extended: extended,
          );
          _expect(
            jsonEncode(projection) ==
                jsonEncode(expected[extended ? 'extended' : 'projection']),
            'Projected chart differs from Node.',
          );
        }
        if (index == 0) destinyId = id;
      }
    } finally {
      client.close(force: true);
      await service.close();
    }
    final restored = await _node({
      ...input,
      'mode': 'verify',
      'fortuneId': oldFortune,
      'synastryId': synastryId,
      'destinyId': destinyId,
    });
    _expect(
      (restored['fortune'] as Map)['id'] == oldFortune &&
          (restored['synastry'] as Map)['id'] == synastryId &&
          (restored['destiny'] as Map)['id'] == destinyId &&
          restored['guest'] == null,
      'Node cannot read Dart archives or guest archive remained after logout.',
    );
    stdout.writeln(
      'Archive HTTP passed Node/Dart SQLite round-trip, content IDs, pagination, all report kinds, snapshot projection, and owner isolation.',
    );
  } finally {
    if (file.existsSync()) file.deleteSync();
    dir.deleteSync();
  }
}

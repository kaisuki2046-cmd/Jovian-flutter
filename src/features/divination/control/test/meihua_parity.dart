import 'dart:io';

import '../lib/jovian_divination.dart';
import 'parity_support.dart';

// The legacy program is an oracle for this migration test only.
const _legacyProgram = r'''
import { readFileSync } from 'node:fs';
import { readMeihuaNumbers, readMeihua, readMeihuaClicks } from './src/features/divination/control/meihua.mjs';
const cases = JSON.parse(readFileSync(0, 'utf8'));
process.stdout.write(JSON.stringify(cases.map(([kind, input]) => {
  if (kind === 'numbers') return readMeihuaNumbers(input);
  if (kind === 'lines') return readMeihua(input);
  return readMeihuaClicks(input);
})));
''';

Future<void> main() async {
  final cases = <(String, List<Object>)>[];
  final anchor = BigInt.parse('2400000000000');
  for (var upper = 1; upper <= 8; upper++) {
    for (var lower = 1; lower <= 8; lower++) {
      for (var last = 1; last <= 6; last++) {
        final values = [upper, lower, last];
        cases.add(('numbers', values));
        cases.add((
          'clicks',
          values
              .map((value) => (anchor + BigInt.from(value)).toString())
              .toList(),
        ));
      }
    }
  }
  for (var first = 6; first <= 9; first++) {
    for (var second = 6; second <= 9; second++) {
      for (var third = 6; third <= 9; third++) {
        cases.add(('lines', [first, second, third]));
      }
    }
  }
  cases.addAll([
    ('numbers', [999, 1, 998]),
    ('numbers', [999, 999, 999]),
    ('clicks', ['1794528002008', '1794528001003', '1794528000002']),
    ('clicks', ['1794528002008', '1794528002008', '1794528002008']),
    ('clicks', ['9007199254740993', '9999999999999999', '9007199254740995']),
  ]);

  final expected = await runLegacyOracle(
    _legacyProgram,
    cases.map((entry) => [entry.$1, entry.$2]).toList(),
  );
  if (expected.length != cases.length)
    throw StateError('Legacy oracle returned the wrong number of results.');
  for (var index = 0; index < cases.length; index++) {
    final (kind, values) = cases[index];
    final actual = switch (kind) {
      'numbers' => readMeihuaNumbers(values.cast<int>()),
      'lines' => readMeihua(values.cast<int>()),
      _ => readMeihuaClicks(values.cast<String>()),
    };
    if (!deepEquals(actual.toJson(), expected[index])) {
      throw StateError(
        'Parity failed for $kind $values\nExpected: ${expected[index]}\nActual: ${actual.toJson()}',
      );
    }
  }
  expectRejected(() => readMeihuaNumbers([0, 1, 2]));
  expectRejected(() => readMeihuaNumbers([1, 2, 1000]));
  expectRejected(() => readMeihuaNumbers([1, 2]));
  expectRejected(() => readMeihua([5, 6, 7]));
  expectRejected(() => readMeihuaClicks(['01', '2', '3']));
  expectRejected(() => readMeihuaClicks(['1', '2', '3.0']));
  stdout.writeln(
    '${cases.length} legacy results match field for field. Invalid input checks passed.',
  );
}

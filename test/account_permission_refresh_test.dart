import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:material_ui/material_ui.dart';

import '../src/features/account/account.dart';
import '../src/features/account/settings/model/agreements.dart';
import '../src/shared/http/json_client.dart';

const _destiny = 'destiny.cloud_interpretation';
const _fortune = 'fortune.cloud_interpretation';
const _updated = '协议已更新，请阅读并重新确认后继续。';

void main() {
  testWidgets('stale AI consent refreshes before an explicit new choice', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(320, 560);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);

    final service = _PermissionService();
    final account = service.account;
    addTearDown(account.dispose);
    await account.initialize();

    await tester.pumpWidget(
      MaterialApp(
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: const TextScaler.linear(1.8)),
          child: child!,
        ),
        home: AccountPrivacyPage(account: account, onlyAiPermissions: true),
      ),
    );
    await tester.pumpAndSettle();

    final destiny = find.widgetWithText(SwitchListTile, '命理在线解读');
    await _tap(tester, destiny);
    expect(find.text('确认 AI 授权'), findsOneWidget);
    service.aiVersion = 'v2';
    await _tap(tester, find.text('同意授权'));
    expect(account.notice, _updated);
    expect(find.text(_updated).hitTestable(), findsOneWidget);
    expect(account.catalog?.ai.version, 'v2');
    expect(account.authorizedSession?.id, 'fixture-member');
    expect(tester.widget<SwitchListTile>(destiny).value, isFalse);
    expect(service.proofs.map((row) => row['version']), ['v1']);

    await _tap(tester, destiny);
    final notice = find.descendant(
      of: find.byType(AlertDialog),
      matching: find.text('《AI 服务与数据共享告知》'),
    );
    await _tap(tester, notice);
    expect(find.text('AI 告知的 v2 正文'), findsOneWidget);
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    await _tap(tester, find.text('同意授权'));
    expect(tester.widget<SwitchListTile>(destiny).value, isTrue);
    expect(service.proofs.map((row) => row['version']), ['v1', 'v2']);
    expect(service.proofs.map((row) => row['hash']), ['ai-v1', 'ai-v2']);
    expect(tester.takeException(), isNull);
  });

  test(
    'bulk authorization reloads if current terms require confirmation',
    () async {
      final service = _PermissionService();
      final account = service.account;
      addTearDown(account.dispose);
      await account.initialize();

      service.requiredVersion = 'v2';
      service.requiredAccepted = false;
      await account.grantAll(account.catalog!.ai);

      expect(account.catalog?.terms.version, 'v2');
      expect(account.agreementState?.requiredAccepted, isFalse);
      expect(account.authorizedSession, isNull);
      expect(account.notice, _updated);
      expect(service.proofs.length, aiPurposes.length);
      expect(service.permissions.values, everyElement(isFalse));
    },
  );

  test(
    'bulk authorization shows the server state after a partial failure',
    () async {
      final service = _PermissionService()..failingPurpose = _fortune;
      final account = service.account;
      addTearDown(account.dispose);
      await account.initialize();

      await account.grantAll(account.catalog!.ai);
      expect(account.agreementState?.permissions[_destiny], isTrue);
      expect(account.agreementState?.permissions[_fortune], isFalse);
      expect(account.notice, '部分 AI 授权未保存，可在隐私设置中查看或重试。');
      expect(service.catalogReads, 1);
      expect(service.proofs.length, aiPurposes.length);
    },
  );
}

Future<void> _tap(WidgetTester tester, Finder control) async {
  await tester.ensureVisible(control);
  await tester.tap(control);
  await tester.pumpAndSettle();
}

class _PermissionService {
  _PermissionService() {
    final api = AccountApi(
      JsonHttpClient(
        base: Uri.https('fixture.invalid'),
        client: MockClient(_request),
      ),
    );
    account = AccountController(api, AgreementsApi(api));
  }

  late final AccountController account;
  final proofs = <Map<String, Object?>>[];
  final permissions = {for (final purpose in aiPurposes.keys) purpose: false};
  var aiVersion = 'v1';
  var requiredVersion = 'v1';
  var requiredAccepted = true;
  var catalogReads = 0;
  String? failingPurpose;

  Future<http.Response> _request(http.Request request) async {
    switch ((request.method, request.url.path)) {
      case ('GET', '/account/session'):
        return _json({
          'user': {'id': 'fixture-member', 'displayName': '测试账号'},
        });
      case ('GET', '/account/auth/capabilities'):
        return _json({});
      case ('GET', '/account/agreements/catalog'):
        catalogReads++;
        return _json({
          'documents': [
            _document('terms', requiredVersion, '用户服务协议'),
            _document('privacy', requiredVersion, '隐私政策'),
            _document('ai', aiVersion, 'AI 服务与数据共享告知'),
          ],
        });
      case ('GET', '/account/agreements'):
        return _state();
      case ('POST', '/account/agreements/permission'):
        final body = jsonDecode(request.body) as Map<String, Object?>;
        proofs.add(body);
        if (body['version'] != aiVersion || body['hash'] != 'ai-$aiVersion') {
          return _json({}, 409);
        }
        if (body['agreed'] == true && !requiredAccepted) return _json({}, 403);
        final purpose = body['purpose'] as String;
        if (purpose == failingPurpose) return _json({}, 503);
        permissions[purpose] = body['agreed'] == true;
        return _state();
      default:
        throw StateError(
          'Unexpected test request: ' + request.method + ' ' + request.url.path,
        );
    }
  }

  http.Response _state() =>
      _json({'requiredAccepted': requiredAccepted, 'permissions': permissions});

  Map<String, Object?> _document(String id, String version, String title) => {
    'id': id,
    'version': version,
    'hash': '$id-$version',
    'title': title,
    'state': 'published',
    'sections': [
      {'title': '测试正文', 'text': 'AI 告知的 $version 正文'},
    ],
  };

  http.Response _json(Object body, [int status = 200]) =>
      http.Response.bytes(utf8.encode(jsonEncode(body)), status);
}

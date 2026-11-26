import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:material_ui/material_ui.dart';

import '../src/app/main.dart';
import '../src/features/account/account.dart';
import '../src/features/account/settings/model/agreements.dart';
import '../src/shared/http/json_client.dart';

void main() {
  testWidgets('in-app and system Back preserve a basic profile draft', (
    tester,
  ) async {
    final service = _ProfileService();
    await _open(tester, service, '基础个人资料');
    final name = find.widgetWithText(TextField, '昵称');

    await tester.enterText(name, '占用昵称');
    await tester.pump();
    await _tap(tester, find.byType(BackButton));
    expect(find.byType(AlertDialog), findsOneWidget);
    await _tap(tester, find.text('继续编辑'));
    expect(tester.widget<TextField>(name).controller!.text, '占用昵称');
    expect(service.profileWrites, isEmpty);

    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    await _tap(tester, find.text('保存并离开'));
    expect(find.text('这个昵称已被使用，请换一个。'), findsOneWidget);
    expect(tester.widget<TextField>(name).controller!.text, '占用昵称');
    expect(service.profile['displayName'], '原昵称');

    await tester.enterText(name, '已保存昵称');
    await tester.pump();
    await _tap(tester, find.byType(BackButton));
    await _tap(tester, find.text('保存并离开'));
    expect(find.text('设置'), findsOneWidget);
    expect(service.profile['displayName'], '已保存昵称');
    expect(service.profileWrites.last['expectedOwnerId'], 'fixture-owner');

    await _tap(tester, find.text('基础个人资料'));
    await tester.enterText(name, '临时草稿');
    await tester.pump();
    await _tap(tester, find.byType(BackButton));
    await _tap(tester, find.text('放弃修改'));
    expect(find.text('设置'), findsOneWidget);
    expect(service.profileWrites, hasLength(2));
    expect(service.profile['displayName'], '已保存昵称');
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'privacy uses one leave confirmation for both visibility drafts',
    (tester) async {
      final service = _ProfileService();
      await _open(tester, service, '隐私设置');
      final publicName = find.widgetWithText(SwitchListTile, '公开昵称');
      final publicBirth = find.widgetWithText(SwitchListTile, '公开出生年月日');
      await _scrollTap(tester, publicName);
      await _scrollTap(tester, publicBirth);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.byType(AlertDialog), findsOneWidget);
      expect(service.profileWrites, isEmpty);
      expect(service.birthWrites, isEmpty);
      await _tap(tester, find.text('保存并离开'));
      expect(find.text('设置'), findsOneWidget);
      expect(service.profileWrites.single['visibility'], {
        'displayName': true,
        'bio': false,
      });
      final saved = service.birthWrites.single;
      expect(saved['expectedOwnerId'], 'fixture-owner');
      expect((saved['visibility'] as Map)['birthDate'], true);
      expect(
        ((saved['expectedReading'] as Map)['visibility'] as Map)['birthDate'],
        false,
      );

      await _tap(tester, find.text('隐私设置'));
      await _scrollTap(tester, publicName);
      await _scrollTap(tester, publicBirth);
      await _tap(tester, find.byType(BackButton));
      await _tap(tester, find.text('放弃修改'));
      expect(find.text('设置'), findsOneWidget);
      expect(service.profileWrites, hasLength(1));
      expect(service.birthWrites, hasLength(1));
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('an owner change dismisses an old draft and cannot save it', (
    tester,
  ) async {
    final service = _ProfileService();
    await _open(tester, service, '基础个人资料');
    final name = find.widgetWithText(TextField, '昵称');
    await tester.enterText(name, '原账号的草稿');
    await tester.pump();
    await _tap(tester, find.byType(BackButton));
    expect(find.byType(AlertDialog), findsOneWidget);

    service.profile = {
      ...service.profile,
      'id': 'another-owner',
      'displayName': '新登录账号',
    };
    await service.account.initialize();
    await tester.pumpAndSettle();
    expect(find.byType(AlertDialog), findsNothing);
    expect(tester.widget<TextField>(name).controller!.text, '新登录账号');
    expect(service.profileWrites, isEmpty);
    expect(tester.takeException(), isNull);
  });
}

Future<void> _open(
  WidgetTester tester,
  _ProfileService service,
  String section,
) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = const Size(320, 680);
  addTearDown(tester.view.resetDevicePixelRatio);
  addTearDown(tester.view.resetPhysicalSize);
  await tester.pumpWidget(
    JovianApp(account: service.account, initialTab: JovianTab.account),
  );
  await tester.pumpAndSettle();
  await _tap(tester, find.byTooltip('设置'));
  await _tap(tester, find.text(section));
}

Future<void> _tap(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

Future<void> _scrollTap(WidgetTester tester, Finder finder) async {
  await tester.scrollUntilVisible(finder, 160);
  await Scrollable.ensureVisible(tester.element(finder), alignment: 0.4);
  await tester.pumpAndSettle();
  await tester.tap(finder.hitTestable());
  await tester.pumpAndSettle();
}

class _ProfileService {
  _ProfileService() {
    final api = AccountApi(
      JsonHttpClient(
        base: Uri.parse('https://account.example.test'),
        client: MockClient((request) async => _reply(request)),
      ),
    );
    account = AccountController(api, AgreementsApi(api));
  }

  late final AccountController account;
  var profile = <String, Object?>{
    'id': 'fixture-owner',
    'displayName': '原昵称',
    'bio': '原简介',
    'visibility': {'displayName': false, 'bio': false},
  };
  var birth = <String, Object?>{
    'birthDate': '1999-04-18',
    'birthTime': '',
    'birthPlace': '',
    'gender': '',
    'visibility': {
      'birthDate': false,
      'birthTime': false,
      'birthPlace': false,
      'gender': false,
    },
  };
  final profileWrites = <Map<String, Object?>>[];
  final birthWrites = <Map<String, Object?>>[];

  http.Response _reply(http.Request request) {
    switch ('${request.method} ${request.url.path}') {
      case 'GET /account/session':
        return _json({'user': profile});
      case 'GET /account/auth/capabilities':
        return _json({});
      case 'GET /account/agreements/catalog':
        return _json({
          'documents': [
            for (final id in ['terms', 'privacy', 'ai'])
              {
                'id': id,
                'title': id,
                'hash': 'hash-$id',
                'version': 'v1',
                'state': 'preview',
                'sections': [],
              },
          ],
        });
      case 'GET /account/agreements':
        return _json({
          'requiredAccepted': true,
          'permissions': {for (final key in aiPurposes.keys) key: false},
        });
      case 'GET /account/reading-profile':
        return _json({'reading': birth});
      case 'PATCH /account/profile':
        final data = jsonDecode(request.body) as Map<String, Object?>;
        profileWrites.add(data);
        if (data['displayName'] == '占用昵称') return _json({}, 409);
        profile = {...profile, ...data};
        return _json({'user': profile});
      case 'PATCH /account/reading-profile':
        final data = jsonDecode(request.body) as Map<String, Object?>;
        birthWrites.add(data);
        birth = {...birth, ...data};
        return _json({'reading': birth});
      case 'GET /social/me':
        return _json({'followingCount': 0, 'followerCount': 0});
      default:
        return _json({}, 404);
    }
  }
}

http.Response _json(Object body, [int status = 200]) =>
    http.Response.bytes(utf8.encode(jsonEncode(body)), status);

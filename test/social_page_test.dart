import 'dart:async';
import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:material_ui/material_ui.dart';

import '../src/app/app_shell.dart';
import '../src/app/main.dart' show JovianApp;
import '../src/features/account/account.dart';
import '../src/features/account/auth/model/session.dart';
import '../src/features/account/settings/model/agreements.dart';
import '../src/features/social/control/message_workspace_controller.dart';
import '../src/features/social/model/social.dart';
import '../src/features/social/social.dart';
import '../src/features/social/view/message_components.dart';
import '../src/features/social/view/message_design.dart';
import '../src/features/social/view/message_stories.dart';
import '../src/features/social/view/message_thread_page.dart';
import '../src/shared/http/json_client.dart';
import '../src/ui/interface_language.dart';
import '../src/ui/theme.dart';

const _memberId = '00000000-0000-0000-0000-000000000001';
const _actorId = '00000000-0000-0000-0000-000000000002';
const _alertId = '00000000-0000-0000-0000-000000000003';

class _Storage implements NativeSessionStorage {
  String? token = 'fixture-token';
  Completer<String?>? nextRead;

  @override
  Future<String?> read() {
    final pending = nextRead;
    nextRead = null;
    return pending?.future ?? Future.value(token);
  }

  @override
  Future<void> write(String? token) async => this.token = token;
}

class _GroupHistory extends Fake implements MessageHistory {
  _GroupHistory(this.image) {
    final start = DateTime(2026, 11, 28, 20);
    messagesNewestFirst = [
      for (final (id, body) in [
        (4, '🫶🫶'),
        (3, '集合时间我记下了。'),
        (2, '先看北面的星图。'),
        (1, ''),
      ])
        ConversationMessage(
          id: id,
          senderId: _actorId,
          senderName: '阿岚',
          sentAt: start.add(Duration(seconds: id)),
          body: body,
          attachment: id == 1
              ? MessageAttachment(
                  kind: MessageMediaKind.image,
                  name: '星图.jpg',
                  type: 'image/jpeg',
                  size: image.length,
                )
              : null,
          reply: null,
        ),
    ];
  }

  final Uint8List image;
  late final List<ConversationMessage> messagesNewestFirst;

  @override
  String get memberId => _memberId;

  @override
  bool get isCurrentMember => true;

  @override
  Future<List<ConversationMember>> conversationMembers(String thread) async => [
    const ConversationMember(_memberId, '我'),
    const ConversationMember(_actorId, '阿岚'),
    const ConversationMember(_alertId, '小禾'),
  ];

  @override
  Future<SocialResultPage<ConversationMessage>> messages(
    String thread, {
    String? before,
  }) async {
    final cursor = int.tryParse(before ?? '');
    return SocialResultPage(
      messagesNewestFirst
          .where((message) => cursor == null || message.id < cursor)
          .toList(),
      null,
    );
  }

  @override
  Future<void> markConversationRead(String thread, int through) async {}

  @override
  Future<Uint8List> loadMessageAttachment(
    String thread,
    ConversationMessage message,
  ) async => image;
}

const _profile = <String, Object?>{
  'id': _actorId,
  'uid': '12345678',
  'displayName': '明月',
  'following': 2,
  'followers': 3,
  'follows': false,
  'followedBy': true,
};

http.Response _json(Object value, [int status = 200]) =>
    http.Response.bytes(utf8.encode(jsonEncode(value)), status);

AccountController _account(
  _Storage storage,
  Future<http.Response> Function(http.Request) social, {
  Future<http.Response> Function(http.Request)? visibleProfile,
  bool guest = false,
}) {
  final api = AccountApi(
    JsonHttpClient(
      base: Uri.parse('https://account.example.test'),
      client: MockClient((request) async {
        if (request.url.path.startsWith('/social/')) {
          expect(request.headers['x-app-client'], 'native');
          expect(request.headers['authorization'], 'Bearer fixture-token');
          return social(request);
        }
        if (request.url.path == '/account/profile/visible/$_actorId') {
          expect(request.headers['x-app-client'], 'native');
          expect(request.headers['authorization'], 'Bearer fixture-token');
          return visibleProfile == null
              ? _json({
                  'profile': {'reading': {}},
                })
              : visibleProfile(request);
        }
        switch (request.url.path) {
          case '/account/session':
            return guest
                ? _json({
                    'guest': {
                      'id': 'guest-fixture',
                      'expiresAt': 1800000000000,
                    },
                  })
                : _json({
                    'user': {'id': _memberId, 'displayName': '当前会员'},
                  });
          case '/account/auth/capabilities':
            return _json({});
          case '/account/agreements/catalog':
            return _json({
              'documents': [
                for (final id in ['privacy', 'terms', 'ai'])
                  {
                    'id': id,
                    'version': 'v1',
                    'hash': 'fixture-$id',
                    'title': id,
                    'state': 'preview',
                    'sections': [],
                  },
              ],
            });
          case '/account/agreements':
            return _json({
              'requiredAccepted': true,
              'permissions': {
                for (final purpose in aiPurposes.keys) purpose: true,
              },
            });
          case '/account/auth/logout':
            return http.Response('', 204);
          default:
            fail('Unexpected account route ${request.method} ${request.url}');
        }
      }),
    ),
    nativeSession: storage,
  );
  return AccountController(api, AgreementsApi(api));
}

Future<void> _openMessageTool(WidgetTester tester, String label) async {
  final chinese = find.byTooltip('消息菜单');
  await tester.tap(
    chinese.evaluate().isEmpty ? find.byTooltip('Messages menu') : chinese,
  );
  await tester.pumpAndSettle();
  final drawer = find.byType(Drawer);
  final item = find
      .descendant(of: drawer, matching: find.text(label))
      .hitTestable();
  final list = find.descendant(of: drawer, matching: find.byType(Scrollable));
  await tester.scrollUntilVisible(item, 170, scrollable: list.first);
  await tester.pumpAndSettle();
  await tester.tap(item);
  await tester.pumpAndSettle();
}

void main() {
  setUp(() {
    final dispatcher =
        TestWidgetsFlutterBinding.ensureInitialized().platformDispatcher;
    dispatcher.accessibilityFeaturesTestValue = const FakeAccessibilityFeatures(
      disableAnimations: true,
    );
    addTearDown(dispatcher.clearAccessibilityFeaturesTestValue);
  });

  testWidgets('new story rings animate until the story opens', (tester) async {
    tester.binding.platformDispatcher.accessibilityFeaturesTestValue =
        const FakeAccessibilityFeatures();
    await tester.pumpWidget(const MaterialApp(home: SocialPage()));
    await tester.pump();
    final strip = find.byType(MessageStoryStrip);
    final rings = find.descendant(
      of: strip,
      matching: find.byType(RotationTransition),
    );
    final unread = rings.evaluate().length;
    final initial = tester.widget<RotationTransition>(rings.first).turns.value;
    await tester.pump(const Duration(milliseconds: 450));
    expect(
      tester.widget<RotationTransition>(rings.first).turns.value,
      isNot(initial),
    );

    await tester.tap(find.descendant(of: strip, matching: find.text('岑宁')));
    await tester.pump();
    final sweep = tester.widget<RotationTransition>(rings.first).turns;
    await tester.pump(const Duration(milliseconds: 120));
    expect(sweep.value, closeTo(1 / 3, .02));
    expect(find.byTooltip('关闭'), findsNothing);
    await tester.pump(const Duration(milliseconds: 260));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 350));
    await tester.tap(find.byTooltip('关闭'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(rings, findsNWidgets(unread - 1));
    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets('signed-out inbox opens demo chats and applies chat appearance', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 3;
    tester.view.physicalSize = const Size(1170, 2340);
    tester.view.padding = const FakeViewPadding(top: 96, bottom: 72);
    tester.view.viewPadding = tester.view.padding;
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetPadding);
    addTearDown(tester.view.resetViewPadding);
    addTearDown(tester.view.resetViewInsets);
    final mode = ValueNotifier(ThemeMode.light);
    final light = jovianTheme(Brightness.light);
    final dark = jovianTheme(Brightness.dark);
    addTearDown(mode.dispose);
    await tester.pumpWidget(
      ValueListenableBuilder(
        valueListenable: mode,
        builder: (_, themeMode, home) => MaterialApp(
          theme: light,
          darkTheme: dark,
          themeMode: themeMode,
          home: home,
        ),
        child: const SocialPage(),
      ),
    );
    await tester.pumpAndSettle();
    final header = tester.widget<AppBar>(find.byType(AppBar));
    const referenceScale = 390 / 576;
    expect(header.centerTitle, isTrue);
    expect(header.toolbarHeight, closeTo(64 * referenceScale, .1));
    expect(header.backgroundColor, light.scaffoldBackgroundColor);
    final stories = find.byType(MessageStoryStrip);
    expect(tester.getSize(stories).height, closeTo(144 * referenceScale, .5));
    final firstAvatar = find
        .descendant(of: stories, matching: find.byType(MessageAvatar))
        .first;
    expect(tester.getSize(firstAvatar).width, closeTo(82 * referenceScale, .1));
    expect(tester.widget<MessageAvatar>(firstAvatar).asset, messageSelfAvatar);
    expect(find.text('会话'), findsNothing);
    expect(find.text('体验会话'), findsNothing);
    expect(find.text('互动消息'), findsOneWidget);
    expect(find.byType(MessageConversationRow), findsAtLeastNWidgets(4));
    final row = find.widgetWithText(MessageConversationRow, '岑宁');
    expect(tester.getSize(row).height, closeTo(105 * referenceScale, .1));
    final rowPhoto = find
        .descendant(of: row, matching: find.byType(Image))
        .first;
    expect(
      tester.widget<Image>(rowPhoto).image,
      AssetImage(messageDemoAvatar('demo-cen')!),
    );
    await tester.tap(row);
    await tester.pumpAndSettle();
    expect(find.text('星轨片段.mp4'), findsOneWidget);
    final firstMessage = find.text('今天傍晚的云像一层薄薄的纸。');
    final toolbarBottom = tester.getBottomLeft(find.byType(AppBar)).dy;
    expect(
      tester.getTopLeft(firstMessage).dy - toolbarBottom,
      inInclusiveRange(0, 75),
    );
    final ownPhoto = find.byWidgetPredicate(
      (widget) =>
          widget is Image &&
          widget.image == const AssetImage(messageSelfAvatar),
    );
    expect(ownPhoto, findsOneWidget);
    final input = find.byType(TextField);
    final microphone = find.byTooltip('录音');
    final attachments = find.byTooltip('添加附件');
    expect(tester.getSize(microphone).height, closeTo(64 * referenceScale, .1));
    expect(
      tester.getCenter(attachments).dy,
      closeTo(tester.getCenter(input).dy, .1),
    );
    expect(tester.getBottomRight(attachments).dy, lessThan(780 - 24));
    await tester.tap(find.byTooltip('表情'));
    await tester.pumpAndSettle();
    expect(
      tester.widget<GridView>(find.byType(GridView)).gridDelegate,
      isA<SliverGridDelegateWithFixedCrossAxisCount>().having(
        (delegate) => delegate.crossAxisCount,
        'column count',
        4,
      ),
    );
    await tester.tap(find.byTooltip('表情'));
    await tester.pumpAndSettle();
    final composerBottom = tester.getBottomRight(attachments).dy;
    tester.view.padding = const FakeViewPadding(top: 96);
    tester.view.viewInsets = const FakeViewPadding(bottom: 840);
    await tester.pumpAndSettle();
    expect(
      composerBottom - tester.getBottomRight(attachments).dy,
      closeTo(256, .5),
    );
    await tester.enterText(find.byType(TextField), '本地演示消息');
    await tester.pump();
    await tester.tap(find.byTooltip('发送'));
    await tester.pumpAndSettle();
    tester.view.resetViewInsets();
    tester.view.padding = tester.view.viewPadding;
    await tester.pumpAndSettle();
    expect(find.text('本地演示消息'), findsOneWidget);
    final bubble = find
        .ancestor(
          of: find.text('本地演示消息'),
          matching: find.byWidgetPredicate(
            (widget) =>
                widget is Material && widget.shape is RoundedRectangleBorder,
          ),
        )
        .first;
    final previousBubbleColor = tester.widget<Material>(bubble).color;

    await tester.tap(find.byTooltip('会话设置'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('聊天装扮'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('苔青'));
    await tester.pumpAndSettle();
    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    Finder chatWithBackground(Color color) => find.byWidgetPredicate(
      (widget) => widget is Scaffold && widget.backgroundColor == color,
    );
    expect(chatWithBackground(light.scaffoldBackgroundColor), findsOneWidget);
    expect(tester.widget<Material>(bubble).color, isNot(previousBubbleColor));
    mode.value = ThemeMode.dark;
    await tester.pumpAndSettle();
    expect(chatWithBackground(dark.scaffoldBackgroundColor), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets('group tabs keep a narrow chat draft and organize its messages', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(320, 720);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetViewInsets);
    final bytes = (await tester.runAsync(
      () => rootBundle.load('src/features/social/assets/avatars/cen.jpg'),
    ))!;
    final workspace = MessageWorkspaceController('group-layout-test');
    addTearDown(workspace.dispose);
    await tester.pumpWidget(
      MaterialApp(
        theme: jovianTheme(Brightness.light),
        home: MessageThreadPage(
          controller: _GroupHistory(
            bytes.buffer.asUint8List(bytes.offsetInBytes, bytes.lengthInBytes),
          ),
          thread: workspace.conversation('demo-sky')!,
          workspace: workspace,
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('晚风观星组'), findsOneWidget);
    expect(find.text('3'), findsOneWidget);
    expect(find.text('阿岚'), findsOneWidget);
    expect(
      find.byWidgetPredicate(
        (widget) => widget is Image && widget.semanticLabel == '星图.jpg',
      ),
      findsOneWidget,
    );
    final first = find.text('先看北面的星图。');
    final second = find.text('集合时间我记下了。');
    expect(
      tester.getTopLeft(first).dx,
      closeTo(tester.getTopLeft(second).dx, .1),
    );

    final draft = find.byType(TextField);
    await tester.enterText(draft, '这条草稿还没有发送');
    tester.view.viewInsets = const FakeViewPadding(bottom: 310);
    await tester.pumpAndSettle();
    expect(draft.hitTestable(), findsOneWidget);
    expect(find.byTooltip('发送').hitTestable(), findsOneWidget);
    tester.view.resetViewInsets();

    await tester.tap(find.text('公告'));
    await tester.pumpAndSettle();
    expect(find.text('周五晚八点在北岸天台集合。'), findsOneWidget);
    expect(draft.hitTestable(), findsNothing);
    await tester.tap(find.text('设置'));
    await tester.pumpAndSettle();
    expect(find.text('会话成员'), findsOneWidget);
    await tester.tap(find.text('聊天'));
    await tester.pumpAndSettle();
    expect(tester.widget<TextField>(draft).controller!.text, '这条草稿还没有发送');

    await tester.tap(find.text('回复'));
    await tester.pumpAndSettle();
    expect(find.byTooltip('取消引用'), findsOneWidget);
    await tester.tap(find.byTooltip('取消引用'));
    await tester.pumpAndSettle();

    await tester.longPress(second);
    await tester.pumpAndSettle();
    await tester.tap(find.text('置顶消息'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('置顶'));
    await tester.pumpAndSettle();
    expect(second.hitTestable(), findsOneWidget);
    await tester.tap(second);
    await tester.pumpAndSettle();
    expect(find.text('回到最新'), findsOneWidget);
    await tester.tap(find.text('回到最新'));
    await tester.pumpAndSettle();

    await tester.longPress(first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('收藏消息'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('收藏'));
    await tester.pumpAndSettle();
    expect(first.hitTestable(), findsOneWidget);
    await tester.tap(find.byTooltip('取消收藏消息'));
    await tester.pumpAndSettle();
    expect(find.text('长按聊天消息，即可收藏到这里。'), findsOneWidget);

    await tester.tap(find.text('聊天'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('收起群聊导航'));
    await tester.pumpAndSettle();
    expect(find.text('公告'), findsNothing);
    expect(draft.hitTestable(), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets('long message history still opens at the latest message', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(360, 680);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    final workspace = MessageWorkspaceController('long-message-history-test');
    addTearDown(workspace.dispose);
    for (var i = 1; i <= 34; i++) {
      await workspace.sendMessage('demo-cen', body: '演示长会话 $i', nonce: '$i');
    }
    await tester.pumpWidget(
      MaterialApp(
        home: MessageThreadPage(
          controller: workspace,
          thread: workspace.conversation('demo-cen')!,
          workspace: workspace,
        ),
      ),
    );
    await tester.pumpAndSettle();

    final latest = find.text('演示长会话 34');
    final oldest = find.text('演示长会话 1');
    expect(latest.hitTestable(), findsOneWidget);
    expect(oldest.hitTestable(), findsNothing);
    final history = find.byWidgetPredicate(
      (widget) => widget is ListView && widget.reverse,
    );
    final scrollable = find
        .descendant(of: history, matching: find.byType(Scrollable))
        .first;
    final loadOlder = find.text('加载更早的消息');
    await tester.scrollUntilVisible(loadOlder, 320, scrollable: scrollable);
    await tester.tap(loadOlder);
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(oldest, 320, scrollable: scrollable);
    expect(oldest.hitTestable(), findsOneWidget);
    await tester.tap(find.text('回到最新'));
    await tester.pumpAndSettle();
    expect(latest.hitTestable(), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets('opens an unread chat, keeps a failed draft and retries once', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(320, 700);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    const threadId = '00000000-0000-0000-0000-000000000004';
    const received = {
      'id': 8,
      'senderId': _actorId,
      'senderName': '联调用户',
      'createdAt': 1700000000000,
      'body': '图书已经归还。',
    };
    var unread = 1;
    final bodies = <Map<String, Object?>>[];
    Map<String, Object?>? sent;
    final account = _account(_Storage(), (request) async {
      switch (request.url.path) {
        case '/social/notifications/summary':
          return _json({
            'unread': 0,
            'canModerate': false,
            'conversations': true,
          });
        case '/social/conversations':
          return _json({
            'items': [
              if (request.url.queryParameters['unread'] != '1' || unread > 0)
                {
                  'id': threadId,
                  'kind': 'direct',
                  'title': '联调用户',
                  'updatedAt': 1700000000000,
                  'preview': received['body'],
                  'pinned': false,
                  'unread': unread,
                },
            ],
          });
        case '/social/conversations/$threadId/messages':
          if (request.method == 'GET') {
            return _json({
              'items': [if (sent != null) sent, received],
            });
          }
          final body = (jsonDecode(request.body) as Map)
              .cast<String, Object?>();
          bodies.add(body);
          if (bodies.length == 1) return _json({'error': 'temporary'}, 503);
          sent = {
            'id': 9,
            'senderId': _memberId,
            'createdAt': 1700000001000,
            'body': body['body'],
          };
          return _json({'message': sent});
        case '/social/conversations/$threadId/read':
          final body = (jsonDecode(request.body) as Map)
              .cast<String, Object?>();
          expect(body['through'], anyOf(8, 9));
          unread = 0;
          return _json({});
        default:
          fail('Unexpected account route ${request.method} ${request.url}');
      }
    });
    addTearDown(account.dispose);
    await account.initialize();
    await tester.pumpWidget(MaterialApp(home: SocialPage(account: account)));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('新建会话'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('未读'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('联调用户'));
    await tester.pumpAndSettle();
    expect(unread, 0);
    expect(find.text('图书已经归还。'), findsOneWidget);

    await tester.enterText(find.byType(TextField), '谢谢提醒。');
    await tester.pump();
    await tester.tap(find.byTooltip('发送'));
    await tester.pumpAndSettle();
    expect(find.text('消息发送失败，请重试。'), findsOneWidget);
    expect(find.text('谢谢提醒。'), findsOneWidget);
    await tester.tap(find.byTooltip('发送'));
    await tester.pumpAndSettle();
    expect(bodies[0], bodies[1]);
    expect(bodies[0]['body'], '谢谢提醒。');
    expect(find.text('谢谢提醒。'), findsOneWidget);
    expect(
      tester.widget<TextField>(find.byType(TextField)).controller!.text,
      isEmpty,
    );

    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    expect(find.text('联调用户'), findsNothing);
    expect(find.byType(MessageConversationRow), findsWidgets);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets('inbox pagination retries the same cursor and can refresh', (
    tester,
  ) async {
    final cursors = <String?>[];
    var pageFailed = false;
    final account = _account(_Storage(), (request) async {
      if (request.url.path == '/social/notifications/summary') {
        return _json({'unread': 2, 'canModerate': false});
      }
      expect(request.url.path, '/social/notifications');
      final cursor = request.url.queryParameters['before'];
      cursors.add(cursor);
      if (cursor != null && !pageFailed) {
        pageFailed = true;
        return _json({'error': 'temporary'}, 503);
      }
      return _json({
        'unread': 2,
        if (cursor == null) 'next': 'older-cursor',
        'items': [
          {
            'id': cursor == null ? _alertId : _actorId,
            if (cursor == null) 'actor': _profile,
            'createdAt': 1700000000000,
            'readAt': 1700000000001,
          },
        ],
      });
    });
    addTearDown(account.dispose);
    await account.initialize();
    await tester.pumpWidget(MaterialApp(home: SocialPage(account: account)));
    await tester.pumpAndSettle();

    await _openMessageTool(tester, '新增粉丝');
    await tester.pumpAndSettle();
    expect(find.text('明月关注了你'), findsOneWidget);
    await tester.tap(find.text('加载更多'));
    await tester.pumpAndSettle();
    expect(find.text('明月关注了你'), findsOneWidget);
    await tester.tap(find.text('重试'));
    await tester.pumpAndSettle();
    expect(cursors, [null, 'older-cursor', 'older-cursor']);
    expect(find.text('明月关注了你'), findsOneWidget);
    expect(find.text('一位木星环用户关注了你'), findsOneWidget);

    await tester.tap(find.byTooltip('刷新'));
    await tester.pumpAndSettle();
    expect(cursors.last, isNull);
    expect(find.text('一位木星环用户关注了你'), findsNothing);
  });

  testWidgets('moderation keeps the conclusion and handles a closed case', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(320, 700);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    final pending = <String, Object?>{
      'id': _alertId,
      'targetId': _actorId,
      'reporterId': '00000000-0000-0000-0000-000000000004',
      'reason': 'harassment',
      'status': 'pending',
      'createdAt': 1700000000000,
      'detail': '举报原文',
    };
    final bodies = <Object?>[];
    var reads = 0;
    final account = _account(_Storage(), (request) async {
      if (request.url.path == '/social/notifications/summary') {
        return _json({'unread': 0, 'canModerate': true});
      }
      expect(request.url.path, '/social/moderation/reports');
      if (request.method == 'GET') {
        reads++;
        return _json({
          'items': [if (bodies.length < 2) pending],
        });
      }
      bodies.add(jsonDecode(request.body));
      return _json({
        'error': bodies.length == 1 ? 'temporary' : 'conflict',
      }, bodies.length == 1 ? 503 : 409);
    });
    addTearDown(account.dispose);
    await account.initialize();
    await tester.pumpWidget(MaterialApp(home: SocialPage(account: account)));
    await tester.pumpAndSettle();

    await _openMessageTool(tester, '举报处理');
    await tester.pumpAndSettle();
    expect(find.text('案件 $_alertId'), findsOneWidget);
    await tester.tap(find.text('处理举报'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '待提交的结论');
    await tester.pump();
    await tester.tap(find.text('标为已处理'));
    await tester.pumpAndSettle();
    expect(find.text('处理结果保存失败，请重试。'), findsOneWidget);
    expect(find.text('待提交的结论'), findsOneWidget);

    await tester.tap(find.text('标为已处理'));
    await tester.pumpAndSettle();
    expect(bodies, [
      for (var attempt = 0; attempt < 2; attempt++)
        {'id': _alertId, 'status': 'resolved', 'conclusion': '待提交的结论'},
    ]);
    expect(find.text('该举报已结案。'), findsOneWidget);
    expect(find.text('举报原文'), findsNothing);
    expect(find.byType(AlertDialog), findsNothing);
    await tester.tap(find.byTooltip('刷新'));
    await tester.pumpAndSettle();
    expect(reads, 2);
    expect(find.text('暂无待处理举报。'), findsOneWidget);
  });

  testWidgets('returning to Messages refreshes unread and moderation access', (
    tester,
  ) async {
    final delayed = Completer<http.Response>();
    var reads = 0;
    final account = _account(_Storage(), (request) async {
      expect(request.url.path, '/social/notifications/summary');
      return switch (++reads) {
        1 => _json({'unread': 1, 'canModerate': true}),
        2 => delayed.future,
        3 => _json({'error': 'forbidden'}, 403),
        4 => _json({'unread': 2, 'canModerate': false}),
        _ => throw StateError('Unexpected summary refresh'),
      };
    });
    addTearDown(account.dispose);
    await account.initialize();
    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('en'),
        localizationsDelegates: const [interfaceStringsDelegate],
        home: JovianShell(
          initialTab: JovianTab.destiny,
          buildPage: (_, tab, active, _) => tab == JovianTab.messages
              ? SocialPage(account: account, active: active)
              : const SizedBox.shrink(),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(reads, 0);

    Future<void> openTab(JovianTab tab) async {
      await tester.tap(find.byKey(ValueKey(tab)));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
    }

    await openTab(JovianTab.messages);
    expect(reads, 1);
    expect(find.text('1 unread'), findsOneWidget);
    await tester.tap(find.byTooltip('Messages menu'));
    await tester.pumpAndSettle();
    final drawerList = find
        .descendant(of: find.byType(Drawer), matching: find.byType(Scrollable))
        .first;
    await tester.scrollUntilVisible(
      find.text('Moderation queue'),
      170,
      scrollable: drawerList,
    );
    expect(find.text('Moderation queue'), findsOneWidget);
    Scaffold.of(tester.element(find.byType(Drawer))).closeDrawer();
    await tester.pumpAndSettle();

    await openTab(JovianTab.destiny);
    expect(reads, 1);
    await openTab(JovianTab.messages);
    expect(reads, 2);
    expect(find.text('1 unread'), findsNothing);
    expect(find.text('Moderation queue'), findsNothing);
    expect(find.byType(LinearProgressIndicator), findsOneWidget);

    await openTab(JovianTab.destiny);
    await openTab(JovianTab.messages);
    expect(reads, 3);
    expect(
      find.text('This account cannot access this feature.'),
      findsOneWidget,
    );

    delayed.complete(_json({'unread': 99, 'canModerate': true}));
    await tester.pumpAndSettle();
    expect(find.text('99 unread'), findsNothing);
    expect(find.text('Moderation queue'), findsNothing);

    await tester.tap(find.text('Retry'));
    await tester.pumpAndSettle();
    expect(reads, 4);
    expect(find.text('2 unread'), findsOneWidget);
    expect(find.text('Moderation queue'), findsNothing);
  });
  for (final switchTabs in [true, false]) {
    final reason = switchTabs ? 'switching tabs' : 'going back';
    testWidgets('a late read does not open a profile after $reason', (
      tester,
    ) async {
      final read = Completer<http.Response>();
      var reads = 0;
      var profileRequests = 0;
      var unread = 1;
      final account = _account(_Storage(), (request) async {
        switch (request.url.path) {
          case '/social/notifications/summary':
            return _json({'unread': unread, 'canModerate': false});
          case '/social/notifications':
            return _json({
              'unread': unread,
              'items': [
                {
                  'id': _alertId,
                  'actor': _profile,
                  'createdAt': 1700000000000,
                  'readAt': unread == 0 ? 1700000000001 : null,
                },
              ],
            });
          case '/social/notifications/read':
            reads++;
            return read.future;
          case '/social/profiles/$_actorId':
            profileRequests++;
            return _json(_profile);
          default:
            fail('Unexpected social route ${request.url.path}');
        }
      });
      addTearDown(account.dispose);
      await account.initialize();
      await tester.pumpWidget(
        MaterialApp(
          home: JovianShell(
            initialTab: JovianTab.messages,
            buildPage: (_, tab, active, _) => tab == JovianTab.messages
                ? SocialPage(account: account, active: active)
                : const SizedBox.shrink(),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await _openMessageTool(tester, '新增粉丝');
      await tester.pumpAndSettle();
      await tester.tap(find.text('查看主页'));
      await tester.pump();
      expect(reads, 1);

      if (switchTabs) {
        await tester.tap(find.byKey(const ValueKey(JovianTab.destiny)));
        await tester.pumpAndSettle();
      } else {
        await tester.tap(find.byType(BackButton));
        await tester.pump();
      }
      unread = 0;
      read.complete(_json({'unread': unread}));
      await tester.pumpAndSettle();
      expect(profileRequests, 0);

      if (switchTabs) {
        await tester.tap(find.byKey(const ValueKey(JovianTab.messages)));
      } else {
        expect(find.text('1 条未读'), findsNothing);
        await _openMessageTool(tester, '新增粉丝');
      }
      await tester.pumpAndSettle();
      expect(find.text('明月关注了你'), findsOneWidget);
      expect(find.textContaining(' · 已读'), findsOneWidget);
      await tester.tap(find.text('查看主页'));
      await tester.pumpAndSettle();
      expect(find.text('UID 12345678'), findsOneWidget);
      expect(reads, 1);
      expect(profileRequests, 1);
    });
  }

  testWidgets('guest message shortcuts open sign-in prompts without requests', (
    tester,
  ) async {
    var signIns = 0;
    final account = _account(
      _Storage(),
      (request) async => fail('Guest requested ${request.url.path}'),
      guest: true,
    );
    addTearDown(account.dispose);
    await account.initialize();
    await tester.pumpWidget(
      MaterialApp(
        home: SocialPage(account: account, openAccount: () => signIns++),
      ),
    );
    await tester.pumpAndSettle();

    for (final destination in ['新增粉丝', '我的举报']) {
      await _openMessageTool(tester, destination);
      await tester.pumpAndSettle();
      expect(find.text(destination), findsOneWidget);
      expect(find.text('登录后查看当前账户的消息'), findsOneWidget);
      await tester.tap(find.text('前往登录'));
      expect(find.byType(BackButton), findsOneWidget);
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      expect(find.text('消息'), findsOneWidget);
    }
    expect(signIns, 2);
  });

  testWidgets('loads, reads and returns from a live follower alert', (
    tester,
  ) async {
    final paths = <String>[];
    var unread = 1;
    final account = _account(_Storage(), (request) async {
      final route = '${request.method} ${request.url.path}';
      paths.add(route);
      switch (route) {
        case 'GET /social/notifications/summary':
          return _json({'unread': unread, 'canModerate': false});
        case 'GET /social/notifications':
          return _json({
            'unread': unread,
            'items': [
              {
                'id': _alertId,
                'actor': _profile,
                'createdAt': 1700000000000,
                'readAt': unread == 0 ? 1700000000001 : null,
              },
            ],
          });
        case 'POST /social/notifications/read':
          expect(jsonDecode(request.body), {'id': _alertId});
          return _json({'unread': --unread});
        case 'GET /social/profiles/$_actorId':
          return _json(_profile);
        case 'POST /social/follows':
          expect(jsonDecode(request.body), {'id': _actorId, 'active': true});
          return _json({
            'following': 2,
            'followers': 4,
            'follows': true,
            'followedBy': true,
          });
        default:
          fail('Unexpected social route $route');
      }
    });
    await account.initialize();
    await tester.pumpWidget(MaterialApp(home: SocialPage(account: account)));
    await tester.pumpAndSettle();
    expect(find.text('1 条未读'), findsOneWidget);
    expect(find.text('举报处理'), findsNothing);
    await _openMessageTool(tester, '新增粉丝');
    await tester.pumpAndSettle();
    expect(find.text('明月关注了你'), findsOneWidget);
    await tester.tap(find.text('查看主页'));
    await tester.pumpAndSettle();
    expect(find.text('明月'), findsOneWidget);
    expect(find.text('UID 12345678'), findsOneWidget);
    await tester.tap(find.text('回关'));
    await tester.pumpAndSettle();
    expect(find.text('互相关注'), findsOneWidget);
    expect(find.text('粉丝 4'), findsOneWidget);
    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    expect(find.textContaining(' · 已读'), findsOneWidget);
    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    expect(find.text('1 条未读'), findsNothing);
    expect(paths, [
      'GET /social/notifications/summary',
      'GET /social/notifications',
      'POST /social/notifications/read',
      'GET /social/profiles/$_actorId',
      'POST /social/follows',
      'GET /social/notifications',
      'GET /social/notifications/summary',
    ]);
    expect(paths.where((route) => route.contains('conversation')), isEmpty);
    await tester.pumpWidget(const SizedBox.shrink());
    account.dispose();
  });

  testWidgets(
    'the routed follower inbox survives direct links and late reads',
    (tester) async {
      final read = Completer<http.Response>();
      var unread = 1;
      var markRequests = 0;
      var profileRequests = 0;
      final account = _account(_Storage(), (request) async {
        switch (request.url.path) {
          case '/social/notifications/summary':
            return _json({'unread': unread, 'canModerate': false});
          case '/social/notifications':
            return _json({
              'unread': unread,
              'items': [
                {
                  'id': _alertId,
                  'actor': _profile,
                  'createdAt': 1700000000000,
                  'readAt': unread == 0 ? 1700000000001 : null,
                },
              ],
            });
          case '/social/notifications/read':
            expect(jsonDecode(request.body), {'id': _alertId});
            markRequests++;
            return read.future;
          case '/social/profiles/$_actorId':
            profileRequests++;
            return _json(_profile);
          default:
            fail('Unexpected social route ' + request.url.path);
        }
      });
      final platform = tester.binding.platformDispatcher;
      platform.defaultRouteNameTestValue = '/account/new-followers';
      addTearDown(platform.clearDefaultRouteNameTestValue);
      await tester.pumpWidget(JovianApp(account: account));
      await tester.pumpAndSettle();
      expect(find.text('明月关注了你'), findsOneWidget);
      await tester.tap(find.text('查看主页'));
      await tester.pump();
      expect(markRequests, 1);

      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.text('1 条未读'), findsOneWidget);
      unread = 0;
      read.complete(_json({'unread': unread}));
      await tester.pumpAndSettle();
      expect(profileRequests, 0);
      expect(find.text('1 条未读'), findsNothing);

      await _openMessageTool(tester, '新增粉丝');
      await tester.pumpAndSettle();
      expect(find.textContaining(' · 已读'), findsOneWidget);
      await tester.tap(find.text('查看主页'));
      await tester.pumpAndSettle();
      expect(find.text('UID 12345678'), findsOneWidget);
      expect(markRequests, 1);
      expect(profileRequests, 1);

      await tester.binding.handlePushRoute('/account/new-followers');
      await tester.pumpAndSettle();
      expect(find.text('明月关注了你'), findsOneWidget);
      expect(find.textContaining(' · 已读'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'opens logged-in search through the narrow message actions menu',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(320, 700);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final requests = <Map<String, String>>[];
      final account = _account(_Storage(), (request) async {
        if (request.url.path == '/social/notifications/summary') {
          return _json({'unread': 0, 'canModerate': false});
        }
        expect(request.url.path, '/social/search');
        final query = request.url.queryParameters;
        requests.add(query);
        return query.containsKey('uid')
            ? _json({'error': 'not_found'}, 404)
            : _json({
                'items': [_profile],
              });
      });
      await account.initialize();
      await tester.pumpWidget(MaterialApp(home: SocialPage(account: account)));
      await tester.pumpAndSettle();
      final more = find.byTooltip('新建会话');
      final findUser = find.widgetWithText(PopupMenuItem<VoidCallback>, '添加好友');
      await tester.tap(more);
      await tester.pumpAndSettle();
      expect(findUser, findsOneWidget);
      await tester.sendKeyEvent(LogicalKeyboardKey.escape);
      await tester.pumpAndSettle();
      expect(findUser, findsNothing);
      await tester.tap(more);
      await tester.pumpAndSettle();
      await tester.tapAt(const Offset(12, 400));
      await tester.pumpAndSettle();
      expect(findUser, findsNothing);
      await _openMessageTool(tester, '找用户');
      expect(findUser, findsNothing);
      expect(find.text('找用户'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.enterText(find.byType(TextField), '1234');
      await tester.pump();
      await tester.tap(find.text('搜索'));
      await tester.pumpAndSettle();
      expect(find.text('请输入完整的 8 位 UID。'), findsOneWidget);
      expect(requests, isEmpty);
      await tester.enterText(find.byType(TextField), 'UID：12345678');
      await tester.pump();
      await tester.tap(find.text('搜索'));
      await tester.pumpAndSettle();
      expect(find.text('未找到该用户。'), findsOneWidget);
      await tester.tap(find.text('按昵称搜索'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), ' 明月 ');
      await tester.pump();
      await tester.tap(find.text('搜索'));
      await tester.pumpAndSettle();
      expect(find.text('明月'), findsOneWidget);
      expect(requests, [
        {'uid': '12345678'},
        {'nickname': '明月'},
      ]);
      await account.signOut();
      await tester.pumpAndSettle();
      expect(find.text('明月'), findsNothing);
      expect(find.byType(MessageConversationRow), findsWidgets);
      await tester.pumpWidget(const SizedBox.shrink());
      account.dispose();
    },
  );

  testWidgets(
    'follows in the list, preserves failed rows and removes unfollows',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(320, 700);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final firstFollow = Completer<http.Response>();
      final mutations = <bool>[];
      var follows = false;
      var followerReads = 0;
      final account = _account(_Storage(), (request) async {
        final profile = {..._profile, 'follows': follows};
        switch (request.url.path) {
          case '/social/followers':
            followerReads++;
            return _json({
              'items': [profile],
            });
          case '/social/following':
            return _json({
              'items': [if (follows) profile],
            });
          case '/social/follows':
            expect(request.method, 'POST');
            final body = jsonDecode(request.body) as Map<String, dynamic>;
            expect(body['id'], _actorId);
            final active = body['active'] as bool;
            mutations.add(active);
            if (mutations.length == 1) return firstFollow.future;
            follows = active;
            return _json({...profile, 'follows': follows});
          default:
            fail('Unexpected social request ${request.url}');
        }
      });
      await account.initialize();
      Widget list(SocialList direction) => MaterialApp(
        locale: const Locale('en'),
        localizationsDelegates: const [interfaceStringsDelegate],
        home: SocialConnectionsPage(account: account, direction: direction),
      );

      await tester.pumpWidget(list(SocialList.followers));
      await tester.pumpAndSettle();
      expect(find.text('明月'), findsOneWidget);
      await tester.tap(find.widgetWithText(FilledButton, 'Follow back'));
      await tester.pump();
      final follow = tester.widget<FilledButton>(
        find.widgetWithText(FilledButton, 'Follow back'),
      );
      expect(follow.onPressed, isNull);
      expect(
        tester
            .widget<IconButton>(
              find.byWidgetPredicate(
                (widget) => widget is IconButton && widget.tooltip == 'Refresh',
              ),
            )
            .onPressed,
        isNull,
      );
      firstFollow.complete(_json({'error': 'temporary'}, 503));
      await tester.pumpAndSettle();
      expect(
        find.text('Could not update the follow status. Try again.'),
        findsOneWidget,
      );
      expect(find.text('明月'), findsOneWidget);
      await tester.tap(find.widgetWithText(FilledButton, 'Follow back'));
      await tester.pumpAndSettle();
      expect(find.text('Following each other'), findsOneWidget);
      expect(find.text('明月'), findsOneWidget);
      await tester.tap(find.byTooltip('Refresh'));
      await tester.pumpAndSettle();
      expect(followerReads, 2);

      await tester.pumpWidget(list(SocialList.following));
      await tester.pumpAndSettle();
      await tester.tap(
        find.widgetWithText(FilledButton, 'Following each other'),
      );
      await tester.pumpAndSettle();
      expect(find.text('明月'), findsNothing);
      expect(find.text('You are not following anyone yet.'), findsOneWidget);
      expect(mutations, [true, true, false]);
      expect(tester.takeException(), isNull);

      await tester.pumpWidget(const SizedBox.shrink());
      account.dispose();
    },
  );

  testWidgets('guest menu opens the sign-in gate without searching', (
    tester,
  ) async {
    final account = _account(
      _Storage(),
      (request) async => fail('A guest must not request ${request.url}.'),
      guest: true,
    );
    await account.initialize();
    var openedAccount = false;
    await tester.pumpWidget(
      MaterialApp(
        home: SocialPage(
          account: account,
          openAccount: () => openedAccount = true,
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('新建会话'));
    await tester.pumpAndSettle();
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.text('消息'), findsOneWidget);
    expect(find.text('找用户'), findsNothing);

    await _openMessageTool(tester, '找用户');
    expect(find.text('找用户'), findsOneWidget);
    expect(find.byType(TextField), findsNothing);
    await tester.tap(find.text('前往登录'));
    expect(openedAccount, isTrue);
    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    expect(find.text('消息'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
    account.dispose();
  });

  test(
    'drops old-owner requests and responses when the session changes',
    () async {
      final storage = _Storage();
      var count = 0;
      final received = Completer<void>();
      final result = Completer<http.Response>();
      final account = _account(storage, (_) {
        count++;
        received.complete();
        return result.future;
      });
      addTearDown(account.dispose);
      await account.initialize();
      final pendingResponse = account.requestSocial(_memberId, [
        'notifications',
      ]);
      final responseCheck = expectLater(
        pendingResponse,
        throwsA(isA<JsonRequestError>()),
      );
      await received.future;
      final pendingCredentials = Completer<String?>();
      storage.nextRead = pendingCredentials;
      final staleRequest = account.requestSocial(
        _memberId,
        ['follows'],
        body: {'id': _actorId, 'active': true},
      );
      final credentialsCheck = expectLater(
        staleRequest,
        throwsA(isA<JsonRequestError>()),
      );
      await account.signOut();
      result.complete(_json({'unread': 1}));
      pendingCredentials.complete('fixture-token');
      await Future.wait([responseCheck, credentialsCheck]);
      expect(count, 1);
    },
  );

  testWidgets(
    'returns to the same search while rechecking access and retries public birth details',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(320, 700);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final rechecking = Completer<http.Response>();
      final stale = Completer<http.Response>();
      final queries = <Map<String, String>>[];
      var birthReads = 0;
      final account = _account(
        _Storage(),
        (request) async {
          switch (request.url.path) {
            case '/social/notifications/summary':
              return _json({'unread': 0, 'canModerate': false});
            case '/social/profiles/$_actorId':
              return _json(_profile);
            case '/social/search':
              final query = request.url.queryParameters;
              queries.add(query);
              if (query['nickname'] == '晚到的昵称') return stale.future;
              if (queries.length == 2) return rechecking.future;
              if (query.containsKey('uid')) return _json(_profile);
              return _json({
                'items': [_profile],
              });
            default:
              fail('Unexpected social request ${request.url}');
          }
        },
        visibleProfile: (_) async {
          birthReads++;
          if (birthReads == 1) return _json({'error': 'temporary'}, 503);
          return _json({
            'profile': {
              'reading': {'birthPlace': '测试公开出生地'},
            },
          });
        },
      );
      await account.initialize();
      await tester.pumpWidget(MaterialApp(home: SocialPage(account: account)));
      await tester.pumpAndSettle();
      await _openMessageTool(tester, '找用户');
      await tester.pumpAndSettle();
      await tester.tap(find.text('按昵称搜索'));
      await tester.pumpAndSettle();
      final field = find.byType(TextField);
      await tester.enterText(field, ' 明月 ');
      await tester.testTextInput.receiveAction(TextInputAction.search);
      await tester.pumpAndSettle();
      expect(tester.testTextInput.isVisible, isFalse);
      expect(find.text('明月'), findsOneWidget);
      await tester.tap(find.text('明月'));
      await tester.pumpAndSettle();
      expect(find.text('用户主页'), findsOneWidget);
      expect(find.text('重试读取公开资料'), findsOneWidget);
      await tester.tap(find.text('重试读取公开资料'));
      await tester.pumpAndSettle();
      expect(birthReads, 2);
      expect(find.text('测试公开出生地'), findsOneWidget);
      expect(tester.takeException(), isNull);

      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      expect(find.text('找用户'), findsOneWidget);
      expect(tester.widget<TextField>(field).controller!.text, ' 明月 ');
      expect(find.text('正在核对搜索结果…'), findsOneWidget);
      expect(find.text('明月'), findsOneWidget);
      expect(
        tester.widget<ListTile>(find.widgetWithText(ListTile, '明月')).onTap,
        isNull,
      );
      rechecking.complete(_json({'items': []}));
      await tester.pumpAndSettle();
      expect(find.text('明月'), findsNothing);
      expect(find.text('未找到该用户。'), findsOneWidget);

      await tester.enterText(field, '晚到的昵称');
      await tester.pump();
      await tester.tap(find.text('搜索'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('按 UID 搜索'));
      await tester.pumpAndSettle();
      await tester.enterText(field, '12345678');
      await tester.pump();
      await tester.tap(find.text('搜索'));
      await tester.pumpAndSettle();
      stale.complete(_json({'items': []}));
      await tester.pumpAndSettle();
      expect(find.text('明月'), findsOneWidget);
      expect(queries, [
        {'nickname': '明月'},
        {'nickname': '明月'},
        {'nickname': '晚到的昵称'},
        {'uid': '12345678'},
      ]);
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      expect(find.text('消息'), findsOneWidget);
      expect(find.text('明月'), findsNothing);
      await tester.pumpWidget(const SizedBox.shrink());
      account.dispose();
    },
  );
}

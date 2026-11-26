import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:webview_flutter_platform_interface/webview_flutter_platform_interface.dart';

import '../src/shared/local_compute/local_compute.dart';

void main() {
  const compute = LocalCompute();

  test(
    'native compute loads only the bundled asset and combines bridge messages',
    () async {
      final platform = _ComputePlatform();
      WebViewPlatform.instance = platform;
      final stages = <String>[];
      final profile = {'value': '命盘𠀀' * 30000};

      final reading = compute.calculateDestiny(profile, onProgress: stages.add);
      final view = platform.view;
      await view.started.future;
      expect(compute.isAvailable, isTrue);
      expect(view.fragments.length, greaterThan(1));
      expect(jsonDecode(utf8.decode(base64Decode(view.fragments.join()))), {
        'name': 'calculateDestiny',
        'profile': profile,
      });
      view.post('1{"stage":"western"}');
      view.post('0{"result":{"text":"命');
      view.post('1盘"}}');
      expect(await reading, {'text': '命盘'});
      expect(stages, ['western']);
      await view.closed.future;
    },
  );

  test(
    'native cancellation closes its worker while a result is pending',
    () async {
      final platform = _ComputePlatform();
      WebViewPlatform.instance = platform;
      final cancel = Completer<void>();
      final reading = compute.calculateDestiny({}, cancel: cancel.future);
      final view = platform.view;
      await view.started.future;
      cancel.complete();
      await expectLater(
        reading,
        throwsA(
          isA<LocalComputeException>().having(
            (error) => error.code,
            'code',
            'cancelled',
          ),
        ),
      );
      await view.closed.future;
      expect(view.workerClosed, isTrue);
    },
  );

  test(
    'native cancellation waits for pending channel registration before removing it',
    () async {
      final allowRegistration = Completer<void>();
      final platform = _ComputePlatform(allowRegistration.future);
      WebViewPlatform.instance = platform;
      final cancel = Completer<void>();
      final reading = compute.calculateDestiny({}, cancel: cancel.future);
      final view = platform.view;

      await view.registrationStarted.future;
      final cancelled = expectLater(
        reading,
        throwsA(
          isA<LocalComputeException>().having(
            (error) => error.code,
            'code',
            'cancelled',
          ),
        ),
      );
      cancel.complete();
      await cancelled;
      await Future<void>.delayed(Duration.zero);

      allowRegistration.complete();
      await view.registrationFinished.future;
      await view.closed.future;
      expect(view.hasChannel, isFalse);
      expect(view.assetLoaded, isFalse);
      expect(view.workerClosed, isFalse);
    },
  );
}

class _ComputePlatform extends WebViewPlatform {
  _ComputePlatform([this.allowRegistration]);

  final Future<void>? allowRegistration;
  late _ComputeView view;

  @override
  PlatformWebViewController createPlatformWebViewController(
    PlatformWebViewControllerCreationParams params,
  ) => view = _ComputeView(params, allowRegistration);

  @override
  PlatformNavigationDelegate createPlatformNavigationDelegate(
    PlatformNavigationDelegateCreationParams params,
  ) => _Navigation(params);
}

class _Navigation extends PlatformNavigationDelegate {
  _Navigation(PlatformNavigationDelegateCreationParams params)
    : super.implementation(params);
  late NavigationRequestCallback onRequest;

  @override
  Future<void> setOnNavigationRequest(
    NavigationRequestCallback callback,
  ) async => onRequest = callback;

  @override
  Future<void> setOnWebResourceError(WebResourceErrorCallback callback) async {}
}

class _ComputeView extends PlatformWebViewController {
  _ComputeView(
    PlatformWebViewControllerCreationParams params,
    this.allowRegistration,
  ) : super.implementation(params);
  final Future<void>? allowRegistration;
  final fragments = <String>[];
  final registrationStarted = Completer<void>();
  final registrationFinished = Completer<void>();
  final started = Completer<void>();
  final closed = Completer<void>();
  JavaScriptChannelParams? _channel;
  late _Navigation _navigation;
  bool assetLoaded = false;
  bool workerClosed = false;

  bool get hasChannel => _channel != null;

  void post(String value) =>
      _channel!.onMessageReceived(JavaScriptMessage(message: value));

  @override
  Future<void> setJavaScriptMode(JavaScriptMode mode) async =>
      expect(mode, JavaScriptMode.unrestricted);

  @override
  Future<void> setPlatformNavigationDelegate(
    PlatformNavigationDelegate delegate,
  ) async => _navigation = delegate as _Navigation;

  @override
  Future<void> addJavaScriptChannel(JavaScriptChannelParams params) async {
    expect(params.name, 'JovianCompute');
    registrationStarted.complete();
    await allowRegistration;
    _channel = params;
    registrationFinished.complete();
  }

  @override
  Future<void> loadFlutterAsset(String key) async {
    expect(key, 'tool/legacy_compute/native_assets/legacy-compute.html');
    assetLoaded = true;
    final local = NavigationRequest(
      url: 'file:///android_asset/flutter_assets/$key',
      isMainFrame: true,
    );
    final external = NavigationRequest(
      url: 'https://example.invalid/$key',
      isMainFrame: true,
    );
    expect(await _navigation.onRequest(local), NavigationDecision.navigate);
    expect(await _navigation.onRequest(external), NavigationDecision.prevent);
    post('ready');
  }

  @override
  Future<void> runJavaScript(String script) async {
    final append = RegExp(
      r'^window\.jovianNativeCompute\.append\("([A-Za-z0-9+/=]+)"\)$',
    );
    if (append.firstMatch(script) case final match?) {
      fragments.add(match[1]!);
    } else if (script == 'window.jovianNativeCompute.run()') {
      started.complete();
    } else {
      expect(script, 'window.jovianNativeCompute?.close()');
      workerClosed = true;
    }
  }

  @override
  Future<void> removeJavaScriptChannel(String name) async {
    expect(name, 'JovianCompute');
    _channel = null;
    closed.complete();
  }
}

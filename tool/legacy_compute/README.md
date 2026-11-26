# Flutter 本机计算

从仓库根目录运行 `node app-flutter/tool/legacy_compute/build.mjs`，再启动或构建 Flutter。构建使用原项目已安装的 Node 依赖。依赖在其他工作树时，通过 `JOVIAN_LEGACY_NODE_ROOT` 指向其根目录。当计算源码更新时，先重建本机计算资源。

`LocalCompute` 在浏览器或系统 WebView 的 Worker 里运行同一个 TypeScript 产物。Web 加载 `web/legacy-compute.js`，原生端加载 `tool/legacy_compute/native_assets/legacy-compute.html`，两个文件均由构建脚本生成。原生页面从应用资源加载，跳转受限，计算 Worker 可离线运行。出生资料通过消息传递，结果分段返回。用户取消或计算超时会终止 Worker。归档及在线解读由 Flutter 业务模块通过现有接口发起。[Flutter WebView 插件](https://pub.dev/packages/webview_flutter)

`node app-flutter/tool/legacy_compute/test.mjs` 用 Chromium 对照普通浏览器入口、生成的本机资源和原 TypeScript 结果。先在 `app-flutter` 运行 `flutter pub get`。测试依赖 Playwright Core、Chromium 和 Dart，可分别用 `JOVIAN_BROWSER_TEST_ROOT`、`CHROME_EXECUTABLE` 和 `JOVIAN_DART_EXECUTABLE` 指定路径。测试运行于本机临时端口，使用固定测试资料。Flutter 的 `test/local_compute_native_test.dart` 验证原生调用协议、资源限制和取消。Android、iOS 的实际系统 WebView 仍待设备验收。

# Flutter Web 本机计算

从仓库根目录运行 `node app-flutter/tool/legacy_compute/build.mjs`，然后执行 Flutter Web 的启动或构建命令。构建使用原项目已安装的 Node 依赖。依赖在其他工作树时，通过 `JOVIAN_LEGACY_NODE_ROOT` 指向其根目录。重新构建 Flutter Web 前先更新 Worker，保证计算结果对应当前源码。

Flutter 通过 `BrowserCompute` 在各自的 Worker 里执行命理、合盘和运势计算。出生资料经浏览器的 Worker 消息传递。页面退出、用户取消或计算超时后，调用方可以终止 Worker。归档及在线解读请求仍由 Flutter 的业务模块负责。

`node app-flutter/tool/legacy_compute/test.mjs` 对照真实浏览器和原 TypeScript 结果。先在 `app-flutter` 运行 `flutter pub get`。测试依赖 Playwright Core、Chromium 和 Dart，可分别用 `JOVIAN_BROWSER_TEST_ROOT`、`CHROME_EXECUTABLE` 和 `JOVIAN_DART_EXECUTABLE` 指定路径。测试运行于本机临时端口，使用固定测试资料。

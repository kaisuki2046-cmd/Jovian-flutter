# Flutter 前端开工规范

Flutter 工作从独立 Git 仓库的项目根目录执行。原项目在同级 `app/` 或 `JOVIAN_LEGACY_SOURCE_ROOT` 指定的路径，项目协作协议和框架图分别见该仓库的 `COLLABORATION.md` 与 `FRAMEWORK.md`。`src/` 是统一的客户端源码。页面交互、样式与公共组件应在 Android 和 Web 使用同一套实现。现有 TypeScript 计算与 Node API 通过公开契约接入。

## 跨平台界面

- 页面和公共 UI 优先使用 Flutter Widget、Theme、CustomPaint 及 Flutter 提供的滤镜和动画。避免用 HTML、DOM、CSS、浏览器 SVG 或 SVG 滤镜实现界面。图标和视觉效果使用 Flutter 能在目标平台渲染的代码或本地素材。
- 原生存储、系统文件选择、链接打开与本机计算等平台差异放在相应的适配层，由页面调用同一接口。浏览器 API 仅用于 Web 适配；Android 入口使用对应的原生或 Flutter 实现。复用原 TypeScript 计算的 Worker 和本机 WebView 归计算适配层。
- Android APK 从同一套 Flutter 页面源码构建。服务环境、包名和签名由构建配置提供。新增或修改关键交互时核对 Android 和 Web 的组件支持，覆盖窄屏、触摸和键盘。交付时区分自动化验证、模拟器和真机实测。

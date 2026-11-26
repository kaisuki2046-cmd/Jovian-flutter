# 木星环 Flutter 版

Flutter 版沿用项目的[目录分工](../FRAMEWORK.md)和[协作协议](../COLLABORATION.md)。前端对照本地 `YA` 的 `b47e061a` 和算事仪式更新 `d12e3f0c`，接入既有后端。

## 启动 Flutter Web 前端

先在仓库根目录运行 `node app-flutter/tool/legacy_compute/build.mjs`。这会用原项目的 TypeScript 计算生成浏览器 Worker。然后在 `app-flutter/` 运行以下命令，将服务地址和 Web 来源设为已有服务允许的值。

```sh
flutter pub get
flutter run -d chrome --web-port 8081 --target src/app/main.dart --dart-define=ACCOUNT_API_URL=http://localhost:8787 --dart-define=DIVINATION_REPORT_URL=http://localhost:8115 --dart-define=DESTINY_REPORT_URL=http://localhost:8788 --dart-define=FORTUNE_TIME_URL=http://localhost:8791
```

手机与桌面浏览器共用页面主题、卡片、表单及底栏，桌面将页面居中到 460 逻辑像素。底栏顺序为命理、合盘、算事、消息、个人中心，周期运势仍从命理进入。个人中心设置可以切换外观，并在本设备保存选择。

底栏沿用原界面的悬浮胶囊、图标和蓝色选中态。滑动时水滴跟随手势，松开后切到相应标签。个人中心沿用大头像、独立设置入口、关注和粉丝按钮及并排的报告与消息入口。

界面内置简体中文字体，关闭 Web CDN 时也能正常显示中文。[Noto Sans SC v2.004](https://github.com/notofonts/noto-cjk/blob/Sans2.004/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf) · [字体许可证](src/ui/assets/NotoSansSC-OFL.txt)

个人中心通过原账户服务恢复会话、显示 UID、关注与粉丝，并读取报告和命理档案。算事通过原 `/reading` 接口发送问题、起盘和追问。同一浏览器标签页可按当前账号恢复尚有效的算事会话。浏览器 Worker 的构建及对照见[本机计算说明](tool/legacy_compute/README.md)。

综合算事保留自动起盘，也可手动投六次铜钱，再从 78 张牌里选三张。仪式可以暂停，支持逐张翻牌或一键翻牌。服务端提供切牌位置时，前端按该位置演示切牌。较早版本的服务仍可完成其余仪式。

```text
app-flutter/
├── src/
│   ├── app/main.dart              Flutter 入口与页面装配
│   ├── bootstrap/                 运行环境与模块装配
│   ├── features/
│   │   ├── account/               登录、会话、协议与 AI 授权的界面和后台
│   │   ├── compliance/server/     协议版本、原有草案与摘要
│   │   ├── destiny/               出生地点、历史时区、八字计算与页面
│   │   ├── divination/
│   │   │   ├── assets/            原有塔罗牌图
│   │   │   ├── control/           共用的 Dart 计算与流程
│   │   │   ├── model/             卦象和报告数据模型
│   │   │   ├── requests/          算事 HTTP 请求与会话恢复
│   │   │   ├── view/              Flutter 界面
│   │   │   └── server/            模型、账号权限和 SQLite 会话
│   │   └── fortune/               周期运势、黄历、历法、SQLite 资料库与建议接口
│   ├── shared/                    公共请求与契约
│   └── ui/                        公共主题
├── test/                          Flutter 组件测试
└── web/                           Flutter Web 入口和图标
```

`src/bootstrap/` 装配服务和模块，`src/shared/` 提供公共 HTTP 能力。业务模块的模型、控制、页面和请求继续按原规则分工。

## 组件测试和开发用服务

在 `app-flutter/` 下执行以下命令。

```sh
flutter pub get
flutter run -d chrome --target src/app/main.dart
flutter analyze
flutter test
flutter build web --target src/app/main.dart --no-web-resources-cdn
```

在线算事支持现有 Node 账户服务和迁移中的 Dart 账户服务。启动账户与算事服务后，在 `app-flutter/` 下运行以下命令。将 Web 来源加入两个服务各自的允许列表。登录或进入游客会话后，在个人中心的「隐私与授权」中开启算事授权。

```sh
flutter run -d chrome --web-port 8114 --target src/app/main.dart --dart-define=ACCOUNT_API_URL=http://localhost:8787 --dart-define=DIVINATION_REPORT_URL=http://localhost:8115
```

Web 会话使用账户服务的 HttpOnly Cookie，浏览器同一标签页按已验证的账号恢复当前算事会话。Flutter 原生端通过系统安全存储保存会话令牌，算事读取同一会话令牌。验证码与免验证码注册根据账户服务公布的能力显示，微信与 QQ 目前接入现有本地服务商协议。原生平台尚待真机验收。

在 `src/features/divination/control/` 下运行 Dart 计算对照。六爻历法和组合起盘对照使用旧项目的 npm 依赖。

```sh
dart pub get
dart run test/meihua_parity.dart
dart run test/liuyao_parity.dart
dart run test/tarot_parity.dart
dart run test/guide_ritual_parity.dart
dart run test/online_controller_contract.dart
```

在 `src/features/divination/server/` 下运行后端验收。测试使用临时 SQLite 文件与本机 HTTP 端口。存储对照也使用旧项目的 npm 依赖。

```sh
dart pub get
dart run test/model_parity.dart
dart run test/model_http_contract.dart
dart run test/reading_store_contract.dart
dart run test/account_permission_contract.dart
dart run test/reading_http_contract.dart
```

在同一目录可用 `dart run bin/reading.dart` 启动算事后台。启动入口沿用现有的 `DIVINATION_REPORT_*`、`APP_ACCOUNT_PORT` 和模型配置变量。

在 `src/features/fortune/server/` 下运行 `dart pub get` 和 `dart run bin/fortune_time.dart`。同一个 Dart 服务提供 `/fortune/time`、`/fortune/advice/options` 与 `/fortune/advice/options/:id`。使用 `dart run test/fortune_time_contract.dart` 和 `dart run test/fortune_advice_contract.dart` 检查 HTTP 状态、跨来源访问和建议内容。

Flutter 命理页上的「周期运势」沿用 `/fortune` 路由。日、周、月、年按设备 IANA 时区划分。交节、换日规则和每日黄历继续按北京时间计算。使用 `--dart-define=FORTUNE_TIME_URL=http://localhost:8791` 时优先使用运势服务的 UTC 时间，请求失败时回退到设备时间。运势时间服务的 `APP_WEB_ORIGIN` 应与 Flutter Web 来源一致。

登录或进入游客会话后，周期运势按当前命理档案、周期、设备时区和窗口起点查找原有归档。「运势报告历史」展示当前身份的旧报告。在线解读和提运建议界面仍在迁移。

在 `src/features/fortune/control/calculation/` 下运行 `dart pub get` 和 `dart run test/calendar_parity.dart`，与旧版核对周期、黄历、历法查询、日柱判定与报告归档键。对照使用 Node.js 和原项目的 npm 依赖。

运势原始资料位于本模块的 `model/knowledge/fortune_knowledge.json`。服务校验原文摘要与条件审阅摘要，再按源文件哈希构建 SQLite 索引。索引默认保存在 `storage/knowledge/.local/`，该目录由 Git 忽略。

在 `src/features/fortune/storage/knowledge/` 下运行以下命令。Dart 和 Node 使用隔离目录各自建库，再分别读取双方生成的文件，对照资料、条件、手动建议和本命主题索引。

```sh
dart pub get
dart run bin/manage.dart
dart run test/knowledge_contract.dart
```

在 `src/features/fortune/control/calculation/` 下运行 `dart run test/match_windows_contract.dart`，对照条件交集、排除、确认分支、夏令时和证据不足时的窗口。

`calculateFortuneFacts` 接收账户层授权的盘面引用和时段，生成八字本命、节气流柱、十神、干支关系、大运和黄历事实。出生资料不足时保留候选，各候选不合并为一张确定的盘。SQLite 的 `matchRun` 校验事实来源、时段、身份绑定与计算版本后执行匹配。事实记录使用 Dart 引擎版本，与旧 Node 事实提交版本分别标识。

在 `src/features/fortune/control/calculation/` 下运行 `dart run test/facts_parity.dart`，对照旧档案的立春、晚子、交运、海外出生时钟与候选隔离。对照默认读取原工程的 npm 依赖，也可用 `JOVIAN_LEGACY_NODE_ROOT` 指定装好原依赖的工作树。资料库测试同时核对旧档案的寒露节令月能命中对应解读规则。

在 `src/features/destiny/control/` 下运行 `dart pub get`、`dart run test/birth_clock_parity.dart` 和 `dart run test/bazi_parity.dart`。出生时刻对照覆盖时分缺失采样、历史时区和夏令时边界。八字对照覆盖节气前后、23 点换日和大运。运行对照需 Node.js，八字对照还需要原项目的 npm 依赖。Dart 时钟使用内置 IANA 转换规则，新时钟版本标识为 `gregory-iana-tzdb-v1`。

Flutter 首页的「命理」入口可填写出生资料并在本机计算八字。时分缺失时，四柱保留采样得到的候选。出生地沿用旧版 2,941 条目录。

在 `src/features/account/server/` 运行 `dart pub get` 和 `dart run bin/account.dart` 可启动迁移中的 Dart 账户服务。默认监听回环地址，临时 SQLite 文件位于系统临时目录。沿用 `APP_ACCOUNT_PORT`、`APP_ACCOUNT_HOST`、`APP_ACCOUNT_DB`、`APP_WEB_ORIGIN`、`APP_ACCOUNT_ISOLATE_WEB_SESSION` 和 `APP_AGREEMENTS_FILE`。当前支持密码登录、回环开发环境免验证码注册、游客、UID、协议、分用途 AI 授权，以及命理、运势和合盘归档接口。短信和邮箱发码、正式第三方登录、隐私请求仍待迁移。

个人中心的「我的报告」分页读取当前账号或游客身份的已保存解读。「命理档案」查看最近一次命理记录的八字、紫微和西方星盘基础数据。命理、运势和合盘的 Dart 报告生成流程接入归档仍在迁移。

在同一目录运行 `dart run test/legacy_credentials_contract.dart`、`dart run test/account_store_contract.dart` 和 `dart run test/account_http_contract.dart`，可核对密码兼容性、SQLite 双向读写、会话和授权。在 `src/features/compliance/server/` 执行 `dart pub get` 和 `dart run test/agreements_parity.dart` 核对协议草案及摘要。对照使用 Node.js、临时凭证与隔离数据库。

`dart run test/archives_http_contract.dart` 使用旧 Node 账户库创建归档，经 Dart HTTP 服务验证读写、历史分节兼容、内容 ID、分页、账号隔离和合盘快照投影，再用 Node 读回 Dart 写入的资料。

## 迁移进度

| 范围 | 已移植内容 | 待迁移或验收 |
| --- | --- | --- |
| Flutter 客户端 | 五栏框架、个人中心、消息、梅花报数、六爻、综合算事、手动投币和抽牌、在线解读与追问 | 独立的算事历史归档、原生投币音效、Android/iOS 真机回归 |
| 算事控制层 | 盘面计算与校验、历史报告解析、待完成事件重放和解读重试 | 账号归档联动和原生恢复 |
| 算事后台 | 原有 `/reading` 路由、问题确认凭证、模型、账户权限、SQLite 会话、报告和追问 | 实际服务切换和真实模型回归 |
| 运势 | 命理入口、UTC 时间接口、四周期与指定日期计算、黄历、历法查询、既有报告恢复、八字基础事实与节令月、候选和来源校验、SQLite 条件与时段匹配、按来源主题查询建议接口 | 紫微、西占和其余八字来源事实、HTTP 授权与存储、解读生成、本命建议接口和 Flutter 建议界面 |
| 命理 | 出生资料、八字预览、Web 复用原有 TypeScript 排盘、可配置的原报告服务 | 完整盘面样式、紫微和西占平台回归、报告生成与保存端到端验收 |
| 账户 | 密码登录、会话、UID、报告与档案、设置、资料编辑和实名认证占位表单 | 实名验证服务、密码设置界面、正式第三方登录与隐私请求 |
| 合规 | 三份现有草案正文、版本与摘要，发布参数校验 | 合规中心界面及服务接线 |
| 社交和其他业务 | 消息通知、关注与粉丝、按 UID 或昵称查找用户 | 合盘在线计算与报告界面、推荐 |
| 切换 | 本地迁移分支 | 各模块旧数据回读、服务装配、启动脚本、平台回归 |

牌图按旧版[资源清单](../src/features/divination/data/asset_manifest.json)逐张校验。Dart 的 Pro 提示词统一用 LF 换行生成版本摘要，已归档报告沿用原有数据格式。

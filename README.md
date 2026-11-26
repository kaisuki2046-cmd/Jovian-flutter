# 木星环 Flutter 版

Flutter 版沿用项目的[目录分工](../FRAMEWORK.md)和[协作协议](../COLLABORATION.md)。前端对照本地 `YA` 的 `b47e061a` 和算事仪式更新 `d12e3f0c`，接入既有后端。

## 启动 Flutter Web 前端

先在仓库根目录运行 `node app-flutter/tool/legacy_compute/build.mjs`。这会用原项目的 TypeScript 计算生成浏览器 Worker。然后在 `app-flutter/` 运行以下命令，将服务地址和 Web 来源设为已有服务允许的值。

```sh
flutter pub get
flutter run -d chrome --web-port 8081 --target src/app/main.dart --dart-define=ACCOUNT_API_URL=http://localhost:8787 --dart-define=DIVINATION_REPORT_URL=http://localhost:8115 --dart-define=DESTINY_REPORT_URL=http://localhost:8788 --dart-define=SYNASTRY_REPORT_URL=http://localhost:8794 --dart-define=FORTUNE_TIME_URL=http://localhost:8791
```

手机与桌面浏览器共用页面主题、卡片、表单及底栏，桌面将页面居中到 460 逻辑像素。底栏顺序为命理、合盘、算事、消息、个人中心，周期运势仍从命理进入。个人中心设置可以切换外观，并在本设备保存选择。

底栏沿用原界面的悬浮胶囊、图标和蓝色选中态。拖动水滴时，玻璃比底栏更亮，边缘会折射下方图标并模糊背景。松开后切到相应标签。个人中心沿用大头像、独立设置入口、关注和粉丝按钮及并排的报告与消息入口。

界面内置简体中文字体，关闭 Web CDN 时也能正常显示中文。[Noto Sans SC v2.004](https://github.com/notofonts/noto-cjk/blob/Sans2.004/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf) · [字体许可证](src/ui/assets/NotoSansSC-OFL.txt)

个人中心通过原账户服务恢复会话、显示 UID、关注与粉丝，并读取报告和命理档案。算事通过原 `/reading` 接口发送问题、起盘和追问。同一浏览器标签页可按当前账号恢复尚有效的算事会话。浏览器 Worker 的构建及对照见[本机计算说明](tool/legacy_compute/README.md)。

算事沿用原版的单一对话入口。输入问题并发送后，按服务返回的流程投六次铜钱，再从 78 张牌里选三张。仪式可暂停续接，支持逐张翻牌和一键翻牌。六爻、梅花易数和塔罗盘面均可在同一对话中查看。服务端提供切牌位置时，前端按该位置演示切牌。

合盘可在 Web 手动填写双方资料并使用原 TypeScript 排盘与比较。会员也可读取本人最近的命理档案。在线解读使用已有 `/synastry/summary` 服务，访客或会员开启合盘用途的 AI 授权后可生成并保存报告。

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

Flutter 命理页上的「周期运势」沿用 `/fortune` 路由。日、周、月、年按设备 IANA 时区划分。交节、换日规则和每日黄历继续按北京时间计算。`FORTUNE_TIME_URL` 指向现有 Node 运势服务，由它提供 UTC 校时、计算、解读、建议和历史查询。该服务的 `APP_WEB_ORIGIN` 应与 Flutter Web 来源一致。

Flutter Web 使用原 TypeScript 计算四周期事实。登录或进入游客会话后，运势可根据命理档案生成解读，调用模型时沿用现有的运势 AI 授权。「按盘面获取建议」为每日运势的独立操作。重新打开页面时，可恢复当前身份和档案下的最近归档，也可通过「运势报告历史」浏览。

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

Flutter Web 的「命理」沿用原版出生资料核对流程，使用原 TypeScript 在浏览器排八字、紫微和西方星盘。盘面可在同一弹窗切换，时分缺失时显示原计算给出的稳定结果和时辰情景。出生地沿用旧版 2,941 条目录。配置 `DESTINY_REPORT_URL` 后，报告沿用原 Node 解读和账户归档服务。重新进入可回看上次报告和已归档盘面，完整快照可直接用于周期运势。

会员打开命理表单时会直接看到已保存的出生资料。确认测算时，通过原账户接口同步出生字段并沿用可见性设置。若账户同时更新，核对界面会显示本次填写与账户最新资料。访客可填写资料进行本次测算。

星盘的黄道与行星符号使用离线字体。[Noto Sans Symbols](https://notofonts.github.io/symbols/) · [字体许可证](src/features/destiny/assets/NotoSansSymbols-OFL.txt)

在 `src/features/account/server/` 运行 `dart pub get` 和 `dart run bin/account.dart` 可启动迁移中的 Dart 账户服务。默认监听回环地址，临时 SQLite 文件位于系统临时目录。沿用 `APP_ACCOUNT_PORT`、`APP_ACCOUNT_HOST`、`APP_ACCOUNT_DB`、`APP_WEB_ORIGIN`、`APP_ACCOUNT_ISOLATE_WEB_SESSION` 和 `APP_AGREEMENTS_FILE`。当前支持密码登录、回环开发环境免验证码注册、游客、UID、协议、分用途 AI 授权，以及命理、运势和合盘归档接口。短信和邮箱发码、正式第三方登录、隐私请求仍待迁移。

个人中心的「我的报告」分页读取当前账号或游客身份的已保存解读。「命理档案」查看最近一次命理记录的八字、紫微和西方星盘基础数据。Flutter Web 的命理、运势和合盘解读沿用现有报告服务和账户归档格式。

在同一目录运行 `dart run test/legacy_credentials_contract.dart`、`dart run test/account_store_contract.dart` 和 `dart run test/account_http_contract.dart`，可核对密码兼容性、SQLite 双向读写、会话和授权。在 `src/features/compliance/server/` 执行 `dart pub get` 和 `dart run test/agreements_parity.dart` 核对协议草案及摘要。对照使用 Node.js、临时凭证与隔离数据库。

`dart run test/archives_http_contract.dart` 使用旧 Node 账户库创建归档，经 Dart HTTP 服务验证读写、历史分节兼容、内容 ID、分页、账号隔离和合盘快照投影，再用 Node 读回 Dart 写入的资料。

## 迁移进度

| 范围 | 已移植内容 | 待迁移或验收 |
| --- | --- | --- |
| Flutter 客户端 | 五栏框架与拖动水滴、个人中心、消息、单入口算事、投币、抽牌、在线解读与追问 | 独立的算事历史归档、原生投币音效、Android/iOS 真机回归 |
| 算事控制层 | 盘面计算与校验、历史报告解析、待完成事件重放和解读重试 | 账号归档联动和原生恢复 |
| 算事后台 | 原有 `/reading` 路由、问题确认凭证、模型、账户权限、SQLite 会话、报告和追问 | 实际服务切换和真实模型回归 |
| 运势 | 命理入口、UTC 校时、四周期和指定日期计算、黄历、历法查询、Web 在线解读与归档恢复、独立每日提运建议 | 原生平台运行原计算与真机回归 |
| 命理 | 账户出生资料回填和并发同步、Web 出生资料核对、原 TypeScript 三类排盘、紫微宫位交互、西方星图、现有报告自动归档及回看 | 个人中心出生资料与可见性编辑、设备档案、原生平台运行原计算与真机回归 |
| 账户 | 密码登录、会话、UID、报告与档案、设置、资料编辑和实名认证占位表单 | 实名验证服务、密码设置界面、正式第三方登录与隐私请求 |
| 合规 | 三份现有草案正文、版本与摘要，发布参数校验 | 合规中心界面及服务接线 |
| 合盘 | Web 双人排盘和比较、本人档案、在线四类解读与归档 | 原生平台运行原计算与真机回归 |
| 社交和其他业务 | 消息通知、关注与粉丝、按 UID 或昵称查找用户 | 推荐 |
| 切换 | 本地迁移分支 | 各模块旧数据回读、服务装配、启动脚本、平台回归 |

牌图按旧版[资源清单](../src/features/divination/data/asset_manifest.json)逐张校验。Dart 的 Pro 提示词统一用 LF 换行生成版本摘要，已归档报告沿用原有数据格式。

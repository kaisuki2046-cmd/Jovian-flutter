# 木星环 Flutter 版

Flutter 版沿用项目的[目录分工](../app/FRAMEWORK.md)、[协作协议](../app/COLLABORATION.md)和 [Flutter 前端开工规范](AGENTS.md)。迁移分支从 `b47e061a` 开始，算事界面对照 `YA` 的 `d12e3f0c`。前端通过现有 API 接入 Node 服务。命理、合盘和运势的本机计算复用原 TypeScript 资源。下文的 Dart 服务和计算对照命令仅用于独立原型，启动 Flutter 前端时使用原 Node 服务。

## 启动 Flutter Web 前端

将 Flutter 客户端与原项目检出为同级目录。`app-flutter/` 是 Flutter 客户端的 Git 工作树和项目根目录，`app/` 提供原 RN 应用、TypeScript 计算和 Node 服务。Flutter 编辑、Git 提交、测试和构建均在 `app-flutter/` 下进行。本文指向原项目的链接使用该同级布局。

在 Flutter 项目根目录运行 `node tool/legacy_compute/build.mjs`，由原 TypeScript 生成 Web 和原生端共用的计算资源。原项目的 Node 依赖位于另一工作树时，按[本机计算说明](tool/legacy_compute/README.md)设置 `JOVIAN_LEGACY_NODE_ROOT`。然后运行以下命令，将服务地址和 Web 来源设为已有服务允许的值。若使用 Flutter 项目 `.local` 下的本地 SDK，在 PowerShell 中把 `flutter` 换成 `& '.\.local\flutter-toolchain\flutter\bin\flutter.bat'`。

```sh
flutter pub get
flutter run -d chrome --web-port 8081 --target src/app/main.dart --dart-define-from-file=config/local-web.example.json
```

Windows 下双击根目录的 [Start-web.cmd](Start-web.cmd)，会一并启动账户、算事、命理、运势和合盘的原 Node 服务，再打开 Flutter 的 Chrome 预览。服务优先使用原项目的端口，端口被占用时使用备选端口，Flutter 会读取实际分配的地址。启动器按原项目方式加载本机虚拟认证服务商与 DeepSeek 配置。保持启动窗口打开，按 Ctrl+C 或关窗时，这次启动的服务会退出。日志位于 `.local/start-web/`。

在 PowerShell 中也可运行 `& '.\Start-web.cmd' -CheckServices`，只检查五个本机服务能否启动。已有独立运行的服务时，可传 `-ServiceConfig` 指定地址文件，并用 `-WebPort` 匹配后端允许的 Web 来源。

示例文件使用原 `Start-app.cmd` 的主树首选端口，其中合盘为 `8812`。预览树或端口被占用时，以已启动服务的实际地址为准，通过自己的 `--dart-define-from-file` 文件或逐项 `--dart-define` 传入。Flutter Web 监听来源也要与 Node 服务允许的 `APP_WEB_ORIGIN` 一致。构建配置只填客户端可见的 URL。

已有 RN 构建配置可沿用 `EXPO_PUBLIC_API_BASE_URL`、`EXPO_PUBLIC_DIVINATION_REPORT_URL`、`EXPO_PUBLIC_DESTINY_API_BASE_URL`、`EXPO_PUBLIC_SYNASTRY_API_BASE_URL` 和 `EXPO_PUBLIC_FORTUNE_TIME_BASE_URL`，仍通过 Flutter 的构建参数传入。同一服务同时配置时，Flutter 变量优先。

手机与桌面浏览器共用页面主题、卡片、表单及底栏。内容区按可用宽度居中，最多 720 逻辑像素。底栏顺序为命理、合盘、算事、消息、个人中心，周期运势仍从命理进入。英文底栏沿用 RN 的单行短标签，长按提示和读屏使用完整名称。个人中心设置可以切换外观，并在本设备保存选择。

Web 底栏同步当前页面路径，支持刷新和浏览器前进、后退。使用 `/#/synastry`、`/#/divination`、`/#/messages`、`/#/account` 可直达对应入口，`/#/fortune` 与 `/#/modules/fortune` 继续打开周期运势。旧版带 `snapshotId` 的链接按当前账号读取指定命盘。从命理页打开某张命盘的运势后，刷新当前浏览器页面也会继续查看同一张命盘。个人中心的设置、报告、资料和社交等子页也可通过原账户路径打开。账户服务启用后，完成会话与协议确认即可继续访问原目标。设置可切换浅色、深色或跟随系统，也可选择简体中文或英语。Web 会在首次使用时读取同源 RN 保存的语言和外观。Android 原位升级且保留原应用数据时，也可沿用 RN 保存的外观和语言。生成的报告和用户填写内容保留原文。

底栏沿用原界面的悬浮胶囊、图标和蓝色选中态。拖动水滴时，玻璃比底栏更亮，边缘会折射下方图标并模糊背景。松开后切到相应标签。个人中心沿用大头像、独立设置入口、关注和粉丝按钮及并排的报告与消息入口。

界面内置简体中文字体，关闭 Web CDN 时也能正常显示中文。[Noto Sans SC v2.004](https://github.com/notofonts/noto-cjk/blob/Sans2.004/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf) · [字体许可证](src/ui/assets/NotoSansSC-OFL.txt)

个人中心通过原账户服务恢复会话、显示 UID、关注与粉丝，并读取报告和命理档案。算事通过原 `/reading` 接口发送问题、起盘和追问。同一浏览器标签页可按当前账号恢复尚有效的算事会话。浏览器 Worker 的构建及对照见[本机计算说明](tool/legacy_compute/README.md)。

配置账户服务后，冷启动先恢复会话。未登录用户在独立欢迎页登录、注册或确认以游客体验。协议更新时核对当前版本后继续原页面，直接打开 `/fortune` 或 `/modules/fortune` 时也沿用这个流程。手机号注册需要验证时会进入现有短信登录流程，邮箱或免码注册会核对两次输入的密码。

登录或进入游客体验后，可以在个人中心从本机选图并拖动或缩放裁切头像。头像按身份保存在当前设备，可以恢复默认头像。Web 可继续读取同源 RN 保存的头像。Android 原位升级保留应用数据后，登录原账号也可沿用已保存的头像。恢复默认头像或注销会清理当前账号的头像记录。

个人中心的个性签名与星座、性格、兴趣标签按账号保存在本机。Web 和保留应用数据的 Android 原位升级可读取同一账号的旧版记录。「基础个人资料」里的简介通过原账户接口管理公开范围。

算事沿用原版的单一对话入口。输入问题并发送后，按服务返回的流程投六次铜钱，再从 78 张牌里选三张。仪式可暂停续接，支持逐张翻牌和一键翻牌。会话有效时，刷新或重新打开可继续同一盘尚未完成的翻牌。翻完或会话过期后可直接回看已保存的报告。投币、洗牌、选牌和翻牌的操作提示随界面语言切换。问题已确认但启盘失败时，可以按原问题「重试算事」，或用「修改问题」回到输入框。服务端提示确认过期时可重新确认。六爻、梅花易数和塔罗盘面均可在同一对话中查看。服务端提供切牌位置时，前端按该位置演示切牌。

算事的果冻章鱼出场、表情、倾听和飞入输入框沿用原 RN 的角色画面与节奏。透明帧资源在 Flutter 内播放，减少动态效果时使用静止姿态。问候文字和金粉也随动态效果设置暂停。需要从同级 RN 源码重新导出角色帧时，在 Flutter 根目录运行 `node tool/render_assistant_motion.mjs`。可通过 `JOVIAN_BROWSER_TEST_ROOT` 和 `CHROME_EXECUTABLE` 指定本机的 Playwright 依赖和 Chrome。

Web、Android 和 iOS 的投币反馈使用同一套声音节拍。减少动态效果时只播放一次碰撞音，暂停或离开仪式会停止声音。算事主报告可逐段展开，追问可查看原文依据并打开或复制参考链接，历史快照会保留当次的依据。

算事输入框可添加图片、文件或选择快捷提问。附件原文件只在当前会话使用。已发送附件的名称按账号保存在本机，AI 请求仅读取正文。图片可在应用内预览。浏览器可保存所选文件，Android 和 iOS 的普通文件可查看名称和大小，并从详情打开系统查看器。

对话左上角的「会话历史」按当前账号查看本设备保存的算事记录，可按问题、澄清回复、追问或附件名称检索。有发送时间的消息按旧版规则分组标注，跨日或与上一条有时间的消息间隔满 5 分钟时再显示时间。已发送的问题和澄清回复会保留，尚未启盘的会话也可继续。同一会话里的多次启盘可从此前解读回看。服务会话有效时可以继续仪式或追问。服务会话过期后仍可回看已保存的盘面、报告和追问。Web 的会话令牌保留在当前标签页，数据快照独立保存。同源的旧版 RN Web 会话可按原账号只读回看。纯文字和澄清记录保留原题名及消息顺序，含综合算事、塔罗、六爻和梅花报告的会话可以展开旧报告。已归档的附件仅显示文件名。Android 原位升级保留原应用数据时，登录原账号也可回看文件里保存的记录。iOS 读取同一应用的 Documents 目录，仍需在正式升级路径复验。

「发送追问」沿用当前盘面，「接着上一题问」带上上一题的背景重新启盘，「另问一件事」在当前会话里提一个无关的新题，顶栏「新对话」另开一条会话。

合盘可手动填写双方资料并使用原 TypeScript 排盘与比较。会员也可读取本人最近的命理档案。在线解读使用已有 `/synastry/summary` 服务，访客或会员开启合盘用途的 AI 授权后可生成并保存报告。

```text
app-flutter/
├── src/
│   ├── app/main.dart              Flutter 入口与页面装配
│   ├── bootstrap/                 运行环境与模块装配
│   ├── features/
│   │   ├── account/               登录、会话、协议、资料与归档的界面及 API 接入
│   │   ├── compliance/            协议文案与阅读资料
│   │   ├── destiny/               出生地点、历史时区、八字计算与页面
│   │   ├── divination/
│   │   │   ├── assets/            原有塔罗牌图
│   │   │   ├── control/           算事对话流程与服务结果适配
│   │   │   ├── model/             卦象和报告数据模型
│   │   │   ├── requests/          算事 HTTP 请求与会话恢复
│   │   │   ├── view/              Flutter 界面
│   │   │   └── server/            Dart 历史服务原型
│   │   ├── fortune/               周期运势、黄历、历法和建议界面及 API 接入
│   │   ├── social/                消息、关注、粉丝和公开资料
│   │   └── synastry/              双人盘面、比较和在线解读
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

在线算事沿用现有 Node 账户和算事服务。启动这两个服务后，在 `app-flutter/` 下运行以下命令，并将 Web 来源加入它们各自的允许列表。登录或进入游客会话后，在个人中心的「隐私与授权」中开启算事授权。下文的 Dart 服务命令用于隔离环境中的历史原型对照。

要使用先选牌、翻牌再六爻起卦的流程，在同级原项目 `app/` 的 Git 工作树中应用[算事服务补丁](tool/patches/divination-tarot-first.patch)，然后重启 Node 算事服务。补丁以原项目 `dev` 的 `7170624` 为基准。

```sh
git -C ../app apply --check "$(pwd)/tool/patches/divination-tarot-first.patch"
git -C ../app apply "$(pwd)/tool/patches/divination-tarot-first.patch"
```

```sh
flutter run -d chrome --web-port 8114 --target src/app/main.dart --dart-define=ACCOUNT_API_URL=http://localhost:8787 --dart-define=DIVINATION_REPORT_URL=http://localhost:8115
```

Web 会话使用账户服务的 HttpOnly Cookie，浏览器同一标签页按已验证的账号恢复当前算事会话。Flutter 原生端通过系统安全存储保存会话令牌，算事读取同一会话令牌。验证码与免验证码注册根据账户服务公布的能力显示，微信与 QQ 目前接入现有本地服务商协议。原生平台尚待真机验收。

命理、合盘和运势的原生计算通过系统 WebView 加载本机资源。Android、iOS 和 Web 都使用 `src/app/main.dart`，沿用当前目录结构。各端加载相同的业务页面和离线计算资源。[本机计算说明](tool/legacy_compute/README.md)

## Android 和 iOS 前端源码

`android/` 和 `ios/` 包含 Flutter 的平台启动工程。显示名沿用「木星环（测试）」，Android 包名和 iOS Bundle ID 暂用 `com.jovian.preview`。Android 的应用标识在 `android/app/build.gradle.kts`，iOS 的应用标识在 `ios/Runner.xcodeproj/project.pbxproj`。Flutter 版本号来自 `pubspec.yaml`，构建时可以覆盖。两端的启动图和应用图标沿用木星环素材。

先生成本机计算资源。Flutter 命令加 `--target src/app/main.dart`，并继续用上面的五项 `--dart-define` 指定原服务地址。Android 模拟器访问宿主机时用 `10.0.2.2`，使用 `adb reverse` 的设备可用 `127.0.0.1`。Android 主清单声明网络访问，调试清单为本机地址提供 HTTP 例外。iOS 原生会话保存在应用自己的 Keychain 中。[Flutter 移动端网络配置](https://docs.flutter.dev/release/breaking-changes/network-policy-ios-android)

Android 的「关于木星环」显示安装包版本。配置 `ANDROID_UPDATE_DOWNLOAD_ORIGIN` 为发布下载的 HTTPS 来源后，应用从 `APP_UPDATE_API_URL` 的 `/app-updates/android/latest` 读取现有发布清单。清单和账户共用网关时可沿用 `ACCOUNT_API_URL`。应用启动、回到前台或手动点「检查更新」可看到同包名的较新版本。点击「下载新版」会在系统浏览器打开受信链接。

在 `app-flutter/` 中用 `flutter build bundle --debug --target src/app/main.dart` 检查 Flutter 入口和资源。Android、iOS 的系统启动、WebView 运行和后端连接仍需分别在对应设备验收。签名由发布流程配置。

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

上述 Dart 算事计算和服务目录用于历史原型对照。运行 Flutter 主入口时，算事由 `DIVINATION_REPORT_URL` 接入原 Node 服务，盘面、报告和会话标识均沿用该服务的结果。

在 Dart 运势对照目录 `src/features/fortune/server/` 下运行 `dart pub get` 和 `dart run bin/fortune_time.dart`。同一个 Dart 服务提供 `/fortune/time`、`/fortune/advice/options` 与 `/fortune/advice/options/:id`。使用 `dart run test/fortune_time_contract.dart` 和 `dart run test/fortune_advice_contract.dart` 检查 HTTP 状态、跨来源访问和建议内容。

Flutter 命理页上的「周期运势」沿用 `/fortune` 路由。日、周、月、年按设备 IANA 时区划分。交节、换日规则和每日黄历继续按北京时间计算。`FORTUNE_TIME_URL` 指向现有 Node 运势服务，由它提供 UTC 校时、计算、解读、建议和历史查询。该服务的 `APP_WEB_ORIGIN` 应与 Flutter Web 来源一致。

Flutter Web 使用原 TypeScript 计算四周期事实。登录或进入游客会话后，运势可根据命理档案生成解读，调用模型时沿用现有的运势 AI 授权。「按盘面获取建议」为每日运势的独立操作。重新打开页面时，可恢复当前身份和档案下的最近归档，也可通过「运势报告历史」浏览。

从运势历史打开报告会显示保存时的周期、日期和时区。历史日运的提运建议沿用该归档的原计算结果。历法查询按北京时间使用日期和时刻输入。

年运的太阳回归地点支持切换南纬和西经。地点无法确定回归上升时，可清空坐标生成常规解读。指定的命盘失效时可以直接返回命理重新选择。

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

Flutter 的「命理」沿用原版出生资料核对流程，通过本机计算桥调用原 TypeScript 排八字、紫微和西方星盘。盘面可在同一弹窗切换，时分缺失时显示原计算给出的稳定结果和时辰情景。出生地沿用旧版 2,941 条目录。配置 `DESTINY_REPORT_URL` 后，报告沿用原 Node 解读和账户归档服务。重新进入可回看上次报告和已归档盘面，完整快照可直接用于周期运势。

命理和合盘共用出生资料表单，支持键盘录入、日历和时间选择，以及逐级浏览或搜索出生地目录。出生资料确认页逐项列出日期、时间、地点和性别。命理页可单独暂停和开启动效，并遵循系统的减少动态效果设置。旧档案的八字支持回看十神与神煞，窄屏和大字号下四柱可换行。选择紫微宫位后会滚动到对应的详情。

会员打开命理表单时会直接看到已保存的出生资料。确认测算时，通过原账户接口同步出生字段并沿用可见性设置。若账户同时更新，核对界面会显示本次填写与账户最新资料。访客可填写资料进行本次测算。

「基础个人资料」可编辑出生日期、时分、地点和性别。省市区选择沿用原账户目录，也可手动保留境外城市和历史地名。「隐私设置」逐项管理出生资料可见性。遇到同时编辑时，页面保留草稿并提示重新加载账户最新值。[原地点目录与许可](../app/src/features/account/reading-profile/places/README.md)

「隐私设置」中的「预览他人可见内容」显示已保存的公开资料。其他已登录用户从消息页找人、关注或粉丝列表进入用户主页时，读取原账户服务提供的公开出生资料。只有本人预览显示每项可见性状态。

「社交隐私」可设置是否允许按 UID 找到自己，昵称搜索还需要公开昵称。这里也可查看黑名单和解除拉黑。

「个人信息权利」可复制基础资料、申请查阅或复制、申请更正，并查看受理状态与处理结论。审核入口只显示给原 Node 账户服务授权的审核员，申请人可查看自己的申请。

「协议与政策」可阅读现行协议、RN 版已有的辅助草案，以及用户已同意的历史版本。「关于木星环」也可打开协议目录。

「账户与安全」沿用现有服务设置或修改密码。已设置密码的账号用当前密码验证。通过短信登录且尚无密码的账号用绑定手机号收到的验证码设置。新密码长度为 8 至 128 个字符。保存后保留当前登录，其他设备的会话由原服务撤销。

「账户与安全 → 手机号」显示脱敏后的绑定号码。有邮箱的账户需要输入账户密码和待绑定号码的验证码。已绑定且仅以手机号作为账户标识的账号，换绑时需要验证旧手机号和新手机号。

首次短信或第三方登录时，若账户服务要求补设昵称，应用会在进入功能页前显示「设置昵称」。刷新后可继续补设，昵称重名时保留输入供修改。

「账户与安全 → 注销账号」使用原账户服务验证身份。服务器受理后，Flutter 结束本地会话并清理本账号的算事记录。登录页可刷新注销回执。Web 同时清理同源 RN 旧版算事历史及当前标签页的会话恢复数据。

星盘的黄道与行星符号使用离线字体。[Noto Sans Symbols](https://notofonts.github.io/symbols/) · [字体许可证](src/features/destiny/assets/NotoSansSymbols-OFL.txt)

在 `src/features/account/server/` 运行 `dart pub get` 和 `dart run bin/account.dart` 可启动历史对照用的 Dart 账户原型。Flutter 主入口接入原 Node 账户服务。默认监听回环地址，临时 SQLite 文件位于系统临时目录。沿用 `APP_ACCOUNT_PORT`、`APP_ACCOUNT_HOST`、`APP_ACCOUNT_DB`、`APP_WEB_ORIGIN`、`APP_ACCOUNT_ISOLATE_WEB_SESSION` 和 `APP_AGREEMENTS_FILE`。当前支持密码登录、回环开发环境免验证码注册、游客、UID、协议、分用途 AI 授权，以及命理、运势和合盘归档接口。短信和邮箱发码、正式第三方登录、隐私请求仍待迁移。

个人中心的「我的报告」分页读取当前账号或游客的解读。打开报告会进入专门的阅读页，返回后保留列表滚动和已加载分页。在线和归档正文共用报告排版，识别旧版标题、加粗和列表，报告原文沿用原归档字段。「命理档案」查看最近的八字四柱、紫微和西方星盘。Flutter Web 的命理、运势和合盘解读沿用现有报告服务和账户归档格式。

原生端会员可从命理报告页主动保存本机出生资料。账户资料为空时可用该副本，之后可修改或仅删除本机副本。注销会清理该账户的本机资料。

在同一目录运行 `dart run test/legacy_credentials_contract.dart`、`dart run test/account_store_contract.dart` 和 `dart run test/account_http_contract.dart`，可核对密码兼容性、SQLite 双向读写、会话和授权。在 `src/features/compliance/server/` 执行 `dart pub get` 和 `dart run test/agreements_parity.dart` 核对协议草案及摘要。对照使用 Node.js、临时凭证与隔离数据库。

`dart run test/archives_http_contract.dart` 使用旧 Node 账户库创建归档，经 Dart HTTP 服务验证读写、历史分节兼容、内容 ID、分页、账号隔离和合盘快照投影，再用 Node 读回 Dart 写入的资料。

## 迁移进度

| 范围 | 已移植内容 | 待迁移或验收 |
| --- | --- | --- |
| Flutter 客户端 | 五栏框架与拖动水滴、个人中心、消息、单入口算事、投币与声音反馈、抽牌、在线解读、追问与会话历史 | Android/iOS 真机回归 |
| 算事控制层 | 原 Node 盘面解码和展示、历史报告解析、按账号保存的会话快照、待完成事件重放和解读重试 | 原生本机存储验收 |
| 算事服务接线 | 复用原 Node `/reading`、问题确认凭证、账户权限、报告和追问 | 真实模型回归 |
| 运势 | 命理入口、UTC 校时、四周期和指定日期计算、黄历、历法查询、在线解读与归档恢复、独立每日提运建议、原生会话接线 | 原生平台真机回归 |
| 命理 | 账户出生资料回填和并发同步、原生本机出生资料、出生资料核对、原 TypeScript 三类排盘、紫微宫位交互、西方星图、现有报告自动归档及回看 | 原生平台真机回归 |
| 账户 | 密码登录、短信找回密码、密码修改与短信验证后设置密码、手机号绑定和换绑、会话、UID、报告与档案、设置、出生资料与可见性编辑、个人信息申请与审核、注销与回执、实名认证占位表单 | 实名验证服务、正式第三方登录 |
| 合规 | 现行与历史协议、辅助草案、分用途 AI 授权、隐私权利入口 | 原版合规中心的发布材料仍在 [RN 仓库](../app/src/features/compliance/README.md) |
| 合盘 | 双人排盘和比较、本人档案、在线四类解读与归档 | 原生平台真机回归 |
| 社交 | 消息通知、关注与粉丝、按 UID 或昵称查找用户、公开资料预览、搜索开关和黑名单 | 原生平台真机回归 |
| 预览 | Flutter 独立源码入口、Web 与原生端使用原 API | 正式部署、平台回归 |

牌图按旧版[资源清单](../app/src/features/divination/data/asset_manifest.json)逐张校验。Dart 的 Pro 提示词统一用 LF 换行生成版本摘要，已归档报告沿用原有数据格式。

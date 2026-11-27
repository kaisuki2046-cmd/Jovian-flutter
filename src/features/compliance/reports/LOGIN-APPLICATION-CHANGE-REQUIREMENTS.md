# 登录、验证码与实名申请：文件改动及接线要求

记录日期：2026-11-19。基线：`codex/compliance/ios-agreements` / `fe52298`，结合当前未提交业务代码只读检查。状态：**申请准备及待授权需求，未提交平台申请，未接入真实服务**。

2026-11-22 按 Android 首发补充[移动登录申请包](SOCIAL-LOGIN-REVIEW-PACKET.md)。经授权，`81ee` 工作树在 `a45f518` 基线上增加了免会话的 `GET /account/auth/capabilities`。当前仅回环开发服务加载虚拟供应商后返回支持的模拟方式，登录页据此展示入口和模拟说明。未配置、接口失败或旧服务未提供此接口时，微信和 QQ 入口隐藏，现有手机和邮箱入口照常可用。该接口不包含公开应用标识、用户数据或凭据。正式原生登录仍需完成实际 SDK 和平台接线。下文的完整网站回调、iOS Universal Links 和 AASA 适用于各自启用的形态。

## 一、来源与核对边界

参考用户提供的 `login-api-application-guide.pdf`（2026-11-19，11 页）：第 2 页微信、第 3 页 QQ、第 4–5 页实名、第 6 页邮箱、第 7–8 页手机验证码、第 9 页交接、第 10–11 页官方链接。附件是参考资料，不构成对账号、费用、个人资料、平台申请或跨模块代码修改的授权。

PDF 第 9 页的“当前项目”指 `f95b` 工作目录。本报告检查的是 `efd7/app`，不能把附件的实现状态当作本树事实。本树有 `deliverCode`、`exchangeSocial` 和本地虚拟供应商；**未找到 `src/features/account/real-name/` 及 `APP_REAL_NAME_PROVIDER_MODULE` 实现**。实名接线须先核对账户负责人已完成的版本，后续整合另行授权，不重复创建或直接引用不存在的接口。

下列官方来源为本次实际阅读或明确受限的页面，见末尾索引。官网/控制台未能读取的细节保留待核实状态，不用博客或第三方转载代替官方确认。所有审批、报价、主体资格以申请时真实控制台为准，不承诺固定审批时长。

## 二、本轮落入合规中心的文件

| 合规文件 | 本轮登记内容 |
| --- | --- |
| 本文件 | 官方核对、实际代码缺口、以后需要改哪些文件及验收 |
| [申请材料与交接台账](LOGIN-APPLICATION-MATERIALS.md) | 五项申请清单、审核页面、配置登记、责任和办理状态模板 |
| [账户登录、验证码与实名告知草案](../agreements/documents/account-verification.draft.md) | 按实际启用能力说明用途、字段、接收方、选择和删除；实名按次明确确认 |
| [隐私草案](../agreements/documents/privacy-policy.draft.md)、[删除草案](../agreements/documents/account-deletion.draft.md) | 纳入条件启用的身份服务与结果清理要求 |
| [确认要求](../agreements/CONSENT-REQUIREMENTS.md)、[模块待办](MODULE-CHANGE-REQUIREMENTS.md)、[iOS 清单](IOS-RELEASE-CHECKLIST.md)、[待确认项](OPEN-ITEMS.md)、[目录](../README.md) | 串联申请和后续接线依赖，不将文档写成已实现能力 |

本轮不创建真实 OAuth 回调、SDK、邮件或短信适配器、实名服务、网站、原生配置或运行接口。以下业务路径均为未来候选修改范围，不是本轮已修改清单。

## 三、五项申请与代码要求

### 1. 微信：先确认 Web、原生 App、微信内 H5 的申请形态

- PDF 区分网站扫码、移动应用和公众号网页授权。本次网站/移动开发文档及开放平台入口均访问失败；保留三个官方链接 W1–W3，**主体、费用、当前材料、授权范围及回调字段写法需管理员登录控制台复核**。不把网站应用权限等同移动权限，也不承诺共用一个 AppID。
- 项目实施要求：由账户负责人定下真实 Web 授权起点、回调 URL、允许返回页面及一次性状态验证；客户端取得相应平台凭证，服务端验证后才建立本站会话。原生端按官方 SDK 方案分别接唤起、取消、回跳、未安装和失败状态。
- 客户端只持必要公开标识；AppSecret 不进入 App、网页、`EXPO_PUBLIC_*` 或仓库。所需原生 SDK 应在开发构建/正式包验收，不能用 Expo Go 按钮可点作为证明。后一点依据 Expo 官方开发构建说明 E1。

候选文件：账户 `auth/view/screen.tsx`、`auth/control/SessionProvider.tsx`、`auth/requests/session.ts`、`auth/control/server-auth.mjs`、`server/handler.mjs`、`server/auth-provider.mjs`、`server/index.mjs`；经批准新增的服务端平台适配器与回调处理；原生及路由范围见第五节。

### 2. QQ：完整回调、真实上线状态和平台凭证校验

- 按 Q1/Q2 创建对应应用并准备公司可持续管理的账号；Q3 要求有效登录入口、完整名称/图标、适用的网站及回调备案资料。拿到 AppID/AppKey 不等于已获上线权限。[Q1][Q2][Q3]
- Q4 的加强校验要求是接收 code 的**完整回调地址**；不能只登记主域名，不能用 localhost 或自定义端口。程序授权与换令牌使用一致的 `redirect_uri`；Q5 部分旧例子较宽泛时，以专门回调校验说明和真实控制台为准。[Q4][Q5]
- Q5 的 Web 流程要求把 `state` 与发起者绑定。项目还应控制一次使用、期限和返回目标，拒绝失配、重放、开放重定向；按服务端验证的应用和平台身份建账，不按昵称/邮箱自动合并。
- QQ 原生 SDK 可能提供与 Web code 流程不同的凭证，不能强行假设都返回同一种 `authorizationCode`。账户负责人确定实际凭证协议及服务端核验方式，不能相信客户端提交的 OpenID、昵称或未核验令牌。App 内嵌 H5 不作为移动 SDK 登录替代。[Q5]
- iOS 按 Q6/A1 核对 Universal Links、App 回调和域名关联。QQ 社交用户不被迫创建独立密码或填写 QQ 邮箱；本站安全能力按实际需求设计，不借申请强加无关资料。[Q3]

候选文件与微信共用认证协调及路由位置；独立平台适配器按批准位置新增，真实身份命名空间应隔离 `local`，并明确多应用标识及后续账号关联策略。

### 3. 邮箱验证码：邮件投递与本站核验分别验收

- DirectMail 开通、区域和发信地址按 D1/D2 核对；API 或 SMTP 二选一，所选区域、地址和接入配置对应。优先自有发信域名，验证码使用触发邮件；SMTP 密码不是 AccessKey。[D1][D2]
- PDF 的专用子域名、SPF/DKIM/DMARC/MX 清单先登记。**D3 域名配置页本次持续超时**，具体记录值、合并方式及必验项由 DNS 管理员按真实控制台/官方页面复核，不把四种记录在所有情形都必须新建写死。
- 现有 `deliverCode({ channel, recipient, purpose, code, expiresIn })` 可以作为投递入口；普通发信不自动提供验证码生成/核验能力。`verification-codes.mjs` 已有五分钟有效、30 秒重发间隔、五次尝试、摘要比对和消费控制，应保留并验证，避免重新建设相同功能。
- 现有 `verification-codes.mjs` 可读取提供商的 `developmentCode`，生产接线须确保验证码和开发 inbox 标识不返回客户端、不落普通日志；检查超时、重复请求、服务重启和多实例挑战的一致性。是否支持邮箱找回要按本树实际功能决定，不因邮件供应商就绪宣称已完成找回流程。

候选文件：账户 `server/auth-provider.mjs`、`server/index.mjs`、`auth/control/server-auth.mjs`、`auth/control/verification-codes.mjs`、经批准新增的 DirectMail/SMTP 服务端适配器及隔离测试。邮件主题/正文、有效期和产品名称由产品核定，再放到账户批准的位置，不提前捏造正式模板。

### 4. 手机验证码：普通短信与短信认证择定后接线

| 路径 | 申请和技术区别 | 接线要求 |
| --- | --- | --- |
| 普通短信 SMS | 国内自用/他用资质、签名、模板及运营商报备分别确认；不是只完成阿里云账号实名即可。SendSms 使用审核通过的签名和模板变量。[S1][S2] | 可适配现有 `deliverCode`，本站继续核验。核对模板有效期与 `expiresIn`，保留验证码前导零 |
| 短信认证 PNVS | 官方当前提供预置签名/模板，可免自申请相应资源；开通后使用 SendSmsVerifyCode 和 CheckSmsVerifyCode。[V1] | 先定平台生成/核验还是受支持的自定义码方案。若采用平台核验，现有只提供发送的接口不足，须扩展挑战与消费契约，不能只换发信实现 |

项目共通要求：号码、用途、挑战编号和必要会话绑定，注册/登录/绑定/换绑/找回隔离；保留已有有效期和次数控制。供应商成功受理不冒充实际送达；超时结果不明时不盲目重复发信。SMS 官方注明非幂等，本站需防重复及失控费用；PNVS 按其自身业务返回核验。真实验证均在用户知情的测试号码上进行，本轮未发送短信。[S2][V1]

候选文件：上节服务端文件，以及账户 `auth/requests/phone.ts`、`auth/control/usePhoneForm.ts`、必要的安全页面和请求解析；采用 PNVS 平台核验时再细化契约，不能默认已获修改整个账户模块授权。

### 5. 身份证二要素：可选的账户资料用途，不设全业务门槛

- 企业实名账号开通号码百科并申请**身份证二要素**标签，按 C1/C2 准备真实场景及表单资料；不要误选姓名+手机号的运营商二要素。相近标签材料可能不同，盖章授权截图/合同链按所选标签和真实主体关系确认。[C1][C2]
- C3 参数为 AuthCode、CertName、CertNo。标签 AuthCode 与 RAM 调用身份不同；申请接收方、传输字段、目的和结果保留方式须先明确，实名告知与 AI 许可分开。[C3]
- 接线须解析 `Code` 和字符串结果 `Data.IsConsistent`：`Code = OK` 且为 `"1"` 才通过；`"0"` 不一致、`"2"` 查无以及未知值/异常均不得成功。HTTP 200 或顶层 OK 不足以证明核验通过。[C3]
- 本次沿用 PDF 的用途边界作为**待实现需求**：仅由用户主动完善账户资料，不强制开启排盘、运势、合盘或算事；不扩大为人脸、手机号三要素核验。不存无必要的原始身份证号，保留什么结果、凭据及期限需先确认。
- 本树尚无该模块；先与账户负责人核对版本和公开契约。不能声称已存在加载环境变量，也不能在合规中心新建实名业务 API。

候选范围：后续整合版本的 `src/features/account/real-name/`（本树尚不存在）、账户受信任身份、资料页、`server/index.mjs`/`handler.mjs`、最小化结果存储及测试。需先交付该版本的具体文件清单和授权，再实施。

## 四、当前树特别需要补的公共接线

1. **生产供应商加载入口**：`server/auth-provider.mjs` 当前只有 `loadLocalAuthProvider`，生产或非回环环境直接退出。真实适配器不能塞进此本地加载器后宣称生产可用；新增正式注入/配置途径，保留开发与生产隔离。
2. **受信任社交登录**：当前 `server-auth.mjs` 允许不传授权码以配合本地模拟；真实模式要按端严格要求有效凭证，并验证状态/应用身份。现有契约不含完整 Web state 交易流程，需在实际回调处理和契约中补齐，不靠昵称建账。
3. **协议与注销联动**：只取必要登录字段，明确选填资料；平台授权不是 AI 共享许可。支持撤回社交数据访问及解绑/注销时的会话、令牌和关联清理，明确最后一种登录方式解绑前如何避免用户失去访问能力。
4. **上线状态与证据**：把创建应用、审核通过、权限开通、代码接通、真机成功分为独立状态。模拟通过、inbox 文件、官方调试登录页都不能作为实际接通证明。

## 五、仓库与部署文件变更登记（以后实施需授权）

| 负责人 | 具体候选文件/产物 | 原因与影响 |
| --- | --- | --- |
| 账户认证 | `src/features/account/auth/view/screen.tsx`、`control/SessionProvider.tsx`、`requests/session.ts`、`control/server-auth.mjs` | 真实登录触发、状态/取消、可信平台身份、本地和正式路径隔离；各相对路径在 auth 下 |
| 账户服务 | `src/features/account/server/auth-provider.mjs`、`index.mjs`、`handler.mjs` | 正式供应商注入与安全回调，保留本地适配契约 |
| 账户验证码 | `src/features/account/auth/control/verification-codes.mjs`、`requests/phone.ts` 及必要 form/control | 真实投递与核验、生产返回限制、PNVS 契约分歧；不重复实现已有控制 |
| 账户存储 | `src/features/account/storage/account-store.mjs`，及经确认新增的适配/测试文件 | 应用身份归属与解绑、注销所需最小字段；不按昵称合并，也不写入原始凭据 |
| 合规 + 账户资料 | 本目录协议/用途记录，账户 `model/sections.ts`、`view/section-screen.tsx` 及资料入口 | 协议、第三方清单、撤回、可选实名；不把私有管理入口放到底栏 |
| 路由/集成 | 经批准新增的 `src/app/` 回跳页面，以及必要 `_layout.tsx`/`src/bootstrap/` 装配 | 只接实际需要的回跳和公开契约，不预先认定必须同时改所有入口 |
| 原生发布 | `app.json` 或实际选用的 app config，必要的 `package.json`、锁文件、构建配置/原生插件 | 确认 SDK 后配置 Bundle ID、URL scheme、Associated Domains、必要查询项和 Android 包名/签名；不假设项目已有 ios/android 源目录，不预选第三方 SDK 库 |
| 域名/运维 | 真实站点 `/.well-known/apple-app-site-association`、HTTPS、DNS、审核页、政策网页与实际部署配置 | AASA 应用标识/路径与原生授权匹配；HTTPS 有效证书且无重定向。文件属于真实域名服务，不误放进合规目录当成部署完成。[A1] |
| 配置负责人 | `.env.example`、经确认的后端部署/密钥注入说明，必要时 `Start-app.cmd` | 只登记变量名和用途；密钥经受控配置。Windows 本机启动不是生产上线入口，不为申请强行修改它 |

需要新增的文件由对应负责人先确定最终路径；不能把“待新增”当作现有文件。账户子目录、路由、配置、依赖和部署都需用户具体授权，本报告不替其他负责人扩大权限。

## 六、交付顺序与验收

1. 公司管理员/产品决定上线端、供应商及主体；按[材料台账](LOGIN-APPLICATION-MATERIALS.md)准备域名、可审核页面、真实文本与材料。QQ 可能需接入完成才能通过上线审核，故“申请中→受限联调→最终上线确认”允许迭代，不把正式审批一律设为开发前置。
2. 合规/账户确定公开身份与用途契约，账户接正式供应商；客户端与集成负责人接 Web/原生，各自只改获准文件；管理员负责平台及 DNS 权限，UI 不持服务端密钥。
3. 社交：首登建账、再次同一账号、跨端归属策略、取消/过期/伪造证明/state 失配和重放拒绝；注销/解绑有效，生产没有固定测试身份。
4. 验证码：本人真实收到→正确回填→对应账户状态变化；错误、过期、重放、跨用途、换绑和并发拒绝；故障不跳过核验、不泄露 code。保留供应商流水的最小脱敏证据，核对费用。
5. 实名：一致、不一致、查无、未知值、鉴权异常和超时分别验收；其他业务不增加实名门槛。只在另行授权后用本人同意的测试资料，不把身份证号或证照加入 Git。
6. iOS：原生包实测应用唤起/回跳及 AASA；启用第三方主账号登录时，按 Apple 4.8 确定等价登录/适用例外并留证，不把普通手机号登录自动当作满足所有条件。[A2]

## 七、官方资料索引与访问状态

2026-11-19 本次阅读状态如下。没有自动提交申请、登录管理员账户或执行付费调试。

| 编号 | 官方来源 | 本次结论/状态 |
| --- | --- | --- |
| W1 | [微信开放平台](https://open.weixin.qq.com/) | 访问失败；主体、材料、认证和费用待控制台复核 |
| W2 | [网站应用微信登录](https://developers.weixin.qq.com/doc/oplatform/Website_App/WeChat_Login/Wechat_Login.html) | 访问失败；保留 PDF 路径建议，不称已读正文 |
| W3 | [移动应用微信登录](https://developers.weixin.qq.com/doc/oplatform/Mobile_App/WeChat_Login/Development_Guide.html)、[微信公众平台](https://mp.weixin.qq.com/) | 移动指南访问失败；公众号入口仅作备选路径，不称其页面内容已核验 |
| Q1/Q2 | [成为开发者](https://wiki.connect.qq.com/成为开发者/)、[创建应用](https://wiki.connect.qq.com/__trashed-2/) | 已读取；创建页为官方导航当前指向的路径 |
| Q3 | [应用审核规范](https://wiki.connect.qq.com/网站审核规范/) | 已读取；备案、登录入口、UI、上线及资料限制 |
| Q4 | [回调地址相关问题](https://wiki.connect.qq.com/回调地址常见问题及修改方法/) | 已读取；完整 URL 的加强校验 |
| Q5 | [Authorization Code 流程](https://wiki.connect.qq.com/使用authorization_code获取access_token/) | 已读取；state、换令牌及 Web/原生差别 |
| Q6 | [Universal Links FAQ](https://wiki.connect.qq.com/universal-links适配faq/) | 已读取；回跳及域名检查，文内旧版本号不当作首发版本建议 |
| D1/D2 | [API/SMTP 流程](https://help.aliyun.com/zh/direct-mail/getting-started/simplified-procedure-of-sending-by-api-and-smtp)、[发信地址](https://help.aliyun.com/zh/direct-mail/user-guide/setup-sender-addresses/) | 已读取；区域、地址、SMTP 密码和触发类型 |
| D3 | [发信域名配置](https://help.aliyun.com/zh/direct-mail/user-guide/how-to-configure-sending-domain-names) | 多次超时；DNS 必验项及具体值待官方/控制台复核 |
| S1/S2 | [短信资质](https://help.aliyun.com/zh/sms/user-guide/qualification-application-description)、[SendSms](https://help.aliyun.com/zh/sms/developer-reference/api-dysmsapi-2017-05-25-sendsms) | 已读取；资质、签名/模板、受理/回执和非幂等 |
| V1 | [短信认证指引](https://help.aliyun.com/zh/pnvs/getting-started/sms-authentication-service-novice-guide) | 已读取；预置资源、发送/核验、测试计费 |
| C1/C2 | [号码百科指引](https://help.aliyun.com/zh/cpns/getting-started/get-started-with-cpns)、[申请材料](https://help.aliyun.com/zh/cpns/user-guide/apply-for-cpns-features) | 已读取；标签选型及不同材料要求 |
| C3 | [身份证二要素 API](https://help.aliyun.com/zh/cpns/developer-reference/api-dytnsapi-2020-02-17-certnotwoelementverification) | 已读取；参数、字符串结果、RAM 权限和计费条件 |
| A1/A2 | [Associated Domains](https://developer.apple.com/documentation/xcode/supporting-associated-domains)、[App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) | 已读取 Apple Markdown 及 4.8/5.1.1；域名关联、登录及撤回 |
| E1 | [Expo 开发构建](https://docs.expo.dev/develop/development-builds/introduction/) | 已读取；原生依赖需要相应构建，不据此执行安装或构建命令 |

费用仅登记核对项，不写固定价格：邮件/短信/实名的测试均可能发生费用；实名官方 C3 的计费条件为 `Code = OK` 且 `IsConsistent != 2`，不能把“不一致”默认当免费。材料清单不替代数据处理与服务合同审查。

## 八、本轮验证与交付状态

已提取附件全部 11 页文字及官方链接，并渲染查看页面。对本树账户适配器、验证码、会话及服务入口作了只读对照。合规目录共 17 份 Markdown，本地链接、变更空白及修改范围检查通过。合规目录外既有业务差异和未跟踪的公共限制文件与开工记录哈希一致。

本轮新增 3 份、更新 8 份合规文档。代码测试、App 构建及真实服务验证留待接入阶段。供应商、主体、域名及材料的确认状态见[申请台账](LOGIN-APPLICATION-MATERIALS.md)。

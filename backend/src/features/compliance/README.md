# Compliance Center｜合规中心

最近核对日期为 2026-11-25。状态为**已接入协议确认、个人信息申请与举报回执，正式文本及供应商配置待提供**。

首发验收见 [Android 首发清单](reports/ANDROID-RELEASE-CHECKLIST.md)。微信与 QQ 的移动应用申请文案、证据和流程见 [Android 登录申请包](reports/SOCIAL-LOGIN-REVIEW-PACKET.md)。

## 初版决定（2026-11-19）

| 项目 | 决定 | 待确认 |
| --- | --- | --- |
| 首发平台与地区 | 中国大陆 Android | 应用商店、包名及发布签名 |
| 验证码 | 暂定通过腾讯云平台接入 | 首发启用邮箱、手机或两种渠道，以及各渠道对应的产品和核验方式 |
| 付费 | 方案待定，应用内条款留空 | 商品、价格、支付和退款安排 |
| 协议重大更新 | 登录页重新确认，站内通知开通后补提醒 | 站内通知接入和提醒展示 |

验证码已接入按渠道配置的服务端接口，腾讯云短信适配器与邮箱交付入口默认等待正式配置。具体申请和接入状态见[申请材料与交接台账](reports/LOGIN-APPLICATION-MATERIALS.md)及[账户接入说明](../account/auth/README.md)。

## 两个独立子系统

| 子系统 | 职责 | 当前范围 |
| --- | --- | --- |
| Agreement System | 协议、授权、版本与用户确认 | 协议草案及实施要求 |
| Moderation System | 输入、输出审核，风险识别、决策及审计 | [暂缓说明](moderation/README.md)，保留算事现状 |

合规中心无需出现在底部导航。未来后台管理逻辑可隐藏，但协议查看、AI 数据共享授权、撤回和账号注销入口必须按实际产品要求可发现。不能以隐藏管理模块为由隐藏用户权利入口。

## 协议草案目录

| 文档 ID | 草案版本 | 文件 | 建议交互 |
| --- | --- | --- | --- |
| terms_of_service | 0.1.0-draft | [用户服务协议](agreements/documents/terms-of-service.draft.md) | 服务协议查看及必要确认 |
| privacy_policy | 0.1.0-draft | [隐私政策](agreements/documents/privacy-policy.draft.md) | 可访问的隐私告知，按实际处理取得必要同意 |
| ai_data_sharing | 0.1.0-draft | [AI 服务与数据共享告知及授权](agreements/documents/ai-data-sharing.draft.md) | 首次相关数据发送前明确确认，可撤回 |
| account_deletion | 0.1.0-draft | [账号注销与数据删除说明](agreements/documents/account-deletion.draft.md) | 注销发起前告知与操作确认 |
| paid_services | 0.1.0-draft | [会员、次数包与自动续费说明](agreements/documents/paid-services.draft.md) | 仅在商品启用时配置购买告知及必要确认 |
| account_verification | 0.1.0-draft | [账户登录、验证码与实名核验告知](agreements/documents/account-verification.draft.md) | 按启用能力告知；可选实名在提交前单独确认 |

以上是产品文件划分，不表示 Apple 要求每一份文件都独立签署。所有草案都缺少正式生效日期；未解决占位项、完成必要审核并接入真实流程前，不得用于宣称用户已授权。

## 实施与交接

- [协议版本、确认与撤回要求](agreements/CONSENT-REQUIREMENTS.md)
- [各板块待改动要求与候选文件](reports/MODULE-CHANGE-REQUIREMENTS.md)
- [五个主要板块的实际代码差距检查](reports/CURRENT-MODULE-GAP-AUDIT.md)：账户、命理、合盘、运势、算事的代码依据、优先级、候选范围和验收条件。
- [后续 iOS 上架检查清单及官方来源](reports/IOS-RELEASE-CHECKLIST.md)
- [待确认信息与发布条件](reports/OPEN-ITEMS.md)
- [同事表格 66 条记录的逐条核对](reports/COLLEAGUE-CLAUSE-RECONCILIATION.md)：来源、适用条件、纠错及经验事项。
- [登录申请所需文件改动](reports/LOGIN-APPLICATION-CHANGE-REQUIREMENTS.md)：微信、QQ、邮件、短信及实名的官方核对、当前代码缺口、候选文件和验收；微信正文及邮件域名页的访问限制已标注。
- [申请材料与交接台账](reports/LOGIN-APPLICATION-MATERIALS.md)：申请、补件、能力开通和接线分别登记，敏感材料与密钥不入库。

## 应用内协议入口

「个人中心 → 设置 → 关于木星环」保留各协议入口。未确定的运营者资料、正式生效日期和付费正文留空。[应用内草案正文](agreements/model/documents.ts)

登录页底部提供协议链接与默认不勾选的确认项，提交登录、注册或进入游客体验时校验当前版本。已登录用户缺少新版本记录时，通过同一登录页重新确认。「实名认证」继续单独打开并确认实名协议。

起草时参照个人信息处理、消费者权益和生成内容标识的公开规定。[个人信息保护法](https://www.cac.gov.cn/2021-08/20/c_1631050028355286.htm) · [消费者权益保护法实施条例](https://app.www.gov.cn/govdata/gov/202403/19/513111/article.html) · [人工智能生成合成内容标识办法](https://www.cac.gov.cn/2025-03/14/c_1743654684782215.htm)

「设置 → 协议与政策」可以查看现行版本和本账号确认记录。「隐私设置 → AI 数据共享授权」分别管理四项模型用途。「账户与安全 → 注销账号」提供重新验证、数据清理和结果回执。上线前仍需核定正式协议、运营联系渠道、备份保留安排和首发商店要求。[确认要求](agreements/CONSENT-REQUIREMENTS.md) · [首发清单](reports/ANDROID-RELEASE-CHECKLIST.md)

「设置 → 隐私设置 → 个人信息权利」提供基础资料查阅、更正和复制，并可另行提交查阅复制或更正申请。仅申请人可查询其回执。使用服务端 `APP_PRIVACY_REVIEWER_IDS` 指定独立的授权运营账号，处理结果须写明，申请人可在页面查看。实际数据交付和人工更正由授权人员按审核流程办理。正式上线前应明确受理渠道、期限、权限、数据交付方式和留存安排。

「消息 → 我的举报」提供本人提交的举报回执及处理结论，授权人员在「举报处理」管理待办。发版前使用真实 Android 候选包核对数据流、个人信息与第三方清单、备案、首发商店要求及 AI 内容标识范围。[社交端行为](../social/README.md) · [APP 备案通知](https://www.miit.gov.cn/zwgk/zcwj/wjfb/tz/art/2023/art_920db564162e4312916a01bed6540ad8.html) · [AI 内容标识办法](https://www.cac.gov.cn/2025-03/14/c_1743654684782215.htm)

## 待提供的发布信息

| 字段 | 值 |
| --- | --- |
| 运营主体法定名称 | |
| 客服及隐私事务联系方式 | |
| 正式协议生效日期 | |
| APP 备案号 | |
| 首发应用商店 | |
| 正式适用年龄与未成年人安排 | |
| 实际第三方服务商及数据保存安排 | |
| 数据备份清理周期、权利请求受理期限 | |

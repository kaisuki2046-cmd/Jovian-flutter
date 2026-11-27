# iOS 上架检查清单

记录日期：2026-11-18。状态：待实施与核验，不是上架通过证明。

初版决定于 2026-11-19 更新为 Android 首发。本清单供后续 iOS 版本使用。首发待确认事项见[待确认信息与发布条件](OPEN-ITEMS.md)。

以下以本次核对的 Apple 官方页面为依据。每次提交前重新核实适用要求及实际构建；Apple 要求不替代首发地区的相关审查。

| 项目 | 待完成的工作 | 当前状态 |
| --- | --- | --- |
| 隐私政策 | 补齐真实主体、联系方式、处理目的、第三方、保存、撤回和删除安排；App 内可发现且有公开网页 | 只有草案，未接线 |
| AI 数据共享 | 在向第三方 AI 发送个人数据前清楚披露接收方及用途，并取得明确许可；无输入栏的模块也逐项核对 | 只有草案与要求 |
| 用户协议与 EULA | 确定服务协议和 Apple 标准或自定义 EULA 的适用关系；付费时核对购买页面披露 | 待确认 |
| 账号注销 | App 内能发起真实删除，不能仅退出或停用；说明关联数据、备份和必要保留项 | 待实现、核验 |
| 第三方登录 | 微信、QQ 如在正式版启用，核对 4.8 及适用例外；确定是否采用 Sign in with Apple 等满足要求的方案 | 当前为本地模拟 |
| 登录申请与原生接线 | 分别确认网站/原生应用、真实权限、SDK 及必要域名关联，原生包验收唤起/回跳；见[申请文件要求](LOGIN-APPLICATION-CHANGE-REQUIREMENTS.md) | 2026-11-19 只登记，未接通 |
| 验证码与可选实名 | 渠道选择、真实投递核验、字段和供应商告知；可选实名单独确认，不成为无关业务门槛 | 本树验证码为本地适配，实名模块未落地 |
| 访客与年龄 | 核对无须登录的能力、访客数据告知、实际目标年龄与 App Store 年龄分级 | 待确认 |
| 隐私申报 | 按实际数据流填写 App Store Connect，涵盖适用的第三方处理；不因手动提供资料就填“无数据” | 待审计 |
| 原生隐私清单 | 核实实际 iOS 构建、所用 SDK 及适用的 required reason API、隐私清单与签名要求 | 尚未核验构建产物 |
| 系统权限 | 只申请实际用到的权限；用途说明与行为一致，不因手动出生地点输入申请实时定位 | 待核验 |
| 付费与社交 | 仅在正式启用时核对内购、订阅、恢复购买、社区安全与用户权利要求 | 延后 |
| 产品真实性与差异化 | 说明实际计算、可验证功能和区别于现有产品的体验；不以“仅供娱乐”替代真实性要求 | 待准备 |
| 审核材料 | 可用的演示账号或演示模式、在线可访问的服务、功能说明、真实第三方服务清单、联系方式 | 待准备 |
| AI 内容与投诉 | 按当前 1.2 和实际 AI 内容功能核对防滥用、举报、及时处理、用户处置与公开联系方式，不只等社交上线 | 只登记，不改审核代码 |
| 商品及失败权益 | 明确次数、追问、失败计次、退款和恢复；测试有效、过期、退款和撤销状态 | 条件适用，未实现 |
| 素材和名称 | 名称可用性、商标、真实 iOS 截图、图标及适用设备规格 | 待准备 |
| 真机及弱网 | 支持设备与系统矩阵、语言回退、冷启动、断网、超时及购买中断 | 待测试 |
| 生产配置 | 移除认证绕过、本地模拟和未披露测试功能；检查必要权限和后台模式 | 待核验原生产物 |
| 地区及商务手续 | APP 备案、主体、许可适用性、银行税务及商品协议分别核实，不等同 Apple 企业注册 | 待确认 |

来源和逐条结论见[同事表格核对记录](COLLEAGUE-CLAUSE-RECONCILIATION.md)。

## 设备、素材与审核资料补充

- 官方截图规格已列出 iPhone Duo：2027 年 4 月起，使用 iOS 27.1 SDK 或更新版本时适用对应截图要求。登记实际构建 SDK、提交日期、内外屏、切换和核心流程测试；提交前复核当时通知及规格。
- 截图展示实际功能，可按规范加说明图层，不能虚构界面或使用真实用户隐私。图标按实际 Xcode、Icon Composer 和对应资源规范制作。
- 准备功能路径、产品定位、商业模式、外部服务、身份权限、地区差异和测试证据。录像根据 App 类型和实际审核要求提供，不认定首次提交一律必交或只有被拒才需要。
- 启用订阅后准备有效、过期等权限状态的演示方法；凭据放受控审核信息渠道，不写入仓库。
- 内部管理可以隐藏，不能用审核专用开关掩盖实际行为。生产认证绕过和本地模拟须排除，合法受控配置不一概删除。
- 三秒或五秒可作内部性能目标，不能当作已核实的 Apple 通用硬性红线。按最低支持机型测试冷启动及交互，不要求所有长耗时 AI 调用瞬间完成。

## 年龄、付费及地区补充

- 按当前问卷、系统与地区确定年龄分级，不能把旧 17+ 当作统一标准；是否只服务成年人仍需产品确认。
- 数字商品、站外支付链接按实际地区及协议判断；首次提交相应类型内购或订阅时按官方流程纳入新 App 版本。
- Apple 交易身份与 App 注册不同；按真实账号依赖设计访客权益、核验、关联和恢复，不能一律以“无法记录购买”为由强制注册。
- 中国大陆服务启用自动续费时，专项核定工信部相关通知中提前五日显著提醒、便捷取消等要求和渠道分工，不能只靠协议宣称已完成。
- APP 备案、Apple 企业账号、邓白氏资料分别办理。许可、AI 相关手续、等保、税务及退款按真实业务核实，不预设统一手续包或税表。
- 小型开发者计划官方适用优惠佣金是 15%，不是表中 12%；其余费率和门槛按地区、商品及实际协议核算，不采用统一 25% 假设。

## 特别交接

Apple 4.3(b) 将 fortune telling 列入已有大量应用的类别，需提供有意义的差异化或改进体验；准备协议不能独立解决这一问题。1.1.6 也不因“仅供娱乐”声明而豁免虚假功能。产品定位、描述、截图和真实功能需一致。

账号删除与注销说明要一起落地，不能只放一段文字。若采用 Sign in with Apple，应核实注销时的凭据撤销。若有 Apple 订阅，说明账号注销不自动取消订阅，并提供适用的管理方式。

## 官方来源

2026-11-19 登录专题阅读的 QQ、阿里云、Apple 域名关联及 Expo 官方来源，及微信访问受限项，单独记录于[申请专题索引](LOGIN-APPLICATION-CHANGE-REQUIREMENTS.md#七官方资料索引与访问状态)。申请完成、代码接通和通过 iOS 审核不是同一状态。

- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)：尤其 1.1.6、4.3(b)、4.8、5.1.1、5.1.2；具体条款以提交时现行版本为准。
- [第三方 AI 数据共享明确许可说明](https://developer.apple.com/news/?id=ey6d8onl)。
- [Offering account deletion in your app](https://developer.apple.com/support/offering-account-deletion-in-your-app/)。
- [App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/)。
- [Third-party SDK requirements](https://developer.apple.com/support/third-party-SDK-requirements/)。
- [Provide information for a complete review](https://developer.apple.com/help/app-review/before-submitting-for-review/complete-review/)。

来源用于内部检查，不整份复制为用户协议；草案文本仍需结合运营主体、首发地区与实际数据处理审核。

补充官方来源：

- [Duo 准备通知](https://developer.apple.com/news/?id=kkphp5qo)、[截图规格](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)。
- [年龄分级](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/)、[小型开发者计划](https://developer.apple.com/app-store/small-business-program/)。
- [首次内购提交](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-in-app-purchase)。
- [工信部 APP 备案通知](https://www.miit.gov.cn/zwgk/zcwj/wjfb/tz/art/2023/art_920db564162e4312916a01bed6540ad8.html)、[移动互联网应用服务能力通知](https://gxca.miit.gov.cn/zwgk/zcwj/wjfb/art/2023/art_5b35a11c28244fb0813378b1e6686dfe.html)。

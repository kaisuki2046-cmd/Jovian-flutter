# Android 首发验收清单

首发计划为中国大陆 Android，首家应用商店待定。下表列中国大陆发布的核对项。iOS 另见[后续 iOS 清单](IOS-RELEASE-CHECKLIST.md)。

## 先核对发行渠道与业务分类

涉及命理、周期运势、合盘、塔罗和六爻等实际功能，应提供真实界面、示例输入输出和拟上架分类，向拟选渠道核对可受理范围。以华为应用市场为例，审核指南第 4.11 条限制含有或传播封建迷信的内容。是否能受理本产品及哪些功能可随首发包提供，需要按拟发布内容确认。若必须调整，应改实际功能、可用路径和申报材料，再用同一发布构建复验。 [华为应用市场审核指南](https://developer.huawei.com/consumer/cn/doc/doccenter-submission/50104/)

## 提审前交付与证据

| 事项 | 当前依据 | 完成条件与证据 |
| --- | --- | --- |
| 主体与应用身份 | 本地 APK 使用测试包名 `com.jovian.preview`。正式应用身份待核定，Android 构建配置见 [app.json](../../../../app.json) | 核定运营主体、正式名称、包名、图标、版本号、商店、最低和目标系统版本。归档最终签名的构建产物、包信息、公开签名证书指纹及签名核验结果。若商店签名与上传签名不同，以用户收到的包登记平台指纹 |
| APP 备案及业务资质 | 尚无正式备案号或已选渠道的资质结论 | 大陆境内提供互联网信息服务时，核实 APP 备案及相关资质，核对主体、正式包名和实际签名。完成后按要求在 APP 显著位置展示编号并链接备案查询 |
| 首次运行与系统权限 | 协议草案已有。首发包的启动时序和最终清单仍需验收 | 用清空数据后的正式候选包分别走同意、拒绝和再次打开。留存 UI 及网络/权限记录。可选权限只在用户发起对应操作时申请，拒绝后仍可用的功能按实际保留 |
| 公开协议、用户权利与反馈 | 本地包已有[应用内协议入口](../README.md#应用内协议入口)，正式文字和[版本确认要求](../agreements/CONSENT-REQUIREMENTS.md)待核定及接线 | 确认主体、隐私联系地址、存储地区和期限。部署可直接打开的 HTTPS 协议页面，核对 App 内入口、政策版本和实际行为。用隔离账户走一次权利请求和注销，验证会话失效、关联数据清理、必要保留和结果通知 |
| 第三方 SDK 与服务 | 源码含 Expo 组件、AI 请求和本机虚拟身份适配。正式接收方需以构建及部署为准 | 对照依赖、合并后的 Android Manifest、SDK 初始化顺序和实际数据流。按实际启用能力披露运营方、用途、字段、权限、触发时机、政策、保留及处理地区。未启用的服务登记为待接入 |
| 生成式 AI | 算事的问题理解也可能先于报告请求调用模型。命理、运势、合盘另有云端解读 | 逐流程验证数据最小化、必要授权及撤回拦截。结合大陆公众服务、实际模型及使用方式核对备案/登记、生成内容标识、投诉和内容保护适用性。用真实生成内容和分享/导出路径验证适用标识 |
| 生产登录与审核演示 | 仅当回环服务启用虚拟供应商时展示有标记的模拟入口 | 按首发实际启用方式验收。需申请的 Android 社交登录见[微信与 QQ 申请包](SOCIAL-LOGIN-REVIEW-PACKET.md)。候选包用正式 HTTPS 服务，在真机验证成功、拒绝、取消、失效和未安装客户端情形。审核账号如需提供，通过商店受控字段交付 |
| 截图、简介与启用能力 | 当前测试包可用于内部取景 | 由最终候选包重新取图，覆盖首屏隐私告知、登录、核心流程、隐私入口和权利请求。应用名、图标、介绍、AI 与其他能力披露应与候选包一致。启用付费、推荐、广告或社交时补对应验收 |

## 本地候选包复核

1. 从发布负责人提供的 APK 读取实际 `applicationId`、`versionName`、`versionCode`、最低和目标 SDK，可使用 Android SDK 的 `aapt2 dump badging`。用 `apksigner verify --verbose --print-certs` 检查签名和证书指纹。若渠道收 AAB，再核验实际安装包签名。
2. 在裸机或清洁 Android 环境安装候选包。记录构建、系统、日期、测试场景和脱敏证据位置。产物不得含预览包名、本机测试证书、`localhost`、`127.0.0.1`、`10.0.2.2` 或虚拟供应商的生产接线。
3. 以相同版本核对 Android 包、后台配置、商店申报、备案、登录平台资料和公开协议。更新名称、包名、签名、隐私正文或数据接收方时重新核对相关材料。

### 已核对的内部 APK

2026-11-22 从 `Jovian-Preview-0.1.1.apk` 读取到 `com.jovian.preview`、`versionCode 2`、最低 API 24、目标 API 36、ARM64 和 x86_64。测试证书的 v2/v3 签名校验均通过。APK 的 SHA-256 为 `213630b006568c97c6b8d55957afa3aa68253d82a5790d6ce9f4f5f6fb204f0d`，仅用于确认复核的是同一测试包。

用对应版本的 Manifest 合并报告逐项追踪后，实际裁减和验证可以按下表执行。

| 声明 | 合并来源 | 发布验收 |
| --- | --- | --- |
| `SYSTEM_ALERT_WINDOW` | Expo 生成的 App 主清单 | 源码未发现悬浮窗使用点。移除后对比最终 Manifest，复验普通启动及登录弹层 |
| `USE_BIOMETRIC`、`USE_FINGERPRINT` | `androidx.biometric:biometric:1.1.0` 的依赖清单 | 当前账户会话使用 SecureStore 且未要求生物识别。移除后复验新会话、重启续用和退出。以后启用生物登录前重新核对 |
| `READ_EXTERNAL_STORAGE`、`WRITE_EXTERNAL_STORAGE` | App 主清单及 Expo FileSystem、ImagePicker 依赖，`maxSdkVersion=32` | 当前头像、封面和附件经用户主动选择。裁减后在最低支持 API 和 API 32 复验选择、取消、裁剪和私有目录保存 |
| 网络明文例外 | 打包的 `jovian_preview_network` 只对 `10.0.2.2` 开放 HTTP | 正式候选包移除本机例外，用 HTTPS 复验已启用后端的请求和错误表现 |

另核对到该包的 `allowBackup=true`。其中两套资源规则仅纳入普通 SharedPreferences，排除 SecureStore。Android 12+ 的云备份及设备迁移分别带有这组规则。发布前按实际构建和备用恢复测试确定哪些本机数据可迁移，尤其检查已退出或注销后的会话和算事恢复凭证。 [Expo 权限配置](https://docs.expo.dev/versions/latest/config/app/#blockedpermissions) · [Android 系统照片选择器](https://developer.android.com/training/data-storage/shared/photo-picker) · [Android 备份规则](https://developer.android.com/identity/data/autobackup?hl=zh-cn)

### 0.1.2 权限裁减结果

测试包 `Jovian-Preview-0.1.2.apk` 使用同一测试证书，包名为 `com.jovian.preview`，`versionCode` 为 `3`，APK SHA-256 为 `13a0be0b884ac698f15c7711be5d0f9362c3a4d0bff5415e3cb94482d53a0018`。最终 Manifest 对比确认移除了 `SYSTEM_ALERT_WINDOW`、`USE_BIOMETRIC` 和 `USE_FINGERPRINT` 三项权限。v2/v3 签名和 16 KB 对齐校验通过。旧存储权限按表中步骤另行评估和测试。

在隔离的 Android 34 环境安装本包，实测了登录前查看两份协议、无虚拟供应商时隐藏第三方入口、启用后微信模拟登录、强制关闭 App 后恢复会话、打开个人中心的隐私入口和安全退出。浏览器另验证了 QQ 模拟登录及刷新后恢复会话。测试使用独立账户数据库。

## 官方依据

- 大陆 APP 备案、编号展示和查询要求。 [工信部 APP 备案通知](https://www.miit.gov.cn/zwgk/zcwj/wjfb/tz/art/2023/art_920db564162e4312916a01bed6540ad8.html)
- 首次运行提示、收集同意及用户的删除、注销和撤回路径。 [App 个人信息行为认定方法](https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/rzjgs/art/2023/art_71e1f20c15e848428b218b88a4407ed4.html) · [网络数据安全管理条例](https://xzfg.moj.gov.cn/mobile/law/detail?LawID=1734)
- Android 发布签名及分发签名区分。 [Android 官方应用签名指南](https://developer.android.com/studio/publish/app-signing)
- 生成式 AI 公众服务范围及标识的适用条件。 [生成式人工智能服务管理暂行办法](https://www.cac.gov.cn/2023-07/13/c_1690898327029107.htm) · [人工智能生成合成内容标识办法](https://www.cac.gov.cn/2025-03/14/c_1743654684782215.htm)

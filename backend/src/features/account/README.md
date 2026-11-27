# 用户信息

- **职责**：管理账号、用户资料和钱包。通过公开接口按当前用户提供读写，负责权限、记录归属和存储。
- **可能输入**：当前会话、资料更新和钱包请求。
- **预期产出**：调用方获准读取的用户字段，以及账户和钱包操作的结果。

| 子目录 | 职责 |
| --- | --- |
| [`auth/`](auth/) | 登录、注册和会话 |
| [`profile/`](profile/) | 基础个人资料 |
| [`reading-profile/`](reading-profile/) | 出生日期、时间和地点等占卜资料 |
| [`wallet/`](wallet/) | 充值、余额和订单 |
| [`history/`](history/) | 会员与游客的命理解读归档、最近报告与历史详情 |
| [`settings/`](settings/) | 本机外观、界面语言、头像、封面、签名和标签 |
| [`storage/`](storage/) | 用户信息的数据库适配 |
| [`server/`](server/) | 账户服务入口、HTTP 路由和请求处理 |

[`server/index.mjs`](server/index.mjs) 装配账户存储、认证服务商和 HTTP 处理器。[`server/handler.mjs`](server/handler.mjs) 负责路由、请求解析、Cookie 和响应，并将业务操作交给各子功能的控制层。

账户首页和多个子功能共用的业务组件在 `view/`，账户级入口状态和导航在 `control/`，栏目定义在 `model/`。认证、基础资料和出生资料各自在子目录内分层。控制层处理请求、表单校验、状态和保存流程，视图调用控制层并渲染结果，模型存放数据类型与校验，持久化由 `storage/` 提供。

## 请求目录

账户公开请求随功能维护，分别放在 [`auth/requests/`](auth/requests/)、[`profile/requests/`](profile/requests/)、[`reading-profile/requests/`](reading-profile/requests/) 和 [`wallet/requests/`](wallet/requests/)。`storage/` 负责账户内部的持久化适配。

## 对外入口与交付

各业务板块通过账户公开入口读取当前用户的出生资料和已归档命盘。 [跨板块接口](reading-profile/README.md#跨板块读取) · [命盘快照](history/README.md#读取完整命盘)

应用接入只从 [`index.ts`](index.ts) 导入页面、AccountSessionProvider 和 useAccountSession。[`view/section-screen.tsx`](view/section-screen.tsx) 负责账户页面分发，路由目录只传入 section。账户内部 requests/、数据库、认证处理器不是其他业务模块的直接导入入口。其他模块需要资料时先约定用途、字段和权限，再由账户提供方明确开放接口。

账户回归测试位于 server/ 的 `*.test.mjs`，从仓库根运行 `npm run test:account`。临时控件及后续共建事项见 [UI 待办](UI-REQUESTS.md)。页面布局留在账户 view，业务流程与状态协调归 control，数据归 model；通用组件和样式在 src/ui 由大家共同维护。

个人中心提供账户资料、安全、钱包、偏好设置和关于页面。头像、封面、签名和标签保存在本机，按会员或游客身份读取。外观和界面语言保存在当前设备，由 `bootstrap/AppProviders` 装配 `PreferencesProvider`。我的报告使用现有归档接口，按身份查看命理、运势与合盘报告。登录页使用现有邮箱、手机号、游客和已配置的虚拟登录服务。

“重置 AI 测算记录”通过算事公开的 `resetDivinationConversation()` 清空当前设备的本次对话、草稿和未完成测算恢复记录。确认框明确保留已保存报告、命理档案、钱包及账户信息；取消不执行清空，失败时支持重试。不会用 HTML 演示账户或昵称覆盖真实会话数据。

账户负责人默认提交 src/features/account/ 及本任务相关 src/ui 文件；其他业务、路由、shared 或根配置改动须先询问用户并获得明确授权。独立负责账户子目录时边界相应缩小。现有 check:scope 只支持单目录，业务/UI 混合交付按根协作协议人工审查路径。

> **跨板块协作**　其他板块的代码可以阅读和参考，可通过对方明确开放的入口或公共 UI 复用能力。需要修改认领范围外的文件时，包括其他板块的代码、业务页面和说明文档，须先向用户说明具体文件、原因和影响，取得明确授权后再修改。

## 协作约束 v1.2

本目录归 `src/features/account/` 管理；默认只改认领范围及本任务相关的 `src/ui/`。业务模块之间不能相互改文件，修改其他目录前 Codex 必须先向用户询问具体范围和影响，获得明确授权后再做。独立认领更小子目录时按更小范围执行。

业务目标采用 `model/`（数据）、`view/`（具体 UI）、`control/`（功能），现有文件按后续任务渐进整理，不表示已迁移。业务请求仍留在本模块 requests；公共 UI 只接收数据、状态和回调。

按 MVP 验收逐步迭代。公共 UI 的破坏性接口或全局风格变更先向用户确认；提交只包含本轮范围，保留并行改动，结束时列出实际目录、共享组件影响和验证。详细规则见 [本目录开工说明](AGENTS.md)、[协作协议](../../../COLLABORATION.md) 与 [框架图](../../../FRAMEWORK.md)。

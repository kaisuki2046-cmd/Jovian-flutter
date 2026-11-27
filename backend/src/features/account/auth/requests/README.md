# 登录与会话请求

登录、注册提交和游客会话创建必须携带 `acceptance`，包括 `agreed: true` 和经 `GET /account/agreements/catalog` 取得的现行隐私政策、用户服务协议的 `id`、`version`、`hash`。未勾选返回 428，版本或哈希失效返回 412。服务端在验证身份成功后写入确认记录。

账户公开资料中的 `uid` 为 8 位数字字符串。内部 `id` 继续用于会话、归档和关系归属。

本目录维护邮箱或手机号登录、注册、会话、验证码、绑定/换绑与密码恢复的请求定义、参数校验和调用封装。registration.ts 请求注册邮箱验证码，session.ts 提交注册证明或微信、QQ 的授权码。提供商适配与授权交换由账户服务端负责。跨模块的对外入口须经账户 index.ts 明确开放。

`GET /account/auth/capabilities` 返回 `emailRegistrationCodeRequired`、`phoneRegistrationWithoutCode`、`emailRegistrationAvailable` 和 `phoneCodesAvailable`。后两项用于控制正式渠道的入口。`POST /account/auth/register` 接受邮箱或手机号之一，以及昵称、密码和协议确认。邮箱按服务能力提交验证码证明，手机号仅在免码能力开启时可用。正式的手机号注册继续通过短信登录验证，未绑定号码验证后创建账号。

## 实名认证

`GET /account/auth/identity-verification` 读取当前登录账号的实名认证状态。未登录及游客请求返回 `401`，会员当前收到 `{ "status": "not_enabled" }`。

`POST /account/auth/identity-verification` 预留提交路径。当前页面发送空对象，服务端返回 HTTP `503` 和 `IDENTITY_VERIFICATION_NOT_ENABLED`，页面提示「实名认证服务暂未接入」。姓名、证件号和勾选状态只保留在当前页面，提交时清除姓名和证件号，离开时清除表单。正式接入后由账户服务端调用二要素核验供应商。

> **跨板块协作**　其他板块的代码可以阅读和参考，可通过对方明确开放的入口或公共 UI 复用能力。需要修改认领范围外的文件时，包括其他板块的代码、业务页面和说明文档，须先向用户说明具体文件、原因和影响，取得明确授权后再修改。

## 协作约束 v1.2

本目录归 `src/features/account/auth/` 管理；默认只改认领范围及本任务相关的 `src/ui/`。业务模块之间不能相互改文件，修改其他目录前 Codex 必须先向用户询问具体范围和影响，获得明确授权后再做。独立认领更小子目录时按更小范围执行。

业务目标采用 `model/`（数据）、`view/`（具体 UI）、`control/`（功能），现有文件按后续任务渐进整理，不表示已迁移。业务请求仍留在本模块 requests；公共 UI 只接收数据、状态和回调。 本目录是模块数据访问适配，由 control 协调调用；view 不直接发请求，返回数据结构由所属 model 约定。现有请求路径保持兼容。

按 MVP 验收逐步迭代。公共 UI 的破坏性接口或全局风格变更先向用户确认；提交只包含本轮范围，保留并行改动，结束时列出实际目录、共享组件影响和验证。详细规则见 [本目录开工说明](../AGENTS.md)、[协作协议](../../../../../COLLABORATION.md) 与 [框架图](../../../../../FRAMEWORK.md)。

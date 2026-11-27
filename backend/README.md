# Node 后端与 TypeScript 计算

本目录的业务实现与数据来自原 Jovian 的 `3440dd04`。复制范围为 `src/features/`、`src/shared/` 和重建算事角色资源需要的 `src/ui/ai-assistant/`，Flutter 拥有独立的页面与入口。后端运行的依赖以本目录的 npm 锁文件为准。算事服务在此快照应用了[提前翻牌接口补丁](../tool/patches/divination-tarot-first.patch)。

从仓库根目录启动 [Start-web.cmd](../Start-web.cmd)。只检查服务时使用 `Start-web.cmd -CheckServices`。服务默认监听回环地址，账户、算事、命理、运势、合盘与 Flutter 预览的地址由启动器统一装配。

本地预览可用 (邮箱或手机号)注册或以游客体验。内置的 [虚拟认证适配器](dev-auth/provider.mjs) 只在回环开发环境启用，模拟微信、QQ 与验证码，收件箱是 `dev-auth/inbox/`。在生产环境启用正式渠道时按账户 API 的[服务配置](src/features/account/auth/README.md)设置邮件、短信与登录凭据。

复制 [.env.example](.env.example) 为 `.env` 后可填写 DeepSeek 配置。自定义适配器或密钥文件的相对路径以本目录为基准。账户和业务 SQLite、验证码收件箱以及本机凭据由当前环境单独保存。

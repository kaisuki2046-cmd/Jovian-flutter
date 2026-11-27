# 模块装配

本目录用于装配运行环境、服务和模块依赖。页面路由在 [src/app](../app)，业务 API 客户端由本目录创建并注入 Flutter 页面。

[Start-web.cmd](../../Start-web.cmd) 从仓库根目录运行各业务的 Node 入口，并把实际服务端口写入 Flutter 的启动参数。账户、算事、命理、运势和合盘分别维护自己的服务与数据。算事会话默认写入本仓库的 `.local/divination.sqlite`。

在根目录复制 [.env.example](../../.env.example) 为 `.env` 后可配置 DeepSeek。开发预览的虚拟认证适配器位于 [账户模块](../features/account/server/dev-auth/provider.mjs)，验证码写入同目录下的 `inbox/`。正式渠道配置见[账户身份说明](../features/account/auth/README.md)。

Node 服务、计算源码与数据最初取自原 Jovian 的 `3440dd04`。算事沿用已纳入本仓库的[提前翻牌接口](../../tool/patches/divination-tarot-first.patch)。

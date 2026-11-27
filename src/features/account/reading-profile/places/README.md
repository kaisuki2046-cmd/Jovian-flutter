# 出生地点选项

`china.json` 来自 [Administrative-divisions-of-China 的省市区数据](https://github.com/modood/Administrative-divisions-of-China/blob/c49d495b40ac73eb1a66f6eeae5f8fd10696f035/dist/pca.json)，按该项目的 [WTFPL v2 许可](LICENSE) 随 app 提供。数据涵盖中国大陆省市区，依据该项目收录的 2023 年行政区划快照。境外城市、历史地名和其他已有文本可通过手动填写保留。

> **跨板块协作**　其他板块的代码可以阅读和参考，可通过对方明确开放的入口或公共 UI 复用能力。需要修改认领范围外的文件时，包括其他板块的代码、业务页面和说明文档，须先向用户说明具体文件、原因和影响，取得明确授权后再修改。

## 协作约束 v1.2

本目录归 `src/features/account/reading-profile/` 管理；默认只改认领范围及本任务相关的 `src/ui/`。业务模块之间不能相互改文件，修改其他目录前 Codex 必须先向用户询问具体范围和影响，获得明确授权后再做。独立认领更小子目录时按更小范围执行。

业务目标采用 `model/`（数据）、`view/`（具体 UI）、`control/`（功能），现有文件按后续任务渐进整理，不表示已迁移。业务请求仍留在本模块 requests；公共 UI 只接收数据、状态和回调。

按 MVP 验收逐步迭代。公共 UI 的破坏性接口或全局风格变更先向用户确认；提交只包含本轮范围，保留并行改动，结束时列出实际目录、共享组件影响和验证。详细规则见 [本目录开工说明](../AGENTS.md)、[协作协议](../../../../../COLLABORATION.md) 与 [框架图](../../../../../FRAMEWORK.md)。

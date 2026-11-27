
# 算事服务

使用 Node 22.13 或更新版本。启动后从浏览器以账户或访客进入 app 的「算事」页。

```powershell
node src/features/divination/server/index.mjs
# 另一个终端
npm run web -- --port 8114
```

算事服务可复用本机的 DeepSeek 密钥。启动前设置服务端环境变量 `DEEPSEEK_API_KEY`，或将 `DEEPSEEK_API_KEY_FILE` 指向仓库外只存一行密钥的文件。默认模型是 `deepseek-flash`，可用 `DIVINATION_DEEPSEEK_MODEL` 覆盖。已有的模块专用 `DIVINATION_OPENAI_API_KEY` 仍优先选择 OpenAI，可用 `DIVINATION_OPENAI_MODEL` 指定模型。未配置密钥时使用本地规则解读。密钥仅供服务端使用。

通过 `Start-app.cmd` 在 8081 端口打开网页版时，另开一个 PowerShell 终端启动算事服务：

```powershell
$env:DEEPSEEK_API_KEY_FILE = Read-Host "输入已有 DeepSeek 密钥文件的完整路径"
$env:DIVINATION_REPORT_WEB_ORIGIN = 'http://localhost:8081,http://127.0.0.1:8081'
node src/features/divination/server/index.mjs
```

旧规则任务仍能读取已保存的报告，未解读的旧规则任务使用本地规则。

新版客户端向 `/reading/understand` 传入 `requireModel: true`，调用 DeepSeek Flash Chat Completions。创建任务传入 `profile: 'three-methods-v1'` 和解析响应里的 `proof`。新仪式先调用 `/toss` 六次，再调用 `/pick` 三次。两类事件提交 `actionId` 和 `step`，选牌还提交 `slot`、`epochMs`、`monotonicMs` 和 `clockSessionId`。同一事件原样重发返回原快照，换参数返回 409。

新版 `/reading/report` 调用 DeepSeek Pro，发送原始盘面并读取 [Pro 提示词](../docs/DeepSeek-Pro-Prompt.md)。服务器保存三段结构化解读，界面按塔罗、梅花易数、六爻排序，对每段中标记的短语应用粗体。各段保留基于对应盘面的判断和分歧。当前提示词版本的报告直接从 SQLite 读取，失败重试或提示词更新后可在同一盘面生成报告。

## API

| 接口 | 操作 |
| --- | --- |
| `POST /reading/understand` | `{ question }`，返回 `{ focus, clarification, source }` |
| `POST /reading` | `{ question, focus, method }`；`method` 是 `combined`、`tarot`、`liuyao` 或 `meihua`。返回 `{ token, task }` |
| `GET /reading` | 恢复快照 |
| `POST /reading/shuffle` | `{}`；塔罗洗牌 |
| `POST /reading/cut` | `{ point }`；塔罗从 19、39、59 选切点 |
| `POST /reading/pick` | `{ step, slot }`；塔罗三次选择，序号从 0 开始 |
| `POST /reading/toss` | `{ step }`；六爻投掷六次，序号从 0 开始 |
| `POST /reading/numbers` | `{ numbers: [a, b, c] }`；梅花三个 1–999 的整数 |
| `POST /reading/report` | `{}`；读取或生成本次已固定结果的报告 |
| `POST /reading/follow-up` | `{ step, question }`；最多八次，序号从 0 开始 |

除理解和创建外，使用 `Authorization: Bearer <task token>`。操作按术法和阶段校验；重复发送同一步和相同参数不会重抽重投，冲突返回 409 并可重新读快照。创建时签发随机任务令牌，SQLite 只保存摘要，任务有效期 24 小时。客户端和服务器一起更新到 `/reading`；之前未提交的 `/tarot` HTTP 路径由新接口替代。服务仍能读旧塔罗任务表，保留牌阵和追问原文，旧解读用原有资料重新按规则组装。`/task` 对应的旧组合原型未接入当前服务。

综合任务的阶段为 `shuffle → cut → draw → cast → reading`。第三次选牌后返回已选的三张牌，依次完成六次投掷。第六次投掷后，快照中的 `draw` 是塔罗结果，`results.liuyao` 是六爻结果，`results.meihua` 是梅花结果，`results.meihuaInputSource` 记录来源为 `liuyao-first-three-lines`。三套规则版本通过 `calculationRules` 返回，`evidence` 保存本次对应的七项依据。该任务不接受 `/reading/numbers`。模型成功的报告包括 `source: 'model'`、`promptVersion` 和每段引用的 `sections`，规则报告为 `source: 'local'`。

## 规则和来源

- 塔罗：服务器使用系统随机源洗牌并为候选牌独立分配朝向，规则版本 `rws-three-card-v1`。牌义按牌 ID、朝向、位置从 SQLite 检索。Jovian 整理的牌义参考 [The Pictorial Key to the Tarot 第三部分](https://en.wikisource.org/wiki/The_Pictorial_Key_to_the_Tarot/Part_3)，三个牌位由 Jovian 定义。
- 六爻：`three-coin-v1`。每次投掷三枚钱，字面记 2、背面记 3；和为 6、9 的爻动，六次依序从初爻到上爻。排盘参考《增删卜易》的[占卦法](https://zh.wikisource.org/wiki/增刪卜易/2)和[八宫图](https://zh.wikisource.org/wiki/增刪卜易/3)。本版不按月建、日辰和用神断卦。
- 梅花：综合流程用 `first-three-liuyao-lines-v1`，以初爻、二爻、三爻的值（6、7、8 或 9）作为下述三数算法的输入。独立入口的 `three-number-v1` 是 Jovian 明确定义的报数法。第一、第二个数分别除 8 取余作为上、下卦，余 0 取 8；三数之和除 6 取余作为动爻，余 0 取 6。乾、坤纯卦用变卦排互卦，其余用本卦中间四爻。参考 [《梅花易数》卷一](https://zh.wikisource.org/wiki/梅花易數/卷一) 的取余、先天卦数和互卦规则；本版不代入时辰。
- 快照记录规则版本、完成的 UTC 时间与本次证据条目。证据带 ID、资料版本、说明和参考链接。首次报告和追问用同一 schema；每个报告的 `evidenceIds` 必须来自本次资料。追问规则区分依据、时间和一般下一步，可接续最近一条建议，属于有限的上下文问答。

## 配置与验收

- `DIVINATION_REPORT_BIND` 默认 `127.0.0.1`，`DIVINATION_REPORT_PORT` 默认 `8115`。自定义 Web 端口需同步设置 `DIVINATION_REPORT_WEB_ORIGIN`。`DIVINATION_REPORT_HOSTS` 和 `DIVINATION_REPORT_WEB_ORIGIN` 均为逗号分隔的允许列表。真机需显式配置可访问的 `EXPO_PUBLIC_DIVINATION_REPORT_URL`，该变量只放 URL。
- `DIVINATION_REPORT_DB` 可指定 SQLite 路径，默认在系统临时目录。任务中含问题、追问和计算原始记录，限制数据库访问权限。服务不在日志输出密钥、令牌或问题；错误响应只返回错误码，响应禁止缓存。服务限制请求体大小、创建频率和追问次数。公开部署前需接入 HTTPS、账户鉴权、网关配额及明确的数据保留策略。
- 自动检查：`npm run typecheck`、`npm run check:boundaries`、`npm test -- src/features/divination`。现行 HTTP 测试覆盖独立任务及综合任务、非法输入、重复请求、报告来源与恢复。综合任务另覆盖相同前三爻及不同后三爻的梅花结果、模型并发去重、超时、伪造证据或牌卦名和重启后的回退。浏览器验收可输入含糊问题再补充，完成三张塔罗和六次投掷，查看依据并追问，在投掷中途和报告完成后刷新。

> **跨板块协作**　其他板块的代码可以阅读和参考，可通过对方明确开放的入口或公共 UI 复用能力。需要修改认领范围外的文件时，包括其他板块的代码、业务页面和说明文档，须先向用户说明具体文件、原因和影响，取得明确授权后再修改。

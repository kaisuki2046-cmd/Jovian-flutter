# 命理报告服务

Node 22.13 或更新版本。Windows 的 `Start-app.cmd` 会在本机启动报告服务，默认使用 `deepseek-v4-pro`，并在未显式配置密钥时查找 `E:\deepseek\deepseek api.txt`。已有 `EXPO_PUBLIC_DESTINY_API_BASE_URL` 时，启动器使用指定的报告服务地址。单独启动服务时，将一行密钥保存在仓库外的文件中，从仓库根目录运行以下命令。也可以由部署环境直接提供 `DEEPSEEK_API_KEY`，服务优先读取该变量。

启动器同时管理 Expo Web（8081）和账户 API（8787）。本机报告 API 优先使用 8788，该端口已占用时使用 8790。前端自动接收启动器选定的报告地址。

```powershell
$env:DEEPSEEK_API_KEY_FILE = 'C:/path/outside/repository/deepseek.key'
$env:DESTINY_DEEPSEEK_MODEL = 'deepseek-v4-pro'
node --experimental-strip-types src/features/destiny/server/index.mjs
```

在 Expo 所用的另一个终端运行。

```powershell
$env:EXPO_PUBLIC_DESTINY_API_BASE_URL = 'http://127.0.0.1:8788'
npm.cmd run web
```

服务默认监听回环地址，供本机开发使用。测试设备通过受信任的内部 HTTPS 网关接入，网关负责鉴权和部署侧限流。Web 使用其他来源时，在服务端用 `DESTINY_ALLOWED_ORIGINS` 设置逗号分隔的精确来源。

服务端在本地用盘面事实匹配并排序，每个主题最多选 40 条解读。调用 DeepSeek 时，入选条目使用「原文：」「现代解读：」和「命中条件：」，条件只描述该条实际通过的规则组。大运条目标明适用阶段。命例和铁板条文使用简短的对照条件说明。整盘事实、原资料使用边界、具体运限、查表结果及铁板查号过程由本地保留。模型按综合、事业、爱情、学业、财富各写一节，结合命中条件理解每条原文，在已有解读的范围内做一步联想或逻辑推演。资料较少的主题简短说明。

## 文件索引

| 文件 | 职责 |
| --- | --- |
| [`index.mjs`](index.mjs) | 启动报告服务，读取服务端配置，接收 `POST /destiny/report`，处理请求大小、来源、并发和超时。 |
| [`report.mjs`](report.mjs) | 校验请求，组织五主题的双层命中，维护系统 Prompt、调用模型并返回正文。 |
| [`corpus.mjs`](corpus.mjs) | 提供报告主题索引，并保留旧版通用知识语料。 |
| [`retrieval.mjs`](retrieval.mjs) 和 [`bge_service.py`](bge_service.py) | 保留旧版通用语料的关键词检索和嵌入工具。 |
| [`chart-facts-text.mjs`](chart-facts-text.mjs) | 将三种盘面及命中条件转换为自然中文，保留位置、关系、数量、岁数与已确认的缺失条件。 |
| [`report-materials.mjs`](report-materials.mjs) | 将已命中的书籍材料和条件转为精简中文文本，不发送内部索引和整包盘面。 |
| [`report.test.mjs`](report.test.mjs) | 验证全部命中、单次调用、正文原样返回和模型请求的数据边界。 |
| [`knowledge/`](knowledge/README.md) | 新旧资料合并的 SQLite 知识库，共 21,941 条，按结构化条件检索，JSON 保留为审查与重建资料源。 |
| [`natural-expression/`](natural-expression/README.md) | 固定中文风格规则、原创示例与本地文风检查。 |

## 报告主题与依据

报告服务首次收到带有效盘面事实的请求时，构建或更新统一 `destiny-knowledge.sqlite`。统一 JSON 的已启用规则、铁板选择器和数字 ID 在同一事务中导入。运行时在同一快照内查询并复核排盘口径、时间层、排除、关系和范围。没有可用解读时返回 `report: null`，已有的铁板计算结果随响应返回。见 [命理解读数据库](knowledge/README.md) 和 [八字计算说明](../BAZI_CALCULATION_LAYER.md)。


随后把自然表达规则加到同一次模型请求。默认只注入规则，可通过 `DESTINY_NATURAL_EXPRESSION=examples` 附带示例，或用 `off` 关闭对照。见 [自然表达库](natural-expression/README.md)。

HTTP 响应的 `report` 字段原样承载模型返回的正文。连接错误或上游失败通过 HTTP 错误返回。账户归档仍按账户服务的数据契约处理。

本命八字具备可用四柱和性别时，HTTP 响应附带 `tieban`，记录太玄算法版本、条文库版本及先天和后天编号的查询结果。已收录且适用的条文带 `claimId`。未收录的编号返回 `status: "unmatched"` 和 `reason: "not_in_catalog"`。相关原文按主题提供给报告作为起数参考。见 [铁板编号查询说明](knowledge/TIEBAN_INTEGRATION_RESEARCH.md#太玄基数接入)。

> **跨板块协作**　其他板块的代码可以阅读和参考，可通过对方明确开放的入口或公共 UI 复用能力。需要修改认领范围外的文件时，包括其他板块的代码、业务页面和说明文档，须先向用户说明具体文件、原因和影响，取得明确授权后再修改。

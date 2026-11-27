# 合盘

合盘负责比较两人的命盘并呈现结果。访客可从底栏进入合盘，手动填写双方资料。会员还可读取本人归档作为 A 方。手动填写 B 方前需要确认本次使用授权，撤回确认会清除页面内 B 方盘面及本次比较。在线解读须有有效的访客或会员会话，并已授权合盘 AI 数据共享。原始双人盘面仅在页面会话内保留；四类关系解读生成后通过账户公开接口自动存档，不归档 B 方出生资料或原始盘面。

重新进入合盘时直接读取当前会话身份最近保存的解读，可通过「查看已存解读」选择历史结果。访客报告只在当前游客会话内可读，结束游客体验或会话过期后不可访问。读取存档不调用模型。同一组页面内盘面的重复比较优先回读对应存档；另一次合盘仍需重新确认并填写双方资料。存档失败会保留本次正文并提供「重试存档」。

## 首版目标

本人盘面通过账户公开接口读取。手动 B 方使用命理模块的录入和纯排盘能力，生成一份仅用于本次比较的盘面。本期双方必须提供出生时间；旧档案或手动计算结果缺少明确时刻时，页面会提示补齐后重新排盘。邀请模式需服务端确认两个账户的成员身份、盘面授权及版本后再接入。

| 体系 | 可用于解读的盘面 | 依赖与边界 |
| --- | --- | --- |
| 八字 | 双向日干生克、四柱天干五合与冲、地支六合冲刑害破、三合半合三会三刑、跨盘透干与藏干十神、本命神煞同支对照、月支本气与日干关系、同五行通根及比印透干 | 组合带双方柱位，也区分单盘已有组合和双方才凑齐的组合。强弱条件供知识筛选，身强身弱、用神、合化和格局仍需独立口径 |
| 紫微 | 命宫、身宫和本命四化同支对照，双向十二宫三方四正，可按两侧宫位与主辅星筛选 | 宫干飞化已有匹配逻辑，需上游提供宫干和所用四化表才会生成；缺项时继续提供其他事实。运限待接 |
| 西占 | 双向行星落宫和跨盘相位、行星对 ASC/DSC/MC/IC、轴点对轴点、12 宫宫主星跨盘落宫及与行星/宫主星相位 | 传统守护星，整宫制从上升所在星座定宫。天顶和天底保留实际度数。组合盘及入相出相待接 |

相位试用容许度为合相 6°、六合相 4°、四分相 5°、三分相 5°、对分相 6°，沿用本地备份已有口径。角距走最短弧并包含容许度边界。双方配置不一致时，相关体系标为不可用。

干支术语参考《三命通会》卷二。紫微按地支同位、顺逆四支和对宫组织跨盘参照，宫干飞化先在各自原盘定位星曜，再按落点地支对照对方宫位。西占宫主星使用传统守护表，天蝎、水瓶和双鱼分别由火星、土星和木星守护。[三命通会卷二](https://zh.wikisource.org/zh-hant/%E4%B8%89%E5%91%BD%E9%80%9A%E6%9C%83/%E5%8D%B7%E4%BA%8C) · [iztro 宫位与四化](https://www.iztro.com/en_US/posts/palace) · [托勒密《四书》卷一](https://astrolibrary.org/library/tetrabiblos/tetrabiblos-19/)

## 关系报告

客户端从两份单人排盘计算三术合盘事实。服务端校验事实，直接匹配独立资料条目，再按四类关系筛选和生成报告。三术事实使用 `synastry-facts-v3`。

当前四段正文从实际命中且符合关系主题与方向的资料生成。正式条目进入条件匹配，审核状态供提示词使用。两套旧库的处置、源文出处和可恢复备份见[旧库迁移](server/knowledge/MIGRATION.md)。

### 事实适配与下游接口

三术计算在 `control/compare.ts` 和同目录的三术事实文件，产出是 `ComparisonSection.evidence`，包含规则名、方向、两侧位置、观察说明和结构化字段。八字有参与柱位和组合来源，紫微有来源宫、星曜及已提供的落点，西占有天体或轴点、实际角距与容许度。页面复用账户的公开盘面快照，在本地计算并投影比较事实。

[事实适配器](control/interpretation-fact-adapter.ts)把真实 DTO 转成带稳定实例 ID 的事实。知识索引使用可复用的 `factTypeId`，例如 `bazi:branch-opposition`。[字段注册表](model/interpretation-facts.ts)覆盖三术现有事实，其中西占跨盘相位可再用天体和相位角派生精确模式。实例 `factId` 在同一事实重排时保持稳定，盘面留有各自的来源和版本，实例标识不能作为个人档案 ID。

历史结构化报告及证据包类型仍可用于读取或审计旧结果。显式传入资料和组合规则后可使用原有构建与校验工具。旧数据和历史审计见[迁移说明](server/knowledge/MIGRATION.md)。

## 页面接线

### 单一解读资料库

[合盘资料 JSON](server/knowledge/synastry-knowledge.json) 是一个数组。每条解读对应一个对象，数字 `id` 唯一且稳定。旧库中引用同一段原文的不同解读分别存档。单条原文同时支持 A→B 与 B→A 时，在同一条的匹配条件内分别登记。

| 栏目 | 内容 |
| --- | --- |
| `id` | 唯一正整数。编辑内容时保留已有编号 |
| `source` | `book` 书名，`locator` 版本及原文位置，`url` 为来源网址或 `null` |
| `category` | `method` 为 `bazi`、`ziwei` 或 `western`。`topic` 单选四类关系。`contentType` 为 `personality` 相处表现或 `fact` 事件倾向 |
| `originalText` | 原文解读或旧库引用的原文。资料未补齐时可以为 `null` |
| `matchConditions` | `original` 保存原文条件。`formatted` 保存程序规则 |
| `modernInterpretation` | 原文的现代转述与场景语境，或旧库已有的现代解读。资料未补齐时可以为 `null` |

主题为亲情 `family`、友情 `friendship`、爱情 `romance`、合作 `collaboration`。条件状态 `ready` 使用 `alternatives`，组间任选一组，组内全部成立。尚未核对的条件使用 `unresolved`、`required` 和 `reason`，与可匹配条目保存在同一文件。旧版盘面条件一并存入 `required`。待核条目可通过数字 ID 查询，待条件完成核对后可加入匹配索引。来源与历史改造见[迁移记录](server/knowledge/MIGRATION.md)。

### 从资料条目到合盘报告

1. 先登记原文解读、出处、原文条件和现代释义。可计算条件整理进 `matchConditions.formatted.alternatives`，待核原文在本库中登记尚缺条件。
2. 对照[事实字段注册表](model/interpretation-facts.ts)核对条件是否有可计算事实。命理提供 A、B 各自的基础盘，合盘计算层自行生成跨盘十神、干支联系、紫微宫位对照、跨盘相位、落宫和组合盘等事实。缺事实时先补计算和反例。
3. [匹配层](server/matching/compile-claims.mjs)编译每条资料的格式化条件。索引筛出候选后，再核对事实、版本、方向和数值。命中结果保留独立条目 ID、条件组编号和盘面证据。
4. [筛选层](server/select-summary-evidence.mjs)按条目的 `category.topic` 分配四类关系，从命中证据推导方向，再用运行时评分排序、去重和截取名额。逐项实算回放见[条件映射进度](CONDITION-MAPPING-PROGRESS.md)。

单条事实可用 `equal` 对照值、`oneOf` 择一、`members` 核对成员、`withoutMembers` 排除成员。排除条件需要已知的列表。一个条件组的后续事实可用 `bindToFirst` 绑定至组内第一条事实，例如要求三方四正事实都来自同一原局宫位。

算法诊断仍使用[方法诊断登记](model/method-diagnostics.ts)，共 98 张方法卡、23 个事实映射。可从原始三份 Schema v2 JSON 用下列命令重新生成。

```powershell
node src/features/synastry/server/pack-reference-knowledge.mjs "C:/path/to/knowledge"
```

服务启动时按[SQLite 表结构](server/knowledge/passage-schema.sql)重建或更新 `.local/synastry-knowledge.sqlite`。每条资料占一行，另建事实条件索引。浏览器包不加载知识库，SQLite 不保存账户、出生资料或用户报告。可按条目 ID 查看完整内容，或按体系、事实类型和关系查询。可用 `SYNASTRY_KNOWLEDGE_DB` 指定数据库位置。

```powershell
node --experimental-strip-types src/features/synastry/server/summary.mjs --knowledge-stats
node --experimental-strip-types src/features/synastry/server/summary.mjs --knowledge-claim 1001
node --experimental-strip-types src/features/synastry/server/summary.mjs --knowledge-find western western-luminary-sign-aspect romance
node --experimental-strip-types src/features/synastry/server/summary.mjs --knowledge-scores "C:/path/to/score-audit.json"
```

在 Windows 上运行 `src/features/synastry/Start-synastry.cmd` 可一起启动合盘解读服务和现有 app。它会优先使用已有 DeepSeek 环境变量，或读取本机 `E:\deepseek\deepseek api.txt`。打开合盘并比较双方盘面，页面会显示亲情、友情、爱情和合作各一段解读。

浏览器向 `POST /synastry/summary` 发送 `{ rulesVersion, facts }`。每条本命、跨盘或关系整体事实包含体系、规则、方向、描述、双方对应位置、允许的结构化字段和双方排盘口径。服务端自行选择材料，拒绝带命中 ID 或知识库版本的旧式请求。页面与服务端应一起更新，历史解读仍可从归档直接回读。实际发送给 DeepSeek 的用户消息由 `server/prompt-materials.mjs` 转成中文材料。

合盘在本地从已确认的盘面生成事实。八字有完整四柱和藏干才生成强弱背景，藏干以地支的本气顺序计算。西占使用可唯一确定的黄经，同一次计算给出实际角距、相位和偏差。紫微按可唯一定位的宫位计算地支差及三方四正关系。出生时刻缺失时仍保留已确认的干支和星座事实。请求仅投影计算结果的公开字段，服务端按现有协议接收事实并匹配资料。

发给 DeepSeek 的材料含四类关系下每条命中资料的原文、现代解读、原文命中条件、作用方向和内容类型。原文命中条件取资料条目的 `matchConditions.original`。盘面事实、实际命中值、计算方法和编译后的规则用于服务端匹配。相同的原文、条件与解读可通过共用引用复用，最终正文省略引用编号。全库回放和原文核对见[条件映射进度](CONDITION-MAPPING-PROGRESS.md#独立条目匹配回放)。

匹配完成后、组装提示词前，由[筛选层](server/select-summary-evidence.mjs)对四类关系分别选取 A→B 前 40 条、B→A 前 40 条、共同前 30 条，合计最多 440 条。哪个方向不足就少发，不用其他方向补位。同一 ID 在同一方向下只占一个名额，保留评分最高的条件组。独立分支分别命中 A→B 和 B→A 时，各占对应方向的名额。双方共同事实、关系整体以及同时有双方本命依据的条目也归共同。只有一方本命依据的词条留在服务端。

每个方向按条件严格度、内容具体度、来源可信度依次比较，三项各用百分制。条件分和内容分以去重样本的经验百分位校准。同一原始分取秩次中点，保留真正的并列；两端映射到 0 和 100。服务端启动时从资料和可执行条件计算分数，选材时按实际匹配的分支取分。

- 条件按本次实际命中的证据评分。精确取值比宽泛选项优先，同一事实的同一字段重复约束只计一次，单纯字段存在和可选条件不加分。独立事实绑定、排除组和量化阈值也计入。全库导出用最宽的已编译备选组作为条件基准分，另列最高备选组分数。
- 内容按明确场景、行为和具体对象评分，古文中的协助方式、家产、自办安排和具体关系变化也可得分。每类特征只计一次，常见特征降权，累加收益递减。相同释义只作为一个校准样本。待核条目的评分也可诊断，条件分为 0。
- 来源沿用可编辑的[可信度基准表](server/evidence-scores.mjs)。条目采用主来源，最终分为基准分的 85% 加独立来源百分位的 15%。同一著作的书名别称共享同一档位。《三命通会》为 100，未评级来源为 0。该分数体现合盘资料的采信顺序。

评分导出按独立条目 ID 列出条件分、内容特征、主来源及分布。

```powershell
node src/features/synastry/server/summary.mjs --knowledge-scores path/to/synastry-three-scores.json
```

系统提示词要求模型从原文命中条件判断适用范围，结合现代解读做一步推理。正文用自然语言简要说明依据怎样支持结论，再用条件性语言描述一种可能的日常表现或做法。结论以现代解读为准。材料足够时每类约 200 至 1200 字，可以分段。没有命中时提示资料不足。请求省略出生资料、账户身份、快照标识和 `max_tokens`。模型响应继续使用四类关系正文的 JSON，兼容现有展示和归档。服务失败时显示可重试错误。

[算法审计与98方法状态](ALGORITHM-UPGRADE.md)记录新增本命结构、拱合与争合候选、紫微本命三方四正和年支定位、西占本命相位与组合星位。组合盘采用短弧星位中点；180°歧义保留两分支并暂停依赖该点的唯一相位输出。Davison、动态运限和缺少定义的流派分支保留登记，所需快照字段见[后续交接](SNAPSHOT-ENRICHMENT-HANDOFF.md)。

`index.ts` 的运行时入口为 `SynastryScreen` 和 `compareCharts`。正式服务在 server 目录加载独立资料条目。页面接收 B 方的 `renderManualSubject` 和可选的 A 方 `renderManualOwner`，两者都使用 `onConfirm(chart)` 和 `onCancel()`。页面自行从账户公开接口读取本人快照。路由及跨模块依赖见[临时交接单](INTEGRATION-HANDOFF.md)。

运行 `npm test -- src/features/synastry` 验证双人输入、未知时刻拦截、三术事实、知识检索与审核过滤、四类关系、跨术分歧、证据追溯及覆盖状态。

## 模块分工

| 路径 | 计划职责 |
| --- | --- |
| `model/` | 双人出生资料、校验结果和盘面比较结果 |
| `control/` | 校验输入、协调单人排盘和执行双人比较 |
| `view/` | 两人资料表单、比较结果、编辑与错误反馈 |
| `index.ts` | 导出合盘页面及明确约定的公开接口 |

计划由[应用入口](../../app/README.md)接入原运势所在的第二个底栏位置。[命理](../destiny/README.md)按约定提供单人排盘能力，[运势](../fortune/README.md)继续在自己的目录维护周期功能。目录授权和验收规则见[合盘开工说明](AGENTS.md)。

> **跨板块协作**　其他板块的代码可以阅读和参考，可通过对方明确开放的入口或公共 UI 复用能力。需要修改认领范围外的文件时，包括其他板块的代码、业务页面和说明文档，须先向用户说明具体文件、原因和影响，取得明确授权后再修改。

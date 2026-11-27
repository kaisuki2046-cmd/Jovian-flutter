# 合盘条件映射与事实覆盖进度

2026-11-18。基线 2155b73，本轮仅修改合盘目录。

## 独立条目匹配回放

唯一资料 JSON 包含 2,134 条资料。2,126 条具有可执行条件，8 条保留待核原因。本轮启用 2,077 条，包括八字旧库 282 条、紫微旧库 652 条、西占旧库 1,139 条，以及先期整理的 4 条。条目使用数字 ID、单一主题和内容类型。`factTypeId` 按「术数:规则名」定位盘面事实类型，条件另行检查方向和具体字段。优先级由服务器计算。[迁移记录](server/knowledge/MIGRATION.md)可查启用口径、原库映射和待核内容。

启用后用 349 组虚构双人盘面及对调顺序回放，共 698 次比较和 789,586 条三术事实。2,126 条资料的 3,498 组可执行条件均有实算见证，事实一致性校验无异常。单方本命命中留在服务端，双方独立命中同一条资料可归入共同结果。完整见证在 `server/.local/activation-full-coverage.json`，四类关系各有命中的模型请求样例在 `server/.local/activation-full-prompt.txt`。

## 历史分句匹配回放

上一版接口读取原文分句的 SQLite 候选索引。下面的回放记录保留旧标识供追溯。

双向回放使用 115 组虚构双人盘面对调顺序，共 230 次比较和 257,002 条三术事实。1,733 个分句及 3,063 组备选条件均有计算见证，几何校验未发现相位或宫位关系矛盾。匹配层把资料中的「偏官」「命」分别对齐到计算层的「七杀」「命宫」，保留原文和原条件措辞。

```powershell
node --experimental-strip-types src/features/synastry/server/matching/claim-coverage.mjs "C:/path/to/replay-charts.json" "C:/path/to/witness-pairs.json" "C:/path/to/entry-coverage.json"
```

见证文件可用 `[{ "a": 0, "b": 1 }]` 数组，也可使用历史回放的 `sceneWitnesses` 数据。脚本输出当前独立条目的命中见证、缺项和缺少的事实字段。新增条目需随条件补充正例、反例和边界样本。

## 逐条条件核对

按[迁移说明](server/knowledge/MIGRATION.md)解压备份后，可从恢复的目录运行历史审计。下列历史审计覆盖 1,733 条分句（八字 242、紫微 552、西占 939）。审计用旧条件生成正例，并核对缺字段、条件不符和方向不符的反例。新版正式库使用上文的独立条目回放。

运行：

```powershell
node --experimental-strip-types C:/path/to/recovered/synastry/server/condition-audit.mjs
node --experimental-strip-types C:/path/to/recovered/synastry/server/condition-audit.mjs C:/path/to/full-entry-audit.json
node --experimental-strip-types C:/path/to/recovered/synastry/server/condition-audit.mjs --all-replay src/features/synastry/server/.local/replay-charts.json src/features/synastry/server/.local/all-calculation-condition-audit.json src/features/synastry/server/.local/condition-replay.json
```

第二条命令输出每个稳定词条 ID 的完整条件、检查次数、状态和错误。它检查来源与运行时一致性，不把构造的条件样本当成真实出生盘。

第三条命令读取已经由排盘引擎生成的虚构快照，重算双人事实，验证全部新旧规则及各自的关系场景。第四个文件参数提供此前六个定向真实见证的索引；也可省略它，仅使用普通配对。`--legacy-replay` 只核对历史1,531条，`--all-replay` 核对当时的完整运行库。

## 本轮计算增量

新增六种规则，共28种算法事实入口；运行库3,292条规则、8,004个关系场景。版本为 synastry-knowledge-0.9.0。客户端和服务端须同时更新。

- BZ-M30：年支生肖、合法年柱纳音及表版本分开保存。
- BZ-M32：分别计算A日柱对B年柱与反向，明干十神以接收方年干为参照。
- ZW-M06：空宫与对宫主星独立参照，不进行未定义的借星。
- ZW-M07：目标宫前后一支的相邻宫位与星曜，不自动判夹格。
- ZW-M20：宫干表的被化星唯一落本宫时生成自化事实。
- ZW-M22：本命标记与宫干自化并存时分别记录，未把上游未说明来源的标记声称为生年四化。

全部28种算法入口均声明必要字段和允许方向，不再仅凭首字段存在；可选的日干、藏干、四化标记与宫位字段按各类事实实际能力保留兼容。双向关系、个人本命、关系整体和关系盘对个人本命分别指定方向，不能互相替代。本命、组合盘和激活本命的相位分别保留自己的偏差与容许度，要求数值非负且偏差在容许度内。比较使用计算端已有的1e-9度浮点精度，只对相位偏差/容许度这一对数值应用，不影响其他数量条件。

更新后，从已保存的真实排盘样本重放28种规则，全部能通过完整条件；3次双人比较共核对2,081条算法事实，未发现字段或方向缺失。逐字段删除、方向不符、超容许度、负值、非数字和浮点边界反例均已加入模块测试。结果记录在 `server/.local/algorithm-condition-audit.json`。原词条解释和审核等级未放宽，未增加模型正文硬性校验。旧本命接触中以JSON字符串存储的详情也在模型边界递归转为中文。

## 真实排盘抽样与边界

调用现有命理手动排盘实现，再走合盘比较、检索和请求组装。首轮12组虚构出生资料产生六类新事实。随后扩大为261组虚构资料、2,474次双人比较，全部正式词条均观察到真实计算事实命中。未访问真实账户或真实模型。

主要样本使用 i=0…255：年份1940+(17i mod 80)、月份1+(5i mod 12)、日期1+(11i mod 28)、小时7i mod 24、分钟13i mod 60，性别交替，地点依次取现有出生地目录。依次比较索引相差1、2、3、4、5、6、11、12、17、31的两份盘面，共2,468次。另加入1901、1910、1920、1930、2025年1月15日12:00的虚构资料，按剩余六条西占相位条件寻找不同盘面的实算正例，完成另外六次完整检索。未用同一对象冒充双人盘面。

完整词条审计与实算结果保存在本工作树 `server/.local/condition-audit.json`、`server/.local/condition-replay.json`，实算盘面缓存为 `server/.local/replay-charts.json`。生成文件不提交。六个定向样本保留双方索引、实际偏差和容许度。全部1,733条可达性已经验证；这仍不等于所有方法卡已完成，也不代表预测效度或人工审阅完成。当前98种方法中58种有部分事实入口，40种仍无计算入口，完整目标继续保留。

后续全库回放又覆盖了历史1,531条与28条算法适配规则：2,521次双人比较产生2,831,902条计算事实，全部3,292条规则和8,004个关系场景均找到真实样本，零未覆盖。每个场景分别记录双方索引、查询参数、命中规则和审核状态，结果为 `server/.local/all-calculation-condition-audit.json`。草稿素材继续标记为草稿，没有借测试改变审核等级。历史库只核对是否命中本次真实条件，没有放宽旧条件。

## 历史服务端全库回放

### 依照命理重构匹配

- 参照命理的 [条件校验](../destiny/server/knowledge/matching.mjs)与 [SQLite 候选索引](../destiny/server/knowledge/claims-sqlite.mjs)。同一备选条件组内每项必须通过，命中任一完整组即可采用条目。候选索引核对必备事实键，最终匹配核对事实绑定、数值、版本及排除条件。缺失字段不能确认排除。
- 核对旧版 1,733 条词条的 3,063 个机器条件组。旧版字段展开与这批资料的机器条件一致。回归另外验证了多字段排除、部分满足及未知字段三种情况。
- 原文包含未被本次跨盘事实证明的单人命局条件。八字「忌庚重」「忌辛多」留在源文，比肩条目只引用已核对的定义片段。紫微跨盘三方对照的来源包含本命正曜、庙旺和吉星会合，报告采用对照事实及其范围内的释义，完整古籍内容保留用于审计。天干五合条目继续只说明配对，资料库保留化气原文供查证。
- 西占的 10 条同名天体角距背景要求另有相应跨盘相位。条目必须同时命中两条事实，核对两侧天体、黄经及角距，并检验相位容许度。历史多证据条目经过同一个索引与条件匹配器。

`--summary-replay` 按见证索引从两份虚构出生资料生成的盘面重新计算双人比较事实，经客户端请求组装、JSON 序列化和服务端 SQLite 匹配后，逐条核对 3,292 条原子规则、8,004 个关系场景和 10 条组合规则。输出记录每个场景及每条组合的实算盘面对，出现遗漏时进程返回失败。基础见证报告可用上文的 `--all-replay` 生成，额外见证使用由 `{ "a": 索引, "b": 索引 }` 组成的 JSON 数组。

```powershell
node --experimental-strip-types C:/path/to/recovered/synastry/server/condition-audit.mjs --summary-replay src/features/synastry/server/.local/replay-charts.json src/features/synastry/server/.local/all-calculation-condition-audit.json src/features/synastry/server/.local/summary-coverage.json src/features/synastry/server/.local/combination-witness-pairs.json
```

## 98种方法的逐项后续

“有事实入口”仅表示相关结构已经输出，不代表整套方法实现。尚需条件沿用已查验方法卡及本轮明确的缺口。不得根据方法名称编造流派阈值、角色、出生时刻或观察时间。

| 方法 | 名称 | 当前计算入口 | 尚需条件 |
| --- | --- | --- | --- |
| BZ-M01 | 双方独立本命结构检查 | bazi:day-master-strength-context、bazi:bazi-natal-pillar、bazi:bazi-natal-ten-god、bazi:bazi-natal-element-count、bazi:bazi-natal-contact、bazi:bazi-natal-strength-context | 当前使用已确认快照；候选出生时间域与稳定性证明尚未实现。 |
| BZ-M02 | 旺衰扶抑 | bazi:day-master-strength-context、bazi:bazi-natal-element-count、bazi:bazi-natal-strength-context | 已有月令根气事实，旺衰分级、季节权重和取用流派尚未指定。 |
| BZ-M03 | 月令格局与成败救应 | 尚无 | 格局判定和救应条件未编码 |
| BZ-M04 | 调候寒暖燥湿 | 尚无 | 调候用神版本与寒暖燥湿辨别未编码 |
| BZ-M05 | 病药结构 | 尚无 | 原局病与药的流派判据未编码 |
| BZ-M06 | 通关与五行源流 | 尚无 | 通关条件及先后与全局取用未编码 |
| BZ-M07 | 从格、专旺及真假从 | 尚无 | 真从、假从及破从的流派判据未编码 |
| BZ-M08 | 传统配偶星定位 | bazi:relative-ten-god、bazi:bazi-natal-ten-god | 尚未取得传统配偶星所需的性别及角色参数。 |
| BZ-M09 | 配偶星质量、清混及喜忌 | 尚无 | 缺完整的相关输入事实、专用规则和复现测试。见本卡原始前置与限制。 |
| BZ-M10 | 夫妻宫与星宫同参 | bazi:branch-union、bazi:branch-harm、bazi:branch-break、bazi:branch-punishment、bazi:bazi-natal-pillar、bazi:bazi-natal-contact | 夫妻宫全层分析与星宫同参 |
| BZ-M11 | 月令藏干与吸引解释 | bazi:cross-pillar-ten-god、bazi:bazi-natal-ten-god | 月令藏干已单独列出，调候和吸引解释规则尚未编码。 |
| BZ-M12 | 双向十神映射 | bazi:relative-ten-god、bazi:cross-pillar-ten-god | 其他参照点、规则上下文和完整候选域 |
| BZ-M13 | 接收方喜忌与结构互补 | bazi:day-stem-elements、bazi:relative-ten-god、bazi:cross-pillar-ten-god、bazi:day-master-strength-context、bazi:bazi-natal-strength-context | 接收方指定流派的取用、喜忌及领域桥接 |
| BZ-M14 | 比劫重与食伤重的传统结构配法 | bazi:cross-pillar-ten-god、bazi:bazi-natal-ten-god、bazi:bazi-natal-element-count | 双方全局比劫、食伤强弱及应用条件 |
| BZ-M15 | 跨盘天干五合接触 | bazi:stem-combination、bazi:bazi-natal-contact | 全候选的干合稳定性与争合冲突审查 |
| BZ-M16 | 合化条件与合而不化 | bazi:branch-group、bazi:stem-combination | 月令条件、根气有效性、合化判定与流派阈值 |
| BZ-M17 | 六合与受益方向 | bazi:branch-union、bazi:bazi-natal-contact | 六合受益、合绊与接收方结构 |
| BZ-M18 | 三合、三会、半合与拱合分级 | bazi:branch-group、bazi:bazi-natal-contact、bazi:bazi-branch-arch | 三合、三会、半合与缺中支的拱合候选分别记录，未判断成局或合化。 |
| BZ-M19 | 六冲与冲动/冲去 | bazi:branch-opposition、bazi:bazi-natal-contact | 六冲接触已实现，冲动、冲去或受损的条件规则尚未编码。 |
| BZ-M20 | 三刑与自刑 | bazi:branch-punishment、bazi:bazi-natal-contact | 完整刑组和自刑流派细则 |
| BZ-M21 | 六害、六破及合破并见 | bazi:branch-harm、bazi:branch-break、bazi:bazi-natal-contact | 合害破并见时的解释顺序与六破原始规则 |
| BZ-M22 | 争合、妒合与作用先后 | bazi:stem-combination、bazi:bazi-stem-competition | 争合候选已有参与人和柱位，作用先后与流派判据尚未编码。 |
| BZ-M23 | 双方大运并行与阶段错位 | 尚无 | 缺双方独立大运、边界和共同时间轴 |
| BZ-M24 | 流年触发与伏吟反吟 | 尚无 | 缺逐人的流年触发与伏吟反吟事实 |
| BZ-M25 | 双人关系事件窗口交叉 | 尚无 | 缺双人已定义的事件窗口及候选规则 |
| BZ-M26 | 六亲星宫与真实亲属双盘对照 | 尚无 | 缺亲属真实角色与逐角色映射规则 |
| BZ-M27 | 合作中的财印食伤官杀结构比较 | bazi:relative-ten-god、bazi:cross-pillar-ten-god、bazi:bazi-natal-ten-god | 明确合作角色、完整财官食伤印星以及领域桥接 |
| BZ-M28 | 朋友与同辈关系的双向角色假设 | bazi:relative-ten-god、bazi:cross-pillar-ten-god、bazi:bazi-natal-ten-god | 同辈角色及实际互动渠道 |
| BZ-M29 | 桃花等神煞附加核对 | bazi:cross-branch-natal-marker | 完整神煞名录、作用域和资格；只检索已提供的原盘神煞 |
| BZ-M30 | 生肖年命与纳音取象 | bazi:bazi-year-symbols | 已按年柱分别列出生肖与纳音，年命关系解释与八宅命宫尚未定义。 |
| BZ-M31 | 八宅命宫/三元年命配婚 | 尚无 | 缺版本化八宅命宫和三元年命规则 |
| BZ-M32 | 一方日柱对另一方年柱 | bazi:bazi-day-to-year | 已有双向日柱对年柱与明干十神；作者解释条件和历史证明仍缺。 |
| BZ-M33 | 盲派宾主、体用、做功及穿 | 尚无 | 缺足够一手定义、宾主体用规则及可复现个案 |
| ZW-M01 | 历法、安星与流派profile | 尚无 | 缺完整的相关输入事实、专用规则和复现测试。见本卡原始前置与限制。 |
| ZW-M02 | 命宫、身宫与全盘基线 | ziwei:ziwei-palace-by-branch、ziwei:ziwei-natal-palace | 命身和星曜事实已列出，格局及候选域判定尚未编码。 |
| ZW-M03 | 主题宫三方四正 | ziwei:ziwei-cross-palace-sector、ziwei:ziwei-natal-sector | 本人三方四正已计算，星系成格与吉凶规则尚未编码。 |
| ZW-M04 | 十四正曜与星系组合 | ziwei:ziwei-natal-palace、ziwei:ziwei-natal-sector、ziwei:ziwei-star-overlay | 缺完整的相关输入事实、专用规则和复现测试。见本卡原始前置与限制。 |
| ZW-M05 | 辅佐、煞曜、庙旺与格局反条件 | 尚无 | 缺完整的相关输入事实、专用规则和复现测试。见本卡原始前置与限制。 |
| ZW-M06 | 空宫与借星安宫 | ziwei:ziwei-empty-palace-context | 已有空宫和对宫主星参照；借入对象、亮度及流派规则未指定。 |
| ZW-M07 | 对星、同度、会照与夹宫结构 | ziwei:ziwei-adjacent-palace-context、ziwei:ziwei-natal-sector | 已有三方四正与两侧邻宫星曜；指定对星夹格和解释判据未提供。 |
| ZW-M08 | 立太极与转宫的角色视角 | 尚无 | 缺完整的相关输入事实、专用规则和复现测试。见本卡原始前置与限制。 |
| ZW-M09 | 情侣/婚姻的夫妻宫主题与关联宫审查 | ziwei:ziwei-natal-palace | 缺完整的相关输入事实、专用规则和复现测试。见本卡原始前置与限制。 |
| ZW-M10 | 朋友关系的交友与自我/外界主题 | ziwei:ziwei-natal-palace | 缺完整的相关输入事实、专用规则和复现测试。见本卡原始前置与限制。 |
| ZW-M11 | 合作关系的财官—交友主题 | ziwei:ziwei-natal-palace | 缺完整的相关输入事实、专用规则和复现测试。见本卡原始前置与限制。 |
| ZW-M12 | 亲属角色的父母、兄弟、子女与田宅主题 | ziwei:ziwei-natal-palace | 缺完整的相关输入事实、专用规则和复现测试。见本卡原始前置与限制。 |
| ZW-M13 | 夫妻期待与对方命身星系的双向比较 | ziwei:ziwei-palace-by-branch、ziwei:ziwei-cross-palace-sector、ziwei:ziwei-natal-palace、ziwei:ziwei-natal-sector、ziwei:ziwei-star-overlay | 夫妻宫与命身星系的双盘前置和主题规则 |
| ZW-M14 | 双人主题与运限并列分析 | ziwei:ziwei-palace-by-branch、ziwei:ziwei-cross-palace-sector、ziwei:ziwei-natal-palace、ziwei:ziwei-star-overlay | 双方主题宫完整结构与各层独立运限 |
| ZW-M15 | 太岁入卦：对方出生年支在接收盘定位 | ziwei:ziwei-birth-year-overlay | 仅实现对方年支定位，完整入卦解释和变盘规则尚未编码。 |
| ZW-M16 | 跨盘四化与两向分算 | ziwei:ziwei-transformation-by-branch、ziwei:ziwei-palace-stem-flight-overlay | 作者的起化表、接收时间层、公共锚点及跨盘解释 |
| ZW-M17 | 本命与对方大限宫位的位置叠置 | ziwei:ziwei-cross-palace-sector | 缺大限层锚点与原案例重排条件 |
| ZW-M18 | 生年四化：本命标记 | ziwei:ziwei-transformation-by-branch、ziwei:ziwei-natal-transformation | 沿用快照原盘四化标记，其他起化来源需额外数据。 |
| ZW-M19 | 宫干飞化：宫位到星曜落宫 | ziwei:ziwei-palace-stem-flight-overlay、ziwei:ziwei-natal-flight | 沿用快照四化表作本人宫干飞化，完整流派解释尚未编码。 |
| ZW-M20 | 本宫宫干作用于本宫星的自化 | ziwei:ziwei-palace-self-transformation | 已有快照宫干表所指星在本宫的自化事实；不包含向心、离心及视同自化。 |
| ZW-M21 | 对宫引动、向心/离心及视同自化 | 尚无 | 缺原作者的箭头视角及向心／离心定义 |
| ZW-M22 | 生年四化与自化并存 | ziwei:ziwei-native-self-transformation-coexistence | 已分别保留同星本命标记与宫干自化；上游缺少本命标记起源，尚不能证明生年四化并存。 |
| ZW-M23 | 同三方及跨三方的互化家族 | 尚无 | 缺完整的相关输入事实、专用规则和复现测试。见本卡原始前置与限制。 |
| ZW-M24 | 紫云生年太岁卦象与变盘/变卦 | 尚无 | 缺紫云变盘、变卦的完整原作者算法 |
| ZW-M25 | 本命—大限—流年/流月分层叠盘 | 尚无 | 缺完整的相关输入事实、专用规则和复现测试。见本卡原始前置与限制。 |
| ZW-M26 | 多层四化触发与重点宫位 | 尚无 | 缺完整的相关输入事实、专用规则和复现测试。见本卡原始前置与限制。 |
| ZW-M27 | 双方时间窗口的并行核对 | 尚无 | 缺完整的相关输入事实、专用规则和复现测试。见本卡原始前置与限制。 |
| ZW-M28 | 候选时辰与定盘审计 | 尚无 | 缺枚举／区间证明引擎及独立定盘验证集 |
| WA-M01 | 分别建立本命关系背景 | western:western-matching-planet-angle、western:western-natal-placement、western:western-natal-axis、western:western-natal-aspect | 本人星位、宫主和相位已列出，完整关系主题解释规则尚未编码。 |
| WA-M02 | 第七宫、下降点与第七宫主 | western:western-house-ruler-overlay、western:western-natal-axis、western:western-natal-house-ruler | 下降点、第七宫与传统宫主已有事实，完整解释规则尚未编码。 |
| WA-M03 | 月亮、金星、火星的需求与表达 | western:western-natal-placement、western:western-natal-aspect | 缺完整的相关输入事实、专用规则和复现测试。见本卡原始前置与限制。 |
| WA-M04 | 水星、第三宫与沟通背景 | western:western-natal-placement、western:western-natal-house-ruler、western:western-natal-aspect | 缺完整的相关输入事实、专用规则和复现测试。见本卡原始前置与限制。 |
| WA-M05 | 土星与承诺、边界、责任 | western:western-natal-placement、western:western-natal-house-ruler、western:western-natal-aspect | 缺完整的相关输入事实、专用规则和复现测试。见本卡原始前置与限制。 |
| WA-M06 | 元素、模式与整体分布比较 | western:western-natal-distribution | 提供十颗天体等权计数，其他权重及流派解释需另定。 |
| WA-M07 | 跨盘主要相位矩阵 | western:western-matching-planet-angle、western:western-cross-aspect | 完整双盘容许度 profile 及候选域稳定性 |
| WA-M08 | 太阳/月亮跨盘组合 | western:western-cross-aspect | 限定日月星体及各自本命需求 |
| WA-M09 | 水星的跨盘沟通联系 | western:western-whole-sign-overlay、western:western-cross-aspect | 限定水星及第三宫面向、各自沟通基线 |
| WA-M10 | 金星/火星跨盘价值与行动联系 | western:western-whole-sign-overlay、western:western-cross-aspect | 限定金火及接收方价值、需求背景 |
| WA-M11 | 木星/土星与支持、资源、持续 | western:western-whole-sign-overlay、western:western-cross-aspect | 限定木土及受力方背景和具体资源 |
| WA-M12 | 外行星与个人点、代际背景 | western:western-cross-aspect、western:western-planet-to-axis | 限定外行星连接个人点并区分代际背景 |
| WA-M13 | 角轴交叉接触 | western:western-planet-to-axis、western:western-axis-aspect、western:western-natal-axis | 角轴稳定性、输入误差范围及可用方向 |
| WA-M14 | 双向落宫叠盘 | western:western-whole-sign-overlay | 接收盘可靠性、来源星位跨界检查、整宫制以外的口径 |
| WA-M15 | 宫主链及事业、资源主题定向 | western:western-house-ruler-overlay、western:western-house-ruler-aspect、western:western-ruler-to-ruler、western:western-natal-house-ruler | 接收方命盘及关系领域条件、守护和时间体系 |
| WA-M16 | 对方激活已有本命结构 | western:western-cross-aspect、western:western-natal-aspect、western:western-natal-activation | 提供接收方已有相位与外来接触的连接，复杂激活排序规则尚未编码。 |
| WA-M17 | 中点组合盘的星体计算 | western:western-composite-midpoint、western:western-composite-aspect | 仅计算短弧星位中点，180度歧义保留两分支；宫头属于另一项方法。 |
| WA-M18 | 组合盘宫头与参考地点变体 | 尚无 | 缺变体和参考地指定的组合盘角宫 |
| WA-M19 | 组合盘作为关系整体解读 | western:western-composite-aspect | 提供无歧义组合星位的相位，完整关系整体解释和宫位规则尚未实现。 |
| WA-M20 | 本命与组合盘交叉比较 | western:western-composite-natal-aspect | 提供无歧义组合星位与个人本命的相位，复杂结构解释规则尚未实现。 |
| WA-M21 | Davison 时空中点及变体 | 尚无 | 缺指定变体下的双方 UTC 瞬间、地理及校正 |
| WA-M22 | 个人行运与关系议题 | 尚无 | 缺个人行运和来源时间层 |
| WA-M23 | 行运触及关系整体盘 | 尚无 | 缺关系盘行运触发 |
| WA-M24 | 个人次限推运 | 尚无 | 缺次限和角轴变体 |
| WA-M25 | 次限比较盘与推运组合盘 | 尚无 | 缺推运与合盘运算次序及定义 |
| WA-M26 | 太阳弧方向 | 尚无 | 缺太阳弧钥及候选角轴 |
| WA-M27 | 个人太阳回归及其他回归 | 尚无 | 缺回归时刻、地点及指定变体 |
| WA-M28 | Davison 的回归与次限 | 尚无 | 缺 Davison 原盘和推运规则 |
| WA-M29 | 相识、婚礼、签约等事件盘 | 尚无 | 缺真实事件钟表、地点及盘型规则 |
| WA-M30 | 择时：婚礼、签约与合作启动 | 尚无 | 缺未来行动时间边界、地点及择时规则 |
| WA-M31 | 传统本命：条件、宫主、接纳与派别 | 尚无 | 缺所选传统学派的完整先决条件与适用范围 |
| WA-M32 | 传统跨盘日月、上升与福点联系 | 尚无 | 缺传统婚姻点、福点和派别定义 |
| WA-M33 | 年限法及其他时间主星 | 尚无 | 缺时间主星与年限法参数 |
| WA-M34 | 交点与演化占星方法 | 尚无 | 缺交点口径及完整作者规则 |
| WA-M35 | Chiron、Juno 与其他小天体 | 尚无 | 缺小天体星历、容许度及参考规则 |
| WA-M36 | 个人中点与中点接触 | 尚无 | 缺中点及直接／间接触发条件 |
| WA-M37 | 谐波及振动占星的关系扩展 | 尚无 | 缺谐波阶数、容许度及关系规则 |

## 下一步依赖

1. 维持现有3,292条规则与8,004个场景的逐条条件及真实计算回归，不把现有运行库全覆盖说成全部方法卡完成。
2. 庙旺需要上游保留星曜亮度及版本；生年与自化分层需要标明四化起源。
3. 动态运限、Davison、推运等需上游授权提供出生瞬间、必要坐标、时间精度及明确的目标时间和技术参数。
4. 不同流派的旺衰、合化、取用、借星、向心离心等缺少完整计算定义时，保留未完成状态。跨模块契约修改须用户授权。

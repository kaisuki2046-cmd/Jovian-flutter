# 合盘方法与算法升级核对

2026-11-18 后续进度：新增六类可计算事实，算法入口增至28种；来源条件逐条核对、真实盘面抽样及98种方法的最新缺口见 [条件映射进度](CONDITION-MAPPING-PROGRESS.md)。下文保留此前22类事实阶段的验收记录，不代表后续全部方法已完成。

2026-11-18。工作树 b037/app，分支 codex/synastry/ya-human-summary，起点 ef5f65f。

## 当前入口与数据链

账户公开命盘快照或现有手动出生录入 → compareCharts → 三术双人盘面事实 → 服务端校验与 SQLite 资料匹配 → 选取命中解读 → DeepSeek → 四种关系正文。实际发送的材料见[合盘说明](README.md#页面接线)。

服务端根据双方盘面检索资料，盘面事实停留在服务端。四种关系按假设情境同时输出，模型可以基于命中解读做一步推理。

## 资料审计

已提取 PDF 全部 137 页及其内嵌方法登记。98 个方法编号均出现在 PDF 正文，完整方法对象随历史备份保存。运行时使用 [方法诊断登记](model/method-diagnostics.ts) 中的必要字段和事实映射。案例和出处表示来源库提供的材料，未重新逐个打开外部原始网页，也未核验现实结果。

合并库包含 1733 条原始词条、98 张方法卡、15 个案例、25 项书目、104 条来源。

原始三份文件当前仍为 242、552、939 条；新增主要是方法及工程资产。旧 1,531 条规则继续兼容。最初的 22 个算法事实适配条目描述可计算的事实与方法边界，供服务端匹配和审计使用。

## 算法与匹配

旧事实继续采用 synastry-facts-v3。新事实使用 synastry-enrichment-v1，单独保留 intra、cross、relationship_whole 作用域，以及 natal/composite 层、计算口径和 methodRefs。

新增日柱明干的跨盘十神输出使库中原有日柱明干条件可以被真实事实命中。其余旧词条条件未放宽。六冲本来已存在于 v3 引擎，方法登记补上 BZ-M19 关联。

| 体系 | 新计算规则 | 方法 | 当前边界 |
| --- | --- | --- | --- |
| bazi | bazi-natal-pillar | BZ-M01、BZ-M10 | 原局仅属于该人，日支只作原局背景。 |
| bazi | bazi-natal-ten-god | BZ-M01、BZ-M08、BZ-M11、BZ-M14、BZ-M27、BZ-M28 | 十神计数不能单独定义强弱、喜忌、用神或真实角色。 |
| bazi | bazi-natal-element-count | BZ-M01、BZ-M02、BZ-M14 | 按出现次数计数，无季节权重。藏干资料不完整时不能断某五行不存在。 |
| bazi | bazi-natal-contact | BZ-M01、BZ-M10、BZ-M15、BZ-M17、BZ-M18、BZ-M19、BZ-M20、BZ-M21 | 接触符号不等于合化、冲去或吉凶结论。 |
| bazi | bazi-natal-strength-context | BZ-M01、BZ-M02、BZ-M13 | 只有完整四柱和藏干时生成。根气计数不等于身强身弱或取用结论。 |
| bazi | bazi-branch-arch | BZ-M18 | 只记录缺中支的结构候选，不能按完整三合或合化论。 |
| bazi | bazi-stem-competition | BZ-M22 | 保留参与人和柱位。多个候选不代表第三者，也不决定作用先后。 |
| ziwei | ziwei-natal-palace | ZW-M02、ZW-M04、ZW-M09、ZW-M10、ZW-M11、ZW-M12、ZW-M13、ZW-M14 | 不从宫名推断真实家庭、伴侣或合作角色，亮度缺失时不判断庙旺。 |
| ziwei | ziwei-natal-sector | ZW-M03、ZW-M04、ZW-M07、ZW-M13 | 这里只给结构与星曜，具体成格及吉凶需要独立规则。 |
| ziwei | ziwei-star-overlay | ZW-M04、ZW-M13、ZW-M14 | 双方星位不移动，跨盘同支对照保留来源和接收者。 |
| ziwei | ziwei-birth-year-overlay | ZW-M15 | 使用账户已确认的八字年柱作地支锚，仅实现年支定位，未实现紫云变盘或变卦。 |
| ziwei | ziwei-natal-transformation | ZW-M18 | 原盘四化与宫干飞化分别记录，上游未提供的四化不补算。 |
| ziwei | ziwei-natal-flight | ZW-M19 | 沿用快照的四化表。星曜落点不唯一时停止该条，不推断自化或向心离心。 |
| western | western-natal-placement | WA-M01、WA-M03、WA-M04、WA-M05 | 采用现有热带黄道及整宫制，不作人格或关系结果评分。 |
| western | western-natal-axis | WA-M01、WA-M02、WA-M13 | 轴点须来自该人的可靠快照，天顶不等同整宫第十宫宫头。 |
| western | western-natal-house-ruler | WA-M02、WA-M04、WA-M05、WA-M15 | 固定传统守护表，未提供现代守护、接纳或尊贵度规则。 |
| western | western-natal-aspect | WA-M01、WA-M03、WA-M04、WA-M05、WA-M16 | 使用当前五种主相位口径，结合对应本命星位阅读。 |
| western | western-natal-distribution | WA-M06 | 采用等权描述性计数，不能替代整盘判断。 |
| western | western-natal-activation | WA-M16 | 必须先有接收方本命相位。连接只表示结构激活候选。 |
| western | western-composite-midpoint | WA-M17 | 组合星位不含宫位、轴点或参考地点，180°歧义分支不自动选定。 |
| western | western-composite-aspect | WA-M17、WA-M19 | 仅代表短弧中点星位模型，关系整体的象征不能分配为一方行为。 |
| western | western-composite-natal-aspect | WA-M20 | 来源为关系整体星位，接收方由 person 标明，不伪作另一方本命影响。 |

## 真实排盘回放

测试使用两份虚构出生资料，经现有命理计算函数生成快照，以本人账户快照和手动 B 方形式进入合盘。没有读取真实账户数据。

| 体系 | v3 事实 | 新增事实 |
| --- | ---: | ---: |
| bazi | 44 | 57 |
| ziwei | 204 | 358 |
| western | 170 | 199 |

本次共 1032 条事实、1380 个去重条目 ID。全部进入请求。53 张方法卡有部分实际事实可用，其余卡片保留具体依赖。资料完整并不自动启用全部算法。

## 98 张方法逐项状态

“部分事实可用”表示已有结构化输出，不能据此宣称完整方法实现或现实预测已验证。原始收录与发布状态保留在正式库。以下是此组虚构资料的运行状态。

| 方法 | 名称 | 状态 | 已计算事实类型 | 尚需条件 |
| --- | --- | --- | --- | --- |
| BZ-M01 | 双方独立本命结构检查 | partial_facts_available | bazi:day-master-strength-context、bazi:bazi-natal-pillar、bazi:bazi-natal-ten-god、bazi:bazi-natal-element-count、bazi:bazi-natal-contact、bazi:bazi-natal-strength-context | 当前使用已确认快照；候选出生时间域与稳定性证明尚未实现。 |
| BZ-M02 | 旺衰扶抑 | partial_facts_available | bazi:day-master-strength-context、bazi:bazi-natal-element-count、bazi:bazi-natal-strength-context | 已有月令根气事实，旺衰分级、季节权重和取用流派尚未指定。 |
| BZ-M03 | 月令格局与成败救应 | not_implemented |  | 格局判定和救应条件未编码 |
| BZ-M04 | 调候寒暖燥湿 | not_implemented |  | 调候用神版本与寒暖燥湿辨别未编码 |
| BZ-M05 | 病药结构 | not_implemented |  | 原局病与药的流派判据未编码 |
| BZ-M06 | 通关与五行源流 | not_implemented |  | 通关条件及先后与全局取用未编码 |
| BZ-M07 | 从格、专旺及真假从 | not_implemented |  | 真从、假从及破从的流派判据未编码 |
| BZ-M08 | 传统配偶星定位 | partial_facts_available | bazi:relative-ten-god、bazi:bazi-natal-ten-god | 尚未取得传统配偶星所需的性别及角色参数。 |
| BZ-M09 | 配偶星质量、清混及喜忌 | not_implemented |  | 缺完整的相关输入事实、专用规则和复现测试。见本卡原始前置与限制。 |
| BZ-M10 | 夫妻宫与星宫同参 | partial_facts_available | bazi:branch-union、bazi:bazi-natal-pillar、bazi:bazi-natal-contact | 夫妻宫全层分析与星宫同参 |
| BZ-M11 | 月令藏干与吸引解释 | partial_facts_available | bazi:cross-pillar-ten-god、bazi:bazi-natal-ten-god | 月令藏干已单独列出，调候和吸引解释规则尚未编码。 |
| BZ-M12 | 双向十神映射 | partial_facts_available | bazi:relative-ten-god、bazi:cross-pillar-ten-god | 其他参照点、规则上下文和完整候选域 |
| BZ-M13 | 接收方喜忌与结构互补 | partial_facts_available | bazi:day-stem-elements、bazi:relative-ten-god、bazi:cross-pillar-ten-god、bazi:day-master-strength-context、bazi:bazi-natal-strength-context | 接收方指定流派的取用、喜忌及领域桥接 |
| BZ-M14 | 比劫重与食伤重的传统结构配法 | partial_facts_available | bazi:cross-pillar-ten-god、bazi:bazi-natal-ten-god、bazi:bazi-natal-element-count | 双方全局比劫、食伤强弱及应用条件 |
| BZ-M15 | 跨盘天干五合接触 | partial_facts_available | bazi:stem-combination、bazi:bazi-natal-contact | 全候选的干合稳定性与争合冲突审查 |
| BZ-M16 | 合化条件与合而不化 | partial_facts_available | bazi:stem-combination | 月令条件、根气有效性、合化判定与流派阈值 |
| BZ-M17 | 六合与受益方向 | partial_facts_available | bazi:branch-union、bazi:bazi-natal-contact | 六合受益、合绊与接收方结构 |
| BZ-M18 | 三合、三会、半合与拱合分级 | partial_facts_available | bazi:bazi-natal-contact、bazi:bazi-branch-arch | 三合、三会、半合与缺中支的拱合候选分别记录，未判断成局或合化。 |
| BZ-M19 | 六冲与冲动/冲去 | partial_facts_available | bazi:bazi-natal-contact | 六冲接触已实现，冲动、冲去或受损的条件规则尚未编码。 |
| BZ-M20 | 三刑与自刑 | partial_facts_available | bazi:bazi-natal-contact | 完整刑组和自刑流派细则 |
| BZ-M21 | 六害、六破及合破并见 | partial_facts_available | bazi:bazi-natal-contact | 合害破并见时的解释顺序与六破原始规则 |
| BZ-M22 | 争合、妒合与作用先后 | partial_facts_available | bazi:stem-combination、bazi:bazi-stem-competition | 争合候选已有参与人和柱位，作用先后与流派判据尚未编码。 |
| BZ-M23 | 双方大运并行与阶段错位 | not_implemented |  | 缺双方独立大运、边界和共同时间轴 |
| BZ-M24 | 流年触发与伏吟反吟 | not_implemented |  | 缺逐人的流年触发与伏吟反吟事实 |
| BZ-M25 | 双人关系事件窗口交叉 | not_implemented |  | 缺双人已定义的事件窗口及候选规则 |
| BZ-M26 | 六亲星宫与真实亲属双盘对照 | not_implemented |  | 缺亲属真实角色与逐角色映射规则 |
| BZ-M27 | 合作中的财印食伤官杀结构比较 | partial_facts_available | bazi:relative-ten-god、bazi:cross-pillar-ten-god、bazi:bazi-natal-ten-god | 明确合作角色、完整财官食伤印星以及领域桥接 |
| BZ-M28 | 朋友与同辈关系的双向角色假设 | partial_facts_available | bazi:relative-ten-god、bazi:cross-pillar-ten-god、bazi:bazi-natal-ten-god | 同辈角色及实际互动渠道 |
| BZ-M29 | 桃花等神煞附加核对 | partial_facts_available | bazi:cross-branch-natal-marker | 完整神煞名录、作用域和资格；只检索已提供的原盘神煞 |
| BZ-M30 | 生肖年命与纳音取象 | not_implemented |  | 缺独立生肖、年命和纳音规则适配 |
| BZ-M31 | 八宅命宫/三元年命配婚 | not_implemented |  | 缺版本化八宅命宫和三元年命规则 |
| BZ-M32 | 一方日柱对另一方年柱 | not_implemented |  | 缺双向日柱对年柱规则及原作者完整条件 |
| BZ-M33 | 盲派宾主、体用、做功及穿 | not_implemented |  | 缺足够一手定义、宾主体用规则及可复现个案 |
| ZW-M01 | 历法、安星与流派profile | not_implemented |  | 缺完整的相关输入事实、专用规则和复现测试。见本卡原始前置与限制。 |
| ZW-M02 | 命宫、身宫与全盘基线 | partial_facts_available | ziwei:ziwei-palace-by-branch、ziwei:ziwei-natal-palace | 命身和星曜事实已列出，格局及候选域判定尚未编码。 |
| ZW-M03 | 主题宫三方四正 | partial_facts_available | ziwei:ziwei-cross-palace-sector、ziwei:ziwei-natal-sector | 本人三方四正已计算，星系成格与吉凶规则尚未编码。 |
| ZW-M04 | 十四正曜与星系组合 | partial_facts_available | ziwei:ziwei-natal-palace、ziwei:ziwei-natal-sector、ziwei:ziwei-star-overlay | 缺完整的相关输入事实、专用规则和复现测试。见本卡原始前置与限制。 |
| ZW-M05 | 辅佐、煞曜、庙旺与格局反条件 | not_implemented |  | 缺完整的相关输入事实、专用规则和复现测试。见本卡原始前置与限制。 |
| ZW-M06 | 空宫与借星安宫 | not_implemented |  | 缺完整的相关输入事实、专用规则和复现测试。见本卡原始前置与限制。 |
| ZW-M07 | 对星、同度、会照与夹宫结构 | partial_facts_available | ziwei:ziwei-natal-sector | 缺完整的相关输入事实、专用规则和复现测试。见本卡原始前置与限制。 |
| ZW-M08 | 立太极与转宫的角色视角 | not_implemented |  | 缺完整的相关输入事实、专用规则和复现测试。见本卡原始前置与限制。 |
| ZW-M09 | 情侣/婚姻的夫妻宫主题与关联宫审查 | partial_facts_available | ziwei:ziwei-natal-palace | 缺完整的相关输入事实、专用规则和复现测试。见本卡原始前置与限制。 |
| ZW-M10 | 朋友关系的交友与自我/外界主题 | partial_facts_available | ziwei:ziwei-natal-palace | 缺完整的相关输入事实、专用规则和复现测试。见本卡原始前置与限制。 |
| ZW-M11 | 合作关系的财官—交友主题 | partial_facts_available | ziwei:ziwei-natal-palace | 缺完整的相关输入事实、专用规则和复现测试。见本卡原始前置与限制。 |
| ZW-M12 | 亲属角色的父母、兄弟、子女与田宅主题 | partial_facts_available | ziwei:ziwei-natal-palace | 缺完整的相关输入事实、专用规则和复现测试。见本卡原始前置与限制。 |
| ZW-M13 | 夫妻期待与对方命身星系的双向比较 | partial_facts_available | ziwei:ziwei-palace-by-branch、ziwei:ziwei-cross-palace-sector、ziwei:ziwei-natal-palace、ziwei:ziwei-natal-sector、ziwei:ziwei-star-overlay | 夫妻宫与命身星系的双盘前置和主题规则 |
| ZW-M14 | 双人主题与运限并列分析 | partial_facts_available | ziwei:ziwei-palace-by-branch、ziwei:ziwei-cross-palace-sector、ziwei:ziwei-natal-palace、ziwei:ziwei-star-overlay | 双方主题宫完整结构与各层独立运限 |
| ZW-M15 | 太岁入卦：对方出生年支在接收盘定位 | partial_facts_available | ziwei:ziwei-birth-year-overlay | 仅实现对方年支定位，完整入卦解释和变盘规则尚未编码。 |
| ZW-M16 | 跨盘四化与两向分算 | partial_facts_available | ziwei:ziwei-transformation-by-branch、ziwei:ziwei-palace-stem-flight-overlay | 作者的起化表、接收时间层、公共锚点及跨盘解释 |
| ZW-M17 | 本命与对方大限宫位的位置叠置 | partial_facts_available | ziwei:ziwei-cross-palace-sector | 缺大限层锚点与原案例重排条件 |
| ZW-M18 | 生年四化：本命标记 | partial_facts_available | ziwei:ziwei-transformation-by-branch、ziwei:ziwei-natal-transformation | 沿用快照原盘四化标记，其他起化来源需额外数据。 |
| ZW-M19 | 宫干飞化：宫位到星曜落宫 | partial_facts_available | ziwei:ziwei-palace-stem-flight-overlay、ziwei:ziwei-natal-flight | 沿用快照四化表作本人宫干飞化，完整流派解释尚未编码。 |
| ZW-M20 | 本宫宫干作用于本宫星的自化 | not_implemented |  | 缺原作者自化定义与派别审定 |
| ZW-M21 | 对宫引动、向心/离心及视同自化 | not_implemented |  | 缺原作者的箭头视角及向心／离心定义 |
| ZW-M22 | 生年四化与自化并存 | not_implemented |  | 缺完整的相关输入事实、专用规则和复现测试。见本卡原始前置与限制。 |
| ZW-M23 | 同三方及跨三方的互化家族 | not_implemented |  | 缺完整的相关输入事实、专用规则和复现测试。见本卡原始前置与限制。 |
| ZW-M24 | 紫云生年太岁卦象与变盘/变卦 | not_implemented |  | 缺紫云变盘、变卦的完整原作者算法 |
| ZW-M25 | 本命—大限—流年/流月分层叠盘 | not_implemented |  | 缺完整的相关输入事实、专用规则和复现测试。见本卡原始前置与限制。 |
| ZW-M26 | 多层四化触发与重点宫位 | not_implemented |  | 缺完整的相关输入事实、专用规则和复现测试。见本卡原始前置与限制。 |
| ZW-M27 | 双方时间窗口的并行核对 | not_implemented |  | 缺完整的相关输入事实、专用规则和复现测试。见本卡原始前置与限制。 |
| ZW-M28 | 候选时辰与定盘审计 | not_implemented |  | 缺枚举／区间证明引擎及独立定盘验证集 |
| WA-M01 | 分别建立本命关系背景 | partial_facts_available | western:western-matching-planet-angle、western:western-natal-placement、western:western-natal-axis、western:western-natal-aspect | 本人星位、宫主和相位已列出，完整关系主题解释规则尚未编码。 |
| WA-M02 | 第七宫、下降点与第七宫主 | partial_facts_available | western:western-house-ruler-overlay、western:western-natal-axis、western:western-natal-house-ruler | 下降点、第七宫与传统宫主已有事实，完整解释规则尚未编码。 |
| WA-M03 | 月亮、金星、火星的需求与表达 | partial_facts_available | western:western-natal-placement、western:western-natal-aspect | 缺完整的相关输入事实、专用规则和复现测试。见本卡原始前置与限制。 |
| WA-M04 | 水星、第三宫与沟通背景 | partial_facts_available | western:western-natal-placement、western:western-natal-house-ruler、western:western-natal-aspect | 缺完整的相关输入事实、专用规则和复现测试。见本卡原始前置与限制。 |
| WA-M05 | 土星与承诺、边界、责任 | partial_facts_available | western:western-natal-placement、western:western-natal-house-ruler、western:western-natal-aspect | 缺完整的相关输入事实、专用规则和复现测试。见本卡原始前置与限制。 |
| WA-M06 | 元素、模式与整体分布比较 | partial_facts_available | western:western-natal-distribution | 提供十颗天体等权计数，其他权重及流派解释需另定。 |
| WA-M07 | 跨盘主要相位矩阵 | partial_facts_available | western:western-matching-planet-angle、western:western-cross-aspect | 完整双盘容许度 profile 及候选域稳定性 |
| WA-M08 | 太阳/月亮跨盘组合 | partial_facts_available | western:western-cross-aspect | 限定日月星体及各自本命需求 |
| WA-M09 | 水星的跨盘沟通联系 | partial_facts_available | western:western-cross-aspect、western:western-whole-sign-overlay | 限定水星及第三宫面向、各自沟通基线 |
| WA-M10 | 金星/火星跨盘价值与行动联系 | partial_facts_available | western:western-cross-aspect、western:western-whole-sign-overlay | 限定金火及接收方价值、需求背景 |
| WA-M11 | 木星/土星与支持、资源、持续 | partial_facts_available | western:western-cross-aspect、western:western-whole-sign-overlay | 限定木土及受力方背景和具体资源 |
| WA-M12 | 外行星与个人点、代际背景 | partial_facts_available | western:western-cross-aspect、western:western-planet-to-axis | 限定外行星连接个人点并区分代际背景 |
| WA-M13 | 角轴交叉接触 | partial_facts_available | western:western-planet-to-axis、western:western-axis-aspect、western:western-natal-axis | 角轴稳定性、输入误差范围及可用方向 |
| WA-M14 | 双向落宫叠盘 | partial_facts_available | western:western-whole-sign-overlay | 接收盘可靠性、来源星位跨界检查、整宫制以外的口径 |
| WA-M15 | 宫主链及事业、资源主题定向 | partial_facts_available | western:western-house-ruler-overlay、western:western-house-ruler-aspect、western:western-ruler-to-ruler、western:western-natal-house-ruler | 接收方命盘及关系领域条件、守护和时间体系 |
| WA-M16 | 对方激活已有本命结构 | partial_facts_available | western:western-cross-aspect、western:western-natal-aspect、western:western-natal-activation | 提供接收方已有相位与外来接触的连接，复杂激活排序规则尚未编码。 |
| WA-M17 | 中点组合盘的星体计算 | partial_facts_available | western:western-composite-midpoint、western:western-composite-aspect | 仅计算短弧星位中点，180度歧义保留两分支；宫头属于另一项方法。 |
| WA-M18 | 组合盘宫头与参考地点变体 | not_implemented |  | 缺变体和参考地指定的组合盘角宫 |
| WA-M19 | 组合盘作为关系整体解读 | partial_facts_available | western:western-composite-aspect | 提供无歧义组合星位的相位，完整关系整体解释和宫位规则尚未实现。 |
| WA-M20 | 本命与组合盘交叉比较 | partial_facts_available | western:western-composite-natal-aspect | 提供无歧义组合星位与个人本命的相位，复杂结构解释规则尚未实现。 |
| WA-M21 | Davison 时空中点及变体 | not_implemented |  | 缺指定变体下的双方 UTC 瞬间、地理及校正 |
| WA-M22 | 个人行运与关系议题 | not_implemented |  | 缺个人行运和来源时间层 |
| WA-M23 | 行运触及关系整体盘 | not_implemented |  | 缺关系盘行运触发 |
| WA-M24 | 个人次限推运 | not_implemented |  | 缺次限和角轴变体 |
| WA-M25 | 次限比较盘与推运组合盘 | not_implemented |  | 缺推运与合盘运算次序及定义 |
| WA-M26 | 太阳弧方向 | not_implemented |  | 缺太阳弧钥及候选角轴 |
| WA-M27 | 个人太阳回归及其他回归 | not_implemented |  | 缺回归时刻、地点及指定变体 |
| WA-M28 | Davison 的回归与次限 | not_implemented |  | 缺 Davison 原盘和推运规则 |
| WA-M29 | 相识、婚礼、签约等事件盘 | not_implemented |  | 缺真实事件钟表、地点及盘型规则 |
| WA-M30 | 择时：婚礼、签约与合作启动 | not_implemented |  | 缺未来行动时间边界、地点及择时规则 |
| WA-M31 | 传统本命：条件、宫主、接纳与派别 | not_implemented |  | 缺所选传统学派的完整先决条件与适用范围 |
| WA-M32 | 传统跨盘日月、上升与福点联系 | not_implemented |  | 缺传统婚姻点、福点和派别定义 |
| WA-M33 | 年限法及其他时间主星 | not_implemented |  | 缺时间主星与年限法参数 |
| WA-M34 | 交点与演化占星方法 | not_implemented |  | 缺交点口径及完整作者规则 |
| WA-M35 | Chiron、Juno 与其他小天体 | not_implemented |  | 缺小天体星历、容许度及参考规则 |
| WA-M36 | 个人中点与中点接触 | not_implemented |  | 缺中点及直接／间接触发条件 |
| WA-M37 | 谐波及振动占星的关系扩展 | not_implemented |  | 缺谐波阶数、容许度及关系规则 |

## 后续与回退

Davison、运限、次限、太阳弧、回归及缺少完整定义的高级流派方法仅登记。后台快照依赖见 SNAPSHOT-ENRICHMENT-HANDOFF.md，完成后删除该交接单。

旧跨盘规则、原始词条、实例 ID 算法继续保留。新算法按独立规则名和版本追加，可通过 compareCharts 的 enrichComparison 调用整体回退，旧计算函数继续保留。

本轮所有改动都在 src/features/synastry/。提交与合入状态以 Git 记录为准。

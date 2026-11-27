# 四周期运势计算与事实层现状审查

核对基线为 `eff1751` 的运势子树及现有未提交改动。项目使用 npm、Expo、TypeScript 和 Node 模块测试。依赖、许可证和既有边界测试见 [运势现状审查](FORTUNE_CURRENT_STATE_AUDIT.md)。

| 规范范围 | 开工时覆盖 | 本轮补齐 |
| --- | --- | --- |
| 四周期与时钟 | IANA 公历窗口、DST、整周独立扫描、服务端校时 | 统一 ISO UTC 契约、明确各术段及边界来源。客户端校时后排盘并提交周期事实。 |
| 八字 | 四层流柱、六十甲子、参考时刻关系及条件大运 | 按窗口切段生成十神、藏干、本命及流限互动和条件大运关系 |
| 紫微 | 参考时刻六层盘、选定粒度的简表 | 原生日段及窗口流限完整结构、十二宫字段、分层四化、闰月边界 |
| 西方 | 跨体相位与入宫、入离相、固定容许度 | 可配置容许度、事件身份和经过编号、明确个人轴线及宫位权限条件 |
| 事实层 | 各算法的不同返回对象 | 原始记录、统一事实、引用和区间校验、方法状态、版本及可回放快照 |

账户现有公开归档提供记录 ID、归档时间和各术原始候选。没有独立出生资料 ID、出生资料版本、出生地时区／经纬度与大运正式规则。当前八字大运仍是显式顺逆候选，西方可靠宫位只使用已确认时间的兼容归档。审核文档放在运势模块内，便于与代码一起交接。

锁定的本地依赖为 lunar-javascript 1.7.8、iztro 2.6.5、Astronomy Engine 2.1.19，包均声明 MIT。沿用既有 IANA 民用窗口、账户归档、时间服务、节气干支、紫微原盘适配和西方数值搜索，依赖及锁文件未变。

| 交付项 | 状态 | 位置与验收 |
| --- | --- | --- |
| 时钟与展示窗口 | `implemented_and_tested` | `control/fact-time-context.ts`。独立取时、指定历史窗口、IANA、DST、跳日。 |
| 八字事实 | `partially_supported` | `control/bazi-calculation.ts`、`control/fortune-facts.ts`。立春、交节、23:00 换日、各段十神藏干及参与柱可追溯。大运为两种条件推算，合化、得令成局及正式起运配置待定。 |
| 紫微运限 | `implemented_and_tested` | `control/ziwei-flows.ts`。本命、大限、流年、流月、流日分别保存映射和四化。测试覆盖整周、闰月第 16 日和大限年龄切换。引擎没给出的宫位或四化来源字段标为部分可用。 |
| 西方行运 | `implemented_and_tested` | `control/solar-transits.ts`。十个行运体匹配本命十体、ASC 和 MC，容许度按相位、行运体及目标取最小阈值。测试覆盖时刻边界、入宫、逆行和多次精确经过。目前阈值是版本化项目配置，正式解释规则需要单独审核。 |
| 事实标准化与归并 | `implemented_and_tested` | `model/fortune-facts.ts`、`control/fortune-facts.ts`。所有输出引用原始记录，UTC 半开区间、版本、来源、方法状态和时间精度可核验。同一相位过程有独立标识，多次精确经过各有编号。跨窗口回查上限为 12 年，未找到实际入相时保留截断与部分状态。 |
| 历史快照和回放 | `implemented_and_tested` | `server/fact-service.mjs`、`server/index.mjs`、`server/resolve-fortune.mjs`。同一计算哈希的记录原子写入，按授权读取。客户端提交的记录按哈希校验，旧服务端记录按原时刻和原归档复算。部署前需配置私有数据目录、账户 URL、Web 来源。 |
| 独立周运 | `implemented_and_tested` | `fortune-facts.test.mjs`。直接扫描整周，覆盖节气及两个历法的本地日边界，固定输入的事实可复现。 |
| 按出生档案 ID 和资料版本取盘 | `blocked_by_missing_data` | 生产接口使用现有不可变账户归档 ID 并校验会话。所缺正式出生档案、资料版本、时区等关联见 [跨模块交接](FORTUNE_HANDOFF.md)。 |

`index.ts` 开放时间上下文、事实计算和校验。`view/FortuneCalculationView.tsx` 提供本地预览，`control/fortune-fact-submission.ts` 为解读和建议生成客户端提交批次。服务端匹配使用收录的标准化事实，方法存在缺失或条件推算时以状态和 warnings 为准。回归测试在 `fortune-facts.test.mjs`、`fortune-guidance.test.mjs`。

本轮运势 45 项、整仓 150 项测试通过，TypeScript 与模块边界检查通过。文件仓储及生产处理器使用隔离数据与授权替身测试，实际账户和启动器配置联调待执行。

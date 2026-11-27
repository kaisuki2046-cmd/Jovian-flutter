# 合盘单一资料库迁移

[合盘资料 JSON](synastry-knowledge.json) 共有 2,134 条。八字 290 条、紫微 686 条、西占 1,158 条。其中 2,126 条已参与自动匹配，8 条标记为 `unresolved`。

## 2.2.0 全量迁移

三份拆分库与合并库记录一致。2,073 个旧 ID 各迁入一次，引用的 129 段原文全部核对到旧库引文。原有 61 条保留原 ID 和状态。

| 术数 | 新增 | 新数字 ID |
| --- | ---: | --- |
| 八字 | 282 | `10001–10282` |
| 紫微 | 652 | `20001–20652` |
| 西占 | 1,139 | `30001–31139` |

`source.locator` 记录原书版本、章节、段落和旧库 ID。主引文照录到 `originalText`，旧库编写的现代解读照录到 `modernInterpretation`。当多个独立解读引用同一段文字时，各自保留条件和正文。原书与辅助引文的逐条对应见本地 `server/.local/v2-2-complete-migration-audit.json`。

迁移时先登记旧版条件。原文条件保存在 `matchConditions.original`，旧版事实类型、方向和字段候选值按原库 ID 可追溯。核对通过的条目已改用 `ready` 和 `alternatives`，参与匹配和内容评分校准。条目均可从服务端资料缓存按数字 ID 读取。

新库每条只填写一种关系。旧库已明确对应四类之一时沿用，否则依据旧主题从条目支持的关系中归类。导入的旧解读描述相处方式，使用 `personality`。

## 自动匹配启用

原来待核的 2,085 条中新启用 2,077 条。2,073 条旧库资料已逐组核对现行盘面字段、方向和条件值。八字按现行术语用「七杀」匹配旧称「偏官」，双方强弱条目核对两方日主、月令、根气和透干。紫微按现行宫名和四化表核对，具体主星组合按旧条目条件执行。西占的同名天体角距须另有同一对天体、同一组黄经及角距的跨盘相位支持。

- `1102` 与 `1103` 采用梁湘润六亲释例的限定条件。外冲取同一人的年干甲、月干庚、日干甲，内冲取同一人的月支戌、日支辰。A、B 各自的命盘分别核对。[《命学精华》六亲释例第 26 则](https://read01.com/zh-tw/d54MQ.html)
- `1018` 与 `1130` 采用本宫及三方四正的保守范围核对星曜排除。四份证据须对应同一人的同一宫位。本宫的武曲或巨门太阳同宫须先成立。四宫均核对羊陀火铃，`1018` 另核对破军、七杀。[《紫微斗数捷览》兄弟宫原文](https://www.tianjihq.com/en/learn/books/ziwei-jielan/101) · [《紫微斗数全书》卷二](https://zh.wikisource.org/zh-hans/紫微斗數全書/卷二)

待核的 8 条保存各自的缺口。包括十神判重和男女角色（`1014`）、复合合婚条件（`1015`）、歌诀星曜组合及煞曜范围（`1016`、`1017`、`1019`）、伴侣命位（`1104`）及跨盘推运（`2006`、`2007`）。

## 先期整理

- `1001–1019` 来自本轮开始时的现有资料。旧版 ID 与当前数字 ID 的对照在本地 `server/.local/schema-v1-ids.json`。
- `1101–1142` 取自三术原始库及可核对的原书。原始 `synastry-knowledge-base-{bazi,ziwei,western}.json` 与合并库 2.2.0 共 2,073 条编写记录、129 段来源。紫微夫妻宫原文按个人本命条件重写，单方本命命中保留在服务端证据。八字本命三合、六合组合按同一人的盘核对。[《三命通会》卷七](https://zh.wikisource.org/wiki/三命通會_(四庫全書本)/卷07) · [《紫微斗数全书》卷二](https://zh.wikisource.org/zh-hans/紫微斗數全書/卷二)
- `2001–2007` 补足西占亲情、友情和合作的原文解读。明确的落宫与相位使用当前计算规则。涉及双方推运的原文在同一库登记尚缺的时间与计算证据。[落宫原文](https://cafeastrology.com/articles/synastryplanetsinhouses.html) · [Lilly 转录本](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=152) · [托勒密卷四](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4B*.html)
- `1201` 采用《三命通会》卷二对命主原局六害的亲缘解读。该条件按各自原局分别匹配。[《三命通会》卷二](https://zh.wikisource.org/wiki/三命通會_(四庫全書本)/卷02)
- `1301–1311` 补入紫微本命夫妻宫的成对主星分句，以及兄弟、仆役、田宅宫的亲情和合作解读。廉贞庙旺分句在当前排盘亮度表下使用入庙条件。[《紫微斗数全书》卷二](https://zh.wikisource.org/zh-hans/紫微斗數全書/卷二) · [《紫微斗数捷览》卷二](https://www.tianjihq.com/en/learn/books/ziwei-jielan/101)
- `2111–2115` 补入西占的双向金月合相、太阳十一宫、月水六合、水金六合或三合、水星六宫。金月交换位置需要两条独立合相事实；水星六宫的沟通描述按行星和宫位所属方取用。[Lilly 转录本](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=152) · [太阳落宫](https://cafeastrology.com/articles/synastrysuninhouses.html) · [月水相位](https://cafeastrology.com/synastry/moon_mercury_aspects.html) · [水金相位](https://cafeastrology.com/synastry/mercury_venus_aspects.html) · [水星落宫](https://cafeastrology.com/articles/synastryplanetsinhouses.html)

仍有歧义的原文保留明确的待核原因，例如煞曜会照范围、内冲与外冲、推运应期。卯酉年与子午月的合婚辨析沿用已核实的分支，数字录文中另一个涉及己／巳异读的分支留待校勘。太阳单守的现代条目按引擎可达的旺位匹配，太阳在卯入庙时按实际同宫处理。[《欽定協紀辨方書》原文](https://www.shidianguji.com/zh/book/SK1619/chapter/1l9lm21xfewpb)

先期以直接关系原文筛选的记录见本地 `server/.local/v2-2-source-migration-audit.json`。完整原库路径、版本和用途见本地 `server/.local/schema-source-audit.md`。旧拆库、早期推演和方法资料保存在 `server/.local/synastry-before-legacy-retirement.zip`，成员校验和在同目录的 `synastry-before-legacy-retirement.sha256`。

## 运行迁移

服务启动时由唯一资料文件建立 SQLite 缓存，`claim_entry.id` 与条件外键改为整数。旧合盘知识缓存按版本及内容指纹在事务内重建。已有的账户合盘报告继续从原归档读取。方法诊断保留在 [TypeScript 登记](../../model/method-diagnostics.ts)，排序分由服务计算。

本地可用以下命令查看条目、编译状态和选材分数。`--knowledge-claim` 直接传数字 ID。

```powershell
node src/features/synastry/server/summary.mjs --knowledge-claim 1001
node src/features/synastry/server/summary.mjs --knowledge-claim 10001
node src/features/synastry/server/summary.mjs --knowledge-stats
node src/features/synastry/server/summary.mjs --knowledge-scores "C:/path/to/score-audit.json"
```

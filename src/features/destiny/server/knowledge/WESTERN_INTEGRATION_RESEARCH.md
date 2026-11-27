# 西占专用条件接入研究

状态：Regiomontanus 几何计算、莉莉本命宫位／传统宫主和明确相位已在工作分支接线；其他专用流派条件仍在研究。不改变原始 Claim 的机器条件，不以现代默认值替代历史学派条件。

## Lilly 智识：水星混合条件

2026-11-18 已查看资料库直接引用的 [Wellcome Collection 1647 初版第 545 页影印](https://iiif.wellcomecollection.org/image/b30338724_0579.jp2/full/1800,/0/default.jpg)，页上标题与页码清晰。缓存位于忽略的 `.local/research/lilly-1647-p545.jpg`，不提交影印图。

涉及 `astro-lilly-v3-wit-p009-001` 至 `p014-001` 的 `profiles.lilly.wit.mercury_mix.*`。该页先讨论水星的东方／西方、所处位置的主宰影响、是否受损、角宫与运动等，再列与其他行星混合的简短判断。不能仅从简短的「with」推断本项目通用六度相位必定等同该节的历史取法；当前原始条件和限制也明确要求按同一对象及本章其他见证合读。

下一步需核对该章前页及作者关于相位、容许度、接纳和混合的定义，确认哪些事实必须同时提供、哪些只是额外修饰。依据明确前保持 `unsupported_calculation_profile`。不把「水星与某行星都在盘中」或任意现代相位当作联结成立。

## 其他尚需实现的依赖

- 默认排盘仍采用整宫制；指定 Regiomontanus 的记录已接独立的宫位计算与版本标记，不能复用整宫制宫位数字。
- `profiles.ptolemy.soul_sign_classes.*` 的条件要求先确定承担性情判断的星体及主宰，不能仅因全盘存在某一类星座而命中。
- 健康、婚姻、职业等历史专用配置各有选取对象和适用分支，应逐套核对；资料里的 `ready` 不表示本项目已经实现这些计算。

这些依赖不阻止继续接入其他已有明确、可核实条件的条目。进度统计仍以 SQLite 审计为准。

## Regiomontanus 计算与接线

2026-11-18 核对 [Swiss Ephemeris 官方说明 6.2.3、6.4、6.5](https://www.astro.com/ftp/swisseph/doc/swisseph.htm)：该宫制由赤道等分点与地平南北轴确定的大圆投影至黄道；极区可能发生宫序反向，天体三维宫位也不一定等同图上黄经所在宫。它与现有整宫制不是同一组宫头及落宫数据。

`control/regiomontanus.mjs` 是独立向量几何实现，配有 `.d.mts` 类型声明，以兼容现有 Expo 和 Node 入口；没有复制或导入 Swiss Ephemeris 的运行代码，没有增加生产依赖。区分宫头、三维天体宫位和明确标注的零纬度黄经落宫函数；生产接线使用包含天体纬度的三维函数。未验证的反向宫序返回不可用，不偷偷替代为其他宫制。

7 项计算测试已通过，包含赤道投影、大圆约束、对宫、三维与高赤纬投影、宫界、无效输入，以及独立数值基准。独立参照为 Swiss Ephemeris 2.10.03，通过仅用于开发验证的 `swisseph-wasm@0.1.0` 调用 `houses_armc`、`house_pos`、`houses`；验证包已清理，不进入生产依赖。可审查数值保存在 `control/regiomontanus-reference.json`。

25 组宫头与 525 个含纬度落宫结果匹配独立参照，宫头最大误差约 `1.14e-13` 度；另对 4 组真实时间、不同经纬度的完整排盘核对，宫头最大差约 `4.21e-5` 度，测试容差 `1e-4` 度。后者包括当前天文引擎与参照引擎在恒星时及坐标变换方面的细小差别，不能将纯几何误差当作整套星历的误差。

当前数据链路：

1. 真实出生时刻和地点驱动计算，原整宫制字段和默认展示保持原状；额外结果带 `regiomontanus-3d-v1` 计算版本。
2. `western_profile_system`、`western_profile_planet_house`、`western_profile_house_sign` 独立标记事实。条件编译按每个 include 分支的明确宫制选择字段；排除条件在同一宫制内证明，不能借用整宫制的存在或不存在。
3. 模型输入将默认事实与「雷吉奥蒙塔努斯独立宫制事实」分组，使用中文名称；未知时间、旧归档或不可计算纬度不补造这组事实。
4. 第四批接通的 35 条后来在第六批按下述莉莉本命判读规则复核、修正。几何三维事实与数值基准仍保留，相关原书规则不再直接借用几何落宫。更新后的实际排盘命中证据见 `claims/regiomontanus-witnesses.json`。

## 第六批：莉莉宫位判读与传统宫主

已目验 [1647 初版 p.104 庙主表](https://iiif.wellcomecollection.org/image/b30338724_0138.jp2/full/1800,/0/default.jpg)，核对十二座的传统七曜庙主。宫主由宫头星座的庙主确定，不用擢升主、界主、综合尊贵最高者或现代外行星替代。定义另见 [第一卷 p.123](https://worldastrology.net/wp-content/uploads/2008/12/CA-I.pdf#page=143)。

原书 [第一卷 p.33](https://worldastrology.net/wp-content/uploads/2008/12/CA-I.pdf#page=53)说明宫头附近五度的效力归属；[第三卷 p.552、565](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=66)进一步将本命宫区间写为本宫头前五度起、下宫头前五度止。因此第四批直接使用三维落宫来匹配莉莉本命条目的做法需要修正，不能将 Swiss 几何基准通过等同于历史判断口径已验证。

现行独立口径 `lilly-1647-longitude-five-degree-v1`：

- 使用实际 Regiomontanus 宫头和行星黄经，按宫头前五度的区间判宫；实际三维几何落宫、整宫制及其字段保留。没有把天体纬度投影或默认六度相位混入该历史判宫规则。
- 传统宫主依十二座固定庙主表选择，然后在同一历史口径中判定该主星所入宫。水瓶取土星、双鱼取木星、天蝎取火星，不新增现代共主。
- 新增可审查的宫头／天体黄经，以及明确标记的历史判宫、宫主身份、宫主入宫字段。报告入口和 SQLite 匹配入口均从数值事实重算历史结果，不接受孤立的客户端派生标记或伪造的排除证明。
- 精确宫头不全、同一宫头或同一天体存在冲突数值、宫头星座投影矛盾时不补造相应结果。旧资料缺少精确宫头时不从整宫制反推；未知时间时去掉数值、宫位和历史派生事实。
- 原书男女婚姻分支只由明确提供的出生资料性别选择；缺失、其他或互相矛盾时不选该分支。前端请求已同步传递明确性别，未读取账户内部资料。
- `Christian Astrology` 中明确指定 Regiomontanus 的条件使用这一历史判读标记；通用几何条件仍使用几何字段。模型事实分别列为「雷吉奥蒙塔努斯独立宫制事实」和「莉莉本命宫位与宫主判读」，不让同一个宫号隐含两种含义。

本批新增可匹配 32 条（30 条所有备选已覆盖，2 条仅已支持部分备选），并修正原有 35 条的条件映射。原 Claim JSON、ID、原文和出处未改。`travel-p001` 的宫主合相分支、`spouse-description-p051` 的界与相位分支继续保留 `remainingAlternatives`，仍列入待办，未借用普通相位冒充已实现。

全部 67 条均以真实出生时刻、地点驱动排盘，验证 SQLite 命中和报告取材，见 [第六批排盘证据](claims/integration-batch-6-witnesses.json)。边界测试另核对宫头前五度、过零、非等距宫头、十二座庙主、缺失与冲突输入；有针对性的反例检查派生标记、排除证明、性别、时间和旧归档。其余 3,238 条 `unsupported_calculation_profile` 仍未接通。

## 第八批：明确相位与两套容许度

已目验 [1647 初版 p.107](https://iiif.wellcomecollection.org/image/b30338724_0141.jp2/full/1800,/0/default.jpg)，并对照 [第一卷 pp.105–109 转录](https://worldastrology.net/wp-content/uploads/2008/12/CA-I.pdf#page=125)。原表列出两组行星容许度，作者说明两者都会使用。成相取双方容许度各一半相加，与精确相位的角距误差比较。

| 行星 | 首列 | 另一说 |
| --- | ---: | ---: |
| 太阳 | 17° | 15° |
| 月亮 | 12°30′ | 12° |
| 水星 | 7° | 7° |
| 金星 | 8° | 7° |
| 火星 | 7°30′ | 7° |
| 木星 | 12° | 9° |
| 土星 | 10° | 9° |

实现 lilly-1647-two-orb-tables-v1 分别计算两套结果，匹配合、六合、刑、拱、冲及善相。原文 p.106 将善相联系到六合与拱，相伴合相的性质另论，因此没有把所有合相并入善相。

同一完整 include 分支与其所有排除条件使用同一套表，避免从一套取肯定、另一套取否定来拼凑成立。两套都成立时保留各自证据；若只有一套满足整组条件，报告材料与单条解释会注明其依赖的口径。保留原始机器条件与 ID，未通过改动源 JSON 消除版本差异。

实际查询从 SQLite 条件字典取得本库所需的相位选择器，按确认的天体黄经计算。宫主选择器在同一张盘的已核宫头中解析；不同角色若指同一颗星，不当成两颗星合相。仅在排除条件出现的选择器也进入字典，缓存随来源摘要更新。运行时不扫描原始 Claim 数组，也不把完整相位矩阵塞入客户端请求或模型事实。

坐标缺失、同一天体有冲突坐标或宫主不能确定时，既不判有相，也不判无相。孤立传入的历史相位标记及其缺席声明不会替代数值计算。未知时间缺少确定数值时不启用相应条目。

本批新增可查询 40 条，其中 35 条原列备选全部可计算，5 条仍有未支持的备选；另补齐第六批 travel-p001 的宫主合相分支。全部 41 条均以真实出生时刻、地点驱动排盘进入 SQLite 查询及报告取材，见 [第八批证据](claims/integration-batch-8-witnesses.json)。其中三重金星合相样例为 2021-02-11T00:00:00Z，月亮一宫对冲七宫太阳且刑四宫木星样例为 1981-01-19T08:00:00Z，均为测试生成的资料，不是用户个人命例。

any 是否包含合相依具体语境继续待核；partile 的精确口径、角点与交点相位、入相／分离、互容、界及其他专用判断仍有独立依赖。当前尚有 3,198 条 unsupported_calculation_profile；已索引记录也可能有未实现备选，须以逐条审计为准。

## 第十三批：尊贵原表的计算用途

2026-11-19 复核 [1647 初版 p.104 原表](https://iiif.wellcomecollection.org/image/b30338724_0138.jp2/full/1800,/0/default.jpg) 与 [p.112 漂泊定义](https://iiif.wellcomecollection.org/image/b30338724_0146.jp2/full/1800,/0/default.jpg)。导入库中 1659 版 144 条原表资料现被构建为 SQLite 的 160 个计算单元，以原 ID 追溯；从 SQL 按星座和度数取值。七曜的五项本质尊贵、失势、落陷、漂泊已实际接入，原表区间和昼夜三分主经独立转录核对。两条新个人解读与 144 条计算资料分别统计，当前缺专用计算口径为 3,196 条。

新增记录只落实明确命名天体的必要事实，不默认激活 `context.lilly_dignity_table`，也不把查表目标设为全部星体。未知昼夜分别算两种，只有一致值可作证；原表 D/N 庙座说明不误读为昼夜资格，特殊擢升度数不收窄整座。整体强弱、接纳、未明确对象及综合取主仍未实现，8 条已索引但有未支持备选的记录继续保留待办。详见 [尊贵算法与边界](LILLY_DIGNITIES.md)。

## 第十四批：明确接纳与角色关系

本批接通基于原表的定向接纳与明确互容，并落实宫主、光体定位星及有明确 OR 语义的聚合。p.544 月亮按庙／擢升接纳水星、p.567 双宫主互容、通行 p.575 的日／月或其定位星互容均有原图核对；p.569 与 p.607 的已明确相位／庙位分支可用，一般接纳范围仍待核。p.593 的土星界作用范围未猜测启用。

新增 5 条、补齐已有远行 1 条，18 个去重后的新增输入均有实际排盘到 SQLite 与报告证据。当前西占 306 条进入索引，3,191 条仍缺专用计算或查询上下文；部分备选共有 9 条（补齐一条、新增两条部分记录）。语义、逐页出处、服务端重算和未完成依赖见 [接纳与互容](LILLY_RECEPTIONS.md)。

## 第四十三批·月交点和原书落宫

莉莉卷一 p.44 的北交点例说明交点可顺行或逆行。项目据此选用现代瞬时轨道交点作为本轮计算口径。用 Astronomy Engine 的地心月球位置与速度确定瞬时轨道面，旋转到当日黄道坐标，再取升交方向的黄经。南交点为对径。此口径独立于莉莉时代星历的数值近似。用现代独立星历的四日取值和月球实际升、降交时刻核对。 [莉莉卷一 p.44](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=64) · [Swiss Ephemeris 交点定义](https://www.astro.com/swisseph/swisseph.pdf) · [Astrodienst 2000 年星历](https://www.astro.com/swisseph/ae50/ae__50_2000.pdf?cmn=ceba26)

后端只接受已知出生时间的带版本北交黄经事实，并从完整宫头重算两交点落宫。宫头前五度影响宫位，星座仍按交点本身黄经确定。冲突坐标、旧盘缺坐标和缺宫头都不触发交点规则。交点独立于传统七曜和现有十颗天体的位置、尊贵计数。

| 原书出处 | 已接入条件 | 条件组 |
| --- | --- | ---: |
| p.567，CXX 亲属 | 南交落第三宫；另一条同时验证实际二宫主燃烧 | 2 |
| p.586，CXXX 家务／用工 | 南交实际落第六宫，且在原列风象或火象六座之一 | 6 |
| pp.634–635，友伴 | 北交的一、十一宫落点分别配原书两组各六座；南交单核实际一、十一宫 | 26 |
| p.612，CXLII 信仰取象 | 补现有条目的北交第三宫、北交第九宫，保留原木星、金星四组 | 2 |

友伴三条现有宫内备选可用，交点照见第十一宫或其主的取证仍待核。交点合相容许度、角点接触及历史专用上下文仍待核。四条其他源记录已识别交点位置条件，仍有独立前提未落实。检查 22,784 张原生盘，选取 [35 份排盘样例](claims/integration-batch-43-witnesses.json) 覆盖 36 组。 [卷三 p.567](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=81) · [p.586](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=100) · [p.612](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=126) · [pp.634–635](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=148)

## 第四十四批·莉莉入相与离相

取出生时刻黄经和前后各半小时的有向位移，核对合相、六合、刑相、拱相、冲相是否仍在双方半径之和内。原书两套容许度各自成组，所有要求同时满足的位移及方向都须用同一套表。入相须当用星自身朝精确角度移动且双方角差收窄。同向时核对轻快星朝重慢星；一顺一逆时按双方实际移动重算。离相须当用星自身远离且双方角差扩大，至少已离开精确角度六角分。逆行离相另须当用星确实逆行。精确成相、停滞、位移不明或记录冲突时没有可确认的阶段。此算法核对当前趋势，未来能否成相、第三星先至和入相后掉头仍待另算。 [卷一 pp.107–108](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=127) · [p.110](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=130)

| 原书段落 | 已接入的判据 | 条件组 |
| --- | --- | ---: |
| p.564，财富持续 | 日、月分别向实际在角宫或果宫的行星入相，两条独立查询 | 4 |
| p.586，家务／用工 | 水星逆行或燃烧，且向实际落固定座的土星或火星入相 | 32 |
| pp.635–636，友伴 | 十一宫主从上升主离相；另两条核对十宫主或上升主自身逆行而离相 | 6 |

已有静态相位与两套容许度仍按原规则计算。本批短窗位移独立于快慢行使用的 24 小时位移。宫主和目标落宫按莉莉宫头前五度规则重算。两角色落在同一星时不形成两星相位。扫描 56,737 张原生盘，选取 [23 份样例](claims/integration-batch-44-witnesses.json) 核对 42 组条件。 [卷三 p.564](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=78) · [p.586](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=100) · [pp.635–636](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=149)

## 第四十五批·入相目标、星座与宫类

| 原书段落 | 已接入的判据 | 条件组 |
| --- | --- | ---: |
| p.592，男命婚姻格言 | 月亮所入相的同一颗行星在双体座；另一条要求月亮也在多产座，并把目标范围扩为多产座或双体座；第三条在后者基础上还核对第七宫头与实际宫主的星座 | 36 |
| p.601，女命婚姻格言 | 太阳与火星各有一条双体座备选。使用已确认的性别与星座，保留原句的任一条件 | 2 |
| p.620，上升主格言 | 上升主分别居角宫或续宫，并向处在自身擢升座的同一颗目标行星入相 | 28 |

双体座取双子、处女、射手、双鱼，多产座取巨蟹、天蝎、双鱼。第七宫头直接按宫头黄经分类，第七宫主另查传统庙主的实际位置。上升主的宫类由宫头前五度规则算出的落宫确定。婚姻格言只用于报告中的原书关系主题，保留原文出处及历史取象说明。 [卷一 p.89](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=109) · [卷三 p.592](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=106) · [p.601](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=115) · [p.620](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=134)

沿用两套容许度核对当前入相趋势。扫描 47,849 张原生盘，选取 [35 份样例](claims/integration-batch-45-witnesses.json) 覆盖 66 组。卷三 p.628 职业段所说的入相星座是否指相位完成时的星座，仍待核对。 [卷三 p.628](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=142)

## 第五十九批·莉莉第115页强弱计分

统一 SQLite 为原表前 38 行保留出处、权重与并列条件。按行星分别核对尊贵、失势、互容、落宫、运动及受照等事实，符合原表同一行的多个条件只记该行一次。出生时刻不确定时，已确认的星座仍可用于部分尊贵、失势及互容判断。需要精确黄经、宫位或速度的分项须有对应证据。日心、燃烧和日光束内按实际日距择一取用。 [1659 年版卷一 p.115](https://archive.org/download/bim_early-english-books-1641-1700_christian-astrology-_lilly-william_1659/page/n146.jpg)

精确相位核对实际角距的度与角分，并要求两颗不同的星体。交点沿用真北交点及相隔 180° 的南交点。土火夹制覆盖卷一所举的两凶星同座夹住另一星的情形。 [卷一 p.106](https://archive.org/download/bim_early-english-books-1641-1700_christian-astrology-_lilly-william_1659/page/n137.jpg) · [p.108](https://archive.org/download/bim_early-english-books-1641-1700_christian-astrology-_lilly-william_1659/page/n139.jpg) · [p.114](https://archive.org/download/bim_early-english-books-1641-1700_christian-astrology-_lilly-william_1659/page/n145.jpg)

扫描 8,614 张原生盘，保留 [20 份排盘样例](claims/lilly-fortitude-witnesses.json) 覆盖 38 条。报告只列已核对的分项及原表权重。

## 第六十批·莉莉强弱表的恒星分项

卷一第 115 页末三行分别对应狮子心 Regulus、角宿一 Spica、大陵五 Algol。采用 Hipparcos 新归算的 HIP 49669、65474、14576，取 J1991.25 星表位置和自行，按出生时刻校正地心视差与周年光行差，再用 Astronomy Engine 旋转到当日真黄道。原书标注的 17 世纪度数保留在出处中。 [卷一 p.115](https://archive.org/download/bim_early-english-books-1641-1700_christian-astrology-_lilly-william_1659/page/n146.jpg) · [三颗星的 Hipparcos 记录](https://vizier.cfa.harvard.edu/viz-bin/asu-tsv?-source=I%2F311%2Fhip2&-out=HIP,RArad,DErad,Plx,pmRA,pmDE&HIP=14576,49669,65474) · [Astronomy Engine 接口](https://github.com/cosinekitty/astronomy/blob/master/source/js/README.md)

狮子心及角宿一两行只写合相，当前取同度同分可确认的情形。大陵五按原表取两者黄经短弧不超过五度。三个分项只用于本命计分，有矛盾、无精确坐标或未知出生时刻时跳过对应分项。卷三其他恒星条目仍按各节独立核对。

三份原生排盘覆盖三项及其报告权重。六个日期的 18 个星位以 Swiss Ephemeris 2.10.03 的 `swe_fixstar2_ut` 独立核算，最大差值约 0.12 角秒。参考数值及排盘样例保存在本模块。 [样例和星历数值](claims/lilly-fortitude-witnesses.json) · [Swiss Ephemeris 接口文档第 6 节](https://www.astro.com/swisseph/swephprg.htm)

## 第六十七批·卡尔达诺日月第四档

卡尔达诺 1578 年译注 p.436 的第四档比较两个星座阴阳相反的光体。阳性座光体入角、阴性座光体离角为第一种，角位对调为第二种。资料库 p033、p034 的两条分别指定太阳阳性、月亮阴性。本批按指定对象核查两种盘式，并保留各自原文。 [卡尔达诺译注 p.436](https://ptolemaeus.badw.de/print/12/3/text/4#436)

星座阴阳按热带黄道自白羊起交替。宫位采用项目已有的三维 Regiomontanus 结果，第一、四、七、十宫为角宫。这个实现选择参考卡尔达诺撰写托勒密译注时期采用 Regiomontanus 的考证。日月各须有唯一的确认黄经与落宫，未知出生时刻或数据矛盾保留未命中。 [校注中的宫制考证](https://skyscript.co.uk/cardan_first.pdf#page=8)

上海坐标的 1990 年 3 月 28 日 14:15 UTC 原生盘，太阳四宫、月亮五宫，命中 p033。当天 16:15 UTC 的太阳三宫、月亮四宫，命中 p034。两盘都验证了 SQLite 查询、单条解释和报告取材。日月同角、同离角、数据缺失和非本命盘均验证无命中。 [排盘和端到端测试](cardano-dignity.test.mjs)

五星伴随、伴随星与角位的联系、右相及历史命例继续按各版原文核对。Hübner 排的是日月整体的五星关系，Robbins 英译的表述强调当派光体。 [Hübner 希腊正文 IV.3](https://ptolemaeus.badw.de/edition/9/27/text/1) · [Robbins 英译 IV.3](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4A%2A.html)

## 第六十八批·莉莉远行见证

先按卷三 p.606–607 核对远行的肯定见证。复用第一、九宫主的实际宫位和合相、月亮与水星的合相或互容、日月水星的本庙或接纳关系。新增月亮或水星与第一、九宫主合相或受接纳，以及月亮或水星落第一、三、九宫或在对应宫头具本质尊贵的见证。尊贵从统一 SQLite 读取莉莉原表，接纳读取同一星位上的庙、擢升、三分、界、面。 [卷三 p.606–607](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=121)

确认至少一项见证后，以参与见证的行星、第九宫主及第九宫内传统行星作为当前指征。相同的行星只计一次。后续分支要求七曜和宫头齐备，两套合相容许度各自计算，活动座或固定座分支要求所选指征一致。 [卷三 p.607](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=121)

方位先按原书所列指征星及其四元素分别提供证据。与日、月合相且未确有本质尊贵的水星不提供方位见证。阿本罗丹的转引另核日月是否同在指定的东西半区。陆路、水路按指征星严格过半计算，平票时两条均无匹配。四足、人形按卷一通用星座表核对所选指征。 [卷三 p.608](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=122) · [卷一 p.89](https://en.wikisource.org/wiki/Page:Christian_Astrology_(Lilly,_1659).djvu/114)

旅行原因按 p.609 核对指征星实际在第一、二宫，以及土星或木星本身是指征、与指征合相或在指征星位具尊贵的情况。木星沿用紧接的土星判据。多项见证并存时报告逐项引用。方位总票决、未量化的「多数行星」起证、地名对照与障碍细则继续待核。 [卷三 p.609](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=123)

从 319 张候选盘中选出 [10 份原生排盘](claims/integration-batch-68-witnesses.json)，覆盖 25 条资料的 58 组条件。

## 第六十九批·托勒密父母篇的日月伴随和昼夜指征

Hübner 希腊校勘本的父母篇编号为 III.5，Robbins 英译为 III.4。p001 分别核对太阳与月亮，每个光体均须有吉星和同派星见证，两类见证可以来自不同的伴星。p002 按资料库对 Robbins 英译该条的整理，要求每个光体各有一颗同时满足两类条件的伴星。原文另列的日晨星、月昏星及日月位置有利是加强条件，留待单独计算。 [Hübner 希腊正文](https://ptolemaeus.badw.de/edition/9/27/text/1) · [Robbins 英译父母篇](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/3A%2A.html#4)

p024 依据资料库收录的 Allacci 拉丁译文，太阳和月亮各有吉星或同派星见证即可。西占本命报告的 `chartQueries` 或知识库命令行查询可带 `"ptolemyParentAttendanceText": "allacci_latin"`，明确选用该译本。常规查询默认使用希腊校勘本，同时检索满足 p002 的英译条目。这里的选项只切换日月伴随条件。 [Allacci 1635 年印本](https://ptolemaeus.badw.de/print/22)

位置按热带黄经取光体同座或按黄道顺序紧邻的下一座，包含双鱼到白羊。各光体须有唯一、与所报星座一致的确认黄经。伴随见证采用日月之外的传统五星，吉星取木星与金星。太阳与昼派星同派，月亮与夜派星同派。水星以相对太阳的短黄经弧判定晨昏，晨星列昼派，昏星列夜派，精确合日时不定派别。水星的条件性吉凶及光体互伴继续待核。 [Robbins 英译第一卷第五、第七章](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/1B%2A.html)

p008、p009 用本命昼夜确定本次优先观察的指征。昼盘对应父方太阳、母方金星，夜盘对应父方土星、母方月亮。两颗自然指征仍保留在原文说明中。未知时刻、矛盾昼夜、缺失星位与非本命时间层均有回归样例。空行、实际升起先后、福点同意、派生盘及其余父母篇条件仍待核。 [排盘样例](claims/integration-batch-69-witnesses.json) · [端到端回归](ptolemy-parents.test.mjs)

## 第七十七批·莉莉手足篇分类、第三宫宫主与居角尊贵

卷三第 565–566 页以第三宫、宫主、该宫内的传统星曜，以及火星和月亮的一般指征为起点。以热带黄道的 Regiomontanus 宫头求第三宫传统庙主，按距该宫头前五度至下一宫头前五度的区间核对落宫。p012–p023 的分类取第三宫头或已确认的所选行星星座。p024–p030 按实际参与的星体提供性质见证。南交按现有计算剖面的真交点，落在第三宫时才采用。 [卷三第 565–566 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=79) · [第 567 页南交落第三宫](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=81)

p003、p032 按第 568 页的并列句读，核对第三宫头和宫主实际所落的星座是否同属本篇明确列出的类别。多产座取巨蟹、天蝎、射手、双鱼。少产座取双子、狮子、处女。白羊、摩羯的偏少产，以及金牛、天秤、水瓶的偏多产仍可各自提供对应的分类条文。p037、p038 要求同一颗土星或太阳同时入第一、四、七、十宫之一，并在其星位拥有庙、擢升、昼夜相应三分、界、面至少一项本质尊贵。尊贵沿用统一 SQLite 的莉莉原表。手足人数、出生次序和生活境遇作为原书历史取象。 [卷三第 568 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=82)

四份上海坐标的原生排盘覆盖 23 条资料，逐条验证 SQLite 命中、单条解释和报告取材。回归用例还核对五度分界、出生时刻未知、黄经与星座冲突、宫头缺失及客户端直接传入派生值。第 031 条的北交纳入须明确选择原书所记的另一说。水星随相位改变性质、指征多数、亲属数量细分和其余手足篇规则继续待核。 [排盘样例及测试](lilly-siblings.test.mjs)

## 第七十八批·莉莉第二宫财富指征与财源词列

第 552 页按热带黄道 Regiomontanus 宫头确认第二宫主。截夺座核对整个星座处于第二、三宫原宫头之间，第二宫内行星的观察区间从第二宫头前五度至第三宫头前五度。候选星比较与宫头的最短黄经距离，须有两颗或以上且距离不全相同。福点沿用已落地的计算，另取其传统庙主，木星为一般指征。同一行星承担多个角色时只计一次。第 553 页关于指征可出自吉星或凶星的两组条件要求七曜黄经、宫头和福点齐备。 [卷三第 552 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=66) · [第 553 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=67)

第 555–559 页的事项、人物、四元素和十二宫词列，按已选行星及其落座、落宫分别匹配。福点用于该章取证，词列中的落宫条件核对行星。词列保留为历史主题，现实收支、职业和人物性质按实际资料判断。原书有关财富高低、指征强弱的格言仍待核算，其中第 553 页的过半居角且有本质尊贵，需要进一步确认福点如何计入整组判据。 [卷三第 555–559 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=69)

四份上海坐标的原生排盘覆盖 38 条资料及全部 39 组条件。另验证了福点与行星落宫的区别、五度起点、候选同距、冲突黄经、资料不足和伪造派生值。 [排盘样例及测试](lilly-wealth-sources.test.mjs)

## 第七十九批·莉莉第五宫子女指征与亲子相位

卷三第 602–603 页取第一、第五、十一宫。宫位沿用热带黄道 Regiomontanus 五度规则。木星、金星、月亮、北交和土星、火星、太阳、南交分别对应本篇的两类指征。交点用实际真交点核对落宫。第 602 页规定三处均无行星时改取第五宫主，需要传统七曜可靠的黄经及落宫才可证明空宫。第 603 页第五宫正向与十一宫反向的比较分别核对两宫行星。p046–p048 的库内记录与本次可查转录在宫位上有出入，留待印本原页对校。 [卷三第 602–603 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=116)

卷一第 89 页的多产座为巨蟹、天蝎、双鱼，少产座为双子、狮子、处女。星体性质与落座同时检查同一对象。第 604 页的宫头组合分别核对上升、第五宫宫头和第五宫主落座。金星与月亮分别核对第五宫落点及多产座。全盘条件逐一确认七曜星座。第 605 页的分组权重仅查第五、十一宫内的多产行星，按源记录明确的排除条件，两种性质重合的双鱼不归入这两个互斥分支。 [卷一第 89 页](https://en.wikisource.org/wiki/Page:Christian_Astrology_(Lilly,_1659).djvu/114) · [卷三第 604–605 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=118)

第一、第五宫主分别核对六合或拱相、刑相或冲相，两套莉莉容许度独立计算。水星先核实属于当盘本篇指征，再按原书搭配其日相方位和与指定星体的相位。西方水星的配置按本篇明确提到的合相或四种主要相位分别核对。第五宫主逆行要求星体及其运动一致。报告中的性质、数量权重和相处格言作为古籍取象。水星取性优先级、历史命例、整体强弱与原书未明确阈值的数量比较仍待核。 [卷一第 106 页相位释义](https://oss.azoth.work/mooc/pdf/c90fde4965c388fb/Christian-Astrology-1647-Digital-Version.pdf) · [卷三第 603–605 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=117)

八张上海坐标原生排盘覆盖 19 条资料与 42 组条件。另用相互冲突或缺失的数据验证空宫、同对象条件与逆行，检查双鱼重合组和直接传入的计算结果。 [排盘样例及测试](lilly-children.test.mjs)

## 第八十二批·莉莉智识篇水星、水月与地平

CIX 开头以水星及水月关系取证。白羊水星获火星接纳的条文保留定向的庙位接纳和水星向火星入相，两套莉莉容许度各自匹配。六条水星混合格言只在相关星体实际形成合相时取用。风象多数须有四颗不同的古典行星确在风象，月亮合交点取月亮与北交或南交同一黄道度位。

水星居角或果宫沿用原书宫头前五度。水星在上升点的句子核对黄道同一度位、风象与日行速度。地平上下从上升和下降之间的两条黄道弧判断。下地平且无相的断语须逐一证实与其余六颗古典星体均无相，两套容许度独立核对。土星或火星的度相使用黄道相应度位上的实际合相、刑相或对冲。 [卷三 CIX，印刷页 543–545](https://libraryofagartha.com/Occultism/%27Aryan%27%20Occultism/Astrology/astrology%20books/William-Lilly-Christian-Astrology-1647-volume-3.pdf)

“很快”、近满月的阈值和“佳宫／有利处所”的完整口径仍待核。两条水月角位记录的库内条件与可查转录在相位类型上有分歧，保留待核。报告以历史取象引用已证条件和原书出处。 [21 份原生排盘与逐组回归](lilly-wit.test.mjs)

## 第九十批·莉莉对立关系篇宫主、冲相与尊贵

卷三第 639–641 页先查第七、十二宫主和落在这两宫的古典行星，再加入与太阳或月亮对冲的其他古典行星。热带黄道 Regiomontanus 落宫沿用宫头前五度规则。空宫条件需要确认七曜的位置。日月对冲分支逐一核对太阳和月亮各自的对冲对象，两套容许度独立计算。第一、十二宫主缺少星位、由同一行星担任或仅呈合相时，保持相位有无待定。第十二宫主落第一宫的分句同时要求第一宫主是第十二宫主所在星座的庙主。 [卷三第 639 页](https://iiif.wellcomecollection.org/image/b30338724_0673.jp2/full/1900,/0/default.jpg) · [第 640 页](https://iiif.wellcomecollection.org/image/b30338724_0674.jp2/full/1900,/0/default.jpg) · [第 641 页](https://iiif.wellcomecollection.org/image/b30338724_0675.jp2/full/1900,/0/default.jpg)

续宫、果宫与本质尊贵只查指征星。尊贵分为入庙或擢升、仅有三分界面，以及无尊贵、失势或落陷三条见证。逆行条文要求第十二宫主同时落第六宫、逆行且失势或落陷。另接入第十二宫由木星或金星守护的格言，以及第 635 页火星、土星落第十二宫或角宫的格言。原文的“多星”和“强固”取法留待进一步核对。 [第 635 页格言](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf)

9 份上海坐标原生排盘覆盖新增的 21 个条件组，逐组核对 SQLite 匹配、单条解释与报告取材。另验证缺少宫头或七曜星位、仅日月相冲、两宫共主、逆行证据冲突和客户端传入派生条件的情况。 [排盘与回归检查](lilly-enemies.test.mjs)

## 第九十一批·莉莉友伴指征和第六宫格言

卷三第 636 页按第一与第十一宫的行星、宫头庙主及截夺座庙主，选取七曜对应的友伴取象。行星落宫沿用宫头前五度规则，截夺座按原宫头之间完整包住的星座确定，跨白羊零度时沿黄道顺序比较。报告呈现命中的具体角色。第 635 页的分句要求同一颗火星或土星落第一或第十一宫，无本质尊贵，并处于本位座或变动座。依相位选取指征的分支保留待核。 [卷三第 635–636 页](https://libraryofagartha.com/Occultism/%27Aryan%27%20Occultism/Astrology/astrology%20books/William-Lilly-Christian-Astrology-1647-volume-3.pdf)

第 586 页的家务用工格言查木星、金星落第六或第十二宫。报告以历史取象引用职业分类和家内用工语境，用于讨论交友、合作与分工。28 份原生排盘覆盖 54 个新增条件组，包括两宫内七曜的截夺座主、宫头庙主与实际占据条件，并检查宫头缺失、位置矛盾和外部直接传入指征。 [原书第 586 页](https://iiif.wellcomecollection.org/image/b30338724_0620.jp2/full/1900,/0/default.jpg) · [排盘与回归检查](lilly-friends.test.mjs)

## 第一百二十二批·莉莉名望篇的宫头同度与三曜成相

太阳、木星、月亮的精确拱相逐一核对三个星对。木星、金星、月亮的另一条分别查三组合相，或三组对应整度拱相。普通合相在同一组中统一采用莉莉首列或另一说容许度。第一宫月亮与日金精确合相的格言查日金黄经落在同一整度。 [卷一第 106 页](https://www.worldastrology.net/wp-content/uploads/2008/12/CA-I.pdf#page=126) · [卷三第 618–619 页](https://www.worldastrology.net/wp-content/uploads/2008/12/CA-III.pdf#page=132)

金牛月亮临上升、白羊或狮子或射手的太阳临中天、上升宫主火星临中天，均以点位与宫头同处一黄经整度作为接入判据。巨蟹木月须合相且同在第一或第十宫。木金合相须同在一个角宫。角宫、第一宫和七曜果宫的判定沿用宫头前五度，果宫句查齐七曜。火象太阳条另核其对月亮的射线相位，独立的加强条件再查月亮落金牛。原书所称身份与官职保留为历史取象。 [卷三第 617–620 页](https://www.worldastrology.net/wp-content/uploads/2008/12/CA-III.pdf#page=131)

20 份原生排盘覆盖 10 条资料的 32 个条件组。从实际 SQLite 查询验证单条解释与报告取材。另查缺失宫头、未知出生时刻、七曜不全、星座冲突和外部直接传入派生事实。名望篇中的恒星聚合、半容许度见证群和合成强弱等级仍待核。 [排盘样例](claims/integration-batch-122-witnesses.json) · [回归测试](integration-batch-122.test.mjs)

## 第一百二十三批·莉莉名望篇的章节取证与北交临中天

章首分别列日月、照见日月的行星、第十宫庙主和十宫内星，其中光体优先看太阳。照见取六合、刑、拱或冲，容许度为两星各自半径之和，莉莉首列与另一说分别计算。整组落宫先核齐七曜，合并重合角色，按前五度分角宫、二五十一宫、八宫或果宫。合相语义未定时，整组须在计入和省去该候选两种情形下都成立。恒星角位见证及尊贵综合仍待核。 [卷三第 615 页](https://www.worldastrology.net/wp-content/uploads/2008/12/CA-III.pdf#page=129) · [卷一第 106–107 页](https://www.worldastrology.net/wp-content/uploads/2008/12/CA-I.pdf#page=126)

北交与木星或月亮要求同在白羊、巨蟹、狮子、射手或双鱼，按真交点和行星实际黄经核一度以内。宫头判据为两点各在实际十宫头一度以内，且至少一点与宫头同处一个黄经整度。25 份原生排盘覆盖 48 个条件组，复验 SQLite 检索、单条解释与报告取材，并检查交点冲突、宫头移位、黄经缺失、两套容许度边界和伪造派生证据。 [卷三第 618 页](https://www.worldastrology.net/wp-content/uploads/2008/12/CA-III.pdf#page=132) · [原生盘例](claims/integration-batch-123-witnesses.json) · [回归测试](integration-batch-123.test.mjs)

## 第一百二十四批·莉莉名望篇的尊贵分级和恒星五度见证

先按卷三第 615 页取行星名望指征，分别核本庙、擢升和双方互容。互容须双方都已入选并各在对方本质尊贵内。三分、界、面分支另核该行星无入庙、擢升或互容。漂泊、失势、落陷分支检查七曜齐全，并对该容许度表下其余可能入选者逐一排除互容。报告列出实际取到尊贵或失势条件的行星。同一盘可见不同星的不同分级。 [卷三第 615 页](https://www.worldastrology.net/wp-content/uploads/2008/12/CA-III.pdf#page=129) · [卷一第 112 页](https://www.worldastrology.net/wp-content/uploads/2008/12/CA-I.pdf#page=132)

双光体格言采用卷一第 104 页印出的擢升整度，太阳白羊十九度、月亮金牛三度。在同一套容许度下逐一排除火星、土星对两颗光体的合相、刑与冲。角宿一、狮子心使用既有 Hipparcos-2 历元换算。只有已取的行星指征与该星实际视黄经相距不超过五度才提供第 616 页见证。三项计权条已接这两颗，原表其余四颗的备选继续待核。第 615 页恒星近角宫头的另一路取证也待核。 [卷一第 104 页](https://www.worldastrology.net/wp-content/uploads/2008/12/CA-I.pdf#page=124) · [卷三第 616–617 页](https://www.worldastrology.net/wp-content/uploads/2008/12/CA-III.pdf#page=130) · [Hipparcos-2 星表](https://vizier.cds.unistra.fr/local/viz-bin/VizieR-3?-source=I%2F311)

8 份原生排盘覆盖 28 个条件组。另检验未知星位、缺失火土证据、恒星黄经冲突、跨白羊零度的五度边界，以及 SQLite 逐条解释和当前报告取材。 [盘例](claims/integration-batch-124-witnesses.json) · [回归测试](integration-batch-124.test.mjs)

## 第一百二十五批·莉莉名望篇六星表与宫头取证

卷三第 616 页的 Oculus Taurus、Hercules、Lucida Lancis、Cor Scorpii 分别校为毕宿五、北河三、氐宿一、心宿二。四颗使用 Hipparcos-2 的 HIP 21421、37826、72622、80763，按 ICRS 的 J1991.25 坐标、自行和视差计算当日热带视黄经。换算至 1647 年中时，四颗各与印刷表相差小于半度。氐宿一取靠近原列天蝎 9°45′ 的 HIP 72622，合并原资料的 Lucida 与 Lusida 拼写。 [卷三第 616 页](https://www.worldastrology.net/wp-content/uploads/2008/12/CA-III.pdf#page=130) · [Hipparcos-2 原表目录](https://vizier.cfa.harvard.edu/vizier/ftp/cats/I/311/)

原表六颗全部参与第 616 页五度相伴和三项见证计权。星等沿用原书对六星的合并类别。第 615 页另用于核恒星视黄经与第一或第十宫头同整度，角宿一的象征条使用这一路入选证据。两条仍保留近宫头的其余范围待核，第 620 页真实升起和中天的几何要求也待核。 [卷三第 615–616 页](https://www.worldastrology.net/wp-content/uploads/2008/12/CA-III.pdf#page=129) · [第 620 页](https://www.worldastrology.net/wp-content/uploads/2008/12/CA-III.pdf#page=134)

16 份原生排盘复算相关 7 条资料的 34 个条件组。专项验证 SQLite、逐条解释和报告取材，也检查星位冲突、未知时刻、未列入原表的恒星，以及只有五度相伴时无法提供宫头同度证据的情况。 [原生盘例](claims/integration-batch-125-witnesses.json) · [回归测试](integration-batch-125.test.mjs)

## 第一百二十六批·莉莉恒星的共升与共上中天

卷三第 620–621 页的三条格言按原录分别核大陵五与日、月、木星，毕宿五或心宿二与日月，以及天狼星或南河三与太阳。天狼星、南河三使用 Hipparcos-2 的 HIP 32349、37279，与前批恒星同样计算出生时刻视黄经和视黄纬。 [卷三第 620–621 页](https://www.worldastrology.net/wp-content/uploads/2008/12/CA-III.pdf#page=134) · [Hipparcos-2 原表目录](https://vizier.cfa.harvard.edu/vizier/ftp/cats/I/311/)

从既有 Regiomontanus 宫头及真黄赤交角还原本地子午圈和纬度，再把两体出生时刻的地心视黄道坐标转为赤经、赤纬。由东侧地平交点查升起，由本地子午圈查地平上方的上中天。原书未量化共角时间，本批采用两事件互距及各自与出生时刻均不超过一恒星度的计算判据，折算约四分钟。地心几何计算采用天体中心，不计大气折射、地平遮挡或地形。更宽阈值、其他传统共角读法、两星团的历史代表星继续待核。 [美国海军天文台的地平坐标公式](https://aa.usno.navy.mil/faq/alt_az) · [升落与中天定义](https://aa.usno.navy.mil/faq/RST_defs)

15 份原生排盘覆盖 15 个条件组，并用独立的地平坐标接口复核东侧地平或上中天。另检查星体纬度缺失、冲突宫头、同一星空换地平、未知出生时间与伪造匹配标志。现有旧盘可继续查询已提供证据的条件，共角条等待重新排盘提供所需坐标。 [原生盘例](claims/integration-batch-126-witnesses.json) · [回归测试](integration-batch-126.test.mjs)

## 第一百二十七批·莉莉十宫恒星与日月名望条件

卷三第 621 页列狮子心、大角星、猎户右肩和御夫左侧星。后两颗校为参宿四和五车二。大角星、参宿四、五车二的 Hipparcos-2 编号为 69673、27989、24608。逐组核恒星与日、月、木星之一同在第十宫，且视黄经同整度，判宫沿用莉莉宫头前五度。原书未量化的其余相伴范围继续待核。 [卷三第 621 页](https://www.worldastrology.net/wp-content/uploads/2008/12/CA-III.pdf#page=135) · [Hipparcos-2 原表目录](https://vizier.cfa.harvard.edu/vizier/ftp/cats/I/311/) · [猎户右肩校名](https://academic.oup.com/mnras/article/516/1/693/6651563) · [御夫左肩校名](https://ptolemaeus.badw.de/files/PAL-Texts_2.pdf)

第 617 页的当派光体按日盘太阳、夜盘月亮核实际十宫头同度，并要求同一套容许度内至少两颗不同星曜作六合或拱相。日月缺项的格言逐一核两光体均在角宫外、均落阴性座，且均无木星或金星合相。第 618 页的王者第一条先接射手日金合相及火象太阳配狮子木星、白羊火星，继续保留对应度数的末支。火象太阳临中天照见金牛月亮的两条资料沿用同一组条件，报告按同一原句计一项见证。 [卷三第 617–618 页](https://www.worldastrology.net/wp-content/uploads/2008/12/CA-III.pdf#page=131)

22 份原生排盘验证了全部 29 个新增条件组。两组罕见的火象组合采用 1516 年和 1563 年的计算盘例验证。另检查同宫不同度、恒星经度冲突、单颗善相、昼夜冲突、缺少金星和直接传入未经推导的条件。 [原生盘例](claims/integration-batch-127-witnesses.json) · [回归测试](integration-batch-127.test.mjs)

## 第一百三十七批·莉莉相位容许度原表与渐入方法

卷一第 107 页的首栏和另列各有 7 个全容许度。构建时读取原书行的度与分，对照既有两栏计算常量，并把栏位、星体和角分随各自来源存入统一 SQLite。两栏的水星值相同，各自保留出处。构建检查来源、条件和原文指纹。 [1647 初版第 107 页影印](https://iiif.wellcomecollection.org/image/b30338724_0141.jp2/full/1800,/0/default.jpg) · [卷一第 106–108 页转录](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=127)

从本命盘实际热带黄经取两颗不同的古典星体。先校验与合相、六合、刑、拱或冲对应的星座位置，再把精确角度的偏差与同一栏的半容许度之和比较。引用宽相资料时另排除相应整度的精确相位。渐入引用须有一致的短窗有向位移。双顺行按轻快星向重慢星追近判断，顺逆相向先取原书明确的同座合相形态，要求顺行星度数在前且两星角差收窄。未知时刻、位置或星座冲突时省略相应计算。 [卷一第 107–108 页转录](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=127)

报告查询从同一 SQLite 读取两栏星体原值，逐对返回各栏阈值、比较结果以及实际用到的出处。非莉莉专选请求省略本批参考。计算引用的新增范围不改变个人断语的相位判据。本批核对当前渐入趋势，双逆行是否在掉头前成相、过去精确成相和第三星抢先等资料继续待核。 [回归测试](lilly-aspect-references.test.mjs)

## 第一百五十八批·莉莉第九宫的信仰格言与梦象取证

卷三第 612 页要求七颗古典星体均未落第三和第九宫，才查木星角宫尊贵、接纳或弱势格言。第 613 页只要求第九宫无行星，木星与金星等天体的接纳或同列相位按各分支核实角宫要求。接纳复用卷一第 112 页的双向尊贵规则。第 611 页章首只在第九宫采月南交点，第 613 页的对应格言则接受第三或第九宫的月南交点。两个位置要求各随原段保留。 [卷三第 611–614 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=125)

第 614 页的梦象先取实际落第九宫的古典星体。确认九宫无行星时，由宫头所在星座及其传统庙主取指征。核对木星与金星强弱时按同一对象比对落宫、顺逆、尊贵、太阳关系和火土相位。角宿一和月南交点相伴采用同一黄道整度，日心按卷一第 113 页的十七角分判据。原书的信仰和梦象用语只作历史取象。 [卷三第 613–614 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=127)

36 份原生排盘覆盖 58 个 SQLite 条件组，逐组复验单条解释与报告取材。10 条已接入记录的相伴范围、强弱判据或附带原文保留待复核；日木共同主导九宫及多星阈值继续待映射。作者按语、双空宫和梦象的取法说明保留供查阅。 [原生盘例](claims/integration-batch-158-witnesses.json) · [回归测试](integration-batch-158.test.mjs)

## 第一百五十九批·莉莉性情篇的指征选星与具名恒星

卷三第 535–538 页先查上升星座及第一宫的截夺星座。截夺要求完整星座落在该宫未经五度平移的宫弧内。七颗古典星体位置齐备且上升座、截夺座和第一宫均无星时，再以合月亮或水星的行星取指征。两者皆无合相后，查实际第一宫主是否受其庙主照见。按同一套容许度核对整组相位。水星参与性情指征时，另核只有一个合相对象或完全无合相，后者接入水星所在座的实际庙主。特殊光体、强势整度相位及末步尊贵的优先次序继续待核。 [卷三第 535–538 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=49)

恒星接触按当时计算盘的热带视黄经同一整度。大陵五、毕宿五、五车二、南河三、北河三、狮子心、心宿二和角宿一沿用既有星表。区分实际性情指征星、第一宫主和原文具名的行星；毕宿五的附加格言另查月亮确实落第一宫。小犬星在本章印为九度左右，书中另两处为二十度左右，按其同名星体南河三复算。昴星团、猎户腰带、海豚及其余需辨认成员的恒星组合继续待核。 [卷三第 536–538 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=50) · [书中另一处南河三位置](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=180)

37 份原生排盘覆盖 72 个 SQLite 条件组，对应 70 个去重规则。两条收录自大陵五同一段的摘录仍可分别检索，报告合并引用。30 条已接入记录的恒星相伴范围、替代指征或尊贵优先次序保留待核说明。原书的性情与行为描述供历史取材。 [原生盘例](claims/integration-batch-159-witnesses.json) · [回归测试](integration-batch-159.test.mjs)

## 第一百六十批·莉莉气质篇的行星、月相与季节见证

卷三第 533–534 页把实际上升及其庙主、第一宫内的古典星体或月交点、按黄道整度与上升成相的行星、在容许度内照见月亮的行星，以及太阳的当前季节列入取证。第一宫采用宫头前五度口径。上升的六合、刑、拱、冲按整度差核实，土火的上升刑冲另外记录。月亮的土火刑冲及其他照见沿用两套半容许度，单个条件组只采用一套。 [卷三第 533–534 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=47)

五曜东方行或西方行须同时具备本篇可确认的取证角色。月相按日月有向黄经差分为四段，太阳的季节按太阳实际所在星座。上升、月亮和已选取证星体的星座另查各自元素。月亮实际落第一宫时，仅接入这一项可以计为两份的规则。第 743 页的案例还单列月亮主星与命局主星，并记录作者结合已有观察调整结论。本批将全局计权、主星选择和综合分类留在待核清单。 [卷三第 743–744 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=257)

17 份原生排盘覆盖 75 个新增条件组，逐组验证 SQLite、单条解释及报告取材。16 条已接入规则仍保留较宽上升相位或命局主星角色待核。原书的气质分类属于历史取材。 [原生盘例](claims/integration-batch-160-witnesses.json) · [回归测试](integration-batch-160.test.mjs)

## 第一百六十一批·莉莉英格兰商人印盘与表格对照

以 1647 年初版第 742 页所印七曜及十二个雷吉奥蒙塔努斯宫头为命例匹配条件，逐项对照到角分。原图第五宫头印作金牛 30°，第十一宫头印作天蝎 30°，几何匹配采用相应交界角度，资料仍引用原印座名。第 757 页作者以射手作第十一宫判断，也随正文独立保留。 [初版第 742 页](https://iiif.wellcomecollection.org/image/b30338724_0776.jp2/full/1800,/0/default.jpg) · [卷三第 757 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=271)

核对第 743 页正反映点、气质表各行及热湿冷干四栏总数 7、6、6、7。双子月亮的行仅列位置，四栏空格均保留。第 744–745 页的强弱资料按原表逐项汇总，太阳与金星相差 17 角分，金星的日心五分保留。水星印盘天秤 3°54′用于复算正映点双鱼 26°06′，强弱表所印天秤 3°34′随该表单独返回。 [初版第 743 页](https://iiif.wellcomecollection.org/image/b30338724_0777.jp2/full/1800,/0/default.jpg) · [初版第 744–745 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=258)

本批共 60 条历史命例及 60 组条件。核验覆盖同座不同角分、缺失或冲突坐标、伪造命例标志和未知出生时间。命例单列于报告的古籍印盘对照部分，通用气质计权与一般盘面命局主星继续待核。 [查询方法](README.md#古籍命例对照) · [回归测试](integration-batch-161.test.mjs)

## 第一百六十二批·莉莉英格兰商人命例后续章节

初版印盘对照扩至 146 条。新增条目覆盖家产、手足、父母、婚姻、子女、旅行、职业和友伴等章节。复算盘面可核对宫主、落宫、日心及具名星体黄经；作者原章所列的派生盘数值、行程旁注和计数分别随其出处保存。第 751 页列七兄弟，木星记 2、火星记 1，日水金的余数为 4。该页称木星六合第三宫头，印盘的较短黄经距离为 116°39′。 [卷三第 749–753 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=263) · [卷三第 754–758 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=268)

第 757 页计数分别印出双体座 2、月亮 1、成相行星 4及结论栏可能 4，四个原值均可检索。第 756 页称狮子心与第八宫头整度合相，第 616 页星表的黄经与该宫头相距 60 角分。同页星表的秤盘亮星与印盘中天相差 294 角分，正文仍保留作者的临中天描述。另接入两处金牛眼表值、角宿一与第九宫头相差 4 角分，以及以第 745 页水星 3°34′复算的正反映点。 [卷三第 616 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=130) · [卷三第 644 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=158) · [卷三第 759–763 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=273)

命例索引、单条解释和报告均通过印盘角分条件查询。报告同时提供原条目的使用边界与已知来源差异。仍待校核的条目包括子女计数综合判断、部分派生盘方法及动态推运。 [命令行查询](README.md#古籍命例对照) · [回归测试](integration-batch-161.test.mjs)

## 第一百六十三批·莉莉商人命例与父母派生图选星

新增的 10 条印盘对照覆盖形貌、旅行方位、四组古代地名和原书末章。第 758 页的正文方位陈述与第 742 页火星狮子的位置一并保留。第 763 页合列金星与木星为命局主星，第 743 页气质表单列金星。月亮受损的结论按作者对本例的取法记录，同时保留印盘中的日、金、水拱相。第 764 页的第八宫截夺处女及水星的传统庙主由原印盘复核。 [卷三第 747 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=261) · [第 758–760 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=272) · [第 763–764 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=277)

第 753 页核出四条选星规则。首生子女查父亲，昼取太阳、夜取土星；查母亲，昼取金星、夜取月亮。匹配须明确出生排行和所查角色，使用已确认的热带本命昼夜、宫制资料与起点星黄经。位置圈、极高和实际派生宫头仍待核。商人命例中仍有 30 条未纳入匹配，其中 28 条保留为参考。原书子女计数的综合断语及旅行判断中未能确认的普遍限制各保留一条待核。 [卷三第 753 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=267) · [选星测试](integration-batch-163.test.mjs)

## 第一百六十四批·莉莉职业第四步与十宫取证

第 625 页 CXLVIII 先要求前三步均已排除。第四步核水星、金星或火星对月亮的六合、刑、拱或冲，角度差在月亮自身半容许度内，分别按原书两张表取 6°15′和 6°。再由同一张表逐一查土星、火星对候选的形体合相、刑或冲。两表结论一致时记录合格或被排除。候选是火星时只核另一颗凶曜。缺少确认排除所需的坐标、两表意见不一致、或多颗星满足时，保留相应证据，无法确认唯一当选。第五步的「第一推动先日」仍待核。 [卷三第 625 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=139)

第 626 页的十宫取法独立核宫头星座、传统庙主黄经及按宫头前五度计算的落宫。下一章的单独职业指征须先由前两步确认唯一候选，再确认另两颗职业候选均无形体合相或射线相位。受弱相位时能否独立发挥、强相位移交职业主星的阈值仍待核。 [卷三第 626 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=140) · [原生盘例](claims/integration-batch-164-witnesses.json)

## 第一百六十五批·莉莉职业第五步与晨出中天双路取证

第 625 页的「第一推动先日」仅在前四步均有排除依据后检查。根据本命雷吉奥蒙塔努斯宫头重建地平，用出生时刻的黄经、黄纬和黄赤交角计算日、水、金、火各自的东地平过界恒星时。太阳前半周的过界次序须与太阳前的黄经顺序一致。当且仅当三颗候选中只有一颗确认先于太阳升起，才返回第五步。多个候选、过界或黄经方向不一致、无法建立地平以及从不东升的星体均保留待定。 [卷三第 625 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=139) · [卷一第 114 页](https://www.worldastrology.net/wp-content/uploads/2008/12/CA-I.pdf#page=134)

第 626 页的转述另行比较完整七曜的几何东升顺序。晨出一路仅取唯一紧先太阳且方向一致的水、金或火星。中天一路按原书首句和库中已收的分支，要求同一星为十宫传统庙主或按五度规则落十宫，且两张容许度表都确认与月亮有射线相位。两路落在同一颗星时返回重合。晨出星中天依据明确缺席时，保留已确认的单一路径。用的是本命瞬时位置的几何计算，晨见可见度、存在歧义的候选集合及强弱排序仍待核。保留托勒密原书基于晨见和月亮施相的独立待办。 [卷三第 626 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=140) · [托勒密卷四第 4 节](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4A%2A.html) · [原生盘例](claims/integration-batch-165-witnesses.json)

## 第一百六十六批·莉莉职业指征的精确联结与凶曜见证

第 626 页要求火星对职业水星有强而有利的相位。卷一将三合列为比六合更有力的善相，本批取火星与已选水星的对应整度三合，同时确认火星的实际落宫和可用黄经。双指征混合目前取两颗当选水、金、火星的对应整度形体合相。木星、月亮的有利修饰取与同一职业指征的对应整度三合，太阳仅核对职业火星的整度三合。土星强修饰先取对应整度的合、刑或冲。其他强度口径、可能的指征移交及日光修饰范围继续待核。 [卷一第 105–106 页](https://www.worldastrology.net/wp-content/uploads/2008/12/CA-I.pdf#page=126) · [卷三第 626 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=140)

第 632 页的单颗及两颗凶曜见证分别检查形体合相、刑或冲。双曜须在一张原书容许度表内作用于同一颗当选职业星。凶曜与自身的关系不计入。新规则使用前两步的确认指征或第三至第五步已唯一选出的星体，另行保留第 626 页转述的晨出、中天取法。缺失坐标、仅在两颗不同指征上分别命中的凶曜或未选定的候选，均不能推出双曜同损。 [卷三第 625 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=139) · [第 632 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=146) · [原生盘例](claims/integration-batch-166-witnesses.json)

## 第一百六十七批·莉莉职业的尊贵、日光与不利落位

金星先有职业选星依据，方检查燃烧或日心。这里的选星依据包括已经当选，或第一步仍需检查日光的尊贵和宫位条件。金星燃烧与日心分别使用卷一的日距判断。第 628 页的金土混合取形体合相或射线，第 634 页另列射线。两处都要求至少一颗星实际失势、落陷或燃烧。 [卷三第 628–629 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=142) · [第 634 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=148)

火星和木星的有利分支核两星均具有庙或擢升、实际落角宫且成六合或三合。不利相位分支另核两星刑或冲，不利落位仍待核。职业水星与火星的技术分支要求两星分别当选并具庙或擢升且落角宫。其他组合的判法保留待校。 [卷三第 629–630 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=143)

第 631 页的有利分支核同一职业星的庙或擢升、角宫、相对太阳东方，以及可验证的其他凶曜无对应整度合相、刑和冲。弱势先接果宫分支，核同一星失势或落陷，并在同一套容许度内同时受土火的合、刑或冲。卷三录文作东方，导入资料标注西方，方向分支留待复核版本。 [卷三第 631–632 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=145) · [原生盘例](claims/integration-batch-167-witnesses.json)

## 第一百六十八批·莉莉火星独主、木星北交及双星失利

第 629 页的三支都先查五步选法是否明确产生唯一火星。强势取庙或擢升、角宫、顺行、离日光，并以土星已知黄经排除对应整度的合、刑、冲。中等依第 615 页的三分主、界、面取至少一项，同时排除庙、擢升、失势和落陷。弱势取游离且确实失势或落陷。原书未给出这些分支的总分阈值，其他力量组合保留待核。 [卷三第 615 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=129) · [第 629 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=143)

第 630 页的诗作取材要求木星与实算本命北交点同一整度，且精确三合已选的水星或金星。同一组须有相应职业星，其他善相和交点容许度留待核。第 630–631 页的水火失利要求两颗均当选且各有失势或落陷。水火月合相使用同一容许度表对三组关系逐一取证，也须明确三颗均无庙或擢升且至少一颗失势或落陷。火金失利核两颗当选且各失势或落陷，同时核土星损火、土星或火星损金，均在一张表内。 [卷三第 630–631 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=144) · [原生盘例](claims/integration-batch-168-witnesses.json)

## 第一百六十九批·莉莉职业的木金水同宫、四曜见证与精确善相比较

第 630 页同宫条文按雷吉奥蒙塔努斯宫头前五度核木、金、水三曜，分别保留第三、五、九、十一和十二宫分支。水金的职业依据包括两星本身当选、当选一星与另一星对应整度合相，以及按第 626 页转述分别取得晨出及中天照月见证。木星需要按同一张原书容许度表分别与水星和金星形成形体合相。同宫条件与实际职业依据同时成立才取材。 [卷三第 626 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=140) · [第 630 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=144)

独立的四曜格言要求木星和月亮各自与水、金构成形体合相或善相。全组使用同一套容许度。第 633 页的相位比较取同一职业星收到不同见证星的对应整度三合及六合，依卷一在这两个见证中优先取三合。其他相位比较、木星与月亮更宽的参与方式、职业主星整体强化排序均留待核定。 [卷一第 105–106 页](https://www.worldastrology.net/wp-content/uploads/2008/12/CA-I.pdf#page=126) · [卷三第 633 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=147) · [原生盘例](claims/integration-batch-169-witnesses.json)

## 第一百七十批·莉莉父母章的昼夜指征、十宫多数与来源修饰

第 569 页父亲章以第四宫为取证范围，取传统四宫主、实际入四宫的星体及昼太阳、夜土星。第 570 页母亲章以第十宫为取证范围，取传统十宫主、实际入十宫的星体及昼金星、夜月亮。卷三第 574 页另列亲子关系的日月取法。父亲章的庙旺分支核同一实际指征具庙或擢升，同时落角宫或续宫。母亲章的分组须核齐七曜，宫主、入宫星、昼夜指征重叠时按一颗计。佳宫先取附近段落列明的第一、二、十、十一宫，或核独立星体具至少一种本质尊贵，再区分全部与严格多数。其他佳宫待核。 [卷三第 569–571 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=83) · [第 574 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=88)

来源修饰核木星、金星与任一已确认父母指征的六合或三合，以及火星、土星对另一实际指征的合相、刑或冲。解释返回修饰星实际落宫。第 573 页的两条关系见证须先核四、十宫主对分，再按火星或土星实际入四、十宫选择对应原句。日月合相须两星同处同一阳性座，太阳南交条保留卷一明列的兽性五座、果宫及同整度。父亲背景与命主寿命同见于第 570 页的一个原句，现有父亲背景条目误摘寿命后件，该条引文保留待核。 [卷一星座分类](https://www.worldastrology.net/wp-content/uploads/2008/12/CA-I.pdf#page=109) · [卷三第 570 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=84) · [第 573 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=87) · [原生盘例](claims/integration-batch-170-witnesses.json)

## 第一百七十一批·莉莉第四宫的父母指征与祖产见证

第 569 页的父亲指征按传统四宫主、昼太阳或夜土星及四宫入宫星去重。强势先取实际角宫或续宫的庙旺，弱势取失势、落陷或果宫漂泊。强弱相混时以四宫入宫星修饰，多颗入宫时只有本质尊贵各项明确占优的星取得唯一优先。全组受阻要求每颗指征都弱且分别受到另一颗火星或土星的合、刑或冲。双方宫主与昼夜指征皆落果宫的分支另核四宫弱势土火。 [卷三第 569 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=83)

四宫木星或金星与各自传统定位星均须有本质尊贵、实际入角宫或续宫，并按同一张表确认火土接触均已排除。定位星实际受火土合、刑或冲则对应另一分支。父亲背景条文核太阳与真北交同一黄经整度和月亮实际入四宫。SQLite 保存原始导入记录并单独记录此条校订，解释与报告读取父亲背景分句。 [卷三第 569–570 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=83)

祖产加强先逐颗核对昼太阳或夜土月与吉星的实际合相、六合、三合，再核参与的木星或金星本身是否位于二宫、四宫或为传统四宫主。祖产阻隔核同一张容许度表内火星与昼太阳或夜土星实际成合、刑、冲，并确认木金与两端均无合相或善相。五宫主同四宫凶星一条要求火星、土星及另一颗担任五宫主的行星同入四宫，并确认五宫主失势或落陷。两张容许度表各自成组。其他强弱、较宽交点容许度、四宫主宰含义及阻隔方式留待复核。第 573 页库内日火记录与常见转录有出入，二宫受损口径和影印校核继续待办。 [卷三第 572–573 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=86) · [排盘样例](claims/integration-batch-171-witnesses.json)

## 第一百七十二批·莉莉父母章历史格言按条核对

第 570 页的四宫星群逐颗验证日、土、火、水。太阳北交和四宫月亮的历史后件复用该句前件的同整度取证。日月同阳性座仍要求形体合相。果宫日土要求两星各自落果宫并实测形体合相。土星损伤太阳先取同表内明确的合、刑、冲。 [卷三第 570 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=84)

第 571 页慢行离角分别对应实际刑冲月亮的土星或火星，离角先取果宫。快行支要求月亮与同一凶星均超出各自平均日行量，月亮和金星分别落第一、二、十、十一宫之一。月土对分独立入库。第 572 页吉星协助先取木星或金星的合相、六合、三合。日月落座须显式选择原书分支并验证黄经。另核十二宫火土和传统十宫主实际进入八宫。两张容许度表各自取证。 [卷三第 571–572 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=85)

新增条目要求明确选定历史格言。单条解释从 SQLite 读取规则并复算，原文、引文和使用边界随结果返回。常规取材仍可命中同段的父亲背景分句。其他离角、协助方式、上升受照及有版本分歧的条文继续待核。 [命令用法](README.md#历史格言按条核对) · [排盘样例](claims/integration-batch-172-witnesses.json) · [回归测试](integration-batch-172.test.mjs)

## 第一百七十三批·莉莉父母指征比较与昼盘金星

第 570 页的母亲指征依十宫主、实际十宫行星与昼金夜月去重。严重受损分支取各独立指征均弱且受凶星接触，同时确认弱势月亮受到火星和土星的合、刑或冲。第 570–571 页的双方比较先去掉共有成员，双方都须有独有成员。一侧独有成员均处庙旺、居角宫或续宫且核实无土火合、刑、冲，另一侧独有成员均弱且受损，才认定一侧有力。比较分别采用两张容许度表。其他强弱混合和整体评分留待核定。 [卷三第 570–571 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=84)

第 573 页昼盘的金星趋近燃烧要求金星处庙旺与角宫或续宫，并排除火土合、刑、冲。计算以日金实测每小时位移估计未来 24 小时内能否在同一星座进入 8 度 30 分以内。样例另用次日星历复算。更长路径及其他有利组合待核。逆行渐离要求金星已离开准确合相至少 6 分、与太阳的角距扩大且仍处同座合相范围，同时漂泊且失势、落陷或落果宫。 [卷三第 573 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=87) · [卷一第 110 页](https://www.worldastrology.net/wp-content/uploads/2008/12/CA-I.pdf#page=130) · [卷一第 113–114 页](https://www.worldastrology.net/wp-content/uploads/2008/12/CA-I.pdf#page=133)

第 571 页的两条历史格言核月亮相对太阳的东方或西方，以及同一张表内土星对月亮的合、刑或冲。东方取月亮从对分至下次合相的区段，西方取从合相至对分的区段。核查结果随历史查询返回。 [卷三第 571 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=85) · [卷一第 114 页](https://www.worldastrology.net/wp-content/uploads/2008/12/CA-I.pdf#page=134) · [排盘样例](claims/integration-batch-173-witnesses.json)

## 第一百七十四批·莉莉分娩章的上升点、交点与伴月行星

卷三第 572 页明列摩羯、水瓶、双鱼、白羊、金牛、双子为短斜升。卷一第 92 页两张列表均含水瓶，第 93 页以水瓶的上升时长说明短斜升。本次据分娩章明列六座及该算例，推定其余六座为长斜升，保留印本文字出入。上升星座按实际雷吉奥蒙塔努斯第一宫头取，斜升类别沿用本章的星座名单。 [卷一第 92–93 页](https://www.worldastrology.net/wp-content/uploads/2008/12/CA-I.pdf#page=112) · [卷三第 572 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=86)

短斜升上升核火星或土星的整度刑、冲，或真南交按莉莉前五度规则落第一宫。长斜升上升核木星或金星的四种整度射线，或真北交按同一宫制落第一宫。宫头射线暂取对应黄道整度，较宽的容许度待核。交点分支与行星相位分支分别取证。 [卷一第 105–107 页](https://www.worldastrology.net/wp-content/uploads/2008/12/CA-I.pdf#page=125) · [卷三第 572 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=86)

月亮须实际处于短斜升六座。另一行星以两张容许度表分别核形体合相，合相对象本身须提供逆行、停驻或慢行证据。逆行和停驻用现有星历的居中一小时黄经变化，停驻沿用排盘引擎的数值阈值。慢行用 24 小时实测位移与卷一行星平均日行量比较。太阳只进入慢行分支。55 份样例均为分钟输入，其中 12 个条件组使用实算的停驻。 [卷一第 114 页](https://www.worldastrology.net/wp-content/uploads/2008/12/CA-I.pdf#page=134) · [排盘样例](claims/integration-batch-174-witnesses.json)

## 第一百七十五批·莉莉初版的母亲章格言与祖产受损

Wellcome 1647 年初版第 571 页保留了通行转录缺失的三条母亲章格言。第一条核位于第十宫的月亮或金星与木星成六合或三合。第二条以第四宫或第十宫的月亮或金星为同一取证对象，核它与土星、火星或水星实际合相。第三条核月亮本庙或擢升、角宫或续宫，以及月亮经实际坐标排除土火合、刑、冲。金星六合、金星三合及木星的四种射线独立取证，整组使用同一张容许度表。三条通过显式历史查询取材。 [Wellcome 初版第 571 页](https://iiif.wellcomecollection.org/image/b30338724_0605.jp2/full/1800,/0/default.jpg)

第 573 页祖产长句取有共同依据的部分。两支都要求夜盘衰月受火星或土星损伤，同时第二宫受损且传统二宫主失势、落陷或果宫漂泊。一支追加同一颗凶星实际伤及二宫主，另一支追加第四宫与传统四宫主各自受损。宫位受损先核土火实际入宫或向宫头发出整度合、刑、冲，宫主损伤按同一表内的实际相位。原句其他断句与更宽口径留待复核。 [Wellcome 初版第 573 页](https://iiif.wellcomecollection.org/image/b30338724_0607.jp2/full/1800,/0/default.jpg)

同页清楚印有太阳和火星的符号，常见转录写作日月。实现依据初版核对日火都漂泊、实际形体合相，并要求两颗星分别以同种整度刑或冲接触实际二宫头。第 570 页吉星配置句的代词对象，以及第 571 页 `Fortunes` 修饰句的吉凶星所指继续待核。 [Wellcome 初版第 570 页](https://iiif.wellcomecollection.org/image/b30338724_0604.jp2/full/1800,/0/default.jpg) · [日月写法的转录](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=87) · [排盘样例](claims/integration-batch-175-witnesses.json)

## 第一百七十六批·莉莉财富持续篇的三颗恒星与二宫受损

Wellcome 初版第 564 页分别列出毕宿五、心宿二和大陵五。每颗星都有福点和福点主两条并列取证。恒星使用出生时刻的热带视黄经，福点沿用莉莉第 143 页统一的有向弧公式，从实际第一宫头加月亮黄经减太阳黄经。福点主按福点所在座的传统庙主确定，解释中给出该行星名。合相采用对应整度，较宽容许度继续待核。 [卷三第 564 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=78)

第 563 页末的二宫行星与第 564 页首相连。组合分支须有太阳、火星或土星实际落第二宫、传统二宫主同座燃烧，以及火星或土星向该盘实算福点成整度合、刑或冲。二宫沿用宫头前五度规则。其他福点受损方式留待核对。该段用于报告中的传统财富守成主题。 [卷三第 563–564 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=77) · [排盘样例](claims/integration-batch-176-witnesses.json)

## 第一百七十七批·莉莉财富持续篇的二宫主指征与强弱

第 562–563 页依次讨论第二宫里有本质尊贵的主指征、吉星的强弱和火土的专门分支。单星先核实际落第二宫和本质尊贵，火星、土星适用具名的凶星分支。多星按强弱比较，第二宫无七曜入宫时先取二宫主与福点主同星的分支。需要七曜完整黄经和实际宫头才能判断多星与空宫。 [Wellcome 初版第 562 页](https://iiif.wellcomecollection.org/image/b30338724_0596.jp2/full/1800,/0/default.jpg) · [Wellcome 初版第 563 页](https://iiif.wellcomecollection.org/image/b30338724_0597.jp2/full/1800,/0/default.jpg)

SQLite 提供卷一第 115 页 41 项加扣分。已确认的分数同时计入上下限。尚未确定的加分只计入上限，尚未确定的扣分只计入下限。多星仅在同一候选的下限高于其余候选的上限时优选。同分或区间交叠时留待判断。报告的匹配证据列出所取指征和对应的候选积分。 [卷一第 115 页](https://www.worldastrology.net/wp-content/uploads/2008/12/CA-I.pdf#page=135)

当前以严格的程序条件实现其中一部分。判为有力时需积分下限为正、具有庙或旺，并已排除失势、落陷、逆行、燃烧、土火精确合刑冲、土火夹制和大陵五见证。偏弱要求积分上限为负，且确认至少一项上述失利。中间情形要求加扣分都已确认有发生，且上下限均为零。原章使用定性用语，其余定性强弱、广义中等及二宫主与福点主异星的情形继续待核。 [排盘样例](claims/integration-batch-177-witnesses.json)

## 第一百七十八批·莉莉财富持续篇的宫组与行星运动

历史择星条文采用第 177 批已经核实的多星唯一优势及空宫共同主宰。第 563 页时机段按传统二宫主、福点主及实际二宫行星列出财富指征，按天体去重。分别核对第十至十二宫、第七至九宫、第四至六宫和第一至三宫。最强依据卷一强弱表的积分区间，须有唯一优势。过半依据各星的实际落宫。两种见证指向不同宫组时一并展示，并列和缺少证据时保留未决。 [Wellcome 初版第 563 页](https://iiif.wellcomecollection.org/image/b30338724_0597.jp2/full/1800,/0/default.jpg)

同页运动段逐星核实相对太阳的东方或西方、居中一小时位移证实的逆行，以及同一星的顺行与快于卷一平均日行量。各项见证独立记录，原书要求用推运佐证的部分继续待核。第 564 页的两条土星格言以土星承担本章主指征为前提，再查完整财富指征集合，分别核日月都未入组和日月同时入组。只见一颗光体时两条均不触发。其他财富参与口径和同页所说的性质相反继续待核。 [Wellcome 初版第 564 页](https://iiif.wellcomecollection.org/image/b30338724_0598.jp2/full/1800,/0/default.jpg)

这八条均按 ID 进入历史查询。宫组和运动见证不换算现实财务事件的年月，也不用于推算个人寿命。实际排盘判定依赖完整七曜坐标、二宫等实际宫头以及所用运动事实。 [查询说明](README.md#历史格言按条核对) · [排盘样例](claims/integration-batch-178-witnesses.json)

## 第一百七十九批·莉莉引托勒密的福点主与同派见证

第 552 页引托勒密段要求先核福点所在星座的主宰与相关相位，第 553 页列土星、木星、火星、金星与水星五条财源短表。当前仅接入由实算福点所在星座的传统庙主承担，且该星有一致的实际坐标的分支。福点沿用第 143 页日夜同一有向弧。其他尊贵参与主宰及其权重继续待核。 [Wellcome 初版第 552 页](https://iiif.wellcomecollection.org/image/b30338724_0586.jp2/full/1800,/0/default.jpg) · [Wellcome 初版第 553 页](https://iiif.wellcomecollection.org/image/b30338724_0587.jp2/full/1800,/0/default.jpg)

莉莉的同类见证参照其引用段落的托勒密译本，先接入明确的同派支。太阳、木星、土星归昼派，月亮、金星、火星归夜派。水星在太阳东方归昼派，在太阳西方归夜派。取与福点主同派的另一颗星，分别核它与实际福点或福点主的整度六合、三合。太阳与水星方位不明时，该水星证据留待核对。其他同类读法和较宽容许度继续待核。 [《四书》卷一第 7 章](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/1B%2A.html) · [《四书》卷四第 2 章](https://penelope.uchicago.edu/Thayer/e/roman/texts/ptolemy/tetrabiblos/4a%2A.html)

凶星主宰条文先接入火星或土星兼任实际福点座主和该度位界主的分支。界主从 SQLite 中卷一的界表按实际度位查得。仅有凶星座主时仍可核财源短表，其主宰组合保持未命中。原句向财富位置升起的分支和其他主宰判法继续待核。 [Wellcome 初版第 553 页](https://iiif.wellcomecollection.org/image/b30338724_0587.jp2/full/1800,/0/default.jpg) · [排盘样例](claims/integration-batch-179-witnesses.json)

## 第一百八十批·托勒密财富章的福点得势与派别见证

《四书》第 IV 卷第 2 章以实际升度加月亮黄经减太阳黄经，归一至热带黄道，昼夜同式。旧输入可以用第一宫头记录的同一个实际升度。计算只需实际升度和日月，整套宫头在高纬不可用时仍可核对。公式条目经 ID 显式查询，保留 Robbins 关于昼夜句的校勘意见。 [《四书》第 IV 卷第 2 章及注 1](https://penelope.uchicago.edu/Thayer/e/roman/texts/ptolemy/tetrabiblos/4a%2A.html)

得势条目先定位福点的传统座主，再据卷一所述多重亲和，核对同一颗座主在其自身位置的庙、旺、当值三分主权以及托勒密手稿界，确认两项以上才匹配。三分和界从 SQLite 的原书版本表查得。其他主宰权和得势形式继续待核。日月加强先用同派的星座六合或三合。土木段先以土星确为福点座主及木星向其成四种星座相位为证，上角、双体和月亮渐入的完整加强配置待核。 [《四书》第 I 卷亲和与星座相位](https://penelope.uchicago.edu/Thayer/e/roman/texts/ptolemy/tetrabiblos/1b%2A.html)

同派条目核同派的另一颗实际行星与座主成六合、刑、三合或对分。水星按相对太阳的方位分派。异派压过先采用另一星在座主之前三个星座所成的右刑。原文所称后升以及对其他财富管辖处的压过继续待核。第 9 与第 14 条共享一个 SQLite 条件，但保留独立来源 ID。 [《四书》第 II 卷对压过的译注](https://penelope.uchicago.edu/Thayer/e/roman/texts/ptolemy/tetrabiblos/2b%2A.html) · [排盘样例](claims/integration-batch-180-witnesses.json)

## 第一百八十一批·托勒密财富章的后升与土木继承见证

Robbins 译为后升，Gogava 译为在管辖处之后接续。参照《四书》卷三和卷四对后继星座的用法，先取异派星处于实际福点座主之后紧接的星座。此支可独立命中，也与右刑共用同一条综合原文。扩大至其他管辖处或按实际升起时刻作比较的读法继续待核。 [Gogava 1548 年拉丁本](https://ptolemaeus.badw.de/print/51/86/text/1) · [《四书》卷四后继星座译注](https://penelope.uchicago.edu/Thayer/e/roman/texts/ptolemy/tetrabiblos/4c%2A.html)

Robbins 所译的财富章上角以《四书》卷三的首要角位说明来落实，取上升、中天所在的两个星座。先核土星为实算福点座主并和木星成星座相位，两者分别占这两个角位所在座。木星在双子、处女、射手或双鱼给出双体见证。月亮见证用两星实际时速及射线偏差验证，六合、刑、三合或冲在 3° 内且正在趋近时匹配。3° 是本项目用于落实卷一短间隔要求的近距离口径。形体合相涉及黄纬，留待单独核对。 [《四书》卷三首要角位](https://penelope.uchicago.edu/Thayer/e/roman/texts/ptolemy/tetrabiblos/3a%2A.html) · [《四书》卷一渐入与渐离](https://penelope.uchicago.edu/Thayer/e/roman/texts/ptolemy/tetrabiblos/1b%2A.html)

Gogava 本的木星西沉取实际西角所在双体座的可验证分支。Cardano 第 430 页明确列土星中天、木星西角，并分别列月亮趋近和离开。历史查询按所选 ID 保留角位及相位的各自口径。Gogava 所写木星趋月仍待核意，当前月亮的趋近或离开只按能够证实的时速方向给出。《四书》第 12 条的历史核对需要完整七曜及座主三分、界表资料，并列出已证亲和与行星见证。 [Cardano 1578 年评注第 430 页](https://ptolemaeus.badw.de/print/12/3/text/4#430) · [排盘样例](claims/integration-batch-181-witnesses.json)

## 第一百八十二批·卡尔达诺财富章的三体合相与角位

1578 年评注第 423 页列出木星、月亮、金星的合相，并允许龙首替代其中一颗。三条替代路径分别通过各自的条目 ID 取证，使用本项目实算的真北交点及保留的两星。每支均核全部三条两两黄经距离，按热带黄道最短弧计算。现在只接入三条距离都不超过 3° 的近合。被替代星的坐标不参与该支判断，其他容许度和交点模型继续待核。 [卡尔达诺 1578 年评注第 423 页](https://ptolemaeus.badw.de/print/12/3/text/4#423)

同页分别列太阳临西角、金星临中天和月亮临上升。分别核太阳与实算下降点、金星与实算中天及月亮与实算上升点的实际黄经距离。已接入不超过 1° 的近角范围，旧输入可使用记录了相同黄经的第一、十宫头。3° 与 1° 是本项目用于核对近合与近角的阈值，原句未列度数。七条均在历史查询中列出对应证据的实际黄经。 [卡尔达诺 1578 年评注第 423 页](https://ptolemaeus.badw.de/print/12/3/text/4#423) · [排盘样例](claims/integration-batch-182-witnesses.json)

## 第一百八十三批·卡尔达诺财富章的福点位置与座主见证

财富章昼夜都用实际升度加月亮黄经减太阳黄经，归一到热带黄道。评注第 426 页优先列落角及地平上第十一、九处。当前用项目的雷吉奥蒙塔努斯宫头，核福点实际黄经所属的未偏移宫段。第十一、九处另核东、西地平点之上的黄道半圆。 [卡尔达诺 1578 年评注第 426 页](https://ptolemaeus.badw.de/print/12/3/text/4#426)

第 428 页分别列座主东方、角位中心、自身尊贵及与日月协调。已接入的座主是福点所在热带星座的传统庙主。东方见证核其为五星之一并位于太阳之前的半圆。近角见证核四轴实算黄经的 1° 范围，自身尊贵核庙位或擢升座，日月协调核两者星座与实际黄经同时成六分或三分，射线偏差不超过 3°。原文也讨论其余共同主宰、其余自身尊贵及更高行星的见证，这些分支待校。 [卡尔达诺财富章的座主说明](https://ptolemaeus.badw.de/print/12/3/text/4#428) · [卷一的晨见与日相](https://ptolemaeus.badw.de/print/12/3/text/1)

福点在太阳下、与月亮三分或六分的三条，同时核第 426 页列出的福点位置。福点随月、太阳临升条目核福点距月亮不超过 3° 且太阳距上升点不超过 1°。3° 和 1° 都是项目的近距阈值。条目逐一按 ID 查询，返回福点与取证对象的实际黄经、宫位、尊贵或相位。二宫替代所需的座主受阻、高置星的协同、角位与尊贵的比较以及不相熟星座的负面关系仍待核对。 [卡尔达诺财富章的日月见证](https://ptolemaeus.badw.de/print/12/3/text/4#428) · [排盘样例](claims/integration-batch-183-witnesses.json)

## 第一百八十四批·卡尔达诺财富章的命例与土木换宫

第 427 页第一例的本命部分，核福点在第 426 页所列位置、水星主管福点、木星主管第二宫且实落第二宫，以及木水黄经相距不超过 3°。相邻第二例取福点、水星、金星同一角宫，三条两两黄经距离均不超过 3°。福点沿用未偏移宫段，两颗行星采用原生雷吉奥蒙塔努斯三维落宫。两条按历史配置核对，原人物身份及后文推运仍以出处为准。 [卡尔达诺 1578 年评注第 427 页](https://ptolemaeus.badw.de/print/12/3/text/4#427)

第 428 页单列角位与自身尊贵的比较。当前验证两者在同一福点庙主上并存，采用距实算四轴不超过 1° 及庙位或擢升座，并给出各自证据。该条可用于并列查证原文的比较条件。 [卡尔达诺 1578 年评注第 428 页](https://ptolemaeus.badw.de/print/12/3/text/4#428)

第 430 页以第十一处代中天，随后列第九和第八处。三个替代处各自查询，取土星为福点庙主且实落对应宫，木星仍在下降点所在星座和实算第七宫。须同时核土木星座相位，以及木星居双体座或月亮正在 3° 内趋近、渐离木星射线。射线阶段用日常排盘得到的实际行星时速判定。样例覆盖三个宫位的三个独立分支，形体合相及其他替代口径待核。 [卡尔达诺 1578 年评注第 430 页](https://ptolemaeus.badw.de/print/12/3/text/4#430) · [排盘样例](claims/integration-batch-184-witnesses.json)

## 第一百八十五批·托勒密卷一的星体分类与星座配对

第 6 章分别核七曜本性、相对太阳的黄经前后和四个地平象限，第 7 章分别核水星晨昏派属、土星配昼和火星配夜。方位证据按原生雷吉奥蒙塔努斯三维宫组分象限，四组依次为 1–3 宫、4–6 宫、7–9 宫、10–12 宫。接近晨昏的星体用有向黄经差作盘面见证，实际日出日落时的可见度仍待核。缺出生时刻时，地平象限及出生昼夜不参与匹配。 [《四书》卷一第 6–7 章](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/1B%2A.html)

第 8 章依 Robbins 版以朔、上弦、望、下弦的有向黄经差核四个开区间。末段当前取下弦至下次朔的天文口径，并保留观测隐没边界的待核记录。Ashmand 的初见起点，以及土、木、火的初见与留站诸段仍待单独处理。 [《四书》卷一第 8 章](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/1B%2A.html)

第 13 至 16 章按实际确认的热带星座配对。六分、四分、三分、对分用最短座数 2、3、4、6；分点座及至点座的对称遵循 Robbins 注 80、82、83 的整座配对。查询会列出配对的两星、星座、分点座或至点座及两侧步数，指挥或从属条目另明确配对列首的夏／冬半圆。相隔一座、五座的离隔条件排除上述两类对称，且两端都必须有确认星座。条目按 ID 历史查询，已在全量星座对上对照原注。 [《四书》卷一第 13–16 章及注 80–83](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/1B%2A.html) · [排盘样例](claims/integration-batch-185-witnesses.json)

## 第一百八十六批·托勒密卷一的具名恒星

卷一第 9 章按古代星图的位置比较恒星与行星的传统性质。本批采用项目既有 Hipparcos-2 数据，核毕宿五、北河三、狮子心、角宿一、心宿二、大角星、五车二、参宿四、天狼星和南河三。天蝎躯干、御夫座及猎户肩部三个多星组分别先接心宿二、五车二、参宿四。其余恒星成员继续按照原注及古星图确认。 [《四书》卷一第 9 章及注 40–61](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/1B%2A.html) · [Hipparcos-2 星表说明](https://cdsarc.cds.unistra.fr/viz-bin/ReadMe/I/311?format=html&tex=true)

第 9 章列恒星性质，项目在按 ID 核对时采用 1° 的黄道投影尺度。单颗恒星的热带视黄经须与七曜、真实上升点或中天之一在 1° 内。查询返回命中的恒星名、盘面对象、两端黄经和实际短弧距离。出生时刻未知、经度冲突或超过阈值时对应证据不成立。共升和共中天需要黄纬及地平几何，沿用项目已有的独立判据。 [排盘样例](claims/integration-batch-186-witnesses.json)

## 第一百八十七批·托勒密卷一的四性质、四角与三分组

卷一第 4 章为已确认盘面对象返回本星冷、热、燥、湿的原书分类。日月修饰条核古典五星之一与太阳或月亮构成第 13 章的六分、四分、三分或对分。第 10 章以太阳的热带星座核四季。原书的东、南、西、北分别取上升、上中天、下降、下中天，项目当前使用 1° 黄经近角来取证。 [《四书》卷一第 4、10、13 章](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/1B%2A.html)

第 10 章同类或相反条目只比较可核的优势性质。太阳、木星属热，月亮、金星属湿，火星属燥，土星属冷。水星的性质随配置变化。四季和近角可各自提供见证，人生阶段的原书类比及更宽近角范围保留待核。 [《四书》卷一第 4、10 章](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/1B%2A.html)

第 12 章分别核从实际上升座交替的完整十二座，以及按四轴划分的象限。后者须确认整个热带星座在同一象限，跨轴的星座继续待核。第 17 章按狮子至摩羯、水瓶至巨蟹分别核太阳、月亮庙座半圆。第 18 章按四组三分的实际落座查询历史风向，Robbins 英译的东方和 Hübner 希腊校勘本的主东方、混合东北共用同一盘面条件，各自返回原有文本与条目 ID。 [Robbins 卷一第 12、17、18 章](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/1B%2A.html) · [Hübner 希腊校勘本卷一第 19 章](https://ptolemaeus.badw.de/edition/9/27/text/1) · [排盘样例](claims/integration-batch-187-witnesses.json)

## 第一百八十八批·托勒密远行章的落宫、福点与黄纬

Robbins 卷四第 8 章及注 57 以月亮实落第七宫或第三、六、九、十二宫核远行。火星须实际落第七、九宫之一，同时刑或冲日月之一。行星使用原生雷吉奥蒙塔努斯三维落宫。已确认月亮或火星指征时，按昼夜同式计算福点，核其热带星座与五处指定宫头之一同座。之后才查当用位置的木星或金星整座相位、紧接下一座、土星或火星整座相位，以及本座或庙主的双体分类。 [Robbins 卷四第 8 章及注 57](https://penelope.uchicago.edu/Thayer/e/roman/texts/ptolemy/tetrabiblos/4c%2A.html)

方向条只核书中的盘面分支。当前按卷一第 6 章并参照 Cardano 的角区说明，以第 4–6 宫核下部东方，以第 1–3、7–9 宫核西方及西角，均须日月同时满足。双形的额外类别和其他地平读法继续待核。 [Robbins 卷一第 6 章](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/1B%2A.html) · [Cardano 1578 年评注第 478 页](https://ptolemaeus.badw.de/print/12/3/text/4#478)

Cardano 评注另核第九宫火星对日或月成刑或冲、第七宫月亮或合资格火星得自身庙或擢升、第十二宫日月，以及福点与合资格月亮或火星同在第七、九宫。福点相伴采用 3° 黄经近距。后继取已确认指征之后紧接的星座。出生时视黄纬的正负用于南北位置，出生时刻前后各半小时的视黄纬位移用于当前上、下行口径，两类证据分开返回。旧盘缺少位移时仍可核南北位置，未知出生时刻时不采用这组证据。其他上、下行读法待核。 [Cardano 1578 年评注第 476–478 页](https://ptolemaeus.badw.de/print/12/3/text/4#476) · [排盘样例](claims/integration-batch-188-witnesses.json)

## 第一百八十九批·托勒密远行章的主宰与相对优势

依卷四第 8 章及注 58 所指的卷三第 3 章核主宰。每个实际光体及有效远行位置独立比较七曜。五项依据为庙、擢升、所属昼夜三分、界和相位。三分与托勒密手稿界从统一 SQLite 按本命昼夜和热带度数读取，相位采用卷一的六分、四分、三分、对分。木金各为一个光体的唯一首要主星，且分别在已确认的远行位置具最多依据。土火支要求两星各为一个光体的唯一首要主星且已有有效远行位置。土火整座对分另查加强支。 [Robbins 卷四第 8 章及注 58–59](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4c%2A.html) · [Robbins 卷三第 3 章](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/3A%2A.html)

土火两星的星座均须落入条目所指形类。水生为巨蟹、天蝎、双鱼，固定为金牛、狮子、天蝎、宝瓶，分至为白羊、巨蟹、天秤、摩羯，人形为双子、处女、天秤、宝瓶，陆生形为白羊、金牛、狮子、天蝎、射手、摩羯。水星加入用同座且相距不超过 3° 的黄经近合联系一星，再以近合或整座相位联系另一星。3° 是项目当前采用的近距阈值。财物分支依 IV.8 注 59 参照 IV.2，核合格月亮或火星位置的唯一首要主星也是实算福点庙主，且在自身实际落点至少有两项尊贵。 [Cardano 第 479–481 页](https://ptolemaeus.badw.de/print/12/3/text/4#479) · [Robbins 卷四第 2 章](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4A%2A.html)

相对优势只在同一个远行位置比较。该位置须同时有木金和土火中的整座相位见证，唯一优势星对该位置的主宰依据数严格领先全部竞争见证，同时自身尊贵和实盘落宫均不弱于它们。落宫依次取第一与第十宫、第四与第七宫、续宫、果宫。查询逐处返回双方相位、尊贵、落宫及优势星，因此同一盘的不同位置可以给出不同结果。本批 14 条均按 ID 查询。其他主宰选法、晨见和增速对强弱的影响、黄道外形象、双形与双体的版本差异及非本命触发时点仍待核。 [排盘样例](claims/integration-batch-189-witnesses.json)

## 第一百九十批·托勒密卷一的星座分类、本面、相位与角位

第 11 章逐一核实至点、分点、固定和双体四类热带星座，历史解释列出每颗见证星的实际落座。第 23 章本面按第 17 章庙座图，核金、火、木的六分、四分、三分和方向，以及土星的对分。一般条文可以对太阳或月亮成立，金星专例同时核昏方两座见太阳及晨方两座见月亮。水星在庙座图相邻位置的本面异读仍待核。战车与王座的当前分支要求同一星体在实盘落点具备至少两项庙、擢升、昼夜三分或托勒密手稿界，以统一 SQLite 的既有三分和界资料取证。 [Robbins 卷一第 11、17、23 章及注 123–125](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/1B%2A.html)

第 24 章的渐入、渐出依据两星的有向黄经时速。形体合相还要确认两个视黄纬严格同号。射线采用已成立的整座六分、四分、三分或对分。两路当前均取距精确黄经位置不超过 3°，精确重合和相对时速无法判向的情况留待核对。3° 是项目当前的近距尺度。原书关于本轮与均轮的增损、其他容许度和间接亲和仍待接入。 [Robbins 卷一第 24 章及注 127–135](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/1B%2A.html)

角位使用实际视黄纬、黄赤交角和原生雷吉奥蒙塔努斯宫头复验本地子午线。通过上中天、下中天或几何地平以时刻相距 1 恒星度内取证，出生后超过 1 至 3 恒星度才通过上中天的另列趋近支。后继取实际上升座之后的完整下一座。对上升座的离隔按第 16 章排除分至对称，其他成相位置另排除本批已支持的角位及后继支。九份样例只使用排盘事实，命中标为历史查询。 [Robbins 卷一第 16、24 章](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/1B%2A.html) · [排盘样例](claims/integration-batch-190-witnesses.json)

## 第一百九十一批·托勒密远行的分题主宰与卡尔达诺比较

Robbins 卷四第 8 章注 59 将职业、财物、身体和名位分别指向原书分题。本批复用第 189 批的五项取主方法，让同一行星在已确认的远行位置和相关分题位置都具最多依据，且每处只有这一首要主星。职业支取中天，名位支取太阳所在位置，参照 Cardano 第 480 页列出的联系。身体支按卷三第 11 章同时取实盘上升和月亮，并另核一处有效火星或福点远行位置。月亮自身的远行身份不能重复承担身体分支的独立取证。其他职业、名位取星和身体分支仍待核。 [Robbins 卷四第 8 章及注 59](https://penelope.uchicago.edu/Thayer/e/roman/texts/ptolemy/tetrabiblos/4c%2A.html) · [Robbins 卷三第 11 章](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/3C%2A.html) · [Cardano 第 480 页](https://ptolemaeus.badw.de/print/12/3/text/4#480)

Cardano 的相位精度和尊贵分别比较。两路都先按该版核日、月、火星或福点是否为当用远行位置。精度支要求至少两颗整座见证星距各自精确黄经相位不超过 3°，距离最小者须唯一。尊贵支允许凭整座相位或尊贵入选，再比较远行处本身的庙、擢升、昼夜三分和托勒密手稿界，尊贵数最高者须唯一。查询逐处返回所有参比星及依据，平手与其他近距口径留待核。福点样例显示水星距射线最近，土星在福点所在度数取得最多尊贵。 [Cardano 第 476–480 页](https://ptolemaeus.badw.de/print/12/3/text/4#476) · [排盘样例](claims/integration-batch-191-witnesses.json)

## 第二百零二批·莉莉远行篇的阻碍见证与星座分类

取已经成立的本命远行指征星，分别按莉莉两张容许度表查询。一般困难分支核火星或土星的相位，以及指征星所在星座是否由另一颗火星或土星主管。具体受阻分支核火星、土星与指征星的合、刑、冲。第三宫和第十二宫分支取实际造成阻碍的同一颗星的宫位。原文另述的相对高位及一般困难条目的独立旺衰条件继续待核。 [莉莉卷三第 610 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=124)

星座分类取实际受阻的指征星落座。固定支包括金牛、狮子和水瓶，气水两类取湿性。人形支取双子、处女、天秤、水瓶，兽形支取白羊、金牛、狮子、射手、摩羯。三份原生排盘覆盖新增 26 个 SQLite 条件组，另验证同宫无关星、两表容许度不同、缺失出生时刻或必要星体的情况。 [莉莉卷一第 88 页](https://en.wikisource.org/wiki/Page:Christian_Astrology_(Lilly,_1659).djvu/114) · [排盘与回归测试](integration-batch-202.test.mjs)

## 第二百零五批·莉莉友伴篇实占行星的尊贵、强弱与受损

核第一、第十一宫的实占古典行星，沿用莉莉的宫头前五度规则。木星、金星的强化分支要求实际入庙或擢升，卷一强弱表在未决项计入可能区间后，最低总分仍大于零。土星、火星的衰弱分支要求失势或落陷，最高可能总分仍小于零。土火及太阳、月亮、水星的得位分支核入庙或擢升。所有证据都与实际落宫的同一颗行星绑定。 [卷三第 634–635 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=148) · [卷一第 115 页](https://www.worldastrology.net/wp-content/uploads/2008/12/CA-I.pdf#page=135)

木星、金星及太阳、月亮、水星的受损分支核同一颗星失势或落陷，并与火星或土星成刑或冲。两张容许度表独立判定。福点、宫主及相位选择的其他路径、只靠次要尊贵或其他受损口径继续待核。28 份原生盘例覆盖全部 38 个新增 SQLite 条件组，并核实同一构型移出指定宫位、容许度不同及缺少星体经度时的结果。 [排盘与回归测试](integration-batch-205.test.mjs)

## 第二百三十三批·莉莉卷一的相位方向与行星状态

第十九章的相位方向按列出的第一星向第二星沿热带黄道顺数。有向座距 2、3、4 和 10、9、8 分别取顺序及逆序。对分取 6，离隔取 1、5、7、11。以确认落座的两颗不同古典行星为见证，列出其顺序与实际星座。第 109 页关于逆序权重的说法按同一方向表取证。 [卷一第 108–109 页](https://www.worldastrology.net/wp-content/uploads/2008/12/CA-I.pdf#page=128)

双逆行渐入与六角分起离以黄经及有向时速判定。先核实际落座对应的合、六合、刑、拱或冲，再分别查原书两列半容许度之和。双逆行遇上级与下级的其他取法待核。漂泊查原书庙、擢升、当值三分、界、面五项。夹持取原书例示的同座条件，要求第三星实际黄经严格位于火土之间。 [卷一第 107–114 页](https://www.worldastrology.net/wp-content/uploads/2008/12/CA-I.pdf#page=127)

Hayz 的昼支核太阳、木星、土星中的阳性落座及实居地平线上方，夜支核月亮、金星中的阴性落座及实居地平线下方。地平侧使用未平移的原生雷吉奥蒙塔努斯三维宫位并与实算昼夜相符。水星条件待核。日心、燃烧、日光下沿用已核太阳距离，日心优先取证。燃烧采用正文的同座 8°30′ 口径，原书十度例继续待核。区分上级行星、月亮和水金的相对太阳方位，水金另核同座或所指紧邻座。 [卷一第 113–114 页](https://www.worldastrology.net/wp-content/uploads/2008/12/CA-I.pdf#page=133)

25 条新增记录通过历史查询按 ID 返回盘面见证。原有 14 条容许度表项和 3 条宽相与渐入方法由既有计算参考查询提供证据。7 份排盘覆盖新增条目，并检查两列容许度、六角分边界、未知时刻及普通报告的取材范围。 [排盘与回归测试](integration-batch-233.test.mjs)

## 第二百三十四批·莉莉卷三的家务与对立指征

家务指征取第六宫主、水星和第六宫实际落入的古典行星。同一星体兼任多种角色时计一次。多数条件以确认七曜落宫为前提，逐星核本性及积分区间。第六宫主入角及水星居指定宫位的强势分支要求该星积分区间下界为正。水星趋近木星按实测时速及两列容许度分别判断，并要求木星处于基本或变动座。火星、土星支要求同一指征星有本质尊贵且六合或拱上升主。 [卷三第 586 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=100)

对立指征包括第七、十二宫的实占星及宫主，以及对冲任一光体的其他古典行星。角宫与强势绑定同一指征星。当值光体按昼取日、夜取月，并核其在八宫外、落入火星的任一本质尊贵范围，或和火星形成双向庙位接纳。火星最强要求其积分下界严格高于另外六曜各自的上界，再核火星与当值光体在其中一列容许度内合相。更宽的近距读法待核。 [卷三第 639–641 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=153)

历史条目按 ID 核北交点、南交点、当用指征落宫及其本性。土火同在十二宫时，分别按两星积分区间均为正或均为负取证。六、十二宫对列要求火星和土星各自实落其一。狮子或射手支取十二宫头及同座、同宫的弱星，十二宫内不同星座所涉读法待核。9 份盘面覆盖 18 条，并补验庙位互容、土火互换和两个指定宫头星座。 [卷三第 640–642 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=154) · [排盘与回归测试](integration-batch-234.test.mjs)

## 第二百三十五批·托勒密兄弟姐妹篇的位置与见证

依据 Robbins 注 26，起点仅取实际中天与当派母星同座的共同分支。昼取金星，夜取月亮。起点座与后继座独立取证。木星、金星用整座六合、刑、拱或冲联系所查位置。凶星压过取从前方三个星座起右刑，另核实冲，同段太阳的加强条件要求太阳也见证同一个位置。 [Robbins 卷三第 5 章及注 26](https://penelope.uchicago.edu/Thayer/e/roman/texts/ptolemy/tetrabiblos/3a%2A.html)

和谐分支核给予星与该位置的传统庙主成六合或拱。福点续句还要同一颗给予星与实算福点成六合或拱，沿用托勒密昼夜同式的实测黄经。Robbins 相离条比较给予星和实际庙主，Ashmand 相离条比较与同一位置关联的两颗给予星。Ashmand 的中天、昼金星、夜月亮分别作为可选起点及其后继座。 [Robbins 卷三第 5 章及注 30–31](https://penelope.uchicago.edu/Thayer/e/roman/texts/ptolemy/tetrabiblos/3a%2A.html) · [Ashmand 卷三第 6 章](https://sacred-texts.com/book/ptolemy-s-tetrabiblos/chapter-vi-brothers-and-sisters)

单形和双体按给予星实际落座核对。地平方位依 Robbins 注 29，以未平移的三维宫位核象限，从上升至中天与下降至下中天为东方两象限。Hübner 火星条核实际火星 1° 内近角、所查位置位于对角的星座，以及整座对冲；近角度数是项目取证尺度。凶星压过给予星与紧接其后一座分别核对。卡尔达诺的水星条保留原书分类。母星与中天异座、土星角位异读、派生盘和实际亲属人数继续待核。 [Hübner 卷三第 6 章](https://ptolemaeus.badw.de/edition/9/27/text/1#III.6) · [卡尔达诺评注第 346 页](https://ptolemaeus.badw.de/print/12/3/text/3#346)

11 份排盘覆盖全部 18 条历史查询记录，另核缺出生时刻、福点缺实际黄经、两颗给予星角色和客户端派生值边界。 [排盘与回归测试](integration-batch-235.test.mjs)

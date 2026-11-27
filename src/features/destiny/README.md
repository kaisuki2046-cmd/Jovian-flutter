# 命理

命理管理出生资料输入、排盘规则、评分与解读视图。个人命理入口为 `DestinyScreen`，合盘手填入口为 `renderManualOwner`（A 方）和 `renderManualSubject`（B 方）。

## 当前可用范围

- 出生日期、时间、地点和性别在同一页按顺序排列，提交时统一校验。出生时间须确认小时和分钟。没有可回填的时间时，滚轮初始停在 12:00，用户核对后确认。旧档案的已知时分可回填，须补齐并确认后才可重新测算。
- 地点可离线逐级选择或搜索。目录复用账户模块的中国大陆行政区名称和层级，覆盖 31 个省级行政区中已匹配坐标和时区的近 3,000 个市、区县等条目，并保留纽约、伦敦。每个可选地点保存代表点坐标、IANA 时区及可用的行政编码。区县缺少可靠匹配时，可手动选择已收录的所属城市。
- 日期支持 1900 年到设备当天。按出生地 IANA 时区解析当地日期和时刻，使用运行环境提供的历史时区数据。夏令时缺口和回拨重叠的精确输入会提示具体原因。保留未知时间推算逻辑：只知道小时则在该小时每五分钟及末分钟取样，只知道分钟则取当天各小时的对应分钟。时分皆未知则每半小时及日末取样。采样跳过不存在的时刻，纳入回拨的两个有效时刻。
- 八字使用 [lunar-javascript 1.7.8](https://github.com/6tail/lunar-javascript) 计算四柱。年、月柱按固定 UTC+8 的绝对节气时刻交界，日、时柱用出生地民用时间，晚子时换日，不校正真太阳时。
- 八字同一次排盘返回四柱、逐柱十神和神煞。十神按已排出的日干计算各柱天干和地支藏干，日柱天干记为「日主」。神煞口径 `natal-shensha-v1` 覆盖八项。天乙贵人、文昌贵人以年干和日干查四柱地支，禄神以日干查地支。驿马、将星、华盖、桃花以年支和日支查其他柱，空亡以年柱和日柱的旬空查其他柱。同柱同名的命中合并并保留来源柱。出生时刻不全时，检索只采用各情景一致的事实。 [十神与旬空接口](https://6tail.cn/calendar/api.html) · [神煞规则参考](https://github.com/ZHENYI-ORG/Zhenyi-bazi/blob/main/src/data/shensha-rules.json)
- 紫微使用 [iztro 2.6.5](https://github.com/SylarLong/iztro) 的通行安星法。农历正月初一换年，闰月初一至十五沿用当月，十六起按下月，晚子时留在当日。保留十二宫、星曜、四化与运限原始结构。未知时刻按有效时辰去重计算，早子与晚子分别保留。命理表单提供「女」「男」两项。旧档案的「其他」仍可读取，重新测算时需要重新选择。
- 左辅、右弼按所在宫的地支补充庙、旺、平、闲、陷。生年纳音以紫微排出的本命年干支查六十甲子表，沿用农历正月初一换年。宫位详情和新归档都显示这两项。出处见 [《中州派紫微斗数讲义》诸星庙陷总表](https://vr-d.com/pdf-file/%E7%B4%AB%E5%BE%AE%E6%96%97%E6%95%B0%2F%E4%B8%AD%E5%B7%9E%E6%B4%BE%E7%B4%AB%E5%BE%AE%E6%96%97%E6%95%B0%E8%AE%B2%E4%B9%89.pdf) 与 [lunar-javascript 纳音表](https://github.com/6tail/lunar-javascript/blob/v1.7.8/lunar.js)。
- 西方使用 [Astronomy Engine 2.1.19](https://github.com/cosinekitty/astronomy) 计算太阳、月亮、地球以外的七颗行星及冥王星的地心位置。采用热带黄道和整宫制，计算上升、天顶、十二宫及五种主要相位（容许度 6°）。三套依赖的上游许可均为 MIT。
- 命理结果页以综合、事业、爱情、学业、财富五个小标题展示正文，兼容旧 Markdown、编号、括号及感情／财运标题。每个主题先写性格特点，再重点分析具体事件；资料不足时从已有盘面推演。正文下方可打开命盘弹窗。弹窗按八字、紫微斗数和西方星盘切换。重新打开 app 后，弹窗读取归档盘面，并用已保存的四柱干支恢复可确定的十神和神煞。
- 报告服务将已确认的八字、紫微与西占盘面事实逐项转换为中文句子，再按五个主题提供书籍出处与原文、实际命中条件和现代释义。盘面与条件共用中文转换，不向模型发送整包 JSON、内部字段名或索引。DeepSeek 自行组织正文，客户端直接显示。请求失败时可手动重试并复用本次盘面。见 [命理报告服务](server/README.md)。
- 八字、紫微和星盘的旧版 3,095 条规则与新版 18,846 条 Claim 已合并到单一 `destiny-knowledge.sqlite`，共 21,941 条，统一目录保留来源、状态和出处，报告在同一数据库快照内查询新旧资料。命理资料库采用「JSON 保留为可审查资料源，SQLite 作为运行时查询库」的约定；导入或更新 JSON 资料库时同时构建 SQLite、接入查询并验证完整性。见 [命理解读数据库](server/knowledge/README.md)。
- 报告查询按实际七曜位置读取托勒密三套界表，按方案及昼夜分别保留界主、区间与出处。160条源表在统一 SQLite 中用于计算和中文报告材料，不直接当作个人性格／事件断语；见 [三套界表说明](server/knowledge/PTOLEMY_TERMS.md)。
- 自然表达库用本地 Markdown 约束语气、句式和词汇。默认只注入风格规则，可在现有 Prompt 中附带少量示例。见 [自然表达库](server/natural-expression/README.md)。
- 会员点击「核对资料」或重新测算时直接进入表单，已保存且可识别的出生资料会回填。提交表单时确认同步，保存成功才开始测算，个人中心已设的逐项可见性由账户保留。遇到另一处已保存的修改时，页面显示两份资料供选择。访客确认后直接测算。旧的 SecureStore 档案可作为本机候选资料。
- 会员和有效游客会话完成解读后，使用账户 V1 契约自动保存。`overview` 保存完整正文，`charts` 保存已算出的基础盘面。命理首页优先显示最近一次已保存的解读。账户读取旧记录时将原有章节标题和段落合入 `overview`，无需重新排盘或生成解读。账户侧的历史页面和归档字段限制由账户模块维护。
- 会员连接同一账户服务即可跨设备查看。游客可以在同一设备恢复有效的 7 天临时会话后回看，结束游客体验或登录后由账户清理游客归档。命理切换身份时清理旧页面状态并中止在途归档请求。

## 组织与协作

新命盘快照可记录已确认的出生 UTC、分钟精度、出生地坐标与 IANA 时区及转换口径。八字已知时刻及适用性别时记录节气起运规则、顺逆和每步运柱的 UTC 半开区间。紫微记录实际采用的亮度表版本及可核对的生年四化来源。未知出生时刻不生成单一出生上下文。这些新增字段供本机计算与本人归档，报告请求仍使用结构化盘面事实。

资料接入第三十三批新增八字5条完整索引，另将1条旧分句按同一组条件升级为整条；新增31组条件，新增及升级共32组均有原生排盘见证。年癸月己与藏丙、指定月时双丙、火透水不透、全局无水和庚透无丁分别核对，见 [文字条件接线](server/knowledge/BAZI_LITERAL_CONDITIONS.md#第三十三批年干月干与五行透藏)。

资料接入第三十二批新增八字2条完整索引、27组条件，分别核对月时两处透庚且全局无辛、庚辛各有实际藏干。藏不自动要求不透；两条三干全透候选因历法相容性仍未索引，见 [明确文字接线](server/knowledge/BAZI_LITERAL_CONDITIONS.md#第三十二批指定月时与多干伏藏)。

资料接入第三十一批把19条托勒密分类资料、61个条件单元接入SQLite和实际报告，计算参考源增至323条。自然类别、固定派别、热带星座类别和昼夜三分主分别核对；个人断语索引数不变，见 [分类参考接线](server/knowledge/PTOLEMY_CLASSIFICATIONS.md)。剩余项见 [接入进度](server/knowledge/INTEGRATION_PROGRESS.md)。

资料接入第二十六批补齐未限定相位种类的肯定／否定条件，新增8条完整记录、扩展2条已有部分记录，共28个新条件组进入SQLite和报告。原书合相用语歧义保留未知，不以缺坐标或同一宫主冒充“无相位”；见 [来源与接线](server/knowledge/LILLY_UNSPECIFIED_ASPECTS.md)。

资料接入第二十五批补齐太阳邻近状态、相对太阳东西方位和莉莉日行快慢判断，新增9条完整记录及1条旧记录的独立备选，实际进入统一SQLite和报告材料。未知时间及旧盘缺新增日行量时不补造证据，原始资料冲突与采用的推定见 [太阳关系与日行量](server/knowledge/LILLY_SOLAR_MOTION.md)。

资料库持续接入已增加一组与整宫制隔离的 Regiomontanus 几何宫制事实。默认命盘展示和原整宫制字段保持原口径；报告材料将两组事实分开标记。几何计算使用已确认的出生时刻、地点和天体纬度，未知时间或不可用几何不提供这组事实，不改写旧归档。验证和剩余工作见 [接入进度](server/knowledge/INTEGRATION_PROGRESS.md)。

第六批核对原书后，莉莉相关资料改用另行标记的黄经／宫头前五度判读，并接入传统宫主与宫主落宫；几何三维结果继续保留。新增 32 条、修正原 35 条的实际检索均已验证，2 条仍有未实现备选。明确性别从命理请求传递以选择原书男女分支，未知时间或缺精确宫头时不生成历史判宫事实。

页面从 `index.ts` 进入 `screen.tsx`，由 `DestinyFlow` 展示表单和结果。`useBirthForm` 提交已确认的出生资料，`useDestiny` 协调本机排盘、API 解读和账户归档。公共主题、按钮、输入和减少动效检测来自 `src/ui/`。

### 文件索引

| 文件 | 职责 |
| --- | --- |
| [`index.ts`](index.ts) | 对外导出 `DestinyScreen`。 |
| [`screen.tsx`](screen.tsx) | 接收账户会话，按身份重建命理页面，装配表单和测算状态。 |
| [`view/DestinyFlow.tsx`](view/DestinyFlow.tsx) | 命理首页、四项录入、测算进度、报告及归档反馈。 |
| [`view/BirthFields.tsx`](view/BirthFields.tsx) | 个人测算与合盘代录共用的出生资料表单。 |
| [`view/BirthPickers.tsx`](view/BirthPickers.tsx) | 日期、具体时分和地点选择面板。 |
| [`view/ManualSubjectEditor.tsx`](view/ManualSubjectEditor.tsx) | 合盘 A、B 双方共用的临时录入与确认。 |
| [`view/BirthWheel.tsx`](view/BirthWheel.tsx) | 日历和时分共用的滚轮组件，处理滚动吸附、点击选择及无障碍状态。 |
| [`view/ChartDialog.tsx`](view/ChartDialog.tsx) | 命盘弹窗、分栏导航和滚动区域。 |
| [`view/ChartPanels.tsx`](view/ChartPanels.tsx) | 展示本次三套排盘详情或已归档的基础盘面。 |
| [`view/StarVisual.tsx`](view/StarVisual.tsx) | 星空背景、测算动效和开始测算按钮。 |
| [`control/useBirthForm.ts`](control/useBirthForm.ts) | 管理确认前的滚轮默认值、确认后的表单值和提交校验。 |
| [`control/useDestiny.ts`](control/useDestiny.ts) | 协调账户资料回填、本机档案、测算取消、API 解读和重试。 |
| [`control/useDestinyArchive.ts`](control/useDestinyArchive.ts) | 经账户公开接口加载最近报告、保存新报告，处理身份失效与重试。 |
| [`control/account-report.ts`](control/account-report.ts) | 解析账户出生日期和时分，将报告正文转换为账户 V1 归档格式。 |
| [`control/birth-clock.ts`](control/birth-clock.ts) | 按出生地时区解析当地时间，处理夏令时边界和未知时分的取样。 |
| [`control/charts.ts`](control/charts.ts) | 封装三套排盘引擎。八字同次计算四柱、天干和藏干十神、神煞。 |
| [`control/local-reading.ts`](control/local-reading.ts) | 执行三套排盘并汇总各候选时刻的盘面数据。 |
| [`control/manual-subject.ts`](control/manual-subject.ts) | 生成合盘需要的三术字段，保留可用性和规则版本。 |
| [`model/birth-profile.ts`](model/birth-profile.ts) | 定义出生资料和完整、部分或未知的时分，保存基础地点与输入校验。 |
| [`model/birth-places.ts`](model/birth-places.ts) | 合并基础地点和离线行政区目录，为新增地点生成 `CN-<行政编码>` ID，并按地点 ID 查询。 |
| [`model/china-birth-places.ts`](model/china-birth-places.ts) | 保存中国大陆地点行数据。来源见下文和[随附许可](model/china-division.LICENSE)。 |
| [`model/local-profile.ts`](model/local-profile.ts) | 通过 SecureStore 读写按账号区分的本机出生资料。 |
| [`model/lunar-javascript.d.ts`](model/lunar-javascript.d.ts) | 补充八字引擎在项目中使用的 TypeScript 声明。 |
| [`model/reading.ts`](model/reading.ts) | 定义排盘结果、计算阶段和报告字数上限。 |
| [`requests/report.ts`](requests/report.ts) | 提取确认的盘面事实、调用深度解读，校验并采用完整的报告正文。见 [命理请求](requests/README.md)。 |
| [`server/`](server/README.md) | HTTP 服务、Prompt、规则匹配和模型调用。 |
| [`server/knowledge/`](server/knowledge/README.md) | 双层关键词解读规则库和出处登记。 |
| [`reading.test.mjs`](reading.test.mjs) | 测试出生资料、地点兼容、时区、排盘和 API 报告请求。 |

离线地点表沿用账户地点目录的 2023 年行政区名称，并与同版本的 [行政区代码表](https://github.com/modood/Administrative-divisions-of-China/blob/c49d495b40ac73eb1a66f6eeae5f8fd10696f035/dist/pca-code.json) 及 [GeoNames](https://www.geonames.org/export/) 行政记录匹配。坐标为四舍五入后的 WGS84 代表点，GeoNames 数据按 CC BY 提供。行政区划的 [WTFPL v2 许可](model/china-division.LICENSE) 随目录保留。

协作规则见 [命理开工说明](AGENTS.md)、[协作协议](../../../COLLABORATION.md) 和 [框架图](../../../FRAMEWORK.md)。

## 合盘代录接入

路由装配时从命理公开入口导入两个手填入口，传给合盘页面的同名属性。

```tsx
<SynastryScreen
  renderManualOwner={renderManualOwner}
  renderManualSubject={renderManualSubject}
/>
```

代录表单要求确认小时和分钟，用本机引擎计算并回传 `calculatedAt` 及八字、紫微、西占的对比字段。程序调用方可直接使用 `calculateManualSubjectChart(profile, signal?)`。

两个入口均接收 `onConfirm(chart)` 和 `onCancel()`。出生资料只用于本次本机计算，回调只交付结构化盘面和计算时间。手填不调用报告 API 或写入账户归档。合盘仍可通过账户公开接口读取 A 方的归档盘面。

## 后续接入

- 计划在命理首页展示「周期运势」入口，由路由层传入目标地址，页面内容由[运势模块](../fortune/README.md)维护。
- [合盘底栏路由](../../app/README.md)由路由负责人装配上方入口，双人比较由合盘模块维护。
- 当前样例覆盖节气、子时、闰月、夏令时和春分。节气或天体交界仍使用既有半小时采样及日末补采，进一步的边界细分与更多流派样例待校准。
- 多法主题映射和三库内容仍可用更多样例审核与校准。

> **跨板块协作**　其他板块的代码可以阅读和参考，可通过对方明确开放的入口或公共 UI 复用能力。需要修改认领范围外的文件时，包括其他板块的代码、业务页面和说明文档，须先向用户说明具体文件、原因和影响，取得明确授权后再修改。

资料库第二十批接通莉莉职业指征前两步及11条对应资料，30个条件输入经实际排盘、SQLite、解释与报告材料验证；多星同主与唯一指征分开，后续选星仍待实现。见 [职业资料接线](server/knowledge/LILLY_PROFESSION.md)。本批无页面或公共UI改动，尚未提交或合入。

资料库第二十一批新增紫微6条、升级2条原分句，32个整条位置条件完成原生排盘、SQLite、解释和报告验证。命／身、同／对和两侧夹宫分别核对，现行布局不相容与原例背景保留待核。见 [明确位置接线](server/knowledge/ZIWEI_RELATIVE_PALACES.md)。本批无页面或公共UI改动，未提交或合入。

资料库第二十二批新增八字7条可查询记录，共148个整条／分句备选。原局十神同现与更强的结构成立门槛分开；透藏、女命、月令和固定柱位保留。见 [八字原局十神接线](server/knowledge/BAZI_NATAL_GODS.md)。本批无页面或公共UI改动，未提交或合入。

资料库第二十三批新增紫微6条可查询记录，生年天干／地支、天马夫妻宫及廉贞申宫分级共26个备选接通SQLite和报告取材；擎羊另8个原列备选与当前安星法不相容，仍保留待办。见 [生年与等级接线](server/knowledge/ZIWEI_NATAL_YEARS.md)。本批无页面或公共UI改动，未提交或合入。

资料库第二十四批新增西占15条、35个条件备选，星座类别按实际宫头、宫主、金星定位星和职业指征分别核对；多个对象不互相替代，未知及伪造派生标记不作证据。见 [星座类别接线](server/knowledge/LILLY_SIGN_CLASSES.md)。本批无页面或公共UI改动，未提交或合入。

## Flutter 与 Node

`control/` 包含 Flutter 页面控制器及 TypeScript 命理算法。纯 Dart 排盘与时间计算在 `control/calculation/`，其数据契约在 `model/contracts/`。`view/` 通过控制器触发业务流程，`requests/` 和 `server/` 分别负责报告客户端和本仓库的 Node 接口。

# Leo 推运上升的本命优先与十分度

`leo-1906-interpretation-p001` 至 `p036` 共 36 条资料。原 JSON 供审查，机器规则由 SQLite 执行。其中 35 条已完成原文独立倾向的映射，天蝎第二十分度仍为部分匹配。 [全库覆盖](CONDITION_MAPPING_PROGRESS.md)

## 原页与版本

目视核对《The Progressed Horoscope》[数字重排版第62页](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=62)的36十分度表，以及[第68页](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=68)、[第69页](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=69)的本命、推运主次说明。页数是362页数字重排PDF中的页码，不冒称1906年影印的原印页码。原JSON所引IAPSOP影印与其原印页码照旧保存。

十分度每十度一段：第一段沿用本星座，第二段是黄道顺序的下一个同元素星座，第三段再顺推一个。白羊依次白羊、狮子、射手；水瓶依次水瓶、双子、天秤。它不同于Lilly的十度面表，不互换。区间采用0至10、10至20、20至30的半开划分；30度归下一星座。

主星表另目视核对同作者《How to Judge a Nativity》**1928年第四版原印第26至27页**，[下载PDF第51页](https://archive.org/download/howtojudgenativi00leoa/howtojudgenativi00leoa.pdf#page=51)为原印第27页。该明确表格中水瓶为土星、双鱼为木星、天蝎为火星；不从现代库补天王、海王或冥王主星。附注没有给天王、海王分配星座本垣，不能把其“替代”文字泛化为现代星座守护表。这是同作者的**辅助版本依据**，不是证明1906年版表格逐字一致；版本差异继续进入逐条审查缺项。

`model/fixtures/leo-ascendant-reference.json`保存目视抄录的全部36个对应、12星座主星、页码、版本说明和两份PDF哈希；完整PDF和渲染图仅缓存在忽略目录。

## 同一盘、同一片段的事实

`control/leo-ascendant.ts`新增 `leo_ascendant_context`：

- 本命上升星座、十分度、对应星座和两位主星；本命命主星终生优先。推运星座及十分度只叠加，不能替换本命。
- 同一真实推运上升区间内的星座、十分度、星座主星及附加主星。位置沿用既有原法角点推进；不换太阳弧、实际行运或其他宫头法。
- 上述相关主星的本命实际黄经、赤纬和来源时间分宫位置。相同主星只列一次，不按角色重复计权。
- 与该上升区间相交的全部Leo来源太阳、月亮、互相推运，按所有开始和结束共同切片。每片只保留确实覆盖全片的相位，精确点按半开时段归属；不会借隔期或不同候选补方向。
- 双鱼片段另保留本命木星对其他八天体的最短黄经距离、赤纬绝对差。本命太阳实际宫号及天底至下降点的半开黄道弧位置独立保留。

原书第一十分度说明也泛指整个星座，不能将其查询强制缩到第一段。因此12条整座规则适用三段，24条十分度修饰规则仅适用自己的第二或第三段；在后两段可以同时获得整座背景与相应修饰。它们仍是同一份上升背景，不作为两份独立支持票数。

事实来源同时连接可靠本命宫头和独立Leo上下文。单一候选、出生时刻、星历一致性及几何框架先由现有读取器核验；两个上下文必须同一出生时刻及来源profile。角点不可用、高纬不可分宫、出生时间未知或多候选时不补假定地点，不借整宫制兜底。

## 逐条条件与保留的缺项

36条查询均改用同一原子上下文，要求本命背景已核、层级优先、明确主星表版本、整座背景及具体目标星座；十分度条另要求对应段、对应星座及主星。每条保留原始证据与条件的哈希，并分别登记自己的能力、现实条件、同期方向及相反分支，不再共用一句笼统缺项。

第 525、528、530、533、536、539、545、546、549、552 条也以实际十分度核原书独立描述的倾向。摩羯第二段的二宫资源分支、狮子第二段的五宫及整盘有利前提继续独立审阅。双鱼整座的本命例外与天蝎第二十分度的现实响应继续保留未决。 [原书整座及十分度说明](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=69)

### 同期方向与本命木星条件

同一个上升时段同时收录次限对本命和同图次限。已逐对确认的月亮、太阳和其他相位，按各自目标盘层记录偏顺、偏难、混合或无已分类方向。各片段在上升十分度及实际相位起止处切开，以半开区间核对；不同时段与盘层中的证据不能相拼。 [原书本命、推运优先次序](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=69)

- 水瓶第二十分度 p002 的基础学习倾向按实际段查。同期偏顺相位须确实照到水星才列为合参，区分水星是受照对象还是主动次限星。第三十分度 p003 仍核同期至少一个已确认偏顺相位，记录同段也有偏难相位的情形。 [水瓶段](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=84)
- 白羊第三十分度 p006、双鱼第二十分度 p023、天蝎第三十分度 p030 查同层已分类推运偏难的子段。双鱼第三十分度 p024、射手第三十分度 p027 查同层已分类推运偏顺的子段。射手第二十分度 p026 保留独立的主动与仓促倾向，偏顺的实际方向另作合参。“很偏顺”或“很偏难”的程度仍待核。 [白羊段](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=71) · [双鱼段](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=85) · [天蝎和射手段](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=81)
- 双鱼整座 p022 用实际推运上升查原文独立描述的忧虑和待人倾向。附带例外另核本命太阳处于天底至下降点的半开黄道弧，以及木星按同作者后版参考表有六合或三分、无四分或对分。两项同时成立才列为联合例外候选。端点解释、木星有利的强弱和其他相位仍待核。 [双鱼原文](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=85) · [同作者本命参考表](https://archive.org/stream/howtojudgenativi00leoa/howtojudgenativi00leoa_djvu.txt)

### 摩羯与狮子的同期本命宫位

用 Leo 口径下已核的本命分宫取实际相关星。宫内有九曜时取实居星，空宫才取宫头座主星。同段次限相位须确实指向所取的本命星，同图次限相位另列。摩羯整座 p010 的勤勉和抱负作为基础，第十宫相关星的已分类方向用于事业分支合参。摩羯第二十分度 p011 仍要求第二宫相关星收到偏顺方向。 [摩羯原文](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=82) · [Leo 与 Green 的宫位判断次序](https://benebellwen.com/wp-content/uploads/2014/06/alan-leo-the-horoscope-in-detail.pdf)

狮子第二十分度 p017 查第五宫相关星收到偏顺方向，同时两个目标盘层均未发现已分类偏难方向。未分类项另留提示，其他方向体系与原文整盘标准仍待核。狮子第三十分度 p018 按实际段匹配开拓倾向，并留存同期偏顺、偏难及并见的分层证据。 [狮子原文](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=76) · [第五宫原文](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=116)

### 水瓶的思维主题与摩羯第三十分度

水瓶整座 p001 交叉核对同书的具名次限水星对本命天王星。六合与三分为偏顺候选，四分为偏难候选。三个十分度分别在真实上升和相位的交集中查证。反向的次限天王星对本命水星、同图次限、未分类相位及其他受照星均不满足此分支。水星三分天王星自身条目 p122 对同期月亮的增强条件由原独立查询核对。 [水瓶原文](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=83) · [具名水星相位](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=168) · [三分与月亮条件](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=169)

摩羯第三十分度 p012 的实务倾向按实际段匹配。两个目标盘层的既有同期方向分开留证，偏顺、偏难及同时出现均保留。原文未规定这些方向的统一优先级。 [摩羯第三十分度原文](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=83)

原书分层的回应、历史事件和特定成败继续留在各条原文。报告采用已经核实可独立使用的阶段倾向。

## 中文输入与验证

新增事实使用显式中文转换，说明本命优先、十分度修饰、主星表辅助版本及实际同期方向；位置黄经注明样本时刻，不能把样本度数当成全段恒定。机器字段、主星角色ID、原始盘面、内部索引和查询JSON不进入模型。部分资料不进入命中原文区，中文提示词约定保持不变。

`leo-ascendant.test.mjs` 核对参考表的 36 格、实际十分度边界和整座与修饰的适用范围。全年流水核对无漏段、实际上升归属、两个盘层每个活动方向及来源。另用真实星历盘例从客户端提交验到服务端 SQLite 和中文输入，覆盖水瓶水星受照、双鱼本命联合候选及缺条件的反例。

两组新增真实星历样例使用本命 1968 年 5 月 9 日与 1990 年 1 月 1 日的计算数据，直接测试 2026 年客户端提交、服务端 SQLite 和中文输入。另核三个水瓶十分度、分段起止、反向与异层排除，以及未分类方向不得独立命中。

24 条按事实层 v1.383 复验。36 个几何框架中，各份命中都落在原文所属星座和十分度。

# Leo 月亮过宫的同段背景

十二条次限月亮过宫资料分别保留本命和次限盘层、有效时间和本命背景。第一宫以实际穿越上升宫头匹配原文的独立主题，其余十一宫按有效过宫区间匹配。机器规则由 SQLite 查询。全库统计见[条件映射进度](CONDITION_MAPPING_PROGRESS.md)。

## 来源与两种星座

核读并渲染检查[数字PDF第114页的月亮总注](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=114)与[第117页的六、七宫分支](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=117)。原书要求太阳或互相推运的同性质呼应，不能将同时存在替代同性质；对过宫重要性的例子用三宫对应的双子，以及昼盘水星受克。实际三宫宫头未必在双子，不能用实际宫头星座去替换这个自然对应。

`control/leo-lunar-houses.ts` 的 `leo_lunar_house_context` 采用已有可靠时刻、单一候选、兼容角点和Placidus宫界。分别保存实际宫头星座、宫序自然对应星座、九颗来源天体在自然星座中的成员，以及实际落入该本命宫的成员。列出本命月亮星座、宫位和太阳几何昼夜关系；三宫另记水星对其余八颗本命天体的最短黄经夹角、赤纬绝对差。

原文的多星和突出未提供可直接采用的数量阈值。第三宫另核出生时太阳在地平线上方，以及本命水星实际参与参考外限内的四分、对分、半刑或倍半刑。本命月亮的位置与强弱仍分别处理。 [原书三宫示例](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=114)

## 年度次限宫分支

第七章逐日对应出生周年，并在所选符号日的出生钟点用恒星时排宫。第十一章明列月亮过本命或次限图第一宫，并以第三宫举例。SQLite 的第一、第三宫条目据此增加年度次限宫查询，其他十条继续使用各自已登记的本命宫条件。已核年度次限宫头由同一兼容出生框架计算，现行 UTC 周年作为切换边界。年度宫界内按月亮实时次限黄经切段，每段附当期年度框架的起止。历史限日、推运生日和年内插值仍待逐法核定。[Leo 原书第七、十一章](https://www.alohaastro.com/wp-content/uploads/2016/08/The_Progressed_Horoscope-Alan_Leo.pdf)

本命第七宫按实际宫头取一、七宫宫主，并用同作者 1928 年第四版的参考外限记录同对相位及两颗宫主各自参与的本命四分、对分、半刑或倍半刑。保留实差与外限，给原文要求的合参提供依据。 [同作者辅助表](https://archive.org/download/howtojudgenativi00leoa/howtojudgenativi00leoa.pdf#page=51)

### 次限月亮越过上升宫头

一宫条目用 `leo_lunar_ascendant_crossing` 记录顺行穿越上升宫头的时刻。固定本命盘和年度次限盘分别扫描实际黄经，保存所用宫界及盘层。查询开始时已在一宫、年度换图造成的归宫变化及仅触及宫头均不计为穿越。穿越时刻的数值精度为秒，事实以半开点区间记录。通过该事实即可匹配个人行动和生活安排的独立主题。本命月亮强弱、持续过宫时段与同期太阳相位继续作为本地审阅证据。 [原书第一宫](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=115)

## 共同有效片段

二、六、七、八、九、十二宫分别以真实过宫区间查原文字段中的收支关注、日常工作、合作来往、内在反思、思想探索和深层感受。原书的财富结果、工作处境、实际合作、遗产、远行以及个人回应与基础倾向分查。 [过宫原文](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=115)

本命过宫和年度次限过宫各自与 Leo 来源相位的所有开始、结束共同切片。每片保存三个相位组，每组分别标明目标属于本命还是同图次限：

- 次限月亮相位。按原书具体对象记录偏顺、偏难或依情境。原文明确说月亮合水星可随太阳及互相推运反转，归依情境。
- 次限太阳相位。
- 其余已扫描的互相推运相位。

每组保留对象、相位类型、坐标、阈值和属于本片段的精确点；本地审计另保留来源区间索引。相位结束不在当前片段继续有效，查询尾端和精确点采用半开区间；不同宫或计算间隙不能拼接。空组表示本次已扫描对象及阈值内没有重叠记录，不等于一切推运不存在，更不是相反趋势的证据。

次限黄经沿用产品的一度阈值。平行按独立 Leo 来源的赤纬绝对差一度处理。宫内相位的偏顺、偏难与取义依情境采用当前原书月亮篇逐对分类，实际程度及与太阳、互相推运是否同性质仍待合参。

### 过宫条目的同层相位与本命条件

SQLite 在同一过宫片段内核对相位的生效和结束。固定本命宫的月亮相位分支使用月亮对本命行星的接触，同图次限月亮相位留作同期背景。混合时段可同时保有偏顺与偏难记录。第二、五、六、八、十及十一宫另有独立的本命或同题分支。

- 二宫的财务分支查询片段内至少一颗本命星实际接受偏顺月亮相位。另按同作者财务章节记录其中受照星是否实居本命二宫、是空宫时宫主，或是涉及二宫、十宫主的具名财务星对的一方。偏顺、偏难分别留证，写作分支见下文。 [数字版第115页](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=115) · [第二宫行运的本命财务条件](WESTERN_HOUSES.md#第二宫行运的本命财务条件)
- 三宫按原书记载的两个宫层查询昼盘水星条件。出生太阳在几何地平线上方，且同一出生盘的水星有参考范围内的四分、对分、半刑或倍半刑，才进入这一子分支。 [数字版第114页](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=114)
- 五、六、八、十、十一宫各自保留查询至少一条确定的偏顺或偏难接触的分支。 [数字版第116页](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=116) · [数字版第117页](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=117) · [数字版第118页](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=118) · [数字版第119页](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=119)
- 七宫查询同段实际出现的偏难月亮相位，另核偏顺子分支。偏顺子分支须照到同一颗本命星，该星在完整九星计算中未见参考外限内的四分、对分、半刑或倍半刑，且该片段没有已知偏难的同层月亮相位。受照星的其他受克方式及同期取义未定相位仍待核。 [数字版第117页](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=117)

### 二、五与十一宫的独立分支

- 二宫 `p134` 单独查原书所述写作条件。按 Leo 与 Green 的本命说明，取实际 Placidus 第三宫或第九宫的水星，以及实际第三宫的海王星为候选。其中水星对应写作与出版，海王星对应想象与小说写作。任一见证可随本命二宫的实际过宫片段进入候选，无需同期有偏顺月亮。历史写作的专门条件与实际创作经历仍待核。 [原书二宫](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=115) · [水星第三宫](https://iapsop.com/ssoc/1906__leo___the_horoscope_in_detail.pdf#page=40) · [水星第九宫](https://iapsop.com/ssoc/1906__leo___the_horoscope_in_detail.pdf#page=41) · [海王星第三宫](https://iapsop.com/ssoc/1906__leo___the_horoscope_in_detail.pdf#page=60)
- 五宫 `p137` 分别登记情感与依恋、投资与投机的同期月亮。每个议题保留具体星体、相位、来源及有效片段。对冲本命海王星或天王星的整体取义依情境，月亮篇明确涉及疏离与依恋时，仅作为情感分支的偏难依据。投机的时段证据不证明当事人的选择符合原文所说的谨慎条件。 [原书五宫](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=116) · [月亮与木星](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=135) · [天王星](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=145) · [海王星](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=149)
- 十一宫 `p143` 分查朋友助力和交往需谨慎的月亮证据。例如，月亮对冲本命天王星的原段明列朋友与熟人的提醒，可以在过十一宫的同一片段进入交往分支。相反证据并见时各自保留，实际交往对象与结果仍待核。 [原书十一宫](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=119) · [月亮对冲天王星](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=146)

这三个专题分支均保留为合参依据。完整出生盘盘例覆盖没有同期偏顺月亮的二宫写作候选，以及只有依情境月亮对冲的五宫、十一宫候选。另核移除对应见证与更换盘层后的排除结果。该批事实 v1.352、西方规则 v83、中文输入 v353。

### 四宫家宅与九宫远行

- 四宫 `p136` 的基本家宅时段仍取月亮实际经过固定本命第四宫。再按 Leo 与 Green 的本命说明核本命水星、天王星实居第四宫，以及实居第四宫且参考外限内未检出四分、对分、半刑或倍半刑的本命月亮。仅在过宫同段附次限月亮对本命、原段明确涉及迁居的方向，可同时列出偏顺与偏难依据。原文的日落至黎明及实际变迁仍待核。 [原书第四宫](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=116) · [本命月亮](https://iapsop.com/ssoc/1906__leo___the_horoscope_in_detail.pdf#page=36) · [本命水星](https://iapsop.com/ssoc/1906__leo___the_horoscope_in_detail.pdf#page=40) · [本命天王星](https://iapsop.com/ssoc/1906__leo___the_horoscope_in_detail.pdf#page=58) · [月亮六合天王星](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=143)
- 九宫 `p141` 的远行分支要求同一过宫片段同时有具名本命证据和同向的远行推运。本命证据核实际第九宫的太阳或月亮。偏顺采用日木、月木或月水六合、三分。偏难采用第九宫月亮参与的四分、对分、半刑或倍半刑，或第九宫太阳与木星成上述相位。 [原书第九宫](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=118) · [本命太阳](https://iapsop.com/ssoc/1906__leo___the_horoscope_in_detail.pdf#page=31) · [本命日木](https://iapsop.com/ssoc/1906__leo___the_horoscope_in_detail.pdf#page=34) · [本命月亮](https://iapsop.com/ssoc/1906__leo___the_horoscope_in_detail.pdf#page=37)
- 远行推运的偏顺候选是次限水星六合本命土星，以及太阳六合天王星的本命目标或同图次限目标。偏难候选要求次限火星刑本命木星，同段次限月亮对本命的实际接触均偏难。各条同向依据保留盘层、真实交集及两端。一般出行方向、其他已核相位与九宫主结构各自保存。 [太阳六合天王星](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=108) · [水星六合土星](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=165) · [火星刑木星](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=191)

用完整出生盘验证本命天王星实际在四宫，且月亮四分本命木星只在实际迁居相位生效的片段附入。九宫盘例验证水星六合本命土星、太阳六合天王星的两个盘层，以及火星刑本命木星叠加同层偏难月亮的分支。另验证相位结束、盘层错误、只存在一般旅行方向及只符合单侧证据时的排除。九宫仍为部分映射。该批事实 v1.353、西方规则 v84、中文输入 v354。 [月亮四分木星](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=135)

### 八宫财务与十宫职业家宅

- 八宫 `p140` 分别记录遗产、伴侣财务的候选依据。按 Leo 与 Green 的本命说明，查出生月亮实际居八宫，并按同作者参考外限核六合或三分火星、金星或木星，以及月亮参与的四分、对分、半刑或倍半刑。前一组在同期月亮偏顺时作为遗产候选，后一组在同期月亮偏难时作为伴侣财务候选。两向同时出现时各自留证。实际财务与继承安排仍待核。 [八宫原段](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=118) · [本命月亮第八宫](https://iapsop.com/ssoc/1906__leo___the_horoscope_in_detail.pdf#page=36) · [本命月亮相位](https://iapsop.com/ssoc/1906__leo___the_horoscope_in_detail.pdf#page=38)
- 八宫的内在体验分支查询同段月亮对本命天王星、海王星的已核同题相位。月亮四分本命海王星的原段谈到梦境等体验，可独立进入该分支。财务分支仍各自需要原有月亮倾向及相应的本命依据，不能用内在体验相位补足。 [八宫原段](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=117) · [月亮四分海王星](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=147)
- 十宫 `p142` 分开登记职业与上级、家宅安排的同期月亮相位。例如，月亮对本命天王星的对分可用于职业分支，月亮与本命天王星赤纬平行可用于家宅分支。职业章另列一宫主实居十宫及十宫主实居一宫，程序按实际两宫宫头和本命位置核证。其他职业标志、母系家宅的细分及现实活动仍待核。 [十宫原段](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=118) · [月亮对分天王星](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=146) · [月亮平行天王星](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=142) · [本命职业章](https://iapsop.com/ssoc/1906__leo___the_horoscope_in_detail.pdf#page=76)

完整出生盘分别核出偏顺的遗产候选、偏难的伴侣财务候选，以及同期海王星四分单独命中的第八宫片段。第十宫用同一出生盘的不同时段核出职业、家宅两种天王星见证，另用一个出生盘核出十宫主木星实居第一宫。第八宫仍为部分映射。该批事实 v1.354、西方规则 v85、中文输入 v355。

### 六宫服务与十二宫反思

- 六宫 `p138` 独立查询本命受雇和服务依据。取实际第六宫、参考外限内未见四分、对分、半刑或倍半刑的本命月亮，也取实际第六宫且参与六合或三分的水星、土星。后一组同时记录该星已见的偏难相位。上述任何一项成立时，实际过宫片段可单独列入服务候选。月亮刑冲本命水星的代理往来及月亮六合本命土星的职责分支另随实际起止记录。保留原有同期月亮的偏顺与偏难分支。 [六宫原段](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=117) · [本命月亮](https://iapsop.com/ssoc/1906__leo___the_horoscope_in_detail.pdf#page=36) · [本命水星](https://iapsop.com/ssoc/1906__leo___the_horoscope_in_detail.pdf#page=41) · [本命土星](https://iapsop.com/ssoc/1906__leo___the_horoscope_in_detail.pdf#page=55) · [月亮六合土星](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=139)
- 十二宫 `p144` 保留本命过宫的基础时段，另外核本命第十二宫太阳、月亮、木星的独处或公益位置，需在参考外限内未见上述受克；天王星在本命十二宫且参与六合或三分时，另列私下兴趣与研究依据。出生盘与同期推运的证据分别保存。 [十二宫原段](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=119) · [本命太阳](https://iapsop.com/ssoc/1906__leo___the_horoscope_in_detail.pdf#page=32) · [本命月亮](https://iapsop.com/ssoc/1906__leo___the_horoscope_in_detail.pdf#page=37) · [本命木星](https://iapsop.com/ssoc/1906__leo___the_horoscope_in_detail.pdf#page=52) · [本命天王星](https://iapsop.com/ssoc/1906__leo___the_horoscope_in_detail.pdf#page=59)
- 十二宫的阅读、内在反思和梦境依据来自同段、同本命盘的月亮相位。月亮倍半刑本命海王星，按原段可作为阅读与反思的偏顺依据，同时在职业议题上有自己的偏难证据。两项分别引用各自过宫片段。原文所述过往行为与现实经历仍需当事人事实。 [月亮倍半刑海王星](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=148)

完整盘例核出无同期月亮相位时的六宫水星就业候选、十二宫海王星倍半刑的阅读片段，以及十二宫木星本命的互助依据。另用按边界切分的相位验证，同一条海王星倍半刑在十宫和十二宫保留不同原文取义，年度次限盘同名相位不会进入固定本命宫的同题分支。两条仍为部分映射。事实 v1.355、西方规则 v86、中文输入 v356。

### 三宫与七宫的本命受克条件

`p135` 与 `p139` 沿用同一组本命受克角度，半刑和倍半刑各取四度参考外限，保留实际参与的两颗星、角差及外限。受克筛选缺少九星几何时保持未知。三宫仍须核出生昼夜，七宫的一、七宫主相位供合参，偏顺分支的受克筛选针对实际被月亮照到的那颗本命星。 [本命相位表](https://benebellwen.com/wp-content/uploads/2014/06/alan-leo-the-horoscope-in-detail.pdf)

2026 年三宫样本分别凭本命水星与火星半刑、月亮与水星倍半刑进入年度次限三宫候选。同年的七宫样本中，次限月亮偏顺照到本命金星，而该金星与本命土星实际成倍半刑，故该片段不命中偏顺分支。另一个候选片段有实际偏难月亮相位，仍独立命中。该例一宫主土星与本命水星的倍半刑也有单独证据。事实 v1.150、西方规则 v51、中文输入 v151。

### 一宫背景与九宫主

- 一宫 p133 在真实穿越基础上增加两个可核分支。一个在出生盘固定月亮位于巨蟹入庙或金牛擢升时保留候选，作为同作者所述强弱的位置证据。另一个核穿越时刻同图次限太阳已形成有效相位。入相边界计入，出相边界归下一片段。其他月亮强弱条件、太阳相位的作用及行动回应仍待核。 [原书一宫](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=115) · [同作者《The Art of Synthesis》](https://bibliotecaparticular.casafernandopessoa.pt/1-90/2/1-90_master/1-90_PDF/1-90_0002_142-283_t24-C-R0072.pdf)
- 九宫 p141 以固定本命九宫的月亮过宫为起点，按原书分别从实际本命九宫头和当年次限九宫头取主星。本命宫主须本人参与本命参考范围相位，同期次限宫主须本人参与实际同图相位。同名星在两张图分开取证，跨周年时换用当年宫界，互换端点的同图相位只保留一条。出生日历框架不可用时，该年度条件保持未知。远行的同题分支见上文，整盘判断仍待核。 [月亮总注的次限九宫主示例](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=113) · [九宫原段](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=118) · [同作者本命参考表](https://archive.org/download/howtojudgenativi00leoa/howtojudgenativi00leoa.pdf#page=51)

两条仍为部分映射。事实 v1.95、西方规则 v38、中文输入 v96。

### 一宫穿越的本命月亮证据

`p133` 再查询本命月亮天蝎落陷或摩羯失势，结合已有的巨蟹入庙与金牛擢升，覆盖同作者列出的四种星座位置。出生盘与年度次限盘分别核穿越时刻，星座证据取自同一个出生盘。 [原书一宫](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=115) · [同作者《Practical Astrology》](https://www.scribd.com/document/438863800/dlscrib-com-book-alan-leo-practical-astrology-pdf)

本命相位分支依据总论涉及的具名星体，按同作者 1928 年参考外限核本命月亮六合或三分木星、金星，以及四分或对分火星、土星。保留实际角差、外限和星体，偏顺与偏难并见时逐项呈现。三组 2026 年穿越样本分别由天蝎落陷、摩羯失势和本命月亮六合金星又对分土星进入匹配，当时同图次限太阳均无命中段。整体强弱及实际作用仍待核。事实 v1.155、西方规则 v56、中文输入 v156。 [原书月亮总论](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=41) · [同作者本命参考外限](https://archive.org/download/howtojudgenativi00leoa/howtojudgenativi00leoa.pdf#page=51)

## 年运中的实际过宫主题

第三、四、五、十、十一宫有明确的过宫主题，采用实际区间并沿用资料的年运周期。三宫的本命和年度次限盘分别核验，水星受克与双子座成员继续用于进一步判断轻重。四、五、十及十一宫取固定本命宫界。五、十及十一宫另保留同一宫内实际精确成相的偏顺、偏难或依情境。每个时段的上层推运、本命与现实须各自合参。 [原书月亮总注](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=114) · [四、五宫](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=116) · [十、十一宫](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=119)

共享星历以同一出生时刻与纬度更换经度，验证全年真实五、十、十一宫分别成立且不会混用。同一过宫内的实际精确相位分别带有偏顺、偏难和依情境的见证。进入模型的是原文与已匹配的释义，具体几何证据保留在本地中文审计。事实层 v1.374。

## 十二条各自的剩余分支

| 本命宫 | 已补的共同事实之外仍须核验 |
| --- | --- |
| 一宫 | 本命月亮强弱、太阳背景及本人行动回应 |
| 二宫 | 受作用星的本命财务资格、同性质、历史写作的专门条件与实际创作 |
| 三宫 | 过宫主题完整。判断事件轻重还须结合双子突出程度、水星受克及全盘条件 |
| 四宫 | 过宫主题完整。实际迁居和当地日落至黎明的钟点随情况判断 |
| 五宫 | 过宫主题完整。判断实际结果还须核受作用星、同期推运及当事人的选择 |
| 六宫 | 其他受雇位置、现实工作与习惯、整体取义及取义未定相位 |
| 七宫 | 其他受克方式、宫主和全盘合参及取义未定相位 |
| 八宫 | 其他遗产与伴侣财务依据、现实财务安排及同期推运 |
| 九宫 | 其他远行证据、本命和推运整体取义及实际出行 |
| 十宫 | 过宫主题完整。实际职业变化、母系家宅及其他同期推运继续合参 |
| 十一宫 | 过宫主题完整。实际交往对象、本命领域与同期推运继续合参 |
| 十二宫 | 其他内在反思和限制条件、原文过往行为及现实活动 |

每条具体查询、证据哈希、已映射条件及独立缺项写入统一资料的 `matchConditions.formatted`。查询采用来源过宫事实。部分匹配留在候选层。 [统一资料源](model/knowledge/fortune_knowledge.json)

## 输入、验证与版本

事实的中文转换包含过宫盘层、年度宫界的生效起止、相位目标盘层及一七宫宫主的出处。内部索引、机器字段和查询 JSON 保留在审计数据。部分资料继续留在候选层。

`leo-lunar-houses.test.mjs` 用原书第七章 Westminster 例核年度次限天顶和周年换界，另用可靠本命框架与现代星历覆盖十二个本命宫位。完整年窗核对两盘层月亮、所有同期相位、来源哈希与半开区间。盘例分别验证本命和年度次限上升宫头穿越、周年换界和已有一宫位置，以及有本命水星条件的年度次限三宫在 SQLite 中的匹配。

过宫事实策略为 `leo-lunar-house-context-v2`，上升宫头穿越策略为 `leo-lunar-ascendant-crossing-v1`。九宫主的额外证据采用 `leo-lunar-ninth-rulers-by-chart-v1`。

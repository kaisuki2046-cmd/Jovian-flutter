# 西方来源时限与时间交集

本页说明西方来源的时间事实、已接入的条件和剩余缺项。JSON 保存原始资料，经过来源审核的规则导入 SQLite，由服务端查询。[当前条件映射覆盖](CONDITION_MAPPING_PROGRESS.md#当前覆盖)

## 托勒密的位置与过境

正文将主限与年度、月级、日级时限分开，年取一年一星座，月取二十八天一星座，日取二又三分之一天一星座。注 82 记二又二分之一天见于两份手稿。三十日属 Bouché-Leclercq 和 Cardanus 的校订读法，注中没有列相应的手稿依据。第 324 条仍以正文二十八日计算月段。 [Robbins 英译 IV.10 正文和注 81–83](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4C*.html)

第 325 条在同一本命起点及同一正文月段内，将月亮实际在座的窗口按两种日段的界点切分。两种算法均指向月亮所在星座时确认一致。1990 年出生试盘的 2026 年 7 月 17 日入处女时两法一致，8 月 5 日入金牛时另一本仍在白羊。7 月 21 日月亮始终留在天秤，备选手稿在北京时间中午换到天秤，两法由此开始一致。原法年界、起始时刻和其他月段安排仍须另核。 [Robbins 注 82](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4C*.html#note82)

两种日长各自保存完整日段及实际入座的归属。2026 年 5 月 19 日月亮入巨蟹时，天顶起点只有手稿为巨蟹，正文为狮子。真实入座与后续在座分别通过手稿的日位条件确认，两法结果注明所用版本。具体入座时间和位置证据留在本地。8 月 15 日太阳起点的正文天秤段已经开始，月亮先进入天秤，直到手稿日段开始后才出现两法都在座。测试复验了 5 月 21 日两读法在同一二十八日月界截尾，以及 2027 年周年前后福点虽同座却各归独立日段，实际入座不会在边界重记。 [Robbins IV.10 与注 82](https://penelope.uchicago.edu/Thayer/e/roman/texts/ptolemy/tetrabiblos/4c%2A.html)

原文所说的过境在注83指通过星座的区间，因此 `ptolemy_ingress_contact` 按实际入座和停留的区间计算，不把位置擅自改成某一度数，也不套默认度数 orb。只有真实跨过星座边界才记精确时刻，时限段开始或查询窗开始不等于天体新入座。整星座六合、刑、拱、冲分别保留，几何相位并不自动决定吉凶。

`control/ptolemy-times.ts` 分别以本命上升、天顶、太阳、月亮、福点作为起点。福点采用 [III.10 明述的昼夜同式](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/3B*.html)，即上升加月亮减太阳；不套常见的昼夜反转式。出生时刻、候选、引擎及本命黄经必须通过已有一致性检查；缺少有效角度时只保留太阳、月亮，不能造一个上升或福点。

年查木星与该年星座的守护星，月查太阳、火星、金星、水星，日查月亮。每个起算点的年、月、日时限事实携带本层及上层的星座和守护星。过境天体、起算点及有效段在同一事实记录。

年度第 326 条新增木星与出生昼夜异派的独立核对。本命木星与原位成刑冲或为异质座，且已核两表均无原位掌权时，分别查实际木星对年位和原位双刑冲。若年位与原位为六合或三分、本命木星与原位成刑冲，也可按实际木星只刑冲年位的时段确认。2026 年 6 月木星入狮子前后复验了三种路径及相邻六合段。 [Robbins IV.10](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4C*.html#10)

第 327 条的年度木星同主复用第 323 条三种年长比较。2021 年 5 月实际木星入双鱼时，三法处同一年序，且木星本人也守护该年位。12 月木星再入双鱼时，埃及年已先换年，只保留注明历法的一般年度同主。 [Robbins IV.10](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4C*.html#10)

月级第 326 条另核一种与原位和谐的已知情形。同一行星在本命和实际过境中都与同一起算原位成六合或三合，并且实际过境与该月级星座也成六合或三合。只取日、火、金三颗原书派别明确且与本命同派的行星。这条候选保留其他原位掌权和界主分支，仍待核原文的其他和谐关系及总时主权重。 [Robbins I.7、I.13](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/1B*.html#13) · [Robbins IV.10](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4C*.html#10)

第 326 条确认本命和谐转为当期对分的分支。同一个已核同派且未掌本命原位的行星，本命与原位成六合或三合，实际过境时同时对原位及同座的月级位置成对分。2026 年 1 月的合成盘复算出本命火星三合上升。火星实际入水瓶后对本命与月级狮子成对分，1 月 29 日月级换座即截止。另一盘在 2026 年 7 月见本命太阳与福点四分，过境的太阳与出生昼夜异派且同时刑照福点和月位，进入原文的异派分支。本命和谐转对分与本命不协调后的月级刑冲各自核对。 [Robbins IV.10](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4C*.html#10)

另按 I.8 实算朔、上弦、望、下弦，取同一时刻日月各自的实际星座，核同一本命起点的当段年、月时限整座相位。年级查询按相位时刻在同一候选历法内推导月段，留证截止同时受月段及所在时限片段约束。没有所列整座相位也如实记录。此项供本地应期复核，IV.10 所提太阳相位是否另指独立现象仍待核。 [Robbins I.8](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/1B*.html#8) · [Robbins IV.10](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4C*.html#10)

同一月相事实记录本命起点、年级和月级守护星，以及两级时限对本命起点的整座相位。若同一起点与周年内另有已核真实入座，而且月相真点仍处该次时限和行运的共同有效段，事实也记录该行运层级、守护星和入座时刻。这些记录供本地复核。第 323 至 326 条已有的已确认分支依各条原有的年、月、日或本命关系判据运行。 [Robbins IV.10](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4C*.html#10)

较窄的月、周、日显示窗可以承接上层已发生的真实入座。各行星从原书指定的对应时限起点回查，只有同一本命起点、同一时限段、同一星座仍有效才附于月相。沿用 1990 年出生的试盘，2026 年 7 月 7 日下弦的月、周、日结果均可追溯上升起点的年级木星于 6 月 30 日入狮子，以及太阳起点的月级太阳于 6 月 21 日入巨蟹。7 月 21 日上弦时，后者的月位已换狮子，太阳仍在巨蟹，故不再附此前的太阳入座。窗外实际入座时刻留作本地证据，查询窗开头仍无新过点。 [Robbins IV.10 及注 83](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4C*.html#10)

卷四第十章注 83 以整座经过的时段说明过境。若月相真点与同一起点的年级木星或月级日、火、金、水实际在座重合，即使这次进入该座早于时限，仍可查当前经过。2026 年 1 月 3 日望时，上升起点的年级木星已经在巨蟹。7 月 7 日下弦时，太阳起点的月级水星也已经在巨蟹。本地审计另列当时仍在该座，并说明本时限内未核到新的入座。实际入座日期由已核的另一条证据显示。月级换座或行星离开同座即截止。供应商只收资料已确认的静态条件和短引。 [Robbins IV.10 注 83](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4C*.html#note83)

同章还将过境星实际所在座与年、月时限座作相位比较。继续使用 1990 年出生盘的 2026 年 7 月 7 日下弦，月亮起点的木星实在狮子，对年位水瓶成对分、与月位狮子同座。上升起点的火星实在双子，对年位狮子成六合、对月位水瓶成三分。同一起点的金星当时已在狮子，对月位水瓶成对分，当段没有新的金星入座。月查及日查保存相同的三种过境关系，真实入座早于查窗仍可回查。此证据供本地核对，第 323、324 条的同座确认不使用这些跨座相位。 [Robbins IV.10](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4C*.html#10)

按年查同一实际月相时，也按正文二十八日月段核月级过境。1990 年试盘的 2026 年 7 月 7 日下弦在年、周、月、日窗口内都保留太阳早先入巨蟹、水星仍在巨蟹和火星对月位三分。到 7 月 21 日上弦，太阳起点的月位已换狮子，7 日的太阳入座及水星续驻两项都不再随该起点的月相显示。一般月级过境只附在对应真实月相上。第 327 条所需的实际月级同主区间可独立确认。 [Robbins IV.10](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4C*.html#10)

### 土星经过总体主限位置

卷四第十章把土星经过总体时限位置与木星经过年度位置分别列出。客户端取移动后的黄道投影主限星座，将它的有效段与真实土星在同座的区间相交。保留年度星座作同起点的背景，主限换界或年度切换只裁开区间。确实在片段内经过星座边界时，才记录土星入座时刻。 [Robbins IV.10，正文及注 83](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4C*.html#10)

服务端 SQLite 的年度同主条按总体主限分支核实际同座过境星是否也是该段射线主限星或埃及界主。土星是原文特别关注的过境星，该段实际掌权的其他行星亦可按 IV.10 末段的同主条件核查。年度守护星和埃及界主分别记录。福点起算的同主过境还核该星是否为本命福点所在星座的守护星，保留为财产议题的一项本命依据。 [Robbins IV.10](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4C*.html#10) · [Robbins IV.2](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4A*.html#2)

第 327 条确认同一个本命起点的总体主限星实际行经该段总体主限星座。原文列出上升、中天、日、月及福点五个起点，特别提到土星经过总体时限，最后对时主与过境同星的原则没有限定土星或中天。沿用已有黄道投影和原文注 83 的实际行经窗口。中天土星原分支仍落在 2026 年 2 月实入白羊及 2027 年开窗时已在白羊的实际区间。另一份 2026 年测试盘复验五起点，包含火星、金星和水星的实际入座以及太阳已在福点总体时限星座的持续段。只过年度星座、仅为界主或过境与主限不在同一座时不走射线时主分支。模型仅接收这一确认所用的静态条件和原文短引。 [Robbins IV.10 及注 83](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4C*.html#10)

### 埃及界主同主过境与福点日月见证

IV.10 明列界主参与总体时限。年度同主条另查当前移动位置的埃及界主本人是否实际经过同一起点的年度星座。总体分支独立核同一界主实际经过总体主限星座。两条证据各与真实过境取交集，分别保存射线主限星和年度守护星，界主的相对权重仍待核。 [Robbins IV.10](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4C*.html#10)

福点分支记录同一过境星作为本命福点守护星时，与出生盘太阳和月亮的整星座相位。日月自配排除。两曜相位提供 IV.2 所说日月见证的几何证据，实际强弱和合宜的见证仍待核。2026 年样本覆盖金星为界主时承接摩羯座过境、土星过白羊座总体主限并任界主，以及本命土星和本命太阳同在摩羯座的福点分支。事实 v1.244、西方规则 v71、中文输入 v245。 [Robbins IV.2](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4A*.html#2)

第 327 条补不同的本命位置证据。只在同一过境星也是本命福点守护星时，查守护星本人所在座的掌权、其他七政的整座相位以及与其同派或异派。未核齐其他星位时保留范围缺证。土星受本命木星照相时，分查木星是否实在双体星座。2026 年用双子座和巨蟹座木星的实算盘验证，另核守护福点与在自身所在座得势的差异。月亮入相、角宫、异派克制和资源结果仍待核。 [Robbins I.7、I.11](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/1B*.html#11) · [Robbins IV.2](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4A*.html#2)

守护星自身落座的本垣、擢升、三分和界按两表分别核对。卷一第二十三章将两项及以上亲近作为力量较强的条件。埃及界和托勒密界分别同该座的其他条件合核，同一类界只计一次。2026 年实际同主过境盘例分辨两表都满足、仅埃及表满足、仅托勒密表满足和只有本垣的情形。此证据供本命福点守护星的强度复核，原章采用哪张界表及其他亲近条件仍待核。 [Robbins I.23](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/1B*.html#23) · [Robbins IV.2](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4A*.html#2)

第 327 条确认一类福点年度结构。按已注明的生日周年算法，年度星座与本命福点星座由同一颗星守护，且该星实际位于年度星座。再核出生盘有同派行星与该星成整星座六合或三分。水星为守护星或本命见证时，按出生地地平实查晨昏。日出水星在地平线上而日落在下为昼派，晨昏两侧相反为夜派，其余情况保留未知。2026 年 4 月火星入白羊的两盘分别实见同派月亮六合和昏出水星三分，第二盘同时保留异派太阳三分。2026 年 5 月水星入双子的三盘分别验证昼派土星六合、仅异派和谐见证与水星派别未知。只传原始短引和静态条件，实际本命星位与时刻留在本地。原法年度边界选择、异派克制以及现实财务结果仍待核。 [Robbins I.7](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/1B*.html#7) · [Robbins IV.2](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4A*.html#2) · [Robbins IV.10](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4C*.html#10)

同一分支也分别核月亮接下来的传统相位。采用 Robbins I.24 注 129 所载古注十五度上限，从出生时逐对寻找实际相位，合相另查出生时与成相时的黄纬同侧。木星为唯一最先成相的目标时保留相位、初始差和真点。1977 年 11 月 28 日样本在木月实际合相前后验证入相与离相。1979 年 3 月 9 日实算样本核到实际黄经同度，因两星分处黄道两侧而排除合相入相候选。古注的范围、候选顺序及本命角位证据分别留存。 [Robbins I.24](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/1B*.html#24) · [Robbins IV.2](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4A*.html#2)

### 托勒密表界主过境

按卷一第二十一章的原表另算五个起点的投影界限与本命原位界主。托勒密表的区间与同一起点的实际总体或年度星座过境独立求交，界限切换遵循半开区间。2026 年同一盘的中天起点，两表同定水星为总体时限界主，且水星确实过境该座，确认到两表首次分界的一刻。太阳起点的两表异主段继续供本地核对。同段两套计算只计一次确认；是否同时执掌本命地位也单独核对。第 327 条保留部分映射，原章选表和界主权重仍待核。 [托勒密界表](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/1B*.html#21) · [第四卷时主说明](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4C*.html#10)

### 本命守护与月级相位

客户端为每个本命起算点求原位的星座守护、擢升、三分及界主。界采用 I.20 埃及表的60个区间，使用星座内实际度数和左闭右开的边界。I.18 水象以火星为主，昼生另列金星、夜生另列月亮。昼夜根据验真的出生角点和当时太阳的几何地平高度判定。角点无效或太阳极近地平线时，仍保留可核的原位坐标，昼夜及依赖它的分支留待核。水星相对太阳的有向黄经差单列为晨昏候选，合日时留空。 [Robbins I.7、I.17–20](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/1B*.html)

月级关系条在服务端 SQLite 分查三种候选。其条件都须在同一起算点、同一过境天体和同一实际有效段成立。 [Robbins IV.10](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4C*.html)

- 过境星掌本命原位，并且本命与该原位成同座、六合或三分。当前实际过境对时限星座另成六合或三分。
- 同样具有可核的本命掌权及相位，当前实际过境改为对冲时限星座。
- 过境星本命与原位成四分或对分，在所列体系无本命原位掌权，并且派别与已核的出生昼夜相反。实际过境同时对月级时限星座成四分或对分。 [Robbins I.13](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/1B*.html#13)

月级水星的偏难分支按出生地在该日实际日出和日落时的水星几何地平位置判晨星、暮星，再和出生昼夜比对。水星本命与原位成四分、对分或原书异质座，且实际过境对月级时限星座成四分或对分时，异派才支持这一分支。同派不满足异派条件，日出和日落时均位于地平线以上或其他无法唯一分型的情况保留待核。真实星历既覆盖黄经候选漏掉异派，也覆盖黄经候选误把同派当成异派。 [Robbins I.7](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/1B*.html#7) · [Robbins IV.10](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4C*.html#10)

月级异派偏难分支同时核埃及表与托勒密表。卷一把界列为本命亲近条件。某行星在原先所核的尊贵范围未掌原位、却按托勒密表实掌同一原位之界时，保留实际月级刑冲和两表差异供本地核对。2026 年 1 月复算了金星异质与本命对分、水星异质与本命四分四种情形。两表均未赋予原位掌权的旧候选继续有效。第四卷没有给出选表和此类分歧的权重，整条仍为部分映射。 [Robbins I.21](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/1B*.html#21) · [Robbins I.23](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/1B*.html#23) · [Robbins IV.10](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4C*.html#10)

同一过境事实另外记录当段年、月时限星座与本命起算点的关系，以及实际过境星座与当段年、月时限星座的关系。只在年级查询时，月级关系留空。某个已知星座对没有合、六合、四分、三分或对分时，事实保留其几何结果。 [Robbins IV.10](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4C*.html#10)

第 326 条确认月级位置与本命起点同座，且同一颗同派的太阳、火星或金星分别在本命和实际过境时以整座六合或三分照该位置的情况。该支要求原位的两表界主和其他所核掌权星均为别星。2026 年 1 月真实金星入座至该月级时限截止的半开段通过。不同座、不同派或几何条件不齐的情况按现有查询另查。 [Robbins I.13](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/1B*.html#13) · [Robbins IV.10](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4C*.html#10)

第 326 条同时纳入和谐相照的不同月位，要求月位与原位本身同座、六合或三分，过境星本命见原位，实际过境再分别和谐照及月位及原位。水星以本命出生地实际晨昏和昼夜同派为必要条件。1968 年出生盘在 2026 年 1 月以同一次水星入座复验两个起点。上升起点与月位成六合，实际过境同时照见两处，该分支确认。太阳起点的托勒密表本命界主仍为独立候选。另用月位对冲原位、异派和晨昏不明确的对照排除该窄支。 [Robbins I.7、I.13](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/1B*.html) · [Robbins IV.10](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4C*.html#10)

第 326 条另确认 I.16 的异质座与 IV.10 同窗异派刑冲的交集。过境星在本命须异质、异派，且两套已核口径均不掌原位。原有确认核实际过境同时刑冲该原位和月位。1990 年 1 月 1 日试盘的本命火星在射手，上升原位在金牛，2026 年 1 月 23 日火星入水瓶，同段实刑金牛原位和月位。1990 年 1 月 9 日出生盘的水星在 2026 年 1 月 1 日同时冲年位和月位，但未冲本命中天原位，仍作候选。1 月 20 日同时冲中天原位及月位，沿原分支确认。水星派别以出生地晨昏确认为准。掌权、相位或派别未核齐的情况继续按原候选筛选。 [Robbins I.16](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/1B*.html#16) · [Robbins IV.10](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4C*.html#10)

I.14 和 I.15 按 Robbins 注 80 与注 83 明列的整座配对核验，各对座相隔偶数个星座。I.16 相隔一座或五座的异质座不会与该表重叠。原先按宫界两侧直接镜射的公式曾把双子与摩羯、射手与摩羯误算为亲近，现按所用版本更正。中天试盘在 2026 年 9 月有实际太阳刑双子中天原位、冲其月位。福点试盘在 2026 年 2 月末至 3 月有实际太阳同时刑射手福点原位和其月位。两段均达到既有的确认条件。此处按所用版本核对整座关系，起算历法与其他古注仍另行核查。 [Robbins I.14 注 80](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/1B*.html#note80) · [Robbins I.15 注 83](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/1B*.html#note83) · [Robbins I.16](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/1B*.html#16)

第 326 条也单独核月位的刑冲。IV.10 先分年位与月位，后要求出生时不协调、异派的星在实际过境时刑冲所考察的位置。当前采用同一起点中实算只刑冲月位的片段，年位和出生原位都须已有明确的非刑冲结果，仍核两表不掌原位。2026 年 7 月 22 日太阳入狮子后，实刑福点月位金牛，六合福点原位和年位天秤。太阳入座前仍六合月位，单独观察年位的四分时不进入该支。1990 年 1 月 9 日试盘的水星于 2026 年 2 月 6 日入双鱼，实冲中天月位处女，年位和中天原位狮子均无所列主要相位。各级相位留本地审计。原书的总时主权重及跨层应期继续待核。 [Robbins IV.10](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4C*.html#10) · [希腊原文 IV.10.21](https://eulogikon.org/works/ptolemy-alexandria-tetrabiblos-phs-ai)

第 326 条同章也明确区分异派不协调的星体在实际过境时所成的其他相位。同一个 2026 年 10 月命例，太阳与月亮起点的本命关系为异质、异派。实算太阳六合其月位，且分别三分原位和年位，因此独立确认这段未触发原文所说的异派刑冲条件。相邻原位和年位继续按已核几何读取。 [Robbins IV.10](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4C*.html#10)

第 326 条另按同章的本命和谐而过境反向核对相隔的月位与原位。1990 年 1 月 1 日试盘中天原位及年位同在双子，所查月位为白羊。金星本命与原位三分，同派且两套取法都不掌原位。2026 年 10 月 25 日金星逆行入天秤后，只对分白羊月位，对原位及年位仍为三分。入座前金星在天蝎，与白羊无原书所列主要整座相位。只采用真实对分的月位时段。 [Robbins IV.10](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4C*.html#10)

第 323–325 条将有明确定义的星历在座区间与同座时限取交集。2026 年同一组出生日期样本中，木星早于周年起点已在巨蟹，金星早于月级换座已在处女，月亮早于日级换座已在天秤，三项均从各时限的交集起点开始匹配。真实入座和查窗裁切独立记录。本地仍可回查同一时限内早于查询窗的实际入座。 [Robbins IV.10 及注83](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4C*.html#10)

年度同主条独立确认五个起点各自的年度守护星实际行经所主的年度星座。同星原本就掌该本命议题时，另核更强的本命支持。例盘在 2026 年 11 月 28 日上升起点换年度位置时，年度守护星金星已在该座，实际同主从周年交界开始，仍保留原入座和交界的区别。异座、不同守护星及错误起点排除。原书所论议题的亲疏及总体时主还有待核条件。 [Robbins IV.10 末段](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4C*.html#10)

第 327 条现在也确认两套界表同主的年度位置。中天样本在 2026 年 4 月和 5 月连续看到水星先在所查年度白羊位置、再进入总体时限金牛位置，原位和两套界主并列取证。另一个 12 月样本的福点显示金星同时守护本命福点和当期月位天秤，实停在该星座到实际换座；单独确认原书本命即掌该主题的更强条件。 [Robbins IV.10](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4C*.html#10)

第 327 条还确认同一起点中，二十八日月位的守护星本人实际行经该星座的片段。试盘的太阳起点在 2026 年 7 月实算太阳入狮子，月亮起点则在 8 月换月位时已有金星在天秤。两项均在实际离座或月位截止时结束。金星例以月位开始为确认起点，不多记一次入座。普通月级过境继续按第 324 条核查。本项只确认月级同主与实际过境相交，原书月段起点与各级时限权重继续待核。 [Robbins IV.10 年月时限及同主说明](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4C*.html#10)

第 326 条同时核书中指明的年度过境星木星。同一本命起点需有本命木星同派六合或三分，两套界法均不赋予它原位掌权，且实际过境同时和谐照本命原位与年位。2026 年 6 月同一组试盘中，木星行经巨蟹时对中天原位天蝎成三分。1990 年试盘的年位同在天蝎，木星换入狮子后两处均转刑，年度确认随即截止。1968 年试盘的年位在处女，实际木星对年位六合和对原位三分需分别核对。 [Robbins I.7、I.13](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/1B*.html#13) · [Robbins IV.10](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4C*.html#10)

第 326 条对同一个出生盘另核年度木星反向条件。1987 年 1 月试盘的本命木星三合本命中天，与出生昼夜同派，两种界法下均无该原位掌权。2023 年 5 月木星实际由白羊入金牛后，同时对分天蝎本命中天及其同座年位。2015 年 8 月木星由狮子入处女后，只对分当年的双鱼年位，对天蝎本命中天仍是六合。两支分别确认，各保留实际入座和当期的半开范围。同派、原位掌权和实际相位变化分别设对照。 [《四书》IV.10](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4C*.html#10)

第 327 条也核日级月亮本人行经自己守护的巨蟹，要求正文和注 82 的手稿时长同时推得巨蟹日位。1990 年试盘中，实际月亮先进入巨蟹，2026 年 7 月 13 日 04:00 UTC 两法才同时指向巨蟹，并在 20:00 UTC 结束重叠，月亮到此刻仍在巨蟹。年查只附上这一类确实重叠的日级同主证据。此前仅正文同座的巨蟹段及两法同座的双子段仍按第 325 条各自处理。古法日段起点和同主的轻重仍待核。 [Robbins IV.10](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4C*.html#10) · [Robbins 注 82](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4C*.html#note82)

### 上升与中天的主限星和界主

卷四第十章分列上升的当地斜升时间与中天的赤经差。客户端在已核出生角点、黄赤交角及反推纬度的同一本命盘上，为这两个起点计算正向黄道投影。七星的合、六合、刑、三分、冲射线按换算后的赤道弧长排序。到达射线后由该星接掌候选时段，初段采用原起点前最近的射线。同度有多星时保留每颗星的位置，主限星留待核。角点刻度按一赤道度一年，以既有 UTC 周年在年内线性换算。 [Robbins IV.10](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4C*.html#10) · [Robbins III.10 的赤道时间换算](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/3B*.html#10)

移动后黄道位置另按 I.20 的埃及界表分段。界主、射线主限星、原位掌权和年、月、日星座守护星分别保留。事实在主限星或界主切换时裁开，并与实际过境区间取交集。年度同主规则分别核实同座过境与当段角点主限星或界主相同的两类证据。 [Robbins I.20 埃及界表](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/1B*.html)

### 太阳、月亮与福点的不等时主限

客户端按黄道投影求太阳、月亮与福点在出生时相对上中天或下中天的有向不等时小时数。到地平的实际昼弧或夜弧各按六个不等时小时计算。每个目标射线与埃及界沿用同一不等时小时数，换为正向旋转的赤道弧长，再以一度一年落到既有 UTC 周年刻度。 [Robbins III.10](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/3B*.html#10) · [Robbins IV.10](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4C*.html#10)

年度同主条在服务端 SQLite 查询五个起点的实际同座过境与射线主限星或埃及界主的交集。过境与主限分段在同一事实中提交，保持实际入座时刻与裁切时刻的区分。超出可完整计算昼夜弧的纬度时，仅保留中天主限候选。带黄纬的球面方向、高纬适用范围、同度排序、主题亲疏及现代时间边界仍待核。五条托勒密时限资料保留部分匹配。

## 候选时间边界尚未定案

本实现明确声明以下产品计时解释，**仍为待核的来源候选计算，不是声称原书已经给出这些现代细则**：

- 年级在出生 UTC 周年切换；2月29日夹到非闰年2月末，之后闰年仍回到原始2月29日，不逐年累积夹尾误差。
- 月级从当年周年起，按28天向后分段；日级从该月级段起按7/3天分段。原文从生月、生日起算的子段重置含义仍须继续核。
- 年尾保留被周年截短的末段，不强行把28天分摊成12个公历月。一整365天候选年度因此可能有13个完整28天段和末尾一天的短段；该尾段取法仍列为来源缺项。
- 查询窗只裁剪实际段，截止时刻不计入；月级不是公历月，日级不是当地午夜的一天。

第 324、325、327 条沿用第 323 条的三个年度起点。固定正文二十八天月段和二又三分之一天日段，比较同一本命起点在三个年长下的已过整年数和相应月序、日序。交集还须有实际过境。2026 年 7 月，成年试盘的太阳实际留在狮子座，第 324 条和第 327 条共用此实际过境，埃及历月位先于 UTC 月位换座。低龄试盘的月亮跨过三个年度起点交集终点时仍在白羊座，第 325 条只对终点前的窗口确认三年长一致。两种日长的额外核对继续固定既有 UTC 周年。上述比较使用明示的子段重置政策，保留原法历界及重置的待核口径。 [《四书》IV.10](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4C*.html#10)

第 323 条对木星真实同座段补查两种同作者年度长度。《天文学大成》III.1 第 140 页把太阳回到季节点的平均年列为 365 天 5 小时 55 分 12 秒，另把埃及历年列为 365 天。两种长度都从出生时刻累计，和现行 UTC 周年分别核对已过整年数。三者同年数才确认共同窗口。1990 年试盘在 2026 年 6 月 26 日先因埃及历换年失去一致，木星到 6 月 30 日才实际离开巨蟹。1992 年试盘则在 6 月 28 日 UTC 周年之后等到 13:16:48 UTC 才达到平均回归年边界，木星在此期间持续位于巨蟹。第 323 条的声明周年分支仍可独立核对。《四书》IV.10 没有指定采用哪一种年度标尺，月段与日段重置也没有因此定案。 [《天文学大成》III.1（Toomer 译本，第 140 页）](https://terre-plate.org/library/Book%20Collection/Ptolemy_s%20Almagest%20%20%28Ptolemy%2C%20Claudius%20_%20Toomer%29.pdf) · [《四书》IV.10](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ptolemy/Tetrabiblos/4C*.html#10)

对应五条资料保留这些未定边界。其余缺项包括完整球面换算、I.21 的其他界表、水星晨昏地平证据无法唯一分型的情形及更完整的本命议题取义。

## 朔望月与两类时序

`control/western-time-links.ts` 计算实际前朔到后朔，边界归到最近一秒以保持相邻查询一致。即使前朔早于查询窗，也保留其在本窗的持续部分；不将公历月当作朔望月，不虚构一次本窗内新月。只有兼容本命资料可用时，该记录才进入个人资料链路；缺少本命时仍保留已有公共天象记录，但不把公共月相冒充个人证据。

该文件另连接完整的次限对本命相位与实际行运对同一本命对象的相位。两者须同一快照、计算、用户资料、周期且有效区间确有交集，天空天体互相相位、不同对象、无交集或部分事实不参与。结果只表明时间重叠，不标记同性质、同方向或加强。

[Heindel 第27章](https://rosicrucian.com/mos/moseng09.htm)区分推运与真实天象，并以性质是否相近讨论加强或削弱。相关条目使用独立的 [Heindel 来源计算](HEINDEL_SOURCE_CONTEXT.md)。Leo 太阳同度条的本命对象判断见下文。

## Leo 本命相位和行运指征

《How to Judge a Nativity》1928 年第四版第 IV 章印刷第 47 页给出参考外限。合相与对相按双方均为日月、仅一方为日月、双方均为行星分别取 12°、10°、8°。四分与三分为 8°，六合 7°，半刑与倍半刑 4°，半六合与梅花相 2°，赤纬绝对值差 1°。保存实际偏差和参考外限，使临界相位可审查。后版的本命外限与现有行运及次限容许度分别使用。 [同作者第四版第 IV 章](https://archive.org/stream/howtojudgenativi00leoa/howtojudgenativi00leoa_djvu.txt)

- `p009` 使用行运太阳对同一颗本命天体的精确同度，按显示时区归日。分别记录实际四角宫落星、本命上升主星、本命太阳最近的有效黄经相位对象，以及空一宫时和实际升起度数的紧密相位。角宫宫头另按 Leo 与 Green 的取法，核实际位于前一宫且沿黄道正向距离在五度以内的同一星体。保留实际宫位和前方宫头，不把它改写为实际落角宫。其他选主条件及整盘主题仍要合参。 [太阳过境正文](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=216) · [本命优先说明](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=68) · [宫头取法](https://iapsop.com/ssoc/1906__leo___the_horoscope_in_detail.pdf#page=19)

第 319 条按同作者的本命解释补入上升十分度辅助主星、月亮唯一联系以及日月各自唯一最近主要相位的四种确认。独立赤纬平行暂缓黄经排序。同星对既有原书明确较强的黄经相位又有赤纬平行时，以该黄经相位参与排序。角宫内原有特定条件和上升主星的更具体文字继续优先；较宽的近相时间和角宫一般判据仍待核。 [原书十分度辅助主星](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=68) · [Leo 与 Green 日月均取最紧密联系](https://iapsop.com/ssoc/1906__leo___the_horoscope_in_detail.pdf#page=86)

第 319 条另查本命上升的十二分度主星。每个黄道星座自本座起按黄道顺序划十二段，每段 2°30′，按本命上升的实际度数取其中一段并查该段星座主星。原书第九章将这项列在本命上升星座主和十分度主之后。行运太阳实际同度经过已核的同一主星时，才在过点当地日参考这个较细的辅助主题。1990 年 1 月 1 日试盘的本命金星始终实居十一宫，太阳于 2026 年 1 月 26 日实际过点。同一出生时刻以白羊上升 2.499°、2.501°、4.999° 与 5.001° 复算，只有金牛分段确认金星。 [1906 年第八章分度表](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=62) · [1906 年第九章本命上升层次](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=69) · [同书后版白羊分段例](https://library.keplercollege.org/wp-content/uploads/2022/01/102-Week-4-Leo-The-Progressed-Horoscope-Ch-11-Subdivisions-of-Signs.pdf)

第 319 条另确认本命太阳在原书已核相位范围内只有一项赤纬平行的子式。按赤纬绝对值差一度复算，行运太阳实际同度经过同一本命星时，仅在当地日参考较弱的行动主题。1930 年 3 月 13 日出生试盘只有日天赤纬平行，邻日仍有日天平行但另外出现日月对分，留待跨星对判别。 [本命平行](https://iapsop.com/ssoc/1906__leo___the_horoscope_in_detail.pdf#page=9) · [太阳本命最紧密联系](https://iapsop.com/ssoc/1906__leo___the_horoscope_in_detail.pdf#page=86)
- `p009` 按 Leo 与 Green 的同一本命章节取日月各自最紧密的联系。相位表所列半刑、倍半刑进入同坐标的唯一最近判定。独立赤纬平行与黄经的误差仍不直接互比。1960 年 1 月 31 日的日木半刑与 1 月 4 日的月海倍半刑各由 2026 年太阳实过同星触发，相邻生日仍有实际过点但缺这一项本命依据。 [相位表](https://iapsop.com/ssoc/1906__leo___the_horoscope_in_detail.pdf#page=8) · [日月最近相位](https://iapsop.com/ssoc/1906__leo___the_horoscope_in_detail.pdf#page=86)
- `p009` 的第十宫分支按 Leo 与 Green 同年手册第 76 页确认。行运太阳实际合到第十宫的同一颗本命星，并核实该星和本命太阳精确形成主要黄经相位时，确认该过点可参考此星原有的主题。实际宫位、出生相位和行运真点绑定在同一份事实。较宽的紧密范围与行运有效时长仍待核。 [第十宫与本命太阳](https://iapsop.com/ssoc/1906__leo___the_horoscope_in_detail.pdf#page=76) · [行运的从属作用](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=216)
- `p009` 另按同年手册第 85 页的择强法查第一、第十和第七宫。当受照星实际是这三个宫位的唯一落星且同时为上升主星，行运太阳与它实际同度的展示日可独立确认。各支用自己的静态条件，相关本命星和宫位的实算信息留在本地审计。 [择强原文](https://iapsop.com/ssoc/1906__leo___the_horoscope_in_detail.pdf#page=85) · [太阳过境原文](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=216)
- `p009` 保留同一原书中不依赖上升主星的角宫择强。当第一、第十与第七宫只有一颗落星时取该星，有多颗时优先星座入垣或擢升。若有多颗均获尊贵，按距这三宫最近宫头的黄经实差择唯一最近者。书里另记的水瓶座金星或天王星与双鱼座海王星若可能改变首位，角宫择强保留待核。如果行运太阳在当地日实际同度经过已择出的同一星体，可参考其本命主题。 [角宫择强](https://iapsop.com/ssoc/1906__leo___the_horoscope_in_detail.pdf#page=85) · [尊贵异说](https://iapsop.com/ssoc/1906__leo___the_horoscope_in_detail.pdf#page=6)
- `p009` 另按同作者第四版第七章印刷第 129 页确认两项。四个本命角宫的实居星分别具重要性，实过任何一颗可独立参考该星原有主题；择强仍依原规则。若无升起星，则可查实际升起度数的紧密相位。确认采用本命主相精确角，并核无实居一宫或距第一宫宫头前五度内的升起候选。一度内其余近相继续保留为候选。两项均要求太阳实际同度经过同一颗已核本命星，只在其当地日采用。 [四角宫及升起度](https://bibliotecaparticular.casafernandopessoa.pt/1-94/2/1-94_master/1-94_PDF/1-94_0002_122-232_t24-C-R0072.pdf) · [角宫宫头取法](https://iapsop.com/ssoc/1906__leo___the_horoscope_in_detail.pdf#page=19) · [太阳过境](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=216)
- `p009` 也可确认太阳实际同度经过本命原上升主星的当地日。原书第九章说明原主星的作用贯穿一生，次限上升换座另有新主星。如果当日没有命中上述两条更具体的分支，独立确认本命原上升主的过境，释义仍限它在本命指明的主题。合成盘复算狮子上升的太阳回归、相同回归时刻但出生上升为处女座、以及同一时刻落在 UTC 相邻日期。 [出生盘原上升主](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=68) · [太阳过境原文](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=216)
- `p001` 与木星过二宫 `p004` 使用本命二宫实际落星。若无落星，首查真实二宫头星座的主星。独立记录参考外限内落星或宫主的相位，以及第 IX 章列出的金星或木星与月亮或土星的主要配对，并标明是否涉及二宫或十宫主星。实际过宫时段保持一致。完整本命财务取义、同性质推运及人的现实回应仍须核。 [同作者第四版第 IX 章](https://archive.org/stream/howtojudgenativi00leoa/howtojudgenativi00leoa_djvu.txt)
- `p008` 的加强分支查被木星经过的那一颗本命日月自身与本命木星的参考相位。火星土星平行 `p066` 单列同对本命半六合、六合或三分作为制衡候选。互守坐标和同期月亮各有独立证据。两条均保留同版依据和实际作用的缺项。 [木星经过日月](LEO_JUPITER_LUMINARIES.md) · [本命掌宫与互守](LEO_RULERSHIP.md)

检查覆盖每种参考外限的边界、南北异侧平行、角宫与空宫的盘面归属、三个太阳过境资格的独立实算，以及一般同度缺资格时的排除。

### 木星过七宫与十宫

第十三章分别讨论木星过七宫的合作主题和过十宫的声誉主题。十宫段把进一步的声誉表现与本命及推运合参。第十二章以本命第一宫主星与第七、十宫主星的相位作为两类主题的示例。新事实 `leo_jupiter_house_ruler_context` 用已经验真的 Placidus 宫头与同作者后版主星表取出实际宫主、各自本命位置及参考外限内的相位。 [第十三章木星过宫](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=212) · [第十二章宫主示例](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=204)

- 七宫 `p006` 用第七宫及本命一七宫主的证据查询。实际过宫段附有本命相位及同对次限的有无。婚姻、合同与其他合作仍各自待定。
- 十宫 `p007` 在实际过宫段中核查同一对不同的本命一十宫主。参考本命六合或三分由任一颗星次限对另一颗本命星重复时，才记录合参候选。只经过第十宫的时段仍作为一般过宫事实保留。完整声誉资格、其他本命指征、主限及同图次限掌宫仍待核。

两条均用已有次限黄经的一度产品外限。同一过宫段在相关次限相位的起止处分割，每段只留片段内的实际成相时刻。次限对本命和同图次限分开，本批采用前者的两个方向。强调本命与次限同性质的段落仍须合参，重复六合或三分只是本批能核定的子条件。 [本命与推运合看](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=205)

合成盘验证七宫土星、月亮，以及十宫金星、月亮两对宫主。2026 年十宫样例的次限月亮对本命金星的三分进入容许度前后都在过宫，SQLite 只取有该相位的半开交集。另一实算盘出现同对梅花相而未产生加强候选。记录及原证据哈希继续保留，两条仍为部分映射。

### 木星过宫的年度宫主

按第七章的年度次限图独立取一、七、十宫头并核主星。实际木星过宫仍使用固定本命宫界。过宫片段在出生周年及相关两颗年度宫主实际相位的进出时刻同时切分。年度宫界有效期与两颗宫主均随本片段记录。两个盘层的同名天体分别核对。两颗宫主恰为同一星时无需编配自相位，同图主客互换记录只计一次。 [年度宫界计算](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=53) · [第十二章区分本命和次限图宫主](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=204)

年度宫主若属于当前 Leo 同图扫描尚未覆盖的星对，年度相位条件为未知。固定本命分支仍独立核对。

- 木星七宫 p006 查询实际本命一七宫主的相位，或当年同图实际一七宫主的黄经相位。两项分别作为合作或关系主题的几何证据，保留相位本身和不同的现实关系条件。
- 木星十宫 p007 保留固定本命一十宫主的六合或三分由次限对本命重复的分支。年度分支独立核那一年的一十宫主，须同见固定本命一十宫主已有的同一种六合或三分。两图的宫主星名可以不同。当前只标记这组位置及相位，整盘、其他主限和作用强弱仍待核。 [木星七宫、十宫原段](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=212)

两条继续为部分映射。事实 v1.96、西方规则 v39、中文输入 v97。

## Sepharial 朔望分层

Section IV 第一章写明天顶黄道弧一度对应一年，并用出生纬度表找指定黄道点升起时的天顶；月亮推运用出生后两小时对应一月。第二章分列主限、行运、月亮推运和朔象，并用新月落在本命木星位置举例。第 123 页的年例再按出生周年年龄加到本命天顶黄经。 [计时法](https://proxybridge.pythonanywhere.com/cache/epub/46963/pg46963-images.html#Page_95) · [行运及朔象](https://proxybridge.pythonanywhere.com/cache/epub/46963/pg46963-images.html#Page_103) · [年度实例](https://proxybridge.pythonanywhere.com/cache/epub/46963/pg46963-images.html#Page_123)

综合条目 `p004` 使用 `sepharial_lunation_context`。朔点数值同度须锚定同一候选的本命日月、七颗原书行星或上升、天顶，并保留实际本命宫位。0.00002° 只用于吸收秒级星历误差。前朔到下一朔与公历查询月取半开交集，其内核对同一目标的实际行运精确经过及月亮、太阳推运精确相位。原书角点简法用天顶正推或同纬度升点逆解黄道位置，另存同段成相的精确时点。任何高阶条件若涉及另一本命对象，仅保留为背景。空组表示这段未查得该层精确点。

同作者 1914 年书第 84 页另查朔点与本命行星的偏顺相位，并以该行星的出生宫位承载主题。规则新增与本命行星的精确六合、三分，沿用 0.00002° 数值误差。2026 年 11 月复算两种成相、四分和未足六合的对照。 [《A Manual of Occultism》第84页](https://iapsop.com/ssoc/1914__sepharial___manual_of_occultism.pdf)

该页另列实际合朔时其他行星与本命天顶、上升、太阳、月亮的关系。按朔的规范秒取当时的地心热带黄经，沿用 0.00002° 数值误差，并与整个朔望月内的其他过境分别保存。2026 年 11 月合朔符合原有木星同度条件时，另核到该秒金星与本命天顶同度。只改变本命子午度 0.001° 会移除金星证据，木星原确认仍在。另一份试盘的出生时刻晚一小时，木星同度不再成立，朔时金星合本命天顶仍可核出。按 Sepharial《Astrology》第 101 至 102 页所列的本命指征，朔时金星或木星精确合本命日或中天时，参考职责与声誉。精确合本命月亮或上升时，参考个人生活与日常安排。两份同朔试盘分别实核金星合本命中天和上升。第 31 至 32 页把火星、土星、天王星和海王星与指征的合相列为偏难。同朔另实核火星合本命中天和上升，参考对应议题的压力。水星合相仍需其具体条件，单凭同度保留候选。作用时长及更宽相位取法继续待核。 [《A Manual of Occultism》第84页](https://iapsop.com/ssoc/1914__sepharial___manual_of_occultism.pdf) · [合相分类](https://proxybridge.pythonanywhere.com/cache/epub/46963/pg46963-images.html#Page_31) · [指征主题](https://proxybridge.pythonanywhere.com/cache/epub/46963/pg46963-images.html#Page_101)

`p004` 按朔点所触及的本命行星实居宫位确认主题。第 103 页以朔点与本命木星同度为例，举第四、第六、第八及第十一宫。其余宫域按同书第 29 至 30 页的宫义表。1914 年同作者所列的朔点与本命行星精确六合、三分也查同一主题表。2026 年 11 月复验原书四个例宫、第十宫，以及实际六合、三分，四分和近相当作反例。模型只收到对应宫义和上层时间指征的合参条件。十二月继续承接同一次朔望月直至下一次朔。 [第103页木星例](https://proxybridge.pythonanywhere.com/cache/epub/46963/pg46963-images.html#Page_103) · [第29页起十二宫宫义](https://proxybridge.pythonanywhere.com/cache/epub/46963/pg46963-images.html#Page_29) · [同作者1914年书第84页](https://iapsop.com/ssoc/1914__sepharial___manual_of_occultism.pdf)

同一次合朔时，其他行星与四个本命指征还可有精确的非合相联系。第 31 至 32 页以相位的性质分类，六合、三分偏顺，半刑、四分、倍半刑、对冲偏难，继续按第 101 至 102 页区分本命日与天顶、本命月与上升涉及的主题。作用限制仍取第 103 页朔象相对于主要时间指征的次序。2026 年 11 月同一朔时用四张试盘核到土星六合天顶、金星三分上升、金星四分天顶及火星对冲上升。各试盘挪开本命子午方位 0.001° 后即无该项精确证据。水星仅保留几何记录，待核其具体分类。 [朔时其他行星与四本命指征，1914 年书第84页](https://magicgatebg.com/Books/A%20Manual%20of%20Occultism%20by%20Sepharial.pdf) · [第31至32页相位分类](https://proxybridge.pythonanywhere.com/cache/epub/46963/pg46963-images.html#Page_31) · [第101至103页指征及朔象](https://proxybridge.pythonanywhere.com/cache/epub/46963/pg46963-images.html#Page_101)

合朔本身的太阳或月亮过点归朔象层。五秒以内的同点过境按星历取整误差归回该次合朔，其他时刻再经同一点仍记独立行运。主要行星的真实逆行经过单独注明。火星及更慢的原书行星若在本命日、月、上升点或天顶数值同度停驻，登记原书所列接近主限的证据。停驻必须在该实际月段内，对应另一个本命指征时供同期审阅。 [原书行运与朔象](https://proxybridge.pythonanywhere.com/cache/epub/46963/pg46963-images.html#Page_103)

同书 1905 年例另查主要行星停驻对冲本命月亮。2026 年 9 月的实际天王星停驻与测试本命月亮精确相距 180°，在当次朔望片段中独立登记。偏离同度精度或停驻落在查询片段末端时排除。 [原书停驻对冲例](https://proxybridge.pythonanywhere.com/cache/epub/46963/pg46963-images.html#Page_124)

同一片段内有两颗以上主要行星各自精确经过该朔点对应的本命指征时，按第 104 页比较发生频次，顺序为海王星、天王星、土星、木星、火星。逐星保留实际先后时间，另核逆行和停驻。1996 年 3 月实算例中火星先经过本命太阳，土星后来经过，在原书频次上仍优先参考土星。土星落在片段截止时，片段只保留火星经过。 [原书的主要行运顺序](https://proxybridge.pythonanywhere.com/cache/epub/46963/pg46963-images.html#Page_104)

角点主限按同书相位表将三分、六合列偏顺，半刑、四分、倍半刑、对冲列偏难。合相沿用原书对不同星体的分类，水星合相保留未定。角点方向另标实际对应的本命指征。 [原书角点方向](https://proxybridge.pythonanywhere.com/cache/epub/46963/pg46963-images.html#Page_97) · [原书相位表](https://proxybridge.pythonanywhere.com/cache/epub/46963/pg46963-images.html#Page_31)

原书按主限与月亮推运是否同向分别说明强化、短暂扰动或暂时缓和。查询片段内的精确候选须锚定同一本命指征，且该指征的主限分类一致，才记录这项关系。其他指征、主限分类矛盾或未定时，仍分别列出证据。2026 年 11 月同一实算朔点复用了月亮推运时点，独立对照同向、反向和另一本命指征，均经 SQLite 核验。 [原书月亮推运与主限](https://proxybridge.pythonanywhere.com/cache/epub/46963/pg46963-images.html#Page_98)

月亮推运依同作者 1914 年《A Manual of Occultism》卷内例表取算。原表在公历年初核年龄，按年折星历日、月折两小时、日折四分钟，表中借月按三十日。求出该年一月的星历时刻和月亮黄经后，取星历对应的格林尼治正午间一日行度，除以十二并取最近角分，作为当年固定的月增量。1911 年原例验到 1865 年 7 月 18 日 15:10 的基准，以及每月 1°09′。年表在下一个一月重新起算，两个年表之间的跳值不会生成成相。程序用 UTC 月初为界，在每个公历月内作均匀插值来定位候选时刻。原书只列月度表，现代出生地日期选择和月内具体时分仍待核。 [原书第二节第一章与第四节第三章](https://magicgatebg.com/Books/manualofoccultismsephariel.pdf)

原书月亮表分别引用本命位置 R 与当年次限位置 P。1911 年次限盘按第四节第二章用出生后第 46 个星历日，即 1865 年 7 月 19 日同一出生时刻。当年的次限金星约在黄经 70.71035°，落在年表六月月亮所走的黄经段内。程序对已核朔点所关联的本命行星，另查同名星在该次限年表上的位置及月亮成相候选。本命层与当年次限层分别出本地审计，沿用实际朔望月片段，年表交接不外推。2026 年 1 月实算样本的朔点核到本命金星，只有月表对当年次限金星的对分。模型继续采用已确认的朔象宫义和静态合参条件，各层作用时长和权重仍待核。 [《A Manual of Occultism》印刷第 71、73、77–79 页](https://logoilibrary.com/wp-content/uploads/2019/07/1914__sepharial___manual_of_occultism.pdf)

第 95 页指向同作者《Prognostic Astronomy》作为球面主限的详法。第四章用本命行星实际赤经、赤纬与出生地纬度，算星体至上、下中天或东、西地平的弧。涉及日月的星体合相另将移动星带至静止星在昼弧或夜弧的同等比例位置。按半弧主限的一赤经度一年换到现有周年时间标尺，分别记录直向与逆向。1841 年原例实算出天王星到东地平、土星到上中天、金星直向合月亮及太阳逆向合木星，与印值相差在数角分内。2026 年 11 月例中，实际赤经所得的上中天证据与简法黄经投影分列，且须落在同一实际朔望月查询片段。极区星体不经过地平时保留缺值。其余球面相位、月球地方视差、不同换年法和真实影响时长仍待核。 [《Prognostic Astronomy》第四章](https://pdfcoffee.com/sepharial-prognostic-astronomy-pdf-free.html) · [《Directional Astrology》第八章](https://iapsop.com/ssoc/1921__sepharial___directional_astrology.pdf)

朔点容许度、各层有效长度和同题权衡仍待核，条目保留部分映射。Liverpool 两例的升点、天顶配对经现代几何交叉核验。2026 年 11 月朔点的合成出生盘检验四层时点，并用不同出生年验证新月表的月相命中与排除。2026 年 9 月实算天王星停驻时，对照天顶数值同度、偏离 0.01° 和恰好落在有效段截止三种情形。

## 模型输入与验证

`ptolemy_time_place`、`ptolemy_ingress_contact`、`ptolemy_lunar_phase_contact`、`lunation_window` 和 `progression_transit_overlap` 经确定性中文转换后供本地审阅。模型接收已完整命中的资料和查询时段。八条部分映射资料仍供本地审核。

`western-source-times.test.mjs` 验证周年和闰日、28天与7/3天、年尾短段、循环星座与昼夜同式福点、真实星历区间、月日条目进入 SQLite 的链路、前朔承接与半开边界、跨快照/周期与无交集保护，以及实际中文输入的字段边界。事实层更新为 `fortune-calculation-fact-layer-v1.9`；没有其他业务、公共 UI 或根配置修改。

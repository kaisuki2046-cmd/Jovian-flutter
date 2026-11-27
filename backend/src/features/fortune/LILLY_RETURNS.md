# Lilly 回归成对事实与来源本质表

该批最初补四条回归资料：土星回本命土星、木星到本命水星、金星到本命水星、月亮回本命月亮。首批四条都登记为部分映射，随后第 336 条已核完。土星、金星与月亮三条仍有来源条件待核，运行匹配读取 SQLite。

后续已补 [偶然条件与逐星正文复核](LILLY_CONDITIONS.md)。以下保留首批实现及审查背景；金牛和天秤界的运行计算现已按同书正文核定，原表差异仍可审查。

## 回归上升与本命第七宫

第三卷第 737 页以本命第七宫宫头的星座与太阳回归上升星座相同作为本条条件。第 735 页原例由太阳回到本命黄经的时刻换当地子午线及纬度，再排宫头。运势使用热带黄道和雷吉奥蒙塔努斯制。 [第 737 页原文](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=251) · [第 735 页计算原例](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=249)

年运页面在命盘时刻可靠、查询年内有唯一一次太阳回归时，可以展开“设置太阳回归地点”。填写页面所示时刻对应地点的十进制度纬度、经度，南纬和西经为负。客户端只为该次回归分宫，上传与第七宫比较和行星配对有关的盘面事实。经纬度留在本次客户端输入中。查询窗口内上一次回归的有效尾段仍分别核对，需要该次自己的地点才能取得宫位和昼夜。

服务端核对比较事实和同一次太阳回归的时间与来源，再用 SQLite 匹配 `lilly-v3-revolution-p003`。同座按黄经所在的 30 度区间判断，跨座时不命中。如果上升星座在求根误差内跨界，或本命宫头星座不可确认，该比较保留未知。命中只覆盖本次回归年至下次回归与查询年的交集。

在 1990 年 6 月 15 日 UTC 04 时的合成档案中，2026 年实际回归为 UTC 6 月 14 日 20:54:22.399。测试用两组经纬度分别验证同座和不同座，并核对几何边界、缺地点、跨年错用及服务端拒绝不一致事实。事实 v1.109，西方规则 v46，中文输入 v110。

### 指定地点的行星宫位与土星中天

同一回归盘的雷吉奥蒙塔努斯宫界用于四条行星配对。取回归时刻及求根误差的两个端点，行星所在宫一致时才记录宫号和宫类。当地太阳高度的昼夜判断也要求三点一致，并用于回归盘的三分尊贵。本命昼夜、宫位和尊贵继续从本命盘取得。第七宫星座比较与行星入宫分别判断，一个边界不确定时仍可使用该张回归盘上已核位置。服务端核对各配对与同一次太阳回归的来源、有效段及字段关系。 [Lilly 第三卷回归盘排法](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=249)

土星回本命土星条进一步查询回归土星实居第十宫的中天位置候选。其他已核宫位、误差内跨宫、未给地点分别处理，保留原有行星配对候选。第十宫是本批用于比对中天的明确口径，原文中天的精细范围和土星综合有利条件仍待核。木星对本命水星仍按成对几何查，金星的回归位置和月亮的本命条件各从对应盘面取。 [土星与木星原文](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=252) · [金星原文](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=253) · [月亮原文](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=254)

2019 年样例以回归土星恰在第十宫宫头的地理经度为界，两侧样本分别得到实际第十宫和第九宫，边界样本的宫位未知。测试还验证前一回归年不会继承该地点，四条新配对事实不上传经纬度或完整宫头表。最初接入的版本为事实 v1.200、西方规则 v63、中文输入 v201。

### 本命日月差与太阳回归福点

第三卷第 736 页用本命月亮黄经减本命太阳黄经，再加回归上升黄经。原书例的回归上升为巨蟹 0°32′，本命日月分别为天秤 6°37′ 和双子 1°44′，按公式重算为水瓶 25°39′。该数值来自原书正文和本命图数据的重算，图中手写标注还待逐字核实。运行于同一真实太阳回归求根及误差两侧重算，三点宫位一致才提交宫位。第 737 页将福点所处宫用于复核财产题材。 [第三卷第735–736页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=250) · [第三卷第737页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=251) · [本命图与映点](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=257)

第 296 条沿用已经确认的有利土星条件。1980 年试盘中，土星实际仍在第六宫，与金星实际合相。同一次回归只改变地点时，福点分别落在第三宫和第四宫。第四宫例用于原书的家产、土地与居所主题旁证。若改用回归月亮计算，同样的返照图会误取第十二宫。宫界不稳定时保留原有土星条件。福点结果不参与金星与月亮条目的各自强弱判断。 [第一卷第四宫的题材](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=72) · [第三卷土星回归](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=252)

### 同一宫头条件复用到土星与本命月亮

第 296 条把第一卷第 33 页的宫头规则应用到回归土星的其他实际宫位。1980 年样本的回归土星实居第三宫，三个求根样本均在最近的第四宫头之前约 3.56 度。原有土星与金星精细合相的支持条件仍齐，采用一般职责原句。误差区间跨五度时维持候选，第十宫实居另用具名中天原句。 [第一卷宫头规则](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=53) · [第三卷土星](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=252)

第 338 条另外按相同宫头规则计算本命月亮的两套助损下限。1988 年试盘的 2026 年回归，回归月亮与本命月亮同座同角分，本命月亮实居第三宫且距第四宫头约 3.27 度，计入该宫作用两套下限均为 14；改位置到五度外仍实居第三宫，改回实际宫计分时两套下限均为 11。远日和具名偏难相位仍沿用原有核对。 [第三卷月亮回归](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=254) · [原书命例](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=259)

第 337 条确认第一卷明确与金星性质相契的第五宫。仍须同座同角分、顺行远日及三个误差采样都达原例下限。2024 年例的同一回归从第五宫换到第六宫时，同角分保留，解读回到候选。第五宫沿用第一卷的三分宫位计分，未额外加分。 [第一卷第五宫](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=73) · [第一卷助损表](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=135) · [第三卷金星](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=253)

第 337 条也采用同一助损表的第二、第三、第九宫正分，分别为 3、1、2。金星仍须满足同座同角分、本质助力、顺行远日和原有保守强势下限。2024 年同一回归的六处实际地点分别核到三次实体落宫、三次接近前方宫头的计分位置，每对的保守净值都是 22、20 或 21。第六宫处于表列扣分位置，同一颗金星在该处仍保留候选。第八宫按原书具名命例另核。 [第一卷正分宫位及助损表](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=135) · [第一卷五度宫头法](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=53) · [第三卷金星](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=253)

同表也用于已核同座日心。2094 年试盘分别在实体第二、第三、第九宫及各自前方宫头中复验，保守净值各为 18、16、17。同一回归换地点，实居第五宫且仍按第五宫计分时净值下限为 18。实居第五宫但距最近的第六宫头约 4.80 度时转按第六宫计分并保留候选。2030 年的同座日心样本移至第三宫或第九宫后，净值分别为 14、15，均低于第三卷强势命例的门槛，继续保留候选。 [第一卷日心与受灼](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=133) · [第一卷助损表](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=135) · [第三卷强势金星原例](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=258)

### 第五宫头金星与第六、第八、第九宫头月亮

第 337 条把第一卷五度宫头作用用于第五宫金星。2024 年样本中，回归金星实居第四宫，在北纬 35 度与南纬 83 度的两处实算盘中，分别距最近的前方第五宫头约 2.23 度和 3.40 度，求根误差内稳定。仍与本命水星同座同角分，并按第五宫作用重算，保守净值为 22。距离等近且求根跨过判定界时维持候选。第一卷给出五度宫头规则和金星喜居第五宫，净值门槛沿用第三卷强势命例。 [第一卷第33页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=53) · [第一卷第53页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=73) · [第三卷第739页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=253)

第 338 条沿用同一宫头法，加入减光、在日光下的本命月亮按第八或第九宫头计入两处助损表的条件。2019 年同一出生时刻与 2038 年真实同角分回归按三个本命角度重算。实居第八宫近第九宫头约 0.43 度时，上限为 -4、-4。实居第七宫近第八宫头约 0.87 度时，上限为 -8、-10。同在第七宫但远离宫头的上限为 -2、-2，仍是候选。 [第一卷助损表](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=135) · [第三卷第740页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=254)

1902 年出生的试盘在 1921 年核到同座同角分。出生月亮在天蝎落陷，减光且在日光下，实居第五宫并距最近的前方第六宫头约 1.88 度。按第六宫扣两分后，第一卷点表与第三卷例的两套净值上限均为 -4。使用同一出生时刻和星历，换出生地使月亮仍在第五宫、距第六宫头约 5.38 度，两套上限均为 +1，继续保留候选。 [第一卷宫头取法](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=53) · [第一卷助损表](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=135) · [第三卷第740页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=254)

### 回归土星与正在入相的同度木金

第 296 条依第一卷第 106 至 108 页区分精确落点与尚在靠近的合相。在回归土星实居第十宫、顺行远日、有本质助力且无已核火星反证时，同一回归图的金星或木星须与土星同座同度格，在求根误差内稳定入相，并在换座前实际合相。避开已核离开趋势、逆行转向及介入。在 1980 年实例中，原出生时点向前移两小时，回归土星与金星仍同度格但相差约 0.09 度，随后真实成相。向后移同样时长则已离相。 [第一卷第106至108页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=126) · [第三卷第738页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=252)

第一卷第 107 页也以金星和土星说明正在靠近的三分。第 296 条复用同一套实际入相和阻断核对，要求同度格、相应的两座三分关系和换座前实际成相。1971 年试盘的回归土星实居第十宫，同图土星在金牛、金星在摩羯，两者互守本垣。原出生时点提前一小时的试盘，金星在太阳回归之后实际三分土星。晚一小时的试盘仍有相同互守和宫位，三分已经离开，保持候选。 [第一卷第107–110页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=127) · [第三卷第738页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=252)

第 296 条依第一卷第 102 页和第 124 页把吉星入相六合与三分分别核验。六合继续查返照土星实居第十宫、本质助力、顺行远日和已核火星抵触，并要求求根时刻及两侧的土星行速快于书载均速。同盘金星或木星与土星须在各自星座的同度格趋近，并在换座前按实际星历成相。1982 年试盘的金星于 8 月 30 日实际六合土星，成相在太阳回归约一小时后。出生时点后移两小时、同次回归移出第十宫，以及 2019 年实居第十宫但土星行速低于书载均速三种情形，均保留为候选。 [第一卷偶然助力](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=123) · [第一卷六合、三分入相](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=145) · [第三卷土星回归](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=252)

### 夜生月亮自身尊贵与实际入相

第 338 条依第三卷第 736 页的回归通则，核本命夜盘地平线上方的月亮、自有本质尊贵、增光远日和同图木金实际顺向成相。仅参考原文的缓和条件，回归月亮仍须同座同角分。1960 年出生的实算盘例在 2017 年的回归满足同角分，月亮在第八宫居己面，木星同座入相并在本命时点后实际合相。原有两表下限为三分和一分，后表未达到命例下限。同一出生时刻改用实际昼盘角度，夜生分支不成立。 [第三卷第736页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=250) · [第三卷第740页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=254)

第 338 条另核第 736 页并列的夜生本垣月亮。回归仍须同座同角分，本命月亮增光远日，在地平线上且实际留在非角宫。同图木星或金星还须在所核两种半径内实际成相，期间无已核折返和介入。1933 年出生试盘在 2009 年满足回归同角分，出生盘月亮在第八宫居巨蟹本垣，出生三小时余后实际六合木星。两表净值下限分别为 3 和 1，原有共同强势下限未满足。只改本命角点为昼盘仍会实际六合，但此支不成立。1988 年的夜盘第八宫同样有本垣及同角分，木星六合已离相，仍不采用这条缓和旁证。 [第三卷第736页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=250) · [第三卷第740页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=254)

### 两盘上升相同与回归上升主本垣

第三卷第 736 页要求核对本命和回归上升及其守护星。选择已核的范围，两盘上升须同座同角分，且回归根误差两侧都满足。回归金星或月亮须为该共同上升的守护星，并在三次取样中实居自身本垣、远离太阳光束。第 337 条继续先核回归金星得势，第 338 条继续先核本命月亮原有助力。1956 年出生试盘在 2024 年复算出天秤同升与回归第一宫金星，1988 年出生试盘在 2026 年复算出巨蟹同升与回归第一宫月亮。两例只改变回归地点使上升移出原角分时，原星本垣和各条原有确认都可复得，本项补充依据随即失效。 [第三卷第736页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=250) · [第739–740页金星与月亮](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=253)

第三卷第 736–737 页还分查回归上升对本命上升的四分、对分，以及实际回归上升所在的本命宫。两边界点和真点须在同一对应角分、同一对应星座才确认四分或对分。三点所落本命宫也一致时才登记宫号。1971 年土星、2024 年金星和 1993 年月亮试盘均核到两盘上升四分、回归上升实落本命第四宫。与各自已核的逐星原条合用时，这组角点只补充家宅、居所题材。三盘只改变回归地点以移出对应角分时，各自原条仍成立。1993 年试盘同次回归另核正向和反向的四分、实际对分及第六与第七宫之间的宫界，跨宫时仍能确认角度，宫号留待核对。 [第三卷第736–737页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=250) · [第一卷第106页相位定义](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=126) · [第一卷第52页第四宫](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=72)

第 737 页另比较年度回归上升所在座与本命第六、十二宫头所在座。使用同一次实际太阳回归的真点与误差两端，确认三个上升均在同一座，再逐一比较本命宫头。土星、金星、月亮三个既有试盘均复算两种同座，并保留各条的原有助损和同位条件。1971 年土星盘的两处回归上升分别实际落在本命第五、十一宫，又与第六、十二宫头同座。2024 年金星试盘越过狮子座起点前后，回归第三宫的原有金星强势仍成立。误差跨座时，同座条件保持未知。题材限定按各宫的日常事务或不公开事务理解。 [第三卷第737页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=251) · [第一卷第六宫题材](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=73) · [第一卷第十二宫题材](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=76)

### 回归月亮第十二宫与本命第六宫座

第 338 条的本命弱月分支另核第三卷第 789 页书例中回归月亮的宫位与本命宫头星座。回归月亮须实居第十二宫，且所在座为本命第六宫头所在座，才参考原书用于日常事务和隐情的两盘主题。第 740 页的两盘同角分及已核本命弱势条件继续独立要求。1936 年出生试盘在 1993 年复算出该组合，两个本命助损上限均为 -5。改变回归地点只把月亮移入第十一宫，或单独改变本命角点只把第六宫头移至另一星座时，此项失效，原有弱月判断依旧成立。未知回归地点、误差内跨宫或跨座以及本命宫头靠近座界的样本继续留待核对。 [第三卷第740页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=254) · [第三卷第789页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=303)

### 第十宫头前五度的候选

回归土星实际位于第九宫、距前方第十宫头不超过五度，且第十宫头是最近的宫头时，另外登记为中天候选。于回归根及误差两侧重复核对，登记距离范围和边界状态。原文对精确中天是否有不同权重仍待核；采用 Lilly 说明宫头归属与本命第二宫时的取法作为候选依据。 [第一卷宫头说明](https://iapsop.com/ssoc/1659__lilly___christian_astrology.pdf) · [第三卷印刷页552](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=66) · [回归土星原文](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=252)

2019 年同一回归时刻的三处地点分别覆盖距宫头四度、误差跨五度界和相距六度。SQLite 单独检查第九宫的近天顶分支，继续保留实际第十宫及一般回归候选。土星总体有利及跨图同度继续核对。事实 v1.243、西方规则 v70、中文输入 v244。

## 核读来源与版本差异

本质表核对 [Wellcome 收藏的 1647 年原书](https://wellcomecollection.org/works/s7z7c46y)、其[印刷页 104 影印](https://iiif.wellcomecollection.org/image/b30338724_0138.jp2/full/2000,/0/default.jpg)、[另一原书副本的同页](https://archive.org/details/ca-william-lilly/page/n125/mode/1up)，并与资料所用 [World Astrology 第一卷转录](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=124)比较。回归条文逐项核读[第三卷印刷页 738 至 740](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=252)。页面已渲染作视觉检查，未只依赖 OCR 的星曜字母。

- 金牛土星界限：所核 Wellcome 副本为 26，另一副本与转录为 20，后者出现 22 后接 20 的非递增。计算保留 Wellcome 参考区间，同时将金牛 20 度以后标为版本差异，不据该参考界主确认界内尊贵。
- 天秤第四界：所核两份影印为金星至 24 度，转录为水星至 24 度。19 至 24 度保留未知，不静默换成通行表。
- 水象三分在 Lilly 本表昼夜均由火星掌管，不混成 Dorothean 的昼金星、夜火星及参与主。交点在原表的标示留审查，本批只计算七曜，不给外行星配传统本垣。

差异与十二行来源参考保存于 `model/fixtures/lilly-essential-reference.json`。该 JSON 仅用于算法验证，不是运行时资料库；实际算法常量在 `control/lilly-essential.ts`。源资料条目和匹配规则仍按既有流程导入 SQLite。

## 本质条件与未知状态

分别计算本垣、擢升、昼夜三分、界、十度面及失势、落陷。擢升按整星座成立，不强求落在原表标示的某一度；界和面采用累计端点的半开区间，不先舍入黄经。

昼夜未知时，只有昼夜结果确实一致才确认三分归属。例如水象火星仍可核，火象太阳不能默认昼主。存在未知项而无其他已知尊贵时，保持未知，不说成游离或无尊贵。已知的一项本质尊贵可以与失势、落陷或其他未知项并存；本实现不相互抵消、不评分，也不输出“状态良好”布尔值。

原书的综合状态还涉及偶然条件、受助受损及相位等。土星和金星的状态良好、本命月亮有利或虚弱均未被单项本质位置替代。木星对水星条没有额外的尊贵前提，本批也未添加。

### 第一卷第 115 页的分项点数

以第一卷第 115 页为口径，在土星、金星和月亮条所要求的盘层分算已核的尊贵、失势、宫位、顺逆、快慢及太阳距离状态。助力和受损分别小计。缺少回归地点时宫位分缺项，昼夜或界不明时对应分项缺项。第八宫按表扣 2 分，第三卷第 744 页的本命示例扣 4 分。点数在本地审计呈现。 [第一卷表](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=135) · [第三卷示例](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=258)

第一卷第 114 页的日距定义分别核外三曜与水金的东西状态，月亮增减光只计一次，朔望界点留空。另核同座内实夹于土火之间的位置，以及木金、土火对应的具名相位。具名相位须同时满足原书示例的整座关系和双方在各自星座中的同一度格，其他容许度相位留为一般背景。取分后的整体判断仍待核。 [第一卷第 106 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=126) · [第一卷第 114 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=134)

升降交点对照同一本命或回归时刻。平交点依 IERS 5.43 的升交点平均经度加当日章动，瞬时交点从月亮地心位置和速度确定的轨道平面求真黄道交线。两个结果分别保留。两者同意所查星体与升交点同度格时加 4 分，同意与降交点同度格时扣 4 分。两者有分歧时该分项待核。原书历史星历的交点取法仍待查。 [第一卷第 115 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=135) · [IERS 2010 第 5 章](https://iers-conventions.obspm.fr/content/chapter5/icc5.pdf)

固定星使用星表的 J2000 赤经、赤纬与自行，换算到实际本命或回归时刻的真黄道。大陵五按第一卷第 115 页明述的五度范围扣 5 分。依第 106 页的合相定义，轩辕十四和角宿一与目标落在同一星座、同一最近角分时，分别按第 115 页计 6 分与 5 分。黄经差、整数度格和角分分别留证。整数度格相同但角分不同的情况不计这两星的分，本项的更宽范围仍待核。回归土星及金星只查回归盘，本命月亮只查出生盘。本批用 2011 年土星、2024 年金星回归点和两张 2026 年匹配命盘复验。 [第一卷第 106 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=126) · [第一卷第 115 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=135) · [轩辕十四目录](https://simbad.harvard.edu/simbad/sim-id?Ident=Regulus) · [角宿一目录](https://simbad.u-strasbg.fr/simbad/sim-basic?Ident=Spica) · [大陵五星表参数](https://doi.org/10.1088/0004-637X/736/2/89)

## 同一本命与同一次回归

`control/lilly-returns.ts` 复用实际太阳回归求根结果，每个真实回归年分别产生四种成对上下文。核出生时钟、七曜唯一性、本命星历、回归星历及太阳回归根精度；缺时刻、多候选、错引擎、缺星、重复星、错星历或错回归时点不产生确定上下文。

每对保留回归星与本命目标的黄经、最短距离、各自本质表位置和完整回归年起止。太阳求根精度只校验回归时刻。跨图同度的统一容许度仍待核，整数一度格保留作审查。候选筛选见下节。

第三卷第 734 页以出生太阳所处度和分定义返照。出生时刻已核时，直接从该时刻的星历读取太阳实算黄经。返照年窗、返照地点定位和跨图角分共用同一根。1960 年木水盘的 2026 年返照实算在 `2026-08-17T02:31:06.960Z`。只把快照显示太阳黄经增加 `0.01°`，会得到相差约十五分钟的显示舍入根并错过木水的同角分。资料匹配只读已核实际根。跨图候选范围和原书尚未给出的容许度仍分别记录。 [莉莉第三卷第734页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=248)

本命昼夜由可靠出生时刻和复原几何框架核，目标宫位采用雷吉奥蒙塔努斯制。回归宫位和昼夜只使用该次回归的指定地点。框架不可复原时，相关宫位和昼夜保持未知，本质表中不依赖它们的条件仍可审查。

窗口跨实际回归时刻时，前一回归年的有效尾段与新回归年分别保留。Prompt 为经过候选筛选的成对年段另保留位置。

## 本命位置候选

第三卷第 734–735 页用本命太阳黄经求回归时刻，第 738–740 页才按回归星与本命位置逐条取义。第 783、802 页有两个实际跨图判读。以第 742–743 页图表和第 735 页正文核出的太阳天秤 6°37′、月亮双子 1°44′、火星狮子 0°54′为锚点，再求现代星历的两次回归时刻。1644 年回归木星与本命月亮相差约 0.481°，1652 年回归土星与本命火星相差约 9.067°；两者同星座。回归星数值是现代复算，未作为 Lilly 当时使用的星历照录。第 782 页对另一处木星经过所写的双子 22°与本命图表不一致，复算以图表和第 743 页可逆核的映点为准。见 [本命图](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=256)、[第 29 年例](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=297)、[第 37 年例](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=316)。

`lilly_return_context` 并列保留同星座、整数一度格和第一卷同图合相的两列半径和。SQLite 候选必须同星座或进入至少一列参考距离。1652 年重算差值超出两列的 8.75°、8°，因此同星座例仍留作候选；黄道首尾跨界的小角距也按实际距离比较。明确超出两列且不在同星座的配对保留在计算审计中，并从规则候选与模型输入剔除。该条件是候选范围，跨图容许度及其分支仍待核。见 [第一卷相位和半径](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=126)。

第三卷第 737 页的回归通则另把本命七曜全在地平下、回归七曜全在地平上列为反向例。第 296、337 条用 SQLite 排除同一次回归中要求回归星得势的分支。第 336 条不以星体得势为前提，第 338 条分读本命月况；两条各走成对条件。2012 年金星与 2020 年土星均用实际太阳回归、指定位置和本命七曜判定。地平反向仅影响相交的回归年片段。 [第三卷回归通则](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=251)

第 737 页还以本命指征在年度回归图的实际所居宫限定议题。土星、金星、月亮各自的本命宫主身份按雷吉奥蒙塔努斯宫头及第一卷本垣表核对，再记录该星在同一次指定地点回归图的实居宫。金星到本命水星条按金星查本命宫主。前一回归年没有相同地点依据，不能沿用。宫主和实居宫用于本地审计。第 740 页的月亮具体指征仍可能涉及其他来源，三条原有得势和同位要求继续分别核查。 [第三卷回归通则](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=251) · [第一卷本垣表](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=124) · [第三卷月亮原文](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=254)

第 296 条另核第 786 页土星回归书例中的交叉处分。按书例太阳位置复算，回归土星同本命仍在金牛，回归月亮在摩羯。月亮由土星守护，土星所在星座为月亮的擢升座。本地审计独立记录这个同图几何，并沿太阳求根两侧复验。第一卷同种互容及其助分继续按各自条件判断。原例还合看金星和高阶方向，因此交叉处分只供复核，整条有利性仍待核。 [第三卷第 786 页书例](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=300) · [土星回归原句](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=252)

第 296 条确认同座近位且回归土星明确得助的一支。土星须按本垣、擢升或同等互容核得尊贵，同时顺行、远离太阳光束，没有落陷或失势。同盘木星或金星的合相、六合或三分须落在相应角分，且已核范围内无火星偏难相位。第十宫按指定回归地点实算，并单独采用原书的中天加强文字。实居第九宫且稳定距第十宫头不足五度时，沿用一般受助的解读。求根误差内跨宫、地点缺失或只有近相继续留作候选。1921 年出生样本的 1980 年回归复用同一金星合相，核实第十宫、第九宫距宫头四度和八度，以及回归土星恰在宫头的不同结果。 [土星回归](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=252) · [第一卷精细相位](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=126) · [第一卷助损表](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=135)

## 自然语言、测试与剩余项

第 337 条确认同一实际太阳回归里，金星与本命水星同座同角分，而该次回归的金星确有强势的一支。金星须在指定地点的回归图实居角宫，且按最近宫头规则仍以实居宫计分，同时按本垣、擢升或同等互容核得尊贵，顺行且远离太阳光束。两列相位半径内若见具名土火不利接触，则不走此支。其余原书列明的可能扣分计入保守下限，再与第三卷称为强势的金星净值十六比较。这个标准只用于确认明确强势的一支，其他有利组合和较宽的跨图作用待核。1956 年出生盘的 2024 年回归验证了实居第十宫的确认，以及同角分但未设地点、实居第十二宫或临下一宫头的候选。 [金星回归原文](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=253) · [第一卷点表](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=135) · [第三卷命例](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=259)

同一金星回归换到实居第十一宫的地点时，依第一卷表给该宫四分，同时保留原有星历、同角分、日距及得助受损的核验。此盘金星入本垣，又与土星互入擢升座。算入这项四分后，保守净值由第十宫的二十四分降至二十三分，仍达到第三卷具名强势原例。金星实居第十一宫但临第十二宫头时，另查第十二宫影响。分值留本地审计。 [第一卷助损表](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=135) · [第三卷强势原例](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=259)

第一卷第 33 页将最近宫头五度内的作用归该宫。第 337、338 条在跨图已同座同角分的前提下，独立按宫头重新计分，实体宫位和原计分分别保留。2024 年同一金水同角分试盘，回归金星实在第九宫、距最近第十宫头前约 3.55°，按第十宫计算的保守下限为 24 分；改地点至距宫头约 5.71°，继续保留候选。2028 年同一月亮回归，出生月亮实在第十一宫、距最近第十二宫头前约 3.30°，按第十二宫计算两套净值上限均为 −4 分；改变出生地角度到约 5.51° 时仍保留候选。候选容许度和其余本命强弱条件仍待核。 [第一卷宫头取法](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=53)

第 296、337、338 条使用同一最近宫头规则。第 33 页规定同时接近两道宫头时取较近的一道。极地短宫的三个实算盘中，1980 年回归土星距实居第十一宫头约 0.36°、距下一宫头约 4.75°，维持一般受助；2024 年回归金星距实居第四宫头约 0.24°、距下一宫头约 4.71°，按第四宫核得净值下限二十三；2055 年月亮回归所对照的出生月亮距第一宫头约 0.40°、距下一宫头约 4.96°，两套净值下限均为十四。改变对应用地使前方宫头成为最近宫头时，三个原实居支路均保留为候选。两道宫头等距或返照求根误差内最近宫头改变时，继续待核。 [第一卷宫头取法](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=53)

第 337 条分开核实金星在日心和远离日光的两种得助。第一卷以十七角分界定日心并明确给五分，第三卷在金星强势原例也计这项分数。返照金星与本命水星仍须同座同角分，回归误差内与太阳同座且持续在十七角分内，并满足实居角宫或第十一宫、已核本垣或擢升、顺行和净值下限。2030 年试盘回归金星离太阳约 6.66 角分，实居第四宫时保守净十七分。同一回归移至第八宫，或另一回归虽同角分但金星超过日心界限而受灼，均继续作候选。其他综合得助和跨图宽容许度仍待核。 [第一卷日心与受灼](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=133) · [第一卷助损表](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=135) · [第三卷金星命例](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=258)

第 337 条另核第三卷第 744 至 745 页的第八宫原例。返照金星与本命水星实际同座同角分，金星稳定按实居第八宫计分，并同时在本垣和无争议的己界、顺行、速度快、位于太阳落侧及同座日心。按卷三的第八宫扣四分复算，保守下限至少十六分。原例的火星和土星在金星同一侧。新支在回归求根误差内核两星始终同侧，且查过的土火困难相位为空。一般夹置继续按已有证据处理。2094 年合成盘实算达到净十六分。同一回归改地点后，金星虽实居第八宫、却按最近前方第九宫头计分，因而保留候选。2030 年第八宫对照盘缺己界，仍保留候选。 [第一卷实体夹置](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=134) · [第三卷金星计分](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=258) · [第三卷净值原判](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=259)

第 338 条确认同一实际太阳回归中，回归月亮与本命月亮处于同一星座和最近角分，且本命月亮落陷或失势、减光并与太阳同座受灼的偏弱分支。按第一卷最近宫头规则须仍以本命实居宫计分。同时把可能的界、三分、较宽木金和谐相、升交点及两颗具名吉恒星尽量计作助分，改用第三卷第八宫扣分后也须仍为负值。这个上限只判这一支，其他本命弱势和有利取法仍待核。1990 年出生算例在 2028 年核到同角分，换出生地使本命月亮移到第十宫、或落在古法移宫的五度范围内，都只保留候选。 [第一卷助损表](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=135) · [第三卷月亮回归条](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=254) · [第三卷命例](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=259)

第 338 条另确认原文的本命月亮有利支路。采用第三卷第 736 页点名的本垣夜生月亮，并同时核位于地平线上方角宫、远离下一宫头前五度、增光远日和未见已核偏难相位。1988 年出生盘的 2026 年回归验证了同座同角分的确认。 [夜生本垣](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=250) · [月亮回归有利与偏弱两支](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=254)

同一条另采用第三卷第 745 页的命例。回归月亮实际同角分，本命月亮远离太阳光束、实居宫位且未见已核土火偏难时，按两卷分别计算助损下限。未核的正分不计，降交点和大陵五未定时计最大扣分，两套口径至少净三分才走此支。上述 2026 年回归复用了同一出生黄经，改用不同出生地验过昼盘、第八宫和第四宫的确认；宫位未知或贴近下一宫头继续保留候选。 [第一卷助损表](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=135) · [第三卷原例](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=259)

第 337、338 条的净值下限纳入第一卷已核的助分。返照金星计入同图木星的精细吉相。返照金星与本命月亮也各计所属图中已经核实的升交点、轩辕十四或角宿一。交点两种算法不同意时不计助分。恒星仅有同度格而未达到同座同角分也不计。金星取实际回归根及误差两侧净值的最低值。2059 年的同角分试盘因第四宫回归金星和木星精细合相加五分，保守下限由十三分成为十八分。2055 年的同角分试盘本命月亮与两种升交点落在同一度格，下限由零分成为四分。换返照地点使金星居第八宫，或换出生时刻使月亮跨图角分错开，各自只保留候选。 [第一卷精细相位](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=126) · [第一卷助损表](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=135) · [第三卷命例](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=259)

第 296、337 条按第一卷第 115 页核同次回归的本垣互容与擢升互容。2028 年金星回归试盘，射手金星和天秤木星互入守护座。实居第十宫的金星计入互容五分后，保守下限达到十六分。同次回归改位置至第十一宫时，下限为十五，仍是候选。金水跨图同角分照常复验，第八宫具名原例继续核金星实居自己的本垣。1971 年土星回归试盘，金牛土星在第十宫顺行，和同图摩羯金星互入守护，且按角分核成三分。出生时刻后移三小时后，另一回归仍有土金互容和跨图同座近位，同图三分没有达到角分条件，仍是候选。第 338 条继续按本命月况计算互容。 [第一卷助损表](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=135) · [土星与金星回归原文](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=252)

第 338 条还保留一条减光且在日光下的明显偏弱分支。沿用返照月亮实际同座同角分及出生月亮距下一宫头超过五度的条件，太阳与本命月亮的距离须在受灼角距外、十七度内。即使计入可能助分，两卷的净值上限仍须至多负四。第三卷第 745 页以净负四断原例的土星偏弱，此处用来界定保守的已确认范围。1952 年出生、2028 年回归的试盘月亮在第十二宫，日月相距约 11.76 度，两套净值上限均为负四。同一返回时刻把出生地换到月亮实居第一宫，两套上限变为正十四。未达此范围的本命条件和跨图宽容许度继续待核。 [第一卷日光条件](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=133) · [第一卷助损表](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=135) · [第三卷原例](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=259)

本命月亮的虚弱上限计入第一卷表已核的土星、火星精细困难相位，以及按出生星历核实的五度内大陵五扣分。仅落入普通相位半径或证据未定时，不从上限扣除。2001 年回归盘用月土精细四分将两套上限从负三降到负六。同次回归若本命月亮实居第八宫，两套上限分别为负三和负五，继续保留候选。2038 年回归盘以月火精细四分将两套上限从负一降到负四，月土仅为近合，继续作背景审阅。 [第一卷精细相位](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=126) · [第一卷助损表](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=135) · [第三卷本命月况](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=254)

第 336 条条件已完整。第三卷第 734 页以星座、度和角分确定太阳回到本命真位置，第 738 页以同一位置说法描述回归木星到本命水星，并未另设星体强弱门槛。结合第一卷第 106 页的同座同度同角分定义，SQLite 核实际回归时刻以及求根误差两侧，三个样本都与重算本命水星同座同角分才匹配。已确定角分不同的对照只在本地显示，误差内跨角分保留未知。解读限于原书的学习、交流主题。 [太阳回归定义](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=248) · [木星段原文](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=252) · [同度同分](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=126)

四组成对规则在 SQLite 统一要求按已核出生时刻复算的太阳回归根。显示黄经求根或缺少该依据的旧候选既不计匹配，也不能触发本命七曜全在地平下、回归七曜全在地平上的排除条件。 [第三卷第 734 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=248)

第 338 条额外记录本命月亮的已核分项净值。第三卷命例是助力 10、受损 7，相减为 3。第八宫扣分在两卷有差异，第一卷保留扣 2 分，第三卷命例口径另扣 4 分。只有本命宫位已核实才列出后者。净值用于本地核对，综合有利或虚弱另按完整前提复核。 [第一卷第 115 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=135) · [第三卷第 744 至 745 页](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=258)

第一卷第 90–92 页分别定义反照点和对反照点，第三卷第 524 页把两类位置列为复核本命行星条件的分项。回归土星和金星查各自回归图，本命月亮只查出生图。同度格保留星名、反照位置和实际角距。吉星反照及对反照按原书分别作六合三分或刑冲类比。范围更宽时仍待核；这些分项不计入第 115 页的分数。 [第一卷反照](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=110) · [第三卷本命星证通则](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=38)

第一卷第 126 页要求传光星在接到第二指征前没有先遇到其他行星的合或相。两套半径仍筛选拟传光的首末接触。对这个已经找到的顺序，再在本图核对原时刻超出半径、但可能于相同星座关系中更早成相的第三星。1993 年出生、2012 年回归的试盘里，本命月亮在 6 月 20 日 00:42 UTC 先六合火星，后在 01:52 UTC 合太阳，因此省略了月亮把光从木星传到太阳的审计说明。第三卷三条回归本身继续按原有吉凶及位置证据判断。 [第一卷传光定义](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=131) · [原书时序条件](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=146)

第三星逆行时也核它与传光星是否先完成相位。1990 年 5 月 27 日中午的试盘，月亮已离木星合相，次日 03:59 UTC 才与金星成四分，但当日 23:47 UTC 已先与逆行土星成对分。这组星历只保留顺序反证，省略原拟传光的本地说明。若第三星精确过点和换座先后在求根误差内无法区分，也暂缓确认次序。原文的传光应用还要看相关指征和接纳。 [第一卷传光动线](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-I-copy.pdf#page=146)

`lilly_return_context` 显式转为中文，区分本命与回归、实际黄经距离与待定同度、各图昼夜及本质位置，说明两列半径和的参考身份及未知综合状态。土星、金星和月亮三条仍按各自已核条件确认。

`lilly-returns.test.mjs` 验证十二座七曜、本垣与整座擢升、六十个界与三十六个面边界、昼夜未知和水象三分、原表差异保护、真实两段回归、坏档与错星历保护、SQLite 成对查询及中文输入。真实星历样本采用 1990 年 6 月 15 日 UTC 04 时，独立三维几何构造测试角点；不代表实际用户出生地点。

已验证两列临界、黄道首尾跨界、两个历史例的现代复算，以及四条候选经真实回归年到 SQLite 的正反例。剩余同度口径、综合状态与原书中天的精细范围继续按条目核对。 [全库条件进度](CONDITION_MAPPING_PROGRESS.md)

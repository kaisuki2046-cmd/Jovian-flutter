# 莉莉福点与同一星体的相位证据

《基督教占星术》卷二 pp.143–144 以升点黄经加月亮黄经减太阳黄经，结果归入 0 至 360 度。莉莉明确对昼夜用同一公式。原书例盘的升点为狮子 23°27′，月亮处女 21°18′，太阳白羊 4°18′，福点为水瓶 10°27′，专项测试复算此数。卷三本命宫位沿用本项目已核的雷吉奥蒙塔努斯宫头前五度判断。福点主取福点所在星座的传统庙主，再按该行星自身黄经判宫。[卷二 pp.143–144](https://www.astrologiahumana.com/WilliamLilly-ChristianAstrology-BookII.pdf) · [卷三 p.552](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=66)

服务端从完整宫头、日月黄经重算福点，没有精确升点或日月黄经时不形成福点证据。单独传入福点落宫、福点主落宫或相位标记不能代替原盘。条文需要福点主入宫时，还必须确认该星的黄经。两套相位容许度分别核对。

| 原书位置 | 本批接入条件 |
| --- | --- |
| p.593、p.601，伴侣来处 | 分别核对原书男性、女性本命分支的福点第三宫。女性条文的婚姻指征群皆漂泊备选仍待核。 [p.593](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=107) · [p.601](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=115) |
| p.554，财富来源 | 福点主实居第八宫，并与上升宫主形成已确认的相位。两角色同属一星时不形成两星相位。泛称「成相」沿用现有四种射线相位证据，合相歧义保留。 [p.554](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=68) |
| p.612，原书信仰格言 | 太阳、月亮、水星或福点居三宫或九宫，逐个保留身份。吉相、凶星成相的备选只核对符合落宫要求的同一颗星。报告说明个人信仰以当事人表达为准。 [p.612](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=126) |

三条部分索引仍有七个原条件组待核。福点本身成相的四组需要确定计算点对应的专用容许度。太阳与金星善相涉及两个宫位。莉莉首列容许度要求二者距角至少 47.5°，现有原生排盘未见样例，另一表要求至少 49°，超过金星通常约 48° 的最大距日角。太阳与木星的善相已验证。女性婚姻条文另有一组仍需婚姻指征选取。 [莉莉两列容许度](https://iiif.wellcomecollection.org/image/b30338724_0141.jp2/full/1800,/0/default.jpg) · [NASA 金星最大距日角](https://history.arc.nasa.gov/hist_pdfs/nasa_sp461.pdf)

本批六条资料中三条覆盖原列备选，三条仍有部分待核。173 张原生盘提供 22 份测试样例，验证了 56 个已接入条件组的 SQLite 命中、单条解释及报告取材。财富指征计分和其他章节的福点用法仍待逐条核对。 [第 35 批编译清单](claims/integration-batch-35-20261119.json) · [原生排盘样例](claims/integration-batch-35-witnesses.json)

## 第三十八批：十宫吉曜、上升主与二宫共主

- 十宫木星、金星分别作为原书认可主题的备选，使用莉莉独立判宫。 [卷三 p.616](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=130)
- 上升主由第一宫头的实际黄经取传统庙主，再从同一颗行星的精确黄经核对是否在上升星座。十二个上升星座分别保留。 [卷三 p.620](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=134)
- 第二宫确实无星、且二宫主与福点主为同一星时，引用共同主宰的取证说明。空宫由传统七曜完整坐标证明。两颗主星各自任职的排序继续待核。 [卷三 p.563](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=77)

3 条由待映射转为可查询。11,832 张原生盘中提取 14 份样例，覆盖 15 个编译条件组。 [原生验证样例](claims/integration-batch-38-western-witnesses.json)

## 第四十二批·当用候选、落宫与漂泊

| 原书段落 | 实际匹配条件 | 条件组 |
| --- | --- | ---: |
| p.562，财富持续章首 | 传统七曜逐一核对第二宫与本质尊贵，保留每颗合格星的候选证据 | 7 |
| p.563，第二宫不利行星 | 按原列土星、火星、太阳各自的第二宫落点分为三条 | 3 |
| p.567，亲属相处 | 土星同时落第三宫和漂泊 | 1 |
| p.570，父家原句 | 太阳或第四宫主，各自同时落第十二宫和漂泊 | 8 |
| p.573，祖产原句 | 土星与实际第四宫主为两颗不同的星，两者同在第十二宫且各自漂泊 | 6 |

尊贵沿用现有莉莉 p.104 表，庙、擢升、三分主、界、面中有任一项即可证明该候选非漂泊。落宫沿用宫头前五度规则，宫主由宫头实际黄经定传统庙主。p.573 的同行按盘面同在十二宫核对。缺少实际黄经或完整宫头时，调用方给出的已判定落宫与尊贵结果无法替代缺失证据。 [p.562–563](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=76) · [p.567](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=81) · [p.570](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=84) · [p.573](https://krasiancientastrology.com/wp-content/uploads/2016/11/CA-III.pdf#page=87)

本轮新增 7 条整条索引和 25 个条件组。第二宫多星的力量排序、强弱分级，以及独立的燃烧和福点不利组合仍待核。64,390 张原生盘中选出 [23 份样例](claims/integration-batch-42-witnesses.json) 验证全部条件组。

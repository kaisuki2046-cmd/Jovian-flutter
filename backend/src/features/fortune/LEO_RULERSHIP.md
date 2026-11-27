# Leo 掌宫事实与中文模型输入

本批扩展既有 `leo_progressed_aspect` 和精确点事实，不新增投影类型。四条来源的掌宫、占宫及本命星座需分别记录；原书的本命条件、有利相位、同性质触发和实际缓和效果仍待核，四条保持部分映射。

## 来源与版本

原书为 Alan Leo《The Progressed Horoscope》1906年版。已逐页目视核对原版扫描，资料 ID 的 p 编号是资料序号，不能作为书页定位。

| 资料序号 | 内容 | 原版PDF页 | 印刷页 |
| --- | --- | ---: | ---: |
| p048 | 火星半六合本命海王星 | 196 | 186 |
| p066 | 火星平行本命土星 | 187 | 177 |
| p105 | 水星对分本命海王星 | 166 | 156 |
| p300 | 金星梅花本命木星 | 173 | 163 |

原版扫描：[1906年原版](https://iapsop.com/ssoc/1906__leo___the_progressed_horoscope.pdf)。辅助表来自同作者 [How to Judge a Nativity，1928年第四版PDF第51页、印刷第27页](https://archive.org/download/howtojudgenativi00leoa/howtojudgenativi00leoa.pdf#page=51)，并未证明它与1906年原书的表完全相同。版本边界保留在事实和中文输入中。

辅助表沿黄道十二座的宫主依次为火星、金星、水星、月亮、太阳、水星、金星、火星、木星、土星、土星、木星；该表未给天王星与海王星分配守护星座。脚注未量化的替代关系不执行，也不引入现代守护关系。

## 计算与未知

`control/leo-rulership.ts` 从同一本命的实际 Placidus 宫头星座确定掌宫，复用既有上升十分度的同源宫主表。行星占宫、按宫序对应的自然星座与实际掌宫分开；不能把火星写死为掌第一宫或用其落宫代掌宫。

- 完整宫头环可用且没有宫头落入某颗已分配守护星的星座：记录已计算的零个掌宫。
- 角点或宫头不可用：掌宫未知，不以空数组表示零个。
- 辅助表未分配天王星、海王星：标注该版本未分配，不视为已计算零个。

双方落在对方守护星座时记录互守坐标，作为 p066 的一类已核缓和证据。火土实际平行带内也独立确认同一本命星对的六合、三分，及原书相位表列为较弱偏顺的半六合。1945 年出生的试盘在 2026 年的同一片段同时实见偏难月相，因此半六合的较弱缓和与月相引动分别保留。原文互相处置是否包括其他尊贵，以及实际制衡程度仍待核。 [Leo 与 Green 的本命相位表](https://benebellwen.com/wp-content/uploads/2014/06/alan-leo-the-horoscope-in-detail.pdf) · [火土平行原文](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=192)

两层已核月相均无偏顺或待分类接触，且月亮对同一本命土星或同图次限火星的偏难方向实际成相时，p066 可独立确认该秒的月相引动。核验只用火土实际平行带内的成相点，邻秒与混合月相仍留候选，原局缓和分支分别确认。 [火土平行与月相引动](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=193)

月亮篇另写到月火、月土赤纬平行的持续作用。第 588 条在同一火土平行带内核月亮与实际对应端点的一度绝对赤纬差。只有本命和同图两层已核月相均无偏顺或待分类接触，才确认两段平行交集可参考原文所述偏难引动。1968 年出生试盘在 2014 年 7 月 16 日至 18 日于本命土星和同图次限火星均核到相交，未有赤纬等值真点。两端仍有月相但夹着尚未分类的月天平行，留作候选。本命互入的缓和仍单独列出。 [原书一度标准](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=56) · [月火平行](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=130) · [月土平行](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=137)

SQLite 按实际宫头查询 p105 的水星掌宫，实掌任意宫位时按原书细分领域，完成计算且零个宫头由水星掌管时保留一般人物线索。p300 查金星和木星合计掌第五及第四或第八宫的子条件。两条仍为部分映射。 [水星掌宫](LEO_SOURCE_CONTEXT.md#水星掌宫与土星同期月亮) · [金星和木星掌宫](LEO_SOURCE_CONTEXT.md#日月证据与实际掌宫)

### 次限行星的实际占座

p048 火星半六合本命海王星及 p300 金星梅花相本命木星，分别计算移动天体的次限黄经与目标天体的固定本命黄经。活跃相位跨星座时按实际换座切成前闭后开的片段，同一相位保留一个主信号及原精确点。逆行出入分别计时，仅接触座界的瞬间不拆段。 [火星半六合海王星](https://iapsop.com/ssoc/1906__leo___the_progressed_horoscope.pdf#page=196) · [金星梅花相木星](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=179)

两条 SQLite 查询都要求同一片段有实际占座及完整本命 Placidus 宫头；p300 另保留对应的第四或第八宫与第五宫组合。辅助表只给可确认的星体登记掌宫，p048 的海王星继续标为未分配。原文未指定哪些星座会改变领域或轻重，两条仍为部分映射。 [Leo 关于本命与次限宫主的说明](https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=204)

## 发给模型的内容

`control/fortune-prompt.mjs` 将嵌套掌宫记录转换为中文。例如：

> 火星的本命星座为摩羯座，按辅助表该星座的宫主为土星；按本命真实Placidus宫头，该星掌第五宫和第十宫。掌宫与该星实际占宫不同。

示例只说明表达格式，实际请求使用计算出的宫头、星座、黄经及未知状态。内部 profile、数组、布尔字段与完整原始盘面留在本地；不使用整段 JSON 或未知事实的 JSON 兜底。命中资料只发送命中条件、原文、现代释义；事实编号、共同有效时间归入命中条件，必要事实未能转换时不发送对应资料。部分映射的原文不发成完整命中。

## 验证与状态

`leo-rulership.test.mjs` 覆盖宫主表、跨零宫头环、占宫区别、零/未知/未分配、无效输入、互守的反例、真实星历与本命宫头、缺失角点、SQLite四条规则，以及实际HTTP消息的中文和三字段过滤。`leo-source-context.test.mjs` 覆盖逆行跨零往返、实际出生时地的火星与金星换座、JSON 提交至 SQLite，以及仅出生地改变导致的掌宫排除。参考页、原始PDF哈希和具名条件在 `model/fixtures/leo-rulership-reference.json`；PDF与渲染页留在忽略目录。

次限占座使用事实层 v1.242、西方规则 v69、中文转换 v243。当前全库覆盖见 [条件映射进度](CONDITION_MAPPING_PROGRESS.md#当前覆盖)。

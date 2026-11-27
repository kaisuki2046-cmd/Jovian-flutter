// Interpretive glosses for this app, based on the references accompanying its three methods.
const references = {
  tarot: 'https://en.wikisource.org/wiki/The_Pictorial_Key_to_the_Tarot/Part_3',
  liuyao: 'https://zh.wikisource.org/wiki/增刪卜易/3',
  meihua: 'https://zh.wikisource.org/wiki/梅花易數/卷一',
};

const bodyUse = {
  '体用比和': '体卦与用卦同属一行，可从容易协调的条件着手。',
  '体生用': '推动事情需要自身投入，先想清时间、精力或资源从哪里来。',
  '体克用': '自身有可以主动调整的空间，适合从可控的一步开始。',
  '用克体': '外部要求可能限制行动，可以先核实最容易卡住的一项条件。',
  '用生体': '可利用已经明确的外部支持，把帮助落实成具体安排。',
};

/**
 * Select entries that apply to the actual reading.
 * @param {{ reversed: boolean, moving: boolean, relations: readonly string[] }} context
 */
export function selectReadingTerms({ reversed, moving, relations }) {
  const terms = [
    { term: '牌位', plain: '现状描述眼下处境，需要留意提示判断条件，下一步提示可以尝试的行动。', source: references.tarot },
    { term: '本卦', plain: '按本次记录排出的原始卦象，用作观察当前情境的线索。', source: references.liuyao },
    { term: '世应', plain: '世爻常用来观察问事者，应爻常用来观察对方或外部条件。', source: references.liuyao },
    { term: '六亲', plain: '排盘用父母、兄弟、子孙、妻财和官鬼来表示卦中各爻的关系。结合具体问题，可以用来观察资料、同辈、产出、资源或责任等线索。', source: references.liuyao },
    { term: '互卦', plain: '取本卦中间的四个爻重新组合，用来观察事情发展的中间环节。', source: references.meihua },
    { term: '体卦和用卦', plain: '不动的一组作体，观察自身。含动爻的一组作用，观察所问事情或外部条件。', source: references.meihua },
  ];
  if (reversed) {
    terms.push({ term: '逆位', plain: '牌图倒转时查阅对应的逆位牌义，具体解释还要结合所在牌位。', source: references.tarot });
  }
  if (moving) {
    terms.push({ term: '动爻和变卦', plain: '老阴和老阳会转成另一种阴阳，翻转这些爻后得到变卦。', source: references.liuyao });
  } else {
    terms.push({ term: '静卦', plain: '六爻都没有发生阴阳变化，六爻解读从本卦的现状着手。', source: references.liuyao });
  }
  for (const relation of new Set(relations)) {
    const plain = /** @type {Record<string, string>} */ (bodyUse)[relation];
    if (plain) terms.push({ term: relation, plain, source: references.meihua });
  }
  return terms;
}

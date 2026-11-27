const phrases = [
  ['腰金衣紫', '得到较高的官位或社会地位'],
  ['金冠封赠', '获得朝廷的授衔或封赏'],
  ['早擢登科', '较早取得科举功名'],
  ['金榜题名', '取得科举功名'],
  ['荣华富贵', '生活富足并获得社会地位'],
  ['荣华', '生活富足或有社会地位'],
  ['富贵', '经济富足或获得社会地位'],
  ['科甲', '通过科举取得功名'],
  ['仕路', '做官的途径'],
  ['仕宦', '担任官职'],
  ['祖业', '家族留下的产业'],
  ['白手成家', '主要依靠自己的积累建立家业'],
  ['口舌是非', '言语争执或人际纠纷'],
  ['衣禄', '生活所需的收入和资源'],
  ['福禄', '生活条件和所得'],
  ['孤贫', '支持较少，经济条件也较紧'],
  ['清贵', '取得地位或名望'],
  ['封赠', '获得授衔或封赏'],
  ['不贫不富', '经济处于普通水平'],
  ['一生不闲', '长期处于忙碌状态'],
  ['横破横成', '得失变化突然，成败反复'],
  ['到老穷', '到晚年仍可能经历经济紧张'],
  ['主富', '古书认为较容易积累财富'],
  ['夭折', '古书所说的早逝'],
  ['刑克', '传统术语所说的冲突或牵制'],
  ['三方四正', '本宫及与它相对、三合的宫位'],
  ['庙旺之地', '星曜力量得到支持的位置'],
  ['生旺之地', '相应五行力量受到支持的位置'],
  ['衰地绝乡', '原书所称力量衰弱的位置'],
  ['同宫', '落在同一个宫位'],
  ['坐守', '落在该宫位'],
  ['合值', '正好遇到'],
  ['独坐', '单独落在'],
  ['犯冲', '出现冲的关系'],
  ['得地', '在相应位置得到支持'],
  ['其人', '这样的人'],
  ['之人', '的人'],
  ['谓之', '原书称为'],
  ['倘若', '如果'],
];

const characters = new Map((
  '財财 貴贵 壽寿 權权 剋克 殺杀 會会 見见 長长 臨临 廟庙 宮宫 祿禄 應应 憂忧 慮虑 禍祸 貧贫 ' +
  '離离 難难 險险 無无 為为 爲为 於于 則则 與与 須须 兩两 並并 屬属 氣气 勢势 過过 時时 歲岁 ' +
  '運运 陽阳 陰阴 親亲 眾众 個个 後后 輔辅 顯显 隱隐 從从 專专 傷伤 強强 諸诸 說说 處处 國国 ' +
  '經经 營营 業业 聲声 譽誉 學学 書书 門门 獨独 連连 遷迁 變变 別别 東东 錢钱 萬万 婦妇 兒儿 ' +
  '總总 聰聪 順顺 實实 現现 體体 終终 達达 職职 賤贱 禮礼 孫孙 緣缘 貼贴 關关 帶带 發发 虛虚 ' +
  '環环 儉俭 饒饶 廚厨 樂乐 惡恶 響响 簡简 濕湿 斷断 盡尽 鋭锐 銳锐 衝冲 貪贪 勞劳 資资 ' +
  '麗丽 詞词 誕诞 檢检 單单 絕绝 鄉乡 壯壮 賽赛 擇择 繼继 貨货 競竞 復复 餘余 髮发 昇升 ' +
  '錦锦 獲获 斂敛 嫻娴 嬰婴 憤愤 恆恒 曆历 雙双 義义 歸归 懼惧 罷罢 脈脉 ' +
  '療疗 躋跻 擾扰 亂乱 濁浊 綱纲 統统 濟济 聞闻 遠远 還还 來来 毆殴'
).split(' ').map(pair => [...pair]));

const text = value => typeof value === 'string' ? value.trim() : '';
const comparable = value => text(value).replace(/[\s。！？；，、.!?;]+$/u, '');
const simplified = value => [...text(value)].map(character => characters.get(character) ?? character).join('');
const quotationKey = value => simplified(value).normalize('NFKC').replace(/[\p{P}\p{Z}\p{Cf}\s]/gu, '');
const quotationIntro = /^(?:按(?:这段|本段)原文|这段原文的意思是|原文(?:记载|写道)|所附条文在其编号及性别、年龄语境下记述|十四表CSV版的断语为|所供盲派技能包的口诀表述为)[：:，,。\s]+/u;

export function cleanModernInterpretation(original, reading) {
  const passage = text(original);
  const meaning = text(reading);
  const framed = quotationIntro.test(meaning);
  const plain = meaning.replace(quotationIntro, '').trim();
  if (!passage) return plain || null;
  const body = framed ? plain.replace(/。相关盘面包括.*$/su, '。') : plain;
  if (!body || quotationKey(passage) === quotationKey(body)) return null;

  // Remove a full leading quotation while retaining any separate explanation.
  for (const [left, right] of [['“', '”'], ['「', '」'], ['『', '』']]) {
    if (!body.startsWith(left)) continue;
    const end = body.indexOf(right);
    if (end !== -1 && quotationKey(body.slice(1, end)) === quotationKey(passage)) {
      return body.slice(end + right.length).replace(/^[：:，,。\s]+/u, '').trim() || null;
    }
  }
  if (framed && passage.length >= 6 && body.startsWith(passage) && /[。！？.!?]$/u.test(passage)) {
    return body.slice(passage.length).trim() || null;
  }
  return body;
}

export function claimEvidence(claim, originalText = claim.evidence.original_text) {
  return { source: claim.source, originalText, modernInterpretation: claim.interpretation.classical_meaning };
}

export function legacyEvidence(rule) {
  const quote = text(rule.source?.excerpt);
  return { source: rule.source, originalText: quote || rule.basis, modernInterpretation: rule.reading,
    ...(!quote && { originalKind: 'rule_basis' }) };
}

function modernizePassage(original) {
  let plain = simplified(original);
  for (const [classical, modern] of phrases) plain = plain.replaceAll(classical, modern);
  return comparable(plain)
    .replace(/(^|[，、；。])(?:但若|若|如)(?=[\u4e00-\u9fff])/gu, '$1如果')
    .replace(/(^|[，、；。])虽(?!然)/gu, '$1虽然')
    .replace(/(^|[，、；。])主(?=[贫穷富足疾病口舌破财失财好坏离别])/gu, '$1原书认为较容易遇到')
    .replace(/(?<![准原法规细通总])则(?=[\u4e00-\u9fff])/gu, '就')
    .replace(/有根/gu, '有地支藏干支持')
    .replace(/明透|高透|实透|出干/gu, '明确出现在天干上');
}

export function branchInterpretation(claim, branch, reviewed) {
  const original = text(branch.text);
  if (!original) throw new Error('Missing original passage: ' + claim?.id);
  const withOrigin = (meaning, origin) => {
    const modernInterpretation = cleanModernInterpretation(original, meaning);
    return { modernInterpretation, interpretationOrigin: modernInterpretation ? origin : 'untranslated' };
  };
  if (text(reviewed)) return withOrigin(reviewed, 'reviewed');
  if (comparable(original) === comparable(claim?.evidence?.original_text)) {
    return withOrigin(claim.interpretation.classical_meaning, 'source');
  }
  // Partial excerpts use their own wording and conditions. The parent summary
  // can describe additional judgments whose conditions have not been met.
  const meaning = modernizePassage(original);
  return withOrigin(`${meaning}。`, 'derived');
}

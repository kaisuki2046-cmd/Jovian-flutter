import 'package:jovian_divination/jovian_divination.dart';

import 'follow_up_model.dart';

const _waite =
    'https://en.wikisource.org/wiki/The_Pictorial_Key_to_the_Tarot/Part_3';
const _liuYaoSource = 'https://zh.wikisource.org/wiki/增刪卜易/3';
const _meihuaSource = 'https://zh.wikisource.org/wiki/梅花易數/卷一';
const _purpose = [
  '这张牌用于回看用户所描述的现状和处境。把牌义当作观察角度。',
  '这张牌用于指出最值得核实的条件、取舍或阻力。',
  '这张牌用于提出一个用户能自主选择、可以验证的小动作。',
];

String _cardEvidenceId(TarotDrawnCard card) =>
    '${card.position.id}:${card.face.card.id}:${card.face.orientation.name}';

List<Map<String, Object>> tarotDocuments(TarotDraw draw) => [
  for (final card in draw.cards)
    {
      'id': _cardEvidenceId(card),
      'cardId': card.face.card.id,
      'position': card.position.id,
      'orientation': card.face.orientation.name,
      'name': card.face.card.name,
      'traditional': card.face.traditionalMeaning,
      'plain': card.face.plainMeaning,
      'direction': card.face.meaningDirection.name,
      'source': _waite,
      'label': card.position.label,
      'purpose': _purpose[card.position.index],
    },
];

List<GuideEvidence> chartEvidence(GuideChart chart) => [
  ...tarotEvidence(tarotDocuments(chart.tarot)),
  ...liuyaoEvidence(chart.liuyao.base),
  ...meihuaEvidence(chart.meihua),
];

List<GuideEvidence> tarotEvidence(Iterable<Map> documents) => [
  for (final card in documents)
    GuideEvidence(
      id: card['id'] as String,
      label:
          '${card['label']} · ${card['name']} · '
          '${card['orientation'] == 'upright' ? '正位' : '逆位'}',
      plain: card['plain'] as String,
      source: card['source'] as String,
    ),
];

List<GuideEvidence> liuyaoEvidence(LiuYaoReading liuyao) {
  final shi = liuyao.lines[liuyao.shi - 1];
  final ying = liuyao.lines[liuyao.ying - 1];
  return [
    GuideEvidence(
      id: 'liuyao:v1:shi-ying',
      label: '世应与六亲',
      plain:
          '世爻在第 ${liuyao.shi} 爻（${shi.relative}），应爻在第 ${liuyao.ying} 爻（${ying.relative}）。'
          '可分别回看自己能做的事和仍需向外确认的条件。',
      source: _liuYaoSource,
    ),
    GuideEvidence(
      id: liuyao.moving.isEmpty ? 'liuyao:v1:still' : 'liuyao:v1:moving',
      label: liuyao.moving.isEmpty ? '静卦' : '本卦与动爻',
      plain: liuyao.interpretation,
      source: 'https://zh.wikisource.org/wiki/增刪卜易/2',
    ),
  ];
}

List<GuideEvidence> meihuaEvidence(MeihuaReading meihua) {
  final nuclearBasis =
      meihua.primary.pattern == 63 || meihua.primary.pattern == 0 ? '变卦' : '本卦';
  return [
    GuideEvidence(
      id: 'meihua:v1:body-use',
      label: '体用与五行',
      plain:
          '体卦为${meihua.body.name}${meihua.body.element}，用卦为${meihua.use.name}${meihua.use.element}。'
          '${meihua.interpretation}',
      source: _meihuaSource,
    ),
    GuideEvidence(
      id: 'meihua:v1:nuclear',
      label: '本卦、互卦与变卦',
      plain:
          '${meihua.primary.name}第 ${meihua.moving} 爻动，变为${meihua.changed.name}。'
          '用$nuclearBasis中间四爻排得互卦${meihua.nuclear.name}。',
      source: _meihuaSource,
    ),
  ];
}

import { createHash } from 'node:crypto';
import { normalizeRuleInput } from './matching.mjs';

export const jielanGusuiProfile = 'jielan-gusui-natal-passages-v1';
const prefix = 'ziwei-v3-jielan-123-p001-';
const life = '命宫';
const bodySeats = ['夫妻', '财帛', '迁移', '官禄', '福德'];
const benefics = ['左辅', '右弼', '文昌', '文曲', '天魁', '天钺'];
const malefics = ['擎羊', '陀罗', '火星', '铃星', '地空', '地劫'];
const stars = (palace, ...names) => names.map(star => ({ kind: 'palace_star', palace, star, scope: 'origin' }));
const place = (palace, branch) => ({ kind: 'palace_branch', palace, branch });
const born = stem => ({ kind: 'natal_year_stem', stem });
const relation = (target, relation) => ({ kind: 'palace_relation', anchor: life, target, relation });
const changeAt = (palace, change) => ({ kind: 'palace_mutagen', palace, change, scope: 'origin' });
const bright = (palace, star, brightness) => ({ kind: 'palace_brightness', palace, star, scope: 'origin', brightness });
const fallen = (palace, star) => bright(palace, star, '陷');
const lifeBranch = (branches, required) => [...branches].map(branch => [...required, place(life, branch)]);
const noLifeMalefics = malefics.map(star => ({ kind: 'palace_sector_star', palace: life, star }));
const lifeTrines = [relation('官禄', 'trine'), relation('财帛', 'trine')];
const externalLifePalaces = ['财帛', '官禄', '迁移'];
const lifeSectors = [...lifeTrines, relation('迁移', 'opposite')];
const sectorStar = (palace, star) => ({ kind: 'palace_sector_star', palace, star });
const trineStar = (palace, star) => ({ kind: 'palace_trine_star', palace, star });
const bodySeat = palace => ({ kind: 'palace_confirmed_body_seat', palace });
const link = (anchor, target, relation) => ({ kind: 'palace_relation', anchor, target, relation });
const bothLu = (first, second) => [[...stars(first, '禄存'), changeAt(second, '禄')],
  [changeAt(first, '禄'), ...stars(second, '禄存')]];
const samePalaceMalefic = malefics.map(star => stars(life, star));
const lifeOrBody = factsAt => [factsAt(life), ...bodySeats.map(palace =>
  [...factsAt(palace), { kind: 'palace_confirmed_body_seat', palace }])];
const trineOrOppositeAuspicious = ['财帛', '官禄', '迁移'].flatMap(palace => [...'禄权科'].map(change => [
  { kind: 'palace_mutagen', palace, change, scope: 'origin' },
  relation(palace, palace === '迁移' ? 'opposite' : 'trine'),
]));
const trineAuspicious = trineOrOppositeAuspicious.filter(([, evidence]) => evidence.relation === 'trine');
const trineBenefics = benefics.map(star => [trineStar(life, star)]);
const fourMalefics = malefics.slice(0, 4);
const luQuanInTemple = (palace, requireBody = false) => ({
  required: [...['禄', '权'].map(change => ({ kind: 'palace_mutagen_brightness', palace, change, brightness: '庙' })),
    ...(requireBody ? [bodySeat(palace)] : [])],
  anyOf: [2, 3, 4, 5, 6].flatMap(beneficCount => Array.from({ length: beneficCount }, (_, maleficCount) => [
    { kind: 'palace_sector_benefic_count', palace, count: beneficCount },
    { kind: 'palace_sector_six_malefic_count', palace, count: maleficCount },
  ])),
});
const luQuanPassages = [{
  text: '出世荣华，权禄守身命之地。此二星身命值之，入庙吉多，定主富贵',
  cases: () => [luQuanInTemple(life), ...['夫妻', '福德'].map(palace => luQuanInTemple(palace, true))],
}, {
  text: '如财帛福德宫值之，亦然。',
  cases: () => ['财帛', '福德'].map(palace => luQuanInTemple(palace)),
}];
const nativeBranches = '子丑寅卯辰巳午未申酉戌亥';
const pairedTriadStars = (triad, [first, backward], [second, forward]) => triad.flatMap((own, start) =>
  triad.map((other, offset) => [...stars(own, first), ...stars(triad[(start + 1) % 3], backward),
    ...stars(other, second), ...stars(triad[(offset + 2) % 3], forward)]));
const kuiYueFlanking = {
  text: '如丙丁壬癸生人，在辰戌安命，魁钺加夹',
  required: [['丙戌', '天魁', '天钺'], ['丁戌', '天魁', '天钺'], ['壬辰', '天钺', '天魁'], ['癸辰', '天钺', '天魁']]
    .map(([[stem, seat], parents, siblings]) => [born(stem), place(life, seat), ...stars('父母', parents), ...stars('兄弟', siblings),
      relation('父母', 'adjacent'), relation('兄弟', 'adjacent')]),
};
const chartPalaces = palaceSectors => palaceSectors(life, Array.from({ length: 12 }, (_, index) => index));
const fallenMutagen = (palace, change) => ({ kind: 'palace_mutagen_brightness', palace, change, brightness: '陷' });
const travellingTanlang = {
  text: '如加杀陷地，则男主飘荡',
  required: lifeBranch('巳亥', [...stars(life, '贪狼'), fallen(life, '贪狼'), { kind: 'natal_gender', gender: '男' }]),
  anyOf: fourMalefics.map(star => stars(life, star)),
};
const flankingSunMoon = {
  text: '如太阳太阴在身命前后二宫夹，命不逢空劫羊铃，其贵必矣。',
  flanking: ['太阳', '太阴'], allowBody: true,
  mustBeAbsent: stars(life, '地空', '地劫', '擎羊', '铃星'),
};
const fallenLianzhenWithoutBenefics = {
  cases: palaceSectors => [life, ...bodySeats.filter(palace => palace !== '迁移')].map(anchor => {
    const near = palaceSectors(anchor, [-4, 4, -1, 1]);
    return {
      required: [...stars(anchor, '廉贞'), fallen(anchor, '廉贞'), ...(anchor === life ? [] : [bodySeat(anchor)]),
        ...near.map((target, index) => link(anchor, target, index < 2 ? 'trine' : 'adjacent'))],
      mustBeAbsent: near.flatMap(palace => stars(palace, ...benefics)),
      anyOf: [...'巳亥'].map(branch => [place(anchor, branch)]),
    };
  }),
};

export const jielanGusuiRepeatedPassages = new Map([
  [prefix + '090', { id: prefix + '001', text: kuiYueFlanking.text }],
  [prefix + '092', { id: prefix + '003', text: flankingSunMoon.text }],
  [prefix + '099', { id: prefix + '007' }],
  [prefix + '102', { id: prefix + '010' }],
  [prefix + '133', { id: prefix + '084', text: travellingTanlang.text }],
]);

const reviewed = new Map([
  ['001', { hash: '2afeb0962922a7991e9bc38900b01c566c234c8385288a23485c1f05dec91fa6', passages: [kuiYueFlanking] }],
  ['003', { hash: '9b692f8634142a41a6fbf6c1ca04be99dab3a24a3d5cc9837e193b7d55291262', passages: [flankingSunMoon, {
    text: '如昌曲夹命，亦如之。',
    // The other orientation always places Dikong in the flanked life palace.
    required: [[...stars('父母', '文昌'), ...stars('兄弟', '文曲'),
      relation('父母', 'adjacent'), relation('兄弟', 'adjacent')]],
    mustBeAbsent: stars(life, '地空', '地劫', '擎羊', '铃星'),
  }] }],
  ['011', { hash: '40dccb08fde8cfcd232b054ce226c5cbf884e4a998716666a84780a219f8238e', passages: [{
    required: lifeBranch('丑未', stars(life, '武曲', '贪狼')),
  }] }],
  ['012', { hash: 'eb8d443ef8160842d4abd5361f197516e3a8dab1d1ec5219f5f2fb25c28979e0', passages: [{
    text: '如左右二星坐命，不拘星多星少，亦主宽厚。',
    required: [stars(life, '左辅', '右弼')],
  }] }],
  ['019', { hash: '4443812fbced96131157123e9b00981127607aa23ffd99f1b55d3b3545032734', passages: [{
    text: '紫微居午无杀凑，位至公卿',
    required: [[...stars(life, '紫微'), place(life, '午')]], mustBeAbsent: noLifeMalefics,
  }, {
    text: '如甲丁己生人，安命午宫，值之入格，主大贵',
    required: [...'甲丁己'].map(stem => [...stars(life, '紫微'), place(life, '午'), born(stem)]),
    mustBeAbsent: noLifeMalefics,
  }] }],
  ['036', { hash: '508d482d7054e13fb269074c2b08bb2639d6bf640454b5517b8edcdabad7a230', passages: [{
    text: '天梁天马陷，飘荡无疑，巳亥申宫安命，值天梁失陷，而天马同宫',
    required: lifeBranch('巳亥申', [...stars(life, '天梁', '天马'),
      { kind: 'palace_brightness', palace: life, star: '天梁', scope: 'origin', brightness: '陷' }]),
  }] }],
  ['048', { hash: '97a369f40c21e6eea5bdf318d70ec4172e9bf007833bc1180dd00d0f9afb0915', passages: [{
    text: '命宫遇地劫坐守，作平常论，亦不住财',
    required: [stars(life, '地劫')],
  }] }],
  ['054', { hash: 'a9959529e0eb0415d12ff1e6d76717f7cd55649496fa3dbc911069b075434976', passages: [{
    required: lifeBranch('卯酉', stars(life, '廉贞')),
    anyOf: malefics.map(star => stars(life, star)),
  }] }],
  ['055', { hash: 'ce6e014e845d2c8e556806773dce8382624deb3101024104185e8ec22cb646ec', passages: [{
    required: lifeBranch('辰戌', stars(life, '左辅', '天府')),
    anyOf: trineOrOppositeAuspicious,
  }] }],
  ['109', { hash: '9efcb665e2f626582be75c2e97d11a77dceb85cf866b04246b4c26c988312501', passages: [{
    text: '如寅安命，午戌紫府来朝，申安命，子辰紫府来朝，是为人君访臣之象，奇格也。',
    required: [['寅', '午', '戌'], ['申', '子', '辰']].map(([lifeSeat, careerSeat, wealthSeat]) =>
      [place(life, lifeSeat), place('官禄', careerSeat), place('财帛', wealthSeat), ...lifeTrines]),
    anyOf: [['紫微', '天府'], ['天府', '紫微']].map(([career, wealth]) =>
      [...stars('官禄', career), ...stars('财帛', wealth)]),
  }] }],
  ['009', { hash: '33ed97ed1fa5f84eaa39cdd0b4be7b3bf68b5d1c0a1c095e3cac74117bad4d26', passages: [{
    text: '生来贫贱，劫空临财福之乡，此二星财帛福德二宫值之是也',
    required: ['财帛', '福德'].map(palace => stars(palace, '地空', '地劫')),
  }, {
    text: '如身命值之亦然。',
    // Dikong and Dijie coincide only at Zi and Wu hours, when life and body coincide.
    required: [stars(life, '地空', '地劫')],
  }] }],
  ['043', { hash: 'f427dca006ef7a31968eb97b18c304e10a341c04cc5887a786f605539e304dca', passages: [{
    text: '李广不侯，羊刃逢于力士，二星守命',
    required: [[...stars(life, '擎羊'), { kind: 'palace_boshi_star', palace: life, star: '力士' },
      { kind: 'natal_gender', gender: '男' }]],
  }] }],
  ['051', { hash: 'b8c0810e0f9f5e26b41883dac48222c7b3d240b66cd6bf9b6bf87cd0bbbfc38a', passages: [{
    required: lifeBranch('寅申巳亥', [...stars(life, '天马'), { kind: 'natal_gender', gender: '女' },
      { kind: 'palace_trine_star', palace: life, star: '天梁' }]),
  }] }],
  ['062', { hash: '5063ef7d607b03552b7163a57088f74718741773367a1dced71c53807f3eaee9', passages: [{
    text: '合禄拱禄，定为巨擘之臣。禄存与化禄在财官二宫合命',
    required: [lifeTrines], anyOf: bothLu('财帛', '官禄'),
  }, {
    text: '命坐禄，而迁移有禄对拱，皆主富贵。',
    required: [[relation('迁移', 'opposite')]], anyOf: bothLu(life, '迁移'),
  }] }],
  ['065', { hash: '4074636cdb05f6d5b3c07c32ffa951e76bdbe32a4afc680b872a205d46028f89', passages: [{
    text: '武曲巳亥守命加杀者，手艺安身',
    required: lifeBranch('巳亥', stars(life, '武曲')), anyOf: samePalaceMalefic,
  }, {
    text: '贪狼巳亥守命加杀者，必作屠牛宰马之人。',
    required: lifeBranch('巳亥', stars(life, '贪狼')), anyOf: samePalaceMalefic,
  }] }],
  ['070', { hash: '6a504f9a7d02adff2e0c11a4d8735eeb6afd3e3c04f007758ffa1ae6acb4e5ac', passages: [{
    required: [['子', '辰', '申'], ['午', '戌', '寅']].map(([seat, career, wealth]) =>
      [place(life, seat), ...stars(life, '巨门'), place('官禄', career), place('财帛', wealth), ...lifeTrines]),
    anyOf: [[changeAt('财帛', '科'), changeAt('官禄', '权')], [changeAt('财帛', '权'), changeAt('官禄', '科')]],
  }] }],
  ['104', { hash: '6af473c6928c05548e25eb128008d463fabb9be833279ed998596da652192abf', passages: [{
    text: '文曲文昌，为人多学多能',
    required: lifeBranch('丑未', stars(life, '文昌', '文曲')),
  }] }],
  ['105', { hash: 'e765b8d2dbfd69c182a1cb2eeaaebcf77c97a82436616e6a1eafed371e188596', passages: [{
    required: lifeBranch('未', stars(life, '文昌', '文曲')), anyOf: samePalaceMalefic,
  }] }],
  ['107', { hash: 'c290960ad79e198381e5e88b2f7f48b8cf842f412eda69d9f7837ed2a0494bf1', passages: [{
    text: '科权禄拱，文誉昭彰，此为三化，如身命坐守一化，财帛宫官禄宫二化来合，是为三合守照，谓之科权禄拱是也',
    required: [lifeTrines],
    anyOf: ['科权禄', '科禄权', '权科禄', '权禄科', '禄科权', '禄权科'].map(([lifeChange, wealthChange, careerChange]) =>
      [changeAt(life, lifeChange), changeAt('财帛', wealthChange), changeAt('官禄', careerChange)]),
  }] }],
  ['120', { hash: 'e67514dd5a51e63cd769b54acc99fecd6a1906246672721bab38f48ac28eebe2', passages: [{
    text: '羊刃在午守命，卯次之，酉又次之，为羊落陷地是也。',
    required: lifeBranch('午卯酉', [...stars(life, '擎羊'), fallen(life, '擎羊')]),
  }, {
    text: '寅申巳亥四宫，陀罗守命亦然',
    required: lifeBranch('寅申巳亥', [...stars(life, '陀罗'), fallen(life, '陀罗')]),
  }] }],
  ['123', { hash: '7f1c336b5765139ec25f5b21245fa407b77d34f132eb5f5a377d0cb966ebe05d', passages: [{
    required: lifeBranch('巳亥', [...stars(life, '贪狼', '廉贞'), changeAt(life, '忌')]), anyOf: samePalaceMalefic,
  }] }],
  ['128', { hash: 'd50c518524528cdc335fa11fb17dbbc90de06661e36e2e168d142a31cab47a81', passages: [{
    text: '况巨门本非吉曜，若陷地化此，何吉之有？',
    required: lifeOrBody(palace => [...stars(palace, '巨门'), fallen(palace, '巨门'),
      { kind: 'star_mutagen', palace, star: '巨门', change: '忌', scope: 'origin' }]),
  }] }],
  ['020', { hash: '7e39ddf08fed8bda9e6d40d7fad949316ab7041015ed06bf8c85a09ae191fdb5', passages: [{
    text: '天府临戌有星扶，腰金衣紫。如甲己生人，安命戌宫值之依此断',
    required: [...'甲己'].map(stem => [...stars(life, '天府'), place(life, '戌'), born(stem)]),
    mustBeAbsent: noLifeMalefics,
    anyOf: [...['天魁', '天钺', '左辅', '右弼', '禄存'].map(star => [sectorStar(life, star)]),
      ...[life, ...externalLifePalaces].flatMap(palace => [...'禄科'].map(change => [changeAt(palace, change)]))],
  }] }],
  ['024', { hash: '9e8ae8eff053d70aae641d95279858699a7c803e878a30566f9ef084212de9b8', passages: [{
    text: '贪铃并守，将相之名。如辰戌丑未子宫安命值之，是为入庙，依此断。',
    required: lifeBranch('辰戌丑未子', stars(life, '贪狼', '铃星')),
  }] }],
  ['025', { hash: '1cfe43ca42a8ce6540d54f02cc44c7687bf9740dcf314fd9e97a46dad420d59f', passages: [{
    cases: palaceSectors => [life, ...bodySeats].map(anchor => {
      const [opposite, ...trines] = palaceSectors(anchor, [6, -4, 4]);
      const externalChanges = [opposite, ...trines].flatMap(palace => [...'禄权科'].map(change =>
        [changeAt(palace, change), link(anchor, palace, palace === opposite ? 'opposite' : 'trine')]));
      return {
        required: [link(anchor, opposite, 'opposite'), ...(anchor === life ? [] : [bodySeat(anchor)])],
        anyOf: [['天魁', '天钺'], ['天钺', '天魁']].flatMap(([near, far]) => externalChanges.map(change =>
          [...stars(anchor, near), ...stars(opposite, far), ...change])),
      };
    }),
  }] }],
  ['038', { hash: '1396aa7804f6579f42d24afbf734d0c3a75a03a57cc3b6df9038b79d5cc65999', passages: [{
    text: '亥宫安命，太阴坐守，更三方吉拱，主大富贵',
    required: lifeBranch('亥', stars(life, '太阴')),
    anyOf: benefics.map(star => [trineStar(life, star)]),
  }] }],
  ['053', { hash: '90e9936d9306be0f0aa5beaea5729d952c8c027c278030029715d7fb25f9c06f', passages: [{
    text: '极居卯酉，多为脱俗之僧，紫微为北极，如坐守命宫，加杀，定主僧道。',
    required: lifeBranch('卯酉', stars(life, '紫微')), anyOf: samePalaceMalefic,
  }] }],
  ['058', { hash: '27b6d0d97678fa73c6d12afa25951f6f8dcff59972085e8201d6501af0403105', passages: [{
    required: lifeBranch('子午', stars(life, '破军')), anyOf: benefics.map(star => stars(life, star)),
  }] }],
  ['059', { hash: '1d59976909393fc90f0d97434cd7a733a5a595437b94ec68d54db26eb120d349', passages: [{
    text: '七杀守命旺宫是也，如子午寅申为朝斗',
    required: lifeBranch('子午寅申', stars(life, '七杀')),
    anyOf: ['庙', '旺'].map(brightness => [{ kind: 'palace_brightness', palace: life, star: '七杀', scope: 'origin', brightness }]),
  }] }],
  ['061', { hash: 'd6156017f5da62bc5d3977f1da3f6447fa45879ca458cc89127a14fc1806975f', passages: [{
    text: '丹墀桂墀，早遂青云之志，丹墀谓日居卯辰巳，桂墀谓月入酉戌亥，此六宫，身命值之是也',
    cases: () => [life, ...bodySeats].flatMap(anchor => [['太阳', '卯辰巳'], ['太阴', '酉戌亥']].map(([star, branches]) => ({
      required: [...stars(anchor, star), ...(anchor === life ? [] : [bodySeat(anchor)])],
      anyOf: [...branches].map(branch => [place(anchor, branch)]),
    }))),
  }] }],
  ['073', { hash: 'bd4cf0af7b0c3f5c1f2ca82c2ed118dc02da93a6e395a2cea0374cff9ef5ee87', passages: [{
    text: '如辰戌丑未四墓，得二星守命，定主少年不利',
    required: lifeBranch('丑未', stars(life, '贪狼', '武曲')),
  }] }],
  ['114', { hash: '94626ffec44a34c31328f0c667b9677ab26827e4940442152e735f8840dbcd9f', passages: [{
    text: '命宫有吉坐守，三方化吉拱冲',
    required: [lifeSectors],
    anyOf: benefics.flatMap(star => trineOrOppositeAuspicious.map(change => [...stars(life, star), ...change])),
  }] }],
  ['115', { hash: 'cf3860b916a4229c6ff046ee551e7f50d4d927af519d1afac568fcdde52e0b6e', passages: [{
    required: ['左辅', '右弼', '天魁', '天钺'].map(star => [...stars(life, star), ...lifeSectors]),
    anyOf: externalLifePalaces.flatMap(chang => externalLifePalaces.flatMap(qu => externalLifePalaces.map(ke =>
      [...stars(chang, '文昌'), ...stars(qu, '文曲'), changeAt(ke, '科')]))),
  }] }],
  ['007', { hash: 'b4b73ac54a023fcd986e99f29b40e946dea374150f42d2c8ea352190169db224', passages: [fallenLianzhenWithoutBenefics] }],
  ['008', { hash: '89eb6075fb7fce982970709923a50c5dd66b054a26c3f7736ce4f021eb022c5f', passages: [{
    text: '如身命自未至子遇太阴，必主富贵',
    cases: () => [life, ...bodySeats].map(anchor => ({
      required: [...stars(anchor, '太阴'), ...(anchor === life ? [] : [bodySeat(anchor)])],
      anyOf: [...'未申酉戌亥子'].map(branch => [place(anchor, branch)]),
    })),
  }] }],
  ['021', { hash: '63d5d26c22be71a068fba0921f259d30e1550034d661295a691c8b92ccad2a2e', passages: [
    ['辰戌', '武曲庙旺，威名赫奕。如辰戌二宫安命值之上格'], ['丑未', '丑未安命次之'],
  ].map(([branches, text]) => ({
    text,
    required: lifeBranch(branches, [...stars(life, '武曲'), bright(life, '武曲', '庙')]),
    anyOf: [...['左辅', '右弼', '文昌', '文曲'].map(star => [sectorStar(life, star)]),
      ...[life, ...externalLifePalaces].flatMap(palace => [...'禄权'].map(change => [changeAt(palace, change)]))],
  })) }],
  ['026', { hash: 'b2af5e5af0a8229f4376de73114fe706e35ce7d6382dc96ef2773dad33028d3f', passages: [{
    required: lifeBranch('寅申', stars(life, '禄存', '天马')),
    anyOf: trineAuspicious,
    mustBeAbsent: noLifeMalefics,
  }] }],
  ['028', { hash: 'b51780babddc1b8fbf71980f68b7ba47adf30f6131cddcbc28e18f804370b3d0', passages: [{
    text: '贪狼火星逢庙旺，名镇诸邦。如辰戌丑未四宫安命值此，上格',
    required: lifeBranch('戌', [...stars(life, '贪狼', '火星'), bright(life, '贪狼', '庙'), bright(life, '火星', '庙')]),
  }, {
    text: '三方吉化拱照尤美',
    required: lifeBranch('戌', [...stars(life, '贪狼', '火星'), bright(life, '贪狼', '庙'), bright(life, '火星', '庙')]),
    anyOf: trineAuspicious,
  }] }],
  ['060', { hash: 'e60371b5b28228111b7fad48500e41d1d2b415ac6c0022c8e5311b73dec208d7', passages: [{
    text: '文昌为文桂，文曲为文华，如丑未安命值之，更遇化吉，及三合吉星拱夹是也。',
    required: lifeBranch('丑未', stars(life, '文昌', '文曲')),
    anyOf: [...'禄权科'].flatMap(change => trineBenefics.map(benefic => [changeAt(life, change), ...benefic])),
  }] }],
  ['071', { hash: 'a6ea384e702195019496d61f97a02be9f54d616d0ef4f7b45ce85cff4b84630f', passages: [{
    text: '紫微辰戌遇破军，富而不贵有虚名。',
    required: [['辰', '戌'], ['戌', '辰']].map(([seat, opposite]) =>
      [place(life, seat), place('迁移', opposite), relation('迁移', 'opposite'), ...stars(life, '紫微'), ...stars('迁移', '破军')]),
  }] }],
  ['072', { hash: 'd193d29864ec8e95484bf230458b26ef82984cec5e5854650096dbcf57a1db03', passages: [{
    text: '昌曲破军逢，刑克多劳碌，如卯酉辰戌破军守命，虽得文昌文曲，亦非全吉',
    required: lifeBranch('卯酉辰戌', [...stars(life, '破军'), sectorStar(life, '文昌'), sectorStar(life, '文曲')]),
  }] }],
  ['083', { hash: 'c19b0a7f87f9940326619664951897d466b9c5b0268e781484000ab2d3b9c1a9', passages: [{
    text: '紫微能降七杀威权',
    required: lifeBranch('巳亥', stars(life, '紫微', '七杀')),
  }] }],
  ['087', { hash: 'b6070c2b619a26065e537031862fcce634cf77f5f70b49635199d490d16eb7ea', passages: [{
    required: [[...stars(life, '贪狼', '火星'), sectorStar(life, '地空'), sectorStar(life, '地劫')]],
  }] }],
  ['098', { hash: 'ea0b93373fa2609e8182ea053830aa25a2425e69d256b055c2d436d0475b82f8', passages: [{
    text: '如卯巳二宫遇天梁坐于身命，定主孤寒，不然必飘荡他乡，耽恋酒色徒耳。',
    required: lifeOrBody(palace => [...stars(palace, '天梁'), place(palace, '巳'), fallen(palace, '天梁')]),
  }] }],
  ['110', { hash: '386d196d7c66dded8e7fc61ee68ee4562c532fa8cd6afcb0366aaa490600fe2a', passages: [{
    text: '科权对拱，跃三汲于禹门，迁移财帛官禄三方对拱是也',
    required: [lifeSectors],
    anyOf: externalLifePalaces.flatMap(ke => externalLifePalaces.filter(quan => quan !== ke).map(quan =>
      [changeAt(ke, '科'), changeAt(quan, '权')])),
  }] }],
  ['112', { hash: '82d8f1e8ab67af45e4ba744a5e52db58b12dfa84ad66cd9900004ed614edacb1', passages: [{
    text: '此二星会身命于陷地，主手艺安身，出外可也。',
    required: lifeOrBody(palace => [...stars(palace, '破军'), fallen(palace, '破军')]),
  }] }],
  ['035', { hash: '136ab593ebc8a4b25e110486fc1e2f725ebbcccdc7b9d11075596acd4a3eac9c', passages: [{
    text: '日月科禄丑宫中，定是方伯公。丑未安命，日月化科禄坐守是也',
    required: lifeBranch('丑未', [...stars(life, '太阳', '太阴'),
      { kind: 'star_mutagen', palace: life, star: '太阳', change: '禄', scope: 'origin' },
      { kind: 'star_mutagen', palace: life, star: '太阴', change: '科', scope: 'origin' }]),
  }] }],
  ['050', { hash: '78d90be1445c1d45e7378dfb9be530b5cf8bf3496a9c95d779bc2e59204e4902', passages: [{
    required: [['文昌', '文曲', '天机', '太阴'].map(star => sectorStar(life, star))],
  }] }],
  ['057', { hash: '717fb1693d9eb632e4657ae0d41293d314b46fe0d026b0d23710049f7ab62bcf', passages: [{
    text: '如命宫不见正星，单值地空坐守，更三合加杀化忌，依此断。',
    required: [[...stars(life, '地空'), { kind: 'palace_main_count', palace: life, count: 0 },
      { kind: 'palace_core_star_count', palace: life, count: 1 }]],
    anyOf: ['财帛', '官禄'].flatMap(palace => fourMalefics.map(star =>
      [changeAt(palace, '忌'), relation(palace, 'trine'), trineStar(life, star)])),
  }] }],
  ['064', { hash: 'e672669d1139d9245e7117ba0645a04ed053c1aa3ad80bff3b17a3be7ca0f36e', passages: [{
    text: '如命身有正星化吉，遇三方财帛官禄宫有辅弼来朝是也。',
    cases: (_palaceSectors, majorStars) => [{
      required: lifeTrines,
      anyOf: [['左辅', '右弼'], ['右弼', '左辅']].flatMap(([wealth, career]) => majorStars.flatMap(star => [...'禄权科'].map(change =>
        [...stars('财帛', wealth), ...stars('官禄', career), ...stars(life, star),
          { kind: 'star_mutagen', palace: life, star, change, scope: 'origin' }]))),
    }],
  }] }],
  ['069', { hash: 'ee9b1c0c48c8d48da189d23517edc00ec9cdfbee1e3df28770d880b3df6aa0c2', passages: [{
    text: '如武曲、太阴、贪狼化禄守照命宫，更加吉曜，亦富贵。',
    required: ['武曲', '太阴', '贪狼'].map(star => [...stars(life, star),
      { kind: 'star_mutagen', palace: life, star, change: '禄', scope: 'origin' }]),
    anyOf: [...'子寅卯巳午申酉亥'].flatMap(branch => benefics.map(star => [place(life, branch), sectorStar(life, star)])),
  }] }],
  ['081', { hash: 'bf7b931d11d1be77251c666cc4a2f54f8edd07d0a4a782929b3174ef545ea8d0', passages: [{
    required: lifeBranch('未', stars(life, '太阳', '太阴', '左辅', '右弼')),
    mustBeAbsent: stars(life, ...malefics),
  }] }],
  ['089', { hash: '5453dceea56a2d3cae18409e3d09fc525b3bb166fafebd91f0b5196edbbdbce9', passages: [{
    cases: () => [life, ...bodySeats].map(palace => ({
      required: [bodySeat(palace)], anyOf: malefics.map(star => stars(palace, star)),
    })),
  }] }],
  ['092', { hash: 'cf9d5e238203b6e560906291ec2c9701bb8e204a951d1fc3078adbb1c2a09feb', passages: [flankingSunMoon] }],
  ['095', { hash: '76e22ecef6cd521e1ed568fe4b471854e20a6810f5ccf6dd38999f9918070a5e', passages: [{
    required: [[changeAt(life, '忌'), relation('父母', 'adjacent'), relation('兄弟', 'adjacent')]],
    anyOf: [['擎羊', '陀罗'], ['陀罗', '擎羊']].flatMap(([a, b]) => [['火星', '铃星'], ['铃星', '火星']].map(([c, d]) =>
      [...stars('父母', a, c), ...stars('兄弟', b, d)])),
  }] }],
  ['099', { hash: 'd5ba5c5bdc37d5f3c62e29e97fcab97c2ba5d5d76d70aecde9313876f8959104', passages: [fallenLianzhenWithoutBenefics] }],
  ['014', { hash: 'c871e7650b23806af272eeffe4912c11682c1453933246a6a2427dd1b86d38b1', passages: [{
    cases: palaceSectors => chartPalaces(palaceSectors).map(palace => ({
      required: [fallenMutagen(palace, '科')],
      anyOf: ['地空', '地劫'].flatMap(empty => ['擎羊', '陀罗'].map(malefic => stars(palace, empty, malefic))),
    })),
  }] }],
  ['016', { hash: 'db812b81da4fff33460bd561e1ba17be817839b1426238202c1c09866b261c96', passages: [{
    text: '发不住财，禄主缠于弱地。如化禄陷于劫空是也',
    cases: palaceSectors => chartPalaces(palaceSectors).map(palace => ({
      required: [fallenMutagen(palace, '禄'), ...stars(palace, '地空', '地劫')],
    })),
  }] }],
  ['047', { hash: '163a04a893c964248a13c151f753f65bb166a2e5e46c43e1b02947a5dd20e3c5', passages: [{
    text: '巳亥二宫安命，值之是也，辛生人最忌',
    required: lifeBranch('巳亥', [...stars(life, '廉贞'), born('辛'), sectorStar(life, '文昌'), sectorStar(life, '文曲'), ...lifeSectors]),
    mustBeAbsent: [life, ...externalLifePalaces].flatMap(palace => stars(palace, '天相')),
  }] }],
  ['079', { hash: '07d1d721d0a137c42c70d2c4d3c65128c2a91dc915ac237fc4f7d831f54df38b', passages: [{
    cases: () => {
      const names = ['天府', '天相', '天同', '天梁'];
      return [...names.map(star => ({ required: stars(life, star) })),
        ...bodySeats.map(palace => ({ required: [bodySeat(palace)], anyOf: names.map(star => stars(palace, star)) }))];
    },
  }] }],
  ['082', { hash: '40b4cd07074c62d10dbef68eb5c16cff7340a784324dfd617a395a15680f4728', passages: [{
    cases: palaceSectors => [life, ...bodySeats].map(anchor => {
      const triad = palaceSectors(anchor, [0, 4, -4]);
      const [own, ...external] = triad;
      // Wuqu to Lianzhen moves four branches backwards, while Pojun to Tanlang moves four forwards.
      const matches = pairedTriadStars(triad, ['武曲', '廉贞'], ['破军', '贪狼']);
      return {
        required: [...external.map(target => link(own, target, 'trine')), ...(anchor === life ? [] : [bodySeat(anchor)])],
        anyOf: matches.flatMap(group => triad.flatMap(palace => [...'禄权科'].map(change => [...group, changeAt(palace, change)]))),
      };
    }),
  }] }],
  ['084', { hash: 'd3c732f2ccc65265ee9967b96bd22bcaaa829a1a2d5f85246f6b189de2a7eed8', passages: [travellingTanlang] }],
  ['086', { hash: '6a78570f91f9fe974a19e097e6441462de3a1baaa63a68242a4bb282e3c0a421', passages: [{
    text: '如四星在辰戌坐命，亦然。',
    required: lifeBranch('辰戌', stars(life, '铃星', '文昌', '陀罗', '武曲')),
  }] }],
  ['125', { hash: 'aeb39e1376ab7b65ee1b8cb0cd53746abb36d077e86755ebc8241addb13a8bda', passages: [{
    required: [[{ kind: 'palace_major_state', palace: life, state: '陷地' }, { kind: 'palace_sector_all_benefic', palace: life }]],
  }] }],
  ['127', { hash: '6f630c1f01be76aa6bc099ab1b327044b05d739c2cf34d6bfdcc3dde8ac13441', passages: [{
    text: '如身逢之，加吉，火铃无害',
    cases: () => [life, ...bodySeats].map(palace => ({
      required: [bodySeat(palace)],
      anyOf: ['火星', '铃星'].flatMap(malefic => benefics.map(star => stars(palace, malefic, star))),
    })),
  }] }],
  ['133', { hash: '42ed3b422832322e890d1ce34fc820e52437374346f0a2b5f524d12717537145', passages: [travellingTanlang] }],
  ['030', { hash: 'e6cb92a3feb5a70d24a9c04a368aa30b9fa016e468c4c79e6090f6fac2722114', passages: [{
    text: '如七杀在寅申坐命者，亦为上格',
    required: lifeBranch('寅申', [...stars(life, '七杀'), { kind: 'palace_life_without_natal_ji' }]),
  }] }],
  ['033', { hash: '44247921606977bb87571f00ebeb1643079facec9fc3266c2d3e1fb9dd88af03', passages: [{
    cases: palaceSectors => [life, ...bodySeats].map(anchor => {
      const triad = palaceSectors(anchor, [0, 4, -4]);
      return {
        required: [...triad.slice(1).map(target => link(anchor, target, 'trine')), ...(anchor === life ? [] : [bodySeat(anchor)])],
        anyOf: pairedTriadStars(triad, ['天机', '天同'], ['太阴', '天梁']),
      };
    }),
  }] }],
  ['056', { hash: '81c62ee32917d994a5f5e516b75dee914ba04d11e6dda86abe2fb061153b6a0b', passages: [{
    required: lifeBranch('巳亥', [...stars(life, '廉贞'), trineStar(life, '七杀'), changeAt(life, '忌'),
      sectorStar(life, '地空'), sectorStar(life, '地劫')]),
    anyOf: fourMalefics.map(star => [sectorStar(life, star)]),
  }] }],
  ['063', { hash: '190a6bebc421e1539c75c7e3aaf161c8d153923c48dc4c4087f8f724a1554034', passages: [
    ['如命坐阴阳，财官二宫昌曲来会', ['太阳', '太阴'], ['文昌', '文曲']],
    ['或命坐昌曲，财官日月来会，更遇魁钺吉星，富贵必矣。', ['文昌', '文曲'], ['太阳', '太阴']],
  ].map(([text, resident, visitors]) => ({
    text, required: [[...stars(life, ...resident), ...lifeTrines, sectorStar(life, '天魁'), sectorStar(life, '天钺')]],
    anyOf: [visitors, visitors.slice().reverse()].map(([wealth, career]) => [...stars('财帛', wealth), ...stars('官禄', career)]),
  })) }],
  ['077', { hash: '12fcb1090b7be50d1688117a6b28f5acc3616aacc95d2f2166b7f9bf8148c765', passages: [{
    text: '然有日月反背而多富贵者，要看本宫三合有吉化拱照，不加杀是也。',
    cases: palaceSectors => [['太阳', '太阴', '申酉戌亥子', '午巳辰卯寅'], ['太阴', '太阳', '午巳辰卯寅', '申酉戌亥子']]
      .map(([own, other, seats, otherSeats]) => ({
        required: [...stars(life, own), ...lifeTrines], mustBeAbsent: noLifeMalefics,
        anyOf: [...seats].flatMap((seat, index) => {
          const otherSeat = otherSeats[index];
          const [target] = palaceSectors(life, [nativeBranches.indexOf(seat) - nativeBranches.indexOf(otherSeat)]);
          return trineAuspicious.map(change => [place(life, seat), place(target, otherSeat), ...stars(target, other), ...change]);
        }),
      })),
  }] }],
  ['090', { hash: 'e1b20d5ffbb040ab67319ec20c7e861935b826ba1985674edda987fa060563ad', passages: [kuiYueFlanking] }],
  ['121', { hash: '1d5e60232221600657b4e9dbf762336ed2c26f41894cb50cf8bcca39d46c6409', passages: [{
    text: '如巳亥二宫安命，值此二星坐守，加杀化忌',
    required: lifeBranch('亥', [...stars(life, '文昌', '贪狼'), changeAt(life, '忌')]),
    anyOf: fourMalefics.map(star => stars(life, star)),
  }] }],
  ['010', { hash: 'ced3f47ae1c750d5da824589a6c84000ea46219dad8eed9d7c21faa3b0ff2def', passages: luQuanPassages }],
  ['017', { hash: 'e7d7f37f53e058bff34e1f23fe0da16a139be28d3cd423082a98e89d529ba2d7', passages: [{
    text: '七杀朝斗，爵禄荣昌，如寅申子午四宫安身命，七杀值之是也。亦要左右魁钺昌曲坐照拱合依此断',
    cases: () => [[life, '子'], ['官禄', '申']].map(([palace, seat]) => ({
      required: [...stars(palace, '七杀'), place(palace, seat), ...benefics.map(star => sectorStar(palace, star)),
        ...(palace === life ? [] : [bodySeat(palace)])],
      mustBeAbsent: malefics.map(star => sectorStar(palace, star)),
    })),
  }] }],
  ['034', { hash: 'c6a473006d98944b436f217f85b9dbca3069fcb37da64c38fb490d318f0fe215', passages: [{
    text: '日卯辰巳，月酉戌亥，又化禄权科，坐守身命是也',
    cases: () => [['太阳', '卯辰巳', '庙旺旺'], ['太阴', '酉戌亥', '旺旺庙']].flatMap(([star, seats, grades]) =>
      [...seats].map((seat, index) => ({
        required: [...stars(life, star), place(life, seat), bright(life, star, grades[index]), { kind: 'palace_life_without_natal_ji' }],
        mustBeAbsent: noLifeMalefics,
        anyOf: [...'禄权科'].map(change => [{ kind: 'star_mutagen', palace: life, star, change, scope: 'origin' }]),
      }))),
  }] }],
  ['075', { hash: 'edfa94564365675d83b185142ada8c859c6720c033c49cf5580d8fea9dc076eb', passages: [
    ['辰', '仆役', '在辰则酉禄暗合'], ['戌', '兄弟', '在戌则酉禄夹命'],
  ].map(([seat, luPalace, text]) => ({
    text, required: [[born('辛'), place(life, seat), ...stars(life, '巨门'), fallen(life, '巨门'),
      { kind: 'star_mutagen', palace: life, star: '巨门', change: '禄', scope: 'origin' }, place(luPalace, '酉'),
      ...stars(luPalace, '禄存'), ...(seat === '戌' ? [relation(luPalace, 'adjacent')] : [])]],
  })) }],
  ['102', { hash: '91d24c4f0ddea889c45ab049b6865f0593ae7dc6aac1288c33c98c1c6d9d2275', passages: luQuanPassages }],
]);

export function compileJielanGusui(claim, surroundingPalaces, palaceSectors, majorStars) {
  if (!claim.id.startsWith(prefix)) return undefined;
  const spec = reviewed.get(claim.id.slice(prefix.length));
  if (!spec) return undefined;
  const { source, conditions, evidence } = claim;
  const hash = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  if (hash !== spec.hash || spec.passages.some(({ text }) => text && !evidence.original_text.includes(text))) {
    return { reason: 'source_review_required', reviewNote: '《捷览》骨髓赋原文、条件或出处有变化，须重新复核。' };
  }
  const branches = spec.passages.map(({ text, required, flanking, allowBody, mustBeAbsent, anyOf, cases }) => {
    const groups = flanking ? [
      ...surroundingPalaces(flanking, life, 'adjacent'),
      ...(allowBody ? bodySeats.flatMap(palace => surroundingPalaces(flanking, palace, 'adjacent')
        .map(facts => [...facts, { kind: 'palace_confirmed_body_seat', palace }])) : []),
    ] : required;
    const inputs = (cases ? cases(palaceSectors, majorStars) : groups.map(facts => ({ required: facts, mustBeAbsent, anyOf })))
      .map(input => normalizeRuleInput('ziwei', input));
    return { text, conditionCompiler: jielanGusuiProfile, inputs };
  });
  if (!branches[0].text) return { compiler: jielanGusuiProfile, inputs: branches[0].inputs };
  return { reason: 'unmapped_condition', condition: '《捷览》骨髓赋只引用已核的本命分句', branches };
}

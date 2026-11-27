import { createHash } from 'node:crypto';
import { normalizeRuleInput } from './matching.mjs';

export const xingjueWealthProfile = 'ziwei-xingjue-wealth-v1';
const prefix = 'ziwei-v3-xingjue-051-p';
const palace = '财帛';
const scope = 'origin';
const starAt = (seat, star) => ({ kind: 'palace_star', palace: seat, star, scope });
const same = (...stars) => stars.map(star => starAt(palace, star));
const onBranch = branch => ({ kind: 'palace_branch', palace, branch });
const at = (branch, ...stars) => [onBranch(branch), ...same(...stars)];
const branchOptions = values => [...values].map(value => [onBranch(value)]);
const sector = (...stars) => stars.map(star => ({ kind: 'palace_sector_star', palace, star }));
const sectorChange = (seat, change) => ({ kind: 'palace_sector_mutagen', palace: seat, change });
const changeAt = (seat, change) => ({ kind: 'palace_mutagen', palace: seat, change, scope });
const localChange = (change, seat = palace) => [changeAt(seat, change), sectorChange(seat, change)];
const starChange = (seat, star, change) => ({ kind: 'star_mutagen', palace: seat, star, change, scope });
const brightness = (star, value) => ({ kind: 'palace_brightness', palace, star, scope, brightness: value });
const relation = (target, relation) => ({ kind: 'palace_relation', anchor: palace, target, relation });
const wealthOpposite = relation('福德', 'opposite');
const outward = [['命宫', 'trine'], ['官禄', 'trine'], ['福德', 'opposite']];
const external = change => outward.map(([seat, path]) => [relation(seat, path), changeAt(seat, change)]);
const externalChanges = (first, second) => external(first).flatMap(a => external(second).map(b => [...a, ...b]));
const mainCount = (count, seat = palace) => ({ kind: 'palace_main_count', palace: seat, count });
const phase = (value, seat = palace) => ({ kind: 'palace_changsheng_phase', palace: seat, phase: value });
const phaseOptions = values => values.map(value => [phase(value)]);
const bureau = value => ({ kind: 'natal_ziwei_bureau', bureau: value });
const growth = ['长生', '帝旺'];
const otherPhases = '沐浴 冠带 临官 衰 病 死 墓 绝 胎 养'.split(' ');
const fireJumen = [...same('巨门', '文昌'), bureau('火六局')];
const destructiveWithLu = {
  required: [...same('破军', '地劫'), ...sector('禄存'), sectorChange(palace, '禄')],
  anyOf: [[...same('禄存'), changeAt(palace, '禄')], ...outward.map(([seat, path]) => [
    relation(seat, path), changeAt(seat, '禄'), starAt(seat, '禄存'),
  ])],
};
const soloLu = [...same('禄存'), mainCount(0), { kind: 'palace_core_star_count', palace, count: 1 }];
const oppositeLu = [wealthOpposite, ...localChange('禄', '福德')];

// Qing manuscript pp. 158–161. Use the antecedent of each continued
// clause and quote just the verified fragment when a following branch is unresolved.
const reviewed = new Map([
  ['654-001', ['21aad3472fbaaaf936f143e050391b24042bdc06332de74bcdbe889b598b5189',
    ["羊破同守財宮於陷地", [[...same('擎羊', '破军'), brightness('擎羊', '陷'), brightness('破军', '陷')]]],
  ]],
  ['655-001', ['9d0046e0b1e426a78044c98209b0bb37c66ce220898195566bf500ca24ce6777',
    [null, [[...same('武曲'), starChange(palace, '武曲', '权'), ...localChange('权')]]],
  ]],
  ['658-001', ['14086eeb8bdab8d298f5aa58303e37116a5c70ea8cbc441a030a62d601c1fa94',
    ["巳財紫七陀同宮者", [at('巳', '紫微', '七杀', '陀罗')]],
  ]],
  ['660-001', ['5ce7bf21ff9ac1c3debd617bda81dc6ef10175eb469a858aa6f79280abb033c6',
    [null, [[mainCount(0), ...sector('紫微', '天府', '天相')]]],
  ]],
  ['663-001', ['f7d425a13889e9a632affa418c88927aed9545b5931ce164d8c154474bc7cd57',
    ['子財武府右曲合', [at('子', '武曲', '天府', '右弼', '文曲')]],
  ]],
  ['664-001', ['8a775b3a09a7e897f64fdf30396daf986ef2942c2e57d981dfda0c0c1e385961',
    [null, [same('太阳', '天刑')]],
  ]],
  ['667-001', ['4d7a4d8e78127b99d7477ebd79815c76aff022cdcffbfa6e02ccde8e4292e2a6',
    ["財宮天府對武權主富", [[...same('天府'), wealthOpposite, starAt('福德', '武曲'), starChange('福德', '武曲', '权'), ...localChange('权', '福德')]]],
  ]],
  ['1413-001', ['94d1cbe0708f64855b2236630711dbd5a23f974103287f85ec0aaac1e0be2852',
    ["火局人財宮巨門文昌同入者、水克火、火克金、財帛不聚", [fireJumen]],
    ["又兼化忌則尤貧", [[...fireJumen, ...localChange('忌')]]],
  ]],
  ['1414-001', ['65aa176a84ab712ff260c5a2355769df4564d682f1e2dd51c7e81a583524fb8e',
    ["財宮遇日月雙祿科星來照者", [{ required: [...sector('太阳', '太阴', '禄存'), sectorChange(palace, '禄'), sectorChange(palace, '科')],
      mustBeAbsent: same('太阳', '太阴', '禄存'), anyOf: externalChanges('禄', '科') }]],
  ]],
  ['1415-001', ['2b291a7275dd964db159c729c0ab11533a397defdb5e2ae58f33f08915460585',
    ['武府同守無殺', [[...same('武曲', '天府'), { kind: 'palace_sector_six_malefic_count', palace, count: 0 }]]],
  ]],
  ['1416-001', ['1848297cabe841b00f5a4e2e352f00a661661445e71fec3e07071feac7eb2afd',
    [null, [{ required: same('地劫'), anyOf: branchOptions('寅卯辰戌丑未') }]],
  ]],
  ['1417-001', ['ff508f5b55cf23fefd64eb8d9a4cd042f615ce7d04f258be873f29a04e7eda7f',
    ["金局人財宮坐午地、得天同水、太陰水者、金生水星、財物多自內出外去", [[...at('午', '天同', '太阴'), bureau('金四局')]]],
  ]],
  ['1418-001', ['918545ed9496390cb749f70e9c57fce6ba107b1c588ff8c9ff4f3a1738044f08',
    [null, [[...at('寅', '武曲', '天相'), ...localChange('科')]]],
  ]],
  ['1419-001', ['0a527daef1ccf6b6077946647fd652e2bdd322699f3080119e01b8102a65b3d7',
    ["財宮天相遇地空羊刃同居", [same('天相', '地空', '擎羊')]],
  ]],
  ['1422-001', ['d9e2dc804b7b63cf222c10b3b11a548824bcb1bcecb90563df763d2a048918e4',
    ["財宮戌地破刧者、非四墓生", [{ required: at('戌', '破军', '地劫'), anyOf: [...'子寅卯巳午申酉亥'].map(branch => [{ kind: 'natal_year_branch', branch }]) }]],
  ]],
  ['1424-001', ['7018477bb75a3c610097882b435fcc506e8d50d0c5e4fe78de69577610db0dd3',
    ["亥財天相單守", [[...at('亥', '天相'), mainCount(1)]]],
  ]],
  ['1425-001', ['c21615b105fca9b84fea77dac5206405c4dfaac97b37bb161719b450359b4b0b',
    [null, [{ required: [...same('太阳', '天梁', '文昌'), ...localChange('忌'),
      { kind: 'palace_suiqian_star', palace, star: '龙德' }, { kind: 'palace_boshi_star', palace, star: '力士' }],
      anyOf: ['庙', '旺', '得'].map(value => [brightness('太阳', value)]) }]],
  ]],
  ['1426-001', ['b22816d1a31d31a391cbd220a34a3755ca111d0c7489a0ee453277064c09da82',
    ["辰財武曲財不聚", [at('辰', '武曲')]],
  ]],
  ['1427-001', ['3ec9130156c67f3782639c160a16f2b22134299b4d48cbf7c5292a7171eac2a5',
    [null, [at('未', '天梁', '文昌', '文曲')]],
  ]],
  ['1428-001', ['ed6ebb778090afb5fde7ced471f5fed9301f24a41c6aa3a4574b184aef180706',
    [null, [same('破军', '陀罗')]],
  ]],
  ['1429-001', ['c4bf2cf8807c79b66ca2df55bd706c141cc9782faa63ca0a75a7552acdb9e222',
    ["丑財貪武同行財多", [at('丑', '贪狼', '武曲')]],
  ]],
  ['1430-001', ['7d77f3b8df8fddce05037c080b08983245ee9627cbe7a41ebe65f9808c71a811',
    [null, [at('酉', '天梁', '太阳')]],
  ]],
  ['1432-001', ['686bab06991aba0fcb90d146162c4d4fe7490a63f6872ee1e2e1c47d5d2b75af',
    ["戌財同火姚共居者至貧", [{ required: at('戌', '天同', '火星', '天姚'), anyOf: phaseOptions(otherPhases) }]],
    ["若生旺方則不貧不富", [[...at('戌', '天同', '火星', '天姚'), phase('帝旺')]]],
  ]],
  ['1433-001', ['7292abfff7d1e48e02cb8e482ae4164fa0ddbf0de10ad8772aac4db6abc7be2d',
    ["若雙祿成合、尚以富貴論之", [destructiveWithLu]],
  ]],
  ['1435-001', ['f20ac1d381c278efcc820c3ede72e564b0d50f8d7d6ab85616255fb304a95633',
    ['財宮空虛無正星、落旬路二空、無財且貧', [{
      required: [mainCount(0), ...same('旬空', '截路')],
      anyOf: [...'甲乙丙丁戊己庚辛壬癸'].map((stem, index) => [
        { kind: 'natal_year_stem', stem }, onBranch('申午辰寅子'[index % 5]),
      ]),
    }]],
  ]],
  ['1436-001', ['eef28bc362d95ee2819b04c3ed5e78cc4122f7a414fc53d4fafd8a8f66200d10',
    ['田財宮七殺單坐絕地', ['财帛', '田宅'].map(seat => [starAt(seat, '七杀'), mainCount(1, seat), phase('绝', seat)])],
  ]],
  ['1437-001', ['81ddf630f2b07d4156f1ceb9a71dbc6d1cda1e590ae4849fdc4e9c9249c4103d',
    ["財破雖得地、橫破橫成", [[...same('破军'), brightness('破军', '得')]]],
  ]],
  ['1440-001', ['03c05bffce73b4b09bc8e254f9a6b670becd962ad9571e4e790c6dcba9f0ad6a',
    ["戌財天府化祿同居者", [[...at('戌', '天府'), ...localChange('禄')]]],
  ]],
  ['1441-001', ['2dda734e2c9c32645931ad166dbc49de42a085c7e27b7fb0e82611279f9a918e',
    ["戌上機梁守財與科祿合者、堆金積玉", [[...at('戌', '天机', '天梁'), sectorChange(palace, '科'), sectorChange(palace, '禄')]]],
  ]],
  ['1442-001', ['b4b2efec61c458662807fe5b6e0dfe39b221e35210351bfae1514f975bb3e5f4',
    [null, [{ required: [...same('禄存', '火星'), ...sector('地空', '地劫')],
      anyOf: phaseOptions([...growth.slice(1), ...otherPhases]) }]],
  ]],
  ['1443-001', ['78a37455e2cd46a5ebe76b7b32653b40084c2fc42f73a80da3c4da96f3a70fac',
    ["財宮貞七丑地則財少", [at('丑', '廉贞', '七杀')]],
    ["未地土火局人則財聚", [{ required: at('未', '廉贞', '七杀'), anyOf: ['土五局', '火六局'].map(value => [bureau(value)]) }]],
  ]],
  ['1444-001', ['f54196c9133e10e1c612afb8602b4af6c812f537cc6186e26fc5c745b9dc6023',
    ["化祿正照者", [[...soloLu, ...oppositeLu]]],
    ["日月會照者", [{ required: [...soloLu, ...sector('太阳', '太阴')], mustBeAbsent: same('太阳', '太阴') }]],
    ["兼逢二格最吉", [{ required: [...soloLu, ...oppositeLu, ...sector('太阳', '太阴')], mustBeAbsent: same('太阳', '太阴') }]],
  ]],
  ['1446-001', ['32dd758d272067f888951420262c00d170a6c5ba5cf02fef55317abf4938a843',
    [null, [same('破军', '陀罗')]],
  ]],
  ['1448-001', ['99eadd47423c6a38047e4d1076acf58f74c468792a5b55185077f945251fec9a',
    ["午財同月", [at('午', '天同', '太阴')]],
  ]],
  ['1449-001', ['fd57466985c23d170d2cdfc2ce24c914b2462e3186655284784c9201eb6ecd95',
    [null, [['子女', '疾厄'], ['疾厄', '子女']].map(([first, second]) => [
      ...same('巨门'), relation(first, 'adjacent'), relation(second, 'adjacent'), starAt(first, '天刑'), starAt(second, '地劫')])],
  ]],
]);

export const xingjueWealthRepeatedPassages = new Map([
  [prefix + '1446-001', { id: prefix + '1428-001' }],
]);

export function compileXingjueWealth(claim) {
  if (!claim.id.startsWith(prefix)) return undefined;
  const spec = reviewed.get(claim.id.slice(prefix.length));
  if (!spec) return undefined;
  const [hash, ...passages] = spec;
  const { source, conditions, evidence } = claim;
  const fingerprint = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  if (fingerprint !== hash || passages.some(([text]) => text && !evidence.original_text.includes(text))) {
    return { reason: 'source_review_required', reviewNote: '《紫微星诀》财帛篇的原文、出处或条件有变化，须重新核对。' };
  }
  const branches = passages.map(([text, groups]) => ({
    text, conditionCompiler: xingjueWealthProfile,
    inputs: groups.map(group => normalizeRuleInput('ziwei', Array.isArray(group) ? { required: group } : group)),
  }));
  if (!branches[0].text) return { compiler: xingjueWealthProfile, inputs: branches[0].inputs };
  return { reason: 'unmapped_condition', condition: '按《紫微星诀》财帛篇已核盘式与分句匹配', branches };
}

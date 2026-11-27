// Deterministic rendering only: do not serialize arbitrary payloads or guess a
// meaning for fields that do not have an explicit natural-language translation.
export const fortunePromptVersion = 'fortune-matched-materials-v4';

export const fortuneNoMatchSummaries = {
  overall: '本期暂无足够资料判断整体趋势。',
  wealth: '本期暂无足够资料判断财运趋势。',
  romance: '本期暂无足够资料判断桃花运。',
};
const methods = { bazi: '八字', ziwei: '紫微斗数', western: '西方占星' };
const periods = { day: '日', week: '周', month: '月', year: '年' };
const scopes = { natal: '本命', decadal: '大限', minor: '小限', yearly: '流年', monthly: '流月', daily: '流日', transit: '行运', progressed: '次限推运' };
const layers = { year: '年柱', month: '月柱', day: '日柱', hour: '时柱' };
const bodies = { Sun: '太阳', Moon: '月亮', Mercury: '水星', Venus: '金星', Mars: '火星', Jupiter: '木星',
  Saturn: '土星', Uranus: '天王星', Neptune: '海王星', Pluto: '冥王星', ASC: '上升点', MC: '天顶', DSC: '下降点', IC: '天底' };
const aspects = { conjunction: '合相', semisextile: '半六合相', semisquare: '半刑相', sextile: '六合相', square: '四分相',
  trine: '三分相', sesquiquadrate: '倍半刑相', quincunx: '梅花相', opposition: '对分相', parallel: '同向赤纬平行' };
const motions = { direct: '顺行', retrograde: '逆行', stationary: '停驻' };
function leoNatalAspectText(contact) {
  const name = contact.aspect === 'parallel' ? '赤纬绝对值平行' : aspects[contact.aspect];
  return name && degrees(contact.difference) && degrees(contact.orb)
    ? name + '，实差' + degrees(contact.difference) + '，参考外限' + degrees(contact.orb) : '';
}
function leoNatalContactLabels(contacts) {
  return list(contacts).flatMap(contact => {
    const first = bodies[contact?.first], second = bodies[contact?.second];
    const aspect = first && second ? leoNatalAspectText(contact) : '';
    return aspect ? ['本命' + first + '与本命' + second + '为' + aspect] : [];
  });
}
function leoNatalContactsText(p) {
  if (p.natalAspectProfile !== 'leo-natal-aspects-1928-support-v1' || !Array.isArray(p.natalMajorAspectContacts)) return '';
  const rows = leoNatalContactLabels(p.natalMajorAspectContacts);
  return rows.length ? '同作者1928年本命参考外限内，与这两颗星相关的六合、三分、四分、对分为' + rows.join('、')
    : '同作者1928年本命参考外限内，与这两颗星相关的六合、三分、四分、对分均未检出';
}
function leoNatalAfflictionText(p) {
  if (p.natalAspectProfile !== 'leo-natal-aspects-1928-support-v1') return '';
  if (Array.isArray(p.natalAfflictionContacts)) {
    const involved = leoNatalContactLabels(p.natalAfflictionContacts).join('、');
    const who = p.progressedBody === 'Sun' && bodies[p.natalTargetId]
      ? '本命' + bodies[p.natalTargetId] : '条目涉及的两颗本命星';
    const marsUranus = p.progressedBody === 'Mars' && p.natalTargetId === 'Uranus' && p.targetKind === 'natal' && p.aspectType === 'sesquiquadrate';
    const priority = p.natalMarsUranusAfflictionFocus === 'Uranus' ? '。原文在这条分支中尤其看本命天王星受克'
      : p.natalMarsUranusAfflictionFocus === 'Mars' ? '。这次核到的是本命火星端受克' : '';
    return '按同作者1928年本命参考外限核' + who + '参与的四分、对分、半刑或倍半刑'
      + (marsUranus ? '，并单独核较弱的梅花相' : '') + '，' + (involved || '均未检出') + priority;
  }
  if (p.progressedBody !== 'Venus' || p.natalTargetId !== 'Neptune' || p.aspectType !== 'semisextile'
    || p.targetKind !== 'natal' || !Array.isArray(p.natalPairAspects)) return '';
  const direct = p.natalPairAspects.filter(contact => ['square', 'opposition', 'semisquare', 'sesquiquadrate'].includes(contact?.aspect))
    .map(leoNatalAspectText).filter(Boolean);
  const weak = p.hasVenusNeptuneSemisextileExact === true
    ? p.natalPairAspects.filter(contact => contact?.aspect === 'quincunx').map(leoNatalAspectText).filter(Boolean) : [];
  return '按同作者1928年本命参考外限核本命金星与本命海王星的直接四分、对分、半刑或倍半刑'
    + (direct.length ? '为' + direct.join('、') : '，均未检出')
    + (weak.length ? '。同一星对另有较弱偏难的本命' + weak.join('、') + '，并核到实际次限金海半六合真点' : '');
}
function leoNatalAbilityText(contacts) {
  const labels = { engineering: '机械及工程倾向', inventiveness: '发明和原创研究倾向', 'writing-and-judgment': '写作与判断倾向' };
  return list(contacts).flatMap(contact => {
    const [aspect] = leoNatalContactLabels([contact]);
    return aspect && labels[contact.ability] ? ['按Leo与Green的本命相位说明，' + aspect + '，为' + labels[contact.ability] + '的盘面见证'] : [];
  });
}

function leoNatalMercuryImpulsivenessText(contacts) {
  const labels = leoNatalContactLabels(contacts);
  return labels.length ? '按Leo与Green的本命水星相位说明，' + labels.join('、') + '，可作为原书所述言行急促分支的盘面依据' : '';
}

function leoNatalMercuryNeptunePremiseText(p) {
  const otherBodies = list(p.natalMercuryContactBodies).filter(body => body !== 'Neptune').map(body => bodies[body]).filter(Boolean);
  return sentences([
    ...list(p.natalMercuryNeptuneTestimonies).flatMap(contact => {
      const [aspect] = leoNatalContactLabels([contact]);
      const nature = { favourable: '偏顺', adverse: '偏难' }[contact?.nature];
      return aspect && nature ? [aspect + '。按Leo与Green的本命相位说明，这为原文所述本命感应的' + nature + '依据'] : [];
    }),
    p.hasSoleNatalMercuryNeptuneContact === true ? '在已核本命相位中，水星只与海王星有相位' : '',
    otherBodies.length ? '本命水星同时与' + otherBodies.join('、') + '等有已核相位，仍须比较各相位强弱' : '',
    ...leoNatalContactLabels(p.natalNeptuneArtContacts).map(aspect => aspect + '。按Leo与Green的本命相位说明，这为艺术或音乐分支的盘面依据'),
    Array.isArray(p.natalNeptuneArtContacts) && p.natalTargetHouse === 3
      ? '本命海王星实居Placidus第三宫，为Leo与Green所列想象和写作的宫位候选' : '',
  ]);
}

function leoNatalMarsNeptuneStrengthText(witness) {
  if (!['Mars', 'Neptune'].includes(witness?.body) || ![1, 7, 10].includes(witness.house)) return '';
  const reason = { 'only-in-angular-house': '所查角宫中只有此星', 'one-dignified': '所查角宫的诸星中仅它有入庙或擢升',
    'closer-dignified-cusp': '在所查有星座尊贵的角宫行星中，它最贴近所查宫头' }[witness.basis];
  return reason ? '按Leo与Green的本命角宫比较，本命' + bodies[witness.body] + '实居第' + witness.house + '宫，' + reason : '';
}

function leoNatalProminenceText(p) {
  if (p.natalTargetId !== 'Neptune' || !(p.progressedBody === 'Sun' && ['conjunction', 'parallel'].includes(p.aspectType)
    || p.progressedBody === 'Mercury' && p.targetKind === 'natal' && p.aspectType === 'semisextile')) return '';
  const elevation = p.natalNeptuneElevation;
  const closest = elevation?.isClosest === true && degrees(elevation.distance) && bodies[elevation.nearestOther?.body]
    && degrees(elevation.nearestOther.distance);
  return sentences([
    [1, 4, 7, 10].includes(p.natalTargetHouse) ? '本命海王星实居第' + p.natalTargetHouse + '宫，为已核的显著位置候选' : '',
    closest ? '本命海王星的黄经离本命天顶' + degrees(elevation.distance) + '，在原书所用九曜中最近；其次为本命'
      + bodies[elevation.nearestOther.body] + '，相距' + degrees(elevation.nearestOther.distance) : '',
    leoAngularCuspText('Neptune', elevation?.angularCuspApproach),
    ...list(p.natalNeptuneSoleLuminaryContacts).flatMap(row => {
      const contact = leoNatalAspectText(row);
      return ['Sun', 'Moon'].includes(row.luminary) && contact
        ? ['按同作者参考外限，本命' + bodies[row.luminary] + '唯一成相的星体为海王星，' + contact] : [];
    }),
    p.natalMercuryDomicileAngular === true && [2, 5].includes(p.natalBodySign) && [1, 4, 7, 10].includes(p.natalBodyHouse)
      ? '本命水星在自己掌管的' + signs[p.natalBodySign] + '，同时实居第' + p.natalBodyHouse + '角宫' : '',
  ]);
}

function leoAngularCuspText(body, approach) {
  return bodies[body] && approach && [1, 4, 7, 10].includes(approach.nextHouse) && degrees(approach.distance)
    ? '本命' + bodies[body] + '在第' + approach.fromHouse + '宫，距前方第' + approach.nextHouse + '角宫宫头' + degrees(approach.distance)
      + '。按 Leo 与 Green 的宫头前约五度口径，作为显著位置候选' : '';
}

function leoNatalTargetAspectsText(p) {
  if (p.natalAspectProfile !== 'leo-natal-aspects-1928-support-v1' || !Array.isArray(p.natalTargetAspectContacts)
    || !bodies[p.natalTargetId]) return '';
  const contacts = leoNatalContactLabels(p.natalTargetAspectContacts).join('、');
  return '按同作者1928年本命参考外限核本命' + bodies[p.natalTargetId] + '参与的相位，' + (contacts || '未检出');
}
function leoNatalFavourableText(p) {
  if (p.natalAspectProfile !== 'leo-natal-aspects-1928-support-v1') return '';
  const weakNotice = rows => rows.some(row => row?.aspect === 'semisextile') ? '，其中半六合属较弱的偏顺相位' : '';
  if (Array.isArray(p.natalFavourableContacts)) {
    const labels = leoNatalContactLabels(p.natalFavourableContacts).join('、');
    const hard = Array.isArray(p.natalAfflictionContacts) ? '' : leoNatalContactLabels(list(p.natalMajorAspectContacts)
      .filter(row => ['square', 'opposition'].includes(row?.aspect))).join('、');
    return '按同作者1928年本命参考外限核两颗本命星参与的半六合、六合或三分，'
      + (labels || '均未检出') + weakNotice(p.natalFavourableContacts) + (hard ? '；另核到四分或对分，' + hard : '');
  }
  const checksDirectPair = p.targetKind === 'natal' && p.progressedBody === 'Mars'
    && (p.natalTargetId === 'Neptune' && p.aspectType === 'semisquare' || p.natalTargetId === 'Saturn' && p.aspectType === 'parallel');
  if (!checksDirectPair || !Array.isArray(p.natalPairAspects)) return '';
  const direct = p.natalPairAspects.filter(row => ['semisextile', 'sextile', 'trine'].includes(row?.aspect));
  return '本命火星与本命' + bodies[p.natalTargetId] + '的直接偏顺相位为'
    + (direct.map(leoNatalAspectText).filter(Boolean).join('、') || '未见') + weakNotice(direct) + '，实际缓和程度仍须核';
}
function leoAspectLabel(type) {
  return type === 'parallel' ? '赤纬绝对值平行' : aspects[type];
}
function solarNeptuneNatalEvidence(state) {
  return ({
    qualified: '本命海王星的相位及显著性均有已核依据，可参照原书的较明显体验',
    'no-reviewed-contact': '所核本命相位未见海王星接触，本段只取基础范围',
    'prominence-unreviewed': '已核海王星的本命相位，显著性仍待核，本段只取基础范围',
  })[state] ?? '';
}
function leoDirectionText(direction) {
  const body = bodies[direction?.body], target = bodies[direction?.target], aspect = leoAspectLabel(direction?.aspectType);
  if (!body || !target || !aspect || !['natal', 'progressed'].includes(direction.targetKind)) return '';
  return '次限' + body + '对' + (direction.targetKind === 'natal' ? '本命' : '同图次限') + target + '的' + aspect;
}

function leoBridgeText(bridge) {
  const direction = leoDirectionText(bridge?.direction);
  const baseContact = leoDirectionText(bridge?.baseContact), otherContact = leoDirectionText(bridge?.otherContact);
  if (!direction || !baseContact || !otherContact) return '';
  return '同段月亮连接本条与' + direction + '，凭据为' + baseContact + (baseContact === otherContact ? '' : '及' + otherContact);
}
const timingOrigins = { ASC: '本命上升点', MC: '本命天顶', Sun: '本命太阳', Moon: '本命月亮', Fortune: '本命福点' };
const timingLevels = { year: '年', month: '月', day: '日' };
const signs = ['白羊座', '金牛座', '双子座', '巨蟹座', '狮子座', '处女座', '天秤座', '天蝎座', '射手座', '摩羯座', '水瓶座', '双鱼座'];

function leoAngularSameSignGroupText(group) {
  if (!group || ![1, 4, 7, 10].includes(group.house) || !signs[group.sign]) return '';
  const names = list(group.bodies).flatMap(body => bodies[body] ? [bodies[body]] : []);
  return names.length >= 4 ? names.join('、') + '同在本命' + signs[group.sign] + '第' + group.house + '角宫' : '';
}
const list = value => Array.isArray(value) ? value : [];
const text = value => typeof value === 'string' ? value : '';
const chinese = value => /\p{Script=Han}/u.test(text(value)) ? value : '';
const number = value => typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const degrees = value => number(value) === undefined ? '' : Number(value.toFixed(6)) + '°';
function leoTransitDeclinationText(witness) {
  return degrees(witness?.difference) ? '精确过点时行运赤纬' + degrees(witness.transitDeclination)
    + '，本命赤纬' + degrees(witness.natalDeclination) + '，南北实差' + degrees(witness.difference) : '';
}
const sentences = values => values.filter(Boolean).join('；');
const refs = values => list(values).filter(value => /^F\d+$/u.test(text(value))).join('、');

function leoFinancialRoleText(roles) {
  const labels = { second_house_occupants: '本命二宫实居星', empty_second_house_ruler: '本命二宫空宫时的宫主',
    named_financial_pair: '同作者所列且涉及二宫或十宫主的财务星对成员' };
  return list(roles).map(role => labels[role]).filter(Boolean).join('、');
}

function leoLunarHousePremises(p) {
  const natureLabels = { favourable: '偏顺', adverse: '偏难', conditional: '取义依情境' };
  const natures = list(p.lunarAspectNatures).map(nature => natureLabels[nature]).filter(Boolean);
  const exactNatures = list(p.lunarExactAspectNatures).map(nature => natureLabels[nature]).filter(Boolean);
  const rulerPair = p.rulerPair;
  const ninth = p.ninthRulers;
  const voyage = p.ninthVoyage;
  const finances = p.eighthFinance;
  const review = contacts => leoNatalContactLabels(contacts).join('、') || '未检出';
  const screenedAspects = '本命四分、对分、半刑或倍半刑';
  const placementText = (row, house, topics) => {
    const topic = topics[row?.body];
    if (row?.house !== house || !topic) return [];
    return ['本命' + bodies[row.body] + '实居第' + house + '宫，Leo与Green将这一位置与' + topic + '相联',
      list(row.support).length ? '已核本命六合或三分为' + review(row.support) : '',
      Array.isArray(row.afflictions) ? '参考外限内的' + screenedAspects + '为' + review(row.afflictions) : ''];
  };
  return sentences([
    natures.length ? '当前过宫盘层内，已列月亮相位有' + natures.join('、') : '',
    exactNatures.length ? '这段宫内同层月亮实际精确成相，来源取义为' + exactNatures.join('、') : '',
    ...list(p.secondFinance?.contacts).flatMap(contact => {
      const relation = leoAspectLabel(contact?.aspectType), target = bodies[contact?.target];
      const roles = leoFinancialRoleText(contact?.roles);
      return relation && target && roles && natureLabels[contact.nature]
        ? ['次限月亮过二宫时与本命' + target + '形成' + relation + '，原书倾向' + natureLabels[contact.nature]
          + '，受照星属' + roles] : [];
    }),
    ...list(p.literaryPlacements).flatMap(placement => placement?.body === 'Mercury' && [3, 9].includes(placement.house)
      ? ['Leo与Green的本命说明将实际第' + placement.house + '宫的水星与写作相联，可作过二宫期间的写作候选依据']
      : placement?.body === 'Neptune' && placement.house === 3
        ? ['Leo与Green的本命说明将实际第三宫的海王星与想象和小说写作相联，可作过二宫期间的创作候选依据'] : []),
    ...list(p.domesticPlacements).flatMap(row => row?.house === 4 && ['Mercury', 'Uranus', 'Moon'].includes(row.body)
      ? ['本命' + bodies[row.body] + '实居第四宫' + (row.body === 'Moon' ? '，在参考外限内未见已列受克相位' : '')
        + '，Leo与Green将这一位置与家宅或迁居相联'] : []),
    ...list(p.sixthServicePlacements).flatMap(row => placementText(row, 6, {
      Moon: '受雇与服务关系', Mercury: '替他人办理事务', Saturn: '管理职责与受雇工作',
    })),
    ...list(p.twelfthPrivatePlacements).flatMap(row => placementText(row, 12, {
      Sun: '安静或私下工作', Moon: '独处与公益活动', Jupiter: '互助与公益', Uranus: '私下兴趣与研究',
    })),
    ...[['家宅迁居', p.relocationDirections], ['情感与依恋', p.attachmentDirections], ['投资与投机', p.speculationDirections],
      ['受雇与服务关系', p.serviceDirections], ['阅读与内在反思', p.reflectionDirections],
      ['玄学与内在体验', p.eighthOccultDirections], ['职业与上级', p.careerDirections], ['家宅安排', p.familyDirections],
      ['朋友与交往', p.friendshipDirections]].flatMap(([topic, directions]) => list(directions).flatMap(direction => {
        const label = leoDirectionText(direction);
        const nature = natureLabels[direction?.nature];
        return label && nature && direction.targetKind === 'natal'
          ? [topic + '的同期依据为' + label + '，该议题在原书此项' + nature] : [];
      })),
    ...list(finances?.matchedNatures).flatMap(nature => {
      const topic = { favourable: '遗产议题的偏顺', adverse: '伴侣财务议题的偏难' }[nature];
      const contacts = leoNatalContactLabels(list(finances?.natalAspects).filter(row => row?.nature === nature));
      return topic && contacts.length ? [topic + '本命依据为月亮实居第八宫，' + contacts.join('、')
        + '，与本片段月亮相位的这一取义同向'] : [];
    }),
    ...list(p.careerPlacements).flatMap(row => {
      if (!bodies[row?.ruler]) return [];
      const placement = row.ruledHouse === 1 && row.house === 10 ? '一宫主' + bodies[row.ruler] + '实居第十宫'
        : row.ruledHouse === 10 && row.house === 1 ? '十宫主' + bodies[row.ruler] + '实居第一宫' : '';
      return placement ? ['本命' + placement + '，是Leo与Green列出的职业与公众地位候选依据'] : [];
    }),
    Array.isArray(p.mercuryAfflictions) ? '同作者1928年参考外限内，水星参与的' + screenedAspects + '为' + review(p.mercuryAfflictions) : '',
    Array.isArray(rulerPair?.natalAspects) ? '按同作者1928年本命参考外限，两颗宫主直接相位为' + review(rulerPair.natalAspects) : '',
    Array.isArray(rulerPair?.firstAfflictions) ? '一宫主参与的' + screenedAspects + '为' + review(rulerPair.firstAfflictions) : '',
    Array.isArray(rulerPair?.seventhAfflictions) ? '七宫主参与的' + screenedAspects + '为' + review(rulerPair.seventhAfflictions) : '',
    bodies[ninth?.natalRuler] && Array.isArray(ninth.natalAspects) ? '固定本命第九宫主为' + bodies[ninth.natalRuler]
      + '，在同作者本命参考外限内参与的相位为' + review(ninth.natalAspects) : '',
    bodies[ninth?.progressedRuler] && signs[ninth.progressedCuspSign] ? '所用年度次限图的第九宫头在'
      + signs[ninth.progressedCuspSign] + '，宫主是' + bodies[ninth.progressedRuler] : '',
    ...list(ninth?.progressedAspects).map(leoDirectionText).filter(Boolean).map(label => '本段涉及年度次限第九宫主的相位为' + label),
    ...list(voyage?.matchedNatures).flatMap(nature => {
      if (!['favourable', 'adverse'].includes(nature)) return [];
      const natalAspects = list(voyage.natalAspects).flatMap(row => row?.house === 9 && ['Sun', 'Moon'].includes(row.body) && row.nature === nature
        ? leoNatalContactLabels([row]).map(label => '本命' + bodies[row.body] + '实居第九宫，' + label) : []);
      const directions = list(voyage.directions).filter(row => row?.nature === nature).map(leoDirectionText).filter(Boolean);
      return natalAspects.length && directions.length
        ? ['远行的' + natureLabels[nature] + '本命依据为' + natalAspects.join('、') + '，同期有' + directions.join('、')] : [];
    }),
    ...list(p.favourableNatalTargets).flatMap(row => bodies[row?.body] && Array.isArray(row.afflictions)
      ? ['同段月亮偏顺照到本命' + bodies[row.body] + '，该星在参考外限内参与的' + screenedAspects + '为' + review(row.afflictions)] : []),
  ]);
}

function ptolemyParentRulers(p) {
  return sentences([
    (p.level === 'month' || p.level === 'day') && signs[p.annualSign] && bodies[p.annualRuler]
      ? '所承年级星座是' + signs[p.annualSign] + '，守护星是' + bodies[p.annualRuler] : '',
    p.level === 'primary' && signs[p.annualSign] && bodies[p.annualRuler]
      ? '同一起点在这个时段的年度星座是' + signs[p.annualSign] + '，年度守护星是' + bodies[p.annualRuler] : '',
    p.level === 'day' && signs[p.monthSign] && bodies[p.monthlyRuler]
      ? '所承月级星座是' + signs[p.monthSign] + '，守护星是' + bodies[p.monthlyRuler] : '',
  ]);
}

function ptolemyNatalRulers(p) {
  const g = p.natalGovernors;
  if (!g || !signs[g.sign] || !bodies[g.domicileRuler]) return '';
  const triplicity = list(g.triplicityRulers).map(planet => bodies[planet]).filter(Boolean).join('、');
  return sentences([
    '本命起算点在' + signs[g.sign] + '，守护星是' + bodies[g.domicileRuler],
    bodies[g.exaltationRuler] ? '原位擢升主是' + bodies[g.exaltationRuler] : '',
    triplicity ? '已核原位三分主为' + triplicity : '',
    g.natalSect === 'day' ? '本命太阳在地平线上方，取昼生'
      : g.natalSect === 'night' ? '本命太阳在地平线下方，取夜生' : '本命昼夜派别未核定',
    bodies[g.term?.ruler] && degrees(g.term.start) && degrees(g.term.end)
      ? '原位按埃及表落在' + degrees(g.term.start) + '至' + degrees(g.term.end) + '的' + bodies[g.term.ruler] + '界，截止度数归下一界' : '',
    bodies[g.authorTerm?.ruler] && degrees(g.authorTerm.start) && degrees(g.authorTerm.end)
      ? '同一本命原位按托勒密表落在' + degrees(g.authorTerm.start) + '至' + degrees(g.authorTerm.end) + '的' + bodies[g.authorTerm.ruler] + '界' : '',
  ]);
}

function ptolemyIngressRelation(p) {
  const roles = { domicile: '守护', exaltation: '擢升', triplicity: '三分', egyptian_term: '埃及界' };
  const rulership = list(p.natalRulership).map(role => roles[role]).filter(Boolean).join('、');
  const fortune = p.natalFortuneRulerConditions;
  const fortuneMercury = fortune?.mercuryHorizon;
  const fortuneRoles = list(fortune?.ownPositionRulership).map(role => roles[role]).filter(Boolean).join('、');
  const familiarities = fortune?.ownPositionFamiliarities;
  const monthlyMercury = p.level === 'month' && p.transitBody === 'Mercury';
  const sameSect = monthlyMercury ? p.sameNatalMercuryHorizonSect === true : p.oppositeNatalSect === false;
  return sentences([
    aspects[p.natalOriginAspect] ? '该天体在本命与起算原位构成整星座' + aspects[p.natalOriginAspect] : '',
    p.natalOriginSignFamiliarity === 'alien' && signs[p.natalTransitBodySign] && signs[p.natalGovernors?.sign]
      ? '该行运星的本命座' + signs[p.natalTransitBodySign] + '与起算原位' + signs[p.natalGovernors.sign] + '按原书列为异质座' : '',
    ...[[p.annualOriginAspect, '年级时限星座', '本命起算点'], [p.monthlyOriginAspect, '月级时限星座', '本命起算点'],
      [p.transitAnnualAspect, '过境星座', '年级时限星座'], [p.transitMonthlyAspect, '过境星座', '月级时限星座'],
      [p.annualTransitNatalOriginAspect ?? p.transitNatalOriginAspect, '过境星座', '本命起算点']]
      .filter(([aspect]) => aspects[aspect]).map(([aspect, from, to]) => from + '与' + to + '构成整星座' + aspects[aspect]),
    p.level === 'month' && sameSect && p.aspectType === 'opposition' && p.transitNatalOriginAspect === 'opposition'
      && ['sextile', 'trine'].includes(p.natalOriginAspect) ? '本命原有和谐相位，实际过境同时对原位与月级位置成对分，按原书另列偏难候选' : '',
    rulership && bodies[p.transitBody] ? bodies[p.transitBody] + '在本命以' + rulership + '掌原位' : '',
    p.annualClockComparisonProfile === 'ptolemy-almagest-III1-mean-and-egyptian-year-v1'
      ? p.annualClockAgreement === 'three-year-counts-agree' ? '三种年长计数一致'
        : p.annualClockAgreement === 'year-counts-differ' ? '三种年长计数出现分歧' : '' : '',
    p.subperiodClockComparisonProfile === 'ptolemy-IV10-three-year-anchors-fixed-subperiods-v1'
      ? p.subperiodClockAgreement === 'same-index' ? '三个年度起点在此段推得同一子期'
        : p.subperiodClockAgreement === 'different-index' ? '三个年度起点在此段的子期有分歧' : '' : '',
    p.level === 'month' && p.sameAsMonthlyLord === true && p.aspectType === 'conjunction'
      ? '实际过境星兼为该二十八日月位的守护星' : '',
    p.level === 'day' && p.sameAsDailyLord === true && p.dayManuscriptAgreement === 'same-place' && p.dayManuscriptMoonContact === true
      ? '实际过境的月亮也守护两种读法共同的日位星座' : '',
    p.level === 'year' && p.sameAsAnnualLord && p.aspectType === 'conjunction' && rulership
      ? '实际过境星兼为年级守护星，且同星掌本命起算点' : '',
    p.level === 'year' && p.origin === 'Fortune' && p.sameAsAnnualLord === true && p.aspectType === 'conjunction'
      && p.sameAsNatalMaterialSignRuler === true && p.hasNatalFortuneSameSectHarmoniousWitness === true
      ? list(fortune?.witnesses).filter(row => row.relation === 'same'
        && ['sextile', 'trine'].includes(row.aspect) && bodies[row.body]).map(row =>
        '本命' + bodies[row.body] + '与福点守护星同派并成整星座' + aspects[row.aspect] + '，与实际年度同主过境同参').join('。') : '',
    p.origin === 'Fortune' && p.sameAsNatalMaterialSignRuler === true && p.aspectType === 'conjunction'
      && (p.termCoRulerIngress === true || p.level === 'primary' && p.sameAsPrimaryDirectionRuler === true
        || p.level === 'year' && (p.sameAsAnnualLord === true || p.sameAsPrimaryDirectionRuler === true))
      ? '按《占星四书》卷四第二章，过境星也是本命福点所在星座的守护星，为财产议题的一项本命依据' : '',
    ...list(p.natalFortuneLordLuminaryContacts).flatMap(row => bodies[row?.body] && aspects[row?.aspect] && signs[row?.sign]
      ? ['本命' + bodies[row.body] + '在' + signs[row.sign] + '，与本命福点守护星成整星座' + aspects[row.aspect]
        + '。日月见证的方向与守护星强弱仍待核'] : []),
    fortune && signs[fortune.rulerSign] && bodies[p.transitBody] ? '本命福点守护星' + bodies[p.transitBody]
      + '本人位于' + signs[fortune.rulerSign] + (fortuneRoles ? '，在该本命位置有' + fortuneRoles + '掌权' : '') : '',
    ...[['egyptian', '埃及界表'], ['author', '托勒密界表']].flatMap(([table, title]) => {
      if (familiarities?.profile !== 'robbins-I.23-same-table-familiarities-v1') return [];
      const choice = familiarities[table];
      const names = list(choice?.roles).map(role => role === 'term' ? '界' : roles[role]).filter(Boolean);
      return names.length ? ['福点守护星本命落座按' + title + '核实' + names.join('、')
        + (choice.multiple === true ? '，同一口径下有至少两项亲近条件' : '')] : [];
    }),
    ...list(fortune?.witnesses).flatMap(row => bodies[row?.body] && aspects[row?.aspect] && ['same', 'opposite'].includes(row?.relation)
      ? ['本命' + bodies[row.body] + '与福点守护星成整星座' + aspects[row.aspect]
        + (row.relation === 'same' ? '，与守护星同派' : '，与守护星异派')] : []),
    fortuneMercury?.phase === 'morning' ? '福点分析所涉水星按出生地日出地平核为晨水星，属昼派'
      : fortuneMercury?.phase === 'evening' ? '福点分析所涉水星按出生地日落地平核为昏水星，属夜派' : '',
    fortune?.witnessesComplete === false ? '其余本命七政未核齐，守护星的见证范围未完整' : '',
    p.sameAsPrimaryDirectionRuler === true ? '该过境星与本段主限星候选相同' : '',
    p.termCoRulerIngress === true
      ? '该行星同时是本段埃及界主，并实际行经' + (p.level === 'primary' ? '总体主限' : '年度') + '星座'
      : p.sameAsPrimaryTermRuler === true ? '该过境星与本段主限位置的埃及界主相同' : '',
    monthlyMercury && p.sameNatalMercuryHorizonSect === false ? '月级水星按本命晨昏地平与出生昼夜异派' : '',
    monthlyMercury && sameSect ? '月级水星按本命晨昏地平与出生昼夜同派' : '',
    !monthlyMercury && !(p.transitBody === 'Mercury' && fortuneMercury) && p.oppositeNatalSect === true
      ? '该天体与本命昼夜派别相反' : '',
    !monthlyMercury && !fortuneMercury && p.transitBody === 'Mercury' && p.planetSect ? '水星派别按本命黄经在太阳东西的候选口径' : '',
  ]);
}

function ptolemyPrimaryDirection(p) {
  const direction = p.primaryDirection;
  if (!direction || !timingOrigins[p.origin]) return '';
  const witnesses = list(direction.witnesses).flatMap(row => bodies[row.body] && aspects[row.aspect] && degrees(row.longitude)
    ? [bodies[row.body] + aspects[row.aspect] + '在黄经' + degrees(row.longitude)] : []);
  const term = direction.term;
  const meridian = direction.temporalMeridian === 'upper' ? '上中天' : direction.temporalMeridian === 'lower' ? '下中天' : '';
  const hours = number(direction.temporalHours);
  return sentences([
    p.origin === 'ASC' ? '从本命上升按当地斜升量取黄道投影主限候选'
      : p.origin === 'MC' ? '从本命中天按赤经差取黄道投影主限候选'
        : meridian && hours !== undefined ? '从' + timingOrigins[p.origin] + '按不等时小时取黄道投影主限候选，'
          + '相对' + meridian + (hours < 0 ? '偏东' : hours > 0 ? '偏西' : '') + Math.abs(hours).toFixed(4) + '个不等时小时' : '',
    witnesses.length ? '当前承接的本命相位射线为' + witnesses.join('、') : '',
    bodies[direction.ruler] ? '本段主限星候选为' + bodies[direction.ruler] : '同度有多颗候选，尚未选定唯一主限星',
    signs[direction.sign] && bodies[term?.ruler] && degrees(term.start) && degrees(term.end)
      ? '移动后的位置在' + signs[direction.sign] + '内' + degrees(term.start) + '至' + degrees(term.end) + '的埃及界，界主为' + bodies[term.ruler] : '',
  ]);
}

function printedLuckDescription(p) {
  if (p.confirmed !== true || !chinese(p.luckPillar)) return [];
  return list(p.printedLuck).flatMap(value => [value.name, value.premise, value.assessment].every(chinese)
    ? ['《子平真诠评注》对' + value.name + '一例' + value.premise + '，将所核的' + p.luckPillar + '运' + value.assessment] : []);
}

function officerDescription(p, at) {
  if (p.profile !== 'zpqz-officer-wealth-seal-output-targets-v1') return '';
  const position = key => layers[key] || (key === 'decadal' ? '本步大运' : '');
  const row = value => value && chinese(value.stem) ? position(value.position) + chinese(value.kind) + value.stem
    + '（' + (value.position === 'day' && value.kind !== '支藏' ? '日元' : chinese(value.god || value.tenGod)) + '）' : '';
  const known = value => value === true ? '已见' : value === false ? '完整已知范围未见' : '尚未核全';
  const contacts = (key, relation) => list(p[key]).map(value => row(value.from) + relation + row(value.to)
    + (number(value.columnDistance) !== undefined ? '；原局柱差' + value.columnDistance : '')
    + (list(value.between).length ? '，中隔' + value.between.map(v => position(v.position) + chinese(v.pillar)).join('、') : '')
    + '；仅核具名端点，不代表制护或通关已成功');
  const matches = id => list(p.printedCases).some(value => value.id === id && value.matches === true);
  const verifiedLuck = p.confirmed === true ? p : {};
  const officerExposure = verifiedLuck.officerExposureChecks;
  const hiddenClash = verifiedLuck.onlyHiddenMonthOfficerDirectLuckClash;
  const fanOutput = verifiedLuck.fanSourceYouOutputChallengesOfficer;
  const bodySupport = verifiedLuck.officerWealthBodySupport ?? verifiedLuck.officerSealBodySupport;
  const jin = verifiedLuck.jinSealComparison;
  const xueSource = verifiedLuck.xueSourceWealthOfficerSeal, zaqi = verifiedLuck.zaqiSourceOfficerAid;
  const xueRoots = verifiedLuck.xueSourceNatalOfficerWealthRoots, xueChou = verifiedLuck.xueSourceChouNorthernSeal;
  const xueFurther = verifiedLuck.xueSourceOfficerSealFurtherSupport;
  const xuan = verifiedLuck.xuanSealComparison, fanSeal = verifiedLuck.fanSourceSealChecksOutput;
  const li = verifiedLuck.liSourceOfficerSealReview;
  const pillarAt = key => position(key) + chinese(key === 'decadal' ? p.luckPillar : list(p.natalPillars).find(value => value.position === key)?.pillar);
  const overlappingSeals = list(p.overlappingSeals);
  return sentences([
    '以下正官取运位置来自同一本命候选与同一实际大运，不按官印财食的名称、颗数或根数判断强弱',
    chinese(p.dayMaster) ? '日主为' + p.dayMaster : '',
    list(p.natalPillars).map(value => position(value.position) + chinese(value.pillar)).join('、'),
    '月令支藏十神为' + list(p.monthHiddenGods).filter(chinese).join('、') + '；含官不等于官格取用已经成立',
    ...list(p.gods).map(value => chinese(value.god) + '明透' + known(value.exposed) + '：' + list(value.exposedRows).map(row).join('、')
      + '；支藏' + known(value.hidden) + '：' + list(value.hiddenRows).map(row).join('、')),
    '日元不作为另一位外透比肩；时柱未知时不能把未见印、财或食伤当作全局无此神',
    ...contacts('wealthOfficerContacts', '生'), ...contacts('officerSealContacts', '生'), ...contacts('outputOfficerContacts', '克'),
    ...contacts('sealOutputContacts', '克'), ...contacts('wealthSealContacts', '克'), ...contacts('sealDayMasterContacts', '生'),
    ...contacts('dayOutputContacts', '生'),
    li ? '李参政原评取年庚合月乙，原局申子辰水势和印位另核' : '',
    li?.repeatedKillerCombination ? '来运庚七杀也合月乙，原评按两庚合乙判七杀混局' : '',
    li?.incomingSeal ? '李参政原评所列亥子丑印运，本步实见' + row(li.incomingSeal) + '生日元' : '',
    ...list(p.movingRows).map(value => '实际本运成分为' + row(value) + '；运干和每个运支藏干分开，不把藏干当运干明透'),
    ...list(p.movingContacts).map(value => row(value.from) + chinese(value.relation) + row(value.to) + '；运来对原局的关系，不据此认定有效制护'),
    ...list(p.natalMovingContacts).map(value => row(value.from) + chinese(value.relation) + row(value.to) + '；原局对运来成分的关系，不据此认定已回克或泄官'),
    ...list(verifiedLuck.wealthOfficerSealPaths).slice(0, 6).map(value => '同一路财官运印关系为' + row(value.wealth)
      + '生' + row(value.officer) + '，该官生' + row(value.seal) + '，同一原财对这处运印还有五行克向'
      + (value.combines === true ? '。同一原财与运印也有天干五合' : '') + '。取财生官及运印泄官的实际作用仍待核'),
    ...list(verifiedLuck.wealthFedOfficerUnderOutput).map(({ moving, officer, wealthSources, sealsFacingOutput }) =>
      list(wealthSources).map(value => row(value.wealth)).join('、') + '生同一个' + row(officer) + '，' + row(moving) + '克此正官'
      + (list(wealthSources).some(value => value.fedByOutput === true) ? '。该运食伤也有生这些原财的方向' : '')
      + (list(sealsFacingOutput).length ? '。原局另有' + sealsFacingOutput.map(row).join('、') + '克同一运食伤' : '。完整原局透藏皆未见印')
      + '。克官、生财和可能的护官效果须分别合参'),
    ...list(verifiedLuck.wealthSupportingOfficerSeal).map(value => '财官印的相生候选：' + row(value.wealth) + '生'
      + row(value.through) + '，同一运成分再生' + row(value.seal)
      + (list(value.between).length ? '；原局两干之间有' + value.between.map(v => position(v.position) + chinese(v.pillar)).join('、') : '；原局两干相邻')
      + (value.combines === true ? '；这对原局财印也有天干五合' : '')
      + (value.wealthControlsSeal === true ? '。同一原财对原印另有克向' : '')
      + (value.sealFeedsDay === true ? '。同一原印有生' + chinese(p.dayMaster) + '日元的方向' : '')
      + (value.movingControlsDay === true ? '。同一运官杀也有克日元的方向，实际通关效果仍待核' : '。实际通关效果仍待核')),
    verifiedLuck.zaqiInactiveWealthSeal ? '杂气原评的年壬财与月丁印同合而失用，排除以同一对财印作通关的候选' : '',
    verifiedLuck.hasMonthOfficerVisibleLuckConflict === true ? '月藏同干是原局唯一明官，本运与该官实际有原书所列合官、杂煞或重官关系' : '',
    hiddenClash ? '实际运支六冲月令，' + row(hiddenClash.officer) + '为唯一原局藏官，和' + row(hiddenClash.movingOfficer)
      + '同干。按徐注暂排本运财官印及财官助力的正向候选' : '',
    fanOutput ? '范图丁酉运补齐巳酉丑，' + row(fanOutput.movingOutput) + '克' + row(fanOutput.officer)
      + '。按原评排此段护官候选，丁干助印另列' : '',
    ...list(officerExposure?.combines).map(value => row({ ...value.moving, kind: '运干' }) + '与明透原官'
      + row(value.target) + '有五合位置，是否合去仍须核'),
    ...list(officerExposure?.authority).map(value => row(value.moving) + '与' + row(value.officer)
      + '呈' + chinese(value.route) + '，实际官杀取用仍须核'),
    ...list(verifiedLuck.monthOfficerWealthPaths).flatMap(path => [
      '原局的' + list(path.nativeWealth).map(row).join('、') + '生同一月令官位' + row(path.officer),
      ...list(path.movingWealth).map(value => row(value) + '也有生这处' + row(path.officer) + '的方向'),
      ...list(path.movingOfficer).map(value => row(value) + '与' + row(path.officer) + '同干，实际助官待核'),
      ...list(path.movingOutput).map(value => row(value) + '也有克这处' + row(path.officer) + '的方向'),
    ]),
    ...list(bodySupport?.peers).map(value => row(value) + '与' + row(bodySupport.day) + '同属日元五行，列扶身候选'),
    ...list(bodySupport?.seals).map(value => row(value) + '生' + row(bodySupport.day) + '，列扶身候选'),
    bodySupport?.luSeat ? row(bodySupport.luSeat) + '与' + row(bodySupport.day) + '同干，实际运支到日禄位' : '',
    ...list(xueRoots?.officerRoots).map(root => '薛例庚官的' + chinese(root.phase) + '位实在' + row(root)),
    ...list(xueRoots?.wealthRoots).map(root => '薛例戊财的' + chinese(root.phase) + '位实在' + row(root)),
    xueChou ? '薛例实交丁丑时，丑中余藏癸偏印生乙日元。另见' + row(xueChou.output) + '、' + row(xueChou.mainQi) : '',
    verifiedLuck.officerWealthNamedStrong === true ? '完整四柱与杂气正官取运原图一致，徐注判该例日元当旺、官稍轻，按原例读助官' : '',
    ...list(verifiedLuck.monthOfficerSealPaths).flatMap(path => [
      '佩印候选见' + row(path.officer) + '生' + row(path.seal) + '，同一原印再生' + row(path.day),
      ...list(path.movingWealth).map(value => row(value) + '有克这处' + row(path.seal) + '的方向，损印或破印须按原局取用核对'),
    ]),
    verifiedLuck.officerSealNamedStrong === true ? '完整四柱与金状元原图一致，徐注判该例身旺印重，按原例读财食与官杀运' : '',
    jin?.woodGroup?.nativeComplete === true ? '金例原局亥卯未三支具备，实际化官为印仍须核。时干庚财的原局金气见'
      + list(jin.natalMetalRoots).map(row).join('、') : '',
    ...list(jin?.movingMetalRoots).map(value => row(value) + (value.stem === jin.wealth.stem ? '与原局时庚同干' : '与原局时庚同金异干')),
    list(jin?.jiaHiddenRoots).length ? '金例原局仍有' + list(jin.jiaHiddenRoots).map(row).join('、')
      + '的位置，徐注所论甲木的有效根气须另核' : '',
    ...list(jin?.southernBridges).map(value => '金例该南方运里' + row(value.wealth) + '生' + row(value.through)
      + '，再生' + row(value.seal) + '，与评注的泄财生印方向相应'),
    ...list(verifiedLuck.counterfactualWealthSeal).map(value => '薛例的己酉年反设中，' + row({ ...value.moving, kind: '运干' }) + '合'
      + row(value.wealth) + '，同一原财有克' + row(value.seal) + '的方向，实际是否破印仍须核'),
    ...list(verifiedLuck.xueXuWealth).map(value => '薛例甲戌运中，' + row(value.from) + '克' + row(value.to)
      + (value.companionControlsWealth === true ? '，同一戌土也受本步运干甲克' : '') + '，两种原文判语各自保留'),
    ...list(verifiedLuck.xueHaiClashes).map(value => '薛例乙亥运有' + list(value.members).map(pillarAt).join('与') + chinese(value.kind)),
    ...list(verifiedLuck.xueYinShenClashes).map(value => '薛例两寅冲申的实位见' + list(value.members).map(pillarAt).join('与') + '六冲'),
    ...list(verifiedLuck.luckOutputFeedsWealth).map(value => '运食伤候选：' + row(value.day) + '生' + row(value.output)
      + (list(value.wealth).length ? '，再生' + value.wealth.map(row).join('、') : '；原局和同运未见可接续的财端点')),
    ...list(verifiedLuck.luckSealControlsOutput).map(value => '运印制食伤候选：' + row(value.seal) + '生'
      + row(value.day) + '并克' + row(value.output)),
    ...list(verifiedLuck.luckOfficerFeedsSeal).map(value => '运官杀生印候选：' + row(value.officer) + '生'
      + row(value.seal) + '，同一原局印克' + row(value.output)),
    ...list(verifiedLuck.officerSealProtectionPaths).filter(path => list(path.movingAuthority).length
      || list(path.movingSeals).length || list(path.movingWealth).length).slice(0, 8).map(path => sentences([
      row(path.output) + '克' + row(path.officer) + '，同一月官生' + row(path.seal) + '，该原印克这处食伤并生' + row(path.day),
      list(path.movingAuthority).length ? list(path.movingAuthority).map(row).join('、') + '生同一原印' + row(path.seal) : '',
      list(path.movingSeals).length ? list(path.movingSeals).map(row).join('、') + '克同一食伤并生日元' : '',
      list(path.movingWealth).length ? list(path.movingWealth).map(row).join('、') + '有克这处原印的方向，实际护官仍须核' : '',
    ])),
    overlappingSeals.length ? '分布在不同柱的实际印位为' + overlappingSeals.map(row).join('、')
      + '；其中明透' + (overlappingSeals.filter(value => value.kind === '透干').map(row).join('、') || '未见')
      + '；印位数量用于核重叠结构，印重和取用仍待核' : '',
    ...list(verifiedLuck.sealOverlapWealthPaths).map(path => sentences([
      row(path.moving) + '分别有克' + list(path.affectedSeals).map(row).join('、') + '的方向',
      list(path.fedByOutput).length ? list(path.fedByOutput).map(row).join('、') + '也有生同一运财的方向' : '',
      ...list(path.stillFedByMovingAuthority).map(value => row(value.authority) + '同运生这处原印' + row(value.seal)),
      '印重、取食伤及损印的实际效果仍须核',
    ])),
    xuan?.woodGroup?.nativeComplete === true ? '宣例原局亥卯未实位俱在' + (xuan.yinHai ? '，原局还有'
      + list(xuan.yinHai.members).map(pillarAt).join('与') + '六合' : '')
      + '。徐注在原例取' + list(xuan.xinSeals).map(row).join('、') + '制伤滋身，实际成化仍待核' : '',
    xuan && p.luckPillar === '丁卯' && list(verifiedLuck.officerSealProtectionPaths)
      .some(path => list(path?.movingWealth).some(value => value?.kind === '运干' && value.stem === '丁'))
      ? '宣参国原例交入丁卯后，运干丁财克原局辛印，按原评排除这一运的护印分支' : '',
    ...list(p.natalFivePairs).map(value => '原局五合位置：' + row(value.first) + '与' + row(value.second) + '，柱差' + value.distance
      + (value.involvesDayMaster ? '；包含日元自身，不当作另一外透比劫' : '') + '；不直接认作财印两失、合去或合化'),
    ...list(p.movingFivePairs).map(value => '实际运干' + row(value.moving) + '五合对象' + row(value.target)
      + (value.targetIsDayMaster ? '；对象是日元自身' : '') + '；大运不虚构为第五柱，合去及成化未核'),
    ...list(p.hiddenFivePairs).map(value => '不同支的实际藏干五合候选：' + row(value.first) + '与' + row(value.second)
      + '；这是两个藏干的关系，不把卯申称为地支六合，也不据此宣称暗合有效'),
    ...list(p.officerBranchRelations).map(value => '涉及原局官所在柱的干支关系为' + chinese(value.kind) + '，实际参与位置'
      + list(value.members).map(position).filter(Boolean).join('、') + '；藏官之支和露官之干仍分开，不由刑冲形式定损用'),
    ...list(p.threeCombinationGroups).map(value => '三合成员' + chinese(value.values) + '：' + list(value.members).map(v => chinese(v.branch)
      + '在原局' + (list(v.natalPositions).map(position).filter(Boolean).join('、') || '已知柱未见') + (v.luckPresent ? '且本运支有' : '且本运支未有')).join('；')
      + (value.nativeComplete === true ? '；原局成员已齐' : value.nativeComplete === false ? '；原局成员未齐' : '；原局尚有未知时柱')
      + (value.complete === true ? '；含本运成员齐全' : value.complete === false ? '；含本运仍未齐' : '；含本运的齐全性未核')
      + '；成员齐全不等于已化官为印或化官为伤，巳丑缺酉不补造酉'),
    ...list(p.roots).map(value => '干' + chinese(value.stem) + '的根位：' + (list(value.roots).map(v => position(v.position) + chinese(v.pillar)
      + (v.exactStem ? '同干藏气' : '同五行异干藏气')).join('、') || (p.timeKnown ? '本局与运支未见同五行藏气' : '已知范围未见，时柱未核')) + '；根位不替代有效轻重'),
    chinese(p.luBranch) ? '日干禄位坐标为' + p.luBranch + '，原局位置' + (list(p.natalLuPositions).map(v => position(v.position) + chinese(v.pillar)).join('、') || '已知范围未见')
      + (p.luckAtLu ? '；本运支到该位' : '；本运支未到该位') + '；禄位不等于帮身已经有效' : '',
    ...list(p.printedCases).flatMap(value => value.matches === true ? ['四柱逐柱符合录文' + chinese(value.name) + '图：'
      + list(value.pillars).filter(chinese).join('、') + '；不是历史人物身份或生日认定'] : []),
    ...printedLuckDescription(p),
    ...list(p.sourceVariants).flatMap(value => matches('zaqi') ? ['来源异文：' + chinese(value.issue)] : []),
    xueSource ? '薛例癸酉的同一财官印路径是' + row(xueSource.wealth) + '生' + row(xueSource.through)
      + '，再生' + row(xueSource.seal) + '，财印中隔' + list(xueSource.between).map(value => pillarAt(value.position)).join('、') : '',
    verifiedLuck.xueSourceBodySupport ? '薛例原评所取的这步助身成分为' + row(verifiedLuck.xueSourceBodySupport) : '',
    xueFurther ? '薛例原月官' + row(xueFurther.officer) + '生月印' + row(xueFurther.seal)
      + '，月印生日元' + row(xueFurther.day) + '；同运另核助身位置' + row(xueFurther.moving) : '',
    xueFurther?.route === 'yi-hai-seal-peer' ? '薛例实排乙亥，亥本气壬印与运干同日干的乙分别扶助，运亥同时冲日巳并害原年月申' : '',
    matches('xue') ? '薛相公图原评取助身，通常身旺时才用的财官和财食方向在此留作位置对照' : '',
    verifiedLuck.officerSealOutputNamedForRestraint === true ? '宣参国图原评用辛印制伤，运财对同一印的克向继续留证' : '',
    verifiedLuck.fanWealthConversion?.join?.values === '丁壬'
      ? '范太傅原图的年丁与月壬实合，徐注作财化为官。原月寅中甲及两处原印分别留位' : '',
    verifiedLuck.fanBranchWealth ? '范例本步支财' + row(verifiedLuck.fanBranchWealth.wealth)
      + '生原月藏官' + row(verifiedLuck.fanBranchWealth.officer) + '，该官再生时印' + row(verifiedLuck.fanBranchWealth.seal) : '',
    fanSeal ? '范例实际' + row(fanSeal.seal) + '回克同一步' + row(fanSeal.output)
      + '，该运干也实际克' + row(fanSeal.officer) + '，按徐注取印护官' : '',
    verifiedLuck.fanSourceOfficerSealSupport ? '范例实运助日的成分为' + row(verifiedLuck.fanSourceOfficerSealSupport.moving)
      + (verifiedLuck.fanSourceOfficerSealSupport.outputGroup ? '，丁酉支的伤官组合另核' : '') : '',
    zaqi ? '杂气原图的实际运支水财' + list(zaqi.movingWealth).map(row).join('、') + '生同一月令所藏官' + row(zaqi.officer) : '',
    list(verifiedLuck.jinSourceWealthTrimsSeal).length ? '金状元原评所取的实际运支金财为'
      + verifiedLuck.jinSourceWealthTrimsSeal.map(row).join('、') + '，同查年透乙印和月藏甲印' : '',
    matches('xue') ? '薛图官藏申而未明透，财印均明透；同段戌运不伤印与戌运破印两种评语并存，不择一消除分歧' : '',
    matches('xue') ? '原文另反设己酉年；反设不是当前甲申年原局，也不把原局或运干甲与己财之合改名为直接合印' : '',
    p.counterfactual?.matches === true ? '当前逐柱符合原文己酉年反设图，此图只是反设比较，不声称其为薛例已核生日；甲运五合目标仍按实际己财说明' : '',
    '财印并透不要求官也明透；官带食伤用印须核实际印，印重用食伤须核实际食伤，不能漏掉共同前提',
    '金例官化印、宣例官化伤与范例巳丑会金的正文和评注承接分别留存；不以三合成员或两个藏干五合代替已化',
    '身旺印重喜财食与官重身轻喜比印是相反分支；护官、泄官、混杀、合官及调候效果与作用起止仍待核',
    chinese(p.luckPillar) ? '实际大运' + p.luckPillar + '，运干十神为' + chinese(p.luckTenGod) + '，产品运支首藏十神为'
      + chinese(p.luckBranchMainQiGod) + '；各自留位，不代原文未明方气或五年分段' : '',
    p.stageStart && p.stageEnd ? '完整实际运段为' + at(p.stageStart) + '至' + at(p.stageEnd) + '，截止不计入' : '',
  ]);
}

function wealthDescription(p, at) {
  if (p.profile !== 'zpqz-wealth-visible-food-seal-and-killer-targets-v1') return '';
  const row = value => value && chinese(value.stem) ? (layers[value.position] || (value.position === 'decadal' ? '本步大运' : ''))
    + chinese(value.kind) + chinese(value.stem) + '（' + (value.position === 'day' && value.kind !== '支藏' ? '日元' : chinese(value.god || value.tenGod)) + '）' : '';
  const contacts = (key, relation) => list(p[key]).map(value => row(value.from) + relation + row(value.to)
    + '；原局柱差' + value.columnDistance
    + (list(value.between).length ? '，中隔' + value.between.map(v => (layers[v.position] || '') + chinese(v.pillar)).join('、') : '')
    + '；这是生克端点与位置，作用成败未核');
  const match = id => list(p.printedCases).some(value => value.id === id && value.matches === true);
  const paths = p.confirmed === true ? p.monthWealthLuck : undefined;
  const wuFoodContrast = paths?.wuFoodSealSourceContrast;
  const remedies = p.confirmed === true ? p.wealthRemedyLuck : undefined;
  const pingjiang = remedies?.pingjiangFoodSealComparison;
  const roadDirector = remedies?.roadDirectorReviewedSealSupport;
  const linked = (values, label) => list(values).map(value => label + '：' + row(value.from) + '生' + row(value.to));
  return sentences([
    chinese(p.dayMaster) ? '日主为' + p.dayMaster : '',
    list(p.natalPillars).map(value => (layers[value.position] || '') + chinese(value.pillar)).join('、'),
    '月令支藏十神为' + list(p.monthHiddenGods).filter(chinese).join('、') + '，月令含财仅是财格位置候选，不等于财为实际用神',
    ...list(p.gods).map(value => chinese(value.god) + '：明透位置' + (list(value.exposedRows).map(row).join('、')
      || (p.timeKnown ? '未见' : '已知三柱未见，时柱未知')) + '；支藏位置' + (list(value.hiddenRows).map(row).join('、')
      || (p.timeKnown ? '未见' : '已知三柱未见，时柱未知'))),
    ...contacts('wealthOfficerContacts', '生'), ...contacts('foodWealthContacts', '生'), ...contacts('hurtWealthContacts', '生'),
    ...contacts('companionOutputContacts', '生'), ...contacts('outputKillerContacts', '克'),
    ...contacts('sealOutputContacts', '克'), ...contacts('wealthSealContacts', '克'), ...contacts('killerSealContacts', '生'),
    ...contacts('sealDayMasterContacts', '生'),
    ...list(p.foodSealPairs).map(value => '食印均明透：' + row(value.from) + '与' + row(value.to) + '，柱差' + value.columnDistance
      + (list(value.between).length ? '，中隔' + value.between.map(v => (layers[v.position] || '') + chinese(v.pillar)).join('、') : '')
      + '；日干仍是日元，不另计为一位外透比肩；隔位不单独证明食印不相碍'),
    ...list(p.roots).map(value => '干' + chinese(value.stem) + '的根位见证：' + (list(value.roots).map(v => (layers[v.position] || '本步大运')
      + chinese(v.pillar) + (v.exactStem ? '同干藏气' : '同五行异干藏气')).join('、') || (p.timeKnown ? '本局与本运支未见同五行藏气' : '已知范围未见，时柱未核'))
      + '；根位不是轻重或有效力量评分'),
    ...list(p.killPairs).map(value => '原局五合的七杀对象为' + row(value.target) + '，配对之干为' + row(value.helper)
      + '；柱差' + value.distance + '，不据五合形式认定合杀成功'),
    ...list(p.movingRows).map(value => '实际本运成分为' + row(value) + '，运干与各运支藏干分开，不合并为一个运类'),
    ...list(p.movingContacts).map(value => row(value.from) + chinese(value.relation) + row(value.to)
      + '；只核成分与对象，大运不虚构为第五个本命柱，也不据此认定有效制护'),
    ...list(p.natalMovingContacts).map(value => row(value.from) + chinese(value.relation) + row(value.to)
      + '；这是原局对本运成分的具名关系，不据此认定有效回克或护官'),
    ...linked(paths?.monthOfficerLinks, '月令财到原局官'),
    ...linked(paths?.monthFoodLinks, '原局食神到月令财'),
    wuFoodContrast && row(wuFoodContrast.monthFood) && row(wuFoodContrast.seal)
      ? '吴榜眼原图取时印，年食不作取用。' + row(wuFoodContrast.monthFood) + '和' + row(wuFoodContrast.seal) + '的实际位置另留证' : '',
    roadDirector && row(roadDirector.movingSeal?.moving) && row(roadDirector.movingSeal?.day)
      ? '公路局长原图的印助身已核至实际甲子运。' + row(roadDirector.movingSeal.moving)
        + '生' + row(roadDirector.movingSeal.day) + '，与原局财、印各自留证' : '',
    ...list(paths?.supportsDay).map(value => '本运助身的位置为' + row(value.moving)
      + (value.relation === '同五行' ? '与' + row(value.day) + '同五行' : '生' + row(value.day))),
    ...linked(paths?.wealthFeedsOfficer, '运财到原局官'), ...linked(paths?.monthWealthFeedsOfficerLuck, '月令财到运官'),
    ...list(paths?.sealProtectsOfficer).map(value => '印护官候选：' + row(value.output) + '克'
      + list(value.targets).map(row).join('、') + '，原局' + list(value.protectors).map(row).join('、')
      + '回克同一运食伤' + (list(value.wealthOfficerLinks).length
        ? '。' + value.wealthOfficerLinks.map(link => row(link.from) + '生同一原官' + row(link.to)).join('，') : '')
      + '；实际护官仍待核'),
    ...list(paths?.natalOutputOfficerPaths).flatMap(value => {
      const officers = list(value.officersAtRisk).map(link => row(link.from) + '生' + row(link.to)).join('、');
      return [
        list(value.movingSeals).length ? '运印制原局食伤候选：' + officers + '，该官受' + row(value.output)
          + '所克，本运' + value.movingSeals.map(row).join('、') + '克同一原局食伤；实际制护待核' : '',
        list(value.controlledKillers).length ? '原局克官食伤回克运杀：' + officers + '，该官受' + row(value.output)
          + '所克，同一食伤也克' + value.controlledKillers.map(row).join('、') + '；有回克位置，实际效果待核' : '',
      ];
    }),
    ...linked(paths?.foodLuckFeedsMonthWealth, '运食神到月令财'), ...linked(paths?.foodFeedsWealthLuck, '原局食神到运财'),
    ...linked(paths?.hurtLuckFeedsMonthFoodWealth, '运伤官到原食神所生的同一月令财'),
    ...(list(paths?.yangCounter).length ? [] : list(paths?.foodWealthControlsKiller)).map(value =>
      '财用食生中的回克候选：原局' + row(value.from) + '克' + row(value.to) + '；实际效果待核'),
    ...list(paths?.foodWealthInterference).flatMap(value => [
      ...list(value.movingOfficerCombinations).map(pair => '运官五合原局食神：' + row(pair.moving) + '合' + row(value.from)
        + '，该食神生' + row(value.to) + '；合的效果待核'),
      list(value.movingSeals).length ? '运印克原局食神：' + value.movingSeals.map(row).join('、') + '克' + row(value.from)
        + '，该食神生' + row(value.to) + '；克的效果待核' : '',
    ]),
    paths?.yangFoodSourceInterference?.mode === 'officer-joins-food'
      ? '杨侍郎原评将本步列为官印反晦，运干丁官合原局壬食' : '',
    paths?.yangFoodSourceInterference?.mode === 'seal-controls-food'
      ? '杨侍郎原评将本步列为官印反晦，运干戊印克原局壬食' : '',
    paths?.foodWealthNamedBalanced ? '杨例评注以日元、财、食相均论本图' : '',
    paths?.geYinWu ? '葛例实际运干甲为七杀，运支寅与原局日午为两支会位，原局月子与日午仍见六冲'
      + '；寅午会位缺' + list(paths.geYinWu.fire?.missingKnownBranches).filter(chinese).join('、') + '，成局与解冲待核' : '',
    paths?.geStrongBodyWealth ? '葛参政原评为身旺坐印、月令财旺。原局' + row(paths.geStrongBodyWealth.seal)
      + '生日元' + row(paths.geStrongBodyWealth.day) + '，' + row(paths.geStrongBodyWealth.wealth)
      + '生' + row(paths.geStrongBodyWealth.officer) : '',
    paths?.convertedWealthOfficer ? '单丞相原评按财旺生官取用。可核' + row(paths.convertedWealthOfficer.from)
      + '生' + row(paths.convertedWealthOfficer.to) : '',
    paths?.wuChaoshuNatalSupport ? '伍朝枢原评为财官旺而日元弱，原年亥禄和时酉印分别留证' : '',
    paths?.wuChaoshuLuLuck ? '实交己亥运时，运支亥首藏壬与原年亥及壬日同干，另见运干己正官' : '',
    ...list(paths?.geOfficerComparison).map(value => '葛例原局' + row(value.monthWealth) + '同生' + row(value.originalOfficer)
      + '并生' + row(value.movingAuthority)
      + (list(value.movingBranchAuthority).length ? '；本运支另实藏' + value.movingBranchAuthority.map(row).join('、') : '')),
    ...list(paths?.geYinWu?.branchSupport).map(value => '葛例运支余藏' + row(value.moving)
      + (value.relation === '生' ? '生日主' : '与日主同五行') + chinese(value.day?.stem) + '，实际帮身仍待核'),
    ...list(paths?.yangCounter).map(value => '杨例原局' + row(value.from) + '回克同一' + row(value.to) + '；制杀和暖局仍待核'),
    ...list(remedies?.wuWoodFeedsSeal).map(value => '吴例运干金在运支无同五行藏气，支本气' + row(value.from)
      + '生原局' + row(value.to) + '；实际得力仍待核'),
    ...linked(remedies?.wuKillerFeedsSeal, '吴例甲午运干七杀生同一时印'),
    ...list(remedies?.monthFoodSealPaths).flatMap(path => [
      '同一透食、月财和透印：' + row(path.food) + '生' + list(path.monthWealth).map(row).join('、')
        + '，明透之印为' + row(path.seal) + '。食印的原局柱差为' + path.columnDistance,
      ...linked(path.incomingFood, '运食神续生该月财'), ...linked(path.incomingWealthFedByFood, '同一原透食神生本运财'),
      ...list(path.officerCombinations).map(pair => '本运干正官' + chinese(pair.moving.stem) + '五合原透食神' + row(path.food)
        + '。合化和对财的影响待核'),
      ...linked(path.killerFeedsSeal, '运七杀生同一原局透印'),
      ...list(path.incomingWealthControlsSeal).map(link => '运财克该原局透印：' + row(link.from) + '克' + row(link.to)
        + '。实际影响待核'),
    ]),
    ...linked(pingjiang?.natalMonthWealthFeedsAuthority, '平江原图的月财生原局巳中官'),
    ...list(remedies?.pingjiangSourceWealth).map(path => '平江原图的' + row(path.food) + '生' + row(path.movingWealth)
      + '，这处运财又生原局' + row(path.originalOfficer)),
    ...linked(pingjiang?.monthWealthFeedsMovingAuthority, '平江原图的月财生本运官杀'),
    ...list(pingjiang?.movingSealsSupportingDay).map(value => '平江原图本步再见' + row(value.moving) + '生' + row(value.day)
      + '。评注对印再助身留有转晦的提醒'),
    pingjiang?.chenYou ? '平江原局年辰与时酉有六合' : '',
    list(pingjiang?.siYou).length ? '平江原局' + pingjiang.siYou.map(value => layers[value] || '').filter(Boolean).join('、')
      + '两处巳和时酉各见合金会位。会化效果待核' : '',
    ...linked(remedies?.monthHurtLinks, '原局伤官到月令财'), ...linked(remedies?.hurtingFeedsWealth, '本运对应的食伤生财位置'),
    ...linked(remedies?.companionFeedsHurt, '比劫生同一伤官的候选'),
    ...list(remedies?.sealControlsHurt).map(value => '印克同一伤官的候选：' + row(value.from) + '克' + row(value.to)),
    ...list(remedies?.hurtInterference).flatMap(path => [
      ...list(path.movingKillerCombinations).map(pair => '实际运干七杀' + chinese(pair.moving.stem) + '五合原局' + row(path.from)
        + '。所合伤官有生' + row(path.to) + '的方向，作用待核'),
      ...list(path.movingOfficerCombinations).map(pair => '实际运干正官' + chinese(pair.moving.stem) + '五合' + row(pair.target)
        + '。所合原局比劫生同一' + row(path.from) + '，作用待核'),
      list(path.movingSeals).length ? '运印克同一原局伤官：' + path.movingSeals.map(row).join('、') + '克' + row(path.from)
        + '。该伤官生' + row(path.to) + '，实际作用待核' : '',
    ]),
    ...list(remedies?.wangBranchRelations).map(pair => '汪例原局' + list(pair.members).map(value => layers[value] || '').join('与')
      + '有' + chinese(pair.values) + chinese(pair.kind) + '。评注所论通关和调候仍须核对'),
    ...list(remedies?.wangInterference).map(value => '汪例实际运干' + row(value.moving) + '五合' + row(value.target)
      + (value.targetIsDayMaster ? '，该目标是日元自身' : '，该目标是另柱明干') + '；作用待核'),
    ...list(remedies?.treatedKillers).map(value => '月令' + list(value.wealth).map(row).join('、') + '生原局' + row(value.killer)
      + (list(value.combinations).length ? '；该七杀与' + value.combinations.map(pair => row(pair.helper)).join('、') + '五合' : '')
      + (list(value.controllers).length ? '；该七杀受' + value.controllers.map(row).join('、') + '所克' : '')),
    ...list(remedies?.outputControlsTreatedKiller).map(value => '本运食伤对同一原局七杀：' + row(value.from) + '克' + row(value.to)),
    ...list(remedies?.killerControlPressure).flatMap(path => [
      ...list(path.attacks).map(seal => '运印克原制杀成分：' + row(seal) + '克' + row(path.controller)
        + '，该原局成分有克' + row(path.killer) + '的方向。制化效果待核'),
      ...list(path.branchClashes).map(pair => '运支冲制杀成分所在支：' + chinese(pair.values) + chinese(pair.kind)
        + '，受冲原支藏' + row(path.controller) + '，该藏干有克' + row(path.killer) + '的方向。解冲和制化待核'),
    ]),
    ...list(remedies?.liBranchSeal).map(value => '李例午中印与原局食神的相克位置：' + row(value.from) + '克' + row(value.to)
      + '；本步运干甲为七杀，原文另举的透丙在本步未见'),
    ...list(remedies?.killerSealPairs).map(value => '财月杀印的实际位置：月令' + list(remedies.monthWealth).map(row).join('、')
      + '生' + row(value.from) + '，同一透杀再生' + row(value.to)),
    ...linked(remedies?.killerFeedsSealLuck, '同一原局透杀生本运印'), ...linked(remedies?.zhaoOfficerFeedsSeal, '赵例运官杀生原局印'),
    ...list(remedies?.zhaoGuiWeiSeal).map(seal => '赵例癸未实见' + row(seal) + '，运干癸与运支藏印按原例分列'),
    ...list(remedies?.zhaoRenWuCombinesSeal).map(pair => '赵例壬午的' + row(pair.from) + '与' + row(pair.to)
      + '有五合，原评与前一步癸未分别论'),
    ...list(remedies?.movingOutputWealthKillerSeal).map(path => '运食伤经月财生原透七杀：' + row(path.output) + '生'
      + row(path.monthWealth) + '，该财生' + row(path.killer) + '，同一杀再生' + row(path.seal)
      + '，该印有生' + row(path.day) + '的方向。助杀、化杀及取用待核'),
    ...list(remedies?.wealthControlsKillerSeal).map(value => '运财克原局杀所生之印：' + row(value.from) + '克' + row(value.to)
      + (value.alsoCombines ? '；同一对天干亦有五合' : '') + '；是否破用仍待核'),
    ...list(p.movingFivePairs).map(value => '运干' + row(value.moving) + '五合实际对象' + row(value.target)
      + (value.targetIsDayMaster ? '，对象是日元自身，不能当作另一位外透比劫' : '') + '；合去及合化未核'),
    ...['natalRelationPairs', 'movingRelationPairs'].flatMap(key => list(p[key]).map(value => '实际支干关系' + chinese(value.kind)
      + '，参与位置' + list(value.members).map(v => layers[v] || (v === 'decadal' ? '本步大运' : '')).filter(Boolean).join('、')
      + '；不据六合、六冲或六害认定成局、解冲或固定吉凶')),
    ...list(p.branchGroups).map(value => '三合成员候选' + chinese(value.values) + '：' + list(value.members).map(v => chinese(v.branch)
      + '在原局' + (list(v.natalPositions).map(k => layers[k]).filter(Boolean).join('、') || '已知柱未见')
      + (v.luckPresent ? '，本运支也有' : '，本运支未有')).join('；')
      + (value.complete === true ? '；已知成员齐全' : value.complete === false ? '；成员未齐' : '；时柱未知，完整性未核')
      + '；不补造缺支，不把寅午或子辰两支会意认作三合成化'),
    ...list(p.printedCases).flatMap(value => value.matches === true ? ['四柱逐柱符合录文' + chinese(value.name) + '图：'
      + list(value.pillars).filter(chinese).join('、') + '；不是历史人物身份认定'] : []),
    ...printedLuckDescription(p),
    ...list(p.sourceVariants).flatMap(value => (match('pingjiang') && value.id === 'pingjiang-prose' || match('zhao') && value.id === 'zhao-earlier-prose')
      ? ['来源异文：' + chinese(value.issue)] : []),
    '财用食印须食印均明透，财月透杀印须杀印均明透；只有支藏不能代替明透',
    '吴例食印不碍、调候及平江例去食护官，前章正文与评注有分歧；两例官运说法亦不同，不推广为官运一律忌或吉',
    match('pingjiang') ? '平江图辰中确藏乙余气，而评注另称食无根；透藏坐标与该评语分存，不据藏乙自动裁定有效通根，也不静默改成年申' : '',
    '毛例合杀正文与评注杀仍留、午丁制杀分别保留；李例印可行支不可行干，不把运丙克庚与运支藏丙并作同一效果',
    '财带伤官的佩印与化劫是不同分支，不要求两者共在；身轻身重、财食印杀轻重、有效合制、护官、调候与取用仍须核',
    chinese(p.luckPillar) ? '实际大运为' + p.luckPillar + '，运干十神为' + chinese(p.luckTenGod) + '，产品运支首藏十神为'
      + chinese(p.luckBranchMainQiGod) + '；首藏只作候选，不代原文方气与干支分段' : '',
    p.stageStart && p.stageEnd ? '完整实际运段：' + at(p.stageStart) + '至' + at(p.stageEnd) + '，截止不计入' : '',
  ]);
}

function killerOrderDescription(p, at) {
  if (p.profile !== 'zpqz-killer-clearing-helper-order-v1') return '';
  const position = value => value === 'decadal' ? '本步大运' : layers[value] || '';
  const row = value => position(value?.position) && chinese(value.stem) ? position(value.position) + chinese(value.pillar)
    + chinese(value.kind) + value.stem + '（' + chinese(value.god || value.tenGod) + '）' : '';
  const pairText = (values, label) => list(values).flatMap(pair => row(pair.from) && row(pair.to) ? [label + '的位置为'
    + row(pair.from) + '对' + row(pair.to) + '，柱差' + pair.columnDistance
    + (list(pair.between).length ? '，中间实际柱为' + pair.between.map(value => position(value.position) + chinese(value.pillar)).join('、') : '')
    + '；五行与间隔不代表制护已经生效'] : []);
  const relations = (values, label) => list(values).flatMap(value => chinese(value.kind) ? [label
    + list(value.members).map(position).filter(Boolean).join('与') + '有' + value.kind + '位置（' + chinese(value.values) + '）；不自动去官去杀或成化'] : []);
  const matches = id => list(p.printedCases).some(value => value.id === id && value.matches === true);
  const moving = (values, meaning, target) => list(values).flatMap(value => row(value) && row(target)
    ? [row(value) + meaning + row(target)] : []);
  const foodLuck = p.killerFoodLuck, sealLuck = p.killerSealLuck, wealthLuck = p.killerWealthLuck;
  const nobleFood = foodLuck?.nobleFoodLuck, heSeal = sealLuck?.heSealContext, tuoSeal = sealLuck?.tuoSealContext;
  const foodDirections = list(foodLuck?.paths).flatMap(path => [
    ...moving(path.outputLuck, '克月令所见原杀', path.killer), ...moving(path.wealthLuck, '生同一所制原杀', path.killer),
    ...moving(path.sealLuck, '克同一制杀原食', path.output),
    ...list(path.foodCombines).map(pair => row(pair.moving) + '合原局制杀的同一食神' + row(path.output)),
    ...list(path.killerLuck).map(value => row(value) + '克日元并受原食' + row(path.output) + '所克'),
  ]);
  const sealDirections = list(sealLuck?.paths).flatMap(path => [
    ...moving(path.wealthLuck, '克同一承杀原印', path.seal), ...moving(path.authorityLuck, '生同一承杀原印', path.seal),
    ...list(path.hurtLuck).map(value => row(value) + '受原局' + row(path.killer) + '所生的同一' + row(path.seal) + '回克'),
    ...list(path.sealLuck).map(value => row(value) + '承原局' + row(path.killer) + '之生并生日元'),
    ...moving(path.peerLuck, '与日元同五行，所对应的原印为', path.seal),
    ...list(path.combinesSeal).map(pair => row(pair.moving) + '又与同一承杀原印' + row(path.seal) + '有五合位置，实际合绊待核'),
  ]);
  const wealthDirections = list(wealthLuck?.wealthRemedies).flatMap(path => {
    const changes = [...moving(path.wealthLuck, '克同一原印', path.seal), ...moving(path.outputLuck, '生同一透财', path.wealth),
      ...moving(path.peerLuck, '克同一透财', path.wealth), ...moving(path.sealLuck, '再克原局所护食伤', path.output),
      ...list(path.killerLuck).map(value => row(value) + '受同一透财之生并被同一原食伤所克'),
      ...list(path.hiddenKillerLuck).map(value => row(value) + '受同一透财之生并被同一原食伤所克，支藏七杀单列')];
    return changes.length ? ['原局' + row(path.wealth) + '克' + row(path.seal) + '，该印克' + row(path.output)
      + '，该食伤克' + row(path.killer) + '；本步见' + changes.join('、')] : [];
  });
  const clearing = p.killerClearingLuck, named = clearing?.namedClearing, blade = p.killerBladeLuck;
  const shenSupport = p.confirmed === true ? clearing?.shenSourceBodySupport : undefined;
  const nobleSouthern = foodLuck?.nobleSouthernFoodRoot, yueGuiChou = clearing?.yueGuiChouRegulatorRoot;
  const clearingDirections = list(clearing?.paths).flatMap(path => [
    path.via === 'hurt-controls-officer'
      ? '原局明透伤官' + row(path.helper) + '克明透正官' + row(path.target) + '，另有月令藏杀' + row(path.retained)
      : '原局' + row(path.helper) + '与' + row(path.target) + '有五合，另一具名官杀为' + row(path.retained),
    ...moving(path.checksHelper, '克这处原局取清配对之干', path.helper),
    ...moving(list(path.combinesHelper).map(pair => pair.moving), '另合这处原局取清配对之干', path.helper),
    ...moving(path.checksRetained, '克该结构另见的同一官杀', path.retained),
    ...moving(path.checksKiller, '另克与去留对照有关的原局七杀', path.target),
    ...list(path.originalControls).flatMap(control => [
      ...moving(control.attack, '克原局制杀之神', control.output),
      ...moving(control.feeds, '生原局制杀之神', control.output),
      ...moving(list(control.combines).map(pair => pair.moving), '合原局制杀之神', control.output),
    ]),
  ]);
  const clashDirections = list(clearing?.clashClearing).flatMap(path => [
    '原局' + position(path.helper.position) + path.helper.pillar + '与月支六冲，月令七杀为' + row(path.killer)
      + '，另见明透正官' + row(path.officer)
      + (list(path.officerMonthRoots).length ? '；该正官在月支亦有同类根气，是否可分别取用仍待核' : '；实际去留待核'),
    ...relations(path.touchesHelper, '本步对原局冲支另见'),
    ...moving(path.checksKiller, '克被冲月支所藏的同一七杀', path.killer),
    ...moving(path.checksOfficer, '克另一处所见原局透官', path.officer),
  ]);
  const bladeDirections = list(blade?.paths).flatMap(path => [
    ...moving(blade?.zhao ? list(path.check).filter(value => value.kind === '运干') : path.check, '克同一原局七杀', path.killer),
    ...moving(path.feed, '生同一原局七杀', path.killer),
    ...moving(path.branchMetalChecks, '以运支金藏气另克赵例同一月杀', path.killer),
    ...list(path.nativeSeals).slice(0, 2).map(seal => '原局' + row(path.killer) + '生' + row(seal) + '，该印生日元'),
  ]);
  const supportDay = rows => list(rows).map(value => row(value) + (['比肩', '劫财'].includes(value.god) ? '与日元同五行' : '生日元'));
  const dual = p.hurtDualLuck, hurtOfficer = p.hurtOfficerLuck;
  const dualSource = dual?.sourceAuthority, takingOfficer = hurtOfficer?.sourceTakingOfficer;
  const zhengLuck = hurtOfficer?.zhengLuck;
  const dualRoots = dual?.dualRoots;
  const dualDirections = list(dual?.paths).flatMap(path => {
    const changes = [...supportDay(path.sealLuck),
      ...list(path.wealthLuck).map(value => row(path.output) + '生' + row(value) + '，该运财克' + row(path.seal)),
      ...list(path.authorityLuck).map(value => row(path.wealth) + '生' + row(value) + '，该运官杀再生同一原印' + row(path.seal))];
    const distance = path.columnDistance ?? path.nativeCombination?.distance;
    const between = list(path.between ?? path.nativeCombination?.between);
    const spacing = distance === 0 ? '原财与原印同柱' : distance === 1 ? '原财与原印相邻'
      : between.length ? '原财与原印中隔' + between.map(value => position(value.position) + value.pillar).join('、') : '';
    return changes.length ? ['兼财印见' + row(path.output) + '生' + row(path.wealth) + '，原印为' + row(path.seal)
      + (spacing ? '，' + spacing : '') + '。本步' + changes.join('、') + (path.nativeCombination ? '。同一对有干合坐标，实际合用待核' : '')] : [];
  });
  const exactRoots = (roots, decadal) => list(roots).filter(value => (value.position === 'decadal') === decadal && value.exactStem)
    .map(value => position(value.position) + value.pillar).join('、') || '未见';
  const officerDirections = list(hurtOfficer?.paths).flatMap(path => [
    ...list(path.moneyLinks).slice(0, 1).map(link => row(path.output) + '生' + row(link.wealth) + '，该财生同一明透原官' + row(path.officer)),
    ...moving(list(path.protectingSeals).slice(0, 1), '克原局月令伤官', path.output),
    ...list(path.wealthLuck).map(value => row(path.output) + '生' + row(value) + '，该运财再生同一明透原官' + row(path.officer)),
    ...list(path.sealLuck).map(value => row(path.officer) + '生' + row(value) + '，该印克原伤并生日元'),
    ...list(path.outputLuck).map(link => row(link.moving) + '克同一明透原官' + row(path.officer)
      + (link.moneyLinks.length || link.protectingSeals.length ? '。原财承接或原印回克的位置亦可见，实际护官仍须核' : '')),
  ]);
  const hurtOfficerPaths = list(hurtOfficer?.paths);
  const officerConfiguration = hurtOfficerPaths.flatMap(path => [
    list(path.officerRoots).length ? '明透原官' + row(path.officer) + '的本命同干根为' + exactRoots(path.officerRoots, false)
      + '，当运同干根为' + exactRoots(path.officerRoots, true) + '，两处分别留位' : '',
    ...relations(path.natalRootClashes, '原局月伤与官根同时涉及'),
    ...list(path.visibleSupports).map(pair => '同一原官可查明透财' + row(pair.wealth) + '和明透印' + row(pair.seal)
      + '，柱差' + pair.distance + '，实际财印旺弱及相碍待核'),
  ]);
  const namedWu = hurtOfficerPaths.find(path => path.namedWuOfficer)?.namedWuOfficer;
  const directions = values => [...new Set(values)].slice(0, 6);
  return sentences([
    '以下偏官和伤官取运背景来自同一本命候选及同一实际运段，取清对象、救护对象和日元位置分别保留',
    '已知本命为' + list(p.natalPillars).map(value => position(value.position) + chinese(value.pillar)).join('、')
      + '，月令藏神为' + list(p.monthHiddenGods).filter(chinese).join('、') + '；不能由藏有一神就确定格局取用',
    ...list(p.gods).flatMap(value => chinese(value.god) ? [value.god + '的位置为'
      + [...list(value.exposedRows), ...list(value.hiddenRows)].map(row).filter(Boolean).join('、')
      + (!list(value.exposedRows).length && !list(value.hiddenRows).length ? p.timeKnown === true ? '完整已知柱位未见' : '已知部分未见，未知时柱未排除' : '')] : []),
    p.foodAbsent === true ? '完整已知原局无食神；此处无食不能误写成无印，食神与伤官是否统称须另核' : p.foodAbsent === false ? '原局已见食神，无食分支不成立' : '时柱未知，不能确认原局无食神',
    ...pairText(p.foodKillerContacts, '食伤制杀'), ...pairText(p.outputOfficerContacts, '食伤克官'),
    ...pairText(p.killerSealContacts, '杀生印'), ...pairText(p.wealthSealContacts, '财克印'),
    ...pairText(p.wealthOfficerKillerContacts, '财生官杀'), ...pairText(p.sealOutputContacts, '印克食伤'), ...pairText(p.sealDayMasterContacts, '印生日元'),
    ...directions(foodDirections), ...moving(foodLuck?.incomingOfficer, '克日元，官杀是否混杂待核；日元为', foodLuck?.day),
    ...supportDay(foodLuck?.luckSupport),
    list(foodLuck?.foodBodySupport).length ? '助身方向查得日元本命根位为'
      + (list(foodLuck.dayRoots).map(value => position(value.position) + value.pillar + (value.exactStem ? '藏同干' : '藏同五行异干')).join('、') || '未见')
      + '，根力和食杀是否相均另核' : '',
    nobleFood ? '贵造按原评为身强杀旺，根轻助身支路排除，生克与合会位置照录' : '',
    list(nobleFood?.foodRootInLuck).length ? '贵造原时丁食的运支同干位置为' + nobleFood.foodRootInLuck.map(row).join('、') : '',
    list(nobleFood?.killerRootInLuck).length ? '贵造原月辛杀的运支同干位置为' + nobleFood.killerRootInLuck.map(row).join('、') : '',
    list(nobleFood?.combinesFood).length ? '贵造同一运又见运壬合原局时丁，支藏丁与干合的作用分别待核' : '',
    nobleFood?.metalWaterStemRoots ? '贵造当步' + nobleFood.metalWaterStemRoots.stem + '的运支同类成分为'
      + (list(nobleFood.metalWaterStemRoots.sameElement).map(value => row(value)
        + (value.stem === nobleFood.metalWaterStemRoots.stem ? '同干' : '同五行异干')).join('、') || '未见') : '',
    nobleSouthern ? '贵造实运未中丁是原时丁食的同干根，运癸仍克原丁，运未与时丑有六冲' : '',
    yueGuiChou ? '岳例实运癸制月丙，丑余癸为运癸同干根，丑首己仍克原年癸' : '',
    nobleFood?.metalGroup ? '贵造辛巳由运巳补月酉、时丑，三支位置齐全，实际是否成化待核' : '',
    nobleFood?.metalPair && list(nobleFood.combinesWood).length ? '贵造庚辰同时核到运辰合月酉；运庚合乙的实际对象为'
      + nobleFood.combinesWood.map(pair => row(pair.target)).join('、') : '',
    ...directions(sealDirections), ...directions(wealthDirections),
    shenSupport?.basis === 'branch-peer' ? (shenSupport.component.stem === '辛'
      ? '沈例实运酉中本气辛比肩与日元同干' : '沈例实运申中本气庚劫财与日元同五行') : '',
    shenSupport?.basis === 'stem-seal' ? '沈例按原评身弱取助，实际' + row(shenSupport.component) + '生' + row(shenSupport.day) : '',
    ...list(sealLuck?.killerSealHurtCommentary).slice(0, 2).map(path => '徐注对伤官运的复核：原局' + row(path.killer)
      + '生' + row(path.seal) + '，同一原印生日元并回克本步' + row(path.hurt)
      + (path.joinsSeal ? '。这处运伤又与同一透印有干合，分开看' : '')),
    list(wealthLuck?.zhouDayRoots).length ? '周例丁日的原局藏根分别在'
      + wealthLuck.zhouDayRoots.map(value => position(value.position) + value.pillar + (value.exactStem ? '藏同干' : '藏同五行异干')).join('、') : '',
    heSeal ? '何例按原评身弱取时辛印，原局食杀的实际生克另留见证' : '',
    heSeal ? '何例的' + row(heSeal.wealth) + '生月令' + row(heSeal.killer) + '，月干另透同一戊干'
      + row(heSeal.exposedKiller) + '，月戊再生' + row(heSeal.seal) + '；原财与原印中隔'
      + list(heSeal.between).map(value => position(value.position) + value.pillar).join('、') + '，财印两不相碍依原评留存' : '',
    list(heSeal?.movingSameSeal).length ? '何例本运与原时辛印同干的实际成分为' + heSeal.movingSameSeal.map(row).join('、') : '',
    ...list(tuoSeal?.combinesKiller).map(pair => '脱例本运' + row(pair.moving) + '合年壬杀' + row(tuoSeal.killer)
      + '，月甲印的位置为' + row(tuoSeal.seal) + '；原评在这一步另有合杀无碍的判读'),
    ...list(wealthLuck?.wealthNourishes).slice(0, 2).map(path => '另核财滋杀路径，原局' + row(path.output) + '生' + row(path.wealth)
      + '，同一财生' + row(path.killer) + '；此路线单独存在时不可带入财去印的喜忌'),
    ...directions(clearingDirections), ...directions(clashDirections), ...supportDay(clearing?.luckSupport),
    named?.yue ? '岳例前章正文取去官留杀，实际核到' + row(named.yueRegulator) + '克' + row(named.officer)
      + '，并保留同根评注所指的' + row(named.killer) : '',
    ...moving(named?.yueAttack, '克岳例所用的原局癸水', named?.yueRegulator),
    ...moving(named?.yueConcealedAttack, '对岳例原局癸水有余气的克向', named?.yueRegulator),
    ...moving(named?.yueWater, '克岳例同一巳中七杀', named?.killer),
    ...moving(named?.yueFeedsRegulator, '生岳例所用的原局癸水', named?.yueRegulator),
    named?.shenClash ? '沈例前章正文取去杀留官，实际年子冲月午；徐注以午为年丙之根，年官和月杀分别留位' : '',
    blade?.monthYangBlade === true ? '月令阳刃坐标见于' + chinese(blade.bladePosition?.pillar) + '，原局未见食神，也未见伤官制这些七杀' : '',
    blade?.zhao ? '赵例午在时支，按原例单列；前章有用印读法，所列印劫与制杀位置按运步核对' : '',
    list(blade?.bladePeers).length ? '原局刃位的藏劫实见' + blade.bladePeers.map(row).join('、') : '',
    list(blade?.movingBladePeers).length ? '当运同刃支另藏同一劫财干' + blade.movingBladePeers.map(row).join('、') : '',
    ...list(blade?.authorityChecksBlade).map(value => row(value.moving) + '克同一原局刃中' + row(value.peer) + '，刃杀轻重另核'),
    blade?.zhao && list(blade.nativeOfficers).length ? '赵例实际另见正官位置' + list(blade.nativeOfficers).map(row).join('、')
      + '，与徐注论杀纯的口径分别记' : '',
    blade && !blade.zhao && list(blade.nativeOfficers).length ? '原局同时可见正官位置' + blade.nativeOfficers.map(row).join('、')
      + '，原局官杀是否相杂仍待核' : '',
    blade?.zhaoMetalControlsKiller ? '赵例本运实见庚或辛克月令甲杀，对照徐注所说金来制杀的方向' : '',
    ...supportDay(blade?.luckSupport), ...directions(bladeDirections),
    ...list(blade?.arrivingKiller).map(value => row(value) + '克日元，另列为运来助杀的结构'),
    ...list(blade?.incomingOfficer).map(value => row(value) + '克日元，官杀是否构成混杂仍须核'),
    ...directions(dualDirections), ...directions(officerDirections),
    ...directions(officerConfiguration.filter(Boolean)),
    dualRoots ? '原局透财' + row(dualRoots.wealth) + '的同干根为' + exactRoots(dualRoots.wealthRoots, false)
      + '，当运支同干根为' + exactRoots(dualRoots.wealthRoots, true) + '；原局透印' + row(dualRoots.seal)
      + '的同干根为' + exactRoots(dualRoots.sealRoots, false) + '，当运支同干根为' + exactRoots(dualRoots.sealRoots, true) : '',
    dual?.dualCase === 'wealth-heavy' ? '都统制按财多取印，官杀生印的取法限该原图' : '',
    dual?.dualCase === 'seal-heavy' ? '丞相按印多取财，运官杀泄财生印的取法限该原图' : '',
    dualSource ? '原透财' + row(dualSource.wealth) + '生本步' + list(dualSource.authority).map(row).join('、') + '，再生同一原透印' + row(dualSource.seal)
      + (dualSource.reading === 'supports-seal' ? '，都统制原评取官杀生印' : '，丞相原评取运官杀泄财生印') : '',
    takingOfficer ? '伤官用官原例中，' + row(takingOfficer.output) + '经原财' + row(takingOfficer.wealth)
      + '生同一原官' + row(takingOfficer.officer) + '，另核原印' + row(takingOfficer.seal)
      + ({ 'wealth-feeds-officer': '；本步核运财生该官', 'seal-protects-officer': '；本步核运印护该官',
        'officer-root-in-luck': '；本步核同一原官的运支同干根' }[takingOfficer.route] ?? '') : '',
    hurtOfficerPaths.some(path => path.winterWaterWithFire) ? '此盘冬金、月令藏水伤及火官明透，可核冬令调候的配置，实际暖局待核' : '',
    zhengLuck ? '郑丞相原图取亥未暗财承接' + row(zhengLuck.officer) + '，原财实位为' + list(zhengLuck.nativeWealth).map(row).join('、') : '',
    list(zhengLuck?.wealth).length ? '本运财位为' + list(zhengLuck.wealth).map(row).join('、') + '，可参原评寅卯甲乙运' : '',
    list(zhengLuck?.southernFireRoots).length ? '本步南方运支见' + list(zhengLuck.southernFireRoots).map(row).join('、') + '，可参原评官得地' : '',
    namedWu ? '此原例庚午见' + row(namedWu) + '，运支本气与原官同干' : '',
    ...(list(hurtOfficer?.convertedWealthMembers).length ? ['此原图申子辰组的本命位置为' + hurtOfficer.convertedWealthMembers.map(value =>
      chinese(value.branch) + (list(value.positions).map(position).join('、') || '未见')).join('、') + '，原例评注的申子关系按该例另论'] : []),
    ...list(p.roots).flatMap(value => chinese(value.stem) ? ['干' + value.stem + '的根位为'
      + (list(value.roots).map(root => position(root.position) + chinese(root.pillar) + (root.exactStem ? '含同干' : '含同五行异干')).join('、') || '已知柱中未见')
      + '；同干与同五行异干分开，根位不代表根旺、身强或制化得用'] : []),
    ...list(p.clearingPairs).map(value => '原局五合中被合的具名对象为' + row(value.target) + '，配对之干为' + row(value.helper)
      + '；保留实际柱序，不表示已去官或去杀'),
    ...list(p.movingFivePairs).map(value => '运来五合的实际目标为' + row(value.target) + '，运干为' + row(value.moving) + '；不虚构大运为本命第五柱'),
    ...list(p.movingAttacksClearingHelpers).map(value => '本步大运' + chinese(value.moving?.pillar) + '对原五合配对之干' + row(value.helper)
      + '有五行克的位置；原配对对象为' + row(value.target) + '；不等于救应已经破坏'),
    ...relations(p.natalRelationPairs, '原局'), ...relations(p.movingRelationPairs, '运来'),
    ...list(p.generationChainPairs).map(value => '相邻实际干序' + row(value.from) + '至' + row(value.to)
      + (value.generates ? '有相生方向' : '不构成顺序相生') + '；日元不计为另一外透比肩，也不凭相生自动判印化成功'),
    chinese(p.luPlusOneBranch) ? '五阳禄前一位坐标在' + p.luPlusOneBranch + '，本命见于'
      + (list(p.luPlusOnePositions).map(value => position(value.position) + chinese(value.pillar)).join('、') || '已知部分未见')
      + '；本命月令' + (p.monthYangBlade ? '到此坐标' : '未到此坐标') + '，年日时劫位不冒充月令阳刃，身强用刃或用印仍须核' : '',
    ...list(p.wealthSealPairs).map(value => '财印均明透的位置为' + row(value.wealth) + '和' + row(value.seal) + '，柱差' + value.distance
      + '；隔离和相邻仅为位置，不能按距离单独定不相碍'),
    ...list(p.printedCases).flatMap(value => value.matches === true ? ['四柱与录文' + chinese(value.name) + '图逐柱相同：'
      + list(value.pillars).filter(chinese).join('、') + '；不是历史身份认定'] : []),
    ...printedLuckDescription(p),
    ...list(p.sourceVariants).flatMap(value => (matches('tuotuo') && value.id === 'tuotuo-prose' || matches('liu-previous') && value.id === 'liu-luck-diagram')
      ? ['录文异文说明：' + chinese(value.issue) + '；疑字不作为有效盘面事实'] : []),
    p.convertedWealthPrintedExample === true ? '此录图后文明确另作财旺生官，不直接作为普通伤官用官的正例；不据原图排除所有未知的化伤结构' : '',
    '伤官运为美与评注恐误、有印回克两种语境保留；官杀共见不自动等于真混，岳沈两例官杀同根的评注不与去留正文合并',
    '去印存食须有实际印的位置，兼用财印也不能只见财便套用；身食杀和财印轻重、取清、救应、调候及反向分支仍待核',
    chinese(p.luckPillar) ? '实际大运' + p.luckPillar + '，运干十神' + chinese(p.luckTenGod) + '，产品运支首藏十神' + chinese(p.luckBranchMainQiGod)
      + '；运类分别留位，不擅定原句干支适用范围' : '',
    p.stageStart && p.stageEnd ? '实际完整运段为' + at(p.stageStart) + '至' + at(p.stageEnd) + '，截止不计入' : '',
  ]);
}

function foodKillerDescription(p, at) {
  if (p.profile !== 'zpqz-food-killer-no-seal-and-climate-candidates-v1') return '';
  const position = key => key === 'decadal' ? '本步大运' : layers[key] || '';
  const row = value => position(value?.position) && chinese(value.stem)
    ? position(value.position) + chinese(value.pillar) + chinese(value.kind) + value.stem + '（' + chinese(value.god || value.tenGod) + '）' : '';
  const pairs = (values, label) => list(values).flatMap(pair => row(pair.from) && row(pair.to)
    ? [label + '的具体位置为' + row(pair.from) + '对' + row(pair.to) + '，柱差' + pair.columnDistance
      + (list(pair.between).length ? '，中间为' + pair.between.map(value => position(value.position) + chinese(value.pillar)).join('、') : '')
      + '；仅是五行和柱位关系，不证明制化有效'] : []);
  const paths = p.confirmed === true ? p.foodLuckPaths : undefined;
  const xie = paths?.xieLuck;
  const climate = p.confirmed === true ? p.foodClimateEvidence : undefined;
  const summerFire = climate?.summerFireSource;
  const summerYiSolstice = climate?.summerYiFireFormationWaterEvidence?.solarTerm;
  const qian = climate?.qianLuck;
  const li = climate?.liLuck;
  const roots = values => list(values).map(value => position(value.position) + chinese(value.pillar)
    + (value.exactStem ? '有同干藏气' : '仅有同五行异干藏气')).join('、') || '未见';
  const contacts = (values, label, relation) => list(values).map(value => label + '为' + row(value.from) + relation + row(value.to));
  return sentences([
    '以下食神生财与带杀条件来自同一本命候选和同一实际运段，透干与支藏分别记录',
    summerYiSolstice?.phase === 'before-solstice' && summerYiSolstice.birthAt && summerYiSolstice.solsticeAt
      ? '午月乙木出生在夏至交节前，徐注先癸次丙。出生' + at(summerYiSolstice.birthAt) + '，交节' + at(summerYiSolstice.solsticeAt)
      : summerYiSolstice?.phase === 'at-or-after-solstice' && summerYiSolstice.birthAt && summerYiSolstice.solsticeAt
        ? '午月乙木出生已到夏至交节，徐注丙癸并取。出生' + at(summerYiSolstice.birthAt) + '，交节' + at(summerYiSolstice.solsticeAt) : '',
    p.confirmed === true && p.namedHuEarthWarning === true ? '胡会元原评对戊辰运有明确警示，辰中余藏乙的制生方向仍留证' : '',
    p.confirmed === true && p.namedLiuWeakDay === true ? '刘提督原图按徐注为身弱，印比助身的条件独立于食神制杀过重' : '',
    '已知四柱为' + list(p.natalPillars).map(value => position(value.position) + chinese(value.pillar)).join('、')
      + '，月令藏神为' + list(p.monthHiddenGods).filter(chinese).join('、') + '；藏神候选不等于已经确定用神格局',
    ...[['foodRows', '食神'], ['hurtRows', '伤官'], ['wealthRows', '财'], ['sealRows', '印'], ['killerRows', '七杀']].map(([key, label]) => label + '的实际位置为'
      + (list(p[key]).map(row).filter(Boolean).join('、') || (p.timeKnown === true ? '完整已知柱位中未见' : '已知部分未见，尚不能排除未知时柱'))),
    p.noSeal === true ? '完整已知原局透干与支藏均未见印；这是食神带杀三种分支共同的无印位置前提'
      : p.noSeal === false ? '原局已见印，不能套入前文限定无印的食神带杀三分支' : '时柱尚未核全，原局无印不能成立为确定前提',
    ...pairs(p.foodWealthPairs, '食伤生财'), ...pairs(p.foodKillerPairs, '食伤制杀'), ...pairs(p.wealthKillerPairs, '财生杀'),
    ...pairs(p.sealOutputPairs, '印克食伤'),
    ...contacts(paths?.monthFoodWealth, '月令食神到原局财的位置', '生'),
    ...contacts(paths?.luckOutputFeedsWealth, '运食伤到原局财的位置', '生'),
    ...contacts(paths?.monthFoodFeedsLuckWealth, '月令食神到运财的位置', '生'),
    ...list(paths?.supportsDay).map(value => '本运助身位置为' + row(value.moving)
      + (value.relation === '同五行' ? '与' + row(value.day) + '同五行' : '生' + row(value.day))),
    ...contacts(paths?.authorityPressure, '食神已透时运官杀克身的位置', '克'),
    paths?.liangContrast ? '梁例的原局亥卯未成员齐，本运干与运支本气又各为正官，评注另有本步提醒' : '',
    paths?.liangSourceRenCounterfactual ? '梁图反设的原局时壬合年丁，按徐注另看火财' : '',
    ...contacts(paths?.liangSourceRenCounterfactual?.fireWealth, '反设命例仍核月乙到实运火财的位置', '生'),
    xie ? '谢例原局' + row(xie.food) + '生' + row(xie.wealth) + '，同干申藏分见食神的'
      + list(xie.foodRoots).map(row).join('、') + '及财的' + list(xie.wealthRoots).map(row).join('、') : '',
    xie ? '谢例原局的申子实位为' + list(xie.waterMembers).filter(value => list(value.natalPositions).length)
      .map(value => value.branch + '在' + list(value.natalPositions).map(position).join('、')).join('，')
      + (xie.chenArrives ? '；这一步运支另外补辰，三支齐全的事实与是否成化分开' : '；本步未新增辰补全三支') : '',
    list(xie?.namedSupport).length ? '谢例本步所核助身为' + xie.namedSupport.map(row).join('、') : '',
    paths?.sourceBodyHeavy === true ? '此图按评注归入身重食旺，身轻分支排除；运印、运劫的生克位置仍可留证' : '',
    ...contacts(paths?.sealChecksOutput, '运印所克且同生原局财的食伤位置', '克'),
    ...contacts(paths?.robberyChecksWealth, '运劫所克且为月食所生的财位', '克'),
    paths?.shenSourceFoodBody ? '沈例按原评为身轻食重，月食' + row(paths.shenSourceFoodBody.food)
      + '与时伤' + row(paths.shenSourceFoodBody.hurt) + '都生原局' + row(paths.shenSourceFoodBody.wealth) : '',
    paths?.shenLuck?.nativeWaterRoot ? '沈例原局癸日的同五行水根实见' + row(paths.shenLuck.nativeWaterRoot) : '',
    ...list(paths?.shenLuck?.renCombinesDing).map(pair => '沈例同一步的运壬与原局年丁有五合位置，所合为' + row(pair.target)),
    ...contacts(paths?.shenLuck?.guiChecksDing, '沈例运干癸与原局年丁的位置', '克'),
    list(paths?.shenLuck?.northWater).length ? '沈例的运支水藏气为' + paths.shenLuck.northWater.map(row).join('、')
      + '，与运干对年丁的关系分别保留' : '',
    paths?.shenLuck?.branchSeal ? '沈例所取的运支印地实际本气为' + row(paths.shenLuck.branchSeal) : '',
    paths?.gongSourceFoodBody ? '龚例按原评为身轻财重，月食' + row(paths.gongSourceFoodBody.food)
      + '生原局财' + paths.gongSourceFoodBody.wealth.map(row).join('、') : '',
    list(paths?.gongSupport).length ? '龚例该步实际助身成分为' + paths.gongSupport.map(value => row(value.moving)).join('、') : '',
    ...list(paths?.noSealKiller).map(value => '无印盘中' + row(paths.foodKillerDay) + '生' + row(value.from)
      + '，月食克' + row(value.to) + '，该七杀亦克同一个日元'),
    paths?.liuWeakDay === true ? '刘例按原评为身弱，排除身旺杀强这一支' : '',
    paths?.rootlessBingShenSource ? '四柱均为丙申。徐乐吾在卷二明确判这组丙火无根为身弱。月申戊食和各柱申中壬杀分别核位，只有支藏七杀，留作本地对照' : '',
    list(paths?.liuSupport).length ? '刘例当步印比劫分别见于' + paths.liuSupport.map(value => row(value.moving)).join('、') : '',
    paths?.huOvercontrol === true ? '胡例按原评为食重制杀偏过，排除身旺杀强这一支' : '',
    ...contacts(paths?.outputChecksKiller, '当运食伤克同一个原局七杀的位置', '克'),
    ...contacts(paths?.wealthFeedsKiller, '当运财生同一个原局七杀的位置', '生'),
    list(paths?.wealthFeedsKiller).length ? '财生杀在身旺杀强与制杀偏过两种前提下有不同取法；先核原局轻重' : '',
    ...list(paths?.rootlessBingShenSource ? paths?.bingShenReviewedSealAid : paths?.sealRescue)
      .map(value => '运印承杀所生的位置为' + row(value.killer) + '生' + row(value.moving)
      + '；同一运印克' + row(value.food) + '并生' + row(value.day) + '，救应作用仍待核'),
    ...list(paths?.secondarySealRescue).map(value => '另核运支余藏印' + row(value.moving) + '承' + row(value.killer)
      + '之生，克同一' + row(value.food) + '并生' + row(value.day) + '，实际救应仍待核'),
    list(paths?.huEarth).length ? '胡例本步实际运干和运支本气为' + paths.huEarth.map(row).join('、') + '，均属土' : '',
    ...list(paths?.huAuthority).map(value => '胡例本步的' + row(value.moving) + '与原局' + row(value.killer)
      + '同属水，均克' + row(value.day) + '；原局' + row(value.food) + '克该原杀，原评按制杀偏过留此官杀运对照'),
    ...list(climate?.summerWater).map(value => '夏木本运水印' + row(value.moving) + '生' + row(value.day)
      + '并克原局' + row(value.fire) + '；实际润木仍待核'),
    summerFire ? '卷首甲木例核到' + (summerFire.formation === 'si-wu' ? '原局四支均为巳午' : '原局寅午戌齐见')
      + '，实位为' + list(summerFire.members).map(value => position(value.position) + chinese(value.pillar)).join('、')
      + (summerFire.hasBothFireStems === true ? '，丙丁都已透出' : '，丙丁并透的条件未齐') : '',
    summerFire?.dampChenDay?.pillar === '甲辰' ? '日柱甲辰另核原书所说的辰湿土，保留它对火势的调节条件' : '',
    p.summerWood === true && p.timeKnown === true && climate ? '夏木原局水印位置为'
      + (list(climate.nativeWaterSeals).map(row).join('、') || '未见') + '；原局和运来的印位分别判断' : '',
    qian ? '钱例的原局' + row(qian.seal) + '在' + row(qian.lu) + '有同干禄位'
      + (qian.branchFeedsSeal ? '；运支本气' + row(qian.branchFeedsSeal) + '生该透印' : '')
      + (qian.wealthAttacksSeal ? '；当运' + row(qian.wealthAttacksSeal) + '克该透印'
        + (qian.wealthCombinesSeal ? '，同一对另见戊癸五合' : '') : '') : '',
    list(climate?.huangSupport).length ? '黄例原局无水印，本运实际助身位置为' + climate.huangSupport.map(value => row(value.moving)).join('、') : '',
    li ? '李例为丙火日，时寅藏印位是' + row(li.seal) + '，原局火根见' + list(li.fireRoots).map(row).join('、')
      + '，原评以土食伤太重另论' : '',
    ...contacts(li?.earthFeedsWealth, '李例的原局土食伤泄给运财的位置', '生'),
    ...contacts(li?.waterChecksDay, '李例按原评另查的运水官杀克身位置', '克'),
    climate?.foodSealSourceComparison?.id === 'printed-wealth-seal-separate' ? '己丑原例按原评为财印不相碍，月令'
      + row(climate.foodSealSourceComparison.food) + '明透，印见' + row(climate.foodSealSourceComparison.seal)
      + '，财在' + list(climate.foodSealSourceComparison.wealth).map(row).join('、') : '',
    ...list(climate?.foodSealWealth).filter(value => [value.movingWealth, value.secondaryWealth, value.movingOutput, value.movingSeal, value.movingAuthority]
      .some(values => list(values).length))
      .map(value => '财解印的位置为原局' + row(value.wealth) + '克' + row(value.seal) + '，同一印克月令' + row(value.food)
        + (list(value.exposedFood).length ? '，该食神另有同干透出在' + value.exposedFood.map(row).join('、') : '')
        + (list(value.movingWealth).length ? '；本运' + value.movingWealth.map(row).join('、') + '也克该印' : '')
        + (list(value.secondaryWealth).length ? '；运支余藏财' + value.secondaryWealth.map(row).join('、') + '也克同一原印' : '')
        + (list(value.movingOutput).length ? '；本运' + value.movingOutput.map(row).join('、') + '生同一原局透财' : '')
        + (list(value.movingSeal).length ? '；反向另见' + value.movingSeal.map(row).join('、') + '克同一月令食神' : '')
        + (list(value.movingAuthority).length ? '；反向另见' + value.movingAuthority.map(row).join('、') + '生同一原局印' : '')
        + '；该透财的原局根位' + roots(list(value.wealthRoots).filter(root => root.position !== 'decadal'))
        + '，当步运支根位' + roots(list(value.wealthRoots).filter(root => root.position === 'decadal'))),
    ...list(climate?.foodSealWealth).flatMap(value => [
      ...list(value.movingAuthorityCombinesFood).map(({ moving, target }) => row(moving) + '实际五合' + row(target)),
      ...list(value.movingSealChecksExposedFood).map(({ from, to }) => row(from) + '克月令食神的同干明透' + row(to)),
    ]),
    ...contacts(climate?.winterWealthFeedsFire, '冬金的运财到原局火杀位置', '生'),
    ...list(climate?.winterFireLuck).map(value => '冬金本运火官杀' + row(value.fire) + '克' + row(value.day)
      + '，月令' + list(value.waterChecks).map(row).join('、') + '也克同一运火'
      + (list(value.movingWealth).length ? '；同运的' + value.movingWealth.map(row).join('、') + '生这处运火' : '')
      + '；寒暖取用仍待核'),
    list(climate?.shuSealPeer).length ? '舒例本运对照成分为' + climate.shuSealPeer.map(value => row(value.moving)).join('、')
      + '；分别保存运干印与金支比劫' : '',
    ...list(p.roots).flatMap(value => chinese(value.stem) ? ['干' + value.stem + '的产品根位为'
      + (list(value.roots).map(root => position(root.position) + chinese(root.pillar) + (root.exactStem ? '含同干' : '只有同五行异干')).join('、') || '已知柱中未见')
      + '；同五行异干根不自动成为原文有效根，不能由根数断财能破印或身食轻重'] : []),
    ...list(p.natalWoodMembers).map(value => '亥卯未成员' + chinese(value.branch) + '的原局位置为'
      + (list(value.natalPositions).map(position).join('、') || '已知部分未见') + '；大运' + (value.luckPresent ? '另提供该支' : '不提供该支')),
    '原局成员齐、运来补支、半会和已成化必须分开，不把沈例亥卯两支补为完整亥卯未',
    ...list(p.natalRenDingWealthPairs).map(pair => '原局壬与丁财的实际五合位置为' + row(pair.first) + '和' + row(pair.second) + '；不表示已合去或成化'),
    ...list(p.movingFivePairs).flatMap(pair => row(pair.moving) && row(pair.target)
      ? ['运来五合位置为' + row(pair.moving) + '对' + row(pair.target) + '；运来壬不冒充梁例所说原局另透壬的假设'] : []),
    p.summerWood === true ? '已核夏月木日的历法位置；食伤见火与印见水分别记录，不能由夏月自动定火炎木焚或水已调候' : '',
    p.winterMetalWaterFoodCandidate === true ? '已核冬月金日、水食藏于月令的候选；舒例壬干实际为伤官、丁干实际为七杀，不因金水食神的章名改换十神' : '',
    ...list(p.printedCases).flatMap(value => value.matches === true ? ['四柱与录文' + chinese(value.name) + '图逐柱相同：'
      + list(value.pillars).filter(chinese).join('、') + '；只作录图对照，不声称历史本人'] : []),
    ...list(p.sourceVariants).filter(chinese),
    ...printedLuckDescription(p),
    '胡例戌中藏辛财仍保留；同章关于财运的相反条件须分别核，不把食杀轻重、身旺弱和制杀太过由十神数量决定',
    '透财解印例的己财没有同干藏根，寅申仍藏同五行戊财；产品根位不能替代原文所说己财无根与解救无力的取义',
    '钱例甲日丙干实际为食神，木火伤官的统称不把丙改为伤官；夏木无印的黄例也不能与已经带印的配置混成同一前提',
    chinese(p.luckPillar) ? '实际大运为' + p.luckPillar + '，运干十神为' + chinese(p.luckTenGod) + '，产品运支首藏十神为' + chinese(p.luckBranchMainQiGod)
      + '；二者分别留位，不擅定原句所有运类取法' : '',
    p.stageStart && p.stageEnd ? '完整运段为' + at(p.stageStart) + '至' + at(p.stageEnd) + '，截止不计入' : '',
    '身食财杀轻重、清杂、用神、制化救应、调候及相反财运分支仍待核；与其他背景重复的同一柱位只作一份见证',
  ]);
}

function leoMercuryRuledHouseTopics(p) {
  if (p.progressedBody !== 'Mercury' || p.natalTargetId !== 'Neptune' || p.targetKind !== 'natal' || p.aspectType !== 'opposition'
    || p.rulership?.first?.body !== 'Mercury' || !Array.isArray(p.rulership.first.ruledHouses)) return '';
  // Leo and Green, The Horoscope in Detail, pp. 14–15 and 80 (fifth house investments).
  const topics = ['个人处境', '钱财与所有物', '手足、书信文书、基础学习与短途出行', '家宅、家庭与不动产',
    '子女、娱乐、感情及投机', '受雇与服务关系', '合作与伴侣关系', '遗产或伴侣与合伙人的钱财',
    '远行、高等教育、出版或法律事务', '职业、名望、雇主与上级', '朋友与团体交往', '私下事务与援助'];
  const houses = p.rulership.first.ruledHouses;
  return sentences([
    ...houses.flatMap(row => Number.isInteger(row?.house) && topics[row.house - 1]
      ? ['按Leo与Green的宫位说明，水星实掌第' + row.house + '宫，可核' + topics[row.house - 1] + '的领域'] : []),
    houses.length === 0 ? '本命宫头已计算，水星未实际掌任何宫位' : '',
    '原文的一般人物线索另列文书人员、雇员、信使或代理人，仍须核现实处境',
  ]);
}

function leoRulershipDescription(p) {
  if (p?.profile !== 'leo-natal-pair-rulership-1928-support-v1') return '';
  const body = value => {
    if (!bodies[value?.body]) return '';
    const placement = bodies[value.body] + '的本命星座为' + (signs[value.sign] || '未核')
      + '，按辅助表该星座的宫主为' + (bodies[value.signRuler] || '未核');
    if (value.status === 'not_allotted_in_supporting_table') return placement + '；辅助表未给该星分配守护星座，掌宫保持未分配，不写成掌宫为零，也不套现代海王星守双鱼或天王星守水瓶';
    if (value.status === 'house_frame_unavailable') return placement + '；本命角点依据未齐，实际掌宫未知，不以空数组声称没有掌宫';
    if (value.status !== 'calculated_from_natal_cusps') return placement + '；掌宫状态未核';
    return placement + '；按本命真实Placidus宫头，该星掌'
      + (list(value.ruledHouses).length ? value.ruledHouses.map(v => '第' + v.house + '宫（宫头' + (signs[v.sign] || '星座未核')
        + '，黄经' + degrees(v.longitude) + '）').join('、') : '零个宫头；这是该完整宫头环中没有宫头落入其守护星座')
      + '；掌宫与该星实际占宫不同，不按自然宫号或该星落在哪宫替代';
  };
  return sentences([
    '以下掌宫口径采用Alan Leo一九二八年第四版明确星座宫主表，属同作者辅助版本，尚未证实与一九〇六原书同版表相同',
    body(p.first), body(p.second),
    typeof p.mutualDomicileExchange === 'boolean' ? '双方本命星座' + (p.mutualDomicileExchange ? '互守对方在辅助表的守护星座' : '不构成辅助表中的互守对方守护星座')
      + '；只核星座坐标，不把互守直接当作原文互相处置、强弱中和或救应成功' : '至少一方在辅助表未分配守护星座，互守对方星座关系保持未核',
    '原文有利本命相位是另一条条件；已有黄经夹角或赤纬差不自动成为有利相位，月亮同性质、轻重、领域资格及有效缓和仍须核',
  ]);
}

function generalRemedyDescription(p) {
  if (p.sourceDecisionProfile !== 'zpqz-general-remedy-premises-v1') return '';
  const position = key => layers[key] || (key === 'decadal' ? '本步大运' : '');
  const row = value => value && chinese(value.stem) ? position(value.position) + chinese(value.kind) + value.stem
    + '（' + (value.position === 'day' && value.kind !== '支藏' ? '日元' : chinese(value.god)) + '）' : '';
  const pairs = (key, relation, title) => list(p[key]).map(value => title + '：' + row(value.from) + relation + row(value.to)
    + '，原局柱差' + value.columnDistance + (list(value.between).length ? '，中隔'
      + value.between.map(v => position(v.position) + chinese(v.pillar)).join('、') : '') + '；只核对象和位置，不代表取用或制化成功');
  const directional = (values, title) => {
    const groups = new Map();
    for (const value of list(values)) {
      const from = row(value.from), relation = chinese(value.relation), to = row(value.to);
      if (!from || !relation || !to) continue;
      const key = from + relation;
      if (!groups.has(key)) groups.set(key, new Set());
      groups.get(key).add(to);
    }
    return [...groups].map(([key, targets]) => title + '：' + key + [...targets].join('、')
      + '；是具名五行联系，不是去病、护杀或滋身已经成立');
  };
  return sentences([
    ...pairs('companionWealthContacts', '克', '比劫对实际财'), ...pairs('foodKillerContacts', '克', '食神对实际七杀'),
    ...pairs('outputWealthContacts', '生', '食伤对实际财'), ...pairs('wealthKillerContacts', '生', '财对实际七杀'),
    ...directional(p.sealDayContacts, '原局印对实际日元'),
    '本运实际成分分别为' + list(p.remedyMovingComponents).map(row).filter(Boolean).join('、') + '；运干与各运支藏干不合为同一神',
    ...directional(p.remedyMovingContacts, '本运对原局'), ...directional(p.remedyNatalContacts, '原局对本运'),
    '带财为忌须核实际财；喜财损印句未明说本命必须先有财，有无财位分别记录，未见财不宣称已财损印；同一财印几何不能替代身弱印用与身旺财用两种相反条件',
    '同章食神带杀明确定义为月令食神而干透七杀；这里只是月令藏神与明透候选，不当成已选定食格',
    '身弱食杀可考察运来印，不要求本命先有印；不借后章无印分支改写本条。实际印化杀、制泄与强弱仍未知',
    '虽佩印而不为用须有实际印，不能用全无印替代；本批未明透藏处不擅加印必须明透门槛，露藏与同干异干根位仍分别保存',
    '七杀食制的枭运分支只登记偏印，不泛化为所有正印运皆夺食；官露财印两旺原句的比劫伤官例外不擅扩为食神',
    '身强弱、财印食杀旺度、用神、去病、合化及救应仍须核，不按颗数或同五行根数选定本条吉凶',
  ]);
}

function sealFoodDescription(p, at) {
  if (p.profile !== 'zpqz-seal-output-exposure-targets-v1') return '';
  const position = value => value === 'decadal' ? '本步大运' : layers[value] || '';
  const state = value => value === true ? '已见' : value === false ? '完整已知柱位中未见' : '尚未核全';
  const rowText = row => position(row?.position) && chinese(row.stem) ? position(row.position) + (chinese(row.pillar) || '')
    + (chinese(row.kind) || '') + row.stem + (chinese(row.god || row.tenGod) ? '（' + (row.god || row.tenGod) + '）' : '') : '';
  const family = rows => list(rows).map(rowText).filter(Boolean).join('、');
  const contact = (rows, label) => list(rows).flatMap(row => rowText(row.from) && rowText(row.to) ? [label + '的五行位置对为'
    + rowText(row.from) + '对' + rowText(row.to) + '，柱差' + row.columnDistance
    + (list(row.between).length ? '，中间已知柱为' + row.between.map(r => position(r.position) + chinese(r.pillar)).join('、') : '')
    + (row.bothExposed === true ? '；两端均明透' : '；至少一端是支藏，不把藏干当明透或虚构其干序')
    + '；相生相克和柱差不证明有效制护'] : []);
  const premise = (value, label) => label + (value === true ? '这一位置前提成立' : value === false ? '这一位置前提不成立' : '这一位置前提未核全');
  const stages = p.confirmed === true ? p.sealLuckEvidence : undefined;
  const linSen = stages?.linSenSealComparison;
  const wealthySon = stages?.wealthySonSealComparison;
  const linhuai = p.confirmed === true ? p.linhuaiGuardComparison : undefined;
  const jiaChen = p.confirmed === true ? p.jiaChenAuthorityComparison : undefined;
  const coldBing = p.confirmed === true ? p.coldBingSealComparison : undefined;
  const sun = p.confirmed === true ? p.sunSourceSealReview : undefined;
  const killerSealPressure = p.confirmed === true ? p.killerSealPressure : undefined;
  const heAuthority = p.confirmed === true ? p.heSourceAuthoritySeal : undefined;
  const killerSealSupport = p.confirmed === true ? p.killerSealSupport : undefined;
  const foodKillerRemedies = p.confirmed === true ? p.foodKillerRemedyPaths : undefined;
  const robberyWithSeal = p.confirmed === true ? p.robberyAgainstSealWealth : undefined;
  const sourceHurtWealthSeal = p.confirmed === true ? p.sourceHurtWealthSeal : undefined;
  const wealthWithHurtSeal = p.confirmed === true ? p.wealthPressesHurtSeal : undefined;
  const exposedOfficerWealthSeal = p.confirmed === true ? p.exposedOfficerWealthSeal : undefined;
  const monthOfficerSealLuck = p.confirmed === true ? p.monthOfficerSealLuck : undefined;
  const wealthWithKiller = p.confirmed === true ? p.wealthWithArrivingKiller : undefined;
  const li = stages?.liLuck;
  const ma = stages?.maLuck;
  return sentences([
    '以下印食与护官结构来自同一本命候选和同一实际运段，分别核明透、支藏、具名作用对象及柱位，不按十神出现或数量定轻重',
    '本命已知四柱为' + list(p.natalPillars).map(r => position(r.position) + chinese(r.pillar)).join('、')
      + '；月令藏神候选为' + list(p.monthHiddenGods).filter(chinese).join('、') + '，不凭藏有一神就确定印格或官格',
    p.autumnWoodSourceNotWeak === true ? '依徐注，秋木失时而有明透比印及年日时三柱通根。已核根位为'
      + family(p.autumnWoodSupport?.roots) + '，这支排除身弱前提' : '',
    sun && rowText(sun.seal) && rowText(sun.killer)
      ? '孙布政原评取' + rowText(sun.seal) + '通关，原图' + rowText(sun.killer) + '孤单' : '',
    sun?.jiaOfficerCombination ? '本步甲戌运的运干甲官与日主己相合，原评以官煞相混为嫌' : '',
    p.maSourceStrongDayLightSeal === true ? '马参政原评判日元旺、印轻，按原图取印通关' : '',
    p.maoSourceAuthorityToExposedSeal === true ? '毛状元原评按官杀生同一时透庚印判本步，留作来官杀的原图对照' : '',
    p.boluoSourceXuWesternWealthAndSeal === true ? '孛罗原图同一步运干土克年、时两处壬印，运支本气金也生同一两处壬印。徐注判这两步尚无大碍' : '',
    heAuthority && rowText(heAuthority.incomingAuthority) && rowText(heAuthority.seal)
      ? '按何参政原图，' + rowText(heAuthority.incomingAuthority) + '生同一' + rowText(heAuthority.seal)
        + '。徐注把这一步作为有印化官杀的实运例' : '',
    ...list(killerSealPressure).map(({ killers, seal, moving }) => '原局七杀' + family(killers) + '克日元并生原局'
      + rowText(seal) + '，该印又生日元。' + family(moving) + '各生这处原印，也各有克日元的方向'
      + '。杀重身轻、用印化杀及再见官杀的实际增重仍待核'),
    ...list(killerSealSupport).map(moving => rowText(moving) + (moving.god === '劫财' ? '与日元同五行' : '有生日元的方向')
      + '，是同一原局杀印结构下的印劫扶身对照，实际效果仍待核'),
    ...list(p.confirmed === true ? p.killerSealSupportPaths : undefined).map(({ killer, seal, day, movingSeals, movingRobberies }) =>
      '同一原透七杀' + rowText(killer) + '生原印' + rowText(seal)
      + (family(movingSeals) ? '，也生' + family(movingSeals) + '，这些运印有生' + rowText(day) + '的方向' : '')
      + (family(movingRobberies) ? '，另见与日元同五行的' + family(movingRobberies) : '')
      + '。取用与实际扶身效果待核'),
    stages?.zhangWarmth ? '张例原局已有' + rowText(stages.zhangWarmth.natalFire) + '，月柱为'
      + chinese(stages.zhangWarmth.month.pillar) + (family(stages.zhangWarmth.movingFire)
      ? '，本运的火另列为' + family(stages.zhangWarmth.movingFire) : '，本运干与支本气未见火')
      + '。原评按此例的原局丙火辨取运' : '',
    p.confirmed === true && p.foodKillerSourceReading === 'liu-weak-day' ? '刘提督原图本命无印，原评按此图身弱，印运另核' : '',
    p.confirmed === true && p.liuSourceWealthSeparation ? '刘提督原评年癸财与时乙杀之间隔着月辛、日己，财不党煞' : '',
    p.confirmed === true && p.foodKillerSourceReading === 'hu-overcontrol' ? '胡会元原图本命无印，原评按此图杀轻制过' : '',
    ...list(foodKillerRemedies).flatMap(({ food, killer, monthSource, seals, secondarySeals, outputs, wealth, owls, liuSourceSeals }) => [
      family(liuSourceSeals) ? '刘提督原例本步' + family(liuSourceSeals) + '承同一时柱' + rowText(killer)
        + '所生，克同一月令' + rowText(food) + '并生日己' : '',
      family(seals) ? rowText(food) + '克' + rowText(killer) + '。同一七杀生' + family(seals)
        + '，这些运印各克这处月令食神，也各生日元。化杀、制食和滋身的实际作用待核' : '',
      ...list(secondarySeals).flatMap(row => rowText(row?.source) && rowText(row.seal) && rowText(food) && rowText(killer)
        ? ['运干' + chinese(row.source.stem) + '生本步同支余藏' + chinese(row.seal.stem) + '，同一原局' + rowText(killer) + '也生该印。该印克月令'
          + rowText(food) + '并生日元，保留三处实际关系供核'] : []),
      family(outputs) ? family(outputs) + '克同一个' + rowText(killer) + '，原局的' + rowText(food)
        + '也有克该七杀的方向。身强杀旺与实际制杀程度待核' : '',
      family(wealth) ? rowText(food) + '生' + family(wealth) + '，该运财再生同一个' + rowText(killer)
        + '。原局食神也有克此杀的方向，实际化食和破用待核' : '',
      family(wealth) && monthSource?.role === '食神' && chinese(monthSource.stem) && Number.isInteger(monthSource.hiddenOrder)
        ? '月令' + monthSource.stem + '食神为' + (monthSource.mainQi === true ? '支中本气' : '支中第' + monthSource.hiddenOrder + '藏')
          + (family(monthSource.exposedSameStem) ? '，同干也见于' + family(monthSource.exposedSameStem) : '') : '',
      family(owls) ? rowText(food) + '克月中' + rowText(killer) + '，月中此杀生' + family(owls)
        + '，这些运偏印各克同一原局食神。实际夺食与护杀须合参' : '',
    ]),
    ...list(robberyWithSeal).flatMap(({ robbery, seals, natalWealthPaths, movingWealthPaths }) => [
      list(natalWealthPaths).length ? '' : rowText(robbery) + '为实际运劫，原局有' + family(seals) + '生日元，完整原局未见财端',
      ...list(natalWealthPaths).map(({ wealth, seal }) => rowText(robbery) + '克原局' + rowText(wealth) + '，这处原财克'
        + rowText(seal) + '，该原印生日元。身印强弱决定这条联系如何取用，实际损印与去病待核'),
      ...list(movingWealthPaths).map(({ wealth, seal }) => rowText(robbery) + '克同一步的' + rowText(wealth) + '，该运财克'
        + rowText(seal) + '。这处财来自本运'),
    ]),
    ...list(wealthWithHurtSeal).map(({ hurt, seal, wealth, monthHurt }) => rowText(seal) + '生日元并克'
      + (monthHurt ? '月令的' : '') + rowText(hurt) + '，该伤官生实际运财' + family(wealth)
      + '，这些运财也克原先制伤的同一原印。取财泄伤或佩印须按原局强弱分别合参'),
    ...list(exposedOfficerWealthSeal).map(({ seal, hurt, officer, wealth, moving }) => rowText(hurt) + '克明透的' + rowText(officer)
      + '，' + family(list(wealth).map(value => value.source)) + '生同一官，这处官又生' + rowText(seal) + '，原印克上述伤官。'
      + list(wealth).map(value => rowText(value.source) + '与此印' + (list(value.between).length ? '中隔'
        + value.between.map(v => position(v.position) + chinese(v.pillar)).join('、') : value.source.position === seal.position ? '同柱' : '相邻')
        + '，' + (value.bothExposed === true ? '两端明透' : '至少一端支藏')).join('。')
      + '。本运' + list(moving).map(({ component, checksOfficer, checksWealth, sameElementAsDay }) => rowText(component)
        + (checksOfficer ? '克同一原官' : '') + (sameElementAsDay ? '与日元同五行' : '')
        + (family(checksWealth) ? '并克所列原财' + family(checksWealth) : '')).join('、') + '。财印两旺及实际是否相碍仍待核'),
    ...list(monthOfficerSealLuck).map(({ seal, hurt, officer, exposedSeal, officersFeedingSeal, sealsFacingHurt, wealthFacingSeal }) =>
      (exposedSeal ? '印露伤藏' : '伤露印藏') + '的实际柱位为' + rowText(seal) + '克' + rowText(hurt) + '，该伤克月令的' + rowText(officer)
      + (family(officersFeedingSeal) ? '。本运' + family(officersFeedingSeal) + '生同一处原印' : '')
      + (family(sealsFacingHurt) ? '。本运' + family(sealsFacingHurt) + '另有克同一伤官的方向' : '')
      + (family(wealthFacingSeal) ? '。本运' + family(wealthFacingSeal) + '克此处藏印' : '')
      + '。官格取用及制伤护官效果仍待核'),
    ...list(wealthWithKiller).map(({ wealth, killer, hiddenFoodFeedingWealth, hiddenFoodFacingKiller, exposedOutputFacingKiller }) =>
      (family(hiddenFoodFeedingWealth) ? family(hiddenFoodFeedingWealth) + '有生同一月令财' + rowText(wealth) + '的方向。' : '')
      + rowText(wealth) + '生' + rowText(killer) + '，同一个运杀也克日元'
      + (family(hiddenFoodFacingKiller) ? '。原局藏食' + family(hiddenFoodFacingKiller) + '有克同一运杀的方向，实际能否制杀仍须核' : '')
      + (family(exposedOutputFacingKiller) ? '。已明透的' + family(exposedOutputFacingKiller) + '另有回克同一运杀的方向' : '')
      + '。财是否得用及泄财、制杀的实际效果待核'),
    ...list(p.gods).flatMap(row => chinese(row.god) ? [row.god + '明透' + state(row.exposed)
      + (family(row.exposedRows) ? '：' + family(row.exposedRows) : '') + '；支藏' + state(row.hidden)
      + (family(row.hiddenRows) ? '：' + family(row.hiddenRows) : '')] : []),
    '日元本身不算另一颗外透比肩；时柱未知时，未透和未藏不能作为全局不存在',
    premise(p.sealExposedHurtOnlyHidden, '印已明透、伤官仅藏而未明透'),
    premise(p.hurtExposedSealOnlyHidden, '伤官已明透、印仅藏而未明透'),
    premise(p.hiddenFoodNoExposedOutputs, '食神藏、食神与伤官都未明透') + '；伤官已透时不能仍套输出全未透的分支，未透不等于无制杀作用',
    ...contact(p.sealOutputContacts, '印克食伤'), ...contact(p.wealthSealContacts, '财克印'), ...contact(p.officerSealContacts, '官杀生印'),
    ...list(stages?.officerToMonthSeal).map(value => '原局官印候选：' + rowText(value.from) + '生' + rowText(value.to)),
    ...list(stages?.wealthControlsMonthSeal).map(value => '本运财克实际月令印：' + rowText(value.from) + '克' + rowText(value.to)),
    linSen && chinese(linSen.variant) ? '林森' + linSen.variant + '原例，原评按寅卯辰会方及月印透干看作印旺取财。'
      + '本盘见' + chinese(linSen.clash?.values) + '相冲，' + rowText(linSen.wealth) + '是原局财位'
      + (family(linSen.incomingWealth) ? '，' + family(linSen.incomingWealth) + '也克同一处月印' : '')
      + '，实际作用仍待核' : '',
    wealthySon ? '浙西富翁子戊寅月异文，年申与日申分别冲月寅，年庚与时乙有相合位置。'
      + (wealthySon.incomingSeal ? rowText(wealthySon.incomingSeal) + '是原评所列的己卯运扶印对照。' : '')
      + (family(wealthySon.incomingWealth) ? family(wealthySon.incomingWealth) + '克同一处月印，供财运反向对照。' : '')
      + '合化及实际强弱与救应仍待核' : '',
    ...list(stages?.dayFeedsMovingOutput).map(value => '本运食伤承日元相生：' + rowText(value.from) + '生' + rowText(value.to)),
    ...list(stages?.officerMonthSealRelays).filter(value => list(value.incomingWealth).length || list(value.incomingOutput).length)
      .map(value => '官印至日元的同一链：' + rowText(value.officer) + '生' + rowText(value.seal) + '，同一月令印再生' + rowText(value.day)),
    stages?.zhangOutput ? '张例的食神在' + rowText(stages.zhangOutput) + '，与朱例明透的壬伤官分别论'
      + (stages.zhangPeer ? '；本步运干辛与日元同五行' : '') : '',
    stages?.zhangDayRoot && stages.zhangOutput ? '张例日酉藏辛生时子藏癸的实际位置为'
      + rowText(stages.zhangDayRoot) + '到' + rowText(stages.zhangOutput) + '。按徐注留泄秀的原例方向' : '',
    p.zhangSourceOutputInsteadOfSeal === true ? '张参政原图按徐注取时支食神泄秀，年财与来官的生克位置仍可另查' : '',
    ...list(stages?.zhuGuardRoots).map(value => '朱例原注按土厚论，同一护官透印' + rowText(value.seal)
      + '的原局同五行藏气见于' + family(value.roots) + '。原例取财与印轻分支分别核验'),
    ...list(stages?.wealthControlsGuard).map(value => '原局' + rowText(value.seal) + '克' + rowText(value.hurt) + '，同一食伤可克'
      + rowText(value.officer) + '；本运' + rowText(value.moving) + '克同一原局印'
      + (value.hurtFeedsWealth && value.wealthFeedsOfficer ? '，也连接原局食伤生运财、运财生原局官的位置' : '') + '；取用取决于实际轻重'),
    ...list(stages?.zhuChecksMovingOutput).map(value => '朱例原局' + rowText(value.seal) + '回克' + rowText(value.moving)
      + '，该运支本气食伤又克' + rowText(value.officer) + '；实际护官待核'),
    p.zhouSourceRobberyDispute ? '周原图此运同一来劫' + rowText(p.zhouSourceRobberyDispute.robbery) + '克'
      + rowText(p.zhouSourceRobberyDispute.wealth) + '，原财又克月印' + rowText(p.zhouSourceRobberyDispute.seal)
      + '。徐注取庚财，林注取甲印，两说分别留证' : '',
    p.zhouSourceWealthOutput ? '周原图实排庚午，' + rowText(p.zhouSourceWealthOutput.hurt) + '生'
      + rowText(p.zhouSourceWealthOutput.wealth) + '，该运财又克月印' + rowText(p.zhouSourceWealthOutput.seal) : '',
    linhuai ? '临淮原例年印' + rowText(linhuai.seal) + '克月食' + rowText(linhuai.hurt) + '，该食克时官' + rowText(linhuai.officer)
      + '。年印与时官柱差为' + linhuai.sealOfficerDistance + '。原评另有年印救护不及的对照' : '',
    linhuai?.sourceSealStanding ? '临淮原图依原评取印旺，年印' + rowText(linhuai.sourceSealStanding.seal)
      + '与月卯同干藏位及年亥、时寅同木支持分别核实' : '',
    ...list(linhuai?.movingOutputAtOfficer).map(value => '临淮例本运食伤' + rowText(value) + '克同一时官' + rowText(linhuai.officer)),
    ...list(linhuai?.movingAuthorityAtSeal).map(value => '临淮例本运官杀' + rowText(value) + '生同一年印' + rowText(linhuai.seal)),
    ...list(linhuai?.movingSealAtFood).map(value => '临淮例本运印' + rowText(value) + '克同一月食' + rowText(linhuai.hurt)),
    linhuai?.chouYou ? '临淮例运丑与日酉见会位' + (linhuai.chouYou.missingSi ? '，巳支未齐' : '')
      + (linhuai.chouYou.maoYouClash ? '，原局仍有月卯日酉之冲' : '')
      + (family(linhuai.chouYou.hiddenWealth) ? '，运丑所藏财为' + family(linhuai.chouYou.hiddenWealth) : '')
      + '。徐注在此例认为财旺未破印，实际会化与解冲待核' : '',
    li ? '李例所用配置的月印透藏为' + rowText(li.exposedSeal) + '与' + rowText(li.monthSeal)
      + '。日午刃位实藏' + rowText(li.dayBlade) + '，日元生原局明透食伤' + family(list(li.originalOutput).map(link => link.to))
      + '。印旺身强仍须合参' : '',
    li?.sourceDiagramExact === true ? '年、月、日、时四柱均与李状元原图相同。徐注对这张原图写乙卯印专旺、此造反忌比劫' : '',
    p.namedHeavySeal === true ? '此四柱与《子平真诠评注》本篇明确按印重或印旺分析的原图一致，原评该盘时按具名条件核对' : '',
    ...list(stages?.lightSealWealthContrast).map(({ robbery, wealth, killer, seal, incomingWealth }) =>
      '徐注将此原图按财旺、煞印均弱论。' + rowText(robbery) + '克' + rowText(wealth)
      + '，该财克' + rowText(seal) + '。' + rowText(killer) + '生同一月印'
      + (family(incomingWealth) ? '，此运另见' + family(incomingWealth) + '克同一月印' : '')),
    p.hasZhangReviewedPeerSupport === true ? '张参政原图实际到辛丑运。运辛比肩与原官印生身、日酉辛生时子癸的次序一并承接徐注比劫运可行的判断' : '',
    p.xiaSourceFavorsArrivingWealth === true || p.xiaSourceFavorsArrivingAuthority === true
      ? '夏阁老原图的月未藏乙印、时辰藏癸水均已核，实际运财或官煞依徐注的金水润燥分支核对' : '',
    p.hasQianSourceWealthSealPressure === true
      ? '钱参政原图实到戊戌运，运干戊与戌中本气戊均克月透癸，月癸在日子仍有根，运干戊癸五合另核' : '',
    ...list(li?.outputFeedsMovingWealth).map(value => '李例配置的原局食伤到运财：' + rowText(value.from) + '生' + rowText(value.to)),
    ...list(li?.wealthAtMonthSeal).map(value => '同一运财' + rowText(value) + '也克上述月令藏乙印，作用待核'),
    ...list(li?.guiFoodPairs).map(value => '合戊的同一运癸'
      + (value.foodControlsGui && value.guiControlsDay ? '同时受该戊食所克，并克日丙' : '另核克与反克的位置')
      + '。实际合到' + rowText(value.food)
      + (list(value.foodEarthRoots).length ? '，该戊食的原局同五行藏气见于' + value.foodEarthRoots.map(root => rowText(root)
        + (root.sameStem === true ? '同干' : '异干')).join('、') : '')
      + '。合化仍待核'),
    ...list(li?.renFeedsSeal).map(value => '李例同一运壬生' + rowText(value.to)
      + (li.renControlsDay ? '并克日丙' : '') + '；运支的同五行水藏气为'
      + (list(li.renRoots).filter(chinese).join('、') || '未见') + '，滋润效果仍待核'),
    list(li?.waterRootWitnesses).length ? '同一运干的水根分别核对：' + li.waterRootWitnesses.map(({ root, sameStem }) =>
      (root.position === 'decadal' ? '本运支' : '原局') + rowText(root) + (sameStem ? '与运干同干' : '与运干同五行异干')).join('、') : '',
    ...list(li?.bladeClashes).map(pair => (list(pair.members).includes('decadal') ? '运支另冲本命日午' : '原局已有子午冲')
      + '，参与位置为' + list(pair.members).map(position).join('与') + '。调候与冲的实际作用分别待核'),
    list(li?.movingFire).length ? '本步与日丙同属火的实际运干或支本气为' + family(li.movingFire)
      + '。若同时见运食伤生泄或原局食伤生运财，各方向按各自成分留证' : '',
    list(li?.movingOtherFire).length ? '李状元原图对照的运支余藏火为' + family(li.movingOtherFire) : '',
    list(li?.fireGroup).length ? '寅午戌的实际成员：' + li.fireGroup.map(value => chinese(value.branch) + '在原局'
      + (list(value.natalPositions).map(position).join('、') || '未见') + (value.inLuck ? '，本运支也见' : '')).join('。')
      + '。合局与实际火势待核' : '',
    ...list(stages?.exposedKillerSealLuck).flatMap(value => [
      '原局透杀' + rowText(value.killer) + '生' + rowText(value.seal) + '，同一透印生' + rowText(value.day),
      ...list(value.wealth).map(moving => '同一运财' + rowText(moving) + '生上述透杀并克其所生的同一透印。破印效果待核'),
      ...list(value.authority).map(moving => '运官杀' + rowText(moving) + '生同一原局透印，同时克日元。实际引化待核'),
      ...list(value.foodCheckedBySeal).map(moving => '原透印回克运食伤' + rowText(moving)
        + '，该运食伤也可克同一原局透杀。实际制化待核'),
      family(value.originalHiddenWealth) ? '同一原局杀印配置另见藏财' + family(value.originalHiddenWealth)
        + '，该财有生杀、克印方向' : '',
    ]),
    ...list(stages?.maSealChains).map(value => '马例申印通关的位置：' + rowText(value.killer) + '生'
      + rowText(value.seal) + '，该月令庚印再生日壬'),
    ...list(stages?.maWealth).map(value => '马例本运' + rowText(value.moving) + '克同一月令庚印，同时生' + rowText(value.killer)),
    ...list(ma?.movingOutput).map(value => '申印与透戊已核位，' + rowText(ma.day) + '生本运食伤' + rowText(value) + '。泄秀效果待核'),
    family(ma?.peersWithOriginalOutput) ? '含原局食伤的比劫运：' + family(ma.peersWithOriginalOutput)
      + '与日壬同五行，原局食伤在' + family(ma.originalOutput) + '。两者作用待核' : '',
    list(ma?.nativeWater).length ? '日壬在原局的水藏气：' + ma.nativeWater.map(({ root, sameStem }) =>
      rowText(root) + (sameStem ? '与日元同干' : '与日元同水异干')).join('、') + '。有效根力待核' : '',
    stages?.maZi ? '本运子补齐原局申辰；同段若见财克申庚，仍按实际端点另列' : '',
    ...list(stages?.robberyChecksWealth).map(value => '劫财制财的候选：' + rowText(value.moving) + '克'
      + rowText(value.wealth) + '，该原局财也克' + rowText(value.seal)),
    ...list(stages?.companionChecksWealth).map(value => '比肩制财的候选：' + rowText(value.moving) + '克'
      + rowText(value.wealth) + '，该原局财也克' + rowText(value.seal)),
    ...list(stages?.sealsHelpWithWealth).map(value => '印运生身的候选：' + rowText(value.moving) + '生' + rowText(value.day)
      + (list(value.pressures).length ? '；原局' + family(value.pressures.map(link => link.from)) + '也克同一运印' : '')),
    ...list(stages?.wealthFeedsLuckOfficer).map(value => '财印之间的运官杀候选：' + rowText(value.wealth) + '生'
      + rowText(value.moving) + '，同一运成分再生' + rowText(value.seal)),
    list(stages?.nativeSealColumns).length > 1 ? '原局多柱见印，所在柱为' + list(stages.nativeSealColumns).map(position).join('、')
      + '，印位分别为' + family(stages.originalSealPositions) + '。印势轻重另核' : '',
    list(stages?.nativeSealColumns).length === 1 && list(stages?.originalSealPositions).length > 1
      ? '原局所见印均在' + position(stages.nativeSealColumns[0]) + '。该柱透藏或藏干有多个位置，柱位按一处计' : '',
    ...list(stages?.multipleSealWealthPaths).flatMap(value => [
      ...list(value.movingWealth).map(moving => '原财' + rowText(value.wealth) + '、运财' + rowText(moving)
        + '均克同一月印' + rowText(value.seal) + '。实际损印待核'),
      ...list(value.movingOutput).map(moving => '本运食伤生原局财的位置：' + rowText(moving) + '生' + rowText(value.wealth)
        + '，这位财克' + rowText(value.seal) + '。实际损印待核'),
    ]),
    stages?.wangNamedLightWealth ? '汪侍郎原图按财轻印重论。评注对照本例的财食运与时段' : '',
    ...list(stages?.wangBingXin?.pairs).map(({ first, second, between }) => '汪例原局'
      + rowText({ ...first, kind: '天干', god: first.tenGod }) + '与' + rowText({ ...second, kind: '天干', god: second.tenGod }) + '为五合'
      + (list(between).length ? '，中隔' + list(between).map(row => position(row.position) + chinese(row.pillar)).join('、') : '，两干相邻')),
    list(stages?.wangBingXin?.southeastLuck).length ? '汪例所述东南运程，本运实际木火位置为'
      + family(stages.wangBingXin.southeastLuck) : '',
    stages?.wangSiWealth ? '汪例癸巳运的运支无水藏气，巳本气为' + rowText(stages.wangSiWealth) + '；两种录文各存' : '',
    stages?.wangChenRoot ? '汪例壬辰运的辰支实藏癸水，为异干同五行的根位；原例波折的原因待核' : '',
    stages?.wangWoodLuck ? '汪例本运支本气为' + rowText(stages.wangWoodLuck) + '，支中无运干金的同五行藏气' : '',
    stages?.wangWoodRelief ? '汪例本步' + rowText(stages.wangWoodRelief.output) + '生原局' + rowText(stages.wangWoodRelief.wealth)
      + '，同一原财再克原月印' + rowText(stages.wangWoodRelief.seal) : '',
    stages?.wangYiWeiRelief ? '汪例本步' + rowText(stages.wangYiWeiRelief.output) + '生未中余藏'
      + rowText(stages.wangYiWeiRelief.wealth) + '，该运财克月印' + rowText(stages.wangYiWeiRelief.seal)
      + '。未的本气另为' + rowText(stages.wangYiWeiRelief.branchMainQi) : '',
    ...list(stages?.natalAuthoritySeal).map(value => '原局' + family([...value.officers, ...value.killers]) + '都生同一'
      + rowText(value.seal) + '，该透印再生' + rowText(value.day)
      + (list(value.moving).length ? '；当运' + family(value.moving) + '也生这一个透印' : '') + '，通关效果待核'),
    ...list(stages?.natalAuthoritySeal).flatMap(path => list(path.movingWealth).map(value => '同一运财' + rowText(value.wealth)
      + '生原局' + family(value.feeds) + '，同时克上述官杀所生之' + rowText(path.seal) + '。实际财破印待核')),
    ...list(jiaChen?.monthPaths).map(path => '甲辰原图只见藏印：' + family([...path.officers, ...path.killers]) + '生月令'
      + rowText(path.seal) + '，该藏印生日元。原局印的透藏按实际柱位核验'),
    ...list(jiaChen?.monthPaths).flatMap(path => list(path.movingWealth).map(value => '甲辰图实际运财' + rowText(value.wealth)
      + '生原局' + family(value.feeds) + '且克同一个月令藏印' + rowText(path.seal) + '。财印作用待核')),
    jiaChen?.wuXu ? '甲辰图戊戌运保留原评有关波折的提醒，实际作用待核' : '',
    ...list(jiaChen?.outputLuck).flatMap(row => [
      '甲辰原例按原评取食伤泄秀，' + rowText(row.day) + '生' + rowText(row.output),
      family(row.checksAuthority) ? '同一运食伤另见克原局' + family(row.checksAuthority) + '的方向' : '',
      family(row.movingAuthorityToSameSeal) ? '运中官杀' + family(row.movingAuthorityToSameSeal) + '另生同一月印' + rowText(row.seal) : '',
    ]),
    rowText(jiaChen?.supportingBranch?.branchQi) ? '甲辰原例的身印旺地取法：本步运支本气为'
      + rowText(jiaChen.supportingBranch.branchQi)
      + (jiaChen.supportingBranch.branchQi.element === jiaChen.supportingBranch.day.element ? '，与' + rowText(jiaChen.supportingBranch.day) + '同五行'
        : '，生' + rowText(jiaChen.supportingBranch.day))
      + (family(jiaChen.supportingBranch.assistingStems) ? '，另见助身运干' + family(jiaChen.supportingBranch.assistingStems) : '')
      + (family(jiaChen.supportingBranch.competingWealth) ? '；同段另有运财触及月印' + family(jiaChen.supportingBranch.competingWealth) : '')
      + (family(jiaChen.supportingBranch.competingAuthority) ? '；同段另有官杀生原藏印' + family(jiaChen.supportingBranch.competingAuthority) : '') : '',
    rowText(coldBing?.seal) ? '冷木丙火例先核' + rowText(coldBing.seal) + '与原透官杀'
      + (rowText(coldBing.movingStemControl) ? '，同段运干' + rowText(coldBing.movingStemControl) + '克制这两处原透' : '')
      + (family(coldBing.movingAuthorityPressure) ? '，同段再来的官杀为' + family(coldBing.movingAuthorityPressure) : '') : '',
    p.confirmed === true && p.namedHurtingOfficerPeerEvidence ? '具名庚午运核到运干庚比肩及同一盘的财、印、正官、伤官' : '',
    ...list(stages?.natalAuthorityCombinations).map(value => '原局透杀的五合位置为' + rowText(value.kill) + '与'
      + rowText(value.combiner) + '；仍须另核原局印是透是藏'),
    ...list(stages?.dayFeedsOriginalOutput).map(value => '原局日元到食伤的位置：' + rowText(value.from) + '生' + rowText(value.to)),
    ...list(stages?.outputWealthSealPaths).map(path => '日元' + rowText(path.day) + '生' + rowText(path.output) + '，同一食伤生运财'
      + rowText(path.wealth) + '，该财再克' + rowText(path.seal) + '。印的轻重和实际作用待核'),
    ...list(stages?.niuLuck?.foodWealth).map(value => '牛例食神引财的位置：' + rowText(value.from) + '生' + rowText(value.to)
      + (stages.niuLuck.yiGeng ? '；原局另见乙庚五合' : '') + '，取用与合化待核'),
    stages?.niuLuck ? '牛监薄原图按徐注身强印旺、食神引财留作对照' : '',
    ...[...list(stages?.niuLuck?.wealthRoots), ...list(stages?.niuLuck?.sealRoots)].map(({ source, root, sameStem }) =>
      '牛例' + rowText(source) + '在' + rowText(root) + '见' + (sameStem === true ? '同干藏根' : '同五行异干藏根')),
    list(stages?.niuLuck?.peerRoots).length ? '牛例实际运支中的同五行水藏气为' + family(stages.niuLuck.peerRoots) : '',
    ...list(p.roots).flatMap(row => chinese(row.stem) ? ['已透干或运干' + row.stem + '的根位为'
      + (list(row.roots).map(root => position(root.position) + chinese(root.pillar) + (root.exactStem === true ? '含同干' : '仅含同五行异干')).join('、') || '本次已知柱位未见')
      + '；不按根位数宣布印重、印轻或身强弱'] : []),
    p.liSkeleton === true ? '当前符合李例乙卯月、丙午日和戊己明透的骨架；其他柱差异、印专旺和火旺木焦仍须核，不以任意一柱卯代替乙卯月' : '',
    ...list(p.movingFivePairs).flatMap(pair => pair.target?.stem === '戊' && pair.target.tenGod === '食神' && p.luckStem === '癸'
      ? ['本步癸运与实际' + rowText(pair.target) + '构成戊癸五合位置；这是合实际食神的目标，不表示已经合去或化劫'] : []),
    p.maoSkeleton === true ? '当前符合癸日酉月、己杀庚印明透且食伤未明透的毛例位置骨架；原文不见食伤与原局有财的见字范围尚未核定，不能把明透未见扩大为所有支藏皆无' : '',
    p.maSkeleton === true ? '当前符合壬日申月透戊、原局见辰的马例骨架；申印通关、水土强弱及财断枢纽还未由这些位置成立' : '',
    ...list(p.shenZiChen).map(row => '申子辰成员' + chinese(row.branch) + '在原局'
      + (list(row.natalPositions).map(position).filter(Boolean).join('、') || '本次已知柱位未见')
      + '，大运' + (row.luckPresent === true ? '提供该支' : '不提供该支')),
    typeof p.groupComplete === 'boolean' ? '申子辰成员在当前原局与运支' + (p.groupComplete ? '齐全' : '尚未齐全')
      + '；齐全不等于已化印为劫，运补齐和原局已齐不能互相代替' : '时柱未知且现有成员不全，不能认定完整申子辰已被排除',
    ...list(p.printedCases).flatMap(row => row.matches === true ? ['当前四柱按原录文与' + chinese(row.name) + '图逐柱相同，年月至时分别为'
      + list(row.pillars).filter(chinese).join('、') + '；不声称为历史本人'
      + (row.stemCheck?.yearMonthCompatible === false ? '；该录图年干与月干搭配不合通常起月规则，原文未改，不能当作已复原有效生日' : '')
      + (row.stemCheck?.dayHourCompatible === false ? '；该录图日干与时干搭配仍待校，不能当有效时刻' : '')] : []),
    ...printedLuckDescription(p),
    chinese(p.luckPillar) ? '本步大运' + p.luckPillar + '，运干十神为' + chinese(p.luckTenGod) + '，产品运支首藏十神为' + chinese(p.luckBranchMainQiGod)
      + '；未详取法只分别留作运类候选，不合成统一吉凶' : '',
    sourceHurtWealthSeal?.role === 'separated' ? '都统制原例壬财与丁印分居，原评为财印不碍'
      + (list(sourceHurtWealthSeal.robberies).length ? '。本步另见劫财克原壬财' : '')
      + (list(sourceHurtWealthSeal.printedSupport).length ? '，原评此运以丁印扶身' : '') : '',
    p.wealthHeavySourceHurtSealPressure === true ? '都统制原图实交癸卯后，另核原月伤官生当运癸财、运癸克年丁印' : '',
    p.coldBingBranchAuthorityWithWealth === true ? '湿木丙火原图实在辛亥运，亥中壬杀生同一月印又克日元，运干辛财另外留位' : '',
    sourceHurtWealthSeal?.role === 'remedy' ? '丞相原例按壬财损丁印取用'
      + (list(sourceHurtWealthSeal.robberies).length ? '，本步另见劫财克原壬财' : '')
      + (list(sourceHurtWealthSeal.printedSupport).length ? '。' + chinese(p.luckPillar) + '运的财位为'
        + list(sourceHurtWealthSeal.printedSupport).map(rowText).filter(Boolean).join('、') : '') : '',
    p.confirmed === true && !sourceHurtWealthSeal && p.sourceWealthRole === 'remedy' && list(robberyWithSeal).length
      ? '原评在这幅命例取财损印，本步劫所及的财位须按这一取法参照' : '',
    p.confirmed === true && p.sourceWealthRole === 'disease' && list(robberyWithSeal).length
      ? '原评在这幅命例把原财列为妨碍，本步劫所及的财位仍须核实际救应' : '',
    '印重可取财与印轻忌财是相反条件，不能由相同财印位置同时选定。原图的张例子中食神与朱例明透伤官也不改名混为同一作用；护官所及、制伤制杀、印化和滋润调候仍须同段核定',
    generalRemedyDescription(p),
    p.stageStart && p.stageEnd ? '所依实际运段为' + at(p.stageStart) + '至' + at(p.stageEnd) + '，截止不计入；不把运干支各划成未证实的五年' : '',
  ]);
}

function monthCommandDescription(p, at) {
  if (p.profile !== 'zpqz-month-command-exposure-atomic-v1') return '';
  const position = value => value === 'decadal' ? '本步大运' : layers[value] || '';
  const witnesses = rows => list(rows).flatMap(row => position(row.position) && chinese(row.pillar)
    ? [position(row.position) + row.pillar] : []).join('、');
  const roots = rows => list(rows).flatMap(row => position(row.position) && chinese(row.pillar)
    ? [position(row.position) + row.pillar + '藏' + list(row.stems).filter(chinese).join('、')
      + (row.exactStem === true ? '，有同干根位' : '，仅同五行根位')] : []).join('；');
  const present = value => value === true ? '已见' : value === false ? '在已知完整四柱中未见' : '未核全，不能当作没有';
  const component = row => (position(row?.position) || '') + chinese(row?.kind) + chinese(row?.stem) + chinese(row?.god);
  const concise = values => [...new Set(values)].slice(0, 5);
  const [bridge, nativeWealth, bladeAuthority, authority] = p.confirmed === true
    ? [p.wealthBridge?.paths, p.nativeWealthBridgePaths ?? p.bladeWealthPaths, p.bladeAuthorityPaths, p.luJieAuthorityPaths] : [];
  const [bladeWealth, bladeWealthExample] = p.confirmed === true ? [p.bladeWealthPaths, p.bladeWealthExample] : [];
  const monthlySeat = row => '月令' + chinese(row?.branch) + '所藏' + chinese(row?.stem) + chinese(row?.tenGod);
  const authorityOutput = p.confirmed === true ? p.authorityOutputPaths : undefined;
  const bladePrinted = p.confirmed === true ? p.bladePrintedSupport : undefined;
  const bladeClearing = p.confirmed === true ? p.bladeClearingSourceComparison : undefined;
  const bladeFoodRelief = p.confirmed === true ? p.bladeFoodReliefComparison : undefined;
  const bladeMuOfficer = p.confirmed === true ? p.bladeKillerMuOfficerComparison : undefined;
  const bladeKillerSource = p.confirmed === true ? p.bladeKillerSourceComparison : undefined;
  const bladeQianlong = p.confirmed === true ? p.bladeQianlongSourceComparison : undefined;
  const officerSource = p.confirmed === true ? p.luOfficerSourceComparison : undefined;
  const gao = p.confirmed === true ? p.gaoContext : undefined;
  const waterSeats = list(gao?.waterSeats);
  const gaoTerms = gao?.birthTiming;
  const [outputPaths, zhang, metalWater] = p.confirmed === true ? [p.luJieOutputPaths, p.zhangOutputCaseEvidence, p.metalWaterOutputCaseEvidence] : [];
  const youOfficer = p.confirmed === true ? p.youOfficerContext : undefined;
  const youStem = youOfficer?.movingStem;
  const youRoot = youOfficer?.branchRoot;
  const outputSeal = list(outputPaths).flatMap(path => list(path.movingSeal).map(seal => component(seal) + '克月令比劫所生的原局'
    + component(path.output) + '并生' + chinese(p.dayMaster) + '日元'
    + (roots(path.outputRoots) ? '。该食伤原局根位为' + roots(path.outputRoots) : '') + '。食伤是否过重仍须核'));
  const outputOther = list(outputPaths).flatMap(path => [
    ...list(path.movingWealth).map(money => component(path.output) + '生实际' + component(money)),
    ...list(path.movingAuthority).map(target => component(path.output) + '克实际' + component(target) + '，该官杀也有克日方向'),
  ]);
  return sentences([
    '以下月令与透藏绑定同一本命候选和实际大运段，只核结构，不把藏比肩等同建禄或把劫财位置等同完整阳刃格',
    '本命已知柱位为' + witnesses(p.natalPillars),
    chinese(p.dayMaster) && chinese(p.monthBranch) ? '日干' + p.dayMaster + '，本命月支' + p.monthBranch : '',
    chinese(p.luBranch) ? '补读《三命通会》十干禄位得日干禄位' + p.luBranch
      + (p.atLu === true ? '，月支与禄位相同，是本书建禄定义的位置前提' : '，月支不在该禄位；其他柱藏比肩不能代替月建逢禄')
      + '；此处只借禄坐标，不混用其他书的羊刃流派' : '',
    p.dayYang === true ? '本书只取五阳干的月令阳刃，禄前一位为' + chinese(p.bladeBranch)
      + (p.atYangBlade === true ? '，本命月支到此位' : '，本命月支未到此位；年日时的同名位不补作月刃')
      : p.dayYang === false ? '日干为阴，本书不设其阳刃；阴干月劫与阳刃不混称' : '',
    p.bladeYueSourceComparison ? '《论阳刃》岳武穆原图已核月刃与时巳藏庚七杀，按原评取刃旺煞轻、财印为佐' : '',
    bladeQianlong ? '乾隆原评判煞旺劫轻，保留月酉冲年卯与时子冲日午' : '',
    ...list(bladeQianlong?.movingSeal).map(row => '实际' + component(row) + '承原局官杀而生同一月刃'),
    ...list(bladeQianlong?.movingPeer).map(row => '实际' + component(row) + '与月刃同五行'),
    ...list(bladeQianlong?.movingWealth).map(row => '实际' + component(row) + '生原局官杀，仍保留为财的生助位置'),
    p.bladeKillerJoin && (p.bladeAuthorityWealthOnlyJoinedKiller === true || p.bladeOutputOnlyJoinedKiller === true)
      ? '月刃所藏' + chinese(p.bladeKillerJoin.blade?.stem) + '实际透于' + component(p.bladeKillerJoin.exposedBlade)
        + '，与' + component(p.bladeKillerJoin.killer) + '五合。只依靠同一被月刃所合七杀的运段路径排除' : '',
    chinese(p.monthMainQi) ? '产品本气表列月支首藏干为' + p.monthMainQi + '，相对日干为' + chinese(p.monthMainQiGod)
      + (p.mainQiJieCandidate === true ? '；它是月令劫财的明示候选，仍未据此确定完整月劫取用' : '')
      + '；本气次序不当作旺度分数，土月及多藏取用仍须同书核定' : '',
    ...list(p.godWitnesses).flatMap(row => chinese(row.god) ? [row.god + '：' + present(row.present)
      + '；透干' + present(row.exposed) + (witnesses(row.exposedPositions) ? '，在' + witnesses(row.exposedPositions) : '')
      + (list(row.hiddenPositions).length ? '；支藏位置为' + row.hiddenPositions.flatMap(h => layers[h.position] && chinese(h.branch) && chinese(h.stem)
        ? [layers[h.position] + h.branch + '藏' + h.stem] : []).join('、') : '')] : []),
    ...concise(list(bridge).map(path => '食伤生财的位置对照。月令藏' + chinese(path.peer.stem) + chinese(path.peer.tenGod)
      + '生' + component(path.output) + '，该食伤生' + component(path.movingWealth) + '。实际通关待核')),
    ...concise(list(nativeWealth).map(path => '同一' + component(path.output) + '所生原财为' + component(path.wealth)
      + '，所接运财为' + component(path.movingWealth)
      + (roots(path.rootPositions) ? '，原财的原局根位为' + roots(path.rootPositions) : '，原局支藏未见该财的同五行根位')
      + '。取用与根力仍须核')),
    ...concise(list(bladeWealth).filter(path => path.movingWealth?.kind === '运支余藏').map(path => monthlySeat(path.peer)
      + '生' + component(path.output) + '，该食伤同接原财' + component(path.wealth) + '及' + component(path.movingWealth)
      + (roots(path.rootPositions) ? '，原财的原局根位为' + roots(path.rootPositions) : '，原局支藏未见该财的同五行根位')
      + '。运支余藏是否取作原文财地待核')),
    p.confirmed === true && p.bladeWealthBridgeSourceComparison
      ? '徐注戊土原例仅见日戌余辛，未按通关取用。原注另提申，原图四支无申。该原例排除这条食伤通关路径' : '',
    list(bladeWealth).length && p.bladeWealthMatched === false ? '可见阳刃及食伤生财的位置，原财缺《论阳刃》所需的本命根' : '',
    bladeWealthExample?.yinHai ? '阳刃用财原图可见日寅与时亥六合，合化仍待核' : '',
    list(bladeWealthExample?.shenZiChen).length ? '同一原图的申子辰成员实位为' + bladeWealthExample.shenZiChen.map(row =>
      chinese(row.branch) + (list(row.positions).map(position).join('、') || '未见')).join('、') + '，三合成化仍待核' : '',
    bladePrinted ? '丞相原图核到' + component(bladePrinted.killer) + '生' + component(bladePrinted.seal)
      + '，同一原印生' + monthlySeat(bladePrinted.blade) : '',
    ...list(bladePrinted?.authority).map(row => component(row) + '生该原印' + component(bladePrinted.seal)),
    ...list(bladePrinted?.unrootedWealth).map(row => component(row) + '在运支无同五行根，生该原杀' + component(bladePrinted.killer)),
    ...list(bladePrinted?.outputsCheckedBySeal).map(row => component(bladePrinted.seal) + '克本步' + component(row)),
    p.confirmed === true && p.bladeSupportStrongSource === true ? '丙寅原图的原评取刃旺杀强' : '',
    bladeClearing ? '庚申原图时壬合月丁，原评留年丙七杀。'
      + (bladeClearing.output ? component(bladeClearing.output) + '实克' + component(bladeClearing.authority)
        + '，同段' + component(bladeClearing.wealth) + '也能生同一处年丙'
        : component(bladeClearing.seal) + '实克参与取清的' + component(bladeClearing.helper)) : '',
    bladeMuOfficer ? '穆同知原图取年午丁正官制刃' + (bladeMuOfficer.officerClash ? '，本步子午正冲' : '') : '',
    bladeFoodRelief ? '戊子原图的三处透戊实克' + component(bladeFoodRelief.officer) + '，徐注对这一图另取印制食' : '',
    p.bladeWealthSourceComparison ? '和珅原图的庚寅运实见寅午方向，徐注对这一运另有不利判读' : '',
    ...concise(list(bladeAuthority).flatMap(path => list(path.movingWealth).map(row => component(row) + '生原局'
      + component(path.authority) + '，同一官杀克' + monthlySeat(path.blade)
      + (roots(path.authorityRoots) ? '。原局官杀根位为' + roots(path.authorityRoots) : '')
      + '。刃旺与实际制刃待核'))),
    ...concise(list(bladeAuthority).flatMap(path => [
      ...list(path.movingSeal).map(row => '原局' + component(path.authority) + '生' + component(row)
        + '，同一运印生' + monthlySeat(path.blade) + '。刃与官杀的轻重及化杀效果待核'),
      ...list(path.movingPeer).map(row => component(row) + '与' + monthlySeat(path.blade) + '同属日元五行，作为助刃候选'),
    ])),
    ...concise(list(authorityOutput).map(path => chinese(path.route) + '一路，' + component(path.output)
      + '克原局' + component(path.authority) + '，同一' + chinese(path.authority?.god) + '克' + monthlySeat(path.seat)
      + (roots(path.authorityRoots) ? '。该原局官杀根位为' + roots(path.authorityRoots) : '')
      + '。日元强弱、是否取该官杀为用以及实际制化仍须核')),
    ...concise(list(authorityOutput).flatMap(path => [
      ...list(path.originalSealsCheckingOutput).map(row => '原局' + component(row) + '克这处' + component(path.output) + '，列作护'
        + chinese(path.authority?.god) + '的结构对照'),
      ...list(path.movingSealsCheckingOutput).map(row => component(row) + '同运克这处' + component(path.output) + '，列作运印制食伤的对照'),
    ])),
    ...concise(list(p.bladeFourGrowthRootClashes).map(pair => '同干本命根所在四生支见六冲，'
      + list(pair.members).map(position).join('与') + '的实际支位为' + chinese(pair.values))),
    list(authorityOutput).length && p.bladeKillerNamedNotStrong === true && !p.bladeKillerJiaComparison
      ? '四柱与用印化杀的丞相原图相同。徐注判该例日元不旺，食伤克杀和印回克按此原例读' : '',
    p.bladeKillerJiaComparison ? '贾平章原图按徐注以寅午会印，壬申和癸酉原评取食伤制过旺的七杀。当前运核到'
      + list(p.bladeKillerJiaComparison.paths).map(path => component(path.output) + '克' + component(path.authority)).join('、') : '',
    ...concise(list(authority).flatMap(path => [
      ...list(path.combinations).map(row => '原局' + component(row.helper) + '与' + component(path.killer) + '有五合位置，另见明透原官'
        + component(path.officer) + '。实际取清效果待核'),
      ...list(path.controls).map(row => component(row) + '克明透原杀' + component(path.killer)
        + '，另见明透原官' + component(path.officer) + '。制杀的实际范围待核'),
      ...list(path.outputLuck).map(row => component(row) + '克同一明透原杀' + component(path.killer)
        + (list(path.outputAlsoChecksOfficer).some(other => other.stem === row.stem && other.kind === row.kind) ? '，亦有克原官的五行方向' : '')),
      ...list(path.peerLuck).map(row => component(row) + '与日元同干，比肩的实际助身效果待核'),
    ])),
    ...concise(list(authority).flatMap(path => list(path.sealsCheckingOutput).map(({ output, seal }) =>
      '禄劫官杀并透的运印对照见' + component(seal) + '克原局制杀之' + component(output)))),
    ...concise(list(authority).flatMap(path => list(path.sealsSupportingDay).map(seal =>
      '运印' + component(seal) + '生同一' + chinese(p.dayMaster) + '日元，是否再取印仍须合原局轻重'))),
    ...concise(list(authority).flatMap(path => [
      ...list(path.wealthFeedsKiller).map(row => component(row) + '生同一明透原杀' + component(path.killer)),
      ...list(path.wealthFeedsOfficer).map(row => component(row) + '生另一处明透原官' + component(path.officer)),
    ])),
    ...concise(list(authority).flatMap(path => list(path.authorityPressure).map(row =>
      component(row) + '克同一' + chinese(p.dayMaster) + '日元，实际官杀轻重待核'))),
    p.confirmed === true && p.namedSealChecksFood === true ? '禄格食制杀原例的戊子运中，子支癸印克原局时干丙食神，按这一运段核印是否伤用' : '',
    ...concise(outputSeal), ...concise(outputOther),
    list(zhang?.natalZiSeals).length ? '张状元例的子藏癸印在' + list(zhang.natalZiSeals).map(row => position(row.position)).join('、')
      + '，评注用于调候，取用与运印分别看' : '',
    roots(zhang?.natalFoodRoots) ? '张例原丙食的同干根位为' + roots(zhang.natalFoodRoots) + '，与本命子水印分别取证' : '',
    zhang?.gengKiller === true && !list(zhang.gengRoots).length ? '张例庚午运干庚杀在原局和运支均未见同五行根，原局丙食有制庚方向' : '',
    ...list(zhang?.xinOutputPairs).map(pair => '张例辛未运干辛与' + list(pair.members).filter(id => id !== 'decadal').map(position).join('、')
      + '原局丙食有干合位置'),
    zhang?.renShenAuthoritySeal === true ? '张例壬申运干壬印克丙食，同时申首藏庚杀，按原例保留两端的提醒' : '',
    metalWater?.waterGroup ? '金水相涵例原局申子辰成员分别见于' + list(metalWater.waterGroup.byBranch).map(ids => list(ids).map(position).join('、')).join('、')
      + '，原局无火，成化仍须核' : '',
    ...concise(list(metalWater?.natalWealthLinks).map(link => '金水相涵原图可查' + component(link.output)
      + '生原局' + component(link.wealth) + '，保留原评食伤生财所指的原局位置')),
    ...list(p.metalWaterSealRelief).map(({ output, seal }) => '金水相涵原例己未另核' + component(seal)
      + '克同一原局' + component(output) + '并生日元，徐注在此盘许印运'),
    list(metalWater?.fireAuthority).length ? '金水相涵例本运火官杀位置为' + list(metalWater.fireAuthority).map(component).join('、')
      + '，与同运印位分别核。该原图的徐注对火官杀另有不利评语' : '',
    chinese(p.luckPillar) ? '本步大运为' + p.luckPillar + '；运干' + chinese(p.luckStem) + '为' + chinese(p.luckTenGod)
      + '，运支' + chinese(p.luckBranch) + '首藏' + chinese(p.luckBranchMainQi) + '为' + chinese(p.luckBranchMainQiGod)
      + '；干与支分别判断，不能同五行一概而论' : '',
    roots(p.dayMasterRoots) ? '日干根位分别为' + roots(p.dayMasterRoots) + '；不按数量决定身强或刃旺' : '本次已知柱位未见日干同五行根，不保证未知时柱无根',
    p.jiaYouMonth === true ? '本局符合原段甲日酉月的明确语境，官弱与官旺仍须分开核'
      : '本局不是原段甲日酉月，不能只凭见辛就套用那四条官星取运说明',
    '本命辛干透出' + present(p.xinExposed) + (witnesses(p.xinExposedPositions) ? '，在' + witnesses(p.xinExposedPositions) : '')
      + '；支藏辛' + present(p.xinHidden),
    roots(p.xinRoots) ? '辛的逐柱与运支根位为' + roots(p.xinRoots) + '；有根不自动等于官已旺' : '',
    youOfficer?.monthOfficer ? witnesses([youOfficer.monthOfficer]) + '藏辛正官，' + (witnesses(p.xinExposedPositions)
      ? '原局同干明透于' + witnesses(p.xinExposedPositions) : '完整原局的天干未透辛') : '',
    ...list(youOfficer?.natalContacts).map(({ source, relation }) => component(source) + relation + '同一个月令辛正官'),
    ...list(youOfficer?.metalFormations).map(row => row.branches + row.kind + '成员在'
      + list(row.members).map(witnesses).join('、') + (row.nativeComplete ? '，原局已齐' : '，本运补齐') + '，实际成化仍须核'),
    youRoot ? witnesses([youRoot]) + '的运支本气为' + chinese(youRoot.stem) + chinese(youRoot.god)
      + '，和月酉所藏辛是' + (youRoot.exactStem === true ? '同干根位' : '同金异干根位') + '。实际得地程度仍须核' : '',
    youOfficer?.liuSourceOfficerStrength ? '四柱与徐乐吾所评刘镇华原图一致。月酉辛实透，日支申有金根。月辛与时丙中隔日甲。'
      + '《子平真诠评注》按丙辛相合，《造化元钥评注》按隔位不合。用于本条的原评仍取官旺通根' : '',
    youStem?.route === 'geng-killer' ? witnesses([youStem]) + '的运干庚为七杀'
      + (witnesses(p.xinExposedPositions) ? '，与原局已透辛正官同见，列为混杀候选' : '，此盘原局辛仍藏于支') : '',
    youStem?.route === 'xin-repeat' ? witnesses([youStem]) + '的运干辛为正官，与原局已透辛同见，列为重官候选' : '',
    youStem?.route === 'xin-new-exposure' ? witnesses([youStem]) + '的运干辛使原局藏辛首次透出，所对原局藏位在'
      + witnesses(youOfficer.newExposureSeats) + '。实际透清发用仍须核' : '',
    list(youOfficer?.xiaolianSourceMetalWater?.nativeFire).length
      ? '孝廉原图在实际庚子运见庚及子中癸，原局各处火对同一月藏辛有克向，且都受子癸克。原评按官受制太过取金水' : '',
    youOfficer?.liSourceXinExposureComparison
      ? '李参政原评仍取印，实际辛卯的卯冲本命月酉，从本段透清候选排除此原例' : '',
    witnesses(youOfficer?.nativeKillerExposures) ? '原局庚七杀明透在' + witnesses(youOfficer.nativeKillerExposures) : '',
    ...list(youOfficer?.rootReview).flatMap(root => {
      const seat = ({ 'xin-you-lu': '酉辛禄位', 'metal-storehouse': '丑金库', 'metal-residual': '戌金余气',
        'other-metal-root': '其他金根' })[root?.seat];
      const place = witnesses([root]), opposing = witnesses(root?.opposingColumns);
      return seat && place ? [place + '为' + seat + (root.exactStem ? '，实藏同干辛' : '，只见同五行根')
        + (opposing ? '，与' + opposing + '实见六冲' : '')] : [];
    }),
    ...list(youOfficer?.exposureReview).flatMap(row => {
      const place = witnesses([row]), combining = witnesses(row?.combiningColumns);
      return place && combining ? [place + '明透' + chinese(row.god) + chinese(row.stem) + '，与' + combining + '具备天干五合位置'] : [];
    }),
    ...list(youOfficer?.rootClashes).flatMap(pair => list(pair).length === 2 && pair.every(row => witnesses([row]))
      ? [pair.map(row => witnesses([row])).join('与') + '六冲，涉及月酉或本运新增的根位，实际根力仍待核'] : []),
    typeof p.xinNewlyExposedByLuck === 'boolean' ? '原局辛藏而未透、运干辛新透这一结构前提' + (p.xinNewlyExposedByLuck ? '成立' : '不成立')
      + '；新透不等于实际透清发用，已透又来辛也不自动裁定重官危害' : '时柱未知时不能确认原局辛未透，不补作运来新透',
    '高尚书原图按年、月、日、时分别为' + list(p.gaoPrintedColumns).filter(chinese).join('、')
      + (p.gaoSameColumns === true ? '；当前四柱与原图逐柱相同，但不声称为历史本人' : p.gaoSameColumns === false ? '；当前四柱并非逐柱相同，不能冒充已复原该个案' : '；时柱未知，不能确认与原图相同'),
    '本命子申见证分别为' + list(p.natalZiShen).map(row => chinese(row.branch) + '在' + (list(row.positions).map(position).filter(Boolean).join('、') || '本次已知柱位未见')).join('；'),
    gaoTerms ? '出生在立秋至白露的申月' + (gaoTerms.afterChuShu === true ? '、处暑起至白露前' : '、立秋起至处暑前') + '。先留节气位置，原文的气候取用仍须核' : '',
    waterSeats.length ? '水局成员实位为' + waterSeats.map(row => chinese(row.branch) + '在' + (witnesses(row.positions) || '原局未见')).join('，')
      + (waterSeats.every(row => witnesses(row.positions)) ? '。申子辰成员齐备，实际成化待核' : '。原局见申子两支，实际会合与化伤待核') : '',
    gao ? '申内金水及子内伤官分别见于' + [...list(gao.shenMetalAndWater), ...list(gao.ziWater)].map(row => position(row.position)
      + chinese(row.branch) + '藏' + chinese(row.stem) + chinese(row.tenGod)).join('、') : '',
    p.fireAbsent === true ? '完整原局透干和支藏均未见火；这不是只检查明透丙丁'
      : p.fireAbsent === false ? '原局有火的明示见证为' + list(p.nativeFireWitnesses).flatMap(row => position(row.position) && chinese(row.pillar)
        ? [position(row.position) + row.pillar + '的' + chinese(row.kind) + chinese(row.fireStem)] : []).join('、')
        : '原局已知部分未见火，时柱未知，不能确认全局无火',
    '运干火与巳午运支分别登记：运干' + (p.luckFireStem === true ? '是火' : '不是火')
      + '、运支' + (p.luckFireBranch === true ? '为巳午' : '不是巳午') + '；此为火运坐标候选，原句干支范围尚未定',
    ...list(gao?.fireAuthority).map(row => component(row) + '有克庚日元的官杀方向'),
    list(gao?.minorFire).length ? '同运支内另藏火气' + list(gao.minorFire).map(row => chinese(row.stem) + chinese(row.tenGod)).join('、')
      + '，另列于运支首藏之外' : '',
    list(gao?.metalAndWater).length ? '同运金水位置见' + list(gao.metalAndWater).map(component).join('、') : '',
    ...(gao ? list(p.gaoSoilReturns).map(row => position(row.wood?.position) + chinese(row.wood?.pillar) + '明透甲木克' + component(row.soil)
      + (row.combinesMovingStem === true ? '，同一甲与运干己还见五合' : '')
      + (roots(row.woodRoots) ? '。该甲木的原局同五行根位为' + roots(row.woodRoots) : '。完整原局支藏未见甲木同五行根位')
      + '。实际能否制土仍须核') : []),
    '同卷高命前段说逆行水木火均美，取运段却说官煞火运反不相宜；两种评语分别保留，不择利合成统一火运结论，七月气候、偏气、实际合化和甲木回克效果仍须核',
    bladeKillerSource?.monthClash?.kind === '六冲' ? '具名丞相戊子运同时见运支子冲原局午刃，依原评排除该段的扶刃候选' : '',
    list(officerSource?.paths).length ? {
      'jin-printed-protection': '金丞相例核到原透庚印克制实克同一月透戊官的运食伤，依原评保留印护对照',
      'li-ji-hai-neutral': '李知府己亥的食神与原局时透壬官有相克位置，原评将这步列为无碍对照',
      'li-wu-xu-pressure': '李知府戊戌的运干戊伤官实克原局时透壬官，原评明确保留这一食伤压力',
    }[officerSource.route] : '',
    ...printedLuckDescription(p),
    p.stageStart && p.stageEnd ? '所依实际运段为' + at(p.stageStart) + '至' + at(p.stageEnd) + '，截止不计入；不自行拆成干支各管五年' : '',
  ]);
}

function yangTabooDescription(p) {
  if (p.profile !== 'quanshu-yang-strength-birth-taboo-v1' || p.ready !== true) return '';
  const words = { 守: '同宫', 冲: '对宫', 三合: '三合位置', 邻宫: '邻宫', 其他: '不在同宫、对宫、三合或邻宫' };
  const related = row => [['focusRelation', '本限焦点'], ['lifeRelation', '本命命宫'], ['bodyRelation', '本命身宫']]
    .flatMap(([key, label]) => words[row?.[key]] ? ['与' + label + '为' + words[row[key]]] : []).join('，');
  const pair = values => list(values).filter(chinese).join('、');
  const groups = row => row && chinese(row.name) ? row.name + '在卷二男表为' + (chinese(row.maleTable) || '未列')
    + '、女表为' + (chinese(row.femaleTable) || '未列') : '';
  const stars = rows => list(rows).flatMap(row => chinese(row.star) && chinese(row.branch) ? [row.star + '在' + row.branch
    + '，卷三明确等级为' + (chinese(row.grade) || '未列，保持未知')] : []).join('、');
  const contacts = [['大限', p.decadalYangRelation], ['小限', p.minorYangRelation]];
  const layersAt = relation => contacts.filter(([, value]) => value === relation).map(([label]) => label).join('、');
  const guard = layersAt('守');
  const axes = p.yangNetVerifiedAxes;
  const verifiedContacts = [['大限', axes?.decadalRelation], ['小限', axes?.minorRelation]];
  const verifiedLayersAt = relation => verifiedContacts.filter(([, value]) => value === relation).map(([label]) => label).join('、');
  const verifiedGuard = verifiedLayersAt('守'), verifiedOpposed = verifiedLayersAt('冲');
  const yangSupport = list(p.yangZiChangFuContacts).flatMap(row => chinese(row?.star) && chinese(row.branch) && words[row.relation]
    ? [row.star + '在' + row.branch + '宫，与羊宫为' + words[row.relation]] : []);
  const ji = p.fallenYangNatalJi, annualYang = p.fallenYangAnnualYang;
  const jielan = p.fallenYangJielanFireJiCandidate === true ? p.fallenYangJielanFireJiWitness : undefined;
  const xingAn = p.fallenYangMingJumenGuardCandidate === true ? p.fallenYangMingJumenWitness : undefined;
  const idleSources = [p.yangNetVolumeTwoIdleLifeCandidate === true && '通行本卷二', p.yangNetMingIdleLifeCandidate === true && '明刻本']
    .filter(Boolean).join('、');
  const lifeIdle = list(p.lifeMajorIdleEvidence).flatMap(row => {
    const editions = [row?.volumeTwo === true && '通行本卷二', row?.mingEdition === true && '明刻本'].filter(Boolean).join('、');
    return editions && chinese(row.star) && chinese(row.branch)
      ? [row.star + '在' + row.branch + '宫，' + editions + '列为闲位，卷三' + (chinese(row.grade) ? '列为' + row.grade : '未列此位等级')] : [];
  });
  const sameSha = list(p.additionalSha).filter(row => row?.relation === '守').map(row => chinese(row.star)).filter(Boolean);
  const tabooCandidate = p.birthTabooWithThreeShaCandidate === true;
  const namedTabooCandidate = p.namedTabooWithThreeShaCandidate === true;
  const namedGuards = namedTabooCandidate ? list(p.namedTabooGuards).filter(row => row.guarded === true) : [];
  const layerName = scope => scope === 'yearly' ? '太岁' : scopes[scope];
  const weakPalace = p.strongPalaceWeakLimitCandidate === true;
  const fallenMajor = p.strongPalaceFallenLimitCandidate === true;
  const dignityWeak = p.strongDignityWeakLimitCandidate === true;
  const dignityFallen = p.strongDignityFallenLimitCandidate === true;
  return sentences([
    '以下在同一本命、同一流年与大小限共同片段中分开记录擎羊、罗网、主曜等级和本生忌候选，不把其中一项当全盘强弱',
    [jielan?.yangBranch, jielan?.decadalBranch, jielan?.minorBranch, jielan?.fire?.branch,
      jielan?.taboo?.star, jielan?.taboo?.branch].every(chinese)
      ? '按《捷览》时位，火星在' + jielan.fire.branch + '宫对冲' + jielan.yangBranch + '宫的擎羊，'
        + jielan.taboo.star + '化忌在' + jielan.taboo.branch + '宫也对冲。大小限实守' + jielan.decadalBranch
        + '、' + jielan.minorBranch + '两端，古空劫为' + list(jielan.voids).filter(row => chinese(row.star) && chinese(row.branch))
          .map(row => row.star + '在' + row.branch + '宫' + (words[row.relation] ? '，与羊宫为' + words[row.relation] : '')).join('、') : '',
    number(p.lunarYear) !== undefined && scopes[p.scope] && chinese(p.branch) ? '农历' + p.lunarYear + '年本段'
      + scopes[p.scope] + '命宫在' + p.branch + '，对应本命' + chinese(p.natalName) : '',
    chinese(p.yangBranch) ? '按生年干独立重算并核唯一归档的擎羊在' + p.yangBranch + '，本段源表等级为' + (chinese(p.yangGrade) || '未列')
      + '；' + related(p) + '；落陷与加杀是两项前提，不能因落陷就补成加杀' : '',
    ...list(p.netMembers).flatMap(row => chinese(row.branch) ? ['罗网候选支位' + row.branch + '；' + related(row)
      + (words[row.yangRelation] ? '；擎羊与该支为' + words[row.yangRelation] : '')] : []),
    p.yangNetVerifiedOpposedLimitCandidate === true ? '本命擎羊在罗网' + p.yangBranch + '宫，同段' + verifiedOpposed + '实际对冲羊宫' : '',
    p.yangNetVerifiedOpposedLimitCandidate === true && p.lifeMajorGradeState === 'all-fallen' && stars(p.lifeMajorStars)
      ? '同段本命命宫的主曜均在卷三星表明列的陷地，可作为卷二所说命宫主星弱的一项候选' : '',
    p.yangNetVerifiedOpposedLimitCandidate === true && lifeIdle.length ? '本命命宫主曜的闲位与卷三等级分列。' + lifeIdle.join('；') : '',
    p.yangNetVerifiedOpposedLimitCandidate === true && idleSources
      ? '按' + idleSources + '所列闲位与卷三陷地逐曜核对，命宫主曜均落在两类位置之一，可列为命宫主星偏弱的一项候选' : '',
    p.yangNetVerifiedAcrossLimits === true ? '大小限分别落在辰戌两端，' + verifiedGuard + '守羊宫' : '',
    p.yangNetVerifiedBothOpposed === true ? '大小限同在羊宫的对宫' : '',
    '二限冲的完整作用对象和接触范围仍待核',
    p.yangTombBirthGuardCandidate === true && guard && chinese(p.birthYearBranch) && chinese(p.yangBranch)
      ? '出生年支' + p.birthYearBranch + '属四墓，' + guard + '实守' + p.yangBranch + '宫的本命擎羊，符合四墓生人守羊限的候选条件' : '',
    p.yangTombLifeGuardCandidate === true && guard && chinese(p.yangBranch)
      ? '本命命宫与擎羊同在四墓' + p.yangBranch + '宫，' + guard + '实守该宫' : '',
    p.yangZiChangFuGuardCandidate === true && guard && chinese(p.yangBranch)
      ? guard + '实守' + p.yangBranch + '宫的擎羊，紫微、文昌、天府齐会该宫，' + yangSupport.join('、') : '',
    [p.yangTombBirthGuardCandidate, p.yangTombLifeGuardCandidate, p.yangZiChangFuGuardCandidate].includes(true)
      ? '这些是同篇的支持条件，实际扶救及与守冲并见时的作用仍待核' : '',
    p.fallenYangGuardShaCandidate === true ? verifiedGuard + '守陷地擎羊宫，羊宫同守' + sameSha.join('、') : '',
    p.fallenYangOpposedShaCandidate === true ? verifiedOpposed + '对冲陷地擎羊宫，羊宫同守' + sameSha.join('、') : '',
    chinese(xingAn?.yangBranch) && xingAn.yangBranch === xingAn.jumenBranch && verifiedGuard
      ? verifiedGuard + '实守' + xingAn.yangBranch + '宫，陷地擎羊与复核过的巨门实居同宫，对应明刊所说的刑暗同行' : '',
    ...list(p.fallenYangMingFixedSha).flatMap(row => p.quanshuFixedFireBellProfile === 'quanshu-nanyangtang-fixed-firebell-v1'
      && row.relation === '守' && chinese(row.star) && chinese(row.branch) ? [
        p.fallenYangMingFixedGuardCandidate === true
          ? verifiedGuard + '实守陷地擎羊所在的' + row.branch + '宫，明刊定宫' + row.star + '同守' : '',
        p.fallenYangMingFixedOpposedCandidate === true
          ? verifiedOpposed + '实冲陷地擎羊所在的' + row.branch + '宫，明刊定宫' + row.star + '同守' : '',
      ] : []),
    p.fallenYangNatalJiCandidate === true && chinese(ji?.stem) && chinese(ji.star) && chinese(ji.branch)
      ? '生年干' + ji.stem + '使' + ji.star + '化忌，与陷地擎羊同在' + ji.branch + '宫，同段'
        + [verifiedGuard && verifiedGuard + '实守此宫', verifiedOpposed && verifiedOpposed + '对冲此宫'].filter(Boolean).join('，') : '',
    p.fallenYangRepeatAnnualCandidate === true && chinese(annualYang?.stem) && chinese(annualYang.branch) && verifiedGuard
      ? '流年干' + annualYang.stem + '所定的流年擎羊与本命陷地擎羊同在' + annualYang.branch + '宫，同段太岁与' + verifiedGuard + '实守该宫' : '',
    ...list(p.mingNamedTabooGuards).flatMap(row => p.namedMingFixedFireBellTabooCandidate === true
      && p.quanshuFixedFireBellProfile === 'quanshu-nanyangtang-fixed-firebell-v1' && chinese(row.star) && chinese(row.branch) ? [
        '申年本生忌按明刊定宫核' + row.star + '在' + row.branch + '宫，由'
          + list(row.scopes).map(scope => scopes[scope]).filter(Boolean).join('和') + '实守',
      ] : []),
    p.yangTombBirthGuardCandidate !== true && typeof p.birthBranchInTombsCandidate === 'boolean' ? '按本生年支' + chinese(p.birthYearBranch) + '所列的四墓生人候选'
      + (p.birthBranchInTombsCandidate ? '符合辰戌丑未支位' : '不在辰戌丑未支位') + '；此处按年支作候选，不宣称免灾已经生效' : '',
    p.mainPositionsReady === true ? '十四主曜唯一归档已核；本命命宫主曜为' + (stars(p.lifeMajorStars) || '此宫没有十四主曜成员，不能因此判弱命')
      + '；本限焦点主曜为' + (stars(p.focusMajorStars) || '此宫没有十四主曜成员，不能因此判弱限')
      : '身命或十四主曜唯一位置未核，不将缺失记录当作无主曜或弱命',
    ...list(p.mainPositions).flatMap(row => chinese(row.star) && chinese(row.branch) && !['守'].includes(row.lifeRelation) && ['冲', '三合'].includes(row.lifeRelation)
      ? ['本命命宫外部主曜' + row.star + '在' + row.branch + '，源表等级为' + (chinese(row.grade) || '未列，保持未知') + '；' + related(row)] : []),
    groups(p.lifePalaceGroups), groups(p.focusPalaceGroups),
    '男女表是原书两套历史宫名分类，并列保留，不推断用户身份；宫名强弱、星曜庙陷和全盘强弱是不同层次，不能互相代替',
    p.supportReady === true ? '源辅星与列名紫微天府的具体关系如下，不以星数宣布诸吉或扶救成立' : '源辅星依据未核，不能补成命有吉曜或全无扶救',
    ...list(p.supportPositions).flatMap(row => chinese(row.star) && chinese(row.branch) ? [row.star + '在' + row.branch + '；' + related(row)] : []),
    p.birthTaboo ? '卷三十二支章按本生年支' + chinese(p.birthYearBranch) + '所列的位置候选：注文支位'
      + (pair(p.birthTaboo.proseBranches) || '未列') + '，歌句支位' + (pair(p.birthTaboo.verseBranches) || '未列')
      + '，另明确年支' + (pair(p.birthTaboo.explicitAnnualBranches) || '未列')
      + '，明确限支' + (pair(p.birthTaboo.explicitLimitBranches) || '未列') + '；各列分别保存，不拼成一份完整忌表' : '',
    p.birthTaboo?.weiProseVerseConflict === true ? '未年歌句猪鸡对应亥酉，注文却列酉戌；差异未定，不择其一或合并扩张为确定凶支' : '',
    list(p.birthTaboo?.oppositionPairs).length ? '该生年注文另列对冲支组' + p.birthTaboo.oppositionPairs.map(pair).join('、')
      + '；所指岁与限的具体对象仍未知，下列只核实际支位关系' : '',
    p.birthTaboo?.requiresTombYang === true ? '未年注文另列擎羊须在四墓宫这一候选，当前源羊在' + chinese(p.yangBranch)
      + '；不把羊存在盘中直接当此组合已完全成立' : '',
    list(p.birthTaboo?.namedStars).length ? '该生年章点名候选为' + pair(p.birthTaboo.namedStars)
      + (p.allListedTabooStarsPositioned === true ? '，以下只登记它们的位置，不认定全部忌条件已满足'
        : '；部分点名星的位置未核，不能把缺项当作无此星或忌法已排除') : '',
    ...list(p.scopeRelations).flatMap(row => scopes[row.scope] && (row.scope !== 'minor' || axes?.minorVerified === true)
      && chinese(row.branch) ? [scopes[row.scope] + '命宫在' + row.branch + '；' + related(row)
      + (words[row.yangRelation] ? '；与源羊为' + words[row.yangRelation] : '')
      + '；该支' + (row.proseCandidate === true ? '属于' : '不属于') + '上述注文位置列，'
      + (row.verseCandidate === true ? '属于' : '不属于') + '上述歌句位置列；单列未中不代表原书全部忌法已排除'] : []),
    ...list(p.scopePairCandidates).flatMap(row => scopes[row.firstScope] && scopes[row.secondScope]
      && (axes?.minorVerified === true || ![row.firstScope, row.secondScope].includes('minor')) ? [scopes[row.firstScope] + '在' + chinese(row.firstBranch)
      + '与' + scopes[row.secondScope] + '在' + chinese(row.secondBranch) + (row.opposite === true ? '互为对宫' : '不是对宫')
      + (row.printedPairCandidate === true ? '，属于该生年注文列出的对冲支组候选' : '')
      + '；原句相冲是否以这两层为对象仍待核，不由几何关系裁定有凶'] : []),
    ...list(p.listedTabooStars).flatMap(row => chinese(row.star) && chinese(row.branch) ? ['该生年章点名候选' + row.star + '在' + row.branch + '；' + related(row)
      + (row.coordinateBasis === 'product-hour' ? '；这是产品火铃生时位置，原书生时法未核' : '')] : []),
    ...((tabooCandidate || namedTabooCandidate) ? list(p.natalHelpers).map(row => pair(row.labels) + '在' + row.branch + '宫，守宫有' + row.star) : []),
    ...((tabooCandidate || namedTabooCandidate) ? list(p.natalAdditionalHelpers).flatMap(row => {
      const labels = pair(row?.labels);
      if (!labels || !chinese(row.branch) || !chinese(row.star)) return [];
      const position = labels + '在' + row.branch + '宫，守宫有本命' + row.star;
      return [['禄', '权', '科'].includes(row.transformation) ? position + '，由生年干化' + row.transformation : position];
    }) : []),
    ...((tabooCandidate || namedTabooCandidate) ? list(p.yearSha).flatMap(row => {
      const sevenKillHere = namedGuards.some(hit => hit.star === '七杀' && list(hit.scopes).includes(row.scope));
      const localSha = pair(sevenKillHere ? [...list(row.stars), '七杀'] : row.stars);
      return localSha ? [layerName(row.scope) + '在' + row.branch + '宫，守宫有' + localSha] : [];
    }) : []),
    ...(tabooCandidate ? list(p.matchingTabooSeats).map(row => layerName(row.scope) + '所在' + row.branch
      + '宫符合' + (row.explicitAnnualCandidate === true ? '注文明确的本生忌年支' : row.explicitLimitCandidate === true
        ? '注文明确的本生忌限支' : '注文与歌句共有的本生忌支位')) : []),
    ...(tabooCandidate ? list(p.matchingTabooPairs).map(row => '本段有原书列出的' + row.firstBranch + row.secondBranch + '对冲支组') : []),
    ...namedGuards.map(row => '卷三该生年点名的' + (row.coordinateBasis === 'product-hour' ? '归档' : '') + row.star
      + '在' + row.branch + '宫，实守' + list(row.scopes).map(layerName).filter(Boolean).join('、')),
    ...((weakPalace || fallenMajor) ? list(p.supportedStrongPalaces).map(row => row.palace + '在' + row.branch + '宫，守宫有'
      + row.star + '，在卷二' + (p.palaceTable === 'maleTable' ? '男盘表' : '女盘表') + '列为强宫，与命宫为' + row.lifeRelation) : []),
    ...((dignityWeak || dignityFallen) ? list(p.strongDignitySupports).map(row => row.star + '在' + row.branch + '宫，卷三星表列为'
      + row.grade + '，与命宫为' + row.lifeRelation) : []),
    ...((weakPalace || dignityWeak) ? list(p.weakLimits).filter(row => row.weakPalace === true)
      .map(row => scopes[row.scope] + '在' + row.branch + '宫的' + row.palace + '，卷二宫名表列为弱宫') : []),
    ...((fallenMajor || dignityFallen) ? list(p.weakLimits).filter(row => row.hasFallenMajor === true)
      .map(row => scopes[row.scope] + '在' + row.branch + '宫，卷三星表在该宫列陷的主曜为' + pair(row.fallenMajors)) : []),
    '本生所忌不保证等于这一章的子集，七杀、羊陀和产品火铃的位置也不等于本生忌已经成立；命有吉曜、太岁二限有凶、强命弱限、主星弱和救应仍须逐条核，不以空表、庙陷计数或单颗星预言疾病、灾祸和确定结果',
  ]);
}

function quanshuPrincipalSeatNotes(proof) {
  return [['太阴', proof?.moon], ['廉贞', proof?.lianzhen], ['七杀', proof?.qisha]].flatMap(([star, row]) =>
    row?.verified === true ? ['本命' + star + '按卷二由' + row.anchor + '复算，与归档同在' + row.expectedBranch + '宫']
      : row?.verified === false ? ['归档' + star + '与卷二复算位置不符'] : []);
}

function tigerLayerDescription(p) {
  if (p.profile !== 'quanshu-tiger-annual-native-layers-v1' || p.ready !== true) return '';
  const words = { 守: '同宫', 冲: '对宫', 三合: '三合位置', 邻宫: '邻宫', 其他: '不在同宫、对宫、三合或邻宫' };
  const related = row => [['focusRelation', '本限焦点'], ['lifeRelation', '本命命宫'], ['parentRelation', '本命父母宫'],
    ['lianzhenRelation', '本命廉贞'], ['sevenKillRelation', '本命七杀']]
    .flatMap(([key, label]) => words[row?.[key]] ? ['与' + label + '为' + words[row[key]]] : []).join('，');
  return sentences([
    '以下分开核同一本命与同一年限片段的白虎、太岁及大小限；几何接触不等于原文加临、遇会或灾害成立',
    number(p.lunarYear) !== undefined && scopes[p.scope] && chinese(p.branch) ? '农历' + p.lunarYear + '年本段'
      + scopes[p.scope] + '命宫在' + p.branch + '，对应本命' + chinese(p.natalName) : '',
    chinese(p.annualBranch) ? '当年太岁在' + p.annualBranch + '；四飞星白虎在太岁前八宫，与太岁为三合位置，不能与同层流年命宫同坐' : '',
    ...list(p.fourFlying).flatMap(row => chinese(row.name) && chinese(row.branch) ? ['卷二四飞星' + row.name + '在' + row.branch + '；' + related(row)] : []),
    '四飞星的官府保留原名，不能仅因支位一致就合并为博士官府或所有官符',
    ...list(p.scopeRelations).flatMap(row => scopes[row.scope] && chinese(row.branch) ? [scopes[row.scope] + '命宫在' + row.branch
      + '，对应本命' + chinese(row.natalName) + '；' + related(row) + (words[row.tigerRelation] ? '；年度白虎与该限命宫为' + words[row.tigerRelation] : '')] : []),
    chinese(p.parentBranch) ? '独立核本命父母宫在' + p.parentBranch + '；不要求当前太岁必须坐入此宫才登记太阴资料候选' : '本命父母宫唯一位置未核，不补作太阴在父母',
    ...list(p.mainStars).flatMap(row => chinese(row.star) ? [row.known === true && chinese(row.branch)
      ? '兼容且唯一归档的本命' + row.star + '在' + row.branch + '；' + related(row)
      : '本命' + row.star + '的唯一位置未核，不把缺项写成没有该星'] : []),
    ...quanshuPrincipalSeatNotes(p.principalSeatProof),
    p.moon && chinese(p.moon.branch) ? '卷一太阴问答在' + p.moon.branch + '明确等级为' + (chinese(p.moon.answerGrade) || '未列，保持未知')
      + '；卷三另表等级为' + (chinese(p.moon.volume3Grade) || '未列，保持未知') + '，两篇分别保留，不互补空格' : '',
    typeof p.parentMoonFallen === 'boolean' ? '按卷一明确支位，太阴在父母且陷地这一位置前提' + (p.parentMoonFallen ? '成立' : '不成立')
      + '；不表示失辉受制或白虎遇会的全部语义已经核定' : '太阴在父母且陷地的来源位置前提尚未核定',
    typeof p.annualMinorAtLianzhen === 'boolean' ? '当年太岁与同段小限' + (p.annualMinorAtLianzhen ? '共同坐本命廉贞宫' : '未共同坐本命廉贞宫')
      + '；不能据此认定白虎加临已成立' : '廉贞位置或同段小限缺失，不补成太岁小限同坐',
    p.annualMinorAtLianzhen === true && p.sourceMinor?.verified === true
      ? '卷二小限诀从' + p.sourceMinor.startBranch + '宫起，按第' + p.sourceMinor.ordinal + '农历年' + p.sourceMinor.direction
        + '至' + p.sourceMinor.branch + '宫，与归档相符' : '',
    p.annualMinorAtLianzhen === true && p.sourceMinor?.verified === false ? '卷二复算的小限宫位与归档不一致' : '',
    p.lianzhenAnnualTigerTrineCandidate === true ? '年度四飞白虎与已核的太岁、小限同守廉贞宫为三合位置' : '',
    ...list(p.yang).flatMap(row => ['natal', 'yearly'].includes(row.layer) && chinese(row.branch) ? [(row.layer === 'natal' ? '生年干' : '流年干')
      + '依卷二独立安擎羊在' + row.branch + '；' + related(row) + '；两层不能互换成原文未明的羊层'] : []),
    p.bellProductVerified === true ? '产品归档铃星在' + list(p.bellArchiveBranches).filter(chinese).join('、') + '；' + related(p.bellRelations)
      + '；仅核兼容引擎生时位置，原书火铃生时法未核，不能称来源铃星已完整安定' : '产品铃星的唯一生时位置未核，不用重复或不一致归档拼条件',
    p.natalTigerProductVerified === true ? '产品本命岁前白虎在' + list(p.natalTigerBranches).filter(chinese).join('、') + '；' + related(p.natalTigerRelations)
      + '；这是生年产品层，原句是否指它尚未核定，不拿它替换年度四飞星白虎' : '产品本命岁前白虎位置未核，不能补成原文白虎的替身',
    '七杀、羊、铃与流年白虎的短句未给全部同宫规则，也不能仅凭同处三方就宣称条件完整成立；失辉、加临和遇会的原义仍待核，不由这些位置预测疾病、刑罚或必然事件',
  ]);
}

function flowHorseGuardDescription(flow) {
  const guards = list(flow?.guardingLimits).filter(layer => ['decadal', 'minor'].includes(layer)).map(layer => scopes[layer]).join('、');
  return flow?.atLimit === true && chinese(flow.branch) && guards
    ? '按当年地支复算并核过引擎唯一流马在' + flow.branch + '宫，同段' + guards + '实守此宫' : '';
}

function horseVoidDescription(p) {
  if (p.profile !== 'quanshu-horse-birth-void-pairs-atomic-v1' || p.ready !== true) return '';
  const words = { 守: '同宫', 冲: '对宫', 三合: '三合位置', 邻宫: '邻宫', 其他: '不在同宫、对宫、三合或邻宫' };
  const pair = values => list(values).filter(chinese).join('、');
  const related = row => [words[row?.horseRelation] ? '与本命马为' + words[row.horseRelation] : '',
    words[row?.focusRelation] ? '与本限焦点为' + words[row.focusRelation] : ''].filter(Boolean).join('，');
  const annual = p.scope === 'yearly';
  const verifiedScope = scope => scope === 'decadal' ? p.sourceDecadal?.verified === true
    : scope === 'minor' ? p.sourceMinor?.verified === true : scope === 'yearly';
  const flowGuard = annual ? flowHorseGuardDescription(p.flowHorse) : '';
  const mingGuards = annual && p.mingNatalHorseProfile === 'quanshu-nanyangtang-cut-void-horse-guard-v1'
    ? list(p.mingHorseGuardScopes).map(scope => scopes[scope]).filter(Boolean).join('、') : '';
  return sentences([
    '以下独立核《全书》本命天马与不同空亡支位；同一本命、太岁和大小限在同一实际片段内对应，不拼不同候选或年份',
    chinese(p.yearPillar) ? '本生年柱为' + p.yearPillar + (chinese(p.xunHead) ? '，本生年所属旬首为' + p.xunHead : '')
      + '；旬空按本生年干支核，不用生日干支或当前年干支替代' : '',
    chinese(p.horseBranch) ? '按本生年支独立重算并核唯一归档的天马在' + p.horseBranch : '',
    annual && p.horseTianxingQishaCandidate === true ? '太岁到' + p.horseBranch + '宫，本命天马与天刑、七杀同守' : '',
    annual && p.lifeHorseXingShaAtVerifiedLimit === true ? '命宫与复算的实际限宫也同守' + p.horseBranch + '宫' : '',
    annual && p.nonLifeHorseXingShaAtVerifiedDecade === true && [p.horseBranch, p.natalName].every(chinese)
      ? '复算大限也实守' + p.horseBranch + '宫的本命' + p.natalName + '宫' : '',
    annual && p.horseCutVoidCandidate === true ? '太岁守本命马宫，该宫在本生年截路双宫组内' : '',
    annual && p.horseXunVoidCandidate === true ? '太岁守本命马宫，该宫在本生年旬中空亡双宫组内' : '',
    annual && p.horseSkyVoidCandidate === true ? '太岁所守的本命天马与按生时核位的古天空同宫' : '',
    annual && p.horseDeadOrExtinctStageCandidate === true && p.horseGrowth?.profile === 'quanshu-volume-two-bureau-growth-by-gender-v1'
      ? '按卷二复算' + p.horseGrowth.bureau + '，' + p.horseGrowth.origin + '起长生' + p.horseGrowth.direction
        + '，本命天马实在' + p.horseGrowth.branch + '宫' + p.horseGrowth.phase + '位，太岁也实临此宫' : '',
    mingGuards && p.mingHorseCutVoidGuardCandidate === true ? '明刊候选核到本命天马、太岁与生年截路空亡同在'
      + p.horseBranch + '宫，同段' + mingGuards + '也实守此宫' : '',
    annual && p.horseLuQishaXunVoidGuardCandidate === true
      ? '同年太岁与已核实限同守本命七杀、禄存、天马和本生年旬空宫' : '',
    mingGuards && p.mingHorseNativeVoidsGuardCandidate === true ? '明刊候选核到本命天马、太岁、古天空与地劫同在'
      + p.horseBranch + '宫，同段' + mingGuards + '也实守此宫' : '',
    annual && p.horseTuoluoTogetherCandidate === true ? '太岁到' + p.horseBranch + '宫，本命天马与源陀罗同守' : '',
    annual && p.horseAnnualTuoluoCandidate === true && chinese(p.flowTuoluoBranch)
      ? '太岁所守的本命天马与按流年干独立核位的流陀同在' + p.flowTuoluoBranch + '宫' : '',
    flowGuard,
    flowGuard && p.flowHorseXingShaCandidate === true ? '本命天刑和七杀与守限的流马同宫' : '',
    flowGuard && p.flowHorseCutVoidCandidate === true ? '守限流马在本生年截路双宫组内' : '',
    flowGuard && p.flowHorseXunVoidCandidate === true ? '守限流马在本生年旬中空亡双宫组内' : '',
    flowGuard && p.flowHorseSkyVoidCandidate === true ? '守限流马与按生时核位的古天空同宫' : '',
    flowGuard && p.flowHorseNatalTuoluoCandidate === true ? '守限流马与本命陀罗同宫' : '',
    flowGuard && p.flowHorseAnnualTuoluoCandidate === true ? '守限流马与按流年干独立核位的流陀同宫' : '',
    number(p.lunarYear) !== undefined && scopes[p.scope] && chinese(p.branch) && verifiedScope(p.scope) ? '农历' + p.lunarYear + '年本段'
      + scopes[p.scope] + '命宫在' + p.branch + '，对应本命' + chinese(p.natalName)
      + (p.natalHorseAtFocus === true ? '，本命马与本限命宫同宫' : '，本命马不与本限命宫同宫') : '',
    ...list(p.scopeRelations).flatMap(row => scopes[row.scope] && chinese(row.branch) && verifiedScope(row.scope) ? [scopes[row.scope] + '命宫在'
      + row.branch + '，对应本命' + chinese(row.natalName) + '；' + related(row)] : []),
    p.sourceMinor?.verified === false ? '按原法复算的小限宫与归档不符，小限关系保留未知' : '',
    p.sourceDecadal?.verified === false ? '未能从归档核对当年虚岁对应的大限十年区间，大限守马关系保留未知' : '',
    typeof p.decadalMinorSamePalace === 'boolean' ? '本段大小限' + (p.decadalMinorSamePalace ? '同宫' : '不同宫')
      + '；不据此自动裁定原句二限临遇必须同时或分别到会' : '另一限位置未核，不补成二限同到',
    ...list(p.groups).flatMap(row => chinese(row.kind) ? [row.kind + '按本生年独立核得双宫组' + pair(row.pair)
      + '；' + (row.atHorse === true ? '本命马位属于这组' : '本命马位不属于这组')
      + '，不区分未经原诀核定的正副单星名称，也不因本组未会马就排除其他空亡'
      + '；各支关系为' + list(row.members).map(member => chinese(member.branch) ? member.branch + '：' + related(member) : '').filter(Boolean).join('、')
      + '；双宫是同一来源组，不重复计成两份灾害依据'] : []),
    ...list(p.archiveVoids).flatMap(row => chinese(row.star) && chinese(row.branch) ? ['归档产品星名' + row.star + '在'
      + row.branch + '；' + related(row) + '；名称含空或与源支位重合都不自动建立它与泛称空亡、截路、旬空的同一性'] : []),
    p.sourceSkyReady === true ? '古天空按出生时支从亥逆行独立核位，对照归档地空；现代同名天空不作替身'
      : p.sourceRobberyReady === true ? '地劫位置已核，古天空仍待核'
        : '古天空和地劫的来源位置未核，不借归档同名空星补出肯定或否定',
    p.sourceSkyReady === true && p.sourceVoidPairReady === false ? '古天空位置已核，地劫仍待核' : '',
    ...list(p.sourceVoids).flatMap(row => chinese(row.kind) && chinese(row.branch) ? [row.kind + '在' + row.branch + '；' + related(row)
      + '；这类时支星与生年截路、旬空双宫分开'] : []),
    ...list(p.companions).flatMap(row => chinese(row.star) ? [row.known === true && chinese(row.branch) ? row.star + '在'
      + row.branch + '；' + related(row) : row.star + '的唯一位置未核，不能把未见当作没有'] : []),
    p.tianxingReady === true ? '天刑按生月独立核位；它与七杀只是刑杀的具名位置候选，不固定为原文完整刑杀集合'
      : '天刑的来源位置未核，不能借另一刑曜补足',
    p.xingShaSeatProof?.qishaVerified === true ? '依紫微核天府斜对位后，七杀按天府对宫重算，与归档同在'
      + p.xingShaSeatProof.qishaExpectedBranch + '宫'
      : p.xingShaSeatProof?.qishaVerified === false ? '归档天府或七杀与安星顺序不符，七杀位置待核' : '',
    chinese(p.tuoluoBranch) ? '源陀罗在' + p.tuoluoBranch + '，与本命马为' + (words[p.tuoluoHorseRelation] || '未核关系')
      + '；原文遇的范围尚未定，不把同宫、三方四正或邻宫擅自作为全部定义' : '',
    ...list(p.natalAuxiliary).flatMap(row => chinese(row.star) && chinese(row.branch) ? ['按出生时支重算并核归档的本命'
      + row.star + '在' + row.branch + '；' + related(row) + '；这是本命辅星，不是限层动态流昌'] : []),
    '流昌的来源排法和限层尚未核实，不能把本命文昌改名为流昌，也不以本命昌的位置作为动态昌必须在场的硬前提',
    flowGuard ? '这组流马只核兼容引擎坐标，古书所用的马层与实际限层待核'
      : chinese(p.annualHorseCandidateBranch) ? '若将生年马表延用于本年，马的候选支位为' + p.annualHorseCandidateBranch
        + '，保留为年度位置对照' : '',
    p.annualVoidCandidates ? '若将生年空亡表延用于本年，仅得候选截路双宫' + pair(p.annualVoidCandidates.cutVoidPair)
      + '和候选年旬空双宫' + pair(p.annualVoidCandidates.xunVoidPair) + '；原文按本生年的定义没有因此被替换，年度作用仍未知' : '',
    '禄存、马、陀罗及具名空亡各按声明来源核位；紫府等主星复用兼容且唯一的归档，不冒称已重排整部原法。泛称空亡和刑杀、流昌、守照及临遇承接尚未核全，不由这些几何位置推断疾病、灾祸或必然吉凶',
  ]);
}

function zpqzStemDescription(p, at) {
  if (p.profile !== 'zpqz-stem-order-targets-atomic-v1') return '';
  const position = value => value === 'decadal' ? '本步大运' : value === 'annual' ? '太岁' : layers[value] ? '本命' + layers[value] : '';
  const positions = values => list(values).map(position).filter(Boolean).join('、');
  const witness = row => position(row?.position) && chinese(row?.pillar) ? position(row.position) + row.pillar
    + (chinese(row.tenGod) ? '（该干对日主为' + row.tenGod + '）' : '') : '';
  const between = row => list(row.between).map(witness).filter(Boolean).join('、');
  const geometry = row => witness(row.first) && witness(row.second) ? witness(row.first) + '与' + witness(row.second)
    + (row.adjacent === true ? '在本命柱序相邻' : '在本命柱序不相邻')
    + (between(row) ? '，中间为' + between(row) : '') : '';
  const cases = { 'zeng-wealth-seal': '曾参政财印隔日干原图', 'yi-ji-adjacent': '乙己财印相并原图',
    'li-robbery-kill': '李参政劫杀五合原图', 'jia-ji-ding-between': '甲己之间隔丁的原图', 'wu-gui-yi-between': '戊癸之间隔乙的原图' };
  const wuOfficer = p.confirmed === true ? p.wuOfficerFoodWealth : undefined;
  const hai = p.confirmed === true ? p.haiStemComparison : undefined;
  const haiRole = chinese(hai?.monthRen?.tenGod);
  const haiSeats = list(hai?.exposedRen).map(witness).filter(Boolean).join('、');
  const gui = p.confirmed === true ? p.guiWithYearWu : undefined;
  const sealOfficerExamples = { 'jia-zi-bing': '甲日子月的运丙合辛官例', 'bing-mao-wu': '丙日卯月的运戊合癸官例' };
  const officerKillLuck = p.confirmed === true ? p.officerKillLuck : undefined;
  const monthOfficer = officerKillLuck?.monthOfficer;
  const branchOwl = p.branchOwlMeetingAgainstHurt === true ? officerKillLuck?.branchOwlMeeting : undefined;
  const wealthSealLuck = p.confirmed === true ? p.wealthSealLuck : undefined;
  const movingStem = row => chinese(row?.placement) + chinese(row?.stem) + '（' + chinese(row?.tenGod) + '）';
  const wealthSealDirections = path => [
    chinese(path.monthWealth?.pillar) && witness(path.wealth) && witness(path.seal) ? '月柱' + path.monthWealth.pillar
      + '的' + chinese(path.monthWealth.placement) + '为' + chinese(path.monthWealth.stem) + chinese(path.monthWealth.tenGod)
      + '，同干财明透于' + witness(path.wealth) + '，对应原局印为' + witness(path.seal) : '',
    ...list(path.authorityBridges).map(({ authority, checkedBy }) => '同一运官杀连接财印：' + witness(path.wealth) + '生'
      + movingStem(authority) + '，再由该运成分生' + witness(path.seal)
      + (list(checkedBy).length ? '。同一步的' + checkedBy.map(movingStem).join('、') + '又克该运官杀' : '')
      + '。实际通关待核'),
    ...list(path.supportingSeals).map(({ seal, controlledByWealth }) => movingStem(seal) + '有生本命日干' + chinese(p.dayMaster)
      + '的方向' + (controlledByWealth === true ? '，原透财' + witness(path.wealth) + '另有克该运印的方向' : '')
      + '。扶身效果待核'),
  ];
  return sentences([
    '以下独立核《子平真诠评注》的天干柱序和实际合的对象，所有见证属于同一候选及同一步大运',
    p.confirmed === true ? '大运已与归档十步表唯一核验' : '大运仍为未核候选',
    chinese(p.dayMaster) ? '日主为' + p.dayMaster + (p.dayYang === true ? '，属阳干' : p.dayYang === false ? '，属阴干' : '') : '',
    '本命依年月日时顺序为' + list(p.natalPillars).map(witness).filter(Boolean).join('、') + '；日干本身保留在柱序内，不冒充另有该干透出',
    p.timeKnown === false ? '时刻未知，时柱不参与，未见、远近及原图完整比对均不能补成已核全局' : '',
    chinese(p.luckPillar) ? '本步大运为' + p.luckPillar + (chinese(p.luckTenGod) ? '，运干十神为' + p.luckTenGod : '')
      + (chinese(p.luckBranchMainQiGod) ? '，运支首藏十神为' + p.luckBranchMainQiGod : '')
      + '；运干没有本命第五柱位置，不把它虚放在时干旁边或按本命隔位直接裁定能合不能合' : '',
    p.stageStart && p.stageEnd ? '本运完整起止为' + at(p.stageStart) + '至' + at(p.stageEnd)
      + '，截止不计入；当前事实只在与查询窗的实际交集中有效' : '',
    ...(p.confirmed === true ? list(p.sealOfficerJoins).flatMap(({ moving, officer, monthSeals, monthPrimary, woodMeeting, example }) => witness(moving) && witness(officer) ? [
      witness(moving) + '五合到' + witness(officer) + '，同一正官有生' + list(monthSeals).filter(seal => chinese(seal.stem)).map(seal =>
        position(seal.position) + chinese(seal.pillar) + '所藏' + seal.stem + chinese(seal.tenGod)).join('、') + '的方向'
      + (sealOfficerExamples[example] ? '，对应评注的' + sealOfficerExamples[example] : '') + '。取印用官与实际合去仍待核',
      ...list(monthSeals).flatMap(seal => Number.isInteger(seal.hiddenOrder) ? ['月令' + chinese(seal.stem) + chinese(seal.tenGod)
        + (seal.mainQi ? '为本气' : '为第' + seal.hiddenOrder + '藏')
        + (list(seal.exposedSeats).length ? '，同干透在' + seal.exposedSeats.map(witness).join('、')
          : seal.supportLevel === 'residual-seal-only' ? '，原局其他柱未见同干明透' : '')] : []),
      list(monthPrimary?.exposedSeats).length ? '月令本气' + chinese(monthPrimary.stem) + chinese(monthPrimary.tenGod)
        + '明透于' + monthPrimary.exposedSeats.map(witness).join('、') : '',
      list(woodMeeting).length ? '亥卯未木组实位为' + woodMeeting.map(row => row.branch + (list(row.positions).length
        ? '在' + row.positions.map(witness).join('、') : '未见')).join('，') : '',
    ] : []) : []),
    p.sealOfficerSourceUnrootedJoin === true ? '明透正官与实际运干独合，本命四支和本步运支未见该正官的同五行藏根' : '',
    p.sealOfficerSourceRetained === true ? '乙日、月乙及实际乙运同对透庚，原评另说月乙相合时庚官仍在' : '',
    p.sealOfficerSingleResidualJoin === true && p.sealOfficerSingleResidual
      ? '四库月支唯一实透的藏干为' + p.sealOfficerSingleResidual.seal.stem + '印，'
        + witness(p.sealOfficerSingleResidual.officer) + '生同一印，' + witness(p.sealOfficerSingleResidual.moving) + '独合这处原官' : '',
    gui?.seal && witness(gui.wealth) && witness(gui.officer) ? witness(gui.wealth) + '五合到' + witness(gui.seal)
      + '，' + witness(gui.officer) + '生这处运癸印。年戊、月辛和运癸按同一步大运核对' : '',
    ...list(gui?.waterRoots).flatMap(root => witness(root) && ['壬', '癸'].includes(root.stem) ? [position(root.position)
      + root.pillar + '支藏' + root.stem + '，为' + chinese(root.role) + '位置，对运癸为' + (root.exactStem === true ? '同干藏位' : '同水异干藏位')] : []),
    gui ? {
      'exact-stem': '这一步运支自身实藏同干癸，与原局本有的水根分开核对',
      'same-element': '这一步运支自身藏同属水的壬，与同干癸分开核对',
      absent: '这一步运支自身未见水根，原局水根另查',
    }[p.guiOwnLuckWaterRoot] : '',
    list(gui?.nativeExposedGui).length ? '运癸之外，原局癸另透在' + list(gui.nativeExposedGui).map(witness).filter(Boolean).join('、') : '',
    ...(gui ? list(p.guiWaterRootClashes).flatMap(pair => list(pair).length === 2 && pair.every(witness)
      ? [pair.map(witness).join('与') + '六冲，涉及这一步所核水根。实际根力仍待核'] : []) : []),
    ...list(p.guiZiLuRoots).flatMap(({ root, relations }) => root?.branch === '子' && witness(root)
      ? ['癸禄在' + position(root.position) + chinese(root.pillar) + '的支本气癸，原局及运支所涉'
        + (list(relations).map(pair => chinese(pair.values) + chinese(pair.kind)).filter(Boolean).join('、') || '冲合刑害破未见')
        + '，浮水与根力须另核'] : []),
    gui && list(p.guiNorthernWaterAssembly).length ? '同一实际运段亥子丑三方成员齐见：'
      + p.guiNorthernWaterAssembly.map(root => position(root.position) + root.pillar + '藏' + root.stem).join('、')
      + '。子禄与北方水气同时实见，本条浮水候选排除' : '',
    gui && list(p.guiShenZiChenAssembly).length ? '同一实际运段申子辰三合成员齐见，水根位于'
      + list(p.guiShenZiChenAssembly).map(witness).filter(Boolean).join('、') + '，浮水候选排除' : '',
    gui && !list(p.guiNorthernWaterAssembly).length && !list(p.guiShenZiChenAssembly).length ? (p.guiRootsOnlyStorageOrResidual === true ? '该盘原局和当运的水根位置只见水库或余气' : '该盘在水库或余气以外另见水根')
      + '。原文所称癸浮水、合绊及对官星的实际作用仍须合参' : '',
    haiRole && haiSeats ? '本命月柱' + chinese(hai.monthRen.pillar) + '的亥支藏壬' + haiRole
      + '，同干壬明透在' + haiSeats : '',
    hai && p.dayMaster === '丁' ? '正文丁日例指定年干透壬，当前盘' + (list(hai.exposedRen).some(row => row.position === 'year')
      ? '满足该年柱位置' : '仅在其他出生柱满足徐注的透壬条件') : '',
    ...list(p.haiGuiRootedLink?.fireRootClashes).flatMap(({ root, opposing }) => witness(root) && witness(opposing) && smthStem(root.stem)
      ? [witness(root) + '所藏的' + root.stem + '火，与' + witness(opposing) + '实见六冲，火根作用留待核'] : []),
    hai && p.haiGuiColdWaterOpposition ? '亥月实际运段亥子丑齐见于'
      + list(p.haiGuiColdWaterOpposition.waterPositions).map(witness).filter(Boolean).join('、') + '，原局金见于'
      + list(p.haiGuiColdWaterOpposition.natalMetalSources).map(witness).filter(Boolean).join('、') + '，未见明火或火根，保留戊癸合的事实' : '',
    hai?.route === 'bing-companion' || hai?.route === 'ding-robbery' ? witness(hai.moving) + '的丙是实际运干，与日干同属火'
      + '。该干为' + (hai.route === 'bing-companion' ? '比肩' : '劫财') + '，是否实际扶身仍须合参' : '',
    ...list(hai?.renCombinations).flatMap(({ target, natalCombinations }) => witness(hai.moving) && witness(target) ? [
      '运丁实际五合到' + witness(target) + '，这是同一亥月盘的' + (haiRole === '正官' ? '合官候选' : '合杀候选'),
      ...list(natalCombinations).flatMap(pair => geometry(pair) ? ['同一壬目标的原有丁壬合见证为' + geometry(pair)
        + (pair.involvesDayMaster === true ? '，涉及本命日丁' : '，涉及原局非日干丁')] : []),
    ] : []),
    ...list(hai?.hurtOfficerLinks).flatMap(({ hurt, officer, movingCombinesHurt, natalHurtPartners }) => witness(hurt) && witness(officer) ? [
      witness(hurt) + '与' + witness(officer) + '是原局戊土克壬水的同一对伤官与官星',
      hai.route === 'gui-joins-hurting' && movingCombinesHurt === true ? witness(hai.moving) + '的运干癸五合到上述同一戊伤官'
        + '，原文所论的化伤与救官仍须核对' : '',
      ...list(natalHurtPartners).flatMap(partner => witness(partner)
        ? ['原局' + witness(partner) + '也与同一戊伤官成五合，运癸只保留合位候选'] : []),
      hai.route === 'ren-repeats-officer-under-hurt' ? witness(hai.moving) + '的壬运干重见正官'
        + '，上述戊伤官对这位运壬也有土克水的方向' : '',
    ] : []),
    ...list(p.natalFivePairs).flatMap(row => geometry(row) ? [geometry(row) + '，两个天干具有五合的形式；'
      + (row.involvesDayMaster === true ? '其中涉及日干自身之合，原书不据此一概认作合去' : '属于两个非日干之间的五合见证')
      + '，是否合而不合、合而不化或仍可用，须另核根气与作用'] : []),
    ...list(p.wealthSealPairs).flatMap(row => geometry(row) ? ['财印柱序：' + geometry(row)
      + '；财干为' + witness(row.wealth) + '，印干为' + witness(row.seal)
      + '；相邻或有隔干只是位置，不自动证明财已破印或隔离已经有效'] : []),
    ...list(p.jiaGengBingBridges).flatMap(row => geometry(row) ? ['甲庚隔丙的实际见证：' + geometry(row)
      + '；中间的丙若是日干，不能要求再有一个非日干丙才承认此结构，不把隔干直接当作通关成功'] : []),
    ...list(p.yiJiPairs).flatMap(row => geometry(row) ? ['乙己见证：' + geometry(row)
      + (row.adjacent === true ? '，符合本条相并的邻位候选' : '，没有满足本条相并邻位，不能仅凭同时出现就套原例')
      + '；原例庚日身弱和实际财破印仍须核'] : []),
    ...list(wealthSealLuck?.separatedWealthSealPaths).flatMap(path => [
      '原局财印之间见日干' + chinese(p.dayMaster) + (list(path.competingAdjacentPairs).length
        ? '，同盘另有月财相邻印位：' + path.competingAdjacentPairs.map(pair => witness(pair.wealth) + '与' + witness(pair.seal)).join('、')
        : '。实际是否相碍待核'),
      ...wealthSealDirections(path),
    ]),
    ...list(wealthSealLuck?.yiJiWealthSealPaths).flatMap(path => [
      ...wealthSealDirections(path),
      ...list(path.supportiveRobbery).map(row => movingStem(row) + '与庚日同属金，并克相邻财印中的原透乙财' + witness(path.wealth)),
      ...list(path.outputFeedsWealth).map(row => movingStem(row) + '生同一原透乙财' + witness(path.wealth)),
      ...list(path.wealthControlsSeal).map(row => movingStem(row) + '克相邻财印中的原透己印' + witness(path.seal)),
    ]),
    wealthSealLuck?.zengSiSupport ? '曾例辛巳运同日干的' + movingStem(wealthSealLuck.zengSiSupport) + '单列为扶身候选' : '',
    list(wealthSealLuck?.zengGengChen).length ? '曾例原表另列庚辰运，实见'
      + wealthSealLuck.zengGengChen.map(movingStem).join('、') + '，作为同一原图的运段对照' : '',
    ...list(wealthSealLuck?.zengWealthSealRoots).map(row => '曾例的' + chinese(row.role) + '见于'
      + list(row.positions).map(witness).join('、') + '，所在支实藏' + chinese(row.stem)),
    ...list(p.movingFivePairs).flatMap(row => witness(row.moving) && witness(row.target) ? [sentences([
      witness(row.moving) + '与实际本命目标' + witness(row.target) + '具有天干五合形式',
      row.targetIsDayMaster === true ? '目标是日干自身，单列本身之合，不拿来代替合到透出的官杀财印'
        : '目标为非日干，其十神只按当前日主核定，不借其他天干的合拼成合官或合伤',
      list(row.nativeSameAsMoving).length ? '本命中与运干同干者为' + row.nativeSameAsMoving.map(witness).join('、')
        + '，这里只列同干，不据两对一自动命名为争合、妒合或成功合去' : '',
      list(row.nativeSameAsTarget).length ? '原局其他同目标干为' + row.nativeSameAsTarget.map(witness).join('、') : '',
      list(row.natalOtherFiveContacts).length ? '此目标在原局另有五合形式的参与者为' + row.natalOtherFiveContacts.map(witness).join('、')
        + '；原有与运来分开，不能认作已经去一留一' : '',
    ])] : []),
    chinese(wuOfficer?.officer?.pillar) && witness(wuOfficer?.moving) ? '本命月柱' + wuOfficer.officer.pillar
      + '的午支藏己正官，' + witness(wuOfficer.moving)
      + (wuOfficer.officer.newlyExposedByLuck === true ? '与月支所藏同干，己在本运首次透出' : '与月支所藏同干')
      + (positions(wuOfficer.officer.natalExposurePositions) ? '，己原已透在' + positions(wuOfficer.officer.natalExposurePositions) : '') : '',
    ...list(wuOfficer?.foodCheckingOfficer).flatMap(food => witness(food) && witness(wuOfficer.moving)
      ? [witness(food) + '在五行上克同一步的' + witness(wuOfficer.moving) + '，按原评作为甲回克运己的对照'] : []),
    ...list(wuOfficer?.foodWealthLinks).flatMap(link => witness(link.food) && witness(link.wealth) ? [
      '运己所合的' + witness(link.food) + '在五行上生' + witness(link.wealth)
      + (list(link.wealthDayCombinations).length ? '，这位丁财与本命壬日干原有五合位置' : '')
      + '，食神生财是否为用仍待核对',
    ] : []),
    ...list(p.natalKillPairs).flatMap(row => witness(row.kill) && witness(row.combiner) ? [
      '本命合杀候选实际配对为' + witness(row.kill) + '与' + witness(row.combiner) + '；' + geometry(row)
        + '；劫财或伤官必须是这一配对里的具体天干，不能只凭三类十神散见认定用劫或用伤合杀',
    ] : []),
    ...list(p.movingAttacksKillCombiners).flatMap(row => witness(row.moving) && witness(row.combiner) ? [
      witness(row.moving) + '的五行克指向同一合杀组合中的' + witness(row.combiner)
        + '，其所配七杀为' + witness(row.kill) + '；方向可核，但不等于伤官已被克去或合杀局已破',
    ] : []),
    chinese(monthOfficer?.pillar) ? '本命月柱' + monthOfficer.pillar + '支藏' + chinese(monthOfficer.stem) + '正官'
      + (list(monthOfficer.exposedSeats).length ? '，同干明透于' + monthOfficer.exposedSeats.map(witness).join('、') : '，原局该干未透')
      + '；月令官位与实际透杀分别核对' : '',
    ...list(officerKillLuck?.sameKillerInLuck).map(({ pair, exposed, hidden, movingCombinations }) => '同干七杀核对：'
      + witness(pair.kill) + '原和' + witness(pair.combiner) + '五合'
      + (exposed ? '，运干' + chinese(exposed.stem) + '再见同一七杀' : '，运干未再透该杀')
      + (list(hidden).length ? '；运支' + hidden.map(value => (value.mainQi ? '本气' : '其他藏气') + chinese(value.stem)).join('、') : '')
      + (list(movingCombinations).length ? '；该运干亦与原配干形成五合位置' : '')
      + '；重见和去留效果分别核对'),
    p.dayYang === false && list(officerKillLuck?.sameKillerInLuck).some(row => row.exposed)
      ? '阴日的伤官原合七杀，同一七杀另由实际运干再透' : '',
    ...list(officerKillLuck?.luckSealAgainstCombiner).map(({ seal, pair, nativeWealth }) => '印克合杀伤官的候选：'
      + chinese(seal.placement) + chinese(seal.stem) + '（' + chinese(seal.tenGod) + '）克' + witness(pair.combiner)
      + '，这位伤官原合' + witness(pair.kill)
      + (list(nativeWealth).length ? '；同时见' + nativeWealth.map(witness).join('、') + '反克该运印' : '')
      + '；破合与救应仍待核'),
    branchOwl ? '实际运支本气偏印' + chinese(branchOwl.seal?.stem)
      + '与本命组成带中神的两支会，实位为' + list(branchOwl.meeting?.natalMembers).map(witness).join('、')
      + '与' + witness(branchOwl.meeting?.moving)
      + '，同一偏印克原来合杀的' + witness(branchOwl.pair?.combiner) : '',
    ...list(officerKillLuck?.supportedSecondaryOwls).map(({ seal, pair }) => '本步运干' + chinese(p.luckStem)
      + '生本柱余藏偏印' + chinese(seal.stem) + '，该偏印克原来合杀的' + witness(pair.combiner)),
    ...list(p.roots).flatMap(row => chinese(row.stem) ? [row.stem + '出现在' + positions(row.stemPositions)
      + '，按同五行藏气口径的根位为' + (list(row.roots).map(root => position(root.position) + chinese(root.pillar)
        + (root.exactStem === true ? '藏同一干' : '仅藏同五行异干')).join('、') || '已知柱位未见')
      + '；根位不等于有效根气、浮水或合绊已经成立，未知时柱不当作没有'] : []),
    ...list(p.printedCases).flatMap(row => row.matches === true && cases[row.id] ? ['完整四柱与转录中的' + cases[row.id]
      + '逐项相同；这里只确认盘面结构一致，不冒称用户就是历史原人，也不照搬原人仕途、财富或寿夭'] : []),
    ...printedLuckDescription(p),
    '本次不从柱序、五合、同干数量或五行克方向自动确认取用、合化、去留、通关和救应。正文与评注对本身之合、合一留一及重合的不同取义分别保留，重复见证不叠加计权',
  ]);
}

function stemBranchDescription(p, at) {
  if (p.stemBranchProfile !== 'zpqz-stem-branch-components-and-exact-return-clashes-v1') return '';
  const position = key => layers[key] || (key === 'decadal' ? '本步大运' : '');
  const pillar = value => position(value.position) + chinese(value.pillar);
  const wuMao = p.confirmed === true ? p.wuMaoLuckContext : undefined;
  const wuMaoBranches = wuMao?.branchReview;
  const branchPair = pair => list(pair?.members).length === 2 ? pair.members.map(pillar).join('与') + chinese(pair.kind) : '';
  const annualClashText = context => list(context?.annualEndpointClashes)
    .filter(({ annual, target }) => smthPillar(annual?.pillar) && smthPillar(target?.pillar))
    .map(({ annual, target }) => '同一岁段太岁' + annual.pillar + '冲' + pillar(target));
  const groupClashText = group => !group ? '' : sentences([
    chinese(group.values) + '会组的原局和大运实位为' + list(group.members).map(pillar).join('、')
      + (list(group.missingBranches).length ? '，当前已知原局及大运缺' + group.missingBranches.join('、')
        : group.natalComplete ? '，三支原局齐备' : '，原局与本步大运实位合计三支齐备'),
    ...list(group.competingClashes).map(branchPair).filter(Boolean).map(pair => '会组成员同时涉及' + pair),
    ...list(group.annualClashes).filter(({ annual, target }) => smthPillar(annual?.pillar) && smthPillar(target?.pillar))
      .map(({ annual, target }) => '同一岁段太岁' + annual.pillar + '冲会组成员' + pillar(target)),
    smthPillar(group.annualMissingMember?.pillar) ? '原局及大运所缺的支仅见于同段太岁'
      + group.annualMissingMember.pillar + '，作为当岁对照' : '',
  ]);
  const dingYou = p.confirmed === true ? p.dingYouZiChain : undefined;
  const dingYouWu = p.confirmed === true ? p.dingYouWuContacts : undefined;
  const dingYouSi = p.confirmed === true ? p.dingYouSiWealth : undefined;
  const locatedHidden = value => value && pillar(value) && smthStem(value.stem) && chinese(value.god)
    ? pillar(value) + '藏' + value.stem + value.god : '';
  const fireMeeting = p.confirmed === true && p.dayMaster === '甲' && ['寅', '戌'].includes(p.luckBranch);
  const firePaths = fireMeeting ? list(p.fireMeetingPaths) : [];
  const fireClashes = firePaths.flatMap(path => [...list(path.rootClashes), ...list(path.wuClashes), ...list(path.movingClashes)]);
  const guard = p.confirmed === true ? p.chenOfficerGuard : undefined;
  const birthTiming = p.confirmed === true
    ? guard?.birthTiming ?? p.dingChenOfficerRootArrival?.birthTiming ?? p.yiChenNativeSeals?.birthTiming : undefined;
  const { jiaWuWealthLu, jiaDingOfficerHurt, jiaWealthStem, jiaWealthBranch, jiaSealStem, jiaSealStorehouse } = p.confirmed === true ? p : {};
  const row = value => value && chinese(value.stem) ? position(value.position) + chinese(value.kind) + value.stem
    + '（' + (value.position === 'day' && value.kind !== '支藏' ? '日元' : chinese(value.god)) + '）' : '';
  const contacts = (values, label) => {
    const groups = new Map();
    for (const value of list(values)) {
      const from = row(value.from), relation = chinese(value.relation), to = row(value.to);
      if (!from || !relation || !to) continue;
      const key = from + relation;
      if (!groups.has(key)) groups.set(key, new Set());
      groups.get(key).add(to);
    }
    return [...groups].map(([key, targets]) => label + '：' + key + [...targets].join('、') + '；仅是成分端点，不等于有效去病、制护或争财');
  };
  return sentences([
    '干支成分分别核实：原局明透为' + list(p.exposedComponents).map(row).filter(Boolean).join('、'),
    '原局实际支藏为' + list(p.hiddenComponents).map(row).filter(Boolean).join('、'),
    '大运实际成分为' + list(p.movingComponents).map(row).filter(Boolean).join('、') + '；运支各藏干不能合为一个运干，日元也不另计为外透比肩',
    ...contacts(p.movingComponentContacts, '运来对原局'), ...contacts(p.natalComponentContacts, '原局对本运'),
    ...contacts(p.luckPillarElementLinks, '同一运柱的干与支藏气联系'),
    wuMao?.route === 'zi-shen-water' && locatedHidden(wuMao.monthOfficer) ? '评注的子年申运分支见'
      + list(wuMao.supports).map(locatedHidden).filter(Boolean).join('、') + '。两处实际水气均指向同一'
      + locatedHidden(wuMao.monthOfficer) + '的生向。徐注以年子和运申两处论会水，三支成局与实际作用另核' : '',
    wuMao?.route === 'zi-you-officer' && locatedHidden(wuMao.monthOfficer) ? '评注的子年酉运分支见'
      + list(wuMao.hurts).map(locatedHidden).filter(Boolean).join('、') + '，对同一'
      + locatedHidden(wuMao.monthOfficer) + '为辛金克乙木。此对亦为运酉冲月卯，实际伤官星仍待核' : '',
    wuMao && list(wuMao.exposedOfficers).length ? '月卯藏乙正官之外，原局的同干乙另透于'
      + list(wuMao.exposedOfficers).map(pillar).join('、') : '',
    branchPair(wuMaoBranches?.natalYearMonthPunishment) ? '原局具名刑位为' + branchPair(wuMaoBranches.natalYearMonthPunishment) : '',
    branchPair(wuMaoBranches?.natalMonthDayCombine) ? '原局月日两柱实际见' + branchPair(wuMaoBranches.natalMonthDayCombine) : '',
    smthPillar(wuMaoBranches?.natalHourFireBranch?.pillar) ? '另见原局时柱' + wuMaoBranches.natalHourFireBranch.pillar
      + '，留作寅午戌的支位证据' : '',
    ...list(wuMaoBranches?.otherEndpointClashes).map(branchPair).filter(Boolean).map(pair => '同段另见' + pair),
    ...list(wuMaoBranches?.endpointCombinations).map(branchPair).filter(Boolean).map(pair => '涉及该路径同端的六合另见' + pair),
    wuMao?.route === 'chou-shen-birth' && wuMao.birthPhase?.text === '长生'
      ? '正文丑年申运例称戊到申为长生，当前排盘十干十二宫表将戊到申列为' + chinese(wuMao.birthPhase.engine)
        + '。保留两种取法及原局年柱' + chinese(wuMao.yearPillar) : '',
    wuMao?.route === 'chou-you-metal' ? '正文丑年酉运例另核丑酉会位，实际见'
      + list(wuMao.hurts).map(locatedHidden).filter(Boolean).join('、') + '。子年评注的独立条件另查' : '',
    locatedHidden(dingYouWu?.wuDing) && locatedHidden(dingYouWu?.wuJi) && locatedHidden(dingYouWu?.youWealth)
      ? '丁日到午为禄位。' + locatedHidden(dingYouWu.wuDing) + '的丁火可克同一'
        + locatedHidden(dingYouWu.youWealth) + '，' + locatedHidden(dingYouWu.wuJi)
        + '的己土则可生该辛金。两条方向都属于当步运支藏气，实际克财、生财及取用仍待核' : '',
    locatedHidden(dingYouSi?.siGeng) && locatedHidden(dingYouSi?.youWealth) ? sentences([
      '巳酉会位两端实际见' + locatedHidden(dingYouSi.siGeng) + '与本命' + locatedHidden(dingYouSi.youWealth),
      '原局巳酉丑组藏财位置为' + list(dingYouSi.natalGroupWealth).map(locatedHidden).filter(Boolean).join('、'),
      ...list(dingYouSi.competingClashes).flatMap(pair => {
        const members = list(pair?.members);
        return members.length === 2 ? ['同段另见' + members.map(pillar).join('与') + '六冲，涉及本步巳酉会位的一端'] : [];
      }),
      ...annualClashText(dingYouSi),
      groupClashText(dingYouSi.groupWitnesses),
      '各支藏金、三合成员和同段冲位分别核对，财局是否成化仍待核',
    ]) : '',
    locatedHidden(dingYou?.chenWu) && locatedHidden(dingYou?.youWealth) && locatedHidden(dingYou?.luckZiGui)
      ? sentences([
        branchPair(dingYou.chenYouCombination) + '。另见' + pillar(dingYou.luckZiGui)
          + '的子辰会位，两路共用同一个原局年辰',
        locatedHidden(dingYou.chenWu) + '的土生同一' + locatedHidden(dingYou.youWealth) + '，该辛又对'
          + locatedHidden(dingYou.luckZiGui) + '呈金生水方向。辰酉或子辰实际成化及偏财能否被泄仍待核',
        ...list(dingYou.competingClashes).map(branchPair).filter(Boolean).map(label => '同段另见' + label),
        ...annualClashText(dingYou),
        groupClashText(dingYou.groupWitnesses),
      ]) : '',
    p.confirmed === true && p.sourcePillarExample?.kind === 'rootless' ? '原文具名的' + chinese(p.luckPillar)
      + '运中，运干在本运支无同五行藏根，原局根与运支方气另核' : '',
    p.confirmed === true && p.sourcePillarExample?.kind === 'generating' ? '原文具名的' + chinese(p.luckPillar)
      + '运中，运支所藏' + list(p.sourcePillarExample.generatingStems).filter(chinese).join('、') + '生运干'
      + chinese(p.luckStem) + '，另核运干有无同干根位' : '',
    p.confirmed === true && list(p.officerHurtCombination?.hurtTargets).length ? '本命丁日亥月，'
      + list(p.officerHurtCombination.officers).map(row).join('、') + '为原局正官，本步运干癸与'
      + list(p.officerHurtCombination.hurtTargets).map(row).join('、') + '五合，实际能否解伤护官仍待核' : '',
    p.confirmed === true && list(p.xinRootsInLuck?.officers).length ? '本命甲日酉月，'
      + list(p.xinRootsInLuck.officers).map(row).join('、') + '见本运支' + chinese(p.luckBranch) + '所藏'
      + list(p.xinRootsInLuck.metalStems).filter(chinese).join('、')
      + (list(p.xinRootsInLuck.metalStems).includes('辛') ? '，是同干根位' : '，是同五行异干根位') + '，实际根气仍待核' : '',
    guard?.monthSeal && guard?.monthHurt ? '丁日辰月，' + row(guard.monthSeal) + '是甲印在月令所见的同五行异干根位，'
      + row(guard.monthHurt) + (guard.monthHurtExposure?.newlyExposedByLuck === true ? '在本运首次同干透出'
        : list(guard.monthHurtExposure?.natalExposurePositions).length ? '与运干同干，原局已透于'
          + guard.monthHurtExposure.natalExposurePositions.map(position).filter(Boolean).join('、') : '与运干同干') : '',
    guard?.movingHurt ? list(guard.sealToHurt).map(link => row(link.from)).filter(Boolean).join('、') + '克实际'
      + row(guard.movingHurt) + '，该运干同时克' + list(guard.hurtToOfficer).map(link => row(link.to)).filter(Boolean).join('、')
      + '。两段以同一运干相连，实际能否护官仍待核' : '',
    birthTiming?.qingmingAt && number(birthTiming.elapsedDay) !== undefined ? '出生在' + at(birthTiming.qingmingAt)
      + '交清明后第' + birthTiming.elapsedDay + '日，卷一司令表列乙木九日、癸水三日、戊土十八日'
      + (['乙', '癸', '戊'].includes(birthTiming.tableDutyStem) ? '，出生时刻落在表载' + birthTiming.tableDutyStem + '用事段'
        : '，出生时刻不在表列三段内')
      + '。同卷评注另列乙木十二日'
      + (birthTiming.proseYiOnDuty === true ? '，该时点在其内' : '，该时点已过该段') + '。两处记载分别保留' : '',
    ...list(p.branchRelations).map(value => '实际干支关系为' + chinese(value.kind) + '，成员为'
      + list(value.members).map(v => position(v.position) + chinese(v.pillar)).filter(Boolean).join('、')
      + '；这是同一候选内的几何，不认定合化、解冲或成局'),
    ...list(p.returnClashes).map(value => '对应回冲位置为' + position(value.natal.position) + chinese(value.natal.pillar) + '与本运'
      + chinese(value.moving.pillar) + '；申只对应寅冲，酉只对应卯冲，不把申卯或酉寅拼成同一六冲；能否阻变格仍未知'),
    ...(p.confirmed === true ? list(p.renHaiReturnContacts).flatMap(({ seal, output }) =>
      seal && output && ['庚', '辛'].includes(seal.stem) && ['甲', '乙'].includes(output.stem)
        ? [pillar(seal) + '藏' + seal.stem + chinese(seal.tenGod) + '，同一回冲所及' + pillar(output) + '藏' + output.stem + chinese(output.tenGod)
          + '，另见' + seal.stem + '金克' + output.stem + '木的五行方向'] : []) : []),
    p.dayMaster === '壬' && p.natalMonthBranch === '亥' && p.luckBranch === '未' && list(p.woodMissingBranches).includes('卯')
      ? '未运与月亥相会，原局缺卯，列作评注虚会候选，实际取用仍须核对' : '',
    ...list(p.fireTargetLayouts).map(value => '火支与具名目标的位置：' + row(value.target) + '对' + position(value.wu.position) + chinese(value.wu.pillar)
      + '，原局柱差' + value.columnDistance + (value.sameColumn ? '，同一柱' : '，不同柱')
      + (list(value.between).length ? '，中隔' + value.between.map(v => position(v.position) + chinese(v.pillar)).join('、') : '')
      + (fireMeeting && list(value.namedRoots).length && !value.sameColumn ? '，此透干有原文具名的同干根位'
        + list(value.namedRoots).map(pillar).join('、') + '，' + pillar(value.wu) + '的午与实际大运' + chinese(p.luckPillar) + '为两支会位' : '')
      + '；只记录干支相隔的位置，不把不隔二位的原文含义自行改成有效性阈值'),
    ...firePaths.map(path => locatedHidden(path.wuFire) + '与' + locatedHidden(path.movingFire)
      + '均有克' + row(path.target) + '的方向，该透干的同干根为' + locatedHidden(path.root)
      + '。午与该透干的原局柱差为' + path.stemColumnDistance + '，午与该根的原局柱差为' + path.rootColumnDistance
      + (list(path.betweenStemAndWu).length ? '，午与透干中隔' + list(path.betweenStemAndWu).map(pillar).join('、') : '')
      + (list(path.betweenRootAndWu).length ? '，午与根中隔' + list(path.betweenRootAndWu).map(pillar).join('、') : '')
      + '。会火、成化及实际制约仍须核'),
    ...new Set(fireClashes.map(pair => '本段会位或根位所涉六冲为' + list(pair.members).map(pillar).join('与') + '，作用先后仍须核')),
    ...new Set(firePaths.flatMap(path => list(path.annualClashes).map(link => '本段太岁' + chinese(link.annual?.pillar)
      + '六冲' + pillar(link.target) + '，原透' + chinese(path.target?.stem) + '所绑根位在' + pillar(path.root)))),
    fireMeeting ? { 'natal-complete': '寅午戌在原局已齐', 'luck-completes': '寅午戌由实际大运补齐',
      'annual-supplement': '寅午戌缺位只由当岁补出', incomplete: '寅午戌仍有缺位' }[p.fireMeetingStatus] : '',
    fireMeeting ? groupClashText(p.fireMeetingGroupWitnesses) : '',
    ...list(p.concealedXinNeighbors).map(({ you, wu }) => '完整原局辛不透，' + pillar(wu) + '的午与'
      + pillar(you) + '的酉相邻，属于徐注的紧贴对照，' + locatedHidden(wu) + '有克' + locatedHidden(you)
      + '的方向，官星实际受伤仍须核对'),
    ...list(p.stemLuCoordinates).map(value => row(value) + '的禄位坐标为' + chinese(value.luBranch)
      + (value.luckAtLu ? '，本运支到此位' : '，本运支未到此位') + '；禄位不替代喜用或得地效果'),
    chinese(p.dayLuBranch) ? '日干禄位坐标为' + p.dayLuBranch + (p.luckAtDayLu ? '，本运支到此位' : '，本运支未到此位')
      + '；日干禄位和各外透干禄位分别记录，不添加日元为另一位外透比肩' : '',
    p.dayMaster === '丁' && p.natalMonthBranch === '酉' && p.luckBranch === '午' ? '丁日午运的实际藏干是丁比肩、己食神；原文禄堂劫财称谓保留，不改成午藏丙劫财，也不把午支当作丁干运' : '',
    jiaWuWealthLu ? list(jiaWuWealthLu.officers).map(row).join('、') + '为酉中辛官，'
      + (list(jiaWuWealthLu.exposedOfficers).length
        ? '另见' + list(jiaWuWealthLu.exposedOfficers).map(row).join('、') + '；' : '全局未见辛官明透；')
      + list(jiaWuWealthLu.wealthAtLu).map(row).join('、') + '见本步午运为己禄位，午中并藏'
      + row(jiaWuWealthLu.hurtHidden) + '、' + row(jiaWuWealthLu.wealthHidden) + '；藏丁与丁运干分论，财官取用仍待核' : '',
    ...list(jiaWuWealthLu?.wealthFeedsOfficer).map(link => row(link.wealth) + '在午得禄，并有生' + row(link.officer) + '的方向'),
    ...list(jiaWuWealthLu?.hiddenHurtControls).map(link => '午中所藏丁有克' + row(link.to) + '的五行方向，实际能否发用仍须核'),
    jiaDingOfficerHurt ? '原局明透' + list(jiaDingOfficerHurt.wealth).map(row).join('、') + '，本运丁伤官明透，逐柱核它所克的辛官' : '',
    ...list(jiaDingOfficerHurt?.controls).map(link => row(link.from) + '克' + row(link.to) + '，该结构进入运干丁一路'),
    ...list(jiaWealthStem?.attacks).map(link => '甲日财露的运干候选：' + row(link.from) + '克' + row(link.to)
      + (link.combines === true ? '，这对明干也有甲己五合' : '') + '，实际争财仍待核'),
    ...list(jiaWealthStem?.officerControls).map(link => '官透制化候选：' + row(link.from) + '克' + row(link.to) + '，与上面的克财为同一运干'),
    ...list(jiaWealthStem?.outputBridges).map(link => '食伤透的制化候选：' + row(link.from) + '生' + row(link.through) + '，再生' + row(link.wealth)),
    jiaWealthBranch ? '甲日财露的运支候选：' + chinese(p.luckBranch) + '支本气为' + row(jiaWealthBranch.mainQi)
      + '，与日元同五行；原局明透' + list(jiaWealthBranch.wealth).map(row).join('、')
      + (list(jiaWealthBranch.concealedYouOfficers).length ? '；同时见官藏财露的对照，酉位有'
        + list(jiaWealthBranch.concealedYouOfficers).map(row).join('、') + '且辛未透' : '')
      + '；运支帮身候选与运干克财各自核对' : '',
    ...list(jiaSealStem).map(link => '甲日癸印的财干候选：' + row(link.from) + '克' + row(link.to)
      + (link.combines === true ? '，同一对明干也有戊癸五合' : '') + '；实际破印或合化仍待核'),
    jiaSealStorehouse ? '甲日癸印的四库运支候选：' + chinese(p.luckBranch) + '支实藏'
      + list(jiaSealStorehouse.hidden).map(row).join('、') + '；原局有' + list(jiaSealStorehouse.seals).map(row).join('、')
      + '；库支藏气与运干条件分别记录' : '',
    ...list(jiaSealStorehouse?.contacts).map(link => '库支' + row(link.from) + (link.relation === '同五行'
      ? '与' + row(link.to) + '同属水' : '有' + chinese(link.relation) + row(link.to) + '的方向') + '，实际作用仍待核'),
    p.dayMaster === '戊' && p.natalMonthBranch === '卯' ? '该段正文丑年与评注子年分别留位，不以一处年支替代另一处；申子不补辰，子辰不补申' : '',
    '四库支中的实际藏气不等同戊己运干破癸印；明透官或食伤的制化例外须另核，不因见一神便宣称已获救',
    '寅午戌、巳酉丑、申子辰的实际全体成员与缺支分别核；两支会意不预先要求三支齐全，也不宣布三支已化',
    '运干去病与运支得地须辨原局取用及实际轻重；木生火、土生金或同五行根位均不自动证明力巨或有利',
  ]);
}

function zpqzMovingDescription(p, at) {
  if (p.profile !== 'zpqz-moving-root-clash-atomic-v1') return '';
  const position = value => value === 'decadal' ? '本步大运' : value === 'annual' ? '本段太岁' : layers[value] ? '本命' + layers[value] : '';
  const positions = values => list(values).map(position).filter(Boolean).join('、');
  const witness = row => position(row?.position) && chinese(row?.pillar) ? position(row.position) + row.pillar : '';
  const hidden = row => witness(row) && smthStem(row.stem) && chinese(row.tenGod) ? witness(row) + '藏' + row.stem + row.tenGod : '';
  const shenYin = p.confirmed === true ? p.shenYinClashComparison : undefined;
  const yishen = p.confirmed === true ? p.shenYinOfficerContext : undefined;
  const natalGeng = list(shenYin?.nativeGeng).map(hidden).filter(Boolean).join('、');
  const fireStem = p.confirmed === true ? p.fireExample?.stemSupport : undefined;
  const waterFire = p.confirmed === true ? p.fireExample?.coldWaterFireContact : undefined;
  const originalWater = p.confirmed === true ? list(p.fireExample?.natalWater).map(hidden).filter(Boolean).join('、') : '';
  const root = row => witness(row) + (row.exactStem === true ? '藏同一干' : '仅藏同五行异干')
    + (list(row.hiddenStems).filter(chinese).length ? '（' + row.hiddenStems.filter(chinese).join('、') + '）' : '');
  const you = p.youExample;
  const youMonthClash = p.confirmed === true && you?.natalJia === true && you?.movingMao === true
    && list(you.natalYouPositions).includes('month');
  const si = positions(you?.natalSiPositions), chou = positions(you?.natalChouPositions);
  const hai = positions(you?.natalHaiPositions), wei = positions(you?.natalWeiPositions);
  const chen = positions(you?.natalChenPositions), xu = positions(you?.natalXuPositions);
  const separatedSi = p.youSiMeetingSeparatedByYin;
  const natalYearPartner = [[you?.natalHaiPositions, '亥'], [you?.natalWeiPositions, '未']]
    .find(([pillars]) => list(pillars).includes('year'))?.[1];
  const renRoots = list(p.renRootsWithLuck);
  const renLuckRoot = renRoots.find(row => row.position === 'decadal');
  const dingChenRootCase = p.confirmed === true && p.dayMaster === '丁' && p.natalMonthBranch === '辰'
    && list(p.renExposures).length > 0 && ['申', '子'].includes(renLuckRoot?.branch);
  const yiChenSealCase = p.confirmed === true && p.dayMaster === '乙' && p.natalMonthBranch === '辰'
    && list(p.waterNativeAssociates).length > 0 && ['壬', '癸'].includes(p.luckStem);
  const waterSealExposures = list(p.waterSealExposures);
  const officerArrival = dingChenRootCase ? p.dingChenOfficerRootArrival : undefined;
  const shenRoot = officerArrival ? p.shenRootOpposition : undefined;
  const ziRoot = p.dingChenZiArrivalWithAnnualShenClash === true ? p.dingChenZiRootComparison : undefined;
  const addedShenRoot = p.dingChenShenArrivalWithAnnualZiClash === true ? p.dingChenShenRootComparison : undefined;
  const haiRoot = p.dingChenZiArrivalWithAnnualHaiClash === true ? p.dingChenHaiRootComparison : undefined;
  const stemMeeting = row => {
    const outer = list(row?.outerMembers).map(witness).filter(Boolean);
    const stems = list(row?.exposedStems).filter(value => witness(value) && smthStem(value.stem));
    return /^(申子辰|寅午戌)$/u.test(row?.branches) && chinese(row.center) && outer.length >= 2 && stems.length >= 2
      ? outer.join('、') + '已有两外支，实透' + [...new Set(stems.map(value => value.stem))].join('、')
        + '，未见中神' + row.center + '，按原书保留双干会合候选' : '';
  };
  const nativeSeals = yiChenSealCase ? p.yiChenNativeSeals : undefined;
  const chenMonthClashes = p.confirmed === true ? p.chenMonthClashes : undefined;
  const chenMonth = witness(chenMonthClashes?.month);
  const sealPositions = (values, placement) => list(values).flatMap(row => witness(row) && ['壬', '癸'].includes(row.stem)
    && ['正印', '偏印'].includes(row.tenGod) ? [witness(row) + placement + row.stem + row.tenGod] : []).join('、');
  const groupSeals = sealPositions(nativeSeals?.group, '藏');
  const outerSeals = sealPositions(nativeSeals?.outsideGroup, '藏');
  const exposedSeals = sealPositions(nativeSeals?.visible, '透');
  const incomingSeal = sealPositions([nativeSeals?.newExposure?.incoming], '新透');
  const otherExposedSeals = sealPositions(nativeSeals?.newExposure?.otherExposed, '原透');
  const groupSealKinds = new Set(list(nativeSeals?.group).map(row => row?.tenGod));
  const waterGroup = nativeSeals?.nativeWaterGroup;
  const directionRoot = p.confirmed === true ? p.directionRootContext : undefined;
  const branchMainQi = directionRoot?.branchMainQi;
  const branchSources = list(directionRoot?.branchFeedsStem).map(row => smthStem(row.stem)).filter(Boolean).join('、');
  const branchReceivers = list(directionRoot?.stemFeedsBranch).map(row => smthStem(row.stem)).filter(Boolean).join('、');
  const natalSources = list(directionRoot?.natalSources).flatMap(row => witness(row) && smthStem(row.stem)
    && ['支藏', '透干'].includes(row.kind)
    ? [witness(row) + (row.kind === '支藏' ? '藏' : '透') + row.stem] : []).join('、');
  return sentences([
    '以下将《子平真诠评注》的干支、根位和冲会逐柱绑定同一候选、同一步大运与同一立春岁段，正文与评注分别解释',
    p.confirmed === true ? '大运已与归档十步表唯一核验' : '大运尚未唯一核验',
    chinese(p.dayMaster) ? '日主为' + p.dayMaster : '',
    '已知本命柱：' + list(p.natalPillars).map(witness).filter(Boolean).join('、'),
    p.timeKnown === false ? '出生时刻未知，时柱不参与；已知三柱未见不能当作四柱全无，精确数量保持未知' : '',
    chinese(p.luckPillar) ? '本步大运为' + p.luckPillar + (chinese(p.luckTenGod) ? '，运干十神为' + p.luckTenGod : '') : '',
    chinese(p.annualPillar) ? '本段太岁为' + p.annualPillar + '，岁与运分别参与，不把同一年内不同交运片段拼接' : '',
    p.fireHalfYearXinSamePillar === true && smthPillar(p.luckPillar)
      ? '年柱辛酉的辛官明透且同柱有根，别柱午与实交' + p.luckPillar + '构成两支会位' : '',
    p.hasZhangReviewedWealthDayClash === true && smthPillar(p.annualPillar)
      ? '张参政原图实交癸卯运，运卯藏乙财克原月戊印；同段' + p.annualPillar + '岁支与运卯各冲本命日支酉' : '',
    witness(shenRoot?.clash?.natal) ? witness(shenRoot.clash.natal) + '六冲本步运申的长生根。'
      + (p.dingChenRootClashUnsupported === true ? '同段未核到六合、完整会局或中神见位，排除申根稳固的候选'
        : '同段另有会合位置见证，是否解冲仍待核') : '',
    stemMeeting(shenRoot?.stemSubstituteMeeting),
    witness(shenRoot?.annualClash?.annual) && witness(shenRoot?.annualClash?.luck)
      ? witness(shenRoot.annualClash.annual) + '六冲' + witness(shenRoot.annualClash.luck) + '的申长生根。'
        + (p.dingChenRootClashUnsupported === true ? '同段未核到六合、完整会局或中神见位，排除申根稳固的候选' : '同段其他会合位置另留待核') : '',
    p.stageStart && p.stageEnd ? '该运完整区间为' + at(p.stageStart) + '至' + at(p.stageEnd) + '，截止不计入；仅记录结构背景，不擅分干前五年、支后五年' : '',
    chinese(p.direction?.name) ? '运支所在方气为' + p.direction.name + '，本章对应' + chinese(p.direction.element)
      + '，支位组为' + chinese(p.direction.values) + '；方气不等于独立喜忌或强弱评分' : '',
    '运干在自身运支的同五行根位：' + (list(p.luckStemOwnRoots).map(root).filter(Boolean).join('、') || '未见')
      + '；这是所声明的藏气位置口径，不是根气有效强度',
    '运干在原局的同五行根位：' + (list(p.luckStemNativeRoots).map(root).filter(Boolean).join('、') || '已知柱未见')
      + '；运支无根不等于原局无根，未知时柱不当作已排除',
    directionRoot && [
      chinese(directionRoot.example) ? '本步大运' + p.luckPillar + '见于' + directionRoot.example : '',
      smthStem(p.luckStem) && chinese(directionRoot.stemElement) && smthStem(branchMainQi?.stem) && chinese(branchMainQi?.element)
        ? '运干' + p.luckStem + '属' + directionRoot.stemElement + '，运支' + p.luckBranch + '本气'
          + branchMainQi.stem + '属' + branchMainQi.element : '',
      branchSources ? '运支所藏' + branchSources + '有生运干' + p.luckStem + '的方向' : '',
      branchReceivers ? '运干' + p.luckStem + '有生运支所藏' + branchReceivers + '的方向' : '',
      natalSources ? natalSources + '有生运干' + p.luckStem + '的方向' : '',
      directionRoot.natalDayFeedsStem === true ? '本命日干' + p.dayMaster + '有生运干' + p.luckStem + '的方向' : '',
    ].filter(Boolean).join('。'),
    ...list(p.branchCounts).filter(row => row.knownCount > 0 || ['申', '寅'].includes(row.branch)).flatMap(row => chinese(row.branch) ? [
      row.branch + '在' + (positions(row.positions) || '已知柱未见') + '，已知柱数量为' + row.knownCount
        + (number(row.totalCount) === undefined ? '；完整四柱总数仍未知' : '，完整四柱总数为' + row.totalCount),
    ] : []),
    p.exactTwoShenOneYin === true ? '完整原局确为两申一寅；本命两申与本步寅运的新增关系须与原有冲分别核'
      : p.exactTwoShenOneYin === false ? '完整原局不满足恰好两申一寅，三申或多寅不能冒充本条数量'
        : '恰好两申一寅尚未核实，不按已知三柱数量补足',
    ...list(p.nativeClashes).flatMap(row => list(row.members).every(witness) ? ['原局已有六冲：' + row.members.map(witness).join('与')] : []),
    ...list(p.movingClashes).flatMap(row => witness(row.natal) && witness(row.luck) ? [sentences([
      witness(row.luck) + '与' + witness(row.natal) + '六冲',
      row.isMonthCommand === true ? '所冲为月令' : '所冲不是月令',
      ['急', '缓'].includes(row.textUrgency) ? '沈氏按柱位将此冲列为' + row.textUrgency
        + '。徐注另分月令和喜用所在，此对' + (row.isMonthCommand === true ? '涉及月令' : '涉及非月令柱')
        + '，所冲是否为喜用仍待核' : '',
      chinese(row.branchClass) ? '本命受冲支按本章归为' + row.branchClass + (row.branchClass === '四正' ? '（原文败地）' : '') : '',
      row.annualAlsoClashes === true && witness(row.annual) ? witness(row.annual) + '也冲同一本命柱，岁运并冲的两个参与方已核'
        + '。' + (row.annual.pillar === row.luck.pillar ? '太岁与大运干支同柱' : '太岁与大运同支异干')
        : '本段太岁没有同时六冲这一原局柱位，不借其他柱的冲拼成岁运并冲',
      '柱位、支类与几何冲不直接决定轻重、冲坏或喜用结果',
    ])] : []),
    ...list(p.movingStemClashes).flatMap(row => witness(row.natal) && witness(row.luck)
      ? [witness(row.luck) + '的天干与' + witness(row.natal) + '的天干相冲。与支冲分别核算'] : []),
    ...list(p.twoClashPairings).map((row, index) => '两申与本命寅、运寅的一对一配对候选' + (index + 1) + '：'
      + list(row.pairs).map(pair => witness(pair.shen) + '对' + witness(pair.yin)).join('；')
      + '；这是两种对应方式之一，不挑定唯一配对，也不把四条可能连边加权成四次作用'),
    p.confirmed === true && p.kangDoubleClash
      ? '同书康例在实交戊午运时，本命年午和运午分别可冲日子、时子，两种一对一配法均成立。徐注将此段作为引起两冲的对照'
      : '',
    p.confirmed === true && p.dayMaster === '乙' && p.luckBranch === '寅' && p.exactTwoShenOneYin === true
      ? '乙日原局两申的本气庚为正官，本步大运再见寅，尚须核是否取申官为用' : '',
    natalGeng && hidden(shenYin?.natalYinJia) ? sentences([
      natalGeng + '分别对同一个' + hidden(shenYin.natalYinJia) + '有庚金克甲木的方向。这是原局两处申的见证',
      yishen ? (list(yishen.betweenOfficers).length ? '两处本命申中隔' + list(yishen.betweenOfficers).map(witness).filter(Boolean).join('、')
        : '两处本命申相邻') : '',
      list(yishen?.exposedOfficers).length ? '另见原局庚明透于' + list(yishen.exposedOfficers).map(witness).filter(Boolean).join('、') : '',
      hidden(shenYin.luckYinJia) ? hidden(shenYin.luckYinJia) + '是实际新增的运寅甲，和原局寅甲保留各自位置。两种配对仍待核实际作用' : '',
      witness(shenYin.onlyAnnualYin) ? witness(shenYin.onlyAnnualYin) + '单独见寅，当步运支未到寅' : '',
    ]) : '',
    [separatedSi?.month, separatedSi?.intervening, separatedSi?.si].every(witness)
      ? witness(separatedSi.intervening) + '隔在' + witness(separatedSi.month) + '与' + witness(separatedSi.si)
        + '之间，按徐注此路仅留巳酉会位候选' : '',
    youMonthClash && si && !separatedSi ? '甲日卯运冲月酉，' + si + '见巳，与月酉相会'
      + (chou ? '，' + chou + '另见丑，原局巳酉丑三支齐备' : '') : '',
    list(p.youSourceMeetingRoutes).includes('natal-si-with-month-you')
      ? '沈氏正文另列本命巳与月酉的两处会位，原局未查到丑，同段未见所列另冲' : '',
    youMonthClash && (hai || wei) ? '本步运卯会原局的' + [hai && hai + '亥', wei && wei + '未'].filter(Boolean).join('、')
      + (natalYearPartner ? '，沈氏正文所举的年支' + natalYearPartner + '在位' : '') : '',
    list(p.youSourceReliefRoutes).includes('hai-mao-wei-in-natal-and-luck')
      ? '卯运与原局' + list(p.youSourceRelief?.annotatedNativeWood).map(witness).filter(Boolean).join('、')
        + '已齐亥卯未，实际合化仍待核' : '',
    list(p.youSourceReliefRoutes).includes('hai-mao-wei-annual-supplement')
      ? '亥卯未所缺支只由本段太岁补出，原局与实际卯运尚未齐组' : '',
    youMonthClash && chen ? chen + '的辰与月酉六合，需合参卯运所冲的同一个月支' : '',
    youMonthClash && xu ? xu + '的戌与运卯六合，需合参同一个运卯对月酉的冲' : '',
    ...list(you?.liuheRoutes).flatMap(route => {
      if (!youMonthClash || !['辰', '戌'].includes(route.partner) || !chinese(route.rivalValues)) return [];
      const candidate = route.partner === '辰' ? '辰酉' : '卯戌';
      const members = list(route.rivalMembers).flatMap(row => chinese(row.branch) && positions(row.natalPositions)
        ? [positions(row.natalPositions) + row.branch] : []).join('、');
      const sharedChen = route.sharedChenClash;
      const sharedTargets = list(sharedChen?.targets).map(witness).filter(Boolean);
      return [
        witness(sharedChen?.partner) && sharedTargets.length === 2
          ? '同一原局辰对应两处受卯运冲的酉，辰在' + witness(sharedChen.partner) + '，两处酉为' + sharedTargets.join('和')
            + '。辰酉合位和两处卯酉冲同时留证' : '',
        route.natalRivalComplete === true ? members + '在原局齐备' + route.rivalValues + '，同一'
          + route.partner + '亦参与此会。排除' + candidate + '六合可单独解月酉冲的候选，保留卯酉冲' : '',
        route.natalRivalHalf === true ? members + '在原局构成' + route.rivalValues + '的半会见位，共用' + candidate + '六合的'
          + route.partner + '。半会与六合的实际轻重仍待核' : '',
        stemMeeting(route.natalRivalStemMeeting),
        ...[route.natalRivalLuMeeting].flatMap(row => {
          const outer = list(row?.outerMembers).map(witness).filter(Boolean);
          const lu = list(row?.luMembers).map(witness).filter(Boolean);
          return /^(申子辰|寅午戌)$/u.test(row?.branches) && chinese(row.center) && outer.length >= 2 && lu.length
            ? [outer.join('、') + '已有两外支，未见中神' + row.center + '，原局却见' + lu.join('、')
              + '的禄位，按卷二保留会意与同一' + candidate + '六合竞争'] : [];
        }),
        route.annualCompletesRival === true ? members + '与太岁' + chinese(p.annualBranch)
          + '在该岁段齐备' + route.rivalValues + '。这一竞争来自流年，实际能否影响' + candidate + '六合仍待核' : '',
        ...list(route.natalPartnerClashes).flatMap(pair => {
          const clashMembers = list(pair?.members);
          return clashMembers.length === 2 && clashMembers.every(witness)
            ? ['同一' + candidate + '六合伙伴在原局另见' + clashMembers.map(witness).join('与') + '六冲，是否牵动原合仍待核'] : [];
        }),
        ...list(route.annualPartnerClashes).flatMap(row => witness(row) && chinese(p.annualPillar)
          ? ['本段太岁' + p.annualPillar + '另冲' + candidate + '六合的伙伴' + witness(row) + '，另属流年冲位'] : []),
      ].filter(Boolean);
    }),
    ...list(p.groups).flatMap(row => chinese(row.values) ? [sentences([
      '核会合候选' + row.values + '：' + list(row.members).map(member => chinese(member.branch) ? member.branch + '在'
        + ([positions(member.natalPositions), member.luckPresent === true ? '本步大运' : ''].filter(Boolean).join('、') || '已知位置未见') : '').filter(Boolean).join('、'),
      row.natalComplete === true ? '原局三支已经齐全' : row.natalComplete === false ? '原局三支未全部齐全' : '原局完整成员仍未知',
      row.completedByLuck === true ? '本运补齐原先缺支' : row.completeWithLuck === true ? '连同大运成员齐全' : '在已知位置仍缺' + list(row.missingInKnownPositions).filter(chinese).join('、'),
      '亥或未、申或子的原文分支保留，半会不补成全局，三支齐全也不当作已化或已解冲',
    ])] : []),
    p.fireExample?.natalFrame === true ? '原局属于丙日子月亥年的本条框架；本步运干'
      + (p.fireExample.movingSameFireStem === true ? '为丙丁的同五行分支' : '不在丙丁分支') + '，运支'
      + (p.fireExample.movingSiWuBranch === true ? '属于巳午冲位分支' : '不在巳午分支')
      + '；两个分支可能同在一运柱，不将同属火合并成同一种效果，水旺火衰及实际增势仍须核' : '',
    originalWater ? '原局年亥和月子的水气分别为' + originalWater : '',
    fireStem && witness(fireStem) && ['丙', '丁'].includes(fireStem.stem) ? witness(fireStem) + '的运干'
      + fireStem.stem + '为' + chinese(fireStem.tenGod) + '，与本命日干丙同属火' : '',
    hidden(waterFire?.waterHidden) && hidden(waterFire?.fireHidden) ? hidden(waterFire.waterHidden) + '与同一六冲中的'
      + hidden(waterFire.fireHidden) + '形成水克火的方向。实际旺衰及冲后的增减仍待核' : '',
    list(p.renExposures).length ? '非日干的壬透见证：' + p.renExposures.map(witness).join('、') : '',
    positions(p.chenStorehousePositions) ? '本章壬水辰库的位置在' + positions(p.chenStorehousePositions) + '；库位不等于官根已经稳固' : '',
    renRoots.length ? '壬在原局及本运的根位：' + renRoots.map(root).join('、') + '；同干壬根与同五行癸根分别保留，不按根数判断强弱' : '',
    dingChenRootCase && p.renRootsConfinedToChen === true ? '丁日辰月原局透壬，原局水根限于辰库，'
      + (renLuckRoot.exactStem ? '申运另见壬的同干根位' : '子运另见癸的同水根位') + '，实际根气仍须核' : '',
    dingChenRootCase && p.renRootsConfinedToChen === false ? '丁日辰月的原局除了辰库，还见'
      + renRoots.filter(row => row.position !== 'decadal' && row.branch !== '辰').map(root).join('、') + '，另行核对原有根气' : '',
    ziRoot && [ziRoot.annualClash?.pillar, ziRoot.originalShen?.pillar, ziRoot.arriving?.pillar].every(chinese)
      ? '太岁' + ziRoot.annualClash.pillar + '六冲原局的' + ziRoot.originalShen.pillar + '藏壬根，同一步'
        + ziRoot.arriving.pillar + '运另见子中本气癸水' : '',
    addedShenRoot && [addedShenRoot.annualClash?.pillar, addedShenRoot.originalZi?.pillar, addedShenRoot.arriving?.pillar].every(chinese)
      ? '太岁' + addedShenRoot.annualClash.pillar + '六冲原局的' + addedShenRoot.originalZi.pillar + '子根，同一步'
        + addedShenRoot.arriving.pillar + '运另见申中壬长生根' : '',
    haiRoot && [haiRoot.annualClash?.pillar, haiRoot.originalHai?.pillar, haiRoot.arriving?.pillar].every(chinese)
      ? '太岁' + haiRoot.annualClash.pillar + '六冲原局的' + haiRoot.originalHai.pillar + '藏壬根，同一步'
        + haiRoot.arriving.pillar + '运另见子中本气癸水' : '',
    officerArrival?.natal && officerArrival?.arriving && witness(officerArrival.natal) && witness(officerArrival.arriving)
      ? sentences([
        '以原局明透的壬官取生旺位置，' + witness(officerArrival.natal) + '为' + chinese(officerArrival.natal.renPhase)
          + '位，实藏癸水。' + witness(officerArrival.arriving) + '为' + chinese(officerArrival.arriving.renPhase)
          + '位，实际根位是' + (officerArrival.arriving.exactStem === true ? '申中同干壬' : '子中同水癸'),
        ...list(officerArrival.incomingClashes).flatMap(row => witness(row)
          ? [witness(officerArrival.arriving) + '的运支同时冲' + witness(row) + '，根位和冲位并存，实际得根效果待核'] : []),
      ]) : '',
    ...list(chenMonthClashes?.opposing).map(witness).filter(label => label && chenMonth)
      .map(label => label + '冲' + chenMonth + '，冲位单独留证'),
    groupSeals ? '原局水组三合成员的藏印为' + groupSeals + (groupSealKinds.has('正印') && groupSealKinds.has('偏印')
      ? '，同组同时见正印与偏印' : '，当前同组仅见一种藏印') : '',
    outerSeals ? '水组以外的原局藏印另见' + outerSeals : '',
    exposedSeals ? '原局已经明透的印另见' + exposedSeals : '',
    incomingSeal && otherExposedSeals ? incomingSeal + '与' + otherExposedSeals + '在同段并见' : '',
    ...(yiChenSealCase ? waterSealExposures.flatMap(row => witness(row) && chinese(row.stem) ? [
      '原局申子辰组的' + witness(row) + '藏' + row.stem + '印，与本步运干同干'
      + (row.newlyExposedByLuck === true ? '，该印本运首次透出' : positions(row.natalExposurePositions)
        ? '，此印原已透在' + positions(row.natalExposurePositions) : ''),
    ] : []) : []),
    yiChenSealCase && p.timeKnown === true && !waterSealExposures.length
      ? p.luckStem + '运在原局申子辰组内未找到同干藏印' : '',
    waterGroup?.complete === true ? '原局实见申、子、辰三支俱全'
      : list(waterGroup?.missingBranches).length ? '按正文逐支核会位，原局尚缺' + waterGroup.missingBranches.join('、') : '',
    groupSeals ? '正偏印见位、当运新透与会印能否成局分别核对，实际取用仍须合参' : '',
    ...list(p.hiddenActivations).filter(row => row.luckStemSame === true).flatMap(row => witness(row) && chinese(row.stem) ? [
      witness(row) + '藏' + row.stem + '，与运干同干；'
      + (row.newlyExposedByLuck === true ? '已知完整原局非日干未透此干，本运新透' : row.newlyExposedByLuck === false ? '不属于本运首次同干透出' : '时柱未知，首次透出尚不能确认')
      + (positions(row.natalExposurePositions) ? '；原已透于' + positions(row.natalExposurePositions) : '')
      + '；同一藏干透出与同五行异干不是同一证据，不能据此认定用神已发用',
    ] : []),
    stemBranchDescription(p, at),
    '正文与评注对两申不冲一寅的说法有分歧；本次只核数量、位置与候选配对，官星取用、成化解冲及实际冲力仍须逐条核定。结构背景沿用真实运段，不借其他条文的五年说法给本段另造时限，不据结构保证具体事件',
  ]);
}

function jupiterRepeatDescription(p, at) {
  if (p?.profile !== 'heindel-jupiter-station-bracketed-repeat-v1') return '';
  const time = value => number(value) === undefined ? '' : at(new Date(value).toISOString());
  const statuses = { repeated: '已闭合核到顺行、逆行、再顺行三次过点', single: '相邻已闭合回环内仅核到一次顺行过点',
    stationary_touch: '本次在停驻边界接触，不能重复算成两次穿越', unresolved: '回环边界或锚点尚未核全', coordinate_mismatch: '精确锚点与目标度数不一致，不能补作重复经过' };
  return sentences([
    '木星复过按同一本命目标、同一相位及有向分支核对；实际目标黄经为' + degrees(p.targetLongitude)
      + '，相对本命的有向角度为' + degrees(p.offset),
    statuses[p.status] || '本次复过状态未确定',
    ...list(p.stationTurns).map(row => '核回环的转向点在' + time(row.at) + '，位置为' + degrees(row.longitude)
      + (row.directionAfter === 'retrograde' ? '，由顺转逆' : '，由逆转顺')),
    ...list(p.passes).map((row, index) => '本次几何序列第' + (index + 1) + '个过点在' + time(row.at)
      + (motions[row.direction] ? '（' + motions[row.direction] + '）' : '')
      + (row.beforeBirth === true ? '；在出生之前，仅作星历背景' : row.afterReference === true ? '；参考时刻之后的星历时刻，尚未发生' : '；不晚于本次参考时刻')),
    time(p.referenceAt) ? '参考时刻为' + time(p.referenceAt) : '',
    p.returnedAsOfReference === true ? '三个过点均在出生后且不晚于参考时刻；这只核过点时间，不证明主题获益'
      : '不能把尚未来到或出生前的过点说成已经完成的个人复过',
    '五年搜索范围只是寻找相邻转向边界的数值范围，不是运势有效期；两个产品相位区间即使中间离相，也可能属于同一个逆行回环',
    '普通六合、拱不以重复经过为必要门槛；一次顺行、局部经过序号或三个几何过点都不自动证明作用延长，本命支持、同性质和原法作用起止仍须另核',
  ]);
}

function heindelBirthdayDescription(p) {
  switch (p.dateBasis) {
    case 'archive-local-birthday': return '依出生档案时区取出生地民用生日，以该日格林尼治正午为星历参照';
    case 'UTC-birth-date-candidate': return '出生地民用生日缺少可核参照，暂取格林尼治出生日期';
    default: return '出生地生日与格林尼治日期的取法未知';
  }
}

function heindelDescription(p, at) {
  if (p.profile !== 'heindel-acd-geometry-candidate-v1') return '';
  const time = value => number(value) === undefined ? '' : at(new Date(value).toISOString());
  const geometry = row => bodies[row?.natalTargetId] && aspects[row?.aspectType]
    ? '推运' + (bodies[row.progressedBody] || '太阳') + '对本命' + bodies[row.natalTargetId] + aspects[row.aspectType] : '';
  const position = row => bodies[row?.body] && zodiacPosition(row.longitude, 'tropical')
    ? bodies[row.body] + '在' + zodiacPosition(row.longitude, 'tropical') : '';
  const minuteDateOffsets = list(p.printedMinuteComparison?.dayOffsets).filter(offset => number(offset) !== undefined);
  const natalFinanceAspect = aspects[p.natalSunJupiterFinanceContact?.aspectType];
  const transitLunationMonth = p.fellowshipTransitLunationMonthProfile === 'rosicrucian-lesson-13-continuous-transit-in-lunation-v1';
  const transitLunation = transitLunationMonth || p.fellowshipTransitLunationProfile === 'rosicrucian-lesson-13-actual-transit-lunation-v1'
    ? p.transitLunationActivation : undefined;
  const fellowshipBand = (p.fellowshipTransitBandProfile === 'rosicrucian-lesson-13-neptune-transit-1.5-v1'
    || transitLunation) && p.transitAllowedOrb === 1.5;
  return sentences([
    jupiterRepeatDescription(p.jupiterRepeat, at),
    transitLunationMonth ? '这一段取相邻两朔之间与连续实际行运带的交集' : '',
    '以下为Heindel调整计算日候选，独立于生日周年与Leo计算；按每日正午恒星时找调整日，再在相邻正午黄经之间每历月推进十二分之一',
    heindelBirthdayDescription(p),
    minuteDateOffsets.length > 1 ? '按原书时分表精度复算，相对现代全精度调整日并列的是'
      + minuteDateOffsets.map(offset => offset === 0 ? '同日' : offset < 0 ? '提前' + -offset + '天' : '推后' + offset + '天').join('、')
      : '',
    '以调整日周年的UTC正午和现代热带视黄经插值；闰日周年夹到月末，不能声称原法计时已完整核实',
    bodies[p.transitBody] && bodies[p.natalTargetId] && aspects[p.aspectType] ? sentences([
      '真实行运' + bodies[p.transitBody] + '与本命' + bodies[p.natalTargetId] + '的' + aspects[p.aspectType]
        + (fellowshipBand ? '一度半区间' : p.kind === 'exact' ? '精确接触' : '产品容许度内区间'),
      motions[p.transitMotion] ? '精确经过时为' + motions[p.transitMotion] : '',
      ({ favourable: '原书在这些条件下列为偏顺', adverse: '原书在这些条件下列为偏难',
        mild_adverse: '原书将这类木星刑冲列为较轻的阻力',
        no_observed_gain: '这类土星六合或拱在原书观察中未见明确增益' })[p.transitNature] ?? '',
      number(p.passIndex) !== undefined ? '当前已核行运段中的第' + p.passIndex + '次精确经过' : '',
      fellowshipBand ? '按同学派高级课程第十三课的实际行运范围复算' : degrees(p.transitAllowedOrb)
        ? '行运区间使用产品容许度' + degrees(p.transitAllowedOrb) + '，该阈值未当作Heindel原书通用阈值' : '',
    ]) : '',
    transitLunation && degrees(transitLunation.natalDeviation) && degrees(transitLunation.phaseTransitDeviation)
      ? '实际新月同时触及同一本命方向，距精确相位' + degrees(transitLunation.natalDeviation)
        + '，与行运行星同段相距' + degrees(transitLunation.phaseTransitDeviation) : '',
    natalFinanceAspect && p.natalSunJupiterFinancialSupport === 'supported'
      ? '原书财务章节所列的本命日木' + natalFinanceAspect + '已核，两曜未见本项所查受克'
      : natalFinanceAspect && p.natalSunJupiterFinancialSupport === 'mixed'
        ? '本命日木虽见' + natalFinanceAspect + '，但同见受克，财务支持仍待核' : '',
    list(p.natal).length ? '本命独立核位：' + p.natal.map(position).filter(Boolean).join('、') : '',
    ...list(p.natalPowers).map(row => {
      const placement = position(row);
      const powers = [row.domicile === true ? '入庙星座' : '', row.detriment === true ? '失势星座' : '',
        row.exaltationSign === true ? '擢升星座' : '', row.fallSign === true ? '落陷星座' : ''].filter(Boolean);
      return placement ? '依原书第十八章核本命' + placement + (powers.length ? '，列为' + powers.join('与') : '') : '';
    }),
    number(p.mercuryToSun?.offset) !== undefined ? '本命水星与太阳黄经相距' + degrees(Math.abs(p.mercuryToSun.offset))
      + (p.mercuryToSun.withinThreeDegrees === true ? '，在原书近太阳三度范围内' : '，在原书近太阳三度范围外') : '',
    ...list(p.natalAspectEvidence ?? p.natalPairs).flatMap(row => {
      if (!bodies[row?.first] || !bodies[row?.second]) return [];
      return list(row.contacts).flatMap(contact => {
        const aspect = contact?.aspectType === 'parallel' ? '赤纬平行' : aspects[contact?.aspectType];
        const affected = list(contact?.affected).map(body => bodies[body]).filter(Boolean).join('、');
        const reading = contact?.assessment === 'support' ? '原书列为支持'
          : contact?.assessment === 'affliction' && affected ? '依原书受克方向核见' + affected : '该星对在本段未定支持或受克';
        return aspect && degrees(contact.deviation) ? ['本命' + bodies[row.first] + '与' + bodies[row.second] + aspect
          + '，离精确相位' + degrees(contact.deviation)
          + (contact.band === 'extended' ? '，仅在赤纬平行扩展范围内' : '，' + reading)] : [];
      });
    }),
    p.sampleAt && list(p.progressed).length ? '在' + at(p.sampleAt) + '的五个主要推运天体位置为'
      + p.progressed.map(position).filter(Boolean).join('、') + '；这是取样位置，不表示整个查询期位置不变' : '',
    ...list(p.solar).flatMap(row => geometry(row) && time(row.start) && time(row.end) ? [geometry(row)
      + '，按原文太阳一度半前后带核得' + time(row.start) + '至' + time(row.end) + '，截止不计入'
      + (list(row.exactTimes).length ? '；其中精确时刻为' + row.exactTimes.map(time).join('、') : '；本段内未出现精确点')
      + '；以上为查询窗内的太阳带片段，窗口起止不自动代表实际入出相，需另核精确行运时是否仍在带内'] : []),
    !list(p.solar).length ? '本段扫描未见上述太阳候选相位带，不表示其他推运不存在或本命已经排除相关条件' : '',
    Array.isArray(p.solarActiveAtExact) ? '精确行运发生时有效的太阳候选相位：'
      + (p.solarActiveAtExact.map(geometry).filter(Boolean).join('、') || '上述太阳范围内未见；其他推运前提仍未知') : '',
    ...list(p.lunar).flatMap(row => geometry(row) && time(row.start) ? [geometry(row) + '的精确过点在' + time(row.start)
      + '；月亮仅核精确过点，未规定整月有效或另设月亮容许度'] : []),
    ...list(p.lunations).flatMap(row => time(row.at) ? ['实际新月在' + time(row.at) + '，位置为' + zodiacPosition(row.longitude, 'tropical')
      + '；' + list(row.natalSeparations).flatMap(target => bodies[target.body] && degrees(target.separation)
        ? ['与本命' + bodies[target.body] + '相距' + degrees(target.separation)] : []).join('、')
      + '；这些夹角不是原文相位命中，不能把整个朔望月都当作该新月精确触发'] : []),
    ...list(p.activations).flatMap(row => bodies[row.solarTarget] && bodies[row.lunarTarget] && aspects[row.solarAspect] && aspects[row.lunarAspect]
      ? ['在' + time(row.at) + '出现原文两例之一的几何组合：太阳推运对本命' + bodies[row.solarTarget] + aspects[row.solarAspect]
        + '带内，月亮推运精确对本命' + bodies[row.lunarTarget] + aspects[row.lunarAspect]
        + '；只证明该例的相位类型与时间相合，不扩展为所有同性质，也不保证事件发生'] : []),
    '太阳带、月亮过点、实际新月、本命夹角与真实行运分开看待；本命承诺、受克强弱、其他天体推运容许度和逐条同性质尚未核全，不根据同时出现认定增强或削弱',
  ]);
}

function zpqzDescription(p, at) {
  if (p.profile !== 'zpqz-hidden-roots-luck-atomic-v1') return '';
  const position = value => value === 'decadal' ? '本步大运' : layers[value] ? '本命' + layers[value] : '';
  const positions = values => list(values).map(position).filter(Boolean).join('、');
  const witness = value => position(value.position) && chinese(value.pillar) ? position(value.position) + value.pillar : '';
  const verifiedPairs = p.confirmed === true && p.rootPairingProfile === 'zpqz-cross-layer-root-pairing-v3';
  const renHai = p.confirmed === true && p.dayMaster === '壬' && p.natalMonthBranch === '亥' && list(p.natalExposedStems).includes('己');
  const renHaiOfficer = renHai ? p.renHaiOfficerContext : undefined;
  const stemPosition = value => value === 'day' ? '本命日干' : value === 'decadal' ? '运干' : position(value) + '天干';
  const rootChoice = verifiedPairs ? p.rootChoice : undefined;
  const reviewedRoots = verifiedPairs ? p.crossLayerRootReview : undefined;
  const natalFireMembers = list(rootChoice?.natalFireMembers);
  const [kang, yao] = p.confirmed === true ? [p.kangExposureContext, p.yaoExposureContext] : [];
  const zhao = p.confirmed === true ? p.zhaoAnnualGengCheck : undefined;
  const sourceHidden = row => witness(row) + '藏' + chinese(row.stem) + chinese(row.tenGod);
  return sentences([
    '以下是《子平真诠评注》透藏与会合的同一候选、同一步大运结构',
    chinese(p.dayMaster) ? '日主为' + p.dayMaster : '', chinese(p.luckPillar) ? '大运柱为' + p.luckPillar : '',
    zhao && chinese(zhao.annualPillar) && witness(zhao.combinesMonthYi) && witness(zhao.controlsHourJia)
      ? '赵例史日仍在' + p.luckPillar + '运，实岁' + zhao.annualPillar + '的庚合' + witness(zhao.combinesMonthYi)
        + '之乙，克' + witness(zhao.controlsHourJia) + '之甲' : '',
    hiddenStems(p.luckHiddenStems) ? '运支藏干为' + hiddenStems(p.luckHiddenStems) + '；本气为'
      + chinese(list(p.luckHiddenStems)[0]?.stem) + '，本气出现不等于该神得用' : '',
    p.confirmed === true ? '大运已与归档十步表唯一核验' : '大运尚未唯一核验',
    p.timeKnown === false ? '时刻未知，时柱不参与，未见不当作全局没有' : '',
    ...list(p.hiddenActivations).flatMap(row => witness(row) && chinese(row.stem) ? [sentences([
      witness(row) + '藏' + row.stem + (chinese(row.tenGod) ? '，十神为' + row.tenGod : ''),
      row.sourceRole ? '本章对此藏干的说明为' + chinese(row.sourceRole) : '',
      positions(row.natalExposurePositions) ? '原局已透于' + positions(row.natalExposurePositions) : '',
      row.dayMasterSameStem === true ? '与日主同干，不能把日干本身当作运来首次透清' : '',
      row.luckStemSame === true ? '本步运干与此藏干相同' : '',
      row.newlyExposedByLuck === true ? '原局非日干处未透该干，本运新透；是否喜忌与发用未据此成立' : '',
    ])] : []),
    ...(p.confirmed === true ? list(p.sourceNewExposures).flatMap(row => {
      if (!row || !witness(row) || !smthStem(row.stem) || !chinese(row.tenGod)) return [];
      const officerSeats = list(row.officerSeats).map(witness).filter(Boolean).join('、');
      return [sentences([
        row.monthCommand === true ? witness(row) + '所藏' + row.stem + row.tenGod + '由本步运干新透，属于正文另论的月令藏干透清' : '',
        officerSeats && ['jia-you-wu', 'jia-you-ding'].includes(row.namedExample)
          ? '甲日原局酉位在' + officerSeats + '，' + witness(row) + '所藏' + row.stem + row.tenGod
            + '由本步运干新透，是正文列举的干支对应，酉官是否为用仍待核' : '',
        row.namedExample === 'ren-wu-ji'
          ? '壬日，' + witness(row) + '藏己正官由本步运干新透，与徐注所举的午中引己对应' : '',
      ])];
    }) : []),
    ...list(p.rootWitnesses).flatMap(row => chinese(row.stem) && positions(row.stemPositions) ? [
      row.stem + '出现在' + positions(row.stemPositions) + '，按已声明的同五行藏气口径核根位：'
      + (list(row.roots).map(root => witness(root) ? witness(root)
        + (root.exactStem === true ? '藏同一干' : '仅藏同五行异干')
        + (chinese(root.sourceRole) ? '（本章称' + root.sourceRole + '）' : '') : '').filter(Boolean).join('、') || '已知柱位暂未见')
      + '；根位不代表旺衰强度或实际取用',
    ] : []),
    ...(verifiedPairs ? list(p.crossLayerRoots).flatMap(row => witness(row) && chinese(row.stem) ? [
      stemPosition(row.stemPosition) + row.stem + '以' + witness(row)
      + (row.exact === true ? '所藏同干为根位' : '为本章列举的甲根位，支内藏乙')
      + (chinese(row.role) ? '（' + row.role + '）' : ''),
    ] : []) : []),
    ...(reviewedRoots ? list(reviewedRoots.columns).flatMap(column => [column.natalStemInLuck, column.luckStemInNatal]
      .filter(row => row?.exact === false && row.namedJiaRoot === false && witness(row) && smthStem(row.stem))
      .map(row => stemPosition(row.stemPosition) + row.stem + '查' + witness(row) + '，'
        + (list(row.sameElementStems).length ? '只见同五行异干' + list(row.sameElementStems).join('、') : '未见同五行藏干'))) : []),
    ...(reviewedRoots ? list(reviewedRoots.luckHiddenExposures).flatMap(row => smthStem(row.stem)
      ? ['运支藏' + row.stem + '，' + (positions(row.natalStemPositions) ? '本命天干见于' + positions(row.natalStemPositions) : '本命四干未见')
        + (row.alreadyInLuckStem === true ? '，也见于运干' : '')] : []) : []),
    ...(verifiedPairs ? list(p.haiRoles).flatMap(row => {
      if (!witness(row)) return [];
      const ren = list(row.renPositions).map(stemPosition).join('、'), jia = list(row.jiaPositions).map(stemPosition).join('、');
      return [witness(row) + '逐干核对' + [ren && '壬在' + ren + '，为壬禄根', jia && '甲在' + jia + '，为甲长生根']
        .filter(Boolean).join('。') + (ren && jia ? '。两干并见，实际是否兼用仍待核' : '')];
    }) : []),
    ...(verifiedPairs ? list(p.sourceRootOrders).flatMap(row => {
      if (!row || !['寅', '辰'].includes(row.branch) || !witness(row)) return [];
      const members = list(row.members).filter(member => smthStem(member?.stem) && chinese(member.role));
      if (members.length !== 3) return [];
      const visible = members.flatMap(member => {
        const found = list(member.stemPositions).map(stemPosition).filter(Boolean).join('、');
        return found ? [member.stem + '见于' + found] : [];
      });
      const paired = members.flatMap(member => {
        const found = list(member.pairedStemPositions).map(stemPosition).filter(Boolean).join('、');
        return found ? [found + '的' + member.stem] : [];
      });
      return ['徐注列' + witness(row) + '的藏气顺序为' + members.map(member => member.stem + '（' + member.role + '）').join('、')
        + (visible.length ? '。该段实际见' + visible.join('、') : '')
        + (paired.length ? '。与该支形成实际跨层同干配对的是' + paired.join('、') : '')
        + '。次序和实际发用仍须结合全局核对'];
    }) : []),
    rootChoice ? '四柱与徐注的' + (rootChoice.example === 'four-yin' ? '四寅原图' : '施再村原图') + '相同。原局寅位见于'
      + list(rootChoice.yinSeats).map(witness).join('、') + '，所藏三干原局明透位置为'
      + list(rootChoice.visibleYinStems).map(row => row.stem + '在' + list(row.positions).map(witness).join('、')).join('，') : '',
    rootChoice?.example === 'four-yin' ? '徐注依原图四寅将甲木按从财解释' : '',
    rootChoice?.arrivingWu ? witness(rootChoice.arrivingWu) + '的午与原局诸寅相会。该段缺戌，属于徐注另列的寅午会后取丙火的对照，实际会化待核' : '',
    rootChoice?.example === 'shi-zai-cun' ? '原局寅午戌俱在，实位为'
      + natalFireMembers.map(row => row.branch + '在' + list(row.positions).map(witness).join('、')).join('，')
      + '。徐注在这个原图以丙火从财，三干明透按用神与相神的关系读' : '',
    kang ? '四柱与徐注康有为原图相同。原局见' + list(kang.natalWu).map(sourceHidden).join('、') : '',
    kang?.jiExposure ? witness(kang.jiExposure) + '的己正官在本步由运干新透，同见原局' + witness(kang.natalKiller)
      + '透戊七杀。运己各有克' + list(kang.jiControls).map(sourceHidden).join('、') + '的方向，实际制刃待核' : '',
    ...list(kang?.wuClashes).map(pair => '康例午运的六冲见于' + list(pair.members).map(witness).join('与')),
    ...list(kang?.maoWeiMeetings).map(meeting => '康例' + witness(meeting.luck) + '的未与' + witness(meeting.natal)
      + '的卯相会，' + (list(meeting.missingBranches).length ? '该段缺' + meeting.missingBranches.join('、') : '成员已齐') + '，实际化伤仍须核'),
    yao ? '四柱与徐注姚君原图相同。' + list(yao.food).map(sourceHidden).join('、')
      + '各有生' + sourceHidden(yao.wealth) + '的方向' : '',
    yao?.metalGroup?.completedByLuck === true ? '姚例本运巳补齐原局的酉、丑，运支藏' + chinese(yao.siWealth?.stem)
      + chinese(yao.siWealth?.tenGod) + '，实际成化待核' : '',
    ...list(yao?.maoWeiMeetings).map(meeting => '姚例' + witness(meeting.luck) + '的卯与'
      + witness(meeting.natal) + '的未相会'),
    yao?.maoSeal ? '姚例运卯藏' + chinese(yao.maoSeal.stem) + chinese(yao.maoSeal.tenGod) + '，有克'
      + list(yao.maoControls).map(sourceHidden).join('、') + '的方向，实际发用待核' : '',
    ...list(yao?.maoClashes).map(pair => '姚例同运另有六冲，实际柱位为' + list(pair.members).map(witness).join('与')),
    ...list(p.luckPairs).flatMap(row => chinese(row.kind) && list(row.members).every(witness)
      ? [row.members.map(witness).join('与') + '有' + row.kind + '的位置关系，不直接判成化、冲去或救应成功'] : []),
    renHai && p.yinLuckJoinsMonthHai === true ? '寅运实际六合本命月亥，为评注所列的候选关系' : '',
    ...(renHai ? list(p.sealReturnPairs).flatMap(row => list(row.members).every(witness)
      ? ['同一步运见对应回冲，' + row.members.map(witness).join('与') + '六冲，实际能否阻止变格仍须核对'] : []) : []),
    renHai && p.luckBranch === '未' && p.woodCompletedByLuck === true
      ? '原局已有月亥与卯，本步未运补齐亥卯未，是正文的会局候选' : '',
    renHaiOfficer?.monthLu && witness(renHaiOfficer.monthLu) ? sentences([
      witness(renHaiOfficer.monthLu) + '藏壬，为壬禄位。已核原局己正官透在' + list(renHaiOfficer.jiOfficers).map(witness).filter(Boolean).join('、'),
      ...list(renHaiOfficer.officerRoots).flatMap(row => witness(row)
        ? [witness(row) + (row.mainQi === true ? '以己为本气' : '藏有己') + '，是同干己官根位'] : []),
      ...list(renHaiOfficer.woodContacts).flatMap(row => witness(row) && ['甲', '乙'].includes(row.stem) && chinese(row.tenGod)
        ? [witness(row) + '在该路会合见位中藏' + row.stem + row.tenGod + '，五行方向为' + row.stem + '木克己土'] : []),
      p.renHaiOfficerRoute === 'wei-incomplete' ? '该段亥未见位而缺卯，未中己的根位和乙伤官藏气分别留证' : '',
      p.renHaiOfficerRoute === 'wei-native-complete' ? '该段原局已具亥卯未，未运为同支复现' : '',
      '同干根位和藏气克向仅为同段盘面条件，取己官为用及会合后能否化伤仍须核对',
    ]) : '',
    ...(p.confirmed === true ? list(p.sourceTwoBranchMeetings).flatMap(row => {
      if (!row?.natal || !row?.luck || !witness(row.natal) || !witness(row.luck) || !chinese(row.group)) return [];
      const missing = list(row.missingBranches).filter(chinese).join('、');
      return [sentences([
        witness(row.natal) + '与' + witness(row.luck) + '构成原文两支会位',
        missing ? row.group + '组目前缺' + missing : Array.isArray(row.missingBranches) ? row.group + '组成员齐备' : '',
        row.luckAddsBranch === false ? '运支在原局也已出现，此处记录本命和当前大运间的会位' : '',
        row.group === '寅午戌' && ['较重', '次之', '较缓'].includes(row.sourceFireWeight)
          ? '正文所举午会火的柱位比较中，此午在' + layers[row.natal.position] + '，属于' + row.sourceFireWeight + '的位置' : '',
        ...list(row.fireControlTargets).flatMap(target => {
          if (!target || !witness(target) || !['辛', '庚'].includes(target.stem) || !['正官', '七杀'].includes(target.tenGod)) return [];
          const roots = list(target.rootSeats).map(witness).filter(Boolean).join('、');
          return roots ? ['按评注的甲日示例，' + witness(row.natal) + '藏丁火，此会位对应透在'
            + witness(target) + '的' + target.stem + target.tenGod + '，原局的具名支位在'
            + roots + '。午和透干分居两柱，此处保留丁火克' + target.stem + '的方向'] : [];
        }),
      ])];
    }) : []),
    ...list(p.groupWitnesses).flatMap(row => chinese(row.kind) && chinese(row.values) ? [sentences([
      '核' + row.values + row.kind + '成员：' + list(row.members).map(member => chinese(member.branch) ? member.branch + '在'
        + ([positions(member.natalPositions), member.luckPresent === true ? '本步大运' : ''].filter(Boolean).join('、') || '已知柱位未见') : '').filter(Boolean).join('；'),
      row.complete === true ? '成员齐全，仍不等于已合化'
        : row.complete === false ? '成员未齐，缺' + list(row.missingBranches).filter(chinese).join('、') + '，不能写成完整会局'
          : '全局成员是否齐全仍未知',
      row.nativeComplete === true ? '这些支在原局已经齐全，不能说本运才补齐' : '',
      row.completedByLuck === true ? '本运补齐了原局缺少的成员，仅证明位置齐备' : '',
    ])] : []),
    p.stageStart && p.stageEnd ? '本步大运完整区间为' + at(p.stageStart) + '至' + at(p.stageEnd) + '，截止不计入' : '',
    '该区间只表示结构的计算背景；原文五年作用的具体起止尚未核定，不擅分前后五年，也不把五年效用扩成十年',
    '沈氏并用与徐氏藏气次序评注分别保留，藏干顺序不换算强弱分数；格局、喜忌、成化、回冲救应仍须另核',
  ]);
}

function smthMajorLuckNaYinDescription(review) {
  if (!review) return [];
  const year = smthPillar(review.yearPillar), luck = smthPillar(review.luckPillar);
  if (!year || !luck || !chinese(review.yearNaYin) || !chinese(review.luckNaYin)) return [];
  const cardinal = /^(东|南|西|北)$/u.test(review.cardinalDirection) ? review.cardinalDirection + '方' : '';
  const expected = /^(东|南|西|北|西南)$/u.test(review.expectedDirection) ? review.expectedDirection + '方' : '';
  if (!cardinal || !expected || review.luckBranch !== luck[1]) return [];
  const relation = {
    同五行: '年命与运柱纳音同类',
    前生后: '年命纳音生运柱纳音，属命气外泄的方向',
    前克后: '年命纳音克运柱纳音，符合卷二财运的生克方向',
    后克前: '运柱纳音克年命纳音，属年命受克的方向',
    后生前: '运柱纳音生年命纳音',
  }[review.relation];
  return [
    '按〈论大运〉，本命年柱' + year + '纳音为' + review.yearNaYin + '，当步' + luck + '运柱纳音为' + review.luckNaYin,
    '运支' + review.luckBranch + '按四方三支属' + cardinal
      + (review.inSouthwest === true ? '，按二十四山也在西南坤位' : ''),
    review.directionMatches === true ? '实运与年命纳音所取的' + expected + '相合'
      : review.directionMatches === false ? '年命纳音取' + expected + '，本步未见该方位条件' : '',
    relation ? relation + '，原局根基与实际生克轻重仍待核' : '',
  ];
}

const smthMajorLuckPolarityOutcomes = new Map([
  ['yang-into-yin', '原局阳支多、当步运支在阴组，符合原文所说乘阴气的条件。原文在两组对照中称这一向较迟，实际时间待核'],
  ['yin-into-yang', '原局阴支多、当步运支在阳组，符合原文所说乘阳气的条件。原文在两组对照中称这一向较快，实际时间待核'],
  ['same-half', '当步运支与原局较多的一组相同，本段未见这一项阴阳互补结构'],
  ['even', '本命四支两组各占两位，本段没有原文所述的阴多或阳多前提'],
]);

function smthMajorLuckPolarityDescription(review) {
  if (!review || !/^[子丑寅卯辰巳午未申酉戌亥]$/u.test(review.luckBranch)) return [];
  const yang = list(review.yangPositions).map(smthSourcePosition).filter(Boolean);
  const yin = list(review.yinPositions).map(smthSourcePosition).filter(Boolean);
  if (yang.length + yin.length !== 4) return [];
  const outcome = smthMajorLuckPolarityOutcomes.get(review.condition);
  if (!outcome || !['yang', 'yin'].includes(review.luckHalf)) return [];
  return [
    '按〈论大运〉本段的地支分组，原局阳组' + yang.length + '位' + (yang.length ? '在' + yang.join('、') : '')
      + '，阴组' + yin.length + '位' + (yin.length ? '在' + yin.join('、') : ''),
    '当步运支' + review.luckBranch + '在' + (review.luckHalf === 'yang' ? '子至巳阳组' : '午至亥阴组'),
    outcome,
  ];
}

function smthWaterNaYinLuckDescription(review) {
  if (!review) return [];
  const year = smthPillar(review.yearPillar), luck = smthPillar(review.luckPillar);
  if (!year || !luck || !chinese(review.yearNaYin) || !chinese(review.luckNaYin)) return [];
  const natalNotes = rows => list(rows).flatMap(row => {
    const label = smthSourcePosition(row?.position), pillar = smthPillar(row?.pillar);
    return label && pillar && chinese(row.naYin) ? [label + pillar + '纳音为' + row.naYin] : [];
  }).join('、');
  const natalMatches = natalNotes(review.matchingNaYin);
  const positions = rows => list(rows).map(smthSourcePosition).filter(Boolean).join('、');
  const stems = positions(review.stemPositions), branches = positions(review.branchPositions);
  const chain = ({
    'fire-earth-water': '运柱纳音火生原局纳音土，原局土再克年命水，符合〈论大运〉财化为鬼的结构条件',
    'earth-metal-water': '运柱纳音土生原局纳音金，原局金再生年命水，符合〈论大运〉化鬼为助气的结构条件',
  })[review.chain];
  const fire = review.fireBranchReview, water = review.waterLuckReview;
  const fireMembers = list(fire?.natalMembers).filter(row => /^[寅午戌]$/u.test(row?.branch));
  const memberPlaces = fireMembers.flatMap(row => {
    const found = positions(row.positions);
    return found ? [row.branch + '在' + found] : [];
  });
  const missing = fireMembers.filter(row => !positions(row.positions)).map(row => row.branch).join('、');
  const fireBases = list(fire?.candidateBases);
  const natalFire = natalNotes(water?.natalFire), natalMetal = natalNotes(water?.natalMetal);
  return [
    '按卷二水命例，年柱' + year + '纳音为' + review.yearNaYin + '，当步大运' + luck + '纳音为' + review.luckNaYin,
    natalMatches && chain ? natalMatches + '。' + chain + '，根基与实际作用待核' : '',
    /^[土金]$/u.test(review.required) && !natalMatches ? '已核四柱纳音未见所需的' + review.required + '，这条纳音生克链缺少中间柱' : '',
    stems ? '按天干另见' + stems + '属' + review.required : '',
    branches ? '按地支五行另见' + branches + '属' + review.required : '',
    /^[寅午戌]$/u.test(fire?.luckBranch) && fireMembers.length === 3
      ? '当步运支' + fire.luckBranch + '在寅午戌之内'
        + (memberPlaces.length ? '，原局' + memberPlaces.join('、') : '')
        + (missing ? '，原局尚缺' + missing : '') : '',
    fireBases.includes('natal-fire-branches') ? '本命寅午戌三支齐备，属水命行寅午戌的原局地支候选' : '',
    fireBases.includes('natal-fire-nayin') ? natalNotes(fire.natalFire) + '，属水命行寅午戌的原局纳音火候选' : '',
    water?.candidate === true && natalFire && natalMetal
      ? natalMetal + '、' + natalFire + '。原局纳音金火同见，当步大运纳音水，属〈论大运〉所列分擘其福的结构条件，实际作用待核' : '',
    water?.candidate === false && (natalFire || natalMetal)
      ? '当步大运纳音水。原局有' + (natalMetal ? '纳音金' : '纳音火') + '，原局金火同见尚缺' + (natalMetal ? '火' : '金') : '',
  ];
}

function smthNamedMajorLuckDescription(rows) {
  const names = {
    'ding-chou-to-ding-wei': '「将凡入圣」的定例',
    'wu-yin-to-ding-chou': '戊寅行丁丑的退神例',
    'geng-chen-and-yi-you': '庚辰乙酉的鸳鸯例',
    'jia-shen-to-bing-yin': '「力停相冲」的定例',
    'bing-xu-to-xin-mao': '丙戌行辛卯例',
    'bing-zi-to-ren-yin': '「壬入丙家」的定例',
  };
  const positions = values => list(values).map(smthSourcePosition).filter(Boolean).join('、');
  return list(rows).flatMap(row => {
    const name = names[row?.sourceCase], natal = smthPillar(row?.natalPillar), luck = smthPillar(row?.luckPillar);
    const bases = positions(row?.matchedBases);
    if (!name || !natal || !luck || !bases) return [];
    const nativeBases = positions(row.natalPillarPositions), nativeLuck = positions(row.luckPillarPositions);
    const you = positions(row.yiGengYearYouPositions);
    const contacts = list(row.contacts).filter(kind => /^(天干五合|天干四冲|六合|六冲|相刑|六破|六害)$/u.test(kind));
    const stemRelation = ({
      前生后: '本命干生运干', 后生前: '运干生本命干', 前克后: '本命干克运干', 后克前: '运干克本命干',
    })[row.stemRelation];
    return [sentences([
      bases + natal + '与当步大运' + luck + '符合〈论大运〉' + name,
      contacts.length || stemRelation ? '该对柱同时见' + [...contacts, stemRelation].filter(Boolean).join('、') : '',
      row.dingChouWeiException === true && nativeLuck
        ? '原局另有' + nativeLuck + '丁未，本命已有丁丑和丁未，原文将此列为例外' : '',
      row.sourceCase === 'geng-chen-and-yi-you' && (nativeBases !== bases || nativeLuck)
        ? '原局另查' + natal + '见于' + nativeBases + (nativeLuck ? '，' + luck + '见于' + nativeLuck : '') + '，原文叠见的具体口径待核' : '',
      you ? '本命属乙年或庚年，酉支见于' + you + '，原文对此另有条件待核' : '',
      '这里只记录原例结构，原局取用及实际作用待核',
    ])];
  });
}

function smthFoundationDescription(p) {
  if (p.confirmed !== true || p.foundationProfile !== 'smth-volume2-natal-foundation-luck-v6' || !p.foundation) return [];
  const f = p.foundation;
  const duty = f.monthDuty?.profile === 'smth-volume-two-month-duty-elapsed-jie-v1' ? f.monthDuty : undefined;
  const branchRelation = { 同五行: '同五行', 前生后: '本命支生运支', 前克后: '本命支克运支', 后克前: '运支克本命支', 后生前: '运支生本命支' };
  return [
    ...list(f.columns).flatMap(row => layers[row.position] && chinese(row.pillar) ? [
      '本命' + layers[row.position] + row.pillar + '的天干属' + chinese(row.stemElement) + '，地支属' + chinese(row.branchElement)
      + '，通常支藏为' + list(row.hiddenStems).filter(chinese).join('、') + '，日干临该支为' + chinese(row.dayStemPhase),
    ] : []),
    '本命月支' + chinese(f.monthBranch) + '按卷二月序为' + list(f.season).map(row => chinese(row.element) + chinese(row.power)).join('、'),
    duty ? '出生落在' + chinese(duty.startTerm) + '交节后的第' + duty.elapsedDay + '日'
      + (chinese(duty.slot?.label) ? '，按人元司事首表的二十四小时分日候选为' + duty.slot.label
        : duty.outsidePrintedDays ? '，首表三十日已满，此时尚未交下个节' : '') : '',
    duty && list(duty.jadeWell).length ? '《玉井》同月另载' + list(duty.jadeWell)
      .map(row => chinese(row.label) + row.printedDays + '日').join('、') + '，作为另一取法对照' : '',
    '日干根位' + (list(f.rootPositions).map(row => layers[row.position] + chinese(row.pillar)
      + (row.sameStem === true ? '藏同干' : '藏同五行异干')).join('、') || '于核验四柱中暂未见'),
    '本步运支属' + chinese(f.luckBranchElement) + '，通常支藏为' + list(f.luckHiddenStems).filter(chinese).join('、')
      + '，日干临运支为' + chinese(f.luckPhase),
    ...list(f.branchComparisons).flatMap(row => layers[row.position] && branchRelation[row.relation] ? [
      '运支对本命' + layers[row.position] + '为' + [branchRelation[row.relation], ...list(row.contacts).filter(chinese)].join('、'),
    ] : []),
    ...smthMajorLuckNaYinDescription(f.majorLuckNaYin),
    ...smthMajorLuckPolarityDescription(f.majorLuckPolarity),
    ...smthWaterNaYinLuckDescription(f.waterNaYinLuck),
    ...smthNamedMajorLuckDescription(f.namedMajorExamples),
    '月序、日干十二宫和支根分别记录。格局、根基厚薄、实际相协及原书司事起算口径仍待核',
  ];
}

function bodyLimitDescription(p) {
  if (p.profile !== 'quanshu-body-life-limits-atomic-v1' || p.ready !== true) return '';
  const words = { 守: '同宫', 冲: '相对', 三合: '在三合位置', 邻宫: '相邻', 其他: '不在同宫、对宫、三合或邻宫范围' };
  const geometry = row => sentences([
    words[row?.focusRelation] ? '与本限焦点' + words[row.focusRelation] : '',
    words[row?.lifeRelation] ? '与本命命宫' + words[row.lifeRelation] : '',
    words[row?.bodyRelation] ? '与本命身宫' + words[row.bodyRelation] : '',
  ]);
  return sentences([
    '本条独立核本命身宫、命宫和同一片段的太岁及大小限，不拼不同候选或年份',
    number(p.birthMonth) !== undefined && chinese(p.birthHour) ? '从寅起正月顺至生月' + p.birthMonth
      + '月，再由该宫起子时顺至生时' + p.birthHour + '安身、逆至该时安命，已核归档唯一身宫标记及两项支位' : '',
    chinese(p.bodyBranch) && chinese(p.lifeBranch) ? '本命命宫在' + p.lifeBranch + '，身宫在' + p.bodyBranch
      + '，身宫对应本命' + chinese(p.bodyNatalName) : '',
    p.bodyLifeSame === true ? '身命同宫只是一处结构，不重复计成两份证据' : p.bodyLifeSame === false ? '身宫和命宫分列，不互相替代' : '',
    scopes[p.scope] && chinese(p.branch) ? '本段以' + scopes[p.scope] + '命宫为焦点，在' + p.branch + '，对应本命' + chinese(p.natalName) : '',
    '焦点归档主星为' + (list(p.focusMainStars).filter(chinese).join('、') || '未见十四主星'),
    '本命命宫归档主星为' + (list(p.lifeMainStars).filter(chinese).join('、') || '未见十四主星'),
    '本命身宫归档主星为' + (list(p.bodyMainStars).filter(chinese).join('、') || '未见十四主星') + '；未见主星不等于没有辅助或救应',
    ...list(p.layerContacts).flatMap(row => scopes[row.scope] && chinese(row.branch) ? [sentences([
      scopes[row.scope] + '命宫在' + row.branch + '，对应本命' + chinese(row.natalName), geometry(row),
      words[row.qishaRelation] ? '与归档七杀' + words[row.qishaRelation] : '',
    ])] : []),
    typeof p.decadalMinorSamePalace === 'boolean' ? '本片段大限与小限' + (p.decadalMinorSamePalace ? '同宫' : '不同宫')
      + '；这不自动裁定原文合身命或符会的含义，不能把不同宫预先排除为不成立' : '另一限层未知，不能补成二限同到',
    chinese(p.qishaBranch) ? '归档七杀在' + p.qishaBranch + (chinese(p.qishaGrade) ? '，卷三明列表记为' + p.qishaGrade : '，该格等级未列')
      + '；' + geometry(p.qishaRelations) : '',
    '卷三七杀表另记无陷，问答段却有陷地之说，分别保留；不借此表抹去原段反向条件',
    ...list(p.shaPositions).flatMap(row => chinese(row.star) && chinese(row.branch) ? [row.star + '在' + row.branch + '，'
      + (row.coordinateBasis === 'source' ? '按来源禄羊陀诀定位' : '仅按兼容引擎生时法核归档产品坐标，火铃原法生时取法仍未知') + '；' + geometry(row)] : []),
    ...[['lifeCandidateShaPresent', '命宫'], ['bodyCandidateShaPresent', '身宫']].map(([key, label]) => p[key] === true
      ? '本命' + label + '在上述四曜候选中见同宫成员'
      : p[key] === false ? '本命' + label + '在上述已核产品候选四曜中未见同宫成员，不代表原文全部杀曜已排除'
        : '本命' + label + '的四曜候选位置未齐，未见不当作没有'),
    p.tianxingReady === true && chinese(p.tianxingBranch) ? '本命天刑按生月独立重算并核唯一归档，在' + p.tianxingBranch + '；' + geometry(p.tianxingRelations)
      : '天刑的来源位置未核，不借其他刑曜或采样星位补齐',
    '天刑只是原文刑的一个明确位置见证，擎羊也不自动成为该段刃的唯一解释；刑忌刃的指代和会侵范围仍须逐条核',
    ...list(p.transformations).flatMap(row => chinese(row.star) && chinese(row.kind) ? [sentences([
      row.layer === 'natal' ? '按来源生年干' + chinese(row.stem) + '的本命' + row.star + '化' + row.kind
        : '将来源生年表延用本年干' + chinese(row.stem) + '所得候选' + row.star + '化' + row.kind + '；年度发化规则尚未同源核实，不能当作已核流年忌',
      row.placed === true && chinese(row.branch) ? '受化星在' + row.branch + '；' + geometry(row) : '受化星归档位置不唯一，关系保持未知',
    ])] : []),
    ...list(p.rescuePositions).flatMap(row => chinese(row.star) && chinese(row.branch) ? [row.star + '在' + row.branch + '；' + geometry(row)
      + '；这只是原文救应星的位置，不是救应已生效'] : []),
    '本命、流年候选发化与限宫接触分别列明，原文无功与可解属于不同语境，不合成统一救应规则；不据古文判断疾病、刑罚、死亡或用户品性',
  ]);
}

function yearAndLimitsDescription(p) {
  if (p.profile !== 'quanshu-v3-year-and-limits-v1') return '';
  const labels = { decadal: '大限', minor: '小限', yearly: '太岁' };
  const relationships = { 守: '同宫', 冲: '对冲', 三合: '三合', 其他: '没有同宫、对冲或三合' };
  const starNameList = values => list(values).filter(chinese).join('、');
  const starDetails = rows => list(rows).flatMap(row => chinese(row.star) ? [row.star
    + (chinese(row.grade) ? '（原书列' + row.grade + '）' : '')] : []).join('、');
  const oppositions = list(p.annualOppositions).map(layer => labels[layer]).filter(Boolean);
  const limitContact = [p.reviewedLimitContact, p.annualFlowOppositionCandidate, p.threeLayerTrineCandidate].includes(true);
  return sentences([
    number(p.lunarYear) !== undefined && chinese(p.lifeBranch) && chinese(p.annualBranch) ? '农历' + p.lunarYear
      + '年此段太岁在' + p.annualBranch + '宫，本命命宫在' + p.lifeBranch + '宫' : '',
    ...(limitContact ? [
      ...list(p.guards).flatMap(row => labels[row.layer] && chinese(row.branch) && chinese(row.natalName) ? [
        labels[row.layer] + '独守' + row.branch + '宫，对应本命' + row.natalName + '宫。已核同宫星曜为'
        + (starDetails(row.stars) || '暂未见本条所核星曜')
        + (starNameList(row.supportGuards) ? '。其中实守助曜有' + starNameList(row.supportGuards) : '')
        + (starNameList(row.adverseGuards) ? '。实守煞曜有' + starNameList(row.adverseGuards) : ''),
      ] : []),
      ...list(p.pairs).flatMap(row => labels[row.first] && labels[row.second] && relationships[row.relation]
        ? [labels[row.first] + '与' + labels[row.second] + relationships[row.relation]] : []),
      oppositions.length ? '太岁实际对冲' + oppositions.join('和') : '',
      ...list(p.annualNamedStarContacts).flatMap(row => chinese(row.star) && chinese(row.branch) && relationships[row.relation]
        ? ['太岁与本命' + row.branch + '宫' + row.star + relationships[row.relation]] : []),
      ...list(p.annualFlowContacts).flatMap(row => p.annualFlowOppositionCandidate === true && ['擎羊', '陀罗'].includes(row.star)
        && chinese(row.branch) && row.relation === '冲' ? ['太岁实冲按当年干核位的' + row.branch + '宫流年' + row.star] : []),
      p.threeLayerTrineCandidate === true ? '太岁、大限和小限实居三个不同宫位，三组宫对均为三合' : '',
      p.fallenWithAdverseAtAllThree === true ? '三层各自的承载宫均查得陷地主星与具名实守煞曜。三层独守的综合作用仍待核' : '',
      '独守、两两相逢和对冲分别观察。原文的轻重及扶救仍须合参',
    ] : []),
    p.annualOppositionProfile === 'quanshu-nanyangtang-verified-limit-opposition-v1'
      && p.annualDoubleVerifiedOppositionCandidate === true && p.sourceMinor?.verified === true && chinese(p.sourceMinor.branch)
      ? '太岁同段实冲大限及明刊复算的小限。两限同在' + p.sourceMinor.branch + '宫' : '',
    ...list(p.threeLayerFallenShangShiWitnesses).flatMap(row => labels[row.scope] && chinese(row.branch)
      && starNameList(row.fallenStars) && starNameList(row.shaStars)
      ? [labels[row.scope] + row.branch + '宫实守陷曜' + starNameList(row.fallenStars) + '，并见' + starNameList(row.shaStars)] : []),
    p.annualAtLife === true ? '太岁实临本命命宫。逐宫核三方与对照' : '',
    ...list(p.lifeArea).flatMap(row => chinese(row.branch) && chinese(row.natalName) && relationships[row.relation] ? [
      '本命' + row.natalName + '宫在' + row.branch + '，与命宫' + relationships[row.relation] + '。已核星曜为'
      + (starDetails(row.stars) || '暂未见本条所核星曜')
      + (starNameList(row.supportPositions) ? '。支持位置见' + starNameList(row.supportPositions) : '')
      + (starNameList(row.adversePositions) ? '。受扰位置见' + starNameList(row.adversePositions) : ''),
    ] : []),
    p.guiLifeZiExample === true ? '此段也符合原章所举癸生人太岁和命宫同在子宫的盘面例' : '',
  ]);
}

function quanshuLeapBirthDescription(p) {
  return p.birthMonthBasis === 'quanshu-leap-next-month' && number(p.birthLeapMonth) !== undefined
    && number(p.birthMonth) === p.birthLeapMonth + 1
    ? '原生月为闰' + p.birthLeapMonth + '月，归档身命与卷二按后一月安身命相合，斗君暂用' + p.birthMonth + '月作生月候选' : '';
}

function quanshuYearDescription(p, at) {
  const profiles = { 'quanshu-doujun-birth-month-hour-v1': '斗君', 'quanshu-kuxu-birth-year-v1': '天哭天虚',
    'quanshu-shangshi-native-palaces-v1': '天伤天使' };
  if (!profiles[p.profile]) return '';
  return sentences([
    '本条独立核《全书》' + profiles[p.profile] + '，本命、太岁及大小限均属于同一候选与共同有效年段',
    number(p.lunarYear) !== undefined ? '农历年为' + p.lunarYear : '',
    scopes[p.scope] && chinese(p.branch) ? scopes[p.scope] + '命宫在' + p.branch + '，对应本命' + chinese(p.natalName) : '',
    ...[['annualBranch', '太岁'], ['decadalBranch', '大限'], ['minorBranch', '小限']].map(([key, label]) =>
      chinese(p[key]) ? label + '命宫在' + p[key] : label + '位置未提供，不能据此补成三层俱临'),
    p.allThreeSamePalace === true ? '太岁与大小限三层确实同宫；吉星众及扶救作用仍未据此成立'
      : p.allThreeSamePalace === false ? '太岁与大小限三层未全部同宫' : '',
    ...list(p.positions).flatMap(row => chinese(row.star) && chinese(row.branch) && chinese(row.relation)
      ? [row.star + '独立重算并核归档唯一位置在' + row.branch + '，与当前宫位为' + row.relation] : []),
    p.profile === 'quanshu-kuxu-birth-year-v1' ? sentences([
      chinese(p.birthYearBranch) ? '哭虚只按生年支' + p.birthYearBranch + '从午逆顺安星，不用当前年支改写本命星位' : '',
      typeof p.exceptionSeat === 'boolean' ? '当前宫位' + (p.exceptionSeat ? '属于' : '不属于') + '本段列出的丑卯申例外支位；未列不自动判为陷地' : '',
      chinese(p.natalLuBranch) ? '本命禄存在' + p.natalLuBranch + '，与当前宫位为' + chinese(p.natalLuRelation) : '',
      chinese(p.annualLuBranch) ? '按本年干核的年度禄存在' + p.annualLuBranch + '，与当前宫位为' + chinese(p.annualLuRelation) : '',
      chinese(p.mourningBranch) ? '按四飞星诀，本年丧门在' + p.mourningBranch + '，与当前宫位为' + chinese(p.mourningRelation) : '',
      '原文遇禄的发化或禄存盘层、哭虚是否须共临，以及天哭丧门的遇会范围仍未定；各自几何位置不等于已构成灾害或已获救应',
    ]) : '',
    p.profile === 'quanshu-doujun-birth-month-hour-v1' ? sentences([
      quanshuLeapBirthDescription(p),
      number(p.birthMonth) !== undefined && chinese(p.birthHour) ? '从本年太岁宫起正月，逆数至生月' + p.birthMonth
        + '月停于' + chinese(p.birthMonthStop) + '，再起子时顺数至生时' + p.birthHour : '',
      chinese(p.doujunBranch) ? '所得斗君在' + p.doujunBranch + '，对应本命' + chinese(p.doujunNatalName) + '，不是直接拿普通流月命宫替代' : '',
      p.yearStart && p.yearEnd ? '该农历年从' + at(p.yearStart) + '至' + at(p.yearEnd) + '，截止不计入' : '',
      p.queryIncludesNewYear === true ? '该年正月初一在查询窗内，年段背景不等于这一天必有事件'
        : p.queryIncludesNewYear === false ? '该年正月初一在查询窗之前，此处只承接年段背景，不冒充本窗新触发' : '',
      Array.isArray(p.archivedStars) ? '斗君所在宫的归档星曜为' + (p.archivedStars.filter(chinese).join('、') || '未记录') + '；归档星名不自动完成本来源的吉凶分类' : '',
      ...list(p.sourceQualities).flatMap(row => chinese(row.star) && chinese(row.grade) ? [row.star + '在本宫按来源明列表为' + row.grade] : []),
      ...list(p.monthTimeline).flatMap(row => row && number(row.lunarMonth) !== undefined
        ? ['农历' + (row.leap ? '闰' : '') + row.lunarMonth + '月的窗内片段' + at(row.startInstant) + '至' + at(row.endInstantExclusive)
          + (row.ready === true && chinese(row.branch) ? '，斗君顺推至' + row.branch + '宫，对应本命' + chinese(row.natalName) : '，本段月限取法未核定')] : []),
      '太岁二限较美、斗君逢吉凶和对应月段的实际取义仍待核定',
    ]) : '',
    p.profile === 'quanshu-shangshi-native-palaces-v1' ? sentences([
      '天伤取来源明指的奴仆宫，对应归档仆役；天使取疾厄宫，均与归档唯一星位核验',
      p.majorPositionsVerified === true ? '十四主星均核归档唯一位置，本限本宫主星为'
        + (list(p.localMajorStars).filter(chinese).join('、') || '未见主星') : '归档十四主星位置未齐，不能据此断定无正曜',
      Array.isArray(p.archivedLocalStars) ? '本宫归档星曜为' + (p.archivedLocalStars.filter(chinese).join('、') || '未记录') : '',
      Array.isArray(p.archivedOppositeStars) ? '对宫归档星曜为' + (p.archivedOppositeStars.filter(chinese).join('、') || '未记录') : '',
      '众吉、无正曜又值羊火巨机及各自会照是不同条件；归档火星不自动补成同书安火口诀，未知不当作没有吉援，不据古文推断疾病、刑罚或死亡',
    ]) : '',
  ]);
}

function quanshuVerseDescription(p) {
  if (p.verseProfile !== 'quanshu-sun-wuqu-pojun-verse-v1') return '';
  if (p.verseReady !== true) return '太阳、武曲与破军诗诀的来源共同依据未齐，不当作已排除相关条件';
  return sentences([
    '以下诗诀背景在同一本命候选与实际岁限共同片段内核算；当前一限及另一限分别留位，不预设两限必须同时到同一颗星',
    scopes[p.verseOtherScope] ? '另一层为' + scopes[p.verseOtherScope] + '，所在支为'
      + (chinese(p.verseOtherBranch) || '未提供，不当作未到') : '',
    ...list(p.verseSubjects).flatMap(row => chinese(row.star) && chinese(row.branch) ? [sentences([
      row.star + '在本命' + chinese(row.natalName) + '宫的' + row.branch + '支',
      '卷二本星逐宫段等级为' + (chinese(row.verseGrade) || '此格未列，不套卷三或引擎补齐'),
      '卷三汇总表另为' + (chinese(row.summaryGrade) || '此格未列'),
      typeof row.gradeAgreement === 'boolean' ? '两个段落的明列用字' + (row.gradeAgreement ? '相同' : '不同，保留差别，不擅合并等级') : '',
      chinese(row.solarPhase) ? '卷一玉蟾段该太阳支位称' + row.solarPhase + '；仅为具名位置，不等于歌诀暗度已经释定' : row.star === '太阳' ? '卷一玉蟾段未列该支的日行阶段，不补造' : '',
      '当前限宫与该星为' + (chinese(row.focusRelation) || '未知') + '；另一限与该星为' + (chinese(row.otherRelation) || '未知')
        + '；太岁与该星为' + (chinese(row.annualRelation) || '未知'),
      ...list(row.auxiliaryRelations).flatMap(v => chinese(v.star) && chinese(v.branch) && chinese(v.relation)
        ? [v.star + '在' + v.branch + '，相对本星为' + v.relation] : []),
      ...list(row.fourShaRelations).flatMap(v => chinese(v.star) && chinese(v.branch) && chinese(v.relation)
        ? [v.star + (v.coordinateBasis === 'source_calculated' ? '按源诀定位' : '仅按产品生时法定位')
          + '在' + v.branch + '，相对本星为' + v.relation] : []),
      ...list(row.natalTransformations).flatMap(v => chinese(v.star) && chinese(v.kind)
        ? ['本命生年表的' + v.star + '化' + v.kind + (chinese(v.branch) && chinese(v.relation)
          ? '在' + v.branch + '，相对本星为' + v.relation : '位置未知，不当作没有')] : []),
    ])] : []),
    '入庙不以旺、得地或和平替代；文昌临左右不擅定为夹宫或辅弼齐到，魁钺仍按源无序支位组，不给二支强行分配星名',
    '生年四化不代本段未明的限干或流年干发化；太阳夜生日生的泛论、暗度、恶杀集合、侵会范围及有效救应仍须核，不据这些位置保证婚育、财富或灾病',
  ]);
}

function fireBellDescription(p) {
  if (p.profile !== 'quanshu-firebell-anchor-archive-v1') return '';
  const flowGuard = p.scope === 'yearly' && (p.flowHorseArchiveFireCandidate === true || p.flowHorseJielanFireCandidate === true
    || p.flowHorseQuanshuFixedFireCandidate === true)
    ? flowHorseGuardDescription(p.flowHorse) : '';
  return sentences([
    quanshuVerseDescription(p),
    '分别记录《全书》南阳堂明刊取法、兼容归档坐标和《捷览》的具名生时法',
    chinese(p.birthYearBranch) && chinese(p.birthGroup) ? '出生年支为' + p.birthYearBranch + '，属于' + p.birthGroup + '组' : '',
    list(p.sourcePair).filter(chinese).length ? '录文在该组只列宫位' + p.sourcePair.filter(chinese).join('、') + '；没有在此段明确继续按生时推算的方法' : '',
    ...list(p.quanshuFixedFireBell).flatMap(row => chinese(row.star) && chinese(row.branch)
      ? ['据南阳堂明刊命图的生年组定宫，' + row.star + '在' + row.branch + '宫'] : []),
    p.quanshuFixedFireBellProfile === 'quanshu-nanyangtang-fixed-firebell-v1' && p.quanshuFixedBellAtLife === true
      && p.qingyangAtLife === true && p.annualWhiteTigerAtLife === true
      ? '按明刊取法，本命擎羊、铃星和流年四飞白虎实到同一本命命宫' : '',
    chinese(p.birthHour) ? '兼容引擎另按生时' + p.birthHour + '将命名起点顺推，已重算核验其唯一归档位置' : '',
    ...list(p.archivedFireBell).flatMap(row => chinese(row.star) && chinese(row.branch) ? ['按该产品生时法，' + row.star + '在' + row.branch] : []),
    typeof p.sourcePairEqualsArchive === 'boolean' ? '归档位置组与录文宫位组' + (p.sourcePairEqualsArchive ? '恰好相同，仍不能据巧合证明原文生时法' : '不同，不能将二者混拼') : '',
    ...list(p.jielanFireBell).flatMap((row, index) => {
      const anchor = p.jielanAnchors?.[index]?.branch;
      return chinese(row.star) && chinese(row.branch) && chinese(anchor)
        ? ['《捷览》的' + row.star + '从' + anchor + '宫起子时，顺数至生时落' + row.branch + '宫'] : [];
    }),
    p.jielanFireAtFocus === true && (p.natalHorseAtFocus === true || p.annualHorseAtFocus === true)
      ? '依《捷览》排出的火星与' + [p.natalHorseAtFocus === true ? '本命天马' : '',
        p.annualHorseAtFocus === true ? '年度天马候选' : ''].filter(Boolean).join('、') + '同在本期宫位' : '',
    p.scope === 'yearly' && p.quanshuFixedFireAtFocus === true && p.natalHorseAtFocus === true
      ? '按南阳堂明刊，火星和本命天马实守本年太岁宫' : '',
    flowGuard,
    flowGuard && p.flowHorseArchiveFireCandidate === true ? '守限流马与归档火星同宫' : '',
    flowGuard && p.flowHorseJielanFireCandidate === true ? '守限流马与《捷览》所推火星同宫' : '',
    flowGuard && p.flowHorseQuanshuFixedFireCandidate === true ? '实际守限的流马与明刊火星同宫' : '',
    flowGuard ? '流马采用兼容引擎的年度安位，原文取哪一层马及限宫仍待核' : '',
    p.jielanBellAtLife === true && p.qingyangAtLife === true && p.annualWhiteTigerAtLife === true
      ? '依《捷览》排出的铃星与本命擎羊、年度四飞白虎同到本命命宫' : '',
    scopes[p.scope] && chinese(p.branch) ? '本期' + scopes[p.scope] + '命宫在' + p.branch + '，对应本命' + chinese(p.natalName) : '',
    number(p.lunarYear) !== undefined && chinese(p.annualBranch) ? '共同片段为农历' + p.lunarYear + '年，太岁在' + p.annualBranch : '',
    Array.isArray(p.localMainStars) ? '本宫主星为' + (p.localMainStars.filter(chinese).join('、') || '未见主星') : '',
    ...list(p.sourceGradeRows).flatMap(row => chinese(row.star) ? [row.star + '在本宫的来源明列表等级为' + (chinese(row.grade) || '未列，不能套默认亮度补齐')] : []),
    ...list(p.fourShaRelations).flatMap(row => chinese(row.star) && chinese(row.branch) && chinese(row.relation) ? [
      row.star + (row.coordinateBasis === 'source_calculated' ? '按来源禄羊陀诀' : '仅按产品生时法') + '在' + row.branch
      + '，与当前宫位为' + row.relation + '，该位置的来源等级为' + (chinese(row.sourceGrade) || '未列'),
    ] : []),
    p.supportReady === true ? list(p.sourceSupportRelations).flatMap(row => ['左辅', '右弼', '文昌', '文曲', '魁钺组'].includes(row.star)
      && chinese(row.branch) && chinese(row.relation) ? [row.star + '按独立来源位置在' + row.branch + '，与当前宫位为' + row.relation] : []).join('；') : '辅弼昌曲等来源位置未齐，不能当作没有吉援',
    p.natalHorseVerified === true && chinese(p.natalHorseBranch) ? '本命天马按生年支重算并核唯一归档，在' + p.natalHorseBranch : '本命天马尚未唯一核实',
    chinese(p.annualHorseCandidateBranch) ? '将同一四组表沿用于当前年支的年度天马候选在' + p.annualHorseCandidateBranch + '；这是明示的产品年度候选，不自动确定原文流年值之指动马' : '',
    chinese(p.natalLifeBranch) ? '另核本命命宫在' + p.natalLifeBranch + '，来源擎羊' + (p.qingyangAtLife === true ? '在命' : '不在命')
      + '，产品铃星' + (p.bellArchiveAtLife === true ? '在命' : '不在命') : '',
    chinese(p.whiteTigerBranch) ? '本年白虎按四飞星诀在' + p.whiteTigerBranch + (p.annualWhiteTigerAtLife === true ? '，到本命命宫' : '，未到本命命宫') : '',
    '四煞位置、庙陷、吉曜和本命或年度马分别保留；恶杀集合、冲破会凑、喜忌和救应不由星名或数量自动判定，不据古文推断事故、疾病、刑罚或死亡',
  ]);
}

function pillarName(value) {
  if (value === 'decadal') return '大运柱';
  const [kind, layer] = text(value).split(':');
  return layers[layer] && ['natal', 'flow'].includes(kind) ? (kind === 'natal' ? '本命' : '流') + layers[layer] : '';
}

function baziBranchPositions(branches, positions) {
  return list(positions).map((members, index) => {
    const names = list(members).map(pillarName).filter(Boolean).join('、');
    return names && branches[index] ? branches[index] + '见于' + names : '';
  }).filter(Boolean).join('，');
}

function luTwistText(pair, firstLabel, secondLabel) {
  if (pair?.firstDegree !== true || !chinese(pair.first) || !chinese(pair.second)
    || ![-1, 1].includes(pair.stemStep) || pair.branchStep !== -pair.stemStep) return '';
  const stemDirection = pair.stemStep === 1 ? '顺' : '逆';
  const branchDirection = pair.branchStep === 1 ? '顺' : '逆';
  return '从' + firstLabel + pair.first + '到' + secondLabel + pair.second + '，天干' + stemDirection + '一位，地支' + branchDirection + '一位'
    + (pair.stemWrap === true ? '，跨癸甲首尾' : '') + (pair.branchWrap === true ? '，跨子亥首尾' : '');
}
function hiddenStems(values) {
  return list(values).map(item => sentences([chinese(item.stem), chinese(item.element),
    item.tenGod && chinese(item.tenGod) ? '十神为' + item.tenGod : ''])).filter(Boolean).join('、');
}
function stars(values) {
  return list(values).map(item => sentences([chinese(item.name), chinese(item.brightness),
    chinese(item.mutagen) ? '化' + item.mutagen : ''])).filter(Boolean).join('、');
}
function transformations(values) {
  return list(values).map(item => sentences([chinese(item.star), chinese(item.kind) ? '化' + item.kind : '']))
    .filter(Boolean).join('、');
}
function yunDayClockDescription(p) {
  if (p.sourceDayClock === 'agreed') return '本片段两种流日日界得到同一农历日';
  const clock = { 'civil-midnight': '午夜换日', 'zi-start': '二十三点换日' }[p.sourceDayClock];
  if (!clock) return '';
  return clock + '的流日候选。' + (p.dayMonthBasisAgreed === false
    ? '此时牵涉农历月或年交界，合用的月日口径仍待核验'
    : '这一时段只有在两种日界下都满足相同规则时才采用该匹配');
}

function yunFinanceStarDescription(rows) {
  return list(rows).flatMap(row => {
    const tabooLayers = list(row?.jiScopes).map(scope => scopes[scope]).filter(Boolean);
    return chinese(row?.star) && tabooLayers.length
      ? [row.star + '本宫同时受' + tabooLayers.join('及') + '化忌，本段暂不计入财星支持'] : [];
  });
}

function sourceTransformations(values) {
  return list(values).map(value => text(value).split(':')).map(([scope, kind, star]) => scopes[scope] && chinese(kind) && chinese(star)
    ? scopes[scope] + star + '化' + kind : '').filter(Boolean).join('、');
}
function zodiacPosition(longitude, zodiac) {
  if (number(longitude) === undefined) return '';
  const normalized = ((longitude % 360) + 360) % 360;
  return zodiac === 'tropical' ? '热带黄道' + signs[Math.floor(normalized / 30)] + degrees(normalized % 30)
    : '黄经' + degrees(normalized);
}

function lillyEssentialDescription(p, label) {
  if (!['lilly-1647-essential-source-v1', 'lilly-1647-essential-prose-v2'].includes(p?.profile) || !bodies[p.body]) return '';
  const within = (first, last) => degrees(first) && degrees(last) ? degrees(first) + '至' + degrees(last) + '（末端不计入）' : '';
  return sentences([
    label + bodies[p.body] + '的 Lilly 本质表位置单独核对',
    zodiacPosition(p.longitude, 'tropical'), bodies[p.signLord] ? '该星座本垣宫主为' + bodies[p.signLord] : '',
    p.domicile === true ? '该星位于自己的本垣星座' : '',
    p.exalted === true ? '该星位于自己的擢升星座，擢升按整座核，不要求落在表中标示的那一个度数' : '',
    p.detriment === true ? '该星同时位于自己的失势星座' : '', p.fall === true ? '该星同时位于自己的落陷星座' : '',
    bodies[p.triplicityDayLord] && bodies[p.triplicityNightLord] ? '本表三分昼主为' + bodies[p.triplicityDayLord] + '、夜主为' + bodies[p.triplicityNightLord]
      + (p.sect === 'day' ? '，本图按昼盘核' : p.sect === 'night' ? '，本图按夜盘核' : '，本图昼夜尚未提供') : '',
    p.inTriplicity === true ? '本星符合所用三分归属' : p.inTriplicity === undefined ? '三分尊贵尚未确定，不把未知当作没有' : '',
    bodies[p.termLord] && within(p.termStart, p.termEnd) ? '核定本质表在本座' + within(p.termStart, p.termEnd) + '的界主为' + bodies[p.termLord] : '',
    p.termStatus === 'source_variant' ? '此处界限或界主有版本差异，不能据参考界主确认界内尊贵' : p.inOwnTerm === true ? '本星位于自己的界内' : '',
    list(p.sourceDifferences).includes('taurus-endpoint-20-vs-26') ? '金牛后段土星界限在所核副本有二十度与二十六度差异'
      + (p.termStatus === 'prose_resolved' ? '；本次据同书土星正文第23至第26度、火星正文第27至第30度核定，原表差异仍留审查' : '，不静默修成统一表') : '',
    list(p.sourceDifferences).includes('libra-fourth-term-venus-vs-mercury') ? '天秤第四界在所核影印为金星、转录为水星'
      + (p.termStatus === 'prose_resolved' ? '；本次据同书水星正文第20至第24度核为水星，影印原格仍留审查' : '，保留差异') : '',
    list(p.sourceDifferences).includes('sagittarius-mercury-saturn-boundary-19-vs-20') ? '射手水土交界在表中为十九度，逐星正文水星至第20度、土星从第21度；本次按正文核二十度交界，原格保留' : '',
    list(p.sourceDifferences).includes('gemini-venus-twenty-first-degree-gap') ? '双子金星正文只列第15至第20度，土星从第22度，第21度与表格存在缺口，未据参考界主补成确定尊贵' : '',
    bodies[p.faceLord] && within(p.faceStart, p.faceEnd) ? '本座' + within(p.faceStart, p.faceEnd) + '的十度面主为' + bodies[p.faceLord] : '',
    p.inOwnFace === true ? '本星位于自己的十度面内' : '',
    p.hasEssentialDignity === undefined ? '本质尊贵仍有未知项，不能据此断言游离或无尊贵' : '',
    '本质表不代替偶然状态、受助受损及状态良好的综合判断，不合成为吉凶分数',
  ]);
}

function lillyApplicationDescription(application, at) {
  if (application?.profile !== 'lilly-same-chart-application-v1') return '';
  const event = {
    exact: '在离开原星座前核到精确黄经相位，时刻为' + at(application.eventAt),
    sign_exit: '精确成相前先遇到行星换座，时刻为' + at(application.eventAt),
    ordering_unresolved: '精确相位与换座在计算精度内无法确定先后',
    window_end: '向后32天的计算窗内未核到精确成相或换座',
  }[application.status];
  const station = application.applyingRetrogradeStation;
  return sentences([event,
    application.lossOfApproachAt ? '此前相位角距停止持续缩小，时刻为' + at(application.lossOfApproachAt) : '',
    bodies[station?.body] ? '初始顺行入相的' + bodies[station.body] + '在此前转逆，时刻为' + at(station.at) : '',
  ]);
}

function lillyInterpositionDescription(row, at) {
  const third = bodies[row?.thirdBody], applying = bodies[row?.applyingBody], receiving = bodies[row?.receivingBody];
  if (!third || !applying || !receiving || !aspects[row.aspectType]) return '';
  if (row.kind === 'frustration') return '较慢的' + receiving + '于' + at(row.receivingContactAt) + '先与第三星' + third
    + '精确合相，早于原来的' + applying + '与' + receiving + '合相。这是原书落空例的相位顺序';
  if (row.kind !== 'bodily_prohibition' && row.kind !== 'aspectual_prohibition') return '';
  return '第三星' + third + '于' + at(row.applyingContactAt) + '先与' + applying + '形成' + aspects[row.aspectType]
    + '，于' + at(row.receivingContactAt) + '再与' + receiving + '形成同类相位，均早于原合相。这是原书'
    + (row.kind === 'bodily_prohibition' ? '身体阻碍例' : '相位阻碍例') + '的相位顺序';
}

function lillyConditionDescription(p, label, at) {
  if (p?.profile !== 'lilly-accidental-source-v1' || !bodies[p.body]) return '';
  const phases = { closing: '当前角距误差在缩小', opening: '当前角距误差在增大', at_angle: '当前数值位于该角度', instantaneous_rate_zero: '当前误差变化率近零' };
  const solarNames = { not_applicable: '太阳自身不套燃烧判断', cazimi: '按17角分内的定义为日心', combust: '按同座8.5度内的定义为燃烧',
    under_beams: '按17度内的定义为日光下', free_of_beams: '按本定义已离日光范围', cross_sign_cazimi_unresolved: '角距在日心范围但跨星座，本段同座限制如何适用于日心仍未核' };
  return sentences([
    label + bodies[p.body] + '的偶然条件来自这一张图的同一星历时刻，与本质位置分开',
    motions[p.motion] ? '实际黄经运动为' + motions[p.motion] : p.motion === 'instantaneous_rate_zero' ? '瞬时采样速度近零，不宣称已定位原书数日停驻阶段' : '',
    p.directFortitudeApplicable === false ? '太阳与月亮的顺行按原表不另算一项助力' : '',
    number(p.speed) !== undefined && number(p.sourceMeanSpeed) !== undefined ? '实际黄经速度每日' + Number(p.speed.toFixed(6)) + '度，原书均速每日'
      + Number(p.sourceMeanSpeed.toFixed(6)) + '度；绝对运动量相对均速' + ({ faster: '较快', slower: '较慢', equal: '相同' }[p.magnitudeComparedToMean] ?? '未定')
      + '，绝对速度对照不把逆行改成顺行或自动加旺' : '',
    p.moonBelowPrintedSlowThreshold === true ? '月亮低于原书另述的每日13度10分慢月界；这是原文评价线索，不表示月亮实际逆行' : '',
    p.moonLight ? '月亮日月黄经相位为' + ({ increasing: '增光半周', decreasing: '减光半周', new_phase: '新月数值位置', full_phase: '满月数值位置' }[p.moonLight] ?? '未定') : '',
    solarNames[p.solar?.condition] ?? '',
    degrees(p.solar?.separation) ? '与本图太阳实际相距' + degrees(p.solar.separation) + (p.solar.sameSign ? '且同座' : '，星座分开核对') : '',
    p.solar?.relativePhase === 'closing' ? '与本图太阳的间距当前在缩小，不保证未来必合' : p.solar?.relativePhase === 'opening' ? '与本图太阳的间距当前在增大' : '',
    p.solar?.definitionExampleConflict === true ? '按8.5度燃烧定义计算，原文另举10度例与定义不一致，未据该例放大阈值' : '',
    p.solar?.solarSide && p.solar.solarSide !== 'boundary' ? '相对太阳在原书' + (p.solar.solarSide === 'oriental' ? '东方侧' : '西方侧') + '，不是地理方位或宫位' : '',
    ...list(p.contacts).flatMap(row => bodies[row.otherBody] && aspects[row.aspectType] ? [sentences([
      '与本图' + bodies[row.otherBody] + '核' + aspects[row.aspectType] + '，实际偏离精确角' + degrees(row.error),
      '按原书主列半径和为' + degrees(row.mainOrb) + '、另一列为' + degrees(row.alternateOrb),
      row.orbAgreement === 'both_columns' ? '本次在两列范围内' : '本次仅在其中一列范围内，不选有利的一列代替两列',
      row.signAspectMatches === false ? '黄经容许度内但星座几何关系不同，保留跨座标记' : '', phases[row.phase] ?? '',
      lillyApplicationDescription(row.application, at),
      ...list(row.interpositions).map(item => lillyInterpositionDescription(item, at)),
    ])] : []),
    ...list(p.translations).flatMap(row => bodies[row.movingBody] && bodies[row.fromBody] && bodies[row.toBody]
      && aspects[row.fromAspect] && aspects[row.toAspect] ? [
        '按传光原例，' + bodies[row.movingBody] + '先于' + at(row.fromAt) + '与' + bodies[row.fromBody] + '形成' + aspects[row.fromAspect]
        + '，本图时刻已离相，随后于' + at(row.toAt) + '与' + bodies[row.toBody] + '形成' + aspects[row.toAspect]
        + '。两段均在各自原座，实际救应仍须合参',
      ] : []),
    ...list(p.antiscionContacts).flatMap(row => {
      const kind = { antiscion: '反照点', contra_antiscion: '对反照点' }[row?.kind];
      if (!kind || !bodies[row.otherBody]) return [];
      const reading = row.kind === 'contra_antiscion' ? '，原书将这类位置比作刑冲'
        : ['Jupiter', 'Venus'].includes(row.otherBody) ? '，原书将吉星的反照比作六合或三分' : '';
      return [label + bodies[p.body] + '与同盘' + bodies[row.otherBody] + '的' + kind
        + '在同一度格，实际相距' + degrees(row.distance) + reading];
    }),
    ...list(p.receptions).map(row => {
      if (!bodies[row.otherBody]) return '';
      const confirmed = [row.mutualHouse && '本垣', row.mutualExaltation && '擢升',
        row.mutualTriplicity && '三分', row.mutualTerm && '界', row.mutualFace && '面'].filter(Boolean);
      return sentences([
        confirmed.length ? '与本图' + bodies[row.otherBody] + '有' + confirmed.join('、') + '互容。救应效果仍待核' : '',
        row.mutualTriplicity === undefined && row.triplicityBySect
          ? '与本图' + bodies[row.otherBody] + '的三分互容仅在' + (row.triplicityBySect.day ? '昼盘' : '夜盘') + '成立，本图昼夜待核' : '',
        row.termVariantUnresolved === true ? '与本图' + bodies[row.otherBody] + '的界互容涉及原书界表与正文缺口，保持待核' : '',
      ]);
    }),
    p.besiegement?.status === 'same_sign_body_example' ? '按原书同座身体夹置例，目标'
      + (p.besiegement.between === true ? '严格位于土星与火星之间' : '未严格位于土星与火星之间') + '；其他夹制构形不据此排除'
      : p.besiegement?.status === 'other_configurations_unresolved' ? '其他夹制构形尚未核齐，不把未找到同座例说成没有夹制' : '',
    number(p.house) !== undefined ? '在本图传统第' + p.house + '宫，归为' + ({ angular: '角宫', succedent: '续宫', cadent: '果宫' }[p.houseKind] ?? '未定宫类') : '本图宫位不可用，不借另一张图的宫位',
    '这些均为分项结构。当前接近不保证以后成相，瞬时速度接近零不等于已核原书停驻。其他阻碍构形、固定星与综合状态仍待核',
  ]);
}

function lillyP115Description(p, label) {
  if (p?.profile !== 'lilly-book-one-p115-selected-points-v1'
    || number(p.fortitudes) === undefined || number(p.debilities) === undefined) return '';
  const starNames = { Algol: '大陵五', Regulus: '轩辕十四', Spica: '角宿一' };
  return sentences([
    label + '按 Lilly 第一卷第115页已核分项，助力小计' + p.fortitudes + '分，受损小计' + p.debilities + '分',
    ...list(p.partileContacts).flatMap(row => bodies[row.body] && aspects[row.aspect] && number(row.points)
      ? ['同度格内与' + bodies[row.body] + '的' + aspects[row.aspect] + '计' + row.points + '分'] : []),
    ...[['升交点', p.nodeContacts?.ascending], ['降交点', p.nodeContacts?.descending]].flatMap(([name, node]) => {
      if (node?.meanConjunction === true && node.osculatingConjunction === true && number(node.points)) {
        return ['平交点与瞬时交点均和' + label + '落在同一度格，' + name + '计' + node.points + '分'];
      }
      return node?.meanConjunction !== node?.osculatingConjunction
        ? [name + '的平交点与瞬时交点对同度格的判断不同，此项留待核对'] : [];
    }),
    ...list(p.fixedStarContacts).flatMap(row => {
      if (row.star === 'Algol' && row.points === -5 && degrees(row.separation)) {
        return [label + '与当时大陵五的黄经相距' + degrees(row.separation) + '，按原表五度范围扣5分'];
      }
      if (starNames[row.star] && row.samePrintedMinute === true && row.points > 0) {
        return [label + '与当时' + starNames[row.star] + '同一星座、同一最近角分，按原表计' + row.points + '分'];
      }
      return starNames[row.star] && row.sameDegree === true
        ? [label + '与当时' + starNames[row.star] + '落在同一黄经度格，原书合相口径待核'] : [];
    }),
    p.points?.besiegement === -5 ? '同一星座中实际夹在土星和火星之间，扣5分' : '',
  ]);
}

const leoLunarNatures = { favourable: '原书月亮篇偏顺', adverse: '原书月亮篇偏难', conditional: '原书取义依情境' };

function lunarHouseAspects(values, label, at) {
  const translated = list(values).flatMap(item => bodies[item.progressedBody] && bodies[item.natalTargetId] && aspects[item.aspectType]
    ? [sentences(['次限' + bodies[item.progressedBody] + (item.targetKind === 'progressed' ? '对同图次限' : '对本命')
      + bodies[item.natalTargetId] + '形成' + aspects[item.aspectType], leoLunarNatures[item.nature],
      item.aspectType === 'parallel' ? (item.coordinate === 'equatorial_declination_of_date' && degrees(item.allowedOrb)
        ? '按赤纬绝对差' + degrees(item.allowedOrb) + '核对，不要求同向' : '平行坐标或阈值未提供，不自行补全')
        : (item.coordinate === 'ecliptic_longitude' && degrees(item.allowedOrb)
          ? '按已声明的黄经' + degrees(item.allowedOrb) + '产品阈值核对' : '黄经坐标或阈值未提供，不自行补全'),
      list(item.exactTimes).length ? '本片段精确成相时刻为' + item.exactTimes.map(at).join('、') : '本片段没有记录新的精确成相时点'])] : []);
  return label + (translated.length ? '：' + translated.join('；') : '：在本次已扫描的来源对象和阈值内，没有与本片段重叠的记录，不代表一切推运均不存在');
}

function smthStemExceptionDescription(p) {
  if (!p.stemExceptionProfile) return [];
  const places = { 天干: '天干', 支本气: '地支本气', 支非本气: '地支非本气' };
  const natalPositions = rows => list(rows).flatMap(row =>
    row && layers[row.layer] && places[row.placement] && chinese(row.stem) && chinese(row.tenGod)
      ? [layers[row.layer] + places[row.placement] + row.stem + '为' + row.tenGod
        + (typeof row.sameStem === 'boolean' ? '（与运干' + (row.sameStem ? '同干' : '同五行异干') + '）' : '')] : []);
  if (p.luckStemWealth === true) {
    const roots = natalPositions(p.natalWealthRoots);
    const rootStatus = { 'exact-main': '原局有与运干同干的本气藏根', 'exact-hidden': '运干同干的藏根只在原局非本气',
      'same-element-only': '原局只有与运干同五行的异干藏根', 'no-natal-root': '已核四柱均未见运干财星的同五行藏根' }[p.wealthRootStatus];
    const evidence = p.luckWealthEvidence;
    return [
      p.luckBranchWealthAbsent === true ? '卷二运支无财的结构在本气和全藏干两种口径均成立，仍须核原局的财星取用'
        : p.luckBranchWealthAbsent === false ? '运支本气见财，排除卷二运支无财一支'
          : '仅非本气藏财，卷二这里的运支无财口径尚不能判定',
      Array.isArray(p.natalWealthRoots) ? (roots.length ? '运干财星在已知本命柱中的藏根见证为' + roots.join('、')
        : '已知本命柱的藏干中未见该运干财星的同五行根') : '',
      rootStatus ? rootStatus + '，藏根的力度须核' : '',
      ...list(evidence?.rootPositions).flatMap(row => {
        const root = natalPositions([row])[0];
        const arrivals = list(row?.contacts).flatMap(contact => {
          const actor = contact?.actor === 'annual' ? '当段岁支' : contact?.actor === 'luck' ? '当段运支' : '';
          return actor && /^[子丑寅卯辰巳午未申酉戌亥]{2}$/u.test(contact.branches)
            && /^(六合|六冲|六害|六破|相刑)$/u.test(contact.kind)
            ? [actor + contact.branches[1] + '与该根支' + contact.branches[0] + contact.kind] : [];
        });
        return root && arrivals.length ? [root + '，' + arrivals.join('、') + '，根是否受损仍待核'] : [];
      }),
      ...list(evidence?.contacts).flatMap(row => {
        const actor = row?.layer === 'annual' ? '当段岁干' : layers[row?.layer] ? '本命' + layers[row.layer] + '天干' : '';
        if (!actor || !smthStem(row.stem) || !chinese(row.tenGod)) return [];
        const relation = [row.feeds === true ? '生运干财星' : '', row.controls === true ? '克运干财星' : '',
          row.combines === true ? '与运干财星五合' : ''].filter(Boolean).join('、');
        return relation ? [actor + row.stem + '为' + row.tenGod + '，' + relation + '，实际作用待核'] : [];
      }),
    ];
  }
  if (p.luckTenGod !== '正官') return [];
  const killers = natalPositions(p.natalKillerPositions), outputs = natalPositions(p.natalOutputPositions);
  const combinations = list(p.natalKillerCombinations).flatMap(row => row && chinese(row.stems)
    ? [list(row.columns).map(column => layers[column]).filter(Boolean).join('与') + '天干' + row.stems + '五合'] : []);
  const evidence = p.officerControlEvidence;
  const paths = list(evidence?.foodPaths);
  const mixedControls = list(evidence?.mixedExposedControls);
  const controls = paths.filter(row => row?.placement === '天干').map(row => layers[row.layer]).filter(Boolean);
  const monthControl = paths.find(row => row?.layer === 'month' && row.placement !== '天干' && row.stem === evidence?.monthDutyStem);
  return [
    killers.length ? '本命七杀的位置为' + killers.join('、') : '',
    outputs.length ? '本命食伤的位置为' + outputs.join('、') : '',
    combinations.length ? '与透出的七杀相合的见证为' + combinations.join('、') + '，合去未核' : '',
    controls.length >= 2 ? '本段运干为正官，一处本命杀位有' + controls.length + '处天干食神的直接制杀结构，食神在'
      + controls.join('、') + '；是否制伏太过及官杀去留仍须核定' : '',
    mixedControls.length ? '原局不同柱的透食与透伤分别克同一七杀，实位为'
      + natalPositions(mixedControls).join('、') + '，制伏轻重仍须核定' : '',
    evidence?.monthFoodOnDuty === true && chinese(monthControl?.stem) && number(evidence.monthDutyDay) !== undefined
      ? '出生月交节后第' + evidence.monthDutyDay + '日，首表司事候选为月支' + (monthControl.placement === '支本气' ? '本气' : '余藏') + monthControl.stem
        + '食神，与另一柱透食指向同一杀位，制伏轻重仍待核' : '',
    evidence?.monthResidualKillerOnDuty === true && chinese(evidence.monthDutyStem) && number(evidence.monthDutyDay) !== undefined
      ? '出生月交节后第' + evidence.monthDutyDay + '日，首表司事候选为月支余藏' + evidence.monthDutyStem
        + '七杀，分别核各透食是否克这一处杀位' : '',
    ...paths.flatMap(row => {
      const source = natalPositions([row])[0], targets = natalPositions(row?.targets);
      if (!source || !targets.length) return [];
      const seals = natalPositions(row.controllingSeals);
      return [source + '，其干克' + targets.join('、')
        + (seals.length ? '；此食另受' + seals.join('、') + '的干克，能否夺食待核' : '')
        + (row.combinesOfficer === true ? '；此透食另与当段运干正官五合，合去及制化待核' : '')];
    }),
  ];
}

const smthSourcePosition = column => column === 'annual' ? '本段流年柱' : column === 'decadal' ? '同段已核大运柱'
  : layers[column] ? '本命' + layers[column] : '';
const smthPillar = value => /^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/u.test(value) ? value : '';
const smthStem = value => /^[甲乙丙丁戊己庚辛壬癸]$/u.test(value) ? value : '';
const smthPlacements = { stem: '天干', main_qi: '支本气', other_hidden: '支非本气藏干' };
function smthSourceRole(row) {
  const column = smthSourcePosition(row?.column), place = smthPlacements[row?.placement], coordinate = smthPillar(row?.pillar);
  const god = /^(正印|偏印|正财|偏财|正官|七杀|伤官|食神|比肩|劫财)$/u.test(row?.god);
  return column && place && coordinate && smthStem(row.stem) && god
    ? column + coordinate + '的' + place + row.stem + '为' + row.god : '';
}
const smthSourceRoles = rows => list(rows).map(smthSourceRole).filter(Boolean).join('、');

function smthBranchRelations(rows, position) {
  return list(rows).flatMap(row => {
    const members = list(row?.members).map(position);
    return members.length === 2 && members.every(Boolean) && /^(相刑|六害|六破|六冲|六合)$/u.test(row?.kind)
      ? [members.join('与') + row.kind] : [];
  }).join('、');
}

function smthJiaWuRescueDescription(p, position) {
  const review = p.jiaWuRescue;
  if (!review) return [];
  const holder = row => {
    const name = position(row?.position), pillar = smthPillar(row?.pillar);
    return name && pillar ? name + pillar : '';
  };
  const details = rows => list(rows).map(holder).filter(Boolean).join('、');
  const wood = review.woodClause;
  const fires = details(wood?.exposedFire);
  const fireMembers = list(wood?.natalFireMembers).map((rows, index) =>
    '寅午戌'[index] + '在' + list(rows).map(position).filter(Boolean).join('、'));
  return [
    ...list(review.metalControls).flatMap(row => {
      const place = holder(row);
      if (!place || row.target !== 'day' || !/^[庚辛]/u.test(row.pillar)) return [];
      const controls = details(row.fireControls);
      const companions = details(row.otherCombines);
      return [place + '的' + row.pillar[0] + '金克日干甲'
        + (controls ? '，同段该金另受' + controls + '的丙丁火反克' : '')
        + (companions ? '，该金同时与' + companions + '的天干五合' : '')];
    }),
    ...list(review.metalRootReview).flatMap(row => {
      const place = holder(row);
      if (!place || !/^[庚辛]/u.test(row.pillar)) return [];
      const roots = list(row.roots).flatMap(root => {
        const rootPlace = holder(root);
        if (!rootPlace || !/^[庚辛]$/u.test(root.stem)) return [];
        const clashes = list(root.clashes).flatMap(contact => {
          const members = list(contact?.members);
          return contact?.kind === '六冲' && members.includes(root.position)
            ? members.filter(member => member !== root.position).map(position).filter(Boolean) : [];
        }).join('、');
        return [rootPlace + (root.mainQi ? '本气' : '非本气藏') + root.stem
          + (root.sameStem ? '为同干根' : '为同五行异干根')
          + (clashes ? '，根所在柱与' + clashes + '六冲' : '')];
      });
      return [place + '的' + row.pillar[0] + '金'
        + (/^[申酉]$/u.test(row.luBranch) ? '禄在' + row.luBranch + '，' : '，')
        + (roots.length ? roots.join('；') : '已知柱未见藏金根')];
    }),
    ...list(review.gengGrowthRoots).flatMap(({ metal, root }) => holder(metal) && holder(root)
      ? [holder(metal) + '明庚克日甲，' + holder(root) + '余藏同干庚，为卷二所列庚之长生位'] : []),
    ...list(review.guiCombines).flatMap(row => {
      const place = holder(row);
      if (!place || row.target !== 'annual' || !/^癸/u.test(row.pillar)) return [];
      const others = list(row.otherWuPositions).map(position).filter(Boolean).join('、');
      const clashes = smthBranchRelations(list(row.branchClashes).filter(contact => contact?.kind === '六冲'), position);
      return [place + '的癸与岁干戊五合'
        + (others ? '，同一癸还与' + others + '的戊干成合，实际取用待核' : '')
        + (clashes ? '，参与干合的柱另见' + clashes + '，属于〈论冲击〉所列支冲条件，合的实际作用待核' : '')];
    }),
    list(review.guiCompetingPositions).length > 1
      ? list(review.guiCompetingPositions).map(position).filter(Boolean).join('、') + '各有透癸，同段并合一个岁干戊'
      : '',
    ({
      'verified-without-listed-counters': '同段核到两路透干见证，至少一处庚辛制甲未见丙丁反克或该金另合，唯一透癸合岁戊且未另合其他戊，参与戊癸合的两柱均未见六冲。制合效力仍待核',
      'with-countercontact': '同段虽有庚辛克甲和癸合岁戊，但至少一路的已见位置均有反克或另合，或有多癸并合岁戊。制合效力仍待核',
      'with-gui-branch-clash': '同段已见庚辛克甲和癸合岁戊，戊癸合的柱位见六冲。制合效力仍待核',
      'with-metal-root-clash': '同段已见庚辛克甲和癸合岁戊，所见藏金根所在柱均参与六冲。根受冲后的作用与制合效力仍待核',
      'coverage-unverified': '同段已见庚辛克甲和癸合岁戊，未核柱位仍可能存在反克、另合、同干并合或冲到合柱',
    })[p.jiaWuDualWitnessState],
    /^[寅卯亥未]$/u.test(wood?.monthBranch) && details(wood.extraWood)
      ? '本命生于' + wood.monthBranch + '月，除日干外，' + details(wood.extraWood) + '另有甲乙透干与岁干戊作克的比较' : '',
    fires ? '原局另透丙丁火于' + fires : '',
    review.fireCandidate === true && fireMembers.length === 3
      ? '重见甲乙的分支同时见丙丁透干和原局寅午戌三个成员，' + fireMembers.join('、') + '，火局作用待核' : '',
    p.jiaWuRescueCandidate === false ? '已核范围未见本条制合候选，该段只保留甲克戊的关系'
      : p.jiaWuRescueCandidate !== true ? '制合候选仍未核定，缺项或只见藏癸的情况保留未知' : '',
  ];
}

function smthNatalOfficerDescription(rows, position) {
  return list(rows).flatMap(row => {
    const officer = smthSourceRole(row?.officer);
    if (!officer) return [];
    const monthRoot = smthSourceRole(row.monthRoot);
    const wealth = smthSourceRoles(row.wealthToOfficer), seals = smthSourceRoles(row.officerToSeals);
    const killers = smthSourceRoles(row.exposedKillers);
    const companions = list(row.officerCombines).flatMap(pair => list(pair.members)
      .filter(member => member !== row.officer.column).map(position).filter(Boolean)).join('、');
    return [sentences([
      '〈论正官〉核原局的' + officer,
      row.sourceOfficerMonth === true && chinese(row.monthBranch) ? '原局月支' + row.monthBranch + '在该日干所列正气月内' : '',
      monthRoot ? '同一官干在月支有根，' + monthRoot : '',
      wealth ? '与这一官干有财生官关系，' + wealth : '',
      seals ? '与这一官干有官生印关系，' + seals : '',
      killers ? '原局同时透出七杀，' + killers : '',
      companions ? '这一官干与' + companions + '的天干五合' : '',
      chinese(row.officerAtHourPhase) ? '该官干临出生时支为' + row.officerAtHourPhase : '',
      ...list(row.hurtingControls).flatMap(contact => {
        const hurting = smthSourceRole(contact?.role);
        if (!hurting) return [];
        const counter = smthSourceRoles(contact.restrainingSeals);
        return [sentences([
          hurting + '，对这一官干有克制关系',
          chinese(contact.atHourPhase) ? '该伤官干临出生时支为' + contact.atHourPhase : '',
          counter ? '原局另有能克这一伤官的印星，' + counter : '',
        ])];
      }),
    ])];
  });
}

function smthYearCombineDescription(p, position) {
  const five = p.fivePositionReferences;
  const offsets = [['sexagenaryForward', '六十干支顺推五位'], ['sexagenaryBackward', '六十干支逆推五位'],
    ['branchForward', '地支顺推五位'], ['branchBackward', '地支逆推五位']]
    .filter(([key]) => five?.[key] === true).map(([, label]) => label);
  const duty = p.dayHourMonthDuty;
  const dutySeason = p.dayHourMonthDutySeason;
  const seasonalPowerText = row => /^[木火土金水]$/u.test(row?.element ?? '') && /^[旺相休囚死]$/u.test(row?.power ?? '')
    ? row.element + '为' + row.power : '';
  const houseTombText = row => {
    if (!smthPillar(row?.reference) || !smthPillar(row?.referenceTarget) || !smthPillar(row?.pillar)) return '';
    const role = row.role === 'house' ? '顺推五位的宅位' : row.role === 'tomb' ? '逆推五位的墓位' : '';
    if (!role) return '';
    return '基准柱' + row.reference + role + '为' + row.referenceTarget + '，实际' + row.pillar
      + (row.match === 'whole-pillar' ? '整柱吻合' : '与该位同支');
  };
  const branchRelations = rows => smthBranchRelations(rows, position);
  const restrictionText = (name, restriction) => {
    const taboo = restriction?.taboo;
    const part = smthStem(taboo) ? '忌干' : /^[子丑寅卯辰巳午未申酉戌亥]$/u.test(taboo) ? '忌支' : '';
    if (!part) return '';
    const where = list(restriction.positions).map(position).filter(Boolean).join('、');
    if (restriction.status === 'listed-counter-present' && where) {
      return '按〈二德扶身〉，' + name + '的' + part + taboo + '见于' + where
        + (name === '月德合' ? '，此支德合受阻' : '，属于天德受伤条件');
    }
    return restriction.status === 'listed-counter-absent'
      ? '按〈二德扶身〉，本命与同段岁运未见' + name + '的' + part + taboo : '';
  };
  const natalSupportsText = support => {
    if (!support) return [];
    const locations = values => list(values).map(position).filter(Boolean).join('、');
    const branchPosition = (name, branch, values) => chinese(branch) && Array.isArray(values)
      ? name + '取' + branch + '，' + (locations(values) ? '原局见于' + locations(values) : '原局未见') : '';
    const officers = smthSourceRoles(support.officers);
    const joint = locations(support.tianyiHorsePositions);
    const branchDetails = list(support.branchSupportDetails).flatMap(row => {
      const name = position(row?.position), pillar = smthPillar(row?.pillar);
      if (!name || !pillar) return [];
      const roles = [['天乙', support.tianyiPositions], ['日禄', support.luPositions], ['驿马', support.horsePositions]]
        .filter(([, values]) => list(values).includes(row.position)).map(([label]) => label);
      const voidTerms = list(row.voidSources).flatMap(source => ['year', 'day'].includes(source?.position) && smthPillar(source.xun)
        ? [position(source.position) + '所属' + source.xun + '旬空'] : []).join('、');
      const contacts = branchRelations(row.contacts);
      return roles.length && (voidTerms || contacts) ? [sentences([
        roles.join('与') + '所在' + name + pillar,
        voidTerms ? '落在' + voidTerms : '',
        contacts ? '该柱原局另见' + contacts : '',
        row.voidHasCombination === true && voidTerms ? '空亡所在柱另有六合，属于〈论空亡〉所列合解候选' : '',
      ])] : [];
    });
    return [
      officers ? '原局按日干核正官和七杀位置，' + officers : '',
      !list(support.officers).some(row => row?.god === '正官' && row.placement === 'stem') ? '原局正官未透' : '',
      ...smthNatalOfficerDescription(support.officerEvidence, position),
      branchPosition('日干天乙按出生节限的' + chinese(support.nobleSeason), support.tianyiBranch, support.tianyiPositions),
      branchPosition('日干禄位', support.luBranch, support.luPositions),
      branchPosition('年支驿马', support.horseBranch, support.horsePositions),
      joint ? '按分列的取法，天乙与驿马同见于' + joint : '',
      ...branchDetails,
      support.hasAllNamedPositions === true ? '原局四项位置同见。格局及实际相扶仍待核' : '',
    ];
  };
  return [
    ...list(p.dayHourStemCombines).flatMap(row => {
      const name = position(row?.position), pillar = smthPillar(row?.pillar);
      if (!name || !pillar || !chinese(row.stemPair)) return [];
      const annualClashes = branchRelations(row.annualClashes), columnClashes = branchRelations(row.combiningColumnClashes);
      return [sentences([
        name + pillar + '的天干与岁干' + row.stemPair + '五合',
        chinese(row.dayStemPhaseAtYearBranch) ? '日干临岁支为' + row.dayStemPhaseAtYearBranch : '',
        row.position === 'hour' && chinese(row.participantStemPhaseAtYearBranch) ? '时干临岁支为' + row.participantStemPhaseAtYearBranch : '',
        row.positionWeight === 'lighter' && row.position === 'day' ? '《神白经》所列日干合的柱位比较为较轻'
          : row.positionWeight === 'heavier' && row.position === 'hour' ? '《神白经》所列时干合的柱位比较为较重' : '',
        row.jiaJiWeight === 'heavier' && row.stemPair === '甲己' ? '卷二将甲日己岁在这对有向例中列为相对较重'
          : row.jiaJiWeight === 'lighter' && row.stemPair === '己甲' ? '卷二将己日甲岁在这对有向例中列为相对较轻' : '',
        annualClashes ? '岁支另有冲位，' + annualClashes : '',
        columnClashes ? '合干所在柱另有冲位，' + columnClashes : '',
        row.yearClashAtDayStemDeathOrExtinction === true ? '按日干有岁支临死绝并另见六冲的候选，原文取法和作用待核'
          : row.yearClashAtParticipantDeathOrExtinction === true ? '按时干有岁支临死绝并另见六冲的候选，原文取法和作用待核' : '',
      ])];
    }),
    five ? (offsets.length ? '以本命日柱对照流年，五位坐标见' + offsets.join('、')
      : '按十二支和六十干支两个序列双向核对，日柱与岁柱均不相距五位') : '',
    houseTombText(p.dayHouseArrival) ? '日时干合的入宅候选，' + houseTombText(p.dayHouseArrival) : '',
    houseTombText(p.hourTombArrival) ? '按《五行精纪》引《神白经》的时后五位核墓，' + houseTombText(p.hourTombArrival) : '',
    list(p.doubleCombineDetails).length && houseTombText(p.annualHouseTomb)
      ? '以本命年柱为准另查太岁所到宅墓，' + houseTombText(p.annualHouseTomb) : '',
    duty && smthPillar(duty.month) && number(duty.elapsedDay) !== undefined ? '出生月' + duty.month + '交节后第' + duty.elapsedDay + '日，'
      + (duty.outsidePrintedDays === true ? '超出首表分配的日数' : chinese(duty.label) ? '首表司事候选为' + duty.label : '首表候选未核')
      + (seasonalPowerText(dutySeason) ? '。按同卷月令表，该司事五行' + seasonalPowerText(dutySeason) : '')
      + '。此项为月令见证，人元实际旺衰仍待核' : '',
    ...list(p.doubleCombineDetails).flatMap(row => {
      const name = position(row?.position), pillar = smthPillar(row?.pillar);
      if (!name || !pillar) return [];
      const own = branchRelations(row.directFriction), others = branchRelations(row.otherFriction);
      const punishmentMonth = smthPillar(row.punishmentSeason?.month);
      const participantPower = seasonalPowerText(row.punishmentSeason?.participant);
      const annualPower = seasonalPowerText(row.punishmentSeason?.annual);
      const moonPlaces = [row.participantAtMoonVirtue === true ? name : '', row.yearAtMoonVirtue === true ? '岁干' : ''].filter(Boolean);
      const general = row.heavenVirtueMonthGeneral;
      const branchOnly = /^[子丑寅卯辰巳午未申酉戌亥]$/u;
      const punishments = list(row.punishments).flatMap(group => /^(寅巳申|丑戌未)$/u.test(group?.values)
        ? [group.values + '三刑（' + list(group.byBranch).map((members, i) => group.values[i] + '在'
          + list(members).map(position).filter(Boolean).join('、')).join('，') + '）'] : []).join('、');
      return [sentences([
        name + pillar + '与太岁干支俱合',
        smthStem(row.moonVirtue) ? '本命月支所取月德为' + row.moonVirtue + '，'
          + (moonPlaces.length ? moonPlaces.join('和') + '见月德' : '这对柱的天干均未见月德') : '',
        smthPillar(row.participantXun) && smthPillar(row.annualXun) && typeof row.sameXun === 'boolean'
          ? '参与柱在' + row.participantXun + '旬，太岁在' + row.annualXun + '旬，按〈论十干合〉属'
            + (row.sameXun ? '同旬俱合' : '跨旬俱合') : '',
        moonPlaces.length ? restrictionText('月德合', row.moonVirtueRestriction) : '',
        ...list(row.heavenVirtue).flatMap(virtue => {
          const basis = { stem: '卷六实干', yuanhai: '《渊海子平》支位', kaoyuan: '《星历考原》支位' }[virtue?.basis];
          if (!basis || !chinese(virtue.value)) return [];
          const annual = virtue.basis === 'stem' ? '岁干' : '岁支';
          const places = [virtue.atParticipant === true ? name + (virtue.basis === 'stem' ? '天干' : '地支') : '',
            virtue.atAnnual === true ? annual : ''].filter(Boolean);
          return places.length ? ['天德按' + basis + '查' + virtue.value + '，' + places.join('和') + '同位',
            restrictionText('天德', virtue.restriction)] : [];
        }),
        general && chinese(general.middleTerm) && branchOnly.test(general.actualBranch) && branchOnly.test(general.expectedBranch)
          ? '出生时按最近中气' + general.middleTerm + '取' + general.actualBranch + '将，〈二德扶身〉本月所列扶将为'
            + general.expectedBranch + '，' + (general.matchesHeavenVirtueGeneral === true ? '两者相符' : '当前月将尚未到该支') : '',
        general?.printedFirstMonthExample === true ? '出生于雨水后的亥将时段，且日干为丙或丁，符合〈将星扶德〉所举正月例的这两项条件' : '',
        ...natalSupportsText(general?.natalSupports),
        ...list(row.branchVirtues).flatMap(virtue => ['天德', '月德'].includes(virtue?.name)
          && /^[子丑寅卯辰巳午未申酉戌亥]$/u.test(virtue.branch) && (virtue.atParticipant === true || virtue.atAnnual === true)
          ? ['按壶中子支法，本命月建所取' + virtue.name + '为' + virtue.branch + '，'
            + [virtue.atParticipant === true ? name + '地支' : '', virtue.atAnnual === true ? '岁支' : ''].filter(Boolean).join('和') + '同位'] : []),
        houseTombText(row.natalHouseTomb) ? '实际参与俱合的' + name + '另查年命宅墓，' + houseTombText(row.natalHouseTomb) : '',
        houseTombText(row.ownHouseTomb) ? '辛丑本以实际参与俱合的日柱或时柱为基准，' + houseTombText(row.ownHouseTomb) : '',
        own ? '俱合的同一对另见' + own : '', others ? '参与柱另与其他柱有关系，' + others : '',
        punishmentMonth && participantPower && annualPower ? '这对俱合柱同时相刑。按本命月' + punishmentMonth + '的月令，'
          + name + '地支五行' + participantPower + '，岁支五行' + annualPower
          + (row.punishmentSeason.hasRestOrCaptive === true ? '。这一对出现地支五行休或囚的候选'
            : '。这一对的地支五行未见休或囚') : '',
        punishments ? '涉及该对至少一柱的完整三刑为' + punishments : '',
      ])];
    }),
  ];
}

const smthFavorableMajorLuckNames = new Map([
  ['nayin-in-own-direction', '年命纳音与运柱同类且当步运支得地'],
  ['earth-metal-water', '水命土运经原局纳音金生水'],
  ['water-and-fire-branches', '水命行寅午戌并见原局三支齐备或纳音火'],
  ['ding-chou-to-ding-wei', '丁丑年行丁未运且原局未见丁未'],
  ['wu-yin-to-ding-chou', '戊寅年行丁丑运'],
  ['geng-chen-and-yi-you', '原局单见庚辰或乙酉，与当步大运的另一柱天干、地支均合'],
]);

function smthP245BathingBladeDescription(review) {
  if (!review || !smthStem(review.yearStem) || !/^[子丑寅卯辰巳午未申酉戌亥]$/u.test(review.bladeBranch)) return [];
  const bases = list(review.bases).flatMap(basis => basis === 'year-nayin' ? ['年命纳音'] : basis === 'day-stem' ? ['本命日干'] : []);
  if (!bases.length) return [];
  const names = { annual: '太岁', luck: '当步大运' };
  const positions = rows => list(rows).flatMap(item => names[item?.position] && smthPillar(item.pillar)
    ? [names[item.position] + item.pillar] : []);
  const blades = positions(review.seats), flying = positions(review.flyingSeats);
  return [
    '按' + bases.join('和') + '，上一正式大运长生，当步进入沐浴败地',
    blades.length ? '本命年干' + review.yearStem + '的羊刃在' + review.bladeBranch + '，实位见于' + blades.join('、') : '',
    flying.length && /^[子丑寅卯辰巳午未申酉戌亥]$/u.test(review.flyingBranch)
      ? flying.join('、') + '实落与羊刃相对的飞刃' + review.flyingBranch : '',
    review.candidate === true ? '长生后入败地、实际岁运同对刑克和本命羊刃同见，保留原文的结构候选，实际作用待核' : '',
  ];
}

function smthP245BathingJieWangDescription(review) {
  const year = smthPillar(review?.yearPillar);
  if (!year || !chinese(review.yearNaYin)) return [];
  const positions = { annual: '太岁', luck: '当步大运' };
  const relations = { 前克后: '该煞位柱纳音克年命', 后克前: '年命纳音反克该煞位柱', 同五行: '两柱纳音同五行',
    前生后: '该煞位柱纳音生年命', 后生前: '年命纳音生该煞位柱' };
  return list(review.seats).flatMap(row => {
    const position = positions[row?.position], pillar = smthPillar(row?.pillar), relation = relations[row?.naYinRelation];
    if (!position || !pillar || !['劫煞', '亡神'].includes(row.star) || !chinese(row.naYin) || !relation) return [];
    return ['按本命年支' + year[1] + '取位，' + position + pillar + '实落' + row.star + '，纳音为' + row.naYin
      + '，本命年柱' + year + '纳音为' + review.yearNaYin + '，' + relation];
  });
}

function smthP245MajorHistoryDescription(history, at) {
  if (history?.profile !== 'smth-volume-two-p245-major-luck-history-v10') return [];
  const contacts = list(history.clashes).filter(kind => /^(相刑|六冲|天干四冲|六破)$/u.test(kind));
  const controls = list(history.controls).flatMap(row => {
    const part = { stem: '干', branch: '支' }[row?.part];
    const pair = { annual: ['岁', '运'], luck: ['运', '岁'] }[row?.source];
    return part && pair ? [pair[0] + part + '克' + pair[1] + part] : [];
  });
  return [
    [...contacts, ...controls].length ? '实际岁柱与当步运柱同对见' + [...contacts, ...controls].join('、') : '',
    ...list(history.bases).flatMap(row => {
      const basis = { 'year-nayin': '年命纳音', 'day-stem': '本命日干' }[row?.basis];
      if (!basis || !chinese(row.value) || !/^(长生|沐浴|冠带|临官|帝旺|衰|病|死|墓|绝|胎|养)$/u.test(row.currentPhase)) return [];
      const earlierBirth = smthPillar(row.earlierBirth?.pillar), earlierPeak = smthPillar(row.earlierPeak?.pillar);
      return [sentences([
        '按' + basis + row.value + '，当步运支为' + row.currentPhase,
        row.birthStatus === 'not-reached' ? '截至本段的已行运步未到长生' :
          row.birthStatus === 'current-stage' ? '当步到长生' :
            row.birthStatus === 'passed' && earlierBirth ? '此前已历' + earlierBirth + '长生运，始于' + at(row.earlierBirth.start) : '',
        row.contentionBeforeBirth === true ? '此口径未历长生，实际岁运同对见刑、冲、克或破的条件之一' : '',
        row.contentionAtBathingAfterBirth === true ? '前一步长生后进入沐浴，实际岁运另见刑、冲、克或破的条件之一' : '',
        row.deathOrExtinctionAfterPeak === true && earlierPeak
          ? '此前' + earlierPeak + '运曾到帝旺，当步为死绝位，取用和实际轻重待核' : '',
      ])];
    }),
    ...smthP245BathingBladeDescription(history.bathingBladeReview),
    ...smthP245BathingJieWangDescription(history.bathingJieWangReview),
    ...smthMajorLuckNaYinDescription(history.majorLuckNaYin),
    ...smthMajorLuckPolarityDescription(history.majorLuckPolarity),
    ...smthWaterNaYinLuckDescription(history.waterNaYinLuck),
    ...smthNamedMajorLuckDescription(history.namedMajorExamples),
  ];
}

function smthP245DirectNobleDescriptions(rows, position) {
  return list(rows).flatMap(row => {
    const basis = row?.basis === 'year' ? '年干' : row?.basis === 'day' ? '日干' : '';
    const stem = smthStem(row?.stem);
    if (!basis || !stem || !/^[子丑寅卯巳午未申酉亥]$/u.test(row.nobleBranch)) return [];
    return list(row.seats).flatMap(seat => {
      const actor = ['annual', 'minor'].includes(seat?.position) && position(seat.position), pillar = smthPillar(seat?.pillar);
      if (!actor || !pillar || pillar[1] !== row.nobleBranch) return [];
      const voids = list(seat.voidSources).flatMap(item => {
        const label = ['year', 'day'].includes(item?.basis) && smthSourcePosition(item.basis), xun = smthPillar(item?.xun);
        return label && xun ? [label + xun + '旬空'] : [];
      });
      const contacts = list(seat.obstructions).flatMap(item => ['六冲', '六破'].includes(item?.kind) && position(item.target)
        ? [position(item.target) + '的' + item.kind] : []);
      const combinations = list(seat.voidCombinations).flatMap(item => item?.kind === '六合' && position(item.target)
        ? [position(item.target)] : []);
      return [sentences([
        actor + pillar + '到本命' + basis + stem + '的天乙实位' + row.nobleBranch,
        voids.length ? '该位落' + voids.join('、') : '',
        contacts.length ? '该位遇' + contacts.join('、') : '',
        combinations.length ? '同一空位还与' + combinations.join('、') + '六合，实际合解待核' : '',
        seat.eligible === false ? '本段只留天乙落位证据，禄与生旺按各自条件核验' : '',
      ])];
    });
  });
}

function smthP245NobleCombinationDescriptions(rows, position) {
  return list(rows).flatMap(row => {
    const basis = row?.basis === 'year' ? '年干' : row?.basis === 'day' ? '日干' : '';
    const stem = smthStem(row?.stem);
    if (!basis || !stem) return [];
    const matches = list(row.matches).flatMap(item => {
      if (!['annual', 'minor'].includes(item?.position) || !smthPillar(item.pillar)
        || !/^[子丑寅卯巳午未申酉亥]$/u.test(item.nobleBranch)) return [];
      return [position(item.position) + item.pillar + '的地支与贵支' + item.nobleBranch + '六合'];
    });
    if (!matches.length) return [];
    return [sentences([
      '按《三命提要》的贵神六合，以本命' + basis + stem + '为基准，' + matches.join('，'),
      matches.length === 2 && row.distinctPairs === 2 ? '两层各到一处，保留同一' + basis + '的共同支持候选，根基与实际作用待核'
        : matches.length === 2 ? '两层同到一处贵支六合位，计一处'
          : '这一干的取法只见一层落位',
    ])];
  });
}

function smthP245StemVirtueDescription(review, virtue, position) {
  if (!review || !/^[子丑寅卯辰巳午未申酉戌亥]$/u.test(review.monthBranch)) return [];
  const stem = smthStem(review.stem), partner = smthStem(review.partner), taboo = smthStem(review.taboo);
  if (!stem || !partner || !taboo) return [];
  const seats = list(review.seats).flatMap(row => ['annual', 'minor'].includes(row?.id) && smthPillar(row.pillar)
    ? [position(row.id) + row.pillar + '透' + row.pillar[0]] : []);
  if (!seats.length) return [];
  const blocked = list(review.obstructions).flatMap(row => position(row?.id) && smthPillar(row.pillar)
    ? [position(row.id) + row.pillar] : []);
  const general = review.monthGeneral;
  const checkedGeneral = general && /^[子丑寅卯辰巳午未申酉戌亥]$/u.test(general.actualBranch)
    && /^[子丑寅卯辰巳午未申酉戌亥]$/u.test(general.expectedBranch);
  return [sentences([
    '按〈二德扶身〉，本命' + review.monthBranch + '月取' + stem + '为' + virtue + '，合干' + partner + '，忌' + taboo + '，' + seats.join('、'),
    review.paired === true && blocked.length ? '岁与本版小运的' + virtue + '干合见忌干，实际透干在' + blocked.join('、') : '',
    checkedGeneral ? '出生中气所取月将为' + general.actualBranch + '，本命月建的天德喜将为' + general.expectedBranch : '',
    review.candidate === true ? '岁与本版小运各透' + virtue + '干对的一方，同段未见所列忌干，记共同支持候选' : '',
  ])];
}

function smthP245HeavenVirtueDirectionDescription(review) {
  if (!review || !/^[卯午酉子]$/u.test(review.monthBranch) || !/^[乾坤艮巽]$/u.test(review.trigram)
    || !/^[乾坤艮巽]$/u.test(review.partner) || !['申巳', '申辰', '寅亥', '寅戌'].includes(review.pairedBranches)) return [];
  return ['本命' + review.monthBranch + '月的天德卦位为' + review.trigram + '，方位合在' + review.partner
    + '。实际岁支与本版小运支见' + review.pairedBranches + '，《协纪辨方书》列作方位取法的对照'];
}

function smthP245CanopyDescription(review, position) {
  if (!review || !/^[辰戌丑未]$/u.test(review.branch)) return [];
  const seats = list(review.seats).flatMap(row => ['annual', 'minor'].includes(row?.position) && smthPillar(row.pillar)
    ? [position(row.position) + row.pillar] : []);
  if (!seats.length) return [];
  const flanks = list(review.flanks).flatMap(row => {
    if (!/^[酉亥卯巳]$/u.test(row?.branch)) return [];
    const columns = list(row.columns).flatMap(column => layers[column?.position] && smthPillar(column.pillar)
      ? ['本命' + layers[column.position] + column.pillar] : []);
    return [row.branch + (columns.length ? '在' + columns.join('、') : '未见于本命四柱')];
  });
  const voids = list(review.voidBases).filter(value => value === 'year' || value === 'day').map(smthSourcePosition);
  const obstructions = list(review.obstructions).flatMap(row => ['六冲', '六破'].includes(row?.kind)
    && position(row.position) && position(row.target) ? [position(row.position) + '与' + position(row.target) + '见' + row.kind] : []);
  return [
    seats.join('与') + '到本命年支所取的华盖' + review.branch,
    flanks.length === 2 && smthStem(review.yearStem) ? '年干' + review.yearStem + '所取夹贵查两侧原局支位，' + flanks.join('，') : '',
    voids.length ? '该华盖支落' + voids.join('、') + '旬空' : '',
    obstructions.length ? '实际华盖位置有' + obstructions.join('、') : '',
    review.candidate === true ? '太岁和本版小运同到华盖，原局夹贵两侧齐备，保留共同支持候选，根基及实际作用待核'
      : '本段仅登记华盖及原局夹贵的实际见证',
  ];
}

function smthHorseSeatDescriptions(rows, position, blockedPositions = []) {
  const bases = { year: '本命年柱', day: '本命日柱' };
  return list(rows).flatMap(row => {
    const label = position(row?.position), pillar = smthPillar(row?.pillar);
    if (!label || !pillar) return [];
    const sources = list(row.voidSources).flatMap(source => bases[source?.basis] && smthPillar(source.xun)
      ? [bases[source.basis] + '的' + source.xun + '旬空'] : []);
    const combines = smthBranchRelations(list(row.voidCombinations).filter(pair => pair?.kind === '六合'), position);
    const breaks = smthBranchRelations(list(row.breakContacts).filter(pair => pair?.kind === '六破'), position);
    const lu = list(row.luBases).map(basis => ({ year: '本命年干禄', day: '本命日干禄' })[basis]).filter(Boolean);
    const noble = list(row.nobleBases).map(basis => ({ year: '本命年干天乙', day: '本命日干天乙' })[basis]).filter(Boolean);
    return [sentences([
      sources.length ? label + pillar + '所坐马位落在' + sources.join('、') : '',
      sources.length && combines ? label + '的这一马位另见' + combines + '，保留合解候选' : '',
      /^(交神|退神|伏神)$/u.test(row.progressRestriction) ? label + pillar + '整柱见〈论进交退伏〉所列' + row.progressRestriction : '',
      breaks ? label + '的这一马位另见' + breaks : '',
      lu.length && noble.length ? label + pillar + '同一马位见' + [...lu, ...noble].join('、') : '',
      blockedPositions.includes(row.position) ? label + '的这一马位单独不能支持岁与小运共同得助' : '',
    ])];
  });
}

function smthTaiSuiDescription(p) {
  const annual = smthPillar(p.yearPillar);
  if (!annual || p.confirmed !== true) return [];
  const positions = { day: '本命日柱', luck: '当段大运', annual: '流年' };
  const contentionPositions = list(p.repeatYearContentionPositions).filter(position => ['day', 'luck'].includes(position))
    .map(position => positions[position]);
  const combinedContention = list(p.repeatYearCombinationContentionPositions).filter(position => ['day', 'luck'].includes(position))
    .map(position => positions[position]);
  const fullPillarCombinations = list(p.repeatYearFullPillarCombinations).flatMap(row => {
    const label = { day: '本命日柱', luck: '当段大运' }[row.position], pillar = smthPillar(row.pillar);
    return label && pillar ? [label + pillar + '与流年' + annual + '干支俱合。〈总论岁运〉另列此合，实际取用待核'] : [];
  });
  const direction = (kind, participant, year) => ({
    同五行: participant + '与' + year + '同五行', 前生后: participant + '生' + year, 后生前: year + '生' + participant,
    前克后: participant + '克' + year, 后克前: year + '克' + participant,
  })[kind];
  const coincident = smthSourceRoles(list(p.coincidentRoles).map(row => ({ ...row, column: 'annual', pillar: annual })));
  const contacts = list(p.repeatYearContacts).flatMap(row => {
    const position = positions[row?.position], pillar = smthPillar(row?.pillar);
    if (!position || !pillar) return [];
    const role = row.position === 'luck' ? '运' : '本命日';
    const pairNames = list(row.contacts).filter(kind => /^(天干五合|天干四冲|六合|六冲|六害|六破|相刑|同柱)$/u.test(kind));
    return [position + pillar + '与流年' + annual + '，' + [
      direction(row.stemRelation, role + '干' + pillar[0], '岁干' + annual[0]),
      direction(row.branchRelation, role + '支' + pillar[1], '岁支' + annual[1]),
      pairNames.length ? '同对另见' + pairNames.join('、') : '',
    ].filter(Boolean).join('，')];
  });
  const stemGeneration = ({
    'both-feed-year': '本命日干和运干同生岁干',
    'year-feeds-both': '岁干同时生本命日干和运干',
    'day-feeds-year-feeds-luck': '本命日干生岁干，岁干再生运干',
    'luck-feeds-year-feeds-day': '运干生岁干，岁干再生本命日干',
  })[p.repeatYearStemGeneration];
  const luckClashControls = list(p.repeatYearLuckClashControls).flatMap(row => {
    const part = { stem: '干', branch: '支' }[row?.part];
    const pair = { annual: ['岁', '运'], luck: ['运', '岁'] }[row?.source];
    return part && pair ? [pair[0] + part + '克' + pair[1] + part] : [];
  }).join('、');
  const exchange = p.repeatYearExchanges;
  const exchangeDetails = [['禄', '干', exchange?.lu], ['驿马', '支', exchange?.horse]].flatMap(([name, basis, row]) => {
    if (!row) return [];
    const atLuck = row.luckAtAnnualTarget === true && /^[子丑寅卯辰巳午未申酉戌亥]$/u.test(row.annualTarget)
      ? '运支到岁' + basis + '的' + name + '位' + row.annualTarget : '';
    const atAnnual = row.annualAtLuckTarget === true && /^[子丑寅卯辰巳午未申酉戌亥]$/u.test(row.luckTarget)
      ? '岁支到运' + basis + '的' + name + '位' + row.luckTarget : '';
    if (row.mutual === true && atLuck && atAnnual) return ['同段岁运互换' + name + '，' + atLuck + '，' + atAnnual];
    return [atLuck, atAnnual].filter(Boolean);
  });
  const nobles = /^(阳贵|阴贵)$/u.test(exchange?.nobleSeason) ? list(exchange.nobles).flatMap(row => {
    const basis = { year: '本命年干', day: '本命日干' }[row?.basis];
    const observed = list(row?.positions).map(position => positions[position]).filter(Boolean).join('、');
    return basis && observed && smthStem(row.stem) && /^[子丑寅卯辰巳午未申酉戌亥]$/u.test(row.branch)
      ? ['按出生节限的' + exchange.nobleSeason + '，' + basis + row.stem + '的天乙在' + row.branch + '，本段见于' + observed] : [];
  }) : [];
  const horseNaYin = exchange?.horse?.naYin;
  const horsePhases = [['岁', '运', horseNaYin?.annual], ['运', '岁', horseNaYin?.luck]].flatMap(([source, target, row]) => {
    const pillar = smthPillar(row?.oppositePillar);
    if (!pillar || !chinese(row.naYin) || !/^(长生|沐浴|冠带|临官|帝旺|衰|病|死|墓|绝|胎|养)$/u.test(row.phase)) return [];
    return [source + '柱纳音' + row.naYin + '临' + target + '支' + pillar[1] + '为' + row.phase
      + (row.restrictedBirth === true ? '，整柱' + pillar + '见卷一所列的长生受制例' : '')];
  });
  const horseNaYinRelation = horsePhases.length === 2
    ? direction(horseNaYin.relation, '岁柱纳音' + chinese(horseNaYin.annual.element), '运柱纳音' + chinese(horseNaYin.luck.element)) : '';
  return [
    coincident ? '并临柱的七杀与财官印按同一组位置核对，' + coincident
      : Array.isArray(p.coincidentRoles) ? '并临柱的天干和藏干未见七杀或财官印，刃位另查' : '',
    ...list(p.coincidentBlades).flatMap(row => {
      const basis = { year: '年干', day: '日干' }[row?.basis];
      if (!basis || !chinese(row.stem) || !chinese(row.bladeBranch)) return [];
      const detail = row.jiaType === 'true_blade' ? '卷三引《太乙经》的甲干真刃例'
        : row.jiaType === 'secondary_blade' ? '卷三引《太乙经》的甲干偏刃例' : '';
      return ['本命' + basis + row.stem + '所定的禄前刃位' + row.bladeBranch + '与岁运并临柱' + annual + '同支'
        + [detail, row.jiaHead === '财' || row.jiaHead === '鬼' ? '另见卷三《广信集》具名的刃头' + row.jiaHead + '例' : '',
          row.ziPingDayBlade === true ? '同支亦合子平五阳日干刃位' : row.ziPingDayBlade === false ? '子平五阳日干口径在本阴日干上无刃' : '',
        ].filter(Boolean).map(part => '，' + part).join('')];
    }),
    ...list(p.coincidentBladeReview).flatMap(row => {
      const basis = { year: '年干', day: '日干' }[row?.basis];
      if (!basis || !smthStem(row.stem)) return [];
      const holders = rows => list(rows).flatMap(holder => layers[holder?.position] && smthPillar(holder.pillar)
        ? ['本命' + layers[holder.position] + holder.pillar] : []).join('、');
      const natalBlades = holders(row.natalBladeHolders), natalLu = holders(row.natalLuHolders);
      const sourceNames = { sanming: '《三命通会》', jingji: '《五行精纪》' };
      const jingjiYear = row.jingjiYearBlade;
      const jingjiPillar = smthPillar(jingjiYear?.truePillar);
      return [
        row.repeatedWithLu === true && natalBlades && natalLu ? '按同一本命' + basis + row.stem + '，岁运并临的刃位另见于'
          + natalBlades + '，禄位见于' + natalLu + '，作为重刃见禄的候选' : '',
        ...(row.repeatedWithLuAndOfficerSeal === true ? list(row.officerSealLinks).flatMap(link => {
          const officer = smthSourceRole(link?.officer), seal = smthSourceRole(link?.seal);
          return officer && seal ? ['同一基准下另有明透官印相生，' + officer + '，其干生' + seal] : [];
        }) : []),
        ...list(row.jiaYearSources).flatMap(reading => {
          const source = sourceNames[reading?.edition];
          if (!source || typeof reading.annualTrue !== 'boolean') return [];
          const repeats = holders(reading.natalTrueHolders);
          return ['甲年取刃时，' + source + '所引《太乙经》将并临柱' + annual + '列为' + (reading.annualTrue ? '真刃' : '偏刃')
            + (reading.annualTrue && repeats ? '，该版本的真刃另见于' + repeats : '')];
        }),
        jingjiPillar ? '《五行精纪》卷二十四按本命年干' + row.stem + '取' + jingjiPillar + '为真羊刃，岁运并临柱'
          + annual + (jingjiYear.annualTrue === true ? '符合该真刃' : '仅同刃支') : '',
        jingjiPillar && holders(jingjiYear.natalTrueHolders) ? '按同一读法，本命真刃另见于' + holders(jingjiYear.natalTrueHolders) : '',
      ];
    }),
    ...contacts,
    ...fullPillarCombinations,
    p.repeatYearCompatibleCandidate === true ? '真太岁同段核到日干与岁干相生，岁运干支同向相生，两对均未见已列的克或刑冲破害。相和相顺的实际作用待核' : '',
    p.repeatYearCombinationCandidate === true ? '真太岁同段核到日干与岁干相生，运干与岁干相生，运支与岁支六合，两对均未见已列的克或刑冲破害' : '',
    p.repeatYearVerifiedLuckPillarCombination === true
      ? '已核日岁干支同向相生，实际运柱和岁柱同一对干支俱合，地支未见所列刑冲破害' : '',
    stemGeneration ? '两处天干相生的方向为' + stemGeneration : '',
    luckClashControls ? '同段岁运支见六冲，本对另见' + luckClashControls + '，按〈总论岁运〉分查克向，实际作用待核' : '',
    ...exchangeDetails,
    ...nobles,
    ...smthHorseSeatDescriptions(exchange?.horseSeats, value => positions[value]
      || (text(value).startsWith('natal:') && layers[value.slice(6)] ? '本命' + layers[value.slice(6)] : '')),
    ...horsePhases,
    horseNaYinRelation ? '马位互换时另查纳音五行，' + horseNaYinRelation + '，保留同段克冲，实际作用待核' : '',
    p.repeatYearMutualLuCandidate === true ? '两对柱未见所列牵制，保留互换禄候选，禄马贵人相合或救应仍待核' : '',
    ...list(p.repeatYearMutualContentionAt).flatMap(position => positions[position]
      ? [positions[position] + '与岁柱的同一柱对见刑冲破害，干支克向分属双方'] : []),
    list(p.repeatYearNatalRepeatedStrikeAt).includes('day')
      ? '原局日年两柱已有同对天干四冲与地支六冲，真太岁重复该年柱，符合原文复见的例外条件' : '',
    list(p.repeatYearNatalRepeatedStrikeAt).includes('luck') && p.repeatYearNatalLuckStrikeWitness
      ? '真太岁重见本命年柱，当步大运整柱重见本命时柱，岁运两柱复现原年、时天干四冲及地支六冲' : '',
    contentionPositions.length ? '真太岁关系中，' + contentionPositions.join('和') + '与岁柱有克或刑冲破害的见证，按上文逐对保留' : '',
    combinedContention.length ? combinedContention.join('和') + '各在与岁柱的同一对关系中并见合与克或刑冲破害，合的实际作用待核' : '',
    ...list(p.repeatYearPunishments).flatMap(row => {
      if (!/^(寅巳申|丑戌未)$/u.test(row?.values)) return [];
      const members = list(row.byBranch).map(ids => positions[list(ids)[0]]);
      return members.length === 3 && members.every(Boolean)
        ? ['同段' + members.join('、') + '依次参与' + row.values + '三刑'] : [];
    }),
  ];
}

function smthOfficerMixDescription(p) {
  if (p.profile !== 'smth-volume-seven-officer-mix-v1' || !['正官', '七杀'].includes(p.natalKind)) return '';
  const native = smthSourceRoles(p.nativePositions), repeats = smthSourceRoles(p.sameKind);
  const different = list(p.differentKind);
  const arriving = smthSourceRoles(different.filter(row => row?.placement === 'stem' || row?.placement === 'main_qi'));
  const twoOfficerSeats = p.twoOfficerSeatsWithoutKiller === true && repeats;
  const season = p.continuedSeasonOfficer;
  const continued = smthPillar(season?.priorLuckPillar) && smthSourceRole(season?.role);
  const pureNatal = [
    p.soleOfficerSeatWithoutKiller === true ? '本命只核一处正官，同段岁运透藏均未增加官杀' : '',
    p.twoNatalOfficerSeatsWithoutKiller === true ? '本命两处正官，同段岁运透藏均未增加官杀' : '',
    p.soleKillerSeatWithoutOfficer === true ? '本命只核一处七杀，同段岁运透藏均未增加官杀' : '',
    p.multiplePureNatalKillerSeats === true ? '本命多处均为七杀，同段岁运也未见正官' : '',
  ].filter(Boolean);
  if (!native || (!arriving && !twoOfficerSeats && !continued && !pureNatal.length)) return '';
  const hidden = smthSourceRoles(different.filter(row => row?.placement === 'other_hidden'
    && (row.column !== season?.role?.column || row.stem !== season?.role?.stem)));
  const support = list(p.phaseEvidence).flatMap(row => {
    const stem = smthStem(row?.stem);
    const column = row?.monthSupport === true ? 'month' : row?.hourOnlySupport === true ? 'hour' : undefined;
    const evidence = list(row?.positions).find(position => position?.column === column);
    const phase = ['长生', '临官', '帝旺'].includes(evidence?.phase) ? evidence.phase : '';
    const pillar = smthPillar(evidence?.pillar);
    return stem && column && phase && pillar ? [`${stem}在${smthSourcePosition(column)}${pillar}地支为${phase}${column === 'hour' ? '，该干仅时支符合所核生旺候选' : ''}`] : [];
  });
  return sentences([
    '本命四柱的官煞透藏只检出' + p.natalKind + '，位置为' + native,
    support.length ? '按各星天干查十二运的生旺候选，' + support.join('、') : '',
    arriving ? '实际岁运新增异类官煞，' + arriving : '',
    ...pureNatal,
    continued ? '按卷十所列余气，实际大运由' + season.priorLuckPillar + '进入' + season.role.pillar + '，在当前运支核到' + continued : '',
    twoOfficerSeats ? '实际岁运新增一处正官，' + repeats + '。两处正官，原局与同段岁运透藏未见七杀'
      : repeats ? '同类重现分开记录，' + repeats : '',
    hidden ? '另有非本气的异类藏干，' + hidden : '',
    '这些位置用于核对传统条目的结构，实际取用、制化和关系结果仍待核定',
  ]);
}

function smthSealHurtingDescription(p) {
  if (p.profile !== 'smth-seal-hurting-officer-v1') return '';
  const position = smthSourcePosition, pillar = smthPillar, role = smthSourceRole, roles = smthSourceRoles;
  const seals = roles(p.monthSealCandidates), wealth = roles(p.movingWealth);
  const sealExposures = roles(p.monthSealExposures), natalYearHourWealth = roles(p.natalYearHourWealth);
  const sealContacts = list(p.sealWealthPaths).flatMap(row => {
    const target = role(row?.target), incoming = roles(row?.arrivingWealth), feeding = roles(row?.feedingOfficers);
    const natalYearHour = roles(row?.natalYearHourWealth);
    if (!target) return [];
    const counter = list(row.nativeWealthWithLuckPeers).flatMap(item => {
      const from = role(item?.wealth), peers = roles(item?.peers);
      return from && peers ? [from + '克这处印，' + peers + '又克这处原局财，实际救应待核'] : [];
    });
    const natalPeers = list(row.arrivingWealthWithNativePeers).flatMap(item => {
      const from = role(item?.wealth), peers = roles(item?.peers);
      return from && peers ? ['按〈论印绶〉的比肩例外，原局' + peers + '克同段实际来财' + from + '，该财也克这一处月印，实际救应待核'] : [];
    });
    const relays = list(row.wealthOfficerRelays).flatMap(item => {
      const from = role(item?.wealth), officer = role(item?.officer);
      return from && officer ? [from + '生' + officer + '，同一官杀再生' + target] : [];
    });
    if (!incoming && !natalYearHour && !counter.length && !relays.length) return [];
    return [
      number(row.dutyDay) !== undefined ? '出生月交节后第' + row.dutyDay + '日，此非本气印位有首表司事候选' : '',
      incoming ? incoming + '克' + target + '，实际损印待核' : '',
      natalYearHour ? '原局年时可见的' + natalYearHour + '克同一处' + target : '',
      feeding ? feeding + '同时生同一处印，实际通关待核' : '',
      ...counter.map(text => target + '，' + text),
      ...natalPeers,
      ...relays,
    ];
  });
  const sealLuckAssemblies = list(p.sealLuckWealthAssemblies).flatMap(row => {
    const seats = list(row.positions).map(members => list(members).map(position).filter(Boolean).join('、'));
    const peak = role(row.peak), affected = roles(row.affectedSeals);
    return /^(申子辰|亥卯未|寅午戌|巳酉丑)$/u.test(row.branches) && seats.length === 3 && seats.every(Boolean) && peak && affected
      ? ['大运补齐' + row.branches + '三合财局，三支实位分别在' + seats.join('、') + '。旺支的' + peak + '克' + affected + '，能否变局待核'] : [];
  });
  const hurt = roles(p.natalHurt), officials = roles(p.natalOfficers);
  const supports = list(p.supportedOfficers).flatMap(row => {
    const officer = role(row?.officer);
    const sources = [role(row?.branchSupport), role(row?.monthSupport)].filter(Boolean);
    return officer && sources.length ? [officer + '，与其同元素的支持位置为' + sources.join('、')] : [];
  });
  const damage = list(p.officerDamage).flatMap(row => {
    const columns = list(row?.byBranch).length ? list(row.byBranch).map(group => list(group).map(position).filter(Boolean).join('或'))
      : list(row?.members).map(position);
    return ['相刑', '三刑', '六冲', '六破', '六害'].includes(row?.kind) && /^[子丑寅卯辰巳午未申酉戌亥]{2,3}$/u.test(row.values)
      && columns.length >= 2 && columns.every(Boolean) ? [columns.join('与') + '见' + row.values + row.kind] : [];
  });
  const blades = list(p.movingBlades).flatMap(row => position(row?.column) && pillar(row?.pillar)
    ? [position(row.column) + row.pillar] : []);
  const bladeKiller = list(p.hurtOfficerSeasonalBladeKiller).flatMap(row => {
    const officer = role(row?.officer), killers = roles(row?.killers);
    return officer && killers && blades.length ? ['同段岁运阳刃与实际七杀克日干方向已核，刃位在' + blades.join('、')
      + '，同段来官为' + officer + '，七杀为' + killers] : [];
  });
  const hurtContacts = list(p.hurtOfficerReview).flatMap(row => {
    const source = role(row?.hurt), natal = roles(row?.nativeTargets);
    if (!source || !natal) return [];
    const seals = roles(row.competingSeals);
    return [
      ...list(row.arrivals).flatMap(item => {
        const arrival = role(item?.officer), killers = roles(item?.movingKillers);
        const fedSeals = roles(item?.sealsFedByOfficer);
        const sourceMonthOfficer = role(item?.sourceMonthOfficer);
        const seasonalRoot = role(item?.seasonalOfficerRoot);
        return arrival ? [source + '克原局官位' + natal + '，同一伤官也克' + arrival,
          sourceMonthOfficer ? '来官与' + sourceMonthOfficer + '同干，可按〈论正官〉核月建支持' : '',
          seasonalRoot ? '来官五行按卷二本命月令表为旺，同一来柱的支余气见同干官根' + seasonalRoot : '',
          fedSeals ? arrival + '同时生' + fedSeals + '，这处印又克原局同一伤官' : '',
          killers && blades.length ? '同段刃位在' + blades.join('、') + '，' + killers + '克本命日干，实际作用待核' : ''] : [];
      }),
      seals ? seals + '另克这一处伤官，实际用印待核' : '',
    ];
  });
  const natalWealth = roles(p.natalWealth), roots = roles(p.natalRoots), peers = roles(p.luckPeers);
  const builtLu = p.builtLuMonth === true && p.builtLuPeerWealthCandidate === true;
  const namedBuiltLu = p.builtLuNamedWealthPressure;
  const namedHurting = p.namedHurtingWealthUse === true;
  const hurting = p.hurtingPeerWealthCandidate === true && (Boolean(roots) || namedHurting);
  const wealthPaths = list(p.peerWealthPaths).flatMap(row => {
    const target = role(row?.target), controllers = roles(row?.peers), sources = hurting ? roles(row?.hurtingSources) : '';
    if (!target || !controllers || (!builtLu && !sources)) return [];
    return ['财位在' + target + '，'
      + (sources ? sources + '生这处财，' : '') + controllers + '克这处财，实际分夺待核'];
  });
  const restraints = wealthPaths.length ? list(p.peerOfficerControls).flatMap(row => {
    const peer = role(row?.peer), officers = roles(row?.officers), targets = roles(row?.targets);
    return peer && officers ? [officers + '另克' + peer + (targets ? '，该比劫实际所克的财位是' + targets : '')
      + '，是否形成制劫待核'] : [];
  }) : [];
  return sentences([
    pillar(p.yearPillar) ? '本段立春流年为' + p.yearPillar : '',
    p.luckStatus === 'confirmed' && pillar(p.luckPillar) ? '同段已核大运为' + p.luckPillar
      : p.luckStatus === 'before_luck' ? '本段仍在起运前' : '本段大运尚未核定',
    seals && wealth ? '财印候选所见，' + seals + '，同期财位为' + wealth : '',
    seals && wealth && sealExposures ? '月令同干印的本命透出位置为' + sealExposures : '',
    seals && wealth && natalYearHourWealth ? '另记录本命年时财位作为背景，' + natalYearHourWealth : '',
    ...sealContacts,
    ...list(p.sealSourceSiDutyEarthWealthPaths).flatMap(row => {
      const from = roles(row.arrivingWealth), target = role(row.target), feeding = roles(row.feedingOfficers);
      return from && target ? ['按巳月初段戊司事核实' + from + '克同一处' + target
        + (feeding ? '，另见' + feeding + '生这处戊印' : '')] : [];
    }),
    p.sealSourceWealthLand === true ? '按卷五运入财乡一支，大运支本气的实财克同一月令本气印' : '',
    p.sealSourceAnnualWealthLand === true ? '按卷五岁运同论一支，太岁支本气的实财克同一月令本气印' : '',
    ...list(p.sealNamedLandAnnualWealthPaths).flatMap(row => {
      const seats = list(row?.namedLandPositions).map(seat => position(seat.column) && pillar(seat.pillar)
        ? position(seat.column) + seat.pillar : '').filter(Boolean);
      const incoming = roles(row?.annualWealth), target = role(row?.target);
      return seats.length && incoming && target ? ['乙日亥子月印见原文时运卯辰巳的位证，' + seats.join('、')
        + '。同段' + incoming + '克' + target] : [];
    }),
    ...list(p.sealSourceNatalVisibleWealthPaths).flatMap(({ target, wealth }) => {
      const monthSeal = role(target), natalWealth = roles(wealth);
      return monthSeal && natalWealth ? ['原局年时明透' + natalWealth + '克同一月令正印' + monthSeal
        + '，该段未见已核的官杀生印或比劫制财'] : [];
    }),
    ...sealLuckAssemblies,
    hurt && officials && supports.length ? '本命伤官在' + hurt + '，正官在' + officials + '，岁运官的支撑候选为' + supports.join('。') : '',
    hurt && officials && supports.length && damage.length ? '同段与受支撑官柱相连的地支关系为' + damage.join('、') : '',
    hurt && officials && supports.length && blades.length && roles(p.killers)
      ? '另见日干基准的行运刃位' + blades.join('、') + '与七杀位置，' + roles(p.killers) : '',
    ...list(p.hurtOfficerSourceExceptions).flatMap(row => {
      const hurt = role(row.hurt), water = role(row.water), month = role(row.monthOfficer);
      const arrivals = roles(list(row.arrivals).map(item => item.officer));
      return hurt && water && month && arrivals
        ? ['按卷五秋月甲日例，' + hurt + '与' + water + '同柱，' + month + '当令，从伤官候选中只排除对' + arrivals + '的这一条路径'] : [];
    }),
    ...hurtContacts,
    ...[...list(p.hurtOfficerNamedWuXinYou), ...list(p.hurtOfficerNamedHiddenMonthCases)].flatMap(row => {
      const hurt = role(row?.hurt), natalOfficer = role(row?.natalOfficer);
      const incoming = role(row?.officer), root = role(row?.ownRoot);
      return hurt && natalOfficer && incoming && root ? [hurt + '克' + natalOfficer + '，同一' + row.hurt.stem + '也克'
        + incoming + '，同柱官根实见' + root] : [];
    }),
    ...bladeKiller,
    hurting && natalWealth && roots && peers ? '伤官用财条目待核的原局财位为' + natalWealth
      + '，日干同干藏根为' + roots + '，大运比劫为' + peers : '',
    namedHurting ? '四柱同卷七所列的伤官用财原例。本段只核同一处本命财位所受的生克' : '',
    hurting && number(p.monthHurtDutyDay) !== undefined ? '出生月交节后第' + p.monthHurtDutyDay
      + '日，非本气伤官是人元司事首表的候选' : '',
    builtLu ? '月支与日干禄位相同，以下为建禄与当段比劫所及的财位' : '',
    namedBuiltLu ? '〈建禄不富〉原图的壬寅运核实' + role(namedBuiltLu.peer) + '克' + role(namedBuiltLu.wealth)
      + '，同时本命年巳与运寅实见相刑' : '',
    p.builtLuNoWealthOfficerWithPeer === true && peers
      ? '月支与日干禄位相同，原局透藏未见财、正官及七杀，同段大运见' + peers : '',
    p.builtLuSourceNoWealthOrOfficer === true ? '按卷六建禄该支复核，同段岁柱与大运的透藏也均无财、正官和七杀' : '',
    ...wealthPaths, ...restraints,
    '月令取用、强弱和实际制化或救应仍待核定',
  ]);
}

function schoolAnnualSupportDescription(p) {
  const annual = smthPillar(p.annualPillar);
  if (!annual || !/^[子丑寅卯辰巳午未申酉戌亥]$/u.test(p.birthBranch)) return [];
  const routes = list(p.examSupportRoutes);
  const nobleGroup = p.annualNobleGroup;
  const natalMembers = list(nobleGroup?.natalMembers).flatMap(row => ['month', 'day', 'hour'].includes(row?.position)
    && smthStem(row.stem) ? ['本命' + layers[row.position] + '透' + row.stem] : []);
  return [
    p.annualFamilyLu === true && p.birthBranch === p.annualStemLuBranch
      ? '岁干' + annual[0] + '的禄位在本命年支' + p.birthBranch + '，按《五行精纪》核为本家禄'
        + (routes.includes('annual-family-lu') ? '，与当段年干基准官位同见' : '') : '',
    nobleGroup?.annualCompletesGroup === true && /^[甲乙丙丁戊己庚辛壬癸]{2,3}$/u.test(nobleGroup.requiredStemPool) && natalMembers.length
      ? '按本命年支' + p.birthBranch + '所查的天乙干组为' + nobleGroup.requiredStemPool + '。' + natalMembers.join('、')
        + '，岁干' + annual[0] + '补足第二种天干'
        + (routes.includes('annual-noble-group') ? '，与当段年干基准官位同见' : '') : '',
  ];
}

export function describeFortuneFact(fact, at) {
  const p = fact.data ?? {};
  if (fact.method === 'bazi') {
    switch (fact.type) {
      case 'zpqz_officer_context': return officerDescription(p, at);
      case 'zpqz_wealth_context': return wealthDescription(p, at);
      case 'zpqz_killer_order_context': return killerOrderDescription(p, at);
      case 'zpqz_food_killer_context': return foodKillerDescription(p, at);
      case 'zpqz_seal_food_context': return sealFoodDescription(p, at);
      case 'zpqz_month_command': return monthCommandDescription(p, at);
      case 'smth_seal_hurting_context': return smthSealHurtingDescription(p);
      case 'smth_officer_mix_context': return smthOfficerMixDescription(p);
      case 'annual_column_relations': {
        if (p.profile !== 'smth-annual-column-relations-v1') return '';
        const position = value => value === 'luck' ? '同段已核大运' : value === 'annual' ? '本段太岁' : layers[value] ? '本命' + layers[value] : '';
        const positions = values => list(values).map(position).filter(Boolean).join('、');
        const branch = { 'both-present': '已知位置同时见透出庚辛与透出癸', 'metal-only': '已知范围仅见透出庚辛而未见透出癸',
          'gui-only': '已知范围仅见透出癸而未见透出庚辛', 'neither-present': '已知范围两类透干都未见' }[p.witnessBranch];
        return sentences([
          '本条将同一候选的本命各柱分别与同一实际年段太岁成对比较，不跨柱拼合',
          chinese(p.natalDay) && chinese(p.yearPillar) ? '本命日柱为' + p.natalDay + '，太岁为' + p.yearPillar : '',
          p.natalDay === '癸巳' && p.yearPillar === '丁亥' && p.dayControlsYear === true && p.dayBranchClash === true
            ? '本命日干癸水克岁干丁火，日支巳与岁支亥六冲，同一对柱符合原文所举征太岁例。现实影响仍取决于其他条件' : '',
          chinese(p.yearTenGod) ? '太岁干相对日主为' + p.yearTenGod : '',
          ...list(p.pairs).flatMap(row => position(row.position) && chinese(row.pillar) ? [sentences([
            position(row.position) + row.pillar + '与太岁逐柱核对',
            row.stemCombine === true ? '本命干与岁干' + chinese(row.stemPair) + '五合' : '本命干与岁干没有五合',
            row.branchCombine === true ? '本命支与岁支' + chinese(row.branchPair) + '六合' : '本命支与岁支没有六合',
            row.bothCombine === true ? '两种合同时落在这一柱' : '',
            row.natalStemControlsYear === true ? '本命干克岁干' : '', row.yearControlsNatalStem === true ? '岁干克本命干' : '',
            row.branchClash === true ? '本柱与岁支六冲' : '', row.branchHarm === true ? '本柱与岁支六害' : '',
            row.branchPunishment === true ? '按所列两支存在刑的位置关系，不等于完整三刑或作用已成' : '',
          ])] : []),
          p.hasDayOrHourStemCombine === true ? '本命日干或已知时干确实参与岁干五合；仅年干或月干参与不能替代此条件'
            : p.hasDayOrHourStemCombine === false ? '已知日干与时干均未参与岁干五合' : '时干未核且日干未见岁干五合，不能据此断言日时干均无合',
          p.hasSameColumnDoubleCombine === true ? '本命干支俱合发生于' + positions(p.sameColumnCombines)
            : p.hasSameColumnDoubleCombine === false ? '四柱逐一核对后，没有同一柱同时满足干合与支合；分散在不同柱不算干支俱合'
              : '已知柱未见干支俱合，未知时柱不能当作已经排除',
          p.timeKnown === false ? '时刻未知，不读取采样时柱，所有未见判断限于已知范围' : '',
          ...smthYearCombineDescription(p, position),
          p.luckStatus === 'confirmed' && p.luckAnnualCombination === 'stem-only' ? '本段大运与太岁仅天干五合'
            : p.luckStatus === 'confirmed' && p.luckAnnualCombination === 'branch-only' ? '本段大运与太岁仅地支六合' : '',
          number(p.dayToYearSexagenarySteps) !== undefined ? '从日柱到岁柱按六十干支顺推' + p.dayToYearSexagenarySteps
            + '位，反向' + p.yearToDaySexagenarySteps + '位；地支顺推' + p.dayToYearBranchSteps
            + '位；这些只是循环坐标，不擅定原文日前五辰、岁位远近或入宅取法' : '',
          p.luckStatus === 'confirmed' && chinese(p.luckPillar) ? '同段大运已按完整归档表唯一核验，为' + p.luckPillar
            : p.luckStatus === 'before_luck' ? '同段尚未交首步正式大运，不虚造一个运柱'
              : '正式大运未唯一核验，不从多个候选中选有利的一步，未见的大运条件保持未知',
          p.stageStart && p.stageEnd ? '该大运或童限完整段为' + at(p.stageStart) + '至' + at(p.stageEnd) + '，截止不计入' : '',
          ...(p.dayMaster === '甲' && p.yearStem === '戊' ? [
          ...smthJiaWuRescueDescription(p, position),
          positions(p.natalGengShenPositions) ? '本命完整庚申柱在' + positions(p.natalGengShenPositions)
            : '已知本命柱未见完整庚申，不将分柱庚与申拼成庚申柱',
          p.luckGengShen === true ? '当前已核大运也是完整庚申柱' : '',
          ...list(p.exposedMetal).flatMap(row => position(row.position) && chinese(row.stem) ? [position(row.position)
            + '透' + row.stem + '，同一已知范围的藏金根位为' + (positions(row.roots) || '暂未见')
            + '；透干与根位只是结构，不证明金已制伏甲木'] : []),
          positions(list(p.exposedGui).map(row => row.position)) ? '透出癸在' + positions(p.exposedGui.map(row => row.position))
            + '，可与戊作五合位置见证；不证明已合解或化火' : '已知范围未见透出癸，若时柱或大运未核，不判断全局没有',
          positions(list(p.hiddenGui).map(row => row.position)) ? '另有仅按支藏检索的癸位在' + positions(p.hiddenGui.map(row => row.position))
            + '；支藏与透出分开，不借藏干补成原文一癸字的实际参与' : '',
          ...list(p.metalGroups).map(row => '原局及当前已核大运的巳酉丑成员为' + list(row.byBranch).map((values, i) => '巳酉丑'[i]
            + '在' + positions(values)).join('；') + '；成员齐备不等于金局已化或制木生效'),
          branch ? '仅按透干见证分类：' + branch + '；这一分类不表示原文救应分支已生效' : '透干见证仍有未知位置，不将缺项划成仅有一种或两者皆无',
          '甲日戊岁条的制与合分别保存，庚申整柱、透出庚辛和癸、支藏及金支成员不互相替代',
          ] : []),
          ...list(p.sourceRelations).flatMap(row => list(row.members).includes('luck') && chinese(row.kind) && list(row.members).every(position)
            ? [row.members.map(position).join('与') + '有' + row.kind + '的位置关系'] : []),
          '干支相合不等于合化、有用或相憎已经确定，不推断人口、婚育、疾病或离合事件',
        ]);
      }
      case 'zpqz_stem_order': return zpqzStemDescription(p, at);
      case 'zpqz_moving_relations': return zpqzMovingDescription(p, at);
      case 'zpqz_luck_context': return zpqzDescription(p, at);
      case 'minor_luck_context': {
        const variant = { 'zuixing-hour-year-direction': '醉醒子时柱起、随年与已核方案定顺逆的候选法',
          'fixed-bingyin-renshen': '男起丙寅顺、女起壬申逆的固定起点候选法',
          'female-bingshen-opening-reading': '开头女起丙申异文按逆排保留的审查对照，不能冒充定本' }[p.variant];
        if (p.profile !== 'smth-minor-luck-alternatives-atomic-v1' || !variant) return '';
        const position = value => value === 'annual' ? '本段太岁' : value === 'minor' ? '本段小运'
          : value === 'luck' ? '同段大运' : text(value).startsWith('natal:') ? (layers[value.slice(6)] ? '本命' + layers[value.slice(6)] : '') : '';
        const p245Observed = p.confirmed === true && p.hasMajorLuck === true
          && p.p245MatchProfile === 'smth-p245-independent-contacts-and-shared-support-v1';
        const weakBases = list(p.majorLuckHistory?.weakBases).flatMap(basis => basis === 'year-nayin' ? ['年命纳音']
          : basis === 'day-stem' ? ['本命日干'] : []);
        const favorable = list(p.majorLuckHistory?.favorableBases).map(basis => smthFavorableMajorLuckNames.get(basis)).filter(Boolean);
        const sharedSupport = [p.hasSharedSourceSupport, p.hasSharedCanopySupport, p.hasSharedNobleCombinationSupport,
          p.hasSharedMoonVirtueSupport, p.hasSharedHeavenVirtueSupport, p.hasSharedYanNobleCombinationSupport].includes(true);
        const bathingBlade = p.majorLuckHistory?.bathingBladeReview?.candidate === true;
        const bathingJieWang = p.majorLuckHistory?.bathingJieWangReview?.candidate === true;
        const namedPressure = list(p.majorLuckHistory?.namedAdverseExamples).some(row => row.sourceCase === 'bing-zi-to-ren-yin');
        const targetText = rows => list(rows).flatMap(row => position(row.target) && chinese(row.pillar) && chinese(row.kind)
          ? [position(row.target) + row.pillar + '的' + row.kind] : []).join('、');
        const annualHarm = targetText(p.harmEvidence?.annual), minorHarm = targetText(p.harmEvidence?.minor);
        const agreedMinorOnlyHarm = targetText(p.p245Agreement?.minorOnlyHarm);
        const details = (value, label) => sentences([
          chinese(value?.tenGod) ? label + '干十神为' + value.tenGod : '',
          chinese(value?.mainQiTenGod) ? label + '支本气十神为' + value.mainQiTenGod : '',
          chinese(value?.naYin) ? label + '纳音为' + value.naYin : '',
          chinese(value?.standardDayPhase) ? label + '按现行引擎日干阶段为' + value.standardDayPhase + '，不等于来源生旺吉神已经成立' : '',
          value?.atDayLu === true ? label + '支到日干禄位' : '', value?.atYearLu === true ? label + '支到年干禄位' : '',
          value?.atYearHorse === true ? label + '支到本命年支三合局的驿马位；这不自动构成吉马' : '',
        ]);
        return sentences([
          '以下是同一本命候选、同一实际时段的小运版本对照，每种方法分别计算，不拼接版本；共用的本命与太岁不重复计权', variant,
          number(p.birthYearLabel) !== undefined && number(p.yearLabel) !== undefined && number(p.ordinal) !== undefined
            ? '候选计龄按北京立春年标签：生年为' + p.birthYearLabel + '，本段为' + p.yearLabel + '，出生年作第一年，本段为第' + p.ordinal + '年' : '',
          p.calendarVerified === true ? '来源计龄边界另有核验' : '立春换序只是明示候选约定，该书计龄边界仍未核定，不当成确定原法',
          chinese(p.annualPillar) && chinese(p.minorPillar) ? '本段太岁为' + p.annualPillar + '，本版小运为' + p.minorPillar : '',
          p.hasMajorLuck === true && chinese(p.luckPillar) ? '同段大运为' + p.luckPillar : '本段尚未交入第一步正式大运，不能虚造大运柱',
          ...(p245Observed ? smthP245MajorHistoryDescription(p.majorLuckHistory, at) : []),
          p245Observed && namedPressure ? '卷二所列丙子生年行壬寅运，实际运壬克年丙，原文将其列为牵制'
            + (favorable.length ? '。另核同一步大运的吉乡依据为' + favorable.join('、') + '，两项作用分别保留' : '') : '',
          ...(p245Observed && sharedSupport ? [
            weakBases.length ? '按' + weakBases.join('和') + '的长生取法，本段未历长生且实际岁运同对见刑冲克破，并见太岁与本版小运的共同支持，实际根基和扶救仍待核' : '',
            bathingBlade ? '本段入败地后见同对刑克和羊刃，并见太岁与本版小运的共同支持，实际根基和扶救仍待核' : '',
            bathingJieWang ? '本段入败地后见岁运同对刑克及劫煞或亡神实位克年，并见太岁与本版小运的共同支持，实际根基和扶救仍待核' : '',
            namedPressure ? '此版同段太岁和小运均有原书同源支持，作为丙子壬寅牵制的缓和证据' : '',
            !namedPressure && !weakBases.length && !bathingBlade && !bathingJieWang
              ? '本段可见太岁与本版小运的共同支持，未见所查的未历长生兼岁运刑冲克破，或入败地兼刑克与实位恶煞' : '',
          ] : []),
          p.confirmed === true ? '本次顺逆方案依据来自唯一吻合的归档十步大运表，不从其他方法借性别' : '顺逆方案未唯一核验，只作条件候选',
          ['forward', 'backward'].includes(p.direction) ? '本版小运按' + (p.direction === 'forward' ? '顺排' : '逆排') + '逐年排位' : '',
          chinese(p.dayLuBranch) && chinese(p.yearLuBranch) ? '日干禄位为' + p.dayLuBranch + '，年干禄位为' + p.yearLuBranch + '，两个基准分别记录' : '',
          chinese(p.yearHorseBranch) ? '按本命年支三合局核得驿马支位为' + p.yearHorseBranch : '',
          details(p.annual, '太岁'), details(p.minor, '小运'),
          ...list(p.yanNobleCombinationReview).flatMap(row => {
            const label = { day: '日干', year: '年干' }[row?.basis];
            const seats = list(row?.seats);
            if (!label || !smthStem(row.stem) || seats.length !== 2
              || !seats.every(seat => position(seat?.position) && smthPillar(seat.pillar))) return [];
            const obstructions = seats.flatMap(seat => list(seat.obstructions).map(item => item?.kind).filter(chinese));
            const vacant = seats.some(seat => list(seat.voidSources).length);
            return [seats.map(seat => position(seat.position) + seat.pillar).join('与') + '同列于同一' + label + row.stem + '的两柱贵合'
              + (row.candidate === true ? '，两实位均已核无空冲破'
                : obstructions.length || vacant ? '，实际受阻于' + [...new Set([...obstructions, ...(vacant ? ['空亡'] : [])])].join('、') : '')];
          }),
          ...[['annualContacts', '太岁'], ['minorContacts', '本版小运']].flatMap(([key, label]) => list(p[key]).flatMap(row =>
            position(row.target) && chinese(row.kind) ? [label + '与' + position(row.target) + '存在' + row.kind + '结构，不据关系出现断定损伤或喜忌'] : [])),
          list(p.jointNatalHarmTargets).map(position).filter(Boolean).length ? '本版太岁与小运各自的刑或害共同涉及'
            + p.jointNatalHarmTargets.map(position).filter(Boolean).join('、') + '；不把不同方法的参与对象拼成同见' : '',
          p245Observed && annualHarm && minorHarm ? '太岁与小运各自有独立刑害位置。太岁见' + annualHarm + '。小运见' + minorHarm : '',
          p245Observed && p.majorLuckHistory?.favorableConflict === true
            ? '同段同时见吉乡结构与水命牵制例，保留实际见证，该段暂不进入已核吉乡条件' : '',
          p245Observed && annualHarm && minorHarm ? favorable.length
            ? '本段符合〈论大运〉所查吉乡条件，依据为' + favorable.join('、') + '，并见太岁与本版小运各自的刑害，实际轻重仍待核'
            : '本段太岁、小运的独立刑害已核，未见可计入的吉乡条件' : '',
          p245Observed && agreedMinorOnlyHarm
            ? '两种计龄一致期间，各法小运均见' + agreedMinorOnlyHarm + '，太岁没有同类刑害。此支对应〈论大运〉的一种断读'
            : p245Observed && !annualHarm && minorHarm ? '目前见小运对' + minorHarm + '。原句另一种断读及其作用仍待核' : '',
          p245Observed && list(p.harmEvidence?.mutual).filter(chinese).length
            ? '太岁和小运之间另有' + p.harmEvidence.mutual.filter(chinese).join('、') + '，与各自涉及本命或大运的位置分开记录' : '',
          ...(p245Observed ? list(p.commonStemSupport).flatMap(row => ['year', 'day'].includes(row.basis) && chinese(row.stem) ? [
            '同以本命' + (row.basis === 'year' ? '年干' : '日干') + row.stem
            + '为基准，太岁支到' + list(row.annual).filter(chinese).join('、') + '，小运支到' + list(row.minor).filter(chinese).join('、')
            + ([...list(row.annual), ...list(row.minor)].includes('天乙') && ['阳贵', '阴贵'].includes(p.nobleSeason)
              ? '。天乙按卷三通玄经一说，以出生时的冬夏至取' + p.nobleSeason + '，本条采用的贵人取法仍待核' : ''),
          ] : []) : []),
          ...(p245Observed ? smthP245DirectNobleDescriptions(p.directNobleReview, position) : []),
          p245Observed && p.commonHorseSupport === 'same_horse_position' && chinese(p.yearHorseBranch)
            ? '太岁支与本版小运支均在本命年支驿马位' + p.yearHorseBranch : '',
          p245Observed && p.commonHorseSupport === 'both_combine_with_horse' && chinese(p.yearHorseBranch) && chinese(p.yearHorseCombineBranch)
            ? '太岁支与本版小运支均在' + p.yearHorseCombineBranch + '，分别六合本命年支驿马位' + p.yearHorseBranch : '',
          p245Observed && p.commonHorseSupport === 'stem_and_branch_combine_with_horse' && chinese(p.yearHorseBranch)
            ? '太岁与本版小运一方坐驿马' + p.yearHorseBranch + '，另一方同时五合它的天干、六合它的地支，构成同段干支合马' : '',
          ...(p245Observed ? [['annual', '太岁'], ['minor', '本版小运']].flatMap(([key, label]) => {
            const horseClass = p.horseEvidence?.[key];
            return chinese(horseClass?.name) ? [label + '坐驿马的干支按卷三列为' + horseClass.name
              + (horseClass.supportUnverified === true ? '，这一马类单独不能支持岁与小运共同得助' : '，实际清浊和作用仍待核')] : [];
          }) : []),
          ...(p245Observed ? smthHorseSeatDescriptions(p.horseEvidence?.seats, position, list(p.horseEvidence?.blockedPositions)) : []),
          ...(p245Observed ? smthP245CanopyDescription(p.canopyReview, position) : []),
          ...(p245Observed ? smthP245NobleCombinationDescriptions(p.nobleCombinationReview, position) : []),
          ...(p245Observed ? smthP245StemVirtueDescription(p.moonVirtueReview, '月德', position) : []),
          ...(p245Observed ? smthP245StemVirtueDescription(p.heavenVirtueReview, '天德', position) : []),
          ...(p245Observed ? smthP245HeavenVirtueDirectionDescription(p.heavenVirtueDirectionReview) : []),
          ...list(p.threePunishments).flatMap(row => chinese(row.branches) ? ['另有三刑地支' + row.branches + '，参与位置按支位分列：'
            + list(row.participants).map(group => list(group).map(position).filter(Boolean).join('、')).filter(Boolean).join('；')] : []),
          p.stageStart && p.stageEnd ? '本段所处运阶完整范围为' + at(p.stageStart) + '至' + at(p.stageEnd) + '，截止时刻不计入；小运不在大运交接时重置' : '',
          '来源取法、适用刑害对象、原局取用、贵人及其他条件的有效组合仍待核。盘面位置只用于核结构',
        ]);
      }
      case 'school_context': return p.profile !== 'smth-school-alternatives-atomic-v1' ? '' : sentences([
        '以下学堂取法分别核对，属于同一本命候选和同一步实际大运，不合并为一个神煞',
        chinese(p.dayMaster) ? '日主为' + p.dayMaster : '',
        list(p.fourBirthPositions).filter(layer => layers[layer]).length ? '宽取寅申巳亥四生宫，本命在' + p.fourBirthPositions.map(layer => layers[layer]).filter(Boolean).join('、') + '见到'
          : p.fourBirthAbsent === true ? '本命完整四柱均不见寅申巳亥四生宫' : '未在已知柱位见到四生宫，缺时柱时不能断言全局不带学堂',
        chinese(p.yearNaYin) && chinese(p.yearNaYinSchoolBranch) ? '以年柱纳音' + p.yearNaYin + '另核五行长生支位为' + p.yearNaYinSchoolBranch : '',
        list(p.naYinPositions).filter(layer => layers[layer]).length ? '纳音长生支位出现在' + p.naYinPositions.map(layer => layers[layer]).filter(Boolean).join('、')
          + '；其中本柱纳音也与年命同五行的柱位为' + (list(p.sameNaYinPositions).map(layer => layers[layer]).filter(Boolean).join('、') || '无') : '',
        chinese(p.standardDayStartBranch) ? '现行引擎日干长生对照支位为' + p.standardDayStartBranch + '，月时查见位置为'
          + (list(p.standardDayMonthHourPositions).map(layer => layers[layer]).filter(Boolean).join('、') || '已知月时未见') : '',
        chinese(p.directSourceDayStart) ? '《三命通会》卷二所列本日干长生在' + p.directSourceDayStart
          + (p.directSourceDayStartAgrees === true ? '，与本次引擎对照相同' : '，与引擎对照有异')
          + '，月时见位为' + (list(p.daySourcePositions).map(layer => layers[layer]).filter(Boolean).join('、') || '已知月时未见') : '',
        p.sourceLuckAtDayStart === true ? '本步运支到了同书日干长生位' : '',
        chinese(p.luckPillar) ? '本步大运为' + p.luckPillar + (chinese(p.standardLuckPhase) ? '，按现行引擎日干阶段为' + p.standardLuckPhase : '') : '',
        p.confirmed === true ? '本步已由归档十步表唯一核验' : '本步起运方案尚未唯一核验',
        p.stageStart && p.stageEnd ? '本步完整大运为' + at(p.stageStart) + '至' + at(p.stageEnd) + '，截止时刻不计入' : '',
        number(p.entryCompletedCivilYears) !== undefined ? '精确交运时按' + (p.entryCivilClock === 'birthplace' ? '出生地民用生日' : '东八区民用生日')
          + '已满' + p.entryCompletedCivilYears + '周岁。原文五七岁的计龄仍待核' : '',
        ...list(p.witnesses).flatMap(w => {
          const variant = { four_birth_palaces: '四生宫宽取', year_nayin_birth: '年命纳音长生', day_month_hour_comparison: '引擎日干月时对照' }[w.variant];
          if (!variant || !layers[w.position] || !chinese(w.pillar)) return [];
          const position = value => value === 'luck' ? '本步大运' : layers[value];
          return [sentences([variant + '见本命' + layers[w.position] + w.pillar,
            '按年柱旬空核' + (w.natalYearVoid === true ? '落空' : '不落空') + '，按日柱旬空核' + (w.natalDayVoid === true ? '落空' : '不落空') + '，两种基准不合并',
            ...list(w.branchContacts).flatMap(r => position(r.other) && chinese(r.kind) ? ['与' + position(r.other) + '存在' + r.kind + '结构'] : []),
            list(w.stemControls).map(position).filter(Boolean).length ? '对该柱天干形成五行克关系的柱位为' + w.stemControls.map(position).filter(Boolean).join('、') : '',
            list(w.naYinControls).map(position).filter(Boolean).length ? '对该柱纳音形成五行克关系的柱位为' + w.naYinControls.map(position).filter(Boolean).join('、') : ''])];
        }),
        '这些位置、旬空与克关系不等于学堂已经受损或得用；取法、五七岁年龄含义、气势及扶救仍须独立核验，不据此断定学历、考试成败或识字能力',
      ]);
      case 'school_entry_context': return p.profile !== 'smth-school-exact-entry-five-seven-age-comparisons-v2' || !fact.exactAt ? '' : sentences([
        '在' + at(fact.exactAt) + '实际交入' + p.luckPillar + '运'
          + (p.sourceLuckPhase === '长生' ? '，运支为' + p.dayMaster + '日干的长生位' + p.directSourceDayStart : ''),
        ['沐浴', '死'].includes(p.sourceLuckPhase) && p.dayLongevityAbsent === true
          ? '按同书日干十二宫，实际入运为' + (p.sourceLuckPhase === '沐浴' ? '沐浴（败）' : '死')
            + '，本命四柱地支均未见日干长生位。原书将此另论' : '',
        '交运时按' + (p.civilClock === 'birthplace' ? '出生地民用生日' : '东八区民用生日') + '已满' + p.civilYears + '周岁',
        '按北京立春换年自出生年起计为第' + p.liChunOrdinal + '年，按北京农历新年换年为第' + p.lunarOrdinal + '年',
        ...list(p.luckSchoolContacts).flatMap(row => ['六冲', '六破', '相刑'].includes(row?.kind) && layers[row.position] && smthPillar(row.pillar)
          ? ['这一步长生运与本命' + layers[row.position] + row.pillar + '构成' + row.kind] : []),
        ...list(p.nobleSchoolWitnesses).flatMap(row => ['day', 'hour'].includes(row?.position) && smthPillar(row.pillar)
          ? [smthSourcePosition(row.position) + row.pillar + '符合卷三具名学堂会贵，排除原局未带学堂的条件'] : []),
        p.sourceLuckSchoolClashOrBreak === true ? '所交长生运柱实际受到冲或破，排除无冲破的长生运候选' : '',
        p.sourceLuckSchoolSelfPunishment === true ? '所交长生运支与本命同支构成自刑，排除这项长生运学堂候选' : '',
        ...list(p.luckSchoolChecks?.voidSources).flatMap(row => ['year', 'day'].includes(row?.basis) && smthPillar(row.xun)
          ? ['按本命' + (row.basis === 'year' ? '年柱' : '日柱') + '所属' + row.xun + '旬，实际长生运支落旬空'] : []),
        ...list(p.luckSchoolChecks?.controls).flatMap(row => {
          const parts = list(row?.parts).map(part => ({ stem: '天干', branch: '地支五行', nayin: '纳音' })[part]).filter(Boolean);
          return layers[row?.position] && smthPillar(row.pillar) && parts.length
            ? ['本命' + layers[row.position] + row.pillar + '的' + parts.join('、') + '对实际运柱构成相克'] : [];
        }),
        p.luckSchoolChecks?.natalColumnsComplete === false ? '本命柱有缺项，克制只列已核柱位' : '',
        p.luckSchoolChecks ? '旬空、相克实际是否起作用及救应仍待核' : '',
        '各年龄只与原文五或七作字面对照。原文年龄口径、无学堂取法与实际作用仍待核验',
      ]);
      case 'school_exam_context': return p.profile !== 'smth-school-exam-atomic-v1' ? '' : sentences([
        chinese(p.natalMonth) && chinese(p.annualPillar) ? '本生月建为' + p.natalMonth + '，本段太岁为' + p.annualPillar : '',
        list(p.monthRelations).filter(chinese).length ? '这同一对柱有' + p.monthRelations.filter(chinese).join('、') : '',
        ...list(p.monthElements).flatMap(row => {
          const relation = { 前生后: '月建生太岁', 后生前: '太岁生月建', 前克后: '月建克太岁', 后克前: '太岁克月建', 同五行: '月建与太岁同五行' }[row?.kind];
          return relation ? [(row.part === 'stem' ? '天干' : '地支') + relation] : [];
        }),
        chinese(p.monthNayin) && chinese(p.annualNayin) ? '本生月建纳音为' + p.monthNayin + '，太岁纳音为' + p.annualNayin : '',
        p.monthPairAssessment === 'same-direction-generation' && ['month-to-annual', 'annual-to-month'].includes(p.monthGenerationDirection)
          ? (p.monthGenerationDirection === 'month-to-annual' ? '月建的天干和地支分别生太岁的天干和地支' : '太岁的天干和地支分别生月建的天干和地支')
            + (p.corroboratedMonthGeneration === true ? '，纳音同向相生，同对也未见所列刑冲破害'
              : '，同对未见所列刑冲破害，记录为月建相和候选') : '',
        ['stem-branch-combination', 'combination-with-friction'].includes(p.monthPairAssessment)
          ? '同一对柱干支俱合，可以核对书中月建相和的候选结构' : '',
        p.verifiedMonthBranchCombination === true ? '同一岁月对只见地支六合，天干未见冲克，地支未见所列刑冲破害' : '',
        p.verifiedMonthStemCombination === true ? '同一岁月对有天干五合，两支同气，未见所列刑冲破害' : '',
        p.monthPairAssessment === 'generation-with-friction' && list(p.monthBranchFriction).filter(chinese).length
          ? '同对岁月柱虽干支同向相生，仍见' + p.monthBranchFriction.filter(chinese).join('、') + '，实际作用待核' : '',
        p.monthHarmonyCandidate === true && list(p.monthBranchFriction).filter(chinese).length
          ? '同对岁月柱兼见' + p.monthBranchFriction.filter(chinese).join('、') + '，合解及相和是否得用仍待核' : '',
        p.confirmed === true && chinese(p.luckPillar) ? '本段唯一已核大运为' + p.luckPillar : '',
        p.stageStart && p.stageEnd && p.confirmed === true ? '本步大运从' + at(p.stageStart) + '至' + at(p.stageEnd) + '前' : '',
        chinese(p.birthNayin) && chinese(p.sealPillar) ? '年命纳音为' + p.birthNayin + '，卷三取' + p.sealPillar + '为正库印，当前太岁'
          + (p.nayinStorehouseSeal === true ? '整柱符合' : '整柱未到该位') : '',
        p.nayinSealVoidBoth === true ? '太岁这处正库印同时落在本命年旬、日旬的空亡，从科名候选中扣除这项纳音库印支持' : '',
        ...list(p.nayinSealVoidSources).flatMap(row => ['year', 'day'].includes(row?.basis) && smthPillar(row.xun)
          ? ['本命' + (row.basis === 'year' ? '年柱' : '日柱') + '所属' + row.xun + '旬的空亡包含此太岁支'] : []),
        ...list(p.nayinSealVoidCombinations).flatMap(row => pillarName('natal:' + row.position) && smthPillar(row.pillar)
          ? ['落空的库印岁支与' + pillarName('natal:' + row.position) + row.pillar + '的地支实际六合，是否有救助仍待核'] : []),
        p.nayinSealNamedPunishment?.birthPillar === '庚戌' && p.nayinSealNamedPunishment?.annualPillar === '乙丑'
          ? '庚戌年命见乙丑，戌丑相刑，按卷三具名自刑印扣除年命纳音正印支持' : '',
        p.nayinSealSameElementPunishment && [p.nayinSealSameElementPunishment.birthPillar,
          p.nayinSealSameElementPunishment.annualPillar, p.nayinSealSameElementPunishment.branches,
          p.nayinSealSameElementPunishment.element].every(chinese)
          && p.nayinSealNamedPunishment === undefined
          ? p.nayinSealSameElementPunishment.birthPillar + '年命见' + p.nayinSealSameElementPunishment.annualPillar
            + '，' + p.nayinSealSameElementPunishment.branches + '相刑，同属'
            + p.nayinSealSameElementPunishment.element + '纳音，按卷三扣除这项年命正库印支持' : '',
        ...list(p.nayinSealNatalDamage).flatMap(row => {
          const label = pillarName('natal:' + row?.position);
          if (!label || !smthPillar(row.natalPillar) || !smthPillar(row.annualPillar)
            || !['相刑', '六冲', '六破', '六害'].includes(row.kind)
            || (row.position === 'year' && row.kind === '相刑' && p.nayinSealSameElementPunishment)) return [];
          return ['岁库印' + row.annualPillar + '与' + label + row.natalPillar + '地支有' + row.kind + '，按〈论正印〉另查这处库印的受损条件'];
        }),
        chinese(p.annualStemTenGod) ? '岁干按日主核为' + p.annualStemTenGod + '，与年命纳音取印分列' : '',
        chinese(p.season) && p.seasonStart ? '按出生的冬至夏至界' + at(p.seasonStart) + '起取' + p.season : '',
        ...list(p.bases).flatMap(row => {
          if (!row || !['year', 'day'].includes(row.basis) || !chinese(row.officerBranch) || !chinese(row.luBranch)) return [];
          const branchLabels = { 正印: row.basis === 'year' ? '纳音正库印' : '岁干十神正印', 天乙: '所核季节天乙支', 禄: '本家禄支候选' };
          const supports = list(row.supports).map(value => branchLabels[value]).filter(Boolean);
          return [sentences([
            '以' + (row.basis === 'year' ? '年干' : '日干') + row.stem + '查官贵临官在' + row.officerBranch
              + '，禄支在' + row.luBranch,
            chinese(row.chosenNobleBranch) ? '本季天乙支为' + row.chosenNobleBranch : '',
            row.officerContact === true && supports.length ? '本步同一基准的官位与当年支持同时可核，支持为' + supports.join('、') : '',
          ])];
        }),
        list(p.documentedSupports).filter(chinese).length && chinese(p.birthBranch) && smthPillar(p.annualPillar)
          ? '本命年支' + p.birthBranch + '见岁干' + p.annualPillar[0] + '，对应'
            + p.documentedSupports.filter(chinese).join('、')
            + (list(p.examSupportRoutes).includes('documented-year-support') ? '，与当段年干基准官位同见' : '') : '',
        ...schoolAnnualSupportDescription(p),
        list(p.examSupportRoutes).includes('nayin-office') && chinese(p.nayinOffice?.linguanBranch) && chinese(p.nayinOffice?.luckNayin)
          ? '按年命纳音核词馆正位在' + p.nayinOffice.linguanBranch + '，当段运柱同纳音五行，为' + p.nayinOffice.luckNayin
            + '，同段岁层支持为' + list(p.nayinOffice.supports).filter(chinese).join('、') : '',
        p.corroboratedNobleAtOffice === true ? '年干官位与年命纳音词馆同段成立，岁干天乙干组与季节天乙实位均有见证' : '',
        p.corroboratedFamilyLuAtOffice === true ? '年干官位与年命纳音词馆同段成立，岁干本家禄位与出生年支一致' : '',
        '这些是原书科名条目的盘面候选。应试语境、官位及正天乙的原句细义、实际取用仍须核对',
      ]);
      case 'fateclear_bazi_context': {
        if (p.profile !== 'fateclear-branch-and-example-v1') return '';
        const moving = p.layer === 'month' ? '流月' : '流日';
        const position = id => id === 'flow' ? moving : layers[id];
        const combinations = rows => list(rows).flatMap(row => {
          const names = list(row?.members).map(position).filter(Boolean);
          return names.length === 2 && chinese(row.values) ? [names.join('与') + '的地支' + row.values + '六合'] : [];
        });
        const trines = rows => list(rows).flatMap(row => {
          const names = list(row?.positions).map(group => list(group).map(position).filter(Boolean).join('或'));
          return names.length === 3 && names.every(Boolean) && chinese(row.branches)
            ? [names.join('、') + '具' + row.branches + '三合支位'] : [];
        });
        const reading = p.exampleVerified === true ? p.exampleReading : p.sourceReading;
        const dayClash = p.monthDayClashGeometryVerified === true ? p.monthDayClashReview : undefined;
        const adjacentClashCombination = dayClash?.publishedAdjacentCombination ?? dayClash?.calculatedEarthAdjacentCombination;
        const natalHalfTrine = dayClash?.relatedNatalHalfTrine, publishedTrine = dayClash?.publishedNatalTrine;
        const earth = reading?.earthTransformation;
        const usefulnessBasis = p.layer === 'month' ? p.monthlyUsefulnessBasis : p.dailyUsefulnessBasis;
        const calculatedEarth = usefulnessBasis === 'calculated-earth-transformation';
        const earthRule = ['甲己', '己甲'].includes(earth?.pair) && ['month', 'hour'].includes(earth.partner)
          && ['未', '戌'].includes(earth.monthBranch);
        const balance = p.baseBalance?.profile === 'fateclear-published-example-base-balance-v2' ? p.baseBalance : undefined;
        const jieMonth = p.jieMonth?.profile === 'fateclear-full-jie-month-midpoint-v1' ? p.jieMonth : undefined;
        const monthMidpoint = new Date(jieMonth?.midpoint);
        const monthLuckPillar = list(p.direction).find(row => row.layer === 'decadal')?.pillar;
        const periodLabel = { annual: '流年', monthly: '流月', decadal: '已核大运', daily: '流日' };
        const directionLabel = { useful: calculatedEarth ? '推算的用神候选' : '用神',
          supportive: calculatedEarth ? '推算的喜神候选' : '喜神', adverse: calculatedEarth ? '推算的忌神候选' : '忌神',
          neutral: '原例不喜不忌',
          unlisted: calculatedEarth ? '化土取法未列为喜用忌' : '原例喜用忌未列该五行',
          aligns_with_balance: '基础扶抑同向候选', opposes_balance: '基础扶抑反向候选',
          tong_guan_review: '基础扶抑反向，因通关仍须复核喜忌',
          climate_review: '基础扶抑反向，因来源所列主调候仍须复核喜忌' };
        const directions = reading || balance?.strength ? list(p.direction).flatMap(row => {
          const label = periodLabel[row?.layer], pillar = smthPillar(row?.pillar);
          const stem = smthStem(row?.stem), main = smthStem(row?.mainQi);
          return label && pillar && stem && main && directionLabel[row.stemDirection] && directionLabel[row.mainDirection]
            ? [label + pillar + '天干' + stem + '为' + directionLabel[row.stemDirection]
              + '，支本气' + main + '为' + directionLabel[row.mainDirection]] : [];
        }) : [];
        return sentences([
          chinese(p.movingPillar) ? moving + '柱为' + p.movingPillar : '',
          p.layer === 'day' ? '按出生地真太阳时23点换日' : '本事实以实际交节时刻划定节令月',
          p.monthlyLayerOrderVerified === true && chinese(jieMonth?.startTerm) && chinese(jieMonth?.endTerm)
            && Number.isFinite(monthMidpoint.getTime()) && smthPillar(monthLuckPillar)
            && smthPillar(jieMonth.annualPillar) && smthPillar(jieMonth.monthPillar)
            ? '在' + jieMonth.startTerm + '至' + jieMonth.endTerm + '整节月的中点（' + at(monthMidpoint.toISOString())
              + '）取月柱，同段依次核大运' + monthLuckPillar + '、流年' + jieMonth.annualPillar + '、流月' + jieMonth.monthPillar : '',
          ({ 'published-natal-reading': '本段喜忌依据已核为同一出生盘的作者公开原例',
            'legacy-published-civil-match': '旧档案按公历出生时刻、性别与四柱对应公开原例，出生地真太阳时尚未核',
            'calculated-earth-transformation': '本段化土五行由程序推算，喜用取法仅供候选审阅',
            'base-balance-candidate': '本段核程序的基础扶抑方向，喜用仍待查证' })[usefulnessBasis] ?? '',
          ...list(p.annualCoreClashes).flatMap(row => {
            const label = row.id === 'decadal' ? '大运' : layers[row.id];
            return label && smthPillar(row.pillar) ? ['流年实冲' + label + row.pillar + '，年度整体方向待核'] : [];
          }),
          ...list(p.annualCorePunishmentsAndHarms).flatMap(row => {
            const label = row.id === 'decadal' ? '大运' : layers[row.id];
            return label && smthPillar(row.pillar) && ['相刑', '六害'].includes(row.kind)
              ? ['流年与' + label + row.pillar + '成' + row.kind + '，年度整体方向待核'] : [];
          }),
          p.layer === 'day' && /^\d{4}-\d{2}-\d{2}$/u.test(p.solarDate) && p.apparentDay?.startInstant && p.apparentDay?.endInstantExclusive
            ? '当地真太阳日为' + p.solarDate + '，整段从' + at(p.apparentDay.startInstant) + '至' + at(p.apparentDay.endInstantExclusive) : '',
          chinese(p.movingBranch) && chinese(p.movingElement) ? moving + '支为' + p.movingBranch + '，支五行为' + p.movingElement
            + (chinese(p.movingMainQi?.stem) ? '，藏干本气为' + p.movingMainQi.stem
              + (chinese(p.movingMainQi.tenGod) ? (earthRule ? '，按原局日干的十神为' : '，十神为') + p.movingMainQi.tenGod : '') : '') : '',
          list(p.clashes).length && p.layer === 'month' && directionLabel[p.movingBranchDirection]
            ? '来冲的流月支本气方向为' + directionLabel[p.movingBranchDirection] : '',
          dayClash && smthPillar(dayClash.natalDay) ? '原局' + dayClash.natalDay + '日柱的六合结构'
            + (dayClash.hasRelatedNatalSixCombination === true ? '已核存在'
              : dayClash.hasRelatedNatalSixCombination === false ? '已核未见' : '尚未核齐')
            + '，来支喜忌' + (directionLabel[dayClash.publishedIncomingDirection]
              ? '在同一公开命例核为' + directionLabel[dayClash.publishedIncomingDirection]
              : directionLabel[dayClash.calculatedEarthIncomingDirection]
                ? '按同盘化土条件核为' + directionLabel[dayClash.calculatedEarthIncomingDirection] : '仍待核') : '',
          adjacentClashCombination && layers[adjacentClashCombination.partner] && chinese(adjacentClashCombination.values)
            ? '受冲日支与原局相邻' + layers[adjacentClashCombination.partner].replace(/柱$/u, '支')
              + adjacentClashCombination.values + '六合。'
              + (dayClash.calculatedEarthAdjacentCombination ? '按该盘化土条件，日支本气为' : '按原例，日支本气为')
              + directionLabel[adjacentClashCombination.dayDirection] + '，合方本气为'
              + directionLabel[adjacentClashCombination.partnerDirection] : '',
          chinese(publishedTrine?.branches) && chinese(publishedTrine.element) && directionLabel[publishedTrine.direction]
            ? '原局' + publishedTrine.branches + '完整三合含同一受冲日支，以该公开原例核' + publishedTrine.element
              + '为' + directionLabel[publishedTrine.direction] + '，同组未见额外六冲' : '',
          natalHalfTrine && list(natalHalfTrine.members).length === 2 && chinese(natalHalfTrine.missingBranch)
            ? '原局' + natalHalfTrine.members.map(row => row.branch).filter(chinese).join('') + '半合含受冲日支，缺'
              + natalHalfTrine.missingBranch + '，' + (natalHalfTrine.hasCentralBranch === true ? '有中神' : '无中神') : '',
          ...list(dayClash?.relatedNatalMeetings).flatMap(row => chinese(row?.branches)
            ? ['原局' + row.branches + '三会含受冲日支'] : []),
          p.publishedMonthDayClashReviewed === true ? '同一公开出生盘的来支喜忌、原局六合及完整三合均已核对' : '',
          ...list(p.clashes).flatMap(target => {
            if (!layers[target?.id] || !chinese(target.branch)) return [];
            const contacts = [...combinations(target.natalCombinations), ...trines(target.natalTrines)];
            return [sentences([
              moving + '支六冲本命' + layers[target.id].replace(/柱$/u, '支') + target.branch,
              chinese(target.element) && chinese(target.mainQi?.tenGod) ? '该本命支五行为' + target.element
                + '，支本气十神为' + target.mainQi.tenGod : '',
              p.layer === 'day' && directionLabel[target.branchDirection]
                ? '受冲本命支的本气方向为' + directionLabel[target.branchDirection] : '',
              contacts.length ? '原局涉及该柱的合会为' + contacts.join('、')
                : (p.timeKnown === true ? '已核原局中未见该柱六合或完整三合' : '已知柱中未见该柱六合或完整三合，时柱仍待核'),
              ...list(target.natalCombinations).flatMap(row => {
                const partner = layers[row.partner];
                if (!partner || typeof row.adjacent !== 'boolean') return [];
                const opposing = list(row.opposingColumns).map(position).filter(Boolean);
                const upperOpposing = list(row.upperOppositions).flatMap(({ layer, pillar }) =>
                  periodLabel[layer] && smthPillar(pillar) ? [periodLabel[layer] + pillar] : []);
                return ['原局' + partner + '直接六合受冲支，两柱' + (row.adjacent ? '相邻' : '隔位')
                  + (directionLabel[row.partnerDirection] ? '，合方本气为' + directionLabel[row.partnerDirection] : '')
                  + (opposing.length ? '，合方同时受' + opposing.join('、') + '冲' : '')
                  + (upperOpposing.length ? '，合方同段还受' + upperOpposing.join('、') + '冲' : '')];
              }),
            ])];
          }),
          ...[...combinations(p.movingCombinations), ...trines(p.movingTrines)].map(text => '涉及' + moving + '的合会为' + text),
          list(p.clashes).length ? '直接六合与来冲支参加的合会分别考虑，实际缓解程度仍待核对' : '',
          reading && chinese(p.exampleYear) && chinese(p.exampleLuck) ? '此段对应拨云公开原例，流年为' + p.exampleYear
            + '，实际已核大运为' + p.exampleLuck : '',
          reading && chinese(reading.strength) && chinese(reading.useful)
            ? (earthRule ? (calculatedEarth ? '按程序复算化土候选，日干与' : '按公开化土判据，日干与') + layers[earth.partner] + '合为' + earth.pair
              + '，月支为' + earth.monthBranch + '，取' + reading.strength : '原文对该例定为' + reading.strength) + '、用' + reading.useful
              + (list(reading.supportive).length ? '、喜' + reading.supportive.filter(chinese).join('、') : '')
              + (list(reading.adverse).length ? '、忌' + reading.adverse.filter(chinese).join('、') : '')
              + (list(reading.neutral).length ? '、' + reading.neutral.filter(chinese).join('、') + '不喜不忌' : '')
              + (calculatedEarth ? '。这些五行说明程序所查化土分支的取向' : earthRule
                ? '。这些喜用按该化土分支取用' : '。这些喜用仅适用于已核原例') : '',
          !earthRule && number(balance?.support) !== undefined && number(balance?.restraint) !== undefined
            ? '按公开计分复算原局，扶分' + balance.support + '，抑分' + balance.restraint
              + (balance.strength === 'strong' ? '，基础方向偏强'
                : balance.strength === 'weak' ? '，基础方向偏弱'
                  : balance.strengthBasis === 'equal-scores' ? '，扶抑分完全相等，计分为中和' : '，当前原局方向待复核') : '',
          chinese(balance?.primaryClimate)
            ? '按拨云所列的日主和月令组合，主调候为' + balance.primaryClimate + '，综合取用仍须核对' : '',
          balance?.strengthBasis === 'month-command' ? '月支本气帮身，按来源月令优先判强' : '',
          balance?.monthSupports === true && balance.monthClashWithoutOtherRoot === true
            ? '月支受冲，月支以外无本气根，取消月令直接判强' : '',
          ...(balance?.monthSupports === true ? list(balance.restrainingMonthGroups).flatMap(row =>
            chinese(row?.branches) && chinese(row?.element) && ['三合', '三会'].includes(row?.kind)
              ? ['月支参与' + row.branches + row.kind + row.element + '局，该局五行落在克泄耗一侧，取消月令直接判强'] : []) : []),
          ...list(balance?.tongGuan?.routes).flatMap(row => {
            const { controlling, controlled, bridge } = row ?? {};
            if (![controlling, controlled, bridge].every(chinese)) return [];
            const sourceShare = number(balance.tongGuan.proportions?.[controlling]);
            const targetShare = number(balance.tongGuan.proportions?.[controlled]);
            return sourceShare !== undefined && targetShare !== undefined
              ? ['通关按计入日干的五行占比核验，' + controlling + '克' + controlled + '，占比分别为' + sourceShare + '%和' + targetShare
                + '%，通关候选为' + bridge] : [];
          }),
          !reading && balance?.strength ? '具体取用、忌神、调候与岁运合参仍待核定' : '',
          ...directions,
        ]);
      }
      case 'annual_luck_context': return p.profile !== 'smth-annual-luck-atomic-v1' ? '' : sentences([
        '以下本命、流年与大运属于同一候选和实际共同有效时段',
        chinese(p.dayMaster) ? '日主为' + p.dayMaster : '',
        chinese(p.natalYear) && chinese(p.natalMonth) ? '本命年柱为' + p.natalYear + '，月柱为' + p.natalMonth : '',
        chinese(p.yearPillar) && chinese(p.luckPillar) ? '流年柱为' + p.yearPillar + '，大运柱为' + p.luckPillar : '',
        p.confirmed === true ? '该大运已与上游十步表唯一核验一致' : '大运尚未唯一核验，不能作为确定岁运条件',
        ...smthFoundationDescription(p),
        p.samePillar === true ? '岁运完整干支相同，符合本条并临结构；并临本身没有固定吉凶'
          : p.sameStem === true ? '岁运仅天干相同，不构成本条完整干支并临'
            : p.sameBranch === true ? '岁运仅地支相同，不构成本条完整干支并临' : '岁运完整干支不相同，不构成本条并临',
        p.yearRepeatsNatalYear === true ? '流年完整干支还与本命年柱相同；相和相顺及取用仍未据此成立' : '',
        ...smthTaiSuiDescription(p),
        ...[['yearTenGod', '岁干'], ['yearMainQiTenGod', '岁支本气'], ['luckTenGod', '运干'], ['luckMainQiTenGod', '运支本气']]
          .map(([key, label]) => chinese(p[key]) ? label + '十神为' + p[key] : ''),
        list(p.luckHiddenTenGods).filter(chinese).length ? '运支全部藏干十神为' + p.luckHiddenTenGods.filter(chinese).join('、') : '',
        p.luckStemWealth === true ? '运干属于财星；运支本气' + (p.luckMainQiWealth === true ? '也是财星' : '不是财星')
          + '，全部藏干中' + (p.luckAnyHiddenWealth === true ? '仍有财星' : '未见财星') + '；本气与全部藏干的无财口径不能混用' : '',
        ...smthStemExceptionDescription(p),
        chinese(p.dayLuBranch) ? '按十干禄表，日干禄位在' + p.dayLuBranch + '；本命月支' + (p.monthBuiltLu === true ? '与之相同，只证明建禄结构' : '与之不同') : '',
        chinese(p.dayBasisBladeBranch) && chinese(p.yearBasisBladeBranch) ? '按卷三禄前一辰分别核位：日干基准刃位为' + p.dayBasisBladeBranch
          + '，年干基准刃位为' + p.yearBasisBladeBranch + '；两种基准分别记录，不据此认定刃旺或吉凶' : '',
        ...[['yearAtDayBasisBlade', '流年支', '日干'], ['luckAtDayBasisBlade', '运支', '日干'],
          ['yearAtYearBasisBlade', '流年支', '年干'], ['luckAtYearBasisBlade', '运支', '年干']]
          .map(([key, label, basis]) => typeof p[key] === 'boolean' ? label + (p[key] ? '到达' : '未到') + basis + '基准的禄前一辰' : ''),
        list(p.yearLuckRelations).filter(chinese).length ? '岁运两柱实际关系为' + p.yearLuckRelations.filter(chinese).join('、') : '',
        p.stageStart && p.stageEnd ? '本步完整大运为' + at(p.stageStart) + '至' + at(p.stageEnd) + '，截止时刻不计入' : '',
        '《论太岁》原用年日基准、甲干以外的真偏口径与实际制化仍待核；同时见七杀、财官印时不自定优先权，不以十神或建禄结构替代身强弱、取用和救应',
      ]);
      case 'source_layer_context': return sentences([
        [['natalYear', '年柱'], ['natalMonth', '月柱'], ['natalDay', '日柱'], ['natalHour', '时柱']]
          .map(([key, label]) => chinese(p[key]) ? '本命' + label + '为' + p[key] : '').filter(Boolean).join('，'),
        [['year', '流年'], ['month', '流月'], ['day', '流日']].map(([key, label]) => chinese(p[key])
          ? label + '柱为' + p[key] + (chinese(p[key + 'TenGod']) ? '，天干十神为' + p[key + 'TenGod'] : '') : '').filter(Boolean).join('；'),
        ...list(p.relations).flatMap(value => {
          const match = /^(year|month|day):natal:(year|month|day|hour):(天干五合|天干四冲|六合|六冲|六害|六破|相刑|同柱)$/u.exec(text(value));
          if (!match) return [];
          const stem = match[3].startsWith('天干'), whole = match[3] === '同柱';
          return ['流' + layers[match[1]] + (whole ? '' : stem ? '天干' : '地支') + '与本命' + layers[match[2]]
            + (whole ? '' : stem ? '天干' : '地支') + '构成' + match[3]];
        }),
        ...list(p.firstDegreeTwists).flatMap(value => {
          const match = /^(year|month|day):natal:(year|month|day|hour)$/u.exec(text(value));
          return match ? ['流' + layers[match[1]] + '与本命' + layers[match[2]] + '的干支各差一步且方向相反，符合一级扭曲的结构；不据此推断具体事件'] : [];
        }),
        p.timeKnown === false ? '出生时刻未确认，本命时柱未参与' : '',
        '这些条件属于同一候选和共同有效时段；日柱按北京民用时晚子换日，尚不能替代要求真太阳时的来源',
      ]);
      case 'luck_transition': return sentences([
        chinese(p.fromPillar) && chinese(p.toPillar) ? '大运从' + p.fromPillar + '切换到' + p.toPillar : '',
        p.confirmed === true ? '交运方案已与上游十步大运表唯一核验一致' : '交运方案未确认',
        p.forwardCorner === true ? '旧支到新支属于原文顺向列举的四方转角' : '',
        p.reverseCorner === true ? '这是反向经过转角，原句未列其等价取法，不套顺向结论' : '',
        p.stemWrap === true ? '运干同时从癸换到甲' : '未同时出现运干由癸换甲',
        p.sameSeason === true && chinese(p.fromSeason) ? '两支同在' + p.fromSeason + '方一气相连，按这段原文排除转角接木' : '',
        p.forwardCorner === true && p.stemWrap === true ? '原文对转角同时换甲另有加重说法，须结合原局格局解释' : '',
        '只标记精确交接，原局喜忌和实际后果均须另核',
      ]);
      case 'work_timing_context': {
        if (p.profile !== 'adee-work-timing-shared-natal-column-v1') return '';
        const names = { luck: '大运', year: '流年', month: '流月', day: '流日' };
        const columns = rows => list(rows).map(key => layers[key]).filter(Boolean).join('、');
        return sentences([
          '同一候选盘在同一有效片段的工作主题盘面线索',
          p.stageStart && p.stageEnd ? '当前大运从' + at(p.stageStart) + '至' + at(p.stageEnd) + '前' : '',
          ...list(p.evidence).flatMap(row => row && names[row.layer] && chinese(row.pillar) ? [
            names[row.layer] + row.pillar + (chinese(row.stemGod) ? '，天干十神为' + row.stemGod : '')
              + (chinese(row.mainQiGod) ? '，地支本气十神为' + row.mainQiGod : '')
              + (list(row.contacts).length ? '，与本命的关系为' + row.contacts.flatMap(contact => contact && layers[contact.target] && chinese(contact.kind)
                ? [layers[contact.target] + contact.kind + (list(contact.roles).filter(chinese).length
                  ? '（' + contact.roles.filter(chinese).join('、') + '参与）' : '')] : []).join('、') : ''),
          ] : []),
          columns(p.upperWorkTargets) ? '大运与流年的工作相关十神线索同触本命' + columns(p.upperWorkTargets) : '',
          columns(p.upperOfficerTargets) ? '两层官杀线索同触本命' + columns(p.upperOfficerTargets) : '',
          columns(p.repeatedByMonth) ? '这个流月再次触及本命' + columns(p.repeatedByMonth) : '',
          p.dayOfficer === true && chinese(p.dayOfficerGod) ? '当日天干为' + p.dayOfficerGod : '',
          p.dayClashesBirthMonth === true ? '流日地支冲本命月支' : '',
          p.dayClashesFlowMonth === true ? '流日地支冲流月地支' : '',
          '现实工作主线与同柱关系是否实际应事仍须结合已有安排核对',
        ]);
      }
      case 'natal_conditions': return sentences([
        [['yearPillar', '年柱'], ['monthPillar', '月柱'], ['dayPillar', '日柱'], ['hourPillar', '时柱']]
          .map(([key, label]) => chinese(p[key]) ? label + '为' + p[key] : '').filter(Boolean).join('，'),
        chinese(p.dayMaster) ? '日主为' + p.dayMaster : '',
        list(p.exposedTenGods).filter(chinese).length ? '除日干自身外，天干透出十神：' + p.exposedTenGods.filter(chinese).join('、') : '',
        list(p.hiddenTenGods).filter(chinese).length ? '地支藏干十神：' + p.hiddenTenGods.filter(chinese).join('、') : '',
        chinese(p.monthMainQi) ? '月令本气藏干为' + p.monthMainQi + (chinese(p.monthMainQiTenGod) ? '，十神为' + p.monthMainQiTenGod : '') : '',
        p.timeKnown === false ? '出生时刻未确认，不能据此断言某十神在全局不存在' : '',
        '这些是透藏结构，不代表格局、身强弱、喜用或救应已经成立',
      ]);
      case 'stem_condition': return sentences([chinese(p.stem) ? '所核天干为' + p.stem : '',
        chinese(p.tenGod) ? '相对日主的十神为' + p.tenGod : '',
        typeof p.exposed === 'boolean' ? (p.exposed ? '透出于' + list(p.exposurePositions).map(layer => layers[layer]).filter(Boolean).join('、') : '除日干自身外未透干') : '是否透干尚未确定',
        typeof p.hidden === 'boolean' ? (p.hidden ? '本命地支确有此藏干' : '本命地支未藏此干') : '是否藏于本命地支尚未确定',
        typeof p.rooted === 'boolean' ? (p.rooted ? '按同五行藏干口径通根于' + list(p.rootPositions).map(layer => layers[layer]).filter(Boolean).join('、') : '按同五行藏干口径未见根') : '本命是否通根尚未确定',
        '有根不等于根旺、未受损或已经得用',
      ]);
      case 'luck_conditions':
      case 'luck_pillar': return sentences([chinese(p.pillar) ? '大运柱为' + p.pillar : '',
        chinese(p.tenGod) ? '运干十神为' + p.tenGod : '',
        chinese(p.mainQiTenGod) ? '运支本气十神为' + p.mainQiTenGod : '',
        hiddenStems(p.hiddenStems) ? '运支藏干：' + hiddenStems(p.hiddenStems) : '',
        p.confirmed === true ? '上游十步大运表与同口径重算的唯一方案逐项一致' : '本条大运方案尚未确认，不作确定依据',
        typeof p.stemRootedInLuckBranch === 'boolean' ? '运干在本运支中' + (p.stemRootedInLuckBranch ? '有同五行藏干根' : '未见同五行藏干根') : '',
        typeof p.stemRootedInNatal === 'boolean' ? '运干在原局' + (p.stemRootedInNatal ? '有同五行藏干根' : '未见同五行藏干根') : '',
        ['东方木', '南方火', '西方金', '北方水'][p.branchDirection] ? '运支方气属' + ['东方木', '南方火', '西方金', '北方水'][p.branchDirection] : '',
        p.stageStart && p.stageEnd ? '完整大运起止为' + at(p.stageStart) + '至' + at(p.stageEnd) + '，截止时刻不计入' : '',
        '此处使用十年并论区间；未据此认定喜忌，也未生成运干运支各五年的作用窗口',
      ]);
      case 'ten_god': return sentences([chinese(p.dayMaster) ? '日主为' + p.dayMaster : '',
        chinese(p.stem) ? '天干为' + p.stem : '', chinese(p.tenGod) ? '天干十神为' + p.tenGod : '']);
      case 'hidden_stem_ten_god': return sentences([chinese(p.branch) ? '地支为' + p.branch : '',
        chinese(p.stem) ? '藏干为' + p.stem : '', chinese(p.tenGod) ? '藏干十神为' + p.tenGod : '']);
      case 'natal_structure': return sentences([
        list(p.pillars).map(item => layers[item.layer] && chinese(item.pillar) ? layers[item.layer] + '为' + item.pillar : '').filter(Boolean).join('，'),
        chinese(p.dayMaster) ? '日主为' + p.dayMaster : '',
        list(p.roots).length ? list(p.roots).map(layer => layers[layer]).filter(Boolean).join('、') + '的地支藏有与日主同五行的藏干' : '',
        p.timeKnown === false ? '出生时刻未确认，时柱不作确定依据' : '',
        p.strength === 'undetermined' ? '身强身弱尚未确定' : chinese(p.strength),
        p.usefulElements === 'undetermined' ? '喜用五行尚未确定' : chinese(p.usefulElements),
      ]);
      case 'layer_pillar': return sentences([chinese(p.pillar) ? (layers[p.layer] ? '流' + layers[p.layer] : '流柱') + '为' + p.pillar : '',
        chinese(p.tenGod) ? '天干十神为' + p.tenGod : '', chinese(p.phase) ? '十二长生为' + p.phase : '',
        hiddenStems(p.hiddenStems) ? '地支藏干：' + hiddenStems(p.hiddenStems) : '',
        list(p.natalPillars).map(item => pillarName(item.id) && chinese(item.pillar) ? pillarName(item.id) + '为' + item.pillar : '').filter(Boolean).join('，')]);
      case 'pillar_relation': return sentences([
        list(p.members).map(pillarName).filter(Boolean).join('与') + (chinese(p.kind) ? '形成' + p.kind : ''),
        list(p.pillars).map(item => pillarName(item.id) && chinese(item.pillar) ? pillarName(item.id) + '为' + item.pillar : '').filter(Boolean).join('，'),
      ]);
      case 'daily_branch_context': {
        if (p.profile !== 'adee-daily-branch-contacts-v1' || !chinese(p.dayBranch)) return '';
        const contacts = list(p.contacts).flatMap(row => {
          const target = pillarName(row.target);
          if (!target || !chinese(row.targetBranch) || !chinese(row.kind)) return [];
          const mainQi = chinese(row.mainQiTenGod) ? '，该支本气相对日主为' + row.mainQiTenGod : '';
          const kind = row.kind === '相刑' ? '两支相刑' : row.kind;
          return ['流日' + p.dayBranch + '支与' + target + '的' + row.targetBranch + '支形成' + kind + mainQi];
        });
        const completedGroups = list(p.completedGroups).flatMap(group => {
          const positions = list(group.positions).map(ids => list(ids).map(pillarName).filter(Boolean).join('或'));
          return ['三合', '三刑'].includes(group.kind) && chinese(group.branches) && positions.length === 3 && positions.every(Boolean)
            ? ['流日' + p.dayBranch + '支补齐' + group.branches + group.kind + '支位，三个支位依次在' + positions.join('、')] : [];
        });
        if (!contacts.length && !completedGroups.length) return '';
        const repeatLayers = { month: '流月', year: '流年', decadal: '大运' };
        const repeats = list(p.repeatedContacts).flatMap(row => {
          const target = pillarName(row.target);
          const background = list(row.background).flatMap(item => repeatLayers[item.layer] && smthPillar(item.pillar)
            ? [item.pillar + repeatLayers[item.layer]] : []);
          return target && smthPillar(row.targetPillar) && chinese(row.kind) && background.length
            ? [background.join('、') + '与流日同样对' + target + row.targetPillar + '形成' + row.kind] : [];
        });
        return sentences([
          '流日为' + chinese(p.dayPillar) + '，当令流月为' + chinese(p.monthPillar),
          p.dayClock === 'beijing-civil-23-v1' ? '日柱按北京时间二十三点切换，流月按交节切换' : '',
          ...contacts,
          ...repeats,
          ...completedGroups,
          p.workMonthBranchWitness?.target === 'natal:month' && smthPillar(p.workMonthBranchWitness.targetPillar)
            && smthPillar(p.workMonthBranchWitness.luckPillar) && smthPillar(p.workMonthBranchWitness.annualPillar)
            ? '大运与流年的官杀线索同触本命月柱' + p.workMonthBranchWitness.targetPillar
              + '，当日也冲到该月支。如果正在看工作，可把这处作为当天的观察点' : '',
          ...list(p.workRepeatedBranchWitnesses).flatMap(row => {
            const target = pillarName(row.target);
            return target && smthPillar(row.targetPillar) && chinese(row.kind)
              ? ['岁运的工作线索、当令流月与流日都触及' + target + row.targetPillar + '，流日以' + row.kind + '接触此支']
              : [];
          }),
          p.timeKnown === false ? '已知本命柱位不含时柱' : '',
          '柱位是短期观察线索，仍须结合实际所问和岁运主线判断其重要性',
        ]);
      }
      case 'calendar_pattern': {
        if (p.profile !== 'lu-first-degree-twist-v1') return '';
        const comparison = luTwistText(p, '当令流月', '流日');
        return comparison ? sentences([comparison, '这组月日干支符合陆氏一级扭曲的时间结构']) : '';
      }
      case 'lu_annual_daily_twist': {
        if (p.profile !== 'lu-first-degree-twist-v1' || p.matchesPublishedGeometry !== true) return '';
        const contacts = (rows, label) => list(rows).flatMap(row => {
          const participants = list(row.members).map(pillarName).filter(Boolean);
          return participants.length === 2 ? [participants.join('与') + '有' + label] : [];
        });
        return sentences([
          luTwistText(p.yearTwist, '本命日柱', '流年'),
          luTwistText(p.dayTwist, '本命时柱', '流日'),
          chinese(p.month) ? '当令流月为' + p.month : '',
          chinese(p.luck) ? '同段已核大运为' + p.luck : '',
          ...contacts(p.weiXu, '未戌相刑'), ...contacts(p.haiShen, '亥申六害（原书称穿）'),
          p.hasPublishedLuck === true && p.sourceDate ? '按原书明载的民用日' + p.sourceDate + '核到两组一级扭曲'
            : '岁层与日层的一级扭曲在同一片段保留',
        ]);
      }
      case 'lu_rootless_day_case': {
        if (p.profile !== 'lu-rootless-case-56-v1' || p.matchesPublishedGeometry !== true) return '';
        const positions = values => list(values).map(pillarName).filter(Boolean).join('、');
        const listContacts = (values, label) => list(values).map(row => positions(row.members) + '见' + label).join('，');
        const pillars = values => list(values).map(row => {
          const name = pillarName(row.id), qi = row.mainQi;
          return name && chinese(row.pillar) ? name + row.pillar
            + (chinese(row.tenGod) ? '，柱干相对日主为' + row.tenGod : '')
            + (chinese(qi?.stem) && chinese(qi?.element) ? '，支本气为' + qi.stem + qi.element : '') : '';
        }).filter(Boolean).join('。');
        return sentences([
          pillars(p.natal), pillars(p.moving),
          '壬水透于' + positions(p.renStemPositions) + '，四支藏干均未见水根',
          list(p.moving).some(row => row.id === 'flow:month' && row.holdsWater === true) ? '流月申支藏壬水，水根观察限于原局四支' : '',
          listContacts(p.dingRen, '丁壬合'), listContacts(p.chouXu, '丑戌相刑'), listContacts(p.youXu, '酉戌六害'),
          listContacts(p.yinShen, '寅申六冲'),
          list(p.chouXuWei).length === 3 ? '同段丑在' + positions(p.chouXuWei[0]) + '，戌在' + positions(p.chouXuWei[1])
            + '，未在' + positions(p.chouXuWei[2]) + '，三支位置齐备' : '',
          list(p.archingColumns).map(columns => positions(columns) + '为原书的寅戌夹午候选').join('，'),
          p.stageStart && p.stageEnd ? '已核大运从' + at(p.stageStart) + '至' + at(p.stageEnd) + '，截止时刻不计入' : '',
          p.sourceBranchHalf === true && p.branchHalfStartsAt
            ? '按同作者的干支分管说明，' + at(p.branchHalfStartsAt) + '起进入本步运后半戌运' : '',
          '夹拱与合泄克用于复核作者的解释，历史作用另查',
        ]);
      }
      case 'smth_dragon_back_month': {
        if (p.profile !== 'smth-volume-six-monthly-cases-v1' || p.matchesPublishedGeometry !== true) return '';
        const labels = rows => list(rows).map(row => pillarName(row.id) + chinese(row.pillar)).filter(Boolean).join('、');
        const earth = rows => list(rows).map(row => pillarName(row.id) + chinese(row.branch) + chinese(row.stem)
          + (chinese(row.tenGod) ? '为' + row.tenGod : '')).filter(Boolean).join('、');
        return sentences([
          '卷六同结构四柱为' + labels(p.native) + '，本段为' + chinese(p.year) + '岁' + chinese(p.month) + '月',
          '透出土干为' + earth(p.earthStems), '土支本气为' + earth(p.earthMainQi),
          '流月乙干相对日主为' + chinese(p.monthTenGod),
          '原局申子位置中实际见' + labels(p.natalWaterMembers),
          '官杀轻重、格局及历史月界仍待核',
        ]);
      }
      case 'smth_day_virtue_month': {
        if (p.profile !== 'smth-volume-six-monthly-cases-v1' || p.matchesPublishedGeometry !== true) return '';
        const basis = { 'jie-si-month': '节令巳月', 'regular-lunar-fourth': '农历正四月' }[p.monthBasis];
        if (!basis) return '';
        const luckPosition = p.sourceLuckWealthBlade;
        return sentences([
          '这一段按' + basis + '读原文四月，实历流月为' + chinese(p.month) + '，原文采用的月制仍待核',
          '三处日德整柱为' + list(p.dayVirtuePositions).map(row => pillarName(row.id) + chinese(row.pillar)).join('、'),
          p.yearStemControlsHour === true ? '原局年干庚克时干甲' : '',
          '同段流年为' + chinese(p.year) + '，已核大运为' + chinese(p.luck) + '，戊日禄前刃位为' + chinese(p.bladeBranch),
          luckPosition && '实际运干' + chinese(luckPosition.wealthStem) + '为' + chinese(luckPosition.wealthGod)
            + '，同一运支' + chinese(luckPosition.bladeBranch) + '所藏' + chinese(luckPosition.bladePeerStem)
            + '为' + chinese(luckPosition.bladePeerGod),
          p.sourceAge38 === true && p.sourceAge?.liChunOrdinal === 38 && p.sourceAge?.lunarOrdinal === 38
            ? '按立春和农历两种年序都为三十八，与原例的岁序一致'
              + (number(p.sourceAge.civilYears) === undefined ? '' : '，此候选时段起点实满' + p.sourceAge.civilYears + '周岁') : '',
          p.yearHourPunishment === true ? '流年巳支与本命时支寅相刑' : '',
          p.stageStart && p.stageEnd ? '该大运起于' + at(p.stageStart) + '，止于' + at(p.stageEnd) + '，截止时刻不计入' : '',
          '刃持权及刑的实际作用仍待核',
        ]);
      }
      case 'smth_tai_sui_clash_month': {
        if (p.profile !== 'smth-tai-sui-jia-wu-month-v1' || p.matchesPublishedGeometry !== true) return '';
        return sentences([
          '辛丑本作己丑，和实算归档的' + chinese(p.natalYear) + '年柱一致，其他底本的乙丑仍列作异文',
          '本段为' + chinese(p.year) + '岁' + chinese(p.month) + '月，已核大运' + chinese(p.luck),
          p.dayStemControlsYear === true ? '本命日干壬克岁干丙' : '',
          p.dayBranchControlsYear === true ? '本命日支申与岁支寅相冲，申本气庚金克寅本气甲木' : '',
          '岁运与本命寅巳申位置为' + baziBranchPositions('寅巳申', p.punishment),
          p.luckYearStemCombine === true ? '岁干丙与运干辛五合' : '',
          p.yinHaiCombine === true ? '岁寅与本命月亥六合' : '',
          '已见的亥卯未成员为' + list(p.woodMembers).map(row => pillarName(row.id) + chinese(row.pillar)).join('、'),
          p.luckWoodOutput && '实际运支' + chinese(p.luckWoodOutput.branch) + '所藏' + chinese(p.luckWoodOutput.stem)
            + '为日主的' + chinese(p.luckWoodOutput.tenGod),
          '交入甲午后，流月午的本气为' + chinese(p.monthMainQi) + '，同段巳午未位置为' + baziBranchPositions('巳午未', p.fireMeeting),
          '木局及火势实际作用仍待核',
        ]);
      }
      case 'smth_fire_assembly_month': {
        if (p.profile !== 'smth-fire-assembly-jia-xu-month-v1' || p.matchesPublishedGeometry !== true) return '';
        const water = values => list(values).map(row => pillarName(row.id) + chinese(row.branch) + chinese(row.stem)).join('、');
        return sentences([
          '本命寅午戌位置为' + baziBranchPositions('寅午戌', p.natalFire),
          '同段为' + chinese(p.year) + '岁' + chinese(p.month) + '月，实际大运为' + chinese(p.luck),
          '加入运、岁、月后，寅午戌位置为' + baziBranchPositions('寅午戌', p.withFlowsFire),
          p.wuGui === true ? '运干戊与本命月干癸五合' : '',
          '水干保留在' + water(p.waterStems),
          list(p.waterHiddenStems).length ? '支藏之水在' + water(p.waterHiddenStems) : '',
          list(p.natalSiPositions).length ? '本命另有巳在' + list(p.natalSiPositions).map(pillarName).join('、') : '',
          '本命月柱为' + chinese(p.natalMonth) + '，依卷二分别核本命月与当令月的寅午戌条件',
          p.natalFireSeason === true ? '本命月支满足所列月令条件' : '',
          p.flowFireSeason === true ? '当令月支满足所列月令条件' : '',
          '本案成化及用水的实际作用仍待核',
        ]);
      }
      case 'smth_hour_blade': {
        if (p.profile !== 'smth-volume-five-hour-blade-v1'
          || (p.yearClashesHourBlade !== true && p.yearHourBladeCombinationCandidate !== true
            && p.verifiedSingleLayerContact !== 'luck' && p.verifiedSamePillarBladeRepetition !== true)) return '';
        const positions = values => list(values).map(pillarName).filter(Boolean).join('、');
        if (p.jiaShenException === true) return sentences([
          '甲申日、丁卯时是卷五另列的时刃例外',
          p.exceptionStemPair?.day?.stem === '庚' && p.exceptionStemPair?.hour?.stem === '乙' ? '日支申藏庚，同时保留时支卯藏乙与时干丁' : '',
          positions(p.exceptionWealthPositions) ? '原局另有透财在' + positions(p.exceptionWealthPositions) : '',
        ]);
        const contacts = rows => list(rows).map(row => positions(row.members) + '见' + chinese(row.kind)).join('，');
        const yearContact = p.yearClashesHourBlade === true ? '与该时支卯酉相冲'
          : p.yearSixCombination?.values === '卯戌' ? '与该时支卯戌六合'
            : ['亥卯', '卯未'].includes(p.yearHalfWoodContact?.values) ? '与该时支构成' + p.yearHalfWoodContact.values + '半合' : '';
        return sentences([
          yearContact ? '甲日禄前卯位落在本命时柱' + chinese(p.actualHour) + '，实岁' + chinese(p.year) + yearContact : '',
          '底本文字为' + chinese(p.publishedHour) + '，实际排盘' + chinese(p.actualHour) + '只用于时支结构对照',
          list(p.yearWoodGroup).length ? '实岁参加的亥卯未位置为' + baziBranchPositions('亥卯未', p.yearWoodGroup) : '',
          contacts(p.natalContacts),
          list(p.natalWoodGroup).length ? '原局亥卯未位置为' + baziBranchPositions('亥卯未', p.natalWoodGroup) : '',
          p.luckStatus === 'confirmed' ? '同段已核大运为' + chinese(p.luckPillar)
            : p.luckStatus === 'before_luck' ? '该段在首步大运前' : '大运尚未唯一核验，运层是否再冲合保留未知',
          contacts(p.luckContacts),
          ['亥卯', '卯未'].includes(p.luckHalfWoodContact?.values)
            ? '按卷五列支复核，当前运支与本命卯时构成' + p.luckHalfWoodContact.values + '半合' : '',
          list(p.luckWoodGroup).length ? '大运参加的亥卯未位置为' + baziBranchPositions('亥卯未', p.luckWoodGroup) : '',
          p.verifiedSamePillarBladeRepetition === true && p.year === p.luckPillar && ['乙卯', '丁卯'].includes(p.year)
            ? '实岁与同段实运均为' + p.year + '，按卷二记真刃岁运并临' : '',
          p.verifiedSingleLayerContact === 'luck' ? '原局时刃已有冲合，同段只有已核大运再次触及时卯'
            : p.verifiedSingleLayerContact === 'annual' ? '原局时刃已有冲合，同段只有实际流年再次触及时卯'
              : p.repeated === true ? '岁层与运层均有针对本命卯时的冲合位置' : '',
          positions(p.dayRootPositions) ? '甲木同五行藏根位置为' + positions(p.dayRootPositions) : '',
          chinese(p.dayQiScreen?.dayPhase) && chinese(p.dayQiScreen?.monthPhase)
            ? '甲木于日支为' + p.dayQiScreen.dayPhase + '，于月支为' + p.dayQiScreen.monthPhase + '。两处分别核对，仍需合参原局藏根和印星' : '',
          ...list(p.heavenVirtue).map(row => {
            const reading = { stem: '实干', yuanhai: '渊海支位', kaoyuan: '考原支位' }[row.basis];
            const where = positions(row.positions);
            return reading ? '本命天德按' + reading + '查' + chinese(row.value) + '，' + (where ? '见于' + where : '已知位置未见') : '';
          }),
          '本命月德干为' + chinese(p.moonVirtue) + '，' + (positions(p.moonVirtuePositions) ? '见于' + positions(p.moonVirtuePositions) : '已知位置未见'),
          p.verifiedUnopposedDayVirtuesWithHourBlade === true && chinese(p.dayVirtueWitness?.dayPillar)
            ? '未月天德、月德同临' + p.dayVirtueWitness.dayPillar + '日，时柱未见所列克冲刑破，同段没有明庚' : '',
          list(p.depletedDayBladeWealthTargets).length && chinese(p.dayQiScreen?.dayPhase)
            ? '按卷五日干无气一段，日支为' + p.dayQiScreen.dayPhase + '，月令未见同类生扶，原局与同段岁运未见印。'
              + '本命时卯藏乙可克' + smthSourceRoles(p.depletedDayBladeWealthTargets) + '，留作时刃扶持的盘面依据' : '',
          list(p.dayVirtueWitness?.tabooPillars).length
            ? '未月二德临日的同段另见明庚：' + list(p.dayVirtueWitness.tabooPillars).map(row => chinese(row.pillar)).filter(Boolean).join('、') : '',
          p.pardonDayObserved === true ? '出生当日符合季节天赦日对照，为' + chinese(p.pardonDay) : '',
          '命元厚薄、赦文取法及实际解救仍待核',
        ]);
      }
    }
  }
  if (fact.method === 'ziwei') {
    switch (fact.type) {
      case 'quanshu_yang_taboo_context': return yangTabooDescription(p);
      case 'quanshu_tiger_layer_context': return tigerLayerDescription(p);
      case 'quanshu_horse_void_context': return horseVoidDescription(p);
      case 'quanshu_body_limit_context': return bodyLimitDescription(p);
      case 'quanshu_firebell_context': return fireBellDescription(p);
      case 'quanshu_doujun_context':
      case 'quanshu_kuxu_condition':
      case 'quanshu_shangshi_condition': return quanshuYearDescription(p, at);
      case 'quanshu_doujun_month': {
        if (p.profile !== 'quanshu-doujun-month-from-first-month-v1' || p.ready !== true) return '';
        const emitters = { natal: '生年干', yearly: '流年干' };
        const contactText = (rows, label) => {
          if (!Array.isArray(rows) || rows.some(row => !row || !chinese(row.star)
            || !/^[子丑寅卯辰巳午未申酉戌亥]$/u.test(text(row.branch)) || !['守', '冲', '三合'].includes(row.relation))) return label + '位置未核齐';
          return label + '在本宫及冲合范围内'
            + (rows.length ? '可见' + rows.map(row => row.star + '在' + row.branch + '宫（' + row.relation + '）').join('、') : '未见所列对象');
        };
        return sentences([
          '《全书》斗君月段在农历' + p.lunarYear + '年' + p.lunarMonth + '月，' + at(p.nativeStart) + '起至' + at(p.nativeEnd) + '前有效',
          quanshuLeapBirthDescription(p),
          '从流年太岁' + p.annualBranch + '宫逆数生月、顺数生时，得正月斗君在' + p.doujunBranch + '宫，再顺推至本月' + p.branch + '宫，对应本命' + p.natalName + '宫',
          contactText(p.supportContacts, '已核的部分吉曜'), contactText(p.voidContacts, '原书空劫'),
          p.voidContactsComplete === false ? '空劫至少一项本命位置待核，已确认的会照仍保留' : '',
          ...list(p.templeSupportContacts).filter(row => chinese(row?.star) && chinese(row.branch)
            && row.branch === p.branch && row.grade === '庙' && row.relation === '守')
            .map(row => '卷二列本命' + row.star + '在' + row.branch + '宫入庙，实际与斗君同守本月' + p.natalName + '宫'),
          list(p.annualLucunContacts).length ? contactText(p.annualLucunContacts, '按农历年干复算的流年禄存') : '',
          ...list(p.wealthWuquChanges).filter(row => emitters[row?.layer] && chinese(row.stem) && ['禄', '权', '科'].includes(row.kind))
            .map(row => '本命武曲实守财帛月宫，' + emitters[row.layer] + row.stem + '使本宫武曲化' + row.kind),
          ...list(p.wealthWuquJi).filter(row => emitters[row?.layer] && chinese(row.stem))
            .map(row => emitters[row.layer] + row.stem + '也使同一颗武曲化忌，保留具体发干'),
          ...list(p.wealthNamedGuards).flatMap(row => chinese(row?.star) && chinese(row.branch) && chinese(row.chapterSeats)
            ? ['月财帛于' + row.branch + '宫，实守的' + row.star + '符合财帛篇所列' + row.chapterSeats + '位置'] : []),
          p.jumenTianjiSameSeatCandidate === true && chinese(p.jumenTianjiSameSeatWitness?.branch)
            ? '复核星序后，巨门与天机实守斗君所到的' + p.natalName + p.jumenTianjiSameSeatWitness.branch + '宫'
              + (p.natalName === '官禄' && p.branch === '酉' ? '。明刊官禄酉宫另论' : '') : '',
          list(p.namedPairGuardWitness?.stars).length === 2 && list(p.namedPairGuardWitness.stars).every(chinese)
            && chinese(p.natalName) && chinese(p.namedPairGuardWitness.branch)
            ? p.namedPairGuardWitness.stars.join('与') + '实守斗君所到的' + p.natalName + p.namedPairGuardWitness.branch + '宫' : '',
          chinese(p.careerTianjiWenqu?.branch) && ['守', '冲', '三合'].includes(p.careerTianjiWenqu.relation)
            ? '官禄月宫天机实守且入庙，文曲在' + p.careerTianjiWenqu.branch + '宫，与本宫为' + p.careerTianjiWenqu.relation : '',
          p.careerTianjiCounter ? contactText(p.careerTianjiCounter.natalYangTuo, '天机分支的本命羊陀') : '',
          p.careerTianjiCounter ? contactText(p.careerTianjiCounter.annualYangTuo, '天机分支的流年羊陀') : '',
          p.careerTianjiCounter ? contactText(p.careerTianjiCounter.archivedFireBell, '天机分支的归档火铃') : '',
          p.careerTianjiCounter ? contactText(p.careerTianjiCounter.mingFixedFireBell, '天机分支的明刊静位火铃') : '',
          p.careerTianjiMingClearCandidate === true ? '明刊天机文曲清止分支的本命羊陀和明刊火铃均未到会该宫' : '',
          chinese(p.careerTiantongMingClearWitness?.branch)
            ? '官禄月宫天同实守' + p.careerTiantongMingClearWitness.branch + '宫且入庙，本命羊陀和明刊火铃均未到会该宫' : '',
          chinese(p.natalName) && chinese(p.mingTianfuClearWitness?.branch)
            ? p.natalName + '月宫在' + p.mingTianfuClearWitness.branch + '宫，天府实守'
              + (p.mingTianfuClearWitness.grade === '庙' ? '且入庙' : '') + '，已核羊陀、明刊火铃、空劫与耗忌均未到会' : '',
          chinese(p.natalName) && chinese(p.mingLianzhenTianxiangClearWitness?.branch)
            ? p.natalName + '月宫在' + p.mingLianzhenTianxiangClearWitness.branch + '宫，廉贞与天相实守同宫，已核忌煞、空劫与耗曜均未到会' : '',
          list(p.careerTiantongMingShaContacts).length ? contactText(p.careerTiantongMingShaContacts, '天同庙位的本命羊陀与明刊火铃') : '',
          p.careerTianjiCounter ? '羊陀火铃的同见或不见在不同底本有异文，分层留证' : '',
          list(p.careerTempleYangSupport).length ? contactText(p.careerTempleYangSupport, '庙羊在官禄月宫同守的吉曜') : '',
          ...list(p.careerWuquGroups).filter(row => emitters[row?.layer] && chinese(row.stem)).map(row => {
            const stars = list(row.stars).filter(star => chinese(star?.star) && chinese(star.branch)
              && ['禄', '权', '科'].includes(star.kind) && ['守', '冲', '三合'].includes(star.relation));
            return stars.length === 3 ? '庙地武曲实守官禄月宫，同一' + emitters[row.layer] + row.stem
              + '所发的科权禄均会本宫，' + stars.map(star => star.branch + '宫' + star.star + '化' + star.kind
                + '与本宫为' + star.relation).join('、') : '';
          }),
          contactText(p.natalShaContacts, '生年羊陀'), contactText(p.annualShaContacts, '流年羊陀'),
          p.natalShaContactsComplete === false ? '仍有本命羊陀的星曜位置待核' : '',
          contactText(p.archivedFireBellContacts, '归档火铃'),
          contactText(p.boshiHaoContacts, '本命博士十二神大耗'), contactText(p.suiqianHaoContacts, '本命岁前大耗'),
          contactText(p.natalJiContacts, '三卷本生年干化忌'), contactText(p.annualJiContacts, '三卷本流年干化忌'),
          contactText(p.mingNatalGengJiContacts, '南阳堂明刊生年庚干化忌'),
          contactText(p.mingAnnualGengJiContacts, '南阳堂明刊流年庚干化忌'),
          ...list(p.voidHaoJiTogether).filter(row => chinese(row?.star) && chinese(row.branch)
            && ['守', '冲', '三合'].includes(row.relation)).map(row => {
            const hao = list(row.haoLabels).filter(chinese);
            const ji = list(row.jiStars).filter(item => chinese(item?.label) && chinese(item.star)).map(item => item.label + '的' + item.star);
            return hao.length && ji.length ? [row.star, ...hao, ...ji].join('、') + '实际同在' + row.branch
              + '宫，与本月斗君宫为' + row.relation : '';
          }),
          '同宫、对宫及三合分别保留。原文遇吉或遇凶的范围、耗忌的盘层和吉凶并见的取法仍待核实。',
        ]);
      }
      case 'yun_month_property_contact': {
        const verifiedLeap = p.profile === 'yun-official-v3-nominal-leap-birth-month-finance-v1'
          && p.birthMonthLayerProof === 'yun-verified-nominal-intercalary-star-layers-v1';
        if ((!verifiedLeap && p.profile !== 'yun-official-v3-lunar-sequence-v1') || !scopes[p.sourceScope]
          || ![p.sourceStem, p.star, p.branch].every(chinese)) return '';
        const placements = { natal: '归档本命', boshi: '博士系', suiqian: '岁前系' };
        const property = list(p.propertyScopes).map(scope => scopes[scope]).filter(Boolean);
        const recipient = p.recipientFinance;
        return sentences([
          verifiedLeap ? '该盘以紫微雲同名闰生月的已核归档推算' : '',
          property.length ? p.branch + '宫在' + property.join('及') + '盘是田宅' : '',
          scopes[p.sourceScope] + p.sourceStem + '干使' + p.star + '化忌，实际落' + p.branch + '宫',
          p.jumenOverlaidPropertyShaSameSeat === true ? '本命和流月田宅在同一宫，天刑、擎羊、大耗都与流月巨门忌实际同宫' : '',
          p.jumenMonthlyPropertyShaSameSeat === true && p.jumenOverlaidPropertyShaSameSeat !== true
            ? '天刑、擎羊、大耗都与流月田宅里的巨门化忌实际同宫' : '',
          p.propertyShaPlacementProof === 'yun-checked-natal-tianxing-qingyang-and-separate-dahao-v1'
            ? '天刑复算生月，擎羊复算生年干，两类大耗分别核位' : '',
          recipient?.intrinsic === true ? '本次受化星是来源所列的基础财星' : '',
          list(recipient?.wealthPalaceScopes).length
            ? '受化星实居' + recipient.wealthPalaceScopes.map(scope => scopes[scope]).filter(Boolean).join('及') + '财帛宫' : '',
          list(recipient?.luScopes).length
            ? '同一颗受化星另见' + recipient.luScopes.map(scope => scopes[scope]).filter(Boolean).join('及') + '化禄' : '',
          ...list(p.shaWitnesses).flatMap(row => placements[row?.layer] && [row.star, row.branch, row.relation].every(chinese)
            ? [placements[row.layer] + row.star + '在' + row.branch + '宫，与化忌所在宫为' + row.relation] : []),
          number(p.shaWitnessCount) !== undefined ? '共核到' + p.shaWitnessCount + '种具名煞曜' : '',
          ...list(p.missingShaPlacements).flatMap(row => placements[row?.layer] && chinese(row.star)
            ? [placements[row.layer] + row.star + '的位置未能唯一核定'] : []),
        ]);
      }
      case 'yun_month_finance_area': {
        if (!['yun-official-v3-lunar-sequence-v1', 'yun-official-v3-nominal-leap-birth-month-finance-v1'].includes(p.profile)) return '';
        return sentences([
          p.birthMonthBasis === 'nominal-intercalary-month' ? '闰月出生时，按紫微雲同名月的实算星位核对本条月财条件' : '',
          list(p.unverifiedShaLocations).length ? '来源有分歧的煞曜位置保持待核，涉及' + p.unverifiedShaLocations.filter(chinese).join('、') : '',
          p.area === 'year-axis' ? '仅核月命所叠的流年轴线两端' : '核流月命宫、官禄、财帛、迁移四处',
          p.annualQuanKeWithMinorLu === true ? '四宫有流年权科及独立小限禄，三层各留实际落位' : '',
          chinese(p.yearAxisLifeSeatFinanceSupportWitness?.branch)
            ? '流月命实际叠在' + p.yearAxisLifeSeatFinanceSupportWitness.branch + '宫，轴线两端只在该宫同时核到年月吉化直接助财星' : '',
          ...list(p.positions).flatMap(row => chinese(row?.branch) && chinese(p.area === 'year-axis' ? row.yearlyName : row.monthlyName) ? [
            (p.area === 'year-axis' ? '流年轴线的' + row.yearlyName : '流月' + row.monthlyName) + '在' + row.branch + '宫',
            ...list(row.transfers).flatMap(change => scopes[change?.sourceScope] && [change.star, change.kind].every(chinese)
              ? [scopes[change.sourceScope] + change.star + '化' + change.kind + '落这处'] : []),
            ...list(row.minorContacts).flatMap(change => [change?.star, change?.kind].every(chinese)
              ? ['此处小限' + change.star + '化' + change.kind] : []),
            list(row.finance).length ? '同宫已核财星为' + row.finance.map(role => role.star).filter(chinese).join('、') : '',
            ...yunFinanceStarDescription(row.finance),
            list(row.sha).filter(chinese).length ? '同宫归档煞曜为' + row.sha.filter(chinese).join('、') : '',
          ] : []),
          ...list(p.affectedFinance).flatMap(row => scopes[row?.sourceScope] && [row.star, row.branch].every(chinese)
            ? [scopes[row.sourceScope] + '所发的' + row.star + '化忌在' + row.branch + '宫，该星本身是已核财星'] : []),
          ...list(p.favorableFinanceContacts).flatMap(row => scopes[row?.sourceScope] && [row.star, row.kind, row.branch].every(chinese)
            ? [row.branch + '宫的财星' + row.star + '本身承' + scopes[row.sourceScope] + '化' + row.kind] : []),
          ...list(p.tabooShaSameSeat).flatMap(row => chinese(row?.branch) && list(row.sha).length
            ? [row.branch + '宫实有化忌与' + list(row.sha).filter(chinese).join('、') + '同座'] : []),
          p.onlyTabooOrOnlySha === true ? '这一查验区域的化忌和六煞均已定位，实际只见其中一类' : '',
          ...[...list(p.yearAxisTabooShaWitnesses), ...list(p.yearAxisRepeatedTabooShaWitnesses)].flatMap(row => [row?.branch, row?.yearlyName, row?.monthTaboo?.star].every(chinese)
            ? list(row.upperTaboos).filter(taboo => scopes[taboo?.sourceScope] && chinese(taboo.star)).map(taboo =>
              '流年' + row.yearlyName + row.branch + '宫，' + scopes[taboo.sourceScope] + taboo.star + '化忌与流月'
              + row.monthTaboo.star + '化忌、' + list(row.sha).filter(chinese).join('、') + '同守') : []),
          p.monthWealthSupportWithUnobstructedLife === true && chinese(p.investmentExamples?.lifeBranch)
            && chinese(p.investmentExamples?.wealthBranch)
            ? '流月命宫' + p.investmentExamples.lifeBranch + '已核无地劫和财星受年忌，财帛宫'
              + p.investmentExamples.wealthBranch + '的实际财星承年或月吉化' : '',
          '区域共核到' + p.financeCount + '颗不同财星。其中' + p.clearFinanceCount + '颗未见相关层的忌，'
            + p.affectedFinanceCount + '颗实际受年或月忌。另记录' + p.positiveContactCount + '笔吉化、'
            + p.tabooContactCount + '笔化忌',
          number(p.shaCount) !== undefined
            ? '区域' + (p.completeShaLocations === true ? '核到' : '至少核到') + p.shaCount + '种归档本命煞曜'
            : '未见已核煞曜，归档煞位未核齐',
          p.noRecordedTabooOrSha === true ? '这个区域未见已核层的忌与六种归档本命煞曜' : '',
          p.separatedTabooAndSha === true ? '已核化忌与本命煞曜均见于该区域，但分守不同宫位' : '',
          '逐项事实不代表原文多吉或少忌煞的充分阈值',
        ]);
      }
      case 'yun_sun_ji_pair':
      case 'yun_time_segment': return p.profile !== 'yun-official-v3-lunar-sequence-v1' ? '' : sentences([
        '本条采用紫微雲公开排盘界面的独立算法', chinese(p.lifeBranch) ? '本期命宫在' + p.lifeBranch : '',
        yunDayClockDescription(p),
        number(p.lunarMonth) !== undefined ? '农历' + (p.leap === true ? '闰' : '') + p.lunarMonth + '月'
          + (number(p.lunarDay) !== undefined ? p.lunarDay + '日' : '') : '',
        chinese(p.monthPillar) ? '月干支为' + p.monthPillar + '，按农历月取干，不在节气交接时换干' : '',
        number(p.monthOrdinal) !== undefined ? '这是该农历年的第' + (p.monthOrdinal + 1) + '个月段，闰月整月占一个宫序，不在十六日分半' : '',
        chinese(p.sourceStem) ? '本层发干为' + p.sourceStem : '',
        chinese(p.minorLifeBranch) && chinese(p.minorStem) ? '小限查本命年龄表，命宫在' + p.minorLifeBranch + '，取' + p.minorStem + '干且只保留禄忌' : '',
        p.sunJiNinthPairVerified === true && chinese(p.sunJiNinthPair?.yearLifeBranch)
          ? '二〇一四年农历九月与闰九月同一本命盘的流年命宫都叠大限官禄，在' + p.sunJiNinthPair.yearLifeBranch
            + '宫核到大限、流年、小限各一笔和两个月各一笔太阳化忌' : '',
        ...list(p.sunJiNinthPair?.months).flatMap(row => chinese(row?.monthPillar) && chinese(row?.monthLifeBranch)
          ? [(row.leap ? '闰九月' : '常九月') + '，月干支' + row.monthPillar + '，月命在' + row.monthLifeBranch + '宫，按实际月段保留月忌'] : []),
        p.allLayersReady === false ? '大限层依据尚未齐备' : '',
        '流月边界暂按北京时间午夜，月年交界及闰生月底盘仍待核验',
      ]);
      case 'yun_palace_condition': return p.profile !== 'yun-official-v3-lunar-sequence-v1' ? '' : sentences([
        '紫微雲独立宫位关系', yunDayClockDescription(p), chinese(p.branch) ? '地支为' + p.branch : '',
        ...[['natalName', '本命'], ['yearlyName', '流年'], ['monthlyName', '流月'], ['dailyName', '流日']]
          .map(([key, label]) => chinese(p[key]) ? '同一地支在' + label + '盘为' + p[key] : ''),
        list(p.localStarNames).filter(chinese).length ? '本命同宫星曜：' + p.localStarNames.filter(chinese).join('、') : '',
        list(p.localWealthStars).filter(chinese).length ? '来源列出的基础财星：' + p.localWealthStars.filter(chinese).join('、') : '',
        sourceTransformations(p.localTransformations) ? '同宫分层变化：' + sourceTransformations(p.localTransformations) : '',
        sourceTransformations(p.surroundingTransformations) ? '本宫三方四正分层变化：' + sourceTransformations(p.surroundingTransformations) : '',
        ...list(p.surroundingWealthJi).flatMap(row => scopes[row?.sourceScope] && [row.star, row.branch].every(chinese)
          ? ['三方四正中，' + scopes[row.sourceScope] + '所发的基础财星' + row.star + '化忌在' + row.branch + '宫'] : []),
        ...list(p.surroundingFinanceSha).flatMap(row => [row?.star, row?.branch].every(chinese)
          ? ['三方四正中，归档本命' + row.star + '实坐' + row.branch + '宫'] : []),
        ...list(p.yearAxisEvidence).flatMap(row => [row?.yearlyName, row?.branch].every(chinese)
          ? ['流年轴线的' + row.yearlyName + '在' + row.branch + '宫',
            list(row.wealth).filter(chinese).length ? '该端基础财星为' + row.wealth.filter(chinese).join('、') : '',
            ...list(row.transfers).flatMap(change => scopes[change?.sourceScope] && [change.star, change.kind].every(chinese)
              ? [scopes[change.sourceScope] + change.star + '化' + change.kind + '落这同一端'] : []),
            list(row.sha).filter(chinese).length ? '该端归档煞曜为' + row.sha.filter(chinese).join('、') : ''] : []),
        ...yunFinanceStarDescription(p.localDailyFinanceStars),
        p.dailyFinanceAxisSide === 'overlaid_wealth' ? '流日财帛叠本命财帛，财帛这一端有财星或月日化禄'
          : p.dailyFinanceAxisSide === 'fortune_only' ? '流日财福线仅福德一端有已核财星或月日化禄，按原文保留这一端的相对取义' : '',
        '基础财星、化禄和财帛承载宫分别核对；遇忌和不同层的变化不自行相抵或折成财运分数',
      ]);
      case 'yun_daily_reading': {
        if (p.profile !== 'yun-official-v3-lunar-sequence-v1') return '';
        const contactText = row => scopes[row?.sourceScope] && [row.sourceStem, row.star, row.kind].every(chinese)
          ? scopes[row.sourceScope] + row.sourceStem + '干发' + row.star + '化' + row.kind : '';
        const housing = list(p.financeScopes).map(scope => scopes[scope]).filter(Boolean);
        const month = p.monthlyContext;
        const upper = list(month?.upperContacts).map(contactText).filter(Boolean);
        const financeRoleText = row => {
          if (!chinese(row?.star)) return '';
          const seats = list(row.wealthPalaceScopes).map(scope => scopes[scope]).filter(Boolean);
          const lu = list(row.luScopes).map(scope => scopes[scope]).filter(Boolean);
          const ji = list(row.jiScopes).map(scope => scopes[scope]).filter(Boolean);
          const grounds = [...(row.intrinsic ? ['基础财星'] : []), ...(seats.length ? ['实叠' + seats.join('、') + '财帛'] : []),
            ...(lu.length ? ['受' + lu.join('、') + '化禄'] : [])];
          return grounds.length ? row.star + '的财星依据为' + grounds.join('、')
            + (ji.length ? '，同一星亦见' + ji.join('、') + '化忌' : '') : '';
        };
        const life = p.lifeSupport;
        const financeBases = { recipient: '按受化的同一颗星核财星资格', 'lu-cun': '另用实际同座的禄存',
          'di-jie': '另用实际同座的地劫', companion: '同支另核财星条件' };
        const contrary = list(p.localContacts).filter(row => (row.kind === '忌') !== (p.polarity === 'ji'))
          .map(contactText).filter(Boolean);
        return sentences([
          yunDayClockDescription(p),
          [p.branch, p.natalName, p.monthlyName, p.dailyName].every(chinese)
            ? '受化位置在' + p.branch + '宫，本命为' + p.natalName + '，流月为' + p.monthlyName + '，流日为' + p.dailyName : '',
          ...list(p.receivingContacts).map(contactText),
          financeBases[p.financeBasis],
          ...list(p.localFinanceRoles).map(financeRoleText).filter(Boolean),
          chinese(life?.branch) ? '流日命宫另在' + life.branch + '宫，承接' + list(life.receivingContacts).map(contactText).filter(Boolean).join('、') : '',
          ...list(life?.financeRoles).map(financeRoleText).filter(Boolean).map(value => '流日命宫中' + value),
          p.overlappingNatalWealth === true ? '日财帛同时叠本命财帛且满足原文两层发化与财星条件' : '',
          housing.length ? '财帛宫实际承载层为' + housing.join('、') : '',
          p.reading === 'daily-finance' && list(p.financeScopes).includes('natal') ? '原文在同类流日解读中更看重日干四化落本命财帛' : '',
          p.reading === 'daily-finance' && !list(p.financeScopes).includes('natal') ? '原文将流日财帛单独受化看作短期线索' : '',
          list(p.localStars).filter(chinese).length ? '此处原坐星曜为' + p.localStars.filter(chinese).join('、') : '',
          contrary.length ? '同处还见反向四化，分别保留为' + contrary.join('、') : '',
          list(p.localSha).filter(chinese).length ? '本宫见归档具名煞曜' + p.localSha.filter(chinese).join('、') : '',
          [month?.branch, month?.natalName, month?.yearlyName].every(chinese)
            ? '同段上层流月命宫在' + month.branch + '宫，本命对应' + month.natalName + '，流年对应' + month.yearlyName : '',
          upper.length ? '流月命宫同座的上层四化为' + upper.join('、') : '',
          list(month?.stars).filter(chinese).length ? '流月命宫原坐星曜为' + month.stars.filter(chinese).join('、') : '',
          list(month?.sha).filter(chinese).length ? '流月命宫见归档具名煞曜' + month.sha.filter(chinese).join('、') : '',
        ]);
      }
      case 'yun_month_finance_support': return p.profile !== 'yun-official-v3-lunar-sequence-v1' ? '' : sentences([
        scopes[p.sourceScope] && [p.star, p.kind, p.branch].every(chinese)
          ? scopes[p.sourceScope] + '发' + p.star + '化' + p.kind + '，落流月命宫所在' + p.branch + '宫' : '',
        chinese(p.natalName) && chinese(p.yearlyName) ? '本命为' + p.natalName + '，流年为' + p.yearlyName : '',
        ...list(p.monthlyFinanceSupport).flatMap(star => {
          if (!chinese(star?.star)) return [];
          const seats = list(star.wealthPalaceScopes).map(scope => scopes[scope]).filter(Boolean);
          const lu = list(star.luScopes).map(scope => scopes[scope]).filter(Boolean);
          const basis = [...(star.intrinsic ? ['基础财星'] : []),
            ...(seats.length ? ['同支实叠' + seats.join('、') + '财帛宫'] : []),
            ...(lu.length ? ['另受' + lu.join('、') + '化禄'] : [])];
          return basis.length ? [star.star + '在同宫符合财星条件（' + basis.join('、') + '），且该星未受流年或小限化忌'] : [];
        }),
      ]);
      case 'yun_transformation_contact': return p.profile !== 'yun-official-v3-lunar-sequence-v1' ? '' : sentences([
        '本条单独采用紫微雲四化表', scopes[p.sourceScope] && chinese(p.sourceStem) ? '发化来源为' + scopes[p.sourceScope] + '的' + p.sourceStem + '干' : '',
        yunDayClockDescription(p),
        chinese(p.star) && chinese(p.kind) ? p.star + '化' + p.kind : '',
        chinese(p.branch) ? '受化星落在' + p.branch : '',
        chinese(p.flowName) && chinese(p.natalName) ? '本期为' + p.flowName + '，本命为' + p.natalName : '',
        p.intrinsicWealthStar === true ? '该星属于来源列举的基础财星，仍须另核化忌和承载宫' : '',
        p.wealthByLu === true ? '本层另有化禄条件' : '',
        p.dailyFinanceRecipientClear === true && p.isJi === false ? '该受化星符合本段财星条件，且该星未受同段月忌或日忌' : '',
        p.dailyFinanceRecipientClear === false && p.hasLuCun === true && p.isJi === false
          ? '本段另有禄存与受化星同宫，可核同宫禄存的条件' : '',
        ...yunFinanceStarDescription(p.localDailyFinanceStars),
        ...list(p.localUpperWealthJi).flatMap(row => scopes[row?.sourceScope] && chinese(row.star)
          ? [row.star + '在本宫受' + scopes[row.sourceScope] + '化忌，记入反向条件'] : []),
        list(p.localUpperClearWealthStars).filter(chinese).length
          ? '此宫未受年忌和小限忌的基础财星为' + p.localUpperClearWealthStars.filter(chinese).join('、') : '',
        p.intrinsicWealthJi === true ? '此处是基础财星本身受忌' : '',
        p.isJi === true && p.intrinsicWealthStar === false && p.hasDiJie === true ? '受忌星非基础财星，本宫另有地劫同坐' : '',
        p.isJi === true && list(p.localLuScopes).includes('monthly') ? '同一宫位另有流月化禄，逐项保留同宫禄与忌' : '',
        p.isJi === true && list(p.localFinanceShaStars).filter(chinese).length ? '同宫归档的具名六煞为' + list(p.localFinanceShaStars).filter(chinese).join('、') : '',
        p.localDailyFinanceWealth === true && p.intrinsicWealthStar === false && p.wealthByLu === false && p.isJi === false
          ? '本宫另见财星或月日化禄，同宫财星与此受化星分别核对' : '',
        ...list(p.propertyShaContacts).flatMap(row => {
          const layer = { natal: '本命', boshi: '归档博士系', suiqian: '归档岁前系' }[row?.layer];
          return layer && [row.star, row.branch].every(chinese) && ['同宫', '对宫', '三合'].includes(row.relation)
            ? [layer + row.star + '在' + row.branch + '宫，与巨门受月忌所在田宅位置成' + row.relation] : [];
        }),
        p.isJi === true ? '本层是化忌，不能同时按同一层吉化计为财星支持' : '',
        p.sourceStem === '庚' ? '本表庚干采用天府化科、天同化忌，不套太阴化科或天相忌' : '',
        '各层和时间口径分别保留，不将同一受化星重复计权',
      ]);
      case 'quanshu_annual_context': return sentences([
        '本条按《全书》所引录文的禄存羊陀口诀独立核验',
        chinese(p.birthStem) ? '出生年干为' + p.birthStem : '',
        chinese(p.lifeBranch) && chinese(p.migrationBranch) ? '本命命宫在' + p.lifeBranch + '，迁移宫在' + p.migrationBranch : '',
        [['lucunBranch', '本命禄存'], ['qingyangBranch', '本命擎羊'], ['tuoluoBranch', '本命陀罗'],
          ['annualLucunBranch', '流年禄存'], ['annualQingyangBranch', '流年擎羊'], ['annualTuoluoBranch', '流年陀罗']]
          .map(([key, name]) => chinese(p[key]) ? name + '在' + p[key] + '宫' : '').filter(Boolean).join('，'),
        chinese(p.annualStem) ? '本段流年天干为' + p.annualStem : '',
        ['守', '冲', '三合'].includes(p.annualQingyangLifeRelation) ? '流年擎羊与本命命宫为' + p.annualQingyangLifeRelation : '',
        ['守', '冲', '三合'].includes(p.annualTuoluoLifeRelation) ? '流年陀罗与本命命宫为' + p.annualTuoluoLifeRelation : '',
        '采用所引版本，不与羊陀互置的异文混用；同一位置不重复加权',
      ]);
      case 'quanshu_shangshi_limits': {
        if (p.profile !== 'quanshu-shangshi-limit-branches-v2') return '';
        const contact = (label, relation) => chinese(relation) ? label + '为' + relation : '';
        const positions = rows => list(rows).filter(row => chinese(row.star) && chinese(row.branch)
          && ['守', '冲', '三合'].includes(row.relation)).map(row => row.star + '在' + row.branch + '宫，与此宫为' + row.relation).join('，');
        return sentences([
          number(p.lunarYear) !== undefined ? '按农历' + p.lunarYear + '年核《全书》天伤天使同段位置' : '',
          ...list(p.unverifiedMajorStars).filter(chinese).map(star => star + '的位置未能复核'),
          ...[p.tianshang, p.tianshi].flatMap(row => {
            if (![row?.reliefCandidate, row?.crossGroupReliefCandidate, row?.adverseCandidate, row?.annualFirePairCandidate,
              row?.jielanFireCandidate, row?.quanshuFixedFireCandidate, row?.xuDiagramCandidate].includes(true)
              || !chinese(row.star) || !chinese(row.branch)) return [];
            const localPrincipals = list(row.localPrincipals).filter(chinese);
            const jielan = row.jielanFireCandidate === true && chinese(row.jielan?.fire?.branch)
              && row.jielan.fire.branch !== list(row.adverse).find(star => star.star === '归档火星')?.branch ? row.jielan : undefined;
            const common = list(row.adverse).filter(star => ['巨门', '天机'].includes(star.star));
            const nanyang = row.quanshuFixedFireCandidate === true && chinese(row.nanyang?.fire?.branch) ? row.nanyang : undefined;
            const natalFireYang = row.star === '天伤' && p.tianshangMingNatalFireYangDoubleGuardCandidate === true
              ? p.tianshangMingNatalFireYangDoubleGuardWitness : undefined;
            return [
              '本命' + row.star + '在' + row.branch + '宫，' + [contact('太岁', row.annualRelation), contact('大限', row.decadalRelation),
                contact('小限', row.minorRelation)].filter(Boolean).join('、'),
              row.star === '天使' ? '太岁、大限和小限同守天使宫' : '',
              row.diagram?.listedForStar ? '《伤使祸福紧慢图》另为' + row.star + '列出' + row.branch + '宫' : '',
              row.diagram?.sharedLabel && !row.diagram.haiSidebar ? '图心将' + row.branch + '宫列为伤使共用位置' : '',
              row.diagram?.haiSidebar ? '图心合列亥宫，亥宫旁注另及大限有宜，两处分别留证' : '',
              chinese(row.diagram?.wuBodyBranch) ? '午宫天伤图注另有身合。当前本命身宫在' + row.diagram.wuBodyBranch
                + '宫，按卷二安法与天伤不同宫，亦无冲及三合' : '',
              row.xuDiagramCandidate === true ? '戌宫天使按图核同段实守，另见' + list(row.diagram?.xuAdverse)
                .map(star => chinese(star.layer) + chinese(star.star)).join('、') + '实守戌宫' : '',
              row.noLocalPrincipals === true ? '已核十八正曜和本命禄存，该宫均未见' : localPrincipals.length ? '该宫核到正曜或本命禄存，为' + localPrincipals.join('、') : '',
              ...list(row.relief).filter(group => row.reliefCandidate === true && group.present === true && chinese(group.name)).map(group =>
                '该宫守冲三合范围核到' + group.name + '这一组。' + positions(group.stars)),
              ...list(row.crossGroupReliefWitnesses).filter(pair => row.crossGroupReliefCandidate === true
                && chinese(pair.guard?.star) && chinese(pair.aspect?.star) && chinese(pair.aspect.branch)
                && ['冲', '三合'].includes(pair.aspect.relation)).map(pair => '本宫实守' + pair.guard.star
                + '，另一组的' + pair.aspect.star + '在' + pair.aspect.branch + '宫，与本宫为' + pair.aspect.relation),
              row.adverseCandidate === true ? '同一宫的守冲三合范围核到擎羊、归档火星、巨门和天机。' + positions(row.adverse) : '',
              row.annualFirePairCandidate === true && chinese(row.annualSheep?.branch) && chinese(row.annualSheep.relation)
                ? '流年擎羊与归档火星同在' + row.annualSheep.branch + '宫，与此宫为' + row.annualSheep.relation + '。'
                  + positions(common) : '',
              jielan?.withNatalSheep === true ? '以《捷览》火星核本命擎羊、火星、巨门和天机同段会宫。'
                + positions([list(row.adverse).find(star => star.star === '擎羊'), jielan.fire, ...common].filter(Boolean)) : '',
              jielan?.withAnnualSheep === true ? '流年擎羊与《捷览》所推火星同在' + jielan.fire.branch + '宫，与此宫为'
                + jielan.fire.relation + '。' + positions(common) : '',
              natalFireYang ? '太岁、大限、小限实守同一天伤空宫。按明刊核本命擎羊、定宫火星、巨门和天机。'
                + positions([natalFireYang.yang, natalFireYang.fire, natalFireYang.jumen, natalFireYang.tianji])
                : nanyang?.withNatalSheep === true ? '按南阳堂明刊火星核' + row.star + '宫的生年擎羊、火星、巨门和天机。'
                + positions([list(row.adverse).find(star => star.star === '擎羊'), nanyang.fire, ...common].filter(Boolean)) : '',
              nanyang?.withAnnualSheep === true ? '流年擎羊与南阳堂明刊火星同在' + nanyang.fire.branch + '宫，与' + row.star + '宫为'
                + nanyang.fire.relation + '。' + positions(common) : '',
            ];
          }),
          '以上为同段几何和已核星组，众吉的范围、归档火星的原法和综合作用待核',
        ]);
      }
      case 'quanshu_year_and_limits': return yearAndLimitsDescription(p);
      case 'quanshu_limit_branches': {
        const split = p.templeChangQuSplitDoubleGuardWitness;
        if (p.profile === 'quanshu-north-south-limit-binding-v1' && p.templeChangQuSplitDoubleGuardCandidate === true
          && chinese(split?.chang?.branch) && chinese(split?.qu?.branch) && scopes[split.chang.scope] && scopes[split.qu.scope]) {
          return '三卷本两庙星在各自有效半段分守真限。文昌守' + split.chang.branch + '宫的' + scopes[split.chang.scope]
            + '，文曲守' + split.qu.branch + '宫的' + scopes[split.qu.scope] + '。';
        }
        if (p.profile === 'quanshu-north-south-limit-binding-v1' && chinese(p.branch)) {
          if (p.wenquTempleDoubleGuardCandidate === true) {
            return '本命文曲在' + p.branch + '宫入庙。实际大限上五年与小限上半年同守该宫。';
          }
          if (p.wenchangTempleDoubleGuardCandidate === true) {
            return '本命文昌在' + p.branch + '宫入庙。实际大限下五年与小限下半年同守该宫。';
          }
        }
        if (p.profile !== 'quanshu-limit-branches-v1') return '';
        const verifiedDecadal = p.sourceDecadal?.verified === true;
        const verifiedMinor = p.sourceMinor?.verified === true;
        const contacts = [...(verifiedDecadal ? [['decadalRelation', '大限']] : []),
          ...(verifiedMinor ? [['minorRelation', '小限']] : [])];
        const geometry = (row, filter) => contacts.filter(([key]) => filter === undefined || key === filter)
          .map(([key, label]) => chinese(row?.[key]) ? '与' + label + '为' + row[key] : '').filter(Boolean).join('，');
        const positions = (group, filter) => list(group.stars).filter(row => chinese(row.star) && chinese(row.branch)).map(row =>
          [row.star + '在' + row.branch + '宫', geometry(row, filter)].filter(Boolean).join('，')).join('；');
        const opposition = contacts.filter(([key]) => p.yearContacts?.[key] === '冲').map(([, label]) => label);
        const chenXu = [p.chenXuChangQuCandidate, p.chenXuTempleCandidate, p.chenXuTempleAspectCandidate].includes(true);
        const templeBothLimits = p.templeChangQuBothLimitsCandidate === true;
        const threeVolumeJi = p.threeVolumeJiChenXuNatalChangQuLifeCandidate === true;
        const changQuLife = threeVolumeJi ? p.threeVolumeJiChenXuNatalChangQuLifeWitness
          : p.mingChenXuNatalChangQuLifeCandidate === true ? p.mingChenXuNatalChangQuLifeWitness : undefined;
        const hasChangQuEvidence = chenXu || templeBothLimits;
        const otherLimit = p.decadalAtChenXu === true ? ['小限', 'minorRelation'] : ['大限', 'decadalRelation'];
        const verseContacts = hasChangQuEvidence ? list(p.changQu).filter(row => chinese(row.star) && chinese(row.branch)) : [];
        const splitStars = p.chenXuSplitChangQuCandidate === true ? contacts.map(([key, label]) => {
          const star = verseContacts.find(row => ['守', '冲', '三合'].includes(row[key]));
          return star ? label + '会到' + star.star : '';
        }).filter(Boolean).join('，') : '';
        const hasOpposedEvidence = [p.annualReliefCandidate, p.annualCrossGroupReliefCandidate, p.annualAdverseCandidate, p.annualSeatedReliefCandidate,
          p.annualSeatedAdverseCandidate, p.annualOpposedGuardCandidate, p.annualTrineAdverseCandidate,
          p.annualOpposedQishaCandidate, p.annualOpposedDecadalVerifiedFullReliefCandidate, p.annualMingFixedOppositionShaCandidate].includes(true);
        const decadal = list(p.seatEvidence).find(row => row.scope === 'decadal');
        const starList = values => list(values).map(chinese).filter(Boolean).join('、');
        const qisha = p.qishaTianfuAtLimitCandidate === true ? p.qishaTianfu : undefined;
        const qishaLimits = list(qisha?.limits);
        const qishaAdverseLimits = p.qishaAdverseAtLimitCandidate === true ? list(p.qishaTianfu?.limits)
          .filter(row => row?.qishaRelation === '守' && ['decadal', 'minor'].includes(row.scope) && chinese(row.branch)) : [];
        return sentences([
          number(p.lunarYear) !== undefined ? '农历' + p.lunarYear + '年的实际岁限星位' : '',
          verifiedDecadal && chinese(p.sourceDecadal.branch) ? '大限命宫在' + p.sourceDecadal.branch + '宫' : '',
          verifiedMinor && chinese(p.minorBranch) ? '小限命宫在' + p.minorBranch + '宫' : '',
          changQuLife && [changQuLife.birthStem, changQuLife.lifeBranch, changQuLife.decadalBranch, changQuLife.minorBranch].every(chinese)
            ? (threeVolumeJi ? '据三卷本，' : '') + changQuLife.birthStem + '年本命'
              + list(changQuLife.stars).map(row => chinese(row.star)).filter(Boolean).join('、')
              + '同守' + changQuLife.lifeBranch + '宫；实算大限' + changQuLife.decadalBranch + '、小限' + changQuLife.minorBranch : '',
          hasOpposedEvidence && chinese(p.annualBranch) && opposition.length
            ? '太岁在' + p.annualBranch + '宫，实际冲' + opposition.join('和') : '',
          p.annualOpposedGuardCandidate === true && chinese(p.annualBranch)
            ? '太岁所在' + p.annualBranch + '宫与' + starList(p.annualAdverseGuards) + '同宫，为受冲限宫的对宫见位' : '',
          ...list(p.annualTrineAdverseWitnesses).filter(row => p.annualTrineAdverseCandidate === true
            && chinese(p.annualBranch) && chinese(row?.star) && chinese(row.branch) && row.relation === '三合')
            .map(row => row.star + '在' + row.branch + '宫，三合太岁所在的' + p.annualBranch + '宫'),
          p.annualOpposedQishaCandidate === true && chinese(p.annualQishaBranch) && opposition.length
            ? '本命七杀实守受冲' + opposition.join('和') + '所在的' + p.annualQishaBranch + '宫' : '',
          p.annualSeatedReliefCandidate === true && chinese(decadal?.branch)
            ? '大限命宫在' + decadal.branch + '宫，具名助曜实守有' + starList(decadal.helperGuards) : '',
          verifiedMinor && decadal?.opposed === false && p.yearContacts?.minorRelation === '冲'
            && [p.annualReliefCandidate, p.annualSeatedReliefCandidate, p.annualCrossGroupReliefCandidate].includes(true)
            ? '本段太岁冲小限，具名助曜属于另一宫的大限背景' : '',
          ...list(p.seatEvidence).filter(row => p.annualSeatedAdverseCandidate === true
            && row.hasOpposedAdverseGuard === true && scopes[row.scope] && chinese(row.branch))
            .map(row => '受冲' + scopes[row.scope] + '在' + row.branch + '宫，具名煞曜实守有' + starList(row.adverseGuards)),
          ...list(p.relief).filter(group => p.annualReliefCandidate === true && group.decadalPair === true && chinese(group.name)).map(group =>
            '大限同段核到' + group.name + '这一组。' + positions(group)),
          p.annualOppositionProfile === 'quanshu-nanyangtang-verified-limit-opposition-v1'
            && p.annualDoubleVerifiedOppositionCandidate === true && [p.annualBranch, p.decadalBranch, p.minorBranch].every(chinese)
            ? '太岁在' + p.annualBranch + '宫，同年实际对冲' + p.decadalBranch + '宫大限和' + p.minorBranch + '宫小限' : '',
          p.annualOppositionProfile === 'quanshu-nanyangtang-verified-limit-opposition-v1'
            && p.annualOpposedDecadalVerifiedFullReliefCandidate === true && chinese(p.decadalBranch)
            ? '紫府、昌曲、辅弼和魁钺八个已核位置均可守冲三合受太岁对冲的' + p.decadalBranch + '宫大限' : '',
          ...list(p.annualMingFixedSha).filter(row => p.annualMingFixedOppositionShaCandidate === true
            && p.quanshuFixedFireBellProfile === 'quanshu-nanyangtang-fixed-firebell-v1' && chinese(row.star) && chinese(row.branch))
            .flatMap(row => [
              p.yearContacts?.decadalRelation === '冲' && row.decadalRelation === '守' ? '实守受冲大限' : '',
              p.sourceMinor?.verified === true && p.yearContacts?.minorRelation === '冲' && row.minorRelation === '守' ? '实守受冲小限' : '',
              ['守', '三合'].includes(row.annualRelation) ? '与太岁为' + row.annualRelation : '',
            ].filter(Boolean).map(location => '明刊定宫' + row.star + '在' + row.branch + '宫，' + location)),
          p.annualCrossGroupReliefCandidate === true ? '同段有不同组具名助曜照到大限。'
            + list(p.annualCrossGroupReliefWitnesses).map(group => positions(group, 'decadalRelation')).filter(Boolean).join('。') : '',
          ...list(p.annualOppositionAdverse).flatMap(group => !chinese(group.name) ? [] : [
            group.decadalPair === true ? '受冲大限见' + group.name + '一组。' + positions(group, 'decadalRelation') : '',
            group.minorPair === true ? '受冲小限见' + group.name + '一组。' + positions(group, 'minorRelation') : '',
          ]),
          ...list(p.seatEvidence).flatMap(row => {
            const counts = row.opposedCounts;
            return hasOpposedEvidence && counts && scopes[row.scope] && chinese(row.branch) ? [
              '受冲' + scopes[row.scope] + '在' + row.branch + '宫，其守冲三合范围已定位助曜' + counts.visibleHelpers + '位、煞曜'
                + counts.visibleAdverse + '位' + (counts.unresolvedHelpers || counts.unresolvedAdverse
                  ? '，另有助曜' + counts.unresolvedHelpers + '位、煞曜' + counts.unresolvedAdverse + '位的位置待核' : ''),
            ] : [];
          }),
          hasOpposedEvidence
            ? '吉众恶多的原文判据、实际扶救和归档火铃的原法仍待核' : '',
          hasChangQuEvidence && chinese(p.birthStem) ? '生年干为' + p.birthStem + '，按同书星表分别核本命文昌与文曲' : '',
          ...verseContacts.map(row => sentences([
            row.star + '在' + row.branch + '宫' + (chinese(row.grade) ? '，卷三星表列为' + row.grade : '，卷三星表未列此位等级'),
            geometry(row),
            p.chenXuTempleCandidate === true && row.templeAtOtherLimit === true ? '一限到辰戌，另一限实际守这颗入庙星' : '',
            p.chenXuTempleAspectCandidate === true && row.templeAspectAtOtherLimit === true ? otherLimit[0] + '与入庙的'
              + row.star + '实际' + (row[otherLimit[1]] === '冲' ? '对冲' : '三合') : '',
            p.chenXuBothLimitsCandidate === true && row.bothLimitsMeet === true ? '大小限均会到同一颗' + row.star : '',
            templeBothLimits && row.templeBothLimitsMeet === true ? '按卷三通行本注语单列入庙双限候选，大小限均到入庙的' + row.star : '',
          ])),
          splitStars ? splitStars + '，两限所会为不同星' : '',
          hasChangQuEvidence ? '辰戌限与入庙双限的原文承接仍待核' : '',
          qisha && chinese(qisha.qishaBranch) && chinese(qisha.tianfuBranch) && qisha.relation === '冲'
            ? '七杀在' + qisha.qishaBranch + '宫' + (chinese(qisha.qishaGrade) ? '，卷三列为' + qisha.qishaGrade : '')
              + '，对宫' + qisha.tianfuBranch + '有天府' + (chinese(qisha.tianfuGrade) ? '，卷三列为' + qisha.tianfuGrade : '') : '',
          ...qishaLimits.flatMap(row => scopes[row.scope] ? [chinese(row.branch) && chinese(row.qishaRelation) && chinese(row.tianfuRelation)
            ? scopes[row.scope] + '在' + row.branch + '宫，与七杀为' + row.qishaRelation + '，与天府为' + row.tianfuRelation
            : scopes[row.scope] + '星位待核'] : []),
          qisha ? '原诀的二限取法和对宫天府的实际作用仍待核' : '',
          qisha || qishaAdverseLimits.length ? '七杀入限的时间按所守限层的下五年或下半年核对' : '',
          ...qishaAdverseLimits.map(row => '本命七杀实守' + scopes[row.scope] + row.branch + '宫，同宫煞曜有'
            + starList(list(p.qishaAdverseGuards).map(star => star.star))),
        ]);
      }
      case 'quanshu_literary_limits': {
        if (p.profile !== 'quanshu-literary-limits-v1') return '';
        const emitters = { natal: '生年干', yearly: '流年干', decadal: '大限宫干', minor: '小限宫干' };
        const see = (branch, rel, name) => chinese(branch) && ['守', '冲', '三合'].includes(rel)
          ? name + '在' + branch + '宫，与限宫为' + rel : '';
        const limits = list(p.limits).filter(seat => (seat.layer !== 'minor' || p.sourceMinor?.verified === true)
          && (seat.layer !== 'decadal' || p.sourceDecadal?.verified === true));
        const validSplit = row => ['decadal', 'minor'].includes(row?.horseLayer)
          && ['decadal', 'minor'].includes(row.peerLayer) && row.horseLayer !== row.peerLayer;
        const productSplits = list(p.horseSplit).filter(validSplit), lumingSplits = list(p.lumingHorseSplit).filter(validSplit);
        const tablesAgree = p.horseChangDoubleGuardAgreementCandidate === true;
        const doubleGuard = tablesAgree ? p.horseChangDoubleGuardAgreementWitness
          : p.jielanAnnualChangProfile === 'jielan-annual-chang-by-year-stem-v1' && p.horseChangJielanDoubleGuardCandidate === true
            ? p.horseChangJielanDoubleGuardWitness : undefined;
        const opposed = p.horseChangZiFuOpposedDoubleGuardCandidate === true ? p.horseChangZiFuOpposedDoubleGuardWitness : undefined;
        const oppositeStars = list(opposed?.stars).filter(row => chinese(row.branch) && row.relation === '冲');
        const lumingGuard = p.horseChangLumingDoubleGuardCandidate === true ? p.horseChangLumingDoubleGuardWitness : undefined;
        const sameSplit = (a, b) => a.horseLayer === b.horseLayer && a.peerLayer === b.peerLayer;
        const splitPaths = [...productSplits, ...lumingSplits]
          .filter((row, index, all) => index === all.findIndex(other => sameSplit(row, other)));
        const lumingChang = seat => see(p.lumingChang, seat.lumingChangRelation, '《紫微随笔》禄命法的流昌');
        const commonMinor = p.movingChangQuLifeAndCommonMinorTrinesCandidate === true ? p.movingChangQuCommonMinorTrineWitness : undefined;
        const bothLimits = p.movingChangQuBothLimitsTrineCandidate === true ? p.movingChangQuBothLimitsTrineWitness : undefined;
        const mixedTrines = p.movingChangQuMixedNamedTrinesCandidate === true ? list(p.movingChangQuMixedNamedTrinesWitness) : [];
        const sibling = p.keChangVerifiedSiblingLimitProfile === 'quanshu-nanyangtang-natal-ke-chang-sibling-limit-v1'
          && (p.keChangVerifiedOpposedLimit === true || p.keChangVerifiedTrineLimit === true) ? p.keChangVerifiedSiblingWitness : undefined;
        const mingGeng = p.keChangMingGengProfile === 'quanshu-nanyangtang-geng-tiantong-ke-at-chang-v1'
          && [p.keChangMingGengDoubleGuard, p.keChangMingGengOpposedLimit, p.keChangMingGengTrineLimit].includes(true)
          ? p.keChangMingGengWitness : undefined;
        const mingGengShared = p.keChangMingGengSharedLimitAspect === true ? p.keChangMingGengSharedLimitAspectWitness : undefined;
        const mingKeAspect = p.keChangMingNatalDoubleGuardWithKeAspectWitness;
        const mingKeGuard = p.keChangMingNatalKeAtDoubleGuardWithChangAspectWitness;
        const siblingSeat = (scope, row) => chinese(row?.branch) && ['守', '冲', '三合'].includes(row.relation)
          ? scopes[scope] + (row.relation === '守' ? '实守' + row.branch + '宫'
            : '在' + row.branch + '宫' + (row.relation === '冲' ? '对冲' : '三合')) : '';
        return sentences([
          number(p.lunarYear) !== undefined ? '按农历' + p.lunarYear + '年核《全书》文昌、化科、流年昌曲及天马' : '',
          p.sourceDecadal?.verified === false ? '归档大限未能通过该农历年的实际十年段核验，该宫与其发干关系保留未知' : '',
          chinese(p.chang) && chinese(mingKeAspect?.stem) && chinese(mingKeAspect?.star)
            ? '大小限实守' + p.chang + '宫文昌。' + see(mingKeAspect.branch, mingKeAspect.relation,
              '明刊生年' + mingKeAspect.stem + '干化科的' + mingKeAspect.star) : '',
          !mingGengShared && chinese(mingKeGuard?.branch) && chinese(mingKeGuard?.stem) && chinese(mingKeGuard?.star)
            ? '大小限实守' + mingKeGuard.branch + '宫明刊生年' + mingKeGuard.stem + '干化科的'
              + mingKeGuard.star + '。' + see(mingKeGuard.changBranch, mingKeGuard.changRelation, '文昌') : '',
          chinese(mingGengShared?.branch) ? '明刊庚干天同与文昌一守一照同一双限宫' + mingGengShared.branch + '，'
            + [see(mingGengShared.chang?.branch, mingGengShared.chang?.relation, '文昌'),
              see(mingGengShared.ke?.branch, mingGengShared.ke?.relation, '庚干化科的天同')].filter(Boolean).join('、') : '',
          ...mixedTrines.flatMap(row => scopes[row.layer] && chinese(row.branch) && chinese(row.natalStem)
            ? ['本命助曜与生年化曜三合到同一限宫，实核' + scopes[row.layer] + '在' + row.branch + '宫。'
              + list(row.pairs).flatMap(({ support, recipient }) => [see(support.branch, support.relation, support.star),
                see(recipient.branch, recipient.relation, row.natalStem + '干化' + recipient.kind + '的' + recipient.star)]).filter(Boolean).join('、')] : []),
          chinese(opposed?.branch) && oppositeStars.some(row => row.star === '紫微') && oppositeStars.some(row => row.star === '天府')
            ? '复算大小限守' + opposed.branch + '宫，' + oppositeStars[0].branch + '宫的紫微与天府实由对宫照来，符合原文守照条件' : '',
          chinese(lumingGuard?.branch) && chinese(lumingGuard.annualStem)
            ? '按钟义明〈天马篇〉附注的禄命法，复算大小限同守' + lumingGuard.branch + '宫。'
              + list(lumingGuard.stars).map(row => see(row.branch, row.relation, row.star)).filter(Boolean).join('、') : '',
          chinese(doubleGuard?.branch) && chinese(doubleGuard.annualStem)
            ? (tablesAgree ? '大限与复算小限实守' + doubleGuard.branch + '宫，两种' + doubleGuard.annualStem + '干流昌安法同落此宫，'
              : '按《捷览》' + doubleGuard.annualStem + '干安流昌，大限和小限实守' + doubleGuard.branch + '宫，')
              + list(doubleGuard.stars).filter(row => row.relation === '守' && row.branch === doubleGuard.branch)
                .map(row => chinese(row.star)).filter(Boolean).join('、') + '同时实守' : '',
          chinese(bothLimits?.branch) && chinese(bothLimits.annualStem) && chinese(bothLimits.annualLu?.star)
            ? '大限与复算小限实守' + bothLimits.branch + '宫，流昌和流曲从不同宫三合到会。'
              + [...list(bothLimits.moving), bothLimits.sun, { ...bothLimits.annualLu,
                star: bothLimits.annualStem + '干所化禄的' + bothLimits.annualLu.star }]
                .map(row => see(row?.branch, row?.relation, row?.star)).filter(Boolean).join('、') : '',
          chinese(commonMinor?.lifeBranch) && chinese(commonMinor?.commonBranch)
            ? '《捷览》按年干排的流昌实守本命' + commonMinor.lifeBranch + '宫。'
              + list(commonMinor.moving).filter(row => row.star === '流曲' && chinese(row.branch) && chinese(row.relation))
                .map(row => '经核位的流曲在' + row.branch + '宫，对本命命宫为' + row.relation).join('、')
              + '。复算小限与太岁同守' + commonMinor.commonBranch + '宫，'
              + list(commonMinor.trines).map(row => see(row.branch, row.relation, row.star)).filter(Boolean).join('、') : '',
          chinese(p.chang) ? '本命文昌核位在' + p.chang + '宫' + (chinese(p.changGrade) ? '，同书星表列为' + p.changGrade : '') : '',
          chinese(p.changNanyangGrade) && p.changNanyangGrade !== p.changGrade ? '明刊文昌正文另列此宫为' + p.changNanyangGrade : '',
          p.changThreeLayersCandidate === true && p.changContacts ? '本命文昌同段对流年、大限、小限的关系分别是'
            + [p.changContacts.yearly, p.changContacts.decadal, p.changContacts.minor].filter(chinese).join('、') : '',
          p.changVerifiedTripleGuard === true && chinese(p.chang)
            ? '经原法核小限，太岁和大小限均实守文昌的' + (p.changGrade === '庙' ? '入庙宫' + p.chang : p.chang + '宫') : '',
          p.keChangVerifiedDoubleGuard === true && chinese(p.keChangVerifiedWitness?.star) && chinese(p.keChangVerifiedWitness.branch)
            ? '经原法核小限，大小限同守文昌，生年干使' + p.keChangVerifiedWitness.star
              + '化科并实守' + p.keChangVerifiedWitness.branch + '宫' : '',
          sibling && chinese(sibling.stem) && chinese(sibling.star) && chinese(sibling.branch)
            ? '生年' + sibling.stem + '干令' + sibling.star + '化科，与本命文昌同在' + sibling.branch + '宫。'
              + [siblingSeat('decadal', sibling.decadal), siblingSeat('minor', sibling.minor)].filter(Boolean).join('，') : '',
          mingGeng?.stem === '庚' && mingGeng.star === '天同' && chinese(mingGeng.branch)
            ? '明刊庚干以天同化科，与本命文昌同在' + mingGeng.branch + '宫。'
              + [siblingSeat('decadal', mingGeng.decadal), siblingSeat('minor', mingGeng.minor)].filter(Boolean).join('，') : '',
          ...limits.flatMap(seat => {
            if (!['decadal', 'minor'].includes(seat.layer) || !chinese(seat.branch)) return [];
            const ke = list(seat.ke).filter(row => [row.candidate, row.aspectCandidate, row.sharedAspectCandidate, row.splitAspectCandidate].includes(true)
              && emitters[row.layer] && chinese(row.stem) && chinese(row.recipient));
            const movingAtLifeAndLimit = [seat.movingAssistantCandidate, seat.movingNamedTrinesCandidate,
              seat.movingNatalTransformCandidate, seat.movingSourceSeatsCandidate].includes(true);
            const horseAtLimit = [seat.horseCandidate, seat.lumingHorseCandidate].includes(true) && chinese(p.horse);
            if (!ke.length && ![seat.changAdverse, seat.changTrineShaJi, seat.changQuanshuFixedAdverse,
              seat.changQuanshuFixedTrineShaJi, seat.movingCandidate, movingAtLifeAndLimit, horseAtLimit].includes(true)) return [];
            return [scopes[seat.layer] + '命宫在' + seat.branch + '宫',
              ...(ke.length ? [see(p.chang, seat.changRelation, '本命文昌'), ...ke.map(row => {
                const change = emitters[row.layer] + row.stem + '使' + row.recipient + '化科';
                if (row.candidate === true) return change + '，受化星守此限宫';
                if (!chinese(row.branch) || !['冲', '三合'].includes(row.relation)) return '';
                if (row.splitAspectCandidate === true && chinese(p.chang) && ['冲', '三合'].includes(seat.changRelation)) {
                  return change + '，本命文昌在' + p.chang + '宫，受科星在' + row.branch + '宫，分别以'
                    + seat.changRelation + '、' + row.relation + '照同一限宫';
                }
                return row.sharedAspectCandidate === true
                  ? change + '，受化星与本命文昌同居' + row.branch + '宫，共以' + row.relation + '照此限'
                  : change + '，受化星在' + row.branch + '宫，与守限文昌为' + row.relation;
              })] : []),
              ...(seat.changAdverse === true ? [
                '卷三星表列陷的本命文昌守此限，已见具名煞曜及化忌，科名分支在此段排除',
                ...list(seat.changSha).filter(row => chinese(row.star)).map(row => see(row.branch, row.relation, row.star)),
                ...list(seat.changJi).filter(row => emitters[row.layer] && chinese(row.stem) && chinese(row.star)).map(row =>
                  see(row.branch, row.relation, emitters[row.layer] + row.stem + '所化忌的' + row.star)),
              ] : []),
              ...(seat.changTrineShaJi === true ? list(seat.changTrineShaJiWitnesses).flatMap(row => {
                const sha = list(row?.sha).filter(chinese).join('、');
                if (!sha || !emitters[row.layer] || ![row.stem, row.star, row.branch].every(chinese)) return [];
                return ['卷三星表列陷的本命文昌守此限，' + sha + '与' + emitters[row.layer] + row.stem + '所化忌的' + row.star
                  + '同在' + row.branch + '宫，共以三合照此限' + (p.changThreeLayersCandidate === true ? '，科名分支在此段排除' : '')];
              }) : []),
              ...(seat.changQuanshuFixedAdverse === true ? [
                '明刊文昌在陷地守此限，明刊火铃与化忌同时有见位',
                ...list(seat.changQuanshuFixedSha).filter(row => chinese(row.star)).map(row => see(row.branch, row.relation, row.star)),
                ...list(seat.changQuanshuFixedJi).filter(row => emitters[row.layer] && chinese(row.stem) && chinese(row.star))
                  .map(row => see(row.branch, row.relation, emitters[row.layer] + row.stem + '所化忌的' + row.star)),
              ] : []),
              ...(seat.changQuanshuFixedTrineShaJi === true ? list(seat.changQuanshuFixedTrineWitnesses).flatMap(row => {
                if (!emitters[row.layer] || ![row.sha, row.stem, row.star, row.branch].every(chinese)) return [];
                return ['明刊文昌陷守此限，' + row.sha + '与' + emitters[row.layer] + row.stem + '所化忌的' + row.star
                  + '同在' + row.branch + '宫，共以三合照此限'];
              }) : []),
              ...(seat.movingCandidate === true ? [
                ...list(seat.moving).filter(row => chinese(row.star)).map(row => see(row.branch, row.relation, row.star)),
                see(p.sun, seat.sunRelation, '本命太阳'),
                ...list(seat.annualLu).filter(row => ['冲', '三合'].includes(row.relation) && chinese(row.star)).map(row =>
                  see(row.branch, row.relation, row.kind === '化禄' ? '年干化禄的' + row.star : '流年禄存')),
                '流年昌曲按当前排盘引擎的十干位置核对，古籍安法、流禄所指及全吉组仍待核',
              ] : []),
              ...(movingAtLifeAndLimit && chinese(p.lifeBranch) ? [
                '按引擎核位的流昌流曲同时会到' + p.lifeBranch + '宫的本命命宫与此限，至少一曜实守此限',
                ...list(seat.moving).filter(row => chinese(row.star)).map(row => see(row.branch, row.relation, row.star)),
                seat.movingAssistantCandidate === true ? '本命辅弼均三合此限，为' + list(seat.assistants)
                  .filter(row => chinese(row.star) && chinese(row.branch)).map(row => row.branch + '宫的' + row.star).join('与') : '',
                seat.movingNamedTrinesCandidate === true && list(seat.namedSupportTrines).some(row => !['左辅', '右弼'].includes(row.star))
                  ? '实际三合此限的具名本命星曜为' + list(seat.namedSupportTrines)
                    .filter(row => chinese(row.star) && chinese(row.branch) && row.relation === '三合')
                    .map(row => row.branch + '宫的' + row.star).join('、') : '',
                seat.movingNatalTransformCandidate === true && chinese(seat.natalTransformStem)
                  ? '同一生年干' + seat.natalTransformStem + '的科权禄受曜中实际三合此限的是'
                    + list(seat.natalTransformTrines).filter(row => chinese(row.star) && chinese(row.branch)
                      && ['科', '权', '禄'].includes(row.kind) && row.relation === '三合')
                      .map(row => row.branch + '宫的' + row.star + '化' + row.kind).join('、') : '',
                seat.movingSourceSeatsCandidate === true ? '流昌流曲分居巳、酉，符合卷一所列得地支位' : '',
                '流昌流曲仍按兼容引擎的十干位置核对，全吉组和古籍安法待核',
              ] : []),
              ...(horseAtLimit ? [
                '本命天马在' + p.horse + '宫，同守此限宫',
                ...list(seat.horseCompanions).filter(row => chinese(row.star) && (row.star !== '流昌' || seat.horseCandidate === true))
                  .map(row => see(row.branch, row.relation, row.star)),
                seat.horseCandidate === true ? '兼容引擎的流昌已按实际流年位置核对' : '',
                seat.lumingHorseCandidate === true ? lumingChang(seat) : '',
                '古籍原法安位和二限到会范围仍待核',
              ] : [])];
          }),
          ...splitPaths.flatMap(path => {
            const seat = limits.find(row => row.layer === path.horseLayer), peer = limits.find(row => row.layer === path.peerLayer);
            if (!seat || !peer || !chinese(p.horse) || !chinese(peer.branch) || !scopes[seat.layer] || !scopes[peer.layer]) return [];
            const product = productSplits.some(row => sameSplit(row, path));
            const luming = lumingSplits.some(row => sameSplit(row, path));
            return ['本命天马实守' + p.horse + '宫的' + scopes[seat.layer] + '，同限会禄存和流昌',
              ...list(seat.horseCompanions).filter(row => row.star === '本命禄存' || (row.star === '流昌' && product))
                .map(row => see(row.branch, row.relation, row.star === '流昌' ? '兼容引擎的流昌' : row.star)),
              luming ? lumingChang(seat) : '',
              scopes[peer.layer] + '在' + peer.branch + '宫，同时会天马、紫微和天府',
              ...list(peer.horseCompanions).filter(row => ['紫微', '天府'].includes(row.star)).map(row => see(row.branch, row.relation, row.star))];
          }),
          '以上仅列同段位置及候选发干，原文的会遇范围和合参作用待核',
        ]);
      }
      case 'quanshu_annual_sha': {
        if (p.profile !== 'quanshu-annual-sha-source-v1') return '';
        const jielanPojun = p.pojunJielanMinorFlowShaCandidate === true ? p.pojunJielanMinorFlowShaWitness : undefined;
        const position = (name, branch, relation, anchor) => chinese(branch)
          ? name + '在' + branch + '宫' + (['守', '冲', '三合', '邻宫'].includes(relation) ? '，与' + anchor + '为' + relation : '') : '';
        const jielanPojunText = chinese(jielanPojun?.minorBranch) && jielanPojun?.grade === '陷'
          ? '按《捷览》星表，破军陷于' + jielanPojun.minorBranch + '宫。复算小限实守该宫，也落在当年流煞组'
            + list(jielanPojun.branches).filter(chinese).join('、')
            + '。已分别查同段天梁与本命、流年禄存的会照' : '';
        const pojun = p.pojunCase, bellTiger = p.bellTigerCase, fixedBellTiger = p.quanshuFixedBellTigerCase;
        const wangHuaLu = p.pojunWangNativeHuaLuSupport === true ? p.pojunWangNativeHuaLuWitness : undefined;
        const wangLimits = list(wangHuaLu?.guardingLimits).filter(layer => ['decadal', 'minor'].includes(layer)).map(layer => scopes[layer]);
        const wangSha = list(wangHuaLu?.annualSha).filter(row => row.branch === wangHuaLu?.branch && chinese(row.star)).map(row => row.star);
        const pojunTiger = p.tigerAtPojunLimitCandidate === true && chinese(pojun?.annualTiger?.branch)
          && pojun.annualTiger.branch === pojun.branch
          && list(pojun.guardingLimits).filter(layer => ['decadal', 'minor'].includes(layer)).map(layer => scopes[layer]).join('、');
        return sentences([
          number(p.lunarYear) !== undefined ? '按农历' + p.lunarYear + '年核《全书》迁移与流年煞曜组合' : '',
          list(p.unverifiedMajorStars).filter(chinese).length
            ? '未能复核位置的主曜有' + list(p.unverifiedMajorStars).filter(chinese).join('、') : '',
          jielanPojunText,
          p.fixedBellTigerZiweiGuard === true && chinese(fixedBellTiger?.lifeBranch)
            ? '紫微和明刊铃星同守' + fixedBellTiger.lifeBranch + '宫，另见同卷所列制铃条件' : '',
          ...list(p.migrations).slice(0, 1).flatMap(row => (p.migrationSharedFireShaRepeat === true
            || p.migrationSharedMingEarthShaRepeat === true) && chinese(row.branch)
            ? list(row.annualSha).filter(star => star.repeatsNatal === true && star.branch === p.yearBranch && chinese(star.star))
              .map(star => '本命与流年迁移同在' + row.branch + '宫'
                + (p.migrationSharedMingEarthShaRepeat === true ? '，按明刊土乡取宫' : '')
                + '，另核本命和流年' + star.star + '均实守' + star.branch + '宫太岁')
            : []),
          ...list(p.migrations).flatMap(row => {
            if ((row.candidate !== true && row.repeatedShaCandidate !== true)
              || !['natal', 'yearly'].includes(row.layer) || !chinese(row.branch)) return [];
            const anchor = scopes[row.layer] + '迁移宫';
            return [anchor + '在' + row.branch + '宫，贪狼同守该宫',
              position('本命破军', row.pojun, row.pojunRelation, anchor), position('本命巨门', row.jumen, row.jumenRelation, anchor),
              position('本命七杀', row.qisha, row.qishaRelation, anchor),
              ...list(row.annualSha).filter(star => star.migrationRelation === '守' || star.pojunRelation === '守').map(star =>
                chinese(star.star) && chinese(star.branch) ? '流年' + star.star + '同守' + star.branch + '宫的'
                  + (star.migrationRelation === '守' ? anchor : '破军') : ''),
              ...list(row.repeatedSha).filter(star => row.repeatedShaCandidate === true && chinese(star.star) && chinese(star.branch))
                .map(star => '本命' + star.star + '与流年' + star.star + '同在' + star.branch
                  + '宫，与本命七杀同守，并三合' + anchor + '和破军宫'),
              '此组合依同卷所列巳午火位，岁煞指代与并照范围待核'];
          }),
          (pojun?.candidate === true || pojunTiger) && chinese(pojun.branch) ? sentences([
            position('本命破军', pojun.branch, pojun.annualRelation, '流年命宫'),
            chinese(pojun.grade) ? '同书星表列为' + pojun.grade : '',
            ...list(pojun.annualSha).filter(row => row.relation === '守' && chinese(row.star)).map(row => '流年' + row.star + '与破军同宫'),
            pojunTiger ? '年度四飞白虎与本命破军同守' + pojun.branch + '宫的' + pojunTiger : '',
            ...list(pojun.relief).map(row => ['natal', 'yearly'].includes(row.layer) && chinese(row.star)
              ? position(scopes[row.layer] + row.star, row.branch, row.relation, '破军') : ''),
            '天梁和两层禄存的星位供制化复核，明刊天禄所指和实际制化仍待核',
          ]) : '',
          wangLimits.length && wangSha.length && chinese(wangHuaLu?.branch) && wangHuaLu.birthStem === '癸'
            ? '按王亭之释法，生年癸使破军化禄。该星守' + wangHuaLu.branch + '宫的' + wangLimits.join('、')
              + '，也与流年' + wangSha.join('、') + '同宫，可另查接应条件' : '',
          p.pojunYearlyHuaLuContact === true && chinese(pojun?.branch)
            ? '另核流年癸发破军化禄，保留在' + pojun.branch + '宫的流年发干层' : '',
          bellTiger?.candidate === true && chinese(bellTiger.lifeBranch)
            ? '本命擎羊、归档铃星和流年白虎同在' + bellTiger.lifeBranch + '宫的本命命宫，原法安铃和白虎取法仍待核' : '',
          p.jielanBellTigerCandidate === true && bellTiger?.candidate !== true && chinese(bellTiger?.lifeBranch)
            ? '本命擎羊、《捷览》所推铃星和年度四飞白虎同在' + bellTiger.lifeBranch + '宫的本命命宫' : '',
          fixedBellTiger?.candidate === true && chinese(fixedBellTiger.lifeBranch)
            ? '明刊铃星、本命擎羊与年度四飞白虎实守' + fixedBellTiger.lifeBranch + '宫的本命命宫' : '',
          '上述星位只用于原文条件复核，实际有制或无制尚未判定',
        ]);
      }
      case 'quanshu_limit_combinations': {
        if (p.profile !== 'quanshu-limit-combinations-v1') return '';
        const reach = (seat, branch, relation) => {
          if (!chinese(branch)) return '';
          if (relation === '守') return '与' + seat + '同在' + branch + '宫';
          return ['冲', '三合'].includes(relation) ? '与在' + branch + '宫的' + seat + '为' + relation : '';
        };
        const pairs = list(p.starPairs).filter(row => row.candidate === true);
        const majors = list(p.majorContacts).filter(row => row.candidate === true);
        const limits = (decadalRelation, minorRelation) => [decadalRelation === '守' ? '大限' : '', minorRelation === '守' ? '小限' : ''].filter(Boolean).join('和');
        const xingQiu = p.mingXingQiuShaCandidate === true ? p.mingXingQiuShaWitness : undefined;
        const xingQiuLimits = list(xingQiu?.guardScopes).filter(scope => scope === 'decadal' || scope === 'minor').map(scope => scopes[scope]);
        const bladeDark = p.mingBladeDarkDoubleGuardCandidate === true ? p.mingBladeDarkDoubleGuardWitness : undefined;
        const tuoTanlang = p.mingTuoTanlangDoubleGuardCandidate === true ? p.mingTuoTanlangDoubleGuardWitness : undefined;
        const fallenJumen = p.fallenJumenDoubleGuardCandidate === true ? p.fallenJumenDoubleGuardWitness : undefined;
        const describeMajor = row => chinese(row.star) && chinese(row.branch)
          ? ['本命' + row.star + '在' + row.branch + '宫', reach('大限命宫', p.decadalBranch, row.decadalRelation),
            reach('小限命宫', p.minorBranch, row.minorRelation), reach('本命命宫', p.lifeBranch, row.lifeRelation),
            reach('本命身宫', p.bodyBranch, row.bodyRelation), chinese(row.grade) ? '同书星表列为' + row.grade : '同书星表未列此位置'].filter(Boolean).join('，') : '';
        return sentences([
          number(p.lunarYear) !== undefined ? '按农历' + p.lunarYear + '年核《全书》二限星曜组合' : '',
          chinese(xingQiu?.branch) && xingQiuLimits.length ? '按明刊刑囚合杀一支，本命擎羊、廉贞、七杀同守'
            + xingQiu.branch + '宫，实际' + xingQiuLimits.join('和') + '也守该宫' : '',
          chinese(bladeDark?.primaryBranch) ? '按明刊刑暗一支，复算大小限同守'
            + bladeDark.primaryBranch + '宫的本命擎羊和巨门' : '',
          chinese(tuoTanlang?.primaryBranch) ? '按明刊陀忌会贪一支，复算大小限同守'
            + tuoTanlang.primaryBranch + '宫的本命陀罗和贪狼' : '',
          chinese(fallenJumen?.branch) ? '复算大小限同守' + fallenJumen.branch + '宫的陷地巨门，本命身宫与命宫均会该宫' : '',
          ...list(p.fallenTanPoLianDoubleGuardWitnesses).flatMap(row => chinese(row?.star) && chinese(row.branch)
            ? [['复算大小限同守' + row.branch + '宫的陷地' + row.star,
              reach('本命命宫', p.lifeBranch, row.lifeRelation), reach('本命身宫', p.bodyBranch, row.bodyRelation)].filter(Boolean).join('，')] : []),
          ...pairs.map(row => {
            const seats = limits(row.decadalRelation, row.minorRelation);
            return chinese(row.primary) && chinese(row.companion) && chinese(row.primaryBranch) && seats
              ? '本命' + row.primary + '与' + (row.archiveFireBell === true ? '归档' : '') + row.companion
                + '同在' + row.primaryBranch + '宫，' + seats + '命宫也在此宫' : '';
          }),
          ...list(p.mingFixedBladeFireBellPairs).flatMap(row => {
            const seats = limits(row.decadalRelation, row.minorRelation);
            return p.quanshuFixedFireBellProfile === 'quanshu-nanyangtang-fixed-firebell-v1'
              && p.mingFixedBladeFireBellCandidate === true && row.sameSeat === true
              && chinese(row.primary) && chinese(row.companion) && chinese(row.primaryBranch) && seats
              ? ['明刊定宫' + row.companion + '与' + row.primary + '同守' + row.primaryBranch + '宫，' + seats + '也实守此宫'] : [];
          }),
          ...list(p.auxiliaryGroups).map(row => {
            const anchors = [p.tuoLife === '三合' ? '本命命宫' : '', p.tuoBody === '三合' ? '本命身宫' : ''].filter(Boolean).join('及');
            const stars = list(row.stars).filter(star => chinese(star.star) && chinese(star.branch) && ['守', '冲', '三合'].includes(star.relation));
            return chinese(p.tuoluoBranch) && anchors && stars.length === 2
              ? '陀罗守' + p.tuoluoBranch + '宫的实际限宫，并三合' + anchors + '，整对会到此宫的辅曜为'
                + stars.map(star => star.branch + '宫的' + star.star + '（' + star.relation + '）').join('、') : '';
          }),
          ...list(p.quanShaGroups).map(row => (row.layer === 'natal' || row.layer === 'yearly') && chinese(row.stem) && chinese(row.star) && chinese(row.branch)
            ? '本命擎羊、七杀和' + (row.layer === 'natal' ? '生年干' : '流年干') + row.stem + '所化权的' + row.star
              + '同守' + row.branch + '宫的实际限宫' : ''),
          ...list(p.tanHaoGroups).map(row => {
            const seats = limits(row.decadalRelation, row.minorRelation);
            return chinese(row.annualStar) && chinese(row.limitStar) && chinese(row.yearSeat) && chinese(row.limitSeat) && seats
              ? '以破军化耗核贪耗候选，太岁守' + row.yearSeat + '宫的' + row.annualStar + '，' + seats + '命宫守'
                + row.limitSeat + '宫的' + row.limitStar + '，二曜三合' : '';
          }),
          ...majors.map(describeMajor),
          ...list(p.splitMajorPairs).map(row => {
            const decadal = describeMajor(row.decadal ?? {}), minor = describeMajor(row.minor ?? {});
            return decadal && minor && ['冲', '三合'].includes(row.contact)
              ? (row.bothOppose === true ? '大小限对宫分别有具名星' : '两颗具名星分守大小限') + '，两星所在宫的关系为' + row.contact
                + '，两曜分别会及本命身命。' + decadal + '。' + minor : '';
          }),
          pairs.some(row => row.archiveFireBell === true) ? '火铃只列逐颗核验的归档位置，原法时支取法仍待核' : '',
          '以上为已核星曜和宫位组合，别名范围、大小限合参和主宾强弱待核',
        ]);
      }
      case 'quanshu_transform_limits': {
        if (p.profile !== 'quanshu-transform-limits-v1') return '';
        const emitters = { natal: '生年干', yearly: '流年干', decadal: '大限宫干', minor: '小限宫干' };
        const contact = row => chinese(row?.star) && chinese(row.branch) && ['守', '冲', '三合'].includes(row.relation)
          ? row.branch + '宫的' + row.star + '与限宫为' + row.relation : '';
        const tabooContact = row => contact(row) || (chinese(row?.star)
          ? chinese(row.branch) ? row.star + '在' + row.branch + '宫，未到守冲三合' : row.star + '位置待核'
          : '');
        const hao = p.decadalNatalQuanPojunHaoWitness;
        const tianShang = p.decadalNatalQuanTianShangHaoWitness;
        const quanAssembly = p.decadalNatalQuanNamedAssemblyWitness ?? p.decadalNatalQuanShangShiAssemblyWitness;
        return sentences([
          number(p.lunarYear) !== undefined && chinese(p.annualBranch) ? '按农历' + p.lunarYear + '年核《全书》化曜与二限，太岁在' + p.annualBranch + '宫' : '',
          p.tripleNatalJiVerifiedGuard === true ? '大小限都经复算，生年化忌与太岁、大限、小限同在一宫' : '',
          hao && [hao.stem, hao.quanStar, hao.branch, hao.decadalBranch, hao.relation].every(chinese)
            ? '《全书》明刊另以破军化耗。生年' + hao.stem + '干所化权的' + hao.quanStar + '与破军同在' + hao.branch
              + '宫，与实际' + hao.decadalBranch + '宫大限为' + hao.relation : '',
          tianShang && [tianShang.stem, tianShang.quanStar, tianShang.branch, tianShang.decadalBranch, tianShang.relation].every(chinese)
            ? '按《全书》天伤篇的大耗取法，生年' + tianShang.stem + '干所化权的' + tianShang.quanStar
              + '与天伤同在' + tianShang.branch + '宫，与实际' + tianShang.decadalBranch + '宫大限为' + tianShang.relation : '',
          quanAssembly && [quanAssembly.stem, quanAssembly.quanStar, quanAssembly.decadalBranch].every(chinese)
            ? '生年' + quanAssembly.stem + '干使' + quanAssembly.quanStar + '化权，实守' + quanAssembly.decadalBranch
              + '宫大限。' + list(quanAssembly.companions).map(contact).filter(Boolean).join('、') : '',
          p.tripleTabooCandidate === true && p.tripleNatalJiVerifiedGuard !== true
            ? '同一时段大限、小限、太岁同居一宫，以下发干组的化忌留作盘层对照' : '',
          p.lianzhenHaiWaterYearAtLimitCandidate === true && chinese(p.birthYearPillar) && chinese(p.birthYearNaYin)
            ? '本盘农历生年柱为' + p.birthYearPillar + '，纳音为' + p.birthYearNaYin + '。《紫微斗数精成》按生年纳音解释这一条的水命' : '',
          p.lianzhenHaiWaterYearAtLimitCandidate === true && chinese(p.verifiedLifeBureau) && chinese(p.lifePalacePillar) && chinese(p.lifePalaceNaYin)
            ? '命宫另按' + p.lifePalacePillar + '的纳音' + p.lifePalaceNaYin + '复核为' + p.verifiedLifeBureau : '',
          [p.femaleLuSupportCandidate, p.femaleLuShaCandidate, p.femaleLuJielanFireTabooCandidate,
            p.femaleLuQuanshuFixedFireTabooCandidate].includes(true)
            ? '归档用女盘配置，化禄限宫的辅曜和煞曜分别核对' : '',
          ...list(p.femaleNatalLuCunCoGuards).flatMap(witness => ['decadal', 'minor'].includes(witness?.scope)
            && [witness.branch, witness.stem, witness.star].every(chinese)
            ? ['同一' + scopes[witness.scope] + witness.branch + '宫，本生年干' + witness.stem + '所化禄的' + witness.star
              + '与本命禄存均实守'] : []),
          p.sourceMinor?.verified === true && chinese(p.sourceMinor.branch)
            ? '按《全书》安小限诀核到' + p.sourceMinor.branch + '宫，与归档一致'
            : p.sourceMinor?.verified === false ? '按《全书》复算的小限宫与归档不一致' : '',
          p.sourceDecadal?.verified === true && chinese(p.sourceDecadal.branch)
            ? '按五局、顺逆与起岁核到' + p.sourceDecadal.branch + '宫大限，与归档一致'
            : p.sourceDecadal?.verified === false ? '按五局、顺逆与起岁复算的大限与归档不一致' : '',
          ...list(p.seats).flatMap(seat => {
            if (!scopes[seat.layer] || !chinese(seat.branch)) return [];
            if (seat.layer === 'minor' && p.sourceMinor?.verified !== true) return [];
            if (seat.layer === 'decadal' && p.sourceDecadal?.verified !== true) return [];
            const reports = list(seat.groups).flatMap(group => {
              if (!emitters[group.layer] || !chinese(group.stem)) return [];
              const minorLu = seat.layer === 'minor' ? list(group.stars).find(row => row.kind === '禄') : undefined;
              const taboo = list(group.stars).find(row => row.kind === '忌' && row.relation === '守');
              const tabooName = chinese(taboo?.star) ? taboo.star + '在' + seat.branch + '宫化忌并守此限' : '';
              const natalLuminaryRelief = group.layer === 'natal' && group.jiVolumeTwoRelief === true
                && (seat.layer === 'decadal' || seat.layer === 'minor' && p.sourceMinor?.verified === true)
                && (group.stem === '甲' && taboo?.star === '太阳' && p.sunNatalJiReliefGuard === true
                  || group.stem === '乙' && taboo?.star === '太阴' && p.moonNatalJiReliefGuard === true);
              const tianjiLucun = group.tianjiLucunKeQuan === true ? contact(group.tianjiLucun) : '';
              const reasons = [
                minorLu?.relation === '守' ? group.layer === 'natal' && p.minorNatalLuGuard === true
                  ? '生年化禄实守小限本宫' : '这一发干组的化禄与小限同宫，保留发干盘层对照' : '',
                group.layer === 'natal' && ['冲', '三合'].includes(minorLu?.relation)
                  ? '生年化禄与小限有' + minorLu.relation + '，保留实际会照位置' : '',
                seat.layer === 'decadal' && group.quanSha === true ? group.layer === 'natal'
                  ? '生年化权实守大限，并有具名煞曜接触' : '这一发干组的化权守大限并见具名曜，保留盘层对照' : '',
                seat.layer === 'decadal' && group.quanAspectSha === true ? (group.layer === 'natal' ? '生年' : '')
                  + '化权和以下具名曜同居大限的一个照临宫：' + list(group.quanAspectHazards).map(contact).filter(Boolean).join('、')
                  + (group.layer === 'natal' ? '' : '，保留发干盘层对照') : '',
                p.tripleTabooCandidate === true && group.ji === true ? group.layer === 'natal'
                  ? '交临宫见生年化忌实守' : '交临宫另列这一发干组的化忌位置' : '',
                ...list(group.tabooBenefics).map(row => {
                  const witness = tabooContact(row);
                  return witness && chinese(row.kind) ? '与化忌同组的化' + row.kind + '：' + witness : '';
                }),
                p.femaleLuSupportCandidate === true && group.luKeQuan === true ? '本宫化禄，同一发干的科权均会到此宫' : '',
                p.femaleLuSupportCandidate === true && group.luSupportPair === true ? '本宫化禄，具名辅曜成对会照且有一曜实守，为'
                  + list(seat.supportPairs).filter(pair => pair.present === true).map(pair => chinese(pair.label)).filter(Boolean).join('、') : '',
                p.femaleLuShaCandidate === true && group.luNatalYangTuo === true ? '本宫化禄，本命擎羊和陀罗均到守冲三合' : '',
                p.femaleLuShaCandidate === true && group.luFireTaboo === true ? '本宫化禄，归档火星和同一发干的化忌也会到此宫' : '',
                p.femaleLuJielanFireTabooCandidate === true && group.luJielanFireTaboo === true && group.luFireTaboo !== true
                  ? '本宫化禄，《捷览》所推火星和同一发干的化忌也会到此宫，'
                    + contact({ ...seat.jielanFire, star: '《捷览》火星' }) : '',
                p.femaleLuQuanshuFixedFireTabooCandidate === true && group.layer === 'natal' && group.luQuanshuFixedFireTaboo === true
                  ? '生年化禄实守，明刊火星与同一生年干的化忌另见此限，'
                    + contact({ ...seat.quanshuFixedFire, star: '明刊火星' }) : '',
                group.tianjiSanHua === true ? group.layer === 'natal' ? '天机守限，生年化科、化权、化禄均会此宫'
                  : '天机守限，此发干组的科权禄均有见位，保留盘层对照' : '',
                tianjiLucun ? (group.layer === 'natal' ? '天机守限，本命禄存与生年化科、化权均到此宫，'
                  : '天机守限，流年禄存与同一流年干的化科、化权另列为盘层对照，') + tianjiLucun : '',
                group.jiSha === true ? group.layer === 'natal' ? '生年同组权禄忌同守，并见篇内煞曜候选'
                  : '同组权禄忌同守，并见篇内煞曜候选，留作其他发干盘层对照' : '',
                group.layer === 'natal' && group.jiMingYangBellAspect === true
                  && p.quanshuFixedFireBellProfile === 'quanshu-nanyangtang-fixed-firebell-v1'
                  ? '生年权禄忌实守同一限宫，擎羊与明刊定宫铃星在同一个照临宫，'
                    + list(group.jiMingYangBellAspectWitnesses).map(contact).filter(Boolean).join('、') : '',
                group.jiNatalShaGuard === true ? '具名本命煞曜实守' : '',
                group.jiYearYangGuard === true ? '流年擎羊实守' : '',
                group.jiNatalShaPair === true ? '两颗以上具名本命煞曜会此限，为'
                  + list(seat.namedMixedContacts).map(row => chinese(row.star)).filter(Boolean).join('、') : '',
                group.jiYearYangMixedAspect === true ? '流年擎羊与下列同宫参与曜共在同一个照临宫：'
                  + list(group.jiYearYangMixedWitnesses).map(contact).filter(Boolean).join('、') : '',
                group.jiSha === true && chinese(group.mixedTabooSummaryGrade) ? '化忌受曜的卷三原表等级为' + group.mixedTabooSummaryGrade : '',
                group.jiSha === true && group.mixedTabooSummaryGrade === '庙' ? '卷二另有化忌入庙的分支，两段的合读口径待核' : '',
                natalLuminaryRelief && tabooName ? '按南阳堂明刊，生年' + group.stem + '干使' + tabooName
                  + '，符合明列的缓和宫位' : '',
                !natalLuminaryRelief && group.jiVolumeTwoRelief === true && tabooName ? tabooName
                  + (group.jiVolumeTwoBirthStemRelief === true ? '，卷二另列此处的缓和条件'
                    + (chinese(group.reliefBirthStem) ? '，此例所核生年干为' + group.reliefBirthStem : '')
                    : '，此宫位另作《全书》明列见位的对照') : '',
                group.jiVolumeTwoFallen === true && tabooName ? tabooName + '，其宫位在卷二明列的陷地，为另一分支' : '',
                group.jiVolumeTwoTemple === true && tabooName ? tabooName + '，卷三星表明确列为庙，对应卷二化忌入庙的独立分支' : '',
                group.jiLianzhenHaiWaterYear === true && tabooName && p.lianzhenHaiWaterYearAtLimitCandidate === true
                  ? p.natalLianzhenHaiBothWaterGuard === true && group.layer === 'natal' && ['decadal', 'minor'].includes(seat.layer)
                    ? '生年纳音属水、命宫为水二局，生年丙干的' + tabooName
                    : tabooName + '，该组发干、守限位置与生年水纳音均符合这项缓和候选' : '',
              ].filter(Boolean);
              if (!reasons.length) return [];
              const stars = list(group.stars).map(row => contact(row) && chinese(row.kind) ? '化' + row.kind + '在' + contact(row) : '').filter(Boolean);
              return [emitters[group.layer] + group.stem + '这一组，' + [...reasons, ...stars].join('，')];
            });
            const tianjiAspect = seat.tianjiNatalYangTuo === true || seat.tianjiYearYangTuo === true;
            const taboo = seat.tabooFollowup;
            const mixed = seat.mixedTabooContext;
            if (!reports.length && !tianjiAspect && mixed?.bothSourceHourVoidsOutside !== true) return [];
            return [sentences([scopes[seat.layer] + '命宫在' + seat.branch + '宫', ...reports,
              tianjiAspect ? '天机会照本限，巨门也到此宫的守冲三合范围' : '',
              tianjiAspect ? contact(seat.tianji) : '', tianjiAspect ? contact(seat.jumen) : '',
              seat.tianjiNatalYangTuo === true ? '本命擎羊、陀罗均会此限' : '',
              seat.tianjiYearYangTuo === true ? '流年擎羊、陀罗均会此限' : '',
              ...list(taboo?.helperPairs).map(pair => chinese(pair.label)
                ? pair.label + '分查：' + list(pair.stars).map(tabooContact).filter(Boolean).join('、')
                  + (pair.guards === true ? '，两曜均守' : pair.visible === true ? '，两曜均到守冲三合' : '') : ''),
              taboo?.natalAssembly?.beneficsGuard === true ? '生年同组科权禄均守化忌交临宫'
                : taboo?.natalAssembly?.beneficsVisible === true ? '生年同组科权禄均到化忌交临宫的守冲三合范围' : '',
              taboo?.natalAssembly?.helpersVisible === true ? '紫府、昌曲、左右六曜均到生年化忌交临宫的守冲三合范围' : '',
              taboo ? '四煞逐曜为' + list(taboo.fourSha).map(tabooContact).filter(Boolean).join('、') : '',
              taboo?.fourShaGuard === true ? '所核四煞均守交临宫' : taboo?.fourShaVisible === true ? '所核四煞均到交临宫的守冲三合范围'
                : taboo?.fourShaVisible === undefined && taboo ? '四煞守冲三合尚有位置待核' : '',
              list(taboo?.yangFireBellSky).length ? '明刻本所列羊火铃空逐曜为' + taboo.yangFireBellSky.map(tabooContact).filter(Boolean).join('、') : '',
              taboo?.yangFireBellSkyGuard === true ? '所核羊火铃空均守交临宫'
                : taboo?.yangFireBellSkyVisible === true ? '所核羊火铃空均到交临宫的守冲三合范围' : '',
              mixed ? '本命羊火铃空逐位核为' + list(mixed.namedPositions).map(tabooContact).filter(Boolean).join('、') : '',
              mixed?.allNamedGuard === true ? '所核羊火铃空均在本限宫' : mixed?.allNamedVisible === true ? '所核羊火铃空均到本限守冲三合' : '',
              mixed?.bothSourceHourVoidsOutside === true
                ? '古天空和地劫均在该限宫的守、冲、三合之外' : '',
              ...list(mixed?.helperPairs).map(pair => chinese(pair.label)
                ? '紫府昌曲的' + pair.label + '位置：' + list(pair.stars).map(tabooContact).filter(Boolean).join('、') : ''),
              list(mixed?.modernSkyPositions).length ? '今法天空另供对照：' + mixed.modernSkyPositions.map(tabooContact).filter(Boolean).join('、') : '',
              ...list(seat.hazards).map(contact), ...list(seat.helpers).map(contact)])];
          }),
          '各发干候选分开核对。归档火铃只代表已核的归档位置，原文的发化层、完整凑合范围与实际作用仍须核实',
        ]);
      }
      case 'quanshu_limit_chapter': {
        if (p.profile !== 'quanshu-limit-chapter-atomic-v1') return '';
        const jielanDay = p.jielanDailyShaCandidate === true ? p.jielanDailyShaWitness : undefined;
        const jielanFireBell = p.jielanDailyFireBellCandidate === true ? p.jielanDailyFireBellWitness : undefined;
        const jielanHour = p.jielanHourWitness;
        const mingHelpers = p.cleanSeatMingFourHelpersCandidate === true ? p.cleanSeatMingFourHelpersWitness : undefined;
        const mingLucunHuaLu = p.cleanSeatMingLucunHuaLuWitness;
        const mingFlyingSha = p.overlappingMingFlyingShaWitness;
        const mingAnnualNatalSha = p.overlappingMingAnnualNatalShaGuardWitness;
        const mingMinorOpeningSha = p.mingOpeningMinorNatalShaWitness;
        const jielanGuard = (stars, fireBell) => [...list(stars), ...list(fireBell).map(row => ({ ...row, relation: '守' }))];
        const lateZiDay = jielanFireBell?.lateZiAlternative ?? jielanDay?.lateZiAlternative;
        const exitFallen = p.exitFallenWithoutNamedGuardCandidate === true ? p.exitFallenWithoutNamedGuardWitness : undefined;
        const contact = row => chinese(row?.star) && chinese(row?.branch) && ['守', '冲', '三合'].includes(row.relation)
          ? row.star + '在' + row.branch + '宫' + row.relation : '';
        const listContacts = (rows, name) => {
          if (!Array.isArray(rows)) return name + '位置未核齐';
          const positions = rows.map(contact).filter(Boolean);
          return positions.length ? name + '为' + positions.join('、') : '';
        };
        const hourSeat = (row, basis) => chinese(row?.dayBranch) && chinese(row?.branch) && list(row.guards).length
          ? basis + '以' + row.dayBranch + '宫的流日宫起子时，流时到' + row.branch + '宫，实守'
            + list(row.guards).map(guard => chinese(guard.star)).filter(Boolean).join('、') : '';
        return sentences([
          number(p.lunarYear) !== undefined ? '按农历' + p.lunarYear + '年的《全书》岁限篇核同段星位' : '',
          p.sourceDecadal?.verified === false ? '归档大限未能通过五局起岁与顺逆复核' : '',
          list(p.unverifiedMajorStars).filter(chinese).length
            ? '未能复核位置的主曜有' + list(p.unverifiedMajorStars).filter(chinese).join('、') : '',
          list(p.unverifiedAuxiliaryStars).filter(chinese).length
            ? '未能复核位置或星层的辅曜有' + list(p.unverifiedAuxiliaryStars).filter(chinese).join('、') : '',
          p.sourceSkyReady === true && p.sourceRobberyReady === false ? '地劫待核，古天空独立核位' : '',
          p.sourceSkyReady === false && p.sourceRobberyReady === true ? '古天空待核，地劫独立核位' : '',
          chinese(jielanDay?.monthBranch) && chinese(jielanDay?.dayBranch) && number(jielanDay?.lunarDay) !== undefined
            ? '按《捷览》，从' + jielanDay.monthBranch + '宫的当月斗君起初一，至农历第' + jielanDay.lunarDay
              + '日落在' + jielanDay.dayBranch + '宫。' + listContacts(jielanDay.monthSha, '月宫实守煞曜')
              + '。' + listContacts(jielanDay.daySha, '日宫实守煞曜') : '',
          chinese(jielanFireBell?.monthBranch) && chinese(jielanFireBell?.dayBranch) && number(jielanFireBell?.lunarDay) !== undefined
            ? '《捷览》按生年与生时安火铃。农历第' + jielanFireBell.lunarDay + '日核到斗君月宫在' + jielanFireBell.monthBranch
              + '、流日宫在' + jielanFireBell.dayBranch + '。'
              + listContacts(jielanGuard(jielanFireBell.monthSha, jielanFireBell.monthFireBell), '月宫实守煞曜')
              + '。' + listContacts(jielanGuard(jielanFireBell.daySha, jielanFireBell.dayFireBell), '日宫实守煞曜') : '',
          chinese(lateZiDay?.monthBranch) && number(lateZiDay?.lunarMonth) !== undefined
            ? '子初换日也进入农历第' + lateZiDay.lunarMonth + '月，斗君月宫在' + lateZiDay.monthBranch + '宫。'
              + listContacts(jielanGuard(lateZiDay.monthSha, lateZiDay.monthFireBell), '月宫实守煞曜') : '',
          chinese(lateZiDay?.dayBranch) && number(lateZiDay?.lunarDay) !== undefined
            ? '子初换日另取农历第' + lateZiDay.lunarDay + '日，流日宫在' + lateZiDay.dayBranch + '宫。'
              + listContacts(jielanGuard(lateZiDay.daySha, lateZiDay.dayFireBell), '日宫实守煞曜') : '',
          chinese(jielanHour?.hourBranch) ? '按《捷览》核' + jielanHour.hourBranch + '时' : '',
          hourSeat(jielanHour?.civil, '午夜换日口径'), hourSeat(jielanHour?.ziStart, '子初换日口径'),
          ...[['decadal', '大限'], ['minor', '小限'], ['yearly', '太岁'], ['monthly', '斗君月'], ['daily', '产品流日']].flatMap(([key, name]) => {
            const row = p[key];
            if (!row || !chinese(row.branch)) return [];
            const grades = list(row.grades).flatMap(item => chinese(item?.star)
              ? [item.star + (chinese(item.grade) ? '为' + item.grade : '未列等级')] : []);
            return [sentences([
              name + '在' + row.branch + '宫',
              grades.length ? '本宫主曜原书等级为' + grades.join('、') : '',
              listContacts(row.namedNativeSha, '已核本命煞曜'), listContacts(row.annualSha, '流年羊陀'),
              listContacts(row.archiveFireBell, '归档火铃'), listContacts(row.mingFixedFireBell, '明刊静位火铃'),
              listContacts(row.namedSupport, '已核的具名支持星曜'),
              contact(row.natalJi) ? '生年干化忌见' + contact(row.natalJi) : '',
              contact(row.annualJiCandidate) ? '流年干推得的化忌候选见' + contact(row.annualJiCandidate) : '',
            ])];
          }),
          Array.isArray(p.lifeReliefStars) && p.lifeReliefStars.filter(chinese).length
            ? '本命命宫可见原篇提到的' + p.lifeReliefStars.filter(chinese).join('、') + '，实际解救仍待核' : '',
          p.cleanSeatCandidate === true ? '大限本宫具篇内具名的庙旺得地主曜，所核本宫煞忌项与归档火铃均未见' : '',
          p.cleanSeatMingFixedCandidate === true ? '大限本宫按明刊核具名庙旺得地的主曜，已列本宫煞忌和静位火铃均未见' : '',
          chinese(mingHelpers?.branch) ? '四辅同守大限' + mingHelpers.branch + '宫，实见'
            + list(mingHelpers.helpers).map(row => chinese(row.star)).filter(Boolean).join('、') + '，本宫已核煞忌均未见' : '',
          chinese(mingLucunHuaLu?.branch) && chinese(mingLucunHuaLu?.stem) && chinese(mingLucunHuaLu?.recipient?.star)
            ? '大限' + mingLucunHuaLu.branch + '宫实守本命禄存与' + mingLucunHuaLu.stem + '年化禄的'
              + mingLucunHuaLu.recipient.star + '，同版具名煞忌未实守此宫' : '',
          p.overlappingMingAnnualBellCandidate === true ? '该年太岁实临明刊定宫铃，大限陷曜与小限的本命煞在同一实际年段分别核实' : '',
          p.overlappingMingFixedShaCandidate === true ? '大限陷曜、小限与太岁煞曜同段，至少一层实守明刊静位火铃' : '',
          p.overlappingMingNatalTabooAndMinorBellCandidate === true && contact(p.decadal?.mingNatalJi)
            ? '大限同宫的明刊生年化忌见' + contact(p.decadal.mingNatalJi) + '，同段已核太岁守煞和小限守铃' : '',
          p.overlappingMingNatalTabooWithAnnualShangShiCandidate === true && contact(p.decadal?.mingNatalJi) && chinese(p.yearly?.branch)
            ? '明刊生年化忌实守大限，见' + contact(p.decadal.mingNatalJi) + '。太岁实临' + p.yearly.branch + '宫本命'
              + list(p.annualShangShiGuards).map(row => chinese(row?.star)).filter(Boolean).join('、')
              + '，复算小限另核同宫本命煞曜' : '',
          p.overlappingShaCandidate === true ? '大限陷曜与煞忌、流年羊陀照大限及小限煞曜在同一实际片段成立' : '',
          p.overlappingAnnualSeatShaCandidate === true ? '大限陷曜与煞忌、太岁宫实见本命具名煞曜及小限实见本命具名煞曜在同一片段成立' : '',
          p.overlappingAnnualShangShiCandidate === true && chinese(p.yearly?.branch)
            ? '太岁在' + p.yearly.branch + '宫，实守本命' + list(p.annualShangShiGuards).map(row => chinese(row?.star)).filter(Boolean).join('、')
              + '，同段另核大限陷曜与煞忌及小限实守本命煞曜' : '',
          p.overlappingAnnualFlyingShaCandidate === true && chinese(p.decadal?.branch)
            ? '同年飞天三杀的无序支位组为' + list(p.annualFlyingShaBranches).filter(chinese).join('、')
              + '，大限实到其中的' + p.decadal.branch + '宫，同段另核大限陷曜与煞忌及小限实守本命煞曜' : '',
          chinese(mingFlyingSha?.decadalBranch) && chinese(mingFlyingSha?.minorBranch)
            ? '明刊所列陷曜和具名本命煞同守' + mingFlyingSha.decadalBranch + '宫大限，'
              + listContacts(mingFlyingSha.decadalSha, '大限实守煞曜') + '。同段小限在' + mingFlyingSha.minorBranch
              + '宫，' + listContacts(mingFlyingSha.minorSha, '小限实守煞曜') : '',
          p.overlappingAnnualBoshiCandidate === true && chinese(p.yearly?.branch)
            ? '太岁实临' + p.yearly.branch + '宫的本命博士系'
              + list(p.annualBoshiGuards).map(row => chinese(row.star)).filter(Boolean).join('、')
              + '，同段另核大限陷曜及复算小限所守煞曜' : '',
          mingAnnualNatalSha && [mingAnnualNatalSha.annualBranch, mingAnnualNatalSha.decadalBranch, mingAnnualNatalSha.minorBranch].every(chinese)
            ? '太岁实到' + mingAnnualNatalSha.annualBranch + '宫的本命煞忌，'
              + listContacts([...list(mingAnnualNatalSha.annualSha), mingAnnualNatalSha.natalTaboo].filter(Boolean), '实际到会')
              + '。同段复算大限' + mingAnnualNatalSha.decadalBranch + '宫的陷曜与煞，小限' + mingAnnualNatalSha.minorBranch + '宫另有本命煞实守' : '',
          p.exitInWindow === true && p.stageEnd ? '此旧大限的实际出限时刻为' + at(p.stageEnd)
            + '，取截止前片段。原文将出的提前量待核' : '',
          p.exitVerifiedNamedSupportAtBoundary === true && chinese(p.decadal?.branch)
            ? '旧大限' + p.decadal.branch + '宫在交限前最后一秒有紫微、天府、文昌、禄存同守' : '',
          p.exitVerifiedMingFourHelpersAtBoundary === true && chinese(p.decadal?.branch)
            ? '旧大限' + p.decadal.branch + '宫在交限前最后一秒有本命左辅、右弼、文昌、文曲全部实守' : '',
          p.exitVerifiedFewNamedSupportsAtBoundary === true && chinese(p.decadal?.branch)
            ? '旧大限' + p.decadal.branch + '宫在交限前最后一秒具名助曜少，已核生年化禄也在该宫守冲三合范围外' : '',
          p.overlappingMingAnnualBladeAtDecadalCandidate === true && chinese(p.decadal?.branch) && chinese(p.minor?.branch)
            ? '本年流羊或流陀实守' + p.decadal.branch + '宫，和本命陷曜、具名煞忌同在实际大限。小限另在' + p.minor.branch + '宫核到实守煞曜' : '',
          exitFallen && chinese(exitFallen.branch) ? '旧大限从' + exitFallen.branch + '宫实际退出，已核陷曜'
            + list(exitFallen.fallen).map(row => chinese(row.star)).filter(Boolean).join('、') + '与'
            + list(exitFallen.sha).map(row => chinese(row.star)).filter(Boolean).join('、') + '实守；已核具名助曜未同守'
            + (list(exitFallen.supportAspects).length ? '，会照另见' + exitFallen.supportAspects.map(row => chinese(row.star)
              + chinese(row.branch) + '宫' + chinese(row.relation)).join('、') : '') : '',
          p.exitInWindow === true && p.decadalMultipleSupportAtSeat === true && chinese(p.decadal?.branch)
            ? '出限前，旧大限' + p.decadal.branch + '宫实守的已核助曜有'
              + list(p.decadal.namedSupport).filter(row => row?.relation === '守').map(row => chinese(row.star)).filter(Boolean).join('、')
              + '，吉众的完整口径待核' : '',
          p.dailyShaCandidate === true ? '同一片段见上层煞曜，斗君月与产品流日亦各有已核本命煞曜守宫。原书流日和时层取法仍待核' : '',
          ...list(p.flankWitnesses).flatMap(row => {
            const label = { decadal: '大限', minor: '小限', yearly: '太岁' }[row?.scope];
            const stars = list(row?.stars).filter(star => chinese(star?.star) && chinese(star.branch));
            return label && chinese(row.branch) && stars.length === 2
              ? [stars.map(star => star.star + '在' + star.branch + '宫').join('、') + '，夹' + label + '所在的' + row.branch + '宫'] : [];
          }),
          p.dailyFlankedShaCandidate === true ? '上层夹限与斗君月、产品流日各有具名本命煞曜实守在同一有效日。原书流日和时层取法仍待核' : '',
          ...list(p.guardedTabooWitnesses).flatMap(row => {
            const label = row?.scope === 'monthly' ? '斗君月' : row?.scope === 'daily' ? '产品流日' : '';
            const sha = list(row?.sha).map(item => chinese(item?.star)).filter(Boolean);
            const taboos = list(row?.taboos).filter(item => ['生年', '流年'].includes(item?.layer) && chinese(item.stem) && chinese(item.star))
              .map(item => item.layer + item.stem + '干化忌受曜' + item.star);
            return label && chinese(row.branch) && sha.length && taboos.length
              ? [label + '在' + row.branch + '宫，' + [...sha, ...taboos].join('、') + '同守该宫'] : [];
          }),
          p.dailyGuardedTabooCandidate === true ? '该日上层另有已核煞曜实守或夹限。原书忌合的盘层、会照范围和作用仍待核' : '',
          p.mingOpeningShaCandidate === true && p.quanshuFixedFireBellProfile === 'quanshu-nanyangtang-fixed-firebell-v1'
            && chinese(p.mingOpeningSha?.branch)
            ? '明刊正月初一斗君和产品流日同在' + p.mingOpeningSha.branch + '宫，'
              + listContacts(p.mingOpeningSha.guards, '按明刊定宫核到的实守火铃')
              + '。按两种分日口径重合的北京时间午夜至23点取证' : '',
          chinese(mingMinorOpeningSha?.branch) ? '明刊正月初一的斗君月宫、流日宫及复算小限同守' + mingMinorOpeningSha.branch
            + '宫。' + listContacts(mingMinorOpeningSha.guards, '实守本命煞曜') : '',
          '归档火铃与明刊静位各留实际见位。凑合、忌合和实际解救仍待核',
        ]);
      }
      case 'quanshu_killer_echo': {
        if (p.profile !== 'quanshu-killer-echo-life-year-v1') return '';
        const positioned = (row, name = row?.star) => {
          if (!chinese(name)) return '';
          if (!chinese(row.branch)) return name + '的唯一位置未核';
          const links = [['lifeRelation', '命宫'], ['killerRelation', '七杀所在宫']].map(([key, label]) =>
            ['守', '冲', '三合'].includes(row[key]) ? '与' + label + '为' + row[key] : '未与' + label + '形成守冲三合');
          if (['守', '冲', '三合'].includes(row.annualRelation)) links.push('与流年太岁宫为' + row.annualRelation);
          return name + '在' + row.branch + '宫，' + links.join('，')
            + (['庙', '旺', '平', '陷'].includes(row.grade) ? '，源表列为' + row.grade : '');
        };
        const verseSeats = p.actualLimitEchoCandidate === true ? list(p.verseSeats) : [];
        const jielan = p.jielanJiaGuiKillerEchoCandidate === true ? p.jielanJiaGuiKillerEchoWitness : undefined;
        return sentences([
          '《全书》这一分支按同一盘的本命命宫和同一农历年核照会',
          jielan && [jielan.sharedShaBranch, jielan.lifeBranch, jielan.killerBranch].every(chinese)
            && ['守', '冲', '三合'].includes(jielan.shaLifeRelation)
            ? '按《捷览》甲生癸岁例，流年擎羊与本命陀罗同在' + jielan.sharedShaBranch + '宫并' + jielan.shaLifeRelation + '命宫'
              + jielan.lifeBranch + '。复核' + list(jielan.guards).map(row => scopes[row.scope]).filter(Boolean).join('、')
              + '守' + jielan.killerBranch + '宫的七杀，同宫也在当年流七杀方组'
              + list(jielan.flowQishaBranches).filter(chinese).join('、') : '',
          chinese(p.annualStem) && chinese(p.annualBranch) ? '本段流年为' + p.annualStem + p.annualBranch + '，本命命宫在' + p.lifeBranch + '宫' : '',
          chinese(p.killerBranch) ? '本命七杀在' + p.killerBranch + '宫，与命宫的关系为' + p.killerLifeRelation
            + '，同书星表列为' + p.killerGrade : '',
          ...list(p.annualYangTuo).map(row => positioned(row, '流年' + row.star)),
          p.jointAnnualContact === true ? '两颗流曜同时照命，一颗对冲、一颗三合' : '',
          p.sourceMinor?.verified === true && chinese(p.sourceMinor.branch) ? '小限依同版原诀复算到' + p.sourceMinor.branch + '宫' : '',
          ...verseSeats.filter(row => scopes[row.scope] && chinese(row.branch) && chinese(row.killerRelation)).map(row =>
            (row.scope === 'yearly' ? '太岁' : scopes[row.scope]) + '在' + row.branch + '宫，与七杀所在宫为' + row.killerRelation),
          verseSeats.length ? '同一有效时段有一限实守七杀，流羊和流陀分别对冲或三合七杀所在宫。诗句所指此地的确切范围仍待核' : '',
          chinese(p.birthYearBranch) && chinese(p.birthHour) ? '出生年支为' + p.birthYearBranch + '，生时支为' + p.birthHour
            + '，原文午生的具体用法待核' : '',
          p.lifeInMaoYou === true ? '本命命宫在卯酉之一' : '',
          p.natalQingyangInMaoYou === true && chinese(p.natalQingyangBranch) ? '本命擎羊在' + p.natalQingyangBranch + '宫' : '',
          p.annualQingyangInMaoYou === true ? '流年擎羊在卯酉之一，闲宫的取义待核' : '',
          ...list(p.tabooPositions).map(row => positioned(row,
            (row.layer === 'natal' ? '生年干化忌的' : '按流年干推算的化忌候选') + row.star)
            + (row.atAnnualQingyang === true ? '，同宫见流年擎羊' : '') + (row.atAnnualTuoluo === true ? '，同宫见流年陀罗' : '')),
          ...list(p.rescuePositions).map(row => positioned(row,
            (row.layer === 'annual' ? '流年' : '本命') + row.star)),
          ...list(p.auxiliaryPositions).filter(row => row.lifeRelation !== '其他' || row.killerRelation !== '其他')
            .map(row => positioned(row)),
          '同书星表未列七杀的陷位，正文陷地逢忌的指代仍待核。上述吉曜只列照会位置，三合拱照的对象、组合和解救效果尚未判定',
        ]);
      }
      case 'quanshu_support_condition': {
        if (p.profile !== 'quanshu-auxiliary-limits-atomic-v1') return '';
        const support = p.namedSupport;
        const sun = support?.propertySun, ziwei = support?.ziwei, liang = support?.tianliang, qu = support?.wenqu;
        const positions = (rows, anchor) => list(rows).filter(row => chinese(row?.star) && chinese(row.branch)
          && ['守', '冲', '三合'].includes(row.relation)).map(row => row.star + '在' + row.branch + '宫，与' + anchor + '为' + row.relation).join('，');
        return sentences([
          '本条把《全书》独立辅助星位、当前限宫与同一年段直接绑定，不把不同宫或不同时段的星拼成扶救',
          chinese(p.birthStem) ? '出生年干为' + p.birthStem : '',
          number(p.birthMonth) !== undefined && chinese(p.birthHour) ? '按农历生月' + p.birthMonth + '月、生时支' + p.birthHour + '独立核辅弼昌曲' : '',
          chinese(p.branch) && chinese(p.natalName) ? '当前限命宫在' + p.branch + '宫，对应本命' + p.natalName : '',
          number(p.lunarYear) !== undefined && chinese(p.annualStem) && chinese(p.annualBranch)
            ? '共同有效片段属于农历' + p.lunarYear + '年，年干' + p.annualStem + '，流年命宫在' + p.annualBranch + '宫' : '',
          chinese(p.annualRelation) ? '流年命宫与当前限宫的几何关系为' + p.annualRelation : '',
          scopes[p.otherScope] && chinese(p.otherBranch) ? '同一片段的' + scopes[p.otherScope] + '命宫在' + p.otherBranch + '宫'
            + (typeof p.otherSamePalace === 'boolean' ? '，与当前限宫' + (p.otherSamePalace ? '同宫' : '不同宫') : '') : '另一个限层位置未提供，不能当成大小限俱到',
          typeof p.otherAtChenXu === 'boolean' ? '另一个限宫' + (p.otherAtChenXu ? '也在辰或戌' : '不在辰戌') + '，是否符合原注俱到仍须另核' : '',
          chinese(p.annualLucunBranch) && chinese(p.annualLucunRelation) ? '按本年干定位的年度禄存在' + p.annualLucunBranch
            + '宫，与当前限宫为' + p.annualLucunRelation + '；这不自动解决条文流年禄究竟指禄存或化禄' : '',
          ...[['sourceLocalStars', '同宫'], ['sourceOppositeStars', '对宫'], ['sourceTrineStars', '三合'], ['sourceAdjacentStars', '邻宫']]
            .map(([key, label]) => Array.isArray(p[key]) ? '本条已核星位在' + label + '的成员为'
              + (p[key].filter(chinese).join('、') || '零个') + '；邻宫与守冲三合分开，不据数量判吉众' : ''),
          Array.isArray(p.decadalAreaStars) ? '同段大限守冲三合范围的已核星位为' + (p.decadalAreaStars.filter(chinese).join('、') || '零个')
            + '；原文大限扶救不借另一时段或任一小限成员代替' : '同段大限位置未提供，不能补成大限已有扶救',
          list(p.sourceAuxiliaryQualities).map(row => chinese(row.star) && chinese(row.branch) ? row.star + '独立核位在' + row.branch
            + '宫，' + (['庙', '旺', '地', '利', '平', '陷'].includes(row.grade) ? '源表明列为' + row.grade : '源表该亮度未列，不按默认表补齐') : '').filter(Boolean).join('；'),
          list(p.noblePair).filter(chinese).length ? '录文魁钺无序支位组为' + p.noblePair.filter(chinese).join('、')
            + '，不擅自给两支分配魁或钺；丙丁保留猪狗亥戌，不套默认猪鸡亥酉，免字按生肖兔卯解读并保留这个释读说明' : '',
          p.nobleArchiveState === 'different_pair' ? '该魁钺组与归档支位有版本差异，来源组不冒称默认本命星位，也不改原盘'
            : p.nobleArchiveState === 'same_pair' ? '源魁钺支位组与归档支位组相合，仍不能因此确定单星分配'
              : '归档魁钺支位组不可唯一核对，不补成相合',
          (sun?.candidate === true || sun?.splitAssistedCandidate === true) && chinese(sun.branch) && chinese(sun.decadalRelation) && chinese(sun.minorRelation)
            ? '本命田宅宫在' + sun.branch + '，太阳守此宫。大限、小限与太阳分别为' + sun.decadalRelation + '、' + sun.minorRelation
              + '。' + positions(sun.assistants, '太阳') : '',
          sun?.splitAssistedCandidate === true ? list(sun.splitAssistants).map(row => scopes[row.scope] && chinese(row.star) && chinese(row.branch)
            ? row.star + '实守' + row.branch + '宫' + scopes[row.scope] : '').filter(Boolean).join('，') : '',
          p.propertySunDoubleFuBiGuard === true && chinese(sun?.branch)
            ? '同一实段的大限与小限都守' + sun.branch + '宫的本命田宅，太阳、左辅和右弼均在此宫' : '',
          ziwei?.candidate === true && chinese(ziwei.branch) ? '本命紫微在' + ziwei.branch + '宫，当前限宫也在此宫。'
            + positions(ziwei.assistants, '紫微') : '',
          p.ziweiDoubleFuBiGuard === true && chinese(ziwei?.branch)
            ? '同一实段的大限与小限都守' + ziwei.branch + '宫，本命紫微、左辅和右弼均在此宫' : '',
          p.ziweiMingFuXiangDoubleGuardCandidate === true && chinese(ziwei?.mingFuXiangWitness?.branch)
            ? '大限和小限实守' + ziwei.mingFuXiangWitness.branch + '宫紫微。'
              + positions(ziwei.mingFuXiangWitness.trines, '紫微') + '。该段未成原诀三方杀破狼' : '',
          ...[ziwei?.mingFuXiangSeatAndTrineWitness].flatMap(row => p.ziweiMingFuXiangSeatAndTrineDoubleGuardCandidate === true
            && chinese(row?.branch) && chinese(row.birthStem) && chinese(row.atSeat?.star)
            && chinese(row.illuminating?.branch) && chinese(row.illuminating.star)
            ? ['大限和小限实守' + row.branch + '宫紫微，按明刊' + row.birthStem + '生人，'
              + row.atSeat.star + '同守此宫，' + row.illuminating.branch + '宫' + row.illuminating.star + '从三合来会。该段未成原诀三方杀破狼'] : []),
          ...(p.ziweiTrinePairCandidate === true && chinese(ziwei?.branch) ? list(ziwei.trinePairs).flatMap(pair => {
            const stars = list(pair);
            return stars.length === 2 && stars.every(row => chinese(row?.star) && chinese(row.branch) && row.relation === '三合')
              ? ['紫微实守' + ziwei.branch + '宫的当前限宫，' + stars.map(row => row.branch + '宫的' + row.star).join('和') + '均三合此限'] : [];
          }) : []),
          ziwei?.threeShaAtLimit === true ? '紫微限诀另列三方的七杀、破军与贪狼。' + positions(ziwei.counter, '紫微') : '',
          (liang?.candidate === true || liang?.templeSupportAtLimit === true) && chinese(liang.branch)
            ? '本命天梁在' + liang.branch + '宫，当前限宫也在此宫。'
            + positions(liang.assistants, '天梁') + (liang.gradeConflict === true ? '。天梁在申宫，卷二逐宫称陷、同篇男命歌称庙'
              : chinese(liang.chapterGrade) ? '。卷二逐宫称' + liang.chapterGrade : '')
            + (chinese(liang.summaryGrade) ? '，卷三汇表称' + liang.summaryGrade : '') : '',
          liang?.templeSupportAtLimit === true && chinese(liang.branch) ? '按卷二逐宫等级，天梁在'
            + liang.branch + '宫入庙，与' + list(liang.assistants).filter(row => row?.relation === '守')
              .map(row => chinese(row.star)).filter(Boolean).join('、') + '实守同一限宫' : '',
          liang?.combinedShaAtLimit === true && chinese(liang.branch) ? '天梁实守' + liang.branch
            + '宫的当前限宫。' + positions(liang.counter, '天梁') + '。火铃采用已核的归档位置，古法时支取法仍待核' : '',
          p.tianliangQuanshuFixedCombinedShaCandidate === true && chinese(liang?.branch) ? '天梁实守' + liang.branch
            + '宫的当前限宫。按南阳堂明刊核火铃，' + positions(liang.quanshuFixedCounter, '天梁') : '',
          qu?.candidate === true && chinese(qu.branch) && chinese(qu.tongBranch) ? '本命文曲与当前限宫同在' + qu.branch + '宫，天同在'
            + qu.tongBranch + '宫。' + positions(qu.companions, '文曲') + '。' + positions(qu.tongAssistants, '天同') : '',
          qu?.pairedLimitsCandidate === true && scopes[p.scope] && scopes[p.otherScope] && chinese(qu.branch) && chinese(qu.tongBranch)
            && ['冲', '三合'].includes(qu.tongRelation) ? scopes[p.scope] + '守' + qu.branch + '宫文曲，'
              + scopes[p.otherScope] + '守' + qu.tongBranch + '宫天同，两宫为' + qu.tongRelation + '。' + positions(qu.tongAssistants, '天同') : '',
          (qu?.candidate === true || qu?.pairedLimitsCandidate === true || qu?.fallenCounterAtLimit === true || qu?.chapterFallenCounterAtLimit === true)
            && chinese(qu.chapterGrade) ? '卷二文曲逐宫称' + qu.chapterGrade + (chinese(qu.grade) ? '，卷三汇表称' + qu.grade : '，卷三汇表未列该位') : '',
          (qu?.fallenCounterAtLimit === true || qu?.chapterFallenCounterAtLimit === true) && chinese(qu.branch)
            ? '文曲守' + qu.branch + '宫的当前限宫。' + positions(qu.counter, '文曲') + '。卷二限诀所需原局星辰强弱仍待核' : '',
          '十四主星位置沿用兼容且唯一的归档，本条没有重排整套《全书》本命；已核几何不等于扶救成立，诸吉集合、发化层、原文关系与相反分支未核时继续保留未知',
        ]);
      }
      case 'quanshu_palace_condition': return sentences([
        '《全书》独立源表记录',
        chinese(p.flowName) && chinese(p.natalName) ? '本期' + p.flowName + '对应本命' + p.natalName : '',
        chinese(p.branch) ? '地支为' + p.branch : '',
        list(p.localStarNames).filter(chinese).length ? '本命原有星曜：' + p.localStarNames.filter(chinese).join('、') : '',
        list(p.sourceQualities).filter(item => chinese(item.star) && ['庙', '旺', '地', '利', '平', '陷'].includes(item.grade))
          .map(item => item.star + '按源表为' + item.grade).join('、'),
        list(p.unknownQualityStars).filter(chinese).length ? '源表未明确本支亮度的星曜：' + p.unknownQualityStars.filter(chinese).join('、') : '',
        list(p.localNatalTransformations).map(value => /^([禄权科忌]):(.+)$/u.exec(text(value)))
          .filter(match => match && chinese(match[2])).map(match => '本命生年干使' + match[2] + '化' + match[1] + '在本宫').join('、'),
        '源表壬干天府化科；未明的亮度不用默认表补齐，生年四化不冒充限干发化；宫序及日界仍按已声明的产品历法分别核验',
      ]);
      case 'quanshu_body_limit_encounters': {
        if (p.profile !== 'quanshu-tanlang-qisha-limit-encounters-v1') return '';
        const near = row => row && chinese(row.star) && chinese(row.branch) && ['守', '冲', '三合'].includes(row.relation);
        const named = row => near(row) ? row.star + '在' + row.branch + '宫，关系为' + row.relation : '';
        const limitLabels = [['decadal', '大限'], ['minor', '小限']];
        const seat = (star, row) => {
          const layers = limitLabels.filter(([key]) => row?.[key] === '守').map(([, label]) => label);
          return chinese(row?.branch) && layers.length ? layers.join('、') + '守' + row.branch + '宫的本命' + star : '';
        };
        const angles = (label, row) => chinese(row?.branch) ? label + '在' + row.branch + '宫，'
          + limitLabels.filter(([key]) => chinese(row[key])).map(([key, limit]) => limit + '为' + row[key]).join('、') : '';
        const taboos = list(p.taboos).filter(row => near(row) && (
          row.label === '生年干化忌' && p.tanlangNatalXingJiCandidate === true
          || row.label === '流年干化忌候选' && p.tanlangYearXingJiCandidate === true));
        const bodyLifeAspects = p.qishaBodyLifeAspectCandidate === true ? list(p.qishaBodyLifeAspectWitnesses) : [];
        const jielanBodyLife = p.qishaBodyLifeJielanMinorShaCandidate === true ? p.qishaBodyLifeJielanMinorShaWitness : undefined;
        const bodyLife = p.qishaSeparateBodyLifeCandidate === true || p.qishaSharedBodyLifeCandidate === true || bodyLifeAspects.length > 0;
        const limitAspect = (label, row) => row && [row.target, row.targetBranch, row.branch].every(chinese)
          && ['三合', '冲'].includes(row.relation)
          ? label + '在' + row.branch + '宫，与' + row.target + '所在的' + row.targetBranch + '宫为' + row.relation : '';
        const qishaLimit = p.qishaPlainLimitCandidate === true || p.qishaImperialLuCandidate === true || p.qishaFlowShaCandidate === true
          || p.qishaAnnualTigerGuardCandidate === true;
        const qishaHome = p.life?.branch === p.body?.branch ? '身命同宫'
          : p.qisha?.branch === p.life?.branch ? '命宫' : '身宫';
        return sentences([
          taboos.length ? seat('贪狼', p.tanlang) : '',
          taboos.length ? named({ star: '按生月核位的天刑', branch: p.tianxingBranch, relation: p.tanlangXing }) : '',
          ...taboos.map(row => row.label + '落在' + row.branch + '宫的' + row.star + '，与贪狼宫为' + row.relation),
          bodyLife && chinese(p.qisha?.branch) ? '同段本命七杀在' + p.qisha.branch + '宫，守' + qishaHome : '',
          p.qishaSeparateBodyLifeCandidate === true ? angles('命宫', p.life) : '',
          p.qishaSeparateBodyLifeCandidate === true ? angles('身宫', p.body) : '',
          p.qishaSharedBodyLifeCandidate === true ? angles('身命同宫', p.life) : '',
          ...bodyLifeAspects.map(row => [limitAspect('大限', row?.decadal), limitAspect('小限', row?.minor)].filter(Boolean).join('、')),
          [jielanBodyLife?.minorBranch, jielanBodyLife?.lifeBranch, jielanBodyLife?.bodyBranch].every(chinese)
            ? '按《捷览》核当年流煞与复算小限同在七杀的' + jielanBodyLife.minorBranch + '宫。'
              + list(jielanBodyLife.bodyGuards).filter(row => chinese(row.star)).map(row => row.star).join('、')
              + '实守身宫' + jielanBodyLife.bodyBranch + '。'
              + list(jielanBodyLife.lifeTrines).filter(row => chinese(row.star)).map(row => row.star).join('、')
              + '三合命宫' + jielanBodyLife.lifeBranch : '',
          p.qishaBodyLifeRepeatCandidate === true ? '以下流年煞曜与本命同名星的位置重叠，'
            + list(p.flowSha).filter(row => row.repeatsNatal === true && near(row)).map(named).join('、') : '',
          qishaLimit ? seat('七杀', p.qisha) : '',
          (bodyLife || qishaLimit) && chinese(p.qishaGrade) ? '卷三在该宫记七杀为' + p.qishaGrade : '',
          p.qishaImperialLuCandidate === true ? named({ star: '紫微', branch: p.ziweiBranch, relation: p.qishaZiwei }) : '',
          p.qishaImperialLuCandidate === true ? list(p.lu).filter(near).map(row => row.label
            + (row.star === '禄存' ? '' : '落在' + row.star) + '，位于' + row.branch + '宫，关系为' + row.relation).join('、') : '',
          p.qishaFlowShaCandidate === true ? '同段见按流年干定位的具名煞曜，' + list(p.flowSha).filter(near).map(named).join('、') : '',
          p.qishaAnnualTigerGuardCandidate === true && chinese(p.annualTiger?.branch) ? '年度四飞白虎与七杀同守' + p.annualTiger.branch
            + '宫，实际一限也守该宫。原句流杀是否含此曜仍待核' : '',
        ]);
      }
      case 'quanshu_xing_ji_tiger': {
        if (p.profile !== 'quanshu-xing-ji-tiger-same-limit-v1') return '';
        const position = (star, branch, relation, focus) => chinese(star) && chinese(branch) && chinese(relation)
          ? star + '在' + branch + '宫，与' + focus + '为' + relation : '';
        const year = list(p.layers).find(row => row.layer === 'yearly');
        const lianLayers = list(p.layers).filter(row => row.lianzhenXingJiBladeCandidate === true);
        const qishaAnnualPair = p.qishaSamePalaceAnnualJiBladeCandidate === true;
        const qishaJi = p.qishaTianxingJiCandidate === true || p.qishaAnnualBladeJiCandidate === true || qishaAnnualPair;
        const qishaSupport = list(p.support), mingLucun = p.mingQishaNatalLucunWitness;
        const mingLucunOffTaiSui = p.mingQishaNatalLucunOffTaiSuiWitness;
        const qishaNamedContact = qishaSupport.filter(row => ['守', '冲', '三合'].includes(row.qishaRelation))
          .map(row => position(row.star, row.branch, row.qishaRelation, '七杀宫')).filter(Boolean);
        const qishaTiger = p.qishaNatalBladeTigerCandidate === true || p.qishaYearBladeTigerCandidate === true;
        const qishaAspectBlades = [p.qishaNatalBladeAspectTigerCandidate === true ? '本命擎羊' : '',
          p.qishaYearBladeAspectTigerCandidate === true ? '流年擎羊' : ''].filter(Boolean);
        const bellVariants = [
          [p.qishaJielanBellTigerCandidate === true && p.jielanBell?.branch !== p.bellBranch ? p.jielanBell : undefined, '依《捷览》排出的铃星'],
          [p.qishaQuanshuFixedBellTigerCandidate === true && p.qishaQuanshuFixedNatalBladeTigerCandidate !== true
            ? p.quanshuFixedBell : undefined, '南阳堂明刊铃星'],
        ];
        const lifeBody = [p.qishaAtLife === true ? '命宫' : '', p.qishaAtBody === true ? '身宫' : ''].filter(Boolean).join('、');
        const taboo = (row, relation, focus) => chinese(row?.stem) && chinese(row.tabooStar)
          ? position((row.layer === 'yearly' ? '流年干' : '生年干') + row.stem + '所推' + row.tabooStar + '化忌', row.tabooBranch, relation, focus) : '';
        const parentMoon = p.parentMoonTigerCandidate === true || p.parentMoonSuiGuardTigerTrineCandidate === true || p.parentMoonSuiTigerTrinesCandidate === true;
        const moonEvidence = parentMoon ? p.parentMoonEvidence : undefined, moonCalendar = moonEvidence?.calendar;
        const moonGrade = [['卷二', moonEvidence?.volume2Grade], ['卷三', moonEvidence?.volume3Grade]].map(([volume, grade]) =>
          volume + (chinese(grade) ? '列为' + grade : '未列此位等级')).join('，');
        const moonNatalSha = p.parentMoonNatalSameSeatCandidate === true ? list(moonEvidence?.yangTuo?.natal)
          .filter(row => row.relation === '守').map(row => position('本命' + row.star, row.branch, row.relation, '父母宫')).filter(Boolean) : [];
        const moonAnnualSha = list(moonEvidence?.yangTuo?.yearly).filter(row => row.relation === '守')
          .map(row => position(row.star, row.branch, row.relation, '父母宫')).filter(Boolean);
        const bodySha = p.lifeBodyShaCandidate === true || p.lifeBodyAdditionalShaCandidate === true;
        const natalSha = [...list(p.nativeSha), ...(p.lifeBodyAdditionalShaCandidate === true ? list(p.nativeAdditionalSha) : [])];
        const lifecycle = (label, branch, row, key) => chinese(branch) && row ? [
          '本命' + label + '在' + branch + '宫',
          ['decadal', 'minor'].filter(scope => ['守', '冲', '三合'].includes(row[scope])).map(scope =>
            (scope === 'decadal' ? '大限' : '小限') + '与该宫为' + row[scope]).join('、'),
          natalSha.filter(sha => sha?.[key] === '守' && chinese(sha.star)).map(sha =>
            position(chinese(sha.stem) ? '生年干' + sha.stem + '所推' + sha.star + '化忌' : sha.star, sha.branch, sha[key], label)).join('、'),
        ].filter(Boolean).join('，') : '';
        return sentences([
          number(p.lunarYear) !== undefined ? '农历' + p.lunarYear + '年《全书》刑忌、羊铃与白虎同段星位' : '',
          p.parentMoonTigerCandidate === true ? '本命父母宫在' + p.parents?.branch + '，太阴按卷一为陷地，年度四飞白虎守该宫' : '',
          parentMoon && p.parentMoonTigerCandidate !== true && chinese(p.parents?.branch)
            ? '本命父母宫在' + p.parents.branch + '，太阴按卷一为陷地' : '',
          parentMoon ? position('太岁', p.annualBranch, p.parents?.taiSui, '父母宫') : '',
          parentMoon && p.parentMoonTigerCandidate !== true ? position('年度四飞白虎', p.annualTiger, p.parents?.annualTiger, '父母宫') : '',
          moonEvidence ? '父母宫太阴的原书异表见位为' + moonGrade : '',
          number(moonCalendar?.lunarMonth) !== undefined && number(moonCalendar?.lunarDay) !== undefined && number(moonCalendar?.monthDays) !== undefined
            ? '出生农历' + (moonCalendar.isLeap === true ? '闰' : '') + moonCalendar.lunarMonth + '月第' + moonCalendar.lunarDay
              + '日，本月共' + moonCalendar.monthDays + '日' + (chinese(moonCalendar.point) ? '，按历日用语记为' + moonCalendar.point : '') : '',
          moonNatalSha.length ? '同段另见卷一所说的羊陀同度候选，' + moonNatalSha.join('、') : '',
          moonAnnualSha.length ? '同宫流曜另列盘层，' + moonAnnualSha.join('、') : '',
          bodySha ? lifecycle('命宫', p.lifeBranch, p.lifeContact, 'lifeContact') : '',
          bodySha ? lifecycle('身宫', p.bodyBranch, p.bodyContact, 'bodyContact') : '',
          ...list(p.lifeBodyMingFixedFireBell).flatMap(row => p.quanshuFixedFireBellProfile === 'quanshu-nanyangtang-fixed-firebell-v1'
            && [p.lifeBodyMingFixedShaCandidate, p.lifeBodyMingFixedPairVerified].includes(true) && chinese(row.star) && chinese(row.branch) ? [
              row.lifeContact === '守' ? '按明刊定宫，' + row.star + '实守' + row.branch + '位的本命命宫' : '',
              row.bodyContact === '守' ? '按明刊定宫，' + row.star + '实守' + row.branch + '位的本命身宫' : '',
            ] : []),
          lianLayers.length && chinese(p.lianzhen?.branch) ? '实际一限守' + p.lianzhen.branch + '宫的廉贞' : '',
          lianLayers.length ? position('本命天刑', p.tianxingBranch, p.tianxingAtLianzhen, '廉贞宫') : '',
          ...lianLayers.map(row => [position(row.layer === 'yearly' ? '流年擎羊' : '本命擎羊', row.bladeBranch, row.lianBlade, '廉贞宫'),
            taboo(row, row.lianTaboo, '廉贞宫')].filter(Boolean).join('、')),
          p.lianzhenAtSuiMinor === true && chinese(p.lianzhen?.branch) ? '太岁和小限同守' + p.lianzhen.branch + '宫的廉贞' : '',
          p.lianzhenAtSuiMinor === true ? position('年度四飞白虎', p.annualTiger, p.lianzhenAnnualTiger, '廉贞宫') : '',
          p.lianzhenAtSuiMinor === true ? position('归档本命岁前白虎', p.natalTiger, p.lianzhenNatalTiger, '廉贞宫') : '',
          qishaJi && chinese(p.qisha?.branch) && lifeBody ? '本命' + lifeBody + '的七杀在' + p.qisha.branch + '宫' : '',
          qishaJi ? position('太岁', p.annualBranch, p.qisha?.annual, '七杀宫') : '',
          qishaJi ? taboo(year, year?.qishaTaboo, '七杀宫') : '',
          p.qishaTianxingJiCandidate === true ? position('本命天刑', p.tianxingBranch, p.tianxingAtQisha, '七杀宫') : '',
          p.qishaAnnualBladeJiCandidate === true && !qishaAnnualPair ? position('流年擎羊', year?.bladeBranch, year?.qishaBlade, '七杀宫') : '',
          qishaAnnualPair && chinese(year?.bladeBranch) && year.bladeBranch === year.tabooBranch
            ? '同一流年干的擎羊与上述化忌受曜同在' + year.bladeBranch + '宫' : '',
          ...quanshuPrincipalSeatNotes(p.principalSeatProof),
          p.mingQishaNatalLucunSameSeatCandidate === true && chinese(mingLucun?.branch)
            ? '明刊另列逢禄存的救应，本命禄存与太岁所守的七杀实居' + mingLucun.branch + '宫' : '',
          p.mingQishaNatalLucunOffTaiSuiCandidate === true && chinese(mingLucunOffTaiSui?.branch)
            ? '明刊七杀临身命的逢禄存一段，本命七杀与本命禄存同守' + mingLucunOffTaiSui.branch + '宫'
              + '，流年擎羊与' + chinese(mingLucunOffTaiSui.tabooStar) + '化忌同守对宫'
              + chinese(mingLucunOffTaiSui.tabooBranch) + '宫，太岁实居' + chinese(mingLucunOffTaiSui.annualBranch) + '宫' : '',
          qishaJi && p.qishaXingJiEvidence === 'seen' && qishaNamedContact.length
            ? '同一刑忌片段的具名会照为' + qishaNamedContact.join('、') + '，各曜是否合用及实际作用待核' : '',
          ...(qishaJi ? qishaSupport.filter(row => p.qishaXingJiEvidence !== 'seen' || !['守', '冲', '三合'].includes(row.qishaRelation))
            .map(row => position(row.star, row.branch, row.qishaRelation, '七杀宫')) : []),
          qishaTiger && chinese(p.qisha?.branch) ? '七杀、年度四飞白虎和归档铃星同在' + p.qisha.branch + '宫' : '',
          p.qishaQuanshuFixedNatalBladeTigerCandidate === true && chinese(p.qisha?.branch)
            ? '本命七杀、本命擎羊和南阳堂明刊铃星同守' + p.qisha.branch + '宫，当年四飞白虎也实到此宫' : '',
          p.qishaNatalBladeTigerCandidate === true ? '本命擎羊同守该七杀宫' : '',
          p.qishaYearBladeTigerCandidate === true ? '流年擎羊同守该七杀宫' : '',
          qishaAspectBlades.length && chinese(p.qisha?.branch) ? '七杀与年度四飞白虎同守' + p.qisha.branch + '宫' : '',
          qishaAspectBlades.length && chinese(p.bellBranch) && ['冲', '三合'].includes(p.qishaBell)
            ? qishaAspectBlades.join('、') + '与归档铃星同在' + p.bellBranch + '宫，与七杀宫为' + p.qishaBell : '',
          ...bellVariants.flatMap(([bell, label]) => {
            if (!chinese(bell?.branch) || !chinese(bell.relation) || !chinese(p.qisha?.branch)) return [];
            const blades = [bell.natalBladeAtSeat || bell.natalBladeAtAspect ? '本命擎羊' : '',
              bell.annualBladeAtSeat || bell.annualBladeAtAspect ? '流年擎羊' : ''].filter(Boolean);
            return blades.length ? ['年度四飞白虎与七杀在' + p.qisha.branch + '宫，' + label + '与' + blades.join('、')
              + '同在' + bell.branch + '宫，与七杀宫为' + bell.relation] : [];
          }),
          '加临盘层、刑忌取法、会照范围及救应作用仍待核',
        ]);
      }
      case 'quanshu_solar_wu_po_limits': {
        if (p.profile !== 'quanshu-solar-wu-po-limit-branches-v1') return '';
        const area = ['守', '冲', '三合'];
        const seat = row => {
          if (!chinese(row?.star) || !chinese(row.branch)) return '';
          const layers = [['decadalRelation', '大限'], ['minorRelation', '小限']].filter(([key]) => row[key] === '守').map(([, label]) => label);
          const grade = chinese(row.verseGrade) ? '，卷二记为' + row.verseGrade : '';
          return layers.length ? layers.join('、') + '守' + row.branch + '宫的' + row.star + grade : '';
        };
        const position = (row, focus) => chinese(row?.star) && chinese(row.branch) && chinese(row.relation)
          ? row.star + '在' + row.branch + '宫，与' + focus + '为' + row.relation : '';
        const visible = (rows, focus) => list(rows).filter(row => area.includes(row.relation)).map(row => position(row, focus)).filter(Boolean).join('、');
        const emitters = { natal: '生年干', yearly: '流年干', decadal: '大限宫干候选', minor: '小限宫干候选' };
        const taboos = list(p.sunTaboos).filter(row => emitters[row.layer] && chinese(row.stem)
          && chinese(row.branch) && chinese(row.star) && area.includes(row.relation)).map(row =>
          emitters[row.layer] + row.stem + '使' + row.star + '化忌在' + row.branch + '宫，与太阳为' + row.relation);
        const mingFire = p.quanshuFixedFireBellProfile === 'quanshu-nanyangtang-fixed-firebell-v1';
        const sunClear = mingFire ? [p.sunMingFixedHarmoniousCandidate, p.sunMingFixedTwoLimitAspectCandidate].includes(true)
          : [p.sunHarmoniousCandidate, p.sunTwoLimitAspectCandidate].includes(true);
        const sunReady = sunClear || p.sunFallenShaCandidate === true || p.sunTabooShaCandidate === true
          || p.sunDarkCandidate === true || p.sunDarkQuanshuFixedCandidate === true || p.sunMingDimPairDoubleGuard === true
          || p.sunMingFixedFallenShaCandidate === true || p.sunMingFixedTabooShaCandidate === true;
        const sunSeenByBothLimits = p.sunTwoLimitAspectCandidate === true || p.sunMingFixedTwoLimitAspectCandidate === true
          || (p.sunFallenShaCandidate === true || p.sunTabooShaCandidate === true) && p.sun?.guarded === false;
        const sunDecadalBranch = p.sourceDecadal?.verified === true ? chinese(p.sourceDecadal.branch) : '';
        const sunMinorBranch = p.sourceMinor?.verified === true ? chinese(p.sourceMinor.branch) : '';
        const dark = p.sunDarkMingDoubleGuardWitness;
        const bright = p.sunMingBrightDoubleGuardWitness;
        const wuReady = p.wuTempleAtVerifiedLimitCandidate === true || p.wuTemplePlainCandidate === true
          || p.wuTempleChangCandidate === true || p.wuQuanAtLimitCandidate === true;
        const poReady = p.poTempleAtVerifiedLimitCandidate === true || p.poTemplePlainCandidate === true
          || p.poTempleSupportCandidate === true || p.poTempleAdverseCandidate === true;
        return sentences([
          number(p.lunarYear) !== undefined ? '农历' + p.lunarYear + '年《全书》太阳、武曲、破军同段星位' : '',
          sunReady ? seat(p.sun) : '',
          chinese(bright?.branch) && ['庙', '旺'].includes(bright.grade)
            ? '明刊核位后，大限、小限实守' + bright.branch + '宫' + bright.grade + '太阳，已核煞曜和四层忌曜均未到会' : '',
          sunSeenByBothLimits && sunDecadalBranch && sunMinorBranch && chinese(p.sun?.branch)
            && ['冲', '三合'].includes(p.sun.decadalRelation) && ['冲', '三合'].includes(p.sun.minorRelation)
            ? '大限在' + sunDecadalBranch + '宫，小限在' + sunMinorBranch + '宫，分别以' + p.sun.decadalRelation
              + '、' + p.sun.minorRelation + '照' + p.sun.branch + '宫的同一颗太阳' : '',
          sunClear ? '本段核对太阳的陷地见煞与加忌见煞条件，已排除两组候选' : '',
          mingFire && sunClear ? '太阳的清候选按南阳堂明刊火铃定宫核验' : '',
          mingFire && [p.sunMingFixedFallenShaCandidate, p.sunMingFixedTabooShaCandidate].includes(true)
            ? '按明刊定宫，本段太阳另见陷地或加忌并见煞曜。' + visible(p.sunMingFixedHazards, '太阳') : '',
          p.sunFallenShaCandidate === true ? '太阳在卷二明列陷地，同时见已核羊陀或归档火铃' : '',
          p.sunTabooShaCandidate === true ? '同段见到分层化忌的候选及具名煞曜。' + taboos.join('、') : '',
          ...list(p.sunTabooShaSharedPalaces).flatMap(row => emitters[row.layer] && [row.stem, row.star, row.sha, row.branch].every(chinese)
            ? [emitters[row.layer] + row.stem + '的化忌受曜' + row.star + '与' + row.sha + '实居' + row.branch + '宫'] : []),
          p.sunDarkCandidate === true ? '太阳在卷一玉蟾段的偏垣，暗度暂按巨门见位核对。' + position(p.sunDarkWitness, '太阳') : '',
          p.sunDarkQuanshuFixedCandidate === true ? '偏垣太阳另核明刊火铃。暗度暂按巨门见位核对。'
            + position(p.sunDarkWitness, '太阳') + '。' + visible(p.sunDarkQuanshuFixedFireBell, '太阳') : '',
          p.sunMingDimPairDoubleGuard === true && chinese(p.sun?.branch)
            ? '按卷一偏垣独立句，复算大小限均实守' + p.sun.branch + '宫的本命太阳与巨门' : '',
          chinese(dark?.branch) ? '大限、小限实守' + dark.branch + '宫的太阳与巨门。'
            + visible([dark.fire, ...list(dark.yangTuo)], '太阳') + '。'
            + (chinese(dark.bell?.branch) ? '明刊铃星在' + dark.bell.branch + '宫，未到会' : '') : '',
          sunReady ? visible(p.sunHazards, '太阳') : '',
          wuReady ? seat(p.wu) : '',
          ...(p.wuQuanAtLimitCandidate === true ? list(p.wuQuanWitnesses).flatMap(row => {
            const scope = row.scope === 'decadal' ? '大限' : row.scope === 'minor' ? '小限' : '';
            return scope && emitters[row.layer] && chinese(row.stem) && chinese(row.branch)
              ? [emitters[row.layer] + row.stem + '使武曲化权，武曲实守' + row.branch + '宫' + scope] : [];
          }) : []),
          p.wuTemplePlainCandidate === true ? '文昌位置已核，武曲宫守冲三合及邻宫未见文昌' : '',
          p.wuTempleChangCandidate === true ? position(p.wuChang, '武曲') : '',
          p.wuTempleChangNeighborCandidate === true && chinese(p.wuChang?.branch)
            ? '文昌实在' + p.wuChang.branch + '宫，仅邻武曲限宫，临左右的古文取法仍待核' : '',
          p.wuTempleChangAssistantsCandidate === true ? '左辅与右弼均对实际到会的文昌有守冲三合关系' : '',
          p.wuTempleChangFlankedCandidate === true ? '左辅与右弼分居文昌两侧邻宫，文昌实际守冲三合武曲限宫' : '',
          p.wuQuanAssistedCandidate === true ? '武曲实守限宫且自身化权时，左辅右弼均到会。' + visible(p.wuAssistants, '武曲') : '',
          p.wuTempleChangCandidate === true ? list(p.wuAssistants).filter(row => chinese(row.changRelation))
            .map(row => position(row, '武曲') + '，与文昌为' + row.changRelation).join('。') : '',
          poReady ? seat(p.po) : '',
          p.poTemplePlainCandidate === true ? '该限实守庙地破军，文昌与魁钺组同会条件未成立。'
            + [position(p.poChang, '破军'), visible(p.poNobles, '破军')].filter(Boolean).join('、') : '',
          p.poTempleSupportCandidate === true ? '破军宫守冲三合范围核到文昌和魁钺组。' + position(p.poChang, '破军') + '、' + visible(p.poNobles, '破军') : '',
          p.poTempleJoinedSupportCandidate === true && chinese(p.poChang?.branch)
            ? '文昌与魁钺组的一颗实居' + p.poChang.branch + '宫，共同到会庙地破军所在的限宫' : '',
          p.poTempleBothNoblesCandidate === true ? '文昌和来源魁钺组两处星位均守冲三合破军限宫。' + visible(p.poNobles, '破军') : '',
          p.poTempleSupportCandidate === true && p.poTempleJoinedSupportCandidate === false
            ? '文昌和到会的魁钺星位分宫，各自照会破军限宫' : '',
          p.poTemplePlainCandidate === true || p.poTempleSupportCandidate === true ? '该宫守冲三合均未见已核羊陀和归档火铃' : '',
          p.poTempleAdverseCandidate === true ? '破军宫见已核煞曜，' + visible(p.poHazards, '破军') : '',
          poReady ? '破军入限的时间按所守限层的上五年或上半年核对' : '',
          '归档火铃原法、原诀所取发干和星曜合参仍待核',
        ]);
      }
      case 'quanshu_year_encounters': {
        if (p.profile !== 'quanshu-cry-void-doujun-year-encounters-v1') return '';
        const doubleGuard = p.cryVoidBothStarsDoubleGuardWitness;
        const pair = p.cryVoidBothStarsDoubleGuardCandidate === true && chinese(doubleGuard?.branch)
          ? '复算大限和小限同守' + doubleGuard.branch + '宫的本命天哭、天虚'
          : p.cryVoidTogetherCandidate === true ? '本命天哭、天虚同宫且有实际限宫守入'
          : p.cryVoidSplitCandidate === true ? '本命天哭、天虚分宫，大小限分别守入' : '';
        const limitName = scope => scope === 'decadal' ? '大限' : scope === 'minor' ? '小限' : '';
        const flanked = p.cryVoidDadeFlankedDecadalWitness;
        const splitFourFlying = p.cryMourningDadeSplitFourFlyingWitness;
        const cryVoidAspects = list(p.cryVoidLimitWitnesses).filter(row => row?.candidate === true
          && limitName(row.guardScope) && limitName(row.aspectScope)
          && [row.guardStar, row.guardBranch, row.aspectStar, row.aspectBranch, row.aspectLimitBranch].every(chinese)
          && ['冲', '三合'].includes(row.aspectRelation)).map(row => {
          const focus = row.guardScope === row.aspectScope ? '该限宫' : limitName(row.aspectScope) + '所在的' + row.aspectLimitBranch + '宫';
          return limitName(row.guardScope) + '守' + row.guardBranch + '宫的本命' + row.guardStar
            + '，本命' + row.aspectStar + '在' + row.aspectBranch + '宫，与' + focus + '为' + row.aspectRelation;
        });
        const cryingSeats = list(p.cries).filter(row => row?.guarded === true && chinese(row.star) && chinese(row.branch)
          && (pair || row.exception === true || row.guardedLu === true || row.guardedLuAspect === true)).map(row => {
          const limits = [['decadal', '大限'], ['minor', '小限']].filter(([key]) => row[key] === '守').map(([, label]) => label).join('、');
          const luName = item => item.star === '禄存' ? item.label : item.label + '落' + item.star;
          const luContacts = list(row.luContacts).filter(item => chinese(item?.label) && chinese(item.star));
          const lu = luContacts.filter(item => item.atSeat === true).map(luName).join('、');
          const aspectedLu = luContacts.filter(item => chinese(item.branch) && ['冲', '三合'].includes(item.relation))
            .map(item => luName(item) + '在' + item.branch + '宫，与该限宫为' + item.relation).join('、');
          return limits + '守' + row.branch + '宫的本命' + row.star
            + (row.exception === true ? '，属于丑卯申例外支位' : '') + (lu ? '，同宫见' + lu : '')
            + (aspectedLu ? '，' + aspectedLu : '');
        });
        const cryBranch = list(p.cries).find(row => row.star === '天哭')?.branch;
        const cryingMourning = p.cryMourningLimitAspectCandidate === true && chinese(cryBranch) && chinese(p.mourningBranch)
          ? list(p.cryMourningLimitContacts).filter(row => row.candidate === true && chinese(row.branch)
            && ['decadal', 'minor'].includes(row.scope) && ['守', '冲', '三合'].includes(row.cryRelation)
            && ['守', '冲', '三合'].includes(row.mourningRelation)).map(row => (row.scope === 'decadal' ? '大限' : '小限')
            + '在' + row.branch + '宫，本命天哭在' + cryBranch + '宫，与该限宫为' + row.cryRelation
            + '，流年丧门在' + p.mourningBranch + '宫，与该限宫为' + row.mourningRelation) : [];
        const splitCryingMourning = p.cryMourningSplitLimitsCandidate === true
          ? list(p.cryMourningSplitGuards).flatMap(row => ['decadal', 'minor'].includes(row?.cryScope)
            && ['decadal', 'minor'].includes(row.mourningScope) && row.cryScope !== row.mourningScope
            && chinese(row.crySeat) && chinese(row.mourningSeat) && row.crySeat !== row.mourningSeat
            ? ['同一农历年片段，本命天哭实守' + (row.cryScope === 'decadal' ? '大限' : '小限') + row.crySeat + '宫'
              + '，流年丧门实守' + (row.mourningScope === 'decadal' ? '大限' : '小限') + row.mourningSeat + '宫'] : []) : [];
        const nanyangCryingMourning = list(p.cryMourningNanyangWitnesses).flatMap(row => {
          if (![row?.branch, cryBranch, p.mourningBranch].every(chinese)) return [];
          if (row.scope === 'minor' && row.cryRelation === '冲' && row.mourningRelation === '守')
            return ['按明刊晏平仲例，小限在' + row.branch + '宫，流年丧门实守此宫，本命天哭从' + cryBranch + '宫正冲'];
          if (row.scope === 'natal' && row.cryRelation === '守' && row.mourningRelation === '冲')
            return ['按明刊冉求例，本命天哭实守' + row.branch + '宫的本命命宫，流年丧门从' + p.mourningBranch + '宫正冲'];
          return [];
        });
        const quanji = p.cryMourningQuanjiProfile === 'quanji-taixuan-tianzhang-life-and-six-harmony-cry-v1'
          && p.cryMourningQuanjiLifeAspectCandidate === true ? p.cryMourningQuanjiLifeWitness : undefined;
        const quanjiCryingMourning = quanji && [quanji.lifeBranch, quanji.cryBranch, quanji.mourningBranch].every(chinese)
          && [quanji.cryRelation, quanji.mourningRelation].every(relation => ['冲', '三合'].includes(relation))
          ? '按《全集》复算的本命命宫在' + quanji.lifeBranch + '宫，天哭在' + quanji.cryBranch + '宫以' + quanji.cryRelation
            + '照命，流年丧门在' + quanji.mourningBranch + '宫以' + quanji.mourningRelation + '照命' : '';
        const natalContrast = p.doujunYearContrastCandidate === true;
        const annualContrast = p.doujunYearAnnualShaCandidate === true;
        const contrast = natalContrast || annualContrast;
        const yearSeats = contrast ? list(p.yearLayers).filter(row => row?.favorable === true && chinese(row.label) && chinese(row.branch))
          .map(row => row.label + '在' + row.branch + '宫，守宫有' + list(row.support).map(star => chinese(star.star)).filter(Boolean).join('、')) : [];
        return sentences([
          pair, ...cryVoidAspects, ...cryingSeats,
          chinese(flanked?.decadalBranch) ? '复算大限在' + flanked.decadalBranch + '宫，两侧实见'
            + list(flanked.flanks).map(row => row.branch + '宫的' + row.star).join('、') : '',
          chinese(splitFourFlying?.voidStar?.branch) ? '天虚实守' + limitName(splitFourFlying.voidStar.scope) + splitFourFlying.voidStar.branch
            + '宫，该限有' + list(splitFourFlying.fourFlying).map(row => row.star + '在' + row.branch + '宫' + row.relation).join('、') : '',
          cryVoidAspects.length || p.cryVoidLuAspectCandidate === true ? '哭虚会遇的原用范围、所取禄层及例外承接仍待核' : '',
          p.cryMourningCandidate === true && chinese(p.mourningBranch) ? '流年丧门与本命天哭同在' + p.mourningBranch + '宫' : '',
          ...cryingMourning, ...splitCryingMourning, ...nanyangCryingMourning, quanjiCryingMourning,
          cryingMourning.length || splitCryingMourning.length ? '旧口诀的完整会遇范围与限层承接仍待核' : '',
          ...yearSeats,
          contrast ? quanshuLeapBirthDescription(p) : '',
          contrast ? '上述三宫均未见已核本命煞曜同守，此处采用归档火铃口径' : '',
          natalContrast && chinese(p.doujunBranch) ? '正月初一的斗君在' + p.doujunBranch + '宫，守宫有'
            + list(p.doujunSha).map(row => chinese(row.star)).filter(Boolean).join('、') : '',
          annualContrast && chinese(p.doujunBranch) ? '上述三宫也均未见流年羊陀同守，正月初一的斗君在' + p.doujunBranch
            + '宫，按流年干核位的守宫星有' + list(p.doujunAnnualSha).map(row => chinese(row.star)).filter(Boolean).join('、') : '',
          p.quanshuFixedFireBellProfile === 'quanshu-nanyangtang-fixed-firebell-v1'
            && p.doujunMingYearContrastCandidate === true && chinese(p.doujunBranch)
            ? '明刊定宫核到正月初一斗君在' + p.doujunBranch + '宫，实守有'
              + list(p.mingDoujunSha).map(row => chinese(row.star)).filter(Boolean).join('、') : '',
          p.quanshuFixedFireBellProfile === 'quanshu-nanyangtang-fixed-firebell-v1'
            && p.doujunMingYearAnnualShaCandidate === true && chinese(p.doujunBranch)
            ? '按明刊火铃复核三层后，开年斗君' + p.doujunBranch + '宫另见流年羊陀中的具名守曜' : '',
          contrast && p.includesFirstInstant === false ? '正月初一早于本段，已复核开年太岁和大小限的三个宫位均与本段相同' : '',
          contrast ? '后续月限按各自实际月段和守宫星位复核' : '',
        ]);
      }
      case 'quanshu_doujun_year_month': {
        if (p.profile !== 'quanshu-doujun-year-month-review-v1' || !chinese(p.branch)
          || number(p.lunarYear) === undefined || number(p.lunarMonth) === undefined) return '';
        const names = rows => list(rows).map(row => chinese(row.star)).filter(Boolean).join('、');
        const sha = p.natalShaReviewCandidate === true ? names(p.sha) : '';
        const annualSha = p.annualShaReviewCandidate === true ? names(p.annualSha) : '';
        const support = names(p.support);
        return sentences([
          '农历' + p.lunarYear + '年' + p.lunarMonth + '月斗君宫在' + p.branch + '宫',
          quanshuLeapBirthDescription(p),
          sha ? '当月具名煞曜实守有' + sha : '',
          annualSha ? '按本年年干定位，实守当月斗君宫的有' + annualSha : '',
          p.quanshuFixedFireBellProfile === 'quanshu-nanyangtang-fixed-firebell-v1' && p.mingNatalShaReviewCandidate === true
            ? '明刊定宫核当月斗君宫的具名煞曜实守有' + names(p.mingSha) : '',
          p.quanshuFixedFireBellProfile === 'quanshu-nanyangtang-fixed-firebell-v1' && p.mingAnnualShaReviewCandidate === true
            ? '开年盘按明刊复核通过，当月流年守曜有' + names(p.annualSha) : '',
          support ? '当月同宫助曜有' + support : '',
        ]);
      }
      case 'quanshu_limit_verse_contacts': {
        if (p.profile !== 'quanshu-tong-yin-bell-verse-contacts-v1') return '';
        const guardedBy = row => [['decadalRelation', '大限'], ['minorRelation', '小限']]
          .filter(([key]) => row?.[key] === '守').map(([, label]) => label).join('、');
        const seat = (name, row) => chinese(row?.branch) && guardedBy(row) ? guardedBy(row) + '守' + row.branch + '宫的' + name : '';
        const positions = (rows, relations = ['守', '冲', '三合']) => list(rows).filter(row => chinese(row?.star) && chinese(row.branch)
          && relations.includes(row.relation)).map(row => row.star + '在' + row.branch + '宫，与此宫为' + row.relation).join('、');
        const jiReady = [p.jiBaseCandidate, p.jiBothLimitsAspectCandidate, p.jiSupportCandidate,
          p.jiLiangTogetherCandidate, p.jiTongChangQuCandidate, p.jiFallenShaCandidate, p.jiMingFixedFourShaCandidate].includes(true);
        const distinctLimitDescription = (star, row) => chinese(row?.branch) && chinese(p.decadalBranch) && chinese(p.minorBranch)
          && ['冲', '三合'].includes(row.decadalRelation) && ['冲', '三合'].includes(row.minorRelation)
          ? '大限从' + p.decadalBranch + '宫' + row.decadalRelation + '，小限从' + p.minorBranch + '宫' + row.minorRelation
            + '，两限从不同宫位照同一颗' + star : '';
        const xiangReady = p.xiangDoubleGuardCandidate === true || p.xiangIdleSeatCandidate === true || p.xiangIdleBothLimitsAspectCandidate === true
          || p.xiangGrowthAidCandidate === true || p.xiangTempleAidCandidate === true
          || p.xiangFallenLianPoYangTuoCandidate === true || p.xiangFallenOpposedCandidate === true
          || p.xiangFallenQuanshuFixedOpposedCandidate === true || p.xiangMingYangFireBellCandidate === true
          || p.xiangMingYangAtVerifiedLimitCandidate === true;
        const tongReady = [p.tongSupportCandidate, p.tongFallenOpposedCandidate, p.tongFallenAnnualOpposedCandidate,
          p.tongFallenVoidsOpposedCandidate, p.tongFallenJiOpposedCandidate].includes(true);
        const yinReverse = [p.yinReverseYangTuoCandidate, p.yinReverseAnnualYangTuoCandidate, p.yinReverseFireBellCandidate,
          p.yinReverseQuanshuFixedFireBellCandidate, p.yinVolumeThreeNativeTrineDoubleGuardCandidate].includes(true);
        const reverseSource = p.yinReverseSource === 'volume-three' ? '卷三明列的反背位置'
          : p.yinReverseSource === 'nanyang-commentary' ? '南阳堂本《太微赋注解》所列的反背支位' : '';
        const yinReady = yinReverse || [p.yinAtVerifiedLimitCandidate, p.yinClearFireBellCandidate, p.yinPairedFireBellCandidate, p.yinSingleFireBellCandidate,
          p.yinQuanshuFixedClearFireBellCandidate, p.yinQuanshuFixedPairedFireBellCandidate].includes(true);
        const bellDescription = (row, label) => {
          const ready = row.bellWithoutNamedSupportCandidate === true || row.bellWithNamedSupportCandidate === true
            || row.bellWithAdditionalAidCandidate === true;
          const fullSupport = row.bellTempleFullSupportCandidate === true;
          const named = [row.bellTanlang, row.bellWuqu, ...list(row.bellSupport)];
          return [ready ? seat(label, row.bell) : '',
            ready && chinese(row.bellSourceGrade) ? '卷三在该铃星宫记' + row.bellSourceGrade : '',
            row.bellWithoutNamedSupportCandidate === true
              ? (row.bellDoubleLimitWithoutNamedSupportCandidate === true ? '大小限同守铃星宫，' : '')
                + '贪狼、武曲、紫微、天府、左辅、右弼均已核位。另核禄存、天马、魁钺组，在铃星宫守冲三合范围内均未见上述星曜' : '',
            row.bellWithAdditionalAidCandidate === true ? '铃星限宫另见卷三具名助曜，' + positions(row.bellAdditionalAid) : '',
            row.bellWithNamedSupportCandidate === true && !fullSupport ? '铃星宫见到同章具名星曜，' + positions(named) : '',
            row.bellTanlangAtLimitCandidate === true && chinese(row.bell?.branch)
              ? label + '与本命贪狼实守' + row.bell.branch + '宫' + guardedBy(row.bell) : '',
            row.bellTanlangAspectCandidate === true && chinese(row.bellTanlang?.branch) && ['冲', '三合'].includes(row.bellTanlang.relation)
              ? '本命贪狼在' + row.bellTanlang.branch + '宫，与' + label + '所守的限宫为' + row.bellTanlang.relation : '',
            fullSupport ? '入庙的铃星守限，贪狼武曲、紫微天府、左辅右弼三组均会此宫，' + positions(named) : '',
            row.bellTempleWuTanCandidate === true && !fullSupport ? '入庙的铃星守限，本命贪狼和武曲均到此限宫，' + positions([row.bellTanlang, row.bellWuqu]) : '',
            row.bellTempleHelperGroupsCandidate === true && !fullSupport ? '入庙的铃星守限，紫微天府与左辅右弼均会此宫，' + positions(row.bellSupport) : '',
            row.bellTempleSupportPairCandidate === true && row.bellTempleHelperGroupsCandidate !== true ? '入庙的铃星守限，本命贪狼及具名辅曜成对会到此限宫，'
              + positions([row.bellTanlang, ...list(row.bellTempleSupportPairs).flatMap(pair => list(pair))]) : ''];
        };
        return sentences([
          number(p.lunarYear) !== undefined ? '农历' + p.lunarYear + '年《全书》同段守限与星曜见位' : '',
          p.sourceDecadal?.verified === false ? '归档大限未通过该年实际十年段核验，仅采用独立复算的其他限位' : '',
          jiReady ? seat('天机', p.ji) : '',
          jiReady && p.jiBothLimitsAspect === true && chinese(p.ji?.branch)
            ? '天机在' + p.ji.branch + '宫，' + distinctLimitDescription('天机', p.ji) : '',
          jiReady ? (chinese(p.jiGrade) ? '卷三在该宫记天机为' + p.jiGrade : '卷三未列该宫的天机等级') : '',
          jiReady && p.jiQuestionSongTemple === true ? '该宫也在卷一天机歌所举的入庙支位中' : '',
          p.jiSupportCandidate === true ? '天梁、辅弼和昌曲全组均有实际会照，' + positions(p.jiSupport) : '',
          p.jiLiangTogetherCandidate === true && p.jiSupportCandidate !== true && chinese(p.ji?.branch) ? '天梁与天机同在' + p.ji.branch + '宫' : '',
          p.jiTongChangQuCandidate === true ? '天同、文昌、文曲均会天机宫，'
            + positions(p.jiSupportCandidate === true ? list(p.jiTongChangQu).filter(row => row.star === '天同') : p.jiTongChangQu) : '',
          p.jiFallenShaCandidate === true ? (p.jiBothLimitsAspect === true ? '两限会照陷地天机' : '该限守陷地天机')
            + '，四颗具名煞曜均到守冲三合范围且有实冲，' + positions(p.jiSha) : '',
          p.jiMingFixedFourShaCandidate === true ? '陷地天机依明刊并列四煞守冲三合，至少一曜实冲，'
            + positions(p.jiMingFixedSha) : '',
          xiangReady ? seat('天相', p.xiang) : '',
          p.xiangDoubleGuardCandidate === true && chinese(p.xiang?.branch)
            ? '大限与复算小限都实守天相所在的' + p.xiang.branch + '宫' : '',
          xiangReady && chinese(p.xiangGrade) ? '卷三在该宫记天相为' + p.xiangGrade : '',
          p.xiangIdleSeatCandidate === true && chinese(p.xiang?.branch) ? '卷二把天相所在的' + p.xiang.branch + '宫列为闲宫' : '',
          p.xiangIdleBothLimitsAspectCandidate === true && chinese(p.xiang?.branch) && chinese(p.decadalBranch) && chinese(p.minorBranch)
            ? '天相在卷二列闲的' + p.xiang.branch + '宫，' + distinctLimitDescription('天相', p.xiang) : '',
          p.xiangGrowthAidCandidate === true && ['bureau', 'origin', 'direction', 'phase'].every(key => chinese(p.xiangGrowth?.[key]))
            ? '按卷二' + p.xiangGrowth.bureau + '从' + p.xiangGrowth.origin + '宫起长生，'
              + p.xiangGrowth.direction + '至天相宫为' + p.xiangGrowth.phase + '。左辅、右弼均会照，'
              + positions(p.xiangSupport) + '。这组位置供比较卷一的生旺条件' : '',
          p.xiangTempleAidCandidate === true ? '左辅、右弼均会照天相庙宫，' + positions(p.xiangSupport) : '',
          p.xiangMingYangFireBellCandidate === true && p.quanshuFixedFireBellProfile === 'quanshu-nanyangtang-fixed-firebell-v1'
            ? '天相与擎羊实守同一限宫，明刊定宫的火铃也均会到此宫，' + positions(p.xiangMingYangFireBellWitnesses) : '',
          p.xiangMingYangAtVerifiedLimitCandidate === true && p.xiangMingYangFireBellCandidate !== true
            && chinese(p.xiangMingYangAtVerifiedLimitWitness?.branch)
            ? '明刊入限诀另列擎羊。本命擎羊与天相同在' + p.xiangMingYangAtVerifiedLimitWitness.branch
              + '宫，' + guardedBy(p.xiang) + '实守此宫' : '',
          p.xiangFallenLianPoYangTuoCandidate === true ? '廉贞、破军同在对宫，源擎羊和陀罗也有见位，'
            + positions([...list(p.xiangLianPo), ...list(p.xiangYangTuo)]) : '',
          p.xiangFallenLianPoYangTuoCandidate === true ? positions(p.xiangWuTan, ['守', '冲', '三合', '其他']) : '',
          p.xiangFallenOpposedCandidate === true ? '陷地天相对宫见归档火铃，' + positions(p.xiangFireBell, ['冲']) : '',
          p.xiangFallenQuanshuFixedOpposedCandidate === true ? '陷地天相实守限宫，对宫见到下列明刊星曜，'
            + positions(p.xiangQuanshuFixedFireBell, ['冲']) : '',
          tongReady ? seat('天同', p.tong) : '',
          tongReady && chinese(p.tongSourceGrade) ? '卷二在该宫记天同为' + p.tongSourceGrade : '',
          p.tongFallenOpposedCandidate === true ? '天同午宫为陷，同段见对冲的具名煞曜，' + positions(p.tongSha, ['冲']) : '',
          p.tongFallenAnnualOpposedCandidate === true ? '午宫天同守限，同年流曜实际对冲此宫，' + positions(p.tongAnnualYangTuo, ['冲']) : '',
          p.tongFallenVoidsOpposedCandidate === true ? '午宫天同守限，对宫见已核空劫星位，' + positions(p.tongVoids, ['冲']) : '',
          ...(p.tongFallenJiOpposedCandidate === true ? list(p.tongJi).flatMap(row => {
            if (row?.relation !== '冲' || !['natal', 'yearly'].includes(row.layer) || !chinese(row.stem)
              || !chinese(row.star) || !chinese(row.branch)) return [];
            const basis = row.layer === 'natal' ? '本命生年干' + row.stem + '使'
              : '以流年干' + row.stem + '延用生年表，候选为';
            return [basis + row.star + '化忌，' + row.star + '在' + row.branch + '宫对冲天同限宫'];
          }) : []),
          p.tongSupportCandidate === true ? '本段已核的天同陷地受对冲条件不成立' : '',
          yinReady ? seat('太阴', p.yin) : '',
          p.yinClearFireBellCandidate === true ? '归档火铃位置均已核，太阴宫守冲三合未见二曜' : '',
          p.yinPairedFireBellCandidate === true ? '归档火铃同见于太阴宫守冲三合范围，' + positions(p.yinFireBell) : '',
          p.yinQuanshuFixedClearFireBellCandidate === true ? '明刊火铃均已定位，太阴宫守冲三合范围均未见' : '',
          p.yinQuanshuFixedPairedFireBellCandidate === true ? '明刊火铃均在太阴宫守冲三合范围，' + positions(p.yinQuanshuFixedFireBell) : '',
          ...[p.yinMingSingleGuardWithoutFireBellWitness].flatMap(row => p.yinMingSingleGuardWithoutFireBellCandidate === true
            && ['decadal', 'minor'].includes(row?.scope) && chinese(row.branch)
            ? [scopes[row.scope] + '实守' + row.branch + '宫本命太阴。另一限已核不实守，复算明刊火铃均未守冲三合此宫'] : []),
          ...[p.yinMingDoubleGuardBothFireBellAspectsWitness].flatMap(row => p.yinMingDoubleGuardBothFireBellAspectsCandidate === true
            && chinese(row?.branch) ? ['明刊火铃同向到会' + row.branch + '宫，均未实守两限同到的太阴宫，' + positions(row.fireBell)] : []),
          p.yinSingleFireBellCandidate === true ? '太阴宫守冲三合只见一颗归档火铃，' + positions(p.yinFireBell) : '',
          yinReverse && reverseSource && chinese(p.sunBranch) && chinese(p.yin?.branch)
            ? '太阳在' + p.sunBranch + '宫且太阴在' + p.yin.branch + '宫，属于' + reverseSource : '',
          p.yinReverseYangTuoCandidate === true ? (p.yinReverseSource === 'nanyang-commentary' ? '南阳堂反背位置的羊陀三合仅作版别对照，' : '反背的太阴宫见羊陀三合，') + positions(p.yinYangTuo, ['三合']) : '',
          ...[p.yinVolumeThreeNativeTrineDoubleGuardWitness].flatMap(row => p.yinVolumeThreeNativeTrineDoubleGuardCandidate === true
            && chinese(p.sunBranch) && chinese(p.yin?.branch) && chinese(row?.star) && chinese(row.branch)
            ? ['按三卷本日' + p.sunBranch + '月' + p.yin.branch + '，大小限同守' + p.yin.branch + '宫太阴，'
              + row.star + '在' + row.branch + '宫实三合'] : []),
          p.yinReverseAnnualYangTuoCandidate === true ? (p.yinReverseSource === 'nanyang-commentary' ? '南阳堂反背位置的流曜三合仅作版别对照，' : '反背的太阴实守限宫，同年流曜三合此宫，') + positions(p.yinAnnualYangTuo, ['三合']) : '',
          p.yinReverseFireBellCandidate === true ? list(p.yinFireBell).map(row => seat(row.star, row)).filter(Boolean).join('、') : '',
          p.yinReverseQuanshuFixedFireBellCandidate === true ? list(p.yinQuanshuFixedFireBell)
            .map(row => seat('明刊' + row.star, row)).filter(Boolean).join('、') : '',
          ...[p.yinReverseQuanshuFixedSplitLimitsWitness].flatMap(row => p.yinReverseQuanshuFixedSplitLimitsCandidate === true
            && scopes[row?.fire?.scope] && scopes[row?.bell?.scope] && chinese(row.fire.branch) && chinese(row.bell.branch)
            ? ['按明刊定宫，火星实守' + row.fire.branch + '宫的' + scopes[row.fire.scope]
              + '，铃星实守' + row.bell.branch + '宫的' + scopes[row.bell.scope]] : []),
          ...bellDescription(p, '归档铃星'),
          ...(p.jielanBell && p.jielanBell.bell?.branch !== p.bell?.branch
            ? bellDescription(p.jielanBell, '《捷览》所推铃星') : []),
          ...(p.quanshuFixedBellCandidate === true && p.quanshuFixedBell
            ? bellDescription(p.quanshuFixedBell, '南阳堂明刊铃星') : []),
          '完整会照范围和合参作用仍待核',
        ]);
      }
      case 'quanshu_kongjie_limits': {
        if (p.profile !== 'quanshu-kongjie-limit-branches-v1') return '';
        const layers = (label, branch, row) => chinese(branch) ? label + '在' + branch + '宫，'
          + [['annual', '太岁'], ['decadal', '大限'], ['minor', '小限']].filter(([key]) => chinese(row?.[key]))
            .map(([key, layer]) => layer + '与此宫为' + row[key]).join('、') : '';
        const positions = (rows, key = 'relation') => list(rows).filter(row => chinese(row.star) && chinese(row.branch)
          && ['守', '冲', '三合'].includes(row[key])).map(row => row.star + '在' + row.branch + '宫，与此宫为' + row[key]).join('、');
        const robberyPositions = [...(p.robberyShaCandidate === true ? list(p.annualShaPositions) : []),
          ...(p.robberyAnnualOfficialCandidate === true ? [p.annualOfficial] : []), ...(p.robberyBoshiOfficialCandidate === true ? [p.boshiOfficial] : [])];
        const principals = list(p.knownLocalPrincipals).filter(chinese);
        const pairedVoids = p.pairedVoidsCandidate === true || p.voidAspectLimitsCandidate === true;
        const voidAspects = p.voidAspectLimitsCandidate === true ? list(p.voidAspectWitnesses) : [];
        const maoYouVoids = p.voidsZiweiMaoYouSplitTrineWitness;
        const taiSuiSha = [...(p.robberyTaiSuiShaCandidate === true ? list(p.taiSuiNamedSha) : []),
          ...(p.robberyTaiSuiFireBellEnvoyCandidate === true ? list(p.taiSuiFireBellEnvoy) : [])].filter(chinese);
        const taiSuiSourceFireBell = p.robberyTaiSuiQuanshuFixedFireBellCandidate === true
          ? list(p.taiSuiQuanshuFixedFireBell).filter(row => row.branch === p.annualBranch && chinese(row.star)).map(row => row.star) : [];
        const robberyGuards = list(p.robberyVerifiedLimitScopes).map(scope => scopes[scope]).filter(Boolean).join('、');
        const robberyNatalSha = p.robberyMingTaiSuiNatalShaDoubleGuardWitness;
        const robberyNatalShaStars = list(robberyNatalSha?.guards).map(row => chinese(row.star)).filter(Boolean).join('、');
        const skyCoSeat = p.skyCoSeatedAssistantCandidate === true ? p.skyCoSeatedAssistantWitness : undefined;
        const skyNoble = p.skyCoSeatedNobleCandidate === true ? p.skyCoSeatedNobleWitness : undefined;
        const skyMingAuxiliary = p.skyCoSeatedMingAuxiliaryNobleCandidate === true ? p.skyCoSeatedMingAuxiliaryNobleWitness : undefined;
        const skyLocalSupport = p.skySupportCandidate === true || p.skyLuSupportCandidate === true || Boolean(skyCoSeat || skyNoble || skyMingAuxiliary);
        const officialGuards = p.mingBoshiOfficialProfile === 'quanshu-nanyangtang-boshi-official-same-limit-v1'
          && p.robberyMingBoshiOfficialGuardCandidate === true
          ? list(p.robberyMingBoshiOfficialScopes).map(scope => scopes[scope]).filter(Boolean).join('、') : '';
        const partnerSky = [...(p.skyPartnerSupportCandidate === true ? list(p.skyPartnerSupportWitnesses) : []),
          ...(p.skyPartnerLuSupportCandidate === true ? list(p.skyPartnerLuSupportWitnesses) : [])];
        return sentences([
          number(p.lunarYear) !== undefined ? '农历' + p.lunarYear + '年《全书》空劫同段星位' : '',
          p.sourceDecadal?.verified === false ? '归档大限未通过五局起岁和宫位复核，按实际可核的限位判读' : '',
          p.sourceSkyReady === false && p.sourceRobberyReady === true ? '古天空待核，地劫独立核位' : '',
          p.sourceRobberyReady === false && p.sourceSkyReady === true ? '地劫待核，古天空独立核位' : '',
          p.robberyFourFlyingOfficialDoubleGuardCandidate === true && chinese(p.robberyBranch)
            ? '流年四飞官符与地劫同在' + p.robberyBranch + '宫，复算大限、小限均实守' : '',
          officialGuards && chinese(p.robberyBranch) ? '明刊候选核到本命博士官府与地劫同守' + p.robberyBranch
            + '宫，同段' + officialGuards + '也实守此宫。四飞官符的位置另查' : '',
          ...list(p.voidMingFixedFourShaWitnesses).flatMap(row => p.voidMingFixedFourShaCandidate === true
            && p.quanshuFixedFireBellProfile === 'quanshu-nanyangtang-fixed-firebell-v1'
            && chinese(row.voidStar) && chinese(row.branch) ? [
              '明刊四煞同核实际限宫' + row.branch + '宫的' + row.voidStar + '。' + positions(row.related),
            ] : []),
          ...list(p.voidJielanFourShaWitnesses).flatMap(row => p.voidJielanFourShaCandidate === true
            && chinese(row.voidStar) && chinese(row.branch) ? [
              '按《捷览》生时定位的火铃与本命羊陀共同会照实际限宫' + row.branch + '宫的' + row.voidStar + '。' + positions(row.related),
            ] : []),
          skyLocalSupport || partnerSky.length || pairedVoids
            ? layers('古天空', p.skyBranch, { annual: p.sky?.annual, ...p.skySupportLimits }) : '',
          pairedVoids ? layers('地劫', p.robberyBranch, { annual: p.robbery?.annual, ...p.robberyLimits }) : '',
          robberyGuards && chinese(p.robberyBranch) && (robberyPositions.length || taiSuiSha.length || taiSuiSourceFireBell.length)
            ? robberyGuards + '实守地劫所在的' + p.robberyBranch + '宫' : '',
          p.robberyTaiSuiSkyCandidate === true && robberyGuards && chinese(p.annualBranch) && chinese(p.robberyBranch)
            && ['守', '冲'].includes(p.robbery?.annual)
            ? '古天空实守' + p.annualBranch + '宫太岁，太岁' + (p.robbery.annual === '冲' ? '正冲' : '同守')
              + '地劫所在的' + p.robberyBranch + '宫，' + robberyGuards + '实际守该宫' : '',
          robberyNatalShaStars && robberyGuards && chinese(robberyNatalSha.annualBranch) && chinese(robberyNatalSha.robberyBranch)
            && ['守', '冲'].includes(robberyNatalSha.annualRelation)
            && (p.robberyTaiSuiSkyCandidate !== true || robberyNatalShaStars !== '古天空')
            ? '本命' + robberyNatalShaStars + '实守' + robberyNatalSha.annualBranch + '宫太岁，太岁' + (robberyNatalSha.annualRelation === '冲' ? '正冲' : '同守')
              + '地劫所在的' + robberyNatalSha.robberyBranch + '宫，' + robberyGuards + '实际守地劫宫' : '',
          p.voidsBothActualLimitsGuardCandidate === true && chinese(p.robberyBranch)
            ? '古天空与地劫同在' + p.robberyBranch + '宫，复算大限、小限均实守'
            : p.sharedPalace === true ? '古天空与地劫同宫，实际一限守该宫' : '',
          maoYouVoids ? '复算紫微在' + maoYouVoids.ziweiBranch + '宫，与'
            + (maoYouVoids.ziweiBranch === maoYouVoids.skyBranch ? '古天空' : '地劫') + '同守，另一空曜三合，实际大限在'
            + maoYouVoids.decadalBranch + '宫，小限在' + maoYouVoids.minorBranch + '宫，分守空劫' : '',
          p.splitLimits === true ? '古天空与地劫分宫，大小限各守一颗' : '',
          ...voidAspects.filter(row => scopes[row.guardScope] && scopes[row.otherScope] && chinese(row.guardStar) && chinese(row.guardBranch)
            && chinese(row.otherStar) && chinese(row.otherBranch) && ['冲', '三合'].includes(row.otherRelation)
            && ['冲', '三合'].includes(p.voidPairRelation)).map(row => scopes[row.guardScope] + '实守' + row.guardBranch + '宫的' + row.guardStar
            + '，' + row.otherBranch + '宫的' + row.otherStar + '与该宫为' + p.voidPairRelation + '，' + scopes[row.otherScope] + '与' + row.otherStar + '为' + row.otherRelation),
          pairedVoids && positions(p.pairedSha, 'skyRelation') ? '古天空宫的已核羊陀与归档火铃见位为' + positions(p.pairedSha, 'skyRelation') : '',
          (p.splitLimits === true || voidAspects.length) && positions(p.pairedSha, 'robberyRelation') ? '地劫宫的已核羊陀与归档火铃见位为' + positions(p.pairedSha, 'robberyRelation') : '',
          taiSuiSha.length && chinese(p.annualBranch) && ['守', '冲'].includes(p.robbery?.annual)
            ? '太岁宫在' + p.annualBranch + '，实守有' + taiSuiSha.join('、') + '，与实际地劫限宫为' + p.robbery.annual : '',
          taiSuiSourceFireBell.length && chinese(p.annualBranch) && ['守', '冲'].includes(p.robbery?.annual)
            ? '太岁' + p.annualBranch + '宫实守' + taiSuiSourceFireBell.join('、') + '，与地劫实际守限为' + p.robbery.annual : '',
          robberyPositions.length ? '地劫宫的流年羊陀和官府分层候选为' + positions(robberyPositions) : '',
          skyLocalSupport && p.skyAllThreeAtSeat === true && p.skySupportLimits?.minor === '守' ? '太岁、大小限同守古天空宫' : '',
          skyLocalSupport && principals.length ? '古天空宫已核正曜有' + principals.join('、') : '',
          skyCoSeat && chinese(skyCoSeat.branch) ? list(skyCoSeat.assistants).filter(chinese).join('、')
            + '与正曜' + list(skyCoSeat.principals).filter(chinese).join('、') + '实守古天空所在的' + skyCoSeat.branch + '宫' : '',
          skyNoble && chinese(skyNoble.branch) && chinese(skyNoble.noble) ? skyNoble.noble + '一曜与正曜'
            + list(skyNoble.principals).filter(chinese).join('、') + '实守古天空所在的' + skyNoble.branch + '宫' : '',
          skyMingAuxiliary && chinese(skyMingAuxiliary.branch) && chinese(skyMingAuxiliary.noble)
            ? '依明刊十八正曜，' + list(skyMingAuxiliary.principals).filter(chinese).join('、') + '与'
              + skyMingAuxiliary.noble + '一曜实守古天空所在的' + skyMingAuxiliary.branch + '宫' : '',
          p.skySupportCandidate === true ? positions(p.independentSupport) : '',
          p.skyLuSupportCandidate === true ? '禄存与实守古天空的正曜有照，'
            + positions(list(p.lucunSupport).filter(row => ['冲', '三合'].includes(row.relation))) : '',
          ...partnerSky.filter(row => scopes[row.supportScope] && chinese(row.supportBranch) && ['冲', '三合'].includes(row.relation)).map(row =>
            scopes[row.supportScope] + '在' + row.supportBranch + '宫，与古天空宫为' + row.relation + '，实守正曜'
            + list(row.principals).filter(chinese).join('、') + '，同宫见' + list(row.support).filter(chinese).join('、')),
          '四飞官府、本命博士官府和流年羊陀各有取法，原文官符所指、空劫共临及扶助取义仍待核',
        ]);
      }
      case 'quanshu_kongjie_condition': return p.profile !== 'quanshu-kongjie-hour-four-flying-v1' ? '' : sentences([
        '本条独立核《全书》的空劫与四飞星几何位置',
        chinese(p.birthHour) ? '出生时支为' + p.birthHour : '',
        chinese(p.skyBranch) ? '亥起子时逆数所得古天空在' + p.skyBranch + '宫，已与归档唯一地空位置核验一致' : '',
        chinese(p.robberyBranch) ? '亥起子时顺数所得地劫在' + p.robberyBranch + '宫，已与归档唯一地劫位置核验一致' : '',
        list(p.modernSkyBranches).filter(chinese).length ? '归档另名天空的星曜在' + p.modernSkyBranches.filter(chinese).join('、') + '宫，不按同名直接替换古天空' : '',
        typeof p.skyRobberyTogether === 'boolean' ? '古天空与地劫实际' + (p.skyRobberyTogether ? '同宫' : '分宫') + '，不据此认定原文必须二星共临' : '',
        chinese(p.branch) ? '当前层命宫在' + p.branch + '宫' : '',
        list(p.localSourceVoids).filter(chinese).length ? '按来源重算与本层命宫同宫的是' + p.localSourceVoids.filter(chinese).join('、')
          : '本层命宫没有与来源重算的古天空或地劫同宫',
        list(p.archivedMajorStarNames).filter(chinese).length ? '归档本宫原有主星为' + p.archivedMajorStarNames.filter(chinese).join('、') + '；这只证明主星位置，不等于正曜加吉已成立' : '归档本宫未列主星，不据此推断三方没有吉援',
        number(p.lunarYear) !== undefined && chinese(p.yearBranch) ? '本段绑定农历' + p.lunarYear + '年，太岁地支为' + p.yearBranch : '',
        ...[['annualAtPalace', '同宫'], ['annualOpposite', '对宫'], ['annualTriad', '三合宫']].map(([key, label]) =>
          list(p[key]).filter(chinese).length ? '按原文独立重算的四飞星在本层命宫' + label + '为' + p[key].filter(chinese).join('、') : ''),
        '这里的四飞星保留原文官府之名，不直接认作其他段落的官符或博士官府；太岁煞集合、救应及相遇范围仍待核，不将本条几何条件当作完整资料命中',
      ]);
      case 'quanshu_tianxing_condition': return p.profile !== 'quanshu-tianxing-month-four-seats-v1' ? '' : sentences([
        '本条独立核《全书》天刑二限条件',
        number(p.birthMonth) !== undefined && chinese(p.tianxingBranch)
          ? '按农历生月' + p.birthMonth + '月从酉顺数，重算并核验本命天刑唯一位于' + p.tianxingBranch + '宫' : '',
        chinese(p.branch) ? '当前限命宫在' + p.branch + '宫' : '',
        typeof p.inLimit === 'boolean' ? (p.inLimit ? '本限命宫确与本命天刑同宫' : '本限命宫不与本命天刑同宫，不能作本条二限相逢') : '',
        p.templeListed === true ? '按同篇歌诀寅、卯、酉、戌的入庙支位解释，本命天刑符合入庙例外，必须保留入庙则吉，不能只引用负面断句'
          : p.templeListed === false ? '本命天刑不在同篇歌诀列出的寅、卯、酉、戌四个入庙支位；未列不等于落陷，不能据单星断定负面事件'
            : '入庙例外尚未核实，不能略过',
        '本事实没有认定昌曲吉星凑合、文星成就或天哭同到；不能据入庙位置声称这些增强或加重分支已成立',
        '限层沿用已声明的产品年界和虚岁口径，不将原文刑罚、出家等历史措辞写成现实事件保证',
      ]);
      case 'quanshu_timed_limit_condition': {
        if (p.profile !== 'quanshu-north-south-limit-binding-v1') return '';
        if (p.star === '铃星') {
          const editions = { archive: '归档移时', jielan: '《捷览》', nanyang: '明刊' };
          const activeLimits = list(p.bellLimitWindows).flatMap(row => row.activeInSourceHalf === true
            && editions[row.edition] && chinese(row.branch)
            ? list(row.guardScopes).filter(scope => ['decadal', 'minor'].includes(scope)).map(scope =>
              editions[row.edition] + '铃星实守' + row.branch + '宫' + scopes[scope]
              + '，处于南斗下' + (scope === 'decadal' ? '五年' : '半年'))
            : []);
          const support = list(p.bellPositiveSupportWitnesses).flatMap(row => {
            if (!editions[row.edition] || !chinese(row.branch)) return [];
            const name = editions[row.edition] + row.branch + '宫铃星';
            const temple = list(row.templeNamedSupport).filter(star => [star?.star, star?.branch, star?.relation].every(chinese));
            return [
              row.tanlang?.relation === '守' ? name + '与本命贪狼同守实际限宫' : '',
              temple.length ? name + '入庙，已核助曜有'
                + temple.map(star => star.star + '在' + star.branch + '宫' + star.relation).join('、') : '',
            ];
          });
          const namedAid = p.bellMingDoubleGuardAidWitness;
          const aidStars = list(namedAid?.assists).filter(star => [star?.star, star?.branch, star?.relation].every(chinese));
          const literaryAid = p.bellMingDoubleGuardLiteraryAidWitness;
          const literaryStars = list(literaryAid?.assists).filter(star => [star?.star, star?.branch, star?.relation].every(chinese));
          return sentences([...activeLimits, ...support, chinese(namedAid?.branch) && aidStars.length
            ? '明刊铃星与复算大限、小限同在' + namedAid.branch + '宫，已核的同篇助曜有'
              + aidStars.map(star => star.star + '在' + star.branch + '宫' + star.relation).join('、') : '',
          chinese(literaryAid?.branch) && literaryStars.length
            ? '明刊铃星与复算大限、小限同在' + literaryAid.branch + '宫，同书〈岁君〉的文曜接应有'
              + literaryStars.map(star => star.star + '在' + star.branch + '宫' + star.relation).join('、') : '']);
        }
        if (![p.activeInSourceHalf, p.tianjiShaAspectCandidate, p.tianjiPlainOppositionCandidate, p.tianjiDualTrineLimitCandidate].includes(true)
          || !chinese(p.star) || !chinese(p.branch) || !['北斗', '南斗'].includes(p.starGroup)) return '';
        const guard = p.activeInSourceHalf === true ? list(p.guardScopes).filter(scope => ['decadal', 'minor'].includes(scope)).map(scope =>
          '《全书》列' + p.star + '为' + p.starGroup + '，实守' + scopes[scope] + p.branch + '宫且处在本星适用的'
          + (p.starGroup === '北斗' ? '上' : '下') + (scope === 'decadal' ? '五年' : '半年') + '，原分支与该限同段') : [];
        if (p.wuNatalQuanAtActiveLimitCandidate === true) guard.push('庚生年本命武曲化权，实守已核的北斗半限');
        const wuLiterary = p.wuNatalQuanMingChangQuAtActiveLimitCandidate === true ? p.wuNatalQuanMingChangQuWitness : undefined;
        if (chinese(wuLiterary?.branch)) guard.push('庚生年庙地化权武曲与文昌、文曲实守' + wuLiterary.branch + '宫');
        if (p.tianliangPlainMingClearDoubleGuardCandidate === true) {
          guard.push('复算大小限同守' + p.branch + '宫庙地天梁，羊陀及明刊火铃均未守、冲或三合此宫');
        } else if (p.tianliangPlainMingClearGuardCandidate === true) {
          guard.push('天梁实守已核南斗半限，羊陀及明刊火铃均未守、冲或三合此宫');
        } else if (p.tianliangPlainGuardCandidate === true) guard.push('本段也符合明刊天梁入限诀的独立守限条件');
        if (p.wenquBrightMingDoubleGuardCandidate === true) {
          guard.push('复算大小限在北斗上段同守' + p.branch + '宫旺地文曲，左右与天同的加强另核');
        } else if (p.wenquPlainDoubleGuardCandidate === true) {
          guard.push('复算大小限同守' + p.branch + '宫庙地文曲，左右与天同的加强另核');
        } else if (p.wenquPlainGuardCandidate === true) guard.push('本段符合明刊文曲入限诀的独立守限条件，左右与天同的加强另核');
        const wenquTrine = p.wenquMingTongTrineDoubleGuardCandidate === true ? p.wenquMingTongTrineDoubleGuardWitness : undefined;
        if (wenquTrine && [wenquTrine.wenquBranch, wenquTrine.tongBranch].every(chinese)) {
          guard.push('大小限实守' + wenquTrine.wenquBranch + '宫文曲，左辅、右弼与天同同在' + wenquTrine.tongBranch + '宫三合');
        }
        const tianliangTrine = p.tianliangMingTempleTrineDoubleGuardCandidate === true
          ? p.tianliangMingTempleTrineDoubleGuardWitness : undefined;
        if (tianliangTrine && [tianliangTrine.tianliangBranch, tianliangTrine.assistantBranch].every(chinese)) {
          guard.push('大小限实守' + tianliangTrine.tianliangBranch + '宫庙地天梁，左辅、右弼、文昌、文曲均在'
            + tianliangTrine.assistantBranch + '宫三合');
        }
        const markPlacements = witness => list(witness?.assistants).filter(row => [row?.star, row?.branch, row?.relation].every(chinese))
          .map(row => row.star + '在' + row.branch + '宫' + row.relation).join('、');
        const wuOpposed = p.wuTempleMingChangFuBiOpposedDoubleGuardCandidate === true
          ? p.wuTempleMingChangFuBiOpposedDoubleGuardWitness : undefined;
        if ([wuOpposed?.wuBranch, wuOpposed?.chang?.branch].every(chinese)) {
          guard.push('大小限同守' + wuOpposed.wuBranch + '宫庙地武曲，文昌、左辅、右弼实同在' + wuOpposed.chang.branch + '宫正对');
        }
        const poDistinct = p.poTempleMingChangTwoNoblesDistinctTrineDoubleGuardCandidate === true
          ? p.poTempleMingChangTwoNoblesDistinctTrineDoubleGuardWitness : undefined;
        if ([poDistinct?.poBranch, poDistinct?.chang?.branch].every(chinese)) {
          const nobles = list(poDistinct.nobles).filter(row => [row?.star, row?.branch].every(chinese));
          guard.push('大小限同守' + poDistinct.poBranch + '宫庙地破军，文昌在' + poDistinct.chang.branch + '宫，'
            + nobles.map(row => row.star + '在' + row.branch + '宫').join('、') + '。昌魁钺分在同一三合组，原文取义待核');
        }
        const wenquSeatedTong = p.wenquMingSeatedTongTrineAssistantsDoubleGuardCandidate === true
          ? p.wenquMingSeatedTongTrineAssistantsDoubleGuardWitness : undefined;
        const wenquAssistants = markPlacements(wenquSeatedTong);
        if (chinese(wenquSeatedTong?.wenquBranch) && wenquAssistants) {
          guard.push('大小限同守' + wenquSeatedTong.wenquBranch + '宫文曲和天同，' + wenquAssistants);
        }
        const wenquDistributed = p.wenquMingDistributedDoubleGuardCandidate === true
          ? p.wenquMingDistributedDoubleGuardWitness : undefined;
        const distributedWenquAssistants = markPlacements(wenquDistributed);
        if (chinese(wenquDistributed?.wenquBranch) && chinese(wenquDistributed.tongBranch) && distributedWenquAssistants) {
          guard.push('大小限同守' + wenquDistributed.wenquBranch + '宫文曲，左辅、右弼与天同在同一组三合宫。天同在'
            + wenquDistributed.tongBranch + '宫，' + distributedWenquAssistants);
        }
        const tianliangDistributed = p.tianliangMingTempleDistributedDoubleGuardCandidate === true
          ? p.tianliangMingTempleDistributedDoubleGuardWitness : undefined;
        const tianliangAssistants = markPlacements(tianliangDistributed);
        if (chinese(tianliangDistributed?.tianliangBranch) && tianliangAssistants) {
          guard.push('大小限同守' + tianliangDistributed.tianliangBranch + '宫庙地天梁，' + tianliangAssistants
            + '。明刊羊、陀、火、铃均复算未到会');
        }
        const jielanSplit = p.wenquJielanChangQuSplitActiveWitness;
        if (jielanSplit && [jielanSplit.wenchang, jielanSplit.wenqu]
          .every(row => chinese(row.branch) && ['decadal', 'minor'].includes(row.scope))) {
          const name = scope => scope === 'decadal' ? '大限' : '小限';
          guard.push(name(jielanSplit.wenchang.scope) + '实守' + jielanSplit.wenchang.branch + '宫文昌，'
            + name(jielanSplit.wenqu.scope) + '实守' + jielanSplit.wenqu.branch + '宫文曲，南北斗各取适用半段，两段实际相交');
        }
        const changQu = p.wenquJielanChangQuGuardCandidate === true ? p.wenquJielanChangQuGuardWitness : undefined;
        if (changQu && [changQu.wenchangBranch, changQu.wenquBranch, changQu.tongBranch, changQu.tongRelation].every(chinese)
          && ['decadal', 'minor'].includes(changQu.wenchangScope)) {
          const quScope = changQu.wenchangScope === 'decadal' ? 'minor' : 'decadal';
          const assistants = list(changQu.assistants).filter(row => [row.star, row.branch, row.relation].every(chinese));
          guard.push('按《捷览》昌曲分守，文昌实守' + scopes[changQu.wenchangScope] + changQu.wenchangBranch + '宫，文曲实守'
            + scopes[quScope] + changQu.wenquBranch + '宫，天同在' + changQu.tongBranch + '宫与文曲为' + changQu.tongRelation
            + '，' + assistants.map(row => row.star + '在' + row.branch + '宫，与天同为' + row.relation).join('、'));
        }
        const fallenPo = p.poFallenMingBladeFireBellWitness;
        if (p.poFallenMingBladeFireBellCandidate === true && chinese(fallenPo?.branch) && fallenPo.grade === '陷') {
          const stars = list(fallenPo.coGuards).filter(row => row.branch === fallenPo.branch).map(row => chinese(row.star)).filter(Boolean);
          if (stars.length) guard.push('破军在' + fallenPo.branch + '宫落陷，和' + stars.join('、') + '同守此限，属明刊另列的反向条件');
        }
        if (p.poTempleMingNamedShaClearCandidate === true) {
          guard.push('庙地破军实守此限，已核羊陀与明刊火铃均未到会');
          if (p.poTempleMingJoinedSupportCandidate === true && chinese(p.poChang?.branch) && ['守', '冲', '三合'].includes(p.poChang.relation)) {
            guard.push('文昌与魁钺组内一曜实同宫并到会此限，两曜在' + p.poChang.branch + '宫，与限宫为' + p.poChang.relation);
          }
        }
        for (const row of list(p.poTempleMingHazards)) {
          if (chinese(row?.star) && chinese(row.branch) && ['守', '冲', '三合'].includes(row.relation)) {
            guard.push('庙地破军所在限宫按明刊安星核得' + row.star + '在' + row.branch + '宫，与限宫为' + row.relation);
          }
        }
        if (p.tianjiMingNatalLucunKeQuanDoubleGuardCandidate === true) {
          guard.push('科权与本命禄存在同一真双限到会，化禄受曜另查');
        }
        if (p.tianjiNatalShaOpposedCandidate === true) {
          guard.push('本命天机从正对宫照实际限位，同一限位另见羊陀和巨门守照');
        }
        if (p.tianjiNatalSanHuaCandidate === true || p.tianjiNatalLucunKeQuanCandidate === true) {
          for (const row of list(p.tianjiSupportWitnesses)) {
            const placements = list(row.stars).filter(star => [star.star, star.kind, star.branch, star.relation].every(chinese))
              .map(star => star.star + '化' + star.kind + '在' + star.branch + '宫' + star.relation);
            if (chinese(row.lucun?.branch) && chinese(row.lucun.relation)) {
              placements.push('本命禄存在' + row.lucun.branch + '宫' + row.lucun.relation);
            }
            if (scopes[row.scope] && chinese(row.stem) && placements.length) {
              const support = row.lucun ? '科权与本命禄存' : '科权禄';
              guard.push('同一' + scopes[row.scope] + '按本生年干' + row.stem + '核天机值限的' + support + '，' + placements.join('、'));
            }
          }
        }
        if (p.tianjiShaAspectCandidate === true) {
          for (const row of list(p.tianjiAspectWitnesses)) {
            const placements = [row.tianji, row.jumen, ...list(row.sha)]
              .filter(star => [star?.star, star?.branch, star?.relation].every(chinese))
              .map(star => star.star + '在' + star.branch + '宫，与限宫为' + star.relation);
            if (scopes[row.scope] && chinese(row.branch) && placements.length) {
              guard.push('另首天机照限的羊陀巨暗条件同段成立，' + scopes[row.scope] + '在' + row.branch + '宫，' + placements.join('、'));
            }
          }
        }
        for (const row of list(p.tianjiPlainOppositionWitnesses)) {
          if (['decadal', 'minor'].includes(row.scope) && [row.branch, row.tianjiBranch].every(chinese)) {
            guard.push('天机在' + row.tianjiBranch + '宫，实冲' + scopes[row.scope] + row.branch + '宫，另核原书照限句');
          }
        }
        const dualTrine = p.tianjiDualTrineLimitCandidate === true ? p.tianjiDualTrineLimitWitness : undefined;
        if (dualTrine && [dualTrine.tianjiBranch, dualTrine.decadalBranch, dualTrine.minorBranch].every(chinese)) {
          guard.push('天机在' + dualTrine.tianjiBranch + '宫，分别三合实际大限' + dualTrine.decadalBranch
            + '宫和小限' + dualTrine.minorBranch + '宫，留作原书照限的同段证据');
        }
        if (p.qishaJielanMinorFlowShaCandidate === true) {
          guard.push('按《捷览》的当年流杀方组，实守七杀的' + p.branch + '宫小限也在本年组内'
            + (list(p.jielanShaBranches).length ? '，该组为' + p.jielanShaBranches.join('、') : ''));
        }
        const tanlang = p.tanlangMingNatalYangJiAspectCandidate === true ? p.tanlangMingNatalYangJiAspectWitness : undefined;
        if (tanlang && [tanlang.tanlangBranch, tanlang.birthStem, tanlang.yangBranch, tanlang.tabooStar, tanlang.relation].every(chinese)) {
          guard.push('按明刊羊化刑，生年干' + tanlang.birthStem + '安擎羊与化忌的' + tanlang.tabooStar + '同守' + tanlang.yangBranch
            + '宫，与实守限的' + tanlang.tanlangBranch + '宫陷地贪狼为' + tanlang.relation);
        }
        const tanlangSha = p.tanlangMingNatalYangTuoJiCandidate === true ? p.tanlangMingNatalYangTuoJiWitness : undefined;
        if (tanlangSha && [tanlangSha.branch, tanlangSha.birthStem].every(chinese)) {
          const contacts = [...list(tanlangSha.yangTuo), { ...tanlangSha.taboo, star: '化忌的' + tanlangSha.taboo?.star }]
            .filter(row => [row.star, row.branch, row.relation].every(chinese));
          if (contacts.length === 3) guard.push('实际限宫在' + tanlangSha.branch + '，陷地贪狼同时见生年羊陀和化忌。生年干为'
            + tanlangSha.birthStem + '，' + contacts.map(row => row.star + '在' + row.branch + '宫' + row.relation + '限宫').join('、'));
        }
        const aliases = p.tanlangMingXingJiAliasesCandidate === true ? p.tanlangMingXingJiAliasesWitness : undefined;
        if (aliases && chinese(aliases.branch)) {
          const relation = { 守: '同守', 冲: '正冲', 三合: '三合' };
          const contacts = list(aliases.yangTuo).filter(row => [row.star, row.branch].every(chinese) && relation[row.relation]);
          if (contacts.length === 2) guard.push('按明刊羊化刑、陀化忌，' + contacts.map(row =>
            row.star + row.branch + '宫' + relation[row.relation]).join('、') + '贪狼所守' + aliases.branch + '宫');
        }
        const blade = p.lianzhenNatalSelfJiAnnualBladeCandidate === true ? p.lianzhenNatalSelfJiAnnualBladeWitness : undefined;
        if (blade && [blade.birthStem, blade.branch, blade.annualStem, blade.annualBladeBranch].every(chinese)) {
          guard.push('生年干' + blade.birthStem + '使廉贞化忌，天刑实守同一' + blade.branch + '宫，流年干'
            + blade.annualStem + '安擎羊在' + blade.annualBladeBranch + '宫实冲');
        }
        const doubleGuard = p.lianzhenNatalDoubleGuardActiveCandidate === true ? p.lianzhenNatalDoubleGuardWitness : undefined;
        if (p.star === '廉贞' && doubleGuard?.branch === p.branch && chinese(doubleGuard.tabooStar)
          && doubleGuard.tianxingBranch === p.branch && doubleGuard.bladeBranch === p.branch && chinese(doubleGuard.birthStem)) {
          guard.push('大限和小限均实守' + p.branch + '宫并处廉贞适用的北斗时段。生年干'
            + doubleGuard.birthStem + '使' + doubleGuard.tabooStar + '化忌，与天刑和本命擎羊同宫');
        }
        const annualGuard = p.lianzhenYearSelfJiBladeDoubleGuardCandidate === true ? p.lianzhenYearSelfJiBladeDoubleGuardWitness : undefined;
        if (p.star === '廉贞' && annualGuard?.branch === p.branch && annualGuard.tabooStar === p.star
          && [annualGuard.tabooBranch, annualGuard.tianxingBranch, annualGuard.bladeBranch].every(branch => branch === p.branch)
          && chinese(annualGuard.annualStem)) {
          guard.push('大限和小限均实守' + p.branch + '宫并处廉贞适用的北斗时段。流年干'
            + annualGuard.annualStem + '使廉贞化忌，流年擎羊和本命天刑也在该宫');
        }
        const wenquAnnualGuard = p.lianzhenYearWenquJiBladeDoubleGuardCandidate === true
          ? p.lianzhenYearWenquJiBladeDoubleGuardWitness : undefined;
        if (p.star === '廉贞' && wenquAnnualGuard?.branch === p.branch && wenquAnnualGuard.tabooStar === '文曲'
          && [wenquAnnualGuard.tabooBranch, wenquAnnualGuard.tianxingBranch, wenquAnnualGuard.bladeBranch].every(branch => branch === p.branch)) {
          guard.push('大小限均实守' + p.branch + '宫廉贞并处北斗时段。流年己使文曲化忌，流年擎羊与本命天刑也实守此宫');
        }
        const wenquOpposed = p.lianzhenYearWenquJiOpposedDoubleGuardCandidate === true
          ? p.lianzhenYearWenquJiOpposedDoubleGuardWitness : undefined;
        if (p.star === '廉贞' && wenquOpposed?.branch === '未' && wenquOpposed.tabooBranch === '丑' && wenquOpposed.tabooRelation === '冲') {
          guard.push('大小限、廉贞、天刑与流羊实守未宫，己年文曲化忌由丑宫正冲');
        }
        const tongVoids = p.tongFallenVoidsOpposedAtTaiSuiDoubleGuardCandidate === true
          ? p.tongFallenVoidsOpposedAtTaiSuiDoubleGuardWitness : undefined;
        if (p.star === '天同' && tongVoids?.branch === p.branch) {
          const opposing = list(tongVoids.voids).filter(row => chinese(row.star) && chinese(row.branch) && row.relation === '冲');
          if (opposing.length) guard.push('太岁和复算大小限实守' + p.branch + '宫，'
            + opposing.map(row => row.star + '由' + row.branch + '宫正冲').join('、') + '。原法空劫正冲与实限同段');
        }
        const tongJi = p.tongFallenNatalJiOpposedAtTaiSuiDoubleGuardCandidate === true
          ? p.tongFallenNatalJiOpposedAtTaiSuiDoubleGuardWitness : undefined;
        if (p.star === '天同' && tongJi?.layer === 'natal' && tongJi.relation === '冲') {
          guard.push('太岁与两实际限同守午宫。出生年干' + tongJi.stem + '所化的' + tongJi.star + '忌实从子宫正冲');
        }
        const weakLife = p.wenquChapterFallenWeakLifeCandidate === true ? p.wenquChapterFallenWeakLifeWitness : undefined;
        if (weakLife && chinese(weakLife.lifeBranch)) {
          const lifeStars = list(weakLife.lifeStars).filter(row => chinese(row.star) && row.grade === '陷');
          if (lifeStars.length) guard.push('本命命宫在' + weakLife.lifeBranch + '，按《全书》星表，实守正曜'
            + lifeStars.map(row => row.star).join('、') + '均列陷地。命宫整体强弱及其他合参仍待核');
        }
        const luConflict = p.qishaImperialLuBodyLifeConflictCandidate === true ? p.qishaImperialLuBodyLifeConflictWitness : undefined;
        if (luConflict && chinese(luConflict.branch)) {
          const contacts = list(luConflict.limits).flatMap(row => [['大限', row.decadal], ['小限', row.minor]])
            .filter(([, row]) => chinese(row?.branch) && chinese(row.target) && ['冲', '三合'].includes(row.relation))
            .map(([label, row]) => label + row.branch + '宫与' + row.target + '为' + row.relation);
          guard.push('七杀、紫微和本命禄存同守' + luConflict.branch + '宫，' + contacts.join('、')
            + '。《捷览》另列身命双限会冲时的禄力制约，解救作用仍待核');
        }
        const jielanDirections = p.tianliangJielanFireBellOpposedTrineCandidate === true
          ? p.tianliangJielanFireBellWitness : p.wenquJielanYinFallenCandidate === true ? p.wenquJielanYinFallenWitness : [];
        if (p.wenquJielanYinFallenCandidate === true) guard.push('《捷览》列文曲在寅宫为陷');
        for (const row of list(jielanDirections)) {
          if (chinese(row.star) && chinese(row.branch) && ['冲', '三合'].includes(row.relation)) {
            guard.push('按《捷览》，' + row.star + '在' + row.branch + '宫，与' + p.star + '实守的限宫为' + row.relation);
          }
        }
        return sentences(guard);
      }
      case 'quanshu_limit_star_timing': {
        if (p.profile !== 'quanshu-north-south-limit-halves-v1') return '';
        const verified = list(p.verifiedStarTimings);
        const qisha = verified.find(star => star.star === '七杀');
        const pojun = verified.find(star => star.star === '破军');
        const tianji = verified.find(star => star.star === '天机');
        const evidence = [qisha, pojun, tianji].flatMap(star => {
          if (star?.candidate !== true || !chinese(star.star) || !chinese(star.group) || !chinese(star.branch)) return [];
          return list(star.activeScopes).flatMap(scope => {
            const layer = list(p.halves).find(row => row.scope === scope);
            if (!layer?.midpoint || !['decadal', 'minor'].includes(scope) || !['first', 'second'].includes(layer.half)) return [];
            const segment = (layer.half === 'first' ? '上' : '下') + (scope === 'decadal' ? '五年' : '半年');
            return ['《全书》列' + star.star + '为' + star.group + '，实守' + scopes[scope] + star.branch + '宫，此段落在' + segment
              + '，该限分界为' + at(layer.midpoint)];
          });
        });
        const tianfu = p.qishaTianfuActiveWitness;
        if (tianfu && chinese(tianfu.qishaBranch) && chinese(tianfu.tianfuBranch)) {
          evidence.push('七杀实际守限在' + tianfu.qishaBranch + '宫，天府在' + tianfu.tianfuBranch + '宫，正对七杀守限宫');
        }
        const unverified = list(p.unverifiedTimingStars).filter(chinese);
        if (unverified.length) evidence.push('未能复核守限用星的位置：' + unverified.join('、'));
        if (p.sourceDecadalVerified === false) evidence.push('归档大限的宫位或起岁与按五局顺逆复算的结果不一致，保留未知');
        if (p.sourceMinorVerified === false) evidence.push('归档小限的宫位与按生年、虚岁复算的结果不一致，保留未知');
        return sentences(evidence);
      }
      case 'quanshu_limit_phase': return sentences([
        chinese(p.branch) ? '当前大限命宫在' + p.branch + '宫' : '',
        number(p.startAge) !== undefined && number(p.endAge) !== undefined ? '本限按已声明的虚岁口径覆盖' + p.startAge + '至' + p.endAge + '岁' : '',
        number(p.nominalAge) !== undefined ? '本段虚岁为' + p.nominalAge : '',
        p.stageStart && p.stageEnd ? '该完整限段从' + at(p.stageStart) + '至' + at(p.stageEnd) + '，截止时刻不计入' : '',
        '不因查询窗口结束就视为出限；原文未给将出的提前量，不能任设一个月或一年',
      ]);
      case 'ling_time_segment': return p.profile !== 'ling-doujun-jie-month-civil-day-v1' ? '' : sentences([
        '本条单独采用令东来计算口径', chinese(p.lifeBranch) ? '本层命宫位于' + p.lifeBranch + '宫' : '',
        chinese(p.sourceStem) ? '本层以' + p.sourceStem + '干发四化' : '',
        number(p.lunarMonth) !== undefined ? '农历' + (p.lunarMonthIsLeap === true ? '闰' + p.lunarMonth : '第' + p.lunarMonth) + '月' : '',
        number(p.lunarDay) !== undefined ? '农历初一起顺数至第' + p.lunarDay + '日' : '',
        '宫序按斗君和农历月日推算，月干在交节时切换，日干采用北京日历午夜分界',
        chinese(p.monthJie?.name) && chinese(p.monthJie.beforeStem) && chinese(p.sourceStem) && chinese(p.lifeBranch)
          ? p.monthJie.name + '于' + at(p.monthJie.at) + '交节，流月命宫仍在' + p.lifeBranch + '宫，月干由' + p.monthJie.beforeStem + '换为' + p.sourceStem : '',
        ...list(p.monthJie?.beforeTransformations).flatMap(row => chinese(row?.star) && ['禄', '权', '科', '忌'].includes(row.kind) && chinese(row.branch)
          ? ['交节前' + row.star + '化' + row.kind + '在' + row.branch + '宫'] : []),
        p.sourceStem === '庚' ? '庚干同时核天同化忌与天相化忌，不套用默认四化输出' : '',
      ]);
      case 'ling_palace_condition': {
        if (p.profile !== 'ling-doujun-jie-month-civil-day-v1') return '';
        const lu = p.dailyPeachLuCandidate === true ? p.dailyPeachLu : undefined;
        const companions = list(lu?.companions).filter(star => chinese(star?.star) && chinese(star.branch)
          && ['同宫', '三合', '对宫'].includes(star.relation));
        const onlyLiteraryPair = p.ready === false && p.yearLifeLiteraryPairVerified === true;
        const onlyExamStructure = p.ready === false && p.yearLifeExamStructureVerified === true;
        const onlyExamNobles = p.ready === false && p.yearLifeExamKeWithNoblesVerified === true;
        const onlyDailyStudy = p.ready === false && p.dailyLearningVoidPairAtLife === true;
        const limitedEvidence = onlyLiteraryPair || onlyExamStructure || onlyExamNobles || onlyDailyStudy;
        const examKe = p.yearLifeExamKeOpposition;
        const ji = p.dailyTravelEvidence?.tianjiJi, liangMa = p.dailyTravelEvidence?.liangMa;
        return sentences([
          '本条单独采用令东来计算口径', chinese(p.flowName) && chinese(p.natalName) ? '本期' + p.flowName + '落在本命' + p.natalName : '',
          chinese(p.branch) ? '地支为' + p.branch : '',
          !limitedEvidence && list(p.localStarNames).filter(chinese).length ? '本宫原有星曜：' + p.localStarNames.filter(chinese).join('、') : '',
          onlyLiteraryPair ? '年命四正内的昌曲与流年科权已单独核位，其余盘层仍待核' :
            onlyExamStructure ? '年命四正的昌曲、三台八座与对宫年科已单独核位，其余盘层仍待核' :
              onlyExamNobles ? '年命四正的昌曲魁钺与年科已单独核位，其余盘层仍待核' :
                onlyDailyStudy ? '日命空劫已单独核位，其余盘层仍待核' :
            list(p.localTransformations).map(value => text(value).split(':')).map(([scope, kind, star]) => scopes[scope] && chinese(kind) && chinese(star)
              ? scopes[scope] + '发化的' + star + '化' + kind : '').filter(Boolean).join('、'),
          !limitedEvidence && list(p.surroundingStarNames).filter(chinese).length ? '本宫三方四正星曜：' + p.surroundingStarNames.filter(chinese).join('、') : '',
          p.taiyinWenchangInLifeArea === true && chinese(p.taiyinBranch) && chinese(p.wenchangBranch)
            && ['庙', '旺', '陷'].includes(p.taiyinBrightness)
            ? '大限命宫三方四正内，太阴在' + p.taiyinBranch + '宫，依作者原表为' + p.taiyinBrightness
              + '，文昌在' + p.wenchangBranch + '宫'
              + (p.taiyinBirthDaylight === 'day' ? '，出生时辰按作者口径属昼'
                : p.taiyinBirthDaylight === 'night' ? '，出生时辰按作者口径属夜' : '') + '。全局强弱仍须合看' : '',
          ...list(p.yearLifeAreaWritingStars).filter(row => ['文昌', '文曲'].includes(row?.star) && chinese(row.branch))
            .map(row => '流年命宫三方四正内，' + row.star + '在' + row.branch + '宫'),
          ...list(p.yearLifeExamStars).filter(row => ['三台', '八座'].includes(row?.star) && chinese(row.branch))
            .map(row => '流年命宫三方四正内，' + row.star + '在' + row.branch + '宫'),
          ...list(p.yearLifeNobles).filter(row => ['天魁', '天钺'].includes(row?.star) && chinese(row.branch))
            .map(row => '按本命年干核位，流年命宫三方四正内' + row.star + '在' + row.branch + '宫'),
          examKe?.sourceScope === 'yearly' && [examKe.star, examKe.branch].every(chinese)
            ? '流年' + examKe.star + '化科落在流年命宫对宫的' + examKe.branch + '位' : '',
          ...list(p.yearLifeAreaLiteraryTransforms).filter(row => scopes[row?.sourceScope] && ['科', '权'].includes(row.kind)
            && [row.star, row.sourceStem, row.branch].every(chinese))
            .map(row => '流年命宫三方四正内有' + scopes[row.sourceScope] + row.sourceStem + '干所发'
              + row.star + '化' + row.kind + '，受化星在' + row.branch + '宫'),
          p.natalHongluanInYearLife === true ? '流年命宫走到本命红鸾所在宫' : '',
          p.natalHongluanProof?.verified === true ? '本命红鸾从卯逆数至出生年支，复算与归档同在' + p.natalHongluanProof.expectedBranch + '宫' : '',
          (p.dailyLearningVoidPairAtLife === true || p.dailyStudySupportedCandidate === true) && chinese(p.branch)
            ? '地空、地劫均实守' + p.branch + '宫的流日命宫'
              + (p.dailyLearningVoidPairAtLife === true ? '，供学习与思考分支审阅' : '') : '',
          ...(p.dailyStudySupportedCandidate === true ? list(p.dailyStudySupport?.support).flatMap(row =>
            chinese(row?.star) && chinese(row.branch) ? ['同一日命三方四正的具名吉星有' + row.branch + '宫' + row.star] : []) : []),
          ...(p.dailyStudySupportedCandidate === true ? list(p.dailyStudySupport?.transformations).flatMap(row =>
            scopes[row?.sourceScope] && ['禄', '权', '科'].includes(row.kind) && [row.star, row.sourceStem, row.branch].every(chinese)
              ? ['同区见' + scopes[row.sourceScope] + row.sourceStem + '干所发' + row.star + '化' + row.kind + '在' + row.branch + '宫'] : []) : []),
          ...list(p.dailyStudySupport?.voidKe).flatMap(row => ['武曲', '紫微'].includes(row?.star) && chinese(row.branch)
            ? [row.branch + '宫的' + row.star + '化科与空劫同宫，单列为来源例外'] : []),
          companions.length && [lu.star, lu.sourceStem, lu.branch].every(chinese)
            ? '流日' + lu.sourceStem + '干使' + lu.star + '化禄，受化星在' + lu.branch + '宫，与'
              + companions.map(star => star.branch + '宫' + (star.star === '沐浴' ? '归档沐浴' : star.star) + '成' + star.relation).join('、') : '',
          ji && [ji.sourceStem, ji.branch].every(chinese) ? '流日' + ji.sourceStem + '干发天机化忌，落命迁轴的' + ji.branch + '宫' : '',
          liangMa && [liangMa.tianliangBranch, liangMa.horseBranch, liangMa.relation].every(chinese)
            ? '命迁轴的' + liangMa.tianliangBranch + '宫天梁与' + liangMa.horseBranch + '宫天马成' + liangMa.relation : '',
        ]);
      }
      case 'ling_transformation_contact': return p.profile !== 'ling-doujun-jie-month-civil-day-v1' ? '' : sentences([
        '本条单独采用令东来四化口径', scopes[p.sourceScope] && chinese(p.sourceStem) ? '发化来源为' + scopes[p.sourceScope] + '的' + p.sourceStem + '干' : '',
        chinese(p.star) && chinese(p.kind) ? p.star + '化' + p.kind : '',
        chinese(p.flowName) && chinese(p.natalName) ? '受化星在本期' + p.flowName + '，对应本命' + p.natalName : '',
        chinese(p.branch) ? '受化星落于' + p.branch + '宫' : '',
        typeof p.inLifeArea === 'boolean' ? (p.inLifeArea ? '属于' : '不属于') + '本期命宫三方四正' : '',
        p.sourceStem === '庚' ? '本口径庚干另核天相化忌，保留与天同化忌并见的条件' : '',
      ]);
      case 'palace_condition': return sentences([
        chinese(p.flowName) && chinese(p.natalName) ? '本期' + p.flowName + '落在本命' + p.natalName : '',
        chinese(p.branch) ? '宫位地支为' + p.branch : '',
        list(p.natalStarNames).filter(chinese).length ? '本命同宫星曜：' + p.natalStarNames.filter(chinese).join('、') : '',
        list(p.movingStarNames).filter(chinese).length ? '本层同宫流曜：' + p.movingStarNames.filter(chinese).join('、') : '',
        list(p.oppositeStarNames).filter(chinese).length ? '对宫星曜：' + p.oppositeStarNames.filter(chinese).join('、') : '',
        list(p.surroundingStarNames).filter(chinese).length ? '三方四正星曜：' + p.surroundingStarNames.filter(chinese).join('、') : '',
        list(p.localFlowTransformations).map(value => text(value).split(':')).map(([kind, star]) => chinese(kind) && chinese(star) ? star + '化' + kind : '').filter(Boolean).join('、'),
        list(p.starBrightness).map(item => chinese(item.name) && chinese(item.brightness) ? item.name + '为' + item.brightness : '').filter(Boolean).join('、'),
        chinese(p.yearlySuiqianStar) ? '流年岁前星为' + p.yearlySuiqianStar : '',
        chinese(p.yearlyJiangqianStar) ? '流年将前星为' + p.yearlyJiangqianStar : '',
      ]);
      case 'palace_mapping': return chinese(p.flowName) && chinese(p.natalName) ? '本期' + p.flowName + '落在本命' + p.natalName : '';
      case 'transformation': return sentences([chinese(p.star), chinese(p.kind) ? '化' + p.kind : '',
        chinese(p.sourcePalaceStem) ? '发化天干为' + p.sourcePalaceStem : '']);
      case 'time_segment': return sentences([chinese(p.stem) && chinese(p.branch) ? '本层命宫干支为' + p.stem + p.branch : '',
        number(p.lunarMonth) !== undefined ? '农历' + (p.leap === true ? '闰' : '') + p.lunarMonth + '月' : '',
        number(p.lunarDay) !== undefined ? '农历日期为第' + p.lunarDay + '日' : '',
        chinese(p.boundary) ? '分界采用' + p.boundary : '']);
      case 'palace_star_structure': return sentences([
        chinese(p.flowName) && chinese(p.natalName) ? '本期' + p.flowName + '落在本命' + p.natalName : '',
        stars(p.stars) ? '本宫星曜：' + stars(p.stars) : '',
        list(p.movingStarIds).filter(chinese).length ? '流曜：' + p.movingStarIds.filter(chinese).join('、') : '',
        list(p.surrounding).map(item => sentences([chinese(item.flowName), chinese(item.natalName) ? '对应本命' + item.natalName : '',
          stars(item.stars) ? '星曜为' + stars(item.stars) : ''])).filter(Boolean).map(value => '三方四正范围内：' + value).join('；'),
        transformations(p.transformations) ? '相关四化：' + transformations(p.transformations) : '',
        chinese(p.transformationStem) ? '本层发化天干为' + p.transformationStem : '',
      ]);
      case 'layer_overlap': return sentences([
        scopes[p.firstScope] && scopes[p.secondScope] ? scopes[p.firstScope] + '与' + scopes[p.secondScope]
          + (p.samePalace === true ? '命宫同宫' : p.opposite === true ? '命宫相对'
            : p.samePalace === false && p.opposite === false ? '命宫既不同宫也不相对' : '的命宫重叠关系尚未确认') : '',
        scopes[p.firstScope] && chinese(p.firstOnSecond) ? scopes[p.firstScope] + '命宫落在另一层' + p.firstOnSecond : '',
        scopes[p.secondScope] && chinese(p.secondOnFirst) ? scopes[p.secondScope] + '命宫落在另一层' + p.secondOnFirst : '',
      ]);
    }
  }
  if (fact.method === 'western') {
    switch (fact.type) {
      case 'leo_solar_natal_contact': return p.profile !== 'leo-transit-natal-witness-1928-v1'
        || p.qualifiedCandidate !== true || !bodies[p.natalTargetId] ? '' : sentences([
        '行运太阳在精确时点经过本命' + bodies[p.natalTargetId] + '，按展示日归属',
        leoTransitDeclinationText(p.contactDeclinations),
        p.isAngular ? '该星实际位于本命第' + p.natalHouse + '角宫'
          : leoAngularCuspText(p.natalTargetId, p.angularCuspApproach) || '该星实际位于本命第' + p.natalHouse + '宫',
        p.elevatedTenthCuspApproach?.nextHouse === 10
          ? '按同作者的高举定义，此星为最接近第十宫头的已核本命星' : '',
        p.natalHouse === 10 && p.hasExactNatalSolarAspectInTenthHouse === true && aspects[p.exactNatalSolarAspectInTenthHouse?.aspect]
          ? '同一颗第十宫本命星与本命太阳精确形成' + aspects[p.exactNatalSolarAspectInTenthHouse.aspect] + '，满足原书的显著性条件' : '',
        p.isAscendantRuler && p.isSoleAngularBody ? '本命' + bodies[p.natalTargetId] + '兼为上升主星，实为原书择强三宫唯一落星' : '',
        p.isAscendantRuler ? '该星为本命上升星座的主星' : '',
        p.isAscendantDecanRuler === true && p.isAscendantRuler !== true && number(p.ascendantDecan?.decan) !== undefined
          ? '该星是本命上升第' + p.ascendantDecan.decan + '十分度的辅助主星，按原书三分象分法核定' : '',
        p.isAscendantDwadashamshaRuler === true && p.isAscendantRuler !== true && p.isAscendantDecanRuler !== true
          && number(p.ascendantDwadashamsha?.part) !== undefined
          ? '该星是本命上升第' + p.ascendantDwadashamsha.part + '个十二分度的辅助主星' : '',
        ...list(p.closestSolarAspects).map(item => '该星是本命太阳的最近有效黄经相位对象，' + leoNatalAspectText(item)),
        p.hasUniqueClosestNatalSolarMajor === true
          ? '本命太阳唯一的最近对象具备主要黄经相位，已查独立赤纬平行没有影响本次排序' : '',
        p.hasUniqueClosestNatalSolarMinor === true
          ? '本命太阳唯一的最近对象为半刑或倍半刑，同场没有阻碍排序的独立赤纬平行' : '',
        p.soleSolarParallelCandidate === true && leoNatalAspectText(p.soleSolarParallelAspect)
          ? '这颗本命星是太阳在原书相位表中的唯一联系，实见' + leoNatalAspectText(p.soleSolarParallelAspect) : '',
        ...list(p.soleSolarDualCoordinateContacts).map(item => '本命太阳的已核黄经和赤纬相位都指向同一颗星，实见' + leoNatalAspectText(item)),
        ...list(p.soleLunarAspectContacts).map(item => '本命月亮在已核相位中仅与该星成相，实见' + leoNatalAspectText(item)),
        ...list(p.closestLunarAspectContacts).map(item => '在已核本命月亮的多个黄经相位中，该星是唯一最接近精确相位的对象，实见' + leoNatalAspectText(item)),
        ...list(p.lunarParallelReplacements).flatMap(item => bodies[item?.body] && aspects[item.preferredAspect]
          ? ['本命月亮与本命' + bodies[item.body] + '已有黄经' + aspects[item.preferredAspect] + '，该星对的赤纬平行不重复参与排序'] : []),
        ...list(p.risingDegreeAspects).filter(item => leoNatalAspectText(item)).map(item =>
          '本命一宫无落星，该星与实际升起度数' + degrees(item.ascendantLongitude) + '的候选为' + leoNatalAspectText(item)),
        leoNatalTargetAspectsText(p),
        leoAngularSameSignGroupText(p.natalAngularSameSignGroup),
        list(p.sameSignNatalBodies).length ? '与该星本命同座的天体有' + p.sameSignNatalBodies.flatMap(item => bodies[item.body]
          ? [bodies[item.body] + (number(item.house) !== undefined ? '（第' + item.house + '宫）' : '')] : []).join('、') : '',
        list(p.ruledHouses).length ? '该星主本命第' + p.ruledHouses.join('、') + '宫，按实际宫头星座计算' : '',
        '各项依据并列保留，整盘主题、其他重要性来源及生效时长仍须核',
      ]);
      case 'leo_second_house_transit_context': return p.profile !== 'leo-transit-natal-witness-1928-v1'
        || !['Saturn', 'Jupiter'].includes(p.transitBody) ? '' : sentences([
        '实际' + bodies[p.transitBody] + '经过本命第二宫，以下为同作者后版的本命财务条件',
        p.financeBasis === 'second_house_occupants' ? '本命第二宫有落星，先核实际落星'
          : '本命第二宫为空，首查实际宫头的主星' + (bodies[p.secondRuler] ?? ''),
        ...list(p.financialAnchors).flatMap(anchor => bodies[anchor.body] ? [
          ['本命' + bodies[anchor.body] + '位于第' + anchor.house + '宫', ...list(anchor.contacts).flatMap(c =>
            bodies[c.body] && leoNatalAspectText(c) ? ['与' + bodies[c.body] + '有' + leoNatalAspectText(c)] : [])].join('，'),
        ] : []),
        ...list(p.generalFinancialPairs).flatMap(c => c.involvesSecondOrTenthRuler && bodies[c.first] && bodies[c.body] && leoNatalAspectText(c)
          ? ['原文列举配对中的本命' + bodies[c.first] + '与' + bodies[c.body] + '，' + leoNatalAspectText(c)
            + '，并涉及本命二宫或十宫主星'] : []),
        ...list(p.natalSecondHouseMinorAfflictionContacts).flatMap(c => bodies[c.first] && bodies[c.body] && leoNatalAspectText(c)
          ? ['本命第二宫首查星' + bodies[c.first] + '与' + bodies[c.body] + '见' + leoNatalAspectText(c)
            + '，原书将这种相位列为相对较弱的压力'] : []),
        ...list(p.natalSecondHousePressureSources).flatMap(c => bodies[c.first] && bodies[c.body] && leoNatalAspectText(c)
          ? ['本命' + bodies[c.body] + '实居第' + c.sourceHouse + '宫，与第二宫首查星' + bodies[c.first] + '见'
            + leoNatalAspectText(c) + '，可按施相星的本命宫位参考开支压力所涉领域'] : []),
        p.natalFinancialState === 'mixed' ? '本命财务相关星体同时见支持与压力相位'
          : p.natalFinancialState === 'support' ? '本命财务相关星体间已查到六合或三分'
            : p.natalFinancialState === 'pressure' ? '本命财务相关星体间已查到四分或对分'
              : p.natalFinancialState === 'none' ? '本命财务相关星体间未检出本条采用的六合、三分、四分或对分' : '',
        p.transitBody === 'Saturn' && ['pressure', 'mixed'].includes(p.natalFinancialState)
          ? '同段本命财务压力可供原文的资源收紧分支参考'
          : p.transitBody === 'Saturn' && p.hasNatalSecondHouseMinorAffliction === true
            ? '本命较弱的压力条件可与同段推运一并参考'
            : p.transitBody === 'Saturn' && ['support', 'none'].includes(p.natalFinancialState)
              ? '本命所核范围未见财务压力相位，可参考原文审慎安排开支的方向' : '',
        ...list(p.repeatingDirections).map(row => leoDirectionText({ body: row.progressedBody, target: row.natalTargetId,
          targetKind: 'natal', aspectType: row.aspectType })).filter(Boolean)
          .map(label => '过宫同一时段重现了对应本命星对与相位，实查为' + label),
        ...list(p.financialDirections).flatMap(row => {
          const direction = leoDirectionText(row), roles = leoFinancialRoleText(row?.roles);
          return direction && roles && leoLunarNatures[row.nature]
            ? ['同段原书所列财务推运为' + direction + '，' + leoLunarNatures[row.nature] + '，所及本命点是' + roles] : [];
        }),
        p.financialDirectionState === 'mixed' ? '同段并有偏顺和偏难财务推运' : '',
        ...list(p.targetCrossings).flatMap(row => bodies[row?.target] && row.exactAt
          ? ['过宫中于' + at(row.exactAt) + '实合本命' + bodies[row.target]
            + (row.sameTargetDirectionState && row.sameTargetDirectionState !== 'none' ? '，同段已有财务推运落到同一目标' : '')] : []),
        '参考相位仍需按本命整体及当期推运合参，现实收入、支出及当事人的回应须另核',
      ]);
      case 'leo_jupiter_house_ruler_context': {
        if (p.profile !== 'leo-jupiter-house-ruler-context-v1' || ![7, 10].includes(p.natalHouse)
          || !bodies[p.ascendantRuler] || !bodies[p.houseRuler]) return '';
        const annual = p.annualRulers;
        return sentences([
          '木星在此时段经过本命第' + p.natalHouse + '宫，实际宫头在' + (signs[p.cuspSign] ?? '已核位置'),
          '本命第一宫主星为' + bodies[p.ascendantRuler] + '，位于第' + p.ascendantRulerHouse + '宫'
            + '，第' + p.natalHouse + '宫主星为' + bodies[p.houseRuler] + '，位于第' + p.houseRulerHouse + '宫',
          ...list(p.natalAspects).map(row => leoNatalAspectText(row) ? '本命两宫主有' + leoNatalAspectText(row) : ''),
          ...list(p.activeDirections).map(row => {
            if (!bodies[row.progressedBody] || !bodies[row.natalTargetId] || !aspects[row.aspectType]) return '';
            const times = list(row.exactTimes).map(value => at(value)).filter(Boolean);
            return '同段次限' + bodies[row.progressedBody] + '对本命' + bodies[row.natalTargetId] + '为' + aspects[row.aspectType]
              + (row.repeatsNatalAspect === true ? '，重复这对宫主的本命相位' : '') + (times.length ? '，成相于' + times.join('、') : '');
          }),
          p.sameRulerDirectionCandidate === true ? '同一对宫主的本命六合或三分在本段次限中重现，可作原书的合参候选' : '',
          bodies[annual?.ascendantRuler] && bodies[annual.houseRuler] && signs[annual.firstSign] && signs[annual.houseSign]
            ? '当年次限图第一宫头在' + signs[annual.firstSign] + '，主星为' + bodies[annual.ascendantRuler]
              + '，第' + p.natalHouse + '宫头在' + signs[annual.houseSign] + '，主星为' + bodies[annual.houseRuler] : '',
          ...list(annual?.activeDirections).map(row => leoDirectionText({
            body: row.progressedBody, target: row.targetId, targetKind: 'progressed', aspectType: row.aspectType,
          })).filter(Boolean).map(label => '同段年度宫主相位为' + label),
          p.annualRulerDirectionCandidate === true ? '固定本命和当年次限图的相同宫位各有同一种六合或三分' : '',
          '宫主归属按同作者后版参考表，现实合作与声誉取义仍须按本命整体合参',
        ]);
      }
      case 'leo_jupiter_luminary_context': {
        if (p.profile !== 'leo-jupiter-luminary-natal-links-v1' || !['Sun', 'Moon'].includes(p.luminary)
          || p.zodiac !== 'tropical') return '';
        if (p.transitKind === 'exact_point') {
          const target = '本命' + bodies[p.luminary];
          const aspect = p.hasExactNatalJupiterTrine === true ? target + '与本命木星实成三分相'
            : p.hasNatalJupiterAspect === true ? target + '与本命木星有已核相位'
              : p.hasReceivedNatalAspect === true ? target + '有已核的其他行星相位'
                : p.hasReceivedNatalAspect === false ? '原书所用的本命相位表未查到该发光体的其他相位' : '';
          const priority = p.natalJupiterLongitudePriority;
          const repeated = p.repeatedMoonJupiterLongitude;
          const progressedJupiter = p.repeatedProgressedJupiterToLuminary;
          return sentences(['木星在实际过点同度经过' + target, aspect, leoAngularSameSignGroupText(p.natalAngularSameSignGroup),
            repeated && aspects[repeated.aspect] ? '次限月亮对同一本命木星确有同类黄经'
              + aspects[repeated.aspect] + '，距成相' + degrees(repeated.deviation) : '',
            aspects[progressedJupiter?.aspect] ? '次限木星对同一' + target + '的'
              + aspects[progressedJupiter.aspect] + '也在已核范围' : '',
            aspects[priority?.longitude?.aspect] && priority?.parallel
              ? target + '与本命木星同时有主要黄经相位和赤纬平行，按原书以黄经' + aspects[priority.longitude.aspect] + '为主' : '']);
        }
        if (p.transitKind === 'station_point') {
          const station = p.natalStation;
          return p.stationTimingProfile === 'leo-1913-near-station-between-exact-passes-v1'
            && station?.at && station.before && station.after && motions[station.directionAfter] && degrees(station.separation)
            ? sentences(['木星实际停驻后转' + motions[station.directionAfter] + '，距同一本命' + bodies[p.luminary]
              + degrees(station.separation) + '，在一九一三年版的两度停驻范围内',
              '同一个本命位置有前后两次精确经过，分别为' + at(station.before) + '和' + at(station.after)]) : '';
        }
        return sentences([
        '以下把木星经过与受照的本命' + bodies[p.luminary] + '及其原有连接绑定于同一已核生日，不把本命另一发光体的相位借来',
        '出生时刻为' + at(p.birthAt) + '；本命黄经经同口径重算一致，赤纬采用出生时刻的真赤道',
        ...list(p.positions).flatMap(row => bodies[row.body] ? ['本命' + bodies[row.body] + zodiacPosition(row.longitude, p.zodiac)] : []),
        ...list(p.natalAspects).flatMap(row => bodies[row.body] ? ['本命' + bodies[p.luminary] + '与本命' + bodies[row.body]
          + '的黄经最短距为' + degrees(row.separation) + '；最近角度候选为'
          + list(row.closestAspects).flatMap(a => aspects[a.aspectType] && degrees(a.difference)
            ? [aspects[a.aspectType] + '，距准确角度尚差' + degrees(a.difference)] : []).join('、')
          + '；绝对赤纬差为' + degrees(row.absoluteDeclinationDifference)
          + (row.sameHemisphere === true ? '，同为北侧或同为南侧' : row.sameHemisphere === false ? '，分处南北两侧' : '，赤道侧别未定')
          + '；只是几何记录，最近不等于落入已核本命相位容许度'] : []),
        '本命木星与受照' + bodies[p.luminary] + '的连接是原文另述的加强分支，不能把它强制设为所有日月经过的门槛，也不把冥王星或角点加入一九〇六年的其他行星集合',
        p.natalAspectProfile === 'leo-green-1906-natal-aspects-v1' && p.natalAspectOrbVerified === true
          ? '按一九〇六年本命相位表，合相还须同一星座。'
            + (list(p.jupiterNatalAspectCandidates).length
              ? '木星与这颗受照天体的本命相位有' + p.jupiterNatalAspectCandidates.map(leoNatalAspectText).filter(Boolean).join('、')
              : '木星与这颗受照天体未查得符合该表的本命相位') : '',
        ...list(p.receivedNatalAspects).flatMap(row => bodies[row.body] && leoNatalAspectText(row)
          ? ['受照的本命' + bodies[p.luminary] + '与本命' + bodies[row.body] + '实查为' + leoNatalAspectText(row)] : []),
        ...list(p.repeatingDirections).flatMap(row => {
          const label = leoDirectionText({ body: row.progressedBody, target: row.natalTargetId, targetKind: 'natal', aspectType: row.aspectType });
          return label && row.start && row.endExclusive
            ? ['受照星的同一本命星对及相位在过境时由' + label + '重现，共同有效时间从' + at(row.start) + '至' + at(row.endExclusive)] : [];
        }),
        ...list(p.directionsAtExactPasses).flatMap(row => {
          const label = leoDirectionText({ body: row.progressedBody, target: row.natalTargetId, targetKind: 'natal', aspectType: row.aspectType });
          return label && row.at ? ['木星在' + at(row.at) + '精确经过时，' + label + '仍处于有效段'] : [];
        }),
        ...list(p.natalLuminaryStationWitnesses).flatMap(row => row.at && motions[row.directionAfter] && degrees(row.distance)
          ? ['木星在' + at(row.at) + '停驻转' + motions[row.directionAfter] + '，距同一本命' + bodies[p.luminary]
            + degrees(row.distance) + '，在后版列出的两度停驻范围内'] : []),
        '本次木星合相区间采用产品容许度' + degrees(p.productOrb) + '；这不是原书给定的统一阈值或固定一个月',
        p.episodeStart ? '已回查的本次产品入相起点为' + at(p.episodeStart) + '，不拿查询窗口起点冒充入相' : '',
        number(p.nativePassage?.durationDays) !== undefined ? '同一次产品合相区间从' + at(p.nativePassage.enteredAt) + '至' + at(p.nativePassage.exitedAt)
          + '，历时约' + Number(p.nativePassage.durationDays.toFixed(2)) + '日。整段实算精确经过'
          + list(p.nativePassage.exactPasses).length + '次'
          + (list(p.nativePassage.exactPasses).length ? '，依次为' + p.nativePassage.exactPasses.map(row =>
            at(row.at) + (motions[row.direction] ? '（' + motions[row.direction] + '）' : '')).join('、') : '') : '',
        list(p.exactPasses).length ? '当前区间的精确经过为' + p.exactPasses.map(row => at(row.at)
          + (motions[row.direction] ? '（' + motions[row.direction] + '）' : '')
          + (number(row.passIndex) !== undefined ? '，本次过程第' + row.passIndex + '次' : '')).join('、')
          : '当前区间未记录精确经过点，仍可能处于持续背景；不能据此说整次过程没有精确经过',
        ...list(p.exactPassDeclinations).flatMap(row => row.at && leoTransitDeclinationText(row)
          ? [at(row.at) + '，' + leoTransitDeclinationText(row)] : []),
        '一九〇六年同版取值、约一月的有效起止和当前推运的同性质尚未核全；夹角、同期和经过次数不能自动证明增强、减弱或机会兑现',
        ]);
      }
      case 'heindel_progression_context':
      case 'heindel_transit_context': return heindelDescription(p, at);
      case 'heindel_transit_observation': {
        const body = bodies[p.transitBody], target = bodies[p.natalTargetId], aspect = aspects[p.aspectType];
        const wording = { no_observed_gain: '原书记录未见明确增益', mild_adverse: '原书将阻力限定为较轻',
          favourable: '原书将顺行时的此类过点解读为有利于专注',
          adverse: '原书将逆行时的此类过点解读为思虑增多',
          hasty_reaction: '原书将这一过点与较急的反应和易于仓促行动联系起来' }[p.observation];
        return p.profile === 'heindel-chapter-27-exact-transit-observation-v1' && body && target && aspect && wording
          ? '实际行运' + body + '对本命' + target + '精确形成' + aspect + '，' + wording : '';
      }
      case 'heindel_direction_transit_overlap': {
        if (p.profile !== 'heindel-acd-same-pair-direction-v1') return '';
        const activations = list(p.lunationActivations).flatMap(row => p.lunationActivationProfile === 'heindel-natal-lunation-3-degree-v1'
          && bodies[row?.natalTargetId] && aspects[row?.aspectType] && row.at && degrees(row.deviation)
          ? ['同段真实朔在' + at(row.at) + '，对本命' + bodies[row.natalTargetId] + '形成' + aspects[row.aspectType]
            + '，距原相位' + degrees(row.deviation) + '，在原书三度内'] : []);
        const direction = aspects[p.directionAspectType];
        if (p.directionKind === 'solar_lunation_activation') return sentences([
          direction && bodies[p.directionNatalTargetId]
            ? '按Heindel调整日，次限太阳与本命' + bodies[p.directionNatalTargetId] + '的' + direction + '仍在有效段内' : '',
          p.natalSaturnAfflicted === true ? '同一本命土星另有已核受克相位' : '',
          ...activations, '原书在这两种次限日例中把真实朔当作独立行运引动',
        ]);
        const aspect = aspects[p.aspectType];
        if (['solar_fellowship_transit_lunation', 'solar_fellowship_transit_lunation_month'].includes(p.directionKind)) {
          const monthly = p.fellowshipTransitLunationMonthProfile === 'rosicrucian-lesson-13-continuous-transit-in-lunation-v1';
          const witness = monthly || p.fellowshipTransitLunationProfile === 'rosicrucian-lesson-13-actual-transit-lunation-v1'
            ? p.transitLunationActivation : undefined;
          return witness && aspect && direction ? sentences([
            '实际新月同时触及同一本命方向，与行运行星相距' + degrees(witness.phaseTransitDeviation),
            '木星对本命太阳的' + aspect + '与次限太阳对本命木星的' + direction + '同段有效',
            monthly ? '两项有效带的交集受下一个实朔边界限制' : '',
          ]) : '';
        }
        if (p.directionKind === 'solar_angle_transit_overlap') {
          const angle = ['ASC', 'MC'].includes(p.natalTargetId) ? bodies[p.natalTargetId] : undefined;
          if (p.angleOverlapProfile !== 'heindel-solar-saturn-radical-angle-v1' || p.progressedBody !== 'Sun'
            || p.transitBody !== 'Saturn' || p.aspectType !== 'conjunction' || p.directionNatalTargetId !== p.natalTargetId
            || !angle || !['square', 'opposition'].includes(p.directionAspectType) || p.allowedOrb !== 1.5) return '';
          return sentences([
            '按Heindel调整日，次限太阳对本命' + angle + '的' + direction + '与实际土星合该点同段成立',
            p.exactSaturnPass === true ? '实际土星在所示时刻精确经过本命' + angle
              : '这段是太阳一度半推运带和土星实际行运带的交集，两项在原书均列为偏难',
            heindelBirthdayDescription(p),
          ]);
        }
        if (!aspect || ![p.transitBody, p.natalTargetId, p.progressedBody, p.directionNatalTargetId].every(body => bodies[body])) return '';
        const parallel = p.directionAspectType === 'parallel' && p.directionCoordinate === 'equatorial_declination_of_date'
          && ((p.progressedBody === 'Moon' && p.directionNatalTargetId === 'Neptune')
            || (p.progressedBody === 'Sun' && ['Jupiter', 'Saturn'].includes(p.directionNatalTargetId)))
          && [p.directionDeclination?.progressed, p.directionDeclination?.natal].every(value => number(value) !== undefined);
        if (p.directionAspectType === 'parallel' && !parallel) return '';
        const directionLabel = direction ?? aspect;
        return sentences([
          (parallel ? '同一对星在此段分别出现次限赤纬平行和行运黄经相位'
            : directionLabel === aspect ? '同一对星在此段出现相同的黄经相位' : '同一对星在此段出现不同的黄经相位')
            + '，真实行运' + bodies[p.transitBody] + '与本命' + bodies[p.natalTargetId] + '为' + aspect,
          parallel ? '按Heindel调整日候选，次限' + bodies[p.progressedBody] + '与本命' + bodies[p.directionNatalTargetId] + '的赤纬绝对值实等'
            : '按Heindel调整日候选，推运' + bodies[p.progressedBody] + '对本命' + bodies[p.directionNatalTargetId] + '为' + directionLabel,
          p.progressedBody === 'Sun' && p.directionNature === 'favourable' ? '按同一受照行星的已核本命相位，太阳推运列作偏顺'
            : p.progressedBody === 'Sun' && p.directionNature === 'adverse' ? '按同一受照行星的已核本命相位，太阳推运列作偏难' : '',
          p.transitBody === 'Neptune' && p.directionNature ? '按原书具名组合的条件，次限列作' + (p.directionNature === 'favourable' ? '偏顺' : '偏难') : '',
          p.fellowshipJupiterMildTransitBandProfile === 'rosicrucian-lesson-13-jupiter-mild-transit-1.5-v1'
            ? '实际木星刑冲在一度半范围内，并与已经核实性质的太阳次限时段相交' : '',
          p.directionKind === 'exact_point' && (p.fellowshipTransitBandProfile === 'rosicrucian-lesson-13-neptune-transit-1.5-v1'
            || p.fellowshipJupiterTransitBandProfile === 'rosicrucian-lesson-13-jupiter-transit-1.5-v1'
            || p.fellowshipSaturnTransitBandProfile === 'rosicrucian-lesson-13-saturn-transit-1.5-v1'
            || p.fellowshipUranusTransitBandProfile === 'rosicrucian-lesson-13-uranus-adverse-transit-1.5-v1')
            ? '精确次限点在同学派课程的一度半行运带内' : '',
          p.transitBody === 'Jupiter' && p.transitNature === 'mild_adverse' ? '原书将这类实际木星刑冲列为较轻的阻力' : '',
          p.natureRelation === 'akin' ? '按原书对这组星与运动状态的说明，两类接触性质同向'
            : p.natureRelation === 'different' ? '按原书对这组星与运动状态的说明，两类接触性质不同' : '',
          heindelBirthdayDescription(p),
          p.directionKind === 'solar_band' ? '所列时段为太阳一度半推运带与实际行运带的交集'
            : p.directionKind === 'exact_point' ? '推运成相点落在实际行运带内，仅记录时刻' : '',
          p.directionKind === 'solar_lunar_direction_activation' && p.lunarDirectionActivation
            && bodies[p.lunarDirectionActivation.natalTargetId] && aspects[p.lunarDirectionActivation.aspectType]
            ? '次限月亮于' + at(p.lunarDirectionActivation.at) + '与本命' + bodies[p.lunarDirectionActivation.natalTargetId]
              + '精确形成' + aspects[p.lunarDirectionActivation.aspectType] + '，同一时刻仍在太阳推运带与实际行运带内，三层方向相符' : '',
          ...list(p.exactTimes).map(value => at(value) ? '推运精确成相在' + at(value) : ''),
          ...activations,
          '原书计时及两层性质的整体合参仍待核',
        ]);
      }
      case 'lilly_return_seventh_context': {
        if (p.profile !== 'lilly-revolution-rising-and-radical-seventh-v1' || p.zodiac !== 'tropical' || p.houseSystem !== 'regiomontanus'
          || number(p.returnAscendant) === undefined || number(p.natalSeventhLongitude) === undefined || typeof p.sameSign !== 'boolean') return '';
        return sentences([
          '按指定回归地点计算，太阳回归在' + at(p.returnAt) + '，完整回归年止于' + at(p.returnEnd),
          '热带黄道雷吉奥蒙塔努斯制的本命第七宫宫头为' + zodiacPosition(p.natalSeventhLongitude, p.zodiac)
            + '，回归上升为' + zodiacPosition(p.returnAscendant, p.zodiac),
          p.sameSign ? '本命第七宫宫头与本次回归上升落在同一星座' : '本命第七宫宫头与本次回归上升分属不同星座',
          '原书这一条比较整个星座。相应的关系主题仅覆盖该回归的有效片段，仍须结合双方现实情况与其他盘面条件',
        ]);
      }
      case 'lilly_return_context': return !['lilly-return-source-pairs-v1', 'lilly-return-source-pairs-v2-conditions', 'lilly-return-source-pairs-v3-radical-place'].includes(p.profile) || !bodies[p.returnBody] || !bodies[p.natalTargetId] ? '' : sentences([
        '本条将同一本命快照与同一次太阳回归时刻成对核对，不拼接另一个回归年',
        p.returnEpochBasis === 'natal-sun-ephemeris' ? '按已核出生时刻的实算太阳黄经确定该次回归' : '',
        '太阳回归时刻为' + at(p.returnAt) + '，完整回归年截止于' + at(p.returnEnd),
        p.returnHorizonContrast === 'radix-below-return-above'
          ? '本命七曜都在当地地平线下，本次回归七曜都在指定地点的地平线上，符合原书回归通则所列的反向对照' : '',
        p.returnHorizonContrast === 'radix-below-return-above' && ['saturn-self', 'venus-mercury'].includes(p.pair)
          ? '同一次回归中，原书要求回归星状态良好的正面分支被这一反向条件排除' : '',
        '回归' + bodies[p.returnBody] + '位置为' + zodiacPosition(p.returningLongitude, 'tropical')
          + '，本命目标' + bodies[p.natalTargetId] + '位置为' + zodiacPosition(p.natalLongitude, 'tropical'),
        degrees(p.longitudeSeparation) ? '二者实际黄经最短距离为' + degrees(p.longitudeSeparation) : '',
        typeof p.sameSign === 'boolean' ? (p.sameSign ? '二者同星座' : '二者分属不同星座') : '',
        degrees(p.mainOrb) && degrees(p.alternateOrb) ? '第一卷同图合相两列半径和分别为' + degrees(p.mainOrb) + '与' + degrees(p.alternateOrb) + '，这里作为跨图距离的参考' : '',
        { both_columns: '实际距离在两列参考范围内', one_column: '实际距离只在一列参考范围内',
          same_sign_only: '仅有同星座这一候选依据，两列距离比较均超出',
          outside_sign_and_columns: '二者既不同星座，距离也超出两列参考范围，本段没有回到本命位置的几何候选' }[p.placeComparison],
        typeof p.sameDegreeCell === 'boolean' ? (p.sameDegreeCell ? '落在同一个整数一度格' : '没有落在同一个整数一度格')
          + '只供审查，不等于原书同度已经成立' : '',
        { same_printed_minute: '依本书回归图记录精度另比较角分，复算的回归星与本命目标处在同一星座和同一最近角分',
          different_printed_minutes: '依最近角分比较，回归星与本命目标没有落在同一星座的同一角分',
          minute_boundary: '回归求根前后样本跨星座或角分界，本段最接近的角分未定' }[p.radicalPlaceMinuteState],
        '原书同度容许度尚未核定，不套一般行运或次限的产品容许度',
        p.natalSect === 'day' ? '本命太阳在地平线上方，几何昼盘' : p.natalSect === 'night' ? '本命太阳在地平线下方，几何夜盘' : '本命昼夜不可确定',
        p.natalHouseSystem === 'regiomontanus' && number(p.natalTargetHouse) !== undefined ? '本命目标按雷吉奥蒙塔努斯制位于第' + p.natalTargetHouse + '宫' : '',
        p.returnSignification?.profile === 'lilly-book-three-p737-radical-lord-return-house-v1'
          && p.returnSignification.body === p.returnBody && number(p.returnSignification.returnHouse) !== undefined
          ? (list(p.returnSignification.natalRuledHouses).length ? '本命' + bodies[p.returnBody] + '守护第'
            + list(p.returnSignification.natalRuledHouses).join('、') + '宫' : '本命' + bodies[p.returnBody] + '未守护所核十二宫头')
            + '，同次实际回归' + bodies[p.returnBody] + '实居第' + p.returnSignification.returnHouse + '宫' : '',
        ['square', 'opposition'].includes(p.returnAscendantHardAspect)
          ? '两盘上升按角分复核' + aspects[p.returnAscendantHardAspect]
            + (number(p.returnAscendantNatalHouse) === undefined ? '，雷吉奥蒙塔努斯制的本命落宫尚未核定'
              : '，回归上升实落本命第' + p.returnAscendantNatalHouse + '宫') : '',
        [6, 12].includes(p.returnRisingSignMatchesNatalCuspHouse)
          ? '回归上升与本命第' + p.returnRisingSignMatchesNatalCuspHouse + '宫宫头同座' : '',
        p.returnAscendantDomicileProfile === 'lilly-book-three-p736-same-rising-minute-domicile-v1'
          ? '本命与真实回归上升同座同角分，回归上升主' + bodies[p.returnBody] + '实居守护座且远离太阳光束' : '',
        p.returnFortuneProfile === 'lilly-book-three-p736-radical-luminaries-return-fortune-v1' && number(p.returnFortuneHouse) !== undefined
          ? '以本命日月间距及实际回归上升复算的回归福点实居第' + p.returnFortuneHouse + '宫' : '',
        motions[p.returnDirection] ? '回归星当时' + motions[p.returnDirection] : '',
        number(p.returnSpeed) !== undefined ? '回归星黄经速度为每日' + Number(p.returnSpeed.toFixed(6)) + '度，不据速度正负判断整体状态良好' : '',
        lillyEssentialDescription(p.returningEssential, '回归'), lillyEssentialDescription(p.natalTargetEssential, '本命目标'),
        lillyConditionDescription(p.returningConditions, '回归', at), lillyConditionDescription(p.natalTargetConditions, '本命目标', at),
        lillyP115Description(p.returningP115, '回归' + bodies[p.returnBody]),
        ...list(p.returningConditions?.receptions).flatMap(reception => {
          const label = bodies[reception?.otherBody];
          const sameDomicile = reception?.mutualHouse === true && p.returningP115?.points?.domicile === 5;
          const sameExaltation = reception?.mutualExaltation === true && p.returningP115?.points?.exaltation === 4;
          return label ? [sameDomicile ? '同次回归' + bodies[p.returnBody] + '与' + label + '互入守护座，按原表计5分' : '',
            sameExaltation ? '同次回归' + bodies[p.returnBody] + '与' + label + '互入擢升座，按原表计4分' : ''] : [];
        }),
        p.returnVenusFortitude?.atLeastWorkedExample === true && number(p.returnVenusFortitude.lowerNet) !== undefined
          ? '回归金星保守计入已核及可能的失分，净值下限为' + p.returnVenusFortitude.lowerNet + '分，已达到第三卷金星强势命例' : '',
        p.returnVenusEighthFortitude?.atLeastWorkedExample === true && number(p.returnVenusEighthFortitude.lowerNet) !== undefined
          ? '回归金星实居第八宫且同座日心，依第三卷原例扣四分后净值下限为' + p.returnVenusEighthFortitude.lowerNet + '分' : '',
        p.returnVenusCazimiFortitude?.atLeastWorkedExample === true && number(p.returnVenusCazimiFortitude.lowerNet) !== undefined
          ? '回归金星实为同座日心，保守净值下限为' + p.returnVenusCazimiFortitude.lowerNet + '分，已达到第三卷金星强势命例' : '',
        number(p.venusCuspVirtue?.fromHouse) !== undefined && number(p.venusCuspVirtue?.cuspHouse) !== undefined
          && degrees(p.venusCuspVirtue.distance)
          ? '回归金星实居第' + p.venusCuspVirtue.fromHouse + '宫，距前方第' + p.venusCuspVirtue.cuspHouse
            + '宫头' + degrees(p.venusCuspVirtue.distance) + '，按五度宫头法另核该宫的作用' : '',
        p.returnVenusCuspFortitude?.atLeastWorkedExample === true && number(p.returnVenusCuspFortitude.lowerNet) !== undefined
          ? '回归金星按宫头作用重算的助损下限为' + p.returnVenusCuspFortitude.lowerNet + '分' : '',
        lillyP115Description(p.natalTargetP115, '本命' + bodies[p.natalTargetId]),
        p.natalMoonP745Balance?.profile === 'lilly-book-three-p745-natal-moon-v1'
          && number(p.natalMoonP745Balance.net) !== undefined
          ? '按第三卷命例相减，本命月亮已核分项净值为' + p.natalMoonP745Balance.net + '分'
            + (p.natalTargetHouse === 8 ? '，第八宫按该命例扣4分' : '') : '',
        p.natalMoonDebility?.weakInBoth === true
          && number(p.natalMoonDebility.bookOneUpperNet) !== undefined && number(p.natalMoonDebility.bookThreeUpperNet) !== undefined
          ? '本命月亮计入可能助分后仍偏弱，两种取法的净值上限分别为' + p.natalMoonDebility.bookOneUpperNet
            + '分和' + p.natalMoonDebility.bookThreeUpperNet + '分' : '',
        p.natalMoonNocturnalDomicileFortitude === true ? '本命月亮夜生，实居地平线以上的角宫与自身本垣，并增光远日' : '',
        bodies[p.natalMoonNocturnalNonAngularDomicileWitness?.supporter] && aspects[p.natalMoonNocturnalNonAngularDomicileWitness?.aspect]
          ? '夜生本垣月亮实居地平线上非角宫，向同图' + bodies[p.natalMoonNocturnalNonAngularDomicileWitness.supporter]
            + '的' + aspects[p.natalMoonNocturnalNonAngularDomicileWitness.aspect] + '已复核真成相与中途阻断条件' : '',
        (() => {
          const witness = p.natalMoonNocturnalEssentialWitness;
          const labels = { exaltation: '擢升', triplicity: '三分', term: '界', face: '面' };
          const dignities = list(witness?.dignities).map(key => labels[key]).filter(Boolean);
          return dignities.length && bodies[witness?.supporter] && aspects[witness?.aspect]
            ? '夜盘本命月亮实居地平线上方、增光远日，具自身' + dignities.join('、')
              + '，与本命' + bodies[witness.supporter] + '的' + aspects[witness.aspect] + '入相已复算' : '';
        })(),
        p.natalMoonWorkedFortitude?.atLeastWorkedExample === true
          && number(p.natalMoonWorkedFortitude.bookOneLowerNet) !== undefined
          && number(p.natalMoonWorkedFortitude.bookThreeLowerNet) !== undefined
          ? '本命月亮按两种助损取法的净值下限分别为' + p.natalMoonWorkedFortitude.bookOneLowerNet
            + '分和' + p.natalMoonWorkedFortitude.bookThreeLowerNet + '分，达到第三卷原例的强势下限' : '',
        p.natalMoonWorkedDebility?.atMostWorkedExample === true
          && number(p.natalMoonWorkedDebility.bookOneUpperNet) !== undefined
          && number(p.natalMoonWorkedDebility.bookThreeUpperNet) !== undefined
          ? '本命月亮在日光下但未受灼，按两种助损取法的净值上限分别为' + p.natalMoonWorkedDebility.bookOneUpperNet
            + '分和' + p.natalMoonWorkedDebility.bookThreeUpperNet + '分，达到原例的明显偏弱程度' : '',
        number(p.natalMoonCuspVirtue?.fromHouse) !== undefined && number(p.natalMoonCuspVirtue?.cuspHouse) !== undefined
          && degrees(p.natalMoonCuspVirtue.distance)
          ? '本命月亮实居第' + p.natalMoonCuspVirtue.fromHouse + '宫，距前方第' + p.natalMoonCuspVirtue.cuspHouse
            + '宫头' + degrees(p.natalMoonCuspVirtue.distance) + '，按五度宫头法另核该宫的作用' : '',
        p.natalMoonCuspFortitude?.atLeastWorkedExample === true
          && number(p.natalMoonCuspFortitude.bookOneLowerNet) !== undefined && number(p.natalMoonCuspFortitude.bookThreeLowerNet) !== undefined
          ? '本命月亮按宫头作用重算的两表净值下限分别为' + p.natalMoonCuspFortitude.bookOneLowerNet
            + '分和' + p.natalMoonCuspFortitude.bookThreeLowerNet + '分' : '',
        p.natalMoonCuspDebility?.atMostWorkedExample === true
          && number(p.natalMoonCuspDebility.bookOneUpperNet) !== undefined && number(p.natalMoonCuspDebility.bookThreeUpperNet) !== undefined
          ? '本命月亮按宫头作用重算的两表净值上限分别为' + p.natalMoonCuspDebility.bookOneUpperNet
            + '分和' + p.natalMoonCuspDebility.bookThreeUpperNet + '分' : '',
        p.saturnMoonDispositionAtReturn === true ? '本次回归月亮实居土星本垣、土星实居月亮擢升座，可对读原书第786页的交叉处分' : '',
        bodies[p.saturnSupportedReturnContact?.body] && aspects[p.saturnSupportedReturnContact?.aspect]
          ? '回归土星与同盘' + bodies[p.saturnSupportedReturnContact.body] + '按角分核成'
            + aspects[p.saturnSupportedReturnContact.aspect] + '，同时有本垣、擢升或已核互容的助力，顺行并远离日光' : '',
        bodies[p.saturnApplyingReturnWitness?.supporter] && aspects[p.saturnApplyingReturnWitness?.aspect]
          ? '回归土星与同盘' + bodies[p.saturnApplyingReturnWitness.supporter]
            + '在同度格趋近' + aspects[p.saturnApplyingReturnWitness.aspect]
            + '，换座前的实际成相已复算'
            + (p.saturnApplyingReturnWitness.aspect === 'sextile' ? '，土星顺行且日行速快于书载均速' : '') : '',
        number(p.saturnCuspVirtue?.fromHouse) !== undefined && number(p.saturnCuspVirtue?.cuspHouse) !== undefined
          && p.saturnCuspVirtue.cuspHouse !== 10 && degrees(p.saturnCuspVirtue.distance)
          ? '回归土星实居第' + p.saturnCuspVirtue.fromHouse + '宫，距前方第' + p.saturnCuspVirtue.cuspHouse
            + '宫头' + degrees(p.saturnCuspVirtue.distance) + '，按五度宫头法核该宫的作用' : '',
        p.returnAngles === 'regiomontanus_verified'
          ? '回归盘采用该次回归的指定地点和雷吉奥蒙塔努斯制。' + ({ day: '回归太阳在当地地平线上方，为昼盘',
            night: '回归太阳在当地地平线下方，为夜盘' }[p.returnSect] ?? '求根误差内不能确定回归盘昼夜')
          : '回归盘昼夜、角点和宫位须有对应地点，不默认拿出生地点代替',
        p.saturnMidheavenState === 'tenth-house' ? '回归土星实居第十宫，供核 Lilly 所述中天条件'
          : p.saturnMidheavenState === 'house-boundary' ? '回归土星在求根误差内可能跨宫，第十宫条件保持未知' : '',
        p.saturnMidheavenApproachStatus === 'within-five-before'
          ? '回归土星实居第九宫，且在最近的第十宫头之前五度内，黄经距离为'
            + list(p.saturnMidheavenDistanceRange).map(degrees).join('至') + '。按 Lilly 宫头取法计入中天候选'
          : p.saturnMidheavenApproachStatus === 'boundary' ? '回归土星是否落入中天宫头前五度范围，在求根误差内仍待核' : '',
        '水象三分按本表昼夜均火星，不混用另一种三分表',
        p.natalMoonDebility?.weakInBoth === true || p.returnVenusFortitude?.atLeastWorkedExample === true
          || p.returnVenusCazimiFortitude?.atLeastWorkedExample === true || p.returnVenusEighthFortitude?.atLeastWorkedExample === true ? ''
          : '月亮的本命有利或虚弱、金星及土星状态良好仍须另核，不从单项尊贵推出原文结果',
      ]);
      case 'leo_lunar_ascendant_crossing': {
        if (p.profile !== 'leo-lunar-ascendant-crossing-v1' || p.fromHouse !== 12
          || p.house !== 1 || p.motion !== 'direct' || !['natal', 'progressed'].includes(p.targetKind)) return '';
        const dignity = { domicile: '入庙', exaltation: '擢升', fall: '落陷', detriment: '失势' }[p.natalMoonDignity];
        const natalContacts = p.natalAspectProfile === 'leo-natal-aspects-1928-support-v1'
          ? leoNatalContactLabels(p.natalMoonContacts) : [];
        return sentences([
          '次限月亮由第十二宫越过' + (p.targetKind === 'progressed' ? '年度次限上升宫头' : '固定本命上升宫头') + '进入第一宫',
          p.targetKind === 'progressed' && p.annualFrameStart && p.annualFrameEnd
            ? '本次穿越所用年度次限宫界从' + at(p.annualFrameStart) + '沿用至' + at(p.annualFrameEnd) : '',
          signs[p.natalMoonSign] && dignity ? '本命月亮在' + signs[p.natalMoonSign] + dignity : '',
          natalContacts.length ? '按同作者本命参考外限，' + natalContacts.join('、') : '',
          ...list(p.solarAtCrossing).map(leoDirectionText).filter(Boolean).map(label => '穿越时同图已有' + label),
          '这项事实记录宫头穿越时刻，月亮的整体强弱和个人实际变化仍需结合其他情况核实',
        ]);
      }
      case 'leo_lunar_house_context': return p.profile !== 'leo-lunar-house-context-v2' ? '' : sentences([
        number(p.house) !== undefined ? '次限月亮经过' + (p.targetKind === 'progressed' ? '年度次限图第' : '固定本命第')
          + p.house + '宫，本条只绑定与下列来源相位共同有效的同一片段，采用Leo时间分宫' : '',
        p.targetKind === 'progressed' && p.annualFrameStart && p.annualFrameEnd ? '年度次限宫界随出生周年更换，本段使用'
          + at(p.annualFrameStart) + '至' + at(p.annualFrameEnd) + '的宫界，周年换算为当前采用的时间口径' : '',
        signs[p.cuspSign] ? '实际宫头落在' + signs[p.cuspSign] : '',
        signs[p.naturalSign] ? '原书按宫序对应的自然星座为' + signs[p.naturalSign] + '；它不是实际宫头星座，也没有把宫制改成自然十二宫' : '',
        Array.isArray(p.naturalSignBodies) ? '九颗来源天体中，本命位于这个自然星座的有'
          + (p.naturalSignBodies.map(body => bodies[body]).filter(Boolean).join('、') || '零颗') + '；只列位置，不按颗数认定突出或强弱' : '',
        Array.isArray(p.natalHouseBodies) ? '本命实际位于该宫的天体为' + (p.natalHouseBodies.map(body => bodies[body]).filter(Boolean).join('、') || '零颗') : '',
        p.natalMoon && signs[p.natalMoon.sign] ? '本命月亮在' + signs[p.natalMoon.sign]
          + (number(p.natalMoon.house) !== undefined ? '，本命第' + p.natalMoon.house + '宫' : '') + '，不据位置单独认定月亮有力或受损' : '',
        typeof p.dayChart === 'boolean' ? '出生太阳几何位置属于' + (p.dayChart ? '昼盘' : '夜盘') : '出生昼夜关系尚未确认',
        list(p.mercurySeparations).map(item => bodies[item.body] && degrees(item.longitudeSeparation)
          ? '本命水星与' + bodies[item.body] + '的最短黄经夹角为' + degrees(item.longitudeSeparation)
            + (degrees(item.absoluteDeclinationDifference) ? '，赤纬绝对差为' + degrees(item.absoluteDeclinationDifference) : '') : '').filter(Boolean).join('；'),
        p.rulerPair && bodies[p.rulerPair.first] && bodies[p.rulerPair.seventh]
          ? '按同作者后版主星表，本命一宫主为' + bodies[p.rulerPair.first] + '，七宫主为' + bodies[p.rulerPair.seventh]
            + (degrees(p.rulerPair.longitudeSeparation) ? '，两颗宫主的本命黄经最短距为' + degrees(p.rulerPair.longitudeSeparation) : '')
            + (degrees(p.rulerPair.absoluteDeclinationDifference) ? '，赤纬绝对差为' + degrees(p.rulerPair.absoluteDeclinationDifference) : '') : '',
        leoLunarHousePremises(p),
        lunarHouseAspects(p.lunarAspects, '本片段的月亮相位', at),
        lunarHouseAspects(p.solarAspects, '本片段的太阳推运', at),
        lunarHouseAspects(p.mutualAspects, '本片段的互相推运', at),
        p.clippedStart === true || p.clippedEnd === true ? '过宫背景被查询窗截断，不把片段起止当成完整过宫起止' : '',
        '自然星座突出、宫主资格、受克与同性质的来源判据仍须核；同一时段不等于同性质、同领域或相互加强，不把几何夹角直接判为吉凶，也不从历史措辞推断疾病、损失或婚姻结果',
      ]);
      case 'leo_natal_context': return p.profile !== 'leo-1906-source-context-v1' ? '' : sentences([
        'Leo资料的本命背景，宫位单独采用原书时间分宫',
        signs[p.ascendantSign] ? '本命上升为' + signs[p.ascendantSign] : '',
        list(p.bodies).map(item => sentences([bodies[item.body] ? '本命' + bodies[item.body] : '',
          signs[item.sign], degrees(item.longitude) ? '黄经为' + degrees(item.longitude) : '',
          degrees(item.declination) ? '赤纬为' + degrees(item.declination) : '',
          number(item.house) !== undefined ? '在本命第' + item.house + '宫' : ''])).filter(Boolean).join('；'),
        typeof p.dayChart === 'boolean' ? '按出生太阳几何位置为' + (p.dayChart ? '昼盘' : '夜盘') + '，不含大气折射' : '出生太阳昼夜关系不可用',
        p.houseStatus !== 'ready' ? '原书宫界依据不可用，不补整宫制' : '',
        '这些是本命位置，不能单凭宫位或星座认定本命强弱、能力或允许发生某个事件',
      ]);
      case 'leo_lunar_exact_observation': {
        const target = bodies[p.natalTargetId], aspect = aspects[p.aspectType];
        if (p.profile !== 'leo-1906-lunar-exact-observation-v1' || !target || !aspect) return '';
        const observation = '次限月亮对' + (p.targetKind === 'progressed' ? '同图次限' : '本命') + target + '精确形成' + aspect;
        const testimonies = leoNatalContactLabels(p.lunarNeptuneTestimonies);
        const risingNeptune = p.natalTargetId === 'Neptune' && p.aspectType === 'quincunx' && p.natalTargetHouse === 1;
        const approachingAscendant = p.natalNeptuneApproachingAscendant === true
          ? leoAngularCuspText('Neptune', p.natalNeptuneAscendantApproach) : '';
        const devotional = leoNatalContactLabels(p.lunarNeptuneDevotionalContacts);
        const creative = leoNatalContactLabels(p.natalSunNeptuneCreativeContacts);
        if (!testimonies.length && !risingNeptune && !approachingAscendant && !devotional.length && !creative.length) {
          return observation + '，按原书作该月的独立倾向参考';
        }
        return sentences([
          observation,
          risingNeptune ? '本命海王星实居第一宫，作为 Leo 与 Green 所列海王星升起的感受性候选' : '',
          approachingAscendant,
          devotional.length ? devotional.join('、') + '，供核同作者所述的虔诚主题候选，个人信念仍待核' : '',
          ...creative.map(label => label + '，供原书所述乐感背景参考'),
          ...testimonies.map(label => label
            + '。这处本命见位供核海王星倾向和限制条件'),
        ]);
      }
      case 'leo_mutual_exact_observation': {
        const moving = bodies[p.progressedBody], target = bodies[p.natalTargetId], aspect = aspects[p.aspectType];
        const venusNeptune = { adverse: '本命金星与海王星有已核的直接不良相位', weak: '本命金星与海王星仅见弱梅花候选',
          clear: '本命金星与海王星未见所核相位的受克分支' }[p.natalVenusNeptuneAfflictionState];
        const variable = p.natalVenusNeptuneVariableContact;
        const literaryConjunction = p.natalVenusNeptuneLiteraryConjunction;
        return p.profile === 'leo-1906-mutual-exact-observation-v1' && moving && target && aspect
          ? sentences(['次限' + moving + '对本命' + target + '精确形成' + aspect + '，按原书作为该年心理倾向的参考',
            leoNatalMercuryNeptunePremiseText(p),
            p.mercuryNeptuneArtisticBasis === 'qualified' ? '本命另有可核的水海创艺见证，诗文与艺术兴趣仍以本人情况为准' : '',
            p.mercuryNeptuneArtisticBasis === 'unreviewed' ? '水海六合已成相，创艺旁证仍待核，取原书所述的基础倾向' : '',
            p.mercuryNeptuneArtisticBasis && p.natalTargetHouse === 9 ? '本命海王星在第九宫，原书可据此讨论旅行或信念主题，实际经历以本人情况为准' : '',
            p.hasMercuryNeptuneDevotionalBasis === true ? '本命木星与海王星的联系支持信念背景，具体体验以本人情况为准' : '',
            venusNeptune,
            variable?.aspect === 'conjunction' ? '本命金星与海王星实际同座合相，按作者列法通常略偏难' : '',
            variable?.aspect === 'parallel' ? '本命金星与海王星见单独赤纬平行，按作者参照较弱的合相性质' : '',
            variable?.venusDignity === 'domicile' ? '金星实在入垣星座，原书允许缓和合相性质' : '',
            variable?.venusDignity === 'exaltation' ? '金星实在擢升星座，原书允许缓和合相性质' : '',
            variable?.neptunePiscesDignityDisputed === true ? '海王星在双鱼的尊贵有原书所载异说，保留条件解读' : '',
            literaryConjunction?.house === 3 && literaryConjunction.aspect === 'conjunction'
              ? '本命金星为上升主星，与海王星同座合相且同居第三宫。Leo 的同型命例以此作为写作和想象的参考' : '',
            p.natalPairHarmonious === true ? leoNatalFavourableText(p) : '',
            p.natalPairHarmonious === true ? '原文认为该本命相位会减轻本条作用'
              : p.natalPairHarmonious === false ? '本命同对未见三种已核的偏顺相位' : ''])
          : '';
      }
      case 'leo_solar_phase': {
        const target = bodies[p.natalTargetId], aspect = aspects[p.aspectType];
        if (p.profile !== 'leo-1906-solar-birthday-phases-v1' || !target || !aspect) return '';
        const phase = { 'applying-year': '成相前一生日年', 'formation-year': '实际成相所在生日年',
          'separating-year': '成相后一生日年' }[p.phase];
        const layer = { natal: '本命', progressed: '同图次限' }[p.targetKind];
        const timing = p.phase === 'natal-to-progressed' ? '次限太阳经过本命' + target + '的' + aspect + '后，正接续至对同图次限' + target + '的同一相位'
          : phase && layer ? '次限太阳与' + layer + target + '的' + aspect + '处于' + phase : '';
        const afflictions = p.natalJupiterAfflictionChecked === true ? leoNatalContactLabels(p.natalJupiterAfflictionContacts) : [];
        return sentences([
          timing,
          solarNeptuneNatalEvidence(p.solarNeptuneNatalEvidenceState),
          afflictions.length ? '本命木星的受克见证为' + afflictions.join('、') + '，原段据此下调合相的支持程度' : '',
          list(p.natalJupiterAfflictionContacts).some(contact => contact.first === 'Mars' || contact.second === 'Mars')
            ? '原段尤其指出来自火星的受克' : '',
        ]);
      }
      case 'leo_solar_lunar_phase': {
        const layer = { natal: '本命', progressed: '同图次限' }[p.targetKind];
        const target = bodies[p.natalTargetId], aspect = aspects[p.aspectType];
        const state = { none: '没有同层月相', all_favourable: '同层月相均偏顺', all_adverse: '同层月相均偏难',
          mixed: '同层月相有偏顺也有偏难', conditional: '同层月相含依情境判断的接触' }[p.sameLayerLunarState];
        const qualification = { strengthened: '原书将这项同期月相视为加强条件',
          moderated: '原书将这项同期月相视为缓和条件',
          'favourable-context': '短期表现可参考偏顺月相', 'adverse-context': '短期表现可参考偏难月相' }[p.lunarQualification];
        const finance = p.natalFinancialContext?.profile === 'leo-second-house-financial-testimony-v1' ? p.natalFinancialContext : undefined;
        const financeState = { support: '见六合或三分，未检出四分或对分', pressure: '见四分或对分，未检出六合或三分',
          mixed: '同时见六合或三分以及四分或对分', none: '未检出所查的四类相位' }[finance?.natalFinancialState];
        const directions = list(p.supportingDirections).flatMap(direction => {
          const label = leoDirectionText(direction);
          return label ? ['同期同层另有' + label + '，原书此项偏' + (direction.nature === 'favourable' ? '顺' : '难')] : [];
        });
        return p.profile === 'leo-1906-solar-lunar-phases-v1' && layer && target && aspect && state ? sentences([
          '次限太阳对' + layer + target + '的' + aspect + '在有效年段内，' + state,
          qualification,
          ...list(p.saturnLunarFamilyContextContacts).flatMap(row => row.target === 'Saturn' && aspects[row.aspectType]
            && typeof row.exactAt === 'string' && Number.isFinite(Date.parse(row.exactAt))
            ? ['同段同层次限月亮对' + layer + '土星精确形成' + aspects[row.aspectType]
              + '，时刻为' + at(row.exactAt) + '，供原书所述家事主题参考'] : []),
          p.hasExactSaturnLunarEighthHouseContext === true
            ? '该家事真点的次限月亮同时实际位于同层第八宫，可对照原书的亲友与失落主题' : '',
          ...list(p.saturnLunarSteadinessContacts).flatMap(row => row.target === 'Saturn' && ['sextile', 'trine'].includes(row.aspectType)
            && typeof row.exactAt === 'string' && Number.isFinite(Date.parse(row.exactAt))
            ? ['同段同层次限月亮对' + layer + '土星精确形成' + aspects[row.aspectType]
              + '，时刻为' + at(row.exactAt) + '，可参考原书所述稳定与坚持'] : []),
          ...list(p.saturnLunarWeakSteadinessContacts).flatMap(row => row.target === 'Saturn' && ['semisextile', 'quincunx'].includes(row.aspectType)
            && typeof row.exactAt === 'string' && Number.isFinite(Date.parse(row.exactAt))
            ? ['同段同层次限月亮对' + layer + '土星精确形成' + aspects[row.aspectType]
              + '，时刻为' + at(row.exactAt) + '，供原书所述较弱的沉着与节制参考'] : []),
          p.saturnLunarFamilyParallelContact?.target === 'Saturn' && p.saturnLunarFamilyParallelContact.targetKind === p.targetKind
            && p.saturnLunarFamilyParallelContact.aspectType === 'parallel' && p.saturnLunarFamilyParallelContact.allowedOrb === 1
            && p.saturnLunarFamilyParallelContact.coordinate === 'equatorial_declination_of_date'
            ? '同段同层次限月亮与' + layer + '土星在原书一度内实见赤纬平行，可参考家事背景' : '',
          ...list(p.neptuneTrineLunarSupportContacts).flatMap(row => row.target === 'Neptune' && ['sextile', 'trine'].includes(row.aspectType)
            && typeof row.exactAt === 'string' && Number.isFinite(Date.parse(row.exactAt))
            ? ['同段同层次限月亮对' + layer + '海王星精确形成' + aspects[row.aspectType] + '，时刻为' + at(row.exactAt)
              + (list(p.contacts).some(contact => contact.nature === 'adverse') ? '，同层另有已核偏难月相，月海真点仅供核对'
                : row.aspectType === 'sextile' ? '，供诗乐与信念主题参考' : '，供信念主题参考')] : []),
          ...list(p.neptuneTrineCrossLayerSolarContacts).flatMap(row => p.hasExactNeptuneTrineCrossLayerSolarSupport === true
            && row.passage === 'p228' && row.body === 'Sun' && row.target === 'Jupiter' && row.aspectType === 'sextile'
            && ['natal', 'progressed'].includes(row.targetKind) && row.targetKind !== p.targetKind
            && typeof row.exactAt === 'string' && Number.isFinite(Date.parse(row.exactAt))
            ? ['同一移动太阳在另一盘层精确六合木星'
              + (p.hasAdverseNeptuneTrineMoonContact === true || p.hasNeptuneTrineVenusMarsOpposition === true
                || p.hasNatalSecondRulerTwelfthHouseAffliction === true
                ? '，此真点仅供核对' : '，供原书的财务背景参考') + '。该木星为'
              + (row.targetKind === 'natal' ? '本命' : '同图次限') + '，时刻为' + at(row.exactAt)] : []),
          p.hasNeptuneTrineVenusMarsOpposition === true ? '同期次限金星对冲本命火星，原书另列财务阻力' : '',
          p.hasAdverseNeptuneTrineMoonContact === true
            && (p.neptuneTrineSupportType === 'major' || p.hasExactNeptuneTrineCrossLayerSolarSupport === true)
            ? '同层已见偏难月相，本片段只保留同期推运供核对' : '',
          p.otherDirection && !Array.isArray(p.supportingDirections) ? '同段另有太阳或行星推运，实算为' + leoDirectionText(p.otherDirection) : '',
          ...directions,
          p.hasUnreviewedOtherDirection === true ? '同层另有取义待核的主要推运' : '',
          ...leoNatalContactLabels(p.natalNeptuneCreativeTestimonies).map(label => label + '供原书另述的诗乐创作分支参考'),
          ...leoNatalContactLabels(p.natalSunNeptuneCreativeContacts).map(label => label + '，供原书所述乐感背景参考'),
          ...leoNatalContactLabels(p.natalMercuryVenusArtisticContacts).map(label => label + '可参考同作者的诗乐背景说法'),
          ...leoNatalContactLabels(p.natalNeptuneDevotionalContacts).map(label => label + '供原书另述的信念背景参考'),
          finance?.financeBasis === 'second_house_occupants' ? '原盘第二宫有实居星，财务部分查' + list(finance.anchors)
            .map(anchor => bodies[anchor.body]).filter(Boolean).join('、')
            : finance?.financeBasis === 'empty_second_house_ruler' && bodies[finance.secondRuler]
              ? '原盘第二宫无实居星，财务部分查第二宫主星' + bodies[finance.secondRuler] : '',
          financeState ? '按同作者1928年参考口径，本命财务相关位置' + financeState : '',
          ...leoNatalContactLabels(list(finance?.financialTestimonies).map(row => ({ ...row, second: row.body }))),
          ...list(finance?.rulerAfflictions).flatMap(row => bodies[finance.secondRuler] && bodies[row.ruler] && [5, 11].includes(row.house)
            && leoNatalAspectText(row) ? ['原书另列的本命第二宫主' + bodies[finance.secondRuler] + '与第' + row.house + '宫主'
              + bodies[row.ruler] + '为' + leoNatalAspectText(row)] : []),
          ...list(finance?.secondRulerTwelfthHouseAfflictions).flatMap(row => row?.house === 12 && bodies[row.ruler]
            && bodies[row.afflicted] && ['square', 'opposition'].includes(row.aspect) && leoNatalAspectText(row)
            ? ['本命第二宫主' + bodies[row.ruler] + '与实居第十二宫的' + bodies[row.afflicted]
              + '形成' + leoNatalAspectText(row) + '，原书另列财务阻力'] : []),
          p.natalTargetId === 'Saturn' && p.aspectType === 'quincunx' ? '同层月相仅作同期背景，实际影响仍需结合本人和亲友的情况' : '',
          ...list(p.contacts).flatMap(row => bodies[row.target] && aspects[row.aspectType]
            ? ['次限月亮同段对' + layer + bodies[row.target] + '形成' + aspects[row.aspectType]]
            : []),
        ]) : '';
      }
      case 'leo_progressed_aspect':
      case 'leo_progressed_aspect_exact': return p.profile !== 'leo-1906-source-context-v1' ? '' : sentences([
        p.hasSolarNeptuneExact === true ? '当前查询窗内日海' + (p.aspectType === 'parallel' ? '赤纬绝对值实达相等' : '黄经确有合相点') : '',
        p.hasSolarNeptuneExact === false ? '当前查询窗内只有日海相位带，精确点不在这段' : '',
        solarNeptuneNatalEvidence(p.solarNeptuneNatalEvidenceState),
        ...list(p.natalNeptuneClosestComparableLuminaryContacts).flatMap(row => bodies[row.luminary] && aspects[row.aspect]
          ? ['在本命' + bodies[row.luminary] + '同类相位中，海王星的' + aspects[row.aspect] + '最接近精确角'] : []),
        ...(p.progressedBody === 'Sun' && p.natalTargetId === 'Neptune'
          ? leoNatalContactLabels(p.natalNeptuneCreativeTestimonies).map(label => label + '供本命诗乐创作主题参考') : []),
        p.mercuryNeptuneParallelBandObserved === true ? '按原书的一度绝对赤纬差核到水海平行' : '',
        ...(p.mercuryNeptuneParallelBandObserved === true ? leoNatalContactLabels(p.natalNeptuneCreativeTestimonies)
          .map(label => label + '供已有诗文和音乐活动参考') : []),
        ...leoNatalContactLabels(list(p.natalNeptuneParallelAfflictionContacts).filter(row => ['square', 'opposition'].includes(row.aspect)))
          .map(label => label + '供原书偏难分支参考'),
        ...leoNatalContactLabels(p.natalNeptuneParallelFavourableConjunctions)
          .map(label => label + '，同座合相按同年原书列为偏顺佐证'),
        ...list(p.natalNeptuneParallelSupersededContacts).flatMap(row => bodies[row?.first] && row.second === 'Neptune'
          && row.aspect === 'parallel' && aspects[row.preferredAspect]
          ? ['本命' + bodies[row.first] + '与本命海王星优先参考' + aspects[row.preferredAspect]
            + '，同一本命星对已有较强黄经相位，赤纬平行不重复计入'] : []),
        ...leoNatalContactLabels(p.natalNeptuneParallelWeakAdverseContacts)
          .map(label => label + '，梅花相单列为较弱旁证'),
        ...leoNatalContactLabels(p.natalNeptuneParallelUnclassifiedContacts).map(label => label + '的作用仍待核'),
        ...leoNatalContactLabels(p.natalNeptuneParallelAdditionalAfflictionContacts)
          .map(label => label + '，供水海平行的过度投入分支参考'),
        ...leoNatalContactLabels(p.natalNeptuneParallelOverindulgenceContacts).map(label => label + '，供原书所述过度投入的条件性提醒参考'),
        ...leoNatalContactLabels(p.natalNeptuneParallelWeakFavourableContacts).map(label => label + '，半六合单列为较弱支持'),
        ...leoNatalContactLabels(p.natalNeptuneMinorAfflictionContacts).map(label =>
          label + '，本命海王星参与的半刑或倍半刑供偏难分支参考'),
        ...leoNatalContactLabels(p.natalMoonJupiterInvestment).map(label =>
          '本命水星实居第五宫，' + label + '，Leo与Green将这组位置和相位列为投机分支的候选依据'),
        ...leoNatalContactLabels(p.natalMoonJupiterDevotion).map(label =>
          label + '，Leo与Green将这类本命相位与信念和灵性兴趣相联'),
        ...([1, 3].includes(p.natalTargetHouse) && p.hasMarsNeptuneConjunctionExact === true
          ? leoNatalContactLabels(p.natalNeptuneCreativeTestimonies).map(label =>
            '次限火星与本命第' + (p.natalTargetHouse === 1 ? '一' : '三') + '宫海王星精确合相。'
            + label + (p.natalTargetHouse === 1 ? '同时提供诗乐和艺术方向的本命参考' : '同时提供想象、写作或艺术方向的本命参考'))
          : []),
        p.isMarsNeptuneConjunctionPoint === true && [1, 3, 9].includes(p.marsNeptuneCuspApproach?.nextHouse)
          && p.marsNeptuneCuspApproach.fromHouse === p.natalTargetHouse && degrees(p.marsNeptuneCuspApproach.distance)
          ? '本命海王星实在第' + p.natalTargetHouse + '宫，距前方第' + p.marsNeptuneCuspApproach.nextHouse
            + '宫头' + degrees(p.marsNeptuneCuspApproach.distance) + '，按 Leo 与 Green 的宫头口径另核后宫主题' : '',
        p.natalTargetHouse === 9 && p.isMarsNeptuneConjunctionPoint === true ? '次限火星精确合到本命第九宫海王星' : '',
        ...(p.isMarsNeptuneConjunctionPoint === true
          && ([1, 3, 9].includes(p.natalTargetHouse) || [1, 3, 9].includes(p.marsNeptuneCuspApproach?.nextHouse))
          ? p.hasNatalMarsNeptuneCreativeAffliction === false
            ? ['已核的本命海王星四分、对分、半刑和倍半刑均未检出']
            : leoNatalContactLabels(p.natalMarsNeptuneCreativeAfflictionContacts)
          : []),
        ...(p.progressedBody === 'Mercury' && p.natalTargetId === 'Neptune' && p.aspectType === 'sextile'
          ? leoNatalContactLabels(p.natalNeptuneCreativeTestimonies).map(label =>
            (p.hasMercuryNeptuneSextileExact === true ? '次限水星与本命海王星精确六合。' : '当前片段只列水海六合带。')
            + label + '是同一盘的创艺见证') : []),
        p.progressedBody === 'Mercury' && p.natalTargetId === 'Neptune' && p.aspectType === 'sextile'
          && p.natalTargetHouse === 3 && p.hasMercuryNeptuneSextileExact !== true
          ? '水海六合带内的本命海王星实居第三宫，保留写作与沟通背景供核对' : '',
        p.natalTargetHouse === 9 && p.hasMercuryNeptuneSextileExact === true
          ? '次限水星精确六合本命第九宫海王星，按 Leo 与 Green 的本命说明可参考想象和思想主题' : '',
        ...(p.progressedBody === 'Mercury' && p.natalTargetId === 'Neptune' && p.aspectType === 'parallel'
          ? leoNatalContactLabels(p.natalNeptuneCreativeTestimonies).map(label => label + '，供同期水海赤纬平行的创作主题参考') : []),
        ...leoNatalContactLabels(p.natalMercuryVenusArtisticContacts).map(label => label + '可参考同作者的诗乐背景说法'),
        p.natalTargetHouse === 1 && (p.hasMercuryNeptuneSextileExact === true || p.hasVenusNeptuneSemisextileExact === true)
          ? '本命海王星实居第一宫，按 Leo 与 Green 的升起海王星条可参考创艺倾向' : '',
        ...(p.mercuryNeptuneParallelBandObserved === true ? leoNatalContactLabels(p.natalNeptuneJupiterArtisticContacts)
          .map(label => label + '，供水海赤纬平行的创作主题参考') : []),
        p.natalMarsNeptuneElementMajorityWitness?.element === 'air'
          ? '精确火海合相时，本命风象星体为' + list(p.natalMarsNeptuneElementMajorityWitness.bodies).map(body => bodies[body]).filter(Boolean).join('、')
            + '，占九星中的' + list(p.natalMarsNeptuneElementMajorityWitness.bodies).length + '颗' : '',
        leoNatalMarsNeptuneStrengthText(p.natalMarsNeptuneStrength),
        leoNatalMercuryImpulsivenessText(p.natalMercuryImpulsivenessContacts),
        leoNatalMercuryNeptunePremiseText(p),
        ...[['艺术或音乐', p.natalVenusArtTestimonies], ['写作、研究或思考', p.natalMercuryMentalTestimonies],
          ['宗教或灵性兴趣', p.natalDevotionalTestimonies]].flatMap(([topic, contacts]) => leoNatalContactLabels(contacts)
          .map(aspect => aspect + '。Leo与Green的本命相位说明将这类相位与' + topic + '相联，可作本条的出生盘依据')),
        leoMercuryRuledHouseTopics(p),
        bodies[p.progressedBody] && bodies[p.natalTargetId] && aspects[p.aspectType]
          ? 'Leo口径的次限' + bodies[p.progressedBody] + (p.targetKind === 'progressed' ? '对同图次限' : '对本命')
            + bodies[p.natalTargetId] + '形成' + aspects[p.aspectType] : '',
        p.targetKind === 'progressed' ? '此条属于次限图内的两颗行星；涉及本命主题还需另外核对与本命的联系' : '',
        p.aspectType === 'parallel' ? sentences([
          degrees(p.progressedDeclination) ? '次限天体赤纬为' + degrees(p.progressedDeclination) : '',
          degrees(p.targetDeclination) ? '同图另一颗次限天体的赤纬为' + degrees(p.targetDeclination) : '',
          degrees(p.natalDeclination) ? '本命天体赤纬为' + degrees(p.natalDeclination) : '',
          '按原书计算页比较赤纬绝对值，一度以内计入，不要求南北同向；各自采用该星历日期的赤道',
          typeof p.sameHemisphere === 'boolean' ? '本段实际赤纬为' + (p.sameHemisphere ? '同向' : '异向') + '，与通用同向零点二五度规则分开' : '',
        ]) : sentences([
          degrees(p.progressedLongitude) ? '次限黄经为' + degrees(p.progressedLongitude) : '',
          degrees(p.targetLongitude) ? '同图另一颗次限天体的黄经为' + degrees(p.targetLongitude) : '',
          degrees(p.natalLongitude) ? '本命黄经为' + degrees(p.natalLongitude) : '',
          '黄经仍采用已声明的产品一度阈值，不能据此断言原书所有相位有统一容许度',
        ]),
        signs[p.natalBodySign] && signs[p.natalTargetSign] ? '两颗星的本命星座分别为' + signs[p.natalBodySign] + '、' + signs[p.natalTargetSign] : '',
        p.targetKind === 'natal' && bodies[p.progressedBody] && bodies[p.natalTargetId] && signs[p.progressedBodySign] && signs[p.natalTargetSign]
          ? '这段相位的次限' + bodies[p.progressedBody] + '在' + signs[p.progressedBodySign] + '，本命' + bodies[p.natalTargetId]
            + '在' + signs[p.natalTargetSign] + '，按本命宫头另核掌宫' : '',
        signs[p.conjunctionSign] ? '该有效段次限火星和本命海王星均位于' + signs[p.conjunctionSign] : '',
        p.progressedBody === 'Mars' && p.natalTargetId === 'Uranus' && p.aspectType === 'conjunction'
          ? list(p.natalPairAspects).filter(contact => contact?.aspect === 'conjunction').map(leoNatalAspectText)
            .filter(Boolean).map(label => '本命火星和本命天王星在同作者后版参考范围内另有' + label).join('、') : '',
        number(p.natalBodyHouse) !== undefined && number(p.natalTargetHouse) !== undefined
          ? '两颗星的本命时间分宫宫位分别为第' + p.natalBodyHouse + '宫、第' + p.natalTargetHouse + '宫' : '本命宫位依据未齐备',
        degrees(p.natalLongitudeSeparation) ? '两颗本命星的最短黄经夹角为' + degrees(p.natalLongitudeSeparation) + '，不据此直接判成亲疏或吉凶' : '',
        leoNatalTargetAspectsText(p) || sentences([leoNatalAfflictionText(p), leoNatalFavourableText(p)]) || leoNatalContactsText(p),
        leoNatalProminenceText(p),
        leoRulershipDescription(p.rulership),
        '已记录的本命背景与同期月亮几何关系不等于本命允许范围、同性质触发或原文反向分支已全部满足',
      ]);
      case 'leo_lunar_contact': return p.profile !== 'leo-1906-source-context-v1' ? '' : sentences([
        bodies[p.progressedBody] && bodies[p.natalTargetId] && aspects[p.aspectType]
          ? '次限' + bodies[p.progressedBody] + (p.targetKind === 'progressed' ? '对同图次限' : '对本命')
            + bodies[p.natalTargetId] + '的' + aspects[p.aspectType] + '作为背景' : '',
        bodies[p.lunarTargetId] && aspects[p.lunarAspectType] ? '同一时段次限月亮'
          + (p.lunarTargetKind === 'progressed' ? '对相关次限' : '对相关本命') + bodies[p.lunarTargetId] + '形成' + aspects[p.lunarAspectType] : '',
        list(p.lunarExactTimes).length ? '本段月亮精确成相时刻：' + p.lunarExactTimes.map(at).join('、') : '',
        '这里只核共同涉及天体及实际区间交集，尚未判为同性质、同领域或相互加强；不能把时间重叠直接写成外部事件已触发',
      ]);
      case 'leo_lunar_condition': {
        if (p.lunarProfile !== 'leo-1906-lunar-conditions-v1') return '';
        const states = { none: '该段未检出其他月亮相位', all_favourable: '已列的月亮相位均为偏顺',
          all_adverse: '已列的月亮相位均为偏难', mixed: '偏顺和偏难的月亮相位同时出现', conditional: '包含取义未定的月亮相位' };
        const moonLocation = p.moonPosition;
        const moonZodiac = zodiacPosition(moonLocation?.longitude, 'tropical');
        const otherDirection = leoDirectionText(p.otherDirection);
        const marsSaturnParallel = p.progressedBody === 'Mars' && p.natalTargetId === 'Saturn' && p.aspectType === 'parallel';
        const otherAdverseMoon = marsSaturnParallel && p.hasExactCleanMarsSaturnAdverseMoon === true
          ? leoDirectionText(p.exactCleanMarsSaturnAdverseMoon) : '';
        const marsJupiterAdverseMoon = p.hasExactCleanMarsJupiterOtherAdverseMoon === true
          ? leoDirectionText(p.exactCleanMarsJupiterOtherAdverseMoon) : '';
        const natalAdverseMoon = p.exactAdverseMoonToNatalEndpoint;
        const movingAdverseMoon = p.exactAdverseMoonToProgressedEndpoint;
        const exactAdverseMoon = ['mixed', 'conditional'].includes(p.sameLayerLunarState)
          && !(marsSaturnParallel && natalAdverseMoon?.aspectType === 'parallel') ? leoDirectionText(natalAdverseMoon) : '';
        const exactFavourableMoon = ['mixed', 'conditional'].includes(p.natalState) ? leoDirectionText(p.exactFavourableMoonToNatalEndpoint) : '';
        const lunarEndpointReview = p.sameLayerLunarState === 'conditional' ? '同层月相另有待核。' : '同层月相有顺有难；';
        const exactAdverseMovingMoon = p.progressedState === 'all_adverse' && !(marsSaturnParallel && movingAdverseMoon?.aspectType === 'parallel')
          ? leoDirectionText(movingAdverseMoon) : '';
        const exactFavourableMovingMoon = p.progressedState === 'all_favourable' ? leoDirectionText(p.exactFavourableMoonToProgressedEndpoint) : '';
        const exactLunarEndpoints = list(p.exactLunarLinkedBodies).filter(body => body === p.progressedBody || body === p.natalTargetId)
          .map(body => (body === p.progressedBody || p.targetKind === 'progressed' ? '次限' : '本命') + bodies[body]);
        const exactLunarPair = p.progressedBody === 'Mars' ? '火土半刑' : '金天';
        const mercuryMarsBackground = p.progressedBody === 'Mercury' && p.natalTargetId === 'Mars'
          && p.targetKind === 'natal' && p.aspectType === 'parallel'
          && (otherDirection || list(p.contacts).some(contact => contact?.targetKind === 'natal'));
        const contraryDirections = list(p.contraryDirections).map(leoDirectionText).filter(Boolean);
        const unreviewedContrary = list(p.unreviewedContraryDirections).map(leoDirectionText).filter(Boolean);
        const progressedContrary = list(p.progressedOtherPlanetContraryDirections).map(leoDirectionText).filter(Boolean);
        const progressedUnreviewed = list(p.progressedOtherPlanetUnreviewedDirections).map(leoDirectionText).filter(Boolean);
        const mercuryNeptuneOffset = number(p.mercuryNeptuneOffset);
        const sensitivity = { 'mercury-and-neptune': '本命水星与海王星均有已核显著见证',
          mercury: '本命水星有已核显著见证', neptune: '本命海王星有已核显著见证',
          unreviewed: '本命水星与海王星的敏感条件仍待核' }[p.mercuryNeptuneNatalSensitivityState];
        const prominence = p.natalMarsJupiterProminence;
        const prominenceBasis = { 'only-in-angular-house': '只有该星落本命第一、第十或第七宫',
          'one-dignified': '两星都位于所查角宫，仅该星在其入庙或擢升星座',
          'closer-dignified-cusp': '两星都位于所查角宫且入庙或擢升，该星距最近的所查角宫头更近' }[prominence?.basis];
        const [marsSign, saturnSign] = list(p.natalMutualDomicileSigns);
        const marsSaturnBalance = { 'harmonious-aspect': '本命火土的偏顺相位',
          'domicile-exchange': '本命火土互换入垣守护位置', both: '本命火土的偏顺相位和互换入垣守护位置' }[p.marsSaturnNatalBalanceBasis];
        const isSolarVenusParallel = p.progressedBody === 'Sun' && p.natalTargetId === 'Venus' && p.aspectType === 'parallel';
        const lunarVenusTrigger = isSolarVenusParallel && list(p.lunarFavourableTargets).includes('Venus');
        const finance = p.natalFinancialContext?.profile === 'leo-second-house-financial-testimony-v1' ? p.natalFinancialContext : undefined;
        const financeStates = { support: '见六合或三分，未检出四分或对分', pressure: '见四分或对分，未检出六合或三分',
          mixed: '同时见六合或三分以及四分或对分', none: '未检出所查的四类相位' };
        const financeContacts = list(finance?.financialTestimonies).map(row => ({ ...row, second: row.body }));
        const monthly = p.monthlyThemeEvidence;
        const monthlyTopic = { monthlyAttachment: '情感联系', monthlyFinance: '金钱与资源' }[monthly?.topic];
        return sentences([
          bodies[p.progressedBody] && bodies[p.natalTargetId] && leoAspectLabel(p.aspectType) ? '次限' + bodies[p.progressedBody]
            + (p.targetKind === 'progressed' ? '对同图次限' : '对本命') + bodies[p.natalTargetId] + '的' + leoAspectLabel(p.aspectType) + '有效段内' : '',
          p.mutualExactInSlice === true ? '本段含基础推运的实际成相点，另查同期推运能否加强' : '',
          p.marsSaturnParallelBandObserved === true ? '在原书一度范围内，火土赤纬平行的背景仍保留' : '',
          p.hasMarsSaturnTrineAtParallel === true ? '同一盘层火土三分实际成相，与一度赤纬平行同段，供行动与节制的主题参考' : '',
          p.hasMarsSaturnReviewedMixedOrFavourableMoon === true ? '两层所见同期月相均已分类，并查到偏顺月相' : '',
          otherAdverseMoon ? '火土平行有效段内，' + otherAdverseMoon + '实际成相，'
            + (p.exactCleanMarsSaturnAdverseMoon?.target === 'Neptune' && p.exactCleanMarsSaturnAdverseMoon?.targetKind === 'progressed'
              ? '这一次同图月海四分按月亮篇列为偏难，两层其余已核月相无偏顺或待分类接触'
              : '两层已核月相无偏顺或待分类接触') : '',
          marsJupiterAdverseMoon ? '火木梅花有效段内，' + marsJupiterAdverseMoon + '实际成相，两层已核月相无偏顺或待分类接触' : '',
          p.hasMarsJupiterAdverseLunarParallelActivation === true
            ? list(p.marsJupiterAdverseLunarParallelContacts).map(leoDirectionText).filter(Boolean)
              .map(label => label + '在火木梅花有效段内持续处于一度绝对赤纬平行带').join('、') : '',
          p.hasExactCleanNeptuneLunarSesquiquadrate === true && p.exactCleanNeptuneLunarSesquiquadrate
            ? '同期' + leoDirectionText(p.exactCleanNeptuneLunarSesquiquadrate) + '实际成相，两层其余已核月相未见偏顺或待分类项' : '',
          p.hasExactCleanNeptuneLunarSemisquare === true && p.exactCleanNeptuneLunarSemisquare
            ? '同期' + leoDirectionText(p.exactCleanNeptuneLunarSemisquare) + '实际成相，月海半刑属弱相，两层其余已核月相未见偏顺或待分类项' : '',
          p.hasCleanAdverseMoonNeptuneActivation === true ? '次限月亮精确四分本命海王星，本命和次限两层所查同期月相按原篇均只见偏难条件' : '',
          marsSaturnBalance ? '同时核到' + marsSaturnBalance + '，本命缓和仅限制偏难读法' : '',
          p.marsSaturnNatalBalanceBasis === 'no-reviewed-mitigation' ? '同一本命火土未见已核偏顺相位或互入守护座' : '',
          p.hasMarsSaturnAdverseLunarActivation === true ? '本段另有符合已核分支的偏难月相引动' : '',
          p.hasMarsSaturnAdverseLunarParallelActivation === true
            ? list(p.marsSaturnAdverseLunarParallelContacts).map(leoDirectionText).filter(Boolean)
              .map(label => label + '在同一火土有效段内持续处于一度绝对赤纬平行带').join('、') : '',
          ...([natalAdverseMoon, movingAdverseMoon].filter(row => marsSaturnParallel && row?.aspectType === 'parallel')
            .map(leoDirectionText).filter(Boolean).map(label => '火土平行有效段内，' + label + '实际成相，供原书月亮引动条件参考')),
          exactAdverseMoon ? lunarEndpointReview + '这一秒核到' + exactAdverseMoon + '精确成相' : '',
          exactFavourableMoon ? '整段月相含其他条件，这一秒单独核到偏顺的' + exactFavourableMoon + '精确成相' : '',
          exactAdverseMovingMoon ? '两颗次限星层已核月相均偏难；这一秒核到' + exactAdverseMovingMoon + '精确成相' : '',
          exactFavourableMovingMoon ? '同图已核月相均偏顺；这一秒核到' + exactFavourableMovingMoon + '精确成相' : '',
          sensitivity ?? '',
          sensitivity && states[p.mercuryNeptuneLunarSupportState]
            ? '水海半六合相关月相：' + states[p.mercuryNeptuneLunarSupportState] : '',
          ...list(p.unreviewedMutualMajorDirections).flatMap(direction => {
            const label = leoDirectionText(direction);
            return label ? ['同段' + label + '的原书取义仍待核'] : [];
          }),
          p.venusJupiterLunarLinkState === 'unreviewed' ? '该金木相位与同段其他推运之间的月亮连接仍待核' : '',
          p.venusJupiterLunarLinkState === 'no-reviewed-link' ? '在已核同期推运范围内未见与金木相位相连的月相' : '',
          p.venusJupiterSupportScope === 'both-chart-planetary-pairs' ? '金木同期主要方向分别核次限对本命与同图次限两层' : '',
          ({
            'linked-support': '金木合相、同期偏顺推运与同一月亮接触均有已核连接',
            'lunar-support': '金木合相同期核到独立的偏顺月相',
            'indirect-candidate': '金木合相同期有已核偏顺推运，所核范围未见月亮连接，可参考间接表现',
            unreviewed: '金木合相同期影响仍待核，暂留原文的温和倾向',
            basic: '金木合相只核到原文的温和倾向',
          })[p.venusJupiterEffectState] ?? '',
          p.natalMercuryAngularDominance?.body === 'Mercury' && number(p.natalMercuryAngularDominance.house) !== undefined
            ? '本命水星实居第' + p.natalMercuryAngularDominance.house + '宫，按同作者的角宫排序列为主导候选' : '',
          ...list(p.favourableNatalNeptuneLunarContacts).flatMap(row => row.target === 'Neptune' && row.targetKind === 'natal'
            && ['sextile', 'trine'].includes(row.aspectType)
            ? ['同段次限月亮对本命海王星形成' + aspects[row.aspectType] + '，作为原文的月亮助力候选'] : []),
          monthlyTopic && list(monthly.lunarExactTimes).length
            ? '这段月亮相位的实际精确点为' + monthly.lunarExactTimes.map(at).join('、') : '',
          monthly?.hasExact === true && p.sameLayerSolarDirectionState === 'adverse'
            ? '精确月日' + (p.aspectType === 'square' ? '刑相' : '对冲') + '所在的同一盘层片段有已核偏难太阳推运，供原文的加强分支参阅' : '',
          monthly?.hasExact === true && p.natalTargetId === 'Venus' && p.aspectType === 'trine' && p.monthlyLunarMajorState === 'favourable'
            ? '精确月金三合所在的同一片段有已核的偏顺情感主题主要推运' : '',
          p.monthlyLunarQualification === 'base' ? '同一时段核到基础倾向，原书另述的加强方向未达条件' : '',
          p.monthlyLunarQualification === 'strengthened' && p.natalTargetId !== 'Sun' && p.aspectType !== 'trine'
            ? '同一时段另有原书的加强条件' : '',
          p.concurrentSolarJupiterSquare === true ? '太阳平行木星的同层同段另有太阳四分木星' : '',
          ...list(monthly?.exactFrames).flatMap(frame => {
            const target = bodies[p.natalTargetId];
            if (!target || number(frame?.moonHouse) === undefined || number(frame.targetHouse) === undefined) return [];
            const label = frame.targetKind === 'progressed' ? '本年的次限盘' : '出生本命盘';
            const ruledHouses = list(frame.targetRuledHouses).filter(house => Number.isInteger(house))
              .map(house => '第' + house + '宫').join('、');
            return [
              '精确成相时按' + label + '的实际宫头，次限月亮在第' + frame.moonHouse + '宫，受照' + target + '在第' + frame.targetHouse + '宫',
              /^\d{4}-\d{2}-\d{2}$/u.test(frame.appendixDate?.date)
                ? '按 Leo 附录 V 查格林尼治正午，另得成相日期候选' + frame.appendixDate.date : '',
              ruledHouses ? '按同作者后版星座守护表，' + target + '在这张盘主管' + ruledHouses : '',
              ...list(frame.radicalContacts).flatMap(contact => {
                const point = Number.isInteger(contact?.target) ? '本命第' + contact.target + '宫头' : bodies[contact?.target];
                const aspect = leoAspectLabel(contact?.aspectType);
                return point && aspect && bodies[contact?.body]
                  ? ['同一精确时刻次限' + bodies[contact.body] + '还与' + point + '形成' + aspect + '，在产品一度范围内'] : [];
              }),
            ];
          }),
          ...list(monthly?.majorDirections).flatMap(direction => {
            const text = leoDirectionText(direction);
            return monthlyTopic && text && leoLunarNatures[direction.nature]
              ? ['同段的' + monthlyTopic + '主要推运见' + text + '，' + leoLunarNatures[direction.nature]] : [];
          }),
          monthlyTopic && monthly.majorState === 'mixed' ? '该主题同时见偏顺和偏难的主要推运' : '',
          ...list(p.contacts).flatMap(contact => contact && bodies[contact.target] && leoAspectLabel(contact.aspectType) && leoLunarNatures[contact.nature]
            ? ['次限月亮' + (contact.targetKind === 'progressed' ? '对同图次限' : '对本命') + bodies[contact.target] + '形成'
              + leoAspectLabel(contact.aspectType) + '，' + leoLunarNatures[contact.nature]
              + (list(contact.exactTimes).length ? '，精确点为' + contact.exactTimes.map(at).join('、') : '')] : []),
          states[p.natalState] ? '次限月亮对本命这一层，' + states[p.natalState] : '',
          states[p.progressedState] ? '次限月亮对同图次限这一层，' + states[p.progressedState] : '',
          mercuryNeptuneOffset ? '按黄道顺序，次限水星在本命海王星的' + (mercuryNeptuneOffset < 0 ? '后方' : '前方')
            + degrees(Math.abs(mercuryNeptuneOffset)) : '',
          leoNatalProminenceText(p),
          prominenceBasis && ['Mars', 'Jupiter'].includes(prominence.candidate)
            ? '按Leo与Green的本命角宫比较，' + bodies[prominence.candidate] + '较显著，' + prominenceBasis : '',
          prominence?.dominant && bodies[p.natalMarsJupiterDominantBody] && number(prominence.dominant.house) !== undefined
            ? '按原书的全盘角宫比较，本命' + bodies[p.natalMarsJupiterDominantBody] + '实居第' + prominence.dominant.house + '宫并居首位' : '',
          p.natalMarsJupiterSquareRepeated === true ? '本命火星与本命木星也在已核外限内形成四分，构成同一星对本命与推运四分的对照' : '',
          ...[prominence?.first, prominence?.second].flatMap(row => bodies[row?.body] && signs[row.sign] && number(row.house) !== undefined
            ? ['本命' + bodies[row.body] + '在' + signs[row.sign] + '第' + row.house + '宫'
              + ({ domicile: '入庙', exaltation: '擢升' }[row.dignity] ?? '')
              + (number(row.distance) === undefined ? '' : '，在所查角宫头中距第' + row.cuspHouse + '宫头最近，相差' + degrees(row.distance))] : []),
          p.natalMutualDomicileExchange === true && signs[marsSign] && signs[saturnSign]
            ? '本命火星在土星守护的' + signs[marsSign] + '，本命土星在火星守护的' + signs[saturnSign]
              + '。两星构成换座互守，该段从无本命缓和证据的候选中扣除' : '',
          finance?.financeBasis === 'second_house_occupants' ? '原盘第二宫有实居星，财务部分查' + list(finance.anchors)
            .map(anchor => bodies[anchor.body]).filter(Boolean).join('、')
            : finance?.financeBasis === 'empty_second_house_ruler' && bodies[finance.secondRuler]
              ? '原盘第二宫无实居星，财务部分查第二宫主星' + bodies[finance.secondRuler] : '',
          financeStates[finance?.natalFinancialState] ? '按同作者1928年参考口径，本命财务相关位置' + financeStates[finance.natalFinancialState] : '',
          ...leoNatalContactLabels(p.natalMoonJupiterPromise).map(label =>
            label + '，是Leo与Green所列交往与友谊的本命候选依据'),
          p.hasCleanLunarJupiterSupport === true
            ? '本段另有已核偏顺的同层推运，已列主要推运未见偏难，同层月亮也未列偏难或取义未定的相位' : '',
          ...leoNatalContactLabels(financeContacts),
          ...list(finance?.rulerAfflictions).flatMap(row => bodies[finance.secondRuler] && bodies[row.ruler] && [5, 11].includes(row.house)
            && leoNatalAspectText(row) ? ['原书另列的本命第二宫主' + bodies[finance.secondRuler] + '与第' + row.house + '宫主'
              + bodies[row.ruler] + '为' + leoNatalAspectText(row)] : []),
          moonZodiac && moonLocation?.targetKind === 'natal' ? '该方向的本命月亮位置为' + moonZodiac
            : moonZodiac && moonLocation?.targetKind === 'progressed' && moonLocation.sampleAt
              ? '在' + at(moonLocation.sampleAt) + '取样，同图次限月亮位于' + moonZodiac : '',
          ...list(p.supportingDirections).flatMap(direction => {
            const label = leoDirectionText(direction);
            return label && ['favourable', 'adverse'].includes(direction.nature)
              ? ['同段另一条推运是' + label + '，原书此项偏' + (direction.nature === 'favourable' ? '顺' : '难')] : [];
          }),
          ...[['投资与投机', p.speculationDirections], ['旅行', p.travelDirections],
            ['写作与文书', p.correspondenceDirections], ['交往与友谊', p.friendshipDirections],
            ['思考与学习', p.studyDirections], ['争执', p.disputeDirections], ['玄学与心灵体验', p.metaphysicalDirections],
            ['迁居与变动', p.relocationDirections]].flatMap(([topic, directions]) => list(directions).flatMap(direction => {
            const label = leoDirectionText(direction);
            return label && ['favourable', 'adverse'].includes(direction.nature)
              ? [topic + '议题的同期推运为' + label + '，原书此项偏' + (direction.nature === 'favourable' ? '顺' : '难')] : [];
          })),
          ...list(p.uranianMetaphysicalMutualDirections).map(leoDirectionText).filter(Boolean).map(direction =>
            '同段的' + direction + '也指向同一本命天王星，原书将它与原创思考和玄学研究相联'),
          p.hasExactUranianMetaphysicalSolarDirection === true && leoDirectionText(p.uranianMetaphysicalSolarDirection)
            ? '日天平行带内还有' + leoDirectionText(p.uranianMetaphysicalSolarDirection) + '真点'
              + (p.uranianMetaphysicalSolarDirection.aspectType === 'semisextile' ? '，作为同层较弱的同主题证据' : '，作为同层同主题证据') : '',
          p.hasExactUranianMetaphysicalMercuryDirection === true && leoDirectionText(p.uranianMetaphysicalMercuryDirection)
            ? '日天平行带内还有' + leoDirectionText(p.uranianMetaphysicalMercuryDirection) + '真点，作为同层'
              + (p.uranianMetaphysicalMercuryDirection.aspectType === 'semisextile' ? '较弱的' : '') + '同主题证据' : '',
          p.hasExactUranianMetaphysicalVenusDirection === true && leoDirectionText(p.uranianMetaphysicalVenusDirection)
            ? '日天平行带内还有' + leoDirectionText(p.uranianMetaphysicalVenusDirection) + '真点，作为同层同主题证据' : '',
          p.hasExactUranianMetaphysicalMoonDirection === true && leoDirectionText(p.uranianMetaphysicalMoonDirection)
            ? '日天平行带内还有' + leoDirectionText(p.uranianMetaphysicalMoonDirection) + '真点' : '',
          [8, 9].includes(p.uranianMetaphysicalMoonHouse) && ['natal', 'progressed'].includes(p.targetKind)
            ? '日天平行带内，次限月亮实际经过同一' + (p.targetKind === 'natal' ? '本命' : '次限')
              + '盘第' + (p.uranianMetaphysicalMoonHouse === 8 ? '八' : '九') + '宫' : '',
          p.hasExactUranianMetaphysicalMoonConjunction === true && leoDirectionText(p.uranianMetaphysicalMoonConjunction)
            ? '日天平行带内还有' + leoDirectionText(p.uranianMetaphysicalMoonConjunction) + '真点，按原书结合本人是否已有相关实践' : '',
          p.hasExactUranianMetaphysicalMinorMoonDirection === true && leoDirectionText(p.uranianMetaphysicalMinorMoonDirection)
            ? '日天平行带内还有' + leoDirectionText(p.uranianMetaphysicalMinorMoonDirection) + '真点，作为较弱同题证据' : '',
          p.hasUranianMetaphysicalMercuryLunarWitness === true && leoDirectionText(p.uranianMetaphysicalMercuryLunarDirection)
            ? '次限水星对本命天王星实际形成半六合时，' + leoDirectionText(p.uranianMetaphysicalMercuryLunarDirection)
              + '也在有效带内' : '',
          ...list(p.crossChartDirections).flatMap(link => {
            const direction = leoDirectionText(link?.direction), natal = leoDirectionText(link?.natalContact);
            const point = bodies[link?.progressedPoint], nature = { favourable: '原书此项偏顺', adverse: '原书此项偏难' }[link?.direction?.nature];
            if (!direction || !natal || !point || !nature) return [];
            return [p.targetKind === 'natal'
              ? '另一盘层同期有' + direction + '，' + nature + '。其实际端点次限' + point + '也形成' + natal
              : '另一盘层同期有' + natal + '，' + nature + '，与本条共用次限' + point + '的位置'];
          }),
          otherDirection ? '同段另有太阳或行星推运，实算为' + otherDirection : '',
          mercuryMarsBackground ? '原书将次限水星与本命火星的赤纬平行作为同段其他推运的持续背景' : '',
          contraryDirections.length ? '与本条同时生效的已核反向推运为' + contraryDirections.join('、') : '',
          unreviewedContrary.length ? '同段仍有性质未核的接触为' + unreviewedContrary.join('、') + '，更强的顺利程度待核' : '',
          p.natalOtherPlanetPairScope === 'all-other-directed-pairs' ? '同段另核九曜间从次限到本命的有向组合，未分类的接触仍须复核'
            : p.natalOtherPlanetPairScope === 'non-luminary-unrelated-directed-pairs' ? '次限对本命另查除日月金海外的有向星对' : '',
          progressedContrary.length ? '同图次限的其他行星对在本段另有偏难相位，实查为' + progressedContrary.join('、') : '',
          p.progressedOtherPlanetPairScope === 'all-other-pairs' ? '同图次限检查九曜配对，含独立的同图金海接触及木土天海的慢行星对'
            : p.progressedOtherPlanetPairScope === 'non-luminary-unrelated-pairs' ? '同图次限另查除日月金海外的行星对，含木土、木天及土天' : '',
          progressedUnreviewed.length ? '同图次限另有性质未核的行星相位为' + progressedUnreviewed.join('、') : '',
          contraryDirections.length || progressedContrary.length ? '本段仅保留金海相位的基础倾向' : '',
          p.contraryReviewState === 'clear' && p.progressedOtherPlanetContraryReviewState === 'clear'
            ? '本段已核范围内未见同期反向推运，更强的和悦倾向仍依原文其余条件' : '',
          ...leoNatalContactLabels(p.natalSolarContacts).map(label => '出生盘太阳在同作者参考外限内的相位为' + label),
          p.natalSolarDignity?.sign === 4 && p.natalSolarDignity.kind === 'domicile' ? '本命太阳在狮子座入庙' : '',
          p.natalSolarDignity?.sign === 0 && p.natalSolarDignity.kind === 'exaltation' ? '本命太阳在白羊座擢升' : '',
          ...list(p.progressedSolarContacts).map(leoDirectionText).filter(Boolean)
            .map(label => '同一有效段另查到' + label),
          p.progressedSolarDignity?.sign === 4 && p.progressedSolarDignity.kind === 'domicile' ? '同一有效段的次限太阳在狮子座入庙' : '',
          p.progressedSolarDignity?.sign === 0 && p.progressedSolarDignity.kind === 'exaltation' ? '同一有效段的次限太阳在白羊座擢升' : '',
          leoBridgeText(p.lunarBridge),
          ...[p.adverseSequence?.first, p.adverseSequence?.second].flatMap((contact, index) =>
            bodies[contact?.target] && aspects[contact.aspectType] && contact.start
              ? ['连续偏难相位的第' + (index + 1) + '项在本次计算中从' + at(contact.start) + '起有效，为月亮对'
                + (p.targetKind === 'progressed' ? '同图次限' : '本命') + bodies[contact.target] + '的' + aspects[contact.aspectType]] : []),
          ...list(p.luminaryLinks).flatMap(link => ['Sun', 'Moon'].includes(link?.body) && ['Mars', 'Saturn'].includes(link.target)
            && ['natal', 'progressed'].includes(link.targetKind) && leoAspectLabel(link.aspectType) ? ['同段次限' + bodies[link.body] + '照到这对星的'
              + (link.targetKind === 'progressed' ? '次限' : '本命') + bodies[link.target] + '，形成' + leoAspectLabel(link.aspectType)] : []),
          ...leoNatalAbilityText(p.natalAbilityContacts),
          ...leoNatalContactLabels(p.natalMercuryBroadStudyContacts).map(aspect => aspect
            + '。Leo与Green将这类本命水星木星相位与开阔思路及学习相联，可供本条玄学研究分支参考'),
          leoNatalMercuryImpulsivenessText(p.natalMercuryImpulsivenessContacts),
          leoNatalAfflictionText(p) || leoNatalFavourableText(p) || leoNatalContactsText(p),
          p.progressedBody === 'Sun' && p.natalTargetId === 'Jupiter' && p.aspectType === 'parallel'
            && list(p.lunarFavourableTargets).includes('Jupiter')
            ? '该段具备原书太阳木星平行条目点名的月亮对同层木星偏顺相位' : '',
          p.progressedBody === 'Sun' && p.natalTargetId === 'Saturn' && p.aspectType === 'semisquare'
            && list(p.lunarAdverseTargets).includes('Saturn')
            ? '该段具备太阳半刑土星条目点名的月亮对同层土星偏难相位' : '',
          lunarVenusTrigger ? '该段具备太阳平行金星条目点名的月亮对同层金星偏顺相位' : '',
          isSolarVenusParallel && list(p.supportingDirections).some(direction => direction.nature === 'favourable')
            ? '与太阳或金星共享实际端点的偏顺推运用于合参，具体时段另看月亮照金星' : '',
          p.progressedBody === 'Sun' && p.natalTargetId === 'Uranus' && p.aspectType === 'parallel'
            && list(p.lunarLinkedBodies).includes('Uranus')
            ? '同段次限月亮也照到太阳平行所指的' + (p.targetKind === 'progressed' ? '同图次限' : '本命') + '天王星' : '',
          p.progressedBody === 'Venus' && p.natalTargetId === 'Uranus' && p.aspectType === 'quincunx'
            && (list(p.lunarLinkedBodies).includes('Venus') || list(p.lunarLinkedBodies).includes('Uranus'))
            ? '同段月亮实际接触这个次限相位的' + list(p.lunarLinkedBodies).filter(body => ['Venus', 'Uranus'].includes(body))
              .map(body => body === 'Venus' || p.targetKind === 'progressed' ? '次限' + bodies[body] : '本命' + bodies[body]).join('、') : '',
          exactLunarEndpoints.length ? exactLunarPair + '有效段内查到次限月亮与' + exactLunarEndpoints.join('、') + '的精确成相' : '',
          p.progressedBody === 'Venus' && p.natalTargetId === 'Uranus' && p.aspectType === 'quincunx' && p.mutualExactInSlice === true
            ? '次限金星对' + (p.targetKind === 'progressed' ? '同图次限' : '本命')
              + '天王星实际形成梅花相，原书列作较弱背景。明显表现仍须相应同期证据' : '',
          p.hasVenusUranusParallelAtFormation === true ? '金天梅花实际成相时，同一星对也处在原书一度赤纬平行带' : '',
          ...list(p.pairLuminaryLinksComplete === true ? p.exactSolarEndpointContacts : undefined).flatMap(direction => {
            const label = leoDirectionText(direction);
            return label ? ['火土半刑有效段内，' + label + '实际成相，同段次限月亮也接触相关火土'] : [];
          }),
          ...list(p.pairLuminaryLinksComplete === false ? p.exactSolarEndpointContacts : undefined).flatMap(direction => {
            const label = leoDirectionText(direction);
            return label ? ['火土半刑有效段内，' + label + '实际成相，只供准备倾向参考，显化仍须月亮合参'] : [];
          }),
          p.exactUranianSensitivityDirection === true ? '金天有效段内，次限太阳精确对冲同一' + (p.targetKind === 'progressed' ? '次限' : '本命') + '天王星' : '',
          p.hasUranianMoonSolarActivation === true
            ? '月亮实际引动金天梅花时，次限太阳对同一' + (p.targetKind === 'progressed' ? '次限' : '本命')
              + '天王星的对冲也在有效段内，可合参日月两项见证' : '',
          p.hasUranianLunarParallelActivation === true && p.uranianLunarParallelActivation?.passage === 'p214'
            ? '金天梅花有效段与次限月亮对同一' + (p.targetKind === 'progressed' ? '次限' : '本命') + '天王星的一度赤纬平行重合' : '',
          p.hasConcurrentUranianSensitivityDirection === true
            ? '月天精确成相时，次限太阳正在与同一' + (p.targetKind === 'progressed' ? '次限' : '本命')
              + '天王星形成对冲有效段，供核同期推运' : '',
          leoDirectionText(p.venusNeptuneSensitivityDirection)
            ? '金天梅花有效段内，' + leoDirectionText(p.venusNeptuneSensitivityDirection) + '实际成相，作为同主题旁证' : '',
          leoDirectionText(p.progressedVenusNeptuneSensitivityDirection)
            ? '金天梅花有效段内，' + leoDirectionText(p.progressedVenusNeptuneSensitivityDirection) + '实际成相，作为同主题旁证' : '',
          leoDirectionText(p.moonNeptuneSensitivityDirection)
            ? '金天梅花有效段内，' + leoDirectionText(p.moonNeptuneSensitivityDirection) + '实际成相，作为同主题旁证' : '',
          '本命领域、整盘是否同性质及现实结果仍须另核',
        ]);
      }
      case 'ptolemy_time_place': return sentences([
        timingOrigins[p.origin] ? '以' + timingOrigins[p.origin] + '为起算点' : '',
        timingLevels[p.level] && signs[p.sign] ? '托勒密候选' + timingLevels[p.level] + '级时限位置在' + signs[p.sign] : '',
        bodies[p.ruler] ? '该星座的守护星为' + bodies[p.ruler] : '',
        ptolemyParentRulers(p),
        ptolemyNatalRulers(p),
        ptolemyPrimaryDirection(p),
        number(p.completedYears) !== undefined ? '从出生已满' + p.completedYears + '个周年' : '',
        '按一年一宫、28天一宫、二又三分之一天一宫计算；年与子段采用本次声明的UTC周年及重置口径，原书边界解释仍待核',
        p.fullPeriodStart && p.fullPeriodEnd ? '该完整时限段从' + at(p.fullPeriodStart) + '至' + at(p.fullPeriodEnd) : '',
        '带黄纬的完整球面取法与原文议题仍待核',
      ]);
      case 'ptolemy_ingress_contact': return sentences([
        p.level === 'authorTerm' && timingOrigins[p.origin] && signs[p.primarySign] && bodies[p.term?.ruler]
          ? '以' + timingOrigins[p.origin] + '起算，按卷一托勒密表，本段主限在' + signs[p.primarySign]
            + '的' + degrees(p.term.start) + '至' + degrees(p.term.end) + '界。界主为' + bodies[p.term.ruler]
            + '，实际行经' + (p.authorTermLevel === 'primary' ? '总体主限' : '年度') + '星座'
            + (p.termTableAgreement === 'same-ruler' ? '，两表在此段得到同一界主'
              : p.termTableAgreement === 'different-ruler' && bodies[p.egyptianTermRuler]
                ? '，另用埃及表同段得' + bodies[p.egyptianTermRuler] + '为界主'
                : p.termTableAgreement === 'egyptian-unavailable' ? '，同段埃及界位未核得' : '') : '',
        p.level === 'authorTerm' && p.sameAsNatalAuthorTermRuler === true && bodies[p.authorNatalTermRuler]
          ? '按同一托勒密表，' + bodies[p.authorNatalTermRuler] + '亦主同一起点的本命原位之界' : '',
        p.level === 'primary' && timingOrigins[p.origin] ? '本条对应以' + timingOrigins[p.origin] + '起算的总体主限位置'
          : timingOrigins[p.origin] && timingLevels[p.level] ? '本条对应以' + timingOrigins[p.origin] + '起算的' + timingLevels[p.level] + '级时限位置' : '',
        bodies[p.transitBody] && signs[p.transitSign] ? '实际行运' + bodies[p.transitBody] + '位于' + signs[p.transitSign] : '',
        signs[p.sign] && aspects[p.aspectType] ? '与本条时限位置所在的' + signs[p.sign] + '构成整星座' + aspects[p.aspectType] : '',
        p.level === 'month' && ['square', 'opposition'].includes(p.transitMonthlyAspect)
          && [p.transitAnnualAspect, p.transitNatalOriginAspect].every(value => ['none', 'conjunction', 'sextile', 'trine'].includes(value))
          ? '当段实际刑冲只及同一月位，年位与本命原位另核各自关系' : '',
        p.level === 'day' && p.dayManuscriptMoonContact === true && signs[p.alternateManuscriptDaySign]
          ? '按注82的二又二分之一天读法，月亮实际与手稿日位同在' + signs[p.alternateManuscriptDaySign]
            + (p.dayManuscriptAgreement === 'same-place' ? '，这段也与正文日位一致' : '，两种日位取法分别核对') : '',
        p.level === 'day' && p.dayManuscriptMoonContact === true && p.dayManuscriptPeriodStart && p.dayManuscriptPeriodEnd
          ? '手稿日位从' + at(p.dayManuscriptPeriodStart) + '至' + at(p.dayManuscriptPeriodEnd) : '',
        p.level === 'day' && p.dayManuscriptMoonContact === true && p.dayManuscriptEnteredDuringTimedPlace === true && p.dayManuscriptIngressAt
          ? '月亮实际在手稿日段内入座，时刻为' + at(p.dayManuscriptIngressAt) : '',
        p.level !== 'primary' && bodies[p.ruler] ? '该级时限星座的守护星为' + bodies[p.ruler] : '',
        ptolemyParentRulers(p),
        ptolemyNatalRulers(p),
        ptolemyPrimaryDirection(p),
        ptolemyIngressRelation(p),
        p.transitBody === 'Mercury' && p.natalMercuryHorizon?.sect === 'night'
          ? '同一本命的水星日落时在当地地平线上，按原书属夜派'
          : p.transitBody === 'Mercury' && p.natalMercuryHorizon?.sect === 'day'
            ? '同一本命的水星日出时在当地地平线上，按原书属昼派' : '',
        p.level === 'month' && p.natalAuthorTermProfile === 'robbins-I.21-author-half-open-bounds'
          && p.sameAsNatalAuthorTermRuler === true && p.governsNatalOrigin === false && bodies[p.transitBody]
          ? '按托勒密本命界表，' + bodies[p.transitBody] + '是同一起点的本命界主' : '',
        p.level === 'month' && p.sameAsNatalAuthorTermRuler === true && p.governsNatalOrigin === false
          && (p.transitBody === 'Mercury' ? p.sameNatalMercuryHorizonSect === false : p.oppositeNatalSect === true)
          && ['square', 'opposition'].includes(p.aspectType)
          && (['square', 'opposition'].includes(p.natalOriginAspect) || p.natalOriginSignFamiliarity === 'alien')
          ? '本命界表有分歧，本段实际刑冲只供核对' : '',
        p.natalFortuneSaturnJupiterWitness && signs[p.natalFortuneSaturnJupiterWitness.saturnSign]
          && signs[p.natalFortuneSaturnJupiterWitness.jupiterSign] && aspects[p.natalFortuneSaturnJupiterWitness.aspect]
          ? '同一福点由土星守护；本命' + signs[p.natalFortuneSaturnJupiterWitness.saturnSign] + '土星与'
            + signs[p.natalFortuneSaturnJupiterWitness.jupiterSign] + '木星成整星座' + aspects[p.natalFortuneSaturnJupiterWitness.aspect] : '',
        p.natalFortuneSaturnJupiterWitness?.jupiterBicorporeal === true
          ? '卷四第二章另核本命木星实在双体星座，角宫仍须另查' : '',
        aspects[p.natalFortuneSaturnJupiterWitness?.lunarApplication?.aspect]
          ? '按古注十五度候选范围，本命月亮优先入相木星，实际形成'
            + aspects[p.natalFortuneSaturnJupiterWitness.lunarApplication.aspect]
            + '的时刻为' + at(p.natalFortuneSaturnJupiterWitness.lunarApplication.exactAt) : '',
        p.physicalIngressAt ? '实际进入这个星座的时刻为' + at(p.physicalIngressAt)
          : p.timedPlaceIngressAt ? '本段承接同一时限内' + at(p.timedPlaceIngressAt) + '已发生的入座'
            : '本段承接实际过境区间，新入座时刻未在本段记录',
        p.enteredDuringTimedPlace === true ? '进入该星座的过点落在同一起点的该级时限内' : '',
        p.aspectType === 'conjunction' ? '整星座合相取同座区间，精确黄经同度需另算' : '',
        '带黄纬的完整球面取法、本命亲疏与时限边界仍待核',
      ]);
      case 'ptolemy_lunar_phase_contact': {
        const phase = { new_moon: '朔', first_quarter: '上弦', full_moon: '望', last_quarter: '下弦' }[p.phase];
        const origin = timingOrigins[p.origin];
        if (!phase || !origin || !signs[p.moonSign] || p.profile !== 'robbins-iv10-lunar-quarter-moon-sign-v1') return '';
        const relation = (level, sign, aspect) => signs[sign] && (aspects[aspect] || aspect === 'none')
          ? '与同一起点的' + level + '级时限位置' + signs[sign] + (aspect === 'none' ? '未成所列整星座相位' : '成整星座' + aspects[aspect])
          : '';
        const originRelation = (level, sign, ruler, aspect) => signs[sign] && bodies[ruler] && (aspects[aspect] || aspect === 'none')
          ? level + '级时限' + signs[sign] + '的守护星是' + bodies[ruler]
            + (aspect === 'none' ? '，该星座与本命起点未成所列整星座相位' : '，该星座与本命起点成整星座' + aspects[aspect])
          : '';
        return sentences([
          '按托勒密时限核' + origin + '的月相应期。实际' + phase + '点的月亮位于' + signs[p.moonSign],
          signs[p.natalOriginSign] ? '同一本命起点位于' + signs[p.natalOriginSign] : '',
          originRelation('年', p.annualSign, p.annualRuler, p.annualOriginAspect),
          originRelation('月', p.monthSign, p.monthlyRuler, p.monthlyOriginAspect),
          relation('年', p.annualSign, p.annualAspect), relation('月', p.monthSign, p.monthlyAspect),
          signs[p.solarSign] ? sentences(['同一月相时刻的太阳位于' + signs[p.solarSign],
            relation('年', p.annualSign, p.solarAnnualAspect), relation('月', p.monthSign, p.solarMonthlyAspect)]) : '',
          ...list(p.phaseIngressContacts).flatMap(row => timingLevels[row?.level] && bodies[row.body] && signs[row.sign] && at(row.ingressAt)
            ? ['同一起点的' + timingLevels[row.level] + '级位置在' + signs[row.sign] + '，' + bodies[row.body]
              + '于' + at(row.ingressAt) + '实际入座，月相真点仍在这段行运内'] : []),
          ...list(p.phaseCarryContacts).flatMap(row => ['year', 'month'].includes(row?.level) && bodies[row.body] && signs[row.sign]
            ? ['月相真点时，同一起点的' + timingLevels[row.level] + '级' + bodies[row.body] + '仍在' + signs[row.sign]
              + '，本时限内未核到新的入座'] : []),
          ...list(p.phaseTransitAspectContacts).flatMap(row => {
            if (!['year', 'month'].includes(row?.level) || !bodies[row.body] || !signs[row.sign]
              || !signs[row.timeSign] || !aspects[row.aspect]) return [];
            const contact = row.ingressAt && at(row.ingressAt);
            return ['月相真点时，' + bodies[row.body] + '实际驻于' + signs[row.sign] + '，'
              + relation(timingLevels[row.level], row.timeSign, row.aspect)
              + (contact ? '，本级时限内的实际入座时刻为' + contact : '，本级时限承接原在座位置')];
          }),
        ]);
      }
      case 'lunation_window': return sentences([
        p.newMoonAt && p.nextNewMoonAt ? '当前朔望月从' + at(p.newMoonAt) + '的新月持续到' + at(p.nextNewMoonAt) + '的下一次新月，截止时刻不计入' : '',
        degrees(p.longitude) ? '本次新月的热带黄道黄经为' + degrees(p.longitude) : '',
        p.startsBeforeQuery === true ? '这次新月发生在查询窗之前，本窗只承接其持续段' : '',
        '朔望月和公历月分别保留；高阶推运与个人本命关系未核时，不将月相直接当作个人趋势',
      ]);
      case 'sepharial_lunation_context': {
        const target = bodies[p.natalTarget];
        const aspect = p.exactNatalSupportAspect === true && ['sextile', 'trine'].includes(p.natalLunationAspect)
          ? aspects[p.natalLunationAspect] : '';
        if (p.profile !== 'sepharial-lunation-hierarchy-v1') return '';
        const newMoonContacts = p.newMoonSignificatorProfile === 'sepharial-1914-new-moon-at-natal-significators-v1'
          ? list(p.newMoonSignificatorContacts).flatMap(row => bodies[row.body] && bodies[row.natalTarget] && aspects[row.aspect] ? [
            '同一次朔时，实际' + bodies[row.body] + '与本命' + bodies[row.natalTarget] + '精确形成' + aspects[row.aspect],
          ] : []) : [];
        if (!target || (p.exactNatalContact !== true && !aspect)) return sentences(newMoonContacts);
        const orderedMajorTransits = list(p.majorTransitPrecedence).map(body => bodies[body]).filter(Boolean);
        const layer = (label, rows, describe) => {
          const entries = list(rows).map(describe).filter(Boolean);
          return label + '中，' + (entries.length ? entries.join('、') : '本片段未核得精确点');
        };
        const direction = (name, item) => aspects[item.aspect] && item.at
          ? name + '在' + at(item.at) + '对本命' + target + '形成' + aspects[item.aspect] : '';
        return sentences([
          'Sepharial 原书按角点主限、实际行运、月亮推运、朔象排列参考层级',
          '本命' + target + (number(p.natalHouse) !== undefined ? '在第' + p.natalHouse + '宫' : '')
            + (p.exactNatalContact === true ? '，与实际朔点数值同度' : '，与实际朔点精确成' + aspect),
          p.newMoonAt && p.nextNewMoonAt ? '实际朔望月从' + at(p.newMoonAt) + '持续到' + at(p.nextNewMoonAt) : '',
          p.startsBeforeQuery ? '本次查询承接前窗朔点，以下计算针对本窗内片段' : '',
          ...newMoonContacts,
          layer('角点主限候选', p.primaryDirections, row => bodies[row.angle] && bodies[row.body] && aspects[row.aspect] && row.at
            ? bodies[row.angle] + '在' + at(row.at) + '与本命' + bodies[row.body] + '形成' + aspects[row.aspect]
              + (row.nature === 'favourable' ? '，原书列为偏顺' : row.nature === 'adverse' ? '，原书列为偏难' : '')
              + (row.mercuryCondition ? '，本命水星的最近核准相位为' + (list(row.mercuryCondition.nearest)
                .map(item => bodies[item.body] + aspects[item.aspect]).join('、') || '未查得')
                + (row.nature === 'unclassified' ? '，尚未定性' : '') : '')
              + (row.sameNatalIndicator === true ? '，与朔点对应同一本命指征'
                : row.sameNatalIndicator === false ? '，列为同期背景' : '') : ''),
          p.sphericalPrimaryProfile === 'sepharial-1901-mundane-natal-semiarc-v1'
            ? layer('球面主限候选（出生地赤经赤纬）', p.sphericalPrimaryDirections, row => {
              if (!bodies[row.body] || !row.at) return '';
              const angle = { 'upper-meridian': '上中天', 'lower-meridian': '下中天',
                'east-horizon': '东地平', 'west-horizon': '西地平' }[row.sphericalPoint];
              const contact = angle ? '到' + angle : row.sphericalPoint === 'luminary-semiarc' && bodies[row.indicator]
                ? '按昼夜半弧比例与本命' + bodies[row.indicator] + '合相' : '';
              return contact ? bodies[row.body] + '在' + at(row.at) + (row.motion === 'converse' ? '逆向' : '直向') + contact
                + (row.sameNatalIndicator === true ? '，对应同一本命指征' : '') : '';
            }) : '',
          layer('独立于合朔的实际行运', p.transits, row => bodies[row.body] && row.at
            ? bodies[row.body] + '在' + at(row.at) + (motions[row.motion] ?? '') + '经过本命' + target
              + (row.majorRetrograde === true ? '，按原书属较持久的逆行过境' : '') : ''),
          orderedMajorTransits.length > 1 ? '同一本命' + target + '的主要行运，按原书的发生频次优先参考'
            + orderedMajorTransits.join('、') + '，逆行和停驻另外核对' : '',
          layer('实际停驻', p.stationaryTransits, row => bodies[row.body] && timingOrigins[row.target] && row.at
            ? bodies[row.body] + '在' + at(row.at) + (row.aspect === 'opposition'
              ? '停驻时精确对冲' + timingOrigins[row.target] + '，对应原书列举的停驻对冲'
              : '停驻于' + timingOrigins[row.target] + '，原书将这类停驻列为接近主限的证据')
              + (row.sameNatalIndicator === true ? '，对应本次朔象的同一指征' : '，对应另一本命指征，作为同期背景') : ''),
          p.lunarClock === 'sepharial-1914-january-noon-monthly-motion-v1'
            && p.lunarDayInterpolation === 'utc-month-uniform-clock-candidate'
            ? '月亮推运采用作者的年初月表，月内时点按现代民用月均匀插值，供比较' : '',
          layer('月亮推运', p.lunarDirections, row => {
            const contact = direction('推运月亮', row);
            if (!contact) return '';
            const relation = {
              reinforcing: '与同一本命指征的角点主限同向，按原书加强该方向的提示',
              brief_disturbance: '同一本命指征的角点主限偏顺，原书将相反的月亮推运视为短暂扰动',
              temporary_relief: '同一本命指征的角点主限偏难，原书将相反的月亮推运视为暂时缓和',
            }[row.primaryRelation];
            return contact + (relation ? '，' + relation : '');
          }),
          p.annualProgressedLunarDirectionProfile === 'sepharial-1914-calendar-year-progressed-planet-v1'
            && list(p.annualProgressedLunarDirections).length
            ? layer('月表对当年次限行星', p.annualProgressedLunarDirections, row => aspects[row.aspect] && row.at && row.annualEphemerisAt
              ? '推运月亮在' + at(row.at) + '对当年次限' + target + '形成' + aspects[row.aspect]
                + '，该星取自出生后星历' + at(row.annualEphemerisAt)
              : '') : '',
          layer('另列的太阳推运', p.solarDirections, row => direction('推运太阳', row)),
          '精确时点只供对照，并列条件仍须核本命主题、整体性质和各层影响的持续时间',
        ]);
      }
      case 'progression_transit_overlap': return sentences([
        bodies[p.natalTargetId] ? '两类时序共同对应本命' + bodies[p.natalTargetId] : '',
        bodies[p.progressedBody] && aspects[p.progressedAspectType] ? '次限' + bodies[p.progressedBody] + '形成' + aspects[p.progressedAspectType] : '',
        bodies[p.transitBody] && aspects[p.transitAspectType] ? '实际行运' + bodies[p.transitBody] + '形成' + aspects[p.transitAspectType] : '',
        '两者只在本条有效区间内重叠；同一本命对象和时间交集不等于同性质、同方向或相互加强，原法取义仍须另核',
      ]);
      case 'natal_house_cusps': return !['placidus', 'regiomontanus'].includes(p.houseSystem) ? '' : sentences([
        '本命宫头另按' + (p.houseSystem === 'placidus' ? 'Leo 原书使用的时间分宫口径' : 'Lilly 使用的雷吉奥蒙塔努斯制') + '计算',
        list(p.cusps).map((cusp, index) => degrees(cusp) ? '第' + (index + 1) + '宫宫头黄经为' + degrees(cusp) : '').filter(Boolean).join('，'),
        '这些宫界与整宫制分别保留，不相互替代',
      ]);
      case 'leo_mc_tenth_contact': return p.profile !== 'leo-mc-tenth-linked-v1' ? '' : sentences([
        '本条把实际天空土星的本命天顶经过与同一段第十宫区间直接关联，使用Leo时间分宫',
        degrees(p.mcLongitude) ? '本命天顶即第十宫头，热带黄道黄经为' + degrees(p.mcLongitude) : '',
        p.inTenth === true ? '本事实有效时段内土星实际位于本命第十宫' : '查询窗内土星未进入本命第十宫，本条第十宫条件不成立',
        ...list(p.mcContacts).flatMap(c => c.motion === 'stationary' && c.role === 'touching'
          ? ['在' + at(c.at) + '土星停驻触及本命天顶，仍保留同一第十宫背景，没有跨宫，不能说成进入或离开']
          : ['direct', 'retrograde'].includes(c.motion) && ['entering', 'leaving'].includes(c.role)
          ? ['在' + at(c.at) + '土星' + motions[c.motion] + '精确经过本命天顶，并在该边界'
            + (c.role === 'entering' ? '进入第十宫' : '离开第十宫，不能写成新进入')] : []),
        p.inTenth === true && p.linkedMcInWindow === false ? '本段只有第十宫背景，查询窗内未记录与它相邻的天顶经过，不视为本条新触发' : '',
        p.clippedStart === true || p.clippedEnd === true ? '这里是与查询窗重合的过宫片段，不声称查询起止就是完整事件起止' : '',
        '精确经过是时点，第十宫背景是区间，不把整个区间说成一直压在天顶，也不用相位容许度替代精确接触，停驻触及不冒称穿越',
        '原文并列压力、信誉受检视与审慎承担责任的回应；它们保持条件性解释，不从命盘给用户判人格层次，不保证失职、丑闻或升迁等现实事件',
      ]);
      case 'traditional_house_interval': return p.houseSystem !== 'placidus' ? '' : sentences([
        bodies[p.transitBody] && number(p.natalHouse) !== undefined ? '行运' + bodies[p.transitBody] + '经过本命第' + p.natalHouse + '宫' : '',
        '宫界采用 Leo 原书所用的时间分宫口径，区间按实际宫头进入离开，不套整宫制或相位容许度',
      ]);
      case 'traditional_cusp_crossing': return p.houseSystem !== 'regiomontanus' ? '' : sentences([
        bodies[p.transitBody] && number(p.house) !== undefined ? '行运' + bodies[p.transitBody] + '精确经过本命第' + p.house + '宫宫头' : '',
        degrees(p.cuspLongitude) ? '宫头黄经为' + degrees(p.cuspLongitude) : '', motions[p.transitMotion],
        '采用 Lilly 的雷吉奥蒙塔努斯宫制，按一秒时间精度定位穿越；持续停留该宫不重复算作每日新触发',
      ]);
      case 'sepharial_saturn_second_house': return p.houseProfile !== 'sepharial-1918-london-table-v1' ? '' : sentences([
        p.enteredThroughSecondCusp === true ? '土星顺行越过 Sepharial 口径的本命第二宫头，进入第二宫'
          : '本片段有土星在本命第二宫的背景，未出现顺行穿越第二宫头的这项条件',
        degrees(p.secondCuspLongitude) ? '第二宫头的热带黄道黄经为' + degrees(p.secondCuspLongitude) : '',
        number(p.entryCusp) !== undefined ? '片段从第' + p.entryCusp + '宫头' + motions[p.entryMotion] + '穿越开始' : '',
        number(p.exitCusp) !== undefined ? '片段以第' + p.exitCusp + '宫头' + motions[p.exitMotion] + '穿越结束' : '',
        '本条仅供核对资源主题，不能由过宫确定实际财务结果',
      ]);
      case 'sepharial_jupiter_lunation': return p.houseProfile !== 'sepharial-1918-london-table-v1'
        || p.exactConjunction !== true ? '' : sentences([
        'Sepharial 口径的本命木星位于第' + p.natalHouse + '宫，新月与木星在热带黄道上同度',
        '实际朔望月由' + at(p.newMoonAt) + '至' + at(p.nextNewMoonAt) + '，只把与所问月重合的片段用于本条',
        degrees(p.newMoonLongitude) ? '朔点黄经为' + degrees(p.newMoonLongitude) : '',
        '新月线索从属于更高层的推运和行运，合朔本身不保证现实事件或实际收益',
      ]);
      case 'leo_ascendant_context': return p.profile !== 'leo-ascendant-natal-decan-context-v1'
        || p.natalContextReady !== true || p.hierarchy !== 'natal-before-progressed-sign-before-decan'
        || p.rulershipBasis !== 'leo-1928-fourth-edition-explicit-sign-table' ? '' : sentences([
        '本条将同一本命与同一有效片段的 Leo 原法推运上升共同核对',
        signs[p.natalSign] && bodies[p.natalSignRuler] ? '本命上升在' + signs[p.natalSign] + '，本命命主星为'
          + bodies[p.natalSignRuler] + '；本命指征终生优先，推运主星不能替换它' : '',
        number(p.natalDecan) !== undefined && signs[p.natalDecanSign] && bodies[p.natalDecanRuler]
          ? '本命上升第' + p.natalDecan + '个十分度对应' + signs[p.natalDecanSign] + '，辅助主星为' + bodies[p.natalDecanRuler] : '',
        signs[p.sign] && bodies[p.signRuler] ? '推运上升在' + signs[p.sign] + '，本期星座主星为' + bodies[p.signRuler] : '',
        number(p.decan) !== undefined && signs[p.decanSign] && bodies[p.decanRuler] ? '推运上升第' + p.decan
          + '个十分度对应' + signs[p.decanSign] + '，附加主星为' + bodies[p.decanRuler] : '',
        p.longitudeSampleAt && degrees(p.longitude) ? '上升黄经' + degrees(p.longitude) + '为' + at(p.longitudeSampleAt)
          + '的定位样本，不声称整段度数不变；星座与十分度在本片段保持一致' : '',
        p.wholeSignApplies === true ? '第一十分度原文同时是整个星座的背景，第二、第三十分度只作修饰，不能取代整座说明' : '',
        '十分度按同元素星座的黄道次序轮转；主星表另据同作者一九二八年第四版明确表格核对，不冒称与一九〇六年版逐字相同；水瓶取土星、双鱼取木星，不借现代守护星表替换',
        ...list(p.rulerPositions).flatMap(row => bodies[row.body] ? [sentences([
          '相关主星' + bodies[row.body] + '的本命位置为' + zodiacPosition(row.longitude, 'tropical'),
          number(row.house) !== undefined ? '在固定本命时间分宫第' + row.house + '宫' : '宫位未知',
        ])] : []),
        number(p.natalSunHouse) !== undefined ? '本命太阳在固定本命时间分宫第' + p.natalSunHouse + '宫' : '',
        typeof p.sunInIcDscArc === 'boolean' ? '本命太阳' + (p.sunInIcDscArc ? '位于' : '不在')
          + '天底至下降点的半开黄道弧内；这一几何位置本身不完成双鱼条的原文例外条件' : '',
        ...list(p.natalJupiterSeparations).flatMap(row => bodies[row.body] ? ['本命木星与' + bodies[row.body]
          + '黄经最短距离为' + degrees(row.longitudeSeparation) + '，赤纬绝对值之差为' + degrees(row.absoluteDeclinationDifference)
          + '；不据夹角直接认定木星非常有利'] : []),
        ...leoNatalContactLabels(p.natalJupiterSupportive),
        ...leoNatalContactLabels(p.natalJupiterHard),
        p.piscesNatalCondition === 'candidate'
          ? '本命太阳在上述黄道弧内，木星在同作者后版参考外限内见六合或三分且未见四分或对分，符合双鱼段的联合例外候选。原文所述木星的程度仍待核' : '',
        ...list(p.natalHouseDirections).flatMap(row => {
          if (![2, 5, 10].includes(row?.house)) return [];
          const links = list(row.contacts).flatMap(contact => {
            const linked = leoDirectionText({ body: contact?.progressedBody, target: contact?.natalTargetId,
              targetKind: 'natal', aspectType: contact?.aspectType });
            return linked && ['favourable', 'adverse'].includes(contact?.nature)
              ? [linked + '，原书此项偏' + (contact.nature === 'favourable' ? '顺' : '难')] : [];
          });
          if (!links.length) return [];
          const occupants = list(row.occupants).map(body => bodies[body]).filter(Boolean);
          const palace = '本命第' + row.house + '宫';
          const role = occupants.length ? palace + '实有' + occupants.join('、')
            : bodies[row.ruler] && signs[row.cuspSign] ? palace + '为空宫，宫头在' + signs[row.cuspSign] + '，取该座主星' + bodies[row.ruler] : '';
          return role ? [role + '。同段登记的相关推运为' + links.join('、')] : [];
        }),
        p.hasAdverseAscendantDirection === true ? '本片段两个目标层合查时有已分类偏难方向，狮子第二十分度的这个候选条件不成立' : '',
        p.hasAdverseAscendantDirection === false && p.hasUnresolvedAscendantDirection === true
          ? '本片段未查到已分类偏难方向，仍有取义待核的同期方向，不能确认全部方向偏顺' : '',
        p.sign === 10 && ['favourable', 'adverse', 'mixed'].includes(p.natalMercuryUranusDirectionState)
          ? '水瓶整座的思维主题可与次限水星对本命天王星的实际相位交叉核对。'
            + ({ favourable: '已分类的这组相位偏顺', adverse: '已分类的这组相位偏难', mixed: '这组相位同时有偏顺和偏难' })[p.natalMercuryUranusDirectionState]
            + '，仅覆盖原文的部分方向' : '',
        p.sign === 9 && p.decan === 3
          && [p.natalDirectionState, p.progressedDirectionState].some(state => ['favourable', 'adverse', 'mixed'].includes(state))
          ? '摩羯第三个十分度有已分类的同期方向可合看，下面按实际目标盘逐项列出，原书未给统一的优先级' : '',
        ...list(p.directions).flatMap(row => bodies[row.progressedBody] && bodies[row.natalTargetId] && aspects[row.aspectType] ? [
          sentences(['本片段实际同期次限' + bodies[row.progressedBody] + '对'
            + (row.targetKind === 'progressed' ? '同图次限' : '本命') + bodies[row.natalTargetId] + '形成'
            + (row.aspectType === 'parallel' ? '绝对赤纬平行' : aspects[row.aspectType]),
          row.nature === 'favourable' ? '原书此项偏顺' : row.nature === 'adverse' ? '原书此项偏难' : '',
          row.involvesRuler === true ? '涉及上述主星之一，不按主星角色重复计权' : '',
          degrees(row.allowedOrb) ? '本次扫描阈值为' + degrees(row.allowedOrb) : '',
          list(row.exactTimes).length ? '本片段精确时刻为' + row.exactTimes.map(at).join('、') : '',
          row.aspectType === 'parallel' ? '按绝对赤纬差一度核，不要求南北同向' : '黄经阈值仍是声明口径，不冒充所有原书相位的统一容许度']),
        ] : []),
        Array.isArray(p.directions) && !p.directions.length ? '本次扫描对象与阈值内，此片段未记录同期来源相位；不能推断整盘无方向或方向全部良好' : '',
        '同期与几何相位不等于有利、受克或同性质；原书能力、品性层次、现实机会及各条相反分支仍未据此成立，不评价用户等级或保证事件',
      ]);
      case 'progressed_ascendant': return sentences([
        number(p.sign) !== undefined && signs[p.sign] ? 'Leo 原法推运上升处于' + signs[p.sign] : '',
        number(p.decan) !== undefined ? '为该星座的第' + p.decan + '个十分度' : '',
        '按固定出生时刻的逐日恒星时增量推进，并在周年之间插值；不采用普通太阳弧，也不将年内时刻转成额外半周',
        '本命上升和命主星、同期推运及原文分支仍须合看',
      ]);
      case 'progressed_house': return p.houseSystem !== 'placidus' ? '' : sentences([
        bodies[p.body] && number(p.house) !== undefined ? '次限' + bodies[p.body] + '经过本命第' + p.house + '宫' : '',
        '采用 Leo 原书所用的固定本命宫头，不用推运宫头或整宫制替代',
        '宫主显著性、太阳或互相推运的同期条件仍须另核',
      ]);
      case 'progressed_position': return sentences([bodies[p.body] ? bodies[p.body] + '的次限位置' : '',
        p.referenceAt ? '此为参考时刻' + at(p.referenceAt) + '的样本，不能视为整个查询窗均保持此度数' : '此为参考时刻样本，不据此确定相位起止',
        zodiacPosition(p.longitude, p.zodiac), degrees(p.declination) ? '在本命真赤道参考系内赤纬为' + degrees(p.declination) : '',
        '按出生后一日对应一岁推算，不是查询日的实际天空位置']);
      case 'progressed_aspect':
      case 'progressed_aspect_exact': return sentences([
        bodies[p.progressedBody] && bodies[p.natalTargetId] && aspects[p.aspectType]
          ? '次限' + bodies[p.progressedBody] + '对本命' + bodies[p.natalTargetId] + '形成' + aspects[p.aspectType] : '',
        p.aspectType === 'parallel' ? sentences([
          degrees(p.progressedDeclination) ? '次限天体赤纬为' + degrees(p.progressedDeclination) : '',
          degrees(p.natalDeclination) ? '本命天体赤纬为' + degrees(p.natalDeclination) : '',
          p.sameHemisphere === true ? '二者赤纬方向一致，不是反平行'
            : p.sameHemisphere === false ? '二者赤纬方向不一致，不能作为同向平行依据' : '赤纬同向状态未确认，不能作为确定平行依据',
        ]) : sentences([degrees(p.progressedLongitude) ? '次限黄经为' + degrees(p.progressedLongitude) : '',
          degrees(p.natalLongitude) ? '本命黄经为' + degrees(p.natalLongitude) : '']),
        degrees(p.allowedOrb) ? '采用已声明的产品判定容许度' + degrees(p.allowedOrb) : '',
        p.clippedStart === true || p.clippedEnd === true ? '此处只列与查询窗口重合的有效部分，不声称完整事件在窗口边界开始或结束' : '',
        '当前仅核实几何条件，本命允许范围与同向触发仍须另核',
      ]);
      case 'aspect_interval':
      case 'aspect_exact': {
        const loopPass = number(p.retrogradeLoopPassIndex);
        const intervalPass = number(p.passIndex);
        return sentences([
          bodies[p.transitBody] && bodies[p.natalTargetId] && aspects[p.aspectType]
            ? '行运' + bodies[p.transitBody] + '与本命' + bodies[p.natalTargetId] + '形成' + aspects[p.aspectType] : '',
          degrees(p.orb) ? '相位容许度为' + degrees(p.orb) : '',
          loopPass !== undefined ? '这是同一顺逆回环的第' + loopPass + '次精确经过'
            : intervalPass !== undefined ? '这是同一行运过程的第' + intervalPass + '次精确经过' : '',
          motions[p.transitMotion],
          ...list(p.retrogradeLoop?.passes).flatMap(pass => motions[pass?.direction] && at(pass.at)
            ? [motions[pass.direction] + '过点于' + at(pass.at)] : []),
        ]);
      }
      case 'house_interval': return sentences([bodies[p.transitBody] ? '行运天体为' + bodies[p.transitBody] : '',
        number(p.natalHouse) !== undefined ? '经过本命第' + p.natalHouse + '宫' : '', '个人宫位采用整宫制']);
      case 'natal_position': return sentences([bodies[p.body] ? '本命' + bodies[p.body] : '', zodiacPosition(p.longitude, p.zodiac),
        number(p.natalHouse) !== undefined ? '位于整宫制第' + p.natalHouse + '宫' : '']);
      case 'solar_return': return sentences(['太阳回归发生于' + at(p.returnAt), '回归年段结束于' + at(p.returnEnd),
        zodiacPosition(p.natalSunLongitude, p.zodiac) ? '本命太阳位置为' + zodiacPosition(p.natalSunLongitude, p.zodiac) : '',
        list(p.bodies).map(item => sentences([bodies[item.planet], zodiacPosition(item.longitude, p.zodiac), motions[item.direction],
          number(item.speed) !== undefined ? '日均黄经速度为' + degrees(item.speed) : ''])).filter(Boolean).join('；'),
        p.returnAngles === 'unavailable' ? '回归盘角点不可用' : p.returnAngles === 'regiomontanus_verified' ? '指定地点的回归盘按雷吉奥蒙塔努斯制分宫'
          : p.returnAngles === 'ascendant_verified' ? '指定地点的回归上升见单独的宫头比较' : '',
        p.traditionalDignities === 'unavailable' ? '传统尊贵状态未计算' : '', p.houseSystem === 'unavailable' ? '回归盘宫位不可用' : '',
      ]);
      case 'station_natal_contact': return sentences([
        bodies[p.transitBody] && bodies[p.natalTargetId] ? bodies[p.transitBody] + '停驻时接近本命' + bodies[p.natalTargetId] : '',
        degrees(p.separation) ? '黄经相距' + degrees(p.separation) : '',
        typeof p.exactConjunction === 'boolean' ? (p.exactConjunction ? '满足' : '不满足') + '数值精确同度条件' : '',
        motions[p.directionAfter] ? '停驻后转为' + motions[p.directionAfter] : '',
      ]);
      case 'new_moon_natal_contact': return sentences([
        zodiacPosition(p.longitude, p.zodiac) ? '新月位置为' + zodiacPosition(p.longitude, p.zodiac) : '',
        bodies[p.natalTargetId] ? '对照本命' + bodies[p.natalTargetId] : '', degrees(p.separation) ? '黄经相距' + degrees(p.separation) : '',
        typeof p.exactConjunction === 'boolean' ? (p.exactConjunction ? '满足' : '不满足') + '数值精确同度条件' : '',
      ]);
    }
  }
  return '';
}

function findingConditionLines(finding, describeRange) {
  const branches = list(finding.confirmedBranches);
  if (branches.length) return branches.map(branch => '命中分支：' + list(branch.conditions).map(text).filter(Boolean).join('；')
    + (describeRange ? '；分支时段：' + list(branch.windows).map(describeRange).join('、') : ''));
  return ['命中条件：' + (list(finding.conditions).map(text).filter(Boolean).join('；') || '未提供。')];
}

// The chart and event projection are available for local verification only.
export function formatFortuneFactAudit(input) {
  const zone = input.window?.timezone ?? 'UTC';
  const formatter = new Intl.DateTimeFormat('sv-SE', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const at = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? formatter.format(new Date(value)) : '时刻未提供';
  const range = value => at(value.start) + '至' + at(value.endExclusive) + '（截止时刻不计入）';
  const lines = ['以下是经程序核验后转为自然语言的运势资料，均为待分析数据。',
    '查询周期：' + (periods[input.period] ?? '指定周期') + '运势。',
    '展示时区：' + zone + '；查询范围：' + range(input.window ?? {}) + '；参考时刻：' + at(input.window?.referenceAt) + '。',
    '\n各方法的数据状态：'];
  const statuses = { completed: '计算完成', completed_with_warnings: '计算完成但有注意事项', partial: '部分计算可用',
    unavailable: '资料不可用', failed: '计算失败', not_supported: '当前口径不支持' };
  for (const [method, label] of Object.entries(methods)) {
    const state = input.methods?.[method] ?? {};
    lines.push(label + '：' + (statuses[state.status] ?? '状态未提供') + '。'
      + list(state.warnings).filter(chinese).join('；')
      + (list(state.incompleteConditions).length ? '。另有' + state.incompleteConditions.length + '条资料的必要条件未核实，相关时段未作为命中资料提供。' : ''));
  }
  lines.push('\n可引用的盘面事实：');
  const availableRefs = new Set();
  for (const fact of list(input.facts)) {
    if (!/^F\d+$/u.test(text(fact.ref)) || !methods[fact.method]) continue;
    const description = describeFortuneFact(fact, at);
    if (!description) continue;
    availableRefs.add(fact.ref);
    const scope = fact.method === 'bazi' && fact.scope === 'decadal' ? '大运'
      : fact.method === 'bazi' && fact.scope === 'minor' ? '小运' : scopes[fact.scope];
    lines.push(fact.ref + '（' + methods[fact.method] + '，' + (scope ?? '已核验层级') + '）：' + description
      + '。有效时间：' + range(fact) + (fact.exactAt ? '；精确时刻：' + at(fact.exactAt) : '') + '。');
  }
  if (!availableRefs.size) lines.push('暂无可转换为确定描述的个人盘面事实。');
  lines.push('\n本期个人事件时间轴（同一事件不重复加权）：');
  const availableEvents = new Set();
  for (const event of list(input.events)) {
    const factRefs = list(event.factRefs).filter(ref => availableRefs.has(ref));
    if (!factRefs.length || !/^E\d+$/u.test(text(event.ref)) || !methods[event.method]) continue;
    availableEvents.add(event.ref);
    lines.push(event.ref + '（' + methods[event.method] + '）：' + (event.phase === 'trigger' ? '本期存在精确触发或进入离开变化' : '本期持续背景')
      + '；有效时间：' + range(event) + '；关联事实：' + refs(factRefs)
      + (list(event.exactTimes).length ? '；精确时刻：' + event.exactTimes.map(at).join('、') : '')
      + (list(event.changes).length ? '；进入或离开变化时刻：' + event.changes.map(at).join('、') : '') + '。');
  }
  const sourceGroups = new Map();
  lines.push('\n命中资料（每条只提供命中条件、原文和现代释义）：');
  const titles = { overall: '综合运势', wealth: '财运', romance: '桃花运' };
  for (const section of list(input.sections)) {
    if (!titles[section.id]) continue;
    lines.push('\n' + titles[section.id] + '参考资料：');
    let count = 0;
    for (const finding of list(section.findings)) {
      const factRefs = list(finding.factRefs);
      // A partially rendered premise cannot stand for the whole matched source.
      if (!factRefs.length || !factRefs.every(ref => availableRefs.has(ref)) || !methods[finding.method]) continue;
      const key = finding.evidenceGroup || finding;
      if (!sourceGroups.has(key)) sourceGroups.set(key, sourceGroups.size + 1);
      const events = list(finding.eventRefs).filter(ref => availableEvents.has(ref));
      lines.push('资料' + (++count) + '（' + methods[finding.method] + '，同源第' + sourceGroups.get(key) + '组）：',
        findingConditionLines(finding, range).join('\n')
          + '。对应事实：' + refs(factRefs)
          + (events.length ? '；关联事件：' + events.join('、') : '')
          + (list(finding.windows).length ? '；共同有效时段：' + finding.windows.map(range).join('、') : '') + '。',
        '原文：' + (text(finding.originalText) || '未提供原文，不得编造。'),
        '现代释义：' + (text(finding.note) || '未提供释义，不得编造。'));
    }
    if (!count) lines.push('本栏暂无条件完整成立且有可引用事实的资料。');
  }
  return lines.join('\n');
}

export function formatFortunePrompt(input) {
  const zone = input.window?.timezone ?? 'UTC';
  const formatter = new Intl.DateTimeFormat('sv-SE', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const at = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? formatter.format(new Date(value)) : '时刻未提供';
  const lines = ['查询周期：' + (periods[input.period] ?? '指定周期') + '运势。',
    '查询范围：' + at(input.window?.start) + '至' + at(input.window?.endExclusive) + '（' + zone + '，截止时刻不计入）。'];
  const titles = { overall: '综合运势', wealth: '财运', romance: '桃花运' };
  const sourceGroups = new Map();
  for (const [id, title] of Object.entries(titles)) {
    lines.push('\n' + title + '参考资料：');
    const findings = list(list(input.sections).find(section => section.id === id)?.findings)
      .filter(finding => Object.hasOwn(methods, finding.method));
    for (const finding of findings) {
      const key = finding.evidenceGroup || finding;
      if (!sourceGroups.has(key)) sourceGroups.set(key, sourceGroups.size + 1);
      lines.push('资料（' + methods[finding.method] + '，同源第' + sourceGroups.get(key) + '组）：',
        ...findingConditionLines(finding),
        '原文：' + (text(finding.originalText) || '未提供。'),
        '现代释义：' + (text(finding.note) || '未提供。'));
    }
    if (!findings.length) lines.push('固定提示：' + fortuneNoMatchSummaries[id]);
  }
  return lines.join('\n');
}

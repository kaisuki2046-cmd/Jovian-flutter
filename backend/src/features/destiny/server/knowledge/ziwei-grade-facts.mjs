const branchCycle = '子丑寅卯辰巳午未申酉戌亥';
const branchElements = '水土木木土火火土金金土水';
const generates = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const controls = { 木: '土', 火: '金', 土: '水', 金: '木', 水: '火' };

// 《紫微斗数精成》附表的五行与星曜阴阳，按附表各自取值。
const starAttributes = {
  紫微: '土阴', 天机: '木阴', 太阳: '火阳', 武曲: '金阳', 天同: '水阳', 廉贞: '火阴', 天府: '土阳',
  太阴: '水阴', 贪狼: '水阳', 巨门: '水阳', 天相: '水阳', 天梁: '土阳', 七杀: '金阴', 破军: '水阴',
};
const rising = ['长生', '冠带', '临官', '帝旺'];
const growing = ['胎', '养'];

export function ziweiLifeBodyClash(lifeBranch, bodyBranch, lifeStar, bodyStar) {
  const lifeElement = branchElements[branchCycle.indexOf(lifeBranch)];
  const bodyElement = branchElements[branchCycle.indexOf(bodyBranch)];
  const lifeStarElement = starAttributes[lifeStar]?.[0];
  const bodyStarElement = starAttributes[bodyStar]?.[0];
  if (!lifeElement || !bodyElement || !lifeStarElement || !bodyStarElement) return false;
  return (controls[lifeElement] === bodyElement && controls[lifeStarElement] === bodyStarElement)
    || (controls[bodyElement] === lifeElement && controls[bodyStarElement] === lifeStarElement);
}

function numberGrade(star, branch, phase) {
  const index = branchCycle.indexOf(branch);
  if (index < 0) return null;
  const palaceElement = branchElements[index];
  const palacePolarity = index % 2 === 0 ? '阳' : '阴';
  const [starElement, starPolarity] = starAttributes[star];
  const nourishes = generates[palaceElement] === starElement;
  const restrains = controls[palaceElement] === starElement;
  if (nourishes && rising.includes(phase)) return '上';
  if ((palaceElement === starElement && palacePolarity === starPolarity && growing.includes(phase))
    || (restrains && rising.includes(phase)) || (nourishes && ['沐浴', '衰', '绝'].includes(phase))) return '中';
  return restrains && ['衰', '绝', '死'].includes(phase) ? '下' : null;
}

// 《紫微斗数精成》命宫星格、数格。只在分项所需的原局证据齐全时定级。
export function ziweiGradeFacts({ branch, phase, majors, brightness, support, benefics, adverse,
  auspiciousChanges, unluckyChange, unluckyOpposesLife }) {
  const facts = [];
  const levels = majors.map((star) => brightness.get(star));
  const statesKnown = levels.length > 0 && levels.every((states) => states?.size === 1);
  if (statesKnown) {
    const states = levels.map((values) => values.values().next().value);
    const bright = states.every((value) => ['庙', '旺'].includes(value));
    const average = states.every((value) => ['得', '利', '平'].includes(value));
    const dim = states.every((value) => ['陷', '闲'].includes(value));
    const unbroken = adverse.every((count) => count === 0) && unluckyChange === false;
    const noNatalClash = adverse[0] === 0 && adverse.at(-1) === 0 && unluckyOpposesLife === false;
    const clear = unbroken && support.every((count) => count > 0) && auspiciousChanges;
    const commander = majors.includes('武曲') && benefics.size > 0;
    const purpleAndTreasury = majors.includes('紫微') && majors.includes('天府')
      && [['左辅', '右弼'], ['天魁', '天钺']].some((pair) => pair.every((star) => benefics.has(star)));
    const goodTotal = support.reduce((sum, count) => sum + count, 0);
    const badTotal = adverse.reduce((sum, count) => sum + count, 0);
    const mixed = support[0] > 0 && adverse[0] > 0 && goodTotal === badTotal;
    if (bright && (clear || (noNatalClash && (commander || purpleAndTreasury)))) {
      facts.push({ kind: 'ziwei_grade', dimension: 'star', grade: '上' });
    }
    else if ((average && clear) || (bright && mixed)) facts.push({ kind: 'ziwei_grade', dimension: 'star', grade: '中' });
    else if (dim && adverse.every((count) => count > 0)) facts.push({ kind: 'ziwei_grade', dimension: 'star', grade: '下' });
  }
  if (branch && phase && majors.length > 0) {
    const [grade, ...others] = majors.map((star) => numberGrade(star, branch, phase));
    if (grade && others.every((other) => other === grade)) facts.push({ kind: 'ziwei_grade', dimension: 'number', grade });
  }
  return facts;
}

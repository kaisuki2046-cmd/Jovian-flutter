import type { DestinyChartSnapshot } from '../../destiny';

export const adviceElements = ['木', '火', '土', '金', '水'];
export const adviceSigns = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];
export const adviceLifeStars = ['紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军'];
export type FortuneAdviceThemes = { element?: string; sign?: string; lifeStar?: string };

function common(values: (string | undefined)[]) {
  const [first] = values;
  return first && values.every(value => value === first) ? first : undefined;
}

export function extractFortuneAdviceThemes(chart: DestinyChartSnapshot): FortuneAdviceThemes {
  const dayStem = chart.bazi?.rulesetVersion === 'utc8-jie-local-civil-late-zi-next-v1'
    ? common(chart.bazi.rawResult.map(row => row.day?.[0])) : undefined;
  const stemIndex = dayStem ? '甲乙丙丁戊己庚辛壬癸'.indexOf(dayStem) : -1;
  const element = stemIndex < 0 ? undefined : adviceElements[Math.floor(stemIndex / 2)];
  const sign = chart.western?.rulesetVersion === 'tropical-whole-sign-v1' ? common(chart.western.rawResult.map(row => {
    const sun = row.positions.find(position => position.planet === 'Sun');
    return sun && Number.isFinite(sun.longitude) ? adviceSigns[Math.floor(((sun.longitude % 360) + 360) % 360 / 30)] : undefined;
  })) : undefined;
  const lifeStar = chart.timeKnown && chart.ziwei?.rulesetVersion === 'standard-new-year-leap-split-late-zi-current-v1'
    ? common(chart.ziwei.rawResult.map(row => row.palaces.find(palace => palace.name === '命宫')?.majorStars[0]?.name)) : undefined;
  return { element, sign, lifeStar: lifeStar && adviceLifeStars.includes(lifeStar) ? lifeStar : undefined };
}

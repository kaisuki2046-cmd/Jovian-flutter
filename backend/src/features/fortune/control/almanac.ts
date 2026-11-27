import { fortuneReferenceFields, lunarAtBeijing } from './fortune-calendar';

export const almanacSource = 'lunar-javascript@1.7.8';
export const almanacRuleset = 'fortune-almanac-beijing-noon-v1';

type AlmanacLunar = ReturnType<typeof lunarAtBeijing> & {
  toString(): string;
  getJieQi(): string;
  getZhiXing(): string;
  getDayInGanZhi(): string;
  getDayYi(): string[];
  getDayJi(): string[];
};

export function buildAlmanacDay(asOf: number) {
  const { date } = fortuneReferenceFields(asOf);
  const lunar = lunarAtBeijing(Date.parse(date + 'T12:00:00+08:00')) as AlmanacLunar;
  const activities = (values: string[]) => [...new Set(values.filter((value) => value && value !== '无'))];
  const yi = activities(lunar.getDayYi());
  const ji = activities(lunar.getDayJi());
  return {
    date, timeZone: 'Asia/Shanghai', lunarDate: lunar.toString(),
    dayPillar: lunar.getDayInGanZhi(), solarTerm: lunar.getJieQi() || null, officer: lunar.getZhiXing(),
    yi, ji, source: almanacSource, ruleset: almanacRuleset,
    completeness: yi.length && ji.length ? 'complete' : 'partial',
  } as const;
}

import { signIndex, zodiacNames, ziweiAssistantBrightnessLabel } from 'jovian-legacy/features/destiny/control/charts';
import type { Reading } from 'jovian-legacy/features/destiny/control/local-reading';

function zodiacPosition(longitude: number) {
  const sign = signIndex(longitude);
  return zodiacNames[sign] + ' ' + (longitude - sign * 30).toFixed(1) + '°';
}

export function destinyPresentation([bazi, ziwei, western]: Reading['charts']) {
  const analysis = bazi.rawResult[0]?.analysis;
  const panel = ziwei.summary;
  const wheel = western.summary;
  const exact = wheel?.exact;
  const longitudes = new Map(exact?.positions.map(({ planet, longitude }) => [planet, longitude]));
  const labels = new Map(wheel?.positions.map(({ planet, label }) => [planet, label]));
  const row = (label: string, value: string) => ({ label, value });
  type Palace = NonNullable<NonNullable<typeof panel>['palaces']>[number];
  const stars = (entries: Palace['majorStars']) => entries.map((star) => {
    const name = ziweiAssistantBrightnessLabel(star) ?? star.name;
    return star.mutagen ? name + '化' + star.mutagen : name;
  }).join('、');
  return {
    bazi: analysis && [
      row('日主与月令', `${analysis.L1.dayMaster.stem.name}${analysis.L1.dayMaster.stem.element} · ${analysis.L1.monthCommand.branch.name}月 · ${analysis.L1.monthCommand.season}季`),
      row('日支藏干十神', analysis.L2.localStructures.daySeat.hiddenStems.map(({ name, tenGod }) => name + ' ' + tenGod).join('、')),
      row('天干五行计数', Object.entries(analysis.L1.elements.stems).map(([name, count]) => name + count).join(' · ')),
      row('日主旺衰', analysis.L2.assessments.dayMasterStrength.result),
      row('月令取格', analysis.L2.assessments.patterns.candidate + '候选 · ' + analysis.L2.assessments.patterns.result),
      row('十神组合候选', analysis.L2.tenGodStructures.filter(({ candidate }) => candidate).map(({ name }) => name).join('、') || '无命中'),
      row('完整地支关系', analysis.L2.stemBranchRelations.branches.filter(({ state }) => state === 'complete').map(({ type, pattern }) => pattern + type).join('、') || '无命中'),
    ],
    ziwei: panel && {
      lunarDate: panel.lunarDate, className: panel.className, scenarioCount: ziwei.rawResult.length,
      palaces: panel.palaces?.map((palace) => ({
        name: palace.name, stem: palace.heavenlyStem, branch: palace.earthlyBranch, body: palace.isBodyPalace,
        major: stars(palace.majorStars) || '无主星', minor: stars(palace.minorStars), others: stars(palace.adjectiveStars),
      })),
    },
    western: wheel && {
      positions: wheel.positions.map(({ planet, label, sign, house }) => {
        const longitude = longitudes.get(planet);
        const position = longitude === undefined ? sign : zodiacPosition(longitude);
        return { ...row(label, house === null ? position : `${position} · 第${house}宫`), planet, longitude };
      }),
      wheel: exact && {
        ascendant: exact.ascendant, midheaven: exact.midheaven,
        angles: [row('上升', zodiacPosition(exact.ascendant)), row('天顶', zodiacPosition(exact.midheaven))],
        houses: exact.houses.map((longitude) => ({ longitude, label: zodiacNames[signIndex(longitude)] })),
        aspects: exact.aspects.map(({ first, second, name, orb }) => ({
          ...row(labels.get(first) + ' · ' + labels.get(second), name + ' · 偏差 ' + orb.toFixed(1) + '°'), first, second,
        })),
      },
    },
  };
}

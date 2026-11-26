import { signIndex, zodiacNames, ziweiAssistantBrightnessLabel } from 'jovian-legacy/features/destiny/control/charts';
import type { Reading } from 'jovian-legacy/features/destiny/control/local-reading';
import type { DestinyChartSnapshot } from 'jovian-legacy/features/destiny/model/chart-snapshot';

type BaZiAnalysis = Reading['charts'][0]['rawResult'][number]['analysis'];
type ZiweiPanel = Pick<NonNullable<Reading['charts'][1]['summary']>, 'lunarDate' | 'className' | 'palaces'>;
type WesternSummary = NonNullable<Reading['charts'][2]['summary']>;

const row = (label: string, value: string) => ({ label, value });

function zodiacPosition(longitude: number) {
  const sign = signIndex(longitude);
  return zodiacNames[sign] + ' ' + (longitude - sign * 30).toFixed(1) + '°';
}

function baziRows(analysis?: BaZiAnalysis) {
  return analysis && [
    row('日主与月令', analysis.L1.dayMaster.stem.name + analysis.L1.dayMaster.stem.element
      + ' · ' + analysis.L1.monthCommand.branch.name + '月 · ' + analysis.L1.monthCommand.season + '季'),
    row('日支藏干十神', analysis.L2.localStructures.daySeat.hiddenStems.map(({ name, tenGod }) => name + ' ' + tenGod).join('、')),
    row('天干五行计数', Object.entries(analysis.L1.elements.stems).map(([name, count]) => name + count).join(' · ')),
    row('日主旺衰', analysis.L2.assessments.dayMasterStrength.result),
    row('月令取格', analysis.L2.assessments.patterns.candidate + '候选 · ' + analysis.L2.assessments.patterns.result),
    row('十神组合候选', analysis.L2.tenGodStructures.filter(({ candidate }) => candidate).map(({ name }) => name).join('、') || '无命中'),
    row('完整地支关系', analysis.L2.stemBranchRelations.branches.filter(({ state }) => state === 'complete').map(({ type, pattern }) => pattern + type).join('、') || '无命中'),
  ];
}

function palaceDetails(panel: ZiweiPanel | null, scenarioCount: number) {
  type Palace = NonNullable<ZiweiPanel['palaces']>[number];
  const stars = (entries: Palace['majorStars']) => entries.map((star) => {
    const name = ziweiAssistantBrightnessLabel(star) ?? star.name;
    return star.mutagen ? name + '化' + star.mutagen : name;
  }).join('、');
  return panel && {
    lunarDate: panel.lunarDate, className: panel.className, scenarioCount,
    palaces: panel.palaces?.map((palace) => ({
      name: palace.name, stem: palace.heavenlyStem, branch: palace.earthlyBranch, body: palace.isBodyPalace,
      major: stars(palace.majorStars) || '无主星', minor: stars(palace.minorStars), others: stars(palace.adjectiveStars),
    })),
  };
}

function westernDetails(summary: WesternSummary | null) {
  if (!summary) return null;
  const exact = summary.exact;
  const longitudes = new Map(exact?.positions.map(({ planet, longitude }) => [planet, longitude]));
  const labels = new Map(summary.positions.map(({ planet, label }) => [planet, label]));
  return {
    positions: summary.positions.map(({ planet, label, sign, house }) => {
      const longitude = longitudes.get(planet);
      const position = longitude === undefined ? sign : zodiacPosition(longitude);
      return { ...row(label, house === null ? position : position + ' · 第' + house + '宫'), planet, longitude };
    }),
    wheel: exact && {
      ascendant: exact.ascendant, midheaven: exact.midheaven,
      angles: [row('上升', zodiacPosition(exact.ascendant)), row('天顶', zodiacPosition(exact.midheaven))],
      houses: exact.houses.map((longitude) => ({ longitude, label: zodiacNames[signIndex(longitude)] })),
      aspects: exact.aspects.map(({ first, second, name, orb }) => ({
        ...row(labels.get(first) + ' · ' + labels.get(second), name + ' · 偏差 ' + orb.toFixed(1) + '°'), first, second,
      })),
    },
  };
}

export function destinyPresentation([bazi, ziwei, western]: Reading['charts']) {
  return {
    bazi: baziRows(bazi.rawResult[0]?.analysis),
    ziwei: palaceDetails(ziwei.summary, ziwei.rawResult.length),
    western: westernDetails(western.summary),
  };
}

function archivedPart<T>(project: () => T): T | undefined {
  try {
    return project();
  } catch (error) {
    // Older records can lack optional presentation fields. Keep their saved rows.
    if (!(error instanceof TypeError)) throw error;
    return undefined;
  }
}

function single<T>(results?: readonly T[]): T | undefined {
  return Array.isArray(results) && results.length === 1 ? results[0] : undefined;
}

/** Projects saved engine facts into the chart UI without rerunning any engine. */
export function archivedDestinyPresentation(snapshot: DestinyChartSnapshot) {
  if (snapshot?.version !== 1 || snapshot.timeKnown !== true) return {};
  const bazi = single(snapshot.bazi?.rawResult);
  const ziwei = single(snapshot.ziwei?.rawResult);
  const western = single(snapshot.western?.rawResult);
  return {
    bazi: archivedPart(() => baziRows(bazi?.analysis)),
    ziwei: archivedPart(() => {
      if (typeof ziwei?.lunarDate !== 'string' || typeof ziwei.fiveElementsClass !== 'string'
          || ziwei.palaces.length !== 12
          || ziwei.palaces.some(({ heavenlyStem }) => typeof heavenlyStem !== 'string')) return;
      return palaceDetails({
        lunarDate: ziwei.lunarDate, className: ziwei.fiveElementsClass, palaces: ziwei.palaces,
      }, 1);
    }),
    western: archivedPart(() => {
      if (!western || !Number.isFinite(western.ascendant) || !Number.isFinite(western.midheaven)
          || western.houses.length !== 12 || !western.houses.every(Number.isFinite)
          || !western.positions.length || western.positions.some(({ label, longitude }) =>
            typeof label !== 'string' || !Number.isFinite(longitude))) return;
      const positions = western.positions.map(({ planet, label, longitude, house }) => ({
        planet, label, sign: zodiacNames[signIndex(longitude)], house,
      }));
      return westernDetails({ positions, exact: western });
    }),
  };
}

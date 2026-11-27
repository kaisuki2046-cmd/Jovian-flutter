import type { SynastryChartSnapshot } from '../../account';
import type { BirthProfile } from '../model/birth-profile';
import { baziPillars, signIndex } from './charts';
import { runReading, type Reading } from './local-reading';

export type ManualSubjectChart = Pick<SynastryChartSnapshot, 'calculatedAt' | 'bazi' | 'ziwei' | 'western' | 'birthContext'>;

type Charts = Reading['charts'];
type Unavailable = Extract<ManualSubjectChart['bazi'], { status: 'unavailable' }>;

function chartVersion({ engineName, engineVersion, rulesetVersion }: Charts[number]) {
  return { engineName, engineVersion, rulesetVersion };
}

function unavailable(chart: Charts[number], reason: Unavailable['reason'] = 'not_calculated'): Unavailable {
  return { ...chartVersion(chart), status: 'unavailable', reason };
}

function commonValue<T>(values: readonly T[]): T | null {
  if (!values.length) return null;
  const first = JSON.stringify(values[0]);
  return values.every((value) => JSON.stringify(value) === first) ? values[0] : null;
}

function projectBaZi(chart: Charts[0]): ManualSubjectChart['bazi'] {
  const candidates = chart.rawResult;
  if (!candidates.length) return unavailable(chart);

  const pillars = baziPillars.map((position) => {
    const hits = candidates.map(({ shenSha }) => shenSha[position].map(({ name, sourcePillars }) => ({
      name, sourcePillars: baziPillars.filter((source) => sourcePillars.includes(source)),
    })));
    const shenSha = hits[0].filter((hit) => hits.every((candidate) => candidate.some((item) =>
      item.name === hit.name && item.sourcePillars.join(',') === hit.sourcePillars.join(','))));
    return {
      position,
      stem: commonValue(candidates.map((candidate) => candidate[position][0])),
      branch: commonValue(candidates.map((candidate) => candidate[position][1])),
      hiddenStems: commonValue(candidates.map(({ tenGods }) => tenGods[position].hiddenStems.map(({ stem }) => stem))),
      shenSha,
      shenShaComplete: hits.every((candidate) => candidate.length === shenSha.length),
    };
  });

  if (!pillars.some(({ stem, branch, hiddenStems, shenSha }) => stem || branch || hiddenStems || shenSha.length)) {
    return unavailable(chart, 'ambiguous_time');
  }
  const luckContext = chart.timeCompleteness === 'complete' ? candidates[0].luckContext : undefined;
  return { ...chartVersion(chart), status: chart.timeCompleteness === 'complete' ? 'complete' : 'partial', pillars,
    ...(luckContext && { luckContext }) };
}

function projectZiwei(chart: Charts[1]): ManualSubjectChart['ziwei'] {
  if (!chart.rawResult.length) return unavailable(chart);
  type Star = Extract<ManualSubjectChart['ziwei'], { status: 'complete' }>['palaces'][number]['majorStars'][number];
  const stars = (items: readonly Star[]) =>
    items.map(({ name, mutagen, brightness, brightnessProfile, mutagenOrigin }) => ({
      name, ...(mutagen && { mutagen }), ...(mutagen && mutagenOrigin && { mutagenOrigin }),
      ...(brightness && brightnessProfile && { brightness, brightnessProfile }),
    }));
  const candidates = chart.rawResult.map(({ palaces }) => ({
    lifePalaceBranch: palaces.find(({ name }) => name === '命宫')?.earthlyBranch,
    bodyPalaceBranch: palaces.find(({ isBodyPalace }) => isBodyPalace)?.earthlyBranch,
    palaces: palaces.map(({ name, earthlyBranch, heavenlyStem, stemTransformations, majorStars, minorStars, adjectiveStars }) => ({
      name, earthlyBranch, majorStars: stars(majorStars), minorStars: stars(minorStars), adjectiveStars: stars(adjectiveStars),
      ...(stemTransformations ? { heavenlyStem, stemTransformations } : {}),
    })),
  }));
  const stable = commonValue(candidates);
  if (!stable) return unavailable(chart, 'ambiguous_time');
  const { lifePalaceBranch, bodyPalaceBranch, palaces } = stable;
  if (!lifePalaceBranch || !bodyPalaceBranch) return unavailable(chart);
  return { ...chartVersion(chart), status: 'complete', lifePalaceBranch, bodyPalaceBranch, palaces };
}

function projectWestern(chart: Charts[2]): ManualSubjectChart['western'] {
  const [first, ...others] = chart.rawResult;
  if (!first) return unavailable(chart);
  if (chart.rulesetVersion !== 'tropical-whole-sign-v1') return unavailable(chart, 'unsupported_ruleset');
  const version = { ...chartVersion(chart), zodiac: 'tropical', houseSystem: 'whole-sign' } as const;
  if (chart.timeCompleteness === 'complete') {
    const { positions, ascendant, midheaven, houses } = first;
    return { ...version, status: 'complete', ascendant, midheaven, houses,
      positions: positions.map(({ planet, longitude }) => ({ planet, longitude })) };
  }

  const positions = first.positions.flatMap(({ planet, longitude }) => {
    const sign = signIndex(longitude);
    const shared = others.every((candidate) => candidate.positions.some((position) =>
      position.planet === planet && signIndex(position.longitude) === sign));
    return shared ? [{ planet, signIndex: sign }] : [];
  });
  return positions.length ? { ...version, status: 'partial', positions } : unavailable(chart, 'ambiguous_time');
}

export async function calculateManualSubjectChart(
  profile: BirthProfile,
  signal: AbortSignal = new AbortController().signal,
): Promise<ManualSubjectChart> {
  const { calculatedAt, birthContext, charts: [bazi, ziwei, western] } = await runReading(profile, signal, () => {});
  return { calculatedAt, ...(birthContext && { birthContext }),
    bazi: projectBaZi(bazi), ziwei: projectZiwei(ziwei), western: projectWestern(western) };
}

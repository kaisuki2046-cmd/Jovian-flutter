import { pillarPositions, westernPlanets, westernRuleset } from './chart-snapshot.mjs';

function sharedValue(values) {
  const first = JSON.stringify(values[0]);
  return values.every((value) => JSON.stringify(value) === first) ? values[0] : null;
}

function chartVersion({ engineName, engineVersion, rulesetVersion }) {
  return { engineName, engineVersion, rulesetVersion };
}

function unavailable(chart, reason = 'not_calculated') {
  return { ...chartVersion(chart), status: 'unavailable', reason };
}

function projectBaZi(chart, timeKnown, includeCalculationContext) {
  const candidates = chart.rawResult;
  if (!candidates.length) return unavailable(chart);

  const pillars = pillarPositions.map((position) => {
    const hits = candidates.map(({ shenSha }) => shenSha[position].map(({ name, sourcePillars }) => ({
      name, sourcePillars: pillarPositions.filter((source) => sourcePillars.includes(source)),
    })));
    const commonHits = hits[0].filter((hit) => hits.every((items) => items.some((item) =>
      item.name === hit.name && item.sourcePillars.join(',') === hit.sourcePillars.join(','))));
    return {
      position,
      stem: sharedValue(candidates.map((candidate) => candidate[position][0])),
      branch: sharedValue(candidates.map((candidate) => candidate[position][1])),
      hiddenStems: sharedValue(candidates.map(({ tenGods }) => tenGods[position].hiddenStems.map(({ stem }) => stem))),
      shenSha: commonHits,
      shenShaComplete: hits.every((items) => items.length === commonHits.length),
    };
  });
  if (!pillars.some(({ stem, branch, hiddenStems, shenSha }) => stem || branch || hiddenStems || shenSha.length)) {
    return unavailable(chart, 'ambiguous_time');
  }
  const luck = timeKnown && includeCalculationContext && candidates[0].luckContext;
  return { ...chartVersion(chart), status: timeKnown ? 'complete' : 'partial', pillars,
    ...(luck && { luckContext: { profile: luck.profile, gender: luck.gender, direction: luck.direction,
      periods: luck.periods.map(({ ganZhi, startAge, endAge, start, endExclusive }) =>
        ({ ganZhi, startAge, endAge, start, endExclusive })) } }) };
}

function projectZiwei(chart) {
  if (!chart.rawResult.length) return unavailable(chart);
  const stars = (items) => items.map(({ name, mutagen, brightness, brightnessProfile, mutagenOrigin }) => ({
    name, ...(mutagen && { mutagen }), ...(mutagen && mutagenOrigin && { mutagenOrigin }),
    ...(brightness && brightnessProfile && { brightness, brightnessProfile }),
  }));
  const stablePalaces = sharedValue(chart.rawResult.map(({ palaces }) => palaces.map((palace) => ({
    name: palace.name,
    earthlyBranch: palace.earthlyBranch,
    isBodyPalace: palace.isBodyPalace,
    ...(palace.stemTransformations ? {
      heavenlyStem: palace.heavenlyStem,
      stemTransformations: palace.stemTransformations.map(({ marker, star }) => ({ marker, star })),
    } : {}),
    majorStars: stars(palace.majorStars),
    minorStars: stars(palace.minorStars),
    adjectiveStars: stars(palace.adjectiveStars),
  }))));
  if (!stablePalaces) return unavailable(chart, 'ambiguous_time');
  return {
    ...chartVersion(chart), status: 'complete',
    lifePalaceBranch: stablePalaces.find(({ name }) => name === '命宫').earthlyBranch,
    bodyPalaceBranch: stablePalaces.find(({ isBodyPalace }) => isBodyPalace).earthlyBranch,
    palaces: stablePalaces.map(({ isBodyPalace, ...palace }) => palace),
  };
}

function projectWestern(chart, timeKnown) {
  if (!chart.rawResult.length) return unavailable(chart);
  if (chart.rulesetVersion !== westernRuleset) return unavailable(chart, 'unsupported_ruleset');
  const version = { ...chartVersion(chart), zodiac: 'tropical', houseSystem: 'whole-sign' };
  if (timeKnown) {
    const { positions, ascendant, midheaven, houses } = chart.rawResult[0];
    return { ...version, status: 'complete', ascendant, midheaven, houses,
      positions: positions.map(({ planet, longitude }) => ({ planet, longitude })) };
  }
  const positions = westernPlanets.flatMap((planet) => {
    const signs = chart.rawResult.map((candidate) =>
      Math.floor(candidate.positions.find((position) => position.planet === planet).longitude / 30));
    const signIndex = sharedValue(signs);
    return signIndex === null ? [] : [{ planet, signIndex }];
  });
  return positions.length ? { ...version, status: 'partial', positions } : unavailable(chart, 'ambiguous_time');
}

export function projectSynastrySnapshot(record, includeCalculationContext = false) {
  if (!record) return { status: 'no_archive' };
  const { id: archiveId, calculatedAt, report } = record;
  const snapshot = report.chartSnapshot;
  if (!snapshot) return { status: 'missing_snapshot', archiveId, calculatedAt };
  const { timeKnown, samplingVersion } = snapshot;
  return { status: 'available', snapshot: {
    archiveId, snapshotId: archiveId, calculatedAt, schemaVersion: snapshot.version, timeKnown, samplingVersion,
    ...(timeKnown && includeCalculationContext && snapshot.birthContext && { birthContext: snapshot.birthContext }),
    bazi: projectBaZi(snapshot.bazi, timeKnown, includeCalculationContext),
    ziwei: projectZiwei(snapshot.ziwei),
    western: projectWestern(snapshot.western, timeKnown),
  } };
}

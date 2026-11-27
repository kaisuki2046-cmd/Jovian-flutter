import type { DestinyChartSnapshot } from '../../destiny';
import type { FortuneFactRecord } from '../model/fortune-facts';
import { readProgressionBirth, progressedAspects, progressionEpoch, progressionPolicy } from './western-progressions';
import { readLeoEquatorial, readLeoMovingPosition, readLeoTransitDeclinations, leoParallelDifference, leoSourcePolicy } from './leo-source-context';
import { isLeoGreenStrongNatalLongitude, leoGreenNatalAspectProfile, readLeoGreenNatalAspects,
  readLeoNatalAngularSignGroup, type LeoNatalHousePosition } from './leo-natal-aspects';
import { readJupiterConjunctionEpisode, westernSearchPolicy } from './solar-transits';

const bodies = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'] as const;
const arc = (first: number, second: number) => Math.abs((first - second + 540) % 360 - 180);
const exactLongitudePrecision = 0.000001;
export const leoJupiterLuminaryPolicy = {
  profile: 'leo-jupiter-luminary-natal-links-v1', zodiac: 'tropical',
  bodies: 'nine-bodies-known-to-the-1906-text-no-pluto-or-angles',
  natalAspectOrb: leoGreenNatalAspectProfile,
  parallel: 'absolute-declination-distance-either-hemisphere',
  transit: 'existing-product-conjunction-band-not-the-source-one-month-duration',
  directions: 'same-luminary-pair-and-reference-aspect-in-the-real-transit-intersection',
  stationOrb: 2, stationTimingProfile: 'leo-1913-near-station-between-exact-passes-v1',
} as const;

export function buildLeoLuminaryNatal(chart?: DestinyChartSnapshot,
  natalHouseBodies?: readonly LeoNatalHousePosition[]) {
  const birth = readProgressionBirth(chart);
  if (birth.status !== 'ready') return { status: birth.status, policy: leoJupiterLuminaryPolicy } as const;
  const archived = chart!.western.rawResult[0].positions;
  if (bodies.some(body => archived.filter(row => row.planet === body).length !== 1)) {
    return { status: 'incomplete_or_duplicate_natal', policy: leoJupiterLuminaryPolicy } as const;
  }
  const positions = bodies.map(body => ({ body, longitude: archived.find(row => row.planet === body)!.longitude,
    declination: readLeoEquatorial(body, birth.birthAt).dec }));
  const hasHousePositions = natalHouseBodies?.length === bodies.length && natalHouseBodies.every(row => row.house !== undefined);
  const luminaries = (['Sun', 'Moon'] as const).map(luminary => {
    const target = positions.find(row => row.body === luminary)!;
    const others = positions.filter(row => row.body !== luminary);
    const natalAspects = others.map(other => {
      const separation = arc(target.longitude, other.longitude);
      const distances = progressedAspects.map(aspect => ({ aspectType: aspect.type, angle: aspect.angle,
        difference: Math.abs(separation - aspect.angle) }));
      const minimum = Math.min(...distances.map(row => row.difference));
      return { body: other.body, longitude: other.longitude, declination: other.declination, separation,
        aspectDistances: distances, closestAspects: distances.filter(row => Math.abs(row.difference - minimum) < 1e-10),
        absoluteDeclinationDifference: leoParallelDifference(target.declination, other.declination),
        sameHemisphere: target.declination === 0 || other.declination === 0 ? undefined
          : Math.sign(target.declination) === Math.sign(other.declination) };
    });
    const receivedNatalAspects = others.flatMap(other => readLeoGreenNatalAspects(target, other)
      .map(aspect => ({ body: other.body, ...aspect })));
    const natalAngularSameSignGroup = hasHousePositions ? readLeoNatalAngularSignGroup(luminary, natalHouseBodies) : undefined;
    return { luminary, natalLongitude: target.longitude, natalDeclination: target.declination, natalAspects,
      jupiterNatalPair: natalAspects.find(row => row.body === 'Jupiter')!,
      receivedNatalAspects, hasReceivedNatalAspect: receivedNatalAspects.length > 0,
      hasNatalAngularSameSignGroup: hasHousePositions ? natalAngularSameSignGroup !== undefined : undefined,
      natalAngularSameSignGroup,
      jupiterNatalAspectCandidates: receivedNatalAspects.filter(row => row.body === 'Jupiter').map(({ body: _body, ...aspect }) => aspect) };
  });
  return { status: 'ready', policy: leoJupiterLuminaryPolicy, birthAt: birth.birthAt, clockSource: birth.clockSource,
    positions, luminaries } as const;
}

// Join one validated birth, the actual illuminated target and one native
// conjunction episode. Unrelated planet records cannot supply a natal premise.
export function linkLeoJupiterLuminaries(natal: ReturnType<typeof buildLeoLuminaryNatal>, facts: FortuneFactRecord[]) {
  if (natal.status !== 'ready') return [];
  let verifiedBirthPositions: typeof natal.positions | undefined;
  const directions = facts.flatMap(fact => {
    const p = fact.normalizedPayload as Record<string, unknown> | null;
    if (fact.method !== 'western' || fact.scope !== 'progressed' || fact.completeness !== 'complete'
      || fact.sourceEngine !== 'astronomy-engine' || p?.targetKind !== 'natal'
      || p.kind !== 'secondary' || p.progressionPolicy !== progressionPolicy.version) return [];
    const sourceDirection = fact.factType === 'leo_progressed_aspect' && p.profile === leoSourcePolicy.profile;
    // Chapter XIII's example directs Jupiter to the radical luminary.
    const directedJupiter = fact.factType === 'progressed_aspect' && p.progressedBody === 'Jupiter'
      && p.zodiac === 'tropical' && p.coordinate === 'ecliptic_longitude' && p.allowedOrb === leoSourcePolicy.longitudeOrb
      && (p.natalTargetId === 'Sun' && p.aspectType === 'conjunction' || p.natalTargetId === 'Moon' && p.aspectType === 'trine')
      && natal.luminaries.some(target => target.luminary === p.natalTargetId && target.natalLongitude === p.natalLongitude);
    if (!sourceDirection && !directedJupiter) return [];
    return [{ fact, p, start: Date.parse(fact.activeFrom), end: Date.parse(fact.activeTo) }];
  });
  return facts.flatMap(fact => {
    const p = fact.normalizedPayload as Record<string, unknown> | null;
    if (fact.method !== 'western' || fact.scope !== 'transit' || fact.factType !== 'aspect_interval'
      || fact.completeness !== 'complete' || fact.sourceEngine !== 'astronomy-engine'
      || !fact.parentSignalId || !p || p.zodiac !== 'tropical' || p.transitBody !== 'Jupiter'
      || p.natalTargetType !== 'planet' || p.aspectType !== 'conjunction'
      || typeof p.allowedOrb !== 'number' || !Number.isFinite(p.allowedOrb) || p.allowedOrb <= 0 || p.allowedOrb > 15) return [];
    const target = natal.luminaries.find(row => row.luminary === p.natalTargetId);
    const start = Date.parse(fact.activeFrom), end = Date.parse(fact.activeTo);
    const episodeStart = typeof p.episodeStartInstant === 'string' ? Date.parse(p.episodeStartInstant) : NaN;
    if (!target || p.natalLongitude !== target.natalLongitude || !Number.isFinite(start) || !Number.isFinite(end)
      || start <= natal.birthAt || start >= end || !Number.isFinite(episodeStart) || episodeStart > start) return [];
    const { hasNatalAngularSameSignGroup, natalAngularSameSignGroup, ...luminaryDetails } = target;
    const exact = facts.filter(row => row.method === 'western' && row.factType === 'aspect_exact'
      && row.parentSignalId === fact.parentSignalId && row.completeness === 'complete'
      && row.exactInstant && start <= Date.parse(row.exactInstant) && Date.parse(row.exactInstant) < end
      && (() => { const data = row.normalizedPayload as Record<string, unknown> | null;
        return data?.transitBody === 'Jupiter' && data?.natalTargetId === target.luminary
          && data?.natalLongitude === target.natalLongitude && data?.aspectType === 'conjunction'; })());
    const exactPasses = exact.map(row => {
      const data = row.normalizedPayload as Record<string, unknown>;
      return { at: row.exactInstant!, direction: data.transitMotion, passIndex: data.passIndex };
    }).sort((a, b) => a.at.localeCompare(b.at)).filter((row, i, all) => !i || row.at !== all[i - 1].at);
    const exactPassDeclinations = exactPasses.map(({ at }) => ({ at,
      ...readLeoTransitDeclinations('Jupiter', Date.parse(at), target.natalDeclination) }));
    const episode = readJupiterConjunctionEpisode(episodeStart, target.natalLongitude, p.allowedOrb);
    const tolerance = westernSearchPolicy.stationToleranceMs;
    const verifiedEpisode = episode && episode.start - tolerance <= start && end <= episode.end + tolerance ? episode : undefined;
    const nativePassage = verifiedEpisode ? {
      enteredAt: new Date(verifiedEpisode.start).toISOString(), exitedAt: new Date(verifiedEpisode.end).toISOString(),
      durationDays: (verifiedEpisode.end - verifiedEpisode.start) / 86_400_000,
      exactPasses: verifiedEpisode.exact.map(({ at, direction }, index) => ({ at: new Date(at).toISOString(), direction, passIndex: index + 1 })),
    } : undefined;
    const natalLuminaryStationWitnesses = verifiedEpisode?.stations.flatMap(({ at, longitude, directionAfter }) => {
      if (at < start || at >= end) return [];
      const distance = arc(longitude, target.natalLongitude);
      // Leo's second edition singles out stations near a sensitive degree.
      return distance <= leoJupiterLuminaryPolicy.stationOrb
        ? [{ at: new Date(at).toISOString(), longitude, distance, directionAfter }] : [];
    });
    const overlaps = directions.flatMap(direction => {
      const { progressedBody, natalTargetId, aspectType, coordinate } = direction.p;
      const other = progressedBody === target.luminary ? natalTargetId : natalTargetId === target.luminary ? progressedBody : undefined;
      const from = Math.max(start, direction.start), to = Math.min(end, direction.end);
      if (!(from < to) || !target.receivedNatalAspects.some(row => row.body === other && row.aspect === aspectType
        && (row.coordinate === 'longitude' ? coordinate === 'ecliptic_longitude' : coordinate === 'equatorial_declination_of_date'))) return [];
      return [{ fact: direction.fact, progressedBody, natalTargetId, aspectType,
        start: new Date(from).toISOString(), endExclusive: new Date(to).toISOString() }];
    });
    const directionsAtExactPasses = exactPasses.flatMap(({ at }) => overlaps
      .filter(direction => direction.start <= at && at < direction.endExclusive)
      .map(({ progressedBody, natalTargetId, aspectType }) => ({ at, progressedBody, natalTargetId, aspectType })));
    // Recheck against the actual birth coordinates before confirming a passage or the station it brackets.
    const { verifiedPasses, verifiedStations } = exact.length || natalLuminaryStationWitnesses?.length ? (() => {
      const birthPositions = verifiedBirthPositions ??= natal.positions.map(position => ({ ...position,
        longitude: readLeoMovingPosition(position.body, natal.birthAt).longitude }));
      const luminary = birthPositions.find(position => position.body === target.luminary)!;
      const jupiter = birthPositions.find(position => position.body === 'Jupiter')!;
      const jupiterAspects = readLeoGreenNatalAspects(luminary, jupiter);
      const hasNatalJupiterAspect = jupiterAspects.length > 0;
      const strongLongitude = jupiterAspects.find(isLeoGreenStrongNatalLongitude);
      const parallel = jupiterAspects.find(contact => contact.aspect === 'parallel');
      const natalJupiterLongitudePriority = strongLongitude && parallel ? { longitude: strongLongitude, parallel } : undefined;
      const hasReceivedNatalAspect = hasNatalJupiterAspect || birthPositions.some(other =>
        other.body !== luminary.body && other.body !== 'Jupiter' && readLeoGreenNatalAspects(luminary, other).length > 0);
      const difference = Math.abs(arc(luminary.longitude, jupiter.longitude) - 120);
      const hasExactNatalJupiterTrine = difference <= exactLongitudePrecision;
      const isExactPass = (at: number) => arc(readLeoMovingPosition('Jupiter', at).longitude, luminary.longitude) <= exactLongitudePrecision;
      const verifiedPasses = exact.flatMap(row => {
        const at = Date.parse(row.exactInstant!), to = Math.min(at + 1_000, end, Date.parse(row.activeTo));
        if (at >= to || !isExactPass(at)) return [];
        const repeatedDirection = (body: string, target: string, aspect: string) => overlaps.find(direction =>
          direction.progressedBody === body && direction.natalTargetId === target && direction.aspectType === aspect
          && direction.start <= row.exactInstant! && row.exactInstant! < direction.endExclusive
          && direction.fact.calculationRunId === row.calculationRunId && direction.fact.natalChartSnapshotId === row.natalChartSnapshotId
          && direction.fact.profileId === row.profileId && direction.fact.periodType === row.periodType);
        const lunarParallel = luminary.body === 'Moon' && parallel && !strongLongitude ? repeatedDirection('Moon', 'Jupiter', 'parallel') : undefined;
        const natalLunarLongitude = luminary.body === 'Moon'
          ? jupiterAspects.find(contact => contact.aspect === 'trine' || contact.aspect === 'sextile') : undefined;
        const lunarLongitude = natalLunarLongitude && repeatedDirection('Moon', 'Jupiter', natalLunarLongitude.aspect);
        const repeatedMoonJupiterLongitude = lunarLongitude && natalLunarLongitude ? (() => {
          const progressedLongitude = readLeoMovingPosition('Moon', Math.round(progressionEpoch(natal.birthAt, at))).longitude;
          const angle = natalLunarLongitude.aspect === 'trine' ? 120 : 60;
          const deviation = Math.abs(arc(progressedLongitude, jupiter.longitude) - angle);
          if (deviation > leoSourcePolicy.longitudeOrb) return undefined;
          return { aspect: natalLunarLongitude.aspect, natalDeviation: natalLunarLongitude.difference,
            progressedLongitude, natalJupiterLongitude: jupiter.longitude, deviation };
        })() : undefined;
        const repeatedMoonJupiterParallel = lunarParallel && parallel ? (() => {
          const progressedDeclination = readLeoEquatorial('Moon', Math.round(progressionEpoch(natal.birthAt, at))).dec;
          const deviation = leoParallelDifference(progressedDeclination, jupiter.declination);
          if (deviation > leoSourcePolicy.parallelOrb) return undefined;
          return { natalDeviation: parallel.difference, progressedDeclination, natalJupiterDeclination: jupiter.declination, deviation };
        })() : undefined;
        const directedAspect = luminary.body === 'Sun' ? 'conjunction' : 'trine';
        const natalJupiterDirection = jupiterAspects.find(contact => contact.aspect === directedAspect);
        const directedJupiter = natalJupiterDirection && repeatedDirection('Jupiter', luminary.body, directedAspect);
        const repeatedProgressedJupiterToLuminary = directedJupiter && natalJupiterDirection ? (() => {
          const progressedLongitude = readLeoMovingPosition('Jupiter', Math.round(progressionEpoch(natal.birthAt, at))).longitude;
          const angle = directedAspect === 'trine' ? 120 : 0;
          const deviation = Math.abs(arc(progressedLongitude, luminary.longitude) - angle);
          if (deviation > leoSourcePolicy.longitudeOrb) return undefined;
          return { aspect: directedAspect, natalDeviation: natalJupiterDirection.difference,
            progressedLongitude, natalLuminaryLongitude: luminary.longitude, deviation };
        })() : undefined;
        return [{ start: at, end: to, at: row.exactInstant!, transit: row, hasReceivedNatalAspect, hasNatalJupiterAspect,
          hasNatalAngularSameSignGroup, natalAngularSameSignGroup,
          hasNatalJupiterLongitudePriority: natalJupiterLongitudePriority !== undefined, natalJupiterLongitudePriority,
          hasExactNatalJupiterTrine, natalTrineDifference: hasExactNatalJupiterTrine ? difference : undefined,
          repeatedMoonJupiterParallel, repeatedMoonJupiterLongitude, repeatedProgressedJupiterToLuminary,
          directionSourceFactIds: [...new Set([
            ...(repeatedMoonJupiterParallel ? lunarParallel?.fact.sourceFactIds ?? [] : []),
            ...(repeatedMoonJupiterLongitude ? lunarLongitude?.fact.sourceFactIds ?? [] : []),
            ...(repeatedProgressedJupiterToLuminary ? directedJupiter?.fact.sourceFactIds ?? [] : []),
          ])] }];
      });
      const verifiedStations = (natalLuminaryStationWitnesses ?? []).flatMap(station => {
        const at = Date.parse(station.at);
        const before = verifiedEpisode?.exact.findLast(pass => pass.at < at);
        const after = verifiedEpisode?.exact.find(pass => at < pass.at);
        const separation = arc(readLeoMovingPosition('Jupiter', at).longitude, luminary.longitude);
        if (!before || !after || before.direction === station.directionAfter || after.direction !== station.directionAfter
          || separation > leoJupiterLuminaryPolicy.stationOrb || !isExactPass(before.at) || !isExactPass(after.at)) return [];
        return [{ start: at, end: Math.min(at + 1_000, end), at: station.at, directionAfter: station.directionAfter,
          separation, before: new Date(before.at).toISOString(), after: new Date(after.at).toISOString(),
          hasReceivedNatalAspect, hasNatalJupiterAspect }];
      });
      return { verifiedPasses, verifiedStations };
    })() : { verifiedPasses: [], verifiedStations: [] };
    return [{ start, end, parentSignalId: fact.parentSignalId, subjectIds: fact.subjectIds,
      verifiedPasses, verifiedStations,
      sourceFactIds: [...new Set([fact, ...exact, ...overlaps.map(row => row.fact)].flatMap(row => row.sourceFactIds))],
      payload: { profile: leoJupiterLuminaryPolicy.profile, zodiac: 'tropical', birthVerified: true,
        natalAspectProfile: leoJupiterLuminaryPolicy.natalAspectOrb,
        birthAt: new Date(natal.birthAt).toISOString(), clockSource: natal.clockSource, positions: natal.positions, ...luminaryDetails,
        transitBody: 'Jupiter', transitConjunction: true, productOrb: p.allowedOrb,
        episodeStart: new Date(episodeStart).toISOString(), enters: p.enters === true, exits: p.exits === true,
        exactPasses, exactPassDeclinations, hasExactInWindow: exactPasses.length > 0, nativePassage, natalLuminaryStationWitnesses,
        linkedTransitFactId: fact.factId,
        repeatingDirections: overlaps.map(({ fact: _fact, ...direction }) => direction), directionsAtExactPasses,
        natalAspectOrbVerified: true, sourceMonthDurationVerified: false, directionsVerified: false } }];
  });
}

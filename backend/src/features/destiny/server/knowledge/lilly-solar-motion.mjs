import { zodiacNames } from '../../control/charts.ts';
import { lillyHouseFacts } from '../../control/lilly-houses.mjs';

export const lillySolarProfile = 'lilly-1647-solar-proximity-v1';
export const lillyMotionProfile = 'lilly-1647-mean-daily-motion-v1';
export const lillySolarStates = ['combust', 'under_beams', 'cazimi', 'free_of_beams', 'oriental', 'occidental'];
export const lillyMotionStates = ['swift', 'slow'];
const bodies = { sun: 'Sun', moon: 'Moon', mercury: 'Mercury', venus: 'Venus', mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturn' };
export const isLillyMotionSelector = selector => Object.hasOwn(bodies, selector);
export const isLillySolarSelector = selector => Object.hasOwn(bodies, selector) && selector !== 'sun'
  || /^house_(?:1|2|5)_ruler$/u.test(selector);
// Book I pp.57,61,65,69,72,76,80: arcseconds of daily mean motion.
// Moon's mean 13°10′36″ is not the distinct figurative-retrograde threshold.
export const lillyMeanDailyArcseconds = { sun: 3548, moon: 47436, mercury: 3548, venus: 3548, mars: 1887, jupiter: 299, saturn: 121 };
const tropical = facts => {
  const values = new Set(facts.filter(f => f.kind === 'western_zodiac').map(f => f.zodiac));
  return values.size === 1 && values.has('tropical');
};
const emit = (kind, selector, condition, matches, profile) => ({ kind, selector, condition, matches, profile });

export function lillySolarFacts(facts) {
  if (!tropical(facts)) return [];
  const positions = new Map();
  function position(planet) {
    if (positions.has(planet)) return positions.get(planet);
    const values = new Set(facts.filter(f => f.kind === 'planet_longitude' && f.planet === planet).map(f => f.longitude));
    const signs = new Set(facts.filter(f => f.kind === 'planet_sign' && f.planet === planet).map(f => f.sign));
    const [longitude] = values;
    const valid = values.size === 1 && Number.isFinite(longitude) && longitude >= 0 && longitude < 360
      && (!signs.size || signs.size === 1 && signs.has(zodiacNames[Math.floor(longitude / 30)]));
    positions.set(planet, valid ? longitude : null); return positions.get(planet);
  }
  const sun = position('Sun'); if (sun === null) return [];
  const selectors = new Map(Object.entries(bodies).filter(([name]) => name !== 'sun'));
  for (const fact of lillyHouseFacts(facts)) if (fact.kind === 'western_lilly_house_ruler' && [1, 2, 5].includes(fact.house)) selectors.set(`house_${fact.house}_ruler`, fact.planet);
  const results = [];
  for (const [selector, planet] of selectors) {
    // A house ruler resolving to the Sun is not a second body in its heart.
    if (planet === 'Sun') continue;
    const longitude = position(planet); if (longitude === null) continue;
    const elongation = ((longitude - sun) % 360 + 360) % 360;
    const distance = Math.min(elongation, 360 - elongation);
    const sameSign = Math.floor(longitude / 30) === Math.floor(sun / 30);
    const cazimi = distance <= 17 / 60 + 1e-10;
    const values = {
      cazimi,
      // p.113's explicit 8°30′ definition and same-sign prerequisite.
      // Cazimi takes priority as an interpretive exception (p.113 and IIIp.628).
      combust: !cazimi && sameSign && distance < 8.5,
      under_beams: !cazimi && distance < 17,
      free_of_beams: distance >= 17,
    };
    for (const [condition, matches] of Object.entries(values)) results.push(emit('western_lilly_solar_state', selector, condition, matches, lillySolarProfile));
    // p.114 uses solar-relative longitude, not the first house. Exact
    // conjunction/opposition is the phase transition; do not manufacture a
    // direction or its absence there. The Sun's own quadrant is a different rule.
    if (distance > 1e-10 && Math.abs(distance - 180) > 1e-10) {
      results.push(emit('western_lilly_solar_state', selector, 'oriental', elongation > 180, lillySolarProfile),
        emit('western_lilly_solar_state', selector, 'occidental', elongation < 180, lillySolarProfile));
    }
  }
  return results;
}

export function lillyMotionFacts(facts) {
  if (!tropical(facts)) return [];
  return Object.entries(bodies).flatMap(([selector, planet]) => {
    const values = new Set(facts.filter(f => f.kind === 'planet_daily_motion' && f.planet === planet).map(f => f.signedDegrees));
    const [value] = values;
    if (values.size !== 1 || !Number.isFinite(value) || Math.abs(value) > 32) return [];
    // Book I pp.42–43 reverses subtraction for retrograde daily motion:
    // magnitude and direction remain separate, as in the mine's AND condition.
    const daily = Math.abs(value), mean = lillyMeanDailyArcseconds[selector] / 3600;
    return [emit('western_lilly_speed_state', selector, 'swift', daily > mean, lillyMotionProfile),
      emit('western_lilly_speed_state', selector, 'slow', daily < mean, lillyMotionProfile)];
  });
}

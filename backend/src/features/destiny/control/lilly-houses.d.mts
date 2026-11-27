export const lillyHouseRuleset: 'lilly-1647-longitude-five-degree-v1';
export function lillyHouse(longitude: number, cusps: number[]): number | null;
export function lillyDomicileRuler(longitude: number): string;
type ChartEvidence = ReadonlyArray<{ kind: string; [key: string]: unknown }>;
export function lillyCusps(facts: ChartEvidence): number[] | null;
type LillyHouseFact =
  | { kind: 'western_lilly_ruleset'; ruleset: typeof lillyHouseRuleset }
  | { kind: 'western_lilly_house_ruler'; house: number; planet: string }
  | { kind: 'western_lilly_planet_house'; planet: string; house: number }
  | { kind: 'western_lilly_ruler_house'; house: number; placedIn: number };
export function lillyHouseFacts(facts: ChartEvidence): LillyHouseFact[];

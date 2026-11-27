export type ChenHuangjiKeSteps = { yearMonth?: number; dayHour?: number };

// Adding 30 spans 400 distinct steps in a 12,000-number cycle.
export const chenHuangjiKeStepLimit = 399;

export function parseChenHuangjiKeSteps(value: unknown): ChenHuangjiKeSteps | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const entries = Object.entries(value);
  if (!entries.length || entries.some(([axis, steps]) =>
    !['yearMonth', 'dayHour'].includes(axis) || typeof steps !== 'number'
    || !Number.isInteger(steps) || steps < 0 || steps > chenHuangjiKeStepLimit)) return null;
  return Object.fromEntries(entries);
}

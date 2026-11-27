function satisfiesFields(payload, where) {
  let unknown = false;
  for (const [key, expected] of Object.entries(where)) {
    const actual = payload?.[key];
    if (actual === undefined || actual === null) {
      unknown = true;
      continue;
    }
    if (!satisfiesValue(actual, expected)) return false;
  }
  return unknown ? undefined : true;
}

function satisfiesValue(actual, expected) {
  if (expected === null || typeof expected !== 'object') return actual === expected;
  if (expected.includes !== undefined) return Array.isArray(actual) && actual.includes(expected.includes);
  if (expected.includesAll) return Array.isArray(actual) && expected.includesAll.every(value => actual.includes(value));
  if (expected.includesAny) return Array.isArray(actual) && expected.includesAny.some(value => actual.includes(value));
  if (expected.oneOf) return expected.oneOf.some(value => actual === value);
  if (expected.gte !== undefined) return typeof actual === 'number' && actual >= expected.gte;
  return false;
}

// The caller has already verified the fact type and scope.
export function evaluateFortunePredicate(fact, query) {
  if (fact.completeness !== 'complete') return undefined;
  if (query.minimumDurationHours !== undefined) {
    const hours = (Date.parse(fact.activeTo) - Date.parse(fact.activeFrom)) / 3_600_000;
    if (!Number.isFinite(hours)) return undefined;
    if (hours < query.minimumDurationHours) return false;
  }
  const base = satisfiesFields(fact.normalizedPayload, query.where);
  if (base === false || !query.anyOf) return base;
  let unknown = false;
  for (const where of query.anyOf) {
    const branch = satisfiesFields(fact.normalizedPayload, where);
    if (branch === true) return base;
    if (branch === undefined) unknown = true;
  }
  return unknown ? undefined : false;
}

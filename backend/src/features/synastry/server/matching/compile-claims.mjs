import '../typescript-imports.mjs';
import { sourceEntries } from '../knowledge/entries.mjs';
const { registeredFactFields } = await import('../../model/interpretation-facts.ts');
const { comparisonDirections } = await import('../../model/algorithm-profiles.ts');
const { sourceFactRequirements } = await import('./source-fact-requirements.ts');

const scalar = (value) => typeof value === 'string' && value.length > 0 || Number.isFinite(value);
const record = (value) => value && typeof value === 'object' && !Array.isArray(value);
const objectFields = ['equal', 'oneOf', 'members', 'withoutMembers', 'bindToFirst'];
const specFields = ['factTypeId', 'direction', ...objectFields];

function requirement(entry, conditionIndex, index, spec) {
  const id = [entry.id, conditionIndex, index].join(':');
  if (!record(spec) || Object.keys(spec).some((key) => !specFields.includes(key))
    || objectFields.some((key) => Object.hasOwn(spec, key) && !record(spec[key]))) {
    throw new Error(id + ': invalid condition fields');
  }
  const { method } = entry.category;
  const prefix = method + ':';
  const rule = typeof spec.factTypeId === 'string' && spec.factTypeId.startsWith(prefix) ? spec.factTypeId.slice(prefix.length) : undefined;
  const fields = rule && registeredFactFields(method, rule);
  if (!fields || !comparisonDirections.includes(spec.direction)) throw new Error(id + ': invalid fact type or direction');
  const { primary, supporting } = sourceFactRequirements(id, method, rule);
  const conditions = [{ id: id + ':direction', field: 'direction', required: true,
    operator: 'eq', expected: spec.direction, description: '作用方向' }];
  for (const [key, value] of Object.entries(spec.equal ?? {})) {
    if (!fields.includes(key) || !scalar(value)) throw new Error(id + ': unsupported equality field ' + key);
    conditions.push({ id: id + ':eq:' + key, field: 'facts.' + key, required: true,
      operator: 'eq', expected: value, description: key });
  }
  for (const [key, values] of Object.entries(spec.oneOf ?? {})) {
    if (!fields.includes(key) || !Array.isArray(values) || !values.length || !values.every(scalar)) {
      throw new Error(id + ': unsupported alternatives for ' + key);
    }
    conditions.push({ id: id + ':in:' + key, field: 'facts.' + key, required: true,
      operator: 'in', expected: values, description: key });
  }
  const members = (key, operator) => Object.entries(spec[key] ?? {}).flatMap(([field, values]) => {
    if (!fields.includes(field) || !Array.isArray(values) || !values.length
      || !values.every((value) => typeof value === 'string' && value.trim() && !value.includes('、'))) {
      throw new Error(id + ': unsupported member list for ' + field);
    }
    return values.map((value) => ({ id: id + ':' + key + ':' + field + ':' + value,
      field: 'facts.' + field, operator, expected: value, required: true, description: field }));
  });
  conditions.push(...members('members', 'member'), ...members('withoutMembers', 'not_member'));
  if (conditions.length === 1) throw new Error(id + ': missing source-specific conditions');
  return { fields, supporting, input: { ...primary, conditions: [...conditions, ...primary.conditions] } };
}

function compileGroup(entry, conditionIndex, group) {
  const required = [];
  const bindings = [];
  let firstFields;
  for (const [index, spec] of group.entries()) {
    const { fields, supporting, input } = requirement(entry, conditionIndex, index, spec);
    firstFields ??= fields;
    const slot = required.length;
    if (spec.bindToFirst) {
      const pairs = Object.entries(spec.bindToFirst);
      if (!slot || !pairs.length || pairs.some(([ownField, firstField]) =>
        !fields.includes(ownField) || !firstFields.includes(firstField))) {
        throw new Error(entry.id + ':' + conditionIndex + ':' + index + ': invalid fact binding');
      }
      bindings.push({ first: 0, second: slot, fields: spec.bindToFirst });
    }
    required.push(input);
    if (supporting) {
      bindings.push({ first: slot, second: required.length, fields: supporting.fields });
      required.push(supporting.input);
    }
  }
  return { required, bindings, relations: [] };
}

export function compileEntryPrograms(entries = sourceEntries) {
  const programs = [];
  const unresolved = [];
  for (const entry of entries) {
    const { id: entryId, matchConditions: { formatted } } = entry;
    if (formatted.status === 'unresolved') {
      unresolved.push({ entryId, reason: formatted.reason });
      continue;
    }
    for (const [conditionIndex, group] of formatted.alternatives.entries()) {
      if (!Array.isArray(group) || !group.length) throw new Error(entryId + ': empty condition group');
      programs.push({ entryId, conditionIndex, program: compileGroup(entry, conditionIndex, group) });
    }
  }
  return { programs, unresolved };
}

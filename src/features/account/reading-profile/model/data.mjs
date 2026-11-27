export const birthProfileFields = ['birthDate', 'birthTime', 'birthPlace', 'gender'];
const genders = ['female', 'male', 'other'];

export function emptyReadingProfile() {
  return { birthDate: '', birthTime: '', birthPlace: '', gender: '', visibility: Object.fromEntries(birthProfileFields.map((key) => [key, false])) };
}

export function birthFieldsOf(profile) {
  return Object.fromEntries(birthProfileFields.map((field) => [field, profile[field]]));
}

export function sameBirthFields(left, right) {
  return birthProfileFields.every((field) => left[field] === right[field]);
}

export function parseBirthProfile(input) {
  const data = {};
  for (const key of birthProfileFields) {
    if (typeof input?.[key] !== 'string') return;
    data[key] = input[key].trim();
  }
  if (data.birthDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.birthDate) || data.birthDate.startsWith('0000')) return;
    const date = new Date(data.birthDate + 'T00:00:00Z');
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== data.birthDate) return;
  }
  if (data.birthTime && (data.birthTime === '??:??' || !/^(?:[01]\d|2[0-3]|\?\?):(?:[0-5]\d|\?\?)$/.test(data.birthTime))) return;
  if (Array.from(data.birthPlace).length > 100 || (data.gender && !genders.includes(data.gender))) return;
  return data;
}

export function parseReadingInput(input) {
  const data = parseBirthProfile(input);
  if (!data || birthProfileFields.some((key) => typeof input.visibility?.[key] !== 'boolean')) return;
  return { ...data, visibility: Object.fromEntries(birthProfileFields.map((key) => [key, input.visibility[key]])) };
}

export function visibleReadingProfile(data) {
  return Object.fromEntries(birthProfileFields.filter((key) => data.visibility[key] && data[key]).map((key) => [key, data[key]]));
}

export function ownerReadingProfile(data) {
  const reading = data ?? emptyReadingProfile();
  return { reading, visible: visibleReadingProfile(reading) };
}

export function readingPreview(data) {
  const { reading, visible } = ownerReadingProfile(data);
  return { visible, filled: birthProfileFields.filter((key) => Boolean(reading[key])) };
}

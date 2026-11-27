import type { AccountBirthProfile } from '../../account';
import { resolveAccountBirthPlace } from './birth-places';
import { birthGenderOptions, birthTimeFromParts, isBirthDate, unknownBirthTime, type BirthProfile } from './birth-profile';

export const accountBirthFields = ['birthDate', 'birthTime', 'birthPlace', 'gender'] as const;

export function readAccountBirthProfile(fields: AccountBirthProfile): Partial<BirthProfile> {
  const [year, month, day] = fields.birthDate.split('-').map(Number);
  const date = { year, month, day };
  const time = /^([01]\d|2[0-3]|\?\?):([0-5]\d|\?\?)$/u.exec(fields.birthTime);
  const part = (value: string) => value === '??' ? null : Number(value);
  return {
    date: /^\d{4}-\d{2}-\d{2}$/u.test(fields.birthDate) && isBirthDate(date) ? date : undefined,
    time: time ? birthTimeFromParts(part(time[1]), part(time[2])) : fields.birthTime === '' ? unknownBirthTime : undefined,
    place: resolveAccountBirthPlace(fields.birthPlace),
    gender: birthGenderOptions.find((gender) => gender === fields.gender),
  };
}

export function completeAccountBirthProfile(fields: AccountBirthProfile): BirthProfile | null {
  const { date, time, place, gender } = readAccountBirthProfile(fields);
  return date && time?.timeKnown && place && gender ? { date, time, place, gender } : null;
}

export function accountBirthProfileFromDraft({ date, time, place, gender }: BirthProfile): AccountBirthProfile {
  const pad = (value: number) => String(value).padStart(2, '0');
  return {
    birthDate: [date.year, pad(date.month), pad(date.day)].join('-'),
    birthTime: time.hour === null && time.minute === null ? ''
      : [time.hour, time.minute].map((value) => value === null ? '??' : pad(value)).join(':'),
    birthPlace: place.name,
    gender,
  };
}

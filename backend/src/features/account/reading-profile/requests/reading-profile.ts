import { accountClient, accountRequest } from '../../client';

import {
  readingFields, type AccountBirthProfile, type BirthProfileField, type ReadingViews, type ReadingProfile,
} from '../model/reading-profile';

function parseViews(value: unknown): ReadingViews {
  const { reading, visible } = value as Partial<ReadingViews>;
  if (!reading || !visible || readingFields.some(({ key }) =>
    typeof reading[key] !== 'string' || typeof reading.visibility?.[key] !== 'boolean' ||
    (visible[key] !== undefined && typeof visible[key] !== 'string'))) {
    throw new Error('Invalid reading profile.');
  }
  return { reading, visible };
}

export function requestReadingProfile(signal?: AbortSignal) {
  return accountClient.request('/account/reading-profile', { ...accountRequest(true), signal, parse: parseViews });
}

function parseBirthFields<Field extends BirthProfileField>(value: unknown, fields: readonly Field[]): Pick<AccountBirthProfile, Field> {
  const profile = value as Partial<AccountBirthProfile> | null;
  if (!profile || fields.some((key) => typeof profile[key] !== 'string')) {
    throw new Error('Invalid account birth profile.');
  }
  return Object.fromEntries(fields.map((key) => [key, profile[key]])) as Pick<AccountBirthProfile, Field>;
}

export function requestAccountBirthProfile<Field extends BirthProfileField>(
  expectedOwnerId: string, fields: readonly Field[], signal?: AbortSignal,
) {
  const requested = [...fields];
  return accountClient.request('/account/reading-profile/birth-profile', {
    ...accountRequest(true), query: { expectedOwnerId, fields: requested.join(',') }, signal,
    parse: (value) => parseBirthFields(value, requested),
  });
}

export function confirmAccountBirthProfile(
  expectedOwnerId: string, expected: AccountBirthProfile, profile: AccountBirthProfile, signal?: AbortSignal,
) {
  return accountClient.request('/account/reading-profile/birth-profile', {
    ...accountRequest(true), method: 'PATCH', body: { expectedOwnerId, expected, profile }, signal,
    parse: (value) => parseBirthFields(value, readingFields.map(({ key }) => key)),
  });
}

export function requestBirthWheelDefaults(signal?: AbortSignal) {
  return accountClient.request('/account/reading-profile/wheel-defaults', {
    ...accountRequest(true), signal,
    parse(value) {
      const fields = value as Partial<Pick<ReadingProfile, 'birthDate' | 'birthTime'>> | null;
      if (!fields || typeof fields.birthDate !== 'string' || typeof fields.birthTime !== 'string') {
        throw new Error('Invalid birth wheel defaults.');
      }
      return { birthDate: fields.birthDate, birthTime: fields.birthTime };
    },
  });
}

export function saveReadingProfile(expectedOwnerId: string, expectedReading: ReadingProfile, reading: ReadingProfile) {
  return accountClient.request('/account/reading-profile', {
    ...accountRequest(true), method: 'PATCH', body: { ...reading, expectedOwnerId, expectedReading }, parse: parseViews,
  });
}

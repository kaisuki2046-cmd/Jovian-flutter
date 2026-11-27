import { fail } from '../../control/account-failure.mjs';
import {
  birthFieldsOf, birthProfileFields, emptyReadingProfile, ownerReadingProfile, parseBirthProfile,
  parseReadingInput, readingPreview, sameBirthFields,
} from '../model/data.mjs';

function requireOwner(userId, expectedOwnerId) {
  if (typeof expectedOwnerId !== 'string' || !expectedOwnerId) fail(400);
  if (userId !== expectedOwnerId) fail(403);
}

function sameReadingProfile(left, right) {
  return sameBirthFields(left, right) && birthProfileFields.every((field) => left.visibility[field] === right.visibility[field]);
}

export function createReadingProfileControl({ store, now }) {
  return {
    birthProfile(userId, expectedOwnerId, requestedFields) {
      requireOwner(userId, expectedOwnerId);
      const fields = requestedFields?.split(',') ?? [];
      if (fields.length === 0 || fields.length > birthProfileFields.length
        || new Set(fields).size !== fields.length || fields.some((field) => !birthProfileFields.includes(field))) fail(400);
      const profile = store.getReadingProfile(userId) ?? emptyReadingProfile();
      return Object.fromEntries(fields.map((field) => [field, profile[field]]));
    },
    confirmBirthProfile(userId, token, body) {
      requireOwner(userId, body.expectedOwnerId);
      const expected = parseBirthProfile(body.expected);
      const next = parseBirthProfile(body.profile);
      if (!expected || !next) fail(400);
      const saved = store.updateReadingProfile(userId, token, now(), (current = emptyReadingProfile()) => {
        if (!sameBirthFields(current, expected) && !sameBirthFields(current, next)) fail(409);
        return { ...next, visibility: current.visibility };
      });
      if (!saved) fail(401);
      return birthFieldsOf(saved);
    },
    wheelDefaults(userId) {
      const { reading: { birthDate, birthTime } } = ownerReadingProfile(store.getReadingProfile(userId));
      return { birthDate, birthTime };
    },
    visible: (userId) => ({ visible: ownerReadingProfile(store.getReadingProfile(userId)).visible }),
    preview: (userId) => readingPreview(store.getReadingProfile(userId)),
    owner: (userId) => ownerReadingProfile(store.getReadingProfile(userId)),
    update(userId, token, body) {
      const next = parseReadingInput(body);
      const expected = body.expectedReading === undefined ? undefined : parseReadingInput(body.expectedReading);
      if (!next || (body.expectedReading !== undefined && !expected)) fail(400);
      if (expected || body.expectedOwnerId !== undefined) requireOwner(userId, body.expectedOwnerId);
      const saved = store.updateReadingProfile(userId, token, now(), (current = emptyReadingProfile()) => {
        if (expected && !sameReadingProfile(current, expected) && !sameReadingProfile(current, next)) fail(409);
        return next;
      });
      if (!saved) fail(401);
      return ownerReadingProfile(saved);
    },
  };
}

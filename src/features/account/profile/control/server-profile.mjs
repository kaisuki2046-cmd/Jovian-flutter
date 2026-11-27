import { fail } from '../../control/account-failure.mjs';
import { ownerReadingProfile } from '../../reading-profile/model/data.mjs';
import { profileForVisitor, profileInput, profileVisibility } from '../model/profile.mjs';

export function createProfileControl({ store, now, ownerProfile }) {
  return {
    preview(user, visitorId) {
      const target = visitorId ? store.getProfile(visitorId) : user;
      if (!target) fail(404);
      const { reading, visible } = ownerReadingProfile(store.getReadingProfile(visitorId ?? user.id));
      const profile = { ...profileForVisitor(target), reading: visible };
      return visitorId ? { profile } : { profile, visibility: { ...profileVisibility(target), ...reading.visibility } };
    },
    update(userId, token, body) {
      if (body.expectedOwnerId !== undefined && body.expectedOwnerId !== userId) fail(403);
      const profile = profileInput(body);
      if (!profile) fail(400);
      const updated = store.updateProfile(userId, token, now(), profile);
      if (updated === 'nickname-taken') fail(409);
      if (!updated) fail(401);
      return { user: ownerProfile(updated) };
    },
  };
}

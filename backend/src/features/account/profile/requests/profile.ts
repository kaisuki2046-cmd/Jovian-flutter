import { accountClient, accountRequest } from '../../client';
import { readingFields } from '../../reading-profile/model/reading-profile';
import type { ProfilePreview, VisitorProfile } from '../model/preview';
import { parseProfile, profileFields, type AccountProfile, type ProfileVisibility } from '../model/account-profile';

export function requestProfileUpdate(profile: Pick<AccountProfile, 'displayName' | 'bio'> &
  Partial<Pick<AccountProfile, 'visibility'>> & { expectedOwnerId?: string }) {
  return accountClient.request('/account/profile', {
    ...accountRequest(true),
    method: 'PATCH',
    body: profile,
    parse: parseProfile,
  });
}

export function requestProfilePreview(signal?: AbortSignal) {
  return accountClient.request('/account/profile/preview', {
    ...accountRequest(true), signal,
    parse(value): ProfilePreview {
      const { profile, visibility } = value as Partial<ProfilePreview>;
      if (!profile?.reading || !visibility || profileFields.some(({ key }) =>
        typeof visibility[key] !== 'boolean' || (profile[key] !== undefined && typeof profile[key] !== 'string')) ||
        readingFields.some(({ key }) => typeof visibility[key] !== 'boolean' ||
          (profile.reading[key] !== undefined && typeof profile.reading[key] !== 'string'))) {
        throw new Error('Invalid profile preview.');
      }
      return { profile, visibility };
    },
  });
}

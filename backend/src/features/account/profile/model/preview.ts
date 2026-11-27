import type { ReadingProfile, ReadingViews } from '../../reading-profile/model/reading-profile';
import type { AccountProfile, ProfileVisibility } from './account-profile';

export type VisitorProfile = Partial<Pick<AccountProfile, 'displayName' | 'bio'>> & { reading: ReadingViews['visible'] };
export type ProfilePreview = { profile: VisitorProfile; visibility: ProfileVisibility & ReadingProfile['visibility'] };

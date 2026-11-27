export const profileFields = [
  { key: 'displayName', label: '昵称' },
  { key: 'bio', label: '个人简介' },
] as const;

export type ProfileVisibility = Record<typeof profileFields[number]['key'], boolean>;

export type AccountProfile = {
  id: string;
  uid?: string;
  email: string | null;
  displayName: string;
  bio: string;
  hasPassword: boolean;
  nicknameRequired?: true;
  socialProvider?: 'wechat' | 'qq';
  visibility: ProfileVisibility;
};

export function parseProfile(response: unknown): AccountProfile {
  const { user } = response as { user?: Partial<AccountProfile> };
  if (!user || typeof user.id !== 'string' || (user.email !== null && typeof user.email !== 'string') ||
      typeof user.displayName !== 'string' || typeof user.bio !== 'string' ||
      (user.hasPassword !== undefined && typeof user.hasPassword !== 'boolean')) {
    throw new Error('Invalid account profile.');
  }
  return {
    id: user.id, uid: typeof user.uid === 'string' && /^[1-9]\d{7}$/.test(user.uid) ? user.uid : undefined,
    email: user.email, displayName: user.displayName, bio: user.bio, hasPassword: user.hasPassword ?? user.email !== null,
    ...(user.nicknameRequired === true ? { nicknameRequired: true as const } : {}),
    socialProvider: user.socialProvider === 'wechat' || user.socialProvider === 'qq' ? user.socialProvider : undefined,
    visibility: { displayName: user.visibility?.displayName === true, bio: user.visibility?.bio === true },
  };
}

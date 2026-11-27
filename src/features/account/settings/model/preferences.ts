import type { AppearanceMode, InterfaceLanguage } from '../../../../ui/presentationState';

export type Preferences = { appearance: AppearanceMode; language: InterfaceLanguage };
export type ProfilePhotoKind = 'avatar' | 'cover';
export const profileTagFields = [
  { key: 'zodiac', label: '星座' }, { key: 'personality', label: '性格' }, { key: 'interests', label: '兴趣' },
] as const;
type ProfileTag = (typeof profileTagFields)[number]['key'];
export type ProfileDetails = { signature: string; tags: Record<ProfileTag, string> };
export const signatureLimit = 100;
export const profileTagLimit = 30;
export const emptyProfileDetails: ProfileDetails = { signature: '', tags: { zodiac: '', personality: '', interests: '' } };
export const defaultPreferences: Preferences = { appearance: 'light', language: 'zh' };
export function parsePreferences(value: unknown): Preferences {
  const data = value && typeof value === 'object' ? value as Partial<Preferences> : {};
  return {
    appearance: data.appearance === 'dark' || data.appearance === 'system' ? data.appearance : 'light',
    language: data.language === 'en' ? 'en' : 'zh',
  };
}
export function profileStorageKey(owner: string, kind: ProfilePhotoKind | 'profile-details') {
  return `jovian.${kind}.v1.` + [...owner].map(character => character.codePointAt(0)!.toString(16)).join('-');
}

export function parseProfileDetails(value: unknown): ProfileDetails {
  const data = value && typeof value === 'object' ? value as Partial<ProfileDetails> : {};
  const clean = (text: unknown, length: number) => typeof text === 'string' ? [...text.trim()].slice(0, length).join('') : '';
  return {
    signature: clean(data.signature, signatureLimit),
    tags: {
      zodiac: clean(data.tags?.zodiac, profileTagLimit),
      personality: clean(data.tags?.personality, profileTagLimit),
      interests: clean(data.tags?.interests, profileTagLimit),
    },
  };
}

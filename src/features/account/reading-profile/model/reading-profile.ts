export const readingFields = [
  { key: 'birthDate', label: '出生年月日' },
  { key: 'birthTime', label: '出生时间' },
  { key: 'birthPlace', label: '出生地点' },
  { key: 'gender', label: '性别' },
] as const;

export type BirthProfileField = typeof readingFields[number]['key'];
export const genderLabels = { '': '不填写', female: '女', male: '男', other: '其他' };
export type AccountBirthProfile = Record<BirthProfileField, string>;
export type ReadingProfile = AccountBirthProfile & { visibility: Record<BirthProfileField, boolean> };
export type ReadingViews = { reading: ReadingProfile; visible: Partial<AccountBirthProfile> };

import { useState } from 'react';
import { isBirthDate, isBirthGenderOption, isBirthTime, type BirthDate, type BirthGenderOption, type BirthPlace, type BirthProfile, type BirthTime, type Gender } from '../model/birth-profile';

type BirthFormInput = {
  date: BirthDate | null;
  time: BirthTime | null;
  place: BirthPlace | null;
  gender: Gender | null;
};
type BirthFormErrors = Partial<Record<keyof BirthFormInput, string>>;

export function validateBirthForm({ date, time, place, gender }: BirthFormInput): BirthFormErrors {
  const errors: BirthFormErrors = {};
  if (!date || !isBirthDate(date)) errors.date = '请先选择并确认有效的出生日期。';
  if (!isBirthTime(time) || !time.timeKnown) errors.time = '请选择并确认出生的小时和分钟。';
  if (!place) errors.place = '请从目录中选择并确认出生城市或区县。';
  if (!isBirthGenderOption(gender)) errors.gender = '请选择性别。';
  return errors;
}

export function useBirthForm() {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState<BirthDate | null>(null);
  const [time, setTime] = useState<BirthTime | null>(null);
  const [place, setPlace] = useState<BirthPlace | null>(null);
  const [gender, setGender] = useState<BirthGenderOption | null>(null);
  const [errors, setErrors] = useState<BirthFormErrors>({});
  function start(profile: Partial<BirthProfile> | null) {
    setDate(profile?.date ?? null);
    setTime(profile?.time ?? null);
    setPlace(profile?.place ?? null);
    const savedGender = profile?.gender;
    setGender(isBirthGenderOption(savedGender) ? savedGender : null);
    setErrors({});
    setEditing(true);
  }

  function submit(onSubmit: (profile: BirthProfile) => void) {
    const nextErrors = validateBirthForm({ date, time, place, gender });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || !date || !time || !place || !gender) return;
    onSubmit({ date, time, place, gender });
  }

  return {
    editing, date, time, place, gender, errors, start, submit, exit: () => setEditing(false),
    setDate: (value: BirthDate) => { setDate(value); setErrors((current) => ({ ...current, date: undefined })); },
    setTime: (value: BirthTime) => { setTime(value); setErrors((current) => ({ ...current, time: undefined })); },
    setPlace: (value: BirthPlace) => { setPlace(value); setErrors((current) => ({ ...current, place: undefined })); },
    setGender: (value: BirthGenderOption) => { setGender(value); setErrors((current) => ({ ...current, gender: undefined })); },
  };
}

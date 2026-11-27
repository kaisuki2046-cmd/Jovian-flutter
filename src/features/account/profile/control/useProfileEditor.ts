import { usePreventRemove, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { RequestError } from '../../../../shared/http/client';
import { useAccountSession } from '../../auth/control/SessionProvider';
import { accountError } from '../../control/account-error';
import { useReadingProfileDraft } from '../../reading-profile/control/useReadingProfileDraft';
import { profileFields, type AccountProfile, type ProfileVisibility } from '../model/account-profile';

export function useProfileEditor(profile: AccountProfile) {
  const router = useRouter();
  const { updateProfile, busy } = useAccountSession();
  const [baseline, setBaseline] = useState(profile);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio);
  const [visibility, setVisibility] = useState(profile.visibility);
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();
  const [leave, setLeave] = useState<(() => void) | null>(null);
  const [leaveError, setLeaveError] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const pending = useRef(false);
  const reading = useReadingProfileDraft(profile.id);
  const dirty = displayName.trim() !== baseline.displayName.trim() || bio.trim() !== baseline.bio.trim() ||
    profileFields.some(({ key }) => visibility[key] !== baseline.visibility[key]);
  const saving = busy || reading.saving || leaving;

  usePreventRemove(dirty || reading.dirty || saving, ({ repeat }) => {
    if (!pending.current) {
      setLeave(() => repeat);
      setLeaveError(false);
    }
  });

  async function save() {
    if (!displayName.trim()) {
      setMessage({ text: '请输入昵称。', error: true });
      return false;
    }
    setMessage(undefined);
    try {
      const updated = await updateProfile({ displayName, bio, visibility });
      setBaseline(updated);
      setDisplayName(updated.displayName);
      setBio(updated.bio);
      setVisibility(updated.visibility);
      setMessage({ text: '个人资料已保存。' });
      return true;
    } catch (error) {
      setMessage({ text: error instanceof RequestError && error.status === 409
        ? '昵称已被使用，请换一个。' : accountError(error, '无法保存个人资料，请重试。'), error: true });
      return false;
    }
  }

  async function saveAndLeave() {
    if (!leave || pending.current) return;
    pending.current = true;
    setLeaving(true);
    setLeaveError(false);
    try {
      if ((dirty && !await save()) || (reading.dirty && !await reading.save())) {
        setLeaveError(true);
        return;
      }
      setLeave(null);
      leave();
    } finally {
      pending.current = false;
      setLeaving(false);
    }
  }

  const discardAndLeave = () => {
    if (!leave) return;
    setDisplayName(baseline.displayName);
    setBio(baseline.bio);
    setVisibility(baseline.visibility);
    reading.discard();
    setLeave(null);
    leave();
  };
  const closeLeave = () => { if (!saving) setLeave(null); };
  const openPreview = () => router.push('/account/profile-preview');
  const changeVisibility = (key: keyof ProfileVisibility, value: boolean) =>
    setVisibility((current) => ({ ...current, [key]: value }));
  return {
    displayName, setDisplayName, bio, setBio, visibility, changeVisibility, message, reading, busy,
    saving, leave, leaveError, save, saveAndLeave, discardAndLeave, closeLeave, openPreview,
  };
}

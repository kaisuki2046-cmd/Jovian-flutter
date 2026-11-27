import { useEffect, useState } from 'react';
import { accountError } from '../../control/account-error';
import type { ProfilePreview } from '../model/preview';
import { requestProfilePreview } from '../requests/profile';

export function useProfilePreview() {
  const [preview, setPreview] = useState<ProfilePreview>();
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void requestProfilePreview(controller.signal).then((data) => {
      if (!controller.signal.aborted) setPreview(data);
    }).catch((failure) => {
      if (!controller.signal.aborted) setError(accountError(failure, '无法加载预览，请重试。'));
    });
    return () => controller.abort();
  }, [revision]);

  function retry() {
    setError('');
    setRevision((value) => value + 1);
  }
  return { preview, error, retry };
}

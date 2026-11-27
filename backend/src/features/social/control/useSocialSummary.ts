import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { requestSocialSummary, type SocialSummary } from '../requests/relationships';

export function useSocialSummary(ownerId?: string) {
  const [current, setCurrent] = useState<{ ownerId: string; summary: SocialSummary }>();
  useFocusEffect(useCallback(() => {
    if (!ownerId) return;
    const controller = new AbortController();
    void requestSocialSummary(controller.signal).then((summary) => {
      if (!controller.signal.aborted) setCurrent({ ownerId, summary });
    }).catch(() => {});
    return () => controller.abort();
  }, [ownerId]));
  return current && current.ownerId === ownerId ? current.summary : undefined;
}

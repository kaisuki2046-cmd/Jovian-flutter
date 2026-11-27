import { useEffect, useState } from 'react';
import { fortuneTimeConfigured, requestFortuneTime } from '../requests/fortune-time';

type ClockSource = 'server' | 'device' | 'fallback';
type Clock = { asOf: number; source: ClockSource };

export function useFortuneClock() {
  const [clock, setClock] = useState<Clock>(() => ({ asOf: Date.now(), source: 'device' }));
  const [revision, setRevision] = useState(0);
  const [syncing, setSyncing] = useState(fortuneTimeConfigured);

  useEffect(() => {
    if (!fortuneTimeConfigured) return;
    const controller = new AbortController();
    void requestFortuneTime(controller.signal).then((asOf) => {
      if (controller.signal.aborted) return;
      setClock({ asOf, source: 'server' });
      setSyncing(false);
    }).catch(() => {
      if (controller.signal.aborted) return;
      setClock({ asOf: Date.now(), source: 'fallback' });
      setSyncing(false);
    });
    return () => controller.abort();
  }, [revision]);

  function refresh() {
    if (fortuneTimeConfigured) {
      setSyncing(true);
      setRevision((previous) => previous + 1);
    } else {
      setClock({ asOf: Date.now(), source: 'device' });
    }
  }

  return { ...clock, syncing, refresh };
}

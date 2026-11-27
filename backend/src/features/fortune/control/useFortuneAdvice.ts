import { useEffect, useRef, useState } from 'react';
import type { FortuneAdvice, FortuneAdviceGroup } from '../model/advice';

type Result = { phase: 'idle' | 'loading' | 'failed' } | { phase: 'ready'; groups: FortuneAdviceGroup[] };

export function useFortuneAdvice(onGet: (signal: AbortSignal) => Promise<FortuneAdvice>) {
  const [result, setResult] = useState<Result>({ phase: 'idle' });
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);

  async function getAdvice() {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setResult({ phase: 'loading' });
    try {
      const { groups } = await onGet(controller.signal);
      if (!controller.signal.aborted) setResult({ phase: 'ready', groups });
    } catch {
      if (!controller.signal.aborted) setResult({ phase: 'failed' });
    } finally {
      pending.current = null;
    }
  }

  return { result, getAdvice };
}

import { useCallback, useEffect, useState } from 'react';
import { requestAgreementCatalog, requestAgreementState } from '../requests/agreements';
import type { AgreementState } from '../model/agreements';

type Catalog = Awaited<ReturnType<typeof requestAgreementCatalog>>;

export function useAgreementState(active: boolean) {
  const [catalog, setCatalog] = useState<Catalog>();
  const [state, setState] = useState<AgreementState>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => {
    setCatalog(undefined);
    setState(undefined);
    setError('');
    setRevision((current) => current + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      requestAgreementCatalog(controller.signal),
      active ? requestAgreementState(controller.signal) : undefined,
    ]).then(([documents, current]) => {
      if (controller.signal.aborted) return;
      setCatalog(documents);
      setState(current);
    }).catch(() => {
      if (!controller.signal.aborted) setError('暂时无法加载协议，请重试。');
    });
    return () => controller.abort();
  }, [active, revision]);

  async function update(run: () => Promise<AgreementState>, failure: string) {
    setBusy(true);
    setError('');
    try {
      setState(await run());
    } catch {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  return { catalog, state, error, busy, reload, update };
}

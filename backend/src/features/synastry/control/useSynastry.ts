import { useEffect, useRef, useState } from 'react';
import { describeModelPermissionError, requestLatestSynastrySnapshot, useReadingHistory,
  type ArchiveIdentity, type ReadingArchive, type SynastrySnapshotResult } from '../../account';
import { RequestError } from '../../../shared/http/client';
import type { ChartFacts } from '../model/comparison';
import { compareCharts, hasUnknownBirthTime } from './compare';
import { prepareSynastrySummary } from './summary';
import { requestSynastrySummary } from '../requests/summary';
import { summarySections, type SynastrySummary } from '../model/summary';

type ArchiveState = SynastrySnapshotResult | { status: 'idle' | 'loading' | 'error' | 'unknown_time' };
type Recovery = 'ai-permission' | 'guest-session';

export function useSynastry(identity: ArchiveIdentity | null) {
  const ownerId = identity?.id;
  const memberId = identity?.kind === 'member' ? identity.id : undefined;
  const pending = useRef<AbortController | null>(null);
  const generating = useRef<AbortController | null>(null);
  const [archive, setArchive] = useState<ArchiveState>({ status: 'idle' });
  const [manualA, setManualA] = useState<ChartFacts | null>(null);
  const [manualB, setManualB] = useState<ChartFacts | null>(null);
  const [summary, setSummary] = useState<SynastrySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recovery, setRecovery] = useState<Recovery>();
  const history = useReadingHistory('synastry', ownerId);
  const { latest, save } = history;
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [savedLabel, setSavedLabel] = useState('');
  const [restoring, setRestoring] = useState(false);
  const draft = useRef<ReadingArchive | null>(null);
  const editRevision = useRef(0);

  function showSaved(report: ReadingArchive) {
    setSummary(Object.fromEntries(report.sections.map(section => [section.id, section.body])));
    draft.current = report;
    setSaveStatus('saved');
    setSavedLabel(new Date(report.calculatedAt).toLocaleString('zh-CN'));
  }
  useEffect(() => {
    if (!ownerId) return;
    const controller = new AbortController();
    const revision = editRevision.current;
    setRestoring(true);
    void latest(undefined, controller.signal).then(record => {
      if (!controller.signal.aborted && revision === editRevision.current && record) showSaved(record.report);
    }).catch(() => {
      if (!controller.signal.aborted && revision === editRevision.current) setError('暂时无法读取合盘存档，可以重试读取。');
    }).finally(() => { if (!controller.signal.aborted) setRestoring(false); });
    return () => controller.abort();
  }, [latest, ownerId]);

  useEffect(() => () => {
    pending.current?.abort();
    generating.current?.abort();
  }, []);

  function clearSummary() {
    editRevision.current++;
    generating.current?.abort();
    generating.current = null;
    setLoading(false);
    setSummary(null);
    setRecovery(undefined);
    setSaveStatus('idle'); setSavedLabel(''); draft.current = null;
  }

  async function loadArchive() {
    if (!memberId || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setArchive({ status: 'loading' });
    setManualA(null);
    clearSummary();
    setError('');
    try {
      const result = await requestLatestSynastrySnapshot(memberId, controller.signal);
      if (!controller.signal.aborted) {
        setArchive(result.status === 'available' && hasUnknownBirthTime(result.snapshot)
          ? { status: 'unknown_time' } : result);
      }
    } catch {
      if (!controller.signal.aborted) setArchive({ status: 'error' });
    } finally {
      pending.current = null;
    }
  }

  function setManualChart(side: 'a' | 'b', chart: ChartFacts | null) {
    const unknownTime = chart !== null && hasUnknownBirthTime(chart);
    const accepted = unknownTime ? null : chart;
    if (side === 'a') {
      pending.current?.abort();
      setArchive({ status: 'idle' });
      setManualA(accepted);
    } else {
      setManualB(accepted);
    }
    clearSummary();
    setError(unknownTime ? '本期合盘需要双方的出生时间，请补充后重新排盘。' : '');
  }

  async function calculate() {
    if (!identity || generating.current || (!manualA && archive.status !== 'available') || !manualB) return;
    const controller = new AbortController();
    generating.current = controller;
    setLoading(true);
    setSummary(null);
    setError('');
    setRecovery(undefined);
    try {
      const a = manualA ? { mode: 'manual_subject', chart: manualA } as const
        : archive.status === 'available' ? { mode: 'account_owner', chart: archive.snapshot } as const : null;
      if (!a) return;
      const comparison = compareCharts(a, { mode: 'manual_subject', chart: manualB });
      const body = prepareSynastrySummary(comparison);
      try {
        editRevision.current++;
        const contextKey = JSON.stringify([a.chart.calculatedAt, manualB.calculatedAt]);
        const saved = await latest(contextKey, controller.signal);
        if (saved) { if (!controller.signal.aborted) showSaved(saved.report); return; }
        const paragraphs = await requestSynastrySummary(body, controller.signal);
        if (!controller.signal.aborted) {
          setSummary(paragraphs);
          const report: ReadingArchive = { version: 1, kind: 'synastry', title: '双人合盘 · 四种关系', contextKey,
            calculatedAt: new Date().toISOString(), context: {},
            sections: summarySections.map(({ type, label }) => ({ id: type, title: label, body: paragraphs[type] ?? '' })) };
          draft.current = report;
          setSaveStatus('saving');
          try { await save(report, controller.signal); if (!controller.signal.aborted) showSaved(report); }
          catch { if (!controller.signal.aborted) setSaveStatus('failed'); }
        }
      } catch (failure) {
        if (controller.signal.aborted) return;
        const status = failure instanceof RequestError ? failure.status : undefined;
        if (status === 428) {
          setError('在线合盘需要 AI 数据共享授权，授权后可继续比较。');
          setRecovery('ai-permission');
        } else if (status === 401 && identity.kind === 'guest') {
          setError('游客会话已失效，请重新进入访客体验。');
          setRecovery('guest-session');
        } else {
          setError(describeModelPermissionError(failure) ?? '合盘解读请求失败，请重试。');
        }
      }
    } catch {
      if (!controller.signal.aborted) setError('盘面比较失败，请重新读取或核对双方资料。');
    } finally {
      if (generating.current === controller) {
        generating.current = null;
        setLoading(false);
      }
    }
  }

  async function openSaved(id: string) {
    clearSummary(); setError(''); setRestoring(true);
    const controller = new AbortController(); generating.current = controller;
    try { const record = await history.read(id, controller.signal); if (!controller.signal.aborted) showSaved(record.report); }
    catch { if (!controller.signal.aborted) setError('暂时无法读取这次合盘存档，请重试。'); }
    finally { if (!controller.signal.aborted) setRestoring(false); if (generating.current === controller) generating.current = null; }
  }
  async function retrySave() {
    if (!draft.current || saveStatus === 'saving') return;
    const report = draft.current;
    setSaveStatus('saving');
    try { const record = await save(report); if (draft.current === report) showSaved(record.report); }
    catch { if (draft.current === report) setSaveStatus('failed'); }
  }
  return { archive, loadArchive, manualA, manualB, setManualChart, summary, loading, error, recovery, calculate,
    history, saveStatus, savedLabel, restoring, openSaved, retrySave };
}

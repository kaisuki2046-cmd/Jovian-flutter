import { useEffect, useRef, useState } from 'react';
import { describeModelPermissionError, useReadingHistory, type ReadingArchive } from '../../account';
import type { AuthorizedFortuneInput, FortuneFactInput, FortuneReturnLocation } from '../model/fortune-facts';
import type { FortunePublishedReport } from '../model/interpretation';
import { fortuneInterpretationAvailable, requestFortuneCalculation, requestFortuneInterpretation, requestSavedFortuneInterpretation } from '../requests/fortune-interpretation';
import { requestFortuneAdvice } from '../requests/fortune-advice';
import { requestFortuneTime } from '../requests/fortune-time';
import { buildFortuneFactSubmission } from './fortune-fact-submission';
import { archiveFortuneReport, fortuneArchiveContext, restoreFortuneReport } from './report-archive';

type State = { key: string; phase: 'idle' | 'restoring' | 'loading' | 'ready' | 'failed' | 'unavailable' | 'location-unavailable';
  report?: FortunePublishedReport; saved?: ReadingArchive; saveStatus?: 'saved' | 'failed'; generationError?: string };

const missingReturnAngles = 'Missing reliable solar return angles';
async function submitCalculation(input: FortuneFactInput, ownerId: string, archive: AuthorizedFortuneInput, signal: AbortSignal,
  returnLocation?: FortuneReturnLocation) {
  const asOf = await requestFortuneTime(signal);
  signal.throwIfAborted();
  const batch = buildFortuneFactSubmission(input, asOf, archive, returnLocation);
  signal.throwIfAborted();
  if (returnLocation && !batch.facts.some(fact => {
    const payload = fact.normalizedPayload;
    return fact.factType === 'solar_return' && payload !== null && typeof payload === 'object'
      && 'returnAngles' in payload && payload.returnAngles === 'regiomontanus_verified';
  })) throw new Error(missingReturnAngles);
  return requestFortuneCalculation(input, ownerId, archive.snapshotId, batch, signal);
}

export function useFortuneInterpretation(input: FortuneFactInput, at: number, ownerId?: string, archive?: AuthorizedFortuneInput, resumeLatest = false) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<State>();
  const active = useRef<AbortController | null>(null);
  const resumed = useRef(false);
  useEffect(() => () => active.current?.abort(), []);
  const history = useReadingHistory('fortune', ownerId);
  const { latest, save } = history;
  const { periodType, displayTimezone } = input;
  const snapshotId = archive?.snapshotId;
  const context = fortuneArchiveContext({ periodType, displayTimezone }, at, snapshotId ?? '');
  const key = context.key;

  useEffect(() => {
    if (!snapshotId || !ownerId) return;
    const controller = new AbortController();
    active.current?.abort(); active.current = controller;
    setState({ key, phase: 'restoring' });
    void (async () => {
      try {
        const resume = resumeLatest && !resumed.current && revision === 0;
        let saved = await latest(resume ? undefined : key, controller.signal);
        let report: FortunePublishedReport | null = null;
        if (resume && saved && saved.report.contextKey !== key) {
          const archived = saved.report.context;
          const verified = fortuneInterpretationAvailable && archived.snapshotId && archived.periodType && archived.displayTimezone
            && archived.windowStart !== undefined
            ? await requestSavedFortuneInterpretation(ownerId, archived.snapshotId, archived.periodType, archived.displayTimezone,
              archived.windowStart, controller.signal).catch(() => null) : null;
          if (controller.signal.aborted) return;
          if (verified && verified.reportId === archived.reportId) report = verified;
          else saved = await latest(key, controller.signal);
        }
        if (controller.signal.aborted) return;
        resumed.current = true;
        // The account archive mirrors reports. The fortune service checks the current rule policy.
        let draft: ReadingArchive | undefined;
        let saveStatus: 'saved' | 'failed' | undefined = report ? 'saved' : undefined;
        if (!report && fortuneInterpretationAvailable) {
          const archived = saved;
          saved = null;
          report = await requestSavedFortuneInterpretation(ownerId, snapshotId, periodType, displayTimezone, context.window.start, controller.signal);
          if (report && archived?.report.context.reportId === report.reportId) {
            saved = archived;
            saveStatus = 'saved';
          } else if (report) {
            draft = archiveFortuneReport(report, { periodType, displayTimezone }, at);
            try { saved = await save(draft, controller.signal); saveStatus = 'saved'; }
            catch (error) { if (controller.signal.aborted) throw error; saveStatus = 'failed'; }
          }
        }
        if (!controller.signal.aborted) setState({ key,
          phase: report ? 'ready' : fortuneInterpretationAvailable ? 'idle' : 'unavailable',
          report: report ?? undefined, saved: report ? saved?.report ?? draft : undefined, saveStatus });
      } catch { if (!controller.signal.aborted) setState({ key, phase: 'failed' }); }
    })();
    return () => { controller.abort(); active.current?.abort(); };
  }, [key, ownerId, snapshotId, periodType, displayTimezone, revision, latest, save, resumeLatest]);

  async function generate(returnLocation?: FortuneReturnLocation) {
    if (!ownerId || !archive?.chart || state?.phase === 'loading' || state?.phase === 'restoring') return;
    const controller = new AbortController();
    active.current?.abort(); active.current = controller;
    setState({ key, phase: 'loading' });
    try {
      const run = await submitCalculation({ periodType, displayTimezone, targetPeriod: context.targetPeriod },
        ownerId, archive, controller.signal, returnLocation);
      const report = await requestFortuneInterpretation(periodType, ownerId, archive.snapshotId, run, controller.signal);
      const draft = archiveFortuneReport(report, { periodType, displayTimezone }, at);
      let saveStatus: 'saved' | 'failed' = 'saved';
      try { await save(draft, controller.signal); } catch { saveStatus = 'failed'; }
      if (!controller.signal.aborted) setState({ key, phase: 'ready', report, saved: draft, saveStatus });
    } catch (error) {
      if (!controller.signal.aborted) setState(error instanceof Error && error.message === missingReturnAngles
        ? { ...(state?.key === key ? state : undefined), key, phase: 'location-unavailable', generationError: undefined }
        : { key, phase: 'failed', generationError: describeModelPermissionError(error) ?? '暂时无法生成解读，请重试。' });
    }
  }
  async function openSaved(id: string) {
    const controller = new AbortController();
    active.current?.abort(); active.current = controller;
    setState({ key, phase: 'restoring' });
    try {
      const record = await history.read(id, controller.signal);
      if (!controller.signal.aborted) setState({ key, phase: 'ready', report: restoreFortuneReport(record.report), saved: record.report, saveStatus: 'saved' });
    } catch { if (!controller.signal.aborted) setState({ key, phase: 'failed' }); }
  }
  async function retrySave() {
    if (state?.key !== key || !state.saved) return;
    const saved = state.saved;
    try { await save(saved); setState(current => current?.saved === saved ? { ...current, saveStatus: 'saved' } : current); }
    catch { /* Keep the generated report and its retry action. */ }
  }
  const current = state?.key === key ? state : undefined;
  async function getAdvice(signal: AbortSignal) {
    if (!ownerId) throw new Error('No fortune owner');
    const report = current?.report;
    if (report?.natalChartSnapshotId) return requestFortuneAdvice(report.calculationRunId, ownerId, report.natalChartSnapshotId, signal);
    if (!archive?.chart) throw new Error('No fortune snapshot');
    const run = await submitCalculation({ periodType, displayTimezone, targetPeriod: context.targetPeriod }, ownerId, archive, signal);
    return requestFortuneAdvice(run, ownerId, archive.snapshotId, signal);
  }
  return { adviceKey: current?.report?.calculationRunId ?? key, getAdvice, phase: current?.phase ?? 'idle', report: current?.report, saved: current?.saved,
    saveStatus: current?.saveStatus, generationError: current?.generationError, generate, retrySave, history, openSaved,
    retryRead: () => setRevision(value => value + 1) };
}

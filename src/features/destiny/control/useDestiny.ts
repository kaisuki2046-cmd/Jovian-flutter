import { useEffect, useRef, useState } from 'react';
import { describeModelPermissionError, modelAccountRequest, requestSameSiteModel, type ArchiveIdentity } from '../../account';
import type { BirthProfile } from '../model/birth-profile';
import { readLocalProfile, removeLocalProfile, saveLocalProfile } from '../model/local-profile';
import type { CalculationStage } from '../model/reading';
import { requestReport, reportServiceConfigured } from '../requests/report';
import { runReading, type Reading } from './local-reading';
import { toDestinyArchiveWithSnapshot, type DestinyArchiveWithSnapshot } from './account-report';
import { useAccountBirthProfile } from './useAccountBirthProfile';
import { useDestinyArchive } from './useDestinyArchive';

type Task =
  | { status: 'running'; stage: CalculationStage }
  | { status: 'error'; message: string; profile: BirthProfile; reading?: Reading }
  | { status: 'result'; profile: BirthProfile; report: DestinyArchiveWithSnapshot };

export function useDestiny(identity: ArchiveIdentity | null, recheckIdentity: () => void) {
  const ownerId = identity?.kind === 'member' ? identity.id : null;
  const activeTask = useRef<AbortController | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [recentReading, setRecentReading] = useState<Pick<Reading, 'calculatedAt' | 'charts'> | null>(null);
  const [saved, setSaved] = useState<BirthProfile | null>(null);
  const [storage, setStorage] = useState({ ready: false, supported: false, busy: false, message: '' });
  const storageOperation = useRef(false);
  const archive = useDestinyArchive(identity?.id, task?.status === 'result' ? task.report : null, recheckIdentity);
  const birthProfile = useAccountBirthProfile(ownerId);

  useEffect(() => {
    let active = true;
    readLocalProfile(ownerId).then(({ supported, profile }) => {
      if (active) {
        setSaved(profile);
        setStorage({ ready: true, supported, busy: false, message: '' });
      }
    }).catch(() => {
      if (active) setStorage({ ready: true, supported: false, busy: false, message: '无法读取本机档案，可继续本次测算。' });
    });
    return () => {
      active = false;
      activeTask.current?.abort();
    };
  }, [ownerId]);

  async function calculate(profile: BirthProfile, prepared?: Reading) {
    if (activeTask.current) return;
    if (!reportServiceConfigured) {
      setTask({ status: 'error', message: '解读服务暂未配置。', profile });
      return;
    }
    const controller = new AbortController();
    activeTask.current = controller;
    let reading = prepared;
    try {
      reading ??= await runReading(profile, controller.signal, (stage) => setTask({ status: 'running', stage }));
      if (controller.signal.aborted) return;
      setTask({ status: 'running', stage: 'expressing' });
      const overview = await requestReport(reading, controller.signal, {
        ...await modelAccountRequest(), transport: requestSameSiteModel,
      });
      if (!controller.signal.aborted) {
        setRecentReading({ calculatedAt: reading.calculatedAt, charts: reading.charts });
        setTask({ status: 'result', profile: reading.profile, report: toDestinyArchiveWithSnapshot(reading, overview) });
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        const message = describeModelPermissionError(error) ?? (error instanceof Error ? error.message : '本次测算失败，请重试。');
        setTask({ status: 'error', message, profile, reading });
      }
    } finally {
      if (activeTask.current === controller) activeTask.current = null;
    }
  }

  function clearTask() {
    activeTask.current?.abort();
    activeTask.current = null;
    setTask(null);
  }

  async function storeProfile(profile: BirthProfile | null) {
    if (!ownerId || !storage.supported || storageOperation.current) return;
    storageOperation.current = true;
    setStorage((current) => ({ ...current, busy: true, message: '' }));
    try {
      if (profile) await saveLocalProfile(ownerId, profile);
      else await removeLocalProfile(ownerId);
      setSaved(profile);
      setStorage((current) => ({ ...current, message: profile ? '出生资料已保存到本机。' : '已删除本机出生档案。' }));
    } catch {
      setStorage((current) => ({ ...current, message: profile ? '保存失败，请重试。' : '删除失败，请重试。' }));
    } finally {
      storageOperation.current = false;
      setStorage((current) => ({ ...current, busy: false }));
    }
  }

  return { task: archive.identityInvalid ? null : task, recentReading, calculate, clearTask, saved, storage,
    storeProfile, reportServiceConfigured, birthProfile, archive, archiveKind: identity?.kind,
  };
}

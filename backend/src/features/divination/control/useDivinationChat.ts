import { uuid } from 'expo';
import { useEffect, useRef, useState } from 'react';
import { RequestError } from '../../../shared/http/client';
import { describeModelPermissionError } from '../../account';
import type { ChatMessage, ChatReply, ChatStatus, TaskKind, UserMessage } from '../model/conversation';
import { emptyChatDraft, removeFromDraft, sameChatDraft, type AttachmentKind, type ChatDraft } from '../model/chat-draft';
import { pickChatAttachments } from './pick-chat-attachments';
import { guideVersion, maxFollowUps, type MeihuaNumbers, type ReadingFollowUpAction, type ReadingQuestion, type ReadingSnapshot } from '../model/reading';
import { readPendingRitual, readTaskRecovery, writePendingRitual, writeTaskRecovery, type PendingRitual, type TaskRecovery } from '../model/task-session';
import { getReading, startReading, updateReading, understandQuestion } from '../requests/report';
import { classifyPreview, isSensitiveQuestion, promptForTask, questionWithClarification, validateMessage } from './preview';

const maxVisibleMessages = 40;

function wait(ms: number, signal: AbortSignal) {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', cancel);
      resolve();
    }, ms);
    function cancel() {
      clearTimeout(timer);
      reject(signal.reason);
    }
    signal.addEventListener('abort', cancel, { once: true });
  });
}

type Session = { token: string; snapshot: ReadingSnapshot };

function hasReport(snapshot: ReadingSnapshot) {
  return snapshot.method === 'combined' && snapshot.ruleVersion === guideVersion ? snapshot.proReport : snapshot.report;
}

function reportError(message: string, error?: RequestError) {
  if (error?.status === 504 || error?.kind === 'timeout') return 'Pro 解读超时，盘面已保存，可以重试。';
  if (error?.status === 502) return 'Pro 返回的解读不完整或格式不符合要求，盘面已保存，可以重试。';
  return message;
}

export function useDivinationChat(owner: string | null, chatId: string, initialMessages: ChatMessage[],
  onMessages: (chatId: string, messages: ChatMessage[]) => void) {
  const [composer, setComposer] = useState(emptyChatDraft);
  const draftRef = useRef(composer);
  const picker = useRef<object | null>(null);
  const [picking, setPicking] = useState(false);
  const retry = useRef<{ id: number; draft: ChatDraft } | null>(null);
  const [error, setError] = useState<string>();
  const [messages, setMessages] = useState(initialMessages);
  const lastMessage = initialMessages.at(-1);
  const [task, setTask] = useState<TaskKind | null>(lastMessage?.kind === 'prompt' ? lastMessage.task : null);
  const [status, setStatus] = useState<ChatStatus>('idle');
  const nextId = useRef(initialMessages.reduce((max, item) => Math.max(max, item.id), 0));
  const awaitingConfirmation = useRef<ReadingQuestion | null>(lastMessage?.kind === 'readingQuestion' ? lastMessage : null);
  const clarifyingQuestion = useRef<string | null>(null);
  const sessions = useRef(new Map<number, Session>());
  const recovery = useRef<TaskRecovery | null>(null);
  const [previousQuestion, setPreviousQuestion] = useState(() => lastMessage?.kind === 'readingSession' && hasReport(lastMessage.snapshot)
    ? lastMessage.snapshot.question : undefined);
  const pending = useRef<{ controller: AbortController; id: number; draft: ChatDraft } | null>(null);
  const operation = useRef<AbortController | null>(null);
  const restoreOperation = useRef<AbortController | null>(null);
  const outbox = useRef<PendingRitual | null>(null);
  const clockSession = useRef<string | null>(null);
  const [taskBusy, setTaskBusy] = useState(false);
  const [taskError, setTaskError] = useState<string>();
  const [restoring, setRestoring] = useState(true);
  const [restoreFailed, setRestoreFailed] = useState(false);
  const [resumeAttempt, setResumeAttempt] = useState(0);
  const busy = status === 'classifying' || status === 'previewing';

  useEffect(() => onMessages(chatId, messages), [chatId, messages, onMessages]);

  useEffect(() => {
    const controller = new AbortController();
    restoreOperation.current = controller;
    async function restore() {
      let id: number | undefined;
      let token: string | undefined;
      try {
        const [pendingEvent, stored] = await Promise.all([readPendingRitual(owner, chatId), readTaskRecovery(owner, chatId)]);
        if (controller.signal.aborted) return;
        outbox.current = pendingEvent;
        if (stored) {
          recovery.current = stored;
          for (const message of messages) {
            const savedToken = stored.tokens[message.id];
            if (message.kind === 'readingSession' && typeof savedToken === 'string') {
              sessions.current.set(message.id, { token: savedToken, snapshot: message.snapshot });
            }
          }
          const pendingId = Object.keys(stored.tokens).find(key => stored.tokens[Number(key)] === pendingEvent?.token);
          id = pendingId === undefined ? stored.latest : Number(pendingId);
          token = stored.tokens[id];
        }
        if (!token || id === undefined) {
          if (outbox.current) { await writePendingRitual(owner, chatId, null); outbox.current = null; }
          return;
        }
        if (outbox.current?.token === token) await sendRitual(outbox.current, controller.signal);
        const snapshot = await getReading(token, controller.signal);
        if (controller.signal.aborted) return;
        if (outbox.current) {
          await writePendingRitual(owner, chatId, null);
          outbox.current = null;
        }
        if (!controller.signal.aborted) {
          nextId.current = Math.max(nextId.current, id);
          if (awaitingConfirmation.current?.id === id) awaitingConfirmation.current = null;
          publish(id, token, snapshot);
        }
      } catch (failure) {
        if (controller.signal.aborted) return;
        if (failure instanceof RequestError && (failure.status === 404 || failure.status === 401)) {
          const tokens = { ...recovery.current?.tokens };
          if (id !== undefined) { delete tokens[id]; sessions.current.delete(id); }
          const remaining = Object.keys(tokens).map(Number);
          recovery.current = remaining.length ? { latest: Math.max(...remaining), tokens } : null;
          await writeTaskRecovery(owner, chatId, recovery.current);
          if (controller.signal.aborted) return;
          await writePendingRitual(owner, chatId, null);
          outbox.current = null;
        } else {
          setRestoreFailed(true);
        }
      } finally {
        if (!controller.signal.aborted) setRestoring(false);
      }
    }
    void restore();
    return () => { controller.abort(); if (restoreOperation.current === controller) restoreOperation.current = null; };
  }, [owner, chatId, resumeAttempt]);

  useEffect(() => () => {
    picker.current = null;
    pending.current?.controller.abort();
    operation.current?.abort();
  }, []);

  function retryRestore() {
    setRestoring(true);
    setRestoreFailed(false);
    setResumeAttempt((previous) => previous + 1);
  }

  function addMessage(message: ChatReply | UserMessage | ReadingQuestion) {
    const entry = { ...message, id: 'id' in message ? message.id : ++nextId.current, sentAt: Date.now() };
    setMessages((previous) => [...previous.slice(-(maxVisibleMessages - 1)), entry]);
  }

  function publish(id: number, token: string, snapshot: ReadingSnapshot) {
    const previous = sessions.current.get(id)?.snapshot;
    sessions.current.set(id, { token, snapshot });
    if (hasReport(snapshot) && (!previous || !hasReport(previous))) setPreviousQuestion(snapshot.question);
    const time = Date.now();
    setMessages(previous => {
      const current = previous.find(message => message.id === id);
      const entry: ChatMessage = { id, kind: 'readingSession', snapshot, sentAt: current?.sentAt ?? time };
      return current ? previous.map(message => message.id === id ? entry : message)
        : [...previous.slice(-(maxVisibleMessages - 1)), entry];
    });
  }

  function discardConfirmation() {
    const question = awaitingConfirmation.current;
    if (!question) return;
    awaitingConfirmation.current = null;
    setMessages((previous) => previous.filter((message) => message.id !== question.id));
  }

  function replaceDraft(next: ChatDraft) {
    draftRef.current = next;
    setComposer(next);
  }

  function restoreDraft(run: { id: number; draft: ChatDraft }) {
    retry.current = { id: run.id, draft: run.draft };
    replaceDraft(run.draft);
  }

  function changeDraft(text: string) {
    replaceDraft({ ...draftRef.current, text });
    setError(undefined);
  }

  async function chooseAttachments(kind: AttachmentKind) {
    if (picker.current || pending.current || operation.current || restoring) return;
    const attempt = {};
    picker.current = attempt;
    setPicking(true);
    setError(undefined);
    try {
      const files = await pickChatAttachments(kind);
      if (picker.current !== attempt || !files.length) return;
      const current = draftRef.current;
      replaceDraft({ ...current, attachments: [...current.attachments, ...files] });
    } catch {
      if (picker.current === attempt) setError('未能读取所选附件，请重新选择。');
    } finally {
      if (picker.current === attempt) { picker.current = null; setPicking(false); }
    }
  }

  function removeAttachment(id: string) {
    replaceDraft(removeFromDraft(draftRef.current, id));
    setError(undefined);
  }

  function selectTask(next: TaskKind) {
    if (pending.current || operation.current || restoring || (task === next && !previousQuestion)) return;
    discardConfirmation();
    clarifyingQuestion.current = null;
    setPreviousQuestion(undefined);
    setTask(next);
    setStatus('idle');
    setError(undefined);
    addMessage(promptForTask(next));
  }

  async function send() {
    if (pending.current || operation.current || picker.current || restoring) return;
    if (outbox.current) {
      setError('请先完成待同步的起卦操作。');
      return;
    }
    const outgoing = draftRef.current;
    const text = outgoing.text.trim();
    const validation = !text && outgoing.attachments.length ? undefined : validateMessage(text);
    setError(validation);
    if (validation) return;
    // Attachment bytes and filenames stay in this conversation. Only the caption
    // goes through the existing question classifier and reading service.
    const previous = retry.current;
    const reuse = previous && sameChatDraft(previous.draft, outgoing) && messages.some(message => message.id === previous.id);
    const id = reuse ? previous.id : ++nextId.current;
    if (!reuse) addMessage({ id, kind: 'user', text, attachments: outgoing.attachments });
    retry.current = null;
    replaceDraft(emptyChatDraft());
    if (!text) { setStatus('idle'); return; }
    const controller = new AbortController();
    const { signal } = controller;
    const run = { controller, id, draft: outgoing };
    pending.current = run;
    discardConfirmation();
    setStatus('classifying');

    try {
      await wait(350, signal);
      const reply = classifyPreview(text, task);
      const canClarify = reply.kind === 'confirmReading'
        || (reply.kind === 'prompt' && (reply.task === 'divination' || reply.task === null));
      const questionText = canClarify ? questionWithClarification(clarifyingQuestion.current, text) : text;
      const reading = canClarify && !isSensitiveQuestion(questionText);
      if (reading) {
        setTask('divination');
        const understanding = await understandQuestion(questionText, signal, true, previousQuestion);
        if (signal.aborted) return;
        if (understanding.clarification) {
          clarifyingQuestion.current = understanding.intent === 'chat_only' ? null : questionText;
          addMessage({ kind: 'guidance', text: understanding.clarification });
          setStatus('idle');
          return;
        }
        clarifyingQuestion.current = null;
        const question: ReadingQuestion = {
          id: ++nextId.current, kind: 'readingQuestion', question: questionText, previousQuestion, understanding,
        };
        awaitingConfirmation.current = question;
        pending.current = null;
        openReading(question.id);
      } else {
        if (reply.kind !== 'guidance') clarifyingQuestion.current = null;
        if (reply.kind === 'preview') {
          setPreviousQuestion(undefined);
          setStatus('previewing');
          await wait(700, signal);
          setTask(null);
        } else if (reply.kind === 'prompt') {
          if (reply.task === 'compatibility' || reply.task === 'naming') setPreviousQuestion(undefined);
          setTask(reply.task);
        }
        addMessage(reply.kind === 'confirmReading' ? promptForTask('divination') : reply);
      }
      setStatus('idle');
    } catch (failure) {
      if (signal.aborted) return;
      restoreDraft(run);
      setError(describeModelPermissionError(failure) ?? '暂时无法理解这条问题，请恢复连接后重试。');
      setStatus('failed');
    } finally {
      if (pending.current?.controller === controller) pending.current = null;
    }
  }

  async function runTask(action: (signal: AbortSignal) => Promise<void>, onFailure: (message: string, error?: RequestError) => void = setTaskError) {
    if (operation.current || pending.current || restoring) return;
    const controller = new AbortController();
    operation.current = controller;
    setTaskBusy(true);
    setTaskError(undefined);
    try {
      await action(controller.signal);
      return true;
    } catch (failure) {
      if (!controller.signal.aborted) {
        const response = failure instanceof RequestError ? failure : undefined;
        onFailure(response?.status === 428 ? describeModelPermissionError(failure)!
          : response?.status === 401 || response?.status === 404 ? '这次算事已过期，可以回到对话发起新问题。'
          : response?.status === 503 ? '解读暂不可用，盘面已保存，可以重试解读。'
          : response?.status === 429 ? '操作太频繁，请稍后再试。'
          : response?.status === 400 ? '服务器未接受这次输入，请核对后再试。'
          : response?.kind === 'timeout' ? '算事服务响应超时，请重试。'
          : '暂时未能连接算事服务，请再试一次。', response);
      }
    } finally {
      if (operation.current === controller) operation.current = null;
      if (!controller.signal.aborted) setTaskBusy(false);
    }
  }

  function openReading(id: number) {
    if (pending.current || operation.current || restoring) return;
    const question = awaitingConfirmation.current;
    if (question?.id !== id || outbox.current) return;
    void runTask(async (signal) => {
      const started = await startReading(question.question, question.understanding.focus, 'combined', signal,
        question.understanding.proof, question.previousQuestion);
      if (signal.aborted) return;
      const activeIds = new Set(messages.map(message => String(message.id)));
      const tokens = Object.fromEntries(Object.entries(recovery.current?.tokens ?? {}).filter(([key]) => activeIds.has(key)));
      recovery.current = { latest: id, tokens: { ...tokens, [id]: started.token } };
      await writeTaskRecovery(owner, chatId, recovery.current);
      if (signal.aborted) return;
      awaitingConfirmation.current = null;
      setPreviousQuestion(undefined);
      setRestoreFailed(false);
      publish(id, started.token, started.task);
      setTask(null);
      if (started.task.stage === 'reading' && !hasReport(started.task)) {
        await progress(id, { token: started.token, snapshot: started.task }, { report: {} }, signal);
      }
    }, (message, error) => {
      if (sessions.current.has(id)) {
        setTaskError(reportError(message, error));
        return;
      }
      const failed = { ...question, error: message };
      awaitingConfirmation.current = failed;
      if (messages.some((entry) => entry.id === id)) {
        setMessages((previous) => previous.map((entry) => entry.id === id ? { ...failed, sentAt: entry.sentAt } : entry));
      } else {
        addMessage(failed);
      }
    });
  }

  async function progress(id: number, session: Session, action: Parameters<typeof updateReading>[1], signal: AbortSignal, minimumTime = 0) {
    let snapshot: ReadingSnapshot;
    try {
      [snapshot] = await Promise.all([
        updateReading(session.token, action, signal, session.snapshot.ruleVersion === guideVersion),
        minimumTime ? wait(minimumTime, signal) : Promise.resolve(),
      ]);
    } catch (failure) {
      if (!(failure instanceof RequestError) || failure.status !== 409) throw failure;
      snapshot = await getReading(session.token, signal);
    }
    if (!signal.aborted) publish(id, session.token, snapshot);
    return snapshot;
  }

  function prepareDeck(id: number, cut?: number) {
    const session = sessions.current.get(id);
    if (session?.snapshot.stage !== 'shuffle' && session?.snapshot.stage !== 'cut') return;
    void runTask(async (signal) => {
      await progress(id, session, cut === undefined ? { shuffle: {} } : { cut: { point: cut } }, signal, 560);
    });
  }

  function chooseTarotSlot(id: number, slot: number) {
    const session = sessions.current.get(id);
    if (!session || session.snapshot.stage !== 'draw' || session.snapshot.selectedSlots.includes(slot)
        || slot < 0 || slot >= session.snapshot.slotCount || session.snapshot.selectedSlots.length >= 3) return;
    const step = session.snapshot.selectedSlots.length;
    void runTask(async (signal) => {
      const snapshot = session.snapshot.ruleVersion === guideVersion
        ? await progressRitual(id, session, () => ({ pick: { slot, step, epochMs: String(Date.now()),
          monotonicMs: performance.now(), clockSessionId: clockSession.current ??= uuid.v4(), actionId: uuid.v4() } }), signal)
        : await progress(id, session, { pick: { slot, step } }, signal);
      if (snapshot.stage === 'reading' && !hasReport(snapshot)) {
        await progress(id, session, { report: {} }, signal);
      }
    }, (message, error) => setTaskError(session.snapshot.ruleVersion === guideVersion ? reportError(message, error) : message));
  }

  function tossCoins(id: number) {
    const session = sessions.current.get(id);
    if (session?.snapshot.stage !== 'cast') return;
    const step = session.snapshot.tosses.length;
    void runTask(async (signal) => {
      const snapshot = session.snapshot.ruleVersion === guideVersion
        ? await progressRitual(id, session, () => ({ toss: { step, actionId: uuid.v4() } }), signal)
        : await progress(id, session, { toss: { step } }, signal);
      if (snapshot.method === 'combined' && snapshot.stage === 'reading' && !snapshot.report) {
        await progress(id, session, { report: {} }, signal);
      }
    });
  }

  async function sendRitual(event: PendingRitual, signal: AbortSignal) {
    signal.throwIfAborted();
    outbox.current = event;
    await writePendingRitual(owner, chatId, event);
    return updateReading(event.token, event.action, signal);
  }

  async function progressRitual(id: number, session: Session, create: () => PendingRitual['action'], signal: AbortSignal) {
    const existing = outbox.current;
    if (existing && existing.token !== session.token) throw new Error('Resolve the pending ritual first.');
    const snapshot = await sendRitual(existing?.token === session.token ? existing : { token: session.token, action: create() }, signal);
    const current = existing?.token === session.token ? await getReading(session.token, signal) : snapshot;
    if (signal.aborted) return current;
    await writePendingRitual(owner, chatId, null);
    outbox.current = null;
    if (!signal.aborted) publish(id, session.token, current);
    return current;
  }

  function submitNumbers(id: number, numbers: MeihuaNumbers) {
    const session = sessions.current.get(id);
    if (session?.snapshot.method !== 'meihua' || session.snapshot.stage !== 'numbers') return;
    void runTask(async (signal) => {
      await progress(id, session, { numbers: { numbers } }, signal);
    });
  }

  function requestReport(id: number) {
    const session = sessions.current.get(id);
    if (session?.snapshot.stage !== 'reading' || hasReport(session.snapshot)) return;
    void runTask(async (signal) => {
      const result = await progress(id, session, { report: {} }, signal);
      if (!hasReport(result)) setTaskError('解读仍在生成，请稍后再试。');
    }, (message, error) => setTaskError(session.snapshot.ruleVersion === guideVersion ? reportError(message, error) : message));
  }

  const askFollowUp: ReadingFollowUpAction = async (id, input) => {
    const session = sessions.current.get(id);
    if (!session || !hasReport(session.snapshot)) return '这次算事的记录已失效，可以另问一件事。';
    const question = input.trim();
    const validation = validateMessage(question);
    if (validation || isSensitiveQuestion(question)) return validation ?? '这类追问请寻求相应专业支持。';
    const step = session.snapshot.followUps.length;
    if (step >= maxFollowUps) return '这次算事的追问已达上限。';

    let error: string | undefined;
    const completed = await runTask(async (signal) => {
      const snapshot = await progress(id, session, { 'follow-up': { question, step } }, signal);
      signal.throwIfAborted();
      if (snapshot.followUps[step]?.question !== question) error = '对话进度已更新，请重新发送追问。';
    }, (message) => { error = message; });
    return error ?? (completed ? undefined : '追问未保存，请重试。');
  };

  function editQuestion(id: number) {
    const question = awaitingConfirmation.current;
    if (pending.current || operation.current || question?.id !== id) return;
    discardConfirmation();
    changeDraft(question.question);
  }

  function stop() {
    const run = pending.current;
    if (!run) return;
    pending.current = null;
    run.controller.abort();
    restoreDraft(run);
    setStatus('cancelled');
  }

  return {
    draft: composer.text, attachments: composer.attachments, picking, chooseAttachments, removeAttachment,
    error, messages, task, status, busy, changeDraft, selectTask, send, stop,
    taskBusy, taskError, restoring, restoreFailed, retryRestore,
    previousQuestion, openReading, prepareDeck, chooseTarotSlot, tossCoins, submitNumbers,
    readingAvailable: (id: number) => sessions.current.has(id),
    editQuestion, requestReport, askFollowUp,
  };
}

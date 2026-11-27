
import { Platform } from 'react-native';
import { createHttpClient } from '../../../shared/http/client';
import { modelAccountRequest, requestSameSiteModel } from '../../account';
import { guideVersion, type CardEvent, type RitualEvent, type MeihuaNumbers, type QuestionUnderstanding, type ReadingKind } from '../model/reading';
import { parseSnapshot, record } from './snapshot';

const baseUrl = process.env.EXPO_PUBLIC_DIVINATION_REPORT_URL
  || (__DEV__ && Platform.OS === 'web' ? 'http://127.0.0.1:8115' : undefined);
const client = createHttpClient({ baseUrl, timeoutMs: 185000, transport: (url, init) => requestSameSiteModel(url, init) });
const proClient = createHttpClient({ baseUrl, timeoutMs: 185000, transport: (url, init) => requestSameSiteModel(url, init) });

function parseUnderstanding(value: unknown): QuestionUnderstanding {
  const { focus, clarification, source, intent, proof } = record(value);
  if (typeof focus !== 'string' || typeof clarification !== 'string' || (source !== 'local' && source !== 'model')) {
    throw new TypeError('Invalid question understanding.');
  }
  return { focus, clarification, source, ...(intent === 'chat_only' ? { intent } : {}), ...(typeof proof === 'string' ? { proof } : {}) };
}

export async function understandQuestion(question: string, signal: AbortSignal, requireModel = false, previousQuestion?: string) {
  return client.request('/reading/understand', {
    ...await modelAccountRequest(), method: 'POST', body: { question, requireModel, previousQuestion }, signal, parse: parseUnderstanding,
  });
}

export async function startReading(question: string, focus: string, method: ReadingKind, signal: AbortSignal, proof?: string, previousQuestion?: string) {
  return client.request('/reading', {
    ...await modelAccountRequest(), method: 'POST',
    body: { question, focus, method, ...(method === 'combined' ? { profile: guideVersion, proof, previousQuestion } : {}) }, signal,
    parse: (value) => {
      const { token, task } = record(value);
      if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new TypeError('Invalid reading token.');
      const snapshot = parseSnapshot(task);
      if (snapshot.method !== method) throw new TypeError('Unexpected reading method.');
      return { token, task: snapshot };
    },
  });
}

export async function getReading(token: string, signal: AbortSignal) {
  const auth = await modelAccountRequest();
  return client.request('/reading', { ...auth, headers: { ...auth.headers, Authorization: 'Bearer ' + token }, signal, parse: parseSnapshot });
}

type Action =
  | { shuffle: Record<string, never> }
  | { cut: { point: number } }
  | { pick: { step: number; slot: number } | CardEvent }
  | { toss: { step: number } | RitualEvent }
  | { numbers: { numbers: MeihuaNumbers } }
  | { report: Record<string, never> }
  | { 'follow-up': { step: number; question: string } };

export async function updateReading(token: string, action: Action, signal: AbortSignal, pro = false) {
  const [path, body] = Object.entries(action)[0];
  const readingClient = pro && path === 'report' ? proClient : client;
  const auth = await modelAccountRequest();
  return readingClient.request('/reading/' + path, {
    ...auth, method: 'POST', headers: { ...auth.headers, Authorization: 'Bearer ' + token }, body, signal, parse: parseSnapshot,
  });
}

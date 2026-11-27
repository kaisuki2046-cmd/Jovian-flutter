import type { LegacyProReport, ProReport, ProReportParagraph } from './reading';

import { maxReportTextLength } from '../../../shared/content-limits.mjs';

const proMaxTextLength = maxReportTextLength;
export const proMethods = ['tarot', 'meihua', 'liuyao'] as const;

export function highlightOffset(text: string, highlight: string): number {
  if (!highlight || /[。！？!?；;\r\n]/u.test(highlight)) return -1;
  const last = text.replace(/[\s。！？!?；;”’」』）》]+$/u, '');
  const start = Math.max(...['。', '！', '？', '!', '?', '\n'].map((separator) => last.lastIndexOf(separator))) + 1;
  const sentence = last.slice(start).trim();
  if (sentence === highlight || sentence.replace(/^[“‘「『]+/u, '') === highlight) return -1;
  const index = last.lastIndexOf(highlight);
  return index >= start ? index : -1;
}

export function splitProText(text: string) {
  const parts = text.split(/\*\*([^*\r\n]+)\*\*/u);
  return parts.map((part, index) => {
    let bold = false;
    if (index % 2 === 1) {
      const phrase = part.trim();
      const atStart = !parts[index - 1].trim() && index === 1 || /[。！？!?\r\n]\s*$/u.test(parts[index - 1]);
      const atEnd = !parts[index + 1].trim() && index === parts.length - 2 || /^\s*[。！？!?\r\n]/u.test(parts[index + 1]);
      bold = phrase.length > 0 && Array.from(phrase).length <= 20 && !/[。！？!?；;]/u.test(part)
        && !(atStart && atEnd);
    }
    return { text: part.replace(/\*\*/g, ''), bold };
  }).filter((part) => part.text);
}

export function splitProInterpretation(text: string) {
  const parts = splitProText(text);
  if (parts.some(({ bold }) => bold)) return parts;
  const plain = parts.map((part) => part.text).join('');
  const evidenceEnd = /[。！？!?；;]\s*(?=[^。！？!?；;\s])/u.exec(plain);
  const boundary = evidenceEnd
    ?? /(?:提示|意味着|说明|显示|暗示|表明|[，,])\s*/u.exec(plain);
  const start = boundary ? boundary.index + boundary[0].length : 0;
  const end = plain.trimEnd().replace(/[。！？!?；;]+$/u, '').length;
  if (end <= start) return parts;
  return [
    { text: plain.slice(0, start), bold: false },
    { text: plain.slice(start, end), bold: true },
    { text: plain.slice(end), bold: false },
  ].filter((part) => part.text);
}

export function parseProReport(value: unknown, allowLegacy = true): ProReport {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== proMethods.length) {
    throw new TypeError('Invalid Pro report.');
  }
  const { tarot, meihua, liuyao } = value as Record<string, unknown>;
  if (allowLegacy && typeof tarot === 'string' && typeof meihua === 'string' && typeof liuyao === 'string') {
    const sections = [tarot, meihua, liuyao];
    if (sections.some((text) => !text.replace(/\*\*/g, '').trim())) throw new TypeError('Invalid Pro report text.');
    if (Array.from(sections.join('')).length > proMaxTextLength) throw new TypeError('Pro report exceeds length limit.');
    return { tarot, meihua, liuyao };
  }
  if (!Array.isArray(tarot) || !Array.isArray(meihua) || !Array.isArray(liuyao)
    || tarot.length !== 4 || meihua.length < 3 || meihua.length > 4 || liuyao.length < 3 || liuyao.length > 4) {
    throw new TypeError('Invalid Pro report sections.');
  }
  const parseSection = (entries: unknown[]) => entries.map((entry, index) => (
    parseParagraph(entry, index === entries.length - 1, allowLegacy)
  ));
  return { tarot: parseSection(tarot), meihua: parseSection(meihua), liuyao: parseSection(liuyao) };
}

function parseParagraph(value: unknown, overview: boolean, allowLegacy: boolean): ProReportParagraph {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Invalid Pro report paragraph.');
  }
  const { text, detail, technique, interpretation } = value as Record<string, unknown>;
  const keys = Object.keys(value).length;
  if (typeof text !== 'string' || !text.replace(/\*\*/g, '').trim() || text.length > 240) {
    throw new TypeError('Invalid Pro report paragraph text.');
  }
  const legacy = allowLegacy && keys === 3 && typeof technique === 'string' && technique.trim() && technique.length <= 240
    && typeof interpretation === 'string' && interpretation.trim() && interpretation.length <= 240;
  if (overview && (keys === 1 || legacy)) return { text: text.trim().replace(/^小结/u, '综述') };
  if (!overview && keys === 2 && typeof detail === 'string' && detail.trim() && detail.length <= 480) {
    return { text: text.trim(), detail: detail.trim() };
  }
  if (!overview && legacy && typeof technique === 'string' && typeof interpretation === 'string') {
    return { text: text.trim(), detail: technique.trim() + ' ' + interpretation.trim() };
  }
  throw new TypeError('Invalid Pro report paragraph detail.');
}

export function parseSavedProReport(value: unknown): ProReport | LegacyProReport {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !('opening' in value)) {
    return parseProReport(value);
  }
  const input = value as Record<string, unknown>;
  if (Object.keys(input).length !== 5) throw new TypeError('Invalid legacy Pro report.');
  function text(field: unknown): string {
    if (typeof field !== 'string' || !field.trim()) throw new TypeError('Invalid Pro report text.');
    return field;
  }
  function section(method: (typeof proMethods)[number]) {
    const field = input[method];
    if (!field || typeof field !== 'object' || Array.isArray(field) || Object.keys(field).length !== 2) {
      throw new TypeError('Invalid legacy Pro section.');
    }
    const { text: body, highlight } = field as Record<string, unknown>;
    const content = text(body);
    const phrase = typeof highlight === 'string' ? highlight.trim() : '';
    return { text: content, highlight: Array.from(phrase).length <= 20 && highlightOffset(content, phrase) >= 0 ? phrase : '' };
  }
  const report = { opening: text(input.opening), tarot: section('tarot'), meihua: section('meihua'),
    liuyao: section('liuyao'), closing: text(input.closing) };
  if (report.opening.length + report.closing.length + proMethods.reduce((total, method) => total + report[method].text.length, 0) > proMaxTextLength) {
    throw new TypeError('Pro report exceeds length limit.');
  }
  return report;
}

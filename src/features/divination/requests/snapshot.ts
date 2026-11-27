
import { readLiuYao, readMeihua, readMeihuaNumbers, validMeihuaNumbers } from '../control/iching';
import { cutPoints } from '../control/tarot-session';
import { castCalendar } from '../control/cast-calendar.mjs';
import { readJingfang } from '../control/liuyao.mjs';
import { readMeihuaClicks, validClickTime } from '../control/meihua.mjs';
import type { CoinToss } from '../model/iching';
import {
  automaticGuideRules, automaticMeihuaSource, clickMeihuaSource, combinedPromptVersion, combinedRules, guidePromptVersion, guideRules, guideVersion, maxFollowUps, meihuaInputSource, ruleVersions,
  type CardEvent, type CombinedSnapshot, type ReadingEvidence, type ReadingKind, type ReadingReport, type ReadingSnapshot,
} from '../model/reading';
import { parseSavedProReport } from '../model/pro-report';
import type { TarotDraw } from '../model/tarot';
import { tarotDeck, tarotSpread } from '../model/tarot-deck.mjs';

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid reading data.');
  return value as Record<string, unknown>;
}

function isUtcTimestamp(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

function parseEvidence(value: unknown): ReadingEvidence {
  const { id, label, plain, source, catalogVersion } = record(value);
  if (typeof id !== 'string' || typeof label !== 'string' || typeof plain !== 'string'
      || typeof source !== 'string' || !/^https:\/\/(?:en|zh)\.wikisource\.org\/wiki\//.test(source)
      || catalogVersion !== 1) throw new TypeError('Invalid reading evidence.');
  return { id, label, plain, source, catalogVersion };
}

function parseReport(value: unknown, expectedMethod: ReadingKind, evidence: readonly ReadingEvidence[], guide = false, followUp = false): ReadingReport {
  const { schemaVersion, method, answer, explanation, nextSteps, evidenceIds, source, sections, promptVersion } = record(value);
  const guideFollowUp = guide && followUp && source === 'model' && promptVersion === 'followup_v1';
  if (schemaVersion !== 1 || method !== expectedMethod
      || (source !== 'local' && (source !== 'model' || expectedMethod !== 'combined'))
      || typeof answer !== 'string' || typeof explanation !== 'string'
      || !Array.isArray(nextSteps) || (!guideFollowUp && nextSteps.length < 1) || nextSteps.length > 3
      || nextSteps.some((step) => typeof step !== 'string')
      || !Array.isArray(evidenceIds) || (!guideFollowUp && evidenceIds.length < 1) || new Set(evidenceIds).size !== evidenceIds.length
      || evidenceIds.some((id) => !evidence.some((item) => item.id === id))) {
    throw new TypeError('Invalid reading report.');
  }
  const report: ReadingReport = { schemaVersion: 1, method: expectedMethod, answer, explanation, nextSteps, evidenceIds, source };
  if (source === 'local') return report;
  if (guideFollowUp) return { ...report, promptVersion: 'followup_v1' };
  const expectedPrompt = guide ? guidePromptVersion : combinedPromptVersion;
  if (promptVersion !== expectedPrompt || !Array.isArray(sections) || sections.length !== 3 || evidenceIds.length !== sections.length) {
    throw new TypeError('Invalid model report sections.');
  }
  return {
    ...report, promptVersion: expectedPrompt,
    sections: sections.map((value, index) => {
      const { evidenceId, text } = record(value);
      if (typeof evidenceId !== 'string' || evidenceId !== evidenceIds[index] || typeof text !== 'string' || !text.trim()) {
        throw new TypeError('Invalid model evidence.');
      }
      return { evidenceId, text };
    }),
  };
}

function parseDraw(value: unknown, selectedSlots: number[], resolvedAt: string | undefined, guide: boolean): TarotDraw {
  const { cards, drawnAt, deck, deckVersion, spread } = record(value);
  if (!Array.isArray(cards) || cards.length !== 3 || !isUtcTimestamp(drawnAt) || drawnAt !== resolvedAt
      || deck !== 'rider-waite-smith' || deckVersion !== 1
      || (spread !== 'situation-focus-next-step' && spread !== 'situation-influence-trend-v1')
      || (spread === 'situation-influence-trend-v1') !== guide) {
    throw new TypeError('Invalid draw.');
  }
  const result: TarotDraw = {
    deck, deckVersion, spread, drawnAt,
    cards: cards.map((entry, index) => {
      const { card, orientation, slot, position } = record(entry);
      const face = tarotDeck.find(({ id }) => id === record(card).id);
      if (!face || (orientation !== 'upright' && orientation !== 'reversed')
          || slot !== selectedSlots[index] || position !== tarotSpread[index].id) throw new TypeError('Invalid card.');
      return { card: face, orientation, position: tarotSpread[index].id, slot: selectedSlots[index] };
    }),
  };
  if (new Set(result.cards.map(({ card }) => card.id)).size !== 3) throw new TypeError('Duplicate card.');
  return result;
}

function parseTarotState(data: Record<string, unknown>, hasDraw: boolean, drawnAt: unknown, guide = false) {
  const { slotCount, selectedSlots, draw, cut, stage } = data;
  const hasSlots = stage === 'draw' || hasDraw;
  if (typeof slotCount !== 'number' || slotCount !== (hasSlots ? guide ? 78 : 9 : 0)
      || (hasSlots && !guide ? !cutPoints.some((point) => point === cut) : cut !== undefined)
      || !Array.isArray(selectedSlots) || selectedSlots.length > 3
      || selectedSlots.some((slot) => !Number.isInteger(slot) || slot < 0 || slot >= slotCount)
      || new Set(selectedSlots).size !== selectedSlots.length
      || (draw !== undefined) !== hasDraw || (selectedSlots.length === 3) !== hasDraw) {
    throw new TypeError('Invalid tarot session.');
  }
  return {
    slotCount, selectedSlots, cut: typeof cut === 'number' ? cut : undefined,
    draw: hasDraw ? parseDraw(draw, selectedSlots, typeof drawnAt === 'string' ? drawnAt : undefined, guide) : undefined,
  };
}

function checkTarotEvidence(draw: TarotDraw, evidence: readonly ReadingEvidence[]) {
  if (draw.cards.some(({ position, card, orientation }, index) => {
    return evidence[index].id !== position + ':' + card.id + ':' + orientation;
  })) throw new TypeError('Tarot evidence does not match the draw.');
}

function isToss(value: unknown): value is CoinToss {
  return Array.isArray(value) && value.length === 3 && value.every((coin) => coin === 2 || coin === 3);
}

const interpretiveFields = new Set(['theme', 'direction', 'interpretation']);

// Check calculation fields against the v1 replay; wording may change without changing the rules.
function matchesReplay(wire: unknown, replay: unknown): boolean {
  if (replay === null || typeof replay !== 'object') return wire === replay;
  if (Array.isArray(replay)) return Array.isArray(wire) && wire.length === replay.length
    && replay.every((item, index) => matchesReplay(wire[index], item));
  const actual = record(wire);
  const entries = Object.entries(replay).filter(([key, value]) => value !== undefined && !interpretiveFields.has(key));
  return Object.keys(actual).filter((key) => !interpretiveFields.has(key)).length === entries.length
    && entries.every(([key, value]) => matchesReplay(actual[key], value));
}

export function parseSnapshot(value: unknown): ReadingSnapshot {
  const data = record(value);
  const { question, focus, method, ruleVersion, stage, resolvedAt, report, followUps } = data;
  const guide = method === 'combined' && ruleVersion === guideVersion;
  if (typeof question !== 'string' || typeof focus !== 'string'
      || (method !== 'tarot' && method !== 'liuyao' && method !== 'meihua' && method !== 'combined')
      || (!guide && ruleVersion !== ruleVersions[method])
      || (stage === 'reading' ? !isUtcTimestamp(resolvedAt) : resolvedAt !== undefined)
      || (report !== undefined && stage !== 'reading')
      || !Array.isArray(followUps) || followUps.length > maxFollowUps || (followUps.length > 0 && stage !== 'reading')
      || (!guide && followUps.length > 0 && !report)
      || !Array.isArray(data.evidence)
      || data.evidence.length !== (stage === 'reading' ? method === 'combined' ? 7 : method === 'tarot' ? 3 : 2 : 0)) {
    throw new TypeError('Invalid reading session.');
  }
  const evidence = data.evidence.map(parseEvidence);
  if (new Set(evidence.map(({ id }) => id)).size !== evidence.length) throw new TypeError('Duplicate evidence.');
  if (method !== 'tarot' && method !== 'combined' && evidence.some(({ id }) => !id.startsWith(method + ':v1:'))) {
    throw new TypeError('Evidence belongs to another method.');
  }
  const shared = {
    question, focus, resolvedAt: isUtcTimestamp(resolvedAt) ? resolvedAt : undefined, evidence,
    report: report !== undefined ? parseReport(report, method, evidence, guide) : undefined,
    followUps: followUps.map((entry) => {
      const item = record(entry);
      if (typeof item.question !== 'string') throw new TypeError('Invalid follow-up.');
      return { question: item.question, report: parseReport(item.report, method, evidence, guide, true) };
    }),
  };

  if (method === 'tarot') {
    if (stage !== 'shuffle' && stage !== 'cut' && stage !== 'draw' && stage !== 'reading') {
      throw new TypeError('Invalid tarot stage.');
    }
    const tarot = parseTarotState(data, stage === 'reading', shared.resolvedAt);
    if (tarot.draw) checkTarotEvidence(tarot.draw, evidence);
    return { ...shared, method, ruleVersion: ruleVersions.tarot, stage, ...tarot };
  }

  if (method === 'combined') {
    const automatic = data.automatic === true;
    const calculationRules = automatic ? automaticGuideRules : guide ? guideRules : combinedRules;
    if ((stage !== 'shuffle' && stage !== 'cut' && stage !== 'draw' && stage !== 'cast' && stage !== 'reading')
        || (guide && (stage === 'shuffle' || stage === 'cut'))
        || (automatic && (!guide || stage !== 'reading'))
        || !matchesReplay(data.calculationRules, calculationRules)) throw new TypeError('Invalid combined reading stage.');

    const isComplete = stage === 'reading';
    const hasDraw = isComplete || (!guide && stage === 'cast');
    const tarot = parseTarotState(data, hasDraw, hasDraw ? record(data.draw).drawnAt : undefined, guide);
    const { tosses } = data;
    if (!Array.isArray(tosses) || !tosses.every(isToss) || tosses.length > 6
        || (guide ? (tosses.length === 6) !== (stage !== 'cast')
          : (!hasDraw && tosses.length !== 0) || (tosses.length === 6) !== isComplete)) {
      throw new TypeError('Invalid combined reading tosses.');
    }
    let castResult: CombinedSnapshot['castResult'];
    let cardEvents: CardEvent[] | undefined;
    let castStartedAt: string | undefined;
    let chartHash: string | undefined;
    let proReport: CombinedSnapshot['proReport'];
    if (guide) {
      const { cardEvents: events, castStartedAt: started, chartHash: hash } = data;
      if ((tosses.length ? !isUtcTimestamp(started) : started !== undefined)
          || (automatic ? events !== undefined : !Array.isArray(events) || events.length !== tarot.selectedSlots.length)
          || (isComplete ? typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash) : hash !== undefined)) {
        throw new TypeError('Invalid ritual record.');
      }
      castStartedAt = typeof started === 'string' ? started : undefined;
      chartHash = typeof hash === 'string' ? hash : undefined;
      if (data.proReport !== undefined) {
        if (!isComplete) throw new TypeError('Invalid Pro report stage.');
        proReport = parseSavedProReport(data.proReport);
      }
      castResult = tosses.length === 6 && castStartedAt ? readJingfang(tosses, castCalendar(Date.parse(castStartedAt))) : undefined;
      if (!matchesReplay(data.castResult, castResult)) throw new TypeError('Invalid Liu Yao replay.');
      cardEvents = Array.isArray(events) ? events.map((event, step) => {
        const { actionId, slot, epochMs, monotonicMs, clockSessionId, step: eventStep } = record(event);
        if (typeof actionId !== 'string' || typeof clockSessionId !== 'string' || !validClickTime(epochMs)
            || typeof monotonicMs !== 'number' || !Number.isFinite(monotonicMs) || monotonicMs < 0
            || eventStep !== step || slot !== tarot.selectedSlots[step]) throw new TypeError('Invalid card event.');
        return { actionId, clockSessionId, epochMs, monotonicMs, step, slot: tarot.selectedSlots[step] };
      }) : undefined;
      if (cardEvents && new Set(cardEvents.map(({ actionId }) => actionId)).size !== cardEvents.length) throw new TypeError('Duplicate card event.');
    }
    let results: CombinedSnapshot['results'];
    if (isComplete) {
      if (!tarot.draw || !shared.resolvedAt || (!guide && tarot.draw.drawnAt > shared.resolvedAt)) {
        throw new TypeError('Invalid combined reading timestamps.');
      }
      checkTarotEvidence(tarot.draw, evidence);
      if (evidence.slice(3, 5).some(({ id }) => !id.startsWith('liuyao:v1:'))
          || evidence.slice(5).some(({ id }) => !id.startsWith('meihua:v1:'))) {
        throw new TypeError('Invalid combined reading evidence.');
      }
      const liuyao = castResult ?? readLiuYao(tosses);
      const [first, second, third] = liuyao.lines;
      if (automatic) {
        const { inputs } = record(record(data.results).meihua);
        if (!validMeihuaNumbers(inputs)) throw new TypeError('Invalid automatic Meihua inputs.');
        results = { liuyao, meihua: readMeihuaNumbers(inputs), meihuaInputSource: automaticMeihuaSource };
      } else {
        const meihua = cardEvents ? readMeihuaClicks(cardEvents.map(({ epochMs }) => epochMs))
          : readMeihua([first.value, second.value, third.value]);
        results = { liuyao, meihua, meihuaInputSource: guide ? clickMeihuaSource : meihuaInputSource };
      }
    }
    if (!matchesReplay(data.results, results)) throw new TypeError('Invalid combined reading result.');
    return { ...shared, method, ruleVersion: guide ? guideVersion : ruleVersions.combined, calculationRules, stage, ...tarot,
      ...(automatic ? { automatic: true } : {}),
      tosses, results, castStartedAt, castResult, cardEvents, chartHash, proReport };
  }

  if (method === 'liuyao') {
    const { tosses } = data;
    if ((stage !== 'cast' && stage !== 'reading') || !Array.isArray(tosses) || !tosses.every(isToss)
        || tosses.length > 6 || (tosses.length === 6) !== (stage === 'reading')) throw new TypeError('Invalid coin tosses.');
    const result = stage === 'reading' ? readLiuYao(tosses) : undefined;
    if (!matchesReplay(data.result, result)) throw new TypeError('Invalid Liu Yao result.');
    return { ...shared, method, ruleVersion: ruleVersions.liuyao, stage, tosses, result };
  }

  if (stage !== 'numbers' && stage !== 'reading') throw new TypeError('Invalid Meihua stage.');
  const inputs = stage === 'reading' ? record(data.result).inputs : undefined;
  if (stage === 'reading' && !validMeihuaNumbers(inputs)) throw new TypeError('Invalid Meihua numbers.');
  const result = validMeihuaNumbers(inputs) ? readMeihuaNumbers(inputs) : undefined;
  if (!matchesReplay(data.result, result)) throw new TypeError('Invalid Meihua result.');
  return { ...shared, method, ruleVersion: ruleVersions.meihua, stage, result };
}

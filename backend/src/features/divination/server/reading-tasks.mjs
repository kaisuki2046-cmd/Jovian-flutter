import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { canReadQuestion, isSensitiveQuestion, understandLocally, validateMessage, maxMessageLength } from '../control/preview.ts';
import { castCalendar } from '../control/cast-calendar.mjs';
import { readJingfang, readLiuYao, rollLiuYaoLine } from '../control/liuyao.mjs';
import { readMeihua, readMeihuaClicks, readMeihuaNumbers, validClickTime, validMeihuaNumbers } from '../control/meihua.mjs';
import { cutPoints, cutTarotDeck, prepareFullTarotDeck, shuffleTarotDeck } from '../control/tarot-session.ts';
import { selectTarotSlot } from '../control/tarot.ts';
import { automaticGuideRules, automaticMeihuaSource, clickMeihuaSource, combinedRules, guideRules, guideVersion, maxFollowUps, meihuaInputSource, readingMethods, ruleVersions } from '../model/reading.ts';
import { parseSavedProReport } from '../model/pro-report.ts';
import profile from '../data/rule_profiles/v1.json' with { type: 'json' };
import { createTarotKnowledge } from './tarot-knowledge.mjs';
import { composeReading, retrieveIChingEvidence, tarotEvidence } from './reading-reports.mjs';
import { composeCombinedReading } from './combined-report.mjs';
import { proPromptVersion } from './pro-report.mjs';
import { ModelOutputError } from './structured-model.mjs';
import { installReadingOwners, readingOwnerKey } from './task-ownership.mjs';

const taskLifetime = 24 * 60 * 60 * 1000;

export class ReadingTaskError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
  }
}

function tokenDigest(token) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token ?? '')) throw new ReadingTaskError(401, 'invalid_task_token');
  return createHash('sha256').update(token).digest('hex');
}

function savedProReport(task) {
  if (!task.proReport) return undefined;
  try { return parseSavedProReport(task.proReport); }
  catch { return undefined; }
}

function snapshot(task) {
  const shared = {
    method: task.method, ruleVersion: task.ruleVersion, resolvedAt: task.resolvedAt, evidence: task.evidence ?? [],
    question: task.question, focus: task.focus, stage: task.stage,
    report: task.ruleVersion === guideVersion ? undefined : task.report, followUps: task.followUps,
  };
  if (task.method === 'tarot' || task.method === 'combined') {
    const tarot = {
      ...shared, cut: task.cut, slotCount: task.picking?.slots.length ?? 0,
      selectedSlots: task.picking?.selectedSlots ?? [], draw: task.draw,
    };
    return task.method === 'tarot' ? tarot : {
      ...tarot, calculationRules: task.calculationRules, tosses: task.tosses, results: task.results,
      ...(task.ruleVersion === guideVersion ? { castStartedAt: task.castStartedAt, castResult: task.castResult,
        ...(task.tarotFirst ? { tarotFirst: true } : {}),
        ...(task.automatic ? { automatic: true } : { cardEvents: task.cardEvents }), chartHash: task.chartHash,
        proReport: savedProReport(task) } : {}),
    };
  }
  if (task.method === 'liuyao') return { ...shared, tosses: task.tosses, result: task.result };
  return { ...shared, result: task.result };
}

function readEvent(input, card = false) {
  const { actionId, step, slot, epochMs, monotonicMs, clockSessionId } = input;
  const validId = (id) => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id);
  if (!validId(actionId) || (card && (!validClickTime(epochMs) || !Number.isFinite(monotonicMs)
      || monotonicMs < 0 || !validId(clockSessionId)))) throw new ReadingTaskError(400, 'invalid_ritual_event');
  return card ? { actionId, step, slot, epochMs, monotonicMs, clockSessionId } : { actionId, step };
}

function requireMethod(task, method, supportsCombined = false) {
  if (task.method !== method && !(supportsCombined && task.method === 'combined')) {
    throw new ReadingTaskError(409, 'wrong_reading_method');
  }
}

// The original Tarot sessions used this table. Convert their reports without changing the draw.
function upgradeLegacy(task) {
  if (task.method) return task;
  task.method = 'tarot';
  task.ruleVersion = ruleVersions.tarot;
  task.resolvedAt = task.draw?.drawnAt;
  if (task.draw) {
    task.documents = task.evidence;
    task.evidence = tarotEvidence(task.documents);
    if (task.report) task.report = composeReading(task);
    const previous = task.followUps;
    task.followUps = [];
    for (const { question } of previous) task.followUps.push({ question, report: composeReading(task, question) });
  }
  return task;
}

export function createReadingTaskService(path, {
  understand, generateFollowUp, generatePro,
  random = () => randomInt(2 ** 32) / 2 ** 32, now = Date.now,
} = {}) {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA busy_timeout = 5000;
    PRAGMA journal_mode = WAL;
    PRAGMA secure_delete = ON;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS tarot_sessions (
      token_hash TEXT PRIMARY KEY, expires INTEGER NOT NULL, payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS tarot_session_expiration ON tarot_sessions(expires);
  `);
  installReadingOwners(db);
  const knowledge = createTarotKnowledge(db);
  const runningReports = new Map();
  const parserSecret = randomBytes(32);
  const questionProof = (question, focus, expires, previousQuestion) =>
    createHmac('sha256', parserSecret).update(JSON.stringify([question, focus, expires, previousQuestion])).digest('hex');
  const find = db.prepare('SELECT payload FROM tarot_sessions WHERE token_hash = ? AND expires > ?');
  const insert = db.prepare('INSERT INTO tarot_sessions VALUES (?, ?, ?)');
  const update = db.prepare('UPDATE tarot_sessions SET payload = ? WHERE token_hash = ?');
  const clearExpired = db.prepare('DELETE FROM tarot_sessions WHERE expires <= ?');
  const ownerOf = db.prepare('SELECT owner_key FROM reading_session_owners WHERE token_hash = ?');
  const bindOwner = db.prepare('INSERT INTO reading_session_owners VALUES (?, ?)');
  const deletedOwner = db.prepare('SELECT 1 FROM reading_deleted_owners WHERE owner_key = ?');
  const clearDeletedOwners = db.prepare('DELETE FROM reading_deleted_owners WHERE expires <= ?');

  function load(key) {
    const row = find.get(key, now());
    if (!row) throw new ReadingTaskError(404, 'task_not_found');
    return upgradeLegacy(JSON.parse(row.payload));
  }

  function change(key, edit) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const task = load(key);
      if (edit(task)) update.run(JSON.stringify(task), key);
      db.exec('COMMIT');
      return task;
    } catch (failure) {
      db.exec('ROLLBACK');
      throw failure;
    }
  }

  function readQuestion(input) {
    const question = typeof input?.question === 'string' ? input.question.trim() : '';
    if (!canReadQuestion(question)) throw new ReadingTaskError(400, 'invalid_question');
    return question;
  }

  function readGuideQuestion(value) {
    const question = typeof value === 'string' ? value.trim() : '';
    if (validateMessage(question) || isSensitiveQuestion(question)) throw new ReadingTaskError(400, 'invalid_question');
    return question;
  }

  async function understandQuestion(input, permit) {
    if (input?.requireModel === true) {
      const question = readGuideQuestion(input.question);
      const previousQuestion = input.previousQuestion === undefined ? undefined : readGuideQuestion(input.previousQuestion);
      if (understand && permit) await permit(true);
      try {
        if (understand) {
          const result = await understand(question, AbortSignal.timeout(20000), true, previousQuestion);
          if (result.clarification) return result;
          const expires = now() + 10 * 60 * 1000;
          return { ...result, proof: expires + '.' + questionProof(question, result.focus, expires, previousQuestion) };
        }
      } catch {
        // The guide workflow requires the parser to succeed before starting a new ritual.
      }
      throw new ReadingTaskError(503, 'question_model_unavailable');
    }
    const question = readQuestion(input);
    const local = understandLocally(question);
    if (local.clarification) return local;
    if (understand && (!permit || await permit(false))) {
      try {
        return await understand(question, AbortSignal.timeout(8000));
      } catch {
        // Use local understanding when the provider is unavailable.
      }
    }
    return local;
  }

  function start(input, identity) {
    const method = input?.method;
    const guide = method === 'combined' && input?.profile === guideVersion;
    const automatic = guide && input.automatic === true;
    const tarotFirst = guide && !automatic && input.tarotFirst === true;
    const question = guide ? readGuideQuestion(input.question) : readQuestion(input);
    const previousQuestion = guide && input.previousQuestion !== undefined ? readGuideQuestion(input.previousQuestion) : undefined;
    if (!guide && understandLocally(question).clarification) throw new ReadingTaskError(400, 'needs_clarification');
    if (method !== 'combined' && !readingMethods.includes(method)) throw new ReadingTaskError(400, 'invalid_method');
    const focus = typeof input?.focus === 'string' ? input.focus.trim() : '';
    if (!focus || focus.length > maxMessageLength) throw new ReadingTaskError(400, 'invalid_focus');
    if (guide) {
      const match = typeof input.proof === 'string' && /^(\d{1,16})\.([a-f0-9]{64})$/.exec(input.proof);
      if (!match || Number(match[1]) < now() || !timingSafeEqual(Buffer.from(match[2], 'hex'),
        Buffer.from(questionProof(question, focus, Number(match[1]), previousQuestion), 'hex'))) {
        throw new ReadingTaskError(400, 'question_needs_model_confirmation');
      }
    }
    const token = randomBytes(32).toString('base64url');
    const created = now();
    const task = {
      method, ruleVersion: ruleVersions[method], question, focus, createdAt: new Date(created).toISOString(),
      stage: { tarot: 'shuffle', liuyao: 'cast', meihua: 'numbers', combined: 'shuffle' }[method], followUps: [],
      ...(method === 'liuyao' || method === 'combined' ? { tosses: [] } : {}),
      ...(method === 'combined' ? { calculationRules: combinedRules } : {}),
      ...(guide ? { ruleVersion: guideVersion, calculationRules: automatic ? automaticGuideRules : guideRules, profile,
        questionHash: createHash('sha256').update(JSON.stringify([question, focus, previousQuestion])).digest('hex'),
        ...(previousQuestion === undefined ? {} : { previousQuestion }),
        stage: 'cast', cardEvents: [], coinEvents: [], actions: {} } : {}),
    };
    if (tarotFirst) {
      task.tarotFirst = true;
      prepareGuideTarot(task);
    } else if (automatic) {
      task.automatic = true;
      task.castStartedAt = task.createdAt;
      task.tosses = Array.from({ length: 6 }, () => rollLiuYaoLine(random));
      finishGuideCast(task);
      // The full deck is already shuffled and each card has an independently sampled orientation.
      for (const slot of [0, 1, 2]) selectCard(task, slot);
    }
    const key = tokenDigest(token);
    if (identity) {
      const owner = readingOwnerKey(identity);
      db.exec('BEGIN IMMEDIATE');
      try {
        if (deletedOwner.get(owner)) throw new ReadingTaskError(401, 'account_session_required');
        insert.run(key, created + taskLifetime, JSON.stringify(task));
        bindOwner.run(key, owner);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    } else {
      insert.run(key, created + taskLifetime, JSON.stringify(task));
    }
    return { token, task: snapshot(task) };
  }

  function shuffle(token) {
    return snapshot(change(tokenDigest(token), (task) => {
      requireMethod(task, 'tarot', true);
      if (task.ruleVersion === guideVersion) throw new ReadingTaskError(409, 'shuffle_out_of_order');
      if (task.stage !== 'shuffle') return false;
      task.deck = shuffleTarotDeck(random);
      task.stage = 'cut';
      return true;
    }));
  }

  function cut(token, input) {
    const point = input?.point;
    if (!cutPoints.includes(point)) throw new ReadingTaskError(400, 'invalid_cut');
    return snapshot(change(tokenDigest(token), (task) => {
      requireMethod(task, 'tarot', true);
      if (task.ruleVersion === guideVersion) throw new ReadingTaskError(409, 'cut_out_of_order');
      if (task.cut === point) return false;
      if (task.stage !== 'cut') throw new ReadingTaskError(409, 'cut_out_of_order');
      task.picking = cutTarotDeck(task.deck, point, task.question, random);
      task.cut = point;
      task.stage = 'draw';
      return true;
    }));
  }

  function pick(token, input) {
    const { slot, step } = input ?? {};
    if (!Number.isInteger(slot) || !Number.isInteger(step) || step < 0 || step > 2) {
      throw new ReadingTaskError(400, 'invalid_selection');
    }
    return applyRitual(token, input, true, (task, event) => {
      requireMethod(task, 'tarot', true);
      if (!task.picking) throw new ReadingTaskError(409, 'selection_out_of_order');
      const { selectedSlots, slots } = task.picking;
      if (slot < 0 || slot >= slots.length) throw new ReadingTaskError(400, 'invalid_slot');
      if (!event && step < selectedSlots.length && selectedSlots[step] === slot) return false;
      if (task.stage !== 'draw' || step !== selectedSlots.length || selectedSlots.includes(slot)) {
        throw new ReadingTaskError(409, 'selection_out_of_order');
      }
      selectCard(task, slot, event);
      return true;
    });
  }

  function selectCard(task, slot, event) {
    const result = selectTarotSlot(task.picking, slot, now);
    if (event) task.cardEvents.push(event);
    if (result.kind !== 'completed') {
      task.picking = result;
      return;
    }
    task.draw = task.ruleVersion === guideVersion ? { ...result.draw, spread: 'situation-influence-trend-v1' } : result.draw;
    task.documents = knowledge.retrieve(task.draw);
    task.picking.selectedSlots = result.selectedSlots;
    if (task.automatic) {
      const inputs = Array.from({ length: 3 }, () => Math.floor(random() * 999) + 1);
      resolveCombined(task, task.castResult, readMeihuaNumbers(inputs), automaticMeihuaSource);
    } else if (event) {
      if (task.tarotFirst) task.stage = 'cast';
      else resolveGuideClicks(task);
    } else if (task.method === 'combined') {
      task.stage = 'cast';
    } else {
      task.resolvedAt = task.draw.drawnAt;
      task.evidence = tarotEvidence(task.documents);
      task.stage = 'reading';
    }
  }

  function applyRitual(token, input, card, edit) {
    let replay;
    const task = change(tokenDigest(token), (current) => {
      if (current.ruleVersion !== guideVersion) return edit(current);
      const event = readEvent(input ?? {}, card);
      const digest = JSON.stringify([card, event]);
      const previous = current.actions[event.actionId];
      if (previous) {
        if (previous.digest !== digest) throw new ReadingTaskError(409, 'action_conflict');
        replay = previous.snapshot;
        return false;
      }
      if (!edit(current, event)) return false;
      current.actions[event.actionId] = { digest, snapshot: snapshot(current) };
      return true;
    });
    return replay ?? snapshot(task);
  }

  function resolveCombined(task, liuyao, meihua, source) {
    task.results = { liuyao, meihua, meihuaInputSource: source };
    task.evidence = [
      ...tarotEvidence(task.documents),
      ...retrieveIChingEvidence('liuyao', liuyao),
      ...retrieveIChingEvidence('meihua', meihua),
    ];
    if (task.ruleVersion === guideVersion) {
      task.chartHash = createHash('sha256').update(JSON.stringify([task.profile, task.tosses, task.cardEvents,
        task.castStartedAt, task.draw, task.results])).digest('hex');
    }
    task.resolvedAt = new Date(now()).toISOString();
    task.stage = 'reading';
  }

  function resolveIChing(task, result) {
    task.result = result;
    task.evidence = retrieveIChingEvidence(task.method, result);
    task.resolvedAt = new Date(now()).toISOString();
    task.stage = 'reading';
  }

  function prepareGuideTarot(task) {
    task.picking = prepareFullTarotDeck(random, task.question);
    task.stage = 'draw';
  }

  function resolveGuideClicks(task) {
    resolveCombined(task, task.castResult, readMeihuaClicks(task.cardEvents.map(({ epochMs }) => epochMs)), clickMeihuaSource);
  }

  function finishGuideCast(task) {
    task.castResult = readJingfang(task.tosses, castCalendar(Date.parse(task.castStartedAt)));
    if (task.tarotFirst) resolveGuideClicks(task);
    else prepareGuideTarot(task);
  }

  function toss(token, input) {
    const step = input?.step;
    if (!Number.isInteger(step) || step < 0 || step >= 6) throw new ReadingTaskError(400, 'invalid_toss');
    return applyRitual(token, input, false, (task, event) => {
      requireMethod(task, 'liuyao', true);
      if (!event && step < task.tosses.length) return false;
      if (task.stage !== 'cast' || step !== task.tosses.length) throw new ReadingTaskError(409, 'toss_out_of_order');
      if (event && step === 0) task.castStartedAt = new Date(now()).toISOString();
      const coins = rollLiuYaoLine(random);
      task.tosses.push(coins);
      if (event) task.coinEvents.push({ ...event, coins });
      if (task.tosses.length === 6) {
        if (event) {
          finishGuideCast(task);
          return true;
        }
        const liuyao = readLiuYao(task.tosses);
        if (task.method === 'combined') {
          const meihua = readMeihua(liuyao.lines.slice(0, 3).map(({ value }) => value));
          resolveCombined(task, liuyao, meihua, meihuaInputSource);
        } else {
          resolveIChing(task, liuyao);
        }
      }
      return true;
    });
  }

  function numbers(token, input) {
    const values = input?.numbers;
    if (!validMeihuaNumbers(values)) throw new ReadingTaskError(400, 'invalid_numbers');
    return snapshot(change(tokenDigest(token), (task) => {
      requireMethod(task, 'meihua');
      if (task.result?.inputs.every((value, index) => value === values[index])) return false;
      if (task.stage !== 'numbers') throw new ReadingTaskError(409, 'numbers_already_recorded');
      resolveIChing(task, readMeihuaNumbers(values));
      return true;
    }));
  }

  async function report(token, _input, permit) {
    const key = tokenDigest(token);
    const task = load(key);
    if (task.stage !== 'reading') throw new ReadingTaskError(409, 'report_not_ready');
    if (task.ruleVersion === guideVersion) {
      if (savedProReport(task)) return snapshot(task);
      if (permit) await permit(true);
      return proReport(key);
    }
    return snapshot(change(key, (current) => {
      if (current.report) return false;
      current.report = current.method === 'combined' ? composeCombinedReading(current) : composeReading(current);
      return true;
    }));
  }

  async function proReport(key) {
    if (runningReports.has(key)) return runningReports.get(key);
    const timeout = 180000;
    const task = change(key, (current) => {
      if (current.ruleVersion !== guideVersion || current.stage !== 'reading') {
        throw new ReadingTaskError(409, 'comparison_not_ready');
      }
      if (savedProReport(current)) return false;
      if (!generatePro) throw new ReadingTaskError(503, 'pro_model_unavailable');
      if (current.proStartedAt !== undefined && now() - current.proStartedAt < timeout) {
        throw new ReadingTaskError(409, 'comparison_in_progress');
      }
      current.proStartedAt = now();
      return true;
    });
    if (savedProReport(task)) return snapshot(task);
    const request = (async () => {
      let result;
      try {
        result = await generatePro(task, AbortSignal.timeout(timeout));
      } catch (error) {
        const timedOut = error?.name === 'TimeoutError';
        const invalid = error instanceof ModelOutputError;
        const detail = invalid || /^Provider HTTP \d{3}$/.test(error?.message ?? '') ? error.message : 'Provider connection failed';
        console.warn('Pro report:', timedOut ? 'Provider timed out' : detail);
        change(key, (current) => {
          if (current.proStartedAt !== task.proStartedAt) return false;
          delete current.proStartedAt;
          return true;
        });
        throw timedOut ? new ReadingTaskError(504, 'pro_model_timeout')
          : invalid ? new ReadingTaskError(502, 'pro_model_invalid_output')
          : new ReadingTaskError(503, 'pro_model_unavailable');
      }
      return snapshot(change(key, (current) => {
        if (current.proStartedAt !== task.proStartedAt) return false;
        current.proReport = result;
        current.proReportVersion = proPromptVersion;
        delete current.proStartedAt;
        return true;
      }));
    })();
    runningReports.set(key, request);
    try {
      return await request;
    } finally {
      runningReports.delete(key);
    }
  }

  async function followUp(token, input, permit) {
    const { step } = input ?? {};
    const question = typeof input?.question === 'string' ? input.question.trim() : '';
    if (!Number.isInteger(step) || step < 0 || step >= maxFollowUps || validateMessage(question) || isSensitiveQuestion(question)) {
      throw new ReadingTaskError(400, 'invalid_follow_up');
    }
    const key = tokenDigest(token);
    const current = load(key);
    if (current.ruleVersion === guideVersion) {
      if (current.followUps[step]?.question === question) return snapshot(current);
      if (!savedProReport(current) || step !== current.followUps.length) throw new ReadingTaskError(409, 'follow_up_out_of_order');
      if (!generateFollowUp) throw new ReadingTaskError(503, 'report_model_unavailable');
      if (permit) await permit(true);
      let report;
      try {
        report = await generateFollowUp(current, question, AbortSignal.timeout(180000));
      } catch {
        throw new ReadingTaskError(503, 'report_model_unavailable');
      }
      return snapshot(change(key, (task) => {
        if (task.followUps[step]?.question === question) return false;
        if (step !== task.followUps.length || task.chartHash !== current.chartHash) {
          throw new ReadingTaskError(409, 'follow_up_out_of_order');
        }
        task.followUps.push({ question, report });
        return true;
      }));
    }
    return snapshot(change(key, (task) => {
      if (task.followUps[step]?.question === question) return false;
      if (!task.report || step !== task.followUps.length) throw new ReadingTaskError(409, 'follow_up_out_of_order');
      const report = task.method === 'combined' ? composeCombinedReading(task, question) : composeReading(task, question);
      task.followUps.push({ question, report });
      return true;
    }));
  }

  return {
    understandQuestion, start, shuffle, cut, pick, toss, numbers, report, followUp,
    get: (token) => snapshot(load(tokenDigest(token))),
    checkOwner(token, identity) {
      const key = tokenDigest(token);
      const owner = ownerOf.get(key)?.owner_key;
      if (owner && owner !== readingOwnerKey(identity)) throw new ReadingTaskError(404, 'task_not_found');
    },
    clearExpired() {
      const time = now();
      clearExpired.run(time);
      clearDeletedOwners.run(time);
    },
    close: () => db.close(),
  };
}

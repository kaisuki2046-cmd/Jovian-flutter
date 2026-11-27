import { createHash, randomBytes, randomInt } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { rollLiuYaoLine } from '../control/iching.ts';
import { classifyPreview, validateMessage } from '../control/preview.ts';
import { openTarotSelection, pickTarotSlot } from '../control/tarot.ts';
import { maxReportVersions } from '../model/report.ts';
import { assembleReport, buildReportEvidence } from './report.mjs';

const taskLifetime = 24 * 60 * 60 * 1000;

export class TaskError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
  }
}

function randomFraction() {
  return randomInt(2 ** 32) / 2 ** 32;
}

function tokenDigest(token) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token ?? '')) throw new TaskError(401, 'invalid_task_token');
  return createHash('sha256').update(token).digest('hex');
}

function toSnapshot(task) {
  return {
    question: task.question,
    slotCount: task.picking.slots.length,
    selectedSlots: task.picking.selectedSlots,
    draw: task.draw,
    tosses: task.tosses,
    report: task.report?.content,
    reportVersion: task.reportVersion,
  };
}

export function createTaskService(databasePath, { generate, random = randomFraction, now = Date.now } = {}) {
  const db = new DatabaseSync(databasePath);
  db.exec(`
    PRAGMA busy_timeout = 5000;
    PRAGMA journal_mode = WAL;
    PRAGMA secure_delete = ON;
    CREATE TABLE IF NOT EXISTS divination_tasks (
      token_hash TEXT PRIMARY KEY,
      expires INTEGER NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS divination_expiration ON divination_tasks(expires);
  `);
  const find = db.prepare('SELECT payload FROM divination_tasks WHERE token_hash = ? AND expires > ?');
  const insert = db.prepare('INSERT INTO divination_tasks VALUES (?, ?, ?)');
  const update = db.prepare('UPDATE divination_tasks SET payload = ? WHERE token_hash = ?');
  const clearExpired = db.prepare('DELETE FROM divination_tasks WHERE expires <= ?');
  const running = new Map();

  function load(key) {
    const row = find.get(key, now());
    if (!row) throw new TaskError(404, 'task_not_found');
    return JSON.parse(row.payload);
  }

  function change(key, edit) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const task = load(key);
      if (edit(task)) update.run(JSON.stringify(task), key);
      db.exec('COMMIT');
      return task;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  function start(input) {
    const question = typeof input?.question === 'string' ? input.question.trim() : '';
    if (validateMessage(question) || classifyPreview(question, 'divination').kind !== 'confirmReading') {
      throw new TaskError(400, 'invalid_question');
    }
    const token = randomBytes(32).toString('base64url');
    const task = {
      question, picking: openTarotSelection({ id: 0, kind: 'tarotQuestion', question }, random),
      tosses: [], reportVersion: 0,
    };
    const started = now();
    clearExpired.run(started);
    insert.run(tokenDigest(token), started + taskLifetime, JSON.stringify(task));
    return { token, task: toSnapshot(task) };
  }

  function pick(token, input) {
    const { slot, step } = input ?? {};
    if (!Number.isInteger(slot) || !Number.isInteger(step) || step < 0 || step > 2) {
      throw new TaskError(400, 'invalid_selection');
    }
    return toSnapshot(change(tokenDigest(token), (task) => {
      const { selectedSlots, slots } = task.picking;
      if (slot < 0 || slot >= slots.length) throw new TaskError(400, 'invalid_slot');
      if (step < selectedSlots.length && selectedSlots[step] === slot) return false;
      if (step !== selectedSlots.length || task.draw || selectedSlots.includes(slot)) {
        throw new TaskError(409, 'selection_out_of_order');
      }
      const result = pickTarotSlot(task.picking, slot);
      if (result.kind === 'tarotResult') {
        task.draw = result.draw;
        task.picking.selectedSlots = [...selectedSlots, slot];
      } else {
        task.picking = result;
      }
      return true;
    }));
  }

  function toss(token, input) {
    const { step } = input ?? {};
    if (!Number.isInteger(step) || step < 0 || step > 5) throw new TaskError(400, 'invalid_toss');
    return toSnapshot(change(tokenDigest(token), (task) => {
      if (!task.draw || step > task.tosses.length) throw new TaskError(409, 'toss_out_of_order');
      if (step < task.tosses.length) return false;
      task.tosses.push(rollLiuYaoLine(random));
      if (task.tosses.length === 6) task.evidence = buildReportEvidence(task);
      return true;
    }));
  }

  async function report(token, input) {
    const { version } = input ?? {};
    if (!Number.isInteger(version) || version < 0) throw new TaskError(400, 'invalid_report_version');
    const key = tokenDigest(token);
    const task = load(key);
    if (!task.evidence || version > task.reportVersion) throw new TaskError(409, 'report_not_ready');
    if (version < task.reportVersion || version >= maxReportVersions) return toSnapshot(task);
    const generationKey = key + ':' + version;
    if (running.has(generationKey)) return running.get(generationKey);

    const request = (async () => {
      let content = assembleReport(task.evidence.choices);
      let source = 'rules';
      if (generate) {
        try {
          const signal = AbortSignal.timeout(15000);
          content = await generate(task.evidence, signal);
          source = 'model';
        } catch {
          // The approved, locally assembled report remains available.
        }
      }
      return toSnapshot(change(key, (current) => {
        if (current.reportVersion !== version) return false;
        current.reportVersion++;
        current.report = { source, content };
        return true;
      }));
    })();
    running.set(generationKey, request);
    try {
      return await request;
    } finally {
      running.delete(generationKey);
    }
  }

  return {
    start, pick, toss, report,
    get: (token) => toSnapshot(load(tokenDigest(token))),
    clearExpired: () => clearExpired.run(now()),
    close: () => db.close(),
  };
}

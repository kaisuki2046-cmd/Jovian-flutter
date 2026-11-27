import { readFileSync } from 'node:fs';
import { LunarUtil } from 'lunar-javascript';
import { isBaZiPillar } from '../../control/charts.ts';
import { confirmedTiebanBirth, tiebanFourteenEdition } from './tieban.mjs';

export const tiebanFourteenTableSource = new URL('./sources/tieban-fourteen-tables.json', import.meta.url);
const tableProfile = 'muxuan-fourteen-table-v1';
const natalProfile = 'muxuan-fourteen-table-natal-v1';
const annualProfile = 'muxuan-fourteen-table-annual-v1';
const stems = '甲乙丙丁戊己庚辛壬癸';
const branches = '子丑寅卯辰巳午未申酉戌亥';
const natalAxes = ['fourteen_personality', 'fourteen_career', 'fourteen_wealth', 'fourteen_siblings'];
const inRange = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

export function parseTiebanTableQuery(value) {
  if (!value || typeof value !== 'object') return null;
  const { lunarMonth, lunarDay, leap, queryTimePillar, age } = value;
  if (!inRange(lunarMonth, 1, 12) || !inRange(lunarDay, 1, 30) || typeof leap !== 'boolean'
    || !isBaZiPillar(queryTimePillar) || age !== undefined && !inRange(age, 1, 100)) return null;
  return { lunarMonth, lunarDay, leap, queryTimePillar, ...(age !== undefined && { age }) };
}

export function writeTiebanTableCells(db) {
  const data = JSON.parse(readFileSync(tiebanFourteenTableSource, 'utf8'));
  if (data.profile !== tableProfile || !Array.isArray(data.cells) || !data.cells.length) throw new Error('Invalid fourteen-table catalog');
  const add = db.prepare('INSERT INTO tieban_calculation_cell VALUES (?, ?, ?)');
  for (const [table, key, value] of data.cells) add.run(table, JSON.stringify(key), JSON.stringify(value));
}

function calculation(profile, candidates, reason) {
  return { profile, libraryEdition: tiebanFourteenEdition, candidates,
    ...(reason && { status: 'unavailable', reason }) };
}

function natalCandidates(cell, moment, mainNumber, initialNumber) {
  const hexagram = cell('hexagram', moment, mainNumber);
  const row = hexagram && cell('natal', hexagram, moment, initialNumber);
  if (!row) return calculation(natalProfile, [], 'missing_table_cell');
  const [base, sequence, ...offsets] = row;
  const candidates = offsets.flatMap((group, i) => group.map(offset => ({ axis: natalAxes[i], clauseId: base + sequence + offset })));
  return candidates.length ? calculation(natalProfile, candidates) : calculation(natalProfile, [], 'missing_table_cell');
}

function annualCandidates(cell, { gender, yearStem, yearBranch, initialNumber, mainNumber, moment, age }) {
  const sequence = cell('annual_sound', initialNumber, yearStem);
  const start = cell('annual_start', yearBranch, gender);
  const later = (initialNumber + mainNumber) % 8 || 8;
  const currentBranch = branches[(branches.indexOf(yearBranch) + age - 1) % 12];
  const sound = sequence && start && sequence[(age - 1 + 13 - start) % 12];
  const marker = cell('annual_marker', currentBranch, later);
  // This source implementation indexes the 14-13 column by the table's age parity.
  const letter = sound && marker && cell('annual_letter', moment, age % 2 ? '奇数' : '偶数', sound, marker);
  const row = letter && cell('annual_number', letter, age);
  if (!row || row[0] === 0) return calculation(annualProfile, [], 'missing_table_cell');
  const [base, add, correction] = row;
  const candidates = [{ axis: 'fourteen_annual', clauseId: base + add, age }];
  if (correction) {
    const shortCycle = age <= 10 || age >= 81;
    const modulus = shortCycle ? 6 : 20;
    const adjusted = (correction + (shortCycle ? 2 : 3) - 1) % modulus + 1;
    const corrected = cell('annual_correction', adjusted, age);
    if (corrected?.[0]) candidates.push({ axis: 'fourteen_annual_corrected', clauseId: corrected[0] + corrected[1], age });
  }
  return calculation(annualProfile, candidates);
}

export function tiebanTableCalculations(db, facts, request) {
  if (!request) return [];
  const query = parseTiebanTableQuery(request);
  const birth = confirmedTiebanBirth(facts);
  if (!query || !birth) return [calculation(natalProfile, [], 'missing_birth_or_query_input')];
  const { gender, pillars: [[yearStem, yearBranch], , day, [, hourBranch]] } = birth;
  const { lunarMonth, lunarDay, leap, queryTimePillar, age } = query;
  const lookup = db.prepare('SELECT value_json FROM tieban_calculation_cell WHERE table_name = ? AND lookup_key = ?');
  function cell(table, ...key) {
    const row = lookup.get(table, JSON.stringify(key));
    return row ? JSON.parse(row.value_json) : undefined;
  }
  const monthNumber = cell('month', (lunarMonth - 1 + Number(leap)) % 12 + 1);
  const hourNumber = cell('hour', hourBranch);
  const rawInitial = monthNumber + 3 - hourNumber;
  const initialNumber = rawInitial <= 0 ? rawInitial + 12 : rawInitial;
  const tone = cell('tone', initialNumber, stems.indexOf(yearStem) % 5);
  const toneNumber = tone && cell('tone_number', tone);
  const dayLife = cell('day_life', LunarUtil.NAYIN[day]?.slice(-1), queryTimePillar[0]);
  const timeLuck = cell('time_luck', LunarUtil.NAYIN[queryTimePillar]?.slice(-1));
  const sum = dayLife + timeLuck;
  const yangYear = stems.indexOf(yearStem) % 2 === 0;
  const group = (gender === '男') === yangYear ? '阳男阴女' : '阴男阳女';
  const moment = cell('moment', group, sum > 6 ? '>6' : '<=6');
  if (!(toneNumber && dayLife && timeLuck && moment)) {
    const profiles = age === undefined ? [natalProfile] : [natalProfile, annualProfile];
    return profiles.map(profile => calculation(profile, [], 'missing_table_cell'));
  }
  const mainNumber = (toneNumber * 5 + sum - (sum <= 6 ? 1 : 6)) * 30 + lunarDay;
  return [
    natalCandidates(cell, moment, mainNumber, initialNumber),
    ...(age === undefined ? [] : [annualCandidates(cell, { gender, yearStem, yearBranch, initialNumber, mainNumber, moment, age })]),
  ];
}

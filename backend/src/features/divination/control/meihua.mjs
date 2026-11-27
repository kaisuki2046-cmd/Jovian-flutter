import { trigrams } from '../model/iching-data.mjs';
import { elementRelation, lineCount, lookupHexagram, trigramMask } from './iching-tables.mjs';

/** @typedef {import('../model/iching').MeihuaReading} MeihuaReading */

const bodyUseLabels = {
  same: '体用比和', gives: '体生用', controls: '体克用', controlled: '用克体', receives: '用生体',
};

const bodyUseThemes = {
  same: '自身与外部条件的节奏接近，可以从容易达成共识的地方开始。',
  gives: '推动事情需要投入自身的时间、精力或资源，先算清能承担多少。',
  controls: '自身对事情有一定主动空间，可以从可控的一步开始。',
  controlled: '外部条件可能限制行动，先核实最容易卡住的一项要求。',
  receives: '可以留意外部支持，把已经明确的帮助转化为实际安排。',
};

/** @param {number} value @param {number} divisor */
function oneBasedRemainder(value, divisor) {
  return (value - 1) % divisor + 1;
}

/** @param {MeihuaReading['inputs']} inputs @returns {MeihuaReading} */
export function readMeihua(inputs) {
  if (inputs.length !== 3 || inputs.some((value) => !Number.isInteger(value) || value < 6 || value > 9)) {
    throw new RangeError('Meihua requires the first three Liu Yao line values.');
  }
  return readMeihuaNumbers(inputs);
}

/** @param {unknown} inputs @returns {inputs is MeihuaReading['inputs']} */
export function validMeihuaNumbers(inputs) {
  return Array.isArray(inputs) && inputs.length === 3
    && [inputs[0], inputs[1], inputs[2]].every((value) => Number.isInteger(value) && value >= 1 && value <= 999);
}

/** @param {MeihuaReading['inputs']} inputs @returns {MeihuaReading} */
export function readMeihuaNumbers(inputs) {
  if (!validMeihuaNumbers(inputs)) throw new RangeError('Meihua requires three integers between 1 and 999.');
  const [first, second, third] = inputs;
  return composeMeihua(inputs, oneBasedRemainder(first, 8), oneBasedRemainder(second, 8),
    oneBasedRemainder(first + second + third, lineCount));
}

/** @param {unknown} value @returns {value is string} */
export function validClickTime(value) {
  return typeof value === 'string' && /^[1-9][0-9]{0,15}$/.test(value);
}

/** @param {readonly string[]} timestamps */
export function readMeihuaClicks(timestamps) {
  if (timestamps.length !== 3 || !timestamps.every(validClickTime)) throw new RangeError('Invalid Tarot click timestamps.');
  const [first, second, third] = timestamps.map((value) => BigInt(value));
  const upperNumber = Number(first % 8n || 8n);
  const lowerNumber = Number(second % 8n || 8n);
  const moving = Number((first + second + third) % 6n || 6n);
  const result = composeMeihua([upperNumber, lowerNumber, moving], upperNumber, lowerNumber, moving);
  const pattern = result.primary.yangLines.reduce((code, yang, index) => code | (Number(yang) << index), 0);
  const mathematicalNuclear = lookupHexagram(nuclearPatternOf(pattern)).hexagram;
  const nuclearSource = pattern === 0 || pattern === 63 ? 'changed' : 'base';
  const nuclearLower = trigrams.find(({ name }) => name === result.nuclear.lower);
  const nuclearUpper = trigrams.find(({ name }) => name === result.nuclear.upper);
  return { ...result, timestamps, upperNumber, lowerNumber, mathematicalNuclear, nuclearSource,
    bodySide: moving <= 3 ? 'upper' : 'lower', useSide: moving <= 3 ? 'lower' : 'upper',
    nuclearLowerRelation: bodyUseLabels[elementRelation(result.body.element, nuclearLower.element)],
    nuclearUpperRelation: bodyUseLabels[elementRelation(result.body.element, nuclearUpper.element)] };
}

function nuclearPatternOf(pattern) {
  return ((pattern >> 1) & trigramMask) | (((pattern >> 2) & trigramMask) << 3);
}

/** @param {MeihuaReading['inputs']} inputs @returns {MeihuaReading} */
function composeMeihua(inputs, upperNumber, lowerNumber, moving) {
  const upper = trigrams[upperNumber - 1];
  const lower = trigrams[lowerNumber - 1];
  const pattern = lower.pattern | (upper.pattern << 3);
  const changedPattern = pattern ^ (1 << (moving - 1));
  const { hexagram: primary } = lookupHexagram(pattern);
  const changedEntry = lookupHexagram(changedPattern);
  // For pure Qian and Kun, the source text uses the changed hexagram to form the nuclear trigrams.
  const nuclearSource = pattern === 0 || pattern === 63 ? changedPattern : pattern;
  const nuclearPattern = nuclearPatternOf(nuclearSource);
  const { hexagram: nuclear } = lookupHexagram(nuclearPattern);

  const lowerMoves = moving <= 3;
  const body = lowerMoves ? upper : lower;
  const use = lowerMoves ? lower : upper;
  const changedUse = lowerMoves ? changedEntry.lower : changedEntry.upper;
  const originalRelation = elementRelation(body.element, use.element);
  const resultingRelation = elementRelation(body.element, changedUse.element);
  const relation = bodyUseLabels[originalRelation];
  const changedRelation = bodyUseLabels[resultingRelation];

  const relations = [originalRelation, resultingRelation];
  const direction = relations.includes('controlled') ? 'verify' : relations.includes('gives') ? 'adjust' : 'advance';
  const interpretation = originalRelation === resultingRelation
    ? bodyUseThemes[originalRelation]
    : `${bodyUseThemes[originalRelation]}变卦转为${changedRelation}，后续可参考「${changedEntry.hexagram.theme}」。`;

  return {
    inputs, primary, nuclear, changed: changedEntry.hexagram, moving,
    body, use, changedUse, relation, changedRelation, direction, interpretation,
  };
}

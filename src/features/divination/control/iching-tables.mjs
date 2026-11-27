import { palaceHexagrams, trigrams } from '../model/iching-data.mjs';

export const lineCount = 6;
export const trigramMask = 7;
const palaceMasks = [0, 1, 3, 7, 15, 31, 23, 16];
const shiPositions = [6, 1, 2, 3, 4, 5, 4, 3];
const trigramsByPattern = new Map(trigrams.map((trigram) => [trigram.pattern, trigram]));

const hexagrams = new Map(trigrams.flatMap((palace) => {
  const palacePattern = palace.pattern | (palace.pattern << 3);
  return palaceHexagrams[palace.name].map(([name, direction, theme], index) => {
    const pattern = palacePattern ^ palaceMasks[index];
    const upper = trigramsByPattern.get(pattern >> 3);
    const lower = trigramsByPattern.get(pattern & trigramMask);
    const hexagram = {
      name: upper === lower ? `${name}为${upper.image}` : `${upper.image}${lower.image}${name}`,
      upper: upper.name,
      lower: lower.name,
      yangLines: Array.from({ length: lineCount }, (_, line) => Boolean(pattern & (1 << line))),
      theme,
      direction,
    };
    return /** @type {const} */ ([pattern, { hexagram, palace, upper, lower, shi: shiPositions[index] }]);
  });
}));

/** @param {number} pattern */
export function lookupHexagram(pattern) {
  const entry = hexagrams.get(pattern);
  if (!entry) throw new RangeError('Invalid hexagram pattern.');
  return entry;
}

const elements = ['木', '火', '土', '金', '水'];
const elementRelations = /** @type {const} */ (['same', 'gives', 'controls', 'controlled', 'receives']);

/** @param {import('../model/iching').Element} body @param {import('../model/iching').Element} other */
export function elementRelation(body, other) {
  const distance = (elements.indexOf(other) - elements.indexOf(body) + elements.length) % elements.length;
  return elementRelations[distance];
}

export const hexagramNames = [...hexagrams.values()].map(({ hexagram }) => hexagram.name);

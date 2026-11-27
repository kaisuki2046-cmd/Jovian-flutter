import { elementRelation, lineCount, lookupHexagram } from './iching-tables.mjs';

/** @typedef {import('../model/iching').CoinToss} CoinToss */

const branchElements = {
  子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火',
  午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水',
};

const relatives = {
  same: '兄弟', gives: '子孙', controls: '妻财', controlled: '官鬼', receives: '父母',
};

const lineValues = /** @type {const} */ ([6, 7, 8, 9]);
const lineKinds = {
  6: '老阴', 7: '少阳', 8: '少阴', 9: '老阳',
};
const najiaStems = { 乾: ['甲', '壬'], 兑: ['丁', '丁'], 离: ['己', '己'], 震: ['庚', '庚'],
  巽: ['辛', '辛'], 坎: ['戊', '戊'], 艮: ['丙', '丙'], 坤: ['乙', '癸'] };
const stems = '甲乙丙丁戊己庚辛壬癸';
const earthlyBranches = '子丑寅卯辰巳午未申酉戌亥';
const spirits = ['青龙', '朱雀', '勾陈', '螣蛇', '白虎', '玄武'];
const spiritStart = [0, 0, 1, 1, 2, 3, 4, 4, 5, 5];

/** @param {readonly CoinToss[]} tosses @param {{timezone: string, year: string, month: string, day: string}} calendar */
export function readJingfang(tosses, calendar) {
  const base = readLiuYao(tosses);
  const dayIndex = Array.from({ length: 60 }, (_, index) => stems[index % 10] + earthlyBranches[index % 12]).indexOf(calendar.day);
  const monthBranch = calendar.month[1];
  if (dayIndex < 0 || !monthBranch || !earthlyBranches.includes(monthBranch)) throw new RangeError('Invalid cast calendar.');
  const firstVoid = (Math.floor(dayIndex / 10) * 10 + 10) % 12;
  const voidBranches = [earthlyBranches[firstVoid], earthlyBranches[(firstVoid + 1) % 12]];
  const pattern = base.primary.yangLines.reduce((code, yang, index) => code | (Number(yang) << index), 0);
  const changedPattern = base.moving.reduce((code, position) => code ^ (1 << (position - 1)), pattern);
  const { palace } = lookupHexagram(pattern);
  const monthOpposition = earthlyBranches[(earthlyBranches.indexOf(monthBranch) + 6) % 12];
  function chartLines(code) {
    const { upper, lower } = lookupHexagram(code);
    return [...lower.inner, ...upper.outer].map((branch, index) => {
      const element = branchElements[branch];
      return { position: index + 1, stem: index < 3 ? najiaStems[lower.name][0] : najiaStems[upper.name][1],
        branch, element, relative: relatives[elementRelation(palace.element, element)],
        spirit: spirits[(spiritStart[dayIndex % 10] + index) % 6],
        void: voidBranches.includes(branch), monthOpposed: branch === monthOpposition };
    });
  }
  const originalLines = chartLines(pattern);
  const changedLines = chartLines(changedPattern);
  const visible = new Set(originalLines.map(({ relative }) => relative));
  const hiddenSpirits = chartLines(palace.pattern | (palace.pattern << 3))
    .filter(({ relative }) => !visible.has(relative))
    .map((line) => ({ ...line, flyingStem: originalLines[line.position - 1].stem,
      flyingBranch: originalLines[line.position - 1].branch }));
  return { ...base, calendar, pattern, changedPattern, palaceElement: palace.element, voidBranches,
    hasChange: base.moving.length > 0, originalLines, changedLines, hiddenSpirits };
}

/** @param {() => number} [random] @returns {CoinToss} */
export function rollLiuYaoLine(random = Math.random) {
  const coin = () => random() < 0.5 ? 2 : 3;
  return [coin(), coin(), coin()];
}

/** @param {CoinToss} toss @returns {import('../model/iching').LineValue} */
export function coinTossValue(toss) {
  return lineValues[toss.filter((coin) => coin === 3).length];
}

/** @param {readonly CoinToss[]} tosses @returns {import('../model/iching').LiuYaoReading} */
export function readLiuYao(tosses) {
  if (tosses.length !== lineCount || tosses.some((toss) => toss.length !== 3 || toss.some((coin) => coin !== 2 && coin !== 3))) {
    throw new RangeError('Liu Yao requires six three-coin tosses.');
  }

  const values = tosses.map(coinTossValue);
  const pattern = values.reduce((bits, value, index) => bits | ((value % 2) << index), 0);
  const moving = values.flatMap((value, index) => value === 6 || value === 9 ? [index + 1] : []);
  const changedPattern = moving.reduce((bits, position) => bits ^ (1 << (position - 1)), pattern);
  const { hexagram: primary, palace, upper, lower, shi } = lookupHexagram(pattern);
  const { hexagram: changed } = lookupHexagram(changedPattern);
  const ying = (shi + 2) % lineCount + 1;
  const branches = [...lower.inner, ...upper.outer];
  const lines = values.map((value, index) => {
    const position = index + 1;
    const branch = branches[index];
    const element = branchElements[branch];
    return {
      position, value, kind: lineKinds[value], yang: value % 2 === 1, moving: moving.includes(position),
      branch, element, relative: relatives[elementRelation(palace.element, element)],
      role: position === shi ? '世' : position === ying ? '应' : undefined,
    };
  });

  const direction = moving.length >= 3 ? 'verify' : changed.direction;
  const change = moving.length
    ? `动爻转入${changed.name}，可留意「${changed.theme}」。`
    : '本次六爻皆静，可以从当前条件和现有安排着手。';
  const manyChanges = moving.length >= 3 ? '动爻较多，先核实哪一处变化会影响你的选择。' : '';
  const interpretation = `本卦${primary.name}提供的观察角度是「${primary.theme}」。${change}${manyChanges}`;

  return { tosses, lines, primary, changed, palace: palace.name, shi, ying, moving, direction, interpretation };
}

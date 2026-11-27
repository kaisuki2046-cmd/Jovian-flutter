import { getReadingAction } from '../control/reading-guidance.mjs';

const sources = {
  liuyao: 'https://zh.wikisource.org/wiki/增刪卜易/3',
  meihua: 'https://zh.wikisource.org/wiki/梅花易數/卷一',
};

export function tarotEvidence(documents) {
  return documents.map((doc) => ({
    id: doc.id, label: doc.label + ' · ' + doc.name + ' · ' + (doc.orientation === 'upright' ? '正位' : '逆位'),
    plain: doc.plain, source: doc.source, catalogVersion: 1,
  }));
}

export function retrieveIChingEvidence(method, result) {
  const entry = (key, label, plain, source = sources[method]) => ({
    id: method + ':v1:' + key, label, plain, source, catalogVersion: 1,
  });
  if (method === 'liuyao') {
    const shi = result.lines[result.shi - 1];
    const ying = result.lines[result.ying - 1];
    return [
      entry('shi-ying', '世应与六亲',
        `世爻在第 ${result.shi} 爻（${shi.relative}），应爻在第 ${result.ying} 爻（${ying.relative}）。可分别回看自己能做的事和仍需向外确认的条件。`),
      entry(result.moving.length ? 'moving' : 'still', result.moving.length ? '本卦与动爻' : '静卦',
        result.interpretation, 'https://zh.wikisource.org/wiki/增刪卜易/2'),
    ];
  }
  const { upper, lower } = result.primary;
  const nuclearBasis = upper === lower && (upper === '乾' || upper === '坤') ? '变卦' : '本卦';
  return [
    entry('body-use', '体用与五行', `体卦为${result.body.name}${result.body.element}，用卦为${result.use.name}${result.use.element}。${result.interpretation}`),
    entry('nuclear', '本卦、互卦与变卦',
      `${result.primary.name}第 ${result.moving} 爻动，变为${result.changed.name}。用${nuclearBasis}中间四爻排得互卦${result.nuclear.name}。`),
  ];
}

const directions = {
  verify: '可以先核实最影响你判断的一项，再决定是否推进。',
  adjust: '先调整现在最费力的一件事，再看看还需要做多大改变。',
  advance: '可以做一次小尝试，用现实反馈决定要不要继续。',
};

export function composeReading(task, followUp) {
  const { method, evidence, question } = task;
  const tarot = method === 'tarot';
  const [first, second, third] = evidence;
  const direction = tarot
    ? (task.documents[1].direction === 'advance' ? task.documents[2].direction : task.documents[1].direction)
    : task.result.direction;
  const base = {
    schemaVersion: 1, method, source: 'local',
    nextSteps: [getReadingAction(question, direction)],
  };
  if (!followUp) return {
    ...base, answer: directions[direction],
    explanation: evidence.map((item) => item.plain).join(' '),
    evidenceIds: evidence.map((item) => item.id),
  };

  const timing = /多久|什么时候|哪天|几月|期限|时间/.test(followUp);
  const reason = /为什么|原因|依据|怎么看|怎么理解|怎么得出|怎么算/.test(followUp);
  const current = reason ? second : tarot ? third : first;
  const previous = task.followUps.at(-1)?.report ?? task.report;
  return {
    ...base, evidenceIds: [current.id],
    answer: timing ? '可以先设一个观察点，用实际反馈判断什么时候适合推进。'
      : reason ? '可以从这次记录下来的依据看这一步。'
        : '沿用这次结果，可以把下一步缩小到一件你能亲自核实的事。',
    explanation: (previous?.nextSteps[0] ? '接着刚才的建议：' + previous.nextSteps[0] + ' ' : '') + current.plain,
  };
}

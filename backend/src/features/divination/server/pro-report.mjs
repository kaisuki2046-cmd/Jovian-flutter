import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseProReport } from '../model/pro-report.ts';
import { ModelOutputError, requestStructuredOutput } from './structured-model.mjs';

export const proModel = 'deepseek-v4-pro';
const proPrompt = readFileSync(new URL('../docs/DeepSeek-Pro-Prompt.md', import.meta.url), 'utf8').trim();
export const proPromptVersion = createHash('sha256').update(proPrompt).digest('hex');

export function rawChartInput({ question, previousQuestion, draw, results, castStartedAt, calculationRules }) {
  const { liuyao, meihua } = results;
  const hexagram = ({ name, upper, lower, yangLines }) => ({ name, upper, lower, yangLines });
  const trigram = ({ name, element }) => ({ name, element });
  return {
    question, ...(previousQuestion === undefined ? {} : { previousQuestion }), calculationRules,
    liuyao: {
      castStartedAt, calendar: liuyao.calendar, tosses: liuyao.tosses, palace: liuyao.palace,
      palaceElement: liuyao.palaceElement, shi: liuyao.shi, ying: liuyao.ying, moving: liuyao.moving,
      voidBranches: liuyao.voidBranches, primary: hexagram(liuyao.primary), changed: hexagram(liuyao.changed),
      originalLines: liuyao.originalLines.map((line, index) => ({
        ...line, value: liuyao.lines[index].value, yang: liuyao.lines[index].yang,
      })),
      changedLines: liuyao.changedLines, hiddenSpirits: liuyao.hiddenSpirits,
    },
    meihua: {
      ...(meihua.timestamps ? { timestamps: meihua.timestamps } : { inputs: meihua.inputs, inputSource: results.meihuaInputSource }),
      upperNumber: meihua.upperNumber, lowerNumber: meihua.lowerNumber,
      moving: meihua.moving, primary: hexagram(meihua.primary), changed: hexagram(meihua.changed),
      nuclear: hexagram(meihua.nuclear),
      ...(meihua.mathematicalNuclear ? { mathematicalNuclear: hexagram(meihua.mathematicalNuclear) } : {}),
      nuclearSource: meihua.nuclearSource, bodySide: meihua.bodySide, useSide: meihua.useSide,
      body: trigram(meihua.body), use: trigram(meihua.use), changedUse: trigram(meihua.changedUse),
      relation: meihua.relation, changedRelation: meihua.changedRelation,
      nuclearLowerRelation: meihua.nuclearLowerRelation, nuclearUpperRelation: meihua.nuclearUpperRelation,
    },
    tarot: {
      deck: draw.deck, spread: draw.spread,
      cards: draw.cards.map(({ card, orientation }, index) => ({
        position: ['现状', '关键影响', '趋势'][index], name: card.name, orientation,
      })),
    },
  };
}

export async function generateProReport(task, options) {
  const output = await requestStructuredOutput(rawChartInput(task), {
    ...options, provider: 'deepseek', model: proModel, chat: true, temperature: 0.4, maxOutputTokens: 8192,
    instructions: proPrompt,
  });
  try {
    return parseProReport(output, false);
  } catch (error) {
    throw new ModelOutputError(error.message);
  }
}

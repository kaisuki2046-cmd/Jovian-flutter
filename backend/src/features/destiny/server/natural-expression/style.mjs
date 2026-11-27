import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(new URL(name, import.meta.url), 'utf8').trim();
export const naturalExpressionVersion = JSON.parse(read('./version.json')).natural_expression_version;
const defaultExpressionMode = process.env.DESTINY_NATURAL_EXPRESSION ?? 'rules';

const guide = ['style_guide', 'sentence_rules', 'natural_vocabulary', 'anti_ai_rules']
  .map((name) => read(`./${name}.md`)).join('\n');
const categories = new Map([['overall', '性格'], ['career', '取舍'], ['love', '感情'], ['study', '日常'], ['wealth', '取舍']]);
const exampleParts = read('./examples.md').replace(/\r\n/gu, '\n').split(/^## (EX-\d{3}) · ([^\n]+)\n/mu);
const examplesByCategory = new Map();
const ids = new Set();
for (let index = 1; index < exampleParts.length; index += 3) {
  const [id, category, entry] = exampleParts.slice(index, index + 3);
  const fields = entry.trim().match(/^\*\*学习重点\*\* (.+)\n\n([^\n]+)\n\n\*\*使用限制\*\* (.+)$/u);
  if (!fields || ids.has(id)) throw new TypeError(`Invalid natural-expression example ${id}`);
  const [, focus, text, limit] = fields;
  ids.add(id);
  const examples = examplesByCategory.get(category) ?? [];
  examples.push({ id, category, focus, text, limit });
  examplesByCategory.set(category, examples);
}

export function buildNaturalExpression(topicIds = [], mode = defaultExpressionMode) {
  if (mode === 'off') return { prompt: '', samples: [] };
  const samples = [];
  if (mode === 'examples') {
    const selected = new Set([...topicIds.map((topic) => categories.get(topic)).filter(Boolean), '人际', '日常']);
    const offset = Array.from(topicIds.join('|')).reduce((hash, char) => (31 * hash + char.codePointAt(0)) >>> 0, 0);
    for (const category of selected) {
      const examples = examplesByCategory.get(category);
      if (examples?.length) samples.push(examples[(offset + samples.length) % examples.length]);
      if (samples.length === 2) break;
    }
  }
  const samplePrompt = samples.map(({ focus, text, limit }) => `${focus}。${text}\n使用限制：${limit}`).join('\n\n');
  const prompt = `【自然表达】\n${guide}`;
  return { prompt: samplePrompt ? `${prompt}\n\n【仅供模仿语言组织的示例】\n${samplePrompt}` : prompt, samples };
}

export function checkNaturalExpression(text) {
  const warnings = [];
  const paragraphs = text.split(/\n+/u).map((paragraph) => paragraph.trim()).filter(Boolean);
  const formula = /^(?:你(?:其实)?是一个|在(?:生活|感情|事业)中[，,]\s*你|值得注意的是|从某种程度上来说)/u;
  const starts = paragraphs.map((paragraph) => paragraph.match(formula)?.[0]);
  if (starts.some((start, index) => start && start === starts[index - 1])) warnings.push('连续段落使用同一开头');
  if ((text.match(/值得注意的是|从某种意义上来说|由此可见|这恰恰说明|综上所述/gu) ?? []).length >= 2) warnings.push('套话堆叠');
  if ((text.match(/(?:表面上|看似)[^。！？\n]{1,50}(?:实际上|其实)/gu) ?? []).length >= 2) warnings.push('反复使用同一种转折');
  if (/懂的都懂|狠狠共情|家人们谁懂|灵魂深处|命运的齿轮/u.test(text)) warnings.push('用语过于随意或煽情');
  return warnings;
}

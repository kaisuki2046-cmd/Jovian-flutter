import { parseChartQueries } from './knowledge/report-lookup.mjs';
import { claimForPrompt } from './knowledge/claims.mjs';
import { buildNaturalExpression } from './natural-expression/style.mjs';
import { collectReportMaterials, renderReportMaterials } from './report-materials.mjs';
import { selectReportMaterials } from './report-ranking.mjs';
import calibration from './report-ranking-calibration.json' with { type: 'json' };
import { reportTopics } from './knowledge/topics.mjs';

export const defaultDeepSeekModel = 'deepseek-v4-pro';

export function parseInput(value, { birthOnlyTieban = false } = {}) {
  if (!value || typeof value.timeKnown !== 'boolean') return null;
  const chartQueries = parseChartQueries(value.chartQueries, { timeKnown: value.timeKnown, birthOnlyTieban });
  if (!chartQueries) return null;
  return { timeKnown: value.timeKnown, chartQueries };
}

const systemPrompt = `请根据已经筛选的解读材料，用平实的中文和第二人称写命理报告。输入按主题提供各条的命中条件、原文和现代解读，原文与现代解读可能只提供其中一项。优先参考靠前且含义明确的条目。用同一条的命中条件理解原文和解读为何适用，以及它具体适用于什么情境。以该条已有解读为依据，禁止凭条件单独下判断或重新排盘。
结合命中条件，每项推断都从一条明确的已有解读出发，可以做一步联想或有逻辑的推理。推演限于原解读的含义、适用范围和具体程度，例如说明这一倾向在相近情境中的表现或直接影响。用“这也可能表现为”“在类似情境下”等自然表达标明推演。后续推断仍回到原解读，禁止把上一步推测当作新的前提。材料只支持性格或一般趋势时，就写到相应的具体程度。事件类型、结果、年龄、年份和次数各自需要材料支持。原条目的年龄和阶段限制只约束这条解读的适用时段。历史命例只供对照，其中的经历和应期属于原例人物。考刻未确认的铁板条文只作古籍参考，禁止把其中的亲属、事件、年龄或应期写成命主的事实或确定预测。语言示例只用于学习表达。
按综合、事业、爱情、学业、财富的顺序各写一次。小标题单独一行，直接写标题文字。材料足够时，先写该主题下的特点和做事方式，再写资料支持的具体情境或事件。某主题材料稀少时就简短说明，缺少可用解读时写“当前资料不足以判断。”合并重复内容，保留各条的适用限制。直接输出正文。`;

export function createDeepSeek({ apiKey, model = defaultDeepSeekModel, transport = fetch }) {
  return async function complete({ naturalExpression, promptMaterials }, signal) {
    const system = [systemPrompt, naturalExpression].filter(Boolean).join('\n\n');
    const response = await transport('https://api.deepseek.com/chat/completions', {
      method: 'POST', redirect: 'error', signal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
      body: JSON.stringify({
        model, thinking: { type: 'disabled' }, max_tokens: 8192,
        messages: [{ role: 'system', content: system }, { role: 'user', content: promptMaterials }],
      }),
    });
    if (!response.ok) throw new Error('DeepSeek request failed.');
    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    return typeof content === 'string' ? content : null;
  };
}

function tiebanCalculationSummary({ profile, libraryEdition, results, status, reason }) {
  return { profile, libraryEdition, ...(status && { status, reason }), results: results.map(({
    axis, clauseId, status, reason, claim, age, decadalPeriod, annualPeriod, yuanTangLine, dayLineBase, rangeLineBase, lineOffset,
    additionStep, calculationStep, keSteps, initialNumber, rawClauseId, rootAxis, requiresSelection,
    heluoTotals, kinshipTable, kinshipSequence, kinshipFact, parentSeries,
  }) => ({
    axis, clauseId, status, ...(age !== undefined && { age }), ...(decadalPeriod && { decadalPeriod }),
    ...(annualPeriod && { annualPeriod }), ...(yuanTangLine !== undefined && { yuanTangLine }),
    ...(lineOffset !== undefined && { lineOffset }),
    ...(dayLineBase !== undefined && { dayLineBase }),
    ...(rangeLineBase !== undefined && { rangeLineBase }),
    ...(additionStep !== undefined && { additionStep }),
    ...(keSteps !== undefined && { calculationStep, keSteps, initialNumber, rawClauseId }),
    ...(rootAxis && { rootAxis, initialNumber }),
    ...(requiresSelection && { requiresSelection }),
    ...(heluoTotals && { heluoTotals }),
    ...(kinshipTable && { kinshipTable }),
    ...(kinshipSequence && { kinshipSequence }),
    ...(kinshipFact && { kinshipFact }),
    ...(parentSeries && { parentSeries }),
    ...(reason && { reason }), ...(claim && { claimId: claim.id }),
  })) };
}

export function selectPromptMaterials(references) {
  return selectReportMaterials(collectReportMaterials(references, { combineAliases: false, forPrompt: true }), calibration);
}

function promptReferences({ topicId, topic, entries }) {
  const references = { topicId, topic, personality: [], events: [] };
  const rules = new Map();
  for (const { rule, branch, caseReference } of entries) {
    if (caseReference) (references.caseReferences ??= []).push(caseReference);
    if (!rule) continue;
    if (!rules.has(rule)) rules.set(rule, []);
    if (branch) rules.get(rule).push(branch);
  }
  for (const [rule, selectedBranches] of rules) {
    const matchedBranches = rule.matchedBranches?.filter(branch => selectedBranches.includes(branch));
    const selected = matchedBranches?.length
      ? { ...rule, matchedBranches, matchedConditions: matchedBranches[0].matchedConditions } : rule;
    references[rule.layer].push(claimForPrompt(selected));
  }
  return references;
}

export async function generateReport(input, { lookup, complete, signal, expressionMode }) {
  const references = lookup(input.chartQueries);
  const sections = selectPromptMaterials(references);
  const promptMaterials = renderReportMaterials(sections);
  const tieban = references.find(reference => reference.tieban)?.tieban;
  const calculation = tieban ? { tieban: {
    ...tiebanCalculationSummary(tieban),
    ...(tieban.additionalCalculations?.length && { additionalCalculations: tieban.additionalCalculations.map(tiebanCalculationSummary) }),
  } } : {};
  if (!promptMaterials) return { report: null, ...calculation };
  const claimReferences = sections.map(promptReferences);
  const matchedTopics = claimReferences.filter(({ personality, events }) => personality.length || events.length);
  const { prompt: naturalExpression } = buildNaturalExpression(matchedTopics.length
    ? matchedTopics.map(({ topicId }) => topicId) : Object.keys(reportTopics), expressionMode);
  signal.throwIfAborted();
  const report = await complete({
    references: claimReferences, promptMaterials, naturalExpression,
    // Local integrations can still inspect the ranked match with its proof.
    get materials() {
      return renderReportMaterials(selectReportMaterials(collectReportMaterials(references, { combineAliases: false }), calibration));
    },
  }, signal);
  signal.throwIfAborted();
  return { report, ...calculation };
}

import { algorithmDefinitions } from '../model/algorithm-profiles';
import type { InterpretationFact } from '../model/interpretation';
import { methodLibrary } from './method-knowledge';
import type { LibraryMethod } from '../model/method-library';

const remaining: Readonly<Record<string, string[]>> = {
  'BZ-M01': ['当前使用已确认快照；候选出生时间域与稳定性证明尚未实现。'],
  'BZ-M02': ['已有月令根气事实，旺衰分级、季节权重和取用流派尚未指定。'],
  'BZ-M08': ['尚未取得传统配偶星所需的性别及角色参数。'],
  'BZ-M11': ['月令藏干已单独列出，调候和吸引解释规则尚未编码。'],
  'BZ-M18': ['三合、三会、半合与缺中支的拱合候选分别记录，未判断成局或合化。'],
  'BZ-M19': ['六冲接触已实现，冲动、冲去或受损的条件规则尚未编码。'],
  'BZ-M22': ['争合候选已有参与人和柱位，作用先后与流派判据尚未编码。'],
  'BZ-M30': ['已按年柱分别列出生肖与纳音，年命关系解释与八宅命宫尚未定义。'],
  'BZ-M32': ['已有双向日柱对年柱与明干十神；作者解释条件和历史证明仍缺。'],
  'ZW-M02': ['命身和星曜事实已列出，格局及候选域判定尚未编码。'],
  'ZW-M03': ['本人三方四正已计算，星系成格与吉凶规则尚未编码。'],
  'ZW-M06': ['已有空宫和对宫主星参照；借入对象、亮度及流派规则未指定。'],
  'ZW-M07': ['已有三方四正与两侧邻宫星曜；指定对星夹格和解释判据未提供。'],
  'ZW-M15': ['仅实现对方年支定位，完整入卦解释和变盘规则尚未编码。'],
  'ZW-M18': ['沿用快照原盘四化标记，其他起化来源需额外数据。'],
  'ZW-M19': ['沿用快照四化表作本人宫干飞化，完整流派解释尚未编码。'],
  'ZW-M20': ['已有快照宫干表所指星在本宫的自化事实；不包含向心、离心及视同自化。'],
  'ZW-M22': ['分别保留同星本命标记与宫干自化。旧快照未给出起源时不判断是否为生年四化。'],
  'WA-M01': ['本人星位、宫主和相位已列出，完整关系主题解释规则尚未编码。'],
  'WA-M02': ['下降点、第七宫与传统宫主已有事实，完整解释规则尚未编码。'],
  'WA-M06': ['提供十颗天体等权计数，其他权重及流派解释需另定。'],
  'WA-M16': ['提供接收方已有相位与外来接触的连接，复杂激活排序规则尚未编码。'],
  'WA-M17': ['仅计算短弧星位中点，180度歧义保留两分支；宫头属于另一项方法。'],
  'WA-M19': ['提供无歧义组合星位的相位，完整关系整体解释和宫位规则尚未实现。'],
  'WA-M20': ['提供无歧义组合星位与个人本命的相位，复杂结构解释规则尚未实现。'],
};

export function remainingMethodRequirements(method: LibraryMethod) {
  return remaining[method.methodId] ?? method.missingFactTypes;
}

export function assessMethods(facts: readonly InterpretationFact[]) {
  return methodLibrary.methodLibrary.methods.map((method) => {
    const existing = methodLibrary.factMethodAdaptation.byFactType
      .filter(({ methodRefs }) => methodRefs.includes(method.methodId)).map(({ factTypeId }) => factTypeId);
    // The supplied sample omitted six clashes, which the v3 engine already computes.
    if (method.methodId === 'BZ-M19') existing.push('bazi:branch-opposition');
    const enrichment = algorithmDefinitions.filter(({ methods }) => methods.includes(method.methodId))
      .map(({ system, rule }) => `${system}:${rule}`);
    const eligible = new Set([...existing, ...enrichment]);
    const found = facts.filter(({ factTypeId }) => eligible.has(factTypeId));
    return {
      methodId: method.methodId, system: method.system, name: method.name,
      status: found.length ? 'partial_facts_available' : eligible.size ? 'no_available_fact' : 'not_implemented',
      factIds: found.map(({ id }) => id),
      calculatedFactTypes: [...new Set(found.map(({ factTypeId }) => factTypeId))],
      missingRequirements: remainingMethodRequirements(method), originalMissingRequirements: method.missingFactTypes,
      limitations: method.limitations,
      originalReleaseStatus: method.releaseStatus,
    };
  });
}

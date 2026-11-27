import { createHttpClient } from '../../../shared/http/client';
import type { FortuneAdvice, FortuneAdviceGroup } from '../model/advice';

const baseUrl = process.env.EXPO_PUBLIC_FORTUNE_TIME_BASE_URL;
const client = createHttpClient({ baseUrl, timeoutMs: 15000 });
const methods = ['bazi', 'western', 'ziwei'];

function validGroups(groups: FortuneAdviceGroup[] | undefined) {
  return Array.isArray(groups) && groups.length === 3
    && ['数字', '饰品', '颜色'].every((kind, index) => groups[index]?.kind === kind
      && Array.isArray(groups[index].items) && groups[index].items.every(item => item
        && methods.includes(item.method) && typeof item.theme === 'string' && typeof item.reason === 'string'
        && typeof item.knowledgeId === 'string' && typeof item.source === 'string'
        && Array.isArray(item.options) && item.options.length && item.options.every(option => typeof option === 'string')
        && Array.isArray(item.limitations) && item.limitations.every(line => typeof line === 'string')));
}

export function requestFortuneAdvice(calculationRunId: string, ownerId: string, snapshotId: string, signal: AbortSignal) {
  return client.request('/fortune/advice/' + calculationRunId, { signal, credentials: 'include', query: { expectedOwnerId: ownerId },
    parse(value: unknown) {
      const result = value as FortuneAdvice;
      if (!result || result.version !== 1 || result.calculationRunId !== calculationRunId || result.snapshotId !== snapshotId
        || !validGroups(result.groups)) throw new Error('Invalid fortune advice');
      return result;
    } });
}

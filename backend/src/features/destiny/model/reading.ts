export const methods = ['bazi', 'ziwei', 'western'] as const;
export type Method = typeof methods[number];

export type CalculationStage = 'validating' | 'normalizing' | Method | 'expressing';

export type ChartResult<T, S> = {
  method: Method;
  engineName: string;
  engineVersion: string;
  rulesetVersion: string;
  timeCompleteness: 'complete' | 'partial';
  rawResult: T[];
  summary: S | null;
  warning?: string;
};

export type FortuneReference = { date: string; time: string };

export type FortuneWindow = {
  period: 'year' | 'month' | 'week' | 'day' | 'hour';
  periodStart: number;
  start: number;
  end: number;
};

export type FourPillars = { year: string; month: string; day: string; hour: string };

export type FortuneCalendar = {
  referencePillars: FourPillars;
  actionPillars: FourPillars;
  windows: readonly FortuneWindow[];
};

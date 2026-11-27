export type ReadingDirection = 'advance' | 'verify' | 'adjust';
export type Element = '木' | '火' | '土' | '金' | '水';
export type TrigramName = '乾' | '兑' | '离' | '震' | '巽' | '坎' | '艮' | '坤';
export type CoinValue = 2 | 3;
export type CoinToss = readonly [CoinValue, CoinValue, CoinValue];
export type LineValue = 6 | 7 | 8 | 9;

export type Trigram = Readonly<{
  name: TrigramName;
  image: string;
  element: Element;
  pattern: number;
  inner: readonly string[];
  outer: readonly string[];
}>;

export type Hexagram = Readonly<{
  name: string;
  upper: TrigramName;
  lower: TrigramName;
  yangLines: readonly boolean[];
  theme: string;
  direction: ReadingDirection;
}>;

export type LiuYaoLine = Readonly<{
  position: number;
  value: LineValue;
  kind: '老阴' | '少阳' | '少阴' | '老阳';
  yang: boolean;
  moving: boolean;
  branch: string;
  element: Element;
  relative: '兄弟' | '子孙' | '妻财' | '官鬼' | '父母';
  role?: '世' | '应';
}>;

export type LiuYaoReading = Readonly<{
  tosses: readonly CoinToss[];
  lines: readonly LiuYaoLine[];
  primary: Hexagram;
  changed: Hexagram;
  palace: TrigramName;
  shi: number;
  ying: number;
  moving: readonly number[];
  direction: ReadingDirection;
  interpretation: string;
}>;

export type MeihuaReading = Readonly<{
  inputs: readonly [number, number, number];
  primary: Hexagram;
  nuclear: Hexagram;
  changed: Hexagram;
  moving: number;
  body: Trigram;
  use: Trigram;
  changedUse: Trigram;
  relation: string;
  changedRelation: string;
  direction: ReadingDirection;
  interpretation: string;
}>;

export type CombinedReading =
  | Readonly<{
    status: 'complete';
    liuyao: LiuYaoReading;
    meihua: MeihuaReading;
    direction: ReadingDirection;
    answer: string;
    summary: string;
    nextStep: string;
  }>
  | Readonly<{ status: 'casting'; tosses: readonly CoinToss[] }>
  | Readonly<{ status: 'failed'; tosses?: readonly CoinToss[] }>;

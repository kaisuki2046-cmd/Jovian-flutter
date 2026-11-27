import { leoContactSharesEndpoint, type GeometricBand } from './leo-source-context';

type Nature = 'favourable' | 'adverse';
type Direction = Pick<GeometricBand, 'progressedBody' | 'natalTargetId' | 'targetKind' | 'aspectType'>;
type TimedDirection = Direction & Pick<GeometricBand, 'start' | 'end'>;

// Explicit judgements from the individual directions in the 1906 text.
// Unlisted pairs are unclassified even when they use the same aspect angle.
export const leoDirectionNatures: Readonly<Record<string, { nature: Nature; passage: string; natalOnly?: true }>> = {
  'Sun:Jupiter:conjunction': { nature: 'favourable', passage: 'p225' },
  'Sun:Jupiter:sextile': { nature: 'favourable', passage: 'p228' },
  'Sun:Jupiter:square': { nature: 'adverse', passage: 'p229' },
  'Sun:Jupiter:trine': { nature: 'favourable', passage: 'p230' },
  'Sun:Jupiter:sesquiquadrate': { nature: 'adverse', passage: 'p231' },
  'Sun:Mars:sextile': { nature: 'favourable', passage: 'p238' },
  'Sun:Mars:square': { nature: 'adverse', passage: 'p239' },
  'Sun:Mars:trine': { nature: 'favourable', passage: 'p240' },
  'Sun:Neptune:square': { nature: 'adverse', passage: 'p261' },
  'Sun:Saturn:semisquare': { nature: 'adverse', passage: 'p269' },
  'Sun:Saturn:sextile': { nature: 'favourable', passage: 'p270' },
  'Sun:Saturn:square': { nature: 'adverse', passage: 'p271' },
  'Sun:Saturn:opposition': { nature: 'adverse', passage: 'p275' },
  'Sun:Uranus:square': { nature: 'adverse', passage: 'p281' },
  'Sun:Uranus:sesquiquadrate': { nature: 'adverse', passage: 'p283' },
  'Sun:Venus:semisextile': { nature: 'favourable', passage: 'p288' },
  'Sun:Venus:trine': { nature: 'favourable', passage: 'p291', natalOnly: true },
  'Mercury:Jupiter:semisquare': { nature: 'adverse', passage: 'p079', natalOnly: true },
  'Mercury:Jupiter:sextile': { nature: 'favourable', passage: 'p080', natalOnly: true },
  'Mercury:Jupiter:trine': { nature: 'favourable', passage: 'p082', natalOnly: true },
  'Mercury:Mars:sextile': { nature: 'favourable', passage: 'p090', natalOnly: true },
  'Mercury:Mars:square': { nature: 'adverse', passage: 'p091', natalOnly: true },
  'Mercury:Mars:trine': { nature: 'favourable', passage: 'p092', natalOnly: true },
  'Mercury:Saturn:sextile': { nature: 'favourable', passage: 'p110', natalOnly: true },
  'Mercury:Saturn:square': { nature: 'adverse', passage: 'p111', natalOnly: true },
  'Mercury:Saturn:trine': { nature: 'favourable', passage: 'p112', natalOnly: true },
  'Mercury:Uranus:sextile': { nature: 'favourable', passage: 'p120', natalOnly: true },
  'Mercury:Uranus:square': { nature: 'adverse', passage: 'p121', natalOnly: true },
  'Mercury:Uranus:trine': { nature: 'favourable', passage: 'p122', natalOnly: true },
  'Mars:Jupiter:opposition': { nature: 'adverse', passage: 'p045', natalOnly: true },
  'Mars:Jupiter:parallel': { nature: 'adverse', passage: 'p046', natalOnly: true },
  'Mars:Neptune:sextile': { nature: 'favourable', passage: 'p050', natalOnly: true },
  'Mars:Saturn:sextile': { nature: 'favourable', passage: 'p060', natalOnly: true },
  'Mars:Saturn:square': { nature: 'adverse', passage: 'p061', natalOnly: true },
  'Mars:Saturn:opposition': { nature: 'adverse', passage: 'p065', natalOnly: true },
  'Venus:Jupiter:sextile': { nature: 'favourable', passage: 'p296', natalOnly: true },
  'Venus:Jupiter:trine': { nature: 'favourable', passage: 'p298', natalOnly: true },
  'Venus:Saturn:semisquare': { nature: 'adverse', passage: 'p325', natalOnly: true },
  'Venus:Saturn:sextile': { nature: 'favourable', passage: 'p326', natalOnly: true },
  'Venus:Saturn:square': { nature: 'adverse', passage: 'p327', natalOnly: true },
  'Venus:Saturn:opposition': { nature: 'adverse', passage: 'p331', natalOnly: true },
  'Venus:Uranus:square': { nature: 'adverse', passage: 'p337', natalOnly: true },
  'Venus:Uranus:trine': { nature: 'favourable', passage: 'p338', natalOnly: true },
  'Venus:Uranus:sesquiquadrate': { nature: 'adverse', passage: 'p339', natalOnly: true },
};

const signature = (body: string, target: string, aspect: string) => [body, target, aspect].join(':');

// These passages address investment or speculation explicitly. Their judgement
// in this topic is narrower than the general nature of the same direction.
const speculationDirections: Readonly<Record<string, { nature: Nature; passage: string }>> = {
  'Moon:Jupiter:semisquare': { nature: 'adverse', passage: 'p147' },
  'Moon:Jupiter:trine': { nature: 'favourable', passage: 'p150' },
  'Moon:Sun:trine': { nature: 'favourable', passage: 'p200' },
  'Moon:Uranus:trine': { nature: 'favourable', passage: 'p210' },
  'Sun:Jupiter:trine': { nature: 'favourable', passage: 'p230' },
  'Sun:Jupiter:sesquiquadrate': { nature: 'adverse', passage: 'p231' },
  'Sun:Mars:sesquiquadrate': { nature: 'adverse', passage: 'p241' },
  'Sun:Moon:trine': { nature: 'favourable', passage: 'p252' },
  'Sun:Saturn:trine': { nature: 'favourable', passage: 'p272' },
  'Sun:Uranus:trine': { nature: 'favourable', passage: 'p282' },
  'Sun:Venus:semisextile': { nature: 'favourable', passage: 'p288' },
  'Sun:Venus:trine': { nature: 'favourable', passage: 'p291' },
  'Mercury:Jupiter:trine': { nature: 'favourable', passage: 'p082' },
  'Mercury:Jupiter:sesquiquadrate': { nature: 'adverse', passage: 'p083' },
  'Mercury:Saturn:trine': { nature: 'favourable', passage: 'p112' },
  'Mercury:Saturn:sesquiquadrate': { nature: 'adverse', passage: 'p113' },
  'Mercury:Uranus:trine': { nature: 'favourable', passage: 'p122' },
  'Mars:Jupiter:semisquare': { nature: 'adverse', passage: 'p039' },
  'Mars:Neptune:trine': { nature: 'favourable', passage: 'p052' },
  'Venus:Saturn:trine': { nature: 'favourable', passage: 'p328' },
  'Venus:Uranus:trine': { nature: 'favourable', passage: 'p338' },
  'Venus:Uranus:opposition': { nature: 'adverse', passage: 'p341' },
};

// Directions with an explicit travel judgement. Mere movement or a journey
// mentioned without a judgement does not qualify.
const travelDirections: typeof speculationDirections = {
  'Moon:Jupiter:semisquare': { nature: 'adverse', passage: 'p147' },
  'Moon:Jupiter:opposition': { nature: 'adverse', passage: 'p153' },
  'Moon:Jupiter:parallel': { nature: 'favourable', passage: 'p154' },
  'Moon:Mars:conjunction': { nature: 'adverse', passage: 'p155' },
  'Moon:Mars:sextile': { nature: 'favourable', passage: 'p158' },
  'Moon:Mars:square': { nature: 'adverse', passage: 'p159' },
  'Moon:Mars:trine': { nature: 'favourable', passage: 'p160' },
  'Moon:Mars:sesquiquadrate': { nature: 'adverse', passage: 'p161' },
  'Moon:Mars:quincunx': { nature: 'adverse', passage: 'p162' },
  'Moon:Mars:opposition': { nature: 'adverse', passage: 'p163' },
  'Moon:Mercury:semisquare': { nature: 'adverse', passage: 'p167' },
  'Moon:Mercury:sextile': { nature: 'favourable', passage: 'p168' },
  'Moon:Mercury:square': { nature: 'adverse', passage: 'p169' },
  'Moon:Mercury:trine': { nature: 'favourable', passage: 'p170' },
  'Moon:Mercury:sesquiquadrate': { nature: 'adverse', passage: 'p171' },
  'Moon:Mercury:opposition': { nature: 'adverse', passage: 'p173' },
  'Moon:Mercury:parallel': { nature: 'favourable', passage: 'p174' },
  'Moon:Sun:square': { nature: 'adverse', passage: 'p199' },
  'Moon:Uranus:trine': { nature: 'favourable', passage: 'p210' },
  'Moon:Uranus:opposition': { nature: 'adverse', passage: 'p213' },
  'Sun:Jupiter:conjunction': { nature: 'favourable', passage: 'p225' },
  'Sun:Jupiter:semisquare': { nature: 'adverse', passage: 'p227' },
  'Sun:Jupiter:sextile': { nature: 'favourable', passage: 'p228' },
  'Sun:Mars:sesquiquadrate': { nature: 'adverse', passage: 'p241' },
  'Sun:Moon:sextile': { nature: 'favourable', passage: 'p250' },
  'Sun:Uranus:sextile': { nature: 'favourable', passage: 'p280' },
  'Sun:Uranus:square': { nature: 'adverse', passage: 'p281' },
  'Sun:Uranus:trine': { nature: 'favourable', passage: 'p282' },
  'Sun:Uranus:sesquiquadrate': { nature: 'adverse', passage: 'p283' },
  'Sun:Uranus:opposition': { nature: 'adverse', passage: 'p285' },
  'Mercury:Jupiter:semisextile': { nature: 'favourable', passage: 'p078' },
  'Mercury:Jupiter:semisquare': { nature: 'adverse', passage: 'p079' },
  'Mercury:Jupiter:sextile': { nature: 'favourable', passage: 'p080' },
  'Mercury:Jupiter:sesquiquadrate': { nature: 'adverse', passage: 'p083' },
  'Mercury:Jupiter:quincunx': { nature: 'favourable', passage: 'p084' },
  'Mercury:Jupiter:parallel': { nature: 'favourable', passage: 'p086' },
  'Mercury:Mars:conjunction': { nature: 'adverse', passage: 'p087' },
  'Mercury:Mars:sextile': { nature: 'favourable', passage: 'p090' },
  'Mercury:Mars:trine': { nature: 'favourable', passage: 'p092' },
  'Mercury:Mars:sesquiquadrate': { nature: 'adverse', passage: 'p093' },
  'Mercury:Mars:opposition': { nature: 'adverse', passage: 'p095' },
  'Mercury:Saturn:sesquiquadrate': { nature: 'adverse', passage: 'p113' },
  'Mercury:Uranus:semisquare': { nature: 'adverse', passage: 'p119' },
  'Mercury:Uranus:sextile': { nature: 'favourable', passage: 'p120' },
  'Mercury:Uranus:sesquiquadrate': { nature: 'adverse', passage: 'p123' },
  'Mercury:Uranus:quincunx': { nature: 'adverse', passage: 'p124' },
  'Mercury:Venus:sextile': { nature: 'favourable', passage: 'p130' },
  'Mars:Jupiter:sesquiquadrate': { nature: 'adverse', passage: 'p043' },
  'Mars:Uranus:conjunction': { nature: 'adverse', passage: 'p067' },
  'Mars:Uranus:semisextile': { nature: 'favourable', passage: 'p068' },
  'Mars:Uranus:semisquare': { nature: 'adverse', passage: 'p069' },
  'Mars:Uranus:trine': { nature: 'favourable', passage: 'p072' },
  'Venus:Jupiter:semisquare': { nature: 'adverse', passage: 'p295' },
  'Venus:Jupiter:sextile': { nature: 'favourable', passage: 'p296' },
  'Venus:Jupiter:square': { nature: 'adverse', passage: 'p297' },
  'Venus:Jupiter:trine': { nature: 'favourable', passage: 'p298' },
  'Venus:Jupiter:sesquiquadrate': { nature: 'adverse', passage: 'p299' },
  'Venus:Jupiter:opposition': { nature: 'adverse', passage: 'p301' },
  'Venus:Uranus:semisextile': { nature: 'favourable', passage: 'p334' },
  'Venus:Uranus:trine': { nature: 'favourable', passage: 'p338' },
  'Venus:Uranus:sesquiquadrate': { nature: 'adverse', passage: 'p339' },
};

// Judgements about writing, letters and papers, and about forming or keeping
// friendships and attachments, from the named passages of the same book.
const correspondenceDirections: typeof speculationDirections = {
  'Moon:Mercury:semisextile': { nature: 'favourable', passage: 'p166' },
  'Moon:Mercury:semisquare': { nature: 'adverse', passage: 'p167' },
  'Moon:Mercury:square': { nature: 'adverse', passage: 'p169' },
  'Moon:Mercury:trine': { nature: 'favourable', passage: 'p170' },
  'Moon:Mercury:sesquiquadrate': { nature: 'adverse', passage: 'p171' },
  'Moon:Mercury:opposition': { nature: 'adverse', passage: 'p173' },
  'Moon:Sun:sextile': { nature: 'favourable', passage: 'p198' },
  'Sun:Jupiter:sextile': { nature: 'favourable', passage: 'p228' },
  'Sun:Mercury:conjunction': { nature: 'favourable', passage: 'p245' },
  'Sun:Mercury:semisextile': { nature: 'favourable', passage: 'p245' },
  'Sun:Mercury:sextile': { nature: 'favourable', passage: 'p245' },
  'Sun:Mercury:trine': { nature: 'favourable', passage: 'p245' },
  'Sun:Mercury:parallel': { nature: 'favourable', passage: 'p245' },
  'Mercury:Jupiter:conjunction': { nature: 'favourable', passage: 'p077' },
  'Mercury:Jupiter:trine': { nature: 'favourable', passage: 'p082' },
  'Mercury:Jupiter:sesquiquadrate': { nature: 'adverse', passage: 'p083' },
  'Mercury:Jupiter:quincunx': { nature: 'favourable', passage: 'p084' },
  'Mercury:Jupiter:opposition': { nature: 'adverse', passage: 'p085' },
  'Mercury:Jupiter:parallel': { nature: 'favourable', passage: 'p086' },
  'Mercury:Mars:semisquare': { nature: 'adverse', passage: 'p089' },
  'Mercury:Mars:sextile': { nature: 'favourable', passage: 'p090' },
  'Mercury:Mars:square': { nature: 'adverse', passage: 'p091' },
  'Mercury:Mars:trine': { nature: 'favourable', passage: 'p092' },
  'Mercury:Mars:sesquiquadrate': { nature: 'adverse', passage: 'p093' },
};

const friendshipDirections: typeof speculationDirections = {
  'Moon:Jupiter:conjunction': { nature: 'favourable', passage: 'p145' },
  'Moon:Jupiter:square': { nature: 'adverse', passage: 'p149' },
  'Moon:Jupiter:trine': { nature: 'favourable', passage: 'p150' },
  'Moon:Jupiter:parallel': { nature: 'favourable', passage: 'p154' },
  'Moon:Mars:conjunction': { nature: 'adverse', passage: 'p155' },
  'Moon:Mars:quincunx': { nature: 'adverse', passage: 'p162' },
  'Moon:Saturn:sextile': { nature: 'favourable', passage: 'p188' },
  'Moon:Sun:semisquare': { nature: 'adverse', passage: 'p197' },
  'Moon:Sun:sextile': { nature: 'favourable', passage: 'p198' },
  'Moon:Sun:trine': { nature: 'favourable', passage: 'p200' },
  'Moon:Uranus:sextile': { nature: 'favourable', passage: 'p208' },
  'Moon:Uranus:trine': { nature: 'favourable', passage: 'p210' },
  'Moon:Uranus:sesquiquadrate': { nature: 'adverse', passage: 'p211' },
  'Moon:Uranus:quincunx': { nature: 'adverse', passage: 'p212' },
  'Moon:Uranus:opposition': { nature: 'adverse', passage: 'p213' },
  'Moon:Venus:conjunction': { nature: 'favourable', passage: 'p215' },
  'Moon:Venus:semisextile': { nature: 'favourable', passage: 'p216' },
  'Moon:Venus:semisquare': { nature: 'adverse', passage: 'p217' },
  'Moon:Venus:sextile': { nature: 'favourable', passage: 'p218' },
  'Moon:Venus:square': { nature: 'adverse', passage: 'p219' },
  'Moon:Venus:trine': { nature: 'favourable', passage: 'p220' },
  'Moon:Venus:opposition': { nature: 'adverse', passage: 'p223' },
  'Moon:Venus:parallel': { nature: 'favourable', passage: 'p224' },
  'Sun:Jupiter:conjunction': { nature: 'favourable', passage: 'p225' },
  'Sun:Jupiter:sextile': { nature: 'favourable', passage: 'p228' },
  'Mercury:Jupiter:trine': { nature: 'favourable', passage: 'p082' },
  'Mercury:Jupiter:parallel': { nature: 'favourable', passage: 'p086' },
  'Venus:Jupiter:sextile': { nature: 'favourable', passage: 'p296' },
  'Venus:Jupiter:square': { nature: 'adverse', passage: 'p297' },
  'Venus:Jupiter:trine': { nature: 'favourable', passage: 'p298' },
  'Venus:Saturn:sextile': { nature: 'favourable', passage: 'p326' },
  'Venus:Saturn:square': { nature: 'adverse', passage: 'p327' },
  'Venus:Saturn:trine': { nature: 'favourable', passage: 'p328' },
  'Venus:Uranus:trine': { nature: 'favourable', passage: 'p338' },
  'Venus:Uranus:sesquiquadrate': { nature: 'adverse', passage: 'p339' },
};

const studyDirections: typeof speculationDirections = {
  'Moon:Mercury:semisextile': { nature: 'favourable', passage: 'p166' },
  'Moon:Mercury:sextile': { nature: 'favourable', passage: 'p168' },
  'Moon:Mercury:trine': { nature: 'favourable', passage: 'p170' },
  'Moon:Mercury:quincunx': { nature: 'favourable', passage: 'p172' },
  'Moon:Mercury:opposition': { nature: 'adverse', passage: 'p173' },
  'Moon:Saturn:sextile': { nature: 'favourable', passage: 'p188' },
  'Moon:Saturn:trine': { nature: 'favourable', passage: 'p190' },
  'Moon:Saturn:sesquiquadrate': { nature: 'adverse', passage: 'p191' },
};

const disputeDirections: typeof speculationDirections = {
  'Moon:Mars:semisquare': { nature: 'adverse', passage: 'p157' },
  'Moon:Mars:sesquiquadrate': { nature: 'adverse', passage: 'p161' },
  'Moon:Mars:opposition': { nature: 'adverse', passage: 'p163' },
  'Moon:Mars:parallel': { nature: 'adverse', passage: 'p164' },
  'Moon:Mercury:semisquare': { nature: 'adverse', passage: 'p167' },
  'Moon:Mercury:square': { nature: 'adverse', passage: 'p169' },
  'Moon:Mercury:opposition': { nature: 'adverse', passage: 'p173' },
  'Moon:Sun:opposition': { nature: 'adverse', passage: 'p203' },
};

const metaphysicalDirections: typeof speculationDirections = {
  'Moon:Neptune:semisextile': { nature: 'favourable', passage: 'p176' },
  'Moon:Neptune:semisquare': { nature: 'adverse', passage: 'p177' },
  'Moon:Neptune:sextile': { nature: 'favourable', passage: 'p178' },
  'Moon:Neptune:square': { nature: 'adverse', passage: 'p179' },
  'Moon:Neptune:trine': { nature: 'favourable', passage: 'p180' },
  'Moon:Neptune:opposition': { nature: 'adverse', passage: 'p183' },
  'Moon:Uranus:sextile': { nature: 'favourable', passage: 'p208' },
  'Moon:Uranus:trine': { nature: 'favourable', passage: 'p210' },
};

const relocationDirections: typeof speculationDirections = {
  'Moon:Jupiter:square': { nature: 'adverse', passage: 'p149' },
  'Moon:Mars:sesquiquadrate': { nature: 'adverse', passage: 'p161' },
  'Moon:Mars:quincunx': { nature: 'adverse', passage: 'p162' },
  'Moon:Mars:opposition': { nature: 'adverse', passage: 'p163' },
  'Moon:Mercury:sextile': { nature: 'favourable', passage: 'p168' },
  'Moon:Mercury:trine': { nature: 'favourable', passage: 'p170' },
  'Moon:Mercury:opposition': { nature: 'adverse', passage: 'p173' },
  'Moon:Saturn:semisquare': { nature: 'adverse', passage: 'p187' },
  'Moon:Saturn:square': { nature: 'adverse', passage: 'p189' },
  'Moon:Sun:sextile': { nature: 'favourable', passage: 'p198' },
  'Moon:Sun:square': { nature: 'adverse', passage: 'p199' },
  'Moon:Uranus:semisquare': { nature: 'adverse', passage: 'p207' },
  'Moon:Uranus:sextile': { nature: 'favourable', passage: 'p208' },
  'Moon:Uranus:square': { nature: 'adverse', passage: 'p209' },
  'Moon:Uranus:trine': { nature: 'favourable', passage: 'p210' },
  'Moon:Uranus:sesquiquadrate': { nature: 'adverse', passage: 'p211' },
  'Moon:Uranus:quincunx': { nature: 'adverse', passage: 'p212' },
  'Moon:Uranus:opposition': { nature: 'adverse', passage: 'p213' },
};

// Attachments and affections have their own evidence in the Moon chapter.
// A judgement about friendships alone does not qualify for this topic.
const attachmentDirections: typeof speculationDirections = {
  'Moon:Jupiter:parallel': { nature: 'favourable', passage: 'p154' },
  'Moon:Neptune:opposition': { nature: 'adverse', passage: 'p183' },
  'Moon:Uranus:opposition': { nature: 'adverse', passage: 'p213' },
  'Moon:Venus:conjunction': { nature: 'favourable', passage: 'p215' },
  'Moon:Venus:semisquare': { nature: 'adverse', passage: 'p217' },
  'Moon:Venus:sextile': { nature: 'favourable', passage: 'p218' },
  'Moon:Venus:square': { nature: 'adverse', passage: 'p219' },
  'Moon:Venus:trine': { nature: 'favourable', passage: 'p220' },
  'Moon:Venus:opposition': { nature: 'adverse', passage: 'p223' },
  'Moon:Venus:parallel': { nature: 'favourable', passage: 'p224' },
};

// The Moon chapter distinguishes an isolated lunar indication from a major
// direction on the same matter. Use passages that actually discuss the topic.
const sharedFinanceAttachmentDirections: typeof speculationDirections = {
  'Sun:Jupiter:conjunction': { nature: 'favourable', passage: 'p225' },
  'Sun:Jupiter:semisquare': { nature: 'adverse', passage: 'p227' },
  'Sun:Jupiter:trine': { nature: 'favourable', passage: 'p230' },
  'Sun:Jupiter:sesquiquadrate': { nature: 'adverse', passage: 'p231' },
  'Sun:Venus:semisextile': { nature: 'favourable', passage: 'p288' },
  'Sun:Venus:semisquare': { nature: 'adverse', passage: 'p289' },
  'Sun:Venus:square': { nature: 'adverse', passage: 'p289' },
  'Sun:Venus:sextile': { nature: 'favourable', passage: 'p290' },
  'Sun:Venus:trine': { nature: 'favourable', passage: 'p291' },
  'Venus:Jupiter:square': { nature: 'adverse', passage: 'p297' },
  'Venus:Jupiter:trine': { nature: 'favourable', passage: 'p298' },
  'Venus:Saturn:sextile': { nature: 'favourable', passage: 'p326' },
  'Venus:Saturn:square': { nature: 'adverse', passage: 'p327' },
  'Venus:Uranus:trine': { nature: 'favourable', passage: 'p338' },
};
const monthlyAttachmentDirections: typeof speculationDirections = {
  ...sharedFinanceAttachmentDirections,
  'Sun:Jupiter:sextile': { nature: 'favourable', passage: 'p228' },
  'Sun:Venus:conjunction': { nature: 'favourable', passage: 'p287' },
};
const monthlyFinanceDirections: typeof speculationDirections = {
  ...sharedFinanceAttachmentDirections,
  'Venus:Jupiter:sextile': { nature: 'favourable', passage: 'p296' },
  'Venus:Saturn:trine': { nature: 'favourable', passage: 'p328' },
};

const careerDirections: typeof speculationDirections = {
  'Moon:Mercury:trine': { nature: 'favourable', passage: 'p170' },
  'Moon:Neptune:sesquiquadrate': { nature: 'adverse', passage: 'p181' },
  'Moon:Saturn:sextile': { nature: 'favourable', passage: 'p188' },
  'Moon:Sun:semisextile': { nature: 'favourable', passage: 'p196' },
  'Moon:Sun:sextile': { nature: 'favourable', passage: 'p198' },
  'Moon:Sun:trine': { nature: 'favourable', passage: 'p200' },
  'Moon:Sun:sesquiquadrate': { nature: 'adverse', passage: 'p201' },
  'Moon:Sun:opposition': { nature: 'adverse', passage: 'p203' },
  'Moon:Uranus:opposition': { nature: 'adverse', passage: 'p213' },
};

const familyDirections: typeof speculationDirections = {
  'Moon:Jupiter:square': { nature: 'adverse', passage: 'p149' },
  'Moon:Mercury:square': { nature: 'adverse', passage: 'p169' },
  'Moon:Saturn:square': { nature: 'adverse', passage: 'p189' },
  'Moon:Uranus:square': { nature: 'adverse', passage: 'p209' },
  'Moon:Uranus:parallel': { nature: 'adverse', passage: 'p214' },
  'Moon:Venus:semisextile': { nature: 'favourable', passage: 'p216' },
  'Moon:Venus:square': { nature: 'adverse', passage: 'p219' },
  'Moon:Venus:sesquiquadrate': { nature: 'adverse', passage: 'p221' },
  'Moon:Venus:quincunx': { nature: 'favourable', passage: 'p222' },
};

const serviceDirections: typeof speculationDirections = {
  'Moon:Mercury:square': { nature: 'adverse', passage: 'p169' },
  'Moon:Mercury:opposition': { nature: 'adverse', passage: 'p173' },
  'Moon:Saturn:sextile': { nature: 'favourable', passage: 'p188' },
};

// The Neptune sesquiquadrate explicitly contrasts business with devotional reading.
const reflectionDirections: typeof speculationDirections = {
  'Moon:Jupiter:trine': { nature: 'favourable', passage: 'p150' },
  'Moon:Neptune:semisextile': { nature: 'favourable', passage: 'p176' },
  'Moon:Neptune:sextile': { nature: 'favourable', passage: 'p178' },
  'Moon:Neptune:square': { nature: 'adverse', passage: 'p179' },
  'Moon:Neptune:trine': { nature: 'favourable', passage: 'p180' },
  'Moon:Neptune:sesquiquadrate': { nature: 'favourable', passage: 'p181' },
  'Moon:Neptune:opposition': { nature: 'adverse', passage: 'p183' },
  'Moon:Uranus:trine': { nature: 'favourable', passage: 'p210' },
};

const topicDirections = { speculation: speculationDirections, travel: travelDirections, correspondence: correspondenceDirections,
  friendship: friendshipDirections, study: studyDirections, dispute: disputeDirections, metaphysical: metaphysicalDirections,
  relocation: relocationDirections, attachment: attachmentDirections, career: careerDirections, family: familyDirections,
  service: serviceDirections, reflection: reflectionDirections,
  monthlyAttachment: monthlyAttachmentDirections, monthlyFinance: monthlyFinanceDirections };

export function classifyLeoTopicDirections<T extends TimedDirection>(bands: T[], topic: keyof typeof topicDirections) {
  const sources = topicDirections[topic];
  return bands.flatMap(band => {
    if (band.targetKind === 'progressed') {
      const lunarMonthly = topic === 'monthlyAttachment' || topic === 'monthlyFinance';
      // The solar chapter permits these same-chart comparisons. Mutual
      // directions and Sun/Venus aspects outside Venus's reach stay natal.
      const solarInBothCharts = band.progressedBody === 'Sun' && (band.natalTargetId === 'Jupiter'
        || band.natalTargetId === 'Venus' && ['conjunction', 'semisextile', 'semisquare'].includes(band.aspectType));
      if (!lunarMonthly || !solarInBothCharts) return [];
    }
    const source = sources[signature(band.progressedBody, band.natalTargetId, band.aspectType)];
    return source ? [{ band, ...describeLeoDirection(band), ...source }] : [];
  });
}

export function describeLeoDirection(band: Direction) {
  return { body: band.progressedBody, target: band.natalTargetId, targetKind: band.targetKind ?? 'natal',
    aspectType: band.aspectType };
}

export function classifyLeoDirections<T extends TimedDirection>(bands: T[]) {
  return bands.flatMap(band => {
    const chart = band.targetKind ?? 'natal';
    const direct = leoDirectionNatures[signature(band.progressedBody, band.natalTargetId, band.aspectType)];
    const reciprocal = chart === 'progressed'
      ? leoDirectionNatures[signature(band.natalTargetId, band.progressedBody, band.aspectType)] : undefined;
    const source = direct ?? reciprocal;
    return source && (chart === 'natal' || !source.natalOnly)
      ? [{ band, ...describeLeoDirection(band), nature: source.nature, passage: source.passage }] : [];
  });
}

export function summarizeLeoDirectionNatures(natures: (Nature | 'conditional' | undefined)[]) {
  const favourable = natures.includes('favourable'), adverse = natures.includes('adverse');
  return favourable ? adverse ? 'mixed' : 'favourable' : adverse ? 'adverse' : 'none';
}

export function isConcurrentLeoDirection(base: TimedDirection, other: TimedDirection) {
  const chart = base.targetKind ?? 'natal';
  if ((other.targetKind ?? 'natal') !== chart || base.start >= other.end || other.start >= base.end) return false;
  const basePair = signature(base.progressedBody, base.natalTargetId, base.aspectType);
  const reciprocal = chart === 'progressed' ? signature(base.natalTargetId, base.progressedBody, base.aspectType) : undefined;
  const otherPair = signature(other.progressedBody, other.natalTargetId, other.aspectType);
  return otherPair !== basePair && otherPair !== reciprocal;
}

export function supportingLeoDirections(base: TimedDirection, directions: ReturnType<typeof classifyLeoDirections>) {
  return directions.filter(({ band }) => isConcurrentLeoDirection(base, band));
}

export function linkLeoSupportingDirection(baseLinks: GeometricBand[], moon: GeometricBand[],
  directions: ReturnType<typeof classifyLeoDirections>) {
  if (!baseLinks.length) return undefined;
  for (const { band, nature, passage } of directions) {
    if (nature !== 'favourable') continue;
    const shared = baseLinks.find(contact => leoContactSharesEndpoint(band, contact));
    const otherContact = shared ?? moon.find(contact => leoContactSharesEndpoint(band, contact));
    if (otherContact) return { direction: { ...describeLeoDirection(band), nature, passage },
      baseContact: describeLeoDirection(shared ?? baseLinks[0]), otherContact: describeLeoDirection(otherContact) };
  }
}

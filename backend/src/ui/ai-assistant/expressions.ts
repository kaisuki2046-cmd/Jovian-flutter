import type { AssistantTransform } from './pose';

const visible: AssistantTransform = { scale: [1, 1, 1] };
const hidden: AssistantTransform = { scale: [0.001, 0.001, 0.001] };
const closedEyes = {
  eyeLeft: hidden,
  eyeRight: hidden,
  eyeLeftClosed: visible,
  eyeRightClosed: visible,
};
const openSmile = { mouth: hidden, laughMouth: visible, laughTongue: visible };
const roundMouth = { mouth: hidden, roundMouth: visible, roundTongue: visible };
const cheeks = { blushLeft: visible, blushRight: visible };
const angerMarks = { angerMark0: visible, angerMark1: visible, angerMark2: visible, angerMark3: visible };

// In the same order as the eleven facial references. Transforms are local
// to the face or eye so the features stay attached through the head animation.
export const assistantExpressions = {
  laugh: {
    ...openSmile,
    eyeLeft: { scale: [1.03, 1.06, 1] },
    eyeRight: { scale: [1.03, 1.06, 1] },
  },
  wink: {
    ...openSmile,
    eyeRight: hidden,
    winkEye: visible,
    laughMouth: { scale: [0.80, 0.84, 1] },
    laughTongue: { scale: [0.80, 0.84, 1] },
  },
  surprise: {
    ...roundMouth,
    eyeLeft: { scale: [0.91, 1.06, 1] },
    eyeRight: { scale: [0.91, 1.06, 1] },
    attentionGoldMain: { scale: [0.9, 0.86, 1] },
    attentionGoldRight: visible,
  },
  teary: {
    mouth: hidden, worriedMouth: visible,
    eyeLeftGlint: { scale: [1.18, 1.10, 1] },
    eyeRightGlint: { scale: [1.18, 1.10, 1] },
    tearLeft: visible, tearRight: visible,
  },
  grumpy: {
    mouth: hidden, worriedMouth: visible,
    eyeLeft: hidden, eyeRight: hidden,
    eyeLeftAngry: visible, eyeRightAngry: visible,
    eyeLeftAngryGlint: visible, eyeRightAngryGlint: visible,
    ...angerMarks,
  },
  sleepy: {
    ...closedEyes,
    mouth: hidden,
    roundMouth: { scale: [0.56, 0.48, 1] },
    roundTongue: { scale: [0.56, 0.48, 1], translation: [0, 0.010, 0] },
    sleepZTop: visible, sleepZSmall: visible,
  },
  puzzled: {
    mouth: hidden,
    worriedMouth: { rotation: [0, 0, 0.42], scale: [0.70, 0.92, 1] },
    eyeLeft: { translation: [0, -0.036, 0.010] },
    eyeRight: { translation: [0, 0.052, 0.016], scale: [1.03, 1.05, 1] },
    questionCurve: visible, questionDot: visible,
  },
  love: {
    ...openSmile,
    ...cheeks,
    eyeLeftGlint: hidden, eyeRightGlint: hidden,
    eyeLeftHeart: visible, eyeRightHeart: visible,
    loveHeart: visible, smallHeart: visible,
  },
  excited: {
    ...openSmile,
    ...cheeks,
    eyeLeft: { scale: [1.09, 1.10, 1] },
    eyeRight: { scale: [1.09, 1.10, 1] },
    eyeLeftGlint: hidden, eyeRightGlint: hidden,
    eyeLeftStar: visible, eyeRightStar: visible,
    attentionGoldLeft: visible, attentionGoldMain: visible, attentionGoldRight: visible,
    laughMouth: { scale: [1.13, 1.19, 1] },
    laughTongue: { scale: [1.14, 1.17, 1], translation: [0, -0.006, 0] },
  },
  listening: {
    ...closedEyes,
    ...cheeks,
    mouth: hidden,
    roundMouth: { scale: [0.42, 0.36, 1] },
    roundTongue: { scale: [0.42, 0.36, 1], translation: [0, 0.012, 0] },
    attentionBlueLeft: visible, attentionBlueMain: visible, attentionBlueRight: visible,
  },
  uneven: {
    eyeLeft: hidden, eyeRight: hidden,
    eyeLeftUneven: { scale: [1.52, 1.18, 1], translation: [0, 0, 0.012] },
    eyeRightUneven: { scale: [0.96, 0.61, 1], translation: [0, -0.028, 0.012] },
    mouth: { scale: [0.64, 0.68, 1] },
  },
} satisfies Record<string, Record<string, AssistantTransform>>;

export const assistantTapExpression = {
  ...assistantExpressions.uneven,
  ...angerMarks,
  mouth: hidden,
  worriedMouth: visible,
} satisfies Record<string, AssistantTransform>;

export type AssistantExpressionPreset = keyof typeof assistantExpressions;

type LegSway = {
  amplitude: number;
  periodMs: number;
};

const legSway = {
  laugh: { amplitude: 0.14, periodMs: 1250 },
  wink: { amplitude: 0.12, periodMs: 1600 },
  surprise: { amplitude: 0.15, periodMs: 1350 },
  teary: { amplitude: 0.095, periodMs: 1550 },
  grumpy: { amplitude: 0.13, periodMs: 1450 },
  sleepy: { amplitude: 0.065, periodMs: 2600 },
  puzzled: { amplitude: 0.10, periodMs: 1850 },
  love: { amplitude: 0.11, periodMs: 1950 },
  excited: { amplitude: 0.16, periodMs: 1100 },
  listening: { amplitude: 0.08, periodMs: 2300 },
  uneven: { amplitude: 0.12, periodMs: 1750 },
  held: { amplitude: 0.175, periodMs: 1500 },
} satisfies Record<AssistantExpressionPreset | 'held', LegSway>;

// The browser iframe and native WebView both sample the leg motion against the
// same elapsed time and blend as the face.
export const assistantExpressionLegMotionSource = `
const expressionLegSway = ${JSON.stringify(legSway)};
function applyAssistantExpressionLegMotion(transform, leg, expression, elapsedMs, weight) {
  const index = legs.indexOf(leg);
  const sway = expressionLegSway[expression];
  if (index < 0 || !sway || !weight) return transform;

  // Let adjacent feet follow closely, with the inner ones swinging a little less.
  // Rotate only around the depth axis so the roots never bob or kick forwards.
  const phase = 2 * Math.PI * elapsedMs / sway.periodMs - (index - 1.5) * 0.20;
  const strength = index === 0 || index === legs.length - 1 ? 1 : 0.76;
  const easeIn = Math.min(1, elapsedMs / 240);
  const angle = Math.sin(phase) * sway.amplitude * weight * easeIn * strength;
  const [pitch, yaw, roll] = transform.rotation || [0, 0, 0];
  return { ...transform, rotation: [pitch, yaw, roll + angle] };
}
`;

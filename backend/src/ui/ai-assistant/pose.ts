import type { Vec3 } from './model';
import { assistantExpressions, type AssistantExpressionPreset } from './expressions';

/** Local offsets from the modeled rest pose. XYZ rotations are in radians. */
export type AssistantTransform = {
  translation?: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
};

export const assistantLegs = ['legOuterLeft', 'legInnerLeft', 'legInnerRight', 'legOuterRight'] as const;
export type AssistantLeg = typeof assistantLegs[number];

/** Left and right refer to the front view. Blink runs from open (0) to closed (1). */
export type AssistantExpression = {
  preset?: AssistantExpressionPreset;
  blinkLeft?: number;
  blinkRight?: number;
  /** 0 relaxes the mouth, 1 gives the reference smile. */
  smile?: number;
};

export type AssistantPose = {
  head?: AssistantTransform;
  headphones?: AssistantTransform;
  legs?: Partial<Record<AssistantLeg, AssistantTransform>>;
  expression?: AssistantExpression;
};

function weight(value: number | undefined, rest: number) {
  if (value === undefined || !Number.isFinite(value)) return rest;
  return Math.max(0, Math.min(1, value));
}

export function resolveAssistantPose(pose?: AssistantPose): Record<string, AssistantTransform> {
  if (!pose) return {};
  const preset = pose.expression?.preset;
  const transforms: Record<string, AssistantTransform> = preset ? { ...assistantExpressions[preset] } : {};
  if (pose.head) transforms.head = pose.head;
  if (pose.headphones) transforms.headphones = pose.headphones;
  for (const id of assistantLegs) {
    const transform = pose.legs?.[id];
    if (transform) transforms[id] = transform;
  }

  for (const side of ['Left', 'Right'] as const) {
    const blink = weight(pose.expression?.[`blink${side}`], 0);
    if (!blink) continue;
    const eye = `eye${side}`;
    const [width, height, depth] = transforms[eye]?.scale ?? [1, 1, 1];
    transforms[eye] = { ...transforms[eye], scale: [width * (1 + 0.04 * blink), height * (1 - 0.91 * blink), depth] };
    // Tuck the two reflections into the eye as the lid closes.
    const glint = Math.min(1, (1 - blink) * 2.5);
    for (const suffix of ['Glint', 'Spark']) {
      const key = eye + suffix;
      const [x, y, z] = transforms[key]?.translation ?? [0, 0, 0];
      const [w, h, d] = transforms[key]?.scale ?? [1, 1, 1];
      const shrink = Math.max(0.01, glint);
      transforms[key] = { ...transforms[key], translation: [x, y, z - 0.012 * (1 - glint)], scale: [w * shrink, h * shrink, d] };
    }
  }
  const smile = weight(pose.expression?.smile, 1);
  if (smile < 1) {
    const [width, height, depth] = transforms.mouth?.scale ?? [1, 1, 1];
    transforms.mouth = { ...transforms.mouth, scale: [width, height * (0.38 + 0.62 * smile), depth] };
  }
  return transforms;
}

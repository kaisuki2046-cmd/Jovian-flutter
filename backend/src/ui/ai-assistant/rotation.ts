export type AssistantRotation = { yaw: number; pitch: number };
export type RotationAction = 'left' | 'right' | 'up' | 'down' | 'reset';

export const frontView: AssistantRotation = { yaw: 0, pitch: 0 };
const degree = Math.PI / 180;
const upLimit = -10 * degree;
const downLimit = 60 * degree;
const narrowFrom = 15 * degree;

// At the full downward tilt the reference still shows both eyes near the bottom.
// Preserve the side views around neutral, then narrow the horizontal arc as the head lowers.
export function assistantYawLimits(pitch: number) {
  const fraction = Math.min(1, Math.max(0, (pitch - narrowFrom) / (downLimit - narrowFrom)));
  return { min: (-17 + 14 * fraction) * degree, max: (25 - 22 * fraction) * degree };
}

function rotate(current: AssistantRotation, horizontal: number, vertical: number): AssistantRotation {
  const pitch = Math.max(upLimit, Math.min(downLimit, current.pitch + vertical));
  const { min, max } = assistantYawLimits(pitch);
  const yaw = Math.max(min, Math.min(max, current.yaw + horizontal));
  if (yaw === current.yaw && pitch === current.pitch) return current;
  return { yaw, pitch };
}

export function dragAssistant(current: AssistantRotation, dx: number, dy: number, size: number) {
  if (size <= 0 || (dx === 0 && dy === 0)) return current;
  const radiansPerPoint = Math.PI / size;
  return rotate(current, dx * radiansPerPoint, dy * radiansPerPoint);
}

export function stepAssistant(current: AssistantRotation, action: RotationAction) {
  const step = 5 * degree;
  switch (action) {
    case 'left': return rotate(current, -step, 0);
    case 'right': return rotate(current, step, 0);
    case 'up': return rotate(current, 0, -step);
    case 'down': return rotate(current, 0, step);
    case 'reset': return frontView;
  }
}

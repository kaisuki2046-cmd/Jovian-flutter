export const assistantIntroDurationMs = 4000;

// Ship JavaScript source to both scene runtimes. Native builds can compile
// React Native functions to Hermes bytecode, whose source is unavailable.
export const assistantIdleMotionSource = `
function sampleAssistantSwim(idleMs, peek) {
  // Swim left, then right, and settle in the middle before the next trip.
  const cycleMs = idleMs % 9400;
  const strokeProgress = Math.max(0, Math.min(1, (cycleMs - 850) / 5200));
  const stroke = -Math.sin(strokeProgress * Math.PI * 2) * Math.sin(strokeProgress * Math.PI);
  const centered = 1 - Math.abs(peek);
  return {
    x: .115 * stroke * centered + .072 * peek * stroke * stroke,
    yaw: .115 * stroke * centered + .42 * peek,
    roll: -.085 * peek + .026 * stroke * centered,
  };
}

function sampleAssistantIdleMotion(elapsedMs, playIntro = true) {
  const introLength = ${assistantIntroDurationMs};
  const phaseMs = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0);
  const idleMs = Math.max(0, phaseMs - (playIntro ? introLength : 0));
  const intro = playIntro && phaseMs < introLength;

  function ease(from, to, value) {
    const progress = Math.max(0, Math.min(1, (value - from) / (to - from)));
    return progress * progress * (3 - 2 * progress);
  }

  if (!intro) {
    const envelope = ease(0, 1000, idleMs);
    return {
      intro, idleMs,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
      offsetY: Math.sin(idleMs * Math.PI * 2 / 5500) * 0.021 * envelope,
      roll: Math.sin(idleMs * Math.PI * 2 / 8200) * 0.017 * envelope,
    };
  }

  // The base stays planted. First the wide mound gathers inward, then it rises.
  const gather = ease(0, 1040, phaseMs);
  const rise = ease(920, 1720, phaseMs);
  const flattened = 1 - rise;
  const settle = ease(1420, 1660, phaseMs) * (1 - ease(1660, 1990, phaseMs));
  const scaleY = 1 - flattened * (0.48 - 0.055 * gather) + settle * 0.012;
  const breath = ease(1720, 2080, phaseMs) * (1 - ease(3590, introLength, phaseMs));
  const feetProgress = ease(2790, 3750, phaseMs);
  // Both eyes open from a slit, blink once, glance left, linger right, then center.
  // The mouth, earcups and silhouette stay in place during the glances.
  const blink = ease(1840, 1920, phaseMs) * (1 - ease(1940, 2010, phaseMs));
  const eyeOpen = (0.12 + 0.88 * ease(1610, 1790, phaseMs)) * (1 - 0.90 * blink);
  const glance = -ease(2030, 2160, phaseMs) + 2 * ease(2260, 2460, phaseMs)
    - ease(2580, 2720, phaseMs);

  return {
    intro, idleMs,
    scaleX: 1 + flattened * (0.17 - 0.15 * gather) - settle * 0.008,
    scaleY,
    scaleZ: 1 + flattened * 0.08,
    offsetY: (scaleY - 1) * 0.795 - (1 - feetProgress) * 0.071
      + breath * Math.sin((phaseMs - 1720) * Math.PI * 2 / 4400) * 0.008,
    roll: Math.sin((phaseMs - 1720) * Math.PI * 2 / 6000) * breath * 0.004,
    ripple: 0.070 * flattened,
    ripplePhase: 0.82 + 0.20 * Math.sin(phaseMs * Math.PI * 2 / 6000),
    bandOpacity: ease(1210, 1490, phaseMs),
    cupOpacity: ease(1370, 1600, phaseMs),
    faceOpacity: ease(1520, 1740, phaseMs),
    eyeOpen, glance,
    feetProgress,
  };
}
`;

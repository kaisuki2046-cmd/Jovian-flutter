export const assistantExpressionIntervalMs = 15000;

// The same sampler runs inside both the browser iframe and native WebView.
export const assistantIdleExpressionSource = `
function createAssistantIdleExpressionSampler(expressions, random = Math.random) {
  const interval = ${assistantExpressionIntervalMs};
  const duration = 5500;
  let lastTick = 0;
  let selected;
  const neutral = { weight: 0 };

  return function sampleExpression(motion) {
    if (!motion || motion.intro || !expressions.length) return neutral;
    const tick = Math.floor(motion.idleMs / interval);
    const elapsedMs = motion.idleMs % interval;
    if (!tick || elapsedMs >= duration) return neutral;
    if (tick !== lastTick) {
      const choices = expressions.length > 1 ? expressions.filter(expression => expression !== selected) : expressions;
      selected = choices[Math.floor(random() * choices.length)];
      lastTick = tick;
    }
    const [name, target] = selected;
    const ramp = Math.min(1, elapsedMs / 470, (duration - elapsedMs) / 650);
    const weight = ramp * ramp * (3 - 2 * ramp);
    return { name, target, weight, elapsedMs };
  };
}
`;

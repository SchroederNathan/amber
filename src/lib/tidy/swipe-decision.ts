export type TidyAction = 'keep' | 'delete' | 'save';

// Animate Expo's momentum projection, in points (velocity is points/second).
function project(velocity: number) {
  'worklet';
  const decelerationRate = 0.998;
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

export function swipeDecision(
  x: number,
  y: number,
  velocityX: number,
  velocityY: number,
  thresholdX: number,
  thresholdY: number,
): TidyAction | null {
  'worklet';
  const projectedX = x + project(velocityX);
  const projectedY = y + project(velocityY);
  const horizontal = Math.abs(projectedX) / thresholdX;
  const upward = -projectedY / thresholdY;
  if (upward > 1 && upward > horizontal) return 'save';
  if (horizontal > 1 && horizontal >= upward) return projectedX >= 0 ? 'keep' : 'delete';
  return null;
}

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { swipeDecision } from '../src/lib/tidy/swipe-decision.ts';

const decide = (x, y, vx = 0, vy = 0) => swipeDecision(x, y, vx, vy, 100, 160);

test('small drags and downward swipes return to the deck', () => {
  assert.equal(decide(40, -30), null);
  assert.equal(decide(0, 240, 0, 600), null);
  assert.equal(decide(100, 0), null);
});

test('slow drags commit at their directional distance thresholds', () => {
  assert.equal(decide(101, 0), 'keep');
  assert.equal(decide(-101, 0), 'delete');
  assert.equal(decide(0, -161), 'save');
});

test('short flicks carry release velocity in all supported directions', () => {
  assert.equal(decide(20, 0, 500), 'keep');
  assert.equal(decide(-20, 0, -500), 'delete');
  assert.equal(decide(0, -20, 0, -500), 'save');
});

test('reversing a drag before release can cancel the decision', () => {
  assert.equal(decide(120, 0, -150), null);
});

test('diagonal gestures choose the axis furthest past its own threshold', () => {
  assert.equal(decide(150, -180), 'keep');
  assert.equal(decide(110, -240), 'save');
});

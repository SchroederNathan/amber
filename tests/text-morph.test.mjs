import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { layoutMorphText, reconcileMorphCells, pruneMorphCells, MAX_MORPH_GLYPHS } from '../src/lib/text-morph.ts';

const layout = (text) => layoutMorphText(text, 240, 32, () => 10);
const transition = (previous, text, now) => reconcileMorphCells(previous, layout(text), now, 240, 25);

test('the initial scene is visible; only newly added glyphs receive an entrance', () => {
  const initial = layout('abc');
  assert.ok(initial.every((cell) => !cell.animateIn));
  const unchanged = transition(initial, 'abc', 0);
  assert.ok(unchanged.every((cell) => !cell.animateIn));
  const changed = transition(unchanged, 'bcd', 100);
  assert.equal(changed.find((cell) => cell.char === 'd').animateIn, true);
  assert.equal(changed.find((cell) => cell.char === 'b').animateIn, false);
  const returned = transition(changed, 'abc', 150);
  assert.equal(returned.find((cell) => cell.char === 'a').animateIn, false);
});

test('long titles fit the slot, retain stable letter identities and bound measurement work', () => {
  let measured = 0;
  const cells = layoutMorphText('a'.repeat(100_000), 240, 32, () => { measured++; return 10; });
  assert.equal(cells.length, 24);
  assert.equal(cells.at(-1).char, '…');
  assert.equal(cells[0].key, layout('a')[0].key);
  assert.ok(cells.at(-1).x + cells.at(-1).width <= 272);
  assert.ok(measured <= MAX_MORPH_GLYPHS + 2);
  assert.ok(layoutMorphText('\u200b'.repeat(100_000), 240, 0, () => 0).length <= MAX_MORPH_GLYPHS);
});

test('rapid changes replace unfinished fragments with a visible current title', () => {
  const unfinished = transition(layout('abc'), 'bcd', 0);
  const interrupted = reconcileMorphCells(unfinished, layout('def'), 100, 240, 25, true);
  assert.equal(interrupted.map((cell) => cell.char).join(''), 'def');
  assert.ok(interrupted.every((cell) => cell.phase === 'present' && !cell.animateIn));
  assert.deepEqual(pruneMorphCells(interrupted, 10_000), interrupted);

  // A later, ordinary transition still gets the full morph.
  const next = transition(interrupted, 'efg', 2_000);
  assert.equal(next.find((cell) => cell.char === 'g').animateIn, true);
  assert.equal(next.find((cell) => cell.char === 'd').phase, 'exit');
});

test('narrow slots do not render overflowing ellipses or split surrogate pairs', () => {
  assert.deepEqual(layoutMorphText('abc', 5, 0, () => 10), []);
  assert.deepEqual(layoutMorphText('abc', 0, 0, () => 10), []);
  assert.equal(layout('😀a')[0].char, '😀');
});

test('an interrupted exit can return and exit again without stale cleanup deleting it', () => {
  const firstExit = transition(layout('a'), 'b', 0);
  const returned = transition(firstExit, 'a', 100);
  assert.equal(returned.find((cell) => cell.char === 'a').phase, 'present');
  const secondExit = transition(returned, 'b', 150);
  assert.equal(secondExit.find((cell) => cell.char === 'a').exitAt, 390);
  assert.ok(pruneMorphCells(secondExit, 240).some((cell) => cell.char === 'a'));
  assert.deepEqual(pruneMorphCells(secondExit, 500).map((cell) => cell.char), ['b']);
});

test('successive transitions preserve exit deadlines and prune expired letters together', () => {
  const exited = transition(layout('ab'), 'c', 0);
  const interrupted = transition(exited, 'd', 100);
  assert.equal(interrupted.find((cell) => cell.char === 'b').exitAt, 265);
  assert.deepEqual(transition(interrupted, 'e', 400).map((cell) => cell.char), ['e', 'd']);
  assert.deepEqual(pruneMorphCells(interrupted, 400).map((cell) => cell.char), ['d']);
});

test('thousands of rapid title changes cannot accumulate an unbounded retiring scene', () => {
  let cells = [];
  for (let i = 0; i < 2_000; i++) {
    const title = String.fromCodePoint(0x400 + i).repeat(40);
    cells = transition(cells, title, i);
    assert.ok(cells.length <= MAX_MORPH_GLYPHS * 2);
    assert.equal(new Set(cells.map((cell) => cell.key)).size, cells.length);
  }
  assert.ok(pruneMorphCells(cells, 10_000).every((cell) => cell.phase === 'present'));
});

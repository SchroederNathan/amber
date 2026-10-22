import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { appIntentContent } from '../src/lib/app-intent-content.ts';

test('Siri receives recipe ingredients beyond the old note/catalog and classifier limits', () => {
  const content = `${'Recipe introduction. '.repeat(500)}\nIngredients\n2 eggs\n1 slice toast\n1 tsp chili crunch`;
  const result = appIntentContent({ content });
  assert.equal(result, content);
  assert.ok(result.includes('2 eggs\n1 slice toast\n1 tsp chili crunch'));
});

test('keeps personal notes alongside article text and does not repeat identical text', () => {
  assert.equal(appIntentContent({ note: 'Use less salt', content: '2 eggs' }), 'Use less salt\n\n2 eggs');
  assert.equal(appIntentContent({ note: ' 2 eggs ', content: '2 eggs' }), '2 eggs');
});

test('missing source content stays missing instead of manufacturing recipe details', () => {
  assert.equal(appIntentContent({}), undefined);
  assert.equal(appIntentContent({ note: '  ', content: '' }), undefined);
});

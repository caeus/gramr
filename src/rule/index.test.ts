import { $ } from 'gramr-ts/pipe';
import { expect, suite, test } from 'vitest';

suite('fork', () => {
  test('succeeds', () => {});
});

test('lift', () => {
  expect($(4).$).toEqual(4);
});

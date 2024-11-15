import { test, suite, expect } from 'vitest';
import { $ } from '@/core';

suite('fork', () => {
  test('succeeds', () => {});
});

test('lift', () => {
  expect($(4).$).toEqual(4);
});

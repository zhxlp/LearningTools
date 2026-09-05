import { DEFAULT_MATH_SETTINGS, DEFAULT_PARENTAL_GATE_SETTINGS, isOpType, digitRangeOf, OP_SYMBOLS } from '../lib/math-types';

test('default math settings match spec', () => {
  expect(DEFAULT_MATH_SETTINGS.enabledOps).toEqual(['+', '-']);
  expect(DEFAULT_MATH_SETTINGS.difficulty['+']).toEqual({ minDigits: 1, maxDigits: 2 });
  expect(DEFAULT_MATH_SETTINGS.wrongAnswerMode).toBe('retry');
  expect(DEFAULT_MATH_SETTINGS.columnarStyle).toEqual({ digitSize: 44, rowGap: 20, colGap: 6 });
});

test('default parental gate settings match spec', () => {
  expect(DEFAULT_PARENTAL_GATE_SETTINGS.enabledOps).toEqual(['+', '-']);
  expect(DEFAULT_PARENTAL_GATE_SETTINGS.digits).toEqual({ min: 4, max: 4 });
  expect(DEFAULT_PARENTAL_GATE_SETTINGS.wrongAnswerMode).toBe('new');
});

test('guards and helpers', () => {
  expect(isOpType('+')).toBe(true);
  expect(isOpType('%')).toBe(false);
  expect(OP_SYMBOLS['*']).toBe('×');
  expect(digitRangeOf(1)).toEqual([1, 9]);
  expect(digitRangeOf(2)).toEqual([10, 99]);
  expect(digitRangeOf(4)).toEqual([1000, 9999]);
});

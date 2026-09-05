import AsyncStorage from '@react-native-async-storage/async-storage';
import { MathSettings, ALL_OPS } from '../lib/math-types';
import { MATH_SETTINGS_KEY, sanitizeMathSettings, loadMathSettings, saveMathSettings } from '../lib/math-settings';

const fullDefaults = (): MathSettings => ({
  enabledOps: ['+', '-'],
  difficulty: {
    '+': { minDigits: 1, maxDigits: 2 },
    '-': { minDigits: 1, maxDigits: 2 },
    '*': { minDigits: 1, maxDigits: 2 },
    '÷': { minDigits: 1, maxDigits: 2 },
  },
  wrongAnswerMode: 'retry',
  columnarStyle: { digitSize: 44, rowGap: 20, colGap: 6 },
});

beforeEach(async () => {
  await AsyncStorage.clear();
});

test('empty/undefined input returns full defaults', () => {
  expect(sanitizeMathSettings(undefined)).toEqual(fullDefaults());
  expect(sanitizeMathSettings(null)).toEqual(fullDefaults());
  expect(sanitizeMathSettings({})).toEqual(fullDefaults());
  expect(sanitizeMathSettings('junk')).toEqual(fullDefaults());
});

test('partial object merges: custom + difficulty keeps other ops at defaults', () => {
  const s = sanitizeMathSettings({ difficulty: { '+': { minDigits: 3, maxDigits: 4 } } });
  expect(s.difficulty['+']).toEqual({ minDigits: 3, maxDigits: 4 });
  expect(s.difficulty['-']).toEqual({ minDigits: 1, maxDigits: 2 });
  expect(s.difficulty['*']).toEqual({ minDigits: 1, maxDigits: 2 });
  expect(s.difficulty['÷']).toEqual({ minDigits: 1, maxDigits: 2 });
  expect(s.enabledOps).toEqual(['+', '-']);
  expect(s.wrongAnswerMode).toBe('retry');
  expect(s.columnarStyle).toEqual({ digitSize: 44, rowGap: 20, colGap: 6 });
});

test('custom settings for every field are respected', () => {
  const s = sanitizeMathSettings({
    enabledOps: ALL_OPS,
    difficulty: { '+': { minDigits: 2, maxDigits: 3 }, '-': { minDigits: 1, maxDigits: 4 } },
    wrongAnswerMode: 'new',
    columnarStyle: { digitSize: 60, rowGap: 30, colGap: 10 },
  });
  expect(s.enabledOps).toEqual(['+', '-', '*', '÷']);
  expect(s.difficulty['+']).toEqual({ minDigits: 2, maxDigits: 3 });
  expect(s.difficulty['-']).toEqual({ minDigits: 1, maxDigits: 4 });
  expect(s.wrongAnswerMode).toBe('new');
  expect(s.columnarStyle).toEqual({ digitSize: 60, rowGap: 30, colGap: 10 });
});

test('enabledOps strips unknown ops and de-duplicates', () => {
  expect(sanitizeMathSettings({ enabledOps: ['+', '%', '-', 'x', '+'] }).enabledOps).toEqual(['+', '-']);
});

test('enabledOps empty/non-array/only-invalid falls back to default', () => {
  expect(sanitizeMathSettings({ enabledOps: [] }).enabledOps).toEqual(['+', '-']);
  expect(sanitizeMathSettings({ enabledOps: ['%', 'x'] }).enabledOps).toEqual(['+', '-']);
  expect(sanitizeMathSettings({ enabledOps: '+-' }).enabledOps).toEqual(['+', '-']);
});

test('wrongAnswerMode keeps only new|retry', () => {
  expect(sanitizeMathSettings({ wrongAnswerMode: 'new' }).wrongAnswerMode).toBe('new');
  expect(sanitizeMathSettings({ wrongAnswerMode: 'retry' }).wrongAnswerMode).toBe('retry');
  expect(sanitizeMathSettings({ wrongAnswerMode: 'alwaysNew' }).wrongAnswerMode).toBe('retry');
  expect(sanitizeMathSettings({ wrongAnswerMode: 42 }).wrongAnswerMode).toBe('retry');
});

test('columnarStyle needs all three numeric fields else defaults', () => {
  expect(sanitizeMathSettings({ columnarStyle: { digitSize: 22, rowGap: 10, colGap: 3 } }).columnarStyle)
    .toEqual({ digitSize: 22, rowGap: 10, colGap: 3 });
  expect(sanitizeMathSettings({ columnarStyle: { digitSize: 50 } }).columnarStyle)
    .toEqual({ digitSize: 44, rowGap: 20, colGap: 6 });
  expect(sanitizeMathSettings({ columnarStyle: { digitSize: 'big', rowGap: 10, colGap: 3 } }).columnarStyle)
    .toEqual({ digitSize: 44, rowGap: 20, colGap: 6 });
  expect(sanitizeMathSettings({ columnarStyle: null }).columnarStyle)
    .toEqual({ digitSize: 44, rowGap: 20, colGap: 6 });
});

test('difficulty digits are clamped to 1..4', () => {
  const s = sanitizeMathSettings({ difficulty: { '+': { minDigits: 0, maxDigits: 9 } } });
  expect(s.difficulty['+']).toEqual({ minDigits: 1, maxDigits: 4 });
  expect(s.difficulty['-']).toEqual({ minDigits: 1, maxDigits: 2 });
});

test('difficulty min>max is swapped after clamping', () => {
  const s = sanitizeMathSettings({ difficulty: { '-': { minDigits: 4, maxDigits: 2 } } });
  expect(s.difficulty['-']).toEqual({ minDigits: 2, maxDigits: 4 });

  const s2 = sanitizeMathSettings({ difficulty: { '*': { minDigits: 9, maxDigits: 2 } } });
  expect(s2.difficulty['*']).toEqual({ minDigits: 2, maxDigits: 4 });
});

test('malformed difficulty entries fall back to per-op default', () => {
  const s = sanitizeMathSettings({
    difficulty: {
      '+': 'easy',
      '-': { minDigits: 3 },
      '*': 5,
      '÷': { minDigits: 2, maxDigits: 'x' },
    },
  });
  expect(s.difficulty['+']).toEqual({ minDigits: 1, maxDigits: 2 });
  expect(s.difficulty['-']).toEqual({ minDigits: 1, maxDigits: 2 });
  expect(s.difficulty['*']).toEqual({ minDigits: 1, maxDigits: 2 });
  expect(s.difficulty['÷']).toEqual({ minDigits: 1, maxDigits: 2 });
});

test('unknown keys are ignored', () => {
  const s = sanitizeMathSettings({
    enabledOps: ['*'],
    difficulty: { '+': { minDigits: 2, maxDigits: 3 } },
    secret: 'x',
    helper: { minDigits: 9, maxDigits: 9 },
  });
  expect(s.enabledOps).toEqual(['*']);
  expect(s).not.toHaveProperty('secret');
  expect(s).not.toHaveProperty('helper');
});

test('sanitize returns independent copies (no shared mutation)', () => {
  const a = sanitizeMathSettings(undefined);
  const b = sanitizeMathSettings(undefined);
  a.difficulty['+'].minDigits = 99;
  a.enabledOps.push('*');
  expect(b.difficulty['+']).toEqual({ minDigits: 1, maxDigits: 2 });
  expect(b.enabledOps).toEqual(['+', '-']);
});

test('load returns defaults when nothing stored', async () => {
  expect(await loadMathSettings()).toEqual(fullDefaults());
});

test('load parses and sanitizes stored JSON', async () => {
  await AsyncStorage.setItem(
    MATH_SETTINGS_KEY,
    JSON.stringify({
      enabledOps: ['+', '÷', '%'],
      difficulty: { '+': { minDigits: 5, maxDigits: 1 } },
    })
  );
  const s = await loadMathSettings();
  expect(s.enabledOps).toEqual(['+', '÷']);
  expect(s.difficulty['+']).toEqual({ minDigits: 1, maxDigits: 4 });
  expect(s.difficulty['-']).toEqual({ minDigits: 1, maxDigits: 2 });
  expect(s.wrongAnswerMode).toBe('retry');
});

test('load falls back to defaults on corrupt stored value', async () => {
  await AsyncStorage.setItem(MATH_SETTINGS_KEY, '{not json');
  expect(await loadMathSettings()).toEqual(fullDefaults());
});

test('load falls back to defaults on non-object stored value', async () => {
  await AsyncStorage.setItem(MATH_SETTINGS_KEY, '"just a string"');
  expect(await loadMathSettings()).toEqual(fullDefaults());
});

test('save persists sanitized settings as JSON', async () => {
  const junk = {
    enabledOps: ['+', '-', '%'],
    difficulty: { '+': { minDigits: 9, maxDigits: 0 } },
    wrongAnswerMode: 'retry',
    columnarStyle: { digitSize: 44, rowGap: 20, colGap: 6 },
  };
  await saveMathSettings(sanitizeMathSettings(junk) as MathSettings);
  const stored = await AsyncStorage.getItem(MATH_SETTINGS_KEY);
  const parsed = JSON.parse(stored as string);
  expect(parsed.enabledOps).toEqual(['+', '-']);
  expect(parsed.difficulty['+']).toEqual({ minDigits: 1, maxDigits: 4 });
  expect(parsed.difficulty['-']).toEqual({ minDigits: 1, maxDigits: 2 });
});

test('save then load round-trips sanitized settings', async () => {
  const wanted: MathSettings = fullDefaults();
  wanted.enabledOps = ['*', '+'];
  wanted.difficulty['+'] = { minDigits: 2, maxDigits: 3 };
  wanted.wrongAnswerMode = 'new';
  await saveMathSettings(wanted);
  expect(await loadMathSettings()).toEqual({
    ...wanted,
    enabledOps: ['*', '+'],
    difficulty: {
      '+': { minDigits: 2, maxDigits: 3 },
      '-': { minDigits: 1, maxDigits: 2 },
      '*': { minDigits: 1, maxDigits: 2 },
      '÷': { minDigits: 1, maxDigits: 2 },
    },
  });
});

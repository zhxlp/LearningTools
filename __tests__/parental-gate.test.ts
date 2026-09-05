import AsyncStorage from '@react-native-async-storage/async-storage';
import { ALL_OPS, ParentalGateSettings } from '../lib/math-types';
import {
  PARENTAL_GATE_KEY,
  sanitizeParentalGateSettings,
  loadParentalGateSettings,
  saveParentalGateSettings,
  generateGateQuestion,
} from '../lib/parental-gate';

const fullDefaults = (): ParentalGateSettings => ({
  enabledOps: ['+', '-'],
  digits: { min: 4, max: 4 },
  wrongAnswerMode: 'new',
});

beforeEach(async () => {
  await AsyncStorage.clear();
});

test('empty/undefined input returns full defaults', () => {
  expect(sanitizeParentalGateSettings(undefined)).toEqual(fullDefaults());
  expect(sanitizeParentalGateSettings(null)).toEqual(fullDefaults());
  expect(sanitizeParentalGateSettings({})).toEqual(fullDefaults());
  expect(sanitizeParentalGateSettings('junk')).toEqual(fullDefaults());
});

test('custom settings for every field are respected', () => {
  const s = sanitizeParentalGateSettings({
    enabledOps: ['*', '÷'],
    digits: { min: 2, max: 3 },
    wrongAnswerMode: 'retry',
  });
  expect(s.enabledOps).toEqual(['*', '÷']);
  expect(s.digits).toEqual({ min: 2, max: 3 });
  expect(s.wrongAnswerMode).toBe('retry');
});

test('enabledOps strips unknown ops and de-duplicates', () => {
  expect(sanitizeParentalGateSettings({ enabledOps: ['+', '%', '-', 'x', '+'] }).enabledOps)
    .toEqual(['+', '-']);
  expect(sanitizeParentalGateSettings({ enabledOps: ALL_OPS }).enabledOps).toEqual(ALL_OPS);
});

test('enabledOps empty/non-array/only-invalid falls back to default', () => {
  expect(sanitizeParentalGateSettings({ enabledOps: [] }).enabledOps).toEqual(['+', '-']);
  expect(sanitizeParentalGateSettings({ enabledOps: ['%', 'x'] }).enabledOps).toEqual(['+', '-']);
  expect(sanitizeParentalGateSettings({ enabledOps: '+-' }).enabledOps).toEqual(['+', '-']);
});

test('digits are clamped to 1..4', () => {
  expect(sanitizeParentalGateSettings({ digits: { min: 0, max: 9 } }).digits)
    .toEqual({ min: 1, max: 4 });
  expect(sanitizeParentalGateSettings({ digits: { min: 5, max: 3 } }).digits)
    .toEqual({ min: 3, max: 4 });
});

test('digits min>max is swapped after clamping', () => {
  expect(sanitizeParentalGateSettings({ digits: { min: 4, max: 2 } }).digits)
    .toEqual({ min: 2, max: 4 });
  expect(sanitizeParentalGateSettings({ digits: { min: 9, max: 1 } }).digits)
    .toEqual({ min: 1, max: 4 });
});

test('malformed digits fall back to default 4..4', () => {
  expect(sanitizeParentalGateSettings({ digits: 'big' }).digits).toEqual({ min: 4, max: 4 });
  expect(sanitizeParentalGateSettings({ digits: null }).digits).toEqual({ min: 4, max: 4 });
  expect(sanitizeParentalGateSettings({ digits: { min: 3 } }).digits).toEqual({ min: 4, max: 4 });
  expect(sanitizeParentalGateSettings({ digits: { min: 'x', max: 2 } }).digits).toEqual({ min: 4, max: 4 });
});

test('wrongAnswerMode keeps only new|retry else default new', () => {
  expect(sanitizeParentalGateSettings({ wrongAnswerMode: 'new' }).wrongAnswerMode).toBe('new');
  expect(sanitizeParentalGateSettings({ wrongAnswerMode: 'retry' }).wrongAnswerMode).toBe('retry');
  expect(sanitizeParentalGateSettings({ wrongAnswerMode: 'alwaysNew' }).wrongAnswerMode).toBe('new');
  expect(sanitizeParentalGateSettings({ wrongAnswerMode: 42 }).wrongAnswerMode).toBe('new');
});

test('unknown keys are ignored', () => {
  const s = sanitizeParentalGateSettings({
    enabledOps: ['*'],
    digits: { min: 1, max: 2 },
    secret: 'x',
    helper: { min: 9, max: 9 },
  });
  expect(s.enabledOps).toEqual(['*']);
  expect(s).not.toHaveProperty('secret');
  expect(s).not.toHaveProperty('helper');
});

test('sanitize returns independent copies (no shared mutation)', () => {
  const a = sanitizeParentalGateSettings(undefined);
  const b = sanitizeParentalGateSettings(undefined);
  a.digits.min = 1;
  a.enabledOps.push('*');
  expect(b.digits).toEqual({ min: 4, max: 4 });
  expect(b.enabledOps).toEqual(['+', '-']);
});

test('load returns defaults when nothing stored', async () => {
  expect(await loadParentalGateSettings()).toEqual(fullDefaults());
});

test('load parses and sanitizes stored JSON', async () => {
  await AsyncStorage.setItem(
    PARENTAL_GATE_KEY,
    JSON.stringify({ enabledOps: ['+', '÷', '%'], digits: { min: 2, max: 5 } })
  );
  const s = await loadParentalGateSettings();
  expect(s.enabledOps).toEqual(['+', '÷']);
  expect(s.digits).toEqual({ min: 2, max: 4 });
  expect(s.wrongAnswerMode).toBe('new');
});

test('load falls back to defaults on corrupt stored value', async () => {
  await AsyncStorage.setItem(PARENTAL_GATE_KEY, '{not json');
  expect(await loadParentalGateSettings()).toEqual(fullDefaults());
});

test('load falls back to defaults on non-object stored value', async () => {
  await AsyncStorage.setItem(PARENTAL_GATE_KEY, '"just a string"');
  expect(await loadParentalGateSettings()).toEqual(fullDefaults());
});

test('save persists sanitized settings as JSON', async () => {
  await saveParentalGateSettings({
    enabledOps: ['+', '-', '%'],
    digits: { min: 9, max: 0 },
    wrongAnswerMode: 'retry',
  } as ParentalGateSettings);
  const stored = await AsyncStorage.getItem(PARENTAL_GATE_KEY);
  const parsed = JSON.parse(stored as string);
  expect(parsed.enabledOps).toEqual(['+', '-']);
  expect(parsed.digits).toEqual({ min: 1, max: 4 });
  expect(parsed.wrongAnswerMode).toBe('retry');
});

test('save then load round-trips sanitized settings', async () => {
  await saveParentalGateSettings({
    enabledOps: ['÷', '+'],
    digits: { min: 2, max: 3 },
    wrongAnswerMode: 'retry',
  });
  expect(await loadParentalGateSettings()).toEqual({
    enabledOps: ['÷', '+'],
    digits: { min: 2, max: 3 },
    wrongAnswerMode: 'retry',
  });
});

test('generateGateQuestion uses only enabled ops', () => {
  for (let i = 0; i < 50; i++) {
    const q = generateGateQuestion({ ...fullDefaults(), enabledOps: ['*', '÷'] });
    expect(['*', '÷']).toContain(q.op);
  }
});

test('generateGateQuestion respects digit range from settings', () => {
  for (let i = 0; i < 100; i++) {
    const q = generateGateQuestion({ ...fullDefaults(), enabledOps: ['+'], digits: { min: 2, max: 2 } });
    expect(String(q.a)).toMatch(/^\d{2}$/);
    expect(String(q.b)).toMatch(/^\d{2}$/);
    expect(q.a).toBeGreaterThanOrEqual(10);
    expect(q.a).toBeLessThanOrEqual(99);
    expect(q.b).toBeGreaterThanOrEqual(10);
    expect(q.b).toBeLessThanOrEqual(99);
  }
});

test('generateGateQuestion default settings produce 4-digit operands and a valid question', () => {
  const q = generateGateQuestion(fullDefaults());
  expect(['+', '-']).toContain(q.op);
  expect(String(q.a)).toMatch(/^\d{4}$/);
  expect(String(q.b)).toMatch(/^\d{4}$/);
  expect(q.expr).toBe(`${q.a} ${q.op === '+' ? '+' : '-'} ${q.b}`);
  expect(q.result).toBe(q.op === '+' ? q.a + q.b : q.a - q.b);
  expect(q.result).toBeGreaterThanOrEqual(0);
});

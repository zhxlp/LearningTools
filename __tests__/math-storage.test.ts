import AsyncStorage from '@react-native-async-storage/async-storage';
import { OpType, MathQuestionRecord, MathRound } from '../lib/math-types';
import {
  ROUND_KEY_PREFIX,
  roundKey,
  saveRound,
  loadRoundsSince,
  deleteRoundsSince,
  sumRound,
  aggregateRounds,
  Aggregates,
  accuracy,
} from '../lib/math-storage';

// Build a MathQuestionRecord. `expr`/`a`/`b` are inert payload for storage
// round-trips; correctness sums are what aggregate logic consumes.
const q = (op: OpType, correct: number, incorrect: number): MathQuestionRecord => ({
  a: 1,
  b: 1,
  op,
  expr: `1${op}1`,
  correct,
  incorrect,
  startedAtISO: '2026-09-01T00:00:00.000Z',
  answeredAtISO: '2026-09-01T00:00:01.000Z',
});

// Round-level correct/incorrect are, by design, sums over questions.
const round = (id: string, questions: MathQuestionRecord[] = []): MathRound => {
  const sums = questions.reduce(
    (acc, x) => ({ correct: acc.correct + x.correct, incorrect: acc.incorrect + x.incorrect }),
    { correct: 0, incorrect: 0 }
  );
  return {
    id,
    startedAtISO: '2026-09-01T00:00:00.000Z',
    firstAnswerAtISO: '2026-09-01T00:00:05.000Z',
    correct: sums.correct,
    incorrect: sums.incorrect,
    questions,
  };
};

const zeroByOp = (): Aggregates['byOp'] => ({
  '+': { correct: 0, incorrect: 0 },
  '-': { correct: 0, incorrect: 0 },
  '*': { correct: 0, incorrect: 0 },
  '÷': { correct: 0, incorrect: 0 },
});

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('roundKey', () => {
  test('prefix and key composition', () => {
    expect(ROUND_KEY_PREFIX).toBe('calcRound_');
    expect(roundKey('1')).toBe('calcRound_1');
    expect(roundKey('1234567890000')).toBe('calcRound_1234567890000');
  });
});

describe('loadRoundsSince', () => {
  test('returns only rounds within the window, skipping older and unrelated keys', async () => {
    // Round ids are ms start timestamps. now=2, window=1 → the trailing window
    // is (now-window, now] = (1, 2]; the round started exactly at t=1 is older
    // than the window start and must be excluded.
    await AsyncStorage.setItem(roundKey('1'), JSON.stringify(round('1', [q('+', 1, 0)])));
    await AsyncStorage.setItem(roundKey('2'), JSON.stringify(round('2', [q('*', 3, 1)])));
    await AsyncStorage.setItem('unrelatedSettings', JSON.stringify({ keep: true }));

    const loaded = await loadRoundsSince(2, 1);

    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('2');
    expect(loaded[0].questions).toEqual([q('*', 3, 1)]);
  });

  test('returns [] when nothing is stored', async () => {
    expect(await loadRoundsSince(Date.now(), 1000)).toEqual([]);
  });

  test('skips corrupt JSON values in-window without throwing', async () => {
    await AsyncStorage.setItem(roundKey('95'), '{not valid json');
    await AsyncStorage.setItem(roundKey('96'), JSON.stringify(round('96', [q('÷', 2, 0)])));

    const loaded = await loadRoundsSince(100, 10);

    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('96');
  });
});

describe('saveRound', () => {
  test('writes the round JSON under its prefixed key and round-trips via load', async () => {
    const r = round('2', [q('+', 2, 1), q('-', 1, 0)]);

    await saveRound(r);

    const stored = await AsyncStorage.getItem(roundKey('2'));
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored as string)).toEqual(r);

    const loaded = await loadRoundsSince(2, 1);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toEqual(r);
  });
});

describe('deleteRoundsSince', () => {
  test('removes only in-window keys; older round and unrelated keys survive', async () => {
    await AsyncStorage.setItem(roundKey('1'), JSON.stringify(round('1')));
    await AsyncStorage.setItem(roundKey('2'), JSON.stringify(round('2')));
    await AsyncStorage.setItem('unrelatedSettings', JSON.stringify({ keep: true }));

    await deleteRoundsSince(2, 1);

    expect(await AsyncStorage.getItem(roundKey('1'))).toBeTruthy();
    expect(await AsyncStorage.getItem(roundKey('2'))).toBeNull();
    expect(await AsyncStorage.getItem('unrelatedSettings')).toBeTruthy();
  });
});

describe('sumRound', () => {
  test('sums correct/incorrect over questions', () => {
    const r = round('1', [q('+', 2, 1), q('*', 3, 0), q('-', 0, 2)]);
    expect(sumRound(r)).toEqual({ correct: 5, incorrect: 3 });
  });

  test('empty questions sum to zero', () => {
    expect(sumRound(round('1'))).toEqual({ correct: 0, incorrect: 0 });
  });
});

describe('aggregateRounds', () => {
  test('totals across rounds and splits per op', () => {
    const rounds = [
      round('1', [q('+', 2, 1), q('*', 3, 0)]),
      round('2', [q('-', 1, 2), q('÷', 0, 1), q('+', 1, 0)]),
    ];

    const agg = aggregateRounds(rounds);

    expect(agg.totalCorrect).toBe(7);
    expect(agg.totalIncorrect).toBe(4);
    expect(agg.byOp['+']).toEqual({ correct: 3, incorrect: 1 });
    expect(agg.byOp['-']).toEqual({ correct: 1, incorrect: 2 });
    expect(agg.byOp['*']).toEqual({ correct: 3, incorrect: 0 });
    expect(agg.byOp['÷']).toEqual({ correct: 0, incorrect: 1 });
  });

  test('ops that never appear stay zeroed rather than missing', () => {
    const agg = aggregateRounds([round('1', [q('+', 1, 1)])]);

    expect(agg.byOp).toEqual({
      '+': { correct: 1, incorrect: 1 },
      '-': { correct: 0, incorrect: 0 },
      '*': { correct: 0, incorrect: 0 },
      '÷': { correct: 0, incorrect: 0 },
    });
  });

  test('empty rounds produce zeroed totals with all four op keys', () => {
    expect(aggregateRounds([])).toEqual({
      totalCorrect: 0,
      totalIncorrect: 0,
      byOp: zeroByOp(),
    });
  });
});

describe('accuracy', () => {
  test('percent of correct, rounded', () => {
    expect(accuracy(3, 1)).toBe(75);
    expect(accuracy(1, 2)).toBe(33);
    expect(accuracy(2, 1)).toBe(67);
    expect(accuracy(5, 0)).toBe(100);
  });

  test('zero total returns 0 rather than dividing by zero', () => {
    expect(accuracy(0, 0)).toBe(0);
    expect(accuracy(0, 5)).toBe(0);
  });
});

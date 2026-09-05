import AsyncStorage from '@react-native-async-storage/async-storage';
import { MathRound, OpType } from './math-types';

export const ROUND_KEY_PREFIX = 'calcRound_';

export interface Aggregates {
  totalCorrect: number;
  totalIncorrect: number;
  byOp: Record<OpType, { correct: number; incorrect: number }>;
}

export function roundKey(id: string): string {
  return `${ROUND_KEY_PREFIX}${id}`;
}

export async function saveRound(r: MathRound): Promise<void> {
  await AsyncStorage.setItem(roundKey(r.id), JSON.stringify(r));
}

// Parse a MathRound out of a stored JSON string; corrupt payloads yield null
// (and are skipped by callers) instead of throwing.
function parseRoundJson(value: string): MathRound | null {
  try {
    return JSON.parse(value) as MathRound;
  } catch {
    return null;
  }
}

// Keys whose trailing id (round-start ms timestamp) falls inside the trailing
// window (nowMs - windowMs, nowMs]. A round started exactly windowMs before
// now is treated as outside the window — its id must be strictly greater than
// the cutoff. Keys with a non-numeric id are ignored.
async function inWindowRoundKeys(nowMs: number, windowMs: number): Promise<string[]> {
  const cutoff = nowMs - windowMs;
  const allKeys = await AsyncStorage.getAllKeys();
  const result: string[] = [];
  for (const key of allKeys) {
    if (!key.startsWith(ROUND_KEY_PREFIX)) continue;
    const idMs = Number(key.slice(ROUND_KEY_PREFIX.length));
    if (Number.isFinite(idMs) && idMs > cutoff) result.push(key);
  }
  return result;
}

export async function loadRoundsSince(nowMs: number, windowMs: number): Promise<MathRound[]> {
  const keys = await inWindowRoundKeys(nowMs, windowMs);
  if (keys.length === 0) return [];
  const pairs = await AsyncStorage.multiGet(keys);
  const rounds: MathRound[] = [];
  for (const [, value] of pairs) {
    if (value == null) continue;
    const parsed = parseRoundJson(value);
    if (parsed) rounds.push(parsed);
  }
  return rounds;
}

export async function deleteRoundsSince(nowMs: number, windowMs: number): Promise<void> {
  const keys = await inWindowRoundKeys(nowMs, windowMs);
  for (const key of keys) {
    await AsyncStorage.removeItem(key);
  }
}

// 删除轮次 key `calcRound_${id}` 中数字 id 早于 `nowMs - cutoffMs` 的（即开轮距今超过 cutoffMs）。
// 只在保存轮次的顺路里机会式清理，静默失败；id 非数字的 key 一律跳过。
export async function pruneRoundsOlderThan(nowMs: number, cutoffMs: number): Promise<void> {
  const deadline = nowMs - cutoffMs;
  const allKeys = await AsyncStorage.getAllKeys();
  for (const key of allKeys) {
    if (!key.startsWith(ROUND_KEY_PREFIX)) continue;
    const idMs = Number(key.slice(ROUND_KEY_PREFIX.length));
    if (Number.isFinite(idMs) && idMs < deadline) {
      await AsyncStorage.removeItem(key);
    }
  }
}

export function sumRound(r: MathRound): { correct: number; incorrect: number } {
  let correct = 0;
  let incorrect = 0;
  for (const question of r.questions) {
    correct += question.correct;
    incorrect += question.incorrect;
  }
  return { correct, incorrect };
}

export function aggregateRounds(rounds: MathRound[]): Aggregates {
  const byOp: Aggregates['byOp'] = {
    '+': { correct: 0, incorrect: 0 },
    '-': { correct: 0, incorrect: 0 },
    '*': { correct: 0, incorrect: 0 },
    '÷': { correct: 0, incorrect: 0 },
  };
  let totalCorrect = 0;
  let totalIncorrect = 0;
  for (const r of rounds) {
    for (const question of r.questions) {
      totalCorrect += question.correct;
      totalIncorrect += question.incorrect;
      byOp[question.op].correct += question.correct;
      byOp[question.op].incorrect += question.incorrect;
    }
  }
  return { totalCorrect, totalIncorrect, byOp };
}

export function accuracy(correct: number, incorrect: number): number {
  const total = correct + incorrect;
  return total > 0 ? Math.round((correct / total) * 100) : 0;
}

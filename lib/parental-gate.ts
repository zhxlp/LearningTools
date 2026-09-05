import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_PARENTAL_GATE_SETTINGS,
  MathQuestion,
  OpType,
  ParentalGateSettings,
  WrongAnswerMode,
  isOpType,
} from './math-types';
import { generateQuestion } from './math-question';

export const PARENTAL_GATE_KEY = 'parentalGateSettings';

const clampDigits = (n: number): number => Math.max(1, Math.min(4, Math.round(n)));

const isFiniteNumber = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

// Fresh deep copy of DEFAULT_PARENTAL_GATE_SETTINGS so sanitized output never
// shares nested object references with the module-level default.
function freshDefaults(): ParentalGateSettings {
  return {
    enabledOps: [...DEFAULT_PARENTAL_GATE_SETTINGS.enabledOps],
    digits: { ...DEFAULT_PARENTAL_GATE_SETTINGS.digits },
    wrongAnswerMode: DEFAULT_PARENTAL_GATE_SETTINGS.wrongAnswerMode,
  };
}

function parseDigits(entry: unknown, fallback: { min: number; max: number }): { min: number; max: number } {
  if (typeof entry !== 'object' || entry === null) return { ...fallback };
  const e = entry as Record<string, unknown>;
  if (!isFiniteNumber(e.min) || !isFiniteNumber(e.max)) return { ...fallback };
  let min = clampDigits(e.min);
  let max = clampDigits(e.max);
  if (min > max) [min, max] = [max, min];
  return { min, max };
}

export function sanitizeParentalGateSettings(raw: unknown): ParentalGateSettings {
  const out = freshDefaults();
  if (typeof raw !== 'object' || raw === null) return out;
  const source = raw as Record<string, unknown>;

  if (Array.isArray(source.enabledOps)) {
    const filtered: OpType[] = [];
    for (const op of source.enabledOps) {
      if (isOpType(op) && !filtered.includes(op)) filtered.push(op);
    }
    if (filtered.length > 0) out.enabledOps = filtered;
  }

  if (source.digits !== undefined) {
    out.digits = parseDigits(source.digits, out.digits);
  }

  const mode = source.wrongAnswerMode;
  if (mode === 'new' || mode === 'retry') out.wrongAnswerMode = mode as WrongAnswerMode;

  return out;
}

export async function loadParentalGateSettings(): Promise<ParentalGateSettings> {
  try {
    const stored = await AsyncStorage.getItem(PARENTAL_GATE_KEY);
    if (stored == null) return freshDefaults();
    return sanitizeParentalGateSettings(JSON.parse(stored));
  } catch {
    return freshDefaults();
  }
}

export async function saveParentalGateSettings(s: ParentalGateSettings): Promise<void> {
  await AsyncStorage.setItem(PARENTAL_GATE_KEY, JSON.stringify(sanitizeParentalGateSettings(s)));
}

export function generateGateQuestion(s: ParentalGateSettings): MathQuestion {
  const enabled = s.enabledOps.length > 0 ? s.enabledOps : DEFAULT_PARENTAL_GATE_SETTINGS.enabledOps;
  const op = enabled[Math.floor(Math.random() * enabled.length)];
  return generateQuestion(op, { minDigits: s.digits.min, maxDigits: s.digits.max });
}

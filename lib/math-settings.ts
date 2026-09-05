import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ALL_OPS,
  DEFAULT_MATH_SETTINGS,
  MathDifficulty,
  MathSettings,
  OpType,
  WrongAnswerMode,
  isOpType,
} from './math-types';

export const MATH_SETTINGS_KEY = 'mathTestSettings';

const clampDigits = (n: number): number => Math.max(1, Math.min(4, Math.round(n)));

const isFiniteNumber = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

// Fresh deep copy of DEFAULT_MATH_SETTINGS so sanitized output never shares
// nested object references with the module-level default.
function freshDefaults(): MathSettings {
  return {
    enabledOps: [...DEFAULT_MATH_SETTINGS.enabledOps],
    difficulty: {
      '+': { ...DEFAULT_MATH_SETTINGS.difficulty['+'] },
      '-': { ...DEFAULT_MATH_SETTINGS.difficulty['-'] },
      '*': { ...DEFAULT_MATH_SETTINGS.difficulty['*'] },
      '÷': { ...DEFAULT_MATH_SETTINGS.difficulty['÷'] },
    },
    wrongAnswerMode: DEFAULT_MATH_SETTINGS.wrongAnswerMode,
    columnarStyle: { ...DEFAULT_MATH_SETTINGS.columnarStyle },
  };
}

// Accepts a per-op difficulty object only when both digit fields are numeric;
// clamps digits to 1..4 and swaps when minDigits > maxDigits.
function parseDifficulty(entry: unknown, fallback: MathDifficulty): MathDifficulty {
  if (typeof entry !== 'object' || entry === null) return { ...fallback };
  const e = entry as Record<string, unknown>;
  if (!isFiniteNumber(e.minDigits) || !isFiniteNumber(e.maxDigits)) return { ...fallback };
  let minDigits = clampDigits(e.minDigits);
  let maxDigits = clampDigits(e.maxDigits);
  if (minDigits > maxDigits) [minDigits, maxDigits] = [maxDigits, minDigits];
  return { minDigits, maxDigits };
}

export function sanitizeMathSettings(raw: unknown): MathSettings {
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

  const rawDiff = source.difficulty;
  if (typeof rawDiff === 'object' && rawDiff !== null) {
    const diffMap = rawDiff as Record<string, unknown>;
    for (const op of ALL_OPS) {
      if (diffMap[op] !== undefined) {
        out.difficulty[op] = parseDifficulty(diffMap[op], out.difficulty[op]);
      }
    }
  }

  const mode = source.wrongAnswerMode;
  if (mode === 'new' || mode === 'retry') out.wrongAnswerMode = mode as WrongAnswerMode;

  const rawStyle = source.columnarStyle;
  if (typeof rawStyle === 'object' && rawStyle !== null) {
    const st = rawStyle as Record<string, unknown>;
    if (isFiniteNumber(st.digitSize) && isFiniteNumber(st.rowGap) && isFiniteNumber(st.colGap)) {
      out.columnarStyle = { digitSize: st.digitSize, rowGap: st.rowGap, colGap: st.colGap };
    }
  }

  return out;
}

export async function loadMathSettings(): Promise<MathSettings> {
  try {
    const stored = await AsyncStorage.getItem(MATH_SETTINGS_KEY);
    if (stored == null) return freshDefaults();
    return sanitizeMathSettings(JSON.parse(stored));
  } catch {
    return freshDefaults();
  }
}

export async function saveMathSettings(settings: MathSettings): Promise<void> {
  await AsyncStorage.setItem(MATH_SETTINGS_KEY, JSON.stringify(sanitizeMathSettings(settings)));
}

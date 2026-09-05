import { OpType, MathDifficulty, MathQuestion, OP_SYMBOLS, digitRangeOf } from './math-types';

// Random integer within [min, max] inclusive.
const randInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

// Random count of digits in [minDigits, maxDigits] then a number with exactly that many digits.
const randomOperand = (minDigits: number, maxDigits: number): number => {
  const digits = randInt(minDigits, maxDigits);
  const [lo, hi] = digitRangeOf(digits);
  return randInt(lo, hi);
};

const exprOf = (a: number, b: number, op: OpType): string => `${a} ${OP_SYMBOLS[op]} ${b}`;

export function generateQuestion(op: OpType, diff: MathDifficulty): MathQuestion {
  const minDigits = Math.max(1, Math.min(diff.minDigits, diff.maxDigits));
  const maxDigits = Math.max(1, Math.max(diff.minDigits, diff.maxDigits));

  if (op === '+') {
    const a = randomOperand(minDigits, maxDigits);
    const b = randomOperand(minDigits, maxDigits);
    return { a, b, op, expr: exprOf(a, b, op), result: a + b };
  }

  if (op === '-') {
    let a = randomOperand(minDigits, maxDigits);
    let b = randomOperand(minDigits, maxDigits);
    if (a < b) [a, b] = [b, a];
    return { a, b, op, expr: exprOf(a, b, op), result: a - b };
  }

  if (op === '*') {
    const a = randomOperand(minDigits, maxDigits);
    const b = randomOperand(minDigits, maxDigits);
    return { a, b, op, expr: exprOf(a, b, op), result: a * b };
  }

  // Division: divisor b within range, dividend a is a multiple of b within range (exact).
  for (let attempt = 0; attempt < 200; attempt++) {
    const b = randomOperand(minDigits, maxDigits);
    const [lo, hi] = [digitRangeOf(minDigits)[0], digitRangeOf(maxDigits)[1]];
    const first = Math.ceil(lo / b) * b;
    const candidates = first <= hi ? Math.floor((hi - first) / b) + 1 : 0;
    if (candidates > 0) {
      const a = first + randInt(0, candidates - 1) * b;
      return { a, b, op, expr: exprOf(a, b, op), result: a / b };
    }
  }
  // Fallback should be unreachable for digits 1..4; guard anyway:
  const b = randomOperand(minDigits, maxDigits);
  const a = b * randomOperand(1, Math.max(1, maxDigits - minDigits + 1));
  return { a, b, op, expr: exprOf(a, b, op), result: a / b };
}

export function generateQuestionFromSettings(
  enabledOps: OpType[],
  difficulty: Record<OpType, MathDifficulty>
): MathQuestion {
  const op = enabledOps[Math.floor(Math.random() * enabledOps.length)];
  return generateQuestion(op, difficulty[op]);
}

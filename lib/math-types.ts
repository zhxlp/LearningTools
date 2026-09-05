export type OpType = '+' | '-' | '*' | '÷';
export type WrongAnswerMode = 'new' | 'retry';

export interface MathDifficulty { minDigits: number; maxDigits: number; }
export interface ColumnarStyle { digitSize: number; rowGap: number; colGap: number; }

export interface MathSettings {
  enabledOps: OpType[];
  difficulty: Record<OpType, MathDifficulty>;
  wrongAnswerMode: WrongAnswerMode;
  columnarStyle: ColumnarStyle;
}

export interface ParentalGateSettings {
  enabledOps: OpType[];
  digits: { min: number; max: number };
  wrongAnswerMode: WrongAnswerMode;
}

export interface MathQuestion { a: number; b: number; op: OpType; expr: string; result: number; }

export interface MathQuestionRecord {
  a: number; b: number; op: OpType; expr: string;
  correct: number; incorrect: number;
  startedAtISO: string; answeredAtISO?: string;
}

export interface MathRound {
  id: string; startedAtISO: string; firstAnswerAtISO: string;
  correct: number; incorrect: number; questions: MathQuestionRecord[];
}

export const ALL_OPS: OpType[] = ['+', '-', '*', '÷'];
export const OP_SYMBOLS: Record<OpType, string> = { '+': '+', '-': '-', '*': '×', '÷': '÷' };

export function isOpType(x: unknown): x is OpType {
  return x === '+' || x === '-' || x === '*' || x === '÷';
}

export function digitRangeOf(count: number): [number, number] {
  if (count <= 1) return [1, 9];
  return [Math.pow(10, count - 1), Math.pow(10, count) - 1];
}

export const DEFAULT_MATH_SETTINGS: MathSettings = {
  enabledOps: ['+', '-'],
  difficulty: { '+': { minDigits: 1, maxDigits: 2 }, '-': { minDigits: 1, maxDigits: 2 }, '*': { minDigits: 1, maxDigits: 2 }, '÷': { minDigits: 1, maxDigits: 2 } },
  wrongAnswerMode: 'retry',
  columnarStyle: { digitSize: 44, rowGap: 20, colGap: 6 },
};

export const DEFAULT_PARENTAL_GATE_SETTINGS: ParentalGateSettings = {
  enabledOps: ['+', '-'],
  digits: { min: 4, max: 4 },
  wrongAnswerMode: 'new',
};

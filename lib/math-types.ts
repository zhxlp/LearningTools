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

// 一条矢量笔迹：points 为 SVG polyline 点串（“x,y x,y …”），坐标系=采集时的画布。
export interface BoardStroke { points: string; color: string; width: number; }

// 一次答案提交时抓取的白板快照：印刷竖式上下文 + 笔迹 + 提交结果。
export interface MathAttempt {
  atISO: string;          // 该次提交时间
  isCorrect: boolean;     // 对错
  submitted: string;      // 儿童敲入的答案
  canvasWidth: number;    // 采集时手写板像素宽
  canvasHeight: number;   // 采集时手写板像素高
  columnarStyle: ColumnarStyle;  // 当时印刷竖式的排版
  strokes: BoardStroke[]; // 矢量笔迹（坐标系=canvas）
}

export interface MathQuestionRecord {
  a: number; b: number; op: OpType; expr: string;
  correct: number; incorrect: number;
  startedAtISO: string; answeredAtISO?: string;
  attempts?: MathAttempt[];  // 旧记录缺省该字段：凡聚合一律忽略
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

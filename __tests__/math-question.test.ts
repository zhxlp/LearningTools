import {
  computeResult,
  generateQuestion,
  generateQuestionFromSettings,
} from "@/lib/math-question";

const digitsOf = (n: number) => String(Math.abs(n)).length;

test("generates each op from a difficulty range", () => {
  for (const op of ["+", "-", "*", "÷"] as const) {
    for (let i = 0; i < 200; i++) {
      const q = generateQuestion(op, { minDigits: 2, maxDigits: 3 });
      expect(digitsOf(q.a)).toBeGreaterThanOrEqual(2);
      expect(digitsOf(q.a)).toBeLessThanOrEqual(3);
      expect(digitsOf(q.b)).toBeGreaterThanOrEqual(2);
      expect(digitsOf(q.b)).toBeLessThanOrEqual(3);
      expect(q.op).toBe(op);
      expect(q.expr).toContain(q.op === "*" ? "×" : q.op === "÷" ? "÷" : q.op);
    }
  }
});

test("subtraction is never negative and division is always exact", () => {
  for (let i = 0; i < 300; i++) {
    const sub = generateQuestion("-", { minDigits: 1, maxDigits: 4 });
    expect(sub.a).toBeGreaterThanOrEqual(sub.b);
    expect(sub.result).toBeGreaterThanOrEqual(0);

    const div = generateQuestion("÷", { minDigits: 1, maxDigits: 3 });
    expect(div.b).not.toBe(0);
    expect(div.a % div.b).toBe(0);
    expect(div.result).toBe(div.a / div.b);
  }
});

test("results are correct arithmetic", () => {
  for (let i = 0; i < 200; i++) {
    const q = generateQuestion("*", { minDigits: 1, maxDigits: 2 });
    expect(q.result).toBe(q.a * q.b);
  }
});

test("generates from enabled ops only", () => {
  for (let i = 0; i < 100; i++) {
    const q = generateQuestionFromSettings(["+", "-"], {
      "+": { minDigits: 1, maxDigits: 2 },
      "-": { minDigits: 1, maxDigits: 2 },
      "*": { minDigits: 1, maxDigits: 1 },
      "÷": { minDigits: 1, maxDigits: 1 },
    });
    expect(["+", "-"]).toContain(q.op);
  }
});

describe("computeResult", () => {
  test("matches exact arithmetic for each op", () => {
    expect(computeResult(23, 45, "+")).toBe(68);
    expect(computeResult(100, 37, "-")).toBe(63);
    expect(computeResult(12, 8, "*")).toBe(96);
    expect(computeResult(84, 7, "÷")).toBe(12);
  });

  test("division is integer-exact for evenly divisible operands", () => {
    for (let i = 0; i < 300; i++) {
      const a = 1 + Math.floor(Math.random() * 999);
      const q = 1 + Math.floor(Math.random() * 99);
      const n = a * q;
      expect(computeResult(n, q, "÷")).toBe(a);
      expect(Number.isInteger(computeResult(n, q, "÷"))).toBe(true);
    }
  });

  test("matches generateQuestion results across generated questions", () => {
    for (const op of ["+", "-", "*", "÷"] as const) {
      for (let i = 0; i < 100; i++) {
        const q = generateQuestion(op, { minDigits: 1, maxDigits: 3 });
        expect(computeResult(q.a, q.b, q.op)).toBe(q.result);
      }
    }
  });
});

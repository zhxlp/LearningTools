import { Line, Svg, Text as SvgText } from 'react-native-svg';
import { OP_SYMBOLS } from '../lib/math-types';
import type { ColumnarStyle, OpType } from '../lib/math-types';

export interface ColumnarLayoutProps {
  a: number;
  b: number;
  op: OpType;
  style: ColumnarStyle;
}

// 竖式印刷层的墨色：深灰数字 + #333 横线，贴近印刷参照而非强调色。
const INK = '#333333';
const RULE_COLOR = '#333333';
const RULE_HEIGHT = 2;
const RULE_GAP = 6;
// 行盒比字号略高，给字形一点余量，避免裁剪；行距已由 style.rowGap 单独控制。
const ROW_LINE_PAD = 4;
// 基线偏移量（占字号比例）：SVG 文字以基线定位，按此近似把字形在行盒内上下居中。
const BASELINE_SHIFT = 0.35;

// 用 SVG 渲染竖式：数字在各自固定格内按列中心对齐（无需等宽字体），
// 与手写笔迹同为矢量，便于后续整板叠加/缩放回放。
export default function ColumnarLayout(props: ColumnarLayoutProps): React.JSX.Element {
  const { a, b, op, style } = props;

  const aDigits = String(Math.abs(a)).split('');
  const bDigits = String(Math.abs(b)).split('');
  // 最左列留给运算符，其余列排数字 → 总列数 = 较长操作数的位数 + 1。
  const totalCols = Math.max(aDigits.length, bDigits.length) + 1;
  const digitColumns = totalCols - 1;

  const fontSize = style.digitSize;
  // 每列横向节距 = 字格 + 列距；固定列中心保证同列数字严格上下对齐。
  const cellWidth = style.digitSize + style.colGap;
  const rowHeight = style.digitSize + ROW_LINE_PAD;

  const svgWidth = totalCols * cellWidth;
  // 纵向：顶行(行高) + rowGap + 底行(行高) + RULE_GAP + 横线 + 底部留空(fontSize)。
  const topRowTop = 0;
  const bottomRowTop = topRowTop + rowHeight + style.rowGap;
  const ruleTop = bottomRowTop + rowHeight + RULE_GAP;
  const svgHeight = ruleTop + RULE_HEIGHT + fontSize;

  // 右侧对齐：数字从右数第 i 位位于列 totalCols-1-i。
  const digitAt = (col: number, digits: string[]): string | null => {
    const idx = col - (totalCols - digits.length);
    return idx >= 0 && idx < digits.length ? digits[idx] : null;
  };

  const glyphY = (centerY: number): number => centerY + fontSize * BASELINE_SHIFT;

  const topRow = Array.from({ length: totalCols }, (_, col) => {
    const ch = digitAt(col, aDigits);
    if (ch === null) return null;
    return (
      <SvgText
        key={`t${col}`}
        x={col * cellWidth + cellWidth / 2}
        y={glyphY(rowHeight / 2)}
        fontSize={fontSize}
        fontWeight="600"
        fill={INK}
        textAnchor="middle"
      >
        {ch}
      </SvgText>
    );
  });

  const bottomRow = Array.from({ length: totalCols }, (_, col) => {
    const ch = col === 0 ? OP_SYMBOLS[op] : digitAt(col, bDigits);
    if (ch === null) return null;
    return (
      <SvgText
        key={`b${col}`}
        x={col * cellWidth + cellWidth / 2}
        y={glyphY(bottomRowTop + rowHeight / 2)}
        fontSize={fontSize}
        fontWeight="600"
        fill={INK}
        textAnchor="middle"
      >
        {ch}
      </SvgText>
    );
  });

  return (
    <Svg width={svgWidth} height={svgHeight}>
      {topRow}
      {bottomRow}
      {/* 跳过运算符列，横线只压在数字列网格上 */}
      <Line
        x1={cellWidth}
        y1={ruleTop + RULE_HEIGHT / 2}
        x2={cellWidth + digitColumns * cellWidth}
        y2={ruleTop + RULE_HEIGHT / 2}
        stroke={RULE_COLOR}
        strokeWidth={RULE_HEIGHT}
      />
    </Svg>
  );
}

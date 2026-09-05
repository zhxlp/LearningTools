import { StyleSheet, Text, View } from 'react-native';
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

export default function ColumnarLayout(props: ColumnarLayoutProps): React.JSX.Element {
  const { a, b, op, style } = props;

  const aDigits = String(Math.abs(a)).split('');
  const bDigits = String(Math.abs(b)).split('');
  // 最左列留给运算符，其余列排数字 → 总列数 = 较长操作数的位数 + 1。
  const totalCols = Math.max(aDigits.length, bDigits.length) + 1;
  const digitColumns = totalCols - 1;

  const fontSize = style.digitSize;
  // 每列横向节距 = 字格 + 列距；固定宽单元格保证同列数字严格上下对齐（无需等宽字体）。
  const cellWidth = style.digitSize + style.colGap;
  const rowHeight = style.digitSize + ROW_LINE_PAD;

  // 右侧对齐：数字从右数第 i 位位于列 totalCols-1-i。
  const digitAt = (col: number, digits: string[]): string | null => {
    const idx = col - (totalCols - digits.length);
    return idx >= 0 && idx < digits.length ? digits[idx] : null;
  };

  const cell = (content: string | null, key: number): React.JSX.Element => (
    <View
      key={key}
      style={{ width: cellWidth, height: rowHeight, alignItems: 'center', justifyContent: 'center' }}
    >
      {content === null ? null : (
        <Text
          style={{
            fontSize,
            lineHeight: rowHeight,
            color: INK,
            fontWeight: '600',
            textAlign: 'center',
            includeFontPadding: false,
          }}
        >
          {content}
        </Text>
      )}
    </View>
  );

  const topCells = Array.from({ length: totalCols }, (_, col) => cell(digitAt(col, aDigits), col));
  // 运算符占底行最左列；数字按同网格右对齐。
  const bottomCells = Array.from({ length: totalCols }, (_, col) =>
    cell(col === 0 ? OP_SYMBOLS[op] : digitAt(col, bDigits), col)
  );

  return (
    <View style={styles.container}>
      <View style={styles.row}>{topCells}</View>
      <View style={{ height: style.rowGap }} />
      <View style={styles.row}>{bottomCells}</View>
      <View style={styles.ruleRow}>
        {/* 跳过运算符列，横线只压在数字列网格上 */}
        <View style={{ width: cellWidth }} />
        <View
          style={{
            width: digitColumns * cellWidth,
            height: RULE_HEIGHT,
            backgroundColor: RULE_COLOR,
          }}
        />
      </View>
      {/* 横线下方留空，供手写结果 */}
      <View style={{ height: fontSize }} />
    </View>
  );
}

const styles = StyleSheet.create({
  // 组件宽度由内容决定并在宿主 flex 容器中居中。
  container: {
    alignSelf: 'center',
  },
  row: {
    flexDirection: 'row',
  },
  ruleRow: {
    flexDirection: 'row',
    marginTop: RULE_GAP,
  },
});

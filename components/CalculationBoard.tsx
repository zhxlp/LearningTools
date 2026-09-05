import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';

import type { ColumnarStyle, MathQuestion } from '../lib/math-types';
import ColumnarLayout from './ColumnarLayout';
import { DrawingPad, type DrawingPadHandle } from './DrawingPad';
import NumberKeypad from './NumberKeypad';

export type FeedbackState = 'idle' | 'correct' | 'wrong';

export interface CalculationBoardProps {
  question: MathQuestion;                    // non-null: 父级仅在可用时渲染
  columnarStyle: ColumnarStyle;
  onColumnarStyleChange?: (style: ColumnarStyle) => void;  // 提供时展示 🅰️排版切换与步进面板
  answer: string;
  feedback: FeedbackState;
  error?: string | null;                     // 如 答案错误，请重试：在答案栏下方红字提示
  emptyPlaceholder?: string;                 // answer==='' 且 feedback==='idle' 时显示；默认 '?'
  rightWidth?: number;                       // 右栏宽度；默认 296（窄屏/竖屏盖层可用比例值）
  onDigit: (d: string) => void;
  onBackspace: () => void;
  onSubmit: () => void;
  submitDisabled: boolean;
}

// 配色沿用计算测试主界面：白卡片、蓝 #1976d2 高亮、绿 #4CAF50、红 #f44336。
const ACCENT = '#1976d2';
const GREEN = '#4CAF50';
const RED = '#f44336';
const INK = '#222222';

// 就地排版步进范围。
const STYLE_LIMITS = {
  digitSize: { min: 24, max: 80, step: 2 },
  rowGap: { min: 4, max: 60, step: 2 },
  colGap: { min: 0, max: 30, step: 2 },
};

type StyleKey = keyof ColumnarStyle;

interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}

// 紧凑步进器：− / 数值 / ＋。到界时禁用对应键。
function Stepper(props: StepperProps): React.JSX.Element {
  const { label, value, min, max, step, onChange } = props;
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <TouchableOpacity
          style={[styles.stepperBtn, value <= min && styles.stepperBtnDisabled]}
          onPress={() => onChange(Math.max(min, value - step))}
          disabled={value <= min}
          accessibilityRole="button"
          accessibilityLabel={`减小${label}`}
        >
          <Text style={styles.stepperBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.stepperValue}>{value}</Text>
        <TouchableOpacity
          style={[styles.stepperBtn, value >= max && styles.stepperBtnDisabled]}
          onPress={() => onChange(Math.min(max, value + step))}
          disabled={value >= max}
          accessibilityRole="button"
          accessibilityLabel={`增大${label}`}
        >
          <Text style={styles.stepperBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// 计算测试答题面板：左侧题面 + 印刷竖式 + 手写白板 + 工具栏（＋可选就地排版），
// 右侧答案栏（含反馈配色/错误提示）+ 数字键盘。供计算测试主界面与家长验证盖层复用，
// 视觉与主界面当前左右分屏保持一致。
export default function CalculationBoard(props: CalculationBoardProps): React.JSX.Element {
  const {
    question,
    columnarStyle,
    onColumnarStyleChange,
    answer,
    feedback,
    error,
    emptyPlaceholder,
    rightWidth,
    onDigit,
    onBackspace,
    onSubmit,
    submitDisabled,
  } = props;

  const { a, b, op, expr } = question;

  const { height: winH } = useWindowDimensions();
  // 矮屏（手机横屏高度不高）自动紧凑：右栏收窄、答案栏与键盘/确定缩小，确保放得下。
  const compact = winH < 500;
  const effectiveRightWidth = rightWidth ?? (compact ? 248 : 296);

  const padRef = useRef<DrawingPadHandle | null>(null);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [styleOpen, setStyleOpen] = useState(false);
  // 手写板实际尺寸（宿主测量后让 DrawingPad 填满整块画区，墨迹区大于印刷竖式）。
  const [padArea, setPadArea] = useState({ width: 0, height: 0 });

  // 换题（question 引用变化，即父级出了新题）时自动清空画板笔迹。用 ref 记下上一题，
  // 按引用比较而非 a/b/op/expr 数值：即便连续两题数值相同（换题必然产生新对象）也会清空，
  // 避免上一题的手写迹残留到同值新题上。
  const prevQuestionRef = useRef<MathQuestion>(question);
  useEffect(() => {
    if (prevQuestionRef.current !== question) {
      padRef.current?.clear();
    }
    prevQuestionRef.current = question;
  }, [question]);

  const showStyleControls = onColumnarStyleChange != null;

  const onPadAreaLayout = (e: LayoutChangeEvent): void => {
    const { width, height } = e.nativeEvent.layout;
    setPadArea({ width, height });
  };

  const changeStyle = (key: StyleKey, value: number): void => {
    onColumnarStyleChange?.({ ...columnarStyle, [key]: value });
  };

  // 答案栏内容：输入中显示数字；空时按反馈态给出 ✓/✗，否则占位提示。
  const answerContent =
    answer !== ''
      ? answer
      : feedback === 'correct'
        ? '✓'
        : feedback === 'wrong'
          ? '✗'
          : (emptyPlaceholder ?? '?');

  return (
    <View style={styles.row}>
      {/* ===== 左侧：题面 + 印刷竖式 + 手写 ===== */}
      <View style={styles.leftCard}>
        {/* 顶行：题横式 + 图标工具（笔/橡皮/清空/排版），把工具栏从底部移上来以放大竖式区 */}
        <View style={styles.boardTop}>
          <Text style={styles.questionLine} numberOfLines={1}>
            {expr} = ?
          </Text>
          <View style={styles.toolbar}>
            <TouchableOpacity
              style={[styles.toolButton, tool === 'pen' && styles.toolButtonActive]}
              onPress={() => setTool('pen')}
              accessibilityRole="button"
              accessibilityLabel="画笔"
            >
              <Text style={styles.toolText}>✏️</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toolButton, tool === 'eraser' && styles.toolButtonActive]}
              onPress={() => setTool('eraser')}
              accessibilityRole="button"
              accessibilityLabel="橡皮"
            >
              <Text style={styles.toolText}>🧽</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.toolButton}
              onPress={() => padRef.current?.clear()}
              accessibilityRole="button"
              accessibilityLabel="清空"
            >
              <Text style={styles.toolText}>🗑️</Text>
            </TouchableOpacity>
            {showStyleControls && (
              <TouchableOpacity
                style={[styles.toolButton, styleOpen && styles.toolButtonActive]}
                onPress={() => setStyleOpen((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel="排版"
              >
                <Text style={styles.toolText}>🅰️</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 手写画区：DrawingPad 填满整块，白板中央印刷竖式（下层、被动，不被橡皮擦除） */}
        <View style={styles.padArea} onLayout={onPadAreaLayout}>
          {padArea.width > 0 && padArea.height > 0 && (
            <DrawingPad ref={padRef} tool={tool} canvasColor="#ffffff">
              {/* 竖式水平居中、垂直靠上，顶部仅留固定 20 内边距；
                  下方留出大片空白供手写竖式过程 */}
              <View
                style={{
                  width: padArea.width,
                  height: padArea.height,
                  alignItems: 'center',
                  paddingTop: 20,
                }}
              >
                <ColumnarLayout a={a} b={b} op={op} style={columnarStyle} />
              </View>
            </DrawingPad>
          )}
        </View>

        {/* 🅰️ 就地排版面板：字号/行距/列距步进，改动即时生效 */}
        {showStyleControls && styleOpen && (
          <View style={styles.stylePanel}>
            <Stepper
              label="字号"
              value={columnarStyle.digitSize}
              min={STYLE_LIMITS.digitSize.min}
              max={STYLE_LIMITS.digitSize.max}
              step={STYLE_LIMITS.digitSize.step}
              onChange={(v) => changeStyle('digitSize', v)}
            />
            <Stepper
              label="行距"
              value={columnarStyle.rowGap}
              min={STYLE_LIMITS.rowGap.min}
              max={STYLE_LIMITS.rowGap.max}
              step={STYLE_LIMITS.rowGap.step}
              onChange={(v) => changeStyle('rowGap', v)}
            />
            <Stepper
              label="列距"
              value={columnarStyle.colGap}
              min={STYLE_LIMITS.colGap.min}
              max={STYLE_LIMITS.colGap.max}
              step={STYLE_LIMITS.colGap.step}
              onChange={(v) => changeStyle('colGap', v)}
            />
          </View>
        )}

      </View>

      {/* ===== 右侧：答案栏 + 数字键盘 ===== */}
      <View style={[styles.rightPanel, { width: effectiveRightWidth }]}>
        <View
          style={[
            styles.answerBox,
            compact && styles.answerBoxCompact,
            feedback === 'correct' && styles.answerBoxCorrect,
            feedback === 'wrong' && styles.answerBoxWrong,
          ]}
        >
          <Text
            style={[
              styles.answerText,
              compact && styles.answerTextCompact,
              feedback === 'correct' && styles.answerTextCorrect,
              feedback === 'wrong' && styles.answerTextWrong,
              answer === '' && feedback === 'idle' && styles.answerPlaceholder,
            ]}
          >
            {answerContent}
          </Text>
        </View>

        {error != null && <Text style={styles.errorText}>{error}</Text>}

        <View style={styles.keypadWrap}>
          <NumberKeypad
            onDigit={onDigit}
            onBackspace={onBackspace}
            onSubmit={onSubmit}
            submitDisabled={submitDisabled}
            dense={compact}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  leftCard: {
    flex: 1,
    marginRight: 10,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 10,
  },
  boardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  questionLine: {
    fontSize: 22,
    fontWeight: '700',
    color: INK,
    flexShrink: 1,
    marginRight: 8,
  },
  padArea: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
  },
  stylePanel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  stepperLabel: {
    fontSize: 13,
    color: INK,
    fontWeight: '600',
    marginRight: 6,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: {
    borderColor: '#cccccc',
    opacity: 0.5,
  },
  stepperBtnText: {
    fontSize: 16,
    color: ACCENT,
    fontWeight: '700',
  },
  stepperValue: {
    minWidth: 34,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: INK,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  toolButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#cccccc',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  toolButtonActive: {
    backgroundColor: '#e3f2fd',
    borderColor: ACCENT,
  },
  toolText: {
    fontSize: 18,
  },
  rightPanel: {
    width: 296,
  },
  answerBox: {
    height: 62,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: ACCENT,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  answerBoxCompact: {
    height: 40,
    marginBottom: 4,
  },
  answerBoxCorrect: {
    borderColor: GREEN,
    backgroundColor: '#e8f5e9',
  },
  answerBoxWrong: {
    borderColor: RED,
    backgroundColor: '#ffebee',
  },
  answerText: {
    fontSize: 40,
    fontWeight: '700',
    color: ACCENT,
  },
  answerTextCompact: {
    fontSize: 28,
  },
  answerTextCorrect: {
    color: GREEN,
  },
  answerTextWrong: {
    color: RED,
  },
  answerPlaceholder: {
    color: '#bbbbbb',
    fontWeight: '400',
    fontSize: 28,
  },
  errorText: {
    color: RED,
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 4,
  },
  keypadWrap: {
    flex: 1,
  },
});

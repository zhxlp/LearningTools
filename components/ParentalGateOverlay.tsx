import { useEffect, useState } from 'react';
import { Keyboard, Modal, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';

import type { ColumnarStyle, MathQuestion, ParentalGateSettings } from '../lib/math-types';
import { generateGateQuestion, loadParentalGateSettings } from '../lib/parental-gate';
import CalculationBoard from './CalculationBoard';

export interface ParentalGateOverlayProps {
  visible: boolean;
  onSuccess: () => void;
  onClose: () => void;
}

const ACCENT = '#1976d2';
const INK_COLOR = '#222222';
const MAX_ANSWER_LENGTH = 9;
// 数字键仅提供 0-9，答案只允许数字。
const DIGIT_ONLY = /^\d$/;
// 家长验证盖层里印刷竖式的排版（略小于主界面，保证窄屏也能放下 4 位数字）。
const GATE_COLUMNAR: ColumnarStyle = { digitSize: 34, rowGap: 12, colGap: 4 };
// 窄屏（横屏下通常是首页竖屏拉起盖层）：改用更小竖式字号与比例右栏，避免 4 位数字溢出。
const NARROW_COLUMNAR: ColumnarStyle = { digitSize: 22, rowGap: 8, colGap: 2 };

// 家长验证盖层：采用与计算测试主界面相同的答题面板（左侧题目+竖式印刷+手写区，
// 右侧答案栏+虚拟数字键盘），布局由 CalculationBoard 统一提供。答对(onSuccess)/
// 答错(换题或重试按全局设置)/关闭(onClose) 均由调用方接入，本组件只负责出题、判题与
// 错误态（无音效）。盖层不开放就地排版，答错仅通过红字提示（feedback 恒为 idle）。
export default function ParentalGateOverlay(props: ParentalGateOverlayProps): React.JSX.Element {
  const { visible, onSuccess, onClose } = props;

  const { width: winWidth } = useWindowDimensions();
  // 窄窗（如首页竖屏拉起盖层）用更紧凑的竖式与右栏比例，宽窗用固定 296。
  const narrow = winWidth < 700;
  const columnar = narrow ? NARROW_COLUMNAR : GATE_COLUMNAR;
  const rightWidth = narrow ? Math.max(190, Math.round(winWidth * 0.5)) : 296;

  const [settings, setSettings] = useState<ParentalGateSettings | null>(null);
  const [question, setQuestion] = useState<MathQuestion | null>(null);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState(false);

  // 每次打开盖层时重新加载设置并生成新题，同时清空上次输入与错误态。
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setAnswer('');
    setError(false);
    setSettings(null);
    setQuestion(null);
    loadParentalGateSettings().then((loaded) => {
      if (cancelled) return;
      setSettings(loaded);
      setQuestion(generateGateQuestion(loaded));
    });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const handleDigit = (d: string) => {
    if (!DIGIT_ONLY.test(d)) return;
    setError(false);
    setAnswer((prev) => (prev.length >= MAX_ANSWER_LENGTH ? prev : prev + d));
  };

  const handleBackspace = () => {
    setAnswer((prev) => prev.slice(0, -1));
  };

  const handleSubmit = () => {
    if (!question || !settings) return;
    if (Number(answer) === question.result) {
      Keyboard.dismiss();
      onSuccess();
      return;
    }
    setError(true);
    setAnswer('');
    // 答错后按全局设置决定换新题或保留原题重试；换新题时 CalculationBoard 随题身变化自动清空白板。
    if (settings.wrongAnswerMode === 'new') {
      setQuestion(generateGateQuestion(settings));
    }
  };

  const handleClose = () => {
    Keyboard.dismiss();
    onClose();
  };

  return (
    <Modal
      animationType="fade"
      transparent={false}
      visible={visible}
      onRequestClose={handleClose}
    >
      <View style={styles.screen}>
        {/* 顶部：标题 / 提示 / 关闭 */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>家长验证</Text>
            <Text style={styles.hint}>请在左板列式手算，在右板输入答案</Text>
          </View>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="关闭"
          >
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* 下方：题目载入前显示占位，载入后整块答题面板填充剩余高度 */}
        <View style={styles.body}>
          {question == null ? (
            <View style={styles.boardPlaceholder}>
              <Text style={styles.placeholderText}>……</Text>
            </View>
          ) : (
            <CalculationBoard
              question={question}
              columnarStyle={columnar}
              rightWidth={rightWidth}
              answer={answer}
              feedback="idle"
              error={error ? '答案错误，请重试' : null}
              emptyPlaceholder="请输入答案"
              onDigit={handleDigit}
              onBackspace={handleBackspace}
              onSubmit={handleSubmit}
              submitDisabled={answer.length === 0}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#eef3f8',
    padding: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexShrink: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: INK_COLOR,
    marginRight: 10,
  },
  hint: {
    fontSize: 12,
    color: '#666666',
    flexShrink: 1,
  },
  closeButton: {
    padding: 6,
  },
  closeText: {
    fontSize: 24,
    lineHeight: 26,
    fontWeight: '600',
    color: ACCENT,
  },
  body: {
    flex: 1,
  },
  boardPlaceholder: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#999999',
  },
});

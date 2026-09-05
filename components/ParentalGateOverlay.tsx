import { useEffect, useRef, useState } from 'react';
import { Keyboard, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';

import type { ColumnarStyle, MathQuestion, ParentalGateSettings } from '../lib/math-types';
import { generateGateQuestion, loadParentalGateSettings } from '../lib/parental-gate';
import { DrawingPad, type DrawingPadHandle } from './DrawingPad';
import ColumnarLayout from './ColumnarLayout';
import NumberKeypad from './NumberKeypad';

export interface ParentalGateOverlayProps {
  visible: boolean;
  onSuccess: () => void;
  onClose: () => void;
}

const ACCENT = '#1976d2';
const ERROR_COLOR = '#d32f2f';
const INK_COLOR = '#222222';
const MAX_ANSWER_LENGTH = 9;
// 数字键仅提供 0-9，答案只允许数字。
const DIGIT_ONLY = /^\d$/;
// 家长验证盖层里印刷竖式的排版（略小于主界面，保证窄屏也能放下 4 位数字）。
const GATE_COLUMNAR: ColumnarStyle = { digitSize: 34, rowGap: 12, colGap: 4 };

// 家长验证盖层：采用与计算测试主界面相同的布局——左侧题目(横式)+竖式印刷+手写区，
// 右侧答案栏+虚拟数字键盘。答对(onSuccess)/答错(换题或重试按全局设置)/
// 关闭(onClose) 均由调用方接入，本组件只负责出题、判题、手写与错误态（无音效）。
export default function ParentalGateOverlay(props: ParentalGateOverlayProps): React.JSX.Element {
  const { visible, onSuccess, onClose } = props;

  const [settings, setSettings] = useState<ParentalGateSettings | null>(null);
  const [question, setQuestion] = useState<MathQuestion | null>(null);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState(false);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const padRef = useRef<DrawingPadHandle | null>(null);
  const [padArea, setPadArea] = useState({ width: 0, height: 0 });

  const nextQuestion = (q: MathQuestion) => {
    setQuestion(q);
    // 换题后清空白板笔迹。
    padRef.current?.clear();
  };

  const onBoardLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setPadArea({ width, height });
  };

  // 每次打开盖层时重新加载设置并生成新题，同时清空上次输入、错误态与手写笔迹。
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setAnswer('');
    setError(false);
    setTool('pen');
    setSettings(null);
    setQuestion(null);
    loadParentalGateSettings().then((loaded) => {
      if (cancelled) return;
      setSettings(loaded);
      nextQuestion(generateGateQuestion(loaded));
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
    // 答错后按全局设置决定换新题或保留原题重试；换新题时顺带清空白板。
    if (settings.wrongAnswerMode === 'new') {
      nextQuestion(generateGateQuestion(settings));
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
        {/* 顶部：标题 / 提示 / 错误 / 关闭 */}
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

        <View style={styles.split}>
          {/* 左侧：横式 + 竖式印刷 + 手写 */}
          <View style={styles.leftPanel}>
            <View style={styles.boardHeader}>
              <Text style={styles.questionLine}>
                {question ? `${question.expr} = ?` : '……'}
              </Text>
              <View style={styles.toolbar}>
                <TouchableOpacity
                  style={[styles.toolButton, tool === 'pen' && styles.toolButtonActive]}
                  onPress={() => setTool('pen')}
                >
                  <Text style={styles.toolText}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toolButton, tool === 'eraser' && styles.toolButtonActive]}
                  onPress={() => setTool('eraser')}
                >
                  <Text style={styles.toolText}>🧽</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.toolButton}
                  onPress={() => padRef.current?.clear()}
                >
                  <Text style={styles.toolText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.board} onLayout={onBoardLayout}>
              {padArea.width > 0 && padArea.height > 0 && (
                <DrawingPad ref={padRef} tool={tool} canvasColor="#ffffff">
                  {/* 竖式水平居中、垂直靠上（顶部留约两个数字高度），下方留白手写 */}
                  <View
                    style={{
                      width: padArea.width,
                      height: padArea.height,
                      alignItems: 'center',
                      paddingTop: GATE_COLUMNAR.digitSize * 2,
                    }}
                  >
                    {question && (
                      <ColumnarLayout
                        a={question.a}
                        b={question.b}
                        op={question.op}
                        style={GATE_COLUMNAR}
                      />
                    )}
                  </View>
                </DrawingPad>
              )}
            </View>
          </View>

          {/* 右侧：答案栏 + 虚拟键盘 */}
          <View style={styles.rightPanel}>
            <View style={styles.answerDisplay}>
              <Text style={[styles.answerText, answer === '' && styles.answerPlaceholder]}>
                {answer === '' ? '请输入答案' : answer}
              </Text>
            </View>
            {error && <Text style={styles.errorText}>答案错误，请重试</Text>}

            <View style={styles.keypadWrap}>
              <NumberKeypad
                onDigit={handleDigit}
                onBackspace={handleBackspace}
                onSubmit={handleSubmit}
                submitDisabled={answer.length === 0}
              />
            </View>
          </View>
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
  split: {
    flex: 1,
    flexDirection: 'row',
  },
  leftPanel: {
    flex: 3,
    marginRight: 10,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 10,
  },
  boardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  questionLine: {
    fontSize: 22,
    fontWeight: '700',
    color: INK_COLOR,
    flexShrink: 1,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toolButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
    backgroundColor: '#eef3f8',
  },
  toolButtonActive: {
    backgroundColor: '#bbdefb',
  },
  toolText: {
    fontSize: 18,
  },
  board: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    overflow: 'hidden',
  },
  rightPanel: {
    flex: 2,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 10,
  },
  answerDisplay: {
    height: 56,
    marginBottom: 4,
    borderBottomWidth: 2,
    borderColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  answerText: {
    fontSize: 32,
    fontWeight: '600',
    color: ACCENT,
  },
  answerPlaceholder: {
    color: '#bbbbbb',
    fontWeight: '400',
    fontSize: 16,
  },
  errorText: {
    color: ERROR_COLOR,
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 4,
  },
  keypadWrap: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingTop: 4,
  },
});

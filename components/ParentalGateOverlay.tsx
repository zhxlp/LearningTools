import { useEffect, useState } from 'react';
import { Keyboard, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { MathQuestion, ParentalGateSettings } from '../lib/math-types';
import { generateGateQuestion, loadParentalGateSettings } from '../lib/parental-gate';
import NumberKeypad from './NumberKeypad';

export interface ParentalGateOverlayProps {
  visible: boolean;
  onSuccess: () => void;
  onClose: () => void;
}

const ACCENT = '#1976d2';
const ERROR_COLOR = '#d32f2f';
const INK_COLOR = '#222222';
const MAX_ANSWER_LENGTH = 6;
// 家长验证题目（任务一阶段为固定简单算式）。数字键仅提供 0-9，答案只允许数字。
const DIGIT_ONLY = /^\d$/;

// 家长验证盖层：居中白卡显示算式，配虚拟数字键输入答案。
// 答对(onSuccess)/答错(换题或重试按设置)/关闭(onClose)均由调用方接入，
// 本组件只负责出题、判题与错误态（无音效）。
export default function ParentalGateOverlay(props: ParentalGateOverlayProps): React.JSX.Element {
  const { visible, onSuccess, onClose } = props;

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
    // 答错后按设置决定换新题或保留原题重试。
    if (settings.wrongAnswerMode === 'new') {
      setQuestion(generateGateQuestion(settings));
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>家长验证</Text>
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

          <Text style={styles.question}>
            {question ? `${question.expr} = ?` : '……'}
          </Text>

          <View style={styles.answerDisplay}>
            <Text style={[styles.answerText, answer === '' && styles.answerPlaceholder]}>
              {answer === '' ? '请输入答案' : answer}
            </Text>
          </View>

          {error && <Text style={styles.errorText}>答案错误，请重试</Text>}

          <NumberKeypad
            onDigit={handleDigit}
            onBackspace={handleBackspace}
            onSubmit={handleSubmit}
            submitDisabled={answer.length === 0}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: INK_COLOR,
  },
  closeButton: {
    padding: 6,
  },
  closeText: {
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '600',
    color: ACCENT,
  },
  question: {
    fontSize: 32,
    fontWeight: '700',
    color: INK_COLOR,
    textAlign: 'center',
    marginBottom: 16,
  },
  answerDisplay: {
    height: 52,
    marginBottom: 6,
    borderBottomWidth: 2,
    borderColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  answerText: {
    fontSize: 30,
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
    marginVertical: 6,
  },
});

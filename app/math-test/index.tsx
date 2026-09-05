import { MaterialIcons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import { type Href, useNavigation, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import audioWrong from '../../assets/audio/game_wrong_choice.mp3';
import ColumnarLayout from '../../components/ColumnarLayout';
import { DrawingPad, type DrawingPadHandle } from '../../components/DrawingPad';
import NumberKeypad from '../../components/NumberKeypad';
import ParentalGateOverlay from '../../components/ParentalGateOverlay';
import { type MathQuestion, type MathQuestionRecord, type MathRound, type MathSettings, type ColumnarStyle } from '../../lib/math-types';
import { generateQuestionFromSettings } from '../../lib/math-question';
import { loadMathSettings, saveMathSettings } from '../../lib/math-settings';
import { saveRound } from '../../lib/math-storage';

// 配色沿用听力页/全局设置：白卡片、蓝 #1976d2 高亮、绿 #4CAF50、红 #f44336、连续橙 #ff9800。
const ACCENT = '#1976d2';
const GREEN = '#4CAF50';
const RED = '#f44336';
const ORANGE = '#ff9800';
const INK = '#222222';
const BOARD_BG = '#f5f5f5';

// 答对后出下一题前停留（绿色反馈展示），答错换新题模式下红闪后出下一题的停留。
const CORRECT_NEXT_DELAY_MS = 800;
const WRONG_NEW_DELAY_MS = 400;
// 结果最大位数上限（含乘法的 2×4 位积）。
const MAX_ANSWER_LENGTH = 9;

// 就地排版步进范围。
const STYLE_LIMITS = {
  digitSize: { min: 24, max: 80, step: 2 },
  rowGap: { min: 4, max: 60, step: 2 },
  colGap: { min: 0, max: 30, step: 2 },
};

type Feedback = 'idle' | 'correct' | 'wrong';

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

export default function MathTestIndexScreen(): React.JSX.Element {
  const router = useRouter();
  const navigation = useNavigation();
  const wrongPlayer = useAudioPlayer(audioWrong);

  const padRef = useRef<DrawingPadHandle | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 当前展示的题是否已落盘（答对关闭，或 new 换题作废）。true 期间离开不再补记该题。
  const currentRecordedRef = useRef(false);

  // 轮次起点：进入页面即开始一轮；离开页面（unmount/返回）才结算保存。
  const [roundStartedMs] = useState<number>(() => Date.now());

  // 设置（含题型/难度/答错后行为）与就地排版样式；载入完成后才渲染题目区。
  const [settings, setSettings] = useState<MathSettings | null>(null);
  const [columnarStyle, setColumnarStyle] = useState<ColumnarStyle>({ digitSize: 44, rowGap: 20, colGap: 6 });

  // 当前题与轮次统计。
  const [question, setQuestion] = useState<MathQuestion | null>(null);
  const [qStartedAtISO, setQStartedAtISO] = useState('');
  const [wrongs, setWrongs] = useState(0); // 当前题累计答错次数（每出下一题归零）
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<Feedback>('idle');
  const [busy, setBusy] = useState(false); // 已判定等待出下一题的过渡态，期间锁定输入
  const [streak, setStreak] = useState(0);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionIncorrect, setSessionIncorrect] = useState(0);
  const [records, setRecords] = useState<MathQuestionRecord[]>([]);
  const [firstAnswerAtISO, setFirstAnswerAtISO] = useState<string | null>(null);

  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [styleOpen, setStyleOpen] = useState(false);
  const [gateVisible, setGateVisible] = useState(false);

  // 手写板实际尺寸（宿主测量后让 DrawingPad 填满整块画区，墨迹区大于印刷竖式）。
  const [padArea, setPadArea] = useState({ width: 0, height: 0 });

  const clearPendingTimer = (): void => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // 出下一题：换题目、清手写、复位本题状态。settings 已在载入后保证非空。
  const presentNext = (): void => {
    if (!settings) return;
    currentRecordedRef.current = false; // 新题重新武装“未落盘”状态
    const q = generateQuestionFromSettings(settings.enabledOps, settings.difficulty);
    setQuestion(q);
    setQStartedAtISO(new Date().toISOString());
    setWrongs(0);
    setAnswer('');
    setFeedback('idle');
    setBusy(false);
    padRef.current?.clear();
  };

  // 挂载：锁横屏、载设置并出第一题；卸载：解锁、清计时器。
  useEffect(() => {
    let cancelled = false;
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    (async () => {
      const loaded = await loadMathSettings();
      if (cancelled) return;
      setSettings(loaded);
      setColumnarStyle(loaded.columnarStyle);
      setQuestion(generateQuestionFromSettings(loaded.enabledOps, loaded.difficulty));
      setQStartedAtISO(new Date().toISOString());
    })();
    return () => {
      cancelled = true;
      clearPendingTimer();
      ScreenOrientation.unlockAsync();
    };
  }, []);

  // 离开页面（真正 pop 掉本屏；push settings/report 不会触发）时结算保存本轮。
  const saveRoundRef = useRef<() => void>(() => {});
  const buildAndSaveRound = (): void => {
    // 0 次提交 → 不保存：以“是否提交过”为准（仅答错的 retry 轮无 records 也必须保存）。
    if (firstAnswerAtISO == null) return;
    const questions = [...records];
    // 收尾时：当前题已答错（wrongs>0）但尚未落盘（未答对关闭、也未被 new 换题作废），
    // 以开放记录随轮保存，避免该轮答错数据丢失；已落盘的题不重复补记。
    if (question && wrongs > 0 && !currentRecordedRef.current) {
      questions.push({
        a: question.a,
        b: question.b,
        op: question.op,
        expr: question.expr,
        correct: 0,
        incorrect: wrongs,
        startedAtISO: qStartedAtISO,
      });
    }
    const round: MathRound = {
      id: String(roundStartedMs),
      startedAtISO: new Date(roundStartedMs).toISOString(),
      firstAnswerAtISO,
      correct: sessionCorrect,
      incorrect: sessionIncorrect,
      questions,
    };
    saveRound(round).catch(() => {
      // 落盘失败静默：不阻塞返回导航。
    });
  };
  saveRoundRef.current = buildAndSaveRound;

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', () => {
      saveRoundRef.current();
    });
    return unsub;
  }, [navigation]);

  const playWrong = (): void => {
    wrongPlayer.seekTo(0);
    wrongPlayer.play();
  };

  // 答对：首答即对连续 +1；关闭当前题记录（correct:1, incorrect:本题答错数）。
  const handleCorrect = (): void => {
    if (!question || !qStartedAtISO) return;
    setBusy(true);
    setFeedback('correct');
    setAnswer('');
    if (firstAnswerAtISO == null) setFirstAnswerAtISO(new Date().toISOString());
    if (wrongs === 0) setStreak((s) => s + 1);
    setSessionCorrect((c) => c + 1);
    const record: MathQuestionRecord = {
      a: question.a,
      b: question.b,
      op: question.op,
      expr: question.expr,
      correct: 1,
      incorrect: wrongs,
      startedAtISO: qStartedAtISO,
      answeredAtISO: new Date().toISOString(),
    };
    setRecords((prev) => [...prev, record]);
    currentRecordedRef.current = true; // 本题已关闭落盘，出下一题前离开不再补记
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      presentNext();
    }, CORRECT_NEXT_DELAY_MS);
  };

  // 答错：错误数 +1、连续归零、红闪 + 音效；new → 本题作废写开放记录并出下一题；retry → 保留本题。
  const handleWrong = (): void => {
    if (!question || !qStartedAtISO) return;
    setFeedback('wrong');
    setAnswer('');
    playWrong();
    if (firstAnswerAtISO == null) setFirstAnswerAtISO(new Date().toISOString());
    setSessionIncorrect((i) => i + 1);
    setStreak(0);
    const nextWrongs = wrongs + 1;
    setWrongs(nextWrongs);
    if (settings?.wrongAnswerMode === 'new') {
      const record: MathQuestionRecord = {
        a: question.a,
        b: question.b,
        op: question.op,
        expr: question.expr,
        correct: 0,
        incorrect: nextWrongs,
        startedAtISO: qStartedAtISO,
      };
      setRecords((prev) => [...prev, record]);
      currentRecordedRef.current = true; // 本题已作废落盘，出下一题前离开不再补记
      setBusy(true);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        presentNext();
      }, WRONG_NEW_DELAY_MS);
    }
  };

  const handleSubmit = (): void => {
    if (!question || busy || feedback !== 'idle' || answer === '') return;
    if (Number(answer) === question.result) {
      handleCorrect();
    } else {
      handleWrong();
    }
  };

  const handleDigit = (d: string): void => {
    if (busy) return;
    setFeedback('idle');
    setAnswer((prev) => (prev.length >= MAX_ANSWER_LENGTH ? prev : prev + d));
  };

  const handleBackspace = (): void => {
    if (busy) return;
    setFeedback('idle');
    setAnswer((prev) => prev.slice(0, -1));
  };

  // 就地排版改动即时生效并持久化到 mathTestSettings.columnarStyle。
  const changeColumnarStyle = (patch: Partial<ColumnarStyle>): void => {
    const next = { ...columnarStyle, ...patch };
    setColumnarStyle(next);
    if (settings) {
      saveMathSettings({ ...settings, columnarStyle: next }).catch(() => {
        // 持久化失败静默。
      });
    }
  };

  const onPadAreaLayout = (e: { nativeEvent: { layout: { width: number; height: number } } }): void => {
    const { width, height } = e.nativeEvent.layout;
    setPadArea({ width, height });
  };

  const notReady = settings == null || question == null;

  // 答案栏内容：正常为输入数字；空时按反馈态给出 ✓/✗/？占位提示。
  const answerContent = answer !== ''
    ? answer
    : feedback === 'correct'
      ? '✓'
      : feedback === 'wrong'
        ? '✗'
        : '?';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.container}>
        {/* ===== 左屏：头部 + 白板 ===== */}
        <View style={styles.leftPanel}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => setGateVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="设置"
            >
              <MaterialIcons name="settings" size={24} color={ACCENT} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => router.push('/math-test/report' as Href)}
              accessibilityRole="button"
              accessibilityLabel="学习报表"
            >
              <MaterialIcons name="assessment" size={24} color={ACCENT} />
            </TouchableOpacity>
            <View style={styles.statsPill}>
              <Text style={styles.statsLabel}>本次答题: </Text>
              <Text style={[styles.statsValue, styles.correctText]}>正确 {sessionCorrect}</Text>
              <Text style={[styles.statsValue, styles.incorrectText]}>错误 {sessionIncorrect}</Text>
              <Text style={[styles.statsValue, styles.streakText]}>连续 {streak}</Text>
            </View>
          </View>

          <View style={styles.board}>
            {notReady ? (
              <View style={styles.loadingWrap}>
                <Text style={styles.loadingText}>加载中……</Text>
              </View>
            ) : (
              <>
                <Text style={styles.questionLine}>{question.expr} = ?</Text>

                {/* 手写画区：DrawingPad 填满整块，白板中央印刷竖式（下层、被动，不被橡皮擦除） */}
                <View style={styles.padArea} onLayout={onPadAreaLayout}>
                  {padArea.width > 0 && padArea.height > 0 && (
                    <DrawingPad ref={padRef} tool={tool} canvasColor="#ffffff">
                      <View
                        style={{
                          width: padArea.width,
                          height: padArea.height,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <ColumnarLayout
                          a={question.a}
                          b={question.b}
                          op={question.op}
                          style={columnarStyle}
                        />
                      </View>
                    </DrawingPad>
                  )}
                </View>

                {/* 🅰️ 就地排版面板：字号/行距/列距步进，改动即时生效并持久化 */}
                {styleOpen && (
                  <View style={styles.stylePanel}>
                    <Stepper
                      label="字号"
                      value={columnarStyle.digitSize}
                      min={STYLE_LIMITS.digitSize.min}
                      max={STYLE_LIMITS.digitSize.max}
                      step={STYLE_LIMITS.digitSize.step}
                      onChange={(v) => changeColumnarStyle({ digitSize: v })}
                    />
                    <Stepper
                      label="行距"
                      value={columnarStyle.rowGap}
                      min={STYLE_LIMITS.rowGap.min}
                      max={STYLE_LIMITS.rowGap.max}
                      step={STYLE_LIMITS.rowGap.step}
                      onChange={(v) => changeColumnarStyle({ rowGap: v })}
                    />
                    <Stepper
                      label="列距"
                      value={columnarStyle.colGap}
                      min={STYLE_LIMITS.colGap.min}
                      max={STYLE_LIMITS.colGap.max}
                      step={STYLE_LIMITS.colGap.step}
                      onChange={(v) => changeColumnarStyle({ colGap: v })}
                    />
                  </View>
                )}

                {/* 白板工具栏：笔/橡皮 切换、清空、排版开合 */}
                <View style={styles.toolbar}>
                  <TouchableOpacity
                    style={[styles.toolButton, tool === 'pen' && styles.toolButtonActive]}
                    onPress={() => setTool('pen')}
                  >
                    <Text style={[styles.toolText, tool === 'pen' && styles.toolTextActive]}>✏️笔</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toolButton, tool === 'eraser' && styles.toolButtonActive]}
                    onPress={() => setTool('eraser')}
                  >
                    <Text style={[styles.toolText, tool === 'eraser' && styles.toolTextActive]}>🧽橡皮</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.toolButton}
                    onPress={() => padRef.current?.clear()}
                  >
                    <Text style={styles.toolText}>🗑️清空</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toolButton, styleOpen && styles.toolButtonActive]}
                    onPress={() => setStyleOpen((v) => !v)}
                  >
                    <Text style={[styles.toolText, styleOpen && styles.toolTextActive]}>🅰️排版</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>

        {/* ===== 右屏：答案栏 + 数字键盘 ===== */}
        <View style={styles.rightPanel}>
          <View
            style={[
              styles.answerBox,
              feedback === 'correct' && styles.answerBoxCorrect,
              feedback === 'wrong' && styles.answerBoxWrong,
            ]}
          >
            <Text
              style={[
                styles.answerText,
                feedback === 'correct' && styles.answerTextCorrect,
                feedback === 'wrong' && styles.answerTextWrong,
                answer === '' && feedback === 'idle' && styles.answerPlaceholder,
              ]}
            >
              {answerContent}
            </Text>
          </View>

          <View style={styles.keypadWrap}>
            <NumberKeypad
              onDigit={handleDigit}
              onBackspace={handleBackspace}
              onSubmit={handleSubmit}
              submitDisabled={answer === ''}
            />
          </View>
        </View>
      </View>

      <ParentalGateOverlay
        visible={gateVisible}
        onClose={() => setGateVisible(false)}
        onSuccess={() => {
          setGateVisible(false);
          router.push('/math-test/settings' as Href);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BOARD_BG,
  },
  container: {
    flex: 1,
    flexDirection: 'row',
    padding: 8,
  },
  leftPanel: {
    flex: 1,
    marginRight: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  statsPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: '#ffffff',
    borderRadius: 19,
    paddingHorizontal: 12,
    paddingVertical: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  statsLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#555555',
    marginRight: 6,
  },
  statsValue: {
    fontSize: 13,
    fontWeight: '600',
    marginHorizontal: 6,
  },
  correctText: {
    color: GREEN,
  },
  incorrectText: {
    color: RED,
  },
  streakText: {
    color: ORANGE,
    fontWeight: '700',
  },
  board: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 10,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#999999',
  },
  questionLine: {
    fontSize: 22,
    fontWeight: '700',
    color: INK,
    textAlign: 'center',
    marginBottom: 8,
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
    marginTop: 8,
  },
  toolButton: {
    flex: 1,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#cccccc',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 3,
  },
  toolButtonActive: {
    backgroundColor: '#e3f2fd',
    borderColor: ACCENT,
  },
  toolText: {
    fontSize: 13,
    color: '#555555',
  },
  toolTextActive: {
    color: ACCENT,
    fontWeight: '700',
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
  keypadWrap: {
    flex: 1,
  },
});

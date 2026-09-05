import { useEffect, useRef, useState } from 'react';
import { Keyboard, Modal, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';

import type { ColumnarStyle, MathQuestion, ParentalGateSettings } from '../lib/math-types';
import { generateGateQuestion, loadParentalGateSettings } from '../lib/parental-gate';
import { columnarDefaultForWindow, loadMathSettings, loadMathSettingsForWindow, saveMathSettings } from '../lib/math-settings';
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

// 家长验证盖层：采用与计算测试主界面相同的答题面板（左侧题目+竖式印刷+手写区，
// 右侧答案栏+虚拟数字键盘），布局由 CalculationBoard 统一提供；竖式排版就地可调，
// 与主界面共用 mathTestSettings.columnarStyle 持久化。答对(onSuccess)/答错(换题或
// 重试按全局设置)/关闭(onClose) 均由调用方接入，本组件只负责出题、判题与错误态（无音效）。
export default function ParentalGateOverlay(props: ParentalGateOverlayProps): React.JSX.Element {
  const { visible, onSuccess, onClose } = props;

  const { width: winWidth, height: winHeight } = useWindowDimensions();
  // 窗口尺寸镜像进 ref：排版默认/载入只需在打开盖层那一刻取值，不因尺寸变化重开盖层。
  const dimsRef = useRef({ width: winWidth, height: winHeight });
  dimsRef.current = { width: winWidth, height: winHeight };
  // 窄窗（如首页竖屏拉起盖层）用较窄右栏，给左侧竖式留更多宽度；宽窗固定 296。
  const rightWidth = winWidth < 700 ? Math.max(190, Math.round(winWidth * 0.5)) : 296;

  const [settings, setSettings] = useState<ParentalGateSettings | null>(null);
  const [question, setQuestion] = useState<MathQuestion | null>(null);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState(false);
  // 竖式排版与主界面共用同一个存储 key（mathTestSettings.columnarStyle），就地可调并持久化。
  // 无存储时（首启）按设备窗口取合适的默认字号：手机更小、平板/大屏为全尺寸。
  const [columnar, setColumnar] = useState<ColumnarStyle>(() =>
    columnarDefaultForWindow(winWidth, winHeight)
  );

  // 每次打开盖层时重新加载设置并生成新题，同时清空上次输入与错误态，
  // 并同步主界面最新竖式排版。
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
    loadMathSettingsForWindow(dimsRef.current.width, dimsRef.current.height)
      .then((s) => {
        if (cancelled) return;
        setColumnar(s.columnarStyle);
      })
      .catch(() => {});
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

  // 打开盖层即临时锁定横屏（竖屏来源如首页设置入口也会旋转过来），关闭时还原：
  // 来源本已是横屏（听力/计算页锁横屏）则重新锁横屏；竖屏来源则解锁回到竖屏。
  const wasLandscapeRef = useRef(false);
  useEffect(() => {
    if (!visible) return;
    let active = true;
    wasLandscapeRef.current = false;
    (async () => {
      let wasLandscape = false;
      try {
        const o = await ScreenOrientation.getOrientationAsync();
        wasLandscape =
          o === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
          o === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
      } catch {
        // 读失败按“非横屏”处理：关闭时回到竖屏。
      }
      if (!active) {
        // 读取尚未完成就已被关闭：按刚读到的来源恢复。
        if (wasLandscape) {
          ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
        } else {
          ScreenOrientation.unlockAsync().catch(() => {});
        }
        return;
      }
      wasLandscapeRef.current = wasLandscape;
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    })();
    return () => {
      active = false;
      if (wasLandscapeRef.current) {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
      } else {
        ScreenOrientation.unlockAsync().catch(() => {});
      }
    };
  }, [visible]);

  const changeColumnar = (next: ColumnarStyle) => {
    setColumnar(next);
    // 即时重读存储再合并落盘，避免把其他设置项（题型/难度/答错行为）旧快照回写覆盖。
    (async () => {
      try {
        const current = await loadMathSettings();
        await saveMathSettings({ ...current, columnarStyle: next });
      } catch {
        // 落盘失败静默。
      }
    })();
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
              onColumnarStyleChange={changeColumnar}
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

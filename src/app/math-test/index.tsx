import { useAudioPlayer } from "expo-audio";
import {
  type Href,
  useFocusEffect,
  useNavigation,
  useRouter,
} from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import { ChartNoAxesColumn, Settings } from "lucide-react-native";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import audioWrong from "@/assets/audio/game_wrong_choice.mp3";
import {
  CalculationBoard,
  type CalculationBoardHandle,
  type FeedbackState,
} from "@/components/CalculationBoard";
import ParentalGateOverlay from "@/components/ParentalGateOverlay";
import { generateQuestionFromSettings } from "@/lib/math-question";
import {
  loadMathSettings,
  loadMathSettingsForWindow,
  saveMathSettings,
} from "@/lib/math-settings";
import { pruneRoundsOlderThan, saveRound } from "@/lib/math-storage";
import {
  type ColumnarStyle,
  type MathAttempt,
  type MathQuestion,
  type MathQuestionRecord,
  type MathRound,
  type MathSettings,
} from "@/lib/math-types";

// 配色沿用听力页/全局设置：白卡片、蓝 #1976d2 高亮、绿 #4CAF50、红 #f44336、连续橙 #ff9800。
const ACCENT = "#1976d2";
const GREEN = "#4CAF50";
const RED = "#f44336";
const ORANGE = "#ff9800";
const BOARD_BG = "#f5f5f5";

// 答对后出下一题前停留（绿色反馈展示），答错换新题模式下红闪后出下一题的停留。
const CORRECT_NEXT_DELAY_MS = 800;
const WRONG_NEW_DELAY_MS = 400;
// 结果最大位数上限（含乘法的 2×4 位积）。
const MAX_ANSWER_LENGTH = 9;

export default function MathTestIndexScreen(): React.JSX.Element {
  const router = useRouter();
  const navigation = useNavigation();
  const wrongPlayer = useAudioPlayer(audioWrong);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 白板审查：答题面板 ref，每次提交时经它抓取当前手写板快照。
  const boardRef = useRef<CalculationBoardHandle>(null);
  // 当前展示的题是否已落盘（答对关闭，或 new 换题作废）。true 期间离开不再补记该题。
  const currentRecordedRef = useRef(false);
  // 最新已载入的设置快照。出题与答错判定始终读本 ref（每次获得焦点都会刷新），
  // 避免回到本屏后仍沿用挂载时的旧快照，导致设置页修改不生效或被旧快照回写覆盖。
  const settingsRef = useRef<MathSettings | null>(null);

  // 轮次起点：进入页面即开始一轮；离开页面（unmount/返回）才结算保存。
  const [roundStartedMs] = useState<number>(() => Date.now());

  // 设置（含题型/难度/答错后行为）与就地排版样式；载入完成后才渲染题目区。
  const [settings, setSettings] = useState<MathSettings | null>(null);
  const [columnarStyle, setColumnarStyle] = useState<ColumnarStyle>({
    digitSize: 44,
    rowGap: 20,
    colGap: 6,
    padTop: 20,
  });

  // 当前题与轮次统计。
  const [question, setQuestion] = useState<MathQuestion | null>(null);
  const [qStartedAtISO, setQStartedAtISO] = useState("");
  const [wrongs, setWrongs] = useState(0); // 当前题累计答错次数（每出下一题归零）
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<FeedbackState>("idle");
  const [busy, setBusy] = useState(false); // 已判定等待出下一题的过渡态，期间锁定输入
  const [streak, setStreak] = useState(0);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionIncorrect, setSessionIncorrect] = useState(0);
  const [records, setRecords] = useState<MathQuestionRecord[]>([]);
  const [firstAnswerAtISO, setFirstAnswerAtISO] = useState<string | null>(null);

  // 白板审查：当前开放题的提交 attempts。attemptsRef 为真相源——每次提交同步写入，
  // 供同一渲染/回调里立即取到完整列表并嵌入 MathQuestionRecord 落盘；state 仅随
  // presentNext 复位（本屏不渲染该列表，无需读取 state 值）。
  const attemptsRef = useRef<MathAttempt[]>([]);
  const [, setAttempts] = useState<MathAttempt[]>([]);

  const [gateVisible, setGateVisible] = useState(false);

  const clearPendingTimer = (): void => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // 出下一题：换题目、复位本题状态。配置读 settingsRef 以取最新设置
  // （其随焦点重载刷新，定时器触发时也总能拿到当前值，而非触发渲染时的旧快照）。
  const presentNext = useCallback((): void => {
    const current = settingsRef.current;
    if (!current) return;
    currentRecordedRef.current = false; // 新题重新武装“未落盘”状态
    attemptsRef.current = []; // 白板审查：新题的 attempt 列表复位
    setAttempts([]);
    const q = generateQuestionFromSettings(
      current.enabledOps,
      current.difficulty,
    );
    setQuestion(q);
    setQStartedAtISO(new Date().toISOString());
    setWrongs(0);
    setAnswer("");
    setFeedback("idle");
    setBusy(false);
  }, []);

  // 白板审查：记录一次提交（对/错皆记）。先于清空答案调用；快照取整板当前笔迹与
  // 画布尺寸，竖式排版取提交时刻的 columnarStyle 副本。同步写 ref 后同帧立即可读。
  const pushAttempt = (submitted: string, isCorrect: boolean): void => {
    const snapshot = boardRef.current?.getBoardSnapshot();
    const attempt: MathAttempt = {
      atISO: new Date().toISOString(),
      isCorrect,
      submitted,
      canvasWidth: snapshot?.width ?? 0,
      canvasHeight: snapshot?.height ?? 0,
      columnarStyle: { ...columnarStyle },
      strokes: snapshot ? snapshot.strokes : [],
    };
    const next = [...attemptsRef.current, attempt];
    attemptsRef.current = next;
    setAttempts(next);
  };

  // 本屏聚焦即锁横屏、失焦即解锁：子路由（报表/设置页）不再被全局横屏锁覆盖，可跟随设备旋转。
  useFocusEffect(
    useCallback(() => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      return () => {
        ScreenOrientation.unlockAsync();
      };
    }, []),
  );

  // 卸载：清掉未触发的“下一题”计时器（方向锁由上面的聚焦回调负责）。
  useEffect(() => {
    return () => {
      clearPendingTimer();
    };
  }, []);

  // 每次本屏重新获得焦点（从设置/报表页返回）都从存储重载设置，使设置页的修改立即生效。
  // 仅当尚无已载入设置（首次聚焦）时顺带出第一题；返回本屏时保留进行中的题不重置。
  // presentNext 恒等稳定，故本回调只在聚焦/失焦边界运行，不会随每次渲染反复触发。
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const win = Dimensions.get("window");
        const loaded = await loadMathSettingsForWindow(win.width, win.height);
        if (cancelled) return;
        const firstReady = settingsRef.current == null;
        settingsRef.current = loaded;
        setSettings(loaded);
        setColumnarStyle(loaded.columnarStyle);
        if (firstReady) presentNext();
      })();
      return () => {
        cancelled = true;
      };
    }, [presentNext]),
  );

  // 本轮保存（幂等：轮 id=本轮开始时间戳，多次写入同一 key，后写覆盖先写）：
  // 既用于离开页面时结算（fire-and-forget），也用于“点报告”前先把当前进度落盘，
  // 这样报告一进入就能看到本轮刚提交的记录，无需先退出再回来。
  const saveRoundRef = useRef<() => Promise<void>>(async () => {});
  const persistRound = async (): Promise<void> => {
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
        attempts: attemptsRef.current, // 白板审查：随开放记录带上全部提交
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
    try {
      await saveRound(round);
      await pruneRoundsOlderThan(Date.now(), 90 * 24 * 3600 * 1000);
    } catch {
      // 落盘/过期裁剪失败静默：不阻塞返回/跳转。
    }
  };
  // 每次渲染后写入最新一版的 persistRound（ref 写入须在 effect 内，渲染期写会被规则拦下）。
  useEffect(() => {
    saveRoundRef.current = persistRound;
  });

  useEffect(() => {
    const unsub = navigation.addListener("beforeRemove", () => {
      void saveRoundRef.current();
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
    pushAttempt(answer, true); // 白板审查：先抓本次提交快照再清空答案
    setBusy(true);
    setFeedback("correct");
    setAnswer("");
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
      attempts: attemptsRef.current,
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
    pushAttempt(answer, false); // 白板审查：先抓本次提交快照再清空答案（retry 累加到开放题）
    setFeedback("wrong");
    setAnswer("");
    playWrong();
    if (firstAnswerAtISO == null) setFirstAnswerAtISO(new Date().toISOString());
    setSessionIncorrect((i) => i + 1);
    setStreak(0);
    const nextWrongs = wrongs + 1;
    setWrongs(nextWrongs);
    if (settingsRef.current?.wrongAnswerMode === "new") {
      const record: MathQuestionRecord = {
        a: question.a,
        b: question.b,
        op: question.op,
        expr: question.expr,
        correct: 0,
        incorrect: nextWrongs,
        startedAtISO: qStartedAtISO,
        attempts: attemptsRef.current,
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
    if (!question || busy || feedback !== "idle" || answer === "") return;
    if (Number(answer) === question.result) {
      handleCorrect();
    } else {
      handleWrong();
    }
  };

  const handleDigit = (d: string): void => {
    if (busy) return;
    setFeedback("idle");
    setAnswer((prev) => (prev.length >= MAX_ANSWER_LENGTH ? prev : prev + d));
  };

  const handleBackspace = (): void => {
    if (busy) return;
    setFeedback("idle");
    setAnswer((prev) => prev.slice(0, -1));
  };

  // 就地排版改动即时生效并持久化到 mathTestSettings.columnarStyle。
  // 落盘前先重读存储中的最新设置再合并 columnarStyle，避免把设置页并发修改的
  // 题型/难度/答错行为用本屏旧快照回写覆盖。
  const changeColumnarStyle = (patch: Partial<ColumnarStyle>): void => {
    const next = { ...columnarStyle, ...patch };
    setColumnarStyle(next); // 本地状态即时重排竖式
    (async () => {
      const current = await loadMathSettings();
      await saveMathSettings({ ...current, columnarStyle: next });
    })().catch(() => {
      // 重读/持久化失败静默。
    });
  };

  const notReady = settings == null || question == null;

  return (
    <SafeAreaView
      style={styles.safe}
      edges={["top", "bottom", "left", "right"]}
    >
      <View style={styles.container}>
        {/* ===== 上部分：设置 / 报告 / 本次答题计数 ===== */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setGateVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="设置"
          >
            <Settings size={24} color={ACCENT} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={async () => {
              // 先落盘当前轮次进度（含刚提交的记录），再进报表，确保报表立即可见本轮。
              await saveRoundRef.current();
              router.push("/math-test/report" as Href);
            }}
            accessibilityRole="button"
            accessibilityLabel="学习报表"
          >
            <ChartNoAxesColumn size={24} color={ACCENT} />
          </TouchableOpacity>
          <View style={styles.statsPill}>
            <Text style={styles.statsLabel}>本次答题: </Text>
            <Text style={[styles.statsValue, styles.correctText]}>
              正确 {sessionCorrect}
            </Text>
            <Text style={[styles.statsValue, styles.incorrectText]}>
              错误 {sessionIncorrect}
            </Text>
            <Text style={[styles.statsValue, styles.streakText]}>
              连续 {streak}
            </Text>
          </View>
        </View>

        {/* ===== 下部分：左右分屏答题面板（载入中显示占位） ===== */}
        <View style={styles.contentRow}>
          {notReady ? (
            <View style={styles.board}>
              <View style={styles.loadingWrap}>
                <Text style={styles.loadingText}>加载中……</Text>
              </View>
            </View>
          ) : (
            <CalculationBoard
              ref={boardRef}
              question={question}
              columnarStyle={columnarStyle}
              onColumnarStyleChange={(s) => changeColumnarStyle(s)}
              answer={answer}
              feedback={feedback}
              onDigit={handleDigit}
              onBackspace={handleBackspace}
              onSubmit={handleSubmit}
              submitDisabled={answer === ""}
            />
          )}
        </View>
      </View>

      <ParentalGateOverlay
        visible={gateVisible}
        onClose={() => setGateVisible(false)}
        onSuccess={() => {
          setGateVisible(false);
          router.push("/math-test/settings" as Href);
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
    flexDirection: "column",
    padding: 8,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  contentRow: {
    flex: 1,
    flexDirection: "row",
  },
  board: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 10,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  statsPill: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: "auto",
    backgroundColor: "#ffffff",
    borderRadius: 19,
    paddingHorizontal: 12,
    paddingVertical: 8,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  statsLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#555555",
    marginRight: 6,
  },
  statsValue: {
    fontSize: 13,
    fontWeight: "600",
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
    fontWeight: "700",
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#999999",
  },
});

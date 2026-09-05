import { MaterialIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ALL_OPS, OP_SYMBOLS, type MathAttempt, type MathQuestionRecord, type MathRound } from '../../lib/math-types';
import { computeResult } from '../../lib/math-question';
import { accuracy, aggregateRounds, deleteRoundsSince, loadRoundsSince } from '../../lib/math-storage';
import BoardReviewModal from '../../components/BoardReviewModal';

// 报表窗口：近 3 个月。
const WINDOW_MS = 90 * 24 * 3600 * 1000;

// 两位数字补零。
function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// 用本地时区把存盘的 ISO 时间格式化为 MM-DD HH:mm。
function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--';
  return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export default function MathTestReportScreen() {
  // 轮次列表（按 firstAnswerAtISO 降序），及展开查看的轮次 id。
  const [rounds, setRounds] = useState<MathRound[]>([]);
  const [ready, setReady] = useState(false);
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  // 展开查看某题逐次提交列表的 key（round.id:index:expr）。
  const [openQuestionKey, setOpenQuestionKey] = useState<string | null>(null);
  // 待回放白板的提交（含所属题目上下文）；非空时弹出回放弹层。
  const [replay, setReplay] = useState<{ attempt: MathAttempt; q: MathQuestionRecord } | null>(null);

  // 近 3 个月总体聚合（空窗口也返回全 0 的 byOp）。
  const agg = useMemo(() => aggregateRounds(rounds), [rounds]);

  // 载入近 3 个月轮次并按答题时间降序排列。
  const loadData = useCallback(async (): Promise<void> => {
    try {
      const loaded = await loadRoundsSince(Date.now(), WINDOW_MS);
      loaded.sort((a, b) => new Date(b.firstAnswerAtISO).getTime() - new Date(a.firstAnswerAtISO).getTime());
      setRounds(loaded);
      setSelectedRoundId(null);
      setOpenQuestionKey(null);
    } catch (error) {
      console.error('加载计算测试报表失败', error);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // 清除近 3 个月轮次。
  const handleClear = (): void => {
    Alert.alert('确认清除', '清除近 3 个月的轮次记录？此操作无法撤销。', [
      { text: '取消', style: 'cancel' },
      {
        text: '确定',
        style: 'destructive',
        onPress: () => {
          void deleteRoundsSince(Date.now(), WINDOW_MS).then(() => loadData());
        },
      },
    ]);
  };

  // 点按切换轮次展开/收起；换轮次同时收起已展开的题目提交列表。
  const toggleRound = (id: string): void => {
    setOpenQuestionKey(null);
    setSelectedRoundId((prev) => (prev === id ? null : id));
  };

  // 点按切换某题“逐次提交”列表展开/收起。
  const toggleQuestion = (key: string): void => {
    setOpenQuestionKey((prev) => (prev === key ? null : key));
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <ScrollView style={styles.content}>
        {/* 总体统计 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>总体统计 (近3个月)</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{ready ? agg.totalCorrect : '—'}</Text>
              <Text style={styles.statLabel}>正确</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{ready ? agg.totalIncorrect : '—'}</Text>
              <Text style={styles.statLabel}>错误</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{ready ? `${accuracy(agg.totalCorrect, agg.totalIncorrect)}%` : '—'}</Text>
              <Text style={styles.statLabel}>准确率</Text>
            </View>
          </View>
        </View>

        {/* 类型详情 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>类型详情 (近3个月)</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.cellOp]}>题型</Text>
            <Text style={[styles.tableHeaderCell, styles.cellNum]}>正确</Text>
            <Text style={[styles.tableHeaderCell, styles.cellNum]}>错误</Text>
            <Text style={[styles.tableHeaderCell, styles.cellNum]}>正确率</Text>
          </View>
          {ALL_OPS.map((op) => {
            const st = agg.byOp[op];
            return (
              <View key={op} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.cellOp]}>{OP_SYMBOLS[op]}</Text>
                <Text style={[styles.tableCell, styles.cellNum]}>{st.correct}</Text>
                <Text style={[styles.tableCell, styles.cellNum]}>{st.incorrect}</Text>
                <Text style={[styles.tableCell, styles.cellNum]}>{accuracy(st.correct, st.incorrect)}%</Text>
              </View>
            );
          })}
        </View>

        {/* 轮次记录 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>轮次记录 (近3个月)</Text>
            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleClear}
              accessibilityRole="button"
              accessibilityLabel="清除近 3 个月的轮次记录"
            >
              <MaterialIcons name="delete" size={20} color="#f44336" />
            </TouchableOpacity>
          </View>
          {rounds.length === 0 ? (
            <Text style={styles.noDataText}>暂无数据</Text>
          ) : (
            rounds.map((round) => {
              const expanded = round.id === selectedRoundId;
              return (
                <View key={round.id}>
                  <TouchableOpacity
                    style={[styles.recordItem, expanded && styles.selectedRecord]}
                    onPress={() => toggleRound(round.id)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.recordTime}>{fmtTime(round.firstAnswerAtISO)}</Text>
                    <View style={styles.recordStatsWrap}>
                      <Text style={styles.correctText}>正确 {round.correct}</Text>
                      <Text style={styles.incorrectText}>错误 {round.incorrect}</Text>
                    </View>
                  </TouchableOpacity>
                  {expanded && (
                    <View style={styles.detailBlock}>
                      <View style={styles.detailStatsRow}>
                        <View style={styles.statBox}>
                          <Text style={styles.statBoxValue}>{round.correct}</Text>
                          <Text style={styles.statBoxLabel}>正确</Text>
                        </View>
                        <View style={styles.statBox}>
                          <Text style={styles.statBoxValue}>{round.incorrect}</Text>
                          <Text style={styles.statBoxLabel}>错误</Text>
                        </View>
                        <View style={styles.statBox}>
                          <Text style={styles.statBoxValue}>{accuracy(round.correct, round.incorrect)}%</Text>
                          <Text style={styles.statBoxLabel}>准确率</Text>
                        </View>
                      </View>
                      <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderCell, styles.cellExpr]}>题目</Text>
                        <Text style={[styles.tableHeaderCell, styles.cellNum]}>正确</Text>
                        <Text style={[styles.tableHeaderCell, styles.cellNum]}>错误</Text>
                      </View>
                      {round.questions.length === 0 ? (
                        <Text style={styles.noDataText}>暂无题目记录</Text>
                      ) : (
                        round.questions.map((q, index) => {
                          const qkey = `${round.id}:${index}:${q.expr}`;
                          // 该题逐次提交（新→旧）。旧记录无 attempts 字段 → 空列表，不提供展开。
                          const rawAttempts = q.attempts ?? [];
                          const attempts = rawAttempts.length
                            ? [...rawAttempts].sort(
                                (x, y) => new Date(y.atISO).getTime() - new Date(x.atISO).getTime()
                              )
                            : [];
                          const questionOpen = openQuestionKey === qkey;
                          const cells = (
                            <>
                              <Text style={[styles.tableCell, styles.cellExpr]} numberOfLines={1}>
                                {q.expr}
                              </Text>
                              <Text style={[styles.tableCell, styles.cellNum]}>{q.correct}</Text>
                              <Text style={[styles.tableCell, styles.cellNum]}>{q.incorrect}</Text>
                            </>
                          );
                          return (
                            <View key={`${q.expr}-${index}`}>
                              {attempts.length > 0 ? (
                                <TouchableOpacity
                                  style={[
                                    styles.tableRow,
                                    styles.questionRow,
                                    questionOpen && styles.questionRowOpen,
                                  ]}
                                  onPress={() => toggleQuestion(qkey)}
                                  accessibilityRole="button"
                                >
                                  {cells}
                                </TouchableOpacity>
                              ) : (
                                <View style={styles.tableRow}>{cells}</View>
                              )}
                              {questionOpen && (
                                <View style={styles.attemptBlock}>
                                  {attempts.map((att, ai) => (
                                    <View
                                      key={`${att.atISO}-${ai}`}
                                      style={styles.attemptRow}
                                    >
                                      <Text style={styles.attemptTime}>
                                        {fmtTime(att.atISO)}
                                      </Text>
                                      <Text style={styles.attemptBody}>
                                        提交{' '}
                                        <Text style={styles.attemptSubmitted}>
                                          {att.submitted}
                                        </Text>{' '}
                                        <Text
                                          style={
                                            att.isCorrect
                                              ? styles.attemptMarkCorrect
                                              : styles.attemptMarkWrong
                                          }
                                        >
                                          {att.isCorrect ? '✓' : '✗'}
                                        </Text>
                                      </Text>
                                      {att.strokes.length > 0 && (
                                        <TouchableOpacity
                                          style={styles.reviewButton}
                                          onPress={() => setReplay({ attempt: att, q })}
                                          accessibilityRole="button"
                                          accessibilityLabel="查看白板"
                                        >
                                          <Text style={styles.reviewButtonText}>
                                            查看白板
                                          </Text>
                                        </TouchableOpacity>
                                      )}
                                    </View>
                                  ))}
                                </View>
                              )}
                            </View>
                          );
                        })
                      )}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* 白板回放：点“查看白板”挂载的全屏弹层 */}
      {replay != null && (
        <BoardReviewModal
          visible
          onClose={() => setReplay(null)}
          expr={replay.q.expr}
          a={replay.q.a}
          b={replay.q.b}
          op={replay.q.op}
          expectedResult={computeResult(replay.q.a, replay.q.b, replay.q.op)}
          attempt={replay.attempt}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 12,
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  clearButton: {
    padding: 6,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  statLabel: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
  },
  tableHeaderCell: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
  },
  tableCell: {
    fontSize: 14,
    color: '#333333',
    textAlign: 'center',
  },
  cellOp: {
    flex: 1,
    fontWeight: '700',
    color: '#1976d2',
  },
  cellNum: {
    flex: 1,
  },
  cellExpr: {
    flex: 3,
    textAlign: 'left',
    paddingHorizontal: 4,
  },
  recordItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
  },
  selectedRecord: {
    backgroundColor: '#e3f2fd',
  },
  recordTime: {
    fontSize: 16,
    color: '#333333',
  },
  recordStatsWrap: {
    flexDirection: 'row',
  },
  correctText: {
    fontSize: 14,
    color: '#4CAF50',
    marginRight: 16,
  },
  incorrectText: {
    fontSize: 14,
    color: '#f44336',
  },
  detailBlock: {
    paddingHorizontal: 4,
    paddingVertical: 8,
    backgroundColor: '#f0f8ff',
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
  },
  detailStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 6,
  },
  statBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    minWidth: 70,
  },
  statBoxValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  statBoxLabel: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
  },
  noDataText: {
    textAlign: 'center',
    color: '#999999',
    padding: 16,
  },
  questionRow: {
    backgroundColor: '#ffffff',
  },
  questionRowOpen: {
    backgroundColor: '#e3f2fd',
  },
  attemptBlock: {
    backgroundColor: '#f7fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  attemptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e6e6e6',
  },
  attemptTime: {
    fontSize: 13,
    color: '#555555',
    marginRight: 10,
    fontVariant: ['tabular-nums'],
  },
  attemptBody: {
    flex: 1,
    fontSize: 13,
    color: '#333333',
  },
  attemptSubmitted: {
    fontWeight: '700',
    color: '#1976d2',
  },
  attemptMarkCorrect: {
    fontWeight: '700',
    color: '#4CAF50',
  },
  attemptMarkWrong: {
    fontWeight: '700',
    color: '#f44336',
  },
  reviewButton: {
    backgroundColor: '#1976d2',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 8,
  },
  reviewButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
});

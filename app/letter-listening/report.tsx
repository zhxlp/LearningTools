import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';

// 答题记录数据结构
interface IQuizRecord {
  date: string; // YYYY-MM-DD
  correct: number;
  incorrect: number;
  letterStats: {
    [letter: string]: {
      correct: number;
      incorrect: number;
    }
  };
}

// 字母信息
interface ILetterInfo {
  letter: string;
  audio: any;
}

// 字母数据
const LettersData: ILetterInfo[] = [
  { letter: "A", audio: null },
  { letter: "B", audio: null },
  { letter: "C", audio: null },
  { letter: "D", audio: null },
  { letter: "E", audio: null },
  { letter: "F", audio: null },
  { letter: "G", audio: null },
  { letter: "H", audio: null },
  { letter: "I", audio: null },
  { letter: "J", audio: null },
  { letter: "K", audio: null },
  { letter: "L", audio: null },
  { letter: "M", audio: null },
  { letter: "N", audio: null },
  { letter: "O", audio: null },
  { letter: "P", audio: null },
  { letter: "Q", audio: null },
  { letter: "R", audio: null },
  { letter: "S", audio: null },
  { letter: "T", audio: null },
  { letter: "U", audio: null },
  { letter: "V", audio: null },
  { letter: "W", audio: null },
  { letter: "X", audio: null },
  { letter: "Y", audio: null },
  { letter: "Z", audio: null }
];

export default function Report() {
  const router = useRouter();
  const [records, setRecords] = useState<IQuizRecord[]>([]);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [totalIncorrect, setTotalIncorrect] = useState(0);
  const [letterStats, setLetterStats] = useState<{[key: string]: {correct: number, incorrect: number}}>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dailyRecord, setDailyRecord] = useState<IQuizRecord | null>(null);

  useEffect(() => {
    loadQuizRecords();
  }, []);

  // 获取过去3个月的日期范围
  const getDateRange = () => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3);
    return { startDate, endDate };
  };

  // 生成日期范围内的所有日期
  const getAllDatesInRange = (startDate: Date, endDate: Date): string[] => {
    const dates: string[] = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      dates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dates;
  };

  // 加载答题记录
  const loadQuizRecords = async () => {
    try {
      const { startDate, endDate } = getDateRange();
      const allDates = getAllDatesInRange(startDate, endDate);
      
      const loadedRecords: IQuizRecord[] = [];
      let correctCount = 0;
      let incorrectCount = 0;
      const letterStats: {[key: string]: {correct: number, incorrect: number}} = {};
      
      // 初始化字母统计
      LettersData.forEach(letter => {
        letterStats[letter.letter] = { correct: 0, incorrect: 0 };
      });
      
      // 加载每个日期的记录
      for (const date of allDates) {
        const recordKey = `quizRecord_${date}`;
        const recordStr = await AsyncStorage.getItem(recordKey);
        
        if (recordStr) {
          const record: IQuizRecord = JSON.parse(recordStr);
          loadedRecords.push(record);
          
          // 累计统计
          correctCount += record.correct;
          incorrectCount += record.incorrect;
          
          // 累计字母统计
          Object.keys(record.letterStats).forEach(letter => {
            if (letterStats[letter]) {
              letterStats[letter].correct += record.letterStats[letter].correct;
              letterStats[letter].incorrect += record.letterStats[letter].incorrect;
            }
          });
        }
      }
      
      setRecords(loadedRecords);
      setTotalCorrect(correctCount);
      setTotalIncorrect(incorrectCount);
      setLetterStats(letterStats);
    } catch (error) {
      console.error("Error loading quiz records:", error);
    }
  };

  // 加载特定日期的记录
  const loadDailyRecord = async (date: string) => {
    try {
      const recordKey = `quizRecord_${date}`;
      const recordStr = await AsyncStorage.getItem(recordKey);
      
      if (recordStr) {
        const record: IQuizRecord = JSON.parse(recordStr);
        setDailyRecord(record);
      } else {
        setDailyRecord(null);
      }
    } catch (error) {
      console.error("Error loading daily record:", error);
    }
  };

  // 计算准确率
  const getAccuracy = () => {
    const total = totalCorrect + totalIncorrect;
    return total > 0 ? Math.round((totalCorrect / total) * 100) : 0;
  };

  // 获取最近7天的记录
  const getRecentRecords = () => {
    const sortedRecords = [...records].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    return sortedRecords.slice(0, 7);
  };

  // 获取答错最多的字母
  const getMostIncorrectLetters = () => {
    const incorrectLetters = Object.keys(letterStats)
      .map(letter => ({
        letter,
        incorrect: letterStats[letter].incorrect,
        correct: letterStats[letter].correct
      }))
      .filter(item => item.incorrect > 0)
      .sort((a, b) => b.incorrect - a.incorrect);
    
    return incorrectLetters.slice(0, 5);
  };

  // 获取所有记录按日期排序
  const getAllRecordsSorted = () => {
    return [...records].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  };

  // 处理日期选择
  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    loadDailyRecord(date);
  };

  // 获取字母统计详情
  const getLetterStatsDetail = () => {
    return Object.keys(letterStats)
      .map(letter => ({
        letter,
        correct: letterStats[letter].correct,
        incorrect: letterStats[letter].incorrect,
        total: letterStats[letter].correct + letterStats[letter].incorrect,
        accuracy: letterStats[letter].correct + letterStats[letter].incorrect > 0 
          ? Math.round((letterStats[letter].correct / (letterStats[letter].correct + letterStats[letter].incorrect)) * 100)
          : 0
      }))
      .sort((a, b) => a.letter.localeCompare(b.letter));
  };

  // 清除所有记录
  const clearAllRecords = async () => {
    Alert.alert(
      "确认清除",
      "您确定要清除所有学习记录吗？此操作无法撤销。",
      [
        {
          text: "取消",
          style: "cancel"
        },
        {
          text: "确定",
          style: "destructive",
          onPress: async () => {
            try {
              const { startDate, endDate } = getDateRange();
              const allDates = getAllDatesInRange(startDate, endDate);
              
              // 清除每个日期的记录
              for (const date of allDates) {
                const recordKey = `quizRecord_${date}`;
                await AsyncStorage.removeItem(recordKey);
              }
              
              // 重置状态
              setRecords([]);
              setTotalCorrect(0);
              setTotalIncorrect(0);
              setLetterStats({});
              setSelectedDate(null);
              setDailyRecord(null);
              
              Alert.alert("成功", "所有学习记录已清除");
            } catch (error) {
              console.error("Error clearing quiz records:", error);
              Alert.alert("错误", "清除记录时出现问题");
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <ScrollView style={styles.content}>
        {/* 总体统计 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>总体统计 (近3个月)</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{totalCorrect}</Text>
              <Text style={styles.statLabel}>正确</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{totalIncorrect}</Text>
              <Text style={styles.statLabel}>错误</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{getAccuracy()}%</Text>
              <Text style={styles.statLabel}>准确率</Text>
            </View>
          </View>
        </View>

        {/* 所有记录 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>每日记录</Text>
            <TouchableOpacity 
              style={styles.clearButton}
              onPress={clearAllRecords}
            >
              <MaterialIcons name="delete" size={20} color="#f44336" />
            </TouchableOpacity>
          </View>
          {getAllRecordsSorted().map((record, index) => (
            <TouchableOpacity 
              key={index} 
              style={[
                styles.recordItem, 
                selectedDate === record.date && styles.selectedRecord
              ]}
              onPress={() => handleDateSelect(record.date)}
            >
              <Text style={styles.recordDate}>{record.date}</Text>
              <Text style={styles.recordStats}>
                正确: {record.correct} 错误: {record.incorrect}
              </Text>
            </TouchableOpacity>
          ))}
          {getAllRecordsSorted().length === 0 && (
            <Text style={styles.noDataText}>暂无数据</Text>
          )}
        </View>

        {/* 选定日期的详细记录 */}
        {dailyRecord && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{dailyRecord.date} 详细记录</Text>
            <View style={styles.dailyStats}>
              <View style={styles.statBox}>
                <Text style={styles.statBoxValue}>{dailyRecord.correct}</Text>
                <Text style={styles.statBoxLabel}>正确</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statBoxValue}>{dailyRecord.incorrect}</Text>
                <Text style={styles.statBoxLabel}>错误</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statBoxValue}>
                  {dailyRecord.correct + dailyRecord.incorrect > 0 
                    ? Math.round((dailyRecord.correct / (dailyRecord.correct + dailyRecord.incorrect)) * 100) 
                    : 0}%
                </Text>
                <Text style={styles.statBoxLabel}>准确率</Text>
              </View>
            </View>
            
            <Text style={[styles.sectionTitle, { marginTop: 16, fontSize: 16 }]}>字母详情</Text>
            <View style={styles.letterGrid}>
              {Object.keys(dailyRecord.letterStats)
                .sort() // 按字母顺序排序
                .map((letter, index) => {
                const stats = dailyRecord.letterStats[letter];
                return (
                  <View key={index} style={styles.letterDetailItem}>
                    <Text style={styles.letterDetailText}>{letter}</Text>
                    <View style={styles.letterStatsContainer}>
                      <Text style={[styles.letterDetailStat, styles.correctStat]}>
                        {stats.correct}
                      </Text>
                      <Text style={[styles.letterDetailStat, styles.incorrectStat]}>
                        {stats.incorrect}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* 字母统计详情 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>字母统计详情</Text>
          <View style={styles.letterStatsHeader}>
            <Text style={[styles.letterStatsHeaderText, { flex: 1 }]}>字母</Text>
            <Text style={[styles.letterStatsHeaderText, { flex: 1 }]}>正确</Text>
            <Text style={[styles.letterStatsHeaderText, { flex: 1 }]}>错误</Text>
            <Text style={[styles.letterStatsHeaderText, { flex: 1 }]}>总计</Text>
            <Text style={[styles.letterStatsHeaderText, { flex: 1 }]}>准确率</Text>
          </View>
          {getLetterStatsDetail().map((item, index) => (
            <View key={index} style={styles.letterStatsRow}>
              <Text style={[styles.letterStatsText, { flex: 1 }]}>{item.letter}</Text>
              <Text style={[styles.letterStatsText, { flex: 1 }]}>{item.correct}</Text>
              <Text style={[styles.letterStatsText, { flex: 1 }]}>{item.incorrect}</Text>
              <Text style={[styles.letterStatsText, { flex: 1 }]}>{item.total}</Text>
              <Text style={[styles.letterStatsText, { flex: 1 }]}>{item.accuracy}%</Text>
            </View>
          ))}
        </View>

        {/* 答错最多的字母 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>需要加强练习的字母</Text>
          {getMostIncorrectLetters().map((item, index) => (
            <View key={index} style={styles.letterItem}>
              <Text style={styles.letterText}>{item.letter}</Text>
              <View style={styles.letterStats}>
                <Text style={styles.correctStat}>正确: {item.correct}</Text>
                <Text style={styles.incorrectStat}>错误: {item.incorrect}</Text>
              </View>
            </View>
          ))}
          {getMostIncorrectLetters().length === 0 && (
            <Text style={styles.noDataText}>暂无数据</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  content: {
    flex: 1,
    padding: 12,
  },
  section: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  clearButton: {
    padding: 6,
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1976d2",
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  statBox: {
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    backgroundColor: "#f0f8ff",
    borderRadius: 8,
    minWidth: 70,
  },
  statBoxValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1976d2",
  },
  statBoxLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  recordItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  selectedRecord: {
    backgroundColor: "#e3f2fd",
  },
  recordDate: {
    fontSize: 16,
    color: "#333",
  },
  recordStats: {
    fontSize: 14,
    color: "#666",
  },
  dailyStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 10,
  },
  letterGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  letterDetailItem: {
    width: "25%", // 每行显示4个字母
    alignItems: "center",
    paddingVertical: 8,
  },
  letterDetailText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1976d2",
  },
  letterStatsContainer: {
    flexDirection: "row",
    marginTop: 4,
  },
  letterDetailStat: {
    fontSize: 12,
    marginHorizontal: 2,
  },
  letterStatsHeader: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  letterStatsHeaderText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    textAlign: "center",
  },
  letterStatsRow: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  letterStatsText: {
    fontSize: 14,
    color: "#333",
    textAlign: "center",
  },
  letterItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  letterText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1976d2",
    width: 40,
    textAlign: "center",
  },
  letterStats: {
    flexDirection: "row",
  },
  correctStat: {
    fontSize: 14,
    color: "#4CAF50",
    marginRight: 16,
  },
  incorrectStat: {
    fontSize: 14,
    color: "#f44336",
  },
  noDataText: {
    textAlign: "center",
    color: "#999",
    padding: 16,
  },
});
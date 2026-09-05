import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from "@react-native-async-storage/async-storage";
import Slider from "@react-native-community/slider";
import { AudioSource, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useRouter } from "expo-router";
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect, useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import WifiSoundWave from "../../components/WifiSoundWave";
import ParentalGateOverlay from "../../components/ParentalGateOverlay";

// Import all letter audio files
import audioA from "../../assets/audio/letters/a.mp3";
import audioB from "../../assets/audio/letters/b.mp3";
import audioC from "../../assets/audio/letters/c.mp3";
import audioD from "../../assets/audio/letters/d.mp3";
import audioE from "../../assets/audio/letters/e.mp3";
import audioF from "../../assets/audio/letters/f.mp3";
import audioG from "../../assets/audio/letters/g.mp3";
import audioH from "../../assets/audio/letters/h.mp3";
import audioI from "../../assets/audio/letters/i.mp3";
import audioJ from "../../assets/audio/letters/j.mp3";
import audioK from "../../assets/audio/letters/k.mp3";
import audioL from "../../assets/audio/letters/l.mp3";
import audioM from "../../assets/audio/letters/m.mp3";
import audioN from "../../assets/audio/letters/n.mp3";
import audioO from "../../assets/audio/letters/o.mp3";
import audioP from "../../assets/audio/letters/p.mp3";
import audioQ from "../../assets/audio/letters/q.mp3";
import audioR from "../../assets/audio/letters/r.mp3";
import audioS from "../../assets/audio/letters/s.mp3";
import audioT from "../../assets/audio/letters/t.mp3";
import audioU from "../../assets/audio/letters/u.mp3";
import audioV from "../../assets/audio/letters/v.mp3";
import audioW from "../../assets/audio/letters/w.mp3";
import audioX from "../../assets/audio/letters/x.mp3";
import audioY from "../../assets/audio/letters/y.mp3";
import audioZ from "../../assets/audio/letters/z.mp3";

import audioWrong from "../../assets/audio/game_wrong_choice.mp3";

// 数据结构定义
interface ILetterInfo {
  letter: string;
  audio: any;
}

// 字母显示选项枚举
type LetterCaseOption = 'uppercase' | 'lowercase' | 'both' | 'mixed';

// 答错反馈音模式
type WrongFeedbackMode = 'error' | 'letter';

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

// Letter audio data
const LettersData: ILetterInfo[] = [
  { letter: "A", audio: audioA },
  { letter: "B", audio: audioB },
  { letter: "C", audio: audioC },
  { letter: "D", audio: audioD },
  { letter: "E", audio: audioE },
  { letter: "F", audio: audioF },
  { letter: "G", audio: audioG },
  { letter: "H", audio: audioH },
  { letter: "I", audio: audioI },
  { letter: "J", audio: audioJ },
  { letter: "K", audio: audioK },
  { letter: "L", audio: audioL },
  { letter: "M", audio: audioM },
  { letter: "N", audio: audioN },
  { letter: "O", audio: audioO },
  { letter: "P", audio: audioP },
  { letter: "Q", audio: audioQ },
  { letter: "R", audio: audioR },
  { letter: "S", audio: audioS },
  { letter: "T", audio: audioT },
  { letter: "U", audio: audioU },
  { letter: "V", audio: audioV },
  { letter: "W", audio: audioW },
  { letter: "X", audio: audioX },
  { letter: "Y", audio: audioY },
  { letter: "Z", audio: audioZ }
];

// Letter option component
const LetterOption: React.FC<{
  letter: string;
  isSelected: boolean;
  isCorrect: boolean;
  onPress: () => void;
  disabled: boolean;
  letterCaseOption: LetterCaseOption;
}> = ({ letter, isSelected, isCorrect, onPress, disabled, letterCaseOption }) => {
  // Format letter based on the selected case option
  const formatLetter = (letter: string): string => {
    switch (letterCaseOption) {
      case 'uppercase':
        return letter.toUpperCase();
      case 'lowercase':
        return letter.toLowerCase();
      case 'both':
        return `${letter.toUpperCase()}
${letter.toLowerCase()}`;
      case 'mixed':
        // For mixed, we still need to maintain consistency for the same letter
        // We'll use a simple hash of the letter to determine case
        const charCode = letter.charCodeAt(0);
        return charCode % 2 === 0 ? letter.toUpperCase() : letter.toLowerCase();
      default:
        return letter.toUpperCase();
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.letterButton,
        isCorrect && styles.correctButton,
        isSelected && !isCorrect && styles.incorrectButton
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[
        styles.letterText,
        letterCaseOption === 'both' && styles.smallLetterText
      ]}>{formatLetter(letter)}</Text>
    </TouchableOpacity>
  );
};

const AudioPlayer: React.FC<{ audio: AudioSource }> = ({ audio }) => {
  const player = useAudioPlayer(audio);
  const { playing } = useAudioPlayerStatus(player);

  useEffect(() => {
    player.play()
  }, [])

  return (
    <TouchableOpacity onPress={() => {
      player.seekTo(0);
      player.play()
    }} style={styles.playerContainer}>
      <View style={styles.soundWaveContainer}>
        <MaterialIcons name="volume-up" size={40} color="#1976d2" />
        <View style={styles.wifiSoundWaveContainer}>
          <WifiSoundWave isPlaying={playing} size={50} color="#1976d2" />
        </View>
      </View>
      <Text style={styles.playText}>点击播放</Text>
    </TouchableOpacity>
  )
}

export default function LetterListening() {
  const router = useRouter();
  const [currentLetter, setCurrentLetter] = useState<ILetterInfo | null>(null);
  const [previousLetter, setPreviousLetter] = useState<ILetterInfo | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [gameCompleted, setGameCompleted] = useState(false);
  const [selectedIncorrect, setSelectedIncorrect] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [optionCount, setOptionCount] = useState<number>(5);
  const [letterCaseOption, setLetterCaseOption] = useState<LetterCaseOption>('uppercase');
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionIncorrect, setSessionIncorrect] = useState(0);
  const [streakCount, setStreakCount] = useState(0);
  const wrongPlayer = useAudioPlayer(audioWrong);
  const feedbackPlayer = useAudioPlayer(audioA);
  const [wrongFeedbackMode, setWrongFeedbackMode] = useState<WrongFeedbackMode>('error');
  const [gateVisible, setGateVisible] = useState(false);


  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    loadSettings();
    return () => {
      ScreenOrientation.unlockAsync();
    }
  }, []);


  const loadSettings = async () => {
    try {
      const savedOptionCount = await AsyncStorage.getItem('letterListeningOptionCount');
      const savedLetterCaseOption = await AsyncStorage.getItem('letterListeningLetterCaseOption');
      const savedWrongFeedback = await AsyncStorage.getItem('letterListeningWrongFeedback');

      if (savedOptionCount) {
        setOptionCount(parseInt(savedOptionCount));
      }

      if (savedLetterCaseOption) {
        setLetterCaseOption(savedLetterCaseOption as LetterCaseOption);
      }

      if (savedWrongFeedback === 'error' || savedWrongFeedback === 'letter') {
        setWrongFeedbackMode(savedWrongFeedback);
      }

      startNewGame(parseInt(savedOptionCount || '') || 5);
    } catch (error) {
      console.error("Error loading settings:", error);
      startNewGame(5);
    }
  };


  const saveSettings = async (count: number, letterCase: LetterCaseOption, wrongFeedback: WrongFeedbackMode) => {
    try {
      await AsyncStorage.setItem('letterListeningOptionCount', count.toString());
      await AsyncStorage.setItem('letterListeningLetterCaseOption', letterCase);
      await AsyncStorage.setItem('letterListeningWrongFeedback', wrongFeedback);
      setOptionCount(count);
      setLetterCaseOption(letterCase);
      setWrongFeedbackMode(wrongFeedback);
      startNewGame(count);
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  };


  // 获取今天的日期字符串 (YYYY-MM-DD)
  const getTodayDate = (): string => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };


  // 更新答题记录
  const updateQuizRecord = async (isCorrect: boolean, letter: string) => {
    try {
      const today = getTodayDate();
      const recordKey = `quizRecord_${today}`;

      // 获取今天的记录
      const existingRecordStr = await AsyncStorage.getItem(recordKey);
      let record: IQuizRecord = {
        date: today,
        correct: 0,
        incorrect: 0,
        letterStats: {}
      };

      // 如果已有记录，则合并
      if (existingRecordStr) {
        record = JSON.parse(existingRecordStr);
      }

      // 更新统计
      if (isCorrect) {
        record.correct += 1;
      } else {
        record.incorrect += 1;
      }

      // 初始化字母统计
      if (!record.letterStats[letter]) {
        record.letterStats[letter] = { correct: 0, incorrect: 0 };
      }

      // 更新字母统计
      if (isCorrect) {
        record.letterStats[letter].correct += 1;
      } else {
        record.letterStats[letter].incorrect += 1;
      }

      // 保存记录
      await AsyncStorage.setItem(recordKey, JSON.stringify(record));
    } catch (error) {
      console.error("Error updating quiz record:", error);
    }
  };


  const startNewGame = (count: number = optionCount) => {
    // Reset game state
    setGameCompleted(false);
    setSelectedIncorrect(null);

    // Select a random letter (ensure it's not the same as the previous one)
    let availableLetters = LettersData;
    if (previousLetter) {
      availableLetters = LettersData.filter(l => l.letter !== previousLetter.letter);
    }

    const randomIndex = Math.floor(Math.random() * availableLetters.length);
    const selectedLetter = availableLetters[randomIndex];

    // Update previous letter
    setPreviousLetter(selectedLetter);
    setCurrentLetter(selectedLetter);

    // Generate options (1 correct + (count-1) random incorrect)
    const incorrectCount = count - 1;
    const otherLetters = LettersData.filter(l => l.letter !== selectedLetter.letter);
    const shuffled = [...otherLetters].sort(() => 0.5 - Math.random());
    const incorrectOptions = shuffled.slice(0, incorrectCount).map(l => l.letter);
    const allOptions = [selectedLetter.letter, ...incorrectOptions].sort(() => 0.5 - Math.random());

    setOptions(allOptions);
  };



  const handleLetterSelect = (selectedLetter: string) => {
    if (gameCompleted) return;

    if (currentLetter && selectedLetter === currentLetter.letter) {
      // Correct selection
      setSessionCorrect(sessionCorrect + 1);
      setStreakCount((count) => count + 1);
      updateQuizRecord(true, currentLetter.letter);
      setGameCompleted(true);
      // Automatically start a new game after a short delay
      setTimeout(() => startNewGame(), 1000);
    } else {
      // 答错反馈音：错误提示音 或 所点字母的发音
      if (wrongFeedbackMode === 'letter') {
        const clicked = LettersData.find((l) => l.letter === selectedLetter);
        if (clicked) {
          feedbackPlayer.replace(clicked.audio);
          feedbackPlayer.seekTo(0);
          feedbackPlayer.play();
        } else {
          wrongPlayer.seekTo(0);
          wrongPlayer.play();
        }
      } else {
        wrongPlayer.seekTo(0);
        wrongPlayer.play();
      }
      // Incorrect selection - show visual feedback
      setSessionIncorrect(sessionIncorrect + 1);
      setStreakCount(0);
      updateQuizRecord(false, selectedLetter);
      setSelectedIncorrect(selectedLetter);
      // Clear the incorrect selection after a short delay
      setTimeout(() => {
        setSelectedIncorrect(null);
      }, 1000);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.container}>
        {/* Settings Button */}
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => setGateVisible(true)}
        >
          <MaterialIcons name="settings" size={24} color="#1976d2" />
        </TouchableOpacity>

        {/* Report Button */}
        <TouchableOpacity
          style={styles.reportButton}
          onPress={() => router.push("/letter-listening/report")}
        >
          <MaterialIcons name="assessment" size={24} color="#1976d2" />
        </TouchableOpacity>

        {/* Statistics Display */}
        <View style={styles.statsContainer}>
          <Text style={styles.statsText}>本次答题: </Text>
          <Text style={[styles.statsText, styles.correctText]}>正确 {sessionCorrect}</Text>
          <Text style={[styles.statsText, styles.incorrectText]}>错误 {sessionIncorrect}</Text>
          <Text style={[styles.statsText, styles.streakText]}>连续 {streakCount}</Text>
        </View>

        {/* Audio Player */}
        {currentLetter ? <AudioPlayer key={currentLetter.letter} audio={currentLetter.audio} /> : null}

        {/* Letter Options */}
        <View style={styles.optionsContainer}>
          {options.map((letter, index) => (
            <LetterOption
              key={index}
              letter={letter}
              isSelected={selectedIncorrect === letter}
              isCorrect={gameCompleted && currentLetter?.letter === letter}
              onPress={() => handleLetterSelect(letter)}
              disabled={gameCompleted}
              letterCaseOption={letterCaseOption}
            />
          ))}
        </View>
      </View>

      <ParentalGateOverlay
        visible={gateVisible}
        onClose={() => setGateVisible(false)}
        onSuccess={() => { setGateVisible(false); setShowSettings(true); }}
      />

      {/* Settings Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showSettings}
        onRequestClose={() => setShowSettings(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>设置</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowSettings(false)}
              >
                <MaterialIcons name="close" size={24} color="#1976d2" />
              </TouchableOpacity>
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>选项数量: {optionCount}</Text>
              <View style={styles.sliderContainer}>
                <Text style={styles.sliderLabel}>3</Text>
                <View style={styles.sliderWrapper}>
                  <Slider
                    style={styles.slider}
                    minimumValue={3}
                    maximumValue={8}
                    step={1}
                    value={optionCount}
                    onValueChange={setOptionCount}
                    minimumTrackTintColor="#1976d2"
                    maximumTrackTintColor="#d3d3d3"
                  />
                </View>
                <Text style={styles.sliderLabel}>8</Text>
              </View>
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>字母显示:</Text>
              <View style={styles.optionButtons}>
                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    letterCaseOption === 'uppercase' && styles.selectedOptionButton
                  ]}
                  onPress={() => setLetterCaseOption('uppercase')}
                >
                  <Text style={[
                    styles.optionButtonText,
                    letterCaseOption === 'uppercase' && styles.selectedOptionButtonText
                  ]}>大写</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    letterCaseOption === 'lowercase' && styles.selectedOptionButton
                  ]}
                  onPress={() => setLetterCaseOption('lowercase')}
                >
                  <Text style={[
                    styles.optionButtonText,
                    letterCaseOption === 'lowercase' && styles.selectedOptionButtonText
                  ]}>小写</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    letterCaseOption === 'both' && styles.selectedOptionButton
                  ]}
                  onPress={() => setLetterCaseOption('both')}
                >
                  <Text style={[
                    styles.optionButtonText,
                    letterCaseOption === 'both' && styles.selectedOptionButtonText
                  ]}>同时</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    letterCaseOption === 'mixed' && styles.selectedOptionButton
                  ]}
                  onPress={() => setLetterCaseOption('mixed')}
                >
                  <Text style={[
                    styles.optionButtonText,
                    letterCaseOption === 'mixed' && styles.selectedOptionButtonText
                  ]}>混搭</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>答错反馈:</Text>
              <View style={styles.optionButtons}>
                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    wrongFeedbackMode === 'error' && styles.selectedOptionButton
                  ]}
                  onPress={() => setWrongFeedbackMode('error')}
                >
                  <Text style={[
                    styles.optionButtonText,
                    wrongFeedbackMode === 'error' && styles.selectedOptionButtonText
                  ]}>错误音</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    wrongFeedbackMode === 'letter' && styles.selectedOptionButton
                  ]}
                  onPress={() => setWrongFeedbackMode('letter')}
                >
                  <Text style={[
                    styles.optionButtonText,
                    wrongFeedbackMode === 'letter' && styles.selectedOptionButtonText
                  ]}>字母发音</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={() => {
                saveSettings(optionCount, letterCaseOption, wrongFeedbackMode);
                setShowSettings(false);
              }}
            >
              <Text style={styles.saveButtonText}>完成</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  container: {
    flex: 1,
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 12,
    position: 'relative',
  },
  settingsButton: {
    position: "absolute",
    top: 0,
    right: 12,
    zIndex: 10,
    backgroundColor: "white",
    borderRadius: 16,
    padding: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  reportButton: {
    position: "absolute",
    top: 0,
    right: 56,
    zIndex: 10,
    backgroundColor: "white",
    borderRadius: 16,
    padding: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "white",
    padding: 8,
    borderRadius: 8,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  statsText: {
    fontSize: 14,
    fontWeight: "500",
    marginHorizontal: 8,
  },
  correctText: {
    color: "#4CAF50",
  },
  incorrectText: {
    color: "#f44336",
  },
  streakText: {
    color: "#ff9800",
    fontWeight: "700",
  },
  playerContainer: {
    alignItems: "center",
    padding: 16,
    backgroundColor: "white",
    borderRadius: 40,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  soundWaveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wifiSoundWaveContainer: {
    marginLeft: 12,
  },
  playText: {
    marginTop: 12,
    fontSize: 14,
    color: "#1976d2",
    fontWeight: "500",
  },
  optionsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    width: "80%",
  },
  letterButton: {
    backgroundColor: "white",
    width: 70,
    height: 70,
    justifyContent: "center",
    alignItems: "center",
    margin: 8,
    borderRadius: 8,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  correctButton: {
    backgroundColor: "#4CAF50",
  },
  incorrectButton: {
    backgroundColor: "#f44336",
  },
  letterText: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
  },
  smallLetterText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    lineHeight: 28,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 16,
    width: "80%",
    maxWidth: 360,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  closeButton: {
    padding: 4,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 14,
  },
  optionButtons: {
    flexDirection: "row",
  },
  optionButton: {
    backgroundColor: "#e0e0e0",
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginHorizontal: 3,
  },
  selectedOptionButton: {
    backgroundColor: "#1976d2",
  },
  optionButtonText: {
    fontSize: 14,
    color: "#333",
  },
  selectedOptionButtonText: {
    color: "white",
  },
  saveButton: {
    backgroundColor: "#1976d2",
    borderRadius: 4,
    padding: 10,
    alignItems: "center",
  },
  saveButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  sliderContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginHorizontal: 8,
  },
  sliderWrapper: {
    flex: 1,
    marginHorizontal: 8,
  },
  slider: {
    width: "100%",
    height: 32,
  },
  sliderLabel: {
    fontSize: 14,
    color: "#333",
  },
});
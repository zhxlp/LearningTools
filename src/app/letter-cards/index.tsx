import { AudioPlayer, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import WifiSoundWave from "@/components/WifiSoundWave";

// 导入所有字母音频文件
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";

import audioA from "@/assets/audio/letters/a.mp3";
import audioB from "@/assets/audio/letters/b.mp3";
import audioC from "@/assets/audio/letters/c.mp3";
import audioD from "@/assets/audio/letters/d.mp3";
import audioE from "@/assets/audio/letters/e.mp3";
import audioF from "@/assets/audio/letters/f.mp3";
import audioG from "@/assets/audio/letters/g.mp3";
import audioH from "@/assets/audio/letters/h.mp3";
import audioI from "@/assets/audio/letters/i.mp3";
import audioJ from "@/assets/audio/letters/j.mp3";
import audioK from "@/assets/audio/letters/k.mp3";
import audioL from "@/assets/audio/letters/l.mp3";
import audioM from "@/assets/audio/letters/m.mp3";
import audioN from "@/assets/audio/letters/n.mp3";
import audioO from "@/assets/audio/letters/o.mp3";
import audioP from "@/assets/audio/letters/p.mp3";
import audioQ from "@/assets/audio/letters/q.mp3";
import audioR from "@/assets/audio/letters/r.mp3";
import audioS from "@/assets/audio/letters/s.mp3";
import audioT from "@/assets/audio/letters/t.mp3";
import audioU from "@/assets/audio/letters/u.mp3";
import audioV from "@/assets/audio/letters/v.mp3";
import audioW from "@/assets/audio/letters/w.mp3";
import audioX from "@/assets/audio/letters/x.mp3";
import audioY from "@/assets/audio/letters/y.mp3";
import audioZ from "@/assets/audio/letters/z.mp3";

interface ILetterInfo {
  letter: string;
  pronounce: string;
  audio: any;
}

// 字母发音数据
const LettersData: ILetterInfo[] = [
  { letter: "A", pronounce: "/eɪ/", audio: audioA },
  { letter: "B", pronounce: "/biː/", audio: audioB },
  { letter: "C", pronounce: "/siː/", audio: audioC },
  { letter: "D", pronounce: "/diː/", audio: audioD },
  { letter: "E", pronounce: "/iː/", audio: audioE },
  { letter: "F", pronounce: "/ef/", audio: audioF },
  { letter: "G", pronounce: "/dʒiː/", audio: audioG },
  { letter: "H", pronounce: "/eɪtʃ/", audio: audioH },
  { letter: "I", pronounce: "/aɪ/", audio: audioI },
  { letter: "J", pronounce: "/dʒeɪ/", audio: audioJ },
  { letter: "K", pronounce: "/keɪ/", audio: audioK },
  { letter: "L", pronounce: "/el/", audio: audioL },
  { letter: "M", pronounce: "/em/", audio: audioM },
  { letter: "N", pronounce: "/en/", audio: audioN },
  { letter: "O", pronounce: "/əʊ/", audio: audioO },
  { letter: "P", pronounce: "/piː/", audio: audioP },
  { letter: "Q", pronounce: "/kjuː/", audio: audioQ },
  { letter: "R", pronounce: "/ɑː(r)/", audio: audioR },
  { letter: "S", pronounce: "/es/", audio: audioS },
  { letter: "T", pronounce: "/tiː/", audio: audioT },
  { letter: "U", pronounce: "/juː/", audio: audioU },
  { letter: "V", pronounce: "/viː/", audio: audioV },
  { letter: "W", pronounce: "/ˈdʌbljuː/", audio: audioW },
  { letter: "X", pronounce: "/eks/", audio: audioX },
  { letter: "Y", pronounce: "/waɪ/", audio: audioY },
  { letter: "Z", pronounce: "/ziː/", audio: audioZ },
];

interface ILetterCard extends ILetterInfo {
  play: (player: AudioPlayer) => void;
}

type CaseMode = "upper" | "lower" | "both";

const CASE_MODE_STORAGE_KEY = "letter-cards.caseMode";
const isCaseMode = (value: string | null): value is CaseMode =>
  value === "upper" || value === "lower" || value === "both";

// Fisher-Yates shuffle algorithm
const shuffleArray = (array: ILetterInfo[]) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const LetterCard: React.FC<ILetterCard & { caseMode: CaseMode }> = ({
  audio,
  letter,
  pronounce,
  play,
  caseMode,
}) => {
  const player = useAudioPlayer(audio);
  const { playing } = useAudioPlayerStatus(player);

  const isBoth = caseMode === "both";
  const displayLetter = caseMode === "lower" ? letter.toLowerCase() : letter;

  return (
    <TouchableOpacity style={styles.card} onPress={() => play(player)}>
      {isBoth ? (
        <>
          <Text style={styles.uppercase}>{letter}</Text>
          <Text style={styles.lowercase}>{letter.toLowerCase()}</Text>
        </>
      ) : (
        <Text style={styles.singleLetter}>{displayLetter}</Text>
      )}
      <View style={styles.pronounceContainer}>
        <Text style={styles.pronounceText}>{pronounce}</Text>
      </View>
      <View style={styles.soundWaveContainer}>
        <WifiSoundWave isPlaying={playing} size={20} color="#52a8e6ff" />
      </View>
    </TouchableOpacity>
  );
};

type DisplayMode = "sequential" | "random";

export default function LetterCards() {
  const [displayMode, setDisplayMode] = useState<DisplayMode>("sequential");
  const [caseMode, setCaseMode] = useState<CaseMode>("both");
  const [shuffledLetters, setShuffledLetters] =
    useState<ILetterInfo[]>(LettersData);
  const lastPlayPlayerRef = useRef<AudioPlayer>(null);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(CASE_MODE_STORAGE_KEY)
      .then((stored) => {
        if (mounted && isCaseMode(stored)) {
          setCaseMode(stored);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const handleCaseModeChange = useCallback((mode: CaseMode) => {
    setCaseMode(mode);
    AsyncStorage.setItem(CASE_MODE_STORAGE_KEY, mode).catch(() => {});
  }, []);

  const play = useCallback((player: AudioPlayer) => {
    if (lastPlayPlayerRef.current?.playing) {
      lastPlayPlayerRef.current?.pause();
    }
    lastPlayPlayerRef.current = player;
    player.seekTo(0);
    player.play();
  }, []);

  const handleShuffle = useCallback(() => {
    const shuffled = shuffleArray(LettersData);
    setShuffledLetters(shuffled);
    setDisplayMode("random");
  }, []);

  const handleSequential = useCallback(() => {
    setShuffledLetters(LettersData);
    setDisplayMode("sequential");
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={[
              styles.modeButton,
              displayMode === "sequential" && styles.activeModeButton,
            ]}
            onPress={handleSequential}
          >
            <Text
              style={[
                styles.modeButtonText,
                displayMode === "sequential" && styles.activeModeButtonText,
              ]}
            >
              顺序
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modeButton,
              displayMode === "random" && styles.activeModeButton,
            ]}
            onPress={handleShuffle}
          >
            <Text
              style={[
                styles.modeButtonText,
                displayMode === "random" && styles.activeModeButtonText,
              ]}
            >
              随机
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={[
              styles.modeButton,
              caseMode === "upper" && styles.activeModeButton,
            ]}
            onPress={() => handleCaseModeChange("upper")}
          >
            <Text
              style={[
                styles.modeButtonText,
                caseMode === "upper" && styles.activeModeButtonText,
              ]}
            >
              大写
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modeButton,
              caseMode === "lower" && styles.activeModeButton,
            ]}
            onPress={() => handleCaseModeChange("lower")}
          >
            <Text
              style={[
                styles.modeButtonText,
                caseMode === "lower" && styles.activeModeButtonText,
              ]}
            >
              小写
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modeButton,
              caseMode === "both" && styles.activeModeButton,
            ]}
            onPress={() => handleCaseModeChange("both")}
          >
            <Text
              style={[
                styles.modeButtonText,
                caseMode === "both" && styles.activeModeButtonText,
              ]}
            >
              大小写
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.grid}>
          {shuffledLetters.map((item) => (
            <LetterCard
              key={item.letter}
              {...item}
              play={play}
              caseMode={caseMode}
            />
          ))}
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
  header: {
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: 3,
  },
  modeButton: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 60,
    alignItems: "center",
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: "#1976d2",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  activeModeButton: {
    backgroundColor: "#1976d2",
    borderColor: "#1976d2",
  },
  modeButtonText: {
    color: "#1976d2",
    fontSize: 16,
    fontWeight: "600",
  },
  activeModeButtonText: {
    color: "white",
  },
  scrollContainer: {
    padding: 8,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  card: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 12,
    margin: 4,
    width: 90,
    height: 110,
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  uppercase: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 4,
  },
  lowercase: {
    fontSize: 18,
    marginBottom: 8,
  },
  singleLetter: {
    fontSize: 40,
    fontWeight: "bold",
    lineHeight: 48,
    marginBottom: 8,
  },
  pronounceContainer: {
    backgroundColor: "#e3f2fd",
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pronounceText: {
    fontSize: 11,
    color: "#1976d2",
    fontWeight: "500",
  },
  soundWaveContainer: {
    position: "absolute",
    top: 4,
    right: 4,
  },
});

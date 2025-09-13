import { AudioPlayer, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import WifiSoundWave from "../../components/WifiSoundWave";

// 导入所有字母音频文件
import { useCallback, useRef } from 'react';
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
  { letter: "Z", pronounce: "/ziː/", audio: audioZ }
];

interface ILetterCard extends ILetterInfo {
  play: (player: AudioPlayer) => void
}

const LetterCard: React.FC<ILetterCard> = ({ audio, letter, pronounce, play }) => {
  const player = useAudioPlayer(audio);
  const { playing } = useAudioPlayerStatus(player);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => play(player)}
    >
      <Text style={styles.uppercase}>{letter}</Text>
      <Text style={styles.lowercase}>{letter.toLowerCase()}</Text>
      <View style={styles.pronounceContainer}>
        <Text style={styles.pronounceText}>{pronounce}</Text>
      </View>
      <View style={styles.soundWaveContainer}>
        <WifiSoundWave isPlaying={playing} size={20} color="#52a8e6ff" />
      </View>
    </TouchableOpacity>
  )
}



export default function LetterCards() {
  const lastPlayPlayerRef = useRef<AudioPlayer>(null);
  const play = useCallback((player: AudioPlayer) => {
    if (lastPlayPlayerRef.current?.playing) {
      lastPlayPlayerRef.current?.pause()
    };
    lastPlayPlayerRef.current = player;
    player.seekTo(0);
    player.play();
  }, [])

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.grid}>
          {LettersData.map((item) => (
            <LetterCard key={item.letter} {...item} play={play} />
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
    position: 'absolute',
    top: 4,
    right: 4
  },
});


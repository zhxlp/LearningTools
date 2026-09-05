import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// 与听力测试主页面保持一致的字面量类型
type LetterCaseOption = 'uppercase' | 'lowercase' | 'both' | 'mixed';
type WrongFeedbackMode = 'error' | 'letter';

const LETTER_CASE_OPTIONS: { value: LetterCaseOption; label: string }[] = [
  { value: 'uppercase', label: '大写' },
  { value: 'lowercase', label: '小写' },
  { value: 'both', label: '同时' },
  { value: 'mixed', label: '混搭' },
];

const WRONG_FEEDBACK_OPTIONS: { value: WrongFeedbackMode; label: string }[] = [
  { value: 'error', label: '错误音' },
  { value: 'letter', label: '字母发音' },
];

const STORAGE_KEYS = {
  optionCount: 'letterListeningOptionCount',
  letterCase: 'letterListeningLetterCaseOption',
  wrongFeedback: 'letterListeningWrongFeedback',
};

const OPTION_COUNT_MIN = 3;
const OPTION_COUNT_MAX = 8;

const ACCENT = '#1976d2';

function CaseChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function LetterListeningSettingsPage() {
  const router = useRouter();
  const [optionCount, setOptionCount] = useState(5);
  const [letterCase, setLetterCase] = useState<LetterCaseOption>('uppercase');
  const [wrongFeedback, setWrongFeedback] = useState<WrongFeedbackMode>('error');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [countStr, caseStr, feedbackStr] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.optionCount),
          AsyncStorage.getItem(STORAGE_KEYS.letterCase),
          AsyncStorage.getItem(STORAGE_KEYS.wrongFeedback),
        ]);
        if (!mounted) return;
        if (countStr) {
          const parsed = parseInt(countStr, 10);
          if (!Number.isNaN(parsed)) {
            setOptionCount(Math.min(OPTION_COUNT_MAX, Math.max(OPTION_COUNT_MIN, parsed)));
          }
        }
        if (caseStr && (LETTER_CASE_OPTIONS as { value: string }[]).some((o) => o.value === caseStr)) {
          setLetterCase(caseStr as LetterCaseOption);
        }
        if (feedbackStr === 'error' || feedbackStr === 'letter') {
          setWrongFeedback(feedbackStr);
        }
      } catch (error) {
        console.error('加载听力测试设置失败', error);
      } finally {
        if (mounted) setLoaded(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleDone = async (): Promise<void> => {
    if (saving) return;
    setSaving(true);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.optionCount, String(optionCount));
      await AsyncStorage.setItem(STORAGE_KEYS.letterCase, letterCase);
      await AsyncStorage.setItem(STORAGE_KEYS.wrongFeedback, wrongFeedback);
    } catch (error) {
      console.error('保存听力测试设置失败', error);
    }
    router.back();
  };

  if (!loaded) {
    return <View style={styles.safe} />;
  }

  return (
    <View style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* 选项数量 */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>选项数量</Text>
          <View style={styles.sliderRow}>
            <Text style={styles.sliderEndText}>{OPTION_COUNT_MIN}</Text>
            <Slider
              style={styles.slider}
              minimumValue={OPTION_COUNT_MIN}
              maximumValue={OPTION_COUNT_MAX}
              step={1}
              value={optionCount}
              onValueChange={setOptionCount}
              minimumTrackTintColor={ACCENT}
              maximumTrackTintColor="#d3d3d3"
            />
            <Text style={styles.sliderEndText}>{OPTION_COUNT_MAX}</Text>
          </View>
          <Text style={styles.sliderCurrent}>当前 {optionCount}</Text>
        </View>

        {/* 字母显示 */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>字母显示</Text>
          <View style={styles.chipRow}>
            {LETTER_CASE_OPTIONS.map((opt) => (
              <CaseChip
                key={opt.value}
                label={opt.label}
                active={letterCase === opt.value}
                onPress={() => setLetterCase(opt.value)}
              />
            ))}
          </View>
        </View>

        {/* 答错反馈 */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>答错反馈</Text>
          <View style={styles.radioGroup}>
            {WRONG_FEEDBACK_OPTIONS.map((opt) => {
              const selected = wrongFeedback === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={styles.radioRow}
                  onPress={() => setWrongFeedback(opt.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                    {selected ? <View style={styles.radioInner} /> : null}
                  </View>
                  <Text style={styles.radioLabel}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 完成 */}
        <TouchableOpacity
          style={[styles.doneButton, saving && styles.doneButtonDisabled]}
          onPress={handleDone}
          disabled={saving}
        >
          <Text style={styles.doneButtonText}>完成</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sliderEndText: {
    fontSize: 14,
    color: '#333',
    width: 20,
    textAlign: 'center',
  },
  slider: {
    flex: 1,
    height: 32,
  },
  sliderCurrent: {
    fontSize: 14,
    color: ACCENT,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 16,
    marginRight: 8,
    marginBottom: 4,
  },
  chipActive: {
    backgroundColor: ACCENT,
  },
  chipInactive: {
    backgroundColor: '#e0e0e0',
  },
  chipText: {
    fontSize: 14,
    color: '#333',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  radioGroup: {
    paddingVertical: 2,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#bdbdbd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  radioOuterSelected: {
    borderColor: ACCENT,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ACCENT,
  },
  radioLabel: {
    fontSize: 14,
    color: '#333',
  },
  doneButton: {
    backgroundColor: ACCENT,
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  doneButtonDisabled: {
    opacity: 0.6,
  },
  doneButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

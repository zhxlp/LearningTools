import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ALL_OPS, OpType, ParentalGateSettings, WrongAnswerMode } from '../lib/math-types';
import { loadParentalGateSettings, saveParentalGateSettings } from '../lib/parental-gate';

const OP_LABELS: Record<OpType, string> = {
  '+': '加法',
  '-': '减法',
  '*': '乘法',
  '÷': '除法',
};

const WRONG_MODE_OPTIONS: { value: WrongAnswerMode; label: string }[] = [
  { value: 'new', label: '换新题' },
  { value: 'retry', label: '继续此题' },
];

const DIGIT_MIN = 1;
const DIGIT_MAX = 4;

const ACCENT = '#1976d2';

type ChipProps = {
  label: string;
  active: boolean;
  onPress: () => void;
};

function OpChip({ label, active, onPress }: ChipProps) {
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

type StepButtonProps = {
  symbol: string;
  disabled: boolean;
  onPress: () => void;
};

function StepButton({ symbol, disabled, onPress }: StepButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.stepButton, disabled && styles.stepButtonDisabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <Text style={[styles.stepButtonText, disabled && styles.stepButtonTextDisabled]}>{symbol}</Text>
    </TouchableOpacity>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<ParentalGateSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadParentalGateSettings().then((loaded) => {
      if (mounted) setSettings(loaded);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Toggle an op's membership in enabledOps, but never allow emptying the list.
  const toggleOp = (op: OpType): void => {
    setSettings((s) => {
      if (!s) return s;
      const includes = s.enabledOps.includes(op);
      if (includes && s.enabledOps.length <= 1) return s;
      const enabledOps = includes
        ? s.enabledOps.filter((x) => x !== op)
        : [...s.enabledOps, op];
      return { ...s, enabledOps };
    });
  };

  // Bump one digit bound; pull the other bound along so min <= max always holds.
  const adjustDigits = (field: 'min' | 'max', delta: -1 | 1): void => {
    setSettings((s) => {
      if (!s) return s;
      let min = s.digits.min;
      let max = s.digits.max;
      if (field === 'min') {
        const next = Math.min(DIGIT_MAX, Math.max(DIGIT_MIN, min + delta));
        if (next === min) return s;
        min = next;
        if (min > max) max = Math.min(DIGIT_MAX, min);
      } else {
        const next = Math.min(DIGIT_MAX, Math.max(DIGIT_MIN, max + delta));
        if (next === max) return s;
        max = next;
        if (min > max) min = Math.max(DIGIT_MIN, max);
      }
      return { ...s, digits: { min, max } };
    });
  };

  const setWrongAnswerMode = (mode: WrongAnswerMode): void => {
    setSettings((s) => (s ? { ...s, wrongAnswerMode: mode } : s));
  };

  const handleDone = async (): Promise<void> => {
    if (!settings || saving) return;
    setSaving(true);
    try {
      await saveParentalGateSettings(settings);
    } catch (e) {
      console.error('保存设置失败', e);
    }
    router.back();
  };

  if (!settings) {
    return <View style={styles.safe} />;
  }

  const minMinusDisabled = settings.digits.min <= DIGIT_MIN;
  const minPlusDisabled = settings.digits.min >= DIGIT_MAX;
  const maxMinusDisabled = settings.digits.max <= DIGIT_MIN;
  const maxPlusDisabled = settings.digits.max >= DIGIT_MAX;

  return (
    <View style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* 计算类型 */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>计算类型</Text>
          <View style={styles.chipRow}>
            {ALL_OPS.map((op) => (
              <OpChip
                key={op}
                label={OP_LABELS[op]}
                active={settings.enabledOps.includes(op)}
                onPress={() => toggleOp(op)}
              />
            ))}
          </View>
        </View>

        {/* 位数难度 */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>位数难度</Text>
          <View style={styles.digitsRow}>
            <View style={styles.digitCol}>
              <Text style={styles.digitLabel}>最少位数</Text>
              <View style={styles.stepperRow}>
                <StepButton symbol="−" disabled={minMinusDisabled} onPress={() => adjustDigits('min', -1)} />
                <Text style={styles.stepperValue}>{settings.digits.min}</Text>
                <StepButton symbol="+" disabled={minPlusDisabled} onPress={() => adjustDigits('min', 1)} />
              </View>
            </View>
            <View style={styles.digitCol}>
              <Text style={styles.digitLabel}>最多位数</Text>
              <View style={styles.stepperRow}>
                <StepButton symbol="−" disabled={maxMinusDisabled} onPress={() => adjustDigits('max', -1)} />
                <Text style={styles.stepperValue}>{settings.digits.max}</Text>
                <StepButton symbol="+" disabled={maxPlusDisabled} onPress={() => adjustDigits('max', 1)} />
              </View>
            </View>
          </View>
        </View>

        {/* 答错后 */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>答错后</Text>
          <View style={styles.radioGroup}>
            {WRONG_MODE_OPTIONS.map((opt) => {
              const selected = settings.wrongAnswerMode === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={styles.radioRow}
                  onPress={() => setWrongAnswerMode(opt.value)}
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
  digitsRow: {
    flexDirection: 'row',
  },
  digitCol: {
    flex: 1,
    alignItems: 'center',
  },
  digitLabel: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepButtonDisabled: {
    borderColor: '#e0e0e0',
  },
  stepButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: ACCENT,
    lineHeight: 22,
  },
  stepButtonTextDisabled: {
    color: '#bdbdbd',
  },
  stepperValue: {
    minWidth: 40,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
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

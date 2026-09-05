import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ALL_OPS, MathSettings, OpType, WrongAnswerMode } from '../../lib/math-types';
import { loadMathSettings, saveMathSettings } from '../../lib/math-settings';

const OP_LABELS: Record<OpType, string> = {
  '+': '加法',
  '-': '减法',
  '*': '乘法',
  '÷': '除法',
};

const WRONG_MODE_OPTIONS: { value: WrongAnswerMode; label: string }[] = [
  { value: 'retry', label: '继续此题' },
  { value: 'new', label: '换新题' },
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

type DifficultyRowProps = {
  opLabel: string;
  enabled: boolean;
  minDigits: number;
  maxDigits: number;
  divider: boolean;
  onAdjust: (field: 'min' | 'max', delta: -1 | 1) => void;
};

// One op's 难度 row: a fixed-width op name on the left and, beside it, the two
// 最少位数 / 最多位数 −/+ steppers. When the op is not in enabledOps the whole
// row renders grayed out and every stepper is disabled (已禁用题型行灰显不可改).
function DifficultyRow({ opLabel, enabled, minDigits, maxDigits, divider, onAdjust }: DifficultyRowProps) {
  const minMinusDisabled = minDigits <= DIGIT_MIN;
  const minPlusDisabled = minDigits >= DIGIT_MAX;
  const maxMinusDisabled = maxDigits <= DIGIT_MIN;
  const maxPlusDisabled = maxDigits >= DIGIT_MAX;
  return (
    <View style={[styles.diffRow, divider && styles.diffRowDivider]}>
      <Text style={[styles.diffOpLabel, !enabled && styles.textDisabled]}>{opLabel}</Text>
      <View style={styles.diffCol}>
        <Text style={[styles.digitLabel, !enabled && styles.textDisabled]}>最少位数</Text>
        <View style={styles.stepperRow}>
          <StepButton
            symbol="−"
            disabled={!enabled || minMinusDisabled}
            onPress={() => onAdjust('min', -1)}
          />
          <Text style={[styles.stepperValue, !enabled && styles.textDisabled]}>{minDigits}</Text>
          <StepButton
            symbol="+"
            disabled={!enabled || minPlusDisabled}
            onPress={() => onAdjust('min', 1)}
          />
        </View>
      </View>
      <View style={styles.diffCol}>
        <Text style={[styles.digitLabel, !enabled && styles.textDisabled]}>最多位数</Text>
        <View style={styles.stepperRow}>
          <StepButton
            symbol="−"
            disabled={!enabled || maxMinusDisabled}
            onPress={() => onAdjust('max', -1)}
          />
          <Text style={[styles.stepperValue, !enabled && styles.textDisabled]}>{maxDigits}</Text>
          <StepButton
            symbol="+"
            disabled={!enabled || maxPlusDisabled}
            onPress={() => onAdjust('max', 1)}
          />
        </View>
      </View>
    </View>
  );
}

export default function MathTestSettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<MathSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadMathSettings().then((loaded) => {
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

  // Bump one digit bound of a single op; pull the other bound along so
  // min <= max always holds. Only the edited op's difficulty entry is replaced,
  // so other ops (incl. disabled ones) keep the values that were loaded.
  const adjustDigits = (op: OpType, field: 'min' | 'max', delta: -1 | 1): void => {
    setSettings((s) => {
      if (!s) return s;
      const cur = s.difficulty[op];
      let min = cur.minDigits;
      let max = cur.maxDigits;
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
      return { ...s, difficulty: { ...s.difficulty, [op]: { minDigits: min, maxDigits: max } } };
    });
  };

  const setWrongAnswerMode = (mode: WrongAnswerMode): void => {
    setSettings((s) => (s ? { ...s, wrongAnswerMode: mode } : s));
  };

  const handleDone = async (): Promise<void> => {
    if (!settings || saving) return;
    setSaving(true);
    try {
      await saveMathSettings(settings);
    } catch (e) {
      console.error('保存计算测试设置失败', e);
    }
    router.back();
  };

  if (!settings) {
    return <View style={styles.safe} />;
  }

  return (
    <View style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* 题目类型 */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>题目类型</Text>
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

        {/* 难度 · 数字位数 */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>难度 · 数字位数</Text>
          {ALL_OPS.map((op, i) => {
            const enabled = settings.enabledOps.includes(op);
            const d = settings.difficulty[op];
            return (
              <DifficultyRow
                key={op}
                opLabel={OP_LABELS[op]}
                enabled={enabled}
                minDigits={d.minDigits}
                maxDigits={d.maxDigits}
                divider={i < ALL_OPS.length - 1}
                onAdjust={(field, delta) => adjustDigits(op, field, delta)}
              />
            );
          })}
        </View>

        {/* 答题行为 */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>答题行为</Text>
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
  diffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  diffRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  diffOpLabel: {
    width: 44,
    marginRight: 8,
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  diffCol: {
    flex: 1,
    alignItems: 'center',
  },
  digitLabel: {
    fontSize: 13,
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
    minWidth: 30,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  textDisabled: {
    color: '#bdbdbd',
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

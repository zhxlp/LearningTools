import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export interface NumberKeypadProps {
  onDigit: (d: string) => void;
  onBackspace: () => void;
  onSubmit: () => void;
  submitDisabled?: boolean;
  submitLabel?: string;
}

// 数字键区域布局：前三行 1-9，最后一行（空位 + 0 + 退格）。
const DIGIT_ROWS: string[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
];

const ACCENT = '#1976d2';

export default function NumberKeypad(props: NumberKeypadProps): React.JSX.Element {
  const { onDigit, onBackspace, onSubmit } = props;
  const submitLabel = props.submitLabel ?? '确定';
  const submitDisabled = props.submitDisabled ?? false;

  return (
    <View style={styles.container}>
      {DIGIT_ROWS.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((digit) => (
            <TouchableOpacity
              key={digit}
              style={styles.key}
              onPress={() => onDigit(digit)}
            >
              <Text style={styles.keyText}>{digit}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
      <View style={styles.row}>
        <View style={styles.blankCell} />
        <TouchableOpacity style={styles.key} onPress={() => onDigit('0')}>
          <Text style={styles.keyText}>0</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.key} onPress={onBackspace}>
          <Text style={styles.keyText}>⌫</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={[styles.submit, submitDisabled && styles.submitDisabled]}
        onPress={onSubmit}
        disabled={submitDisabled}
      >
        <Text style={styles.submitText}>{submitLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  key: {
    flex: 1,
    height: 56,
    marginHorizontal: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: ACCENT,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 与按键占位等宽（flex + 外边距），保证 0 键居中、退格键靠右。
  blankCell: {
    flex: 1,
    marginHorizontal: 6,
  },
  keyText: {
    fontSize: 26,
    fontWeight: '600',
    color: ACCENT,
  },
  submit: {
    height: 52,
    marginTop: 4,
    borderRadius: 26,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
});

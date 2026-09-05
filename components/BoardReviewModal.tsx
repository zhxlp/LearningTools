import type React from 'react';
import { useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

import type { ColumnarStyle, MathAttempt, OpType } from '../lib/math-types';
import ColumnarLayout from './ColumnarLayout';

export interface BoardReviewModalProps {
  visible: boolean;
  onClose: () => void;
  expr: string;          // e.g. "23 + 45"
  a: number; b: number; op: OpType;
  expectedResult: number;
  attempt: MathAttempt;  // 有 canvas + columnarStyle + strokes + submitted + isCorrect
}

// 白板回放：全屏重放某次提交时的印刷竖式（按当时排版缩放）与叠加其上的矢量笔迹。
// 竖式印刷层与答题现场一致渲染在笔迹之上（现场即如此：笔迹画在印刷层下方，
// 橡皮/画笔都不可能盖住印刷竖式），比例尺 = min(availW/canvasW, availH/canvasH)。
const GREEN = '#4CAF50';
const RED = '#f44336';
const ACCENT = '#1976d2';
const INK = '#222222';

// 把 SVG 点串（“x,y x,y …”）按 scale 放大，得到同一坐标系下放大后的点串。
function scalePoints(points: string, scale: number): string {
  if (scale === 1) return points;
  return points
    .split(' ')
    .map((pt) => {
      const comma = pt.indexOf(',');
      if (comma <= 0 || comma === pt.length - 1) return pt;
      const x = parseFloat(pt.slice(0, comma)) * scale;
      const y = parseFloat(pt.slice(comma + 1)) * scale;
      return Number.isFinite(x) && Number.isFinite(y) ? `${x},${y}` : pt;
    })
    .join(' ');
}

export default function BoardReviewModal(props: BoardReviewModalProps): React.JSX.Element {
  const { visible, onClose, expr, a, b, op, expectedResult, attempt } = props;

  // 回放区可用尺寸（onLayout 测得），据此反推比例尺使快照按宽高比尽量铺满。
  const [avail, setAvail] = useState({ width: 0, height: 0 });

  const onAreaLayout = (e: LayoutChangeEvent): void => {
    const { width, height } = e.nativeEvent.layout;
    setAvail({ width, height });
  };

  const cw = attempt.canvasWidth;
  const ch = attempt.canvasHeight;
  const scale =
    cw > 0 && ch > 0 && avail.width > 0 && avail.height > 0
      ? Math.min(avail.width / cw, avail.height / ch)
      : 0;
  const boxW = cw * scale;
  const boxH = ch * scale;

  const scaledColumnarStyle = useMemo<ColumnarStyle>(() => {
    const cs = attempt.columnarStyle ?? { digitSize: 44, rowGap: 20, colGap: 6 };
    return {
      digitSize: cs.digitSize * scale,
      rowGap: cs.rowGap * scale,
      colGap: cs.colGap * scale,
    };
  }, [attempt.columnarStyle, scale]);

  const markColor = attempt.isCorrect ? GREEN : RED;
  const mark = attempt.isCorrect ? '✓' : '✗';

  return (
    <Modal
      animationType="fade"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>白板回放</Text>
            <Text style={styles.hint}>该次提交时的手写板</Text>
          </View>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="关闭白板回放"
          >
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.captionWrap}>
          <Text style={styles.caption}>
            {expr} = ?　提交 <Text style={styles.captionSubmitted}>{attempt.submitted}</Text>{' '}
            <Text style={{ color: markColor, fontWeight: '700' }}>{mark}</Text>
            <Text style={styles.captionDivider}>　正确答案 {expectedResult}</Text>
          </Text>
        </View>

        <View style={styles.area} onLayout={onAreaLayout}>
          {cw <= 0 || ch <= 0 ? (
            <Text style={styles.emptyText}>暂无白板画面</Text>
          ) : scale > 0 ? (
            <View
              style={[
                styles.boardBox,
                { width: boxW, height: boxH },
              ]}
            >
              {/* 笔迹层先渲染（在底）；印刷竖式后渲染（在上），与现场一致 */}
              <Svg
                width={boxW}
                height={boxH}
                style={styles.strokeSvg}
                pointerEvents="none"
              >
                {attempt.strokes.map((stroke, index) => (
                  <Polyline
                    key={index}
                    points={scalePoints(stroke.points, scale)}
                    stroke={stroke.color}
                    strokeWidth={stroke.width * scale}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </Svg>
              <View
                style={[
                  styles.columnarWrap,
                  { width: boxW, height: boxH, paddingTop: 20 * scale },
                ]}
                pointerEvents="none"
              >
                <ColumnarLayout a={a} b={b} op={op} style={scaledColumnarStyle} />
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#eef3f8',
    padding: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingBottom: 6,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexShrink: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: INK,
    marginRight: 10,
  },
  hint: {
    fontSize: 12,
    color: '#666666',
    flexShrink: 1,
  },
  closeButton: {
    padding: 6,
  },
  closeText: {
    fontSize: 24,
    lineHeight: 26,
    fontWeight: '600',
    color: ACCENT,
  },
  captionWrap: {
    paddingHorizontal: 6,
    paddingBottom: 8,
  },
  caption: {
    fontSize: 15,
    color: '#333333',
  },
  captionSubmitted: {
    color: ACCENT,
    fontWeight: '700',
  },
  captionDivider: {
    color: '#666666',
  },
  area: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boardBox: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  strokeSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  columnarWrap: {
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#999999',
  },
});

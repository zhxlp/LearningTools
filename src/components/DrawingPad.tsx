import type { ReactNode } from "react";
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { GestureResponderEvent, LayoutChangeEvent } from "react-native";
import { PanResponder, StyleSheet, View } from "react-native";
import Svg, { Polyline } from "react-native-svg";

// 白板快照：采集时刻已提交笔迹 + 测量到的画布尺寸（坐标系=画布像素）。
// 结构与内部 Stroke 相同（结构别名），便于外部以快照形状存盘。
export interface DrawingPadSnapshot {
  width: number; // measured canvas width
  height: number; // measured canvas height
  strokes: { points: string; color: string; width: number }[];
}

export interface DrawingPadHandle {
  clear: () => void;
  getSnapshot: () => DrawingPadSnapshot | null;
}

export interface DrawingPadProps {
  tool: "pen" | "eraser";
  penColor?: string;
  canvasColor?: string;
  children?: ReactNode;
}

// 画笔/橡皮颜色与线宽常量。橡皮不“删除”已有笔画，而是在笔画层上画一道
// 画布色粗笔触盖住下方笔迹（白板擦除）。印刷内容（children，即竖式）始终渲染在
// 笔画层之上，因此橡皮/画笔都不可能盖住或擦掉印刷的竖式。
const PEN_COLOR = "#1a237e";
const PEN_WIDTH = 4;
const CANVAS_COLOR = "#ffffff";
const ERASER_COLOR = "#ffffff";
const ERASER_WIDTH = 18;

// 一条已完成笔画：points 为 SVG polyline 点串（“x,y x,y …”）。
type Stroke = { points: string; color: string; width: number };

const clampCoord = (value: number, max: number): number =>
  Math.min(Math.max(value, 0), max);

export const DrawingPad = forwardRef<DrawingPadHandle, DrawingPadProps>(
  (props, ref): React.JSX.Element => {
    const { canvasColor, children } = props;

    // 宿主在 onLayout 里量出自身尺寸；尺寸同时入 state（驱动 Svg 渲染）与 ref
    // （供只创建一次的 PanResponder 读取最新边界做坐标钳制）。
    const [size, setSize] = useState<{ width: number; height: number }>({
      width: 0,
      height: 0,
    });
    const sizeRef = useRef(size);
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    // 已提交笔迹的 ref 镜像：每次落笔/清空同步，保证快照读取时拿到的是最新值。
    const strokesRef = useRef<Stroke[]>([]);
    // 正在画的那笔的点串；与 pointsRef 保持同步以便 release 回调能拿到最新值。
    const [activePoints, setActivePoints] = useState("");

    const handleLayout = (e: LayoutChangeEvent): void => {
      const { width, height } = e.nativeEvent.layout;
      sizeRef.current = { width, height };
      setSize({ width, height });
    };

    // 当前 props/尺寸的“最新值”镜像，避免一次性创建的 PanResponder 闭包过期。
    const propsRef = useRef(props);
    propsRef.current = props;
    const pointsRef = useRef("");
    const activeStyleRef = useRef<{ color: string; width: number }>({
      color: PEN_COLOR,
      width: PEN_WIDTH,
    });

    const clear = useCallback((): void => {
      pointsRef.current = "";
      setActivePoints("");
      strokesRef.current = [];
      setStrokes([]);
    }, []);

    // 快照读取当前已提交笔迹与测量尺寸。画布尚未完成首次布局（尺寸为 0）时返回 null，
    // 由宿主决定降级（如记空笔迹）。
    const getSnapshot = useCallback((): DrawingPadSnapshot | null => {
      const { width, height } = sizeRef.current;
      if (width <= 0 || height <= 0) return null;
      return { width, height, strokes: strokesRef.current };
    }, []);
    useImperativeHandle(ref, () => ({ clear, getSnapshot }), [
      clear,
      getSnapshot,
    ]);

    // PanResponder 只创建一次：手势回调全部经由 ref/setState，故不存在过期闭包。
    // 这样工具/颜色切换不会中断手势，也避免每次渲染重建响应器。
    const panResponder = useMemo(() => {
      const pointAt = (evt: GestureResponderEvent): string => {
        const { width, height } = sizeRef.current;
        const x = clampCoord(evt.nativeEvent.locationX, width);
        const y = clampCoord(evt.nativeEvent.locationY, height);
        return `${x},${y}`;
      };
      const finishStroke = (): void => {
        const points = pointsRef.current;
        if (points === "") {
          return;
        }
        const style = activeStyleRef.current;
        const stroke: Stroke = {
          points,
          color: style.color,
          width: style.width,
        };
        const next = [...strokesRef.current, stroke];
        strokesRef.current = next;
        setStrokes(next);
        pointsRef.current = "";
        setActivePoints("");
      };
      return PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt: GestureResponderEvent) => {
          const p = propsRef.current;
          const erasing = p.tool === "eraser";
          activeStyleRef.current = {
            color: erasing
              ? (p.canvasColor ?? ERASER_COLOR)
              : (p.penColor ?? PEN_COLOR),
            width: erasing ? ERASER_WIDTH : PEN_WIDTH,
          };
          pointsRef.current = pointAt(evt);
          setActivePoints(pointsRef.current);
        },
        onPanResponderMove: (evt: GestureResponderEvent) => {
          pointsRef.current = `${pointsRef.current} ${pointAt(evt)}`.trim();
          setActivePoints(pointsRef.current);
        },
        onPanResponderRelease: finishStroke,
        onPanResponderTerminate: finishStroke,
      });
    }, []);

    return (
      <View
        style={{ backgroundColor: canvasColor ?? CANVAS_COLOR }}
        onLayout={handleLayout}
        collapsable={false}
      >
        {/* 笔画层先渲染（在底）；children（印刷竖式）后渲染（在上） */}
        {size.width > 0 && size.height > 0 && (
          <View style={styles.overlay} {...panResponder.panHandlers}>
            <Svg
              width={size.width}
              height={size.height}
              style={styles.svg}
              pointerEvents="none"
            >
              {strokes.map((stroke, index) => (
                <Polyline
                  key={index}
                  points={stroke.points}
                  stroke={stroke.color}
                  strokeWidth={stroke.width}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
              {activePoints !== "" && (
                <Polyline
                  points={activePoints}
                  stroke={activeStyleRef.current.color}
                  strokeWidth={activeStyleRef.current.width}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </Svg>
          </View>
        )}
        {/* 印刷内容后渲染（在上）、留在普通文档流里以支撑容器尺寸；不拦截触摸：
            橡皮的白色粗笔触只能覆盖其下的笔迹，永远盖不住竖式；
            pointerEvents="none" 让触摸穿透到下方（先渲染）的覆盖层。 */}
        <View pointerEvents="none">{children}</View>
      </View>
    );
  },
);

DrawingPad.displayName = "DrawingPad";

const styles = StyleSheet.create({
  // 覆盖层盖住整块画布，作为唯一的手势接收面；Svg 关闭 pointerEvents，
  // 使 locationX/Y 相对覆盖层（即相对画布原点）解析。
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "transparent",
  },
  svg: {
    position: "absolute",
    top: 0,
    left: 0,
  },
});

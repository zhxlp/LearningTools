import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';



function calculateWifiArc(size: number) {
  const R1 = size / 2 * 1.4;
  const R2 = 5 / 8 * R1;
  const R3 = 1 / 4 * R1;
  const width = 1 / 4 * R1;

  const offset = (r: number) => {
    const left = -r;
    const top = size / 2 - r;
    return { left, top }
  }

  return [{
    r: R3,
    width: width,
    ...offset(R3),
    opacitys: [1, 1, 1]
  }, {
    r: R2,
    width: width,
    ...offset(R2),
    opacitys: [0, 1, 1]
  }, {
    r: R1,
    width: width,
    ...offset(R1),
    opacitys: [0, 0, 1]
  }]
}

interface WifiSoundWaveProps {
  isPlaying: boolean;
  size?: number;
  color?: string;
}

const WifiSoundWave: React.FC<WifiSoundWaveProps> = ({
  isPlaying,
  size = 24,
  color = '#1976d2'
}) => {
  const animatedValue = useRef(new Animated.Value(2)).current;

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;

    if (isPlaying) {
      // 启动声波动画，循环播放
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue, {
            toValue: 2, // 3个状态：点、1条波、2条波
            duration: 800,
            useNativeDriver: true,
          }),

        ])
      );
      animation.start();
    } else {
      // 停止动画
      animatedValue.stopAnimation();
      animatedValue.setValue(2);
    }

    return () => {
      if (animation) {
        animation.stop();
      }
    };
  }, [isPlaying]);

  const opacitys = useMemo(() => {
    return [
      animatedValue.interpolate({
        inputRange: [0, 1, 2],
        outputRange: [1, 1, 1],
      }),
      animatedValue.interpolate({
        inputRange: [0, 1, 2],
        outputRange: [0, 1, 1],
      }),
      animatedValue.interpolate({
        inputRange: [0, 1, 2],
        outputRange: [0, 0, 1],
      }),
    ]
  }, [])

  const arcStyles = React.useMemo(() => {
    const arcs = calculateWifiArc(size);
    return arcs.map(arc => {
      const style: ViewStyle = {
        position: 'absolute',
        left: arc.left,
        top: arc.top,
        width: arc.r * 2,
        height: arc.r * 2,
        borderWidth: arc.width,
        borderRadius: arc.r * 2,
        borderColor: 'transparent',
        borderRightColor: color,
        opacity: animatedValue.interpolate({
          inputRange: [0, 1, 2],
          outputRange: arc.opacitys,
        }),
      }
      return style;
    })
  }, [size, color])

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {arcStyles.map((style, i) => <Animated.View key={i} style={style} />)}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'flex-end',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
});

export default WifiSoundWave;
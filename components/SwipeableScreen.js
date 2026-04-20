import React from 'react';
import { View, StyleSheet } from 'react-native';
import { PanGestureHandler } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedGestureHandler,
  useSharedValue,
  runOnJS,
} from 'react-native-reanimated';

export default function SwipeableScreen({ children, onSwipeRight }) {
  const translateX = useSharedValue(0);

  const gestureHandler = useAnimatedGestureHandler({
    onActive: (event) => {
      if (event.translationX > 0 && event.translationX < 100) {
        translateX.value = event.translationX;
      }
    },
    onEnd: (event) => {
      if (event.translationX > 50 && event.velocityX > 0) {
        runOnJS(onSwipeRight)();
      }
      translateX.value = 0;
    },
  });

  return (
    <PanGestureHandler onGestureEvent={gestureHandler} activeOffsetX={10}>
      <Animated.View style={styles.container}>
        {children}
      </Animated.View>
    </PanGestureHandler>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

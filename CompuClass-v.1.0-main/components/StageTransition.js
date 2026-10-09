import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function StageTransition({ stage, theme, onDone }) {
  const { height: SH } = useWindowDimensions();
  const opacity  = useRef(new Animated.Value(0)).current;
  const scale    = useRef(new Animated.Value(0.6)).current;
  const slideOut = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(scale,   { toValue: 1, friction: 5, useNativeDriver: true }),
      ]),
      Animated.delay(1400),
      Animated.parallel([
        Animated.timing(opacity,  { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(slideOut, { toValue: -SH, duration: 500, useNativeDriver: true }),
      ]),
    ]).start(() => onDone?.());
  }, []);

  return (
    <Animated.View style={[s.overlay, { opacity, transform: [{ translateY: slideOut }] }]}>
      <LinearGradient colors={theme.bg} style={s.grad}>
        <Animated.View style={[s.card, { transform: [{ scale }], borderColor: theme.trace }]}>
          <Text style={[s.stageNum, { color: theme.trace }]}>STAGE {stage}</Text>
          <Text style={[s.stageLabel, { color: theme.trace }]}>{theme.label}</Text>
          {stage > 1 && (
            <View style={[s.boostBadge, { backgroundColor: theme.trace + '22', borderColor: theme.trace }]}>
              <Text style={[s.boostText, { color: theme.trace }]}>⚡ +20% XP BOOST ACTIVE</Text>
            </View>
          )}
          <View style={s.dotsRow}>
            {[1, 2, 3].map(i => (
              <View key={i} style={[s.dot, {
                backgroundColor: i <= stage ? theme.trace : theme.traceDim,
                width: i === stage ? 24 : 10,
              }]} />
            ))}
          </View>
        </Animated.View>
      </LinearGradient>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  overlay:    { ...StyleSheet.absoluteFillObject, zIndex: 999 },
  grad:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card:       { alignItems: 'center', padding: 40, borderRadius: 28, borderWidth: 2,
                backgroundColor: 'rgba(0,0,0,0.6)', minWidth: '75%', maxWidth: '92%' },
  stageNum:   { fontSize: 13, fontWeight: '900', letterSpacing: 4, marginBottom: 8 },
  stageLabel: { fontSize: 28, fontWeight: '900', letterSpacing: 2, textAlign: 'center', marginBottom: 20 },
  boostBadge: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 20 },
  boostText:  { fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  dotsRow:    { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dot:        { height: 10, borderRadius: 5 },
});

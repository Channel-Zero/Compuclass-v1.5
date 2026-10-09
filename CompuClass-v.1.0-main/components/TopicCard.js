import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import ProgressBar from './ProgressBar';
import { MAZE, TYPE, bulletise } from './mazeTheme';
import { TOPIC_STATE } from '../services/circuitMazeProgress';

/**
 * TopicCard
 * Props:
 *   topic    { id, label, icon, color, desc }
 *   progress { levelsCleared, total, ratio, state }  — from topicProgress()
 *   locked   boolean, plus lockHint text (no topic gating exists yet; the
 *            state is here so gating can be switched on without a redesign)
 *   width    resolved column width
 *   onPress  () => void
 */
function TopicCard({ topic, progress, locked = false, lockHint, width, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const glow  = useRef(new Animated.Value(0)).current;

  const animate = (toScale, toGlow) => {
    Animated.parallel([
      Animated.spring(scale, { toValue: toScale, useNativeDriver: true, speed: 50, bounciness: 4 }),
      Animated.timing(glow,  { toValue: toGlow, duration: 140, useNativeDriver: true }),
    ]).start();
  };

  const { levelsCleared, total, ratio, state } = progress;
  const done       = state === TOPIC_STATE.COMPLETED;
  const started    = state === TOPIC_STATE.IN_PROGRESS;
  const accent     = locked ? MAZE.muted : topic.color;

  const a11yLabel = locked
    ? `${topic.label}, locked. ${lockHint || 'Not yet available'}`
    : done
      ? `${topic.label}, completed. All ${total} levels cleared`
      : `${topic.label}. ${started ? `Level ${levelsCleared} of ${total} cleared` : 'Not started'}`;

  return (
    <Animated.View style={[{ width, transform: [{ scale }] }]}>
      <TouchableOpacity
        onPress={locked ? undefined : onPress}
        onPressIn={locked ? undefined : () => animate(0.97, 1)}
        onPressOut={locked ? undefined : () => animate(1, 0)}
        activeOpacity={1}
        disabled={locked}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        accessibilityHint={locked ? undefined : 'Opens this topic'}
        accessibilityState={{ disabled: locked, selected: started }}
      >
        <View style={[s.shell, locked && s.shellLocked]}>
          {/* Press glow — a colour wash that fades in rather than a new layer */}
          <Animated.View
            pointerEvents="none"
            style={[s.pressGlow, { backgroundColor: accent, opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.09] }) }]}
          />
          <LinearGradient
            colors={locked ? ['#0B1220', '#080D18'] : [accent + '18', MAZE.card]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[s.card, { borderColor: locked ? 'rgba(255,255,255,0.05)' : accent + '40' }]}
          >
            <View style={s.topRow}>
              <View style={[s.iconWrap, { backgroundColor: accent + '1F', borderColor: accent + '33' }]}>
                <Ionicons name={locked ? 'lock-closed' : topic.icon} size={20} color={accent} />
              </View>
              {done && (
                <View style={[s.badge, { borderColor: accent + '55', backgroundColor: accent + '14' }]}>
                  <Ionicons name="checkmark" size={11} color={accent} />
                </View>
              )}
            </View>

            <Text style={[s.title, locked && s.titleLocked]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
              {topic.label}
            </Text>

            <Text style={s.desc} numberOfLines={2} maxFontSizeMultiplier={1.2}>
              {locked ? (lockHint || 'Locked') : bulletise(topic.desc)}
            </Text>

            <View style={s.footer}>
              {done ? (
                <Text style={[s.meta, { color: accent }]} maxFontSizeMultiplier={1.2}>✓ COMPLETED</Text>
              ) : (
                <Text style={[s.meta, { color: locked ? MAZE.muted : MAZE.textDim }]} maxFontSizeMultiplier={1.2}>
                  Level {levelsCleared} / {total}
                </Text>
              )}
              <ProgressBar
                ratio={locked ? 0 : ratio}
                color={accent}
                segments={total}
                height={5}
                style={s.bar}
              />
            </View>
          </LinearGradient>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  shell: {
    borderRadius: 18,
    overflow: 'hidden',
    // Depth without a coloured halo, which Android cannot tint anyway.
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  shellLocked: { opacity: 0.5 },
  pressGlow:   { ...StyleSheet.absoluteFillObject, zIndex: 2, borderRadius: 18 },
  card:        { borderRadius: 18, borderWidth: 1, padding: 14, gap: 7, minHeight: 152, justifyContent: 'flex-start' },
  topRow:      { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  iconWrap:    { width: 38, height: 38, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  badge:       { width: 20, height: 20, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title:       { ...TYPE.cardTitle, color: '#EAF6FF' },
  titleLocked: { color: MAZE.textDim },
  desc:        { ...TYPE.cardDesc, color: MAZE.muted },
  footer:      { marginTop: 'auto', gap: 6, paddingTop: 4 },
  meta:        TYPE.meta,
  bar:         { width: '100%' },
});

export default React.memo(TopicCard);

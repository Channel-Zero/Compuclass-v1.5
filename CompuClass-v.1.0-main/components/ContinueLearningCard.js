import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import ProgressBar from './ProgressBar';
import { MAZE, TYPE } from './mazeTheme';

/**
 * ContinueLearningCard
 * Rendered only when there is real progress to continue — the caller decides,
 * via continueTarget(), so this never invents a topic or a level.
 *
 * Props:
 *   topic          { id, label, icon, color }
 *   levelsCleared  levels already finished
 *   total          levels in the topic
 *   levelLabel     name of the stage they are up to, e.g. "DEEP CACHE"
 *   questionsDone  real answered-question count, or 0 to hide the line
 *   onPress        () => void
 */
function ContinueLearningCard({ topic, levelsCleared, total, levelLabel, questionsDone = 0, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const press = (to) => Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 50, bounciness: 4 }).start();

  const ratio   = total > 0 ? levelsCleared / total : 0;
  const percent = Math.round(ratio * 100);
  const nextLevel = Math.min(levelsCleared + 1, total);

  return (
    <Animated.View style={[s.wrap, { transform: [{ scale }], shadowColor: topic.color }]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={() => press(0.985)}
        onPressOut={() => press(1)}
        activeOpacity={1}
        accessibilityRole="button"
        accessibilityLabel={`Continue learning ${topic.label}, level ${nextLevel} of ${total}, ${percent} percent complete`}
        accessibilityHint="Resumes this topic"
      >
        <LinearGradient
          colors={[topic.color + '2E', '#0C1A2B', '#0A1220']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[s.card, { borderColor: topic.color + '55' }]}
        >
          <View style={s.headRow}>
            <Ionicons name="flash" size={13} color={topic.color} />
            <Text style={[s.eyebrow, { color: topic.color }]} maxFontSizeMultiplier={1.3}>CONTINUE LEARNING</Text>
          </View>

          <View style={s.body}>
            <View style={s.bodyText}>
              <Text style={s.topicName} numberOfLines={1} maxFontSizeMultiplier={1.3}>{topic.label}</Text>
              <Text style={s.levelLine} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                Level {nextLevel} of {total}{levelLabel ? `  •  ${levelLabel}` : ''}
              </Text>
              {questionsDone > 0 && (
                <Text style={s.questions} maxFontSizeMultiplier={1.2}>{questionsDone} questions answered</Text>
              )}
            </View>
            <View style={[s.iconBubble, { backgroundColor: topic.color + '1F', borderColor: topic.color + '44' }]}>
              <Ionicons name={topic.icon} size={22} color={topic.color} />
            </View>
          </View>

          <View style={s.progressRow}>
            <ProgressBar ratio={ratio} color={topic.color} height={7} style={s.bar} />
            <Text style={[s.percent, { color: topic.color }]} maxFontSizeMultiplier={1.2}>{percent}%</Text>
          </View>

          <View style={[s.cta, { backgroundColor: topic.color }]}>
            <Text style={s.ctaText} maxFontSizeMultiplier={1.2}>CONTINUE</Text>
            <Ionicons name="arrow-forward" size={14} color="#06101C" />
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap:        { borderRadius: 20, shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  card:        { borderRadius: 20, borderWidth: 1, padding: 16, gap: 12 },
  headRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyebrow:     { ...TYPE.sectionLabel },
  body:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  bodyText:    { flex: 1, gap: 2 },
  topicName:   { fontSize: 19, fontWeight: '900', color: '#EAF6FF', letterSpacing: 0.2 },
  levelLine:   { fontSize: 12, fontWeight: '600', color: MAZE.textDim },
  questions:   { fontSize: 11, fontWeight: '500', color: MAZE.muted, marginTop: 2 },
  iconBubble:  { width: 46, height: 46, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bar:         { flex: 1 },
  percent:     { fontSize: 12, fontWeight: '900', minWidth: 38, textAlign: 'right' },
  cta:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 11 },
  ctaText:     { fontSize: 12, fontWeight: '900', color: '#06101C', letterSpacing: 1.5 },
});

export default React.memo(ContinueLearningCard);

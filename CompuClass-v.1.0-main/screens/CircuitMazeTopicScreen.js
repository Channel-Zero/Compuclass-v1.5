import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';
import { TOPICS } from '../data/circuitMazeQuestions';
import { LEVEL_THEMES } from '../data/circuitMazeLayout';
import { circuitMazeService } from '../services/circuitMazeService';
import { gamificationService } from '../services/gamificationservice';
import {
  circuitMazeProgress, topicProgress, continueTarget, TOTAL_LEVELS,
} from '../services/circuitMazeProgress';
import TopicCard from '../components/TopicCard';
import ContinueLearningCard from '../components/ContinueLearningCard';
import CircuitBackdrop from '../components/CircuitBackdrop';
import { MAZE, TYPE, formatNumber } from '../components/mazeTheme';

const H_PADDING = 16;
const GUTTER    = 12;

/** Total questions this player has answered on a topic, from the real
 *  adaptive-difficulty counters. Returns 0 when nothing has been recorded. */
function answeredCount(perfMap, topicId) {
  const byDifficulty = perfMap?.[topicId];
  if (!byDifficulty) return 0;
  return Object.values(byDifficulty).reduce(
    (sum, d) => sum + (d?.correct_count || 0) + (d?.wrong_count || 0), 0,
  );
}

export default function CircuitMazeTopicScreen({ navigation }) {
  const { width, height } = useWindowDimensions();

  const [progress, setProgress] = useState({});
  const [stats,    setStats]    = useState(null);
  const [perfMap,  setPerfMap]  = useState(null);

  // Re-read on focus so a finished run shows up the moment the player comes
  // back from the maze.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      circuitMazeProgress.getAll().then(p => { if (alive) setProgress(p); });
      gamificationService.getMyStats().then(s => { if (alive) setStats(s); });
      circuitMazeService.getTopicPerformance().then(m => { if (alive) setPerfMap(m); });
      return () => { alive = false; };
    }, []),
  );

  const columns   = width >= 700 ? 3 : 2;
  const cardWidth = Math.floor((width - H_PADDING * 2 - GUTTER * (columns - 1)) / columns);

  const select = useCallback((topicId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('CircuitMazeLobby', { topic: topicId });
  }, [navigation]);

  const resume = useMemo(() => {
    const target = continueTarget(progress);
    if (!target) return null;
    const topic = TOPICS.find(t => t.id === target.topicId);
    if (!topic) return null;
    return {
      topic,
      levelsCleared: target.levelsCleared,
      // Stage name for the level they are about to play, taken from the maze's
      // own theme table rather than an invented subtitle.
      levelLabel: LEVEL_THEMES[Math.min(target.levelsCleared, LEVEL_THEMES.length - 1)]?.label,
      questionsDone: answeredCount(perfMap, target.topicId),
    };
  }, [progress, perfMap]);

  const completedCount = useMemo(
    () => TOPICS.filter(t => topicProgress(progress, t.id).levelsCleared >= TOTAL_LEVELS).length,
    [progress],
  );

  const renderItem = useCallback(({ item }) => (
    <TopicCard
      topic={item}
      progress={topicProgress(progress, item.id)}
      width={cardWidth}
      onPress={() => select(item.id)}
      // Nothing gates topics in the app today, so nothing is locked. TopicCard
      // accepts `locked` / `lockHint` for when something does.
      locked={false}
    />
  ), [progress, cardWidth, select]);

  const header = (
    <View style={s.headerBlock}>
      <View style={s.navRow}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={s.iconBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={20} color={MAZE.text} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('Settings')}
          style={s.iconBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Settings"
        >
          <Ionicons name="settings-outline" size={18} color={MAZE.textDim} />
        </TouchableOpacity>
      </View>

      <View style={s.titleBlock}>
        <Text style={s.title} maxFontSizeMultiplier={1.4}>
          <Text style={{ color: MAZE.trace }}>⚡ </Text>CHOOSE YOUR PATH
        </Text>
        <Text style={s.subtitle} maxFontSizeMultiplier={1.4}>Build your IT knowledge</Text>
      </View>

      {/* Real gamification values only — a chip is absent when the stat is 0 */}
      {(stats?.current_streak > 0 || stats?.xp > 0) && (
        <View style={s.statRow}>
          {stats?.current_streak > 0 && (
            <View
              style={[s.chip, { borderColor: MAZE.streak + '44' }]}
              accessibilityLabel={`${stats.current_streak} day streak`}
            >
              <Text style={s.chipEmoji}>🔥</Text>
              <Text style={[s.chipText, { color: MAZE.streak }]} maxFontSizeMultiplier={1.2}>
                {stats.current_streak} DAY STREAK
              </Text>
            </View>
          )}
          {stats?.xp > 0 && (
            <View
              style={[s.chip, { borderColor: MAZE.xp + '44' }]}
              accessibilityLabel={`${stats.xp} experience points, level ${stats.level}`}
            >
              <Ionicons name="flash" size={11} color={MAZE.xp} />
              <Text style={[s.chipText, { color: MAZE.xp }]} maxFontSizeMultiplier={1.2}>
                {formatNumber(stats.xp)} XP
              </Text>
            </View>
          )}
        </View>
      )}

      {resume && (
        <ContinueLearningCard
          topic={resume.topic}
          levelsCleared={resume.levelsCleared}
          total={TOTAL_LEVELS}
          levelLabel={resume.levelLabel}
          questionsDone={resume.questionsDone}
          onPress={() => select(resume.topic.id)}
        />
      )}

      <View style={s.sectionRow}>
        <Text style={s.sectionLabel} maxFontSizeMultiplier={1.3}>EXPLORE TOPICS</Text>
        <Text style={s.sectionCount} maxFontSizeMultiplier={1.3}>
          {completedCount > 0 ? `${completedCount}/${TOPICS.length} COMPLETE` : `${TOPICS.length} TOPICS`}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <LinearGradient colors={[MAZE.bg, MAZE.bgDeep]} style={s.container}>
        <CircuitBackdrop width={width} height={height} />
        <FlatList
          key={`cols-${columns}`}
          data={TOPICS}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          numColumns={columns}
          ListHeaderComponent={header}
          columnWrapperStyle={s.column}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={6}
        />
      </LinearGradient>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: MAZE.bg },
  container:   { flex: 1 },
  listContent: { paddingHorizontal: H_PADDING, paddingBottom: 48 },
  column:      { gap: GUTTER, marginBottom: GUTTER },

  headerBlock: { paddingTop: 4, gap: 16, marginBottom: 16 },
  navRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn:     {
    width: 34, height: 34, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: MAZE.hairline,
    alignItems: 'center', justifyContent: 'center',
  },

  titleBlock:  { gap: 4 },
  title:       { ...TYPE.screenTitle, color: '#EAF6FF' },
  subtitle:    { ...TYPE.screenSub, color: MAZE.muted },

  statRow:     { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip:        {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  chipEmoji:   { fontSize: 11 },
  chipText:    { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },

  sectionRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  sectionLabel: { ...TYPE.sectionLabel, color: MAZE.textDim },
  sectionCount: { fontSize: 10, fontWeight: '700', letterSpacing: 1, color: MAZE.muted },
});

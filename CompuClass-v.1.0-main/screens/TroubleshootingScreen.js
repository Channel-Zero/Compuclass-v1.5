import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LAB_CATEGORIES, LAB_DIFFICULTIES, TROUBLESHOOTING_SCENARIOS } from '../data/troubleshootingScenarios';
import { loadTroubleshootingProgress, saveScenarioResult } from '../services/troubleshootingProgress';
import {
  applyCheck,
  canCommit,
  commitDiagnosis,
  currentNode,
  filterScenarios,
  startAttempt,
  takeHint,
} from '../utils/troubleshootingLab';

const RED = '#B91C1C';
const GREEN = '#166534';
const BLUE = '#1D4ED8';
const WHITE = '#FFFFFF';
const BG = '#F3F4F6';
const TEXT = '#111827';
const MUTED = '#374151';
const BORDER = '#D1D5DB';
const CARD = '#FFFFFF';

const DIFFICULTY_STYLE = {
  easy: { color: '#166534', background: '#DCFCE7' },
  medium: { color: '#92400E', background: '#FEF3C7' },
  hard: { color: '#991B1B', background: '#FEE2E2' },
};

function Chip({ label, selected, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, selected && styles.chipOn]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function TroubleshootingScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [progress, setProgress] = useState({ scenarios: {}, streak: 0, lastPlayed: null });
  const [category, setCategory] = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const [scenario, setScenario] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [choosing, setChoosing] = useState(false);
  const [xpAwarded, setXpAwarded] = useState(0);

  useEffect(() => {
    loadTroubleshootingProgress().then(setProgress).catch(() => {});
  }, []);

  const openScenario = (item) => {
    setScenario(item);
    setAttempt(startAttempt(item));
    setChoosing(false);
    setXpAwarded(0);
  };

  const finish = async (diagnosisId) => {
    const next = commitDiagnosis(scenario, attempt, diagnosisId);
    setAttempt(next);
    setChoosing(false);
    if (!next.committed) return;
    try {
      const saved = await saveScenarioResult({
        scenarioId: scenario.id,
        correct: next.correct,
        score: next.score,
        previous: progress,
      });
      setProgress(saved.progress);
      setXpAwarded(saved.xpAwarded);
    } catch {
      setXpAwarded(0);
    }
  };

  const completedCount = TROUBLESHOOTING_SCENARIOS.filter((item) => progress.scenarios?.[item.id]?.completed).length;
  const visible = filterScenarios(TROUBLESHOOTING_SCENARIOS, { category, difficulty });

  if (!scenario) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: BG }]} contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}>
        <LinearGradient colors={[RED, '#7F1D1D']} style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <View style={styles.headerIcon}><Ionicons name="bug" size={28} color={WHITE} /></View>
          <Text style={styles.headerTitle}>Troubleshooting Lab</Text>
          <Text style={styles.headerSubtitle}>Pick a case, run the checks, then commit a diagnosis.</Text>
        </LinearGradient>
        <View style={styles.statsRow}>
          <View style={styles.statCard}><Text style={styles.statValue}>{completedCount}</Text><Text style={styles.statLabel}>Completed</Text></View>
          <View style={styles.statCard}><Text style={styles.statValue}>{TROUBLESHOOTING_SCENARIOS.length}</Text><Text style={styles.statLabel}>Cases</Text></View>
          <View style={styles.statCard}><Text style={styles.statValue}>{progress.streak || 0}</Text><Text style={styles.statLabel}>Streak</Text></View>
        </View>
        <Text style={styles.sectionTitle}>Category</Text>
        <View style={styles.chips}>
          <Chip label="All categories" selected={category === 'all'} onPress={() => setCategory('all')} />
          {LAB_CATEGORIES.map((item) => (
            <Chip key={item.id} label={item.label} selected={category === item.id} onPress={() => setCategory(item.id)} />
          ))}
        </View>
        <Text style={styles.sectionTitle}>Difficulty</Text>
        <View style={styles.chips}>
          <Chip label="All levels" selected={difficulty === 'all'} onPress={() => setDifficulty('all')} />
          {LAB_DIFFICULTIES.map((item) => (
            <Chip key={item.id} label={item.label} selected={difficulty === item.id} onPress={() => setDifficulty(item.id)} />
          ))}
        </View>
        <Text style={styles.sectionTitle}>Cases</Text>
        {visible.length === 0 ? <Text style={styles.empty}>No cases match these filters.</Text> : null}
        {visible.map((item) => {
          const record = progress.scenarios?.[item.id];
          const tone = DIFFICULTY_STYLE[item.difficulty];
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.card, record?.completed && styles.cardDone]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); openScenario(item); }}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}. ${record?.completed ? 'Completed' : 'Not completed'}.`}
            >
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                {record?.completed ? <Ionicons name="checkmark-circle" size={22} color={GREEN} /> : null}
              </View>
              <Text style={styles.cardSummary}>{item.summary}</Text>
              <View style={styles.metaRow}>
                <Text style={[styles.badge, { color: tone.color, backgroundColor: tone.background }]}>{item.difficulty}</Text>
                {record?.bestScore ? <Text style={styles.best}>Best {record.bestScore}</Text> : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  }

  if (attempt?.committed) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: BG }]} contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}>
        <LinearGradient colors={[RED, '#7F1D1D']} style={[styles.playHeader, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.playTitle}>{scenario.title}</Text>
        </LinearGradient>
        <View style={styles.card}>
          <Text style={styles.resultHeading}>{attempt.correct ? 'Diagnosis correct' : 'Diagnosis missed'}</Text>
          <Text style={styles.score}>{attempt.score} points</Text>
          <Text style={styles.cardSummary}>{attempt.checksUsed} checks, {attempt.hintsTaken} hints.</Text>
          {xpAwarded > 0 ? <Text style={styles.xp}>+{xpAwarded} XP saved to your account</Text> : <Text style={styles.cardSummary}>Your score is saved on this device.</Text>}
          <Text style={styles.blockLabel}>Cause</Text>
          <Text style={styles.body}>{scenario.rootCause}</Text>
          <Text style={styles.blockLabel}>Fix</Text>
          <Text style={styles.body}>{scenario.fix}</Text>
          <Text style={styles.blockLabel}>Why</Text>
          <Text style={styles.body}>{scenario.why}</Text>
          <TouchableOpacity style={styles.primary} onPress={() => setScenario(null)} accessibilityRole="button" accessibilityLabel="Back to cases">
            <Text style={styles.primaryText}>Back to cases</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  const node = currentNode(scenario, attempt);
  return (
    <ScrollView style={[styles.container, { backgroundColor: BG }]} contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}>
      <LinearGradient colors={[RED, '#7F1D1D']} style={[styles.playHeader, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => setScenario(null)} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back to cases">
          <Ionicons name="arrow-back" size={20} color={WHITE} />
        </TouchableOpacity>
        <Text style={styles.playTitle}>{scenario.title}</Text>
      </LinearGradient>
      <View style={styles.card}>
        <Text style={styles.body}>{scenario.summary}</Text>
        <Text style={styles.blockLabel}>Symptoms</Text>
        {scenario.symptoms.map((symptom) => <Text key={symptom} style={styles.body}>• {symptom}</Text>)}
      </View>
      <View style={styles.card}>
        <Text style={styles.blockLabel}>Next check</Text>
        <Text style={styles.body}>{node?.prompt}</Text>
        {node?.checks?.map((check) => (
          <TouchableOpacity
            key={check.id}
            style={styles.choice}
            onPress={() => setAttempt(applyCheck(scenario, attempt, check.id))}
            accessibilityRole="button"
            accessibilityLabel={check.label}
          >
            <Text style={styles.choiceText}>{check.label}</Text>
          </TouchableOpacity>
        ))}
        {attempt.pendingHint && !attempt.hintShown ? (
          <TouchableOpacity style={styles.secondary} onPress={() => setAttempt(takeHint(attempt))} accessibilityRole="button" accessibilityLabel="Show hint">
            <Text style={styles.secondaryText}>Show hint</Text>
          </TouchableOpacity>
        ) : null}
        {attempt.hintShown ? <Text style={styles.hint}>{attempt.pendingHint}</Text> : null}
      </View>
      {attempt.log.map((entry, index) => (
        <View key={`${entry.checkId}-${index}`} style={styles.feedback}>
          <Text style={styles.feedbackLabel}>{entry.label}</Text>
          <Text style={styles.body}>{entry.feedback}</Text>
        </View>
      ))}
      {choosing ? (
        <View style={styles.card}>
          <Text style={styles.blockLabel}>Commit a diagnosis</Text>
          {scenario.diagnoses.map((item) => (
            <TouchableOpacity key={item.id} style={styles.choice} onPress={() => finish(item.id)} accessibilityRole="button" accessibilityLabel={item.label}>
              <Text style={styles.choiceText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.primary, !canCommit(attempt) && styles.primaryOff]}
          disabled={!canCommit(attempt)}
          onPress={() => setChoosing(true)}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canCommit(attempt) }}
          accessibilityLabel="Commit a diagnosis"
        >
          <Text style={styles.primaryText}>Commit a diagnosis</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={styles.secondary}
        onPress={() => navigation.navigate('Chatbot', { context: `Help me troubleshoot: ${scenario.title}` })}
        accessibilityRole="button"
        accessibilityLabel="Ask CompuBot"
      >
        <Text style={styles.secondaryText}>Ask CompuBot</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 20 },
  headerIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  headerTitle: { color: WHITE, fontSize: 22, fontWeight: '900' },
  headerSubtitle: { color: WHITE, fontSize: 14, marginTop: 4, lineHeight: 20 },
  statsRow: { flexDirection: 'row', gap: 8, padding: 12 },
  statCard: { flex: 1, backgroundColor: CARD, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  statValue: { color: TEXT, fontSize: 20, fontWeight: '900' },
  statLabel: { color: MUTED, fontSize: 12, fontWeight: '700', marginTop: 2 },
  sectionTitle: { color: MUTED, fontSize: 13, fontWeight: '800', marginHorizontal: 12, marginTop: 8, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12 },
  chip: { minHeight: 44, paddingHorizontal: 12, borderRadius: 999, borderWidth: 2, borderColor: BORDER, backgroundColor: CARD, justifyContent: 'center' },
  chipOn: { backgroundColor: BLUE, borderColor: BLUE },
  chipText: { color: TEXT, fontWeight: '700', fontSize: 13 },
  chipTextOn: { color: WHITE },
  card: { backgroundColor: CARD, borderRadius: 14, marginHorizontal: 12, marginTop: 10, padding: 14 },
  cardDone: { borderWidth: 2, borderColor: GREEN },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { color: TEXT, fontSize: 16, fontWeight: '800', flex: 1 },
  cardSummary: { color: MUTED, fontSize: 14, lineHeight: 20, marginTop: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  badge: { overflow: 'hidden', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
  best: { color: MUTED, fontWeight: '700', fontSize: 13 },
  empty: { color: MUTED, marginHorizontal: 12, fontSize: 14 },
  playHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingBottom: 16 },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  playTitle: { color: WHITE, fontSize: 18, fontWeight: '900', flex: 1 },
  blockLabel: { color: TEXT, fontSize: 13, fontWeight: '800', marginTop: 8, marginBottom: 4 },
  body: { color: MUTED, fontSize: 15, lineHeight: 22 },
  choice: { minHeight: 44, borderWidth: 2, borderColor: BORDER, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center', marginTop: 8 },
  choiceText: { color: TEXT, fontSize: 15, fontWeight: '700' },
  primary: { minHeight: 48, backgroundColor: RED, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginHorizontal: 12, marginTop: 12 },
  primaryOff: { opacity: 0.45 },
  primaryText: { color: WHITE, fontSize: 16, fontWeight: '800' },
  secondary: { minHeight: 44, borderRadius: 12, borderWidth: 2, borderColor: BORDER, alignItems: 'center', justifyContent: 'center', marginHorizontal: 12, marginTop: 8, backgroundColor: CARD },
  secondaryText: { color: TEXT, fontWeight: '800', fontSize: 15 },
  hint: { color: TEXT, backgroundColor: '#FEF3C7', borderRadius: 10, padding: 10, marginTop: 8, fontSize: 14, lineHeight: 20 },
  feedback: { backgroundColor: CARD, borderRadius: 12, marginHorizontal: 12, marginTop: 8, padding: 12 },
  feedbackLabel: { color: TEXT, fontWeight: '800', fontSize: 14, marginBottom: 4 },
  resultHeading: { color: TEXT, fontSize: 20, fontWeight: '900' },
  score: { color: TEXT, fontSize: 28, fontWeight: '900', marginTop: 4 },
  xp: { color: GREEN, fontWeight: '800', fontSize: 15, marginTop: 6 },
});

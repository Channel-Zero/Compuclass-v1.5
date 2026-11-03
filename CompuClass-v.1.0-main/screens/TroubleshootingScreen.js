import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
import { useTheme } from '../context/ThemeContext';
import { useShellBack } from '../context/ChromeContext';
import { leaveScreen } from '../utils/screenNav';
import { Glass, IconButton, Heading, Body, Button, Badge, IconTile, font, useLayout } from '../components/ui/kit';

const DIFFICULTY_KIND = { easy: 'ok', medium: 'warning', hard: 'error' };

function Chip({ label, selected, onPress }) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      className="cc-glass"
      style={({ pressed }) => [{
        minHeight: 44,
        paddingHorizontal: 14,
        borderRadius: 999,
        borderWidth: 1,
        justifyContent: 'center',
        backgroundColor: selected ? theme.primary : theme.glassPanel,
        borderColor: selected ? theme.primary : theme.glassBorder,
        opacity: pressed ? 0.9 : 1,
      }]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <Text style={[{ color: selected ? theme.surface : theme.text, fontSize: 14 }, font(theme, 'semibold')]}>{label}</Text>
    </Pressable>
  );
}

function Choice({ label, onPress }) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        minHeight: 48,
        marginTop: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: theme.radiusButton,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: pressed ? theme.tint : theme.surface,
        justifyContent: 'center',
        width: '100%',
        maxWidth: 400,
        alignSelf: 'center',
      })}
    >
      <Text style={[{ color: theme.text, fontSize: 15, lineHeight: 22 }, font(theme, 'semibold')]}>{label}</Text>
    </Pressable>
  );
}

export default function TroubleshootingScreen({ navigation }) {
  const { theme } = useTheme();
  const shellBack = useShellBack();
  const insets = useSafeAreaInsets();
  const { phone, horizontal, bottom } = useLayout();
  const [progress, setProgress] = useState({ scenarios: {}, streak: 0, lastPlayed: null });
  const [category, setCategory] = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const [scenario, setScenario] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [choosing, setChoosing] = useState(false);
  const [xpAwarded, setXpAwarded] = useState(0);
  const [savedOnAccount, setSavedOnAccount] = useState(false);

  useEffect(() => {
    loadTroubleshootingProgress().then(setProgress).catch(() => {});
  }, []);

  const openScenario = (item) => {
    setScenario(item);
    setAttempt(startAttempt(item));
    setChoosing(false);
    setXpAwarded(0);
    setSavedOnAccount(false);
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
      setSavedOnAccount(!!saved.savedToAccount);
    } catch {
      setXpAwarded(0);
      setSavedOnAccount(false);
    }
  };

  const completedCount = TROUBLESHOOTING_SCENARIOS.filter((item) => progress.scenarios?.[item.id]?.completed).length;
  const visible = filterScenarios(TROUBLESHOOTING_SCENARIOS, { category, difficulty });
  const pagePad = {
    paddingHorizontal: horizontal,
    paddingBottom: bottom,
    paddingTop: shellBack ? 8 : insets.top + 16,
  };

  if (!scenario) {
    return (
      <ScrollView testID="troubleshoot-list" style={[styles.fill, { backgroundColor: theme.background }]} contentContainerStyle={pagePad}>
        <View style={styles.listWrap}>
          <View style={styles.titleRow}>
            {!shellBack && <IconButton name="chevLeft" label="Go back" onPress={() => leaveScreen(navigation)} />}
            <IconTile name="wrench" tone="teal" />
            <View style={{ flex: 1 }}>
              <Heading level={1}>Troubleshooting Lab</Heading>
            </View>
          </View>
          <Body style={{ marginTop: 8, marginBottom: 20 }}>Pick a case, run the checks, then commit a diagnosis.</Body>
          <View style={styles.statsRow}>
            {[
              { value: completedCount, label: 'Completed' },
              { value: TROUBLESHOOTING_SCENARIOS.length, label: 'Cases' },
              { value: progress.streak || 0, label: 'Streak' },
            ].map((stat) => (
              <Glass key={stat.label} strong radius={16} style={styles.statCard}>
                <Text style={[{ fontSize: 24, color: theme.text }, font(theme, 'display')]}>{stat.value}</Text>
                <Text style={[{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }, font(theme, 'semibold')]}>{stat.label}</Text>
              </Glass>
            ))}
          </View>
          <Heading level={3} style={styles.sectionTitle}>Category</Heading>
          <View style={styles.chips}>
            <Chip label="All categories" selected={category === 'all'} onPress={() => setCategory('all')} />
            {LAB_CATEGORIES.map((item) => (
              <Chip key={item.id} label={item.label} selected={category === item.id} onPress={() => setCategory(item.id)} />
            ))}
          </View>
          <Heading level={3} style={styles.sectionTitle}>Difficulty</Heading>
          <View style={styles.chips}>
            <Chip label="All levels" selected={difficulty === 'all'} onPress={() => setDifficulty('all')} />
            {LAB_DIFFICULTIES.map((item) => (
              <Chip key={item.id} label={item.label} selected={difficulty === item.id} onPress={() => setDifficulty(item.id)} />
            ))}
          </View>
          <Heading level={3} style={styles.sectionTitle}>Cases</Heading>
          {visible.length === 0 ? <Body style={{ marginBottom: 12 }}>No cases match these filters.</Body> : null}
          <View style={styles.caseGrid}>
            {visible.map((item) => {
              const record = progress.scenarios?.[item.id];
              const kind = DIFFICULTY_KIND[item.difficulty] || 'neutral';
              return (
                <Pressable
                  key={item.id}
                  style={[styles.caseSlot, phone && styles.caseSlotPhone]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); openScenario(item); }}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title}. ${record?.completed ? 'Completed' : 'Not completed'}.`}
                >
                  <Glass strong radius={16} style={[styles.caseCard, record?.completed && { borderColor: theme.success }]}>
                    <View style={styles.cardTop}>
                      <Text style={[{ flex: 1, fontSize: 16, color: theme.text }, font(theme, 'h3')]}>{item.title}</Text>
                      {record?.completed ? <Ionicons name="checkmark-circle" size={22} color={theme.success} /> : null}
                    </View>
                    <Body variant="small" style={{ marginTop: 8 }}>{item.summary}</Body>
                    <View style={styles.metaRow}>
                      <Badge label={item.difficulty.charAt(0).toUpperCase() + item.difficulty.slice(1)} kind={kind} />
                      {record?.bestScore ? <Text style={[{ color: theme.textSecondary, fontSize: 13 }, font(theme, 'semibold')]}>Best {record.bestScore}</Text> : null}
                    </View>
                  </Glass>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    );
  }

  const closeCase = () => setScenario(null);

  if (attempt?.committed) {
    const correct = attempt.correct;
    return (
      <ScrollView testID="troubleshoot-result" style={[styles.fill, { backgroundColor: theme.background }]} contentContainerStyle={pagePad}>
        <View style={styles.playWrap}>
          <View style={styles.titleRow}>
            <IconButton name="chevLeft" label="Back to cases" onPress={closeCase} />
            <Heading level={2} style={{ flex: 1 }}>{scenario.title}</Heading>
          </View>
          <Glass strong radius={24} style={styles.playCard}>
            <View style={[styles.resultBanner, { backgroundColor: correct ? theme.successWash : theme.errorWash }]}>
              <Text style={[{ fontSize: 20, color: correct ? theme.successInk : theme.errorInk }, font(theme, 'h2')]}>{correct ? 'Diagnosis correct' : 'Diagnosis missed'}</Text>
              <Text style={[{ fontSize: 32, lineHeight: 40, color: theme.text, marginTop: 4 }, font(theme, 'display')]}>{attempt.score} points</Text>
            </View>
            <Body variant="small" style={{ marginTop: 12 }}>{attempt.checksUsed} checks, {attempt.hintsTaken} hints.</Body>
            {xpAwarded > 0 ? (
              <Text style={[{ color: theme.successInk, fontSize: 15, marginTop: 8 }, font(theme, 'semibold')]}>+{xpAwarded} XP saved to your account</Text>
            ) : (
              <Body variant="small" style={{ marginTop: 8 }}>{savedOnAccount ? 'Your score is saved to your account.' : 'Your score is saved on this device.'}</Body>
            )}
            {attempt.log.map((entry, index) => (
              <Body key={`${entry.checkId}-${index}`}>{entry.label}: {entry.feedback}</Body>
            ))}
            <Text style={[styles.blockLabel, { color: theme.text }, font(theme, 'semibold')]}>Cause</Text>
            <Body>{scenario.rootCause}</Body>
            <Text style={[styles.blockLabel, { color: theme.text }, font(theme, 'semibold')]}>Fix</Text>
            <Body>{scenario.fix}</Body>
            <Text style={[styles.blockLabel, { color: theme.text }, font(theme, 'semibold')]}>Why</Text>
            <Body>{scenario.why}</Body>
            <View style={styles.actions}>
              <Button block label="Back to cases" onPress={closeCase} />
            </View>
          </Glass>
        </View>
      </ScrollView>
    );
  }

  const node = currentNode(scenario, attempt);
  return (
    <ScrollView testID="troubleshoot-lab" style={[styles.fill, { backgroundColor: theme.background }]} contentContainerStyle={pagePad}>
      <View style={styles.playWrap}>
        <View style={styles.titleRow}>
          <IconButton name="chevLeft" label="Back to cases" onPress={closeCase} />
          <Heading level={2} style={{ flex: 1 }}>{scenario.title}</Heading>
        </View>

        <Glass strong radius={20} style={styles.playCard}>
          <Body>{scenario.summary}</Body>
          <Text style={[styles.blockLabel, { color: theme.text }, font(theme, 'semibold')]}>Symptoms</Text>
          {scenario.symptoms.map((symptom) => (
            <View key={symptom} style={styles.symptomRow}>
              <View style={[styles.dot, { backgroundColor: theme.accent }]} />
              <Text style={[{ flex: 1, color: theme.textSecondary, fontSize: 15, lineHeight: 22 }, font(theme, 'body')]}>{symptom}</Text>
            </View>
          ))}
        </Glass>

        <Glass strong radius={20} style={[styles.playCard, { marginTop: 12 }]}>
          <Text style={[styles.blockLabel, { color: theme.text, marginTop: 0 }, font(theme, 'semibold')]}>Next check</Text>
          <Body style={{ marginBottom: 4 }}>{node?.prompt}</Body>
          {node?.checks?.map((check) => (
            <Choice key={check.id} label={check.label} onPress={() => setAttempt(applyCheck(scenario, attempt, check.id))} />
          ))}
          {attempt.pendingHint && !attempt.hintShown ? (
            <View style={styles.actions}>
              <Button block variant="secondary" label="Show hint" onPress={() => setAttempt(takeHint(attempt))} />
            </View>
          ) : null}
          {attempt.hintShown ? (
            <View style={[styles.hint, { backgroundColor: theme.yellowWash }]}>
              <Text style={[{ color: theme.yellowInk, fontSize: 14, lineHeight: 20 }, font(theme, 'semibold')]}>{attempt.pendingHint}</Text>
            </View>
          ) : null}
        </Glass>

        {attempt.log.length > 0 && (
          <Glass strong radius={20} style={[styles.playCard, { marginTop: 12 }]}>
            <Text style={[styles.blockLabel, { color: theme.text, marginTop: 0 }, font(theme, 'semibold')]}>Diagnostic log</Text>
            <View style={[styles.readout, { backgroundColor: theme.text, borderColor: theme.text }]}>
              {attempt.log.map((entry, index) => (
                <View key={`${entry.checkId}-${index}`} style={index > 0 ? [styles.logEntry, { borderTopColor: theme.glassBorder }] : styles.logEntryFirst}>
                  <Text style={[{ color: theme.secondary, fontSize: 14 }, font(theme, 'semibold')]}>{entry.label}</Text>
                </View>
              ))}
            </View>
          </Glass>
        )}

        {choosing ? (
          <Glass strong radius={20} style={[styles.playCard, { marginTop: 12 }]}>
            <Text style={[styles.blockLabel, { color: theme.text, marginTop: 0 }, font(theme, 'semibold')]}>Commit a diagnosis</Text>
            {scenario.diagnoses.map((item) => (
              <Choice key={item.id} label={item.label} onPress={() => finish(item.id)} />
            ))}
          </Glass>
        ) : (
          <View style={styles.actions}>
            <Button
              block
              label="Commit a diagnosis"
              disabled={!canCommit(attempt)}
              onPress={() => setChoosing(true)}
            />
          </View>
        )}
        <View style={styles.actionsTight}>
          <Button
            block
            variant="secondary"
            label="Ask CompuBot"
            onPress={() => navigation.navigate('Chatbot', { context: `Help me troubleshoot: ${scenario.title}` })}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  listWrap: { width: '100%', maxWidth: 1200, alignSelf: 'center' },
  playWrap: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  statCard: { flex: 1, paddingVertical: 16, paddingHorizontal: 8, alignItems: 'center', maxWidth: 400 },
  sectionTitle: { marginTop: 20, marginBottom: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  caseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  caseSlot: { flexGrow: 1, flexBasis: 300, maxWidth: 400 },
  caseSlotPhone: { flexBasis: '100%', maxWidth: 400 },
  caseCard: { padding: 16, minHeight: 44 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  playCard: { padding: 16, marginTop: 16 },
  blockLabel: { fontSize: 13, marginTop: 14, marginBottom: 6 },
  symptomRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
  readout: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingBottom: 4 },
  logEntryFirst: { paddingVertical: 10 },
  logEntry: { paddingVertical: 10, borderTopWidth: 1 },
  hint: { borderRadius: 14, padding: 12, marginTop: 12 },
  resultBanner: { borderRadius: 16, padding: 16 },
  actions: { marginTop: 16, width: '100%', maxWidth: 400, alignSelf: 'center' },
  actionsTight: { marginTop: 8, width: '100%', maxWidth: 400, alignSelf: 'center' },
});

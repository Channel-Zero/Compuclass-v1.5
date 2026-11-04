import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { supabase } from '../config/supabase';
import { authService } from '../services/authService';
import { useTheme } from '../context/ThemeContext';
import { Icon } from '../components/ui/Icon';
import { Heading, Body, Glass, Badge, Button, IconTile, IconButton, Skeleton, Page, font, useLayout } from '../components/ui/kit';
import { leaveScreen } from '../utils/screenNav';
import { advanceQuiz, bestScoresByQuiz, normalizeOptions, passingMark, uniqueIds } from '../utils/quizFlow';
const WHITE = '#FFFFFF';

// Base XP mirrors the CASE in submit_quiz_attempt — keep the two in sync.
const DIFFICULTY = {
  easy:   { label: 'Easy',   color: '#1F9D55', icon: 'check',  xp: 5  },
  medium: { label: 'Medium', color: '#8A5A00', icon: 'flame',  xp: 10 },
  hard:   { label: 'Hard',   color: '#D92D4A', icon: 'target', xp: 15 },
};

function PressableQuiz({ theme, quiz, onPress, bestScore }) {
  const done = bestScore != null;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel={`${done ? 'Retake' : 'Start'} ${quiz.title}`} style={{ marginBottom: 12 }}>
      <Glass strong style={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, minHeight: 72 }}>
        <IconTile name="quiz" tone="teal" />
        <View style={{ flex: 1 }}>
          <Text style={[{ color: theme.text }, font(theme, 'h3')]}>{quiz.title}</Text>
          {quiz.description ? <Body variant="small">{quiz.description}</Body> : null}
          <Body variant="caption">Pass mark {passingMark(quiz)}%</Body>
        </View>
        <Badge label={done ? `Best ${bestScore}%` : 'To do'} kind="neutral" />
        <Button label={done ? 'Retake' : 'Start'} variant="secondary" fit onPress={onPress} style={{ height: 44, minHeight: 44 }} />
      </Glass>
    </TouchableOpacity>
  );
}

export default function QuizScreen({ route, navigation }) {
  const { theme } = useTheme();
  const { bottom, phone } = useLayout();
  const tabClearance = phone ? bottom : 0;
  const BLUE = theme.primary;
  const YELLOW = theme.yellow;
  const RED = theme.error;
  const GREEN = theme.success;
  const BG = theme.background;
  const TEXT = theme.text;
  const MUTED = theme.textSecondary;
  const BORDER = theme.border;
  const CARD = theme.surface;
  const PURPLE = theme.accentInk;
  const { quizId } = route?.params || {};
  const [loading, setLoading] = useState(true);
  const [availableQuizzes, setAvailableQuizzes] = useState([]);
  const [listError, setListError] = useState(false);
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [bestScores, setBestScores] = useState({});
  const [submitError, setSubmitError] = useState(false);
  const [quizMissing, setQuizMissing] = useState(false);

  // Refs so the timer's interval callback always sees fresh values
  // without having to restart the interval every render.
  const timerRef = useRef(null);
  const loadQuizRef = useRef(() => {});
  const selectedAnswerRef = useRef(null);
  const answersRef = useRef([]);
  const questionsRef = useRef([]);
  const currentIndexRef = useRef(0);
  const advancingRef = useRef(false);
  const pendingAnswersRef = useRef(null);
  const submitQuizRef = useRef(async () => {});

  useEffect(() => { selectedAnswerRef.current = selectedAnswer; }, [selectedAnswer]);
  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { questionsRef.current = questions; }, [questions]);
  useEffect(() => { currentIndexRef.current = currentQuestion; }, [currentQuestion]);

  useEffect(() => { if (quizId) loadQuizRef.current(); }, [quizId]);
  useFocusEffect(useCallback(() => { if (!quizId) loadAvailableQuizzes(); }, [quizId]));

  // Starts (or restarts) the countdown whenever the active question changes.
  // Untimed questions (time_limit_seconds is null) just skip the timer.
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    const q = questions[currentQuestion];
    if (!q || quizCompleted || submitError) return;
    if (!q.time_limit_seconds) { setTimeLeft(null); return; }

    setTimeLeft(q.time_limit_seconds);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setTimeout(() => advanceQuestion(selectedAnswerRef.current, 0), 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion, questions, quizCompleted, submitError]);

  const loadAvailableQuizzes = async () => {
    setListError(false);
    try {
      const user = await authService.getCurrentUser();
      const { data: classStudents, error: classError } = await supabase.from('class_students').select('class_id').eq('student_id', user.id);
      if (classError) throw classError;
      const classIds = uniqueIds(classStudents?.map((cs) => cs.class_id));
      if (classIds.length === 0) { setAvailableQuizzes([]); setBestScores({}); setLoading(false); return; }
      const { data: assignments, error: assignmentError } = await supabase.from('quiz_assignments').select('quiz_id').in('class_id', classIds);
      if (assignmentError) throw assignmentError;
      const quizIds = uniqueIds(assignments?.map((a) => a.quiz_id));
      if (quizIds.length === 0) { setAvailableQuizzes([]); setBestScores({}); setLoading(false); return; }
      const { data: quizzes, error: quizError } = await supabase.from('quizzes').select('*').in('id', quizIds);
      if (quizError) throw quizError;
      const { data: attempts, error: attemptsError } = await supabase.from('quiz_attempts').select('quiz_id, score').eq('user_id', user.id);
      setBestScores(attemptsError ? {} : bestScoresByQuiz(attempts));
      setAvailableQuizzes(quizzes || []);
    } catch (error) {
      // Previously swallowed, so a failed load looked like "No quizzes assigned yet".
      console.error('[Quiz] Failed to load assigned quizzes:', error);
      setListError(true);
    }
    finally { setLoading(false); }
  };

  const loadQuiz = async () => {
    try {
      const { data: quizData, error: quizError } = await supabase.from('quizzes').select('*').eq('id', quizId).single();
      if (quizError) throw quizError;

      // Questions come through a security-definer RPC — it never returns
      // correct_answer, so there's nothing for the client to leak or fake.
      const { data: questionsData, error: questionsError } = await supabase
        .rpc('get_quiz_questions_for_attempt', { p_quiz_id: quizId });
      if (questionsError) throw questionsError;

      const ordered = (questionsData || []).slice().sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
      setQuiz(quizData);
      setQuestions(ordered);
      setQuizMissing(ordered.length === 0);
    } catch {
      Alert.alert('Error', 'Failed to load quiz');
      leaveScreen(navigation);
    } finally { setLoading(false); }
  };
  loadQuizRef.current = loadQuiz;

  const advanceQuestion = useCallback((finalAnswer, finalTimeLeft) => {
    // The timer and the Next button can both fire. A second call used to
    // append the same answer again and skip a question, and a failed submit
    // did it a second time on retry.
    if (advancingRef.current) return;
    const step = advanceQuiz({
      questions: questionsRef.current,
      index: currentIndexRef.current,
      answers: answersRef.current,
      selected: finalAnswer,
      timeLeft: finalTimeLeft,
    });
    if (step.status === 'idle') return;
    advancingRef.current = true;
    setAnswers(step.answers);
    if (step.status === 'next') {
      setCurrentQuestion(step.index);
      setSelectedAnswer(null);
      advancingRef.current = false;
      return;
    }
    pendingAnswersRef.current = step.answers;
    submitQuizRef.current(step.answers);
  }, []);

  const handleNextPress = () => {
    if (selectedAnswer === null) { Alert.alert('Please select an answer'); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (timerRef.current) clearInterval(timerRef.current);
    advanceQuestion(selectedAnswer, timeLeft);
  };

  const submitQuiz = async (finalAnswers) => {
    const payload = finalAnswers || pendingAnswersRef.current;
    if (!payload) return;
    pendingAnswersRef.current = payload;
    setSubmitting(true);
    setSubmitError(false);
    try {
      const { data, error } = await supabase.rpc('submit_quiz_attempt', {
        p_quiz_id: quizId,
        p_answers: payload,
      });
      if (error || data == null) throw error || new Error('empty result');
      setResult(data);
      setQuizCompleted(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setSubmitError(true);
    } finally {
      setSubmitting(false);
      advancingRef.current = false;
    }
  };
  submitQuizRef.current = submitQuiz;

  const resetQuiz = () => {
    advancingRef.current = false;
    pendingAnswersRef.current = null;
    setCurrentQuestion(0); setSelectedAnswer(null); setAnswers([]);
    setQuizCompleted(false); setResult(null); setTimeLeft(null); setSubmitError(false);
  };

  if (loading) return (
    <View style={[styles.centered, { backgroundColor: BG, padding: 24 }]} accessibilityRole="progressbar">
      <Skeleton width={72} height={72} radius={16} />
      <Skeleton width={180} height={18} style={{ marginTop: 16 }} />
      <Skeleton width={240} height={14} style={{ marginTop: 8 }} />
      <Heading level={2} style={{ marginTop: 20 }}>Loading quizzes</Heading>
      <Body variant="small" style={{ marginTop: 4 }}>Fetching what your class has assigned.</Body>
    </View>
  );

  if (submitting) return (
    <View style={[styles.centered, { backgroundColor: BG }]}>
      <ActivityIndicator size="large" color={BLUE} />
      <Text style={[styles.loadingText, { color: MUTED }]}>Grading your quiz...</Text>
    </View>
  );

  if (!quizId) return (
    <Page maxWidth={960}>
      <View style={{ marginTop: 8, marginBottom: 8 }}>
        <Heading level={1}>Quizzes</Heading>
        <Body style={{ marginTop: 4 }}>{listError ? 'Could not refresh the list' : `${availableQuizzes.length} assigned`}</Body>
      </View>
      <View style={{ paddingBottom: 8 }}>
        {listError ? (
          <View style={styles.emptyState} accessibilityRole="alert">
            <Ionicons name="cloud-offline-outline" size={64} color={BORDER} />
            <Text style={[styles.emptyText, { color: TEXT }]}>{"Couldn't load your quizzes"}</Text>
            <Text style={[styles.emptySubtext, { color: MUTED }]}>Check your internet connection and try again.</Text>
            <TouchableOpacity onPress={() => { setLoading(true); loadAvailableQuizzes(); }} style={styles.retryBtn} activeOpacity={0.8}>
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : availableQuizzes.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color={BORDER} />
            <Text style={[styles.emptyText, { color: TEXT }]}>No quizzes assigned yet</Text>
            <Text style={[styles.emptySubtext, { color: MUTED }]}>Join a class to see quizzes from your lecturer</Text>
            <TouchableOpacity onPress={() => navigation.navigate('JoinClass')} style={styles.retryBtn} accessibilityRole="button" accessibilityLabel="Join a class">
              <Text style={styles.retryText}>Join a class</Text>
            </TouchableOpacity>
          </View>
        ) : availableQuizzes.map((q) => (
          <PressableQuiz key={q.id} theme={theme} quiz={q} bestScore={bestScores[q.id]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate('Quiz', { quizId: q.id }); }} />
        ))}
      </View>
    </Page>
  );

  if (quizCompleted && result) {

    // A quiz pays out its best-ever attempt, once. xp_earned is what actually
    // landed on the total; xp_attempt_value is what this run was worth alone.
    // Only say anything if they've taken this quiz before — first-timers just
    // see their XP with no explanation needed.
    const isRetake = (result.xp_previous_best ?? 0) > 0;
    let retryNote = null;
    if (isRetake && result.is_personal_best) {
      retryNote = `New personal best — worth ${result.xp_attempt_value} XP, up from ${result.xp_previous_best}`;
    } else if (isRetake) {
      retryNote = `Worth ${result.xp_attempt_value} XP — your best on this quiz is still ${result.xp_previous_best}`;
    }

    return (
      <ScrollView style={[styles.container, { backgroundColor: BG }]} contentContainerStyle={{ paddingBottom: tabClearance }}>
        <View style={[styles.resultBanner, { backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border }]}>
          <IconTile name={result.passed ? 'trophy' : 'refresh'} tone={result.passed ? 'yellow' : 'blue'} size={56} />
          <Text style={[styles.resultTitle, { color: theme.text }]} accessibilityRole="header">Quiz completed</Text>
          <Text style={[styles.resultQuizTitle, { color: theme.textSecondary }]}>{quiz.title}</Text>
          <Text style={[styles.resultScore, { color: theme.text }]}>{result.score}%</Text>
          <Text style={[styles.resultFraction, { color: result.passed ? theme.successInk : theme.errorInk, fontSize: 16, fontWeight: '700' }]}>{result.passed ? 'Passed' : 'Failed'}</Text>
          <Text style={[styles.resultFraction, { color: 'rgba(11,27,58,0.65)', fontSize: 13 }]}>{result.correct_count} / {result.total_questions} correct</Text>

          <View style={styles.statsRow}>
            <View style={[styles.statPill, styles.neutralPill]}><Text style={[styles.statPillText, styles.neutralPillText]}>+{result.xp_earned} XP</Text></View>
            <View style={[styles.statPill, styles.neutralPill]}><Text style={[styles.statPillText, styles.neutralPillText]}>Best combo x{result.max_combo}</Text></View>
            <View style={[styles.statPill, styles.neutralPill]}><Text style={[styles.statPillText, styles.neutralPillText]}>{result.current_streak} day streak</Text></View>
          </View>

          {/* A quiz is worth its best attempt, once — explain a retake that
              earned nothing, and celebrate one that beat the old best. */}
          {retryNote && <Text style={[styles.retryNote, { color: theme.textSecondary }]}>{retryNote}</Text>}

          <View style={styles.resultBtns}>
            <Button label="Try again" variant="secondary" fit onPress={resetQuiz} />
            <Button label="Back to quizzes" fit onPress={() => navigation.goBack()} />
          </View>
        </View>

        {result.leveled_up && (
          <View style={styles.levelUpBanner}>
            <Ionicons name="rocket" size={26} color={PURPLE} />
            <Text style={styles.levelUpText}>Level up. You are now level {result.new_level}.</Text>
          </View>
        )}

        {result.new_badges?.length > 0 && (
          <View style={styles.badgesSection}>
            <Text style={styles.reviewTitle}>New Badges Earned</Text>
            <View style={styles.badgeRow}>
              {result.new_badges.map((b) => (
                <View key={b.code} style={styles.badgeChip}>
                  <Ionicons name={b.icon || 'trophy'} size={22} color={YELLOW} />
                  <Text style={styles.badgeChipText}>{b.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {result.review?.length > 0 && (
          <View style={styles.reviewSection}>
            <Text style={[styles.reviewTitle, { color: TEXT }]}>Review Answers</Text>
            {result.review.map((r, index) => (
              <View key={r.question_id} style={[styles.reviewCard, { backgroundColor: CARD }]}>
                <Text style={[styles.reviewQ, { color: TEXT }]}>{index + 1}. {r.question}</Text>
                <Text style={[styles.reviewA, { color: r.is_correct ? GREEN : RED }]}>
                  Your answer: {r.selected_answer ?? '(no answer)'} {r.is_correct ? 'Correct' : 'Incorrect'}
                </Text>
                {!r.is_correct && <Text style={styles.correctA}>Correct answer: {r.correct_answer}</Text>}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    );
  }

  if (submitError) return (
    <Page>
      <View style={styles.emptyState} accessibilityRole="alert">
        <Ionicons name="cloud-offline-outline" size={64} color={BORDER} />
        <Text style={[styles.emptyText, { color: TEXT }]}>Could not submit your quiz</Text>
        <Text style={[styles.emptySubtext, { color: MUTED }]}>Your answers are still here. Check your connection and try again.</Text>
        <TouchableOpacity onPress={() => submitQuiz(pendingAnswersRef.current)} style={styles.retryBtn} accessibilityRole="button" accessibilityLabel="Try submitting again">
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => leaveScreen(navigation)} style={[styles.retryBtn, { backgroundColor: 'transparent' }]} accessibilityRole="button" accessibilityLabel="Back to quizzes">
          <Text style={[styles.retryText, { color: BLUE }]}>Back to quizzes</Text>
        </TouchableOpacity>
      </View>
    </Page>
  );

  const currentQ = questions[currentQuestion];
  if (!currentQ || quizMissing) return (
    <Page>
      <View style={styles.emptyState}>
        <Ionicons name="document-text-outline" size={64} color={BORDER} />
        <Text style={[styles.emptyText, { color: TEXT }]}>This quiz has no questions yet</Text>
        <Text style={[styles.emptySubtext, { color: MUTED }]}>Ask your lecturer to add questions before you start.</Text>
        <TouchableOpacity onPress={() => leaveScreen(navigation)} style={styles.retryBtn} accessibilityRole="button" accessibilityLabel="Back to quizzes">
          <Text style={styles.retryText}>Back to quizzes</Text>
        </TouchableOpacity>
      </View>
    </Page>
  );
  const options = normalizeOptions(currentQ.options);
  const timerColor = timeLeft === null ? MUTED : timeLeft <= 5 ? RED : timeLeft <= 10 ? YELLOW : GREEN;
  const difficultyMeta = DIFFICULTY[currentQ.difficulty] || DIFFICULTY.medium;

  return (
    <View style={[styles.container, { backgroundColor: BG, paddingBottom: tabClearance }]}>
      <View style={[styles.header, { paddingTop: 12, backgroundColor: 'transparent' }]}>
        <IconButton name="chevLeft" label="Back" onPress={() => leaveScreen(navigation)} />
        <Text style={[styles.headerTitle, { color: TEXT }]} accessibilityRole="header">Question {currentQuestion + 1} of {questions.length}</Text>
        {timeLeft !== null && (
          <View style={[styles.timerPill, { backgroundColor: theme.tint }]}>
            <Icon name="clock" size={16} color={timerColor} />
            <Text style={[styles.timerPillText, { color: timerColor }]}>{timeLeft}s</Text>
          </View>
        )}
      </View>
      <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${((currentQuestion + 1) / questions.length) * 100}%` }]} /></View>
      <ScrollView style={styles.questionScroll}>
        <View style={[styles.difficultyPill, { backgroundColor: difficultyMeta.color + '1A', borderColor: difficultyMeta.color }]}>
          <Icon name={difficultyMeta.icon} size={14} color={difficultyMeta.color} />
          <Text style={[styles.difficultyText, { color: difficultyMeta.color }]}>
            {difficultyMeta.label} · {difficultyMeta.xp} XP
          </Text>
        </View>
        <Text style={[styles.questionText, { color: TEXT }]}>{currentQ.question}</Text>
        <View style={styles.optionsWrap}>
          {options.length === 0 ? (
            <Text style={[styles.emptySubtext, { color: MUTED }]}>This question has no answer choices.</Text>
          ) : null}
          {options.map((option, index) => (
            <TouchableOpacity key={index} style={[styles.optionBtn, { backgroundColor: CARD, borderColor: BORDER }, selectedAnswer === option && styles.optionBtnSelected]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedAnswer(option); }} activeOpacity={0.75}>
              <View style={[styles.optionLetter, { backgroundColor: BG }, selectedAnswer === option && { backgroundColor: BLUE }]}>
                <Text style={[styles.optionLetterText, { color: TEXT }, selectedAnswer === option && { color: WHITE }]}>{String.fromCharCode(65 + index)}</Text>
              </View>
              <Text style={[styles.optionText, { color: TEXT }, selectedAnswer === option && { color: BLUE, fontWeight: '700' }]}>{option}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <TouchableOpacity style={[styles.nextBtn, selectedAnswer === null && styles.nextBtnDisabled]} onPress={handleNextPress} disabled={selectedAnswer === null} activeOpacity={0.85}>
        <Text style={styles.nextBtnText}>{currentQuestion + 1 === questions.length ? 'Finish quiz' : 'Next question'}</Text>
        <Ionicons name="arrow-forward" size={18} color={WHITE} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.chatbotBtn} onPress={() => navigation.navigate('Chatbot', { context: `Help me with this quiz question: ${currentQ?.question}` })} activeOpacity={0.85}>
        <Ionicons name="chatbubbles" size={16} color={BLUE} />
        <Text style={styles.chatbotBtnText}>Ask CompuBot</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14 },
  header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 16, paddingHorizontal: 16, gap: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  timerPill: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, gap: 4 },
  timerPillText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  progressBar: { height: 6, backgroundColor: '#DCE6EF' },
  progressFill: { height: '100%', backgroundColor: '#0A66FF' },
  listScroll: { flex: 1, padding: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#0B1B3A', marginTop: 16 },
  emptySubtext: { fontSize: 13, color: '#44526F', marginTop: 6, textAlign: 'center' },
  retryBtn: { marginTop: 16, backgroundColor: '#0A66FF', borderRadius: 14, minHeight: 48, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  retryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  quizCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  quizIconWrap: { width: 52, height: 52, borderRadius: 14, backgroundColor: '#FFE680', alignItems: 'center', justifyContent: 'center' },
  quizInfo: { flex: 1 },
  quizTitle: { fontSize: 15, fontWeight: '700', color: '#0B1B3A', marginBottom: 3 },
  quizDesc: { fontSize: 13, color: '#44526F', marginBottom: 3 },
  passingScore: { fontSize: 11, color: '#44526F' },
  questionScroll: { flex: 1, padding: 20 },
  questionText: { fontSize: 20, fontWeight: '800', color: '#0B1B3A', marginBottom: 24, lineHeight: 28 },
  optionsWrap: { gap: 12 },
  optionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, gap: 14, borderWidth: 2, borderColor: '#DCE6EF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  optionBtnSelected: { borderColor: '#0A66FF', backgroundColor: '#0A66FF' + '10' },
  optionLetter: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F7FBFD', alignItems: 'center', justifyContent: 'center' },
  optionLetterText: { fontSize: 14, fontWeight: '800', color: '#0B1B3A' },
  optionText: { fontSize: 15, color: '#0B1B3A', flex: 1 },
  nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A66FF', marginHorizontal: 16, marginTop: 12, marginBottom: 4, height: 48, borderRadius: 14, gap: 8, alignSelf: 'center', width: '92%', maxWidth: 400 },
  nextBtnDisabled: { backgroundColor: '#D1D5DB', shadowOpacity: 0 },
  nextBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  resultBanner: { alignItems: 'center', padding: 40 },
  resultTitle: { fontSize: 26, fontWeight: '900', color: '#FFFFFF', marginTop: 16 },
  resultQuizTitle: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginBottom: 12 },
  resultScore: { fontSize: 56, fontWeight: '900', color: '#FFFFFF', marginBottom: 4 },
  resultFraction: { fontSize: 16, color: 'rgba(255,255,255,0.85)', marginBottom: 20 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 24 },
  statPill: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, gap: 6, minHeight: 32 },
  neutralPill: { backgroundColor: 'rgba(255,255,255,0.70)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' },
  neutralPillText: { color: 'rgba(11,27,58,0.65)', fontSize: 13 },
  statPillText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  retryNote: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600', textAlign: 'center', marginBottom: 20, paddingHorizontal: 24 },
  difficultyPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10 },
  difficultyText: { fontSize: 11, fontWeight: '800' },
  resultBtns: { flexDirection: 'row', gap: 12 },
  resultBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, gap: 6 },
  resultBtnText: { fontWeight: '700', fontSize: 14 },
  levelUpBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', marginHorizontal: 20, marginTop: 16, padding: 16, borderRadius: 14, borderWidth: 2, borderColor: '#0A6F79' + '40' },
  levelUpText: { fontSize: 14, fontWeight: '800', color: '#0A6F79', flex: 1 },
  badgesSection: { padding: 20, paddingBottom: 0 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badgeChip: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, gap: 6, width: 96, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  badgeChipText: { fontSize: 11, fontWeight: '700', color: '#0B1B3A', textAlign: 'center' },
  reviewSection: { padding: 20, paddingBottom: 40 },
  reviewTitle: { fontSize: 18, fontWeight: '800', color: '#0B1B3A', marginBottom: 16 },
  reviewCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  reviewQ: { fontSize: 14, fontWeight: '700', color: '#0B1B3A', marginBottom: 8 },
  reviewA: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  correctA: { fontSize: 13, color: '#1F9D55', fontWeight: '600' },
  chatbotBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginHorizontal: 16, marginBottom: 24, paddingVertical: 10, borderRadius: 12, backgroundColor: '#0A66FF' + '12', borderWidth: 1.5, borderColor: '#0A66FF' + '30', alignSelf: 'center', width: '92%', maxWidth: 400 },
  chatbotBtnText: { fontSize: 13, fontWeight: '700', color: '#0A66FF' },
});

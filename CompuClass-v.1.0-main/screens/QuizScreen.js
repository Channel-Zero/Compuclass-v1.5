import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { supabase } from '../config/supabase';
import { authService } from '../services/authService';
const BLUE = '#2563EB'; const YELLOW = '#FACC15'; const RED = '#EF4444';
const GREEN = '#22C55E'; const WHITE = '#FFFFFF'; const BG = '#F3F4F6';
const TEXT = '#111827'; const MUTED = '#4B5563'; const BORDER = '#E5E7EB';
const CARD = '#FFFFFF'; const PURPLE = '#8B5CF6'; const AMBER = '#CA8A04';

// Base XP mirrors the CASE in submit_quiz_attempt — keep the two in sync.
const DIFFICULTY = {
  easy:   { label: 'Easy',   color: GREEN, icon: 'leaf',    xp: 5  },
  medium: { label: 'Medium', color: AMBER, icon: 'flame',   xp: 10 },
  hard:   { label: 'Hard',   color: RED,   icon: 'barbell', xp: 15 },
};

export default function QuizScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
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

  // Refs so the timer's interval callback always sees fresh values
  // without having to restart the interval every render.
  const timerRef = useRef(null);
  const selectedAnswerRef = useRef(null);
  const answersRef = useRef([]);
  const questionsRef = useRef([]);
  const currentIndexRef = useRef(0);

  useEffect(() => { selectedAnswerRef.current = selectedAnswer; }, [selectedAnswer]);
  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { questionsRef.current = questions; }, [questions]);
  useEffect(() => { currentIndexRef.current = currentQuestion; }, [currentQuestion]);

  useEffect(() => { quizId ? loadQuiz() : loadAvailableQuizzes(); }, [quizId]);

  // Starts (or restarts) the countdown whenever the active question changes.
  // Untimed questions (time_limit_seconds is null) just skip the timer.
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    const q = questions[currentQuestion];
    if (!q || quizCompleted) return;
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
  }, [currentQuestion, questions.length]);

  const loadAvailableQuizzes = async () => {
    setListError(false);
    try {
      const user = await authService.getCurrentUser();
      const { data: classStudents, error: classError } = await supabase.from('class_students').select('class_id').eq('student_id', user.id);
      if (classError) throw classError;
      const classIds = classStudents?.map((cs) => cs.class_id) || [];
      if (classIds.length === 0) { setAvailableQuizzes([]); setLoading(false); return; }
      const { data: assignments, error: assignmentError } = await supabase.from('quiz_assignments').select('quiz_id').in('class_id', classIds);
      if (assignmentError) throw assignmentError;
      const quizIds = assignments?.map((a) => a.quiz_id) || [];
      if (quizIds.length === 0) { setAvailableQuizzes([]); setLoading(false); return; }
      const { data: quizzes, error: quizError } = await supabase.from('quizzes').select('*').in('id', quizIds);
      if (quizError) throw quizError;
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

      setQuiz(quizData);
      setQuestions((questionsData || []).slice().sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)));
    } catch {
      Alert.alert('Error', 'Failed to load quiz');
      navigation.goBack();
    } finally { setLoading(false); }
  };

  const advanceQuestion = useCallback((finalAnswer, finalTimeLeft) => {
    const qs = questionsRef.current;
    const idx = currentIndexRef.current;
    const currentQ = qs[idx];
    if (!currentQ) return;

    const newAnswers = [...answersRef.current, {
      question_id: currentQ.id,
      selected_answer: finalAnswer,
      time_remaining_seconds: currentQ.time_limit_seconds ? finalTimeLeft : null,
    }];
    setAnswers(newAnswers);

    if (idx + 1 < qs.length) {
      setCurrentQuestion(idx + 1);
      setSelectedAnswer(null);
    } else {
      submitQuiz(newAnswers);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNextPress = () => {
    if (selectedAnswer === null) { Alert.alert('Please select an answer'); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (timerRef.current) clearInterval(timerRef.current);
    advanceQuestion(selectedAnswer, timeLeft);
  };

  const submitQuiz = async (finalAnswers) => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('submit_quiz_attempt', {
        p_quiz_id: quizId,
        p_answers: finalAnswers,
      });
      if (error) throw error;
      setResult(data);
      setQuizCompleted(true);
      if (data?.leveled_up) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Error', 'Could not submit your quiz. Check your connection and try again.');
    } finally { setSubmitting(false); }
  };

  const resetQuiz = () => {
    setCurrentQuestion(0); setSelectedAnswer(null); setAnswers([]);
    setQuizCompleted(false); setResult(null); setTimeLeft(null);
  };

  if (loading) return <View style={[styles.centered, { backgroundColor: BG }]}><ActivityIndicator size="large" color={BLUE} /><Text style={[styles.loadingText, { color: MUTED }]}>Loading...</Text></View>;

  if (submitting) return (
    <View style={[styles.centered, { backgroundColor: BG }]}>
      <ActivityIndicator size="large" color={BLUE} />
      <Text style={[styles.loadingText, { color: MUTED }]}>Grading your quiz...</Text>
    </View>
  );

  if (!quizId) return (
    <View style={[styles.container, { backgroundColor: BG }]}>
      <LinearGradient colors={[YELLOW, '#EAB308']} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={TEXT} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: TEXT }]}>Available Quizzes</Text>
      </LinearGradient>
      <ScrollView style={[styles.listScroll, { backgroundColor: BG }]} contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}>
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
            <Text style={[styles.emptySubtext, { color: MUTED }]}>Your lecturer will assign quizzes to your class</Text>
          </View>
        ) : availableQuizzes.map((q) => (
          <TouchableOpacity key={q.id} style={[styles.quizCard, { backgroundColor: CARD }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate('Quiz', { quizId: q.id }); }} activeOpacity={0.75}>
            <View style={styles.quizIconWrap}><Ionicons name="document-text" size={26} color={WHITE} /></View>
            <View style={styles.quizInfo}>
              <Text style={[styles.quizTitle, { color: TEXT }]}>{q.title}</Text>
              {q.description && <Text style={[styles.quizDesc, { color: MUTED }]}>{q.description}</Text>}
              <Text style={[styles.passingScore, { color: MUTED }]}>Passing: {q.passing_score}%</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={MUTED} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  if (quizCompleted && result) {
    const scoreColor = result.passed ? GREEN : (result.score >= 60 ? YELLOW : RED);

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
      <ScrollView style={[styles.container, { backgroundColor: BG }]}>
        <LinearGradient colors={[scoreColor, scoreColor + 'CC']} style={styles.resultBanner}>
          <Ionicons name={result.passed ? 'trophy' : 'ribbon'} size={60} color={WHITE} />
          <Text style={styles.resultTitle}>Quiz Completed! 🎉</Text>
          <Text style={styles.resultQuizTitle}>{quiz.title}</Text>
          <Text style={styles.resultScore}>{result.score}%</Text>
          <Text style={styles.resultFraction}>{result.correct_count} / {result.total_questions} correct</Text>

          <View style={styles.statsRow}>
            <View style={styles.statPill}><Ionicons name="flash" size={14} color={WHITE} /><Text style={styles.statPillText}>+{result.xp_earned} XP</Text></View>
            <View style={styles.statPill}><Ionicons name="trending-up" size={14} color={WHITE} /><Text style={styles.statPillText}>Best combo x{result.max_combo}</Text></View>
            <View style={styles.statPill}><Ionicons name="flame" size={14} color={WHITE} /><Text style={styles.statPillText}>{result.current_streak} day streak</Text></View>
          </View>

          {/* A quiz is worth its best attempt, once — explain a retake that
              earned nothing, and celebrate one that beat the old best. */}
          {retryNote && <Text style={styles.retryNote}>{retryNote}</Text>}

          <View style={styles.resultBtns}>
            <TouchableOpacity style={styles.resultBtn} onPress={resetQuiz} activeOpacity={0.85}><Ionicons name="refresh" size={16} color={scoreColor} /><Text style={[styles.resultBtnText, { color: scoreColor }]}>Try Again</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.resultBtn, { backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 0 }]} onPress={() => navigation.goBack()} activeOpacity={0.85}><Ionicons name="home" size={16} color={WHITE} /><Text style={[styles.resultBtnText, { color: WHITE }]}>Home</Text></TouchableOpacity>
          </View>
        </LinearGradient>

        {result.leveled_up && (
          <View style={styles.levelUpBanner}>
            <Ionicons name="rocket" size={26} color={PURPLE} />
            <Text style={styles.levelUpText}>Level Up! You&apos;re now Level {result.new_level} 🎊</Text>
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
                  Your answer: {r.selected_answer ?? '(no answer)'} {r.is_correct ? '✓' : '✗'}
                </Text>
                {!r.is_correct && <Text style={styles.correctA}>✓ Correct: {r.correct_answer}</Text>}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    );
  }

  const currentQ = questions[currentQuestion];
  if (!currentQ) return null;
  const options = typeof currentQ.options === 'string' ? JSON.parse(currentQ.options) : currentQ.options;
  const timerColor = timeLeft === null ? MUTED : timeLeft <= 5 ? RED : timeLeft <= 10 ? YELLOW : GREEN;
  const difficultyMeta = DIFFICULTY[currentQ.difficulty] || DIFFICULTY.medium;

  return (
    <View style={[styles.container, { backgroundColor: BG }]}>
      <LinearGradient colors={[BLUE, '#1D4ED8']} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}><Ionicons name="arrow-back" size={20} color={WHITE} /></TouchableOpacity>
        <Text style={styles.headerTitle}>Question {currentQuestion + 1} of {questions.length}</Text>
        {timeLeft !== null && (
          <View style={[styles.timerPill, { backgroundColor: timerColor }]}>
            <Ionicons name="time" size={14} color={WHITE} />
            <Text style={styles.timerPillText}>{timeLeft}s</Text>
          </View>
        )}
      </LinearGradient>
      <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${((currentQuestion + 1) / questions.length) * 100}%` }]} /></View>
      <ScrollView style={styles.questionScroll}>
        <View style={[styles.difficultyPill, { backgroundColor: difficultyMeta.color + '1A', borderColor: difficultyMeta.color }]}>
          <Ionicons name={difficultyMeta.icon} size={12} color={difficultyMeta.color} />
          <Text style={[styles.difficultyText, { color: difficultyMeta.color }]}>
            {difficultyMeta.label} · {difficultyMeta.xp} XP
          </Text>
        </View>
        <Text style={[styles.questionText, { color: TEXT }]}>{currentQ.question}</Text>
        <View style={styles.optionsWrap}>
          {Array.isArray(options) && options.map((option, index) => (
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
        <Text style={styles.nextBtnText}>{currentQuestion + 1 === questions.length ? 'Finish Quiz 🎉' : 'Next Question'}</Text>
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
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: WHITE },
  timerPill: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, gap: 4 },
  timerPillText: { fontSize: 13, fontWeight: '800', color: WHITE },
  progressBar: { height: 6, backgroundColor: BORDER },
  progressFill: { height: '100%', backgroundColor: BLUE },
  listScroll: { flex: 1, padding: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 18, fontWeight: '700', color: TEXT, marginTop: 16 },
  emptySubtext: { fontSize: 13, color: MUTED, marginTop: 6, textAlign: 'center' },
  retryBtn: { marginTop: 16, backgroundColor: BLUE, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 22 },
  retryText: { color: WHITE, fontSize: 14, fontWeight: '800' },
  quizCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: WHITE, borderRadius: 16, padding: 16, marginBottom: 12, gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  quizIconWrap: { width: 52, height: 52, borderRadius: 14, backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center' },
  quizInfo: { flex: 1 },
  quizTitle: { fontSize: 15, fontWeight: '700', color: TEXT, marginBottom: 3 },
  quizDesc: { fontSize: 13, color: MUTED, marginBottom: 3 },
  passingScore: { fontSize: 11, color: MUTED },
  questionScroll: { flex: 1, padding: 20 },
  questionText: { fontSize: 20, fontWeight: '800', color: TEXT, marginBottom: 24, lineHeight: 28 },
  optionsWrap: { gap: 12 },
  optionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: WHITE, borderRadius: 14, padding: 14, gap: 14, borderWidth: 2, borderColor: BORDER, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  optionBtnSelected: { borderColor: BLUE, backgroundColor: BLUE + '10' },
  optionLetter: { width: 34, height: 34, borderRadius: 10, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  optionLetterText: { fontSize: 14, fontWeight: '800', color: TEXT },
  optionText: { fontSize: 15, color: TEXT, flex: 1 },
  nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: BLUE, margin: 16, height: 54, borderRadius: 14, gap: 8, shadowColor: BLUE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  nextBtnDisabled: { backgroundColor: '#D1D5DB', shadowOpacity: 0 },
  nextBtnText: { color: WHITE, fontSize: 16, fontWeight: '800' },
  resultBanner: { alignItems: 'center', padding: 40 },
  resultTitle: { fontSize: 26, fontWeight: '900', color: WHITE, marginTop: 16 },
  resultQuizTitle: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginBottom: 12 },
  resultScore: { fontSize: 56, fontWeight: '900', color: WHITE, marginBottom: 4 },
  resultFraction: { fontSize: 16, color: 'rgba(255,255,255,0.85)', marginBottom: 20 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 24 },
  statPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, gap: 6 },
  statPillText: { color: WHITE, fontSize: 12, fontWeight: '800' },
  retryNote: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600', textAlign: 'center', marginBottom: 20, paddingHorizontal: 24 },
  difficultyPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10 },
  difficultyText: { fontSize: 11, fontWeight: '800' },
  resultBtns: { flexDirection: 'row', gap: 12 },
  resultBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: WHITE, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, gap: 6 },
  resultBtnText: { fontWeight: '700', fontSize: 14 },
  levelUpBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: WHITE, marginHorizontal: 20, marginTop: 16, padding: 16, borderRadius: 14, borderWidth: 2, borderColor: PURPLE + '40' },
  levelUpText: { fontSize: 14, fontWeight: '800', color: PURPLE, flex: 1 },
  badgesSection: { padding: 20, paddingBottom: 0 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badgeChip: { alignItems: 'center', backgroundColor: WHITE, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, gap: 6, width: 96, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  badgeChipText: { fontSize: 11, fontWeight: '700', color: TEXT, textAlign: 'center' },
  reviewSection: { padding: 20, paddingBottom: 40 },
  reviewTitle: { fontSize: 18, fontWeight: '800', color: TEXT, marginBottom: 16 },
  reviewCard: { backgroundColor: WHITE, borderRadius: 16, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  reviewQ: { fontSize: 14, fontWeight: '700', color: TEXT, marginBottom: 8 },
  reviewA: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  correctA: { fontSize: 13, color: GREEN, fontWeight: '600' },
  chatbotBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginHorizontal: 16, marginBottom: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: BLUE + '12', borderWidth: 1.5, borderColor: BLUE + '30' },
  chatbotBtnText: { fontSize: 13, fontWeight: '700', color: BLUE },
});

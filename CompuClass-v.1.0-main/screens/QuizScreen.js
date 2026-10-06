import React, { useState, useEffect } from 'react';
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

export default function QuizScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { quizId } = route?.params || {};
  const [loading, setLoading] = useState(true);
  const [availableQuizzes, setAvailableQuizzes] = useState([]);
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [score, setScore] = useState(0);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { quizId ? loadQuiz() : loadAvailableQuizzes(); }, [quizId]);

  const loadAvailableQuizzes = async () => {
    try {
      const user = await authService.getCurrentUser();
      const { data: classStudents } = await supabase.from('class_students').select('class_id').eq('student_id', user.id);
      const classIds = classStudents?.map((cs) => cs.class_id) || [];
      if (classIds.length === 0) { setAvailableQuizzes([]); setLoading(false); return; }
      const { data: assignments } = await supabase.from('quiz_assignments').select('quiz_id').in('class_id', classIds);
      const quizIds = assignments?.map((a) => a.quiz_id) || [];
      if (quizIds.length === 0) { setAvailableQuizzes([]); setLoading(false); return; }
      const { data: quizzes, error } = await supabase.from('quizzes').select('id, title, description, passing_score, question_count').in('id', quizIds);
      if (error) throw error;
      setAvailableQuizzes(quizzes || []);
    } catch (error) { Alert.alert('Error', error.message || 'Failed to load quizzes'); }
    finally { setLoading(false); }
  };

  const loadQuiz = async () => {
    try {
      const { data, error } = await supabase.rpc('get_quiz_for_student', { p_quiz_id: quizId });
      if (error) throw error;
      setQuiz(data);
      setQuestions(data?.questions || []);
    } catch (error) { Alert.alert('Error', error.message || 'Failed to load quiz'); navigation.goBack(); }
    finally { setLoading(false); }
  };

  const handleNextQuestion = () => {
    if (submitting || selectedAnswer === null) { Alert.alert('Please select an answer'); return; }
    const newAnswers = [...answers, { questionId: questions[currentQuestion].id, selected: selectedAnswer }];
    setAnswers(newAnswers);
    if (currentQuestion + 1 < questions.length) { setCurrentQuestion(currentQuestion + 1); setSelectedAnswer(null); }
    else submitQuizAttempt(newAnswers);
  };

  const submitQuizAttempt = async (answerPayload) => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('submit_quiz_attempt', {
        p_quiz_id: quizId,
        p_answers: answerPayload,
      });
      if (error) throw error;
      setResult(data);
      setScore(data?.correct || 0);
      setQuizCompleted(true);
    } catch (error) {
      Alert.alert('Could not save quiz', error.message || 'Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetQuiz = () => { setCurrentQuestion(0); setSelectedAnswer(null); setScore(0); setQuizCompleted(false); setAnswers([]); setResult(null); };

  const pct = result?.score ?? 0;
  const scoreColor = result?.passed ? GREEN : RED;

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color={BLUE} /><Text style={styles.loadingText}>Loading...</Text></View>;

  if (!quizId) return (
    <View style={styles.container}>
      <LinearGradient colors={[YELLOW, '#EAB308']} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={TEXT} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: TEXT }]}>Available Quizzes</Text>
      </LinearGradient>
      <ScrollView style={styles.listScroll} contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}>
        {availableQuizzes.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color={BORDER} />
            <Text style={styles.emptyText}>No quizzes assigned yet</Text>
            <Text style={styles.emptySubtext}>Your lecturer will assign quizzes to your class</Text>
          </View>
        ) : availableQuizzes.map((q) => (
          <TouchableOpacity key={q.id} style={styles.quizCard} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate('Quiz', { quizId: q.id }); }} activeOpacity={0.75}>
            <View style={styles.quizIconWrap}><Ionicons name="document-text" size={26} color={WHITE} /></View>
            <View style={styles.quizInfo}>
              <Text style={styles.quizTitle}>{q.title}</Text>
              {q.description && <Text style={styles.quizDesc}>{q.description}</Text>}
              <Text style={styles.passingScore}>Passing: {q.passing_score}%</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={MUTED} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  if (quizCompleted) return (
    <ScrollView style={styles.container}>
      <LinearGradient colors={[scoreColor, scoreColor + 'CC']} style={styles.resultBanner}>
        <Ionicons name="trophy" size={60} color={WHITE} />
        <Text style={styles.resultTitle}>Quiz Completed! 🎉</Text>
        <Text style={styles.resultQuizTitle}>{quiz.title}</Text>
        <Text style={styles.resultScore}>{pct}%</Text>
        <Text style={styles.resultFraction}>{result?.correct ?? 0} / {result?.total ?? questions.length} correct</Text>
        <Text style={styles.resultFraction}>{result?.passed ? 'Passed' : 'Not passed'} · pass mark {result?.passingScore ?? quiz?.passing_score}%</Text>
        <View style={styles.resultBtns}>
          <TouchableOpacity style={styles.resultBtn} onPress={resetQuiz} activeOpacity={0.85}><Ionicons name="refresh" size={16} color={scoreColor} /><Text style={[styles.resultBtnText, { color: scoreColor }]}>Try Again</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.resultBtn, { backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 0 }]} onPress={() => navigation.goBack()} activeOpacity={0.85}><Ionicons name="home" size={16} color={WHITE} /><Text style={[styles.resultBtnText, { color: WHITE }]}>Home</Text></TouchableOpacity>
        </View>
      </LinearGradient>
      <View style={styles.reviewSection}>
        <Text style={styles.reviewTitle}>Review Answers</Text>
        {(result?.review || []).map((item, index) => (
          <View key={item.questionId || index} style={styles.reviewCard}>
            <Text style={styles.reviewQ}>{index + 1}. {item.question}</Text>
            <Text style={[styles.reviewA, { color: item.isCorrect ? GREEN : RED }]}>Your answer: {item.selected || '—'} {item.isCorrect ? '✓' : '✗'}</Text>
            {!item.isCorrect && <Text style={styles.correctA}>✓ Correct: {item.correctAnswer}</Text>}
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const currentQ = questions[currentQuestion];
  if (!currentQ) return null;
  const options = typeof currentQ.options === 'string' ? JSON.parse(currentQ.options) : currentQ.options;

  return (
    <View style={styles.container}>
      <LinearGradient colors={[BLUE, '#1D4ED8']} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}><Ionicons name="arrow-back" size={20} color={WHITE} /></TouchableOpacity>
        <Text style={styles.headerTitle}>Question {currentQuestion + 1} of {questions.length}</Text>
        <View style={styles.scorePill}><Text style={styles.scorePillText}>Score: {score}</Text></View>
      </LinearGradient>
      <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${((currentQuestion + 1) / questions.length) * 100}%` }]} /></View>
      <ScrollView style={styles.questionScroll}>
        <Text style={styles.questionText}>{currentQ.question}</Text>
        <View style={styles.optionsWrap}>
          {Array.isArray(options) && options.map((option, index) => (
            <TouchableOpacity key={index} style={[styles.optionBtn, selectedAnswer === option && styles.optionBtnSelected]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedAnswer(option); }} activeOpacity={0.75}>
              <View style={[styles.optionLetter, selectedAnswer === option && { backgroundColor: BLUE }]}>
                <Text style={[styles.optionLetterText, selectedAnswer === option && { color: WHITE }]}>{String.fromCharCode(65 + index)}</Text>
              </View>
              <Text style={[styles.optionText, selectedAnswer === option && { color: BLUE, fontWeight: '700' }]}>{option}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <TouchableOpacity style={[styles.nextBtn, (selectedAnswer === null || submitting) && styles.nextBtnDisabled]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); handleNextQuestion(); }} disabled={selectedAnswer === null || submitting} activeOpacity={0.85}>
        <Text style={styles.nextBtnText}>{submitting ? 'Saving...' : currentQuestion + 1 === questions.length ? 'Finish Quiz 🎉' : 'Next Question'}</Text>
        <Ionicons name="arrow-forward" size={18} color={WHITE} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  centered: { flex: 1, backgroundColor: BG, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: MUTED, marginTop: 12, fontSize: 14 },
  header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 16, paddingHorizontal: 16, gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: WHITE },
  scorePill: { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  scorePillText: { fontSize: 13, fontWeight: '700', color: WHITE },
  progressBar: { height: 6, backgroundColor: BORDER },
  progressFill: { height: '100%', backgroundColor: BLUE },
  listScroll: { flex: 1, padding: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 18, fontWeight: '700', color: TEXT, marginTop: 16 },
  emptySubtext: { fontSize: 13, color: MUTED, marginTop: 6, textAlign: 'center' },
  quizCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: WHITE, borderRadius: 16, padding: 16, marginBottom: 12, gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  quizIconWrap: { width: 52, height: 52, borderRadius: 14, backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center' },
  quizInfo: { flex: 1 },
  quizTitle: { fontSize: 15, fontWeight: '700', color: TEXT, marginBottom: 3 },
  quizDesc: { fontSize: 13, color: MUTED, marginBottom: 3 },
  passingScore: { fontSize: 11, color: MUTED },
  questionScroll: { flex: 1, padding: 20 },
  questionText: { fontSize: 20, fontWeight: '800', color: TEXT, marginBottom: 24, lineHeight: 28 },
  optionsWrap: { gap: 12 },
  optionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: WHITE, borderRadius: 14, padding: 14, gap: 14, borderWidth: 2, borderColor: BORDER, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  optionBtnSelected: { borderColor: BLUE, backgroundColor: BLUE + '10' },
  optionLetter: { width: 34, height: 34, borderRadius: 10, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  optionLetterText: { fontSize: 14, fontWeight: '800', color: TEXT },
  optionText: { fontSize: 15, color: TEXT, flex: 1 },
  nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: BLUE, margin: 16, padding: 16, borderRadius: 14, gap: 8, shadowColor: BLUE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  nextBtnDisabled: { backgroundColor: '#D1D5DB', shadowOpacity: 0 },
  nextBtnText: { color: WHITE, fontSize: 16, fontWeight: '800' },
  resultBanner: { alignItems: 'center', padding: 40 },
  resultTitle: { fontSize: 26, fontWeight: '900', color: WHITE, marginTop: 16 },
  resultQuizTitle: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginBottom: 12 },
  resultScore: { fontSize: 56, fontWeight: '900', color: WHITE, marginBottom: 4 },
  resultFraction: { fontSize: 16, color: 'rgba(255,255,255,0.85)', marginBottom: 24 },
  resultBtns: { flexDirection: 'row', gap: 12 },
  resultBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: WHITE, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, gap: 6 },
  resultBtnText: { fontWeight: '700', fontSize: 14 },
  reviewSection: { padding: 20, paddingBottom: 40 },
  reviewTitle: { fontSize: 18, fontWeight: '800', color: TEXT, marginBottom: 16 },
  reviewCard: { backgroundColor: WHITE, borderRadius: 14, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  reviewQ: { fontSize: 14, fontWeight: '700', color: TEXT, marginBottom: 8 },
  reviewA: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  correctA: { fontSize: 13, color: GREEN, fontWeight: '600' },
});

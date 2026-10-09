import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { lecturerService } from '../services/lecturerService';
import { getErrorMessage } from '../utils/errorMessages';

const BLUE = '#2563EB'; const YELLOW = '#FACC15'; const RED = '#EF4444'; const GREEN = '#22C55E';
const WHITE = '#FFFFFF'; const BG = '#F3F4F6'; const TEXT = '#111827'; const MUTED = '#4B5563'; const BORDER = '#E5E7EB';

export default function QuizDetailScreen({ navigation, route }) {
  const { quizId } = route.params;
  const [quiz, setQuiz] = useState(null);

  useEffect(() => { loadQuiz(); }, []);

  const loadQuiz = async () => {
    try { const data = await lecturerService.getQuizDetail(quizId); setQuiz(data); }
    catch (error) { Alert.alert('Error', getErrorMessage(error, { context: 'QuizDetail' })); }
  };

  const handleDeleteQuiz = () => {
    Alert.alert('Delete Quiz', 'Are you sure you want to delete this quiz?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await lecturerService.deleteQuiz(quizId); navigation.goBack(); Alert.alert('Success', 'Quiz deleted'); }
        catch (error) { Alert.alert('Error', getErrorMessage(error, { context: 'QuizDetail' })); }
      }},
    ]);
  };

  if (!quiz) return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={BLUE} />
      <Text style={styles.loadingText}>Loading quiz...</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={[YELLOW, '#EAB308']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={TEXT} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: TEXT }]}>Quiz Details</Text>
        <TouchableOpacity onPress={handleDeleteQuiz} style={styles.deleteBtn}>
          <Ionicons name="trash" size={18} color={RED} />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.quizHeaderCard}>
          <View style={styles.quizIconWrap}>
            <Ionicons name="document-text" size={28} color={WHITE} />
          </View>
          <Text style={styles.quizTitle}>{quiz.title}</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaBadge}>
              <Ionicons name="help-circle" size={14} color={BLUE} />
              <Text style={styles.metaText}>{quiz.quiz_questions?.length || 0} Questions</Text>
            </View>
            <View style={[styles.metaBadge, { backgroundColor: GREEN + '15' }]}>
              <Ionicons name="checkmark-circle" size={14} color={GREEN} />
              <Text style={[styles.metaText, { color: GREEN }]}>{quiz.passing_score}% to pass</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Questions</Text>

        {quiz.quiz_questions?.map((question, index) => (
          <View key={index} style={styles.questionCard}>
            <View style={styles.questionNumRow}>
              <View style={styles.questionNumBadge}>
                <Text style={styles.questionNumText}>Q{index + 1}</Text>
              </View>
            </View>
            <Text style={styles.questionText}>{question.question}</Text>
            <View style={styles.optionsWrap}>
              {question.options?.map((option, optIndex) => {
                const isCorrect = question.correct_answer === option;
                return (
                  <View key={optIndex} style={[styles.optionItem, isCorrect && styles.optionCorrect]}>
                    <View style={[styles.optionLetter, isCorrect && { backgroundColor: GREEN }]}>
                      <Text style={[styles.optionLetterText, isCorrect && { color: WHITE }]}>
                        {String.fromCharCode(65 + optIndex)}
                      </Text>
                    </View>
                    <Text style={[styles.optionText, isCorrect && styles.optionTextCorrect]}>{option}</Text>
                    {isCorrect && <Ionicons name="checkmark-circle" size={18} color={GREEN} />}
                  </View>
                );
              })}
            </View>
          </View>
        ))}
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  centered: { flex: 1, backgroundColor: BG, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: MUTED, fontSize: 14, marginTop: 12, fontWeight: '600' },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16, gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.1)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '900' },
  deleteBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: RED + '20', alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, padding: 16 },
  quizHeaderCard: { backgroundColor: WHITE, borderRadius: 16, padding: 20, marginBottom: 20, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 },
  quizIconWrap: { width: 60, height: 60, borderRadius: 18, backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  quizTitle: { fontSize: 20, fontWeight: '900', color: TEXT, marginBottom: 14, textAlign: 'center' },
  metaRow: { flexDirection: 'row', gap: 10 },
  metaBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: BLUE + '15', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, gap: 5 },
  metaText: { fontSize: 13, color: BLUE, fontWeight: '700' },
  sectionLabel: { fontSize: 13, fontWeight: '800', color: MUTED, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  questionCard: { backgroundColor: WHITE, borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  questionNumRow: { marginBottom: 10 },
  questionNumBadge: { backgroundColor: BLUE, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  questionNumText: { fontSize: 11, fontWeight: '900', color: WHITE, letterSpacing: 0.5 },
  questionText: { fontSize: 15, fontWeight: '700', color: TEXT, marginBottom: 14, lineHeight: 22 },
  optionsWrap: { gap: 8 },
  optionItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 2, borderColor: BORDER, backgroundColor: BG, gap: 10 },
  optionCorrect: { borderColor: GREEN, backgroundColor: GREEN + '10' },
  optionLetter: { width: 30, height: 30, borderRadius: 8, backgroundColor: BORDER, alignItems: 'center', justifyContent: 'center' },
  optionLetterText: { fontSize: 13, fontWeight: '900', color: TEXT },
  optionText: { fontSize: 13, color: MUTED, flex: 1, fontWeight: '500' },
  optionTextCorrect: { color: GREEN, fontWeight: '700' },
});

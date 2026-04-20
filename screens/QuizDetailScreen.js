import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { lecturerService } from '../services/lecturerService';
//Quiz detail screen for lecturer to view quiz details and delete quiz
export default function QuizDetailScreen({ navigation, route }) {
  const { theme } = useTheme();
  const { quizId } = route.params;
  const [quiz, setQuiz] = useState(null);

  useEffect(() => {
    loadQuiz();
  }, []);

  const loadQuiz = async () => {
    try {
      const data = await lecturerService.getQuizDetail(quizId);
      setQuiz(data);
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleDeleteQuiz = () => {
    Alert.alert('Delete Quiz', 'Are you sure you want to delete this quiz?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await lecturerService.deleteQuiz(quizId);
            navigation.goBack();
            Alert.alert('Success', 'Quiz deleted');
          } catch (error) {
            Alert.alert('Error', error.message);
          }
        }
      }
    ]);
  };

  if (!quiz) {
    return (
      <View style={[styles.container, { backgroundColor: theme.surface }]}>
        <Text style={[styles.loading, { color: theme.text }]}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <LinearGradient colors={theme.gradient} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Quiz Details</Text>
          <TouchableOpacity onPress={handleDeleteQuiz}>
            <Ionicons name="trash" size={24} color={theme.error} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content}>
        <View style={[styles.quizHeader, { backgroundColor: theme.card }]}>
          <Text style={[styles.quizTitle, { color: theme.text }]}>{quiz.title}</Text>
          <View style={styles.quizMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="help-circle" size={16} color={theme.primary} />
              <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                {quiz.quiz_questions?.length || 0} Questions
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="checkmark-circle" size={16} color={theme.success} />
              <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                {quiz.passing_score}% to pass
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.questionsContainer}>
          {quiz.quiz_questions?.map((question, index) => (
            <View key={index} style={[styles.questionCard, { backgroundColor: theme.card }]}>
              <View style={styles.questionHeader}>
                <Text style={[styles.questionNumber, { color: theme.primary }]}>
                  Question {index + 1}
                </Text>
              </View>
              
              <Text style={[styles.questionText, { color: theme.text }]}>
                {question.question}
              </Text>
              
              <View style={styles.optionsContainer}>
                {question.options?.map((option, optIndex) => (
                  <View
                    key={optIndex}
                    style={[
                      styles.optionItem,
                      {
                        backgroundColor: question.correct_answer === option 
                          ? theme.success + '20' 
                          : theme.borderLight,
                        borderColor: question.correct_answer === option 
                          ? theme.success 
                          : theme.border
                      }
                    ]}
                  >
                    <Text style={[styles.optionText, { color: theme.text }]}>
                      {String.fromCharCode(65 + optIndex)}. {option}
                    </Text>
                    {question.correct_answer === option && (
                      <Ionicons name="checkmark-circle" size={20} color={theme.success} />
                    )}
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 50, paddingBottom: 20 },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  loading: { textAlign: 'center', marginTop: 50, fontSize: 16 },
  content: { flex: 1 },
  quizHeader: {
    padding: 20,
    margin: 16,
    borderRadius: 12,
  },
  quizTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 12 },
  quizMeta: { flexDirection: 'row', gap: 16 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 14 },
  questionsContainer: { paddingHorizontal: 16, paddingBottom: 20 },
  questionCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  questionHeader: { marginBottom: 12 },
  questionNumber: { fontSize: 14, fontWeight: '600' },
  questionText: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  optionsContainer: { gap: 8 },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  optionText: { fontSize: 14, flex: 1 },
});
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../context/ThemeContext";
import { supabase } from "../config/supabase";
import { authService } from "../services/authService";
//Quiz screen for students to take quizzes assigned to their class. Quizzes are loaded from Supabase based on quizId passed from previous screen. Students can select answers and submit quiz. Score is calculated and displayed at the end along with correct answers for review. Quiz attempts are saved to Supabase for tracking student progress.
export default function QuizScreen({ route, navigation }) {
  const { theme } = useTheme();
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

  useEffect(() => {
    if (quizId) {
      loadQuiz();
    } else {
      loadAvailableQuizzes();
    }
  }, [quizId]);

  const loadAvailableQuizzes = async () => {
    try {
      const user = await authService.getCurrentUser();

      const { data: classStudents } = await supabase
        .from("class_students")
        .select("class_id")
        .eq("student_id", user.id);

      const classIds = classStudents?.map((cs) => cs.class_id) || [];

      if (classIds.length === 0) {
        setAvailableQuizzes([]);
        setLoading(false);
        return;
      }

      const { data: assignments } = await supabase
        .from("quiz_assignments")
        .select("quiz_id")
        .in("class_id", classIds);

      const quizIds = assignments?.map((a) => a.quiz_id) || [];

      if (quizIds.length === 0) {
        setAvailableQuizzes([]);
        setLoading(false);
        return;
      }

      const { data: quizzes } = await supabase
        .from("quizzes")
        .select("*")
        .in("id", quizIds);

      setAvailableQuizzes(quizzes || []);
    } catch (error) {
      console.error("Error loading quizzes:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadQuiz = async () => {
    try {
      const { data: quizData, error: quizError } = await supabase
        .from("quizzes")
        .select("*")
        .eq("id", quizId)
        .single();

      if (quizError) throw quizError;

      const { data: questionsData, error: questionsError } = await supabase
        .from("quiz_questions")
        .select("*")
        .eq("quiz_id", quizId)
        .order("order_index");

      if (questionsError) throw questionsError;

      setQuiz(quizData);
      setQuestions(questionsData);
    } catch (error) {
      console.error("Error loading quiz:", error);
      Alert.alert("Error", "Failed to load quiz");
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (answer) => {
    setSelectedAnswer(answer);
  };

  const handleNextQuestion = () => {
    if (selectedAnswer === null) {
      Alert.alert(
        "Please select an answer",
        "Choose one of the options before proceeding.",
      );
      return;
    }

    const isCorrect =
      selectedAnswer === questions[currentQuestion].correct_answer;
    const newAnswers = [
      ...answers,
      {
        questionId: questions[currentQuestion].id,
        selected: selectedAnswer,
        correct: questions[currentQuestion].correct_answer,
        isCorrect,
      },
    ];

    setAnswers(newAnswers);

    if (isCorrect) {
      setScore(score + 1);
    }

    if (currentQuestion + 1 < questions.length) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
    } else {
      submitQuizAttempt(score + (isCorrect ? 1 : 0));
    }
  };

  const submitQuizAttempt = async (finalScore) => {
    try {
      const user = await authService.getCurrentUser();
      const percentage = Math.round((finalScore / questions.length) * 100);

      console.log("📝 Submitting quiz attempt:", {
        user_id: user.id,
        quiz_id: quizId,
        score: percentage,
      });

      const { data, error } = await supabase.from("quiz_attempts").insert({
        user_id: user.id,
        quiz_id: quizId,
        score: percentage,
      });

      if (error) {
        console.error("❌ Quiz submission error:", error.message);
        console.error("Error details:", error);
      } else {
        console.log("✅ Quiz submitted successfully:", data);
      }

      setQuizCompleted(true);
    } catch (error) {
      console.error("❌ Quiz submission exception:", error);
      setQuizCompleted(true);
    }
  };

  const resetQuiz = () => {
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setScore(0);
    setQuizCompleted(false);
    setAnswers([]);
  };

  const getScoreColor = () => {
    const percentage = (score / questions.length) * 100;
    if (percentage >= 80) return "#10B981";
    if (percentage >= 60) return "#F59E0B";
    return "#EF4444";
  };

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.surface,
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>
          Loading...
        </Text>
      </View>
    );
  }

  if (!quizId) {
    return (
      <View style={[styles.container, { backgroundColor: theme.surface }]}>
        <View style={[styles.header, { backgroundColor: theme.card }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={theme.primary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Available Quizzes
          </Text>
        </View>

        <ScrollView style={styles.quizListContainer}>
          {availableQuizzes.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="document-text-outline"
                size={64}
                color={theme.textTertiary}
              />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No quizzes assigned yet
              </Text>
              <Text
                style={[styles.emptySubtext, { color: theme.textTertiary }]}
              >
                Your lecturer will assign quizzes to your class
              </Text>
            </View>
          ) : (
            availableQuizzes.map((q) => (
              <TouchableOpacity
                key={q.id}
                style={[styles.quizCard, { backgroundColor: theme.card }]}
                onPress={() => navigation.navigate("Quiz", { quizId: q.id })}
              >
                <View style={styles.quizIcon}>
                  <Ionicons name="document-text" size={32} color="#10B981" />
                </View>
                <View style={styles.quizInfo}>
                  <Text style={[styles.quizTitle, { color: theme.text }]}>
                    {q.title}
                  </Text>
                  {q.description && (
                    <Text
                      style={[
                        styles.quizDescription,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {q.description}
                    </Text>
                  )}
                  <Text
                    style={[styles.passingScore, { color: theme.textTertiary }]}
                  >
                    Passing Score: {q.passing_score}%
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={24}
                  color={theme.textTertiary}
                />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>
    );
  }

  if (quizCompleted) {
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: theme.surface }]}
      >
        <LinearGradient
          colors={[getScoreColor(), "#1F2937"]}
          style={styles.resultContainer}
        >
          <Ionicons name="trophy" size={64} color="#fff" />
          <Text style={styles.resultTitle}>Quiz Completed!</Text>
          <Text style={styles.quizTitle}>{quiz.title}</Text>
          <Text style={styles.scoreText}>
            Your Score: {score}/{questions.length}
          </Text>
          <Text style={styles.percentageText}>
            {Math.round((score / questions.length) * 100)}%
          </Text>

          <TouchableOpacity style={styles.retryButton} onPress={resetQuiz}>
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.homeButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="home" size={20} color="#fff" />
            <Text style={styles.retryButtonText}>Back to Dashboard</Text>
          </TouchableOpacity>
        </LinearGradient>

        <View
          style={[styles.reviewContainer, { backgroundColor: theme.surface }]}
        >
          <Text style={[styles.reviewTitle, { color: theme.text }]}>
            Review Your Answers
          </Text>
          {questions.map((question, index) => {
            const options =
              typeof question.options === "string"
                ? JSON.parse(question.options)
                : question.options;
            return (
              <View
                key={question.id}
                style={[styles.reviewItem, { backgroundColor: theme.card }]}
              >
                <Text style={[styles.reviewQuestion, { color: theme.text }]}>
                  {index + 1}. {question.question}
                </Text>
                <Text
                  style={[
                    styles.reviewAnswer,
                    {
                      color: answers[index]?.isCorrect ? "#10B981" : "#EF4444",
                    },
                  ]}
                >
                  Your answer: {answers[index]?.selected}
                  {answers[index]?.isCorrect ? " ✓" : " ✗"}
                </Text>
                {!answers[index]?.isCorrect && (
                  <Text style={styles.correctAnswer}>
                    Correct: {question.correct_answer}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  }

  const currentQ = questions[currentQuestion];
  if (!currentQ) return null;
  const options =
    typeof currentQ.options === "string"
      ? JSON.parse(currentQ.options)
      : currentQ.options;

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <View style={[styles.header, { backgroundColor: theme.card }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={theme.primary} />
        </TouchableOpacity>
        <Text style={[styles.questionCounter, { color: theme.text }]}>
          Question {currentQuestion + 1} of {questions.length}
        </Text>
        <Text style={[styles.scoreCounter, { color: theme.primary }]}>
          Score: {score}
        </Text>
      </View>

      <View
        style={[styles.progressBar, { backgroundColor: theme.borderLight }]}
      >
        <View
          style={[
            styles.progressFill,
            { width: `${((currentQuestion + 1) / questions.length) * 100}%` },
          ]}
        />
      </View>

      <ScrollView style={styles.questionContainer}>
        <Text style={[styles.questionText, { color: theme.text }]}>
          {currentQ.question}
        </Text>

        <View style={styles.optionsContainer}>
          {Array.isArray(options) &&
            options.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.optionButton,
                  { backgroundColor: theme.card, borderColor: theme.border },
                  selectedAnswer === option && {
                    borderColor: "#3B82F6",
                    backgroundColor: "#3B82F6" + "20",
                  },
                ]}
                onPress={() => handleAnswerSelect(option)}
              >
                <Text
                  style={[
                    styles.optionText,
                    { color: theme.text },
                    selectedAnswer === option && styles.selectedOptionText,
                  ]}
                >
                  {String.fromCharCode(65 + index)}. {option}
                </Text>
              </TouchableOpacity>
            ))}
        </View>
      </ScrollView>

      <TouchableOpacity
        style={[
          styles.nextButton,
          selectedAnswer === null && styles.disabledButton,
        ]}
        onPress={handleNextQuestion}
        disabled={selectedAnswer === null}
      >
        <Text style={styles.nextButtonText}>
          {currentQuestion + 1 === questions.length
            ? "Finish Quiz"
            : "Next Question"}
        </Text>
        <Ionicons name="arrow-forward" size={20} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    flex: 1,
  },
  quizListContainer: {
    flex: 1,
    padding: 20,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  quizCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quizIcon: {
    marginRight: 16,
  },
  quizInfo: {
    flex: 1,
  },
  quizTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  quizDescription: {
    fontSize: 14,
    marginBottom: 4,
  },
  passingScore: {
    fontSize: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  backButton: {
    marginRight: 12,
  },
  questionCounter: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  scoreCounter: {
    fontSize: 16,
    fontWeight: "600",
  },
  progressBar: {
    height: 4,
    marginHorizontal: 20,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#10B981",
  },
  questionContainer: {
    flex: 1,
    padding: 20,
  },
  questionText: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 30,
    lineHeight: 28,
  },
  optionsContainer: {
    marginBottom: 20,
  },
  optionButton: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
  },
  optionText: {
    fontSize: 16,
  },
  selectedOptionText: {
    color: "#3B82F6",
    fontWeight: "600",
  },
  nextButton: {
    backgroundColor: "#10B981",
    margin: 20,
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  disabledButton: {
    backgroundColor: "#9CA3AF",
  },
  nextButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginRight: 8,
  },
  resultContainer: {
    alignItems: "center",
    padding: 40,
    margin: 20,
    borderRadius: 16,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 16,
  },
  quizTitle: {
    fontSize: 16,
    color: "#fff",
    marginBottom: 16,
    opacity: 0.9,
  },
  scoreText: {
    fontSize: 20,
    color: "#fff",
    marginBottom: 8,
  },
  percentageText: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 24,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  homeButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  reviewContainer: {
    margin: 20,
  },
  reviewTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
  },
  reviewItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  reviewQuestion: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  reviewAnswer: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  correctAnswer: {
    fontSize: 14,
    color: "#10B981",
    marginBottom: 8,
  },
});

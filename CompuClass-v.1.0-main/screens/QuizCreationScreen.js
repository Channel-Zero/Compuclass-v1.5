import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '../context/ThemeContext';
import { lecturerService } from '../services/lecturerService';
import { getErrorMessage } from '../utils/errorMessages';
import { formatShortDate, passingMark, plural, prepareQuestionsForSave, questionCount as storedQuestionCount } from '../utils/quizFlow';
import { formatFileSize } from '../utils/fileSize';
import { Page, Body, Glass, Button, IconTile, font } from '../components/ui/kit';
import { LECTURER_COLUMN, ScreenHeading } from '../components/lecturerChrome';

export default function QuizCreationScreen({ navigation, route }) {
  const { theme } = useTheme();
  const { folderId: routeFolderId } = route.params || {};
  const [folderId, setFolderId] = useState(routeFolderId || null);
  const [quizzes, setQuizzes] = useState([]);
  const [listStatus, setListStatus] = useState('loading');
  const [showCreateQuiz, setShowCreateQuiz] = useState(false);
  const [showAIGenerate, setShowAIGenerate] = useState(false);
  const [quizTitle, setQuizTitle] = useState('');
  const [questions, setQuestions] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [questionCount, setQuestionCount] = useState(5);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [classes, setClasses] = useState([]);
  const [selectedClasses, setSelectedClasses] = useState([]);
  const loadQuizzesRef = useRef(() => {});
  const loadClassesRef = useRef(() => {});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (routeFolderId) {
        setFolderId(routeFolderId);
        return;
      }
      try {
        const folders = await lecturerService.getFolders();
        let id = folders?.[0]?.id;
        if (!id) {
          const created = await lecturerService.createFolder('General', 'General quizzes');
          id = created?.id;
        }
        if (!cancelled) setFolderId(id || null);
        if (!id && !cancelled) setListStatus('error');
      } catch (error) {
        console.error('Quiz folder error:', error);
        if (!cancelled) setListStatus('error');
      }
    })();
    loadClassesRef.current();
    return () => { cancelled = true; };
  }, [routeFolderId]);

  useEffect(() => {
    if (folderId) loadQuizzesRef.current();
  }, [folderId]);

  const loadQuizzes = async () => {
    if (!folderId) return;
    setListStatus('loading');
    try {
      const data = await lecturerService.getQuizzes(folderId);
      setQuizzes(data);
      setListStatus('ready');
    } catch (error) {
      console.error('Quizzes error:', error);
      setListStatus('error');
    }
  };

  const loadClasses = async () => {
    try {
      const data = await lecturerService.getClasses();
      setClasses(data);
    } catch (error) {
      console.error('Classes error:', error);
    }
  };
  loadQuizzesRef.current = loadQuizzes;
  loadClassesRef.current = loadClasses;

  const handleShareQuiz = (quiz) => {
    setSelectedQuiz(quiz);
    setSelectedClasses([]);
    setShowShareModal(true);
  };

  const toggleClassSelection = (classId) => {
    setSelectedClasses(prev => 
      prev.includes(classId) 
        ? prev.filter(id => id !== classId)
        : [...prev, classId]
    );
  };

  const handleShareToClasses = async () => {
    if (selectedClasses.length === 0) {
      Alert.alert('Error', 'Please select at least one class');
      return;
    }

    setLoading(true);
    try {
      await lecturerService.shareQuizToClasses(selectedQuiz.id, selectedClasses);
      setShowShareModal(false);
      Alert.alert('Shared', `Quiz shared with ${plural(selectedClasses.length, 'class')}.`);
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error, { context: 'QuizCreation' }));
    } finally {
      setLoading(false);
    }
  };

  const pickDocumentForAI = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'text/plain'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedFile(result.assets[0]);
        setAiError(null);
        setShowAIGenerate(true);
      }
    } catch (_error) {
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const generateQuizWithAI = async () => {
    if (!selectedFile || !quizTitle.trim()) {
      setAiError('Please select a file and enter a quiz title');
      return;
    }

    setAiError(null);
    setAiGenerating(true);
    setGenerationProgress(15);

    try {
      const progressTimer = setInterval(() => {
        setGenerationProgress((current) => (current >= 90 ? current : current + 8));
      }, 400);
      let aiQuiz;
      try {
        aiQuiz = await lecturerService.generateAIQuiz(selectedFile, quizTitle, questionCount);
      } finally {
        clearInterval(progressTimer);
      }
      setGenerationProgress(100);
      const questionsWithDefaults = aiQuiz.questions.map((q) => ({
        ...q,
        difficulty: q.difficulty || 'medium',
        timeLimitSeconds: q.timeLimitSeconds || null,
      }));
      setQuestions(questionsWithDefaults);
      
      Alert.alert('Success', `Generated ${aiQuiz.questions.length} questions from your document!`);
      setShowAIGenerate(false);
      setShowCreateQuiz(true);
    } catch (error) {
      setAiError(getErrorMessage(error, { context: 'QuizCreation' }));
    } finally {
      setAiGenerating(false);
      setGenerationProgress(0);
    }
  };

  const addManualQuestion = () => {
    const newQuestion = {
      id: Date.now(),
      question: '',
      options: ['', '', '', ''],
      correctAnswer: 0,
      type: 'multiple-choice',
      difficulty: 'medium',
      timeLimitSeconds: null,
      topic: '',
    };
    setQuestions([...questions, newQuestion]);
  };

  const updateQuestion = (index, field, value) => {
    const updated = [...questions];
    updated[index][field] = value;
    setQuestions(updated);
  };

  const updateOption = (questionIndex, optionIndex, value) => {
    const updated = [...questions];
    updated[questionIndex].options[optionIndex] = value;
    setQuestions(updated);
  };

  const removeQuestion = (index) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const saveQuiz = async () => {
    if (!quizTitle.trim() || questions.length === 0) {
      Alert.alert('Error', 'Please add a title and at least one question');
      return;
    }

    if (!folderId) {
      Alert.alert('Error', 'Open a folder before saving a quiz.');
      return;
    }

    const prepared = prepareQuestionsForSave(questions);
    if (!prepared.ok) {
      Alert.alert('Error', prepared.message);
      return;
    }

    setLoading(true);
    try {
      await lecturerService.createQuiz(folderId, quizTitle, prepared.questions);
      setShowCreateQuiz(false);
      setQuizTitle('');
      setQuestions([]);
      loadQuizzes();
      Alert.alert('Success', 'Quiz created successfully');
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error, { context: 'QuizCreation' }));
    } finally {
      setLoading(false);
    }
  };

  const renderQuizCard = (quiz) => (
    <Glass key={quiz.id} strong style={{ padding: 16, marginBottom: 12 }}>
      <View style={styles.quizHeader}>
        <IconTile name="quiz" tone="blue" />
        <View style={styles.quizInfo}>
          <Text style={[{ color: theme.text }, font(theme, 'h3')]}>{quiz.title}</Text>
          <Body variant="caption">
            {plural(storedQuestionCount(quiz), 'question')} · {passingMark(quiz)}% to pass
          </Body>
          {formatShortDate(quiz.created_at) ? (
            <Body variant="caption">Created {formatShortDate(quiz.created_at)}</Body>
          ) : null}
        </View>
      </View>
      <View style={styles.quizActions}>
        <Button label="View" variant="secondary" fit onPress={() => navigation.navigate('QuizDetail', { quizId: quiz.id })} accessibilityLabel={`View ${quiz.title}`} />
        <Button label="Share" variant="secondary" fit onPress={() => handleShareQuiz(quiz)} accessibilityLabel={`Share ${quiz.title}`} />
      </View>
    </Glass>
  );

  const renderQuestionEditor = (question, index) => (
    <View key={question.id} style={[styles.questionCard, { backgroundColor: theme.borderLight }]}>
      <View style={styles.questionHeader}>
        <Text style={[styles.questionNumber, { color: theme.text }]}>Question {index + 1}</Text>
        <TouchableOpacity onPress={() => removeQuestion(index)} accessibilityRole="button" accessibilityLabel={`Remove question ${index + 1}`} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="trash" size={20} color={theme.error} />
        </TouchableOpacity>
      </View>
      
      <TextInput
        style={[styles.questionInput, { backgroundColor: theme.card, color: theme.text }]}
        placeholder="Enter your question..."
        placeholderTextColor={theme.textTertiary}
        value={question.question}
        onChangeText={(text) => updateQuestion(index, 'question', text)}
        multiline
      />
      <TextInput
        style={[styles.questionInput, { backgroundColor: theme.card, color: theme.text, marginTop: 8 }]}
        placeholder="Topic, for example Memory or Networking"
        placeholderTextColor={theme.textTertiary}
        value={question.topic || ''}
        onChangeText={(text) => updateQuestion(index, 'topic', text)}
        accessibilityLabel={`Topic for question ${index + 1}`}
        maxLength={80}
      />
      
      {question.options.map((option, optIndex) => (
        <View key={optIndex} style={styles.optionRow}>
          <TouchableOpacity
            style={[
              styles.correctIndicator,
              { 
                backgroundColor: question.correctAnswer === optIndex ? theme.success : theme.borderLight,
                borderColor: theme.border
              }
            ]}
            onPress={() => updateQuestion(index, 'correctAnswer', optIndex)}
          >
            {question.correctAnswer === optIndex && (
              <Ionicons name="checkmark" size={16} color="#fff" />
            )}
          </TouchableOpacity>
          
          <TextInput
            style={[styles.optionInput, { backgroundColor: theme.card, color: theme.text }]}
            placeholder={`Option ${optIndex + 1}`}
            placeholderTextColor={theme.textTertiary}
            value={option}
            onChangeText={(text) => updateOption(index, optIndex, text)}
          />
        </View>
      ))}

      <View style={styles.gamificationRow}>
        <Text style={[styles.gamificationLabel, { color: theme.textSecondary }]}>Difficulty</Text>
        <View style={styles.chipRow}>
          {['easy', 'medium', 'hard'].map((level) => (
            <TouchableOpacity
              key={level}
              style={[
                styles.chip,
                {
                  backgroundColor: question.difficulty === level ? theme.primary : theme.borderLight,
                  borderColor: theme.border,
                },
              ]}
              onPress={() => updateQuestion(index, 'difficulty', level)}
            >
              <Text style={[styles.chipText, { color: question.difficulty === level ? '#fff' : theme.text }]}>
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.gamificationRow}>
        <Text style={[styles.gamificationLabel, { color: theme.textSecondary }]}>Time limit</Text>
        <View style={styles.chipRow}>
          {[
            { label: 'None', value: null },
            { label: '15s', value: 15 },
            { label: '30s', value: 30 },
            { label: '60s', value: 60 },
          ].map((opt) => (
            <TouchableOpacity
              key={opt.label}
              style={[
                styles.chip,
                {
                  backgroundColor: question.timeLimitSeconds === opt.value ? theme.primary : theme.borderLight,
                  borderColor: theme.border,
                },
              ]}
              onPress={() => updateQuestion(index, 'timeLimitSeconds', opt.value)}
            >
              <Text style={[styles.chipText, { color: question.timeLimitSeconds === opt.value ? '#fff' : theme.text }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Page maxWidth={LECTURER_COLUMN} scroll={false} fill>
      <ScreenHeading navigation={navigation} title="Quizzes" subtitle="Write a quiz or generate one from a document" />

      <View style={styles.createSection}>
        <TouchableOpacity style={styles.aiCreateButton} onPress={pickDocumentForAI}>
                <LinearGradient colors={theme.primaryGradient} style={styles.aiCreateGradient}>
            <Ionicons name="sparkles" size={24} color="#fff" />
            <Text style={styles.aiCreateText}>AI Generate Quiz</Text>
            <Text style={styles.aiCreateSubtext}>Upload document to auto-generate</Text>
          </LinearGradient>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.manualButton, { backgroundColor: theme.card }]} 
          onPress={() => setShowCreateQuiz(true)}
        >
          <Ionicons name="create" size={24} color={theme.primary} />
          <Text style={[styles.manualText, { color: theme.text }]}>Create Manually</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.quizzesContainer}>
        {listStatus === 'loading' ? (
          <View style={styles.emptyState} accessibilityRole="progressbar">
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Loading quizzes</Text>
          </View>
        ) : listStatus === 'error' ? (
          <View style={styles.emptyState} accessibilityRole="alert">
            <Ionicons name="cloud-offline-outline" size={64} color={theme.textTertiary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Could not load quizzes</Text>
            <Text style={[styles.emptySubtext, { color: theme.textTertiary }]}>Check your connection and try again.</Text>
            <TouchableOpacity onPress={loadQuizzes} style={[styles.manualButton, { backgroundColor: theme.primary, marginTop: 16, padding: 12 }]} accessibilityRole="button" accessibilityLabel="Try again">
              <Text style={[styles.manualText, { color: '#fff' }]}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : quizzes.length > 0 ? (
          quizzes.map(renderQuizCard)
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="help-circle-outline" size={64} color={theme.textTertiary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              No quizzes created yet
            </Text>
            <Text style={[styles.emptySubtext, { color: theme.textTertiary }]}>
              Use AI to generate from documents or create manually
            </Text>
          </View>
        )}
      </ScrollView>
      </Page>

      {/* AI Generation Modal */}
      <Modal visible={showAIGenerate} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>AI Quiz Generation</Text>
            
            {selectedFile && (
              <View style={[styles.filePreview, { backgroundColor: theme.borderLight }]}>
                <Ionicons name="document-text" size={32} color={theme.primary} />
                <View style={styles.fileDetails}>
                  <Text style={[styles.fileName, { color: theme.text }]}>{selectedFile.name}</Text>
                  <Text style={[styles.fileSize, { color: theme.textSecondary }]}>
                    {formatFileSize(selectedFile.size)}
                  </Text>
                </View>
              </View>
            )}

            <TextInput
              style={[styles.input, { backgroundColor: theme.borderLight, color: theme.text }]}
              placeholder="Quiz Title"
              placeholderTextColor={theme.textTertiary}
              value={quizTitle}
              onChangeText={setQuizTitle}
            />
            
            <View style={styles.questionCountContainer}>
              <Text style={[styles.questionCountLabel, { color: theme.text }]}>Number of Questions:</Text>
              <View style={styles.questionCountButtons}>
                {[3, 5, 10, 15].map(count => (
                  <TouchableOpacity
                    key={count}
                    style={[
                      styles.countButton,
                      {
                        backgroundColor: questionCount === count ? theme.primary : theme.borderLight,
                        borderColor: theme.border
                      }
                    ]}
                    onPress={() => setQuestionCount(count)}
                  >
                    <Text style={[
                      styles.countButtonText,
                      { color: questionCount === count ? '#fff' : theme.text }
                    ]}>
                      {count}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {aiGenerating && (
              <View style={styles.progressContainer} accessibilityRole="progressbar" accessibilityLabel="Generating quiz">
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={[styles.progressText, { color: theme.textSecondary }]}>
                  Generating quiz... {generationProgress}%
                </Text>
                <View style={[styles.progressBar, { backgroundColor: theme.borderLight }]}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { backgroundColor: theme.primary, width: `${generationProgress}%` }
                    ]} 
                  />
                </View>
              </View>
            )}

            {aiError ? (
              <Text accessibilityRole="alert" style={[styles.aiError, { color: theme.error }]}>{aiError}</Text>
            ) : null}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.cancelButton, { backgroundColor: theme.borderLight }]}
                onPress={() => setShowAIGenerate(false)}
                disabled={aiGenerating}
              >
                <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.generateButton}
                onPress={generateQuizWithAI}
                disabled={aiGenerating}
                accessibilityRole="button"
                accessibilityLabel="Generate quiz"
                accessibilityState={{ disabled: aiGenerating, busy: aiGenerating }}
              >
                <LinearGradient colors={theme.primaryGradient} style={styles.generateGradient}>
                  {aiGenerating ? <ActivityIndicator color="#fff" /> : null}
                  <Text style={styles.generateText}>
                    {aiGenerating ? 'Generating...' : 'Generate Quiz'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Manual Quiz Creation Modal */}
      <Modal visible={showCreateQuiz} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.createModal, { backgroundColor: theme.card }]}>
            <View style={styles.createHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Create Quiz</Text>
              <TouchableOpacity onPress={() => setShowCreateQuiz(false)}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.createContent}>
              <TextInput
                style={[styles.input, { backgroundColor: theme.borderLight, color: theme.text }]}
                placeholder="Quiz Title"
                placeholderTextColor={theme.textTertiary}
                value={quizTitle}
                onChangeText={setQuizTitle}
              />
              
              {questions.map((question, index) => renderQuestionEditor(question, index))}
              
              <TouchableOpacity style={styles.addQuestionButton} onPress={addManualQuestion}>
                <Ionicons name="add-circle" size={24} color={theme.primary} />
                <Text style={[styles.addQuestionText, { color: theme.primary }]}>Add Question</Text>
              </TouchableOpacity>
            </ScrollView>
            
            <View style={styles.createFooter}>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={saveQuiz}
                disabled={loading}
              >
                <LinearGradient colors={theme.primaryGradient} style={styles.saveGradient}>
                  <Text style={styles.saveText}>
                    {loading ? 'Saving...' : 'Save Quiz'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Share Quiz Modal */}
      <Modal visible={showShareModal} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.shareModal, { backgroundColor: theme.card }]}>
            <View style={styles.shareHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Share Quiz: {selectedQuiz?.title}
              </Text>
              <TouchableOpacity onPress={() => setShowShareModal(false)} accessibilityRole="button" accessibilityLabel="Close share quiz" style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.shareSubtitle, { color: theme.textSecondary }]}>
              Select classes to share this quiz with:
            </Text>
            
            <ScrollView style={styles.classesList}>
              {classes.length === 0 ? (
                <Text style={[styles.shareSubtitle, { color: theme.textSecondary }]}>
                  No classes yet. Create one in Class Management, then share this quiz.
                </Text>
              ) : null}
              {classes.map((classItem) => (
                <TouchableOpacity
                  key={classItem.id}
                  style={[
                    styles.classItem,
                    {
                      backgroundColor: selectedClasses.includes(classItem.id) 
                        ? theme.primary + '20' 
                        : theme.borderLight,
                      borderColor: selectedClasses.includes(classItem.id) 
                        ? theme.primary 
                        : 'transparent'
                    }
                  ]}
                  onPress={() => toggleClassSelection(classItem.id)}
                >
                  <View style={[styles.classIcon, { backgroundColor: theme.primary }]}>
                    <Ionicons name="school" size={20} color="#fff" />
                  </View>
                  <View style={styles.classDetails}>
                    <Text style={[styles.className, { color: theme.text }]}>
                      {classItem.name}
                    </Text>
                    <Text style={[styles.classStudents, { color: 'rgba(11,27,58,0.65)', fontSize: 13 }]}>
                      {plural(classItem.student_count || 0, 'student')}
                    </Text>
                  </View>
                  {selectedClasses.includes(classItem.id) && (
                    <Ionicons name="checkmark-circle" size={24} color={theme.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <View style={styles.shareFooter}>
              <Text style={[styles.selectedCount, { color: 'rgba(11,27,58,0.65)', fontSize: 13 }]}>
                {plural(selectedClasses.length, 'class')} selected
              </Text>
              <TouchableOpacity
                style={styles.shareButton}
                onPress={handleShareToClasses}
                disabled={loading || selectedClasses.length === 0}
              >
                <LinearGradient colors={theme.primaryGradient} style={styles.shareButtonGradient}>
                  <Text style={styles.shareButtonText}>
                    {loading ? 'Sharing...' : 'Share Quiz'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 50, paddingBottom: 20 },
  iconHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  headerActions: { flexDirection: 'row', gap: 12 },
  aiButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  createSection: { gap: 12, marginBottom: 16 },
  aiCreateButton: {},
  aiCreateGradient: {
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
  },
  aiCreateText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 8,
  },
  aiCreateSubtext: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 4,
  },
  manualButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  manualText: { fontSize: 16, fontWeight: '600' },
  quizzesContainer: { flex: 1 },
  quizCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  quizHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  quizIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  quizInfo: { flex: 1 },
  quizTitle: { fontSize: 16, fontWeight: '600' },
  quizDetails: { fontSize: 14, marginTop: 2 },
  quizDate: { fontSize: 12, marginTop: 4 },
  quizActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  actionText: { fontSize: 12, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtext: { fontSize: 14, marginTop: 8, textAlign: 'center' },
  modalOverlay: { flex: 1, justifyContent: 'center', padding: 20 },
  modalContent: { borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  filePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  fileDetails: { marginLeft: 12, flex: 1 },
  fileName: { fontSize: 14, fontWeight: '600' },
  fileSize: { fontSize: 12, marginTop: 2 },
  input: { borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 16 },
  progressContainer: { alignItems: 'center', marginBottom: 16 },
  progressText: { fontSize: 14, marginVertical: 8 },
  progressBar: { height: 4, borderRadius: 2, width: '100%', overflow: 'hidden' },
  progressFill: { height: '100%' },
  aiError: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  modalButtons: { flexDirection: 'row', gap: 12 },
  cancelButton: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  cancelButtonText: { fontWeight: '600' },
  generateButton: { flex: 1 },
  generateGradient: { padding: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  generateText: { color: '#fff', fontWeight: '600' },
  createModal: { borderRadius: 16, maxHeight: '90%' },
  createHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  createContent: { maxHeight: 400, padding: 20 },
  questionCard: { padding: 16, borderRadius: 12, marginBottom: 16 },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  questionNumber: { fontSize: 16, fontWeight: '600' },
  questionInput: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  correctIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  optionInput: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
  },
  addQuestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  addQuestionText: { fontSize: 16, fontWeight: '600' },
  createFooter: { padding: 20, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.1)' },
  saveButton: {},
  saveGradient: { padding: 12, borderRadius: 8, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '600' },
  shareModal: { borderRadius: 16, maxHeight: '80%' },
  shareHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  shareSubtitle: { fontSize: 14, paddingHorizontal: 20, marginTop: 12 },
  classesList: { maxHeight: 300, padding: 20 },
  classItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  classIcon: {
    width: 44,
    height: 44,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  classDetails: { flex: 1 },
  className: { fontSize: 14, fontWeight: '600' },
  classStudents: { fontSize: 12, marginTop: 2 },
  shareFooter: { padding: 20, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.1)' },
  selectedCount: { fontSize: 14, marginBottom: 12 },
  shareButton: {},
  shareButtonGradient: { padding: 12, borderRadius: 8, alignItems: 'center' },
  shareButtonText: { color: '#fff', fontWeight: '600' },
  questionCountContainer: { marginBottom: 16 },
  questionCountLabel: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  questionCountButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  countButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  countButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  gamificationRow: { marginTop: 12 },
  gamificationLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
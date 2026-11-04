import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, TextInput, Modal, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { lecturerService } from '../services/lecturerService';
import { useTheme } from '../context/ThemeContext';
import { getErrorMessage } from '../utils/errorMessages';
import { openStoredDocument } from '../utils/fileDownload';
import ClassScopePicker from '../components/ClassScopePicker';
import { prepareQuestionsForSave, plural, withQuestionType } from '../utils/quizFlow';
import { Page, Heading, Body, Glass, Button, IconButton } from '../components/ui/kit';
import { LECTURER_COLUMN, ScreenHeading } from '../components/lecturerChrome';

export default function FolderContentScreen({ route, navigation }) {
  const { theme } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const { folder } = route.params;
  const [documents, setDocuments] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [showUploadDoc, setShowUploadDoc] = useState(false);
  const [showCreateQuiz, setShowCreateQuiz] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState(null);
  const [quizTitle, setQuizTitle] = useState('');
  const [questions, setQuestions] = useState([{ question: '', options: ['', '', '', ''], correctAnswer: 0, type: 'multiple-choice' }]);
  const [status, setStatus] = useState('loading');
  const loadContentRef = useRef(() => {});

  useEffect(() => {
    loadContentRef.current();
    lecturerService.getClasses().then((data) => setClasses(Array.isArray(data) ? data : [])).catch(() => setClasses([]));
  }, []);

  const loadContent = async () => {
    setStatus('loading');
    try {
      const [docs, quizData] = await Promise.all([
        lecturerService.getDocuments(folder.id),
        lecturerService.getQuizzes(folder.id)
      ]);
      setDocuments(docs);
      setQuizzes(quizData);
      setStatus('ready');
    } catch (error) {
      setStatus('error');
      Alert.alert('Error', getErrorMessage(error, { context: 'FolderContent' }));
    }
  };
  loadContentRef.current = loadContent;

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets[0]) {
        const file = result.assets[0];
        try {
          await lecturerService.uploadDocument(folder.id, file, docTitle || file.name, classId);
          Alert.alert('Success', 'Document uploaded!');
          setShowUploadDoc(false);
          setDocTitle('');
          setClassId(null);
          await loadContent();
        } catch (error) {
          Alert.alert('Error', getErrorMessage(error, { context: 'FolderContent' }));
        }
      }
    } catch (_error) {
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const handleCreateQuiz = async () => {
    if (!quizTitle.trim()) {
      Alert.alert('Error', 'Please enter quiz title');
      return;
    }
    const prepared = prepareQuestionsForSave(questions);
    if (!prepared.ok) {
      Alert.alert('Error', prepared.message);
      return;
    }
    try {
      await lecturerService.createQuiz(folder.id, quizTitle, prepared.questions);
      setShowCreateQuiz(false);
      setQuizTitle('');
      setQuestions([{ question: '', options: ['', '', '', ''], correctAnswer: 0 }]);
      loadContent();
      Alert.alert('Success', 'Quiz created successfully');
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error, { context: 'FolderContent' }));
    }
  };

  const deleteDocument = (doc) => {
    Alert.alert(`Delete ${doc.title}?`, 'This removes the file from the folder.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await lecturerService.deleteDocument(doc.id);
            await loadContent();
          } catch (error) {
            Alert.alert('Error', getErrorMessage(error, { context: 'FolderContent' }));
          }
        },
      },
    ]);
  };

  const openDocument = async (doc) => {
    try {
      if (!doc.file_url) {
        Alert.alert('Error', 'This file could not be opened. Please try again.');
        return;
      }
      const outcome = await openStoredDocument(doc.file_url, doc.file_name || `${doc.title}.pdf`);
      if (outcome === 'downloaded') Alert.alert('Success', 'File downloaded');
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error, { context: 'FolderContent', fallback: 'This file could not be opened. Please try again.' }));
    }
  };

  const addQuestion = () => {
    setQuestions([...questions, { question: '', options: ['', '', '', ''], correctAnswer: 0, type: 'multiple-choice' }]);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Page maxWidth={LECTURER_COLUMN}>
        <ScreenHeading
          navigation={navigation}
          title={folder.name}
          subtitle={folder.description || 'Documents and quizzes'}
        />
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Heading level={2}>Documents</Heading>
            <IconButton name="plus" label="Upload document" onPress={() => setShowUploadDoc(true)} />
          </View>
          {status === 'loading' ? <Body variant="caption">Loading folder</Body> : null}
          {status === 'error' ? (
            <Button label="Try again" fit onPress={loadContent} />
          ) : null}
          {status === 'ready' && documents.length === 0 ? <Body variant="caption">No documents in this folder yet.</Body> : null}
          {documents.map((doc) => (
            <Glass key={doc.id} strong style={styles.itemCard}>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => openDocument(doc)} accessibilityRole="button" accessibilityLabel={`Open ${doc.title}`}>
                <Text style={[styles.itemTitle, { color: theme.text }]}>{doc.title}</Text>
                <Body variant="caption">Open</Body>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteDocument(doc)} accessibilityRole="button" accessibilityLabel={`Delete ${doc.title}`} style={styles.removeQuestion}>
                <Text style={{ color: theme.error, fontWeight: '600' }}>Delete</Text>
              </TouchableOpacity>
            </Glass>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Heading level={2}>Quizzes</Heading>
            <IconButton name="plus" label="Create quiz" onPress={() => setShowCreateQuiz(true)} />
          </View>
          {status === 'ready' && quizzes.length === 0 ? <Body variant="caption">No quizzes in this folder yet.</Body> : null}
          {quizzes.map((quiz) => (
            <TouchableOpacity key={quiz.id} onPress={() => navigation.navigate('QuizDetail', { quizId: quiz.id })} accessibilityRole="button" accessibilityLabel={`Open quiz ${quiz.title}`}>
              <Glass strong style={styles.itemCard}>
                <Text style={[styles.itemTitle, { color: theme.text }]}>{quiz.title}</Text>
                <Body variant="caption">{plural(quiz.question_count ?? quiz.quiz_questions?.length ?? 0, 'question')}</Body>
              </Glass>
            </TouchableOpacity>
          ))}
        </View>
      </Page>

      <Modal visible={showUploadDoc} animationType="slide" transparent onRequestClose={() => setShowUploadDoc(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Upload Document</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.borderLight, color: theme.text }]}
              placeholder="Document Title (optional)"
              placeholderTextColor={theme.textTertiary}
              value={docTitle}
              onChangeText={setDocTitle}
            />
            <ClassScopePicker
              classes={classes}
              value={classId}
              onChange={setClassId}
              textColor={theme.text}
              mutedColor={theme.textSecondary}
              accent={theme.primary}
            />
            <TouchableOpacity style={[styles.pickButton, { backgroundColor: theme.primary }]} onPress={handlePickDocument}>
              <Text style={styles.pickButtonText}>Pick PDF or PowerPoint</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.cancelButton, { backgroundColor: theme.borderLight }]} onPress={() => setShowUploadDoc(false)}>
              <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showCreateQuiz} animationType="slide" transparent onRequestClose={() => setShowCreateQuiz(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modalContent, styles.quizModal, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Create Quiz</Text>
            <ScrollView style={[styles.quizScroll, { maxHeight: Math.round(windowHeight * 0.5) }]} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.quizScrollContent}>
            <TextInput
              style={[styles.input, { backgroundColor: theme.borderLight, color: theme.text }]}
              placeholder="Quiz Title"
              placeholderTextColor={theme.textTertiary}
              value={quizTitle}
              onChangeText={setQuizTitle}
            />
            {questions.map((q, idx) => (
              <View key={idx} style={[styles.questionBlock, { backgroundColor: theme.surface }]}>
                <View style={styles.questionLabelRow}>
                  <Text style={[styles.questionLabel, { color: theme.text }]}>Question {idx + 1}</Text>
                  <TouchableOpacity
                    onPress={() => setQuestions(questions.filter((_, questionIndex) => questionIndex !== idx))}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove question ${idx + 1}`}
                    style={styles.removeQuestion}
                  >
                    <Text style={{ color: theme.error, fontWeight: '600' }}>Remove</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.typeRow}>
                  {[
                    { id: 'multiple-choice', label: 'Multiple choice' },
                    { id: 'true_false', label: 'True / False' },
                  ].map((choice) => {
                    const selected = (q.type || 'multiple-choice') === choice.id;
                    return (
                      <TouchableOpacity
                        key={choice.id}
                        onPress={() => {
                          const next = [...questions];
                          next[idx] = withQuestionType(q, choice.id);
                          setQuestions(next);
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityLabel={`${choice.label} for question ${idx + 1}`}
                        style={[styles.typeChip, { borderColor: selected ? theme.primary : theme.border, backgroundColor: selected ? theme.tint || '#EDF4FF' : 'transparent' }]}
                      >
                        <Text style={{ color: selected ? theme.primary : theme.textSecondary, fontWeight: '600' }}>{choice.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.borderLight, color: theme.text }]}
                  placeholder="Question"
                  placeholderTextColor={theme.textTertiary}
                  value={q.question}
                  onChangeText={(text) => {
                    const newQ = [...questions];
                    newQ[idx].question = text;
                    setQuestions(newQ);
                  }}
                />
                <Text style={[styles.correctAnswerHint, { color: theme.textTertiary }]}>Tap circle to mark correct answer</Text>
                {q.options.map((opt, optIdx) => (
                  <View key={optIdx} style={styles.optionRow}>
                    <TouchableOpacity
                      onPress={() => {
                        const newQ = [...questions];
                        newQ[idx].correctAnswer = optIdx;
                        setQuestions(newQ);
                      }}
                      style={[
                        styles.radioButton,
                        { borderColor: q.correctAnswer === optIdx ? theme.primary : theme.textTertiary,
                          backgroundColor: q.correctAnswer === optIdx ? theme.primary : 'transparent' }
                      ]}
                    >
                      {q.correctAnswer === optIdx && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </TouchableOpacity>
                    <TextInput
                      style={[styles.input, styles.optionInput, { backgroundColor: theme.borderLight, color: theme.text }]}
                      placeholder={`Option ${optIdx + 1}`}
                      placeholderTextColor={theme.textTertiary}
                      value={opt}
                      onChangeText={(text) => {
                        const newQ = [...questions];
                        newQ[idx].options[optIdx] = text;
                        setQuestions(newQ);
                      }}
                    />
                  </View>
                ))}
              </View>
            ))}
            <TouchableOpacity style={styles.addQuestionButton} onPress={addQuestion}>
              <Text style={[styles.addQuestionText, { color: theme.primary }]}>+ Add Question</Text>
            </TouchableOpacity>
            </ScrollView>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.cancelButton, { backgroundColor: theme.borderLight }]} onPress={() => setShowCreateQuiz(false)} accessibilityRole="button" accessibilityLabel="Cancel">
                <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitButton, { backgroundColor: theme.primary }]} onPress={handleCreateQuiz} accessibilityRole="button" accessibilityLabel="Create">
                <Text style={styles.submitButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  backSlot: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', gap: 12 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1F2937' },
  content: { flex: 1, padding: 16 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#1F2937' },
  itemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 8, gap: 12 },
  itemTitle: { flex: 1, fontSize: 16, color: '#1F2937' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 20, maxHeight: '80%' },
  quizModal: { width: '100%', maxHeight: '90%' },
  quizScroll: { flexGrow: 0 },
  quizScrollContent: { paddingBottom: 8 },
  questionLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  removeQuestion: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  typeChip: { minHeight: 36, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16, color: '#1F2937' },
  input: { backgroundColor: '#F7FBFD', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16 },
  pickButton: { backgroundColor: '#10B981', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  pickButtonText: { color: '#fff', fontWeight: '600' },
  questionBlock: { marginBottom: 16, padding: 12, backgroundColor: '#F9FAFB', borderRadius: 8 },
  questionLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: '#1F2937' },
  correctAnswerHint: { fontSize: 11, marginBottom: 6 },
  optionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  radioButton: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, marginRight: 8, alignItems: 'center', justifyContent: 'center' },
  optionInput: { flex: 1, marginBottom: 0 },
  addQuestionButton: { padding: 12, alignItems: 'center', marginBottom: 16 },
  addQuestionText: { color: '#10B981', fontWeight: '600' },
  modalButtons: { flexDirection: 'row', gap: 12 },
  cancelButton: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#F7FBFD', alignItems: 'center' },
  cancelButtonText: { color: '#5E6B85', fontWeight: '600' },
  submitButton: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#10B981', alignItems: 'center' },
  submitButtonText: { color: '#fff', fontWeight: '600' }
});

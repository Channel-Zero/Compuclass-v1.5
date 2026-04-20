import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, TextInput, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { lecturerService } from '../services/lecturerService';
import { useTheme } from '../context/ThemeContext';

export default function FolderContentScreen({ route, navigation }) {
  const { theme } = useTheme();
  const { folder } = route.params;
  const [documents, setDocuments] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [showUploadDoc, setShowUploadDoc] = useState(false);
  const [showCreateQuiz, setShowCreateQuiz] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [quizTitle, setQuizTitle] = useState('');
  const [questions, setQuestions] = useState([{ question: '', options: ['', '', '', ''], correctAnswer: 0 }]);

  useEffect(() => {
    loadContent();
  }, []);

  const loadContent = async () => {
    try {
      const [docs, quizData] = await Promise.all([
        lecturerService.getDocuments(folder.id),
        lecturerService.getQuizzes(folder.id)
      ]);
      setDocuments(docs);
      setQuizzes(quizData);
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handlePickDocument = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.ppt,.pptx';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          await lecturerService.uploadDocument(folder.id, file, docTitle || file.name);
          Alert.alert('Success', 'Document uploaded!');
          setShowUploadDoc(false);
          setDocTitle('');
          await loadContent();
        } catch (error) {
          Alert.alert('Error', error.message);
          console.error('Upload error:', error);
        }
      }
    };
    input.click();
  };

  const handleCreateQuiz = async () => {
    if (!quizTitle.trim()) {
      Alert.alert('Error', 'Please enter quiz title');
      return;
    }
    try {
      await lecturerService.createQuiz(folder.id, quizTitle, questions);
      setShowCreateQuiz(false);
      setQuizTitle('');
      setQuestions([{ question: '', options: ['', '', '', ''], correctAnswer: 0 }]);
      loadContent();
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const addQuestion = () => {
    setQuestions([...questions, { question: '', options: ['', '', '', ''], correctAnswer: 0 }]);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <View style={[styles.header, { backgroundColor: theme.card }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>{folder.name}</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Documents</Text>
            <TouchableOpacity onPress={() => setShowUploadDoc(true)}>
              <Ionicons name="add-circle" size={28} color={theme.primary} />
            </TouchableOpacity>
          </View>
          {documents.map((doc) => (
            <View key={doc.id} style={[styles.itemCard, { backgroundColor: theme.card }]}>
              <Ionicons name="document" size={24} color="#3B82F6" />
              <Text style={[styles.itemTitle, { color: theme.text }]}>{doc.title}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Quizzes</Text>
            <TouchableOpacity onPress={() => setShowCreateQuiz(true)}>
              <Ionicons name="add-circle" size={28} color={theme.primary} />
            </TouchableOpacity>
          </View>
          {quizzes.map((quiz) => (
            <View key={quiz.id} style={[styles.itemCard, { backgroundColor: theme.card }]}>
              <Ionicons name="help-circle" size={24} color="#8B5CF6" />
              <Text style={[styles.itemTitle, { color: theme.text }]}>{quiz.title}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal visible={showUploadDoc} animationType="slide" transparent>
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
            <TouchableOpacity style={[styles.pickButton, { backgroundColor: theme.primary }]} onPress={handlePickDocument}>
              <Text style={styles.pickButtonText}>Pick PDF or PowerPoint</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.cancelButton, { backgroundColor: theme.borderLight }]} onPress={() => setShowUploadDoc(false)}>
              <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showCreateQuiz} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <ScrollView style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Create Quiz</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.borderLight, color: theme.text }]}
              placeholder="Quiz Title"
              placeholderTextColor={theme.textTertiary}
              value={quizTitle}
              onChangeText={setQuizTitle}
            />
            {questions.map((q, idx) => (
              <View key={idx} style={[styles.questionBlock, { backgroundColor: theme.surface }]}>
                <Text style={[styles.questionLabel, { color: theme.text }]}>Question {idx + 1}</Text>
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
                {q.options.map((opt, optIdx) => (
                  <TextInput
                    key={optIdx}
                    style={[styles.input, { backgroundColor: theme.borderLight, color: theme.text }]}
                    placeholder={`Option ${optIdx + 1}`}
                    placeholderTextColor={theme.textTertiary}
                    value={opt}
                    onChangeText={(text) => {
                      const newQ = [...questions];
                      newQ[idx].options[optIdx] = text;
                      setQuestions(newQ);
                    }}
                  />
                ))}
              </View>
            ))}
            <TouchableOpacity style={styles.addQuestionButton} onPress={addQuestion}>
              <Text style={[styles.addQuestionText, { color: theme.primary }]}>+ Add Question</Text>
            </TouchableOpacity>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.cancelButton, { backgroundColor: theme.borderLight }]} onPress={() => setShowCreateQuiz(false)}>
                <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitButton, { backgroundColor: theme.primary }]} onPress={handleCreateQuiz}>
                <Text style={styles.submitButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', gap: 12 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1F2937' },
  content: { flex: 1, padding: 16 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#1F2937' },
  itemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 8, gap: 12 },
  itemTitle: { fontSize: 16, color: '#1F2937' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 20, maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16, color: '#1F2937' },
  input: { backgroundColor: '#F3F4F6', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16 },
  pickButton: { backgroundColor: '#10B981', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  pickButtonText: { color: '#fff', fontWeight: '600' },
  questionBlock: { marginBottom: 16, padding: 12, backgroundColor: '#F9FAFB', borderRadius: 8 },
  questionLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: '#1F2937' },
  addQuestionButton: { padding: 12, alignItems: 'center', marginBottom: 16 },
  addQuestionText: { color: '#10B981', fontWeight: '600' },
  modalButtons: { flexDirection: 'row', gap: 12 },
  cancelButton: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center' },
  cancelButtonText: { color: '#6B7280', fontWeight: '600' },
  submitButton: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#10B981', alignItems: 'center' },
  submitButtonText: { color: '#fff', fontWeight: '600' }
});

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { downloadAsync, documentDirectory } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { supabase } from '../config/supabase';
import { useTheme } from '../context/ThemeContext';
// Student materials screen for students to browse folders containing documents and quizzes. Students can open quizzes in quiz screen and download/share documents. Folders are loaded from Supabase and content is displayed based on selected folder.
export default function StudentMaterialsScreen({ navigation }) {
  const { theme } = useTheme();
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [quizzes, setQuizzes] = useState([]);

  useEffect(() => {
    loadFolders();
  }, []);

  useEffect(() => {
    if (selectedFolder) {
      loadFolderContent(selectedFolder.id);
    }
  }, [selectedFolder]);
// Load folders from Supabase and handle errors
  const loadFolders = async () => {
    try {
      const { data, error } = await supabase.from('folders').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setFolders(data);
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };
// Load documents and quizzes for the selected folder from Supabase and handle errors
  const loadFolderContent = async (folderId) => {
    try {
      const [docsRes, quizzesRes] = await Promise.all([
        supabase.from('documents').select('*').eq('folder_id', folderId),
        supabase.from('quizzes').select('*, quiz_questions(*)').eq('folder_id', folderId)
      ]);
      if (docsRes.error) throw docsRes.error;
      if (quizzesRes.error) throw quizzesRes.error;
      setDocuments(docsRes.data);
      setQuizzes(quizzesRes.data);
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };
// Handle document opening by downloading the file and sharing it if supported. Show appropriate alerts for errors and success.
  const openDocument = async (doc) => {
    try {
      if (!doc.file_url) {
        Alert.alert('Error', 'No file URL available');
        return;
      }
// Generate a file name and URI for downloading the document
      const fileName = doc.file_name || `${doc.title}.pdf`;
      const fileUri = `${documentDirectory}${fileName}`;
      
      const downloadResult = await downloadAsync(doc.file_url, fileUri);
      
      if (downloadResult.status === 200) {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(downloadResult.uri);
        } else {
          Alert.alert('Success', 'File downloaded');
        }
      } else {
        Alert.alert('Error', 'Download failed');
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to download document');
      console.error('Download error:', error);
    }
  };
// Handle quiz opening by navigating to quiz screen with selected quiz data
  if (selectedFolder) {
    return (
      <View style={[styles.container, { backgroundColor: theme.surface }]}>
        <View style={[styles.header, { backgroundColor: theme.card }]}>
          <TouchableOpacity onPress={() => setSelectedFolder(null)}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>{selectedFolder.name}</Text>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Documents</Text>
            {documents.map((doc) => (
              <TouchableOpacity key={doc.id} style={[styles.itemCard, { backgroundColor: theme.card }]} onPress={() => openDocument(doc)}>
                <Ionicons name="document" size={24} color="#3B82F6" />
                <Text style={[styles.itemTitle, { color: theme.text }]}>{doc.title}</Text>
                <Ionicons name="open-outline" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Quizzes</Text>
            {quizzes.map((quiz) => (
              <TouchableOpacity key={quiz.id} style={[styles.itemCard, { backgroundColor: theme.card }]} onPress={() => navigation.navigate('Quiz', { quiz })}>
                <Ionicons name="help-circle" size={24} color="#8B5CF6" />
                <Text style={[styles.itemTitle, { color: theme.text }]}>{quiz.title}</Text>
                <Text style={[styles.questionCount, { color: theme.textSecondary }]}>{quiz.quiz_questions?.length || 0} questions</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <LinearGradient colors={theme.gradient} style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Learning Materials</Text>
        <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Browse folders and resources</Text>
      </LinearGradient>

      <ScrollView style={styles.content}>
        {folders.map((folder) => (
          <TouchableOpacity key={folder.id} style={[styles.folderCard, { backgroundColor: theme.card }]} onPress={() => setSelectedFolder(folder)}>
            <View style={styles.folderIcon}>
              <Ionicons name="folder" size={32} color={theme.primary} />
            </View>
            <View style={styles.folderInfo}>
              <Text style={[styles.folderName, { color: theme.text }]}>{folder.name}</Text>
              {folder.description && <Text style={[styles.folderDescription, { color: theme.textSecondary }]}>{folder.description}</Text>}
            </View>
            <Ionicons name="chevron-forward" size={24} color={theme.textTertiary} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { padding: 20, paddingTop: 40 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1F2937' },
  headerSubtitle: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  content: { flex: 1, padding: 16 },
  folderCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  folderIcon: { marginRight: 12 },
  folderInfo: { flex: 1 },
  folderName: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  folderDescription: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#1F2937', marginBottom: 12 },
  itemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 8, gap: 12 },
  itemTitle: { flex: 1, fontSize: 16, color: '#1F2937' },
  questionCount: { fontSize: 14, color: '#6B7280' }
});

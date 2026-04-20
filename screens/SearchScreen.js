import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../config/supabase';
import { downloadAsync, documentDirectory } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
//Search screen for students to search quizzes and documents. Quizzes can be opened in quiz screen, documents can be downloaded and shared.
export default function SearchScreen({ navigation }) {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [quizzes, setQuizzes] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchQuery.length > 0) {
      searchContent();
    } else {
      setQuizzes([]);
      setDocuments([]);
    }
  }, [searchQuery]);

  const searchContent = async () => {
    setLoading(true);
    try {
      const [quizzesRes, docsRes] = await Promise.all([
        supabase.from('quizzes').select('*, quiz_questions(*)').ilike('title', `%${searchQuery}%`),
        supabase.from('documents').select('*').ilike('title', `%${searchQuery}%`)
      ]);
      setQuizzes(quizzesRes.data || []);
      setDocuments(docsRes.data || []);
    } catch (error) {
      console.error('Search error:', error);
    }
    setLoading(false);
  };

  const openDocument = async (doc) => {
    try {
      const fileName = doc.file_name || `${doc.title}.pdf`;
      const fileUri = `${documentDirectory}${fileName}`;
      const downloadResult = await downloadAsync(doc.file_url, fileUri);
      if (downloadResult.status === 200 && await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(downloadResult.uri);
      }
    } catch (error) {
      console.error('Download error:', error);
    }
  };
// Render search input and results for quizzes and documents. Show loading indicator while searching and handle empty state when no results are found.
  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <View style={[styles.searchContainer, { backgroundColor: theme.card }]}>
        <Ionicons name="search" size={20} color={theme.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search lessons, topics..."
          placeholderTextColor={theme.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <ScrollView style={styles.content}>
        {loading && <ActivityIndicator size="large" color={theme.primary} style={styles.loader} />}
        
        {searchQuery.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="search" size={64} color={theme.textTertiary} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Search for Content</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>Find quizzes and documents</Text>
          </View>
        )}

        {searchQuery.length > 0 && !loading && (
          <>
            {quizzes.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Quizzes</Text>
                {quizzes.map((quiz) => (
                  <TouchableOpacity
                    key={quiz.id}
                    style={[styles.resultCard, { backgroundColor: theme.card }]}
                    onPress={() => navigation.navigate('Quiz', { quiz })}
                  >
                    <Ionicons name="help-circle" size={24} color="#F59E0B" />
                    <View style={styles.resultInfo}>
                      <Text style={[styles.resultTitle, { color: theme.text }]}>{quiz.title}</Text>
                      <Text style={[styles.resultSubtitle, { color: theme.textSecondary }]}>
                        {quiz.quiz_questions?.length || 0} questions
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {documents.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Documents</Text>
                {documents.map((doc) => (
                  <TouchableOpacity
                    key={doc.id}
                    style={[styles.resultCard, { backgroundColor: theme.card }]}
                    onPress={() => openDocument(doc)}
                  >
                    <Ionicons name="document-text" size={24} color="#8B5CF6" />
                    <View style={styles.resultInfo}>
                      <Text style={[styles.resultTitle, { color: theme.text }]}>{doc.title}</Text>
                      <Text style={[styles.resultSubtitle, { color: theme.textSecondary }]}>
                        {doc.file_type || 'PDF'}
                      </Text>
                    </View>
                    <Ionicons name="download-outline" size={20} color={theme.textTertiary} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {quizzes.length === 0 && documents.length === 0 && (
              <Text style={[styles.noResults, { color: theme.textSecondary }]}>No results found</Text>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0FDF4',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    height: 50,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
  loader: {
    marginVertical: 20,
  },
  section: {
    marginBottom: 24,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  resultInfo: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  resultSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  noResults: {
    textAlign: 'center',
    fontSize: 16,
    color: '#6B7280',
    marginTop: 40,
  },
});

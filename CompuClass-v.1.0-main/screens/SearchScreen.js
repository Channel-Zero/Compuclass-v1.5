import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Animated, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { supabase } from '../config/supabase';
import { escapeLikePattern, LIMITS } from '../utils/inputValidation';
import { openStoredDocument } from '../utils/fileDownload';
import { getErrorMessage } from '../utils/errorMessages';
import { classService } from '../services/classService';
import { filterByClassScope } from '../utils/classScope';
const BLUE = '#2563EB'; const YELLOW = '#FACC15'; const PURPLE = '#8B5CF6';
const WHITE = '#FFFFFF'; const BG = '#F3F4F6'; const TEXT = '#111827';
const MUTED = '#4B5563'; const CARD = '#FFFFFF';

const SEARCH_DEBOUNCE_MS = 300;

function SkeletonCard() {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.9] });
  return (
    <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, borderRadius: 14, padding: 14, marginBottom: 8, gap: 12 }, { opacity }]}>
      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#E5E7EB' }} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={{ height: 12, backgroundColor: '#E5E7EB', borderRadius: 6, width: '80%' }} />
        <View style={{ height: 10, backgroundColor: '#E5E7EB', borderRadius: 6, width: '50%' }} />
      </View>
    </Animated.View>
  );
}

export default function SearchScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [searchQuery, setSearchQuery] = useState('');
  const [quizzes, setQuizzes] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const inputRef = useRef(null);

  const latestSearch = useRef(0);

  // Debounced: previously every keystroke fired two Supabase queries.
  useEffect(() => {
    if (searchQuery.length === 0) { setQuizzes([]); setDocuments([]); setLoading(false); return; }
    setLoading(true);
    const timer = setTimeout(() => searchContent(searchQuery), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const searchContent = async (query) => {
    const searchId = ++latestSearch.current;
    const pattern = `%${escapeLikePattern(query.trim().slice(0, LIMITS.search))}%`;
    try {
      const [quizzesRes, docsRes] = await Promise.all([
        // Question rows stay on the server. Counts come from quiz_question_counts
        // when that function exists; the embed is only ids, never correct_answer.
        supabase.from('quizzes').select('*, quiz_questions(id)').ilike('title', pattern),
        supabase.from('documents').select('*').ilike('title', pattern),
      ]);
      // Ignore responses for queries the user has already typed past.
      if (searchId !== latestSearch.current) return;
      // supabase-js returns errors rather than throwing; previously a failed
      // search just looked like "No results found".
      if (quizzesRes.error || docsRes.error) throw quizzesRes.error || docsRes.error;
      const quizzes = quizzesRes.data || [];
      const ids = quizzes.map((quiz) => quiz.id).filter(Boolean);
      let counts = null;
      if (ids.length > 0 && typeof supabase.rpc === 'function') {
        const countRes = await supabase.rpc('quiz_question_counts', { p_quiz_ids: ids });
        if (!countRes.error && Array.isArray(countRes.data)) {
          counts = Object.fromEntries(countRes.data.map((row) => [row.quiz_id, row.question_count]));
        }
      }
      setSearchError('');
      setQuizzes(counts
        ? quizzes.map((quiz) => ({ ...quiz, quiz_questions: Array.from({ length: counts[quiz.id] || 0 }) }))
        : quizzes);
      const scope = await classService.classScopeForCurrentUser();
      setDocuments(filterByClassScope(docsRes.data || [], scope));
    } catch (error) {
      if (searchId === latestSearch.current) {
        setQuizzes([]); setDocuments([]);
        setSearchError(getErrorMessage(error, { context: 'Search', fallback: "Couldn't load results. Please try again." }));
      }
    }
    if (searchId === latestSearch.current) setLoading(false);
  };

  const openDocument = async (doc) => {
    try {
      const outcome = await openStoredDocument(doc.file_url, doc.file_name || `${doc.title}.pdf`);
      if (outcome === 'downloaded') Alert.alert('Success', 'File downloaded');
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error, { context: 'SearchDownload', fallback: 'Failed to download document' }));
    }
  };

  const hasResults = quizzes.length > 0 || documents.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: BG }]}>
      <LinearGradient colors={[BLUE, '#1D4ED8']} style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.topTitle}>Search 🔍</Text>
        <Text style={styles.topSubtitle}>Find quizzes, documents and more</Text>
        <View style={[styles.searchBar, { backgroundColor: CARD }]}>
          <Ionicons name="search-outline" size={18} color={MUTED} />
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, { color: TEXT }]}
            placeholder="Search lessons, quizzes, topics..."
            placeholderTextColor={MUTED}
            value={searchQuery}
            onChangeText={setSearchQuery}
            maxLength={LIMITS.search}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSearchQuery(''); }} activeOpacity={0.75}>
              <Ionicons name="close-circle" size={18} color={MUTED} />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}>
        {loading && [1, 2, 3].map(i => <SkeletonCard key={i} />)}
        {searchQuery.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconWrap, { backgroundColor: BLUE }]}>
              <Ionicons name="search" size={40} color={WHITE} />
            </View>
            <Text style={[styles.emptyTitle, { color: TEXT }]}>Find Anything</Text>
            <Text style={[styles.emptySubtitle, { color: MUTED }]}>Search for quizzes and documents</Text>
            <View style={styles.suggestionsRow}>
              {['CPU', 'RAM', 'Motherboard', 'Quiz'].map((s) => (
                <TouchableOpacity key={s} style={[styles.suggestionChip, { backgroundColor: CARD, borderColor: BLUE + '30' }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSearchQuery(s); }} activeOpacity={0.75}>
                  <Text style={[styles.suggestionText, { color: BLUE }]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
        {searchQuery.length > 0 && !loading && (
          <>
            {quizzes.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: MUTED }]}>Quizzes ({quizzes.length})</Text>
                {quizzes.map((quiz) => (
                  <TouchableOpacity key={quiz.id} style={[styles.resultCard, { backgroundColor: CARD }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate('Quiz', { quizId: quiz.id }); }} activeOpacity={0.75}>
                    <View style={[styles.resultIconWrap, { backgroundColor: YELLOW }]}>
                      <Ionicons name="help-circle" size={22} color={WHITE} />
                    </View>
                    <View style={styles.resultInfo}>
                      <Text style={[styles.resultTitle, { color: TEXT }]}>{quiz.title}</Text>
                      <Text style={[styles.resultSubtitle, { color: MUTED }]}>{quiz.quiz_questions?.length || 0} questions</Text>
                    </View>
                    <View style={[styles.resultBadge, { backgroundColor: YELLOW + '30' }]}>
                      <Text style={[styles.resultBadgeText, { color: TEXT }]}>Quiz</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {documents.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: MUTED }]}>Documents ({documents.length})</Text>
                {documents.map((doc) => (
                  <TouchableOpacity key={doc.id} style={[styles.resultCard, { backgroundColor: CARD }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); openDocument(doc); }} activeOpacity={0.75}>
                    <View style={[styles.resultIconWrap, { backgroundColor: PURPLE }]}>
                      <Ionicons name="document-text" size={22} color={WHITE} />
                    </View>
                    <View style={styles.resultInfo}>
                      <Text style={[styles.resultTitle, { color: TEXT }]}>{doc.title}</Text>
                      <Text style={[styles.resultSubtitle, { color: MUTED }]}>{doc.file_type || 'PDF'}</Text>
                    </View>
                    <Ionicons name="download-outline" size={18} color={MUTED} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {searchError ? (
              <View style={styles.emptyState} accessibilityRole="alert">
                <View style={[styles.emptyIconWrap, { backgroundColor: '#EF4444' }]}><Ionicons name="cloud-offline" size={40} color={WHITE} /></View>
                <Text style={[styles.emptyTitle, { color: TEXT }]}>Search failed</Text>
                <Text style={[styles.emptySubtitle, { color: MUTED }]}>{searchError}</Text>
              </View>
            ) : !hasResults && (
              <View style={styles.emptyState}>
                <View style={[styles.emptyIconWrap, { backgroundColor: MUTED }]}><Ionicons name="search" size={40} color={WHITE} /></View>
                <Text style={[styles.emptyTitle, { color: TEXT }]}>No results found</Text>
                <Text style={[styles.emptySubtitle, { color: MUTED }]}>Try a different search term</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { paddingBottom: 16, paddingHorizontal: 16 },
  topTitle: { fontSize: 24, fontWeight: '900', color: '#FFFFFF', marginBottom: 2 },
  topSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 14 },
  searchBar: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: 14, height: 48, gap: 10 },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '600' },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '900', marginBottom: 6 },
  emptySubtitle: { fontSize: 14, fontWeight: '500', marginBottom: 20 },
  suggestionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  suggestionChip: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 2 },
  suggestionText: { fontSize: 13, fontWeight: '700' },
  section: { marginBottom: 24 },
  sectionLabel: { fontSize: 13, fontWeight: '800', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  resultCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 14, marginBottom: 8, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  resultIconWrap: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  resultInfo: { flex: 1 },
  resultTitle: { fontSize: 14, fontWeight: '700' },
  resultSubtitle: { fontSize: 12, marginTop: 2, fontWeight: '500' },
  resultBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  resultBadgeText: { fontSize: 11, fontWeight: '800' },
});

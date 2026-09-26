import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Animated, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { supabase } from '../config/supabase';
import { escapeLikePattern, LIMITS } from '../utils/inputValidation';
import { openRemoteDocument } from '../utils/fileDownload';
import { getErrorMessage } from '../utils/errorMessages';

const SEARCH_DEBOUNCE_MS = 300;

const BLUE = '#2563EB'; const YELLOW = '#FACC15'; const PURPLE = '#8B5CF6';
const WHITE = '#FFFFFF'; const BG = '#F3F4F6'; const TEXT = '#111827';
const MUTED = '#4B5563'; const BORDER = '#E5E7EB';

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
    <Animated.View style={[styles.skeletonCard, { opacity }]}>
      <View style={styles.skeletonIcon} />
      <View style={styles.skeletonLines}>
        <View style={styles.skeletonLine} />
        <View style={[styles.skeletonLine, { width: '50%' }]} />
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
        // Only the question count is displayed here — fetch ids, not full rows,
        // so correct_answer never reaches a student's device for quizzes they
        // haven't started yet.
        supabase.from('quizzes').select('*, quiz_questions(id)').ilike('title', pattern),
        supabase.from('documents').select('*').ilike('title', pattern),
      ]);
      // Ignore responses for queries the user has already typed past.
      if (searchId !== latestSearch.current) return;
      // supabase-js returns errors rather than throwing; previously a failed
      // search just looked like "No results found".
      if (quizzesRes.error || docsRes.error) throw quizzesRes.error || docsRes.error;
      setSearchError('');
      setQuizzes(quizzesRes.data || []);
      setDocuments(docsRes.data || []);
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
      const outcome = await openRemoteDocument(doc.file_url, doc.file_name || `${doc.title}.pdf`);
      if (outcome === 'downloaded') Alert.alert('Success', 'File downloaded');
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error, { context: 'SearchDownload', fallback: 'Failed to download document' }));
    }
  };

  const hasResults = quizzes.length > 0 || documents.length > 0;

  return (
    <View style={styles.container}>
      {/* Header with safe area */}
      <LinearGradient colors={[BLUE, '#1D4ED8']} style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.topTitle}>Search 🔍</Text>
        <Text style={styles.topSubtitle}>Find quizzes, documents and more</Text>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={MUTED} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
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

        {/* Skeleton loading */}
        {loading && [1, 2, 3].map(i => <SkeletonCard key={i} />)}

        {/* Empty state */}
        {searchQuery.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="search" size={40} color={WHITE} />
            </View>
            <Text style={styles.emptyTitle}>Find Anything</Text>
            <Text style={styles.emptySubtitle}>Search for quizzes and documents</Text>
            <View style={styles.suggestionsRow}>
              {['CPU', 'RAM', 'Motherboard', 'Quiz'].map((s) => (
                <TouchableOpacity
                  key={s}
                  style={styles.suggestionChip}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSearchQuery(s); }}
                  activeOpacity={0.75}
                >
                  <Text style={styles.suggestionText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {searchQuery.length > 0 && !loading && (
          <>
            {quizzes.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Quizzes ({quizzes.length})</Text>
                {quizzes.map((quiz) => (
                  <TouchableOpacity
                    key={quiz.id}
                    style={styles.resultCard}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate('Quiz', { quizId: quiz.id }); }}
                    activeOpacity={0.75}
                  >
                    <View style={styles.resultIconWrap}>
                      <Ionicons name="help-circle" size={22} color={WHITE} />
                    </View>
                    <View style={styles.resultInfo}>
                      <Text style={styles.resultTitle}>{quiz.title}</Text>
                      <Text style={styles.resultSubtitle}>{quiz.quiz_questions?.length || 0} questions</Text>
                    </View>
                    <View style={styles.resultBadge}>
                      <Text style={styles.resultBadgeText}>Quiz</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {documents.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Documents ({documents.length})</Text>
                {documents.map((doc) => (
                  <TouchableOpacity
                    key={doc.id}
                    style={styles.resultCard}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); openDocument(doc); }}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.resultIconWrap, { backgroundColor: PURPLE }]}>
                      <Ionicons name="document-text" size={22} color={WHITE} />
                    </View>
                    <View style={styles.resultInfo}>
                      <Text style={styles.resultTitle}>{doc.title}</Text>
                      <Text style={styles.resultSubtitle}>{doc.file_type || 'PDF'}</Text>
                    </View>
                    <Ionicons name="download-outline" size={18} color={MUTED} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {searchError ? (
              <View style={styles.emptyState} accessibilityRole="alert">
                <View style={[styles.emptyIconWrap, { backgroundColor: '#EF4444' }]}>
                  <Ionicons name="cloud-offline" size={40} color={WHITE} />
                </View>
                <Text style={styles.emptyTitle}>Search failed</Text>
                <Text style={styles.emptySubtitle}>{searchError}</Text>
              </View>
            ) : !hasResults && (
              <View style={styles.emptyState}>
                <View style={[styles.emptyIconWrap, { backgroundColor: MUTED }]}>
                  <Ionicons name="search" size={40} color={WHITE} />
                </View>
                <Text style={styles.emptyTitle}>No results found</Text>
                <Text style={styles.emptySubtitle}>Try a different search term</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  topBar: { paddingBottom: 16, paddingHorizontal: 16 },
  topTitle: { fontSize: 24, fontWeight: '900', color: WHITE, marginBottom: 2 },
  topSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 14 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: WHITE, borderRadius: 14, paddingHorizontal: 14, height: 48, gap: 10 },
  searchInput: { flex: 1, color: TEXT, fontSize: 15, fontWeight: '600' },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },

  // Skeleton
  skeletonCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: WHITE, borderRadius: 14, padding: 14, marginBottom: 8, gap: 12 },
  skeletonIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#E5E7EB' },
  skeletonLines: { flex: 1, gap: 8 },
  skeletonLine: { height: 12, backgroundColor: '#E5E7EB', borderRadius: 6, width: '80%' },

  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 24, backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: TEXT, marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: MUTED, fontWeight: '500', marginBottom: 20 },
  suggestionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  suggestionChip: { backgroundColor: WHITE, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 2, borderColor: BLUE + '30' },
  suggestionText: { fontSize: 13, fontWeight: '700', color: BLUE },

  section: { marginBottom: 24 },
  sectionLabel: { fontSize: 13, fontWeight: '800', color: MUTED, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  resultCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: WHITE, borderRadius: 14, padding: 14, marginBottom: 8, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  resultIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center' },
  resultInfo: { flex: 1 },
  resultTitle: { fontSize: 14, fontWeight: '700', color: TEXT },
  resultSubtitle: { fontSize: 12, color: MUTED, marginTop: 2, fontWeight: '500' },
  resultBadge: { backgroundColor: YELLOW + '30', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  resultBadgeText: { fontSize: 11, fontWeight: '800', color: TEXT },
});

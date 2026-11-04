import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Animated, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { supabase } from '../config/supabase';
import { escapeLikePattern, LIMITS } from '../utils/inputValidation';
import { plural } from '../utils/quizFlow';
import { findAppScreens, quizResultDestination } from '../utils/appSearch';
import { authService } from '../services/authService';
import { openStoredDocument } from '../utils/fileDownload';
import { getErrorMessage } from '../utils/errorMessages';
import { classService } from '../services/classService';
import { filterByClassScope } from '../utils/classScope';
import { appTheme, useTheme } from '../context/ThemeContext';
import { useLayout } from '../components/ui/kit';
const BLUE = appTheme.primary; const PURPLE = appTheme.accentInk;
const WHITE = appTheme.surface; const TEXT = appTheme.text;
const MUTED = appTheme.textSecondary; const CARD = appTheme.card;

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
  }, [shimmer]);
  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.9] });
  return (
    <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, borderRadius: 14, padding: 14, marginBottom: 8, gap: 12 }, { opacity }]}>
      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#DCE6EF' }} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={{ height: 12, backgroundColor: '#DCE6EF', borderRadius: 6, width: '80%' }} />
        <View style={{ height: 10, backgroundColor: '#DCE6EF', borderRadius: 6, width: '50%' }} />
      </View>
    </Animated.View>
  );
}

export default function SearchScreen({ navigation, route }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { bottom } = useLayout();

  const [searchQuery, setSearchQuery] = useState('');
  const [quizzes, setQuizzes] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [role, setRole] = useState(null);
  const inputRef = useRef(null);

  const latestSearch = useRef(0);

  useEffect(() => {
    let alive = true;
    authService.getCurrentUser().then((user) => {
      if (alive) setRole(user?.profile?.role || 'student');
    }).catch(() => {
      if (alive) setRole('student');
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const incoming = route?.params?.query;
    if (typeof incoming === 'string' && incoming.trim()) {
      setSearchQuery(incoming.trim().slice(0, LIMITS.search));
    }
  }, [route?.params?.query]);

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

  const screens = findAppScreens(searchQuery);
  const hasResults = quizzes.length > 0 || documents.length > 0 || screens.length > 0;

  const openQuiz = (quiz) => {
    const destination = quizResultDestination(role, quiz.id);
    navigation.navigate(destination.name, destination.params);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + 12, backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <Text style={styles.topTitle} accessibilityRole="header">Search</Text>
        <Text style={styles.topSubtitle}>Find quizzes, documents and more</Text>
        <View style={[styles.searchBar, { backgroundColor: CARD, borderColor: '#C9D6E3' }]} pointerEvents="box-none">
          <Ionicons name="search-outline" size={18} color={MUTED} />
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, { color: TEXT }]}
            placeholder="Search lessons, quizzes, topics..."
            placeholderTextColor={MUTED}
            value={searchQuery}
            onChangeText={setSearchQuery}
            maxLength={LIMITS.search}
            editable
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSearchQuery(''); }} style={styles.clearBtn} accessibilityRole="button" accessibilityLabel="Clear search" activeOpacity={0.75}>
              <Ionicons name="close-circle" size={18} color={MUTED} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottom }}>
        {loading && [1, 2, 3].map(i => <SkeletonCard key={i} />)}
        {searchQuery.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconWrap, { backgroundColor: '#EDF4FF' }]}>
              <Ionicons name="search" size={40} color={BLUE} />
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
                  <TouchableOpacity key={quiz.id} style={[styles.resultCard, { backgroundColor: CARD }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); openQuiz(quiz); }} activeOpacity={0.75}>
                    <View style={[styles.resultIconWrap, { backgroundColor: '#EDF4FF' }]}>
                      <Ionicons name="help-circle" size={22} color={BLUE} />
                    </View>
                    <View style={styles.resultInfo}>
                      <Text style={[styles.resultTitle, { color: TEXT }]}>{quiz.title}</Text>
                      <Text style={[styles.resultSubtitle, { color: MUTED }]}>{plural(quiz.quiz_questions?.length || 0, 'question')}</Text>
                    </View>
                    <View style={[styles.resultBadge, { backgroundColor: '#FFF9D6' }]}>
                      <Text style={[styles.resultBadgeText, { color: '#7A5C00' }]}>Quiz</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {screens.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: MUTED }]}>In the app ({screens.length})</Text>
                {screens.map((item) => (
                  <TouchableOpacity key={item.screen} style={[styles.resultCard, { backgroundColor: CARD }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate(item.screen); }} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel={`Open ${item.title}`}>
                    <View style={[styles.resultIconWrap, { backgroundColor: '#EDF4FF' }]}>
                      <Ionicons name="apps" size={22} color={BLUE} />
                    </View>
                    <View style={styles.resultInfo}>
                      <Text style={[styles.resultTitle, { color: TEXT }]}>{item.title}</Text>
                      <Text style={[styles.resultSubtitle, { color: MUTED }]}>{item.blurb}</Text>
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
                    <View style={[styles.resultIconWrap, { backgroundColor: '#DDF3F4' }]}>
                      <Ionicons name="document-text" size={22} color={PURPLE} />
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
                <View style={[styles.emptyIconWrap, { backgroundColor: '#D92D4A' }]}><Ionicons name="cloud-offline" size={40} color={WHITE} /></View>
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
  topBar: { paddingBottom: 16, paddingHorizontal: 16, backgroundColor: WHITE, borderBottomWidth: 1, borderBottomColor: '#DCE6EF' },
  topTitle: { fontSize: 24, fontWeight: '800', color: TEXT, marginBottom: 2 },
  topSubtitle: { fontSize: 13, color: MUTED, marginBottom: 14 },
  clearBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: 14, minHeight: 52, height: 52, gap: 10, width: '100%', maxWidth: 400, alignSelf: 'flex-start', borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 16, fontWeight: '600', height: 44, minHeight: 44, paddingVertical: 10, paddingHorizontal: 4, outlineStyle: 'none' },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '900', marginBottom: 6 },
  emptySubtitle: { fontSize: 14, fontWeight: '500', marginBottom: 20 },
  suggestionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  suggestionChip: { borderRadius: 20, paddingHorizontal: 16, minHeight: 44, justifyContent: 'center', borderWidth: 2 },
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

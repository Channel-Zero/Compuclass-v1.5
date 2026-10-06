import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { supabase } from '../config/supabase';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { createSignedFileUrl, recordMaterialView } from '../services/fileAccess';

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
  const inputRef = useRef(null);
  const requestRef = useRef(0);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setQuizzes([]);
      setDocuments([]);
      setLoading(false);
      return undefined;
    }
    const requestId = ++requestRef.current;
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const term = searchQuery.trim().replace(/[%_]/g, '');
        const [quizzesRes, docsRes] = await Promise.all([
          supabase.from('quizzes').select('id, title, description').ilike('title', `%${term}%`),
          supabase.from('documents').select('id, title, file_name, file_type, file_url').ilike('title', `%${term}%`),
        ]);
        if (requestId !== requestRef.current) return;
        setQuizzes(quizzesRes.data || []);
        setDocuments(docsRes.data || []);
      } catch (error) { console.error('Search error:', error); }
      finally { if (requestId === requestRef.current) setLoading(false); }
    }, 300);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  const openDocument = async (doc) => {
    try {
      await recordMaterialView(doc.id);
      const fileName = doc.file_name || `${doc.title}.pdf`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      const signedUrl = await createSignedFileUrl(doc.file_url);
      const result = await FileSystem.downloadAsync(signedUrl, fileUri);
      if (result.status === 200 && await Sharing.isAvailableAsync()) await Sharing.shareAsync(result.uri);
    } catch (error) { console.error('Download error:', error); }
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
                      <Text style={styles.resultSubtitle}>{quiz.description || 'Quiz'}</Text>
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

            {!hasResults && (
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

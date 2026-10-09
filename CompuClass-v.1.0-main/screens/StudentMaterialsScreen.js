import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { supabase } from '../config/supabase';
import { openRemoteDocument } from '../utils/fileDownload';
import { getErrorMessage } from '../utils/errorMessages';
const BLUE = '#2563EB'; const YELLOW = '#FACC15'; const PURPLE = '#8B5CF6';
const WHITE = '#FFFFFF'; const BG = '#F3F4F6'; const TEXT = '#111827';
const MUTED = '#4B5563'; const CARD = '#FFFFFF';

export default function StudentMaterialsScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [quizzes, setQuizzes] = useState([]);

  useEffect(() => { loadFolders(); }, []);
  useEffect(() => { if (selectedFolder) loadFolderContent(selectedFolder.id); }, [selectedFolder]);

  const loadFolders = async () => {
    try {
      const { data, error } = await supabase.from('folders').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setFolders(data);
    } catch (error) { Alert.alert('Error', getErrorMessage(error, { context: 'StudentMaterials' })); }
  };

  const loadFolderContent = async (folderId) => {
    try {
      const [docsRes, quizzesRes] = await Promise.all([
        supabase.from('documents').select('*').eq('folder_id', folderId),
        // Only the question count is displayed here — fetch ids, not full rows,
        // so correct_answer never reaches a student's device for quizzes they
        // haven't started yet.
        supabase.from('quizzes').select('*, quiz_questions(id)').eq('folder_id', folderId),
      ]);
      if (docsRes.error) throw docsRes.error;
      if (quizzesRes.error) throw quizzesRes.error;
      setDocuments(docsRes.data);
      setQuizzes(quizzesRes.data);
    } catch (error) { Alert.alert('Error', getErrorMessage(error, { context: 'StudentMaterials' })); }
  };

  const openDocument = async (doc) => {
    try {
      if (!doc.file_url) { Alert.alert('Error', 'No file URL available'); return; }
      const outcome = await openRemoteDocument(doc.file_url, doc.file_name || `${doc.title}.pdf`);
      if (outcome === 'downloaded') Alert.alert('Success', 'File downloaded');
    } catch (error) { Alert.alert('Error', getErrorMessage(error, { context: 'StudentMaterials', fallback: 'Failed to download document' })); }
  };

  if (selectedFolder) return (
    <View style={[styles.container, { backgroundColor: BG }]}>
      <LinearGradient colors={[PURPLE, '#7C3AED']} style={[styles.folderHeader, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => setSelectedFolder(null)} style={styles.backBtn}><Ionicons name="arrow-back" size={20} color={WHITE} /></TouchableOpacity>
        <View style={styles.folderHeaderIcon}><Ionicons name="folder-open" size={22} color={WHITE} /></View>
        <Text style={styles.folderHeaderTitle}>{selectedFolder.name}</Text>
      </LinearGradient>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}>
        <Text style={[styles.sectionLabel, { color: MUTED }]}>Documents</Text>
        {documents.length === 0
          ? <Text style={[styles.emptyText, { color: MUTED }]}>No documents in this folder</Text>
          : documents.map((doc) => (
            <TouchableOpacity key={doc.id} style={[styles.itemCard, { backgroundColor: CARD }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); openDocument(doc); }} activeOpacity={0.75}>
              <View style={[styles.itemIconWrap, { backgroundColor: PURPLE }]}><Ionicons name="document-text" size={18} color={WHITE} /></View>
              <Text style={[styles.itemTitle, { color: TEXT }]}>{doc.title}</Text>
              <View style={[styles.downloadBadge, { backgroundColor: PURPLE + '15' }]}><Ionicons name="download-outline" size={14} color={PURPLE} /></View>
            </TouchableOpacity>
          ))}
        <Text style={[styles.sectionLabel, { color: MUTED, marginTop: 20 }]}>Quizzes</Text>
        {quizzes.length === 0
          ? <Text style={[styles.emptyText, { color: MUTED }]}>No quizzes in this folder</Text>
          : quizzes.map((quiz) => (
            <TouchableOpacity key={quiz.id} style={[styles.itemCard, { backgroundColor: CARD }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate('Quiz', { quizId: quiz.id }); }} activeOpacity={0.75}>
              <View style={[styles.itemIconWrap, { backgroundColor: YELLOW }]}><Ionicons name="help-circle" size={18} color={TEXT} /></View>
              <Text style={[styles.itemTitle, { color: TEXT }]}>{quiz.title}</Text>
              <View style={[styles.questionBadge, { backgroundColor: YELLOW + '30' }]}><Text style={[styles.questionBadgeText, { color: TEXT }]}>{quiz.quiz_questions?.length || 0} Q</Text></View>
            </TouchableOpacity>
          ))}
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: BG }]}>
      <LinearGradient colors={[PURPLE, '#7C3AED']} style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <View style={styles.headerIconWrap}><Ionicons name="library" size={32} color={WHITE} /></View>
        <Text style={styles.headerTitle}>Learning Materials 📚</Text>
        <Text style={styles.headerSubtitle}>Browse your course folders and resources</Text>
      </LinearGradient>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}>
        {folders.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconWrap, { backgroundColor: PURPLE }]}><Ionicons name="folder-open" size={40} color={WHITE} /></View>
            <Text style={[styles.emptyTitle, { color: TEXT }]}>No folders yet</Text>
            <Text style={[styles.emptySubtitle, { color: MUTED }]}>Your lecturer will add materials here</Text>
          </View>
        ) : folders.map((folder) => (
          <TouchableOpacity key={folder.id} style={[styles.folderCard, { backgroundColor: CARD }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedFolder(folder); }} activeOpacity={0.75}>
            <View style={[styles.folderIconWrap, { backgroundColor: PURPLE }]}><Ionicons name="folder" size={26} color={WHITE} /></View>
            <View style={styles.folderInfo}>
              <Text style={[styles.folderName, { color: TEXT }]}>{folder.name}</Text>
              {folder.description && <Text style={[styles.folderDesc, { color: MUTED }]}>{folder.description}</Text>}
            </View>
            <Ionicons name="chevron-forward" size={18} color={MUTED} />
          </TouchableOpacity>
        ))}
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { alignItems: 'center', paddingBottom: 32, paddingHorizontal: 20 },
  headerIconWrap: { width: 68, height: 68, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: WHITE, marginBottom: 6 },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.85)', textAlign: 'center' },
  folderHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: 20, paddingHorizontal: 16, gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  folderHeaderIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  folderHeaderTitle: { fontSize: 17, fontWeight: '800', color: WHITE, flex: 1 },
  content: { flex: 1, padding: 16 },
  sectionLabel: { fontSize: 13, fontWeight: '800', color: MUTED, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  emptyText: { fontSize: 13, color: MUTED, marginBottom: 8, fontWeight: '500' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 24, backgroundColor: PURPLE, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: TEXT, marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: MUTED, fontWeight: '500' },
  folderCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: WHITE, borderRadius: 16, padding: 16, marginBottom: 10, gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  folderIconWrap: { width: 46, height: 46, borderRadius: 12, backgroundColor: PURPLE, alignItems: 'center', justifyContent: 'center' },
  folderInfo: { flex: 1 },
  folderName: { fontSize: 15, fontWeight: '700', color: TEXT },
  folderDesc: { fontSize: 12, color: MUTED, marginTop: 3 },
  itemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: WHITE, borderRadius: 16, padding: 14, marginBottom: 8, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  itemIconWrap: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  itemTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: TEXT },
  downloadBadge: { width: 32, height: 32, borderRadius: 10, backgroundColor: PURPLE + '15', alignItems: 'center', justifyContent: 'center' },
  questionBadge: { backgroundColor: YELLOW + '30', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  questionBadgeText: { fontSize: 11, fontWeight: '800', color: TEXT },
});

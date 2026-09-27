import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, TextInput, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { lecturerService } from '../services/lecturerService';

const BLUE = '#2563EB'; const YELLOW = '#FACC15'; const RED = '#EF4444';
const GREEN = '#22C55E'; const PURPLE = '#8B5CF6'; const WHITE = '#FFFFFF';
const BG = '#F3F4F6'; const TEXT = '#111827'; const MUTED = '#4B5563'; const BORDER = '#E5E7EB';

const quickActions = (navigation, lecturerService) => [
  { icon: 'people', label: 'Student Progress', color: BLUE, onPress: () => navigation.navigate('StudentProgress') },
  { icon: 'school', label: 'Class Management', color: PURPLE, onPress: () => navigation.navigate('ClassManagement') },
  { icon: 'cloud-upload', label: 'Upload Content', color: GREEN, onPress: async () => {
    try {
      const f = await lecturerService.getFolders();
      let folderId = f[0]?.id;
      if (!folderId) { const nf = await lecturerService.createFolder('General', 'General documents'); folderId = nf.id; }
      navigation.navigate('ContentUpload', { folderId });
    } catch (error) { Alert.alert('Error', error.message); }
  }},
  { icon: 'help-circle', label: 'Create Quiz', color: YELLOW, onPress: async () => {
    try {
      const f = await lecturerService.getFolders();
      let folderId = f[0]?.id;
      if (!folderId) { const nf = await lecturerService.createFolder('General', 'General quizzes'); folderId = nf.id; }
      navigation.navigate('QuizCreation', { folderId });
    } catch (error) { Alert.alert('Error', error.message); }
  }},
];

export default function LecturerDashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [folders, setFolders] = useState([]);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const [folderName, setFolderName] = useState('');
  const [folderDescription, setFolderDescription] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadFolders(); }, []);

  const loadFolders = async () => {
    try { const data = await lecturerService.getFolders(); setFolders(data); }
    catch (error) { Alert.alert('Error', error.message); }
  };

  const handlePostAnnouncement = async () => {
    if (!announcementTitle.trim()) { Alert.alert('Error', 'Please enter a title'); return; }
    setLoading(true);
    try {
      const { supabase } = await import('../config/supabase');
      await supabase.from('announcements').insert({ title: announcementTitle, body: announcementBody });
      setShowAnnouncement(false); setAnnouncementTitle(''); setAnnouncementBody('');
      Alert.alert('Posted!', 'Announcement sent to all students.');
    } catch (error) { Alert.alert('Error', error.message); }
    finally { setLoading(false); }
  };

  const handleCreateFolder = async () => {
    if (!folderName.trim()) { Alert.alert('Error', 'Please enter a folder name'); return; }
    setLoading(true);
    try {
      await lecturerService.createFolder(folderName, folderDescription);
      setShowCreateFolder(false); setFolderName(''); setFolderDescription('');
      loadFolders();
    } catch (error) { Alert.alert('Error', error.message); }
    finally { setLoading(false); }
  };

  const handleDeleteFolder = (folderId) => {
    Alert.alert('Delete Folder', 'Are you sure? This will delete all content inside.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await lecturerService.deleteFolder(folderId); loadFolders(); }
        catch (error) { Alert.alert('Error', error.message); }
      }},
    ]);
  };

  const actions = quickActions(navigation, lecturerService);

  return (
    <View style={styles.container}>
      <LinearGradient colors={[BLUE, '#1D4ED8']} style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <View style={styles.headerIconWrap}>
          <Ionicons name="desktop" size={28} color={WHITE} />
        </View>
        <Text style={styles.headerTitle}>Lecturer Dashboard 👨‍🏫</Text>
        <Text style={styles.headerSubtitle}>Manage your learning materials</Text>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}>
        <TouchableOpacity style={[styles.createFolderBtn, { backgroundColor: '#7C3AED', marginBottom: 10 }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowAnnouncement(true); }} activeOpacity={0.85}>
          <Ionicons name="megaphone" size={20} color={WHITE} />
          <Text style={styles.createFolderText}>Post Announcement</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.createFolderBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowCreateFolder(true); }} activeOpacity={0.85}>
          <Ionicons name="add-circle" size={20} color={WHITE} />
          <Text style={styles.createFolderText}>Create New Folder</Text>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {actions.map((action, i) => (
            <TouchableOpacity key={i} style={styles.actionCard} onPress={action.onPress} activeOpacity={0.75}>
              <View style={[styles.actionIconWrap, { backgroundColor: action.color }]}>
                <Ionicons name={action.icon} size={22} color={action.color === YELLOW ? TEXT : WHITE} />
              </View>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Your Folders</Text>
        {folders.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="folder-open" size={36} color={WHITE} />
            </View>
            <Text style={styles.emptyText}>No folders yet. Create one above.</Text>
          </View>
        ) : folders.map((folder) => (
          <TouchableOpacity key={folder.id} style={styles.folderCard} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate('FolderContent', { folder }); }} activeOpacity={0.75}>
            <View style={styles.folderIconWrap}>
              <Ionicons name="folder" size={22} color={WHITE} />
            </View>
            <View style={styles.folderInfo}>
              <Text style={styles.folderName}>{folder.name}</Text>
              {folder.description && <Text style={styles.folderDesc}>{folder.description}</Text>}
            </View>
            <TouchableOpacity onPress={() => handleDeleteFolder(folder.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="trash-outline" size={18} color={RED} />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
        <View style={{ height: 32 }} />
      </ScrollView>

      <Modal visible={showAnnouncement} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Post Announcement 📢</Text>
            <TextInput style={styles.input} placeholder="Title" placeholderTextColor={MUTED} value={announcementTitle} onChangeText={setAnnouncementTitle} />
            <TextInput style={[styles.input, styles.textArea]} placeholder="Message to students..." placeholderTextColor={MUTED} value={announcementBody} onChangeText={setAnnouncementBody} multiline />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAnnouncement(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handlePostAnnouncement} disabled={loading}>
                <Text style={styles.saveBtnText}>{loading ? 'Posting...' : 'Post'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showCreateFolder} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create New Folder 📁</Text>
            <TextInput style={styles.input} placeholder="Folder Name" placeholderTextColor={MUTED}
              value={folderName} onChangeText={setFolderName} />
            <TextInput style={[styles.input, styles.textArea]} placeholder="Description (optional)" placeholderTextColor={MUTED}
              value={folderDescription} onChangeText={setFolderDescription} multiline />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreateFolder(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleCreateFolder} disabled={loading}>
                <Text style={styles.saveBtnText}>{loading ? 'Creating...' : 'Create'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: { alignItems: 'center', paddingBottom: 32, paddingHorizontal: 20 },
  headerIconWrap: { width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: WHITE, marginBottom: 4 },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  content: { flex: 1, padding: 16 },
  createFolderBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: BLUE, borderRadius: 14, padding: 14, marginBottom: 20, gap: 8, shadowColor: BLUE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  createFolderText: { color: WHITE, fontSize: 15, fontWeight: '800' },
  sectionLabel: { fontSize: 13, fontWeight: '800', color: MUTED, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  actionCard: { width: '47%', backgroundColor: WHITE, borderRadius: 16, padding: 16, alignItems: 'center', gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  actionIconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 12, fontWeight: '700', color: TEXT, textAlign: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIconWrap: { width: 68, height: 68, borderRadius: 20, backgroundColor: PURPLE, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyText: { fontSize: 13, color: MUTED, fontWeight: '500' },
  folderCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: WHITE, borderRadius: 14, padding: 14, marginBottom: 10, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  folderIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: PURPLE, alignItems: 'center', justifyContent: 'center' },
  folderInfo: { flex: 1 },
  folderName: { fontSize: 14, fontWeight: '700', color: TEXT },
  folderDesc: { fontSize: 12, color: MUTED, marginTop: 3 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: WHITE, borderRadius: 20, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: TEXT, marginBottom: 20 },
  input: { backgroundColor: BG, borderWidth: 2, borderColor: BORDER, borderRadius: 12, padding: 12, marginBottom: 12, fontSize: 14, color: TEXT, fontWeight: '600' },
  textArea: { height: 80, textAlignVertical: 'top' },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: BORDER, alignItems: 'center' },
  cancelBtnText: { color: MUTED, fontWeight: '700' },
  saveBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: BLUE, alignItems: 'center' },
  saveBtnText: { color: WHITE, fontWeight: '800' },
});

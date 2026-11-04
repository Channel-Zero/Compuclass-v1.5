import React, { useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, TextInput, Modal, Share, Clipboard } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { lecturerService } from '../services/lecturerService';
import { getErrorMessage } from '../utils/errorMessages';
import { formatShortDate, plural } from '../utils/quizFlow';
import ClassScopePicker from '../components/ClassScopePicker';
import { appTheme, useTheme } from '../context/ThemeContext';
import {
  Page, Heading, Body, Glass, Badge, Button, IconTile, SectionHeader, Skeleton, font, useLayout,
} from '../components/ui/kit';
import { ActionMenu, LECTURER_COLUMN, ToastBanner, confirmNamed, useUndoToast } from '../components/lecturerChrome';

const BLUE = appTheme.primary;
const WHITE = appTheme.surface;
const TEXT = appTheme.text;
const MUTED = appTheme.textSecondary;
const BORDER = appTheme.border;
const BG = appTheme.background;

const quickActions = (navigation, service) => [
  { icon: 'user', label: 'Student progress', tone: 'blue', onPress: () => navigation.navigate('StudentProgress') },
  { icon: 'target', label: 'Quiz analytics', tone: 'teal', onPress: () => navigation.navigate('QuizAnalytics') },
  { icon: 'folder', label: 'Upload content', tone: 'teal', onPress: async () => {
    try {
      const folders = await service.getFolders();
      let folderId = folders?.[0]?.id;
      if (!folderId) {
        const created = await service.createFolder('General', 'General documents');
        folderId = created.id;
      }
      navigation.navigate('ContentUpload', { folderId });
    } catch (error) { Alert.alert('Error', getErrorMessage(error, { context: 'LecturerDashboard' })); }
  }},
  { icon: 'quiz', label: 'Create quiz', tone: 'yellow', onPress: async () => {
    try {
      const folders = await service.getFolders();
      let folderId = folders?.[0]?.id;
      if (!folderId) {
        const created = await service.createFolder('General', 'General quizzes');
        folderId = created.id;
      }
      navigation.navigate('QuizCreation', { folderId });
    } catch (error) { Alert.alert('Error', getErrorMessage(error, { context: 'LecturerDashboard' })); }
  }},
];

function Stat({ label, value }) {
  const { theme } = useTheme();
  return (
    <Glass strong radius={16} style={styles.stat}>
      <Text style={[{ fontSize: 28, color: theme.text }, font(theme, 'h1')]}>{value}</Text>
      <Badge label={label} kind="neutral" />
    </Glass>
  );
}

export default function LecturerDashboardScreen({ navigation }) {
  const { theme } = useTheme();
  const { laptop, phone } = useLayout();
  const { toast, offer, show } = useUndoToast();
  const [folders, setFolders] = useState([]);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const [folderName, setFolderName] = useState('');
  const [folderDescription, setFolderDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState([]);
  const [announcementClassId, setAnnouncementClassId] = useState(null);
  const [folderClassId, setFolderClassId] = useState(null);
  const [status, setStatus] = useState('loading');
  const loadRef = useRef(() => {});

  const loadHome = async () => {
    try {
      const [folderData, classData] = await Promise.all([
        lecturerService.getFolders(),
        lecturerService.getClasses(),
      ]);
      setFolders(Array.isArray(folderData) ? folderData : []);
      setClasses(Array.isArray(classData) ? classData : []);
      setStatus('ready');
    } catch (error) {
      setStatus('error');
      Alert.alert('Error', getErrorMessage(error, { context: 'LecturerDashboard' }));
    }
  };
  loadRef.current = loadHome;
  useFocusEffect(useCallback(() => { loadRef.current(); }, []));

  const handlePostAnnouncement = async () => {
    if (!announcementTitle.trim()) { Alert.alert('Error', 'Please enter a title'); return; }
    setLoading(true);
    try {
      const { supabase } = await import('../config/supabase');
      const row = { title: announcementTitle.trim(), body: announcementBody.trim() };
      if (announcementClassId) row.class_id = announcementClassId;
      const { error } = await supabase.from('announcements').insert(row);
      if (error) throw error;
      setShowAnnouncement(false); setAnnouncementTitle(''); setAnnouncementBody(''); setAnnouncementClassId(null);
      Alert.alert('Posted', announcementClassId ? 'Announcement sent to that class.' : 'Announcement sent to all students.');
    } catch (error) { Alert.alert('Error', getErrorMessage(error, { context: 'LecturerDashboard' })); }
    finally { setLoading(false); }
  };

  const handleCreateFolder = async () => {
    if (!folderName.trim()) { Alert.alert('Error', 'Please enter a folder name'); return; }
    setLoading(true);
    try {
      await lecturerService.createFolder(folderName, folderDescription, folderClassId);
      setShowCreateFolder(false); setFolderName(''); setFolderDescription(''); setFolderClassId(null);
      loadHome();
      Alert.alert('Success', 'Folder created successfully');
    } catch (error) { Alert.alert('Error', getErrorMessage(error, { context: 'LecturerDashboard' })); }
    finally { setLoading(false); }
  };

  const handleDeleteFolder = async (folder) => {
    const ok = await confirmNamed({
      title: `Delete ${folder.name}?`,
      message: `Delete the folder “${folder.name}”? Documents and quizzes inside it will be removed.`,
      confirmLabel: 'Delete folder',
    });
    if (!ok) return;
    setFolders((current) => current.filter((item) => item.id !== folder.id));
    offer({
      message: `${folder.name} deleted`,
      undo: () => setFolders((current) => [folder, ...current.filter((item) => item.id !== folder.id)]),
      commit: async () => {
        try {
          await lecturerService.deleteFolder(folder.id);
        } catch (error) {
          setFolders((current) => [folder, ...current.filter((item) => item.id !== folder.id)]);
          Alert.alert('Error', getErrorMessage(error, { context: 'LecturerDashboard' }));
        }
      },
    });
  };

  const copyCode = (code) => {
    Clipboard.setString(code);
    show(`${code} copied`);
  };

  const enrolled = classes.reduce((sum, item) => sum + (Number(item.student_count) || 0), 0);
  const actions = quickActions(navigation, lecturerService);
  const recent = [...classes]
    .filter((item) => item.created_at)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 3);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Page maxWidth={LECTURER_COLUMN}>
        <View style={[styles.titleRow, laptop && styles.titleRowDesktop]}>
          <View style={{ flex: 1 }}>
            <Heading level={1} style={{ marginTop: 8 }}>Lecturer</Heading>
            <Body variant="caption" style={{ marginTop: 4 }}>Manage classes, materials, and quizzes.</Body>
          </View>
          <View style={[styles.actionRow, laptop && styles.actionRowDesktop]}>
            <Button label="Post announcement" icon="bell" fit onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setAnnouncementClassId(null); setShowAnnouncement(true); }} />
            <Button label="New folder" variant="secondary" icon="plus" fit onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setFolderClassId(null); setShowCreateFolder(true); }} />
          </View>
        </View>

        {status === 'loading' ? (
          <View accessibilityRole="progressbar">
            <Skeleton height={88} radius={16} />
            <Skeleton height={72} radius={16} style={{ marginTop: 12 }} />
            <Skeleton height={120} radius={16} style={{ marginTop: 12 }} />
          </View>
        ) : null}

        {status === 'error' ? (
          <Glass strong style={styles.errorCard}>
            <Heading level={3}>Could not refresh your dashboard</Heading>
            <Body variant="caption" style={{ marginTop: 6, marginBottom: 12 }}>Check your connection and try again.</Body>
            <Button label="Try again" onPress={loadHome} />
          </Glass>
        ) : null}

        {status === 'ready' ? (
          <>
            <View style={styles.statRow}>
              <Stat label="Classes" value={classes.length} />
              <Stat label="Students" value={enrolled} />
              <Stat label="Folders" value={folders.length} />
            </View>

            <SectionHeader title="Quick actions" />
            <View style={styles.grid}>
              {actions.map((action) => (
                <TouchableOpacity key={action.label} onPress={action.onPress} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={action.label} style={[styles.gridItem, laptop && styles.gridItemDesktop]}>
                  <Glass strong style={styles.actionCard}>
                    <IconTile name={action.icon} tone={action.tone} />
                    <Text style={[{ color: theme.text, marginTop: 10, textAlign: 'center' }, font(theme, 'semibold')]}>{action.label}</Text>
                  </Glass>
                </TouchableOpacity>
              ))}
            </View>

            <SectionHeader title="Your classes" action="Manage" onAction={() => navigation.navigate('ClassManagement')} />
            {classes.length === 0 ? (
              <Glass strong style={styles.emptyCard}>
                <IconTile name="school" tone="teal" />
                <Body style={{ marginTop: 10, textAlign: 'center' }}>No classes yet. Create one so students can join with a code.</Body>
                <Button label="Create a class" fit style={{ marginTop: 12 }} onPress={() => navigation.navigate('ClassManagement')} />
              </Glass>
            ) : classes.map((item) => (
              <Glass key={item.id} strong style={styles.classCard}>
                <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }} onPress={() => navigation.navigate('ClassDetail', { classId: item.id })} accessibilityRole="button" accessibilityLabel={`Open ${item.name}`}>
                  <IconTile name="school" tone="teal" />
                  <View style={{ flex: 1 }}>
                    <Text style={[{ color: theme.text }, font(theme, 'h3')]}>{item.name}</Text>
                    <Body variant="caption">{plural(item.student_count || 0, 'student')}{item.join_code ? ` · ${item.join_code}` : ''}</Body>
                  </View>
                </TouchableOpacity>
                {item.join_code ? (
                  <TouchableOpacity
                    onPress={() => copyCode(item.join_code)}
                    accessibilityRole="button"
                    accessibilityLabel={`Copy code ${item.join_code}`}
                    style={styles.copyHit}
                  >
                    <Text style={[{ color: theme.primary }, font(theme, 'semibold')]}>Copy code</Text>
                  </TouchableOpacity>
                ) : <Badge label="No code" kind="neutral" />}
              </Glass>
            ))}

            <View style={{ height: 8 }} />
            <SectionHeader title="Your folders" />
            {folders.length === 0 ? (
              <Glass strong style={styles.emptyCard}>
                <IconTile name="folder" tone="blue" />
                <Body style={{ marginTop: 10, textAlign: 'center' }}>No folders yet. Create one to hold documents and quizzes.</Body>
              </Glass>
            ) : folders.map((folder) => (
              <Glass key={folder.id} strong style={styles.classCard}>
                <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate('FolderContent', { folder }); }} accessibilityRole="button" accessibilityLabel={`Open folder ${folder.name}`}>
                  <IconTile name="folder" tone="blue" />
                  <View style={{ flex: 1 }}>
                    <Text style={[{ color: theme.text }, font(theme, 'h3')]}>{folder.name}</Text>
                    {folder.description ? <Body variant="caption" numberOfLines={2}>{folder.description}</Body> : null}
                  </View>
                </TouchableOpacity>
                <ActionMenu
                  label={`Actions for ${folder.name}`}
                  items={[{ label: `Delete ${folder.name}`, destructive: true, onPress: () => handleDeleteFolder(folder) }]}
                />
              </Glass>
            ))}

            {phone ? (
              <>
                <View style={{ height: 8 }} />
                <SectionHeader title="Recent" />
                {recent.length === 0 ? (
                  <Glass strong style={styles.emptyCard}>
                    <Body style={{ textAlign: 'center' }}>Class activity will show up here.</Body>
                  </Glass>
                ) : recent.map((item) => (
                  <Glass key={item.id} strong style={styles.classCard}>
                    <IconTile name="school" tone="neutral" />
                    <View style={{ flex: 1 }}>
                      <Text style={[{ color: theme.text }, font(theme, 'h3')]}>{item.name} created</Text>
                      <Body variant="caption">{formatShortDate(item.created_at)} · {plural(item.student_count || 0, 'student')}</Body>
                    </View>
                  </Glass>
                ))}
              </>
            ) : null}
          </>
        ) : null}
      </Page>
      <ToastBanner toast={toast} />

      <Modal visible={showAnnouncement} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Post announcement</Text>
            <TextInput style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]} placeholder="Title" placeholderTextColor={MUTED} value={announcementTitle} onChangeText={setAnnouncementTitle} />
            <TextInput style={[styles.input, styles.textArea, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]} placeholder="Message to students..." placeholderTextColor={MUTED} value={announcementBody} onChangeText={setAnnouncementBody} multiline />
            <ClassScopePicker classes={classes} value={announcementClassId} onChange={setAnnouncementClassId} textColor={theme.text} mutedColor={theme.textSecondary} accent={theme.primary} />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.cancelBtn, { borderColor: theme.border }]} onPress={() => setShowAnnouncement(false)} accessibilityRole="button" accessibilityLabel="Cancel announcement">
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handlePostAnnouncement} disabled={loading} accessibilityRole="button" accessibilityLabel="Post announcement">
                <Text style={styles.saveBtnText}>{loading ? 'Posting...' : 'Post'}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => announcementTitle.trim() && Share.share({ message: `${announcementTitle}\n\n${announcementBody}` })} accessibilityRole="button" accessibilityLabel="Share announcement text">
              <Text style={[{ color: theme.primary, textAlign: 'center', marginTop: 8 }, font(theme, 'semibold')]}>Share text</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showCreateFolder} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Create new folder</Text>
            <TextInput style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]} placeholder="Folder Name" placeholderTextColor={MUTED} value={folderName} onChangeText={setFolderName} />
            <TextInput style={[styles.input, styles.textArea, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]} placeholder="Description (optional)" placeholderTextColor={MUTED} value={folderDescription} onChangeText={setFolderDescription} multiline />
            <ClassScopePicker classes={classes} value={folderClassId} onChange={setFolderClassId} textColor={theme.text} mutedColor={theme.textSecondary} accent={theme.primary} />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.cancelBtn, { borderColor: theme.border }]} onPress={() => setShowCreateFolder(false)} accessibilityRole="button" accessibilityLabel="Cancel new folder">
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleCreateFolder} disabled={loading} accessibilityRole="button" accessibilityLabel="Create folder">
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
  titleRow: { marginBottom: 20, gap: 16 },
  titleRowDesktop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  stat: { flex: 1, padding: 14, alignItems: 'flex-start', gap: 8 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end' },
  actionRowDesktop: { alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  gridItem: { width: '48%' },
  gridItemDesktop: { width: '31.5%' },
  actionCard: { alignItems: 'center', padding: 16, minHeight: 120, justifyContent: 'center' },
  classCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginBottom: 10 },
  copyHit: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  emptyCard: { alignItems: 'center', padding: 24, marginBottom: 16 },
  errorCard: { padding: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(11,27,58,0.45)', justifyContent: 'center', padding: 20 },
  modalCard: { borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12, fontSize: 14, fontWeight: '600', backgroundColor: BG, borderColor: BORDER, color: TEXT },
  textArea: { height: 80, textAlignVertical: 'top' },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 14, borderWidth: 1, alignItems: 'center', minHeight: 48 },
  cancelBtnText: { color: MUTED, fontWeight: '700' },
  saveBtn: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: BLUE, alignItems: 'center', minHeight: 48 },
  saveBtnText: { color: WHITE, fontWeight: '800' },
});

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, TextInput, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { lecturerService } from '../services/lecturerService';
import { useTheme } from '../context/ThemeContext';

export default function LecturerDashboardScreen({ navigation }) {
  const { theme } = useTheme();
  const [folders, setFolders] = useState([]);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderDescription, setFolderDescription] = useState('');
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadFolders();
  }, []);

  const loadFolders = async () => {
    try {
      const data = await lecturerService.getFolders();
      setFolders(data);
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleCreateFolder = async () => {
    if (!folderName.trim()) {
      Alert.alert('Error', 'Please enter a folder name');
      return;
    }
    setLoading(true);
    try {
      await lecturerService.createFolder(folderName, folderDescription);
      setShowCreateFolder(false);
      setFolderName('');
      setFolderDescription('');
      loadFolders();
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFolder = async (folderId) => {
    Alert.alert('Delete Folder', 'Are you sure? This will delete all content inside.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await lecturerService.deleteFolder(folderId);
            loadFolders();
          } catch (error) {
            Alert.alert('Error', error.message);
          }
        }
      }
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <LinearGradient colors={theme.gradient} style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Lecturer Dashboard</Text>
        <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Manage your learning materials</Text>
      </LinearGradient>

      <ScrollView style={styles.content}>
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.createButton} onPress={() => setShowCreateFolder(true)}>
            <LinearGradient colors={theme.primaryGradient} style={styles.createButtonGradient}>
              <Ionicons name="add-circle" size={24} color="#fff" />
              <Text style={styles.createButtonText}>Create New Folder</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: theme.card }]} 
            onPress={() => navigation.navigate('StudentProgress')}
          >
            <Ionicons name="people" size={24} color={theme.primary} />
            <Text style={[styles.actionButtonText, { color: theme.text }]}>Student Progress</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: theme.card }]} 
            onPress={() => navigation.navigate('ClassManagement')}
          >
            <Ionicons name="school" size={24} color={theme.primary} />
            <Text style={[styles.actionButtonText, { color: theme.text }]}>Class Management</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: theme.card }]} 
            onPress={async () => {
              // Get or create default folder
              const folders = await lecturerService.getFolders();
              let folderId = folders[0]?.id;
              
              if (!folderId) {
                const newFolder = await lecturerService.createFolder('General', 'General documents');
                folderId = newFolder.id;
              }
              
              navigation.navigate('ContentUpload', { folderId });
            }}
          >
            <Ionicons name="cloud-upload" size={24} color={theme.primary} />
            <Text style={[styles.actionButtonText, { color: theme.text }]}>Upload Content</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: theme.card }]} 
            onPress={async () => {
              const folders = await lecturerService.getFolders();
              let folderId = folders[0]?.id;
              
              if (!folderId) {
                const newFolder = await lecturerService.createFolder('General', 'General quizzes');
                folderId = newFolder.id;
              }
              
              navigation.navigate('QuizCreation', { folderId });
            }}
          >
            <Ionicons name="help-circle" size={24} color={theme.primary} />
            <Text style={[styles.actionButtonText, { color: theme.text }]}>Create Quiz</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.foldersContainer}>
          {folders.map((folder) => (
            <TouchableOpacity
              key={folder.id}
              style={[styles.folderCard, { backgroundColor: theme.card }]}
              onPress={() => navigation.navigate('FolderContent', { folder })}
            >
              <View style={styles.folderIcon}>
                <Ionicons name="folder" size={32} color={theme.primary} />
              </View>
              <View style={styles.folderInfo}>
                <Text style={[styles.folderName, { color: theme.text }]}>{folder.name}</Text>
                {folder.description && <Text style={[styles.folderDescription, { color: theme.textSecondary }]}>{folder.description}</Text>}
              </View>
              <TouchableOpacity onPress={() => handleDeleteFolder(folder.id)} style={styles.deleteButton}>
                <Ionicons name="trash" size={20} color="#EF4444" />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <Modal visible={showCreateFolder} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Create New Folder</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.borderLight, color: theme.text }]}
              placeholder="Folder Name"
              placeholderTextColor={theme.textTertiary}
              value={folderName}
              onChangeText={setFolderName}
            />
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: theme.borderLight, color: theme.text }]}
              placeholder="Description (optional)"
              placeholderTextColor={theme.textTertiary}
              value={folderDescription}
              onChangeText={setFolderDescription}
              multiline
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.cancelButton, { backgroundColor: theme.borderLight }]} onPress={() => setShowCreateFolder(false)}>
                <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitButton} onPress={handleCreateFolder} disabled={loading}>
                <LinearGradient colors={theme.primaryGradient} style={styles.submitButtonGradient}>
                  <Text style={styles.submitButtonText}>{loading ? 'Creating...' : 'Create'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { padding: 20, paddingTop: 40 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1F2937' },
  headerSubtitle: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  content: { flex: 1, padding: 16 },
  quickActions: { marginBottom: 20, gap: 12 },
  createButton: {},
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  createButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12 },
  createButtonText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  foldersContainer: { gap: 12 },
  folderCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  folderIcon: { marginRight: 12 },
  folderInfo: { flex: 1 },
  folderName: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  folderDescription: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  deleteButton: { padding: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16, color: '#1F2937' },
  input: { backgroundColor: '#F3F4F6', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16 },
  textArea: { height: 80, textAlignVertical: 'top' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelButton: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center' },
  cancelButtonText: { color: '#6B7280', fontWeight: '600' },
  submitButton: { flex: 1 },
  submitButtonGradient: { padding: 12, borderRadius: 8, alignItems: 'center' },
  submitButtonText: { color: '#fff', fontWeight: '600' }
});

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '../context/ThemeContext';
import { lecturerService } from '../services/lecturerService';

export default function ContentUploadScreen({ navigation, route }) {
  const { theme } = useTheme();
  const [folderId, setFolderId] = useState(route.params?.folderId);
  const [documents, setDocuments] = useState([]);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    initializeFolder();
  }, []);

  const initializeFolder = async () => {
    let currentFolderId = folderId;
    
    // If no valid folderId, get or create one
    if (!currentFolderId || currentFolderId === 'default') {
      try {
        const folders = await lecturerService.getFolders();
        if (folders.length > 0) {
          currentFolderId = folders[0].id;
        } else {
          const newFolder = await lecturerService.createFolder('General', 'General documents');
          currentFolderId = newFolder.id;
        }
        setFolderId(currentFolderId);
      } catch (error) {
        console.error('Folder init error:', error);
        Alert.alert('Error', 'Failed to initialize folder');
        return;
      }
    }
    
    loadDocuments(currentFolderId);
  };

  const loadDocuments = async (folderIdToUse = folderId) => {
    try {
      const data = await lecturerService.getDocuments(folderIdToUse);
      setDocuments(data);
    } catch (error) {
      console.error('Documents error:', error);
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const file = result.assets[0];
        setSelectedFile(file);
        setTitle(file.name.split('.')[0]);
        setShowUpload(true);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !title.trim()) {
      Alert.alert('Error', 'Please select a file and enter a title');
      return;
    }

    setLoading(true);
    setUploadProgress(0);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      await lecturerService.uploadDocument(folderId, selectedFile, title);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      setTimeout(() => {
        setShowUpload(false);
        setSelectedFile(null);
        setTitle('');
        setUploadProgress(0);
        loadDocuments();
        Alert.alert('Success', 'Document uploaded successfully');
      }, 500);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const getFileIcon = (fileType) => {
    if (fileType?.includes('pdf')) return 'document-text';
    if (fileType?.includes('image')) return 'image';
    if (fileType?.includes('video')) return 'videocam';
    if (fileType?.includes('audio')) return 'musical-notes';
    if (fileType?.includes('word') || fileType?.includes('doc')) return 'document';
    if (fileType?.includes('excel') || fileType?.includes('sheet')) return 'grid';
    if (fileType?.includes('powerpoint') || fileType?.includes('presentation')) return 'easel';
    return 'document-outline';
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderDocument = (doc) => (
    <View key={doc.id} style={[styles.documentCard, { backgroundColor: theme.card }]}>
      <View style={styles.documentHeader}>
        <View style={[styles.fileIcon, { backgroundColor: theme.primary + '20' }]}>
          <Ionicons name={getFileIcon(doc.file_type)} size={24} color={theme.primary} />
        </View>
        <View style={styles.documentInfo}>
          <Text style={[styles.documentTitle, { color: theme.text }]}>{doc.title}</Text>
          <Text style={[styles.fileName, { color: theme.textSecondary }]}>{doc.file_name}</Text>
          <Text style={[styles.fileSize, { color: theme.textTertiary }]}>
            {formatFileSize(doc.file_size)} • {new Date(doc.created_at).toLocaleDateString()}
          </Text>
        </View>
      </View>
      
      <View style={styles.documentActions}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.info + '20' }]}
          onPress={() => handleDownload(doc)}
        >
          <Ionicons name="download" size={16} color={theme.info} />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.error + '20' }]}
          onPress={() => handleDeleteDocument(doc.id)}
        >
          <Ionicons name="trash" size={16} color={theme.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const handleDownload = async (doc) => {
    try {
      const FileSystem = require('expo-file-system/legacy');
      const Sharing = require('expo-sharing');
      
      // Download file
      const fileUri = FileSystem.documentDirectory + doc.file_name;
      const downloadResult = await FileSystem.downloadAsync(doc.file_url, fileUri);
      
      // Share/Save file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(downloadResult.uri);
      } else {
        Alert.alert('Success', 'File downloaded to: ' + downloadResult.uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to download file');
    }
  };

  const handleDeleteDocument = (docId) => {
    Alert.alert('Delete Document', 'Are you sure you want to delete this document?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await lecturerService.deleteDocument(docId);
            loadDocuments();
            Alert.alert('Success', 'Document deleted');
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
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Content Upload</Text>
          <TouchableOpacity onPress={pickDocument}>
            <Ionicons name="add" size={24} color={theme.primary} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.uploadSection}>
        <TouchableOpacity style={styles.uploadButton} onPress={pickDocument}>
          <LinearGradient colors={theme.primaryGradient} style={styles.uploadButtonGradient}>
            <Ionicons name="cloud-upload" size={32} color="#fff" />
            <Text style={styles.uploadButtonText}>Upload New Document</Text>
            <Text style={styles.uploadSubtext}>PDF, DOC, PPT, Images, Videos</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statItem, { backgroundColor: theme.card }]}>
          <Text style={[styles.statNumber, { color: theme.primary }]}>{documents.length}</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Documents</Text>
        </View>
        <View style={[styles.statItem, { backgroundColor: theme.card }]}>
          <Text style={[styles.statNumber, { color: theme.success }]}>
            {formatFileSize(documents.reduce((acc, doc) => acc + (doc.file_size || 0), 0))}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Size</Text>
        </View>
      </View>

      <ScrollView style={styles.documentsContainer}>
        {documents.length > 0 ? (
          documents.map(renderDocument)
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="folder-open-outline" size={64} color={theme.textTertiary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              No documents uploaded yet
            </Text>
            <Text style={[styles.emptySubtext, { color: theme.textTertiary }]}>
              Tap the upload button to add your first document
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Upload Modal */}
      <Modal visible={showUpload} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Upload Document</Text>
            
            {selectedFile && (
              <View style={[styles.filePreview, { backgroundColor: theme.borderLight }]}>
                <Ionicons name={getFileIcon(selectedFile.mimeType)} size={32} color={theme.primary} />
                <View style={styles.fileDetails}>
                  <Text style={[styles.previewName, { color: theme.text }]}>{selectedFile.name}</Text>
                  <Text style={[styles.previewSize, { color: theme.textSecondary }]}>
                    {formatFileSize(selectedFile.size)}
                  </Text>
                </View>
              </View>
            )}

            <TextInput
              style={[styles.input, { backgroundColor: theme.borderLight, color: theme.text }]}
              placeholder="Document Title"
              placeholderTextColor={theme.textTertiary}
              value={title}
              onChangeText={setTitle}
            />

            {loading && (
              <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { backgroundColor: theme.borderLight }]}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { backgroundColor: theme.primary, width: `${uploadProgress}%` }
                    ]} 
                  />
                </View>
                <Text style={[styles.progressText, { color: theme.textSecondary }]}>
                  {uploadProgress}% uploaded
                </Text>
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.cancelButton, { backgroundColor: theme.borderLight }]}
                onPress={() => setShowUpload(false)}
                disabled={loading}
              >
                <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.uploadBtn}
                onPress={handleUpload}
                disabled={loading}
              >
                <LinearGradient colors={theme.primaryGradient} style={styles.uploadBtnGradient}>
                  <Text style={styles.uploadBtnText}>
                    {loading ? 'Uploading...' : 'Upload'}
                  </Text>
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
  container: { flex: 1 },
  header: { paddingTop: 50, paddingBottom: 20 },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  uploadSection: { padding: 16 },
  uploadButton: { marginBottom: 16 },
  uploadButtonGradient: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 16,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 8,
  },
  uploadSubtext: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statNumber: { fontSize: 18, fontWeight: 'bold' },
  statLabel: { fontSize: 12, marginTop: 4 },
  documentsContainer: { flex: 1, paddingHorizontal: 16 },
  documentCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  documentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  fileIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  documentInfo: { flex: 1 },
  documentTitle: { fontSize: 16, fontWeight: '600' },
  fileName: { fontSize: 14, marginTop: 2 },
  fileSize: { fontSize: 12, marginTop: 4 },
  documentActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtext: { fontSize: 14, marginTop: 8, textAlign: 'center' },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  filePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  fileDetails: { marginLeft: 12, flex: 1 },
  previewName: { fontSize: 14, fontWeight: '600' },
  previewSize: { fontSize: 12, marginTop: 2 },
  input: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  progressContainer: { marginBottom: 16 },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: '100%' },
  progressText: { fontSize: 12, marginTop: 8, textAlign: 'center' },
  modalButtons: { flexDirection: 'row', gap: 12 },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: { fontWeight: '600' },
  uploadBtn: { flex: 1 },
  uploadBtnGradient: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  uploadBtnText: { color: '#fff', fontWeight: '600' },
});
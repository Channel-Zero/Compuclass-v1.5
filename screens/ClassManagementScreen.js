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
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { lecturerService } from '../services/lecturerService';

export default function ClassManagementScreen({ navigation }) {
  const { theme } = useTheme();
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [showAssignStudents, setShowAssignStudents] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  const [className, setClassName] = useState('');
  const [classDescription, setClassDescription] = useState('');
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadClasses();
    loadStudents();
  }, []);

  const loadClasses = async () => {
    try {
      const data = await lecturerService.getClasses();
      setClasses(data);
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const loadStudents = async () => {
    try {
      const data = await lecturerService.getStudents();
      setStudents(data || []);
    } catch (error) {
      console.error('Students error:', error);
      setStudents([]);
    }
  };

  const handleCreateClass = async () => {
    if (!className.trim()) {
      Alert.alert('Error', 'Please enter a class name');
      return;
    }
    setLoading(true);
    try {
      await lecturerService.createClass(className, classDescription);
      setShowCreateClass(false);
      setClassName('');
      setClassDescription('');
      loadClasses();
      Alert.alert('Success', 'Class created successfully');
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignStudents = async () => {
    if (selectedStudents.length === 0) {
      Alert.alert('Error', 'Please select at least one student');
      return;
    }
    setLoading(true);
    try {
      await lecturerService.assignStudentsToClass(selectedClass.id, selectedStudents);
      setShowAssignStudents(false);
      setSelectedStudents([]);
      loadClasses();
      Alert.alert('Success', 'Students assigned successfully');
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleStudentSelection = (studentId) => {
    setSelectedStudents(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const renderClassCard = ({ item }) => (
    <View style={[styles.classCard, { backgroundColor: theme.card }]}>
      <View style={styles.classHeader}>
        <View style={[styles.classIcon, { backgroundColor: theme.primary + '20' }]}>
          <Ionicons name="school" size={24} color={theme.primary} />
        </View>
        <View style={styles.classInfo}>
          <Text style={[styles.className, { color: theme.text }]}>{item.name}</Text>
          <Text style={[styles.classDescription, { color: theme.textSecondary }]}>
            {item.description || 'No description'}
          </Text>
          <Text style={[styles.studentCount, { color: theme.textTertiary }]}>
            {item.student_count || 0} students
          </Text>
        </View>
      </View>
      
      <View style={styles.classActions}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: theme.primary + '20' }]}
          onPress={() => {
            setSelectedClass(item);
            setShowAssignStudents(true);
          }}
        >
          <Ionicons name="person-add" size={16} color={theme.primary} />
          <Text style={[styles.actionText, { color: theme.primary }]}>Assign</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: theme.info + '20' }]}
          onPress={() => navigation.navigate('ClassDetail', { classId: item.id })}
        >
          <Ionicons name="eye" size={16} color={theme.info} />
          <Text style={[styles.actionText, { color: theme.info }]}>View</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStudentItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.studentItem,
        { 
          backgroundColor: selectedStudents.includes(item.id) ? theme.primary + '20' : theme.borderLight,
          borderColor: selectedStudents.includes(item.id) ? theme.primary : 'transparent'
        }
      ]}
      onPress={() => toggleStudentSelection(item.id)}
    >
      <View style={[styles.studentAvatar, { backgroundColor: theme.primary }]}>
        <Text style={styles.avatarText}>
          {item.full_name?.charAt(0)?.toUpperCase() || 'S'}
        </Text>
      </View>
      <View style={styles.studentDetails}>
        <Text style={[styles.studentName, { color: theme.text }]}>
          {item.full_name || 'Unknown Student'}
        </Text>
        <Text style={[styles.studentEmail, { color: theme.textSecondary }]}>
          {item.email}
        </Text>
      </View>
      {selectedStudents.includes(item.id) && (
        <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <LinearGradient colors={theme.gradient} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Class Management</Text>
          <TouchableOpacity onPress={() => setShowCreateClass(true)}>
            <Ionicons name="add" size={24} color={theme.primary} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.statNumber, { color: theme.primary }]}>{classes.length}</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Classes</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.statNumber, { color: theme.success }]}>{students.length}</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Students</Text>
        </View>
      </View>

      <FlatList
        data={classes}
        renderItem={renderClassCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.classList}
        showsVerticalScrollIndicator={false}
      />

      {/* Create Class Modal */}
      <Modal visible={showCreateClass} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Create New Class</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.borderLight, color: theme.text }]}
              placeholder="Class Name"
              placeholderTextColor={theme.textTertiary}
              value={className}
              onChangeText={setClassName}
            />
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: theme.borderLight, color: theme.text }]}
              placeholder="Description (optional)"
              placeholderTextColor={theme.textTertiary}
              value={classDescription}
              onChangeText={setClassDescription}
              multiline
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.cancelButton, { backgroundColor: theme.borderLight }]}
                onPress={() => setShowCreateClass(false)}
              >
                <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.createButton} onPress={handleCreateClass} disabled={loading}>
                <LinearGradient colors={theme.primaryGradient} style={styles.createButtonGradient}>
                  <Text style={styles.createButtonText}>{loading ? 'Creating...' : 'Create'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Assign Students Modal */}
      <Modal visible={showAssignStudents} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.assignModal, { backgroundColor: theme.card }]}>
            <View style={styles.assignHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Assign Students to {selectedClass?.name}
              </Text>
              <TouchableOpacity onPress={() => setShowAssignStudents(false)}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            
            {students.length === 0 ? (
              <View style={styles.emptyStudents}>
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  No students found. Create student accounts first.
                </Text>
              </View>
            ) : (
              <FlatList
                data={students}
                renderItem={renderStudentItem}
                keyExtractor={(item) => item.id}
                style={styles.studentsList}
              />
            )}
            
            <View style={styles.assignFooter}>
              <Text style={[styles.selectedCount, { color: theme.textSecondary }]}>
                {selectedStudents.length} students selected
              </Text>
              <TouchableOpacity
                style={styles.assignButton}
                onPress={handleAssignStudents}
                disabled={loading || selectedStudents.length === 0}
              >
                <LinearGradient colors={theme.primaryGradient} style={styles.assignButtonGradient}>
                  <Text style={styles.assignButtonText}>
                    {loading ? 'Assigning...' : 'Assign Students'}
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
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statNumber: { fontSize: 24, fontWeight: 'bold' },
  statLabel: { fontSize: 12, marginTop: 4 },
  classList: { paddingHorizontal: 16 },
  classCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  classHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  classIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  classInfo: { flex: 1 },
  className: { fontSize: 16, fontWeight: '600' },
  classDescription: { fontSize: 14, marginTop: 2 },
  studentCount: { fontSize: 12, marginTop: 4 },
  classActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  actionText: { fontSize: 12, fontWeight: '600' },
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
  input: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  modalButtons: { flexDirection: 'row', gap: 12 },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: { fontWeight: '600' },
  createButton: { flex: 1 },
  createButtonGradient: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  createButtonText: { color: '#fff', fontWeight: '600' },
  assignModal: {
    borderRadius: 16,
    maxHeight: '80%',
  },
  assignHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  studentsList: { maxHeight: 300, padding: 20 },
  studentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  studentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  studentDetails: { flex: 1 },
  studentName: { fontSize: 14, fontWeight: '600' },
  studentEmail: { fontSize: 12, marginTop: 2 },
  assignFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  selectedCount: { fontSize: 14, marginBottom: 12 },
  assignButton: {},
  assignButtonGradient: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  assignButtonText: { color: '#fff', fontWeight: '600' },
  emptyStudents: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
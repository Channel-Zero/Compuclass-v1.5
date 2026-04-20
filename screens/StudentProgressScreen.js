import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
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
//Student progress screen for lecturer to view student progress and add students to class. Progress data is loaded from Supabase and displayed in a list of student cards. Each card shows student's name, email, quizzes completed, average score, materials viewed and last activity. Lecturer can tap on a student card to view more details in a modal. Lecturer can also add new students by entering their email in a modal form.
export default function StudentProgressScreen({ navigation }) {
  const { theme } = useTheme();
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [studentEmail, setStudentEmail] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [progressData, setProgressData] = useState({});

  const loadData = async () => {
    await loadStudents();
    await loadProgressData();
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadStudents = async () => {
    try {
      const data = await lecturerService.getStudents();
      setStudents(data);
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const loadProgressData = async () => {
    try {
      const data = await lecturerService.getStudentProgress();
      setProgressData(data);
    } catch (error) {
      console.error('Progress data error:', error);
    }
  };

  const handleAddStudent = async () => {
    if (!studentEmail.trim()) {
      Alert.alert('Error', 'Please enter student email');
      return;
    }
    setLoading(true);
    try {
      await lecturerService.addStudent(studentEmail);
      setShowAddStudent(false);
      setStudentEmail('');
      loadStudents();
      Alert.alert('Success', 'Student added successfully');
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(student =>
    student.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getProgressStats = (studentId) => {
    const progress = progressData[studentId] || {};
    return {
      quizzesCompleted: progress.quizzesCompleted || 0,
      averageScore: progress.averageScore || 0,
      materialsViewed: progress.materialsViewed || 0,
      lastActivity: progress.lastActivity || 'Never'
    };
  };

  const renderStudentCard = ({ item }) => {
    const stats = getProgressStats(item.id);
    
    return (
      <TouchableOpacity
        style={[styles.studentCard, { backgroundColor: theme.card }]}
        onPress={() => setSelectedStudent(item)}
      >
        <View style={styles.studentHeader}>
          <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
            <Text style={styles.avatarText}>
              {item.full_name?.charAt(0)?.toUpperCase() || 'S'}
            </Text>
          </View>
          <View style={styles.studentInfo}>
            <Text style={[styles.studentName, { color: theme.text }]}>
              {item.full_name || 'Unknown Student'}
            </Text>
            <Text style={[styles.studentEmail, { color: theme.textSecondary }]}>
              {item.email}
            </Text>
          </View>
          <View style={styles.progressIndicator}>
            <Text style={[styles.scoreText, { color: theme.primary }]}>
              {stats.averageScore}%
            </Text>
          </View>
        </View>
        
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="checkmark-circle" size={16} color={theme.success} />
            <Text style={[styles.statText, { color: theme.textSecondary }]}>
              {stats.quizzesCompleted} Quizzes
            </Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="document-text" size={16} color={theme.info} />
            <Text style={[styles.statText, { color: theme.textSecondary }]}>
              {stats.materialsViewed} Materials
            </Text>
          </View>
        </View>
        
        <Text style={[styles.lastActivity, { color: theme.textTertiary }]}>
          Last active: {stats.lastActivity}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <LinearGradient colors={theme.gradient} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Student Progress</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={loadData}>
              <Ionicons name="refresh" size={24} color={theme.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowAddStudent(true)}>
              <Ionicons name="person-add" size={24} color={theme.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.searchContainer}>
        <View style={[styles.searchBox, { backgroundColor: theme.card }]}>
          <Ionicons name="search" size={20} color={theme.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search students..."
            placeholderTextColor={theme.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <View style={styles.statsOverview}>
        <View style={[styles.overviewCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.overviewNumber, { color: theme.primary }]}>
            {students.length}
          </Text>
          <Text style={[styles.overviewLabel, { color: theme.textSecondary }]}>
            Total Students
          </Text>
        </View>
        <View style={[styles.overviewCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.overviewNumber, { color: theme.success }]}>
            {Math.round(Object.values(progressData).reduce((acc, p) => acc + (p.averageScore || 0), 0) / Math.max(Object.keys(progressData).length, 1))}%
          </Text>
          <Text style={[styles.overviewLabel, { color: theme.textSecondary }]}>
            Class Average
          </Text>
        </View>
      </View>

      <FlatList
        data={filteredStudents}
        renderItem={renderStudentCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.studentsList}
        showsVerticalScrollIndicator={false}
      />

      {/* Add Student Modal */}
      <Modal visible={showAddStudent} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Add Student</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.borderLight, color: theme.text }]}
              placeholder="Student Email"
              placeholderTextColor={theme.textTertiary}
              value={studentEmail}
              onChangeText={setStudentEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.cancelButton, { backgroundColor: theme.borderLight }]}
                onPress={() => setShowAddStudent(false)}
              >
                <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addButton}
                onPress={handleAddStudent}
                disabled={loading}
              >
                <LinearGradient colors={theme.primaryGradient} style={styles.addButtonGradient}>
                  <Text style={styles.addButtonText}>
                    {loading ? 'Adding...' : 'Add Student'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Student Detail Modal */}
      <Modal visible={!!selectedStudent} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.detailModal, { backgroundColor: theme.card }]}>
            <View style={styles.detailHeader}>
              <Text style={[styles.detailTitle, { color: theme.text }]}>
                {selectedStudent?.full_name || 'Student Details'}
              </Text>
              <TouchableOpacity onPress={() => setSelectedStudent(null)}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            
            {selectedStudent && (
              <ScrollView style={styles.detailContent}>
                <View style={styles.detailSection}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Contact Info</Text>
                  <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                    {selectedStudent.email}
                  </Text>
                </View>
                
                <View style={styles.detailSection}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Progress Summary</Text>
                  {(() => {
                    const stats = getProgressStats(selectedStudent.id);
                    return (
                      <View style={styles.progressDetails}>
                        <View style={styles.progressItem}>
                          <Text style={[styles.progressLabel, { color: theme.textSecondary }]}>
                            Quizzes Completed
                          </Text>
                          <Text style={[styles.progressValue, { color: theme.text }]}>
                            {stats.quizzesCompleted}
                          </Text>
                        </View>
                        <View style={styles.progressItem}>
                          <Text style={[styles.progressLabel, { color: theme.textSecondary }]}>
                            Average Score
                          </Text>
                          <Text style={[styles.progressValue, { color: theme.primary }]}>
                            {stats.averageScore}%
                          </Text>
                        </View>
                        <View style={styles.progressItem}>
                          <Text style={[styles.progressLabel, { color: theme.textSecondary }]}>
                            Materials Viewed
                          </Text>
                          <Text style={[styles.progressValue, { color: theme.text }]}>
                            {stats.materialsViewed}
                          </Text>
                        </View>
                      </View>
                    );
                  })()}
                </View>
              </ScrollView>
            )}
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
  searchContainer: { padding: 16 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 16 },
  statsOverview: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  overviewCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  overviewNumber: { fontSize: 24, fontWeight: 'bold' },
  overviewLabel: { fontSize: 12, marginTop: 4 },
  studentsList: { paddingHorizontal: 16 },
  studentCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  studentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#fff', fontWeight: 'bold' },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 16, fontWeight: '600' },
  studentEmail: { fontSize: 14, marginTop: 2 },
  progressIndicator: { alignItems: 'center' },
  scoreText: { fontSize: 18, fontWeight: 'bold' },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: { fontSize: 12 },
  lastActivity: { fontSize: 12 },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  input: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  modalButtons: { flexDirection: 'row', gap: 12 },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: { fontWeight: '600' },
  addButton: { flex: 1 },
  addButtonGradient: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: { color: '#fff', fontWeight: '600' },
  detailModal: {
    borderRadius: 16,
    maxHeight: '80%',
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  detailTitle: { fontSize: 18, fontWeight: 'bold' },
  detailContent: { padding: 20 },
  detailSection: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  detailText: { fontSize: 14 },
  progressDetails: { gap: 12 },
  progressItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: { fontSize: 14 },
  progressValue: { fontSize: 14, fontWeight: '600' },
});
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { lecturerService } from '../services/lecturerService';

export default function ClassDetailScreen({ navigation, route }) {
  const { theme } = useTheme();
  const { classId } = route.params;
  const [classData, setClassData] = useState(null);
  const [students, setStudents] = useState([]);

  useEffect(() => {
    loadClassDetail();
  }, []);

  const loadClassDetail = async () => {
    try {
      console.log('Loading class detail for:', classId);
      const data = await lecturerService.getClassDetail(classId);
      console.log('Class detail loaded:', data);
      setClassData(data.class);
      setStudents(data.students);
    } catch (error) {
      console.error('Class detail error:', error);
      Alert.alert('Error', error.message);
    }
  };

  const handleRemoveStudent = (studentId) => {
    Alert.alert('Remove Student', 'Remove this student from the class?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            console.log('Removing student:', studentId, 'from class:', classId);
            await lecturerService.removeStudentFromClass(classId, studentId);
            loadClassDetail();
            Alert.alert('Success', 'Student removed');
          } catch (error) {
            console.error('Remove student error:', error);
            Alert.alert('Error', error.message);
          }
        }
      }
    ]);
  };

  if (!classData) {
    return (
      <View style={[styles.container, { backgroundColor: theme.surface }]}>
        <Text style={[styles.loading, { color: theme.text }]}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <LinearGradient colors={theme.gradient} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Class Details</Text>
          <View style={{ width: 24 }} />
        </View>
      </LinearGradient>

      <ScrollView style={styles.content}>
        <View style={[styles.classHeader, { backgroundColor: theme.card }]}>
          <View style={[styles.classIcon, { backgroundColor: theme.primary }]}>
            <Ionicons name="school" size={32} color="#fff" />
          </View>
          <Text style={[styles.className, { color: theme.text }]}>{classData.name}</Text>
          {classData.description && (
            <Text style={[styles.classDescription, { color: theme.textSecondary }]}>
              {classData.description}
            </Text>
          )}
          <View style={styles.classMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="people" size={16} color={theme.primary} />
              <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                {students.length} Students
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="calendar" size={16} color={theme.primary} />
              <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                Created {new Date(classData.created_at).toLocaleDateString()}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.studentsSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Enrolled Students</Text>
          
          {students.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: theme.card }]}>
              <Ionicons name="person-add-outline" size={48} color={theme.textTertiary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No students enrolled yet
              </Text>
              <Text style={[styles.emptySubtext, { color: theme.textTertiary }]}>
                Use the Assign button to add students
              </Text>
            </View>
          ) : (
            students.map((student) => (
              <View key={student.id} style={[styles.studentCard, { backgroundColor: theme.card }]}>
                <View style={[styles.studentAvatar, { backgroundColor: theme.primary }]}>
                  <Text style={styles.avatarText}>
                    {student.full_name?.charAt(0)?.toUpperCase() || 'S'}
                  </Text>
                </View>
                <View style={styles.studentInfo}>
                  <Text style={[styles.studentName, { color: theme.text }]}>
                    {student.full_name || 'Unknown Student'}
                  </Text>
                  <Text style={[styles.studentMeta, { color: theme.textSecondary }]}>
                    Joined {new Date(student.joined_at).toLocaleDateString()}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => handleRemoveStudent(student.id)}
                >
                  <Ionicons name="close-circle" size={24} color={theme.error} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>
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
  loading: { textAlign: 'center', marginTop: 50, fontSize: 16 },
  content: { flex: 1 },
  classHeader: {
    padding: 24,
    margin: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  classIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  className: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  classDescription: { fontSize: 14, textAlign: 'center', marginBottom: 16 },
  classMeta: { flexDirection: 'row', gap: 16 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12 },
  studentsSection: { paddingHorizontal: 16, paddingBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  studentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 16, fontWeight: '600' },
  studentMeta: { fontSize: 12, marginTop: 2 },
  removeButton: { padding: 4 },
  emptyState: {
    padding: 40,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyText: { fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptySubtext: { fontSize: 14, marginTop: 4, textAlign: 'center' },
});
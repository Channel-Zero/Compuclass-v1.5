import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Modal, TextInput, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { lecturerService } from '../services/lecturerService';
import { getErrorMessage } from '../utils/errorMessages';

const BLUE = '#2563EB'; const YELLOW = '#FACC15'; const GREEN = '#22C55E'; const PURPLE = '#8B5CF6';
const WHITE = '#FFFFFF'; const BG = '#F3F4F6'; const TEXT = '#111827'; const MUTED = '#4B5563'; const BORDER = '#E5E7EB';

export default function ClassManagementScreen({ navigation }) {
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [showAssignStudents, setShowAssignStudents] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  const [className, setClassName] = useState('');
  const [classDescription, setClassDescription] = useState('');
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadClasses(); loadStudents(); }, []);

  const loadClasses = async () => {
    try { const data = await lecturerService.getClasses(); setClasses(data); }
    catch (error) { Alert.alert('Error', getErrorMessage(error, { context: 'ClassManagement' })); }
  };

  const loadStudents = async () => {
    try { const data = await lecturerService.getStudents(); setStudents(data || []); }
    catch { setStudents([]); }
  };

  const handleCreateClass = async () => {
    if (!className.trim()) { Alert.alert('Error', 'Please enter a class name'); return; }
    setLoading(true);
    try {
      await lecturerService.createClass(className, classDescription);
      setShowCreateClass(false); setClassName(''); setClassDescription('');
      loadClasses(); Alert.alert('Success', 'Class created successfully');
    } catch (error) { Alert.alert('Error', getErrorMessage(error, { context: 'ClassManagement' })); }
    finally { setLoading(false); }
  };

  const handleAssignStudents = async () => {
    if (selectedStudents.length === 0) { Alert.alert('Error', 'Please select at least one student'); return; }
    setLoading(true);
    try {
      await lecturerService.assignStudentsToClass(selectedClass.id, selectedStudents);
      setShowAssignStudents(false); setSelectedStudents([]);
      loadClasses(); Alert.alert('Success', 'Students assigned successfully');
    } catch (error) { Alert.alert('Error', getErrorMessage(error, { context: 'ClassManagement' })); }
    finally { setLoading(false); }
  };

  const toggleStudent = (id) => setSelectedStudents((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);

  const renderClass = ({ item }) => (
    <View style={styles.classCard}>
      <View style={styles.classTop}>
        <View style={styles.classIconWrap}>
          <Ionicons name="school" size={20} color={WHITE} />
        </View>
        <View style={styles.classInfo}>
          <Text style={styles.className}>{item.name}</Text>
          <Text style={styles.classDesc}>{item.description || 'No description'}</Text>
          <Text style={styles.studentCount}>{item.student_count || 0} students enrolled</Text>
        </View>
      </View>
      <View style={styles.classActions}>
        <TouchableOpacity style={styles.assignBtn} onPress={() => { setSelectedClass(item); setShowAssignStudents(true); }} activeOpacity={0.75}>
          <Ionicons name="person-add" size={14} color={WHITE} />
          <Text style={styles.assignBtnText}>Assign</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.viewBtn} onPress={() => navigation.navigate('ClassDetail', { classId: item.id })} activeOpacity={0.75}>
          <Ionicons name="eye" size={14} color={BLUE} />
          <Text style={styles.viewBtnText}>View</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStudent = ({ item }) => (
    <TouchableOpacity
      style={[styles.studentItem, selectedStudents.includes(item.id) && styles.studentItemSelected]}
      onPress={() => toggleStudent(item.id)} activeOpacity={0.75}
    >
      <View style={[styles.studentAvatar, selectedStudents.includes(item.id) && { backgroundColor: BLUE }]}>
        <Text style={styles.avatarText}>{item.full_name?.charAt(0)?.toUpperCase() || 'S'}</Text>
      </View>
      <View style={styles.studentDetails}>
        <Text style={styles.studentName}>{item.full_name || 'Unknown Student'}</Text>
        <Text style={styles.studentEmail}>{item.email}</Text>
      </View>
      {selectedStudents.includes(item.id) && <Ionicons name="checkmark-circle" size={22} color={BLUE} />}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={[PURPLE, '#7C3AED']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={WHITE} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Class Management</Text>
        <TouchableOpacity onPress={() => setShowCreateClass(true)} style={styles.addBtn} accessibilityRole="button" accessibilityLabel="Create class">
          <Ionicons name="add" size={22} color={WHITE} />
        </TouchableOpacity>
      </LinearGradient>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderLeftColor: BLUE }]}>
          <Text style={[styles.statValue, { color: BLUE }]}>{classes.length}</Text>
          <Text style={styles.statLabel}>Total Classes</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: GREEN }]}>
          <Text style={[styles.statValue, { color: GREEN }]}>{students.length}</Text>
          <Text style={styles.statLabel}>Total Students</Text>
        </View>
      </View>

      <FlatList
        data={classes}
        renderItem={renderClass}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="school" size={36} color={WHITE} />
            </View>
            <Text style={styles.emptyText}>No classes yet. Tap + to create one.</Text>
          </View>
        }
      />

      <Modal visible={showCreateClass} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create New Class 🏫</Text>
            <TextInput style={styles.input} placeholder="Class Name" placeholderTextColor={MUTED} value={className} onChangeText={setClassName} />
            <TextInput style={[styles.input, styles.textArea]} placeholder="Description (optional)" placeholderTextColor={MUTED} value={classDescription} onChangeText={setClassDescription} multiline />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreateClass(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleCreateClass} disabled={loading}>
                <Text style={styles.saveBtnText}>{loading ? 'Creating...' : 'Create'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showAssignStudents} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.assignModal}>
            <View style={styles.assignHeader}>
              <Text style={styles.modalTitle}>Assign to {selectedClass?.name}</Text>
              <TouchableOpacity onPress={() => setShowAssignStudents(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={MUTED} />
              </TouchableOpacity>
            </View>
            {students.length === 0
              ? <Text style={[styles.emptyText, { padding: 20 }]}>No students found.</Text>
              : <FlatList data={students} renderItem={renderStudent} keyExtractor={(item) => item.id} style={styles.studentsList} />}
            <View style={styles.assignFooter}>
              <Text style={styles.selectedCount}>{selectedStudents.length} selected</Text>
              <TouchableOpacity style={[styles.saveBtn, { flex: 1 }]} onPress={handleAssignStudents} disabled={loading || selectedStudents.length === 0}>
                <Text style={styles.saveBtnText}>{loading ? 'Assigning...' : 'Assign Students'}</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16, gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '900', color: WHITE },
  addBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', padding: 16, gap: 12 },
  statCard: { flex: 1, backgroundColor: WHITE, borderRadius: 14, padding: 16, alignItems: 'center', borderLeftWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  statValue: { fontSize: 26, fontWeight: '900' },
  statLabel: { fontSize: 12, color: MUTED, marginTop: 4, fontWeight: '600' },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  classCard: { backgroundColor: WHITE, borderRadius: 16, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  classTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  classIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: PURPLE, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  classInfo: { flex: 1 },
  className: { fontSize: 15, fontWeight: '800', color: TEXT },
  classDesc: { fontSize: 12, color: MUTED, marginTop: 2 },
  studentCount: { fontSize: 11, color: MUTED, marginTop: 3, fontWeight: '600' },
  classActions: { flexDirection: 'row', gap: 8 },
  assignBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: GREEN, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, gap: 5 },
  assignBtnText: { fontSize: 12, fontWeight: '800', color: WHITE },
  viewBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: BLUE, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, gap: 5 },
  viewBtnText: { fontSize: 12, fontWeight: '800', color: BLUE },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyIconWrap: { width: 68, height: 68, borderRadius: 20, backgroundColor: PURPLE, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyText: { fontSize: 13, color: MUTED, fontWeight: '500', textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: WHITE, borderRadius: 20, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 },
  modalTitle: { fontSize: 17, fontWeight: '900', color: TEXT, marginBottom: 18 },
  input: { backgroundColor: BG, borderWidth: 2, borderColor: BORDER, borderRadius: 12, padding: 12, marginBottom: 12, fontSize: 14, color: TEXT, fontWeight: '600' },
  textArea: { height: 80, textAlignVertical: 'top' },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: BORDER, alignItems: 'center' },
  cancelBtnText: { color: MUTED, fontWeight: '700' },
  saveBtn: { padding: 14, borderRadius: 12, backgroundColor: BLUE, alignItems: 'center' },
  saveBtnText: { color: WHITE, fontWeight: '800' },
  assignModal: { backgroundColor: WHITE, borderRadius: 20, maxHeight: '80%', overflow: 'hidden' },
  assignHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: BORDER },
  closeBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  studentsList: { maxHeight: 300, padding: 16 },
  studentItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: BG, borderWidth: 2, borderColor: BORDER, borderRadius: 12, padding: 12, marginBottom: 8 },
  studentItemSelected: { borderColor: BLUE, backgroundColor: BLUE + '08' },
  studentAvatar: { width: 36, height: 36, borderRadius: 12, backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { color: TEXT, fontSize: 14, fontWeight: '900' },
  studentDetails: { flex: 1 },
  studentName: { fontSize: 13, fontWeight: '700', color: TEXT },
  studentEmail: { fontSize: 11, color: MUTED, marginTop: 2 },
  assignFooter: { flexDirection: 'row', alignItems: 'center', padding: 16, borderTopWidth: 1, borderTopColor: BORDER, gap: 12 },
  selectedCount: { fontSize: 13, color: MUTED, fontWeight: '600' },
});

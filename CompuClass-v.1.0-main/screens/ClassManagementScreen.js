import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Modal, TextInput, ActivityIndicator, Clipboard } from 'react-native';
import { lecturerService } from '../services/lecturerService';
import { getErrorMessage } from '../utils/errorMessages';
import { plural } from '../utils/quizFlow';
import { useTheme } from '../context/ThemeContext';
import {
  Page, Heading, Body, Glass, Badge, Button, IconTile, Avatar, initials, font, IconButton,
} from '../components/ui/kit';
import { LECTURER_COLUMN, ScreenHeading, ToastBanner, useUndoToast } from '../components/lecturerChrome';

export default function ClassManagementScreen({ navigation }) {
  const { theme } = useTheme();
  const { toast, show } = useUndoToast();
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [showAssignStudents, setShowAssignStudents] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  const [className, setClassName] = useState('');
  const [classDescription, setClassDescription] = useState('');
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('loading');
  const [studentError, setStudentError] = useState(false);
  const loadRef = useRef(() => {});

  const loadClasses = async () => {
    try {
      const data = await lecturerService.getClasses();
      setClasses(data || []);
      setStatus('ready');
    } catch (error) {
      setStatus('error');
      Alert.alert('Error', getErrorMessage(error, { context: 'ClassManagement' }));
    }
  };

  const loadClassRoster = async (item) => {
    setSelectedClass(item);
    setSelectedStudents([]);
    setStudents([]);
    setStudentError(false);
    setShowAssignStudents(true);
    try {
      const data = await lecturerService.getClassStudents(item.id);
      setStudents(data || []);
    } catch {
      setStudents([]);
      setStudentError(true);
    }
  };

  const loadAll = () => { loadClasses(); };
  loadRef.current = loadAll;
  useEffect(() => { loadRef.current(); }, []);

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
  const enrolled = classes.reduce((sum, item) => sum + (Number(item.student_count) || 0), 0);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Page maxWidth={LECTURER_COLUMN}>
        <ScreenHeading
          navigation={navigation}
          title="Classes"
          subtitle="Create a class and share its code"
          trailing={<IconButton name="plus" label="Create class" onPress={() => setShowCreateClass(true)} />}
        />

        <View style={styles.statRow}>
          <Glass strong radius={16} style={styles.stat}>
            <Text style={[{ fontSize: 28, color: theme.text }, font(theme, 'h1')]}>{classes.length}</Text>
            <Badge label="Classes" kind="neutral" />
          </Glass>
          <Glass strong radius={16} style={styles.stat}>
            <Text style={[{ fontSize: 28, color: theme.text }, font(theme, 'h1')]}>{enrolled}</Text>
            <Badge label="Students" kind="neutral" />
          </Glass>
        </View>

        {status === 'loading' && classes.length === 0 ? (
          <View style={styles.empty} accessibilityRole="progressbar">
            <ActivityIndicator size="large" color={theme.primary} />
            <Body variant="caption" style={{ marginTop: 8 }}>Loading classes</Body>
          </View>
        ) : null}
        {status === 'error' && classes.length === 0 ? (
          <Glass strong style={styles.emptyCard} accessibilityRole="alert">
            <Heading level={3}>Could not load classes</Heading>
            <Button label="Try again" fit style={{ marginTop: 12 }} onPress={loadAll} />
          </Glass>
        ) : null}
        {status === 'ready' && classes.length === 0 ? (
          <Glass strong style={styles.emptyCard}>
            <IconTile name="school" tone="teal" />
            <Body style={{ marginTop: 10, textAlign: 'center' }}>No classes yet. Create one so students can join with a code.</Body>
          </Glass>
        ) : null}
        {classes.map((item) => (
          <Glass key={item.id} strong style={styles.classCard}>
            <View style={styles.classTop}>
              <IconTile name="school" tone="teal" />
              <View style={{ flex: 1 }}>
                <Text style={[{ color: theme.text }, font(theme, 'h3')]}>{item.name}</Text>
                <Body variant="caption">{item.description || 'No description'}</Body>
                <Body variant="caption">{plural(item.student_count || 0, 'student')} enrolled</Body>
              </View>
            </View>
            {item.join_code ? (
              <TouchableOpacity
                onPress={() => { Clipboard.setString(item.join_code); show(`${item.join_code} copied`); }}
                accessibilityRole="button"
                accessibilityLabel={`Copy code ${item.join_code}`}
                style={styles.copyHit}
              >
                <Text style={[{ color: theme.primary }, font(theme, 'semibold')]}>Copy code {item.join_code}</Text>
              </TouchableOpacity>
            ) : null}
            <View style={styles.classActions}>
              <Button label="Assign" variant="secondary" fit onPress={() => loadClassRoster(item)} accessibilityLabel={`Assign students to ${item.name}`} />
              <Button label="View" variant="secondary" fit onPress={() => navigation.navigate('ClassDetail', { classId: item.id })} accessibilityLabel={`View ${item.name}`} />
            </View>
          </Glass>
        ))}
      </Page>
      <ToastBanner toast={toast} />

      <Modal visible={showCreateClass} animationType="slide" transparent onRequestClose={() => setShowCreateClass(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <Glass strong radius={24} style={styles.modalCard}>
            <Heading level={2}>Create class</Heading>
            <TextInput style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]} placeholder="Class Name" placeholderTextColor={theme.textTertiary} value={className} onChangeText={setClassName} />
            <TextInput style={[styles.input, styles.textArea, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]} placeholder="Description (optional)" placeholderTextColor={theme.textTertiary} value={classDescription} onChangeText={setClassDescription} multiline />
            <View style={styles.modalBtns}>
              <Button label="Cancel" variant="secondary" fit onPress={() => setShowCreateClass(false)} />
              <Button label={loading ? 'Creating...' : 'Create'} fit onPress={handleCreateClass} disabled={loading} />
            </View>
          </Glass>
        </View>
      </Modal>

      <Modal visible={showAssignStudents} animationType="slide" transparent onRequestClose={() => setShowAssignStudents(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <Glass strong radius={24} style={styles.assignModal}>
            <View style={styles.assignHeader}>
              <Heading level={2}>Assign to {selectedClass?.name}</Heading>
              <IconButton name="close" label="Close" onPress={() => setShowAssignStudents(false)} />
            </View>
            {studentError ? (
              <Body style={{ padding: 16 }}>Could not load the student directory. Close this and try again.</Body>
            ) : students.length === 0 ? (
              <Body style={{ padding: 16 }}>No students in this class yet. They appear here after they join with the class code.</Body>
            ) : students.map((item) => {
              const selected = selectedStudents.includes(item.id);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.studentItem, { borderColor: selected ? theme.primary : theme.border }]}
                  onPress={() => toggleStudent(item.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${selected ? 'Deselect' : 'Select'} ${item.full_name || 'student'}`}
                >
                  <Avatar label={initials(item.full_name)} tone={selected ? 'blue' : 'neutral'} />
                  <View style={{ flex: 1 }}>
                    <Text style={[{ color: theme.text }, font(theme, 'semibold')]}>{item.full_name || 'Unknown student'}</Text>
                    {item.email ? <Body variant="caption">{item.email}</Body> : null}
                  </View>
                  {selected ? <Badge label="Selected" kind="neutral" /> : null}
                </TouchableOpacity>
              );
            })}
            <View style={styles.assignFooter}>
              <Body variant="caption">{plural(selectedStudents.length, 'student')} selected</Body>
              <Button label={loading ? 'Assigning...' : 'Assign students'} fit onPress={handleAssignStudents} disabled={loading || selectedStudents.length === 0} />
            </View>
          </Glass>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  stat: { flex: 1, padding: 14, alignItems: 'flex-start', gap: 8 },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyCard: { alignItems: 'center', padding: 24, marginBottom: 16 },
  classCard: { padding: 16, marginBottom: 12 },
  classTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  copyHit: { minHeight: 44, justifyContent: 'center', marginTop: 8 },
  classActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  modalOverlay: { flex: 1, justifyContent: 'center', padding: 20 },
  modalCard: { padding: 24 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 12, fontSize: 15 },
  textArea: { height: 80, textAlignVertical: 'top' },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 16 },
  assignModal: { padding: 16, maxHeight: '80%' },
  assignHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  studentItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  assignFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 8 },
});

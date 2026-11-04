import React, { useState, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, Modal, TextInput, Linking, ScrollView,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { lecturerService } from '../services/lecturerService';
import { getErrorMessage } from '../utils/errorMessages';
import { classAverageCaption, formatShortDate, plural, summarizeClassProgress } from '../utils/quizFlow';
import {
  Page, Heading, Body, Glass, Badge, Button, IconButton, Avatar, initials, Field, font,
} from '../components/ui/kit';
import { LECTURER_COLUMN, ScreenHeading, ToastBanner, useUndoToast } from '../components/lecturerChrome';

export default function StudentProgressScreen({ navigation }) {
  const { theme } = useTheme();
  const { toast, show } = useUndoToast();
  const [classes, setClasses] = useState([]);
  const [roster, setRoster] = useState({});
  const [classFilter, setClassFilter] = useState('all');
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [studentEmail, setStudentEmail] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [progressData, setProgressData] = useState({});
  const [status, setStatus] = useState('loading');
  const [attempts, setAttempts] = useState([]);
  const [attemptsStatus, setAttemptsStatus] = useState('idle');

  const loadData = async () => {
    setStatus((current) => (current === 'ready' ? 'ready' : 'loading'));
    try {
      const classList = await lecturerService.getClasses();
      const entries = await Promise.all((classList || []).map(async (item) => {
        const enrolled = await lecturerService.getClassStudents(item.id);
        return [item.id, enrolled || []];
      }));
      const nextRoster = Object.fromEntries(entries);
      setClasses(classList || []);
      setRoster(nextRoster);
      setSelectedClassId((current) => current || classList?.[0]?.id || null);
      setStatus('ready');
      lecturerService.getStudents().then((people) => {
        const byId = new Map((people || []).map((student) => [student.id, student]));
        setRoster((current) => {
          const next = {};
          Object.entries(current).forEach(([classId, list]) => {
            next[classId] = (list || []).map((student) => ({
              ...student,
              email: byId.get(student.id)?.email || student.email || '',
              full_name: student.full_name || byId.get(student.id)?.full_name,
            }));
          });
          return next;
        });
      }).catch(() => {});
      const ids = [...new Set(Object.values(nextRoster).flat().map((student) => student?.id).filter(Boolean))];
      const progress = await lecturerService.getStudentProgress(ids);
      setProgressData(progress || {});
    } catch (error) {
      setStatus('error');
      Alert.alert('Error', getErrorMessage(error, { context: 'StudentProgress' }));
    }
  };
  const loadDataRef = useRef(loadData);
  loadDataRef.current = loadData;

  useFocusEffect(useCallback(() => { loadDataRef.current(); }, []));

  const handleAddStudent = async () => {
    if (!studentEmail.trim()) {
      Alert.alert('Error', 'Please enter student email');
      return;
    }
    if (!selectedClassId) {
      Alert.alert('Error', 'Create a class before adding a student');
      return;
    }
    setLoading(true);
    try {
      await lecturerService.addStudent(studentEmail, selectedClassId);
      setShowAddStudent(false);
      setStudentEmail('');
      await loadData();
      show('Student enrolled');
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error, { context: 'StudentProgress' }));
    } finally {
      setLoading(false);
    }
  };

  const openStudent = async (student) => {
    setSelectedStudent(student);
    setAttempts([]);
    setAttemptsStatus('loading');
    try {
      const detail = await lecturerService.getStudentDetail(student.id);
      setAttempts(detail?.quizAttempts || []);
      setAttemptsStatus('ready');
    } catch (error) {
      console.error('Student quiz history error:', error);
      setAttemptsStatus('error');
    }
  };

  const enrolledStudents = () => {
    const source = classFilter === 'all'
      ? Object.values(roster).flat()
      : (roster[classFilter] || []);
    const seen = new Set();
    return source.filter((student) => {
      if (!student?.id || seen.has(student.id)) return false;
      seen.add(student.id);
      return true;
    });
  };

  const visibleStudents = enrolledStudents().filter((student) =>
    student.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredProgress = () => {
    const slice = {};
    enrolledStudents().forEach((student) => {
      slice[student.id] = progressData[student.id] || { quizzesCompleted: 0, averageScore: null };
    });
    return slice;
  };

  const summary = summarizeClassProgress(filteredProgress());
  const statsFor = (studentId) => progressData[studentId] || {
    quizzesCompleted: 0, averageScore: null, materialsViewed: 0, lastActivity: null,
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Page maxWidth={LECTURER_COLUMN}>
        <ScreenHeading
          navigation={navigation}
          title="Student progress"
          subtitle="Enrolled students and quiz scores"
          trailing={(
            <>
              <IconButton name="refresh" label="Refresh student list" onPress={loadData} />
              <IconButton name="plus" label="Add student" onPress={() => setShowAddStudent(true)} />
            </>
          )}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {[{ id: 'all', name: 'All classes' }, ...classes].map((item) => {
            const selected = classFilter === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => setClassFilter(item.id)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Show ${item.name}`}
                style={[styles.filterChip, { backgroundColor: selected ? theme.primary : 'rgba(255,255,255,0.70)', borderColor: 'rgba(255,255,255,0.8)' }]}
              >
                <Text style={[{ color: selected ? '#fff' : theme.text, fontSize: 14 }, font(theme, 'semibold')]}>{item.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={[styles.searchBox, { borderColor: theme.border }]}>
          <TextInput
            style={[{ flex: 1, fontSize: 16, color: theme.text, minHeight: 44 }, font(theme, 'body')]}
            placeholder="Search students"
            placeholderTextColor={theme.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            accessibilityLabel="Search students"
          />
        </View>

        <View style={styles.statRow}>
          <Glass strong radius={16} style={styles.stat}>
            <Text style={[{ fontSize: 28, color: theme.text }, font(theme, 'h1')]}>{enrolledStudents().length}</Text>
            <Badge label="Students" kind="neutral" />
          </Glass>
          <Glass strong radius={16} style={styles.stat}>
            <Text style={[{ fontSize: 28, color: theme.text }, font(theme, 'h1')]}>{summary.average == null ? '—' : `${summary.average}%`}</Text>
            <Badge label="Average" kind="neutral" />
            <Body variant="caption">{classAverageCaption(summary)}</Body>
          </Glass>
        </View>

        {status === 'loading' ? (
          <Body variant="caption" accessibilityRole="progressbar">Loading students</Body>
        ) : null}
        {status === 'error' ? (
          <Glass strong style={styles.emptyCard} accessibilityRole="alert">
            <Heading level={3}>Could not load student progress</Heading>
            <Button label="Try again" fit style={{ marginTop: 12 }} onPress={loadData} />
          </Glass>
        ) : null}
        {status === 'ready' && visibleStudents.length === 0 ? (
          <Glass strong style={styles.emptyCard}>
            <Heading level={3}>{searchQuery ? 'No students match that search' : 'No students in this class'}</Heading>
            <Body variant="caption" style={{ marginTop: 6, textAlign: 'center' }}>
              {searchQuery ? 'Try a different name or email.' : 'Students appear here after they join with the class code.'}
            </Body>
          </Glass>
        ) : null}
        {status === 'ready' ? visibleStudents.map((item) => {
          const stats = statsFor(item.id);
          const attempted = (stats.quizzesCompleted || 0) > 0 && stats.averageScore != null;
          return (
            <TouchableOpacity key={item.id} onPress={() => openStudent(item)} accessibilityRole="button" accessibilityLabel={`Open ${item.full_name || 'student'}`}>
              <Glass strong style={styles.studentCard}>
                <View style={styles.studentHeader}>
                  <Avatar label={initials(item.full_name)} />
                  <View style={{ flex: 1 }}>
                    <Text style={[{ color: theme.text }, font(theme, 'h3')]}>{item.full_name || 'Unknown student'}</Text>
                    <Body variant="caption">{item.email}</Body>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[{ fontSize: 18, color: attempted ? theme.text : 'rgba(11,27,58,0.65)' }, font(theme, 'h2')]}>
                      {attempted ? `${stats.averageScore}%` : 'No attempts'}
                    </Text>
                    <Body variant="caption">{attempted ? 'Average' : 'Quiz average'}</Body>
                  </View>
                </View>
                <Body variant="caption">
                  {plural(stats.quizzesCompleted || 0, 'quiz')} · {plural(stats.materialsViewed || 0, 'material')}
                </Body>
                <Body variant="caption">Last active: {stats.lastActivity || 'Never'}</Body>
              </Glass>
            </TouchableOpacity>
          );
        }) : null}
      </Page>
      <ToastBanner toast={toast} />

      <Modal visible={showAddStudent} animationType="fade" transparent onRequestClose={() => setShowAddStudent(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <Glass strong radius={24} style={styles.modalCard}>
            <Heading level={2}>Enrol student</Heading>
            <Body variant="caption" style={{ marginTop: 6, marginBottom: 12 }}>The student needs a CompuClass account. Pick the class they should join.</Body>
            <ScrollView style={{ maxHeight: 160 }}>
              {classes.length === 0 ? (
                <Body variant="caption">No classes yet. Create one from Classes first.</Body>
              ) : classes.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => setSelectedClassId(item.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedClassId === item.id }}
                  accessibilityLabel={item.name}
                  style={[styles.classOption, { borderColor: selectedClassId === item.id ? theme.primary : theme.border }]}
                >
                  <Text style={[{ color: theme.text }, font(theme, 'semibold')]}>{item.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Field label="Email" icon="mail" value={studentEmail} onChangeText={setStudentEmail} placeholder="name@school.edu" keyboardType="email-address" autoCapitalize="none" />
            <View style={styles.modalBtns}>
              <Button label="Cancel" variant="secondary" fit onPress={() => setShowAddStudent(false)} />
              <Button label={loading ? 'Adding...' : 'Add student'} fit onPress={handleAddStudent} disabled={loading} />
            </View>
          </Glass>
        </View>
      </Modal>

      <Modal visible={!!selectedStudent} animationType="fade" transparent onRequestClose={() => setSelectedStudent(null)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <Glass strong radius={24} style={styles.detailCard}>
            <View style={styles.assignHeader}>
              <Heading level={2}>{selectedStudent?.full_name || 'Student'}</Heading>
              <IconButton name="close" label="Close student details" onPress={() => setSelectedStudent(null)} />
            </View>
            {selectedStudent ? (
              <ScrollView>
                {selectedStudent.email ? (
                  <TouchableOpacity
                    onPress={() => Linking.openURL(`mailto:${selectedStudent.email}`).catch(() => Alert.alert('Error', 'No email app is available on this device.'))}
                    accessibilityRole="link"
                    accessibilityLabel={`Email ${selectedStudent.email}`}
                    style={styles.emailLink}
                  >
                    <Text style={[{ color: theme.primary }, font(theme, 'semibold')]}>{selectedStudent.email}</Text>
                  </TouchableOpacity>
                ) : <Body variant="caption">No email on file</Body>}
                {(() => {
                  const stats = statsFor(selectedStudent.id);
                  const attempted = (stats.quizzesCompleted || 0) > 0 && stats.averageScore != null;
                  return (
                    <View style={{ marginTop: 12, gap: 8 }}>
                      <Body variant="caption">{plural(stats.quizzesCompleted || 0, 'quiz')} completed</Body>
                      <Body variant="caption">{attempted ? `${stats.averageScore}% average` : 'No attempts'}</Body>
                      <Body variant="caption">{plural(stats.materialsViewed || 0, 'material')} viewed</Body>
                    </View>
                  );
                })()}
                <Heading level={3} style={{ marginTop: 16, marginBottom: 8 }}>Quiz results</Heading>
                {attemptsStatus === 'loading' ? <Body variant="caption">Loading quiz results</Body> : null}
                {attemptsStatus === 'error' ? <Body variant="caption">Quiz history could not be loaded.</Body> : null}
                {attemptsStatus === 'ready' && attempts.length === 0 ? <Body variant="caption">No quiz attempts yet.</Body> : null}
                {attempts.map((attempt) => (
                  <View key={attempt.id || `${attempt.quiz_id}-${attempt.completed_at}`} style={styles.resultRow}>
                    <Text style={[{ flex: 1, color: theme.text }, font(theme, 'body')]}>{attempt.quizzes?.title || 'Quiz'}</Text>
                    <Text style={[{ width: 108, textAlign: 'right', color: 'rgba(11,27,58,0.65)', fontSize: 13 }, font(theme, 'medium')]}>
                      {formatShortDate(attempt.completed_at)}
                    </Text>
                    <Text style={[{ width: 52, textAlign: 'right', color: theme.text }, font(theme, 'semibold')]}>{attempt.score}%</Text>
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </Glass>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  filters: { gap: 8, paddingBottom: 12 },
  filterChip: { minHeight: 44, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  searchBox: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, marginBottom: 12, backgroundColor: 'rgba(255,255,255,0.70)' },
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  stat: { flex: 1, padding: 14, alignItems: 'flex-start', gap: 8 },
  emptyCard: { alignItems: 'center', padding: 24, marginBottom: 16 },
  studentCard: { padding: 16, marginBottom: 10, gap: 6 },
  studentHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modalOverlay: { flex: 1, justifyContent: 'center', padding: 20 },
  modalCard: { padding: 20 },
  modalBtns: { flexDirection: 'row', gap: 12 },
  classOption: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, marginBottom: 8 },
  detailCard: { padding: 20, maxHeight: '80%' },
  assignHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  emailLink: { minHeight: 44, justifyContent: 'center' },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 },
});

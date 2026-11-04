import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Alert, Share, Clipboard, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { lecturerService } from '../services/lecturerService';
import { classService } from '../services/classService';
import { getErrorMessage } from '../utils/errorMessages';
import { formatShortDate, plural } from '../utils/quizFlow';
import {
  Page, Heading, Body, Glass, Button, IconTile, Avatar, initials, Skeleton, font,
} from '../components/ui/kit';
import {
  ActionMenu, LECTURER_COLUMN, ScreenHeading, ToastBanner, confirmNamed, useUndoToast,
} from '../components/lecturerChrome';

export default function ClassDetailScreen({ navigation, route }) {
  const { theme } = useTheme();
  const { toast, offer, show } = useUndoToast();
  const { classId } = route.params;
  const [classData, setClassData] = useState(null);
  const [students, setStudents] = useState([]);
  const [status, setStatus] = useState('loading');
  const loadClassDetailRef = useRef(() => {});

  useEffect(() => {
    loadClassDetailRef.current();
  }, []);

  const loadClassDetail = async () => {
    setStatus('loading');
    try {
      const data = await lecturerService.getClassDetail(classId);
      setClassData(data.class);
      setStudents(data.students);
      setStatus('ready');
    } catch (error) {
      console.error('Class detail error:', error);
      setStatus('error');
      Alert.alert('Error', getErrorMessage(error, { context: 'ClassDetail' }));
    }
  };
  loadClassDetailRef.current = loadClassDetail;

  const handleRemoveStudent = async (student) => {
    const name = student.full_name || 'this student';
    const ok = await confirmNamed({
      title: `Remove ${name}?`,
      message: `Remove ${name} from ${classData?.name || 'this class'}? They can join again with the class code.`,
      confirmLabel: 'Remove student',
    });
    if (!ok) return;
    setStudents((current) => current.filter((item) => item.id !== student.id));
    offer({
      message: `${name} removed`,
      undo: () => setStudents((current) => [student, ...current.filter((item) => item.id !== student.id)]),
      commit: async () => {
        try {
          await lecturerService.removeStudentFromClass(classId, student.id);
        } catch (error) {
          setStudents((current) => [student, ...current.filter((item) => item.id !== student.id)]);
          Alert.alert('Error', getErrorMessage(error, { context: 'ClassDetail' }));
        }
      },
    });
  };

  const handleNewCode = async () => {
    if (!classData?.join_code) return;
    const previous = classData.join_code;
    const ok = await confirmNamed({
      title: `New code for ${classData.name}?`,
      message: `${previous} will stop working. Students need the new code to join ${classData.name}.`,
      confirmLabel: 'New code',
    });
    if (!ok) return;
    try {
      const next = await classService.regenerateClassCode(classId);
      setClassData((current) => ({ ...current, join_code: next }));
      offer({
        message: `${previous} no longer works`,
        undo: async () => {
          try {
            const restored = await classService.restoreClassCode(classId, previous);
            setClassData((current) => ({ ...current, join_code: restored }));
            show(`${restored} restored`);
          } catch (error) {
            Alert.alert('Error', getErrorMessage(error, { context: 'ClassDetail' }));
          }
        },
      });
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error, { context: 'ClassDetail' }));
    }
  };

  const handleDeleteClass = async () => {
    const name = classData?.name || 'this class';
    const ok = await confirmNamed({
      title: `Delete ${name}?`,
      message: 'This removes the class, its enrolments, and quiz assignments. This cannot be undone.',
      confirmLabel: 'Delete class',
    });
    if (!ok) return;
    try {
      await lecturerService.deleteClass(classId);
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error, { context: 'ClassDetail' }));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Page maxWidth={LECTURER_COLUMN}>
        <ScreenHeading
          navigation={navigation}
          title="Class details"
          subtitle="Enrolment and join code"
          trailing={classData ? (
            <ActionMenu
              label={`Actions for ${classData.name}`}
              items={[
                { label: `New code for ${classData.name}`, destructive: true, onPress: handleNewCode },
                { label: `Delete ${classData.name}`, destructive: true, onPress: handleDeleteClass },
              ]}
            />
          ) : null}
        />
        {status === 'loading' ? (
          <View accessibilityRole="progressbar">
            <Skeleton height={180} radius={24} />
            <Skeleton height={72} radius={16} style={{ marginTop: 12 }} />
          </View>
        ) : null}
        {status === 'error' ? (
          <Glass strong style={styles.card}>
            <Heading level={3}>Could not load this class</Heading>
            <Button label="Try again" fit style={{ marginTop: 12 }} onPress={loadClassDetail} />
          </Glass>
        ) : null}
        {status === 'ready' && classData ? (
          <>
            <Glass strong style={styles.card}>
              <IconTile name="school" tone="teal" size={56} />
              <Heading level={2} style={{ marginTop: 12, textAlign: 'center' }}>{classData.name}</Heading>
              {classData.description ? (
                <Body variant="caption" style={{ marginTop: 6, textAlign: 'center' }}>{classData.description}</Body>
              ) : null}
              <Body variant="caption" style={{ marginTop: 16 }}>Class code</Body>
              <Text
                style={[{ color: theme.text, fontSize: 28, letterSpacing: 3, marginTop: 4 }, font(theme, 'h1')]}
                accessibilityLabel={`Class code ${classData.join_code || 'not available'}`}
              >
                {classData.join_code || 'Not available yet'}
              </Text>
              {classData.join_code ? (
                <View style={styles.codeActions}>
                  <Button label="Copy code" fit onPress={() => { Clipboard.setString(classData.join_code); show(`${classData.join_code} copied`); }} />
                  <Button
                    label="Share"
                    variant="secondary"
                    fit
                    onPress={() => Share.share({ message: `Join my CompuClass class ${classData.name} with code ${classData.join_code}` })}
                  />
                </View>
              ) : null}
              <Body variant="caption" style={{ marginTop: 16 }}>
                {plural(students.length, 'student')} enrolled · Created {formatShortDate(classData.created_at)}
              </Body>
            </Glass>

            <Heading level={2} style={{ marginBottom: 12 }}>Enrolled students</Heading>
            {students.length === 0 ? (
              <Glass strong style={styles.card}>
                <IconTile name="user" tone="neutral" />
                <Body style={{ marginTop: 10, textAlign: 'center' }}>No students enrolled yet</Body>
                <Body variant="caption" style={{ marginTop: 4, textAlign: 'center' }}>Share the class code, or assign students from Class management.</Body>
              </Glass>
            ) : students.map((student) => (
              <Glass key={student.id} strong style={styles.studentCard}>
                <Avatar label={initials(student.full_name)} />
                <View style={{ flex: 1 }}>
                  <Text style={[{ color: theme.text }, font(theme, 'h3')]}>{student.full_name || 'Unknown student'}</Text>
                  <Body variant="caption">Joined {formatShortDate(student.joined_at)}</Body>
                </View>
                <Button
                  label="Remove"
                  variant="secondary"
                  fit
                  accessibilityLabel={`Remove ${student.full_name || 'student'}`}
                  onPress={() => handleRemoveStudent(student)}
                />
              </Glass>
            ))}
          </>
        ) : null}
      </Page>
      <ToastBanner toast={toast} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', padding: 24, marginBottom: 20 },
  codeActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16, justifyContent: 'center', alignItems: 'center' },
  studentCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginBottom: 10 },
});

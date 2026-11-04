import React, { useState } from 'react';
import { Text, View } from 'react-native';
import Sidebar from '../components/Sidebar';
import Windows11SimulatorScreen from '../screens/Windows11SimulatorScreen';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { supabase } from '../config/supabase';
import { authService } from '../services/authService';
import { lecturerService } from '../services/lecturerService';
import { classService } from '../services/classService';
import { progressFromAttempts } from '../utils/quizFlow';
import LecturerDashboardScreen from '../screens/LecturerDashboardScreen';
import ClassManagementScreen from '../screens/ClassManagementScreen';
import ClassDetailScreen from '../screens/ClassDetailScreen';
import StudentProgressScreen from '../screens/StudentProgressScreen';
import QuizCreationScreen from '../screens/QuizCreationScreen';
import QuizDetailScreen from '../screens/QuizDetailScreen';
import QuizAnalyticsScreen from '../screens/QuizAnalyticsScreen';
import ContentUploadScreen from '../screens/ContentUploadScreen';
import FolderContentScreen from '../screens/FolderContentScreen';
import QuizScreen from '../screens/QuizScreen';

// Local screenshot and design check. It stays off unless the web bundle was
// built with EXPO_PUBLIC_SCREEN_PREVIEW=1 and the URL has ?preview=.
// The data below is dummy and never comes from Supabase.

export function isScreenPreview() {
  return process.env.EXPO_PUBLIC_SCREEN_PREVIEW === '1'
    && typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).has('preview');
}

const NOW = '2026-10-12T09:00:00.000Z';

const CLASS_ROWS = [
  { id: 'class-ict', name: 'ICT Grade 11', description: 'Hardware, software, and networks', join_code: 'AB23CD', created_at: '2026-02-02T08:00:00.000Z' },
  { id: 'class-net', name: 'Networking 101', description: 'OSI model and IP addresses', join_code: 'K7PQ2M', created_at: '2026-03-11T08:00:00.000Z' },
];

const FOLDERS = [
  { id: 'folder-hw', name: 'Hardware notes', description: 'CPU, RAM, storage, and the motherboard' },
  { id: 'folder-quiz', name: 'Quiz bank', description: 'Practice questions for the term' },
];

const STUDENTS = [
  { id: 'student-1', full_name: 'Thandi Nkosi', email: 'thandi@example.com' },
  { id: 'student-2', full_name: 'Liam Jacobs', email: 'liam@example.com' },
  { id: 'student-3', full_name: 'Aisha Patel', email: 'aisha@example.com' },
  { id: 'student-4', full_name: 'Sipho Dlamini', email: 'sipho@example.com' },
];

const ENROLLMENTS = [
  { class_id: 'class-ict', student_id: 'student-1', joined_at: '2026-02-03T08:00:00.000Z' },
  { class_id: 'class-ict', student_id: 'student-2', joined_at: '2026-02-04T08:00:00.000Z' },
  { class_id: 'class-ict', student_id: 'student-3', joined_at: '2026-02-10T08:00:00.000Z' },
  { class_id: 'class-net', student_id: 'student-4', joined_at: '2026-03-12T08:00:00.000Z' },
];

const CLASSES = CLASS_ROWS.map((item) => ({
  ...item,
  student_count: ENROLLMENTS.filter((row) => row.class_id === item.id).length,
}));

const QUIZZES = [
  { id: 'quiz-cpu', title: 'CPU and memory', description: 'How the processor uses RAM', passing_score: 70, created_at: '2026-10-01T09:00:00.000Z', question_count: 2, quiz_questions: [{}, {}] },
  { id: 'quiz-net', title: 'Networking basics', description: 'Addresses, switches, and the OSI model', passing_score: 60, created_at: '2026-10-05T09:00:00.000Z', question_count: 1, quiz_questions: [{}] },
];

const QUESTIONS = [
  { id: 'q1', quiz_id: 'quiz-cpu', question: 'Which part stores the data the CPU is using right now?', options: ['Power supply', 'RAM', 'GPU', 'Hard drive'], correct_answer: 'RAM', order_index: 0, time_limit_seconds: 30, difficulty: 'easy' },
  { id: 'q2', quiz_id: 'quiz-cpu', question: 'What does CPU stand for?', options: ['Computer Personal Unit', 'Core Program Utility', 'Central Processing Unit', 'Control Power Unit'], correct_answer: 'Central Processing Unit', order_index: 1, time_limit_seconds: null, difficulty: 'medium' },
];

const ATTEMPTS = [
  { id: 'attempt-1', quiz_id: 'quiz-net', user_id: 'student-1', score: 80, completed_at: NOW, quizzes: { title: 'Networking basics' } },
  { id: 'attempt-2', quiz_id: 'quiz-cpu', user_id: 'student-2', score: 90, completed_at: '2026-10-11T09:00:00.000Z', quizzes: { title: 'CPU and memory' } },
  { id: 'attempt-3', quiz_id: 'quiz-cpu', user_id: 'student-3', score: 45, completed_at: '2026-10-02T09:00:00.000Z', quizzes: { title: 'CPU and memory' } },
];

const MATERIALS = { 'student-1': 2, 'student-2': 3, 'student-3': 1, 'student-4': 0 };

function studentsIn(classId) {
  return ENROLLMENTS.filter((row) => row.class_id === classId).map((row) => {
    const student = STUDENTS.find((person) => person.id === row.student_id);
    return { id: row.student_id, full_name: student?.full_name, email: student?.email, joined_at: row.joined_at };
  });
}

function progressMap() {
  const progress = {};
  STUDENTS.forEach((student) => {
    progress[student.id] = progressFromAttempts(
      ATTEMPTS.filter((attempt) => attempt.user_id === student.id),
      MATERIALS[student.id] || 0,
    );
  });
  return progress;
}

function query(rows) {
  const state = { rows: rows.slice() };
  const builder = {
    select() { return builder; },
    eq(column, value) {
      state.rows = state.rows.filter((row) => row[column] === value);
      return builder;
    },
    in(column, values) {
      state.rows = state.rows.filter((row) => values.includes(row[column]));
      return builder;
    },
    order() { return builder; },
    single() {
      return Promise.resolve({ data: state.rows[0] || null, error: state.rows[0] ? null : { message: 'not found' } });
    },
    insert() { return Promise.resolve({ error: null }); },
    then(resolve, reject) {
      return Promise.resolve({ data: state.rows, error: null }).then(resolve, reject);
    },
  };
  return builder;
}

const TABLES = {
  class_students: ENROLLMENTS,
  quiz_assignments: [
    { quiz_id: 'quiz-cpu', class_id: 'class-ict' },
    { quiz_id: 'quiz-net', class_id: 'class-ict' },
  ],
  quizzes: QUIZZES,
  quiz_attempts: ATTEMPTS,
  quiz_questions: QUESTIONS,
  profiles: STUDENTS.map((student) => ({ id: student.id, full_name: student.full_name })),
  documents: [
    { id: 'doc-1', title: 'Motherboard diagram', file_name: 'motherboard.pdf', file_type: 'application/pdf', file_size: 240000, created_at: NOW, file_url: 'lecturer/motherboard.pdf', folder_id: 'folder-hw' },
  ],
  announcements: [],
};

let installed = false;

export function installPreviewData() {
  if (installed) return;
  installed = true;
  authService.getCurrentUser = async () => ({
    id: 'student-1',
    profile: { role: 'student', full_name: 'Thandi Nkosi' },
  });
  supabase.from = (table) => query(TABLES[table] || []);
  supabase.rpc = async (name) => {
    if (name === 'get_quiz_questions_for_attempt') {
      return {
        data: QUESTIONS.map(({ correct_answer, ...question }) => question),
        error: null,
      };
    }
    if (name === 'submit_quiz_attempt') {
      return {
        data: {
          score: 50,
          passed: false,
          correct_count: 1,
          total_questions: 2,
          xp_earned: 15,
          xp_attempt_value: 15,
          xp_previous_best: 0,
          is_personal_best: true,
          max_combo: 1,
          current_streak: 3,
          leveled_up: false,
          new_level: 2,
          new_badges: [],
          review: [
            { question_id: 'q1', question: QUESTIONS[0].question, selected_answer: 'RAM', is_correct: true, correct_answer: 'RAM' },
            { question_id: 'q2', question: QUESTIONS[1].question, selected_answer: 'Computer Personal Unit', is_correct: false, correct_answer: 'Central Processing Unit' },
          ],
        },
        error: null,
      };
    }
    return { data: [], error: null };
  };

  lecturerService.getFolders = async () => FOLDERS;
  lecturerService.getClasses = async () => CLASSES;
  lecturerService.getStudents = async () => STUDENTS;
  lecturerService.getDocuments = async () => TABLES.documents;
  lecturerService.getQuizzes = async () => QUIZZES;
  lecturerService.getClassStudents = async (classId) => studentsIn(classId || 'class-ict');
  lecturerService.getClassDetail = async (classId) => ({
    class: CLASSES.find((item) => item.id === classId) || CLASSES[0],
    students: studentsIn(classId || 'class-ict'),
  });
  lecturerService.getStudentProgress = async () => progressMap();
  lecturerService.getStudentDetail = async (studentId) => ({
    student: STUDENTS.find((student) => student.id === studentId),
    quizAttempts: ATTEMPTS.filter((attempt) => attempt.user_id === studentId),
  });
  lecturerService.getQuizDetail = async () => ({
    id: 'quiz-cpu',
    title: 'CPU and memory',
    passing_score: 70,
    quiz_questions: QUESTIONS,
  });
  lecturerService.getQuizAnalytics = async () => ({
    quizzes: [
      {
        id: 'quiz-cpu',
        title: 'CPU and memory',
        passing_score: 70,
        questions: [
          { id: 'q1', question: 'Which part stores the data the CPU is using right now?', topic: 'Memory', order_index: 0 },
          { id: 'q2', question: 'What does CPU stand for?', topic: '', order_index: 1 },
        ],
        attempts: [
          {
            id: 'attempt-cpu-1',
            user_id: 'student-1',
            full_name: 'Thandi Nkosi',
            score: 50,
            completed_at: '2026-10-02T09:00:00.000Z',
            answers: [
              { question_id: 'q1', is_correct: true, selected: 'RAM', correct: 'RAM' },
              { question_id: 'q2', is_correct: false, selected: 'Computer Personal Unit', correct: 'Central Processing Unit' },
            ],
          },
          {
            id: 'attempt-cpu-2',
            user_id: 'student-1',
            full_name: 'Thandi Nkosi',
            score: 100,
            completed_at: '2026-10-12T09:00:00.000Z',
            answers: [
              { question_id: 'q1', is_correct: true, selected: 'RAM', correct: 'RAM' },
              { question_id: 'q2', is_correct: true, selected: 'Central Processing Unit', correct: 'Central Processing Unit' },
            ],
          },
          {
            id: 'attempt-cpu-3',
            user_id: 'student-2',
            full_name: 'Liam Jacobs',
            score: 0,
            completed_at: '2026-10-03T09:00:00.000Z',
            answers: [
              { question_id: 'q1', is_correct: false, selected: 'GPU', correct: 'RAM' },
              { question_id: 'q2', is_correct: false, selected: 'Control Power Unit', correct: 'Central Processing Unit' },
            ],
          },
        ],
      },
      {
        id: 'quiz-net',
        title: 'Networking basics',
        passing_score: 60,
        questions: [
          { id: 'q3', question: 'Which device forwards packets between networks?', topic: null, order_index: 0 },
        ],
        attempts: [
          {
            id: 'attempt-net-1',
            user_id: 'student-1',
            full_name: 'Thandi Nkosi',
            score: 0,
            completed_at: '2026-10-20T09:00:00.000Z',
            answers: [
              { question_id: 'q3', is_correct: false, selected: 'Monitor', correct: 'Router' },
            ],
          },
        ],
      },
    ],
  });
  lecturerService.getQuizResults = async (quizId) => ATTEMPTS
    .filter((attempt) => attempt.quiz_id === (quizId || 'quiz-cpu'))
    .map((attempt) => ({
      ...attempt,
      full_name: STUDENTS.find((student) => student.id === attempt.user_id)?.full_name || 'Student',
    }));
  classService.regenerateClassCode = async () => 'NEW4CD';
  classService.restoreClassCode = async (_classId, code) => code;
}

const FOLDER = FOLDERS[0];

function MenuShell() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#F7FBFD' }}>
      <Sidebar
        docked
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((value) => !value)}
        currentScreen="Materials"
        onNavigate={() => {}}
        onHomePress={() => {}}
        onClose={() => {}}
        user={{ profile: { full_name: 'Thandi Nkosi', role: 'student', xp: 1200 } }}
      />
      <View style={{ flex: 1, padding: 28 }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: '#0B1B3A' }}>Learning materials</Text>
        <Text style={{ marginTop: 8, fontSize: 16, lineHeight: 24, color: '#44526F' }}>Collapse the menu when you want the page to use the width.</Text>
      </View>
    </View>
  );
}

export function ScreenPreview() {
  installPreviewData();
  const initial = new URLSearchParams(window.location.search).get('preview') || 'lecturer';
  const [screen, setScreen] = useState(initial);
  const [params, setParams] = useState(initial === 'quiz-play' ? { quizId: 'quiz-cpu' } : {});
  const navigation = {
    navigate(name, next) {
      if (name === 'Quiz' && next?.quizId) {
        setParams(next);
        setScreen('quiz-play');
        return;
      }
      if (name === 'QuizDetail') {
        setParams(next || {});
        setScreen('quiz-detail');
        return;
      }
      if (name === 'ClassDetail') {
        setParams(next || { classId: 'class-ict' });
        setScreen('class');
        return;
      }
      const map = {
        StudentProgress: 'progress',
        ClassManagement: 'classes',
        ContentUpload: 'upload',
        QuizCreation: 'quiz-create',
        FolderContent: 'folder',
        Quiz: 'quizzes',
        LecturerDashboard: 'lecturer',
        QuizAnalytics: 'analytics',
      };
      setScreen(map[name] || 'lecturer');
    },
    goBack() { setScreen('lecturer'); },
    canGoBack() { return false; },
    getState() { return { routeNames: ['Lecturer'] }; },
  };
  const route = { params: { ...params, folderId: 'folder-quiz', folder: FOLDER, classId: params.classId || 'class-ict', quizId: params.quizId || 'quiz-cpu' } };

  let body = null;
  if (screen === 'classes') body = <ClassManagementScreen navigation={navigation} />;
  else if (screen === 'class') body = <ClassDetailScreen navigation={navigation} route={route} />;
  else if (screen === 'progress') body = <StudentProgressScreen navigation={navigation} />;
  else if (screen === 'quiz-create') body = <QuizCreationScreen navigation={navigation} route={route} />;
  else if (screen === 'quiz-detail') body = <QuizDetailScreen navigation={navigation} route={route} />;
  else if (screen === 'analytics') body = <QuizAnalyticsScreen navigation={navigation} route={{ params: { example: true, quizId: params.quizId || 'quiz-cpu', studentId: params.studentId } }} />;
  else if (screen === 'upload') body = <ContentUploadScreen navigation={navigation} route={route} />;
  else if (screen === 'folder') body = <FolderContentScreen navigation={navigation} route={route} />;
  else if (screen === 'quizzes') body = <QuizScreen navigation={navigation} route={{ params: {} }} />;
  else if (screen === 'quiz-play') body = <QuizScreen navigation={navigation} route={{ params: { quizId: 'quiz-cpu' } }} />;
  else if (screen === 'menu') body = <MenuShell />;
  else if (screen === 'windows') body = <Windows11SimulatorScreen />;
  else body = <LecturerDashboardScreen navigation={navigation} />;

  return (
    <NavigationContainer>
      <PreviewStack.Navigator screenOptions={{ headerShown: false }}>
        <PreviewStack.Screen name="PreviewHost">{() => <View style={{ flex: 1 }}>{body}</View>}</PreviewStack.Screen>
      </PreviewStack.Navigator>
    </NavigationContainer>
  );
}

const PreviewStack = createStackNavigator();

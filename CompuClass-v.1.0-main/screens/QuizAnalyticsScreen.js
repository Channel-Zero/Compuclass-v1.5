import React, { useCallback, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { lecturerService } from '../services/lecturerService';
import { getErrorMessage } from '../utils/errorMessages';
import { formatShortDate, plural } from '../utils/quizFlow';
import { buildQuizAnalytics } from '../utils/quizAnalytics';
import { Page, Heading, Body, Glass, Badge, Button, font } from '../components/ui/kit';
import { LECTURER_COLUMN, ScreenHeading } from '../components/lecturerChrome';

const OUTCOME = {
  right: { label: 'Right', kind: 'ok' },
  wrong: { label: 'Wrong', kind: 'error' },
  ungraded: { label: 'Not graded', kind: 'warning' },
  unrecorded: { label: 'No answer saved', kind: 'neutral' },
};

function trendText(trend) {
  if (!trend?.length) return 'No attempts yet';
  return trend.map((item) => `${formatShortDate(item.completed_at)} ${item.score}%`).join('  ·  ');
}

function scoreText(value) {
  return value == null ? '—' : `${value}%`;
}

export default function QuizAnalyticsScreen({ navigation, route }) {
  const { theme } = useTheme();
  const example = route?.params?.example === true;
  const [status, setStatus] = useState('loading');
  const [errorText, setErrorText] = useState('');
  const [report, setReport] = useState({ quizzes: [] });
  const [quizId, setQuizId] = useState(route?.params?.quizId || null);
  const [studentId, setStudentId] = useState(route?.params?.studentId || null);
  const loadRef = useRef(() => {});

  const load = async () => {
    setStatus((current) => (current === 'ready' ? 'ready' : 'loading'));
    setErrorText('');
    try {
      const data = await lecturerService.getQuizAnalytics();
      setReport(data || { quizzes: [] });
      setStatus('ready');
    } catch (error) {
      setStatus('error');
      setErrorText(getErrorMessage(error, { context: 'QuizAnalytics' }));
    }
  };
  loadRef.current = load;
  useFocusEffect(useCallback(() => { loadRef.current(); }, []));

  const view = buildQuizAnalytics(report, { quizId, studentId });
  const quiz = view.selectedQuiz;
  const student = view.selectedStudent;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Page maxWidth={LECTURER_COLUMN}>
        <ScreenHeading
          navigation={navigation}
          title="Quiz analytics"
          subtitle="Right and wrong answers, scores, and topics to revisit"
        />

        {example ? (
          <Glass strong style={styles.banner} accessibilityRole="text">
            <Badge label="Example data" kind="yellow" />
            <Body variant="caption" style={{ marginTop: 8 }}>
              These students, scores, and answers are sample records for this preview. They are not live results.
            </Body>
          </Glass>
        ) : null}

        {status === 'loading' ? (
          <Body variant="caption" accessibilityRole="progressbar">Loading quiz results</Body>
        ) : null}

        {status === 'error' ? (
          <Glass strong style={styles.block} accessibilityRole="alert">
            <Heading level={3}>Could not load quiz analytics</Heading>
            <Body variant="caption" style={{ marginTop: 6 }}>{errorText}</Body>
            <Button label="Try again" fit style={{ marginTop: 12 }} onPress={load} />
          </Glass>
        ) : null}

        {status === 'ready' && view.quizzes.length === 0 ? (
          <Glass strong style={styles.block}>
            <Heading level={3}>No quizzes to review yet</Heading>
            <Body variant="caption" style={{ marginTop: 6 }}>
              Create a quiz and share it with one of your classes. Results appear here after a student submits.
            </Body>
          </Glass>
        ) : null}

        {status === 'ready' && view.quizzes.length > 0 ? (
          <>
            <View style={styles.chipRow}>
              {view.quizzes.map((item) => {
                const selected = quiz?.id === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => { setQuizId(item.id); setStudentId(null); }}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Show ${item.title}`}
                    style={[styles.chip, { backgroundColor: selected ? theme.primary : 'rgba(255,255,255,0.70)' }]}
                  >
                    <Text style={[{ color: selected ? '#fff' : theme.text, fontSize: 14 }, font(theme, 'semibold')]}>{item.title}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {student ? (
              <StudentFocus
                theme={theme}
                student={student}
                onBack={() => setStudentId(null)}
              />
            ) : quiz ? (
              <QuizFocus
                theme={theme}
                quiz={quiz}
                onOpenStudent={setStudentId}
              />
            ) : null}
          </>
        ) : null}
      </Page>
    </View>
  );
}

function QuizFocus({ theme, quiz, onOpenStudent }) {
  return (
    <>
      <Glass strong style={styles.block}>
        <Heading level={2}>{quiz.title}</Heading>
        <Body variant="caption" style={{ marginTop: 6 }}>
          {plural(quiz.attemptCount, 'attempt')}
          {quiz.average == null ? '' : ` · ${quiz.average}% average`}
          {` · ${quiz.passingScore}% to pass`}
        </Body>
      </Glass>

      {quiz.students.length === 0 ? (
        <Glass strong style={styles.block}>
          <Body variant="caption">No attempts from students in your classes yet.</Body>
        </Glass>
      ) : quiz.students.map((person) => (
        <Glass key={person.id} strong style={styles.block}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={[{ color: theme.text }, font(theme, 'h3')]}>{person.fullName}</Text>
              <Body variant="caption">
                {plural(person.attemptCount, 'attempt')} · latest {scoreText(person.latest?.score)} · best {scoreText(person.best)}
              </Body>
            </View>
            <Button label="Focus" variant="secondary" fit onPress={() => onOpenStudent(person.id)} accessibilityLabel={`Focus on ${person.fullName}`} />
          </View>
          <Body variant="caption" style={{ marginTop: 8 }}>{trendText(person.trend)}</Body>
          {!person.hasAnswerRecord ? (
            <Body variant="caption" style={{ marginTop: 8 }}>
              This attempt has a score, and the per-question answers were not stored.
            </Body>
          ) : person.questions.map((question, index) => {
            const outcome = OUTCOME[question.outcome] || OUTCOME.unrecorded;
            return (
              <View key={question.id || index} style={styles.questionRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[{ color: theme.text }, font(theme, 'semibold')]}>{index + 1}. {question.question}</Text>
                  <Body variant="caption">{question.topic}{question.selected ? ` · answered ${question.selected}` : ''}</Body>
                </View>
                <Badge label={outcome.label} kind={outcome.kind} />
              </View>
            );
          })}
        </Glass>
      ))}
    </>
  );
}

function StudentFocus({ theme, student, onBack }) {
  return (
    <>
      <Button label="All students" variant="secondary" fit onPress={onBack} accessibilityLabel="Back to all students" />
      <Glass strong style={[styles.block, { marginTop: 12 }]}>
        <Heading level={2}>{student.fullName}</Heading>
        <Body variant="caption" style={{ marginTop: 6 }}>
          {plural(student.attemptCount, 'attempt')} across quizzes · average {scoreText(student.average)} · best {scoreText(student.best)}
        </Body>
        <Text style={[{ color: theme.text, marginTop: 10 }, font(theme, 'semibold')]}>Score trend</Text>
        <Body variant="caption" style={{ marginTop: 4 }}>{trendText(student.trend.map((item) => ({
          ...item,
          completed_at: item.completed_at,
          score: item.score,
        })))}</Body>
        {student.trend.map((item) => (
          <View key={item.id || `${item.quiz_id}-${item.completed_at}`} style={styles.questionRow}>
            <View style={{ flex: 1 }}>
              <Text style={[{ color: theme.text }, font(theme, 'semibold')]}>{item.quizTitle || 'Quiz'}</Text>
              <Body variant="caption">{formatShortDate(item.completed_at)}</Body>
            </View>
            <Badge label={`${item.score}%`} kind={item.score >= (item.passingScore ?? 70) ? 'ok' : 'error'} />
          </View>
        ))}
      </Glass>

      <Heading level={2} style={{ marginBottom: 8 }}>Topics to focus on</Heading>
      {student.recommendations.length === 0 ? (
        <Glass strong style={styles.block}>
          <Body variant="caption">No wrong answers recorded for this student.</Body>
        </Glass>
      ) : student.recommendations.map((item) => (
        <Glass key={item.topic} strong style={styles.block}>
          <View style={styles.rowBetween}>
            <Text style={[{ color: theme.text, flex: 1 }, font(theme, 'h3')]}>{item.topic}</Text>
            <Badge label={plural(item.wrongCount, 'miss', 'misses')} kind="error" />
          </View>
          {item.questions.map((question) => (
            <Body key={question} variant="caption" style={{ marginTop: 6 }}>{question}</Body>
          ))}
        </Glass>
      ))}

      <Heading level={2} style={{ marginTop: 8, marginBottom: 8 }}>Questions they got wrong</Heading>
      {student.wrong.length === 0 ? (
        <Glass strong style={styles.block}>
          <Body variant="caption">Nothing to revisit from the saved answers.</Body>
        </Glass>
      ) : student.wrong.map((item) => (
        <Glass key={`${item.attemptId}-${item.questionId}`} strong style={styles.block}>
          <Badge label={item.topic} kind="info" />
          <Text style={[{ color: theme.text, marginTop: 8 }, font(theme, 'semibold')]}>{item.question}</Text>
          <Body variant="caption" style={{ marginTop: 4 }}>
            {item.quizTitle} · {formatShortDate(item.completed_at)}
          </Body>
          <Body variant="caption">Their answer: {item.selected || 'No answer'}</Body>
          {item.correct ? <Body variant="caption">Correct answer: {item.correct}</Body> : null}
        </Glass>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  banner: { padding: 16, marginBottom: 16 },
  block: { padding: 16, marginBottom: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  questionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
});

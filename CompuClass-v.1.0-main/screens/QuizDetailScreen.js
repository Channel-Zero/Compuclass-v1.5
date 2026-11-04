import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Alert, StyleSheet } from 'react-native';
import { lecturerService } from '../services/lecturerService';
import { getErrorMessage } from '../utils/errorMessages';
import { useTheme } from '../context/ThemeContext';
import { formatShortDate, normalizeOptions, passingMark, plural, summarizeQuizAttempts } from '../utils/quizFlow';
import { Page, Heading, Body, Glass, Badge, Button, IconTile, Skeleton, font } from '../components/ui/kit';
import { ActionMenu, LECTURER_COLUMN, ScreenHeading, ToastBanner, confirmNamed, useUndoToast } from '../components/lecturerChrome';

export default function QuizDetailScreen({ navigation, route }) {
  const { theme } = useTheme();
  const { toast, offer } = useUndoToast();
  const { quizId } = route.params;
  const [quiz, setQuiz] = useState(null);
  const [status, setStatus] = useState('loading');
  const [results, setResults] = useState([]);
  const [resultsNote, setResultsNote] = useState('');
  const [removed, setRemoved] = useState(false);
  const loadQuizRef = useRef(() => {});

  useEffect(() => { loadQuizRef.current(); }, []);

  const loadQuiz = async () => {
    setStatus('loading');
    try {
      const data = await lecturerService.getQuizDetail(quizId);
      setQuiz(data);
      setStatus('ready');
      try {
        const rows = await lecturerService.getQuizResults(quizId);
        setResults(rows);
        setResultsNote('');
      } catch (error) {
        console.error('Quiz results error:', error);
        setResults([]);
        setResultsNote('Results could not be loaded.');
      }
    } catch (error) {
      setStatus('error');
      Alert.alert('Error', getErrorMessage(error, { context: 'QuizDetail' }));
    }
  };
  loadQuizRef.current = loadQuiz;

  const handleDeleteQuiz = async () => {
    const title = quiz?.title || 'this quiz';
    const ok = await confirmNamed({
      title: `Delete ${title}?`,
      message: `Delete “${title}”? Students will no longer be able to take it.`,
      confirmLabel: 'Delete quiz',
    });
    if (!ok) return;
    setRemoved(true);
    offer({
      message: `${title} deleted`,
      undo: () => setRemoved(false),
      commit: async () => {
        try {
          await lecturerService.deleteQuiz(quizId);
          navigation.goBack();
        } catch (error) {
          setRemoved(false);
          Alert.alert('Error', getErrorMessage(error, { context: 'QuizDetail' }));
        }
      },
    });
  };

  const summary = summarizeQuizAttempts(results);
  const passMark = passingMark(quiz);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Page maxWidth={LECTURER_COLUMN}>
        <ScreenHeading
          navigation={navigation}
          title="Quiz details"
          subtitle={quiz?.title || 'Questions and scores'}
          trailing={quiz ? (
            <ActionMenu
              label={`Actions for ${quiz.title}`}
              items={[{ label: `Delete ${quiz.title}`, destructive: true, onPress: handleDeleteQuiz }]}
            />
          ) : null}
        />

        {status === 'loading' ? (
          <View accessibilityRole="progressbar">
            <Skeleton height={120} radius={24} />
            <Skeleton height={88} radius={16} style={{ marginTop: 12 }} />
          </View>
        ) : null}
        {status === 'error' ? (
          <Glass strong style={styles.card} accessibilityRole="alert">
            <Heading level={3}>Could not load this quiz</Heading>
            <Button label="Try again" fit style={{ marginTop: 12 }} onPress={loadQuiz} />
          </Glass>
        ) : null}
        {status === 'ready' && quiz && !removed ? (
          <>
            <Glass strong style={styles.card}>
              <IconTile name="quiz" tone="blue" size={56} />
              <Heading level={2} style={{ marginTop: 12, textAlign: 'center' }}>{quiz.title}</Heading>
              <View style={styles.metaRow}>
                <Badge label={plural(quiz.quiz_questions?.length || 0, 'question')} kind="neutral" />
                <Badge label={`${passMark}% to pass`} kind="neutral" />
              </View>
            </Glass>

            <View style={styles.metaRow}>
              <Heading level={2} style={{ flex: 1 }}>Results</Heading>
              {summary.count > 0 ? null : (
                <Button label="Edit" variant="secondary" fit onPress={() => navigation.navigate('QuizCreation', { editQuizId: quizId })} accessibilityLabel={`Edit ${quiz.title}`} />
              )}
              <Button label="Analytics" variant="secondary" fit onPress={() => navigation.navigate('QuizAnalytics', { quizId })} accessibilityLabel="Open quiz analytics" />
            </View>
            {summary.count > 0 ? (
              <Body variant="caption" style={{ marginBottom: 12 }}>Questions stay as they are once a student has attempted this quiz.</Body>
            ) : null}
            <Glass strong style={styles.block}>
              {resultsNote ? <Body variant="caption">{resultsNote}</Body> : null}
              {!resultsNote && summary.count === 0 ? (
                <Body variant="caption">No attempts yet. Share this quiz with a class so students can take it.</Body>
              ) : null}
              {!resultsNote && summary.count > 0 ? (
                <>
                  <Body variant="caption" style={{ marginBottom: 12 }}>
                    {plural(summary.count, 'attempt')} · {summary.average}% average · best {summary.best}%
                  </Body>
                  {results.slice(0, 8).map((attempt) => {
                    const passed = Number(attempt.score) >= passMark;
                    return (
                      <View key={attempt.id || `${attempt.user_id}-${attempt.completed_at}`} style={styles.resultRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={[{ color: theme.text }, font(theme, 'semibold')]}>{attempt.full_name || 'Student'}</Text>
                          <Body variant="caption">{formatShortDate(attempt.completed_at)}</Body>
                        </View>
                        <View style={styles.scoreCol}>
                          <Text style={[{ color: theme.text, fontSize: 16 }, font(theme, 'h3')]}>{attempt.score}%</Text>
                          <Text style={[{ color: passed ? theme.successInk : theme.errorInk, fontSize: 13 }, font(theme, 'semibold')]}>
                            {passed ? 'Passed' : 'Failed'}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </>
              ) : null}
            </Glass>

            <Heading level={2} style={{ marginTop: 8, marginBottom: 12 }}>Questions</Heading>
            {quiz.quiz_questions?.length ? null : <Body variant="caption">This quiz has no questions yet.</Body>}
            {quiz.quiz_questions?.map((question, index) => (
              <Glass key={question.id || index} strong style={styles.block}>
                <Badge label={`Question ${index + 1}`} kind="neutral" />
                <Text style={[{ color: theme.text, marginTop: 10, marginBottom: 12 }, font(theme, 'semibold')]}>{question.question}</Text>
                {normalizeOptions(question.options).map((option, optIndex) => {
                  const isCorrect = question.correct_answer === option;
                  return (
                    <View key={optIndex} style={[styles.option, { borderColor: isCorrect ? theme.success : theme.border, backgroundColor: isCorrect ? theme.successWash : 'transparent' }]}>
                      <Text style={[{ width: 24, color: theme.text }, font(theme, 'semibold')]}>{String.fromCharCode(65 + optIndex)}</Text>
                      <Text style={[{ flex: 1, color: theme.text, fontSize: 15 }, font(theme, 'body')]}>{option}</Text>
                      {isCorrect ? <Text style={[{ color: theme.successInk, fontSize: 13 }, font(theme, 'semibold')]}>Correct</Text> : null}
                    </View>
                  );
                })}
              </Glass>
            ))}
          </>
        ) : null}
        {removed ? (
          <Glass strong style={styles.card}>
            <Heading level={3}>{quiz?.title || 'Quiz'} deleted</Heading>
            <Body variant="caption" style={{ marginTop: 6 }}>Undo is at the bottom of the screen.</Body>
          </Glass>
        ) : null}
      </Page>
      <ToastBanner toast={toast} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', padding: 24, marginBottom: 20 },
  metaRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  block: { padding: 16, marginBottom: 12 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  scoreCol: { width: 72, alignItems: 'flex-end' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8 },
});

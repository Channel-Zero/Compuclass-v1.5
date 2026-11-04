// Pure helpers for the lecturer quiz analytics screen.
// No Supabase and no React, so grouping and recommendations can be tested
// without a signed-in lecturer.

function numericScore(value) {
  if (value == null || value === '') return null;
  const score = Number(value);
  return Number.isFinite(score) ? score : null;
}

function average(scores) {
  if (!scores.length) return null;
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

// A blank topic falls back to the quiz title, then to General, so older
// questions still group somewhere a lecturer can act on.
export function questionTopic(question, quiz) {
  const topic = String(question?.topic || '').trim();
  if (topic) return topic;
  const title = String(quiz?.title || '').trim();
  if (title) return title;
  return 'General';
}

export function attemptTrend(attempts) {
  return (Array.isArray(attempts) ? attempts : [])
    .map((attempt) => ({ ...attempt, score: numericScore(attempt?.score) }))
    .filter((attempt) => attempt.score != null)
    .sort((left, right) => {
      const leftTime = new Date(left.completed_at).getTime();
      const rightTime = new Date(right.completed_at).getTime();
      const safeLeft = Number.isNaN(leftTime) ? 0 : leftTime;
      const safeRight = Number.isNaN(rightTime) ? 0 : rightTime;
      if (safeLeft !== safeRight) return safeLeft - safeRight;
      return String(left.id || '').localeCompare(String(right.id || ''));
    });
}

export function topicRecommendations(wrongItems) {
  const groups = new Map();
  (Array.isArray(wrongItems) ? wrongItems : []).forEach((item) => {
    const topic = String(item?.topic || '').trim() || 'General';
    const current = groups.get(topic) || { topic, wrongCount: 0, questions: [] };
    current.wrongCount += 1;
    const text = String(item?.question || '').trim();
    if (text && !current.questions.includes(text)) current.questions.push(text);
    groups.set(topic, current);
  });
  return [...groups.values()].sort(
    (left, right) => right.wrongCount - left.wrongCount || left.topic.localeCompare(right.topic),
  );
}

function answerFor(attempt, questionId) {
  return (attempt?.answers || []).find((answer) => answer?.question_id === questionId) || null;
}

function questionResult(question, quiz, attempt) {
  const answer = attempt ? answerFor(attempt, question.id) : null;
  const recorded = Boolean(answer);
  let outcome = 'unrecorded';
  if (recorded && answer.is_correct === true) outcome = 'right';
  else if (recorded && answer.is_correct === false) outcome = 'wrong';
  else if (recorded) outcome = 'ungraded';
  return {
    id: question.id,
    question: question.question,
    topic: questionTopic(question, quiz),
    outcome,
    selected: answer?.selected ?? null,
    correct: answer?.correct ?? null,
  };
}

function summariseStudent(studentId, fullName, attempts, quizzes) {
  const trend = attemptTrend(attempts);
  const scores = trend.map((attempt) => attempt.score);
  const wrong = [];
  trend.forEach((attempt) => {
    const quiz = quizzes.find((item) => item.id === attempt.quiz_id) || attempt.quiz || {};
    (quiz.questions || []).forEach((question) => {
      const result = questionResult(question, quiz, attempt);
      if (result.outcome !== 'wrong') return;
      wrong.push({
        attemptId: attempt.id,
        quizId: quiz.id,
        quizTitle: quiz.title || 'Quiz',
        questionId: question.id,
        question: result.question,
        topic: result.topic,
        selected: result.selected,
        correct: result.correct,
        completed_at: attempt.completed_at,
      });
    });
  });
  return {
    id: studentId,
    fullName: fullName || 'Student',
    attemptCount: trend.length,
    average: average(scores),
    best: scores.length ? Math.max(...scores) : null,
    latest: trend.length ? trend[trend.length - 1] : null,
    trend,
    wrong,
    recommendations: topicRecommendations(wrong),
  };
}

export function buildQuizAnalytics(report, { quizId, studentId } = {}) {
  const quizzes = (Array.isArray(report?.quizzes) ? report.quizzes : []).map((quiz) => {
    const questions = (quiz.questions || [])
      .slice()
      .sort((left, right) => (left.order_index ?? 0) - (right.order_index ?? 0));
    const attempts = (quiz.attempts || []).map((attempt) => ({ ...attempt, quiz_id: attempt.quiz_id || quiz.id }));
    const byStudent = new Map();
    attempts.forEach((attempt) => {
      if (!attempt?.user_id) return;
      const current = byStudent.get(attempt.user_id) || [];
      current.push(attempt);
      byStudent.set(attempt.user_id, current);
    });
    const students = [...byStudent.entries()]
      .map(([id, rows]) => {
        const summary = summariseStudent(id, rows[0]?.full_name, rows.map((row) => ({ ...row, quiz_id: quiz.id })), [{ ...quiz, id: quiz.id, questions }]);
        const latest = summary.latest;
        return {
          ...summary,
          questions: questions.map((question) => questionResult(question, quiz, latest)),
          hasAnswerRecord: Boolean(latest && (latest.answers || []).length > 0),
        };
      })
      .sort((left, right) => left.fullName.localeCompare(right.fullName));
    const allScores = attemptTrend(attempts).map((attempt) => attempt.score);
    return {
      id: quiz.id,
      title: quiz.title || 'Quiz',
      passingScore: Number.isFinite(Number(quiz.passing_score)) ? Number(quiz.passing_score) : 70,
      questions: questions.map((question) => ({
        ...question,
        topic: questionTopic(question, quiz),
      })),
      students,
      attemptCount: allScores.length,
      average: average(allScores),
    };
  }).sort((left, right) => left.title.localeCompare(right.title));

  const selectedQuiz = quizzes.find((quiz) => quiz.id === quizId) || quizzes[0] || null;

  const people = new Map();
  (report?.quizzes || []).forEach((quiz) => {
    (quiz.attempts || []).forEach((attempt) => {
      if (!attempt?.user_id) return;
      const current = people.get(attempt.user_id) || { fullName: attempt.full_name, attempts: [] };
      if (!current.fullName && attempt.full_name) current.fullName = attempt.full_name;
      current.attempts.push({
        ...attempt,
        quiz_id: attempt.quiz_id || quiz.id,
        quizTitle: quiz.title,
        passingScore: Number.isFinite(Number(quiz.passing_score)) ? Number(quiz.passing_score) : 70,
      });
      people.set(attempt.user_id, current);
    });
  });
  const students = [...people.entries()]
    .map(([id, person]) => summariseStudent(
      id,
      person.fullName,
      person.attempts,
      (report?.quizzes || []).map((quiz) => ({ ...quiz, questions: quiz.questions || [] })),
    ))
    .sort((left, right) => left.fullName.localeCompare(right.fullName));

  const selectedStudent = students.find((student) => student.id === studentId) || null;
  return { quizzes, selectedQuiz, students, selectedStudent };
}

export function isMissingAnalyticsRpc(error) {
  if (!error) return false;
  const code = String(error.code || '');
  const message = String(error.message || '');
  return code === 'PGRST202'
    || /schema cache/i.test(message)
    || /get_lecturer_quiz_analytics/i.test(message)
    || /could not find the function/i.test(message);
}

function nameMap(students) {
  if (students instanceof Map) return students;
  const names = new Map();
  (Array.isArray(students) ? students : []).forEach((student) => {
    if (student?.id) names.set(student.id, student.full_name || student.fullName || 'Student');
  });
  return names;
}

// Turns table rows into the report shape. Students outside `students` are
// dropped here as well as by RLS, so a broad attempt policy cannot paint
// another class on this screen.
export function analyticsReportFromRows({ quizzes, questions, attempts, answers, options, students }) {
  const names = nameMap(students);
  const optionById = new Map((options || []).map((option) => [option.id, option]));
  const correctByQuestion = new Map();
  (options || []).forEach((option) => {
    if (option?.is_correct && !correctByQuestion.has(option.question_id)) {
      correctByQuestion.set(option.question_id, option.option_text);
    }
  });
  const questionRows = Array.isArray(questions) ? questions : [];
  const answerRows = Array.isArray(answers) ? answers : [];
  return {
    quizzes: (Array.isArray(quizzes) ? quizzes : []).map((quiz) => ({
      id: quiz.id,
      title: quiz.title,
      passing_score: quiz.passing_score,
      questions: questionRows
        .filter((question) => question.quiz_id === quiz.id)
        .sort((left, right) => (left.order_index ?? 0) - (right.order_index ?? 0))
        .map((question) => ({
          id: question.id,
          question: question.question,
          topic: question.topic || null,
          order_index: question.order_index,
        })),
      attempts: (Array.isArray(attempts) ? attempts : [])
        .filter((attempt) => attempt.quiz_id === quiz.id && names.has(attempt.user_id) && attempt.status !== 'rejected' && numericScore(attempt.score) != null)
        .map((attempt) => ({
          id: attempt.id,
          user_id: attempt.user_id,
          full_name: names.get(attempt.user_id) || 'Student',
          score: numericScore(attempt.score),
          completed_at: attempt.completed_at,
          answers: answerRows
            .filter((answer) => answer.attempt_id === attempt.id)
            .map((answer) => ({
              question_id: answer.question_id,
              is_correct: answer.is_correct,
              selected: optionById.get(answer.selected_option_id)?.option_text || answer.short_answer_text || null,
              correct: correctByQuestion.get(answer.question_id) || null,
            })),
        })),
    })),
  };
}

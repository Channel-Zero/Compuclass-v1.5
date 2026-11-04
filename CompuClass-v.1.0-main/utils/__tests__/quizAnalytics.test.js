import {
  analyticsReportFromRows,
  buildQuizAnalytics,
  isMissingAnalyticsRpc,
  questionTopic,
  topicRecommendations,
} from '../quizAnalytics';

const REPORT = {
  quizzes: [
    {
      id: 'quiz-cpu',
      title: 'CPU and memory',
      passing_score: 70,
      questions: [
        { id: 'q1', question: 'Which part stores the data the CPU is using?', topic: 'Memory', order_index: 0 },
        { id: 'q2', question: 'What does CPU stand for?', topic: '', order_index: 1 },
      ],
      attempts: [
        {
          id: 'a1',
          user_id: 's1',
          full_name: 'Thandi Nkosi',
          score: 50,
          completed_at: '2026-10-02T09:00:00.000Z',
          answers: [
            { question_id: 'q1', is_correct: true, selected: 'RAM', correct: 'RAM' },
            { question_id: 'q2', is_correct: false, selected: 'Computer Personal Unit', correct: 'Central Processing Unit' },
          ],
        },
        {
          id: 'a2',
          user_id: 's1',
          full_name: 'Thandi Nkosi',
          score: 100,
          completed_at: '2026-10-12T09:00:00.000Z',
          answers: [
            { question_id: 'q1', is_correct: true, selected: 'RAM', correct: 'RAM' },
            { question_id: 'q2', is_correct: true, selected: 'Central Processing Unit', correct: 'Central Processing Unit' },
          ],
        },
        {
          id: 'a3',
          user_id: 's2',
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
        { id: 'q3', question: 'Which device forwards packets?', topic: null, order_index: 0 },
      ],
      attempts: [
        {
          id: 'a4',
          user_id: 's1',
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
};

describe('question topics', () => {
  it('uses the question topic, then the quiz title, then General', () => {
    expect(questionTopic({ topic: ' Memory ' }, { title: 'CPU' })).toBe('Memory');
    expect(questionTopic({ topic: '' }, { title: 'CPU and memory' })).toBe('CPU and memory');
    expect(questionTopic({}, {})).toBe('General');
  });
});

describe('lecturer quiz analytics', () => {
  const view = buildQuizAnalytics(REPORT, { quizId: 'quiz-cpu', studentId: 's1' });

  it('shows each student right or wrong on the latest attempt of the chosen quiz', () => {
    const quiz = view.selectedQuiz;
    expect(quiz.title).toBe('CPU and memory');
    const thandi = quiz.students.find((student) => student.id === 's1');
    const liam = quiz.students.find((student) => student.id === 's2');
    expect(thandi.questions.map((question) => question.outcome)).toEqual(['right', 'right']);
    expect(liam.questions.map((question) => question.outcome)).toEqual(['wrong', 'wrong']);
    expect(liam.questions[0]).toMatchObject({ selected: 'GPU', correct: 'RAM', topic: 'Memory' });
    expect(liam.questions[1].topic).toBe('CPU and memory');
    expect(thandi.attemptCount).toBe(2);
    expect(thandi.trend.map((attempt) => attempt.score)).toEqual([50, 100]);
  });

  it('tracks one student across quizzes and recommends topics from wrong answers', () => {
    const thandi = view.selectedStudent;
    expect(thandi.trend.map((attempt) => attempt.score)).toEqual([50, 100, 0]);
    expect(thandi.attemptCount).toBe(3);
    expect(thandi.average).toBe(50);
    expect(thandi.wrong.map((item) => item.question)).toEqual([
      'What does CPU stand for?',
      'Which device forwards packets?',
    ]);
    expect(thandi.recommendations).toEqual([
      {
        topic: 'CPU and memory',
        wrongCount: 1,
        questions: ['What does CPU stand for?'],
      },
      {
        topic: 'Networking basics',
        wrongCount: 1,
        questions: ['Which device forwards packets?'],
      },
    ]);
  });

  it('counts repeated misses of the same topic ahead of a single miss', () => {
    const ranked = topicRecommendations([
      { topic: 'Memory', question: 'What is RAM?' },
      { topic: 'Memory', question: 'What is RAM?' },
      { topic: 'Networks', question: 'What is a router?' },
    ]);
    expect(ranked[0]).toMatchObject({ topic: 'Memory', wrongCount: 2, questions: ['What is RAM?'] });
    expect(ranked[1].topic).toBe('Networks');
  });
});

describe('analytics rows', () => {
  it('keeps only students on the class roster', () => {
    const report = analyticsReportFromRows({
      quizzes: [{ id: 'quiz-1', title: 'CPU', passing_score: 70 }],
      questions: [{ id: 'q1', quiz_id: 'quiz-1', question: 'RAM?', topic: 'Memory', order_index: 0 }],
      attempts: [
        { id: 'a1', quiz_id: 'quiz-1', user_id: 's1', score: 80, completed_at: '2026-10-01', status: 'graded' },
        { id: 'a2', quiz_id: 'quiz-1', user_id: 'outsider', score: 10, completed_at: '2026-10-01', status: 'graded' },
        { id: 'a3', quiz_id: 'quiz-1', user_id: 's1', score: null, completed_at: '2026-10-02', status: 'rejected' },
      ],
      answers: [
        { attempt_id: 'a1', question_id: 'q1', is_correct: false, selected_option_id: 'opt-wrong' },
      ],
      options: [
        { id: 'opt-wrong', question_id: 'q1', option_text: 'GPU', is_correct: false },
        { id: 'opt-right', question_id: 'q1', option_text: 'RAM', is_correct: true },
      ],
      students: [{ id: 's1', full_name: 'Thandi Nkosi' }],
    });
    expect(report.quizzes[0].attempts).toHaveLength(1);
    expect(report.quizzes[0].attempts[0]).toMatchObject({
      user_id: 's1',
      full_name: 'Thandi Nkosi',
      answers: [{ question_id: 'q1', is_correct: false, selected: 'GPU', correct: 'RAM' }],
    });
  });

  it('treats a missing analytics function as a reason to read the tables', () => {
    expect(isMissingAnalyticsRpc({ code: 'PGRST202', message: 'Could not find the function public.get_lecturer_quiz_analytics' })).toBe(true);
    expect(isMissingAnalyticsRpc({ code: '42501', message: 'permission denied' })).toBe(false);
  });
});

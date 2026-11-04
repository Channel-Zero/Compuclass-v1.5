import {
  advanceQuiz,
  bestScoresByQuiz,
  classAverageCaption,
  classAverageScore,
  formatShortDate,
  normalizeOptions,
  passingMark,
  plural,
  prepareQuestionsForSave,
  questionsPayloadForSave,
  progressFromAttempts,
  questionCount,
  spreadCorrectAnswer,
  summarizeClassProgress,
  summarizeQuizAttempts,
  uniqueIds,
} from '../quizFlow';

describe('quiz authoring', () => {
  it('keeps two filled options and drops blanks without moving the correct answer', () => {
    const prepared = prepareQuestionsForSave([
      { question: ' What is RAM? ', options: ['Memory', '', 'Disk', ''], correctAnswer: 0, difficulty: 'easy' },
    ]);
    expect(prepared.ok).toBe(true);
    expect(prepared.questions[0]).toMatchObject({
      question: 'What is RAM?',
      options: ['Memory', 'Disk'],
      correctAnswer: 0,
      difficulty: 'easy',
    });
  });

  it('repoints the correct answer when blank options before it are removed', () => {
    const prepared = prepareQuestionsForSave([
      { question: 'CPU?', options: ['', 'Chip', 'Cable'], correctAnswer: 1 },
    ]);
    expect(prepared.questions[0].options).toEqual(['Chip', 'Cable']);
    expect(prepared.questions[0].correctAnswer).toBe(0);
  });

  it('sends the shape live save_quiz accepts for a practice quiz', () => {
    const prepared = prepareQuestionsForSave([
      {
        question: ' What does <p> do? ',
        options: ['Paragraph ', 'Picture', '', ''],
        correctAnswer: 0,
        type: 'multiple-choice',
      },
    ]);
    const payload = questionsPayloadForSave(prepared.questions);
    expect(payload.ok).toBe(true);
    expect(payload.questions).toEqual([
      {
        question: 'What does <p> do?',
        type: 'mcq',
        order_index: 0,
        options: [
          { option_text: 'Paragraph', is_correct: true },
          { option_text: 'Picture', is_correct: false },
        ],
      },
    ]);
    expect(payload.questions[0]).not.toHaveProperty('correct_answer');
  });

  it('rejects a question type a practice quiz cannot store', () => {
    const payload = questionsPayloadForSave([
      { question: 'Explain RAM', options: ['A', 'B'], correctAnswer: 0, type: 'short_answer' },
    ]);
    expect(payload.ok).toBe(false);
    expect(payload.message).toMatch(/multiple choice or true\/false/);
  });

  it('keeps a topic on the save payload and leaves it off when blank', () => {
    const payload = questionsPayloadForSave([
      { question: 'What is RAM?', options: ['Memory', 'Disk'], correctAnswer: 0, topic: ' Memory ' },
    ]);
    expect(payload.questions[0].topic).toBe('Memory');
    const blank = questionsPayloadForSave([
      { question: 'What is RAM?', options: ['Memory', 'Disk'], correctAnswer: 0, topic: '   ' },
    ]);
    expect(blank.questions[0]).not.toHaveProperty('topic');
  });

  it('maps a true/false question and keeps points when they were set', () => {
    const payload = questionsPayloadForSave([
      { question: 'RAM is memory', options: ['True', 'False'], correctAnswer: 1, type: 'true/false', points: 2 },
    ]);
    expect(payload.questions[0]).toMatchObject({
      type: 'true_false',
      points: 2,
      options: [
        { option_text: 'True', is_correct: false },
        { option_text: 'False', is_correct: true },
      ],
    });
  });

  it('rejects a blank question, a single option, and a correct answer that was left blank', () => {
    expect(prepareQuestionsForSave([])).toMatchObject({ ok: false });
    expect(prepareQuestionsForSave([{ question: '  ', options: ['A', 'B'], correctAnswer: 0 }]).message).toMatch(/needs text/);
    expect(prepareQuestionsForSave([{ question: 'Q', options: ['Only one', ''], correctAnswer: 0 }]).message).toMatch(/at least two/);
    expect(prepareQuestionsForSave([{ question: 'Q', options: ['A', 'B'], correctAnswer: 3 }]).message).toMatch(/isn't blank/);
  });
});

describe('quiz taking', () => {
  const questions = [
    { id: 'q1', time_limit_seconds: 20 },
    { id: 'q2', time_limit_seconds: null },
  ];

  it('moves to the next question and records the time left', () => {
    const step = advanceQuiz({ questions, index: 0, answers: [], selected: 'RAM', timeLeft: 12 });
    expect(step).toEqual({
      status: 'next',
      index: 1,
      answers: [{ question_id: 'q1', selected_answer: 'RAM', time_remaining_seconds: 12 }],
    });
  });

  it('submits once on the last question and does not invent a timer', () => {
    const step = advanceQuiz({
      questions,
      index: 1,
      answers: [{ question_id: 'q1', selected_answer: 'RAM', time_remaining_seconds: 12 }],
      selected: null,
      timeLeft: 0,
    });
    expect(step.status).toBe('submit');
    expect(step.answers).toHaveLength(2);
    expect(step.answers[1]).toEqual({
      question_id: 'q2',
      selected_answer: null,
      time_remaining_seconds: null,
    });
  });

  it('does nothing when the question list is empty', () => {
    expect(advanceQuiz({ questions: [], index: 0, answers: [], selected: 'A', timeLeft: 1 }).status).toBe('idle');
  });

  it('reads option labels from strings, JSON text, and objects', () => {
    expect(normalizeOptions([' RAM ', '', 'CPU'])).toEqual(['RAM', 'CPU']);
    expect(normalizeOptions('["A","B"]')).toEqual(['A', 'B']);
    expect(normalizeOptions([{ text: 'Chip' }, { label: 'Cable' }, { option: 'Port' }])).toEqual(['Chip', 'Cable', 'Port']);
    expect(normalizeOptions('not-json')).toEqual(['not-json']);
    expect(normalizeOptions(null)).toEqual([]);
  });

  it('keeps the best score per quiz and a 70 pass mark when none is stored', () => {
    expect(bestScoresByQuiz([
      { quiz_id: 'a', score: 40 },
      { quiz_id: 'a', score: 80 },
      { quiz_id: 'b', score: 'nope' },
      { quiz_id: 'b', score: 55 },
    ])).toEqual({ a: 80, b: 55 });
    expect(passingMark({ passing_score: 60 })).toBe(60);
    expect(passingMark({})).toBe(70);
    expect(questionCount({ question_count: 4, quiz_questions: [{}, {}] })).toBe(4);
    expect(uniqueIds(['a', 'a', null, 'b'])).toEqual(['a', 'b']);
  });
});

describe('lecturer results', () => {
  it('averages only students who have finished a quiz', () => {
    expect(classAverageScore({
      one: { quizzesCompleted: 2, averageScore: 80 },
      two: { quizzesCompleted: 0, averageScore: 0 },
      three: { quizzesCompleted: 1, averageScore: 60 },
    })).toBe(70);
    expect(classAverageScore({})).toBeNull();
  });

  it('summarises attempt scores for one quiz', () => {
    expect(summarizeQuizAttempts([
      { score: 40 },
      { score: 90 },
      { score: null },
    ])).toEqual({ count: 2, average: 65, best: 90 });
    expect(summarizeQuizAttempts([])).toEqual({ count: 0, average: null, best: null });
  });

  it('labels an average that leaves out students with no attempts', () => {
    const summary = summarizeClassProgress({
      one: { quizzesCompleted: 1, averageScore: 80 },
      two: { quizzesCompleted: 1, averageScore: 90 },
      three: { quizzesCompleted: 0, averageScore: null },
    });
    expect(summary).toEqual({ average: 85, attempted: 2, total: 3 });
    expect(classAverageScore({ one: { quizzesCompleted: 1, averageScore: 80 }, two: { quizzesCompleted: 1, averageScore: 90 } })).toBe(85);
    expect(classAverageCaption(summary)).toBe('85% average across 2 students who attempted');
    expect(classAverageCaption(summarizeClassProgress({}))).toBe('No attempts yet');
  });

  it('formats dates as 12 Oct 2026 and matches plurals', () => {
    expect(formatShortDate('2026-10-12T09:00:00.000Z')).toBe('12 Oct 2026');
    expect(formatShortDate('2026-10-02T09:00:00.000Z')).toBe('2 Oct 2026');
    expect(formatShortDate('')).toBe('');
    expect(plural(1, 'quiz')).toBe('1 quiz');
    expect(plural(0, 'quiz')).toBe('0 quizzes');
    expect(plural(2, 'class')).toBe('2 classes');
    expect(plural(2, 'material')).toBe('2 materials');
    expect(plural(1, 'question')).toBe('1 question');
  });

  it('builds student progress from the same attempts shown on quiz details', () => {
    expect(progressFromAttempts([
      { score: 90, completed_at: '2026-10-11T09:00:00.000Z' },
      { score: null, completed_at: '2026-10-01T09:00:00.000Z' },
    ], 3)).toEqual({
      quizzesCompleted: 1,
      averageScore: 90,
      materialsViewed: 3,
      lastActivity: '11 Oct 2026',
    });
    expect(progressFromAttempts([], 0).averageScore).toBeNull();
  });

  it('moves a correct answer off option A when a generated quiz pinned it there', () => {
    expect(spreadCorrectAnswer(['RAM', 'GPU', 'Disk'], 0)).toEqual({
      options: ['GPU', 'Disk', 'RAM'],
      correctIndex: 2,
    });
    expect(spreadCorrectAnswer(['RAM', 'GPU', 'Disk'], 1)).toEqual({
      options: ['RAM', 'GPU', 'Disk'],
      correctIndex: 1,
    });
  });
});

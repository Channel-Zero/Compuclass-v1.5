// Pure quiz helpers shared by lecturer authoring and student attempts.
// Kept free of Supabase and React so scoring and validation can be tested
// without a screen render.

export function passingMark(quiz) {
  const score = Number(quiz?.passing_score);
  return Number.isFinite(score) ? score : 70;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// One date style for every lecturer and quiz screen: "12 Oct 2026".
// UTC keeps a stored timestamp on the same calendar day in tests and previews.
export function formatShortDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

const PLURALS = { quiz: 'quizzes', class: 'classes' };

export function plural(count, singular, pluralForm) {
  const amount = Number(count) || 0;
  const word = amount === 1 ? singular : (pluralForm || PLURALS[singular] || `${singular}s`);
  return `${amount} ${word}`;
}

// quiz_questions.options is jsonb. Live rows have been stored as a string
// array, a JSON string, or objects with a text/label field. Students submit
// the visible label, which is what submit_quiz_attempt compares.
export function normalizeOptions(options) {
  let list = options;
  if (typeof list === 'string') {
    const trimmed = list.trim();
    if (!trimmed) return [];
    try {
      list = JSON.parse(trimmed);
    } catch {
      return [trimmed];
    }
  }
  if (!Array.isArray(list)) return [];
  return list.map((option) => {
    if (typeof option === 'string') return option.trim();
    if (option && typeof option === 'object') {
      const label = option.text ?? option.label ?? option.option ?? option.value;
      return label == null ? '' : String(label).trim();
    }
    return option == null ? '' : String(option).trim();
  }).filter((label) => label.length > 0);
}

export function questionCount(quiz) {
  if (Number.isInteger(quiz?.question_count)) return quiz.question_count;
  if (Array.isArray(quiz?.quiz_questions)) return quiz.quiz_questions.length;
  return 0;
}

// Drop blank options and point correctAnswer at the kept list. A question
// needs two filled options and a correct one that is not blank.
export function prepareQuestionsForSave(questions) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return { ok: false, message: 'Please add at least one question.' };
  }
  const cleaned = [];
  for (let i = 0; i < questions.length; i += 1) {
    const source = questions[i] || {};
    const question = String(source.question || '').trim();
    const label = `Question ${i + 1}`;
    if (!question) return { ok: false, message: `${label} needs text.` };
    const raw = Array.isArray(source.options) ? source.options : [];
    const options = [];
    let correctAnswer = null;
    raw.forEach((option, index) => {
      const text = String(option || '').trim();
      if (!text) return;
      if (index === source.correctAnswer) correctAnswer = options.length;
      options.push(text);
    });
    if (options.length < 2) return { ok: false, message: `${label} needs at least two answer options.` };
    if (correctAnswer == null) return { ok: false, message: `${label}: mark a correct answer that isn't blank.` };
    cleaned.push({
      ...source,
      question,
      options,
      correctAnswer,
    });
  }
  return { ok: true, questions: cleaned };
}

// Live save_quiz rejects a practice quiz unless every question type is
// 'mcq' or 'true_false'. The editor and the AI generator label that same
// question 'multiple-choice', which PostgREST returns as a 400.
const SAVE_QUIZ_TYPES = {
  mcq: 'mcq',
  'multiple-choice': 'mcq',
  multiple_choice: 'mcq',
  'true/false': 'true_false',
  'true-false': 'true_false',
  true_false: 'true_false',
  boolean: 'true_false',
};

export function canonicalQuestionType(type) {
  if (type == null || String(type).trim() === '') return 'mcq';
  return SAVE_QUIZ_TYPES[String(type).trim().toLowerCase()] || null;
}

export const TRUE_FALSE_OPTIONS = ['True', 'False'];

export function withQuestionType(question, type) {
  const source = question || {};
  if (canonicalQuestionType(type) === 'true_false') {
    return {
      ...source,
      type: 'true_false',
      options: [...TRUE_FALSE_OPTIONS],
      correctAnswer: source.correctAnswer === 1 ? 1 : 0,
    };
  }
  const current = Array.isArray(source.options) ? source.options.map((option) => String(option ?? '')) : [];
  const options = current.length >= 4 ? current.slice(0, 4) : [...current, '', '', '', ''].slice(0, 4);
  const correctAnswer = Number.isInteger(source.correctAnswer) ? source.correctAnswer : 0;
  return { ...source, type: 'multiple-choice', options, correctAnswer };
}

// quiz_questions stores option labels plus correct_answer text. The editors
// want a correctAnswer index and either four choices or True/False.
export function editorQuestionsFromStored(rows) {
  return (Array.isArray(rows) ? rows : []).map((row, index) => {
    const storedType = canonicalQuestionType(row?.type) === 'true_false' ? 'true_false' : 'multiple-choice';
    const labels = normalizeOptions(row?.options);
    const correctText = String(row?.correct_answer ?? '').trim();
    let correctAnswer = labels.findIndex((label) => label === correctText);
    if (correctAnswer < 0 && storedType === 'true_false') {
      correctAnswer = correctText.toLowerCase() === 'false' ? 1 : 0;
    }
    if (correctAnswer < 0) correctAnswer = 0;
    return withQuestionType({
      id: row?.id || `stored-${index}`,
      question: row?.question || '',
      options: labels,
      correctAnswer,
      difficulty: row?.difficulty || 'medium',
      timeLimitSeconds: row?.time_limit_seconds ?? null,
      topic: row?.topic || '',
    }, storedType);
  });
}

function optionText(option) {
  if (typeof option === 'string') return option.trim();
  if (option && typeof option === 'object') {
    const label = option.option_text ?? option.text ?? option.label ?? option.value ?? '';
    return String(label).trim();
  }
  return option == null ? '' : String(option).trim();
}

// replace_quiz_questions reads options as objects with option_text and
// is_correct, and counts the correct flags. A string array plus
// correct_answer never marks an option, so the save fails after the type check.
export function questionsPayloadForSave(questions) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return { ok: false, message: 'Please add at least one question.' };
  }
  const rows = [];
  for (let i = 0; i < questions.length; i += 1) {
    const source = questions[i] || {};
    const label = `Question ${i + 1}`;
    const type = canonicalQuestionType(source.type);
    if (!type) {
      return { ok: false, message: `${label} must be multiple choice or true/false.` };
    }
    const raw = Array.isArray(source.options) ? source.options : [];
    const options = [];
    raw.forEach((option, index) => {
      const text = optionText(option);
      if (!text) return;
      options.push({ option_text: text, is_correct: index === source.correctAnswer });
    });
    if (options.length < 2) return { ok: false, message: `${label} needs at least two answer options.` };
    if (options.filter((option) => option.is_correct).length !== 1) {
      return { ok: false, message: `${label}: mark exactly one correct answer.` };
    }
    const row = {
      question: String(source.question || '').trim(),
      type,
      options,
      order_index: i,
    };
    if (source.points != null) row.points = source.points;
    if (source.image_url) row.image_url = source.image_url;
    const topic = String(source.topic || '').trim();
    if (topic) row.topic = topic.slice(0, 80);
    rows.push(row);
  }
  return { ok: true, questions: rows };
}

export function advanceQuiz({ questions, index, answers, selected, timeLeft }) {
  const list = Array.isArray(questions) ? questions : [];
  const current = list[index];
  if (!current) return { status: 'idle', answers: answers || [], index };
  const nextAnswers = [...(Array.isArray(answers) ? answers : []), {
    question_id: current.id,
    selected_answer: selected ?? null,
    time_remaining_seconds: current.time_limit_seconds ? timeLeft : null,
  }];
  if (index + 1 < list.length) {
    return { status: 'next', answers: nextAnswers, index: index + 1 };
  }
  return { status: 'submit', answers: nextAnswers, index };
}

function numericScore(value) {
  if (value == null || value === '') return null;
  const score = Number(value);
  return Number.isFinite(score) ? score : null;
}

export function bestScoresByQuiz(attempts) {
  const best = {};
  (Array.isArray(attempts) ? attempts : []).forEach((attempt) => {
    if (!attempt?.quiz_id) return;
    const score = numericScore(attempt.score);
    if (score == null) return;
    const previous = best[attempt.quiz_id];
    if (previous == null || score > previous) best[attempt.quiz_id] = score;
  });
  return best;
}

export function summarizeQuizAttempts(attempts) {
  const rows = (Array.isArray(attempts) ? attempts : []).filter((attempt) => numericScore(attempt?.score) != null);
  if (rows.length === 0) return { count: 0, average: null, best: null };
  const scores = rows.map((attempt) => numericScore(attempt.score));
  const average = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  return { count: rows.length, average, best: Math.max(...scores) };
}

// Students who have not taken a quiz are left out. Counting them as 0%
// makes a class of one finisher and many new students look like it is failing.
export function summarizeClassProgress(progressData) {
  const rows = Object.values(progressData || {});
  const attempted = rows.filter((row) => (row?.quizzesCompleted || 0) > 0 && numericScore(row?.averageScore) != null);
  if (attempted.length === 0) return { average: null, attempted: 0, total: rows.length };
  const total = attempted.reduce((sum, row) => sum + numericScore(row.averageScore), 0);
  return { average: Math.round(total / attempted.length), attempted: attempted.length, total: rows.length };
}

export function classAverageScore(progressData) {
  return summarizeClassProgress(progressData).average;
}

export function classAverageCaption(summary) {
  if (!summary || summary.average == null) return 'No attempts yet';
  return `${summary.average}% average across ${plural(summary.attempted, 'student')} who attempted`;
}

export function progressFromAttempts(attempts, materialCount = 0) {
  const scored = (Array.isArray(attempts) ? attempts : []).filter((attempt) => numericScore(attempt?.score) != null);
  const materials = Number(materialCount) || 0;
  if (scored.length === 0) {
    return { quizzesCompleted: 0, averageScore: null, materialsViewed: materials, lastActivity: null };
  }
  const averageScore = Math.round(scored.reduce((sum, attempt) => sum + numericScore(attempt.score), 0) / scored.length);
  const times = scored
    .map((attempt) => new Date(attempt.completed_at).getTime())
    .filter((time) => !Number.isNaN(time));
  const lastActivity = times.length ? formatShortDate(new Date(Math.max(...times)).toISOString()) : null;
  return { quizzesCompleted: scored.length, averageScore, materialsViewed: materials, lastActivity };
}

// Sample and AI quizzes often pin the correct choice on A. Move it when it
// sits in the first slot so the letter varies. A lecturer's own mark is left
// alone when it is already somewhere else.
export function spreadCorrectAnswer(options, correctIndex) {
  const list = Array.isArray(options) ? options.map((option) => option) : [];
  const index = Number(correctIndex);
  if (list.length < 2 || !Number.isInteger(index) || index < 0 || index >= list.length) {
    return { options: list, correctIndex: index };
  }
  if (index !== 0) return { options: list, correctIndex: index };
  const [first, ...rest] = list;
  return { options: [...rest, first], correctIndex: list.length - 1 };
}

export function uniqueIds(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

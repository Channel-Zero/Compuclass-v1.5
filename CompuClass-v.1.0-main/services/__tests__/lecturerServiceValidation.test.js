import { lecturerService } from '../lecturerService';
import { supabase } from '../../config/supabase';

jest.mock('../aiService', () => ({ aiService: {} }));
jest.mock('../../config/supabase', () => {
  const inserted = [];
  const state = { questionRows: { data: [], error: null } };
  const table = (name) => ({
    insert: jest.fn((row) => {
      inserted.push({ table: name, row });
      const rows = Array.isArray(row) ? row.map((r, i) => ({ id: `q${i}`, ...r })) : { id: 'new-id', ...row };
      const result = { data: rows, error: null };
      return { select: () => ({ single: async () => result, then: (res) => Promise.resolve(result).then(res) }) };
    }),
    select: jest.fn(() => ({
      eq: () => ({
        order: async () => state.questionRows,
      }),
    })),
  });
  return {
    supabase: {
      __inserted: inserted,
      get __questionRows() { return state.questionRows; },
      set __questionRows(value) { state.questionRows = value; },
      auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'lecturer-1' } } })) },
      from: jest.fn(table),
      rpc: jest.fn(async () => ({ data: '11111111-1111-1111-1111-111111111111', error: null })),
      storage: { from: () => ({ upload: jest.fn(async () => ({ error: null })), getPublicUrl: () => ({ data: { publicUrl: 'https://x/documents/f' } }) }) },
    },
  };
});

beforeEach(() => {
  supabase.__inserted.length = 0;
  supabase.__questionRows = { data: [], error: null };
  supabase.rpc.mockClear();
  supabase.rpc.mockImplementation(async () => ({ data: '11111111-1111-1111-1111-111111111111', error: null }));
  supabase.from.mockClear();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

describe('lecturerService input validation', () => {
  it('rejects a folder name containing a script tag and never writes it', async () => {
    await expect(lecturerService.createFolder('<script>alert("x")</script>', '')).rejects.toThrow("Folder name can't contain HTML or script code.");
    expect(supabase.from).not.toHaveBeenCalledWith('folders');
    expect(supabase.__inserted).toHaveLength(0);
  });

  it('rejects a class name with an event-handler payload', async () => {
    await expect(lecturerService.createClass('<img src=x onerror=alert(1)>')).rejects.toThrow(/can't contain HTML/);
    expect(supabase.__inserted).toHaveLength(0);
  });

  it('stores a SQL-like string as literal, trimmed text', async () => {
    await lecturerService.createFolder("  x'; DROP TABLE folders;--  ", 'desc');
    expect(supabase.__inserted[0].row).toEqual({ name: "x'; DROP TABLE folders;--", description: 'desc', lecturer_id: 'lecturer-1' });
  });

  it('stores a class id only when the lecturer picked a class', async () => {
    await lecturerService.createFolder('Notes', 'desc', 'class-1');
    expect(supabase.__inserted[0].row).toEqual({ name: 'Notes', description: 'desc', lecturer_id: 'lecturer-1', class_id: 'class-1' });
  });

  it('rejects blank quiz questions instead of saving an empty quiz', async () => {
    await expect(
      lecturerService.createQuiz('f1', 'Quiz', [{ question: '', options: ['', '', '', ''], correctAnswer: 0 }])
    ).rejects.toThrow('Question 1 is required.');
    expect(supabase.__inserted).toHaveLength(0);
  });

  it('rejects a quiz whose correct answer is blank', async () => {
    await expect(
      lecturerService.createQuiz('f1', 'Quiz', [{ question: 'Q?', options: ['A', 'B', '', ''], correctAnswer: 3 }])
    ).rejects.toThrow(/mark a correct answer/);
  });

  it('allows code in question text (rendered as plain text) and saves cleaned values', async () => {
    await lecturerService.createQuiz('f1', 'HTML basics', [
      { question: ' What does <p> do? ', options: ['Paragraph ', 'Picture', 'Port', 'Page'], correctAnswer: 0 },
    ]);
    expect(supabase.from).not.toHaveBeenCalledWith('quizzes');
    expect(supabase.from).not.toHaveBeenCalledWith('quiz_questions');
    expect(supabase.rpc).toHaveBeenCalledWith('save_quiz', {
      p_quiz_id: null,
      p_title: 'HTML basics',
      p_type: 'practice',
      p_folder_id: 'f1',
      p_questions: [
        expect.objectContaining({
          question: 'What does <p> do?',
          correct_answer: 'Paragraph',
          order_index: 0,
          options: ['Paragraph', 'Picture', 'Port', 'Page'],
        }),
      ],
    });
    const payload = supabase.rpc.mock.calls.find((call) => call[0] === 'save_quiz')[1].p_questions[0];
    expect(payload).not.toHaveProperty('lecturer_id');
    expect(payload).not.toHaveProperty('points');
  });

  it('sanitises uploaded file names so they cannot escape the user folder', async () => {
    global.fetch = jest.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(1) }));
    await lecturerService.uploadDocument('f1', { name: '../../other-user/evil.pdf', uri: 'file://x', mimeType: 'application/pdf', size: 1 }, 'Notes');
    expect(supabase.__inserted[0].row.file_name).toBe('evil.pdf');
    expect(supabase.__inserted[0].row.file_url).toMatch(/^lecturer-1\/\d+_evil\.pdf$/);
    expect(supabase.__inserted[0].row.lecturer_id).toBe('lecturer-1');
  });

  it('does not upload when nobody is signed in', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
    global.fetch = jest.fn();
    await expect(
      lecturerService.uploadDocument('f1', { name: 'notes.pdf', uri: 'file://x', mimeType: 'application/pdf', size: 1 }, 'Notes')
    ).rejects.toThrow();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(supabase.__inserted).toHaveLength(0);
  });

  it('uses the quiz uuid from save_quiz and loads question ids for timer settings', async () => {
    supabase.__questionRows = { data: [{ id: 'qq-0', order_index: 0 }], error: null };
    const quiz = await lecturerService.createQuiz('f1', 'Timers', [{
      question: 'Q?',
      options: ['A', 'B'],
      correctAnswer: 0,
      timeLimitSeconds: 20,
      difficulty: 'hard',
    }]);
    expect(quiz).toEqual({
      id: '11111111-1111-1111-1111-111111111111',
      title: 'Timers',
      folder_id: 'f1',
      type: 'practice',
    });
    expect(supabase.from).toHaveBeenCalledWith('quiz_questions');
    expect(supabase.rpc).toHaveBeenCalledWith('set_question_gamification_settings', {
      p_question_id: 'qq-0',
      p_time_limit_seconds: 20,
      p_difficulty: 'hard',
    });
  });

  it('keeps the saved quiz when question ids cannot be loaded', async () => {
    supabase.__questionRows = { data: null, error: { message: 'not readable' } };
    const quiz = await lecturerService.createQuiz('f1', 'Timers', [{
      question: 'Q?',
      options: ['A', 'B'],
      correctAnswer: 0,
      timeLimitSeconds: 15,
    }]);
    expect(quiz.id).toBe('11111111-1111-1111-1111-111111111111');
    expect(supabase.rpc).not.toHaveBeenCalledWith('set_question_gamification_settings', expect.anything());
  });

  it('calls assign_quiz_to_classes with the live argument list', async () => {
    await lecturerService.shareQuizToClasses('quiz-1', ['class-1', 'class-2']);
    expect(supabase.rpc).toHaveBeenCalledWith('assign_quiz_to_classes', {
      p_quiz_id: 'quiz-1',
      p_class_ids: ['class-1', 'class-2'],
      p_due_at: null,
      p_closes_at: null,
      p_attempt_limit: 3,
      p_late_penalty_percent: 10,
      p_time_limit_seconds: null,
    });
  });

  it('rejects an invalid student email before querying', async () => {
    await expect(lecturerService.addStudent('not-an-email')).rejects.toThrow('Please enter a valid email address.');
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});

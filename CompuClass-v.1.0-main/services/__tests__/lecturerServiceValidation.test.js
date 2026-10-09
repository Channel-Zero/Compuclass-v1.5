import { lecturerService } from '../lecturerService';
import { supabase } from '../../config/supabase';

jest.mock('../aiService', () => ({ aiService: {} }));
jest.mock('../../config/supabase', () => {
  const inserted = [];
  const table = (name) => ({
    insert: jest.fn((row) => {
      inserted.push({ table: name, row });
      const rows = Array.isArray(row) ? row.map((r, i) => ({ id: `q${i}`, ...r })) : { id: 'new-id', ...row };
      const result = { data: rows, error: null };
      return { select: () => ({ single: async () => result, then: (res) => Promise.resolve(result).then(res) }) };
    }),
  });
  return {
    supabase: {
      __inserted: inserted,
      auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'lecturer-1' } } })) },
      from: jest.fn(table),
      rpc: jest.fn(async () => ({ data: [], error: null })),
      storage: { from: () => ({ upload: jest.fn(async () => ({ error: null })), getPublicUrl: () => ({ data: { publicUrl: 'https://x/documents/f' } }) }) },
    },
  };
});

beforeEach(() => {
  supabase.__inserted.length = 0;
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
    const questionRows = supabase.__inserted.find((i) => i.table === 'quiz_questions').row;
    expect(questionRows[0]).toMatchObject({ question: 'What does <p> do?', correct_answer: 'Paragraph' });
  });

  it('sanitises uploaded file names so they cannot escape the user folder', async () => {
    global.fetch = jest.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(1) }));
    await lecturerService.uploadDocument('f1', { name: '../../other-user/evil.pdf', uri: 'file://x', mimeType: 'application/pdf', size: 1 }, 'Notes');
    expect(supabase.__inserted[0].row.file_name).toBe('evil.pdf');
  });

  it('rejects an invalid student email before querying', async () => {
    await expect(lecturerService.addStudent('not-an-email')).rejects.toThrow('Please enter a valid email address.');
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});

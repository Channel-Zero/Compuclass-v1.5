import { supabase } from '../../config/supabase';
import { lecturerService } from '../lecturerService';

jest.mock('../../config/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
  },
}));

function tableResult(result) {
  const chain = {
    select: jest.fn(() => chain),
    in: jest.fn(() => Promise.resolve(result)),
    upsert: jest.fn(() => Promise.resolve({ error: null })),
  };
  return chain;
}

describe('lecturerService.addStudent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws when no class is selected', async () => {
    await expect(lecturerService.addStudent('student@compuclass.test')).rejects.toThrow(
      'Choose a class before adding a student'
    );
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('throws when the email is not a registered student', async () => {
    supabase.rpc.mockResolvedValue({ data: [{ id: 's1', email: 'other@compuclass.test' }], error: null });

    await expect(
      lecturerService.addStudent('missing@compuclass.test', 'class-1')
    ).rejects.toThrow('No registered student found with email: missing@compuclass.test');
  });

  it('enrolls a matching student into the chosen class', async () => {
    supabase.rpc.mockResolvedValue({
      data: [{ id: 's1', email: 'Student@CompuClass.test' }],
      error: null,
    });
    const classStudents = tableResult({ error: null });
    supabase.from.mockReturnValue(classStudents);

    const found = await lecturerService.addStudent('student@compuclass.test', 'class-1');

    expect(found.id).toBe('s1');
    expect(supabase.from).toHaveBeenCalledWith('class_students');
    expect(classStudents.upsert).toHaveBeenCalledWith(
      [expect.objectContaining({ class_id: 'class-1', student_id: 's1' })],
      { onConflict: 'class_id,student_id', ignoreDuplicates: true }
    );
  });
});

describe('lecturerService.getStudentProgress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('averages the best score per quiz instead of every retake', async () => {
    supabase.rpc.mockResolvedValue({
      data: [{ id: 's1', email: 'student@compuclass.test' }],
      error: null,
    });
    supabase.from.mockImplementation((table) => {
      if (table === 'quiz_attempts') {
        return tableResult({
          data: [
            { user_id: 's1', quiz_id: 'q1', score: 40, completed_at: '2026-10-01T00:00:00.000Z' },
            { user_id: 's1', quiz_id: 'q1', score: 80, completed_at: '2026-10-02T00:00:00.000Z' },
            { user_id: 's1', quiz_id: 'q2', score: 60, completed_at: '2026-10-03T00:00:00.000Z' },
          ],
          error: null,
        });
      }
      return tableResult({
        data: [{ user_id: 's1', created_at: '2026-10-04T00:00:00.000Z' }],
        error: null,
      });
    });

    const progress = await lecturerService.getStudentProgress();

    expect(progress.s1.quizzesCompleted).toBe(2);
    expect(progress.s1.averageScore).toBe(70);
    expect(progress.s1.materialsViewed).toBe(1);
  });
});

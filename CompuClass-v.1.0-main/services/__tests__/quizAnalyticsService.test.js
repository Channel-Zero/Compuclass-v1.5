import { lecturerService } from '../lecturerService';
import { supabase } from '../../config/supabase';

jest.mock('../aiService', () => ({ aiService: {} }));
jest.mock('../../config/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
    auth: { getUser: jest.fn() },
  },
}));

function chain(result) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    order: () => builder,
    single: () => Promise.resolve(result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

describe('lecturer quiz analytics reads', () => {
  beforeEach(() => {
    supabase.rpc.mockReset();
    supabase.from.mockReset();
    supabase.auth.getUser.mockReset();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('uses get_lecturer_quiz_analytics when the database has it', async () => {
    supabase.rpc.mockResolvedValue({
      data: { quizzes: [{ id: 'quiz-1', title: 'CPU', questions: [], attempts: [] }] },
      error: null,
    });
    const report = await lecturerService.getQuizAnalytics();
    expect(supabase.rpc).toHaveBeenCalledWith('get_lecturer_quiz_analytics');
    expect(report.quizzes).toHaveLength(1);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('reads class-scoped tables when the analytics function is not installed', async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { code: 'PGRST202', message: 'Could not find the function public.get_lecturer_quiz_analytics' },
    });
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'lecturer-1' } } });
    supabase.from.mockImplementation((table) => {
      if (table === 'classes') {
        return chain({ data: [{ id: 'class-1', class_students: [{ count: 1 }] }], error: null });
      }
      if (table === 'class_students') {
        return chain({ data: [{ student_id: 's1', joined_at: '2026-10-01' }], error: null });
      }
      if (table === 'profiles') {
        return chain({ data: [{ id: 's1', full_name: 'Thandi Nkosi' }], error: null });
      }
      if (table === 'quizzes') {
        return chain({ data: [{ id: 'quiz-1', title: 'CPU', passing_score: 70 }], error: null });
      }
      if (table === 'quiz_assignments') return chain({ data: [], error: null });
      if (table === 'quiz_questions') {
        return chain({
          data: [{ id: 'q1', quiz_id: 'quiz-1', question: 'What is RAM?', topic: 'Memory', order_index: 0 }],
          error: null,
        });
      }
      if (table === 'quiz_attempts') {
        return chain({
          data: [
            { id: 'a1', quiz_id: 'quiz-1', user_id: 's1', score: 40, completed_at: '2026-10-02', status: 'graded' },
            { id: 'a2', quiz_id: 'quiz-1', user_id: 'other', score: 90, completed_at: '2026-10-02', status: 'graded' },
          ],
          error: null,
        });
      }
      if (table === 'quiz_answers') {
        return chain({
          data: [{ attempt_id: 'a1', question_id: 'q1', is_correct: false, selected_option_id: null, short_answer_text: 'Disk' }],
          error: null,
        });
      }
      if (table === 'quiz_options') return chain({ data: [], error: null });
      return chain({ data: [], error: null });
    });

    const report = await lecturerService.getQuizAnalytics();
    expect(report.quizzes).toHaveLength(1);
    expect(report.quizzes[0].attempts.map((attempt) => attempt.user_id)).toEqual(['s1']);
    expect(report.quizzes[0].attempts[0].answers[0]).toMatchObject({
      selected: 'Disk',
      is_correct: false,
    });
  });
});

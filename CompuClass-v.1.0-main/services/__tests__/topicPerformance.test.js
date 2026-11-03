import { supabase } from '../../config/supabase';
import { authService } from '../authService';
import { circuitMazeService } from '../circuitMazeService';

jest.mock('../../config/supabase', () => ({
  supabase: { rpc: jest.fn(), from: jest.fn() },
}));

jest.mock('../authService', () => ({
  authService: { getCurrentUser: jest.fn() },
}));

describe('circuit maze topic performance', () => {
  beforeEach(() => {
    supabase.rpc.mockReset();
    supabase.from.mockReset();
    authService.getCurrentUser.mockResolvedValue({ id: 'user-1' });
  });

  it('reads topic stats through get_topic_performance, not a schema-qualified table', async () => {
    supabase.rpc.mockResolvedValue({
      data: [{ topic: 'hardware', difficulty: 'easy', correct_count: 2, wrong_count: 1 }],
      error: null,
    });

    const map = await circuitMazeService.getTopicPerformance();

    expect(supabase.rpc).toHaveBeenCalledWith('get_topic_performance');
    expect(supabase.from).not.toHaveBeenCalled();
    expect(map).toEqual({ hardware: { easy: { correct_count: 2, wrong_count: 1 } } });
  });

  it('returns null when the stats call fails', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'missing' } });
    await expect(circuitMazeService.getTopicPerformance()).resolves.toBeNull();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('records an answer with record_answer_result', async () => {
    supabase.rpc.mockResolvedValue({ error: null });
    await circuitMazeService.recordAnswerResult('hardware', 'easy', true);
    expect(supabase.rpc).toHaveBeenCalledWith('record_answer_result', {
      p_topic: 'hardware',
      p_difficulty: 'easy',
      p_correct: true,
    });
  });
});

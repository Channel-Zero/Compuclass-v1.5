import { circuitMazeService } from '../circuitMazeService';
import { gameRunnerService } from '../gameRunnerService';
import { supabase } from '../../config/supabase';

jest.mock('../../config/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
  },
}));

jest.mock('../authService', () => ({
  authService: {
    getCurrentUser: jest.fn(async () => ({ id: 'student-1', profile: { full_name: 'Ada' } })),
  },
}));

function insertChain() {
  return { insert: jest.fn(async () => ({ error: null })) };
}

describe('member-only room joins', () => {
  beforeEach(() => {
    supabase.rpc.mockReset();
    supabase.from.mockReset();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('joins a maze room through join_circuit_maze_room and does not list rooms', async () => {
    supabase.rpc.mockResolvedValue({ data: { id: 'room-1', code: 'AB12CD', status: 'waiting' }, error: null });
    const players = insertChain();
    supabase.from.mockImplementation((table) => (table === 'circuit_maze_players' ? players : insertChain()));

    const room = await circuitMazeService.joinRoom(' ab12cd ');

    expect(room.id).toBe('room-1');
    expect(supabase.rpc).toHaveBeenCalledWith('join_circuit_maze_room', { p_code: 'AB12CD' });
    expect(supabase.from).not.toHaveBeenCalledWith('circuit_maze_rooms');
    expect(players.insert).toHaveBeenCalledWith({
      room_id: 'room-1',
      user_id: 'student-1',
      full_name: 'Ada',
    });
  });

  it('joins a runner room from a jsonb string and reads the leaderboard from the function', async () => {
    supabase.rpc.mockImplementation(async (name) => {
      if (name === 'join_game_runner_room') {
        return { data: JSON.stringify({ id: 'room-2', code: 'ZZ99ZZ', status: 'waiting' }), error: null };
      }
      if (name === 'get_runner_leaderboard') {
        return { data: [{ full_name: 'Ada', score: 40 }], error: null };
      }
      return { data: null, error: { message: 'unexpected' } };
    });
    const players = insertChain();
    supabase.from.mockReturnValue(players);

    const room = await gameRunnerService.joinRoom('zz99zz');
    const board = await gameRunnerService.getLeaderboard();

    expect(room.id).toBe('room-2');
    expect(supabase.from).not.toHaveBeenCalledWith('game_runner_rooms');
    expect(supabase.from).not.toHaveBeenCalledWith('game_scores');
    expect(board).toEqual([{ score: 40, profiles: { full_name: 'Ada' } }]);
  });

  it('stops when the join function cannot see a waiting room', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'Room not found or already started' } });

    await expect(circuitMazeService.joinRoom('MISSING')).rejects.toThrow('Room not found or already started');
    expect(supabase.from).not.toHaveBeenCalled();
  });
});

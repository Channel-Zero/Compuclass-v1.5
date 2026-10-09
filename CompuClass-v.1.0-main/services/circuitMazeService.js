import { supabase } from '../config/supabase';
import { authService } from './authService';
import { AppError } from '../utils/errorMessages';

// Generate a random 6-char room code
const makeCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

export const circuitMazeService = {
  // ── XP ──────────────────────────────────────────────────────────────────
  async awardXp(xp) {
    try {
      if (xp <= 0) return null;
      const { data, error } = await supabase.rpc('award_maze_xp', { p_xp: xp });
      if (error) throw error;
      const user = await authService.getCurrentUser();
      if (user) {
        await supabase.from('circuit_maze_sessions').insert({
          user_id: user.id,
          xp_earned: xp,
          finished: false,
          finish_bonus: 0,
        });
      }
      return data;
    } catch (e) {
      console.error('awardXp error:', e.message);
      return null;
    }
  },

  // ── Multiplayer: host creates a room ────────────────────────────────────
  async createRoom() {
    try {
      const user = await authService.getCurrentUser();
      const code = makeCode();
      const { data: room, error } = await supabase
        .from('circuit_maze_rooms')
        .insert({ code, host_id: user.id, status: 'waiting' })
        .select()
        .single();
      if (error) throw error;

      // Host joins as first player
      await supabase.from('circuit_maze_players').insert({
        room_id: room.id,
        user_id: user.id,
        full_name: user.profile?.full_name || 'Host',
      });
      return room;
    } catch (e) {
      console.error('createRoom error:', e.message);
      return null;
    }
  },

  // ── Multiplayer: guest joins by code ────────────────────────────────────
  async joinRoom(code) {
    try {
      const user = await authService.getCurrentUser();
      const { data: room, error } = await supabase
        .from('circuit_maze_rooms')
        .select('*')
        .eq('code', code.toUpperCase())
        .eq('status', 'waiting')
        .single();
      if (error || !room) throw new AppError('Room not found or already started');

      const { error: joinErr } = await supabase.from('circuit_maze_players').insert({
        room_id: room.id,
        user_id: user.id,
        full_name: user.profile?.full_name || 'Player',
      });
      if (joinErr && !joinErr.message.includes('duplicate')) throw joinErr;
      return room;
    } catch (e) {
      console.error('joinRoom error:', e.message);
      throw e;
    }
  },

  // ── Start game (host only) ───────────────────────────────────────────────
  async startRoom(roomId) {
    const { error } = await supabase
      .from('circuit_maze_rooms')
      .update({ status: 'playing' })
      .eq('id', roomId);
    if (error) console.error('startRoom error:', error.message);
  },

  // ── Push local player state to Supabase ─────────────────────────────────
  async pushPlayerState(roomId, userId, { position, hearts, xp, finished, finishRank }) {
    const { error } = await supabase
      .from('circuit_maze_players')
      .update({
        position,
        hearts,
        xp,
        finished,
        finish_rank: finishRank ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('room_id', roomId)
      .eq('user_id', userId);
    if (error) console.error('pushPlayerState error:', error.message);
  },

  // ── Subscribe to room players (Realtime) ────────────────────────────────
  subscribeToRoom(roomId, onPlayersChange, onRoomChange) {
    const channel = supabase
      .channel(`maze-room-${roomId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'circuit_maze_players', filter: `room_id=eq.${roomId}` },
        () => onPlayersChange()
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'circuit_maze_rooms', filter: `id=eq.${roomId}` },
        (payload) => onRoomChange(payload.new)
      )
      .subscribe();
    return channel;
  },

  unsubscribe(channel) {
    if (channel) supabase.removeChannel(channel);
  },

  // ── Fetch all players in a room ──────────────────────────────────────────
  async getRoomPlayers(roomId) {
    const { data, error } = await supabase
      .from('circuit_maze_players')
      .select('*')
      .eq('room_id', roomId)
      .order('xp', { ascending: false });
    if (error) return [];
    return data;
  },

  // ── Adaptive difficulty: record a question result ────────────────────────
  async recordAnswerResult(topic, difficulty, correct) {
    try {
      await supabase.rpc('record_answer_result', {
        p_topic: topic,
        p_difficulty: difficulty,
        p_correct: correct,
      });
    } catch (e) {
      console.error('recordAnswerResult error:', e.message);
    }
  },

  // ── Adaptive difficulty: fetch performance map for current user ──────────
  async getTopicPerformance() {
    try {
      const user = await authService.getCurrentUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from('gamification.topic_performance')
        .select('topic, difficulty, correct_count, wrong_count')
        .eq('user_id', user.id);
      if (error) return null;
      // Shape: { [topic]: { [difficulty]: { correct_count, wrong_count } } }
      const map = {};
      for (const row of data) {
        if (!map[row.topic]) map[row.topic] = {};
        map[row.topic][row.difficulty] = {
          correct_count: row.correct_count,
          wrong_count:   row.wrong_count,
        };
      }
      return map;
    } catch (e) {
      console.error('getTopicPerformance error:', e.message);
      return null;
    }
  },

  // ── Count finishers to assign rank ──────────────────────────────────────
  async getFinishRank(roomId) {
    const { count } = await supabase
      .from('circuit_maze_players')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId)
      .eq('finished', true);
    return (count || 0) + 1;
  },
};

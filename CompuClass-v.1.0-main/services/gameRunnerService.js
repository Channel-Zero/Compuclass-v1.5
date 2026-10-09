import { supabase } from '../config/supabase';
import { authService } from './authService';
import { AppError } from '../utils/errorMessages';

// Generate a random 6-char room code
const makeCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

export const gameRunnerService = {
  // ── Multiplayer: host creates a room ────────────────────────────────────
  async createRoom() {
    try {
      const user = await authService.getCurrentUser();
      const code = makeCode();
      const { data: room, error } = await supabase
        .from('game_runner_rooms')
        .insert({ code, host_id: user.id, status: 'waiting' })
        .select()
        .single();
      if (error) throw error;

      // Host joins as first player
      await supabase.from('game_runner_players').insert({
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
      const cleanCode = code.trim().toUpperCase();
      const { data: room, error } = await supabase
        .from('game_runner_rooms')
        .select('*')
        .eq('code', cleanCode)
        .eq('status', 'waiting')
        .single();
      if (error || !room) {
        console.error('joinRoom lookup failed:', { cleanCode, error, userId: user?.id });
        throw new AppError('Room not found or already started');
      }

      const { error: joinErr } = await supabase.from('game_runner_players').insert({
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
      .from('game_runner_rooms')
      .update({ status: 'playing' })
      .eq('id', roomId);
    if (error) console.error('startRoom error:', error.message);
  },

  // ── Push local player state to Supabase ─────────────────────────────────
  async pushPlayerState(roomId, userId, { lane, score, lives, finished, finishRank }) {
    const { error } = await supabase
      .from('game_runner_players')
      .update({
        lane,
        score,
        lives,
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
      .channel(`runner-room-${roomId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'game_runner_players', filter: `room_id=eq.${roomId}` },
        () => onPlayersChange()
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'game_runner_rooms', filter: `id=eq.${roomId}` },
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
      .from('game_runner_players')
      .select('*')
      .eq('room_id', roomId)
      .order('score', { ascending: false });
    if (error) return [];
    return data;
  },

  // ── Count finishers to assign rank ──────────────────────────────────────
  async getFinishRank(roomId) {
    const { count } = await supabase
      .from('game_runner_players')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId)
      .eq('finished', true);
    return (count || 0) + 1;
  },
};

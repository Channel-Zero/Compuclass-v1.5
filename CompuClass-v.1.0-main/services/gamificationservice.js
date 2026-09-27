import { supabase } from '../config/supabase';

const DEFAULT_STATS = {
  xp: 0,
  level: 1,
  current_streak: 0,
  longest_streak: 0,
  xp_for_current_level: 0,
  xp_for_next_level: 100,
};

export const gamificationService = {
  async getMyStats() {
    try {
      const { data, error } = await supabase.rpc('get_my_stats');
      if (error) throw error;
      // RPCs returning TABLE come back as an array of rows
      return data?.[0] || DEFAULT_STATS;
    } catch (error) {
      console.error('❌ Get my stats error:', error.message);
      return DEFAULT_STATS;
    }
  },

  async getMyBadges() {
    try {
      const { data, error } = await supabase.rpc('get_my_badges');
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Get my badges error:', error.message);
      return [];
    }
  },

  async getLeaderboard(classId = null) {
    try {
      const { data, error } = await supabase.rpc('get_leaderboard', { p_class_id: classId });
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Get leaderboard error:', error.message);
      return [];
    }
  },
};
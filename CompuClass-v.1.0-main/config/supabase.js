import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { buildSupabaseClient, readSupabasePublicConfig } from './supabaseClient';

const supabaseConfig = readSupabasePublicConfig();

if (!supabaseConfig.configured) {
  console.warn('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY.');
}

const supabase = buildSupabaseClient(supabaseConfig, createClient, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export { supabase, supabaseConfig };

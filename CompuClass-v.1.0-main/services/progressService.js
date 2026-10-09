import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';
import { mergeTroubleshootingProgress } from '../utils/troubleshootingLab';

// Keys stored for the signed-in person. The maze and chat keys match the
// AsyncStorage keys already cleared on sign-out.
export const PROGRESS_KEYS = {
  pcAssembly: 'pc_assembly',
  pcLab: 'pc_lab',
  circuitMaze: 'circuitMazeProgress:v1',
  compuRunner: 'compurunner',
  compuBot: 'compubot_chat_history',
  troubleshooting: 'troubleshooting_lab',
};

export const MAX_PROGRESS_BYTES = 100 * 1024;
const META_KEY = 'progress_updated_at';
const DEBOUNCE_MS = 400;
const timers = new Map();

function byteLength(text) {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length;
  return text.length;
}

export function fitsAccountProgress(value) {
  try {
    return byteLength(JSON.stringify(value)) < MAX_PROGRESS_BYTES;
  } catch {
    return false;
  }
}

// Latest updated_at wins. A tie keeps the local copy. A side with no
// timestamp loses to a side that has one.
export function mergeByUpdatedAt(local, remote) {
  if (!local && !remote) return null;
  if (!remote) return local;
  if (!local) return remote;
  const localTime = Date.parse(local.updated_at);
  const remoteTime = Date.parse(remote.updated_at);
  const localOk = local.updated_at && !Number.isNaN(localTime);
  const remoteOk = remote.updated_at && !Number.isNaN(remoteTime);
  if (!localOk && remoteOk) return remote;
  if (!remoteOk && localOk) return local;
  if (!localOk && !remoteOk) return local;
  return remoteTime > localTime ? remote : local;
}

// Account chat keeps the last 50 messages and drops image data, which can
// be a large base64 payload. The copy on this device can still hold the image.
export function stripChatForAccount(messages) {
  return (Array.isArray(messages) ? messages : []).slice(-50).map((message) => {
    if (!message || typeof message !== 'object') return message;
    const rest = { ...message };
    delete rest.image;
    return rest;
  });
}

function accountValue(key, value) {
  if (key === PROGRESS_KEYS.compuBot) return stripChatForAccount(value);
  return value;
}

function remoteAllowed() {
  if (progressService._remote) return true;
  return !process.env.JEST_WORKER_ID;
}

function parseStored(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

async function readMeta() {
  try {
    const raw = await AsyncStorage.getItem(META_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeMeta(key, updatedAt) {
  const meta = await readMeta();
  meta[key] = updatedAt;
  await AsyncStorage.setItem(META_KEY, JSON.stringify(meta));
}

function client() {
  return progressService._remote || supabase;
}

async function currentUserId() {
  const { data: { user } } = await client().auth.getUser();
  return user?.id || null;
}

async function writeRemote(key, value, updatedAt) {
  const stored = accountValue(key, value);
  if (!fitsAccountProgress(stored) || !updatedAt) return;
  const userId = await currentUserId();
  if (!userId) return;
  await client().from('user_progress').upsert({
    user_id: userId,
    key,
    value: stored,
    updated_at: updatedAt,
  }, { onConflict: 'user_id,key' });
}

function scheduleRemote(key, value, updatedAt) {
  if (!remoteAllowed()) return;
  const pending = timers.get(key);
  if (pending) clearTimeout(pending);
  timers.set(key, setTimeout(() => {
    timers.delete(key);
    writeRemote(key, value, updatedAt).catch(() => {});
  }, DEBOUNCE_MS));
}

async function localEnvelope(key) {
  const meta = await readMeta();
  if (key === PROGRESS_KEYS.compuRunner) {
    const raw = await AsyncStorage.getItem(PROGRESS_KEYS.compuRunner);
    const legacy = await AsyncStorage.getItem('compurunner_highscore');
    const parsed = raw == null ? null : parseStored(raw);
    const legacyScore = legacy ? parseInt(legacy, 10) : 0;
    const highScore = Math.max(Number(parsed?.highScore) || 0, Number.isNaN(legacyScore) ? 0 : legacyScore);
    const unlockedIds = Array.isArray(parsed?.unlockedIds) ? parsed.unlockedIds : [];
    if (!parsed && !highScore) return null;
    return { value: { highScore, unlockedIds }, updated_at: meta[key] || null };
  }
  const raw = await AsyncStorage.getItem(key);
  if (raw == null) return null;
  return { value: parseStored(raw), updated_at: meta[key] || null };
}

export const progressService = {
  // Tests inject a fake client. Production uses the shared Supabase client.
  _remote: null,

  async get(key) {
    try {
      const local = await localEnvelope(key);
      if (local) return local.value;
      if (!remoteAllowed()) return null;
      const userId = await currentUserId();
      if (!userId) return null;
      const { data, error } = await client()
        .from('user_progress')
        .select('value, updated_at')
        .eq('user_id', userId)
        .eq('key', key)
        .maybeSingle();
      if (error || !data) return null;
      await AsyncStorage.setItem(key, JSON.stringify(data.value));
      if (data.updated_at) await writeMeta(key, data.updated_at);
      return data.value;
    } catch {
      return null;
    }
  },

  async set(key, value) {
    const updatedAt = new Date().toISOString();
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
      await writeMeta(key, updatedAt);
    } catch {
      return;
    }
    scheduleRemote(key, value, updatedAt);
  },
};

export async function syncProgressOnSignIn(keys = Object.values(PROGRESS_KEYS)) {
  if (!remoteAllowed()) return;
  let rows = null;
  try {
    const userId = await currentUserId();
    if (!userId) return;
    const { data, error } = await client().from('user_progress').select('key, value, updated_at').eq('user_id', userId);
    if (error) return;
    rows = Array.isArray(data) ? data : [];
  } catch {
    return;
  }

  for (const key of keys) {
    try {
      const local = await localEnvelope(key);
      const remoteRow = rows.find((row) => row.key === key);
      const remote = remoteRow ? { value: remoteRow.value, updated_at: remoteRow.updated_at } : null;
      if (key === PROGRESS_KEYS.troubleshooting) {
        if (!local && !remote) continue;
        const merged = mergeTroubleshootingProgress(local?.value, remote?.value);
        const mergedJson = JSON.stringify(merged);
        const stamp = new Date().toISOString();
        if (mergedJson !== JSON.stringify(local?.value ?? null)) {
          await AsyncStorage.setItem(key, mergedJson);
          await writeMeta(key, stamp);
        }
        if (mergedJson !== JSON.stringify(remote?.value ?? null)) {
          await writeRemote(key, merged, stamp);
        }
        continue;
      }
      const winner = mergeByUpdatedAt(local, remote);
      if (!winner) continue;
      if (winner === remote) {
        await AsyncStorage.setItem(key, JSON.stringify(winner.value));
        if (winner.updated_at) await writeMeta(key, winner.updated_at);
      } else {
        const updatedAt = winner.updated_at || new Date().toISOString();
        if (!winner.updated_at) await writeMeta(key, updatedAt);
        await writeRemote(key, winner.value, updatedAt);
      }
    } catch {
      /* keep the local copy */
    }
  }
}

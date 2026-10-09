import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Structured log of security-relevant events (failed logins, lockouts, rate
// limiting, repeated errors). This app has no backend of its own, so these
// entries live on the device: they go to the console (visible in Metro /
// logcat / browser devtools) and the most recent ones are kept in
// AsyncStorage for debugging. Server-side equivalents live in the Supabase
// dashboard (Logs -> Auth) and in the gemini-proxy Edge Function logs.

const STORAGE_KEY = 'securityLog';
const MAX_ENTRIES = 100;

let entries = null;

async function loadEntries() {
  if (entries) return entries;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    entries = raw ? JSON.parse(raw) : [];
  } catch {
    entries = [];
  }
  return entries;
}

// "student@school.edu" -> "st***@school.edu". Enough to correlate events
// without writing full addresses into logs.
export function maskEmail(email) {
  if (typeof email !== 'string' || !email.includes('@')) return undefined;
  const [local, domain] = email.trim().toLowerCase().split('@');
  return `${local.slice(0, 2)}***@${domain}`;
}

export async function logSecurityEvent(type, details = {}) {
  const entry = { type, at: new Date().toISOString(), platform: Platform.OS, ...details };
  console.warn('[SECURITY]', JSON.stringify(entry));

  try {
    const list = await loadEntries();
    list.push(entry);
    if (list.length > MAX_ENTRIES) list.splice(0, list.length - MAX_ENTRIES);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Logging must never break the action being logged.
  }
  return entry;
}

export async function getSecurityLog() {
  return [...(await loadEntries())];
}

export function __resetSecurityLogForTests() {
  entries = null;
}

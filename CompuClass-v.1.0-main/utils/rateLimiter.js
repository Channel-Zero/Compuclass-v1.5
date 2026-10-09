import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppError } from './errorMessages';
import { logSecurityEvent } from './securityLog';

// Client-side throttling. This is defence in depth, NOT the security boundary:
// someone scripting requests straight at Supabase bypasses the app entirely.
// The real server-side limits are Supabase Auth's rate limits (Dashboard ->
// Authentication -> Rate Limits) and the limits inside the gemini-proxy Edge
// Function. What this does add: honest users and runaway UI loops can't
// hammer the backend, and a stolen/shared device can't brute-force an account
// through the app. State is persisted so restarting the app doesn't reset it.

const STORAGE_PREFIX = 'rateLimit:';

export function formatWait(ms) {
  const seconds = Math.max(1, Math.ceil(ms / 1000));
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

export class RateLimitError extends AppError {
  constructor(retryAfterMs, message) {
    super(message || `Too many attempts. Please wait ${formatWait(retryAfterMs)} and try again.`);
    this.name = 'RateLimitError';
    this.status = 429;
    this.retryAfterMs = retryAfterMs;
  }
}

function createStore(name) {
  const cache = new Map();
  const storageKey = (key) => `${STORAGE_PREFIX}${name}:${key}`;

  return {
    async get(key, initial) {
      if (cache.has(key)) return cache.get(key);
      let state = initial();
      try {
        const raw = await AsyncStorage.getItem(storageKey(key));
        if (raw) state = { ...state, ...JSON.parse(raw) };
      } catch {
        // Storage unavailable: fall back to in-memory only.
      }
      cache.set(key, state);
      return state;
    },
    async set(key, state) {
      cache.set(key, state);
      try { await AsyncStorage.setItem(storageKey(key), JSON.stringify(state)); } catch {}
    },
    async clear(key) {
      cache.delete(key);
      try { await AsyncStorage.removeItem(storageKey(key)); } catch {}
    },
  };
}

const normalizeKey = (key) => String(key ?? 'device').trim().toLowerCase();

// Failure-based lockout, for things like wrong passwords or wrong OTP codes.
// After `maxFailures` failures inside `windowMs`, the key is locked for
// `lockoutMs`; each further lockout doubles, up to `maxLockoutMs`.
// Successful attempts call reset().
export function createAttemptLimiter({ name, maxFailures, windowMs, lockoutMs, maxLockoutMs = lockoutMs, now = () => Date.now() }) {
  const store = createStore(name);
  const initial = () => ({ failures: [], lockedUntil: 0, lockouts: 0 });

  return {
    async check(key) {
      const state = await store.get(normalizeKey(key), initial);
      const remaining = state.lockedUntil - now();
      return remaining > 0 ? { allowed: false, retryAfterMs: remaining } : { allowed: true, retryAfterMs: 0 };
    },

    async assertAllowed(key) {
      const { allowed, retryAfterMs } = await this.check(key);
      if (!allowed) throw new RateLimitError(retryAfterMs);
    },

    async recordFailure(key) {
      const k = normalizeKey(key);
      const state = await store.get(k, initial);
      const t = now();
      const failures = [...state.failures.filter((at) => t - at < windowMs), t];
      const failureCount = failures.length;
      let { lockedUntil, lockouts } = state;
      let lockedNow = false;
      if (failureCount >= maxFailures) {
        lockouts += 1;
        lockedUntil = t + Math.min(lockoutMs * 2 ** (lockouts - 1), maxLockoutMs);
        lockedNow = true;
        failures.length = 0;
      }
      await store.set(k, { failures, lockedUntil, lockouts });
      return { failures: failureCount, lockedNow, retryAfterMs: Math.max(0, lockedUntil - t), lockouts };
    },

    async reset(key) {
      await store.clear(normalizeKey(key));
    },
  };
}

// Sliding-window request limiter: at most `maxRequests` per `windowMs`, and
// optionally at least `minIntervalMs` between requests.
export function createRequestLimiter({ name, maxRequests, windowMs, minIntervalMs = 0, message, now = () => Date.now() }) {
  const store = createStore(name);
  const initial = () => ({ requests: [] });

  return {
    async consume(key) {
      const k = normalizeKey(key);
      const state = await store.get(k, initial);
      const t = now();
      const requests = state.requests.filter((at) => t - at < windowMs);
      const last = requests[requests.length - 1];

      if (last !== undefined && t - last < minIntervalMs) {
        logSecurityEvent('rate_limited', { limiter: name, reason: 'min_interval' });
        throw new RateLimitError(minIntervalMs - (t - last), message);
      }
      if (requests.length >= maxRequests) {
        logSecurityEvent('rate_limited', { limiter: name, reason: 'window_exceeded', requestsInWindow: requests.length });
        throw new RateLimitError(windowMs - (t - requests[0]), message);
      }
      requests.push(t);
      await store.set(k, { requests });
    },

    async reset(key) {
      await store.clear(normalizeKey(key));
    },
  };
}

// Limits used across the app. Kept together so they're easy to tune.
export const limiters = {
  // 5 wrong passwords in 15 min -> locked 1 min, then 2, 4, ... up to 15 min.
  login: createAttemptLimiter({ name: 'login', maxFailures: 5, windowMs: 15 * 60 * 1000, lockoutMs: 60 * 1000, maxLockoutMs: 15 * 60 * 1000 }),
  // Reset codes: 3 emails per 15 min, at least 60s apart.
  passwordResetSend: createRequestLimiter({ name: 'passwordResetSend', maxRequests: 3, windowMs: 15 * 60 * 1000, minIntervalMs: 60 * 1000 }),
  // 5 wrong codes in 15 min -> locked 5 min, doubling up to 30 min.
  passwordResetVerify: createAttemptLimiter({ name: 'passwordResetVerify', maxFailures: 5, windowMs: 15 * 60 * 1000, lockoutMs: 5 * 60 * 1000, maxLockoutMs: 30 * 60 * 1000 }),
  signUp: createRequestLimiter({ name: 'signUp', maxRequests: 5, windowMs: 10 * 60 * 1000 }),
  aiChat: createRequestLimiter({ name: 'aiChat', maxRequests: 10, windowMs: 60 * 1000, message: "You're sending messages too quickly. Please wait a moment and try again." }),
  aiQuiz: createRequestLimiter({ name: 'aiQuiz', maxRequests: 5, windowMs: 10 * 60 * 1000, message: 'AI quiz generation limit reached. Please wait a few minutes and try again.' }),
};

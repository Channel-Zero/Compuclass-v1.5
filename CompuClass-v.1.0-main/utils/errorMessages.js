import { logSecurityEvent } from './securityLog';

// Errors thrown on purpose by app code, whose message is safe to show as-is.
export class AppError extends Error {
  constructor(userMessage) {
    super(userMessage);
    this.name = 'AppError';
    this.userMessage = userMessage;
  }
}

export const GENERIC_ERROR = 'Something went wrong. Please try again.';
const NETWORK_ERROR = "Can't reach the server. Check your internet connection and try again.";
const RATE_LIMITED = 'Too many requests. Please wait a few minutes and try again.';

// Supabase Auth error codes whose meaning is safe (and useful) to tell the user.
const AUTH_CODE_MESSAGES = {
  invalid_credentials: 'Invalid login credentials',
  email_not_confirmed: 'Please verify your email address before signing in.',
  user_already_exists: 'An account with this email already exists.',
  email_exists: 'An account with this email already exists.',
  weak_password: 'That password is too weak. Please choose a stronger one.',
  same_password: 'Your new password must be different from your current password.',
  otp_expired: 'Invalid or expired code. Please try again.',
  over_request_rate_limit: RATE_LIMITED,
  over_email_send_rate_limit: RATE_LIMITED,
  signup_disabled: 'New sign-ups are currently disabled.',
};

// Older supabase-js versions (and some mocks) only give us a message string.
const MESSAGE_PATTERNS = [
  [/invalid login credentials/i, 'Invalid login credentials'],
  [/email not confirmed/i, AUTH_CODE_MESSAGES.email_not_confirmed],
  [/user already registered/i, AUTH_CODE_MESSAGES.user_already_exists],
  [/rate limit|too many requests/i, RATE_LIMITED],
  [/network request failed|failed to fetch|networkerror|load failed/i, NETWORK_ERROR],
  [/row-level security|permission denied/i, "You don't have permission to do that."],
];

// Postgres / PostgREST error codes.
const DB_CODE_MESSAGES = {
  23505: 'That item already exists.',
  23503: 'This item is linked to other data and cannot be changed.',
  23514: 'Some of the information entered is not valid.',
  22001: 'One of the fields is too long.',
  42501: "You don't have permission to do that.",
  PGRST116: 'The item could not be found.',
};

const REPEAT_WINDOW_MS = 60 * 1000;
const REPEAT_THRESHOLD = 5;
const recentErrors = new Map();

function trackRepeatedErrors(context) {
  const now = Date.now();
  const times = (recentErrors.get(context) || []).filter((t) => now - t < REPEAT_WINDOW_MS);
  times.push(now);
  recentErrors.set(context, times);
  if (times.length === REPEAT_THRESHOLD) {
    logSecurityEvent('repeated_errors', { context, count: times.length, windowSeconds: REPEAT_WINDOW_MS / 1000 });
  }
}

// Maps any thrown value to a message that is safe to show the user, and logs
// the full error (stack, DB details, API bodies) to the console only.
export function getErrorMessage(error, { context = 'unknown', fallback = GENERIC_ERROR } = {}) {
  console.error(`[${context}]`, error);
  trackRepeatedErrors(context);

  if (!error) return fallback;
  if (error.userMessage) return error.userMessage;
  if (error.status === 429) return RATE_LIMITED;
  if (error.code && AUTH_CODE_MESSAGES[error.code]) return AUTH_CODE_MESSAGES[error.code];
  if (error.code && DB_CODE_MESSAGES[error.code]) return DB_CODE_MESSAGES[error.code];

  const message = typeof error === 'string' ? error : error.message;
  if (typeof message === 'string') {
    const match = MESSAGE_PATTERNS.find(([pattern]) => pattern.test(message));
    if (match) return match[1];
  }
  return fallback;
}

export function __resetErrorTrackingForTests() {
  recentErrors.clear();
}

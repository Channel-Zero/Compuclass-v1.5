import { AppError } from './errorMessages';

// Input validation applied in the service layer before anything is written to
// Supabase. Two notes on what this does and doesn't need to do:
//  - SQL injection: supabase-js sends values as parameters, never as SQL, so a
//    string like "'; DROP TABLE users;--" is stored as plain text. We don't
//    reject SQL-looking text (the Databases quiz topic legitimately uses it).
//  - XSS: React Native <Text> renders strings as text, never as HTML, on both
//    native and web. We still reject markup in short name/title fields where it
//    has no legitimate use, so nothing tag-like is stored for other consumers.

export class ValidationError extends AppError {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

export const LIMITS = {
  name: 100,
  title: 200,
  description: 1000,
  question: 1000,
  option: 300,
  chatMessage: 2000,
  search: 100,
  email: 254,
  fileName: 120,
};

// Control characters (except tab/newline/CR), zero-width and bidi-override
// characters that can hide or visually reorder text.
const INVISIBLE_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;
const MARKUP = /<\s*\/?\s*[a-z!?][^>]*>|javascript\s*:|\bon[a-z]+\s*=/i;
const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i;

export function cleanText(value, { field = 'This field', maxLength, required = false, multiline = false, allowMarkup = true } = {}) {
  if (value === null || value === undefined) value = '';
  if (typeof value !== 'string') throw new ValidationError(`${field} must be text.`);

  let text = value;
  try { text = text.normalize('NFC'); } catch {}
  text = text.replace(INVISIBLE_CHARS, '');
  if (!multiline) text = text.replace(/\s+/g, ' ');
  text = text.trim();

  if (required && !text) throw new ValidationError(`${field} is required.`);
  if (maxLength && text.length > maxLength) throw new ValidationError(`${field} must be ${maxLength} characters or fewer.`);
  if (!allowMarkup && MARKUP.test(text)) throw new ValidationError(`${field} can't contain HTML or script code.`);
  return text;
}

export function cleanEmail(value, { field = 'Email' } = {}) {
  const email = cleanText(value, { field, maxLength: LIMITS.email, required: true });
  if (!EMAIL.test(email)) throw new ValidationError('Please enter a valid email address.');
  return email;
}

// Safe for use as a storage object name or a local file path segment:
// no directory separators, no "..", no reserved characters.
export function sanitizeFileName(name, fallback = 'file') {
  const base = String(name ?? '').split(/[\\/]/).pop();
  let cleaned = base
    .replace(INVISIBLE_CHARS, '')
    .replace(/[<>:"|?*\u0000-\u001F]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/^[.\s_]+/, '');

  if (cleaned.length > LIMITS.fileName) {
    const dot = cleaned.lastIndexOf('.');
    const ext = dot > 0 && cleaned.length - dot <= 10 ? cleaned.slice(dot) : '';
    cleaned = cleaned.slice(0, LIMITS.fileName - ext.length) + ext;
  }
  return cleaned || fallback;
}

// Escapes the wildcard characters of a Postgres LIKE/ILIKE pattern so user
// search text matches literally ("100%" searches for "100%", not "100...").
export function escapeLikePattern(value) {
  return String(value ?? '').replace(/[\\%_]/g, (c) => `\\${c}`);
}

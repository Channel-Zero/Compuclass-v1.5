// Password rules for new passwords (sign-up, reset, change). Existing
// passwords are never re-checked, so current users can still log in.
//
// The breached-password check uses the Have I Been Pwned "range" API with
// k-anonymity: only the first 5 hex chars of the password's SHA-1 hash leave
// the device, never the password or the full hash.

export const PASSWORD_MIN_LENGTH = 8;
// Supabase Auth hashes with bcrypt, which ignores bytes past 72.
export const PASSWORD_MAX_LENGTH = 72;

export const PASSWORD_HINT = `At least ${PASSWORD_MIN_LENGTH} characters, with upper- and lowercase letters and a number.`;

// Offline backstop for when the breach API can't be reached.
const COMMON_FRAGMENTS = ['password', 'passw0rd', 'qwerty', '123456', 'abc123', 'letmein', 'welcome', 'iloveyou', 'admin', 'compuclass'];

const HIBP_RANGE_URL = 'https://api.pwnedpasswords.com/range/';

export function checkPasswordRules(password, { email } = {}) {
  const errors = [];
  const pw = typeof password === 'string' ? password : '';

  if (pw.length < PASSWORD_MIN_LENGTH) errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
  if (utf8Encode(pw).length > PASSWORD_MAX_LENGTH) errors.push(`Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`);
  if (!/[a-z]/.test(pw)) errors.push('Password must include a lowercase letter.');
  if (!/[A-Z]/.test(pw)) errors.push('Password must include an uppercase letter.');
  if (!/[0-9]/.test(pw)) errors.push('Password must include a number.');
  if (/^\s|\s$/.test(pw)) errors.push('Password cannot start or end with a space.');

  const lower = pw.toLowerCase();
  if (COMMON_FRAGMENTS.some((f) => lower.includes(f))) errors.push('Password is too common. Please choose something less predictable.');

  const emailName = typeof email === 'string' ? email.split('@')[0].toLowerCase() : '';
  if (emailName.length >= 3 && lower.includes(emailName)) errors.push('Password cannot contain your email address.');

  return errors;
}

// Returns { pwned, count, checked }. Fails open (checked: false) on network
// problems so an outage at HIBP can't block sign-ups; the rules above still apply.
export async function checkPwnedPassword(password, { fetchImpl = globalThis.fetch, timeoutMs = 5000 } = {}) {
  let timer;
  try {
    const hash = sha1Hex(password).toUpperCase();
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const response = await Promise.race([
      fetchImpl(`${HIBP_RANGE_URL}${prefix}`, { headers: { 'Add-Padding': 'true' } }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('HIBP timeout')), timeoutMs); }),
    ]);
    if (!response.ok) throw new Error(`HIBP status ${response.status}`);

    const body = await response.text();
    for (const line of body.split('\n')) {
      const [lineSuffix, countText] = line.trim().split(':');
      const count = parseInt(countText, 10);
      // Padding entries have a count of 0.
      if (lineSuffix === suffix && count > 0) return { pwned: true, count, checked: true };
    }
    return { pwned: false, count: 0, checked: true };
  } catch (error) {
    console.warn('Breached-password check unavailable:', error?.message);
    return { pwned: false, count: 0, checked: false };
  } finally {
    clearTimeout(timer);
  }
}

// Full check for a new password. Returns a list of user-facing problems
// (empty = acceptable).
export async function validateNewPassword(password, { email, fetchImpl } = {}) {
  const errors = checkPasswordRules(password, { email });
  if (errors.length > 0) return errors;

  const { pwned } = await checkPwnedPassword(password, { fetchImpl });
  if (pwned) {
    return ['This password has appeared in a known data breach. Please choose a different one.'];
  }
  return [];
}

function utf8Encode(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
      const next = str.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        i++;
      }
    }
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
  }
  return bytes;
}

// Plain-JS SHA-1 (no native crypto module needed on Hermes). Used only for the
// HIBP lookup, which is defined in terms of SHA-1.
export function sha1Hex(str) {
  const bytes = utf8Encode(str);
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const buffer = new Uint8Array(paddedLength);
  buffer.set(bytes);
  buffer[bytes.length] = 0x80;
  const view = new DataView(buffer.buffer);
  const bitLength = bytes.length * 8;
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(paddedLength - 4, bitLength >>> 0);

  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
  const w = new Uint32Array(80);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 80; i++) {
      const x = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16];
      w[i] = (x << 1) | (x >>> 31);
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let i = 0; i < 80; i++) {
      let f, k;
      if (i < 20) { f = (b & c) | (~b & d); k = 0x5a827999; }
      else if (i < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }
      else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }
      else { f = b ^ c ^ d; k = 0xca62c1d6; }
      const temp = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) >>> 0;
      e = d; d = c; c = ((b << 30) | (b >>> 2)) >>> 0; b = a; a = temp;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
  }

  return [h0, h1, h2, h3, h4].map((h) => h.toString(16).padStart(8, '0')).join('');
}

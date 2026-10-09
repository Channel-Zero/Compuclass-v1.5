// Class join codes are 6 characters. I, O, 0 and 1 are left out so a code
// read off a screen is not easy to mistype.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function normalizeClassCode(value) {
  return String(value || '').toUpperCase().replace(/\s+/g, '');
}

export function classCodeError(value) {
  const code = normalizeClassCode(value);
  if (!code) return 'Enter the class code from your lecturer.';
  if (code.length !== 6 || [...code].some((ch) => !ALPHABET.includes(ch))) {
    return 'A class code is 6 letters and numbers, without I, O, 0 or 1.';
  }
  return null;
}

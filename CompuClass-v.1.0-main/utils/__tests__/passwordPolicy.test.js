import { createHash } from 'crypto';
import { checkPasswordRules, checkPwnedPassword, sha1Hex, validateNewPassword } from '../passwordPolicy';

const nodeSha1 = (s) => createHash('sha1').update(s, 'utf8').digest('hex');

// Fake HIBP range endpoint backed by a set of "breached" passwords.
const fakeHibp = (breached) => jest.fn(async (url, options) => {
  const prefix = url.split('/').pop();
  const lines = breached
    .map((pw) => nodeSha1(pw).toUpperCase())
    .filter((h) => h.startsWith(prefix))
    .map((h) => `${h.slice(5)}:4200`);
  lines.push('0000000000000000000000000000000000A:0'); // padding entry
  return { ok: true, text: async () => lines.join('\r\n'), options };
});

describe('sha1Hex', () => {
  it.each(['', 'abc', 'password123', 'Pässwörd-ünïcode-😀', 'x'.repeat(1000)])('matches Node crypto for %j', (input) => {
    expect(sha1Hex(input)).toBe(nodeSha1(input));
  });
});

describe('checkPasswordRules', () => {
  it('rejects "password123"', () => {
    const errors = checkPasswordRules('password123');
    expect(errors).toEqual(expect.arrayContaining([
      'Password must include an uppercase letter.',
      'Password is too common. Please choose something less predictable.',
    ]));
  });

  it.each([
    ['short', 'Ab1'],
    ['no uppercase', 'lowercase-only-9'],
    ['no lowercase', 'UPPERCASE-ONLY-9'],
    ['no number', 'No-Numbers-Here'],
  ])('rejects a password with %s', (_, pw) => {
    expect(checkPasswordRules(pw).length).toBeGreaterThan(0);
  });

  it('rejects a password containing the email name', () => {
    expect(checkPasswordRules('Thabo-Rocks-2026', { email: 'thabo@school.edu' })).toContain('Password cannot contain your email address.');
  });

  it('accepts a strong password', () => {
    expect(checkPasswordRules('Violet-Kettle-Orbit-47')).toEqual([]);
  });
});

describe('checkPwnedPassword', () => {
  it('only sends the 5-char hash prefix, never the password', async () => {
    const fetchImpl = fakeHibp([]);
    await checkPwnedPassword('Violet-Kettle-Orbit-47', { fetchImpl });
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe(`https://api.pwnedpasswords.com/range/${nodeSha1('Violet-Kettle-Orbit-47').slice(0, 5).toUpperCase()}`);
    expect(url).not.toContain('Violet');
    expect(options.headers['Add-Padding']).toBe('true');
  });

  it('detects a breached password and ignores zero-count padding rows', async () => {
    const fetchImpl = fakeHibp(['Password123']);
    expect(await checkPwnedPassword('Password123', { fetchImpl })).toEqual({ pwned: true, count: 4200, checked: true });
    expect((await checkPwnedPassword('Violet-Kettle-Orbit-47', { fetchImpl })).pwned).toBe(false);
  });

  it('fails open when the API is unreachable', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('Network request failed'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await checkPwnedPassword('Violet-Kettle-Orbit-47', { fetchImpl })).toEqual({ pwned: false, count: 0, checked: false });
  });
});

describe('validateNewPassword', () => {
  const fetchImpl = fakeHibp(['Summer2024!', 'Password123']);

  it('rejects "password123" (rules) without calling the breach API', async () => {
    const f = fakeHibp([]);
    expect((await validateNewPassword('password123', { fetchImpl: f })).length).toBeGreaterThan(0);
    expect(f).not.toHaveBeenCalled();
  });

  it('rejects a password that passes the rules but is breached', async () => {
    expect(await validateNewPassword('Summer2024!', { fetchImpl })).toEqual([
      'This password has appeared in a known data breach. Please choose a different one.',
    ]);
  });

  it('accepts a strong, unique password', async () => {
    expect(await validateNewPassword('Violet-Kettle-Orbit-47', { fetchImpl })).toEqual([]);
  });
});

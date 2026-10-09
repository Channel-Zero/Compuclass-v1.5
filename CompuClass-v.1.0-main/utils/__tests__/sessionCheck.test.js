import { sessionCheckDecision } from '../sessionCheck';

describe('sessionCheckDecision', () => {
  it('does not sign out when the session check fails because the network is down', () => {
    expect(sessionCheckDecision(new TypeError('Network request failed'))).toBe('offline');
    expect(sessionCheckDecision({ message: 'Failed to fetch' })).toBe('offline');
  });

  it('signs out when the session itself is invalid', () => {
    expect(sessionCheckDecision({ message: 'Invalid Refresh Token' })).toBe('signOut');
    expect(sessionCheckDecision({ message: 'Auth session missing' })).toBe('signOut');
    expect(sessionCheckDecision({ status: 401, message: 'unauthorized' })).toBe('signOut');
  });

  it('keeps the user signed in when the error is not an auth failure', () => {
    expect(sessionCheckDecision({ message: 'database is starting' })).toBe('offline');
  });
});

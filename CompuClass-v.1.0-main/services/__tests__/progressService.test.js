import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  MAX_PROGRESS_BYTES,
  PROGRESS_KEYS,
  fitsAccountProgress,
  mergeByUpdatedAt,
  progressService,
  stripChatForAccount,
  syncProgressOnSignIn,
} from '../progressService';

describe('mergeByUpdatedAt', () => {
  const older = { value: { installed: ['cpu'] }, updated_at: '2026-10-01T00:00:00.000Z' };
  const newer = { value: { installed: ['cpu', 'ram'] }, updated_at: '2026-10-09T00:00:00.000Z' };

  it('keeps the copy with the later updated_at', () => {
    expect(mergeByUpdatedAt(older, newer)).toBe(newer);
    expect(mergeByUpdatedAt(newer, older)).toBe(newer);
  });

  it('keeps the local copy when the timestamps are equal', () => {
    const remote = { value: { installed: ['other'] }, updated_at: newer.updated_at };
    expect(mergeByUpdatedAt(newer, remote)).toBe(newer);
  });

  it('uses the only side that exists', () => {
    expect(mergeByUpdatedAt(null, newer)).toBe(newer);
    expect(mergeByUpdatedAt(older, null)).toBe(older);
    expect(mergeByUpdatedAt(null, null)).toBeNull();
  });

  it('lets a stamped copy replace a copy with no timestamp', () => {
    expect(mergeByUpdatedAt({ value: { installed: [] }, updated_at: null }, newer)).toBe(newer);
  });
});

describe('account progress limits', () => {
  it('drops chat images and keeps the last 50 messages', () => {
    const messages = Array.from({ length: 60 }, (_, i) => ({ id: i, text: `m${i}`, image: 'data:image/jpeg;base64,AAAA' }));
    const stored = stripChatForAccount(messages);
    expect(stored).toHaveLength(50);
    expect(stored[0].id).toBe(10);
    expect(stored[49]).toEqual({ id: 59, text: 'm59' });
  });

  it('rejects a value that is 100KB or larger', () => {
    expect(fitsAccountProgress({ note: 'ok' })).toBe(true);
    expect(fitsAccountProgress({ blob: 'x'.repeat(MAX_PROGRESS_BYTES) })).toBe(false);
  });
});

describe('syncProgressOnSignIn', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    progressService._remote = null;
  });

  it('writes the newer remote progress onto this device and pushes a newer local copy', async () => {
    const upsert = jest.fn(async () => ({ error: null }));
    const rows = [
      { key: PROGRESS_KEYS.pcAssembly, value: { installed: ['cpu', 'ram'] }, updated_at: '2026-10-09T00:00:00.000Z' },
      { key: PROGRESS_KEYS.pcLab, value: { currentStep: 1, selectedComponents: ['motherboard'] }, updated_at: '2026-10-01T00:00:00.000Z' },
    ];
    progressService._remote = {
      auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
      from: () => ({
        select: () => ({ eq: async () => ({ data: rows, error: null }) }),
        upsert,
      }),
    };
    await AsyncStorage.setItem(PROGRESS_KEYS.pcAssembly, JSON.stringify({ installed: ['cpu'] }));
    await AsyncStorage.setItem('progress_updated_at', JSON.stringify({ [PROGRESS_KEYS.pcAssembly]: '2026-10-01T00:00:00.000Z' }));
    await AsyncStorage.setItem(PROGRESS_KEYS.pcLab, JSON.stringify({ currentStep: 4, selectedComponents: ['motherboard', 'cpu'] }));
    await AsyncStorage.setItem('progress_updated_at', JSON.stringify({
      [PROGRESS_KEYS.pcAssembly]: '2026-10-01T00:00:00.000Z',
      [PROGRESS_KEYS.pcLab]: '2026-10-08T00:00:00.000Z',
    }));

    await syncProgressOnSignIn([PROGRESS_KEYS.pcAssembly, PROGRESS_KEYS.pcLab]);

    expect(JSON.parse(await AsyncStorage.getItem(PROGRESS_KEYS.pcAssembly))).toEqual({ installed: ['cpu', 'ram'] });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ key: PROGRESS_KEYS.pcLab, value: { currentStep: 4, selectedComponents: ['motherboard', 'cpu'] } }),
      { onConflict: 'user_id,key' },
    );
  });
});

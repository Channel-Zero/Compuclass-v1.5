import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../config/supabase';
import { authService } from '../authService';

jest.mock('../../config/supabase', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));

describe('authService.signIn', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('stores the user and a login timestamp on success', async () => {
    const user = { id: 'user-1', email: 'student@compuclass.test' };
    supabase.auth.signInWithPassword.mockResolvedValue({ data: { user }, error: null });

    const result = await authService.signIn('student@compuclass.test', 'password123');

    expect(result.user).toEqual(user);
    expect(JSON.parse(await AsyncStorage.getItem('user'))).toEqual(user);
    expect(await AsyncStorage.getItem('loginTimestamp')).not.toBeNull();
  });

  it('throws and does not persist a user when Supabase returns an error', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: null,
      error: { message: 'Invalid login credentials' },
    });

    await expect(authService.signIn('bad@compuclass.test', 'wrong')).rejects.toEqual({
      message: 'Invalid login credentials',
    });
    expect(await AsyncStorage.getItem('user')).toBeNull();
  });
});

describe('authService.signOut', () => {
  it('clears the cached user and login timestamp', async () => {
    await AsyncStorage.setItem('user', JSON.stringify({ id: 'user-1' }));
    await AsyncStorage.setItem('loginTimestamp', Date.now().toString());
    supabase.auth.signOut.mockResolvedValue({});

    await authService.signOut();

    expect(await AsyncStorage.getItem('user')).toBeNull();
    expect(await AsyncStorage.getItem('loginTimestamp')).toBeNull();
  });
});

describe('authService.isSessionValid', () => {
  it('returns false when there is no stored timestamp', async () => {
    await AsyncStorage.clear();
    expect(await authService.isSessionValid()).toBe(false);
  });

  it('returns true for a timestamp within the last 30 minutes', async () => {
    await AsyncStorage.setItem('loginTimestamp', Date.now().toString());
    expect(await authService.isSessionValid()).toBe(true);
  });

  it('returns false once 30 minutes have elapsed', async () => {
    const thirtyOneMinutesAgo = Date.now() - 31 * 60 * 1000;
    await AsyncStorage.setItem('loginTimestamp', thirtyOneMinutesAgo.toString());
    expect(await authService.isSessionValid()).toBe(false);
  });
});

describe('authService session lifecycle (integration)', () => {
  it('a fresh sign-in produces a valid session, and sign-out invalidates it', async () => {
    const user = { id: 'user-3', email: 'flow@compuclass.test' };
    supabase.auth.signInWithPassword.mockResolvedValue({ data: { user }, error: null });
    supabase.auth.signOut.mockResolvedValue({});

    await authService.signIn('flow@compuclass.test', 'password123');
    expect(await authService.isSessionValid()).toBe(true);
    expect(await authService.getOfflineUser()).toEqual(user);

    await authService.signOut();
    expect(await authService.isSessionValid()).toBe(false);
    expect(await authService.getOfflineUser()).toBeNull();
  });
});

describe('authService.getOfflineUser', () => {
  it('returns the parsed cached user when present', async () => {
    const user = { id: 'user-2', email: 'lecturer@compuclass.test' };
    await AsyncStorage.setItem('user', JSON.stringify(user));
    expect(await authService.getOfflineUser()).toEqual(user);
  });

  it('returns null when nothing is cached', async () => {
    await AsyncStorage.clear();
    expect(await authService.getOfflineUser()).toBeNull();
  });
});

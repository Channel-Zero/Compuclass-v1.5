import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../config/supabase';
import { authService } from '../authService';

jest.mock('../../config/supabase', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      getUser: jest.fn(),
      updateUser: jest.fn(),
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

describe('authService.updatePassword', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('checks the current password before changing it', async () => {
    const order = [];
    supabase.auth.getUser.mockResolvedValue({ data: { user: { email: 'student@compuclass.test' } } });
    supabase.auth.signInWithPassword.mockImplementation(async () => {
      order.push('signIn');
      return { error: null };
    });
    supabase.auth.updateUser.mockImplementation(async () => {
      order.push('update');
      return { error: null };
    });

    await authService.updatePassword('current-secret', 'Violet-Kettle-Orbit-47');

    expect(order).toEqual(['signIn', 'update']);
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'student@compuclass.test',
      password: 'current-secret',
    });
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'Violet-Kettle-Orbit-47' });
  });

  it('does not change the password when the current one is wrong', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: { email: 'student@compuclass.test' } } });
    supabase.auth.signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } });

    await expect(authService.updatePassword('wrong', 'Violet-Kettle-Orbit-47')).rejects.toThrow('Current password is incorrect');
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
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

  it('clears chat and game progress that belongs to the signed-in user', async () => {
    await AsyncStorage.setItem('compubot_chat_history', '[]');
    await AsyncStorage.setItem('circuitMazeProgress:v1', '{}');
    await AsyncStorage.setItem('compurunner_highscore', '10');
    await AsyncStorage.setItem('notifications', 'true');
    supabase.auth.signOut.mockResolvedValue({});

    await authService.signOut();

    expect(await AsyncStorage.getItem('compubot_chat_history')).toBeNull();
    expect(await AsyncStorage.getItem('circuitMazeProgress:v1')).toBeNull();
    expect(await AsyncStorage.getItem('compurunner_highscore')).toBeNull();
    expect(await AsyncStorage.getItem('notifications')).toBe('true');
  });
});

describe('authService.signIn per-user storage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('clears the previous user progress when a different person signs in', async () => {
    await AsyncStorage.setItem('user', JSON.stringify({ id: 'user-1' }));
    await AsyncStorage.setItem('compubot_chat_history', 'old chat');
    await AsyncStorage.setItem('compurunner_highscore', '9');
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'user-2', email: 'other@compuclass.test' } },
      error: null,
    });

    await authService.signIn('other@compuclass.test', 'password123');

    expect(await AsyncStorage.getItem('compubot_chat_history')).toBeNull();
    expect(await AsyncStorage.getItem('compurunner_highscore')).toBeNull();
    expect(JSON.parse(await AsyncStorage.getItem('user')).id).toBe('user-2');
  });

  it('keeps progress when the same user signs in again', async () => {
    await AsyncStorage.setItem('user', JSON.stringify({ id: 'user-1' }));
    await AsyncStorage.setItem('compubot_chat_history', 'kept');
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'student@compuclass.test' } },
      error: null,
    });

    await authService.signIn('student@compuclass.test', 'password123');

    expect(await AsyncStorage.getItem('compubot_chat_history')).toBe('kept');
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

describe('authService.signUp', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('stores the name only and does not send a client-supplied role', async () => {
    supabase.auth.signUp.mockResolvedValue({ data: { user: { id: 'new' }, session: null }, error: null });

    await authService.signUp('new.student@compuclass.test', 'Violet-Kettle-Orbit-47', 'Test Student');

    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: 'new.student@compuclass.test',
      password: 'Violet-Kettle-Orbit-47',
      options: { data: { full_name: 'Test Student' } },
    });
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

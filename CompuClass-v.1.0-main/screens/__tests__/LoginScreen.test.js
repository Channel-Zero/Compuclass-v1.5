import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import LoginScreen from '../LoginScreen';
import { authService } from '../../services/authService';

jest.mock('../../services/authService', () => ({
  authService: { signIn: jest.fn() },
}));

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('warns instead of calling signIn when email or password is missing', () => {
    const { getByText } = render(<LoginScreen onLogin={jest.fn()} onSignUp={jest.fn()} onForgotPassword={jest.fn()} />);

    fireEvent.press(getByText('Sign In'));

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please enter email and password');
    expect(authService.signIn).not.toHaveBeenCalled();
  });

  it('signs in and calls onLogin when credentials are provided', async () => {
    authService.signIn.mockResolvedValue({ user: { id: 'user-1' } });
    const onLogin = jest.fn();
    const { getByText, getByPlaceholderText } = render(
      <LoginScreen onLogin={onLogin} onSignUp={jest.fn()} onForgotPassword={jest.fn()} />
    );

    fireEvent.changeText(getByPlaceholderText('Email address'), 'student@compuclass.test');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByText('Sign In'));

    await waitFor(() => expect(onLogin).toHaveBeenCalledTimes(1));
    expect(authService.signIn).toHaveBeenCalledWith('student@compuclass.test', 'password123');
  });

  it('shows the Supabase error message and does not call onLogin on failure', async () => {
    authService.signIn.mockRejectedValue(new Error('Invalid login credentials'));
    const onLogin = jest.fn();
    const { getByText, getByPlaceholderText } = render(
      <LoginScreen onLogin={onLogin} onSignUp={jest.fn()} onForgotPassword={jest.fn()} />
    );

    fireEvent.changeText(getByPlaceholderText('Email address'), 'student@compuclass.test');
    fireEvent.changeText(getByPlaceholderText('Password'), 'wrongpass');
    fireEvent.press(getByText('Sign In'));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Invalid login credentials')
    );
    expect(onLogin).not.toHaveBeenCalled();
  });

  describe('brute-force throttling', () => {
    const attempt = async (utils, email, password) => {
      Alert.alert.mockClear();
      fireEvent.changeText(utils.getByPlaceholderText('Email address'), email);
      fireEvent.changeText(utils.getByPlaceholderText('Password'), password);
      fireEvent.press(utils.getByText('Sign In'));
      await waitFor(() => expect(Alert.alert.mock.calls.length + utils.onLogin.mock.calls.length).toBeGreaterThan(0));
      return Alert.alert.mock.calls[0]?.[1];
    };

    const renderLogin = () => {
      const onLogin = jest.fn();
      const utils = render(<LoginScreen onLogin={onLogin} onSignUp={jest.fn()} onForgotPassword={jest.fn()} />);
      return { ...utils, onLogin };
    };

    it('blocks further attempts after 5 wrong passwords, without calling Supabase', async () => {
      authService.signIn.mockImplementation(async (email, password) => {
        if (password !== 'Correct-Horse-9') throw new Error('Invalid login credentials');
        return { user: { id: 'u' } };
      });
      const utils = renderLogin();
      const messages = [];
      for (let i = 0; i < 12; i++) {
        messages.push(await attempt(utils, 'target@compuclass.test', `wrong-${i}`));
      }

      expect(messages.slice(0, 5)).toEqual(Array(5).fill('Invalid login credentials'));
      messages.slice(5).forEach((m) => expect(m).toMatch(/Too many attempts\. Please wait/));
      // Only the first 5 requests ever reached Supabase.
      expect(authService.signIn).toHaveBeenCalledTimes(5);

      // Even the correct password is refused while the account is locked.
      expect(await attempt(utils, 'target@compuclass.test', 'Correct-Horse-9')).toMatch(/Too many attempts/);
      expect(utils.onLogin).not.toHaveBeenCalled();
    });

    it('still lets a different account sign in straight away', async () => {
      authService.signIn.mockResolvedValue({ user: { id: 'u2' } });
      const utils = renderLogin();
      await attempt(utils, 'other-student@compuclass.test', 'Correct-Horse-9');
      expect(utils.onLogin).toHaveBeenCalledTimes(1);
    });

    it('lets the locked account sign in once the lockout has expired', async () => {
      authService.signIn.mockResolvedValue({ user: { id: 'u' } });
      const realNow = Date.now;
      Date.now = () => realNow() + 61 * 1000;
      try {
        const utils = renderLogin();
        await attempt(utils, 'target@compuclass.test', 'Correct-Horse-9');
        expect(utils.onLogin).toHaveBeenCalledTimes(1);
      } finally {
        Date.now = realNow;
      }
    });
  });
});

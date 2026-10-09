import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import SignUpScreen from '../SignUpScreen';
import { authService } from '../../services/authService';
import { ThemeProvider } from '../../context/ThemeContext';
import { limiters } from '../../utils/rateLimiter';

const renderScreen = (ui) => render(ui, { wrapper: ThemeProvider });

jest.mock('../../services/authService', () => ({
  authService: { signUp: jest.fn() },
}));

const fill = (utils, { name = 'Test Student', email = 'new.student@compuclass.test', password, confirm = password }) => {
  fireEvent.changeText(utils.getByPlaceholderText('Full Name'), name);
  fireEvent.changeText(utils.getByPlaceholderText('Email address'), email);
  fireEvent.changeText(utils.getByPlaceholderText('Password'), password);
  fireEvent.changeText(utils.getByPlaceholderText('Confirm Password'), confirm);
  fireEvent.press(utils.getAllByText('Sign Up').pop());
};

describe('SignUpScreen password policy', () => {
  // Jest's own 5s limit matches the breach-check timer and waitFor, so a cold
  // first run can be killed while validation is still finishing.
  jest.setTimeout(15000);

  beforeEach(async () => {
    jest.useRealTimers();
    jest.clearAllTimers();
    jest.clearAllMocks();
    // The sign-up limiter lives in a module Map. A previous run in this worker
    // can still be inside the 5-request window and fail the next attempt.
    await limiters.signUp.reset('device');
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    // Resolve immediately so the 5s breach-check timer cannot tie with waitFor.
    global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => '' });
    authService.signUp.mockResolvedValue({ user: { id: 'new' } });
  });

  afterEach(async () => {
    jest.clearAllTimers();
    jest.useRealTimers();
    await limiters.signUp.reset('device');
    jest.restoreAllMocks();
  });

  it('rejects "password123" and never creates the account', async () => {
    const utils = renderScreen(<SignUpScreen onSignUp={jest.fn()} onBackToLogin={jest.fn()} />);
    fill(utils, { password: 'password123' });

    // Generous timeout: validation is async and CI machines running suites in parallel can be slow.
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Choose a stronger password', expect.stringContaining('uppercase')), { timeout: 5000 });
    expect(authService.signUp).not.toHaveBeenCalled();
  });

  it('accepts a strong unique password and creates the account', async () => {
    const onSignUp = jest.fn();
    const onBackToLogin = jest.fn();
    const utils = renderScreen(<SignUpScreen onSignUp={onSignUp} onBackToLogin={onBackToLogin} />);
    fill(utils, { password: 'Violet-Kettle-Orbit-47' });

    await waitFor(() => expect(authService.signUp).toHaveBeenCalledWith('new.student@compuclass.test', 'Violet-Kettle-Orbit-47', 'Test Student'), { timeout: 5000 });
    // No session means email confirmation is still required, so the user is not signed in.
    expect(Alert.alert).toHaveBeenCalledWith(
      'Verify your email',
      'Account created! Check your email to verify it, then sign in.',
      [{ text: 'OK', onPress: onBackToLogin }]
    );
    expect(onSignUp).not.toHaveBeenCalled();
  });

  it('shows Success and continues when signup already returns a session', async () => {
    authService.signUp.mockResolvedValue({ user: { id: 'new' }, session: { access_token: 'token' } });
    const onSignUp = jest.fn();
    const onBackToLogin = jest.fn();
    const utils = renderScreen(<SignUpScreen onSignUp={onSignUp} onBackToLogin={onBackToLogin} />);
    fill(utils, { password: 'Violet-Kettle-Orbit-47' });

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Success', 'Account created!', [{ text: 'OK', onPress: onSignUp }]), { timeout: 5000 });
    expect(onBackToLogin).not.toHaveBeenCalled();
  });

  it('shows the password requirements up front', () => {
    const utils = renderScreen(<SignUpScreen onSignUp={jest.fn()} onBackToLogin={jest.fn()} />);
    expect(utils.getByText(/At least 8 characters/)).toBeTruthy();
  });
});

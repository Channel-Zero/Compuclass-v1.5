import React from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import LoginScreen from '../../screens/LoginScreen';
import { authService } from '../../services/authService';
import { getSecurityLog, maskEmail, __resetSecurityLogForTests } from '../securityLog';
import { getErrorMessage, __resetErrorTrackingForTests } from '../errorMessages';
import { createRequestLimiter } from '../rateLimiter';

jest.mock('../../services/authService', () => ({ authService: { signIn: jest.fn() } }));

const securityLines = () => console.warn.mock.calls.filter(([tag]) => tag === '[SECURITY]').map(([, json]) => JSON.parse(json));

beforeEach(async () => {
  await AsyncStorage.clear();
  __resetSecurityLogForTests();
  __resetErrorTrackingForTests();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('suspicious activity logging', () => {
  it('logs each failed login with timestamp and context, then the lockout', async () => {
    authService.signIn.mockRejectedValue(new Error('Invalid login credentials'));
    const utils = render(<LoginScreen onLogin={jest.fn()} onSignUp={jest.fn()} onForgotPassword={jest.fn()} />);

    for (let i = 0; i < 5; i++) {
      Alert.alert.mockClear();
      fireEvent.changeText(utils.getByPlaceholderText('Email address'), 'lecturer.smith@compuclass.test');
      fireEvent.changeText(utils.getByPlaceholderText('Password'), `Wrong-Guess-${i}`);
      fireEvent.press(utils.getByText('Sign In'));
      await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    }

    const lines = securityLines();
    const failed = lines.filter((l) => l.type === 'login_failed');
    expect(failed).toHaveLength(5);
    failed.forEach((l, i) => {
      expect(new Date(l.at).toString()).not.toBe('Invalid Date');
      expect(l).toMatchObject({ email: 'le***@compuclass.test', recentFailures: i + 1, platform: expect.any(String) });
    });
    expect(lines.find((l) => l.type === 'login_lockout')).toMatchObject({ email: 'le***@compuclass.test', lockoutSeconds: 60, lockoutNumber: 1 });

    // Persisted for later inspection, and never contains passwords or full emails.
    const stored = await getSecurityLog();
    expect(stored.filter((e) => e.type === 'login_failed')).toHaveLength(5);
    const everything = JSON.stringify(console.warn.mock.calls) + JSON.stringify(stored);
    expect(everything).not.toMatch(/Wrong-Guess|lecturer\.smith@/);
  });

  it('logs repeated errors from the same place', () => {
    for (let i = 0; i < 5; i++) getErrorMessage(new Error('boom'), { context: 'loadFolders' });
    expect(securityLines()).toEqual([expect.objectContaining({ type: 'repeated_errors', context: 'loadFolders', count: 5 })]);
  });

  it('logs when a request limiter blocks', async () => {
    const limiter = createRequestLimiter({ name: 'aiChat-test', maxRequests: 1, windowMs: 60_000 });
    await limiter.consume('device');
    await expect(limiter.consume('device')).rejects.toThrow();
    expect(securityLines()).toEqual([expect.objectContaining({ type: 'rate_limited', limiter: 'aiChat-test', reason: 'window_exceeded' })]);
  });

  it('masks emails', () => {
    expect(maskEmail(' Student.One@School.EDU ')).toBe('st***@school.edu');
    expect(maskEmail('not-an-email')).toBeUndefined();
  });
});

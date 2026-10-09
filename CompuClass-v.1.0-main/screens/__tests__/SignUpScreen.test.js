import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import SignUpScreen from '../SignUpScreen';
import { authService } from '../../services/authService';

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
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    // No breach hits for the strong password.
    global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => '' });
    authService.signUp.mockResolvedValue({ user: { id: 'new' } });
  });

  it('rejects "password123" and never creates the account', async () => {
    const utils = render(<SignUpScreen onSignUp={jest.fn()} onBackToLogin={jest.fn()} />);
    fill(utils, { password: 'password123' });

    // Generous timeout: validation is async and CI machines running suites in parallel can be slow.
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Choose a stronger password', expect.stringContaining('uppercase')), { timeout: 5000 });
    expect(authService.signUp).not.toHaveBeenCalled();
  });

  it('accepts a strong unique password and creates the account', async () => {
    const utils = render(<SignUpScreen onSignUp={jest.fn()} onBackToLogin={jest.fn()} />);
    fill(utils, { password: 'Violet-Kettle-Orbit-47' });

    await waitFor(() => expect(authService.signUp).toHaveBeenCalledWith('new.student@compuclass.test', 'Violet-Kettle-Orbit-47', 'Test Student', 'student'), { timeout: 5000 });
    expect(Alert.alert).toHaveBeenCalledWith('Success', expect.any(String), expect.any(Array));
  });

  it('shows the password requirements up front', () => {
    const utils = render(<SignUpScreen onSignUp={jest.fn()} onBackToLogin={jest.fn()} />);
    expect(utils.getByText(/At least 8 characters/)).toBeTruthy();
  });
});

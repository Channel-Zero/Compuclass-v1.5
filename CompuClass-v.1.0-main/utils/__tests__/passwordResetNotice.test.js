import { PASSWORD_RESET_GENERIC_MESSAGE, passwordResetSendOutcome } from '../passwordResetNotice';

describe('passwordResetSendOutcome', () => {
  it('uses the same message when the email exists', () => {
    expect(passwordResetSendOutcome(null)).toEqual({
      advance: true,
      message: PASSWORD_RESET_GENERIC_MESSAGE,
    });
  });

  it('uses the same message when the email does not exist', () => {
    expect(passwordResetSendOutcome({ message: 'Signups not allowed for otp' })).toEqual({
      advance: true,
      message: 'If an account exists, we sent a code',
    });
  });

  it('does not hide a different send failure', () => {
    expect(passwordResetSendOutcome({ message: 'Network request failed' }).advance).toBe(false);
  });
});

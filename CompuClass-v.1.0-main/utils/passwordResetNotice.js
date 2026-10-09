export const PASSWORD_RESET_GENERIC_MESSAGE = 'If an account exists, we sent a code';

// A missing account and a successful send must look the same. Other failures
// (rate limit, network) stay visible.
export function passwordResetSendOutcome(error) {
  if (!error || error.message === 'Signups not allowed for otp') {
    return { advance: true, message: PASSWORD_RESET_GENERIC_MESSAGE };
  }
  return { advance: false, message: null };
}

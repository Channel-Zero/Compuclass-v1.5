import React, { useState } from 'react';
import { Text } from 'react-native';
import { authService } from '../services/authService';
import { limiters, RateLimitError } from '../utils/rateLimiter';
import { getErrorMessage } from '../utils/errorMessages';
import { logSecurityEvent, maskEmail } from '../utils/securityLog';
import { cleanEmail } from '../utils/inputValidation';
import { useTheme } from '../context/ThemeContext';
import AuthLayout, { AuthLink } from '../components/ui/AuthLayout';
import { Button, Field, font } from '../components/ui/kit';

const isCredentialFailure = (error) =>
  error?.code === 'invalid_credentials' || /invalid login credentials/i.test(error?.message || '');

export default function LoginScreen({ onLogin, onSignUp, onForgotPassword }) {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const showError = (message) => setFormError(message || 'Something went wrong. Please try again.');
  const clearError = () => { if (formError) setFormError(''); };

  const handleLogin = async () => {
    if (!email || !password) { showError('Please enter email and password'); return; }
    let trimmedEmail;
    try {
      trimmedEmail = cleanEmail(email);
    } catch (error) {
      showError(getErrorMessage(error, { context: 'login' }));
      return;
    }
    setFormError('');
    setLoading(true);
    try {
      const { allowed, retryAfterMs } = await limiters.login.check(trimmedEmail);
      if (!allowed) {
        logSecurityEvent('login_blocked_locked_out', { email: maskEmail(trimmedEmail), retryAfterSeconds: Math.ceil(retryAfterMs / 1000) });
        throw new RateLimitError(retryAfterMs);
      }
      await authService.signIn(trimmedEmail, password);
      await limiters.login.reset(trimmedEmail);
      onLogin();
    } catch (error) {
      if (isCredentialFailure(error)) {
        const result = await limiters.login.recordFailure(trimmedEmail);
        logSecurityEvent('login_failed', { email: maskEmail(trimmedEmail), recentFailures: result.failures });
        if (result.lockedNow) {
          logSecurityEvent('login_lockout', { email: maskEmail(trimmedEmail), lockoutSeconds: Math.ceil(result.retryAfterMs / 1000), lockoutNumber: result.lockouts });
        }
      }
      showError(getErrorMessage(error, { context: 'login' }));
    } finally { setLoading(false); }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to pick up your lessons, quizzes and streak."
      footer={<AuthLink prefix="New to CompuClass?" label="Create an account" onPress={onSignUp} />}
    >
      <Field label="Email address" icon="mail" placeholder="Email address" value={email} onChangeText={(value) => { setEmail(value); clearError(); }} keyboardType="email-address" autoCapitalize="none" />
      <Field label="Password" icon="lock" placeholder="Password" value={password} onChangeText={(value) => { setPassword(value); clearError(); }} secure secureVisible={showPassword} onToggleSecure={() => setShowPassword((v) => !v)} />
      {formError ? <Text testID="form-error" accessibilityRole="alert" style={[{ color: theme.errorInk, fontSize: 14, lineHeight: 20, marginBottom: 8 }, font(theme, 'semibold')]}>{formError}</Text> : null}
      <Button label="Forgot password?" variant="text" onPress={onForgotPassword} style={{ alignSelf: 'flex-end', marginTop: -8, marginBottom: 8, maxWidth: undefined, width: undefined }} />
      <Button label={loading ? 'Signing in...' : 'Sign in'} onPress={handleLogin} disabled={loading} block />
    </AuthLayout>
  );
}

import React, { useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { authService } from '../services/authService';
import { validateNewPassword, PASSWORD_HINT, PASSWORD_MAX_LENGTH } from '../utils/passwordPolicy';
import { cleanText, cleanEmail, LIMITS } from '../utils/inputValidation';
import { getErrorMessage } from '../utils/errorMessages';
import { limiters } from '../utils/rateLimiter';
import { useTheme } from '../context/ThemeContext';
import AuthLayout, { AuthLink } from '../components/ui/AuthLayout';
import { Button, Field, Sheet, Body, font } from '../components/ui/kit';

const LEGAL = {
  terms: {
    title: 'Terms of Service',
    body: 'CompuClass is a learning tool for your class. Use your own account, keep your password private, and follow your school\'s rules when you use the labs, quizzes and games. Your lecturer can see the work you submit for class.',
  },
  privacy: {
    title: 'Privacy Policy',
    body: 'CompuClass stores the name and email you sign up with, plus your quiz scores, badges and class membership, so your progress can be shown to you and your lecturer. You can export that data from Settings. We do not sell it.',
  },
};

export default function SignUpScreen({ onSignUp, onBackToLogin }) {
  const { theme } = useTheme();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [legal, setLegal] = useState(null);
  const [formError, setFormError] = useState('');

  const showError = (message) => setFormError(message || 'Something went wrong. Please try again.');
  const clearError = () => { if (formError) setFormError(''); };

  const handleSignUp = async () => {
    if (!fullName || !email || !password || !confirmPassword) { showError('Please fill in all fields'); return; }
    if (password !== confirmPassword) { showError('Passwords do not match'); return; }
    setFormError('');
    setLoading(true);
    try {
      const cleanName = cleanText(fullName, { field: 'Full name', maxLength: LIMITS.name, required: true, allowMarkup: false });
      const cleanedEmail = cleanEmail(email);
      const passwordProblems = await validateNewPassword(password, { email: cleanedEmail });
      if (passwordProblems.length > 0) { showError(passwordProblems.join('\n')); return; }
      await limiters.signUp.consume('device');
      const { session } = await authService.signUp(cleanedEmail, password, cleanName);
      if (session) {
        Alert.alert('Success', 'Account created!', [{ text: 'OK', onPress: onSignUp }]);
      } else {
        Alert.alert('Verify your email', 'Account created! Check your email to verify it, then sign in.', [{ text: 'OK', onPress: onBackToLogin }]);
      }
    } catch (error) { showError(getErrorMessage(error, { context: 'signUp' })); }
    finally { setLoading(false); }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start with your class account. New accounts are students."
      footer={<AuthLink prefix="Already have an account?" label="Sign in" onPress={onBackToLogin} />}
    >
      <Field label="Full name" icon="user" placeholder="Full Name" value={fullName} onChangeText={(value) => { setFullName(value); clearError(); }} autoCapitalize="words" />
      <Field label="Email address" icon="mail" placeholder="Email address" value={email} onChangeText={(value) => { setEmail(value); clearError(); }} keyboardType="email-address" />
      <Field label="Password" icon="lock" placeholder="Password" value={password} onChangeText={(value) => { setPassword(value); clearError(); }} secure secureVisible={showPassword} onToggleSecure={() => setShowPassword((v) => !v)} maxLength={PASSWORD_MAX_LENGTH} hint={PASSWORD_HINT} />
      <Field label="Confirm password" icon="lock" placeholder="Confirm Password" value={confirmPassword} onChangeText={(value) => { setConfirmPassword(value); clearError(); }} secure secureVisible={showConfirm} onToggleSecure={() => setShowConfirm((v) => !v)} />
      {formError ? <Text testID="form-error" accessibilityRole="alert" style={[{ color: theme.errorInk, fontSize: 14, lineHeight: 20, marginBottom: 8 }, font(theme, 'semibold')]}>{formError}</Text> : null}
      <Button label={loading ? 'Creating account...' : 'Create account'} onPress={handleSignUp} disabled={loading} block />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignSelf: 'stretch', marginTop: 16 }}>
        <Text style={[{ fontSize: 12, lineHeight: 16, color: theme.textTertiary }, font(theme, 'body')]}>By creating an account you agree to the </Text>
        <Pressable onPress={() => setLegal('terms')} accessibilityRole="button" accessibilityLabel="Terms of Service" style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={[{ fontSize: 12, color: theme.primary }, font(theme, 'semibold')]}>Terms of Service</Text>
        </Pressable>
        <Text style={[{ fontSize: 12, lineHeight: 16, color: theme.textTertiary }, font(theme, 'body')]}> and </Text>
        <Pressable onPress={() => setLegal('privacy')} accessibilityRole="button" accessibilityLabel="Privacy Policy" style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={[{ fontSize: 12, color: theme.primary }, font(theme, 'semibold')]}>Privacy Policy</Text>
        </Pressable>
      </View>
      <Sheet visible={!!legal} onClose={() => setLegal(null)} title={legal ? LEGAL[legal].title : ''}>
        <Body>{legal ? LEGAL[legal].body : ''}</Body>
      </Sheet>
    </AuthLayout>
  );
}

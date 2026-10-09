import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../config/supabase';
import { limiters, RateLimitError } from '../utils/rateLimiter';
import { getErrorMessage } from '../utils/errorMessages';
import { logSecurityEvent, maskEmail } from '../utils/securityLog';
import { validateNewPassword, PASSWORD_HINT, PASSWORD_MAX_LENGTH } from '../utils/passwordPolicy';

const BLUE = '#2563EB'; const WHITE = '#FFFFFF'; const BG = '#F3F4F6';
const TEXT = '#111827'; const MUTED = '#4B5563'; const BORDER = '#E5E7EB';

export default function ForgotPasswordScreen({ onBackToLogin }) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSendCode = async () => {
    if (!email.trim()) { Alert.alert('Error', 'Please enter your email'); return; }
    setLoading(true);
    try {
      await limiters.passwordResetSend.consume(email.trim());
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error, { context: 'passwordResetSend' }));
      setLoading(false);
      return;
    }
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false } });
      if (error) throw error;
      Alert.alert('Code Sent', `A 6-digit code has been sent to ${email}`);
      setStep(2);
    } catch (error) {
      Alert.alert('Error', error.message === 'Signups not allowed for otp' ? 'No account found with this email' : getErrorMessage(error, { context: 'passwordResetSend' }));
    } finally { setLoading(false); }
  };

  const handleVerifyCode = async () => {
    if (!code.trim()) { Alert.alert('Error', 'Please enter the code'); return; }
    setLoading(true);
    try {
      const { allowed, retryAfterMs } = await limiters.passwordResetVerify.check(email);
      if (!allowed) {
        logSecurityEvent('password_reset_verify_blocked_locked_out', { email: maskEmail(email), retryAfterSeconds: Math.ceil(retryAfterMs / 1000) });
        throw new RateLimitError(retryAfterMs);
      }
      const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
      if (error) throw error;
      await limiters.passwordResetVerify.reset(email);
      setStep(3);
    } catch (error) {
      if (error instanceof RateLimitError) {
        Alert.alert('Error', error.userMessage);
      } else {
        getErrorMessage(error, { context: 'passwordResetVerify' });
        const result = await limiters.passwordResetVerify.recordFailure(email);
        logSecurityEvent('password_reset_code_failed', { email: maskEmail(email), recentFailures: result.failures });
        if (result.lockedNow) {
          logSecurityEvent('password_reset_lockout', { email: maskEmail(email), lockoutSeconds: Math.ceil(result.retryAfterMs / 1000) });
          Alert.alert('Error', new RateLimitError(result.retryAfterMs).userMessage);
        } else {
          Alert.alert('Error', 'Invalid or expired code. Please try again.');
        }
      }
    }
    finally { setLoading(false); }
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) { Alert.alert('Error', 'Please fill all fields'); return; }
    if (newPassword !== confirmPassword) { Alert.alert('Error', 'Passwords do not match'); return; }
    setLoading(true);
    try {
      const passwordProblems = await validateNewPassword(newPassword, { email });
      if (passwordProblems.length > 0) { Alert.alert('Choose a stronger password', passwordProblems.join('\n')); return; }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      await supabase.auth.signOut();
      Alert.alert('Success', 'Password reset successfully! Please log in.', [{ text: 'OK', onPress: onBackToLogin }]);
    } catch (error) { Alert.alert('Error', getErrorMessage(error, { context: 'passwordReset' })); }
    finally { setLoading(false); }
  };

  const stepLabels = ['Enter your email to receive a reset code', 'Enter the 6-digit code sent to your email', 'Enter your new password'];

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={[BLUE, '#1D4ED8']} style={styles.topBanner}>
          <TouchableOpacity style={styles.backBtn} onPress={onBackToLogin}>
            <Ionicons name="arrow-back" size={20} color={WHITE} />
          </TouchableOpacity>
          <View style={styles.iconWrap}>
            <Ionicons name="lock-closed" size={32} color={BLUE} />
          </View>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>{stepLabels[step - 1]}</Text>
        </LinearGradient>

        <View style={styles.card}>
          <View style={styles.stepRow}>
            {[1, 2, 3].map((s) => (
              <View key={s} style={[styles.stepDot, step >= s && { backgroundColor: BLUE }]} />
            ))}
          </View>

          {step === 1 && (
            <>
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={18} color={MUTED} />
                <TextInput style={styles.input} placeholder="Email address" placeholderTextColor={MUTED} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
              </View>
              <TouchableOpacity style={styles.ctaBtn} onPress={handleSendCode} disabled={loading} activeOpacity={0.85}>
                <Text style={styles.ctaText}>{loading ? 'Sending...' : 'Send Code'}</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 2 && (
            <>
              <View style={styles.inputWrap}>
                <Ionicons name="key-outline" size={18} color={MUTED} />
                <TextInput style={styles.input} placeholder="6-digit code" placeholderTextColor={MUTED} value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
              </View>
              <TouchableOpacity style={styles.ctaBtn} onPress={handleVerifyCode} disabled={loading} activeOpacity={0.85}>
                <Text style={styles.ctaText}>{loading ? 'Verifying...' : 'Verify Code'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.resendBtn} onPress={() => { setStep(1); setCode(''); }}>
                <Text style={styles.resendText}>Resend Code</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 3 && (
            <>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color={MUTED} />
                <TextInput style={styles.input} placeholder="New Password" placeholderTextColor={MUTED} value={newPassword} onChangeText={setNewPassword} secureTextEntry={!showPassword} maxLength={PASSWORD_MAX_LENGTH} />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={18} color={MUTED} />
                </TouchableOpacity>
              </View>
              <Text style={styles.passwordHint}>{PASSWORD_HINT}</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color={MUTED} />
                <TextInput style={styles.input} placeholder="Confirm New Password" placeholderTextColor={MUTED} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showPassword} />
              </View>
              <TouchableOpacity style={styles.ctaBtn} onPress={handleResetPassword} disabled={loading} activeOpacity={0.85}>
                <Text style={styles.ctaText}>{loading ? 'Resetting...' : 'Reset Password'}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scroll: { flexGrow: 1 },
  topBanner: { alignItems: 'center', paddingTop: 52, paddingBottom: 40, paddingHorizontal: 24 },
  backBtn: { alignSelf: 'flex-start', marginBottom: 20, width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  iconWrap: { width: 72, height: 72, borderRadius: 20, backgroundColor: WHITE, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { fontSize: 24, fontWeight: '900', color: WHITE, marginBottom: 6 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.85)', textAlign: 'center' },
  card: { backgroundColor: WHITE, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -20, flex: 1, padding: 28, paddingTop: 32 },
  stepRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 28 },
  stepDot: { width: 40, height: 6, borderRadius: 3, backgroundColor: '#E5E7EB' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: BG, borderWidth: 2, borderColor: BORDER, borderRadius: 14, paddingHorizontal: 14, height: 54, marginBottom: 14, gap: 10 },
  input: { flex: 1, color: TEXT, fontSize: 15 },
  passwordHint: { color: MUTED, fontSize: 12, marginTop: -6, marginBottom: 14, marginLeft: 4, lineHeight: 16 },
  ctaBtn: { backgroundColor: BLUE, height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 12, shadowColor: BLUE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  ctaText: { color: WHITE, fontSize: 16, fontWeight: '800' },
  resendBtn: { alignItems: 'center', marginTop: 4 },
  resendText: { color: BLUE, fontSize: 14, fontWeight: '700' },
});

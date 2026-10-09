import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { authService } from '../services/authService';
import { limiters, RateLimitError } from '../utils/rateLimiter';
import { getErrorMessage } from '../utils/errorMessages';
import { logSecurityEvent, maskEmail } from '../utils/securityLog';
import { useTheme } from '../context/ThemeContext';

const { height } = Dimensions.get('window');

const isCredentialFailure = (error) =>
  error?.code === 'invalid_credentials' || /invalid login credentials/i.test(error?.message || '');

export default function LoginScreen({ onLogin, onSignUp, onForgotPassword }) {
  const { theme } = useTheme();
  const BLUE = theme.primary;
  const WHITE = '#FFFFFF';
  const BG = theme.surface;
  const TEXT = theme.text;
  const MUTED = theme.textSecondary;
  const BORDER = theme.border;
  const CARD = theme.card;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) { Alert.alert('Error', 'Please enter email and password'); return; }
    const trimmedEmail = email.trim();
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
      Alert.alert('Error', getErrorMessage(error, { context: 'login' }));
    }
    finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: BG }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        <LinearGradient colors={[BLUE, '#1D4ED8']} style={styles.topBanner}>
          <View style={styles.logoWrap}>
            <Ionicons name="desktop" size={36} color={BLUE} />
          </View>
          <Text style={styles.appName}>CompuClass</Text>
          <Text style={styles.appTagline}>Master Computer Skills</Text>
        </LinearGradient>

        <View style={[styles.card, { backgroundColor: CARD }]}>
          <Text style={[styles.welcomeTitle, { color: TEXT }]}>Welcome Back! 👋</Text>
          <Text style={[styles.welcomeSub, { color: MUTED }]}>Sign in to continue your learning journey</Text>

          <View style={[styles.inputWrap, { backgroundColor: BG, borderColor: BORDER }]}>
            <Ionicons name="mail-outline" size={18} color={MUTED} style={styles.inputIcon} />
            <TextInput style={[styles.input, { color: TEXT }]} placeholder="Email address" placeholderTextColor={MUTED}
              value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          </View>

          <View style={[styles.inputWrap, { backgroundColor: BG, borderColor: BORDER }]}>
            <Ionicons name="lock-closed-outline" size={18} color={MUTED} style={styles.inputIcon} />
            <TextInput style={[styles.input, { color: TEXT }]} placeholder="Password" placeholderTextColor={MUTED}
              value={password} onChangeText={setPassword} secureTextEntry={!showPassword} />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={18} color={MUTED} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
            <Text style={styles.loginBtnText}>{loading ? 'Signing In...' : 'Sign In'}</Text>
            <Ionicons name="arrow-forward" size={18} color={WHITE} />
          </TouchableOpacity>

          <TouchableOpacity onPress={onForgotPassword} style={styles.forgotBtn}>
            <Text style={[styles.forgotText, { color: BLUE }]}>Forgot Password?</Text>
          </TouchableOpacity>

          <View style={styles.signUpRow}>
            <Text style={[styles.signUpText, { color: MUTED }]}>Don&apos;t have an account? </Text>
            <TouchableOpacity onPress={onSignUp}>
              <Text style={[styles.signUpLink, { color: BLUE }]}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1 },
  topBanner: { alignItems: 'center', paddingTop: Math.max(height * 0.08, 48), paddingBottom: 48, paddingHorizontal: 24, minHeight: 220 },
  logoWrap: { width: 80, height: 80, borderRadius: 24, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 6 },
  appName: { fontSize: 32, fontWeight: '900', color: '#FFFFFF', marginBottom: 6 },
  appTagline: { fontSize: 15, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  card: { borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -20, flex: 1, padding: 28, paddingTop: 32 },
  welcomeTitle: { fontSize: 24, fontWeight: '900', marginBottom: 6 },
  welcomeSub: { fontSize: 14, marginBottom: 28 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderRadius: 14, paddingHorizontal: 14, height: 54, marginBottom: 14, gap: 10 },
  inputIcon: {},
  input: { flex: 1, fontSize: 15 },
  loginBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2563EB', height: 54, borderRadius: 14, marginTop: 6, marginBottom: 16, gap: 8, shadowColor: '#2563EB', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  loginBtnText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  forgotBtn: { alignItems: 'center', marginBottom: 20 },
  forgotText: { fontSize: 14, fontWeight: '600' },
  signUpRow: { flexDirection: 'row', justifyContent: 'center' },
  signUpText: { fontSize: 14 },
  signUpLink: { fontSize: 14, fontWeight: '800' },
});

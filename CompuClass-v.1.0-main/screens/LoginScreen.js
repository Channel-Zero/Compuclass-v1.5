import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { authService } from '../services/authService';
import { limiters, RateLimitError } from '../utils/rateLimiter';
import { getErrorMessage } from '../utils/errorMessages';
import { logSecurityEvent, maskEmail } from '../utils/securityLog';

const { height } = Dimensions.get('window');

// Only wrong-credential errors count toward the lockout, not network blips.
const isCredentialFailure = (error) =>
  error?.code === 'invalid_credentials' || /invalid login credentials/i.test(error?.message || '');
const BLUE = '#2563EB'; const YELLOW = '#FACC15'; const WHITE = '#FFFFFF';
const BG = '#F3F4F6'; const TEXT = '#111827'; const MUTED = '#4B5563'; const BORDER = '#E5E7EB';

export default function LoginScreen({ onLogin, onSignUp, onForgotPassword }) {
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
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        <LinearGradient colors={[BLUE, '#1D4ED8']} style={styles.topBanner}>
          <View style={styles.logoWrap}>
            <Ionicons name="desktop" size={36} color={BLUE} />
          </View>
          <Text style={styles.appName}>CompuClass</Text>
          <Text style={styles.appTagline}>Master Computer Skills</Text>
        </LinearGradient>

        <View style={styles.card}>
          <Text style={styles.welcomeTitle}>Welcome Back! 👋</Text>
          <Text style={styles.welcomeSub}>Sign in to continue your learning journey</Text>

          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={18} color={MUTED} style={styles.inputIcon} />
            <TextInput style={styles.input} placeholder="Email address" placeholderTextColor={MUTED}
              value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          </View>

          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color={MUTED} style={styles.inputIcon} />
            <TextInput style={styles.input} placeholder="Password" placeholderTextColor={MUTED}
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
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          <View style={styles.signUpRow}>
            <Text style={styles.signUpText}>Don&apos;t have an account? </Text>
            <TouchableOpacity onPress={onSignUp}>
              <Text style={styles.signUpLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scroll: { flexGrow: 1 },
  topBanner: { alignItems: 'center', paddingTop: height * 0.08, paddingBottom: 48, paddingHorizontal: 24 },
  logoWrap: { width: 80, height: 80, borderRadius: 24, backgroundColor: WHITE, alignItems: 'center', justifyContent: 'center', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 6 },
  appName: { fontSize: 32, fontWeight: '900', color: WHITE, marginBottom: 6 },
  appTagline: { fontSize: 15, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  card: { backgroundColor: WHITE, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -20, flex: 1, padding: 28, paddingTop: 32 },
  welcomeTitle: { fontSize: 24, fontWeight: '900', color: TEXT, marginBottom: 6 },
  welcomeSub: { fontSize: 14, color: MUTED, marginBottom: 28 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: BG, borderWidth: 2, borderColor: BORDER, borderRadius: 14, paddingHorizontal: 14, height: 54, marginBottom: 14, gap: 10 },
  inputIcon: {},
  input: { flex: 1, color: TEXT, fontSize: 15 },
  loginBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: BLUE, height: 54, borderRadius: 14, marginTop: 6, marginBottom: 16, gap: 8, shadowColor: BLUE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  loginBtnText: { fontSize: 16, fontWeight: '800', color: WHITE },
  forgotBtn: { alignItems: 'center', marginBottom: 20 },
  forgotText: { color: BLUE, fontSize: 14, fontWeight: '600' },
  signUpRow: { flexDirection: 'row', justifyContent: 'center' },
  signUpText: { color: MUTED, fontSize: 14 },
  signUpLink: { color: BLUE, fontSize: 14, fontWeight: '800' },
});

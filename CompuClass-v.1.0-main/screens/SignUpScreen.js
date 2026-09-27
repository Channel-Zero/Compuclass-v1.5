import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { authService } from '../services/authService';
import { validateNewPassword, PASSWORD_HINT, PASSWORD_MAX_LENGTH } from '../utils/passwordPolicy';
import { cleanText, cleanEmail, LIMITS } from '../utils/inputValidation';
import { getErrorMessage } from '../utils/errorMessages';
import { limiters } from '../utils/rateLimiter';

const BLUE = '#2563EB'; const YELLOW = '#FACC15'; const WHITE = '#FFFFFF';
const BG = '#F3F4F6'; const TEXT = '#111827'; const MUTED = '#4B5563'; const BORDER = '#E5E7EB';

export default function SignUpScreen({ onSignUp, onBackToLogin }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('student');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!fullName || !email || !password || !confirmPassword) { Alert.alert('Error', 'Please fill in all fields'); return; }
    if (password !== confirmPassword) { Alert.alert('Error', 'Passwords do not match'); return; }
    setLoading(true);
    try {
      const cleanName = cleanText(fullName, { field: 'Full name', maxLength: LIMITS.name, required: true, allowMarkup: false });
      const cleanedEmail = cleanEmail(email);
      const passwordProblems = await validateNewPassword(password, { email: cleanedEmail });
      if (passwordProblems.length > 0) { Alert.alert('Choose a stronger password', passwordProblems.join('\n')); return; }
      await limiters.signUp.consume('device');
      await authService.signUp(cleanedEmail, password, cleanName, role);
      Alert.alert('Success', 'Account created! Please check your email to verify.', [{ text: 'OK', onPress: onSignUp }]);
    } catch (error) { Alert.alert('Error', getErrorMessage(error, { context: 'signUp' })); }
    finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        <LinearGradient colors={[BLUE, '#1D4ED8']} style={styles.topBanner}>
          <TouchableOpacity style={styles.backBtn} onPress={onBackToLogin} accessibilityRole="button" accessibilityLabel="Back to sign in">
            <Ionicons name="arrow-back" size={20} color={WHITE} />
          </TouchableOpacity>
          {/* Logo links back to the signed-out home page (Sign In). */}
          <TouchableOpacity style={styles.logoWrap} onPress={onBackToLogin} activeOpacity={0.8} accessibilityRole="link" accessibilityLabel="CompuClass home">
            <Ionicons name="desktop" size={32} color={BLUE} />
          </TouchableOpacity>
          <Text style={styles.appName}>Create Account</Text>
          <Text style={styles.appTagline}>Join CompuClass today 🎉</Text>
        </LinearGradient>

        <View style={styles.card}>
          {/* Role selector */}
          <View style={styles.roleRow}>
            {['student', 'lecturer'].map((r) => (
              <TouchableOpacity key={r} style={[styles.roleBtn, role === r && styles.roleBtnActive]} onPress={() => setRole(r)} activeOpacity={0.8}>
                <Ionicons name={r === 'student' ? 'school' : 'person'} size={20} color={role === r ? WHITE : MUTED} />
                <Text style={[styles.roleText, role === r && styles.roleTextActive]}>{r.charAt(0).toUpperCase() + r.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {[
            { icon: 'person-outline', placeholder: 'Full Name', value: fullName, onChange: setFullName },
            { icon: 'mail-outline', placeholder: 'Email address', value: email, onChange: setEmail, keyboard: 'email-address', caps: 'none' },
          ].map((f, i) => (
            <View key={i} style={styles.inputWrap}>
              <Ionicons name={f.icon} size={18} color={MUTED} />
              <TextInput style={styles.input} placeholder={f.placeholder} placeholderTextColor={MUTED}
                value={f.value} onChangeText={f.onChange} keyboardType={f.keyboard} autoCapitalize={f.caps} />
            </View>
          ))}

          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color={MUTED} />
            <TextInput style={styles.input} placeholder="Password" placeholderTextColor={MUTED} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} maxLength={PASSWORD_MAX_LENGTH} />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={18} color={MUTED} />
            </TouchableOpacity>
          </View>
          <Text style={styles.passwordHint}>{PASSWORD_HINT}</Text>

          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color={MUTED} />
            <TextInput style={styles.input} placeholder="Confirm Password" placeholderTextColor={MUTED} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showConfirm} />
            <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
              <Ionicons name={showConfirm ? 'eye-outline' : 'eye-off-outline'} size={18} color={MUTED} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.signUpBtn} onPress={handleSignUp} disabled={loading} activeOpacity={0.85}>
            <Text style={styles.signUpBtnText}>{loading ? 'Creating Account...' : 'Sign Up'}</Text>
            <Ionicons name="checkmark" size={18} color={WHITE} />
          </TouchableOpacity>

          <Text style={styles.termsText}>By signing up, you agree to our Terms of Service and Privacy Policy</Text>

          <View style={styles.signInRow}>
            <Text style={styles.signInText}>Already have an account? </Text>
            <TouchableOpacity onPress={onBackToLogin}>
              <Text style={styles.signInLink}>Sign In</Text>
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
  topBanner: { alignItems: 'center', paddingTop: 52, paddingBottom: 40, paddingHorizontal: 24 },
  backBtn: { alignSelf: 'flex-start', marginBottom: 16, width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  logoWrap: { width: 72, height: 72, borderRadius: 20, backgroundColor: WHITE, alignItems: 'center', justifyContent: 'center', marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 6 },
  appName: { fontSize: 26, fontWeight: '900', color: WHITE, marginBottom: 4 },
  appTagline: { fontSize: 14, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  card: { backgroundColor: WHITE, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -20, flex: 1, padding: 28, paddingTop: 32 },
  roleRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  roleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: BORDER, borderRadius: 14, paddingVertical: 12, gap: 8 },
  roleBtnActive: { backgroundColor: BLUE, borderColor: BLUE },
  roleText: { fontSize: 14, fontWeight: '700', color: MUTED },
  roleTextActive: { color: WHITE },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: BG, borderWidth: 2, borderColor: BORDER, borderRadius: 14, paddingHorizontal: 14, height: 54, marginBottom: 12, gap: 10 },
  input: { flex: 1, color: TEXT, fontSize: 15 },
  passwordHint: { color: MUTED, fontSize: 12, marginTop: -4, marginBottom: 12, marginLeft: 4, lineHeight: 16 },
  signUpBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: BLUE, height: 54, borderRadius: 14, marginTop: 6, marginBottom: 14, gap: 8, shadowColor: BLUE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  signUpBtnText: { fontSize: 16, fontWeight: '800', color: WHITE },
  termsText: { color: MUTED, fontSize: 11, textAlign: 'center', marginBottom: 16, lineHeight: 16 },
  signInRow: { flexDirection: 'row', justifyContent: 'center' },
  signInText: { color: MUTED, fontSize: 14 },
  signInLink: { color: BLUE, fontSize: 14, fontWeight: '800' },
});

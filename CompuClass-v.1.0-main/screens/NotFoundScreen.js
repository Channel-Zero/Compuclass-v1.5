import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { usePageMeta } from '../utils/pageMeta';

const BLUE = '#2563EB'; const WHITE = '#FFFFFF'; const BG = '#F3F4F6';
const TEXT = '#111827'; const MUTED = '#4B5563';

// Shown on the web build when someone opens a URL the app doesn't have
// (everything is served from "/", so any other path is unknown).
export default function NotFoundScreen({ onGoHome }) {
  usePageMeta('NotFound');

  return (
    <View style={styles.container}>
      <LinearGradient colors={[BLUE, '#1D4ED8']} style={styles.banner}>
        <TouchableOpacity style={styles.logoRow} onPress={onGoHome} accessibilityRole="link" accessibilityLabel="CompuClass home">
          <View style={styles.logoWrap}>
            <Ionicons name="desktop" size={22} color={BLUE} />
          </View>
          <Text style={styles.appName}>CompuClass</Text>
        </TouchableOpacity>
      </LinearGradient>

      <View style={styles.body}>
        <Text style={styles.code} accessibilityRole="header">404</Text>
        <Text style={styles.title}>Page not found</Text>
        <Text style={styles.message}>{"The page you're looking for doesn't exist or may have been moved."}</Text>
        <TouchableOpacity style={styles.button} onPress={onGoHome} activeOpacity={0.85} accessibilityRole="link">
          <Ionicons name="home" size={18} color={WHITE} />
          <Text style={styles.buttonText}>Go to CompuClass home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  banner: { paddingVertical: 20, paddingHorizontal: 20 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start' },
  logoWrap: { width: 38, height: 38, borderRadius: 12, backgroundColor: WHITE, alignItems: 'center', justifyContent: 'center' },
  appName: { fontSize: 20, fontWeight: '900', color: WHITE },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  code: { fontSize: 72, fontWeight: '900', color: BLUE },
  title: { fontSize: 22, fontWeight: '900', color: TEXT, marginBottom: 8, textAlign: 'center' },
  message: { fontSize: 15, color: MUTED, textAlign: 'center', marginBottom: 28, maxWidth: 340, lineHeight: 22 },
  button: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: BLUE, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24 },
  buttonText: { color: WHITE, fontSize: 16, fontWeight: '800' },
});

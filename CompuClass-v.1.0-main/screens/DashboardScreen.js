import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { supabase } from '../config/supabase';
import { authService } from '../services/authService';

const { width } = Dimensions.get('window');

const BLUE = '#2563EB'; const YELLOW = '#FACC15'; const RED = '#EF4444';
const GREEN = '#22C55E'; const PURPLE = '#8B5CF6'; const WHITE = '#FFFFFF';
const BG = '#F3F4F6'; const TEXT = '#111827'; const MUTED = '#4B5563';

function AnimatedCard({ onPress, style, children, activeOpacity = 0.85 }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }).start();
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <TouchableOpacity
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress?.(); }}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={activeOpacity}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function DashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState([
    { label: 'Folders', value: '—', icon: 'library', bg: BLUE, text: WHITE },
    { label: 'Documents', value: '—', icon: 'document-text', bg: GREEN, text: WHITE },
    { label: 'Quizzes', value: '—', icon: 'help-circle', bg: PURPLE, text: WHITE },
    { label: 'Best avg', value: '—', icon: 'trophy', bg: YELLOW, text: TEXT },
  ]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await authService.getCurrentUser();
        const [{ count: folders }, { count: documents }, { count: quizzes }, { data: attempts }] = await Promise.all([
          supabase.from('folders').select('id', { count: 'exact', head: true }),
          supabase.from('documents').select('id', { count: 'exact', head: true }),
          supabase.from('quizzes').select('id', { count: 'exact', head: true }),
          user?.id
            ? supabase.from('quiz_attempts').select('quiz_id, score').eq('user_id', user.id)
            : Promise.resolve({ data: [] }),
        ]);
        const best = new Map();
        (attempts || []).forEach((attempt) => {
          const previous = best.get(attempt.quiz_id);
          if (previous == null || attempt.score > previous) best.set(attempt.quiz_id, attempt.score);
        });
        const scores = [...best.values()];
        const average = scores.length ? `${Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)}%` : '0%';
        if (!cancelled) {
          setStats([
            { label: 'Folders', value: String(folders || 0), icon: 'library', bg: BLUE, text: WHITE },
            { label: 'Documents', value: String(documents || 0), icon: 'document-text', bg: GREEN, text: WHITE },
            { label: 'Quizzes', value: String(quizzes || 0), icon: 'help-circle', bg: PURPLE, text: WHITE },
            { label: 'Best avg', value: average, icon: 'trophy', bg: YELLOW, text: TEXT },
          ]);
        }
      } catch { /* counts stay as placeholders until the next visit */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const features = [
    { title: 'Component Learning',   icon: 'hardware-chip', bg: BLUE,   screen: 'PC Lab'       },
    { title: 'Drag & Drop Assembly', icon: 'construct',     bg: GREEN,  screen: 'PC Lab'       },
    { title: 'Troubleshooting',      icon: 'bug',           bg: RED,    screen: 'Troubleshoot' },
    { title: 'Interactive Quizzes',  icon: 'help-circle',   bg: YELLOW, screen: 'Quiz'         },
  ];

  const highlights = [
    { title: 'Real-time Assembly', desc: 'Drag components into the PC case', icon: 'flash',     color: BLUE   },
    { title: 'Smart Guidance',     desc: 'Step-by-step hints and feedback',  icon: 'bulb',      color: YELLOW },
    { title: 'Progress Tracking',  desc: 'Monitor your learning journey',    icon: 'analytics', color: GREEN  },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: 100 + insets.bottom }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <LinearGradient colors={[BLUE, '#1D4ED8']} style={styles.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={styles.heroIcon}>
          <Ionicons name="desktop" size={40} color={WHITE} />
        </View>
        <Text style={styles.heroTitle}>Master PC Hardware</Text>
        <Text style={styles.heroSub}>Learn through interactive simulations, drag-and-drop assembly, and hands-on challenges</Text>
        <AnimatedCard onPress={() => navigation.navigate('PC Lab')} style={styles.heroBtnWrap}>
          <View style={styles.heroBtn}>
            <Text style={styles.heroBtnText}>Start Learning Now</Text>
            <Ionicons name="arrow-forward" size={16} color={BLUE} />
          </View>
        </AnimatedCard>
      </LinearGradient>

      {/* Stats */}
      <View style={styles.statsRow}>
        {stats.map((s, i) => (
          <View key={i} style={[styles.statCard, { backgroundColor: s.bg }]}>
            <Ionicons name={s.icon} size={20} color={s.text} />
            <Text style={[styles.statValue, { color: s.text }]}>{s.value}</Text>
            <Text style={[styles.statLabel, { color: s.text, opacity: 0.85 }]}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Features grid */}
      <Text style={styles.sectionTitle}>What You&apos;ll Learn</Text>
      <View style={styles.featuresGrid}>
        {features.map((f, i) => (
          <AnimatedCard key={i} onPress={() => navigation.navigate(f.screen)} style={styles.featureCardWrap}>
            <View style={styles.featureCard}>
              <View style={[styles.featureIconWrap, { backgroundColor: f.bg }]}>
                <Ionicons name={f.icon} size={22} color={f.bg === YELLOW ? TEXT : WHITE} />
              </View>
              <Text style={styles.featureText}>{f.title}</Text>
            </View>
          </AnimatedCard>
        ))}
      </View>

      {/* PC Building simulator card */}
      <View style={styles.simCard}>
        <View style={styles.simTop}>
          <View style={[styles.simBadgeWrap, { backgroundColor: YELLOW }]}>
            <Text style={styles.simBadge}>⭐ FEATURED</Text>
          </View>
        </View>
        <Text style={styles.simTitle}>🚀 Step-by-step{'\n'}PC Building!</Text>
        <Text style={styles.simDesc}>Install each part in order, and open a 3D view of the component you just fitted.</Text>

        <View style={styles.highlightsRow}>
          {highlights.map((h, i) => (
            <View key={i} style={styles.highlightItem}>
              <View style={[styles.highlightIcon, { backgroundColor: h.color }]}>
                <Ionicons name={h.icon} size={16} color={h.color === YELLOW ? TEXT : WHITE} />
              </View>
              <Text style={styles.highlightTitle}>{h.title}</Text>
              <Text style={styles.highlightDesc}>{h.desc}</Text>
            </View>
          ))}
        </View>

        <AnimatedCard onPress={() => navigation.navigate('PC Lab')}>
          <View style={styles.simBtn}>
            <Ionicons name="hardware-chip" size={18} color={WHITE} />
            <Text style={styles.simBtnText}>Try the PC Building Simulator</Text>
          </View>
        </AnimatedCard>
      </View>

      {/* Quick nav row */}
      <Text style={styles.sectionTitle}>Quick Access</Text>
      <View style={styles.quickRow}>
        {[
          { label: 'Materials', icon: 'book', color: PURPLE, screen: 'Materials' },
          { label: 'Windows 11', icon: 'laptop', color: BLUE, screen: 'Windows 11' },
          { label: 'AI Assistant', icon: 'chatbubble-ellipses', color: '#8B5CF6', screen: 'Chatbot' },
          { label: 'Settings', icon: 'settings', color: MUTED, screen: 'Settings' },
        ].map((item, i) => (
          <AnimatedCard key={i} onPress={() => navigation.navigate(item.screen)} style={{ flex: 1 }}>
            <View style={styles.quickCard}>
              <View style={[styles.quickIconWrap, { backgroundColor: item.color }]}>
                <Ionicons name={item.icon} size={18} color={WHITE} />
              </View>
              <Text style={styles.quickLabel}>{item.label}</Text>
            </View>
          </AnimatedCard>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  content: { paddingTop: 8 },

  streakBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: WHITE, marginHorizontal: 16, marginBottom: 12, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  streakEmoji: { fontSize: 20 },
  streakText: { flex: 1, fontSize: 13, fontWeight: '700', color: TEXT },
  xpBadge: { backgroundColor: YELLOW, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  xpText: { fontSize: 12, fontWeight: '900', color: TEXT },

  hero: { margin: 16, borderRadius: 20, padding: 28, alignItems: 'center' },
  heroIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  heroTitle: { fontSize: 26, fontWeight: '900', color: WHITE, textAlign: 'center', marginBottom: 10 },
  heroSub: { fontSize: 14, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  heroBtnWrap: { alignSelf: 'center' },
  heroBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: WHITE, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, gap: 8 },
  heroBtnText: { fontSize: 15, fontWeight: '800', color: BLUE },

  statsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 24 },
  statCard: { flex: 1, borderRadius: 14, alignItems: 'center', paddingVertical: 14, gap: 4 },
  statValue: { fontSize: 16, fontWeight: '900' },
  statLabel: { fontSize: 10, fontWeight: '600' },

  sectionTitle: { fontSize: 18, fontWeight: '900', color: TEXT, marginHorizontal: 16, marginBottom: 12 },

  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10, marginBottom: 24 },
  featureCardWrap: { width: (width - 52) / 2 },
  featureCard: { backgroundColor: WHITE, borderRadius: 14, padding: 16, alignItems: 'center', gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  featureIconWrap: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  featureText: { fontSize: 12, fontWeight: '700', color: TEXT, textAlign: 'center' },

  simCard: { backgroundColor: WHITE, marginHorizontal: 16, borderRadius: 20, padding: 24, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  simTop: { marginBottom: 12 },
  simBadgeWrap: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  simBadge: { fontSize: 10, fontWeight: '900', color: TEXT, letterSpacing: 0.5 },
  simTitle: { fontSize: 20, fontWeight: '900', color: TEXT, marginBottom: 10, lineHeight: 28 },
  simDesc: { fontSize: 13, color: MUTED, lineHeight: 20, marginBottom: 20 },
  highlightsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  highlightItem: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  highlightIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  highlightTitle: { fontSize: 11, fontWeight: '700', color: TEXT, textAlign: 'center', marginBottom: 3 },
  highlightDesc: { fontSize: 9, color: MUTED, textAlign: 'center', lineHeight: 13 },
  simBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: BLUE, paddingVertical: 14, borderRadius: 12, gap: 8 },
  simBtnText: { fontSize: 14, fontWeight: '800', color: WHITE },

  quickRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 8 },
  quickCard: { backgroundColor: WHITE, borderRadius: 14, padding: 14, alignItems: 'center', gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  quickIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 11, fontWeight: '700', color: TEXT },
});

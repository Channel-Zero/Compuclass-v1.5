import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { supabase } from "../config/supabase";
import { authService } from "../services/authService";
import { classService } from "../services/classService";
import { filterByClassScope } from "../utils/classScope";

const BLUE = '#2563EB';
const YELLOW = '#FACC15';
const RED = '#EF4444';
const GREEN = '#22C55E';
const PURPLE = '#8B5CF6';
const ORANGE = '#F97316';
const WHITE = '#FFFFFF';
const BG = '#F3F4F6';
const TEXT = '#111827';
const MUTED = '#4B5563';
const CARD = '#FFFFFF';
const AMBER_TEXT = '#B45309';

const GUTTER = 16;
const CONTENT_MAX_WIDTH = 720;
const GRID_GAP = 12;
const PASS_SCORE = 70;

const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 3,
};

const DAILY_TIPS = [
  { icon: "hardware-chip", color: BLUE,   tip: "The CPU is the brain of the computer. More cores = better multitasking." },
  { icon: "battery-charging", color: GREEN, tip: "A PSU that is too weak can cause random shutdowns and hardware damage." },
  { icon: "layers",        color: PURPLE, tip: "RAM is temporary storage. Closing apps frees up RAM immediately." },
  { icon: "save",          color: RED,    tip: "SSDs are up to 10x faster than HDDs because they have no moving parts." },
  { icon: "thermometer",   color: ORANGE, tip: "Thermal paste between the CPU and cooler prevents overheating." },
  { icon: "grid",          color: BLUE,   tip: "The motherboard connects all components. Compatibility matters when upgrading." },
  { icon: "desktop",       color: GREEN,  tip: "GPU handles graphics. A dedicated GPU is essential for gaming and video editing." },
];

function scoreTone(score) {
  if (score >= 80) return { bg: GREEN,  text: "#15803D",  label: "Great work",        icon: "trophy"  };
  if (score >= PASS_SCORE) return { bg: YELLOW, text: AMBER_TEXT, label: "Passed", icon: "ribbon"  };
  return                        { bg: RED,    text: "#B91C1C",  label: "Needs another try", icon: "refresh" };
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function SkeletonBlock({ width, height: h, style }) {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.85] });
  return <Animated.View style={[{ width, height: h, borderRadius: 10, backgroundColor: '#E5E7EB', opacity }, style]} />;
}

function SkeletonCard() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, marginHorizontal: 16, marginBottom: 10, borderRadius: 16, padding: 14, gap: 12 }}>
      <SkeletonBlock width={46} height={46} style={{ borderRadius: 12 }} />
      <View style={{ flex: 1, gap: 8 }}>
        <SkeletonBlock width="80%" height={12} />
        <SkeletonBlock width="50%" height={10} />
      </View>
    </View>
  );
}

function AnimatedCard({ onPress, style, children, activeOpacity = 0.85, accessibilityLabel }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }).start();
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <TouchableOpacity
        onPress={() => { if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress?.(); }}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={activeOpacity}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function DashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [user, setUser] = useState(null);
  const [pendingQuizzes, setPendingQuizzes] = useState([]);
  const [lastScore, setLastScore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [enrolledClass, setEnrolledClass] = useState(null);
  const [stats, setStats] = useState({ completed: 0, passed: 0, materialsRead: 0 });
  const [streak, setStreak] = useState(0);
  const [announcements, setAnnouncements] = useState([]);
  const tipIndex = new Date().getDate() % DAILY_TIPS.length;
  const tip = DAILY_TIPS[tipIndex];

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const loadData = async () => {
    try {
      const u = await authService.getCurrentUser();
      setUser(u);

      const { data: classStudents } = await supabase
        .from('class_students').select('class_id, classes(name)').eq('student_id', u.id).limit(1);
      setEnrolledClass(classStudents?.length > 0 ? classStudents[0].classes?.name || null : null);
      const classIds = classStudents?.map(cs => cs.class_id) || [];

      let assignedQuizIds = [];
      if (classIds.length > 0) {
        const { data: assignments } = await supabase
          .from('quiz_assignments').select('quiz_id').in('class_id', classIds);
        assignedQuizIds = assignments?.map(a => a.quiz_id) || [];
      }

      const { data: allAttempts } = await supabase
        .from('quiz_attempts').select('quiz_id, score, completed_at').eq('user_id', u.id)
        .order('completed_at', { ascending: false });

      const attemptedIds = new Set(allAttempts?.map(a => a.quiz_id) || []);
      const pendingIds = assignedQuizIds.filter(id => !attemptedIds.has(id));
      if (pendingIds.length > 0) {
        const { data: pendingData } = await supabase
          .from('quizzes').select('*').in('id', pendingIds).limit(3);
        setPendingQuizzes(pendingData || []);
      } else {
        setPendingQuizzes([]);
      }

      const completed = allAttempts?.length || 0;
      const passed = allAttempts?.filter(a => a.score >= PASS_SCORE).length || 0;
      const { data: views } = await supabase
        .from('material_views').select('id', { count: 'exact' }).eq('user_id', u.id);
      setStats({ completed, passed, materialsRead: views?.length || 0 });

      if (allAttempts?.length > 0) {
        const { data: quizInfo } = await supabase
          .from('quizzes').select('title').eq('id', allAttempts[0].quiz_id).single();
        setLastScore({ score: allAttempts[0].score, title: quizInfo?.title || 'Quiz' });
      }

      if (allAttempts?.length > 0) {
        const days = [...new Set(allAttempts.map(a => new Date(a.completed_at).toDateString()))];
        let s = 0;
        const today = new Date();
        for (let i = 0; i < days.length; i++) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          if (days.includes(d.toDateString())) s++;
          else break;
        }
        setStreak(s);
      }

      const { data: announcementsData } = await supabase
        .from('announcements').select('*').order('created_at', { ascending: false }).limit(3);
      const scope = await classService.classScopeForCurrentUser();
      setAnnouncements(filterByClassScope(announcementsData || [], scope));
    } catch {}
    finally { setLoading(false); }
  };

  const displayName = user?.user_metadata?.full_name || user?.profile?.full_name || "Student";
  const firstName = displayName.split(" ")[0];
  const contentWidth = Math.min(windowWidth, CONTENT_MAX_WIDTH);
  const quickColumns = contentWidth >= 600 ? 4 : 3;
  const quickCardWidth = (contentWidth - GUTTER * 2 - GRID_GAP * (quickColumns - 1)) / quickColumns;
  const passRate = stats.completed > 0 ? Math.round((stats.passed / stats.completed) * 100) : 0;
  const lastTone = lastScore ? scoreTone(lastScore.score) : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: 100 + insets.bottom }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Greeting */}
      <View style={styles.greetingRow}>
        <View style={styles.greetingTextWrap}>
          <Text style={styles.greetingText} numberOfLines={1}>{getGreeting()}, {firstName} 👋</Text>
          {enrolledClass ? (
            <View style={styles.classRow}>
              <Ionicons name="school" size={13} color={MUTED} />
              <Text style={styles.greetingSubText} numberOfLines={1}>{enrolledClass}</Text>
            </View>
          ) : (
            <TouchableOpacity onPress={() => navigation.navigate('JoinClass')} accessibilityRole="button" accessibilityLabel="Join a class">
              <Text style={styles.greetingSubText}>Join a class</Text>
            </TouchableOpacity>
          )}
        </View>
        {streak > 0 && (
          <View style={styles.xpBadge} accessibilityLabel={`${streak} day streak`}>
            <Text style={styles.xpText}>🔥 {streak}d streak</Text>
          </View>
        )}
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        {[
          { icon: 'checkmark-circle', value: stats.completed, label: 'Quizzes done', color: BLUE },
          { icon: 'trophy',           value: `${passRate}%`,  label: 'Pass rate',    color: GREEN },
          { icon: 'book',             value: stats.materialsRead, label: 'Materials read', color: PURPLE },
        ].map(s => (
          <View key={s.label} style={[styles.statCard, CARD_SHADOW]} accessible accessibilityLabel={`${s.label}: ${s.value}`}>
            <View style={[styles.statIconWrap, { backgroundColor: s.color + '1A' }]}>
              <Ionicons name={s.icon} size={18} color={s.color} />
            </View>
            <Text style={styles.statValue}>{loading ? '–' : s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Daily tip */}
      <View style={[styles.tipCard, CARD_SHADOW]}>
        <View style={[styles.tipIconWrap, { backgroundColor: tip.color }]}>
          <Ionicons name={tip.icon} size={20} color={WHITE} />
        </View>
        <View style={styles.tipContent}>
          <Text style={styles.tipLabel}>Tip of the day</Text>
          <Text style={styles.tipText}>{tip.tip}</Text>
        </View>
      </View>

      {/* Pending Quizzes */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderTitle}>Pending quizzes</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Quiz')} style={styles.seeAllBtn} accessibilityRole="button" accessibilityLabel="See all quizzes">
          <Text style={styles.seeAll}>See all</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
      ) : pendingQuizzes.length === 0 ? (
        <View style={[styles.emptyCard, CARD_SHADOW]}>
          <Ionicons name="checkmark-done-circle-outline" size={32} color={GREEN} />
          <Text style={styles.emptyText}>{enrolledClass ? 'All caught up!' : 'No class yet'}</Text>
          <Text style={styles.emptySubText}>{enrolledClass ? 'No pending quizzes right now' : 'Join a class to see quizzes from your lecturer'}</Text>
          {!enrolledClass && (
            <TouchableOpacity onPress={() => navigation.navigate('JoinClass')} style={styles.seeAllBtn} accessibilityRole="button" accessibilityLabel="Join a class">
              <Text style={styles.seeAll}>Join a class</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        pendingQuizzes.map(q => (
          <AnimatedCard key={q.id} onPress={() => navigation.navigate('Quiz', { quizId: q.id })} accessibilityLabel={`Start quiz ${q.title}`}>
            <View style={[styles.quizCard, CARD_SHADOW]}>
              <View style={styles.quizIconWrap}>
                <Ionicons name="document-text" size={22} color={TEXT} />
              </View>
              <View style={styles.quizInfo}>
                <Text style={styles.quizTitle} numberOfLines={2}>{q.title}</Text>
                <Text style={styles.quizMeta}>Pass mark {q.passing_score}%</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={MUTED} />
            </View>
          </AnimatedCard>
        ))
      )}

      {/* Last score */}
      {lastScore && (
        <>
          <Text style={styles.sectionTitle}>Recent activity</Text>
          <View style={[styles.scoreCard, CARD_SHADOW]} accessible accessibilityLabel={`Last attempt: ${lastScore.title}, ${lastScore.score}%, ${lastTone.label}`}>
            <View style={[styles.scoreIconWrap, { backgroundColor: lastTone.bg }]}>
              <Ionicons name={lastTone.icon} size={20} color={lastTone.bg === YELLOW ? TEXT : WHITE} />
            </View>
            <View style={styles.scoreInfo}>
              <Text style={styles.scoreTitle} numberOfLines={2}>{lastScore.title}</Text>
              <Text style={styles.scoreSub}>Last attempt · {lastTone.label}</Text>
            </View>
            <Text style={[styles.scoreValue, { color: lastTone.text }]}>{lastScore.score}%</Text>
          </View>
        </>
      )}

      {/* Announcements */}
      {announcements.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Announcements</Text>
          {announcements.map(a => (
            <View key={a.id} style={[styles.announcementCard, CARD_SHADOW]}>
              <View style={styles.announcementIconWrap}>
                <Ionicons name="megaphone" size={18} color={PURPLE} />
              </View>
              <View style={styles.announcementContent}>
                <Text style={styles.announcementTitle} numberOfLines={2}>{a.title}</Text>
                <Text style={styles.announcementBody}>{a.body}</Text>
                <Text style={styles.announcementTime}>{new Date(a.created_at).toLocaleDateString()}</Text>
              </View>
            </View>
          ))}
        </>
      )}

      {/* Game cards */}
      <Text style={styles.sectionTitle}>Play & learn</Text>
      <View style={[styles.gameRow, contentWidth >= 600 && styles.gameRowWide]}>
        {[
          { route: 'GameRunnerLobby', title: 'CompuRunner', emoji: '🏃', colors: ['#7C3AED', '#4F46E5'], btnColor: '#4F46E5', desc: 'Dodge obstacles and collect PC parts. Answer questions to keep running.' },
          { route: 'CircuitMazeTopic', title: 'Circuit Maze', emoji: '🔌', colors: ['#0284C7', '#16A34A'], btnColor: '#0369A1', desc: 'Find your way through the maze and wire up circuits as you go.' },
        ].map(g => (
          <AnimatedCard key={g.route} onPress={() => navigation.navigate(g.route)} style={[styles.gameCardWrap, contentWidth >= 600 && styles.gameCardWrapWide]} accessibilityLabel={`Play ${g.title}`}>
            <LinearGradient colors={g.colors} style={styles.gameCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <View style={styles.gameCardLeft}>
                <Text style={styles.gameCardTitle}>{g.title}</Text>
                <Text style={styles.gameCardDesc}>{g.desc}</Text>
                <View style={styles.gamePlayBtn}>
                  <Ionicons name="play" size={13} color={g.btnColor} />
                  <Text style={[styles.gamePlayBtnText, { color: g.btnColor }]}>Play</Text>
                </View>
              </View>
              <Text style={styles.gameCardEmoji}>{g.emoji}</Text>
            </LinearGradient>
          </AnimatedCard>
        ))}
      </View>

      {/* Quick Access */}
      <Text style={styles.sectionTitle}>Quick access</Text>
      <View style={styles.quickGrid}>
        {[
          { icon: 'book',        label: 'Materials',    screen: 'Materials',    color: PURPLE },
          { icon: 'desktop',     label: 'PC Lab',       screen: 'PC Lab',       color: GREEN  },
          { icon: 'construct',   label: 'PC Assembly',  screen: 'PC Assembly',  color: ORANGE },
          { icon: 'laptop',      label: 'Windows 11',   screen: 'Windows 11',   color: BLUE   },
          { icon: 'bug',         label: 'Troubleshoot', screen: 'Troubleshoot', color: RED    },
          { icon: 'search',      label: 'Search',       screen: 'Search',       color: MUTED  },
          { icon: 'chatbubbles', label: 'CompuBot',     screen: 'Chatbot',      color: BLUE   },
          { icon: 'settings',    label: 'Settings',     screen: 'Settings',     color: MUTED  },
        ].map((item) => (
          <AnimatedCard key={item.screen} onPress={() => navigation.navigate(item.screen)} style={{ width: quickCardWidth }} accessibilityLabel={item.label}>
            <View style={[styles.quickCard, CARD_SHADOW]}>
              <View style={[styles.quickIconWrap, { backgroundColor: item.color + '1A' }]}>
                <Ionicons name={item.icon} size={22} color={item.color} />
              </View>
              <Text style={styles.quickLabel} numberOfLines={1} adjustsFontSizeToFit>{item.label}</Text>
            </View>
          </AnimatedCard>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  content: { paddingTop: 8, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },

  greetingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: GUTTER, marginBottom: 16, gap: 12 },
  greetingTextWrap: { flex: 1, flexShrink: 1 },
  greetingText: { fontSize: 22, fontWeight: '900', color: TEXT },
  classRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  greetingSubText: { fontSize: 13, color: MUTED, marginTop: 2, flexShrink: 1 },
  xpBadge: { backgroundColor: YELLOW, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  xpText: { fontSize: 12, fontWeight: '900', color: TEXT },

  statsRow: { flexDirection: 'row', paddingHorizontal: GUTTER, gap: 8, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: CARD, borderRadius: 16, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 6, gap: 4 },
  statIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  statValue: { fontSize: 20, fontWeight: '900', color: TEXT },
  statLabel: { fontSize: 11, fontWeight: '600', color: MUTED, textAlign: 'center', lineHeight: 14 },

  tipCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, marginHorizontal: GUTTER, marginBottom: 24, borderRadius: 16, padding: 14, gap: 12 },
  tipIconWrap: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tipContent: { flex: 1 },
  tipLabel: { fontSize: 12, fontWeight: '800', color: MUTED, marginBottom: 4 },
  tipText: { fontSize: 13, color: TEXT, lineHeight: 19, fontWeight: '500' },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: GUTTER, marginBottom: 12 },
  sectionHeaderTitle: { fontSize: 18, fontWeight: '900', color: TEXT },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: TEXT, marginHorizontal: GUTTER, marginBottom: 12, marginTop: 4 },
  seeAllBtn: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  seeAll: { fontSize: 13, fontWeight: '700', color: BLUE },

  emptyCard: { alignItems: 'center', backgroundColor: CARD, marginHorizontal: GUTTER, borderRadius: 16, padding: 24, marginBottom: 24, gap: 8 },
  emptyText: { fontSize: 15, fontWeight: '700', color: TEXT },
  emptySubText: { fontSize: 12, color: MUTED, textAlign: 'center' },

  quizCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, marginHorizontal: GUTTER, marginBottom: 10, borderRadius: 16, padding: 14, gap: 12 },
  quizIconWrap: { width: 46, height: 46, borderRadius: 12, backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center' },
  quizInfo: { flex: 1 },
  quizTitle: { fontSize: 14, fontWeight: '700', color: TEXT, marginBottom: 3 },
  quizMeta: { fontSize: 12, color: MUTED },

  scoreCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, marginHorizontal: GUTTER, marginBottom: 24, borderRadius: 16, padding: 14, gap: 12 },
  scoreIconWrap: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  scoreInfo: { flex: 1 },
  scoreTitle: { fontSize: 14, fontWeight: '700', color: TEXT },
  scoreSub: { fontSize: 12, color: MUTED, marginTop: 2 },
  scoreValue: { fontSize: 22, fontWeight: '900' },

  announcementCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: CARD, marginHorizontal: GUTTER, marginBottom: 10, borderRadius: 16, padding: 14, gap: 12, borderLeftWidth: 4, borderLeftColor: PURPLE },
  announcementIconWrap: { width: 38, height: 38, borderRadius: 10, backgroundColor: PURPLE + '1A', alignItems: 'center', justifyContent: 'center' },
  announcementContent: { flex: 1 },
  announcementTitle: { fontSize: 14, fontWeight: '800', color: TEXT, marginBottom: 3 },
  announcementBody: { fontSize: 13, color: MUTED, lineHeight: 19, marginBottom: 4 },
  announcementTime: { fontSize: 11, color: MUTED, fontWeight: '600' },

  gameRow: { paddingHorizontal: GUTTER, gap: 12, marginBottom: 24 },
  gameRowWide: { flexDirection: 'row' },
  gameCardWrap: {},
  gameCardWrapWide: { flex: 1 },
  gameCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, padding: 20, justifyContent: 'space-between', minHeight: 150 },
  gameCardLeft: { flex: 1 },
  gameCardTitle: { fontSize: 22, fontWeight: '900', color: WHITE, marginBottom: 6 },
  gameCardDesc: { fontSize: 13, color: 'rgba(255,255,255,0.9)', lineHeight: 19, marginBottom: 14 },
  gamePlayBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: WHITE, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9, minHeight: 36 },
  gamePlayBtnText: { fontSize: 13, fontWeight: '800' },
  gameCardEmoji: { fontSize: 52, marginLeft: 12 },

  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: GUTTER, gap: GRID_GAP, marginBottom: 16 },
  quickCard: { backgroundColor: CARD, borderRadius: 16, alignItems: 'center', paddingVertical: 16, paddingHorizontal: 6, gap: 10 },
  quickIconWrap: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 12, fontWeight: '700', color: TEXT, textAlign: 'center' },
});

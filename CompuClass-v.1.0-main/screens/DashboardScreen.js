import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { supabase } from "../config/supabase";
import { authService } from "../services/authService";

const { width } = Dimensions.get("window");

const BLUE = "#2563EB";
const YELLOW = "#FACC15";
const RED = "#EF4444";
const GREEN = "#22C55E";
const PURPLE = "#8B5CF6";
const WHITE = "#FFFFFF";
const BG = "#F3F4F6";
const TEXT = "#111827";
const MUTED = "#4B5563";

const DAILY_TIPS = [
  { icon: "hardware-chip", color: BLUE, tip: "The CPU is the brain of the computer. More cores = better multitasking." },
  { icon: "battery-charging", color: GREEN, tip: "A PSU that is too weak can cause random shutdowns and hardware damage." },
  { icon: "layers", color: PURPLE, tip: "RAM is temporary storage. Closing apps frees up RAM immediately." },
  { icon: "save", color: RED, tip: "SSDs are up to 10x faster than HDDs because they have no moving parts." },
  { icon: "thermometer", color: "#F97316", tip: "Thermal paste between the CPU and cooler prevents overheating." },
  { icon: "grid", color: BLUE, tip: "The motherboard connects all components. Compatibility matters when upgrading." },
  { icon: "desktop", color: GREEN, tip: "GPU handles graphics. A dedicated GPU is essential for gaming and video editing." },
];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function AnimatedCard({ onPress, style, children, activeOpacity = 0.85 }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () =>
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 50,
    }).start();
  const onPressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
    }).start();
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <TouchableOpacity
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress?.();
        }}
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

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const u = await authService.getCurrentUser();
      setUser(u);

      // Enrolled class
      const { data: classStudents } = await supabase
        .from('class_students').select('class_id, classes(name)').eq('student_id', u.id).limit(1);
      if (classStudents?.length > 0) setEnrolledClass(classStudents[0].classes?.name);
      const classIds = classStudents?.map(cs => cs.class_id) || [];

      // All assigned quiz IDs
      let assignedQuizIds = [];
      if (classIds.length > 0) {
        const { data: assignments } = await supabase
          .from('quiz_assignments').select('quiz_id').in('class_id', classIds);
        assignedQuizIds = assignments?.map(a => a.quiz_id) || [];
      }

      // All attempts by this student
      const { data: allAttempts } = await supabase
        .from('quiz_attempts').select('quiz_id, score, completed_at').eq('user_id', u.id)
        .order('completed_at', { ascending: false });

      const attemptedIds = new Set(allAttempts?.map(a => a.quiz_id) || []);

      // Pending quizzes (assigned but not attempted)
      const pendingIds = assignedQuizIds.filter(id => !attemptedIds.has(id));
      if (pendingIds.length > 0) {
        const { data: pendingData } = await supabase
          .from('quizzes').select('*').in('id', pendingIds).limit(3);
        setPendingQuizzes(pendingData || []);
      }

      // Stats
      const completed = allAttempts?.length || 0;
      const passed = allAttempts?.filter(a => a.score >= 70).length || 0;
      const { data: views } = await supabase
        .from('material_views').select('id', { count: 'exact' }).eq('user_id', u.id);
      setStats({ completed, passed, materialsRead: views?.length || 0 });

      // Last score
      if (allAttempts?.length > 0) {
        const { data: quizInfo } = await supabase
          .from('quizzes').select('title').eq('id', allAttempts[0].quiz_id).single();
        setLastScore({ score: allAttempts[0].score, title: quizInfo?.title || 'Quiz' });
      }

      // Streak: count consecutive days with attempts
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
      // Announcements
      const { data: announcementsData } = await supabase
        .from('announcements').select('*').order('created_at', { ascending: false }).limit(3);
      setAnnouncements(announcementsData || []);
    } catch {}
    finally { setLoading(false); }
  };

  const displayName =
    user?.user_metadata?.full_name || user?.profile?.full_name || "Student";
  const firstName = displayName.split(" ")[0];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: 100 + insets.bottom },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Greeting */}
      <View style={styles.greetingRow}>
        <View>
          <Text style={styles.greetingText}>{getGreeting()}, {firstName} 👋</Text>
          <Text style={styles.greetingSubText}>{enrolledClass ? `📚 ${enrolledClass}` : 'What are you learning today?'}</Text>
        </View>
        {streak > 0 && (
          <View style={styles.xpBadge}>
            <Text style={styles.xpText}>🔥 {streak}d streak</Text>
          </View>
        )}
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: BLUE }]}>
          <Ionicons name="checkmark-circle" size={20} color={WHITE} />
          <Text style={styles.statValue}>{stats.completed}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: GREEN }]}>
          <Ionicons name="trophy" size={20} color={WHITE} />
          <Text style={styles.statValue}>{stats.completed > 0 ? Math.round((stats.passed / stats.completed) * 100) : 0}%</Text>
          <Text style={styles.statLabel}>Pass Rate</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: PURPLE }]}>
          <Ionicons name="book" size={20} color={WHITE} />
          <Text style={styles.statValue}>{stats.materialsRead}</Text>
          <Text style={styles.statLabel}>Materials</Text>
        </View>
      </View>

      {/* Daily tip */}
      <View style={styles.tipCard}>
        <View style={[styles.tipIconWrap, { backgroundColor: tip.color }]}>
          <Ionicons name={tip.icon} size={20} color={WHITE} />
        </View>
        <View style={styles.tipContent}>
          <Text style={styles.tipLabel}>💡 Tip of the Day</Text>
          <Text style={styles.tipText}>{tip.tip}</Text>
        </View>
      </View>

      {/* Pending Quizzes */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Pending Quizzes</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Quiz')}>
          <Text style={styles.seeAll}>See all</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={BLUE} />
        </View>
      ) : pendingQuizzes.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="checkmark-done-circle-outline" size={32} color={GREEN} />
          <Text style={styles.emptyText}>All caught up!</Text>
          <Text style={styles.emptySubText}>No pending quizzes right now</Text>
        </View>
      ) : (
        pendingQuizzes.map(q => (
          <AnimatedCard key={q.id} onPress={() => navigation.navigate('Quiz', { quizId: q.id })}>
            <View style={styles.quizCard}>
              <View style={styles.quizIconWrap}>
                <Ionicons name="document-text" size={22} color={WHITE} />
              </View>
              <View style={styles.quizInfo}>
                <Text style={styles.quizTitle}>{q.title}</Text>
                <Text style={styles.quizMeta}>Passing score: {q.passing_score}%</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={MUTED} />
            </View>
          </AnimatedCard>
        ))
      )}

      {/* Last score */}
      {lastScore && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Recent Activity</Text>
          <View style={styles.scoreCard}>
            <View style={[styles.scoreIconWrap, { backgroundColor: lastScore.score >= 80 ? GREEN : lastScore.score >= 60 ? YELLOW : RED }]}>
              <Ionicons name="trophy" size={20} color={WHITE} />
            </View>
            <View style={styles.scoreInfo}>
              <Text style={styles.scoreTitle}>{lastScore.title}</Text>
              <Text style={styles.scoreSub}>Last attempt</Text>
            </View>
            <Text style={[styles.scoreValue, { color: lastScore.score >= 80 ? GREEN : lastScore.score >= 60 ? YELLOW : RED }]}>
              {lastScore.score}%
            </Text>
          </View>
        </>
      )}

      {/* Announcements */}
      {announcements.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 8 }]}>📢 Announcements</Text>
          {announcements.map(a => (
            <View key={a.id} style={styles.announcementCard}>
              <View style={styles.announcementIconWrap}>
                <Ionicons name="megaphone" size={20} color={WHITE} />
              </View>
              <View style={styles.announcementContent}>
                <Text style={styles.announcementTitle}>{a.title}</Text>
                <Text style={styles.announcementBody}>{a.body}</Text>
                <Text style={styles.announcementTime}>{new Date(a.created_at).toLocaleDateString()}</Text>
              </View>
            </View>
          ))}
        </>
      )}

      {/* Game card */}
      <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Play & Learn</Text>
      <AnimatedCard onPress={() => navigation.navigate('Game')} style={{ marginBottom: 16 }}>
        <LinearGradient colors={['#7C3AED', '#4F46E5']} style={styles.gameCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={styles.gameCardLeft}>
            <Text style={styles.gameCardTitle}>CompuRunner</Text>
            <Text style={styles.gameCardDesc}>
              Run, dodge obstacles &amp; collect PC components. Answer questions to survive!
            </Text>
            <View style={styles.gamePlayBtn}>
              <Text style={styles.gamePlayBtnText}>Play Now →</Text>
            </View>
          </View>
          <Text style={styles.gameCardEmoji}>🏃</Text>
        </LinearGradient>
      </AnimatedCard>

      {/* Quick Access */}
      <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Quick Access</Text>
      <View style={styles.quickGrid}>
        {[
          { icon: 'book',           label: 'Materials',   screen: 'Materials',    color: PURPLE },
          { icon: 'desktop',        label: 'PC Lab',      screen: 'PC Lab',       color: GREEN  },
          { icon: 'laptop',         label: 'Windows 11',  screen: 'Windows 11',   color: BLUE   },
          { icon: 'bug',            label: 'Troubleshoot',screen: 'Troubleshoot', color: RED    },
          { icon: 'search',         label: 'Search',      screen: 'Search',       color: MUTED  },
          { icon: 'chatbubbles',    label: 'CompuBot',    screen: 'Chatbot',      color: BLUE   },
          { icon: 'settings',       label: 'Settings',    screen: 'Settings',     color: MUTED  },
        ].map((item) => (
          <AnimatedCard key={item.screen} onPress={() => navigation.navigate(item.screen)} style={styles.quickCardWrap}>
            <View style={styles.quickCard}>
              <View style={[styles.quickIconWrap, { backgroundColor: item.color }]}>
                <Ionicons name={item.icon} size={24} color={item.color === YELLOW ? TEXT : WHITE} />
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
  greetingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 16 },
  greetingText: { fontSize: 22, fontWeight: "900", color: TEXT },
  greetingSubText: { fontSize: 13, color: MUTED, marginTop: 2 },

  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginHorizontal: 16, marginBottom: 10 },
  seeAll: { fontSize: 13, fontWeight: "700", color: BLUE },

  loadingWrap: { alignItems: "center", paddingVertical: 24 },
  emptyCard: { alignItems: "center", backgroundColor: WHITE, marginHorizontal: 16, borderRadius: 16, padding: 24, marginBottom: 20, gap: 8 },
  emptyText: { fontSize: 15, fontWeight: "700", color: TEXT },
  emptySubText: { fontSize: 12, color: MUTED, textAlign: "center" },

  container: { flex: 1, backgroundColor: BG },
  content: { paddingTop: 8 },

  streakBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: WHITE,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  streakEmoji: { fontSize: 20 },
  streakText: { flex: 1, fontSize: 13, fontWeight: "700", color: TEXT },
  xpBadge: {
    backgroundColor: YELLOW,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  xpText: { fontSize: 12, fontWeight: "900", color: TEXT },

  tipCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: WHITE, marginHorizontal: 16, marginBottom: 20, borderRadius: 16, padding: 14, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  tipIconWrap: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tipContent: { flex: 1 },
  tipLabel: { fontSize: 11, fontWeight: '800', color: MUTED, marginBottom: 4 },
  tipText: { fontSize: 13, color: TEXT, lineHeight: 19, fontWeight: '500' },

  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    alignItems: "center",
    paddingVertical: 14,
    gap: 4,
  },
  statValue: { fontSize: 16, fontWeight: "900" },
  statLabel: { fontSize: 10, fontWeight: "600" },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: TEXT,
    marginHorizontal: 16,
    marginBottom: 12,
  },

  quizCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: WHITE, marginHorizontal: 16, marginBottom: 10, borderRadius: 16, padding: 14, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  quizIconWrap: { width: 46, height: 46, borderRadius: 12, backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center' },
  quizInfo: { flex: 1 },
  quizTitle: { fontSize: 14, fontWeight: '700', color: TEXT, marginBottom: 3 },
  quizMeta: { fontSize: 12, color: MUTED },

  scoreCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: WHITE, marginHorizontal: 16, marginBottom: 20, borderRadius: 16, padding: 14, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  scoreIconWrap: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  scoreInfo: { flex: 1 },
  scoreTitle: { fontSize: 14, fontWeight: '700', color: TEXT },
  scoreSub: { fontSize: 12, color: MUTED, marginTop: 2 },
  scoreValue: { fontSize: 22, fontWeight: '900' },

  gameCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, padding: 20, marginHorizontal: 16, justifyContent: 'space-between' },
  gameCardLeft: { flex: 1 },
  gameCardTitle: { fontSize: 22, fontWeight: '900', color: WHITE, marginBottom: 6 },
  gameCardDesc: { fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 18, marginBottom: 14 },
  gamePlayBtn: { backgroundColor: WHITE, alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  gamePlayBtnText: { fontSize: 13, fontWeight: '800', color: '#4F46E5' },
  gameCardEmoji: { fontSize: 56, marginLeft: 12 },

  announcementCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: WHITE, marginHorizontal: 16, marginBottom: 10, borderRadius: 16, padding: 14, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3, borderLeftWidth: 4, borderLeftColor: PURPLE },
  announcementIconWrap: { width: 38, height: 38, borderRadius: 10, backgroundColor: PURPLE, alignItems: 'center', justifyContent: 'center' },
  announcementContent: { flex: 1 },
  announcementTitle: { fontSize: 14, fontWeight: '800', color: TEXT, marginBottom: 3 },
  announcementBody: { fontSize: 13, color: MUTED, lineHeight: 19, marginBottom: 4 },
  announcementTime: { fontSize: 11, color: MUTED, fontWeight: '600' },

  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 12, marginBottom: 16 },
  quickCardWrap: { width: (width - 56) / 3 },
  quickCard: { backgroundColor: WHITE, borderRadius: 16, alignItems: 'center', paddingVertical: 18, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  quickIconWrap: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 11, fontWeight: '700', color: TEXT, textAlign: 'center' },
});

import React, { useRef, useState, useEffect, useCallback } from "react";
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
import { useFocusEffect } from "@react-navigation/native";
import { gamificationService } from "../services/gamificationservice";
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
  const [gamifyStats, setGamifyStats] = useState({ xp: 0, current_streak: 0 });
  const [user, setUser] = useState(null);
  const [quizzes, setQuizzes] = useState([]);
  const [lastScore, setLastScore] = useState(null);
  const [loadingQuizzes, setLoadingQuizzes] = useState(true);

  const tip = DAILY_TIPS[new Date().getDate() % DAILY_TIPS.length];

  // XP and streak change while the user is away in a quiz or the maze, so they
  // are refreshed every time the dashboard regains focus rather than on mount.
  useFocusEffect(
    useCallback(() => {
      gamificationService.getMyStats().then(setGamifyStats);
    }, [])
  );

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const u = await authService.getCurrentUser();
      setUser(u);

      const { data: classStudents } = await supabase
        .from("class_students").select("class_id").eq("student_id", u.id);
      const classIds = classStudents?.map((cs) => cs.class_id) || [];

      if (classIds.length > 0) {
        const { data: assignments } = await supabase
          .from("quiz_assignments").select("quiz_id").in("class_id", classIds);
        const quizIds = assignments?.map((a) => a.quiz_id) || [];

        if (quizIds.length > 0) {
          const { data: quizData } = await supabase
            .from("quizzes").select("*").in("id", quizIds).limit(3);
          setQuizzes(quizData || []);
        }
      }

      const { data: attempts } = await supabase
        .from("quiz_attempts")
        .select("score, created_at, quiz_id")
        .eq("user_id", u.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (attempts?.length > 0) {
        const { data: quizInfo } = await supabase
          .from("quizzes").select("title").eq("id", attempts[0].quiz_id).single();
        setLastScore({ score: attempts[0].score, title: quizInfo?.title || "Quiz" });
      }
    } catch {
      // Dashboard extras are best-effort; the rest of the screen still renders.
    } finally {
      setLoadingQuizzes(false);
    }
  };

  const displayName =
    user?.user_metadata?.full_name || user?.profile?.full_name || "Student";
  const firstName = displayName.split(" ")[0];

  const stats = [
    { label: "Modules", value: "25+", icon: "library", bg: BLUE, text: WHITE },
    {
      label: "Parts",
      value: "50+",
      icon: "hardware-chip",
      bg: GREEN,
      text: WHITE,
    },
    {
      label: "Students",
      value: "1K+",
      icon: "people",
      bg: PURPLE,
      text: WHITE,
    },
    { label: "Success", value: "95%", icon: "trophy", bg: YELLOW, text: TEXT },
  ];

  const features = [
    {
      title: "Component Learning",
      icon: "hardware-chip",
      bg: BLUE,
      screen: "PC Lab",
    },
    {
      title: "Drag & Drop Assembly",
      icon: "construct",
      bg: GREEN,
      screen: "PC Lab",
    },
    { title: "Troubleshooting", icon: "bug", bg: RED, screen: "Troubleshoot" },
    {
      title: "Interactive Quizzes",
      icon: "help-circle",
      bg: YELLOW,
      screen: "Quiz",
    },
  ];

  const highlights = [
    {
      title: "Real-time Assembly",
      desc: "Drag components into the PC case",
      icon: "flash",
      color: BLUE,
    },
    {
      title: "Smart Guidance",
      desc: "Step-by-step hints and feedback",
      icon: "bulb",
      color: YELLOW,
    },
    {
      title: "Progress Tracking",
      desc: "Monitor your learning journey",
      icon: "analytics",
      color: GREEN,
    },
  ];

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
          <Text style={styles.greetingText}>
            {getGreeting()}, {firstName} 👋
          </Text>
          <Text style={styles.greetingSubText}>What are you learning today?</Text>
        </View>
        <View style={styles.xpBadge}>
          <Text style={styles.xpText}>⚡ {gamifyStats.xp} XP</Text>
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

      {/* Streak banner */}
      <View style={styles.streakBanner}>
        <Text style={styles.streakEmoji}>🔥</Text>
        <Text style={styles.streakText}>
          {gamifyStats.current_streak > 0
            ? `${gamifyStats.current_streak} day streak! Keep it up!`
            : "Take a quiz today to start your streak!"}
        </Text>
      </View>

      {/* Hero */}
      <LinearGradient
        colors={[BLUE, "#1D4ED8"]}
        style={styles.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.heroIcon}>
          <Ionicons name="desktop" size={40} color={WHITE} />
        </View>
        <Text style={styles.heroTitle}>Master PC Hardware</Text>
        <Text style={styles.heroSub}>
          Learn through interactive simulations, drag-and-drop assembly, and
          hands-on challenges
        </Text>
        <AnimatedCard
          onPress={() => navigation.navigate("PC Lab")}
          style={styles.heroBtnWrap}
        >
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
            <Text style={[styles.statLabel, { color: s.text, opacity: 0.85 }]}>
              {s.label}
            </Text>
          </View>
        ))}
      </View>

      {/* Features grid */}
      <Text style={styles.sectionTitle}>What You&apos;ll Learn</Text>
      <View style={styles.featuresGrid}>
        {features.map((f, i) => (
          <AnimatedCard
            key={i}
            onPress={() => navigation.navigate(f.screen)}
            style={styles.featureCardWrap}
          >
            <View style={styles.featureCard}>
              <View style={[styles.featureIconWrap, { backgroundColor: f.bg }]}>
                <Ionicons
                  name={f.icon}
                  size={22}
                  color={f.bg === YELLOW ? TEXT : WHITE}
                />
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
        <Text style={styles.simTitle}>
          🚀 Interactive Drag & Drop{"\n"}PC Building!
        </Text>
        <Text style={styles.simDesc}>
          Experience the most realistic PC building simulator with true
          drag-and-drop interaction.
        </Text>

        <View style={styles.highlightsRow}>
          {highlights.map((h, i) => (
            <View key={i} style={styles.highlightItem}>
              <View
                style={[styles.highlightIcon, { backgroundColor: h.color }]}
              >
                <Ionicons
                  name={h.icon}
                  size={16}
                  color={h.color === YELLOW ? TEXT : WHITE}
                />
              </View>
              <Text style={styles.highlightTitle}>{h.title}</Text>
              <Text style={styles.highlightDesc}>{h.desc}</Text>
            </View>
          ))}
        </View>

        <AnimatedCard onPress={() => navigation.navigate("PC Lab")}>
          <View style={styles.simBtn}>
            <Ionicons name="hardware-chip" size={18} color={WHITE} />
            <Text style={styles.simBtnText}>Try the PC Building Simulator</Text>
          </View>
        </AnimatedCard>
      </View>

      {/* My Quizzes */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { marginHorizontal: 0, marginBottom: 0 }]}>My Quizzes</Text>
        <TouchableOpacity onPress={() => navigation.navigate("Quiz")}>
          <Text style={styles.seeAll}>See all</Text>
        </TouchableOpacity>
      </View>

      {loadingQuizzes ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={BLUE} />
        </View>
      ) : quizzes.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="document-text-outline" size={32} color={MUTED} />
          <Text style={styles.emptyText}>No quizzes assigned yet</Text>
          <Text style={styles.emptySubText}>
            Your lecturer will assign quizzes to your class
          </Text>
        </View>
      ) : (
        quizzes.map((q) => (
          <AnimatedCard key={q.id} onPress={() => navigation.navigate("Quiz", { quizId: q.id })}>
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
          <Text style={styles.sectionTitle}>Recent Activity</Text>
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

      {/* Play & Learn */}
      <Text style={styles.sectionTitle}>Play & Learn</Text>

      {/* CompuRunner card */}
      <AnimatedCard onPress={() => navigation.navigate("Game")} style={{ marginBottom: 16 }}>
        <LinearGradient
          colors={["#7C3AED", "#4F46E5"]}
          style={styles.gameCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.gameCardLeft}>
            <View style={styles.gameBadge}>
              <Text style={styles.gameBadgeText}>🎮 NEW</Text>
            </View>
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

      {/* Circuit Maze card */}
      <AnimatedCard onPress={() => navigation.navigate('CircuitMazeTopic')} style={{ marginHorizontal: 16, marginBottom: 24 }}>
        <LinearGradient colors={['#0A0E1A', '#0D1B2A']} style={styles.mazeCard}>
          <View style={styles.mazeLeft}>
            <View style={styles.mazeBadge}>
              <Text style={styles.mazeBadgeText}>🎮 NEW</Text>
            </View>
            <Text style={styles.mazeTitle}>Circuit Maze</Text>
            <Text style={styles.mazeDesc}>Answer IT questions, roll the dice{"\n"}& navigate the circuit board!</Text>
            <View style={styles.mazeTags}>
              {['❤️ 5 Lives', '⚡ XP Rewards', '🏆 Leaderboard'].map((t, i) => (
                <View key={i} style={styles.mazeTag}><Text style={styles.mazeTagText}>{t}</Text></View>
              ))}
            </View>
          </View>
          <View style={styles.mazeRight}>
            <Text style={{ fontSize: 52 }}>🔌</Text>
          </View>
        </LinearGradient>
      </AnimatedCard>

      {/* Quick nav row */}
      <Text style={styles.sectionTitle}>Quick Access</Text>
      <View style={styles.quickRow}>
        {[
          {
            label: "Materials",
            icon: "book",
            color: PURPLE,
            screen: "Materials",
          },
          {
            label: "Windows 11",
            icon: "laptop",
            color: BLUE,
            screen: "Windows 11",
          },
          {
            label: "PC Assembly",
            icon: "construct",
            color: GREEN,
            screen: "PC Assembly",
          },
          {
            label: "AI Assistant",
            icon: "chatbubble-ellipses",
            color: "#8B5CF6",
            screen: "Chatbot",
          },
          {
            label: "Settings",
            icon: "settings",
            color: MUTED,
            screen: "Settings",
          },
        ].map((item, i) => (
          <AnimatedCard
            key={i}
            onPress={() => navigation.navigate(item.screen)}
            style={{ flex: 1 }}
          >
            <View style={styles.quickCard}>
              <View
                style={[styles.quickIconWrap, { backgroundColor: item.color }]}
              >
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
  greetingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 16 },
  greetingText: { fontSize: 22, fontWeight: "900", color: TEXT },
  greetingSubText: { fontSize: 13, color: MUTED, marginTop: 2 },

  tipCard: { flexDirection: "row", alignItems: "center", backgroundColor: WHITE, marginHorizontal: 16, marginBottom: 20, borderRadius: 16, padding: 14, gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  tipIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  tipContent: { flex: 1 },
  tipLabel: { fontSize: 11, fontWeight: "800", color: MUTED, marginBottom: 4 },
  tipText: { fontSize: 13, color: TEXT, lineHeight: 19, fontWeight: "500" },

  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginHorizontal: 16, marginBottom: 10 },
  seeAll: { fontSize: 13, fontWeight: "700", color: BLUE },

  loadingWrap: { alignItems: "center", paddingVertical: 24 },
  emptyCard: { alignItems: "center", backgroundColor: WHITE, marginHorizontal: 16, borderRadius: 16, padding: 24, marginBottom: 20, gap: 8 },
  emptyText: { fontSize: 15, fontWeight: "700", color: TEXT },
  emptySubText: { fontSize: 12, color: MUTED, textAlign: "center" },

  quizCard: { flexDirection: "row", alignItems: "center", backgroundColor: WHITE, marginHorizontal: 16, marginBottom: 10, borderRadius: 16, padding: 14, gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  quizIconWrap: { width: 46, height: 46, borderRadius: 12, backgroundColor: YELLOW, alignItems: "center", justifyContent: "center" },
  quizInfo: { flex: 1 },
  quizTitle: { fontSize: 14, fontWeight: "700", color: TEXT, marginBottom: 3 },
  quizMeta: { fontSize: 12, color: MUTED },

  scoreCard: { flexDirection: "row", alignItems: "center", backgroundColor: WHITE, marginHorizontal: 16, marginBottom: 20, borderRadius: 16, padding: 14, gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  scoreIconWrap: { width: 46, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  scoreInfo: { flex: 1 },
  scoreTitle: { fontSize: 14, fontWeight: "700", color: TEXT },
  scoreSub: { fontSize: 12, color: MUTED, marginTop: 2 },
  scoreValue: { fontSize: 22, fontWeight: "900" },

  gameCard: { flexDirection: "row", alignItems: "center", borderRadius: 20, padding: 20, marginHorizontal: 16, justifyContent: "space-between" },
  gameCardLeft: { flex: 1 },
  gameBadge: { backgroundColor: YELLOW, alignSelf: "flex-start", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 8 },
  gameBadgeText: { fontSize: 10, fontWeight: "900", color: TEXT },
  gameCardTitle: { fontSize: 22, fontWeight: "900", color: WHITE, marginBottom: 6 },
  gameCardDesc: { fontSize: 12, color: "rgba(255,255,255,0.8)", lineHeight: 18, marginBottom: 14 },
  gamePlayBtn: { backgroundColor: WHITE, alignSelf: "flex-start", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  gamePlayBtnText: { fontSize: 13, fontWeight: "800", color: "#4F46E5" },
  gameCardEmoji: { fontSize: 56, marginLeft: 12 },

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

  hero: { margin: 16, borderRadius: 20, padding: 28, alignItems: "center" },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: WHITE,
    textAlign: "center",
    marginBottom: 10,
  },
  heroSub: {
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 24,
  },
  heroBtnWrap: { alignSelf: "center" },
  heroBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: WHITE,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  heroBtnText: { fontSize: 15, fontWeight: "800", color: BLUE },

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

  featuresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 24,
  },
  featureCardWrap: { width: (width - 52) / 2 },
  featureCard: {
    backgroundColor: WHITE,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  featureIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    fontSize: 12,
    fontWeight: "700",
    color: TEXT,
    textAlign: "center",
  },

  simCard: {
    backgroundColor: WHITE,
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  simTop: { marginBottom: 12 },
  simBadgeWrap: {
    alignSelf: "flex-start",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  simBadge: {
    fontSize: 10,
    fontWeight: "900",
    color: TEXT,
    letterSpacing: 0.5,
  },
  simTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: TEXT,
    marginBottom: 10,
    lineHeight: 28,
  },
  simDesc: { fontSize: 13, color: MUTED, lineHeight: 20, marginBottom: 20 },
  highlightsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  highlightItem: { flex: 1, alignItems: "center", paddingHorizontal: 4 },
  highlightIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  highlightTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: TEXT,
    textAlign: "center",
    marginBottom: 3,
  },
  highlightDesc: {
    fontSize: 9,
    color: MUTED,
    textAlign: "center",
    lineHeight: 13,
  },
  simBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BLUE,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  simBtnText: { fontSize: 14, fontWeight: "800", color: WHITE },

  quickRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 8,
  },
  quickCard: {
    backgroundColor: WHITE,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  quickIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: { fontSize: 11, fontWeight: "700", color: TEXT },

  mazeCard: {
    borderRadius: 20, padding: 20, flexDirection: "row",
    alignItems: "center", borderWidth: 1, borderColor: "#1A3A5C",
  },
  mazeLeft:  { flex: 1 },
  mazeBadge: {
    alignSelf: "flex-start", backgroundColor: "#00FF9C22", borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3, marginBottom: 8,
    borderWidth: 1, borderColor: "#00FF9C",
  },
  mazeBadgeText: { fontSize: 10, fontWeight: "900", color: "#00FF9C", letterSpacing: 1 },
  mazeTitle: { fontSize: 20, fontWeight: "900", color: "#E0F7FF", marginBottom: 6 },
  mazeDesc:  { fontSize: 12, color: "#4A7A9B", lineHeight: 18, marginBottom: 12 },
  mazeTags:  { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  mazeTag:   {
    backgroundColor: "#0F1E30", borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: "#1A3A5C",
  },
  mazeTagText: { fontSize: 10, color: "#00BFFF", fontWeight: "700" },
  mazeRight: { alignItems: "center", justifyContent: "center", paddingLeft: 12 },
});

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { supabase } from "../config/supabase";
import { authService } from "../services/authService";
import { gamificationService } from "../services/gamificationservice";

const BLUE = "#2563EB";
const YELLOW = "#FACC15";
const RED = "#EF4444";
const GREEN = "#22C55E";
const PURPLE = "#8B5CF6";
const WHITE = "#FFFFFF";
const BG = "#F3F4F6";
const TEXT = "#111827";
const MUTED = "#4B5563";
const BORDER = "#E5E7EB";

const MEDAL_COLORS = { 1: "#FFD700", 2: "#C0C0C0", 3: "#CD7F32" };

export default function LeaderboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scope, setScope] = useState("class"); // 'class' | 'global'
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [rows, setRows] = useState([]);
  const [myId, setMyId] = useState(null);

  useEffect(() => {
    init();
  }, []);

  // Fires once init() finishes (loading -> false) and again whenever
  // the person switches scope or picks a different class.
  useEffect(() => {
    if (loading) return;
    loadLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, selectedClassId, loading]);

  const init = async () => {
    try {
      const user = await authService.getCurrentUser();
      setMyId(user?.id || null);

      const { data } = await supabase
        .from("class_students")
        .select("class_id, classes(name)")
        .eq("student_id", user.id);

      const myClasses = (data || [])
        .filter((c) => c.classes)
        .map((c) => ({ id: c.class_id, name: c.classes.name }));

      setClasses(myClasses);
      setSelectedClassId(myClasses[0]?.id || null);
      setScope(myClasses.length > 0 ? "class" : "global");
    } catch {
      setScope("global");
    } finally {
      setLoading(false);
    }
  };

  const loadLeaderboard = async () => {
    const classId = scope === "class" ? selectedClassId : null;
    if (scope === "class" && !classId) {
      setRows([]);
      return;
    }
    const data = await gamificationService.getLeaderboard(classId);
    setRows(data);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLeaderboard();
    setRefreshing(false);
  };

  const switchScope = (next) => {
    if (next === scope) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setScope(next);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={PURPLE} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[PURPLE, "#7C3AED"]}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={20} color={WHITE} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Leaderboard</Text>
        <View style={{ width: 36 }} />
      </LinearGradient>

      <View style={styles.scopeToggle}>
        <TouchableOpacity
          style={[styles.scopeBtn, scope === "class" && styles.scopeBtnActive]}
          onPress={() => switchScope("class")}
          disabled={classes.length === 0}
          activeOpacity={0.75}
        >
          <Text
            style={[
              styles.scopeBtnText,
              scope === "class" && styles.scopeBtnTextActive,
            ]}
          >
            My Class
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.scopeBtn, scope === "global" && styles.scopeBtnActive]}
          onPress={() => switchScope("global")}
          activeOpacity={0.75}
        >
          <Text
            style={[
              styles.scopeBtnText,
              scope === "global" && styles.scopeBtnTextActive,
            ]}
          >
            Global
          </Text>
        </TouchableOpacity>
      </View>

      {scope === "class" && classes.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.classChipsRow}
          contentContainerStyle={styles.classChipsContent}
        >
          {classes.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[
                styles.classChip,
                selectedClassId === c.id && styles.classChipActive,
              ]}
              onPress={() => setSelectedClassId(c.id)}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.classChipText,
                  selectedClassId === c.id && styles.classChipTextActive,
                ]}
              >
                {c.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView
        style={styles.list}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 40 + insets.bottom,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[BLUE]}
            tintColor={BLUE}
          />
        }
      >
        {scope === "class" && classes.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="school-outline" size={56} color={BORDER} />
            <Text style={styles.emptyText}>You&apos;re not in a class yet</Text>
            <Text style={styles.emptySubtext}>
              Ask your lecturer to add you to see a class leaderboard
            </Text>
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="trophy-outline" size={56} color={BORDER} />
            <Text style={styles.emptyText}>No rankings yet</Text>
            <Text style={styles.emptySubtext}>
              Complete a quiz to appear on the leaderboard
            </Text>
          </View>
        ) : (
          rows.map((row, index) => {
            const rank = index + 1;
            const isMe = row.id === myId;
            return (
              <View key={row.id} style={[styles.row, isMe && styles.rowMe]}>
                <View
                  style={[
                    styles.rankWrap,
                    rank <= 3 && { backgroundColor: MEDAL_COLORS[rank] },
                  ]}
                >
                  {rank <= 3 ? (
                    <Ionicons name="trophy" size={16} color={WHITE} />
                  ) : (
                    <Text style={styles.rankText}>{rank}</Text>
                  )}
                </View>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarInitial}>
                    {(row.full_name || "?").charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {row.full_name || "Student"}
                    {isMe ? " (You)" : ""}
                  </Text>
                  <Text style={styles.rowMeta}>
                    Level {row.level} · 🔥 {row.current_streak}
                  </Text>
                </View>
                <Text style={styles.rowXp}>{row.xp} XP</Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  centered: {
    flex: 1,
    backgroundColor: BG,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 16, fontWeight: "800", color: WHITE },
  scopeToggle: {
    flexDirection: "row",
    backgroundColor: WHITE,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 4,
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  scopeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: "center",
  },
  scopeBtnActive: { backgroundColor: PURPLE },
  scopeBtnText: { fontSize: 13, fontWeight: "700", color: MUTED },
  scopeBtnTextActive: { color: WHITE },
  classChipsRow: { marginTop: 12, flexGrow: 0 },
  classChipsContent: { paddingHorizontal: 16, gap: 8 },
  classChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  classChipActive: { backgroundColor: PURPLE, borderColor: PURPLE },
  classChipText: { fontSize: 12, fontWeight: "700", color: TEXT },
  classChipTextActive: { color: WHITE },
  list: { flex: 1, marginTop: 4 },
  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyText: { fontSize: 16, fontWeight: "700", color: TEXT, marginTop: 16 },
  emptySubtext: {
    fontSize: 13,
    color: MUTED,
    marginTop: 6,
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: WHITE,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  rowMe: { borderWidth: 2, borderColor: PURPLE },
  rankWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: { fontSize: 12, fontWeight: "800", color: MUTED },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BLUE + "15",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { fontSize: 15, fontWeight: "800", color: BLUE },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: "700", color: TEXT },
  rowMeta: { fontSize: 12, color: MUTED, marginTop: 2 },
  rowXp: { fontSize: 14, fontWeight: "800", color: PURPLE },
});

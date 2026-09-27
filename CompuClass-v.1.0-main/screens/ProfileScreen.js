import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { authService } from "../services/authService";
import { gamificationService } from "../services/gamificationservice";
import { validateNewPassword, PASSWORD_HINT, PASSWORD_MAX_LENGTH } from "../utils/passwordPolicy";
import { cleanText, LIMITS } from "../utils/inputValidation";
import { getErrorMessage } from "../utils/errorMessages";

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

export default function ProfileScreen({ onLogout }) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [user, setUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [fullName, setFullName] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [gamifyStats, setGamifyStats] = useState({
    xp: 0,
    level: 1,
    current_streak: 0,
    xp_for_current_level: 0,
    xp_for_next_level: 100,
  });
  const [badges, setBadges] = useState([]);

  useEffect(() => {
    loadUser();
  }, []);

  // Refresh XP/stats every time the profile tab comes into focus
  // (e.g. after returning from Circuit Maze)
  useFocusEffect(
    useCallback(() => {
      loadGamification();
    }, [])
  );

  const loadGamification = async () => {
    const [stats, myBadges] = await Promise.all([
      gamificationService.getMyStats(),
      gamificationService.getMyBadges(),
    ]);
    setGamifyStats(stats);
    setBadges(myBadges);
  };

  const loadUser = async () => {
    try {
      const u = await authService.getCurrentUser();
      setUser(u);
      setFullName(u?.user_metadata?.full_name || u?.profile?.full_name || "");
    } catch {}
  };

  const handlePickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) setAvatarFile(result.assets[0]);
  };

  const handleEditProfile = async () => {
    if (!fullName.trim()) {
      Alert.alert("Error", "Name cannot be empty");
      return;
    }
    setLoading(true);
    try {
      const cleanName = cleanText(fullName, { field: "Name", maxLength: LIMITS.name, required: true, allowMarkup: false });
      await authService.updateProfile(cleanName, avatarFile);
      Alert.alert("Success", "Profile updated");
      setShowEditModal(false);
      setAvatarFile(null);
      loadUser();
    } catch (error) {
      Alert.alert("Error", getErrorMessage(error, { context: "Profile" }));
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert("Error", "All fields are required");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const passwordProblems = await validateNewPassword(newPassword, { email: user?.email });
      if (passwordProblems.length > 0) {
        Alert.alert("Choose a stronger password", passwordProblems.join("\n"));
        return;
      }
      await authService.updatePassword(null, newPassword);
      Alert.alert("Success", "Password changed successfully");
      setShowPasswordModal(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      Alert.alert("Error", getErrorMessage(error, { context: "Profile" }));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await authService.signOut();
            onLogout();
          } catch {
            Alert.alert("Error", "Failed to logout. Please try again.");
          }
        },
      },
    ]);
  };

  const displayName =
    user?.user_metadata?.full_name || user?.profile?.full_name || "User";
  const role = user?.profile?.role;
  const levelSpan = Math.max(
    gamifyStats.xp_for_next_level - gamifyStats.xp_for_current_level,
    1,
  );
  const levelProgress = Math.min(
    Math.max(
      (gamifyStats.xp - gamifyStats.xp_for_current_level) / levelSpan,
      0,
    ),
    1,
  );

  const actionItems = [
    {
      icon: "person-outline",
      label: "Edit Profile",
      color: BLUE,
      onPress: () => setShowEditModal(true),
    },
    {
      icon: "lock-closed-outline",
      label: "Change Password",
      color: PURPLE,
      onPress: () => setShowPasswordModal(true),
    },
    {
      icon: "settings-outline",
      label: "Settings",
      color: MUTED,
      // Previously only had `screen: "Settings"`, which nothing read, so the tile did nothing.
      onPress: () => navigation.navigate("Settings"),
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient colors={[BLUE, "#1D4ED8"]} style={styles.heroBanner}>
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          {user?.user_metadata?.avatar_url ? (
            <Image
              source={{ uri: user.user_metadata.avatar_url }}
              style={styles.avatarImg}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={40} color={BLUE} />
            </View>
          )}
        </View>
        <Text style={styles.userName}>{displayName}</Text>
        <Text style={styles.userEmail}>{user?.email || "No email"}</Text>
        {role && (
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>
              {role.charAt(0).toUpperCase() + role.slice(1)}
            </Text>
          </View>
        )}

        {/* XP + Streak row */}
        <View style={styles.gamifyRow}>
          <View style={styles.gamifyCard}>
            <Text style={styles.gamifyEmoji}>⚡</Text>
            <Text style={styles.gamifyValue}>{gamifyStats.xp}</Text>
            <Text style={styles.gamifyLabel}>XP</Text>
          </View>
          <View style={styles.gamifyDivider} />
          <View style={styles.gamifyCard}>
            <Text style={styles.gamifyEmoji}>🔥</Text>
            <Text style={styles.gamifyValue}>{gamifyStats.current_streak}</Text>
            <Text style={styles.gamifyLabel}>Day Streak</Text>
          </View>
          <View style={styles.gamifyDivider} />
          <View style={styles.gamifyCard}>
            <Text style={styles.gamifyEmoji}>🏆</Text>
            <Text style={styles.gamifyValue}>Lv {gamifyStats.level}</Text>
            <Text style={styles.gamifyLabel}>Level</Text>
          </View>
        </View>

        {/* XP progress bar */}
        <View style={styles.xpBarWrap}>
          <View style={styles.xpBarBg}>
            <View
              style={[
                styles.xpBarFill,
                { width: `${Math.round(levelProgress * 100)}%` },
              ]}
            />
          </View>
          <Text style={styles.xpBarLabel}>
            {gamifyStats.xp} / {gamifyStats.xp_for_next_level} XP to Level{" "}
            {gamifyStats.level + 1}
          </Text>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        {badges.length > 0 && (
          <View style={styles.badgesCard}>
            <Text style={styles.badgesTitle}>Badges</Text>
            <View style={styles.badgesGrid}>
              {badges.map((b) => (
                <View key={b.code} style={styles.badgeItem}>
                  <View
                    style={[
                      styles.badgeIconWrap,
                      { backgroundColor: b.earned ? YELLOW : BG },
                    ]}
                  >
                    <Ionicons
                      name={b.icon || "trophy"}
                      size={20}
                      color={b.earned ? TEXT : BORDER}
                    />
                  </View>
                  <Text
                    style={[styles.badgeName, !b.earned && { color: MUTED }]}
                  >
                    {b.name}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {actionItems.map((item, i) => (
          <TouchableOpacity
            key={i}
            style={styles.actionCard}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              item.onPress?.();
            }}
            activeOpacity={0.75}
          >
            <View
              style={[
                styles.actionIconWrap,
                { backgroundColor: item.color + "18" },
              ]}
            >
              <Ionicons name={item.icon} size={22} color={item.color} />
            </View>
            <Text style={styles.actionLabel}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={MUTED} />
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[styles.actionCard, styles.logoutCard]}
          onPress={handleLogout}
          activeOpacity={0.75}
        >
          <View
            style={[styles.actionIconWrap, { backgroundColor: RED + "18" }]}
          >
            <Ionicons name="log-out-outline" size={22} color={RED} />
          </View>
          <Text style={[styles.actionLabel, { color: RED }]}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Edit Modal */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Profile ✏️</Text>
            <TouchableOpacity
              style={styles.avatarPickerBtn}
              onPress={handlePickAvatar}
            >
              <Ionicons name="camera-outline" size={20} color={BLUE} />
              <Text style={styles.avatarPickerText}>
                {avatarFile ? "Avatar selected ✓" : "Choose Avatar"}
              </Text>
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor={MUTED}
              value={fullName}
              onChangeText={setFullName}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowEditModal(false)}
                disabled={loading}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleEditProfile}
                disabled={loading}
              >
                <Text style={styles.saveBtnText}>
                  {loading ? "Saving..." : "Save"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Password Modal */}
      <Modal visible={showPasswordModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Change Password 🔒</Text>
            <TextInput
              style={styles.input}
              placeholder="New Password"
              placeholderTextColor={MUTED}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              maxLength={PASSWORD_MAX_LENGTH}
            />
            <Text style={styles.passwordHint}>{PASSWORD_HINT}</Text>
            <TextInput
              style={styles.input}
              placeholder="Confirm New Password"
              placeholderTextColor={MUTED}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowPasswordModal(false)}
                disabled={loading}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleChangePassword}
                disabled={loading}
              >
                <Text style={styles.saveBtnText}>
                  {loading ? "Changing..." : "Change"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  passwordHint: { color: MUTED, fontSize: 12, marginTop: -4, marginBottom: 12, lineHeight: 16 },
  heroBanner: {
    alignItems: "center",
    paddingTop: 32,
    paddingBottom: 28,
    paddingHorizontal: 24,
  },
  avatarWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
    borderColor: WHITE,
    overflow: "hidden",
    marginBottom: 12,
    backgroundColor: WHITE,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImg: { width: "100%", height: "100%" },
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  userName: { fontSize: 22, fontWeight: "900", color: WHITE, marginBottom: 4 },
  userEmail: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    marginBottom: 10,
  },
  roleBadge: {
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 16,
  },
  roleText: { fontSize: 12, color: WHITE, fontWeight: "700" },
  gamifyRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    width: "100%",
    marginBottom: 14,
  },
  gamifyCard: { flex: 1, alignItems: "center", gap: 2 },
  gamifyDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.3)" },
  gamifyEmoji: { fontSize: 18 },
  gamifyValue: { fontSize: 16, fontWeight: "900", color: WHITE },
  gamifyLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "600",
  },
  xpBarWrap: { width: "100%", alignItems: "center", gap: 6 },
  xpBarBg: {
    width: "100%",
    height: 8,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 4,
    overflow: "hidden",
  },
  xpBarFill: { height: "100%", backgroundColor: YELLOW, borderRadius: 4 },
  xpBarLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "600",
  },
  content: { padding: 16, gap: 10 },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: WHITE,
    borderRadius: 16,
    padding: 16,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  logoutCard: { marginTop: 8 },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: { flex: 1, fontSize: 15, fontWeight: "700", color: TEXT },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: { backgroundColor: WHITE, borderRadius: 20, padding: 24 },
  modalTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: TEXT,
    marginBottom: 20,
  },
  avatarPickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: BLUE,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    gap: 10,
    backgroundColor: BLUE + "10",
  },
  avatarPickerText: { color: BLUE, fontWeight: "700", fontSize: 14 },
  input: {
    backgroundColor: BG,
    borderWidth: 2,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    fontSize: 15,
    color: TEXT,
  },
  modalBtns: { flexDirection: "row", gap: 12, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: BORDER,
    alignItems: "center",
  },
  cancelBtnText: { color: MUTED, fontWeight: "700" },
  saveBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: BLUE,
    alignItems: "center",
  },
  saveBtnText: { color: WHITE, fontWeight: "800" },
  badgesCard: {
    backgroundColor: WHITE,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  badgesTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: TEXT,
    marginBottom: 12,
  },
  badgesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  badgeItem: { alignItems: "center", width: 72, gap: 6 },
  badgeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeName: {
    fontSize: 10,
    fontWeight: "700",
    color: TEXT,
    textAlign: "center",
  },
});

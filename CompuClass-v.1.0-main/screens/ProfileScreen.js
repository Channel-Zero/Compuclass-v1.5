import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, Alert, Image } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { authService } from '../services/authService';
import { gamificationService } from '../services/gamificationservice';
import { validateNewPassword, PASSWORD_HINT, PASSWORD_MAX_LENGTH } from '../utils/passwordPolicy';
import { cleanText, LIMITS } from '../utils/inputValidation';
import { getErrorMessage } from '../utils/errorMessages';
import { useTheme } from '../context/ThemeContext';
import { Icon } from '../components/ui/Icon';
import {
  Page, Heading, Body, Card, Badge, Button, IconTile, Avatar, initials, Sheet, Field, Skeleton, font, useLayout,
} from '../components/ui/kit';

export default function ProfileScreen({ onLogout }) {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { laptop } = useLayout();
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [fullName, setFullName] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gamifyStats, setGamifyStats] = useState(null);
  const [badges, setBadges] = useState([]);

  useEffect(() => { loadUser(); }, []);
  useFocusEffect(useCallback(() => { loadGamification(); }, []));

  const loadGamification = async () => {
    const [stats, myBadges] = await Promise.all([gamificationService.getMyStats(), gamificationService.getMyBadges()]);
    setGamifyStats(stats);
    setBadges(myBadges || []);
  };

  const loadUser = async () => {
    try {
      const u = await authService.getCurrentUser();
      setUser(u);
      setFullName(u?.user_metadata?.full_name || u?.profile?.full_name || '');
    } catch { /* skeleton stays until a later focus */ }
    finally { setReady(true); }
  };

  const handlePickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setAvatarFile(result.assets[0]);
  };

  const handleEditProfile = async () => {
    if (!fullName.trim()) { Alert.alert('Error', 'Name cannot be empty'); return; }
    setLoading(true);
    try {
      const cleanName = cleanText(fullName, { field: 'Name', maxLength: LIMITS.name, required: true, allowMarkup: false });
      await authService.updateProfile(cleanName, avatarFile);
      Alert.alert('Success', 'Profile updated');
      setShowEditModal(false);
      setAvatarFile(null);
      loadUser();
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error, { context: 'Profile' }));
    } finally { setLoading(false); }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) { Alert.alert('Error', 'All fields are required'); return; }
    if (newPassword !== confirmPassword) { Alert.alert('Error', 'Passwords do not match'); return; }
    setLoading(true);
    try {
      const passwordProblems = await validateNewPassword(newPassword, { email: user?.email });
      if (passwordProblems.length > 0) { Alert.alert('Choose a stronger password', passwordProblems.join('\n')); return; }
      await authService.updatePassword(currentPassword, newPassword);
      Alert.alert('Success', 'Password changed successfully');
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error, { context: 'Profile' }));
    } finally { setLoading(false); }
  };

  const handleLogout = () => {
    Alert.alert('Sign out', 'Sign out of CompuClass on this device?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => { try { await authService.signOut(); onLogout(); } catch { Alert.alert('Error', 'Failed to logout. Please try again.'); } } },
    ]);
  };

  const displayName = user?.user_metadata?.full_name || user?.profile?.full_name || '';
  const role = user?.profile?.role;
  const lecturer = role === 'lecturer';
  const joined = user?.profile?.created_at || user?.created_at;
  const joinedLabel = joined ? new Date(joined).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : null;
  const points = gamifyStats?.xp || 0;
  const earned = badges.filter((b) => b.earned);

  return (
    <Page>
      <View style={{ height: 8 }} />
      {!ready ? (
        <Card style={{ padding: 24, flexDirection: 'row', gap: 16, alignItems: 'center' }}>
          <Skeleton width={72} height={72} radius={36} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="60%" height={22} />
            <Skeleton width="40%" height={14} />
          </View>
        </Card>
      ) : (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: laptop ? 32 : 20, flexWrap: 'wrap' }}>
          {user?.user_metadata?.avatar_url ? (
            <Image source={{ uri: user.user_metadata.avatar_url }} style={{ width: laptop ? 88 : 72, height: laptop ? 88 : 72, borderRadius: 44 }} />
          ) : (
            <Avatar label={initials(displayName)} size={laptop ? 88 : 72} />
          )}
          <View style={{ flex: 1, minWidth: 160 }}>
            <Heading level={1} style={{ fontSize: 26, lineHeight: 32 }}>{displayName || 'Your profile'}</Heading>
            <Body variant="small" style={{ marginTop: 4 }}>{[role ? role.charAt(0).toUpperCase() + role.slice(1) : null, joinedLabel ? `Joined ${joinedLabel}` : null].filter(Boolean).join(' · ') || user?.email}</Body>
            {lecturer ? null : <View style={{ marginTop: 8 }}><Badge label={`${points.toLocaleString()} points`} kind="yellowStrong" /></View>}
          </View>
          <Button label="Settings" icon="sliders" variant="secondary" fit onPress={() => navigation.navigate('Settings')} style={{ height: 44, minHeight: 44 }} />
        </Card>
      )}

      {lecturer ? null : (
      <Card style={{ flexDirection: 'row', marginVertical: 24 }}>
        {[
          { value: points.toLocaleString(), label: 'Points' },
          { value: gamifyStats ? `Lv ${gamifyStats.level}` : '–', label: 'Level' },
          { value: gamifyStats?.current_streak ?? '–', label: 'Day streak' },
        ].map((s, i) => (
          <View key={s.label} style={{ flex: 1, padding: 16, borderLeftWidth: i ? 1 : 0, borderLeftColor: theme.border }}>
            <Text style={[{ fontSize: 26, lineHeight: 32, color: theme.text }, font(theme, 'display')]}>{ready ? s.value : '–'}</Text>
            <Text style={[{ fontSize: 12, color: theme.textTertiary }, font(theme, 'body')]}>{s.label}</Text>
          </View>
        ))}
      </Card>
      )}

      <View style={laptop ? { flexDirection: 'row', gap: 32, alignItems: 'flex-start', flexWrap: 'wrap' } : undefined}>
        <View style={{ width: 400, maxWidth: '100%' }}>
          <Heading level={2} style={{ marginBottom: 16 }}>Account</Heading>
          <Card>
            {[
              { icon: 'user', label: 'Edit profile', onPress: () => setShowEditModal(true) },
              { icon: 'lock', label: 'Change password', onPress: () => setShowPasswordModal(true) },
              ...(role === 'lecturer' ? [] : [{ icon: 'school', label: 'Join a class', onPress: () => navigation.navigate('JoinClass') }]),
            ].map((item, i) => (
              <Pressable key={item.label} onPress={item.onPress} accessibilityRole="button" accessibilityLabel={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, minHeight: 72, borderTopWidth: i ? 1 : 0, borderTopColor: theme.borderLight }}>
                <IconTile name={item.icon} tone={i === 1 ? 'neutral' : 'blue'} />
                <Text style={[{ flex: 1, color: theme.text }, font(theme, 'h3')]}>{item.label}</Text>
                <Icon name="chev" size={18} color={theme.textTertiary} tone="transparent" />
              </Pressable>
            ))}
          </Card>
          <Pressable onPress={handleLogout} accessibilityRole="button" accessibilityLabel="Sign out" style={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, minHeight: 72, marginTop: 16 }}>
            <IconTile name="logout" tone="neutral" />
            <Text style={[{ color: theme.error, fontSize: 16 }, font(theme, 'semibold')]}>Sign out</Text>
          </Pressable>
        </View>
        {lecturer ? null : <View style={{ flex: 1, marginTop: laptop ? 0 : 32 }}>
          <Heading level={2} style={{ marginBottom: 16 }}>Badges{badges.length ? ` · ${earned.length} of ${badges.length}` : ''}</Heading>
          {badges.length === 0 ? (
            <Card style={{ padding: 20 }}><Body variant="small">Badges you earn from quizzes and streaks show up here.</Body></Card>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {badges.map((b) => (
                <Card key={b.code} style={{ width: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, opacity: b.earned ? 1 : 0.55 }}>
                  <IconTile name="medal" tone={b.earned ? 'yellow' : 'neutral'} />
                  <Text style={[{ flex: 1, fontSize: 14, color: theme.text }, font(theme, 'semibold')]}>{b.name}</Text>
                </Card>
              ))}
            </View>
          )}
        </View>}
      </View>

      <Sheet visible={showEditModal} onClose={() => setShowEditModal(false)} title="Edit profile">
        <Button block label={avatarFile ? 'Photo selected' : 'Choose a photo'} icon="user" variant="secondary" onPress={handlePickAvatar} accessibilityLabel="Choose avatar" style={{ marginBottom: 16 }} />
        <Field label="Full name" icon="user" placeholder="Full Name" value={fullName} onChangeText={setFullName} autoCapitalize="words" />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Button label="Cancel" variant="secondary" onPress={() => setShowEditModal(false)} style={{ flex: 1 }} />
          <Button label={loading ? 'Saving...' : 'Save'} onPress={handleEditProfile} disabled={loading} style={{ flex: 1 }} />
        </View>
      </Sheet>

      <Sheet visible={showPasswordModal} onClose={() => setShowPasswordModal(false)} title="Change password">
        <Field label="Current password" icon="lock" placeholder="Current Password" value={currentPassword} onChangeText={setCurrentPassword} secure secureVisible={showCurrent} onToggleSecure={() => setShowCurrent((v) => !v)} />
        <Field label="New password" icon="lock" placeholder="New Password" value={newPassword} onChangeText={setNewPassword} secure secureVisible={showNew} onToggleSecure={() => setShowNew((v) => !v)} maxLength={PASSWORD_MAX_LENGTH} hint={PASSWORD_HINT} />
        <Field label="Confirm password" icon="lock" placeholder="Confirm New Password" value={confirmPassword} onChangeText={setConfirmPassword} secure />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Button label="Cancel" variant="secondary" onPress={() => setShowPasswordModal(false)} style={{ flex: 1 }} />
          <Button label={loading ? 'Changing...' : 'Change'} onPress={handleChangePassword} disabled={loading} style={{ flex: 1 }} />
        </View>
      </Sheet>
    </Page>
  );
}

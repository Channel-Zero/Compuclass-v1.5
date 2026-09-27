import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch, Alert, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '../services/authService';
import { supabase } from '../config/supabase';
import { saveTextFile } from '../utils/fileDownload';
import { getErrorMessage } from '../utils/errorMessages';

const BLUE = '#2563EB'; const WHITE = '#FFFFFF'; const BG = '#F3F4F6';
const TEXT = '#111827'; const MUTED = '#4B5563'; const BORDER = '#E5E7EB';

export default function SettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState(true);
  const [soundEffects, setSoundEffects] = useState(true);

  useEffect(() => { loadUser(); loadSettings(); }, []);

  const loadUser = async () => { const u = await authService.getCurrentUser(); setUser(u); };

  const loadSettings = async () => {
    try {
      const vals = await AsyncStorage.multiGet(['notifications', 'soundEffects']);
      vals.forEach(([key, val]) => {
        if (val !== null) {
          if (key === 'notifications') setNotifications(JSON.parse(val));
          if (key === 'soundEffects') setSoundEffects(JSON.parse(val));
        }
      });
    } catch {}
  };

  const saveSetting = async (key, value) => { await AsyncStorage.setItem(key, JSON.stringify(value)); };

  const handleExportData = async () => {
    try {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      const exportData = JSON.stringify({ user: { email: user.email, name: user.user_metadata?.full_name }, profile, exportDate: new Date().toISOString() }, null, 2);
      const outcome = await saveTextFile(`compuclass_data_${Date.now()}.json`, exportData);
      if (outcome === 'downloaded') Alert.alert('Success', 'Your data has been downloaded.');
      else if (outcome !== 'shared') Alert.alert('Success', 'Data exported to: ' + outcome);
    } catch (error) { Alert.alert('Error', getErrorMessage(error, { context: 'ExportData', fallback: 'Failed to export data' })); }
  };

  const sections = [
    {
      title: 'Preferences',
      items: [
        { icon: 'notifications', label: 'Notifications', subtitle: 'Push notifications', color: BLUE, hasSwitch: true, value: notifications, onToggle: (v) => { setNotifications(v); saveSetting('notifications', v); } },
        { icon: 'volume-medium', label: 'Sound Effects', subtitle: 'In-app sounds', color: '#8B5CF6', hasSwitch: true, value: soundEffects, onToggle: (v) => { setSoundEffects(v); saveSetting('soundEffects', v); } },
      ],
    },
    {
      title: 'Data',
      items: [
        { icon: 'download', label: 'Export My Data', subtitle: 'Download your learning data', color: '#22C55E', onPress: handleExportData },
      ],
    },
    {
      title: 'About',
      items: [
        { icon: 'information-circle', label: 'About CompuClass', subtitle: 'Version 1.0.0', color: '#FACC15', onPress: () => Alert.alert('CompuClass', `Version 1.0.0\n\nInteractive Computer Learning Platform\n\n© ${new Date().getFullYear()} CompuClass`) },
      ],
    },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}>
      <LinearGradient colors={[BLUE, '#1D4ED8']} style={styles.heroBanner}>
        <View style={styles.avatarWrap}>
          {user?.user_metadata?.avatar_url
            ? <Image source={{ uri: user.user_metadata.avatar_url }} style={styles.avatarImg} />
            : <View style={styles.avatarPlaceholder}><Ionicons name="person" size={32} color={BLUE} /></View>}
        </View>
        <Text style={styles.userName}>{user?.user_metadata?.full_name || 'User'}</Text>
        <Text style={styles.userEmail}>{user?.email || 'No email'}</Text>
      </LinearGradient>

      <View style={styles.content}>
        {sections.map((section, si) => (
          <View key={si} style={styles.section}>
            <Text style={styles.sectionLabel}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, ii) => (
                <React.Fragment key={ii}>
                  {ii > 0 && <View style={styles.divider} />}
                  <TouchableOpacity style={styles.row} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); item.onPress?.(); }} disabled={item.hasSwitch} activeOpacity={0.75}>
                    <View style={[styles.rowIconWrap, { backgroundColor: item.color + '20' }]}>
                      <Ionicons name={item.icon} size={20} color={item.color} />
                    </View>
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowLabel}>{item.label}</Text>
                      <Text style={styles.rowSubtitle}>{item.subtitle}</Text>
                    </View>
                    {item.hasSwitch
                      ? <Switch value={item.value} onValueChange={item.onToggle} trackColor={{ false: BORDER, true: BLUE + '60' }} thumbColor={item.value ? BLUE : '#9CA3AF'} />
                      : <Ionicons name="chevron-forward" size={18} color={MUTED} />}
                  </TouchableOpacity>
                </React.Fragment>
              ))}
            </View>
          </View>
        ))}
        <Text style={styles.version}>CompuClass — Interactive Computer Learning • v1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  heroBanner: { alignItems: 'center', paddingTop: 32, paddingBottom: 40 },
  avatarWrap: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: WHITE, overflow: 'hidden', marginBottom: 12, backgroundColor: WHITE, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: '100%', height: '100%' },
  avatarPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  userName: { fontSize: 20, fontWeight: '900', color: WHITE, marginBottom: 4 },
  userEmail: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  content: { padding: 16, paddingBottom: 40 },
  section: { marginBottom: 20 },
  sectionLabel: { fontSize: 12, fontWeight: '800', color: MUTED, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 },
  sectionCard: { backgroundColor: WHITE, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  divider: { height: 1, backgroundColor: BORDER, marginHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  rowIconWrap: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowInfo: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '700', color: TEXT },
  rowSubtitle: { fontSize: 12, color: MUTED, marginTop: 2 },
  version: { textAlign: 'center', fontSize: 12, color: MUTED, marginTop: 8 },
});

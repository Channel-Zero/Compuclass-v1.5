import React, { useCallback, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { classService } from '../services/classService';
import { getErrorMessage } from '../utils/errorMessages';
import { appTheme, useTheme } from '../context/ThemeContext';
import { useLayout } from '../components/ui/kit';
import { useShellBack } from '../context/ChromeContext';
import { leaveScreen } from '../utils/screenNav';

const BLUE = appTheme.primary;
const WHITE = appTheme.surface;
const BG = appTheme.background;
const TEXT = appTheme.text;
const MUTED = appTheme.textSecondary;
const CARD = appTheme.card;

export default function JoinClassScreen({ navigation }) {
  const { theme } = useTheme();
  const shellBack = useShellBack();
  const insets = useSafeAreaInsets();
  const { bottom, phone } = useLayout();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [joined, setJoined] = useState(null);
  const [classes, setClasses] = useState([]);

  const refresh = useCallback(async () => {
    setClasses(await classService.myClasses());
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const submit = async () => {
    setLoading(true);
    try {
      const result = await classService.joinClassByCode(code);
      setJoined(result);
      setCode('');
      await refresh();
    } catch (error) {
      Alert.alert('Join a class', getErrorMessage(error, { context: 'JoinClass', fallback: 'Class code not found' }));
    } finally {
      setLoading(false);
    }
  };

  const leave = (item) => {
    Alert.alert('Leave class', `Leave ${item.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            await classService.leaveClass(item.id);
            if (joined?.class_id === item.id) setJoined(null);
            await refresh();
          } catch (error) {
            Alert.alert('Leave class', getErrorMessage(error, { context: 'JoinClass' }));
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { paddingBottom: phone ? bottom : insets.bottom + 24, backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        {shellBack ? <View style={styles.backBtn} /> : (
          <TouchableOpacity onPress={() => leaveScreen(navigation)} style={[styles.backBtn, { backgroundColor: theme.tint }]} accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={20} color={theme.text} />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle} accessibilityRole="header">Join a class</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.body}>
        <Text style={styles.help}>Enter the 6-character code from your lecturer.</Text>
        <TextInput
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={8}
          placeholder="AB23CD"
          placeholderTextColor={MUTED}
          style={styles.input}
          accessibilityLabel="Class code"
        />
        <TouchableOpacity style={styles.button} onPress={submit} disabled={loading} accessibilityRole="button" accessibilityLabel="Join class">
          {loading ? <ActivityIndicator color={WHITE} /> : <Text style={styles.buttonText}>Join class</Text>}
        </TouchableOpacity>

        {joined?.name ? (
          <View style={styles.success}>
            <Ionicons name="checkmark-circle" size={22} color="#17743F" />
            <Text style={styles.successText}>You joined {joined.name}.</Text>
          </View>
        ) : null}

        {classes.map((item) => (
          <View key={item.id} style={styles.classRow}>
            <Text style={styles.className}>{item.name}</Text>
            <TouchableOpacity onPress={() => leave(item)} style={styles.leaveBtn} accessibilityRole="button" accessibilityLabel={`Leave ${item.name}`}>
              <Text style={styles.leave}>Leave</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16, gap: 12, backgroundColor: WHITE, borderBottomWidth: 1, borderBottomColor: '#DCE6EF' },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#EDF4FF', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: TEXT, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  body: { padding: 16 },
  help: { color: MUTED, fontSize: 14, marginBottom: 12 },
  input: { backgroundColor: CARD, borderRadius: 12, padding: 14, fontSize: 20, letterSpacing: 4, fontWeight: '800', color: TEXT, marginBottom: 12 },
  button: { backgroundColor: BLUE, minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', maxWidth: 400 },
  buttonText: { color: WHITE, fontWeight: '800', fontSize: 16 },
  success: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, backgroundColor: '#DCFCE7', borderRadius: 12, padding: 12 },
  successText: { color: TEXT, fontWeight: '700', flex: 1 },
  classRow: { marginTop: 12, backgroundColor: CARD, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center' },
  className: { flex: 1, color: TEXT, fontWeight: '700' },
  leaveBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  leave: { color: '#B01E38', fontWeight: '700' },
});

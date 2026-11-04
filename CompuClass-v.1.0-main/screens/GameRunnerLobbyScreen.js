import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
  TextInput, ActivityIndicator, FlatList, ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { gameRunnerService } from '../services/gameRunnerService';
import { authService } from '../services/authService';
import { getErrorMessage } from '../utils/errorMessages';
import { useTheme } from '../context/ThemeContext';
import { useShellBack } from '../context/ChromeContext';
import { leaveScreen } from '../utils/screenNav';
import { font, useLayout } from '../components/ui/kit';
import { runnerArt } from '../assets/runner/art';
import { WORLD_STORAGE_KEY, normalizeWorld } from '../utils/runnerEngine';

export default function GameRunnerLobbyScreen({ navigation }) {
  const { theme } = useTheme();
  const { bottom, phone } = useLayout();
  const shellBack = useShellBack();
  const [mode, setMode] = useState(null); // null | 'host' | 'join'
  const [joinCode, setJoinCode] = useState('');
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [myId, setMyId] = useState(null);
  const channelRef = useRef(null);
  const launchedRef = useRef(false);
  const [city, setCity] = useState('light');

  useEffect(() => {
    AsyncStorage.getItem(WORLD_STORAGE_KEY).then((value) => {
      setCity(normalizeWorld(value));
    }).catch(() => {});
  }, []);

  const chooseCity = (next) => {
    const world = normalizeWorld(next);
    setCity(world);
    AsyncStorage.setItem(WORLD_STORAGE_KEY, world).catch(() => {});
  };

  const teardownChannel = () => {
    if (!channelRef.current) return;
    gameRunnerService.unsubscribe(channelRef.current);
    channelRef.current = null;
  };

  useEffect(() => {
    authService.getCurrentUser().then(u => setMyId(u?.id));
    return teardownChannel;
  }, []);

  const refreshPlayers = async (roomId) => {
    const p = await gameRunnerService.getRoomPlayers(roomId);
    setPlayers(p);
  };

  const handleHost = async () => {
    setLoading(true); setError('');
    const r = await gameRunnerService.createRoom();
    if (!r) { setError('Could not create room. Try again.'); setLoading(false); return; }
    setRoom(r);
    setMode('host');
    await refreshPlayers(r.id);
    channelRef.current = gameRunnerService.subscribeToRoom(
      r.id,
      () => refreshPlayers(r.id),
      (updated) => { if (updated.status === 'playing') launchGame(r.id); }
    );
    setLoading(false);
  };

  const handleJoin = async () => {
    if (joinCode.length < 4) { setError('Enter a valid room code.'); return; }
    setLoading(true); setError('');
    try {
      const r = await gameRunnerService.joinRoom(joinCode);
      setRoom(r);
      setMode('join');
      await refreshPlayers(r.id);
      channelRef.current = gameRunnerService.subscribeToRoom(
        r.id,
        () => refreshPlayers(r.id),
        (updated) => { if (updated.status === 'playing') launchGame(r.id); }
      );
    } catch (e) {
      setError(getErrorMessage(e, { context: 'GameRunnerLobby', fallback: 'Room not found.' }));
    }
    setLoading(false);
  };

  const handleStart = async () => {
    if (!room) return;
    setError('');
    try {
      await gameRunnerService.startRoom(room.id);
      launchGame(room.id);
    } catch (e) {
      setError(getErrorMessage(e, { context: 'GameRunnerLobby', fallback: 'Could not start the game. Try again.' }));
    }
  };

  const launchGame = (roomId) => {
    if (launchedRef.current) return;
    launchedRef.current = true;
    // Deferred: this can be called from inside the room channel's own
    // realtime dispatch (the 'playing' status update). Tearing the channel
    // down synchronously from within its own message handler crashes the
    // realtime client, so we let that dispatch finish unwinding first.
    setTimeout(() => {
      teardownChannel();
      navigation.navigate('Game', { roomId, multiplayer: true });
    }, 0);
  };

  const isHost = room && players[0]?.user_id === myId;

  const glassBack = [s.backBtn, { backgroundColor: theme.glassFill, borderColor: theme.glassBorder }];

  if (mode === 'host' || mode === 'join') {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => { teardownChannel(); setMode(null); setRoom(null); }} style={glassBack} accessibilityRole="button" accessibilityLabel="Back to lobby">
            <Ionicons name="chevron-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: theme.text }, font(theme, 'h2')]}>Waiting room</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={s.column}>
          <View style={[s.codeBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[s.codeLabel, { color: theme.textTertiary }, font(theme, 'semibold')]}>Room code</Text>
            <Text style={[s.codeValue, { color: theme.primary }, font(theme, 'display')]}>{room?.code}</Text>
            <Text style={[s.codeHint, { color: theme.textSecondary }, font(theme, 'body')]}>Share this code with classmates</Text>
          </View>

          <Text style={[s.sectionLabel, { color: theme.textTertiary }, font(theme, 'semibold')]}>Players ({players.length})</Text>
          <FlatList
            data={players}
            keyExtractor={p => p.id}
            style={s.playerList}
            renderItem={({ item, index }) => (
              <View style={[s.playerRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={[s.playerAvatar, { backgroundColor: index === 0 ? theme.secondary : theme.tint }]}>
                  <Text style={[s.playerInitial, { color: index === 0 ? theme.accentInk : theme.primaryInk }, font(theme, 'h2')]}>{(item.full_name || '?')[0].toUpperCase()}</Text>
                </View>
                <Text style={[s.playerName, { color: theme.text }, font(theme, 'semibold')]}>{item.full_name || 'Player'}</Text>
                {index === 0 && (
                  <Text style={[s.hostBadge, { color: theme.yellowInk, backgroundColor: theme.yellowTint }, font(theme, 'semibold')]}>Host</Text>
                )}
              </View>
            )}
          />

          {isHost && (
            <TouchableOpacity
              style={[s.actionBtn, players.length < 2 && s.startBtnDisabled]}
              onPress={handleStart}
              disabled={players.length < 2}
              accessibilityRole="button"
              accessibilityLabel={players.length < 2 ? 'Waiting for players' : 'Start race'}
            >
              <Text style={[s.actionBtnText, font(theme, 'semibold')]}>
                {players.length < 2 ? 'Waiting for players...' : 'Start race'}
              </Text>
            </TouchableOpacity>
          )}
          {!isHost && (
            <View style={s.waitingWrap}>
              <ActivityIndicator color={theme.primary} />
              <Text style={[s.waitingText, { color: theme.textSecondary }, font(theme, 'body')]}>Waiting for host to start...</Text>
            </View>
          )}
          {error ? <Text style={[s.errorText, { color: theme.error }]}>{error}</Text> : null}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={[s.scroll, phone ? { paddingBottom: bottom } : null]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          {shellBack ? <View style={{ width: 44 }} /> : (
            <TouchableOpacity onPress={() => leaveScreen(navigation)} style={glassBack} accessibilityRole="button" accessibilityLabel="Go back">
              <Ionicons name="chevron-back" size={22} color={theme.text} />
            </TouchableOpacity>
          )}
          <Text style={[s.headerTitle, { color: theme.text }, font(theme, 'h2')]}>CompuRunner</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={s.banner}>
          <Image source={city === 'dark' ? runnerArt.world.nightSky : runnerArt.world.sky} style={s.bannerSky} resizeMode="cover" accessibilityElementsHidden />
          <Image source={city === 'dark' ? runnerArt.world.nightBuildings : runnerArt.world.buildings} style={s.bannerBuildings} resizeMode="cover" accessibilityElementsHidden />
          <Image source={runnerArt.plate} style={s.bannerPlate} resizeMode="repeat" accessibilityElementsHidden />
          <Image source={runnerArt.player.idle} style={s.bannerRunner} resizeMode="contain" accessibilityElementsHidden />
          <Text style={[s.bannerTitle, font(theme, 'display')]}>COMPURUNNER</Text>
          <Text style={[s.bannerSub, font(theme, 'body')]}>Grab a computer part, answer the question, and race classmates.</Text>
        </View>

        <View style={s.worldRow}>
          <TouchableOpacity
            onPress={() => chooseCity('light')}
            style={[s.worldBtn, city === 'light' && s.worldOn]}
            accessibilityRole="button"
            accessibilityLabel="Light city"
            accessibilityState={{ selected: city === 'light' }}
          >
            <Text style={[s.worldText, font(theme, 'semibold')]}>Light city</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => chooseCity('dark')}
            style={[s.worldBtn, city === 'dark' && s.worldOn]}
            accessibilityRole="button"
            accessibilityLabel="Night city"
            accessibilityState={{ selected: city === 'dark' }}
          >
            <Text style={[s.worldText, font(theme, 'semibold')]}>Night city</Text>
          </TouchableOpacity>
        </View>

        <View style={s.modesWrap}>
          <TouchableOpacity
            style={[s.modeCard, s.modeSolo]}
            onPress={() => navigation.navigate('Game')}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Solo Run"
          >
            <Image source={runnerArt.ui.solo} style={s.modeIcon} accessibilityElementsHidden />
            <Text style={[s.modeTitle, s.modeTitleOn, font(theme, 'h3')]}>Solo Run</Text>
            <Text style={[s.modeDesc, s.modeDescOn, font(theme, 'body')]}>Practice alone and chase your high score</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.modeCard, s.modeHost]}
            onPress={handleHost}
            activeOpacity={0.85}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Host Race"
          >
            <Image source={runnerArt.ui.multi} style={s.modeIcon} accessibilityElementsHidden />
            <Text style={[s.modeTitle, s.modeTitleOn, font(theme, 'h3')]}>Host Race</Text>
            <Text style={[s.modeDesc, s.modeDescOn, font(theme, 'body')]}>Create a room and invite classmates with a code</Text>
          </TouchableOpacity>
        </View>

        <View style={s.joinWrap}>
          <Text style={[s.joinLabel, { color: theme.textTertiary }, font(theme, 'semibold')]}>Join with code</Text>
          <View style={s.joinRow}>
            <TextInput
              style={[s.joinInput, { backgroundColor: theme.surface, borderColor: theme.inputBorder, color: theme.text }, font(theme, 'h2')]}
              value={joinCode}
              onChangeText={t => setJoinCode(t.toUpperCase())}
              placeholder="XXXXXX"
              placeholderTextColor={theme.textTertiary}
              maxLength={6}
              autoCapitalize="characters"
              accessibilityLabel="Room code"
            />
            <TouchableOpacity
              style={s.joinBtn}
              onPress={handleJoin}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Join"
            >
              {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={[s.joinBtnText, font(theme, 'semibold')]}>Join</Text>}
            </TouchableOpacity>
          </View>
          {error ? <Text style={[s.errorText, { color: theme.error }]}>{error}</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingBottom: 48 },
  column: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, paddingBottom: 8, paddingHorizontal: 20, width: '100%', maxWidth: 720, alignSelf: 'center' },
  backBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, color: '#0B1B3A' },
  banner: {
    alignSelf: 'center', marginHorizontal: 20, marginBottom: 20,
    height: 220, borderRadius: 20, overflow: 'hidden', backgroundColor: '#10203A',
    borderWidth: 4, borderColor: '#041018', maxWidth: 720, width: '92%',
  },
  bannerSky: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, width: '100%', height: '100%' },
  bannerBuildings: { position: 'absolute', left: 0, right: 0, bottom: 36, height: 120, width: '100%' },
  bannerPlate: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 40, width: '100%' },
  bannerRunner: { position: 'absolute', left: 36, bottom: 28, width: 80, height: 110 },
  worldRow: { flexDirection: 'row', gap: 12, width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 20, marginBottom: 16 },
  worldBtn: { flex: 1, minHeight: 56, borderRadius: 14, borderWidth: 4, borderColor: '#041018', backgroundColor: '#10203A', alignItems: 'center', justifyContent: 'center' },
  worldOn: { backgroundColor: '#0A66FF' },
  worldText: { color: '#fff', fontSize: 16 },
  bannerTitle: { position: 'absolute', left: 140, right: 16, top: 48, color: '#fff', fontSize: 32, letterSpacing: 1 },
  bannerSub: { position: 'absolute', left: 140, right: 20, top: 100, color: '#F7FBFD', fontSize: 15, lineHeight: 22 },
  modeIcon: { width: 36, height: 36, tintColor: '#fff' },
  modesWrap: { flexDirection: 'row', gap: 12, marginBottom: 24, width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 20 },
  modeCard: { flex: 1, borderRadius: 16, borderWidth: 4, borderColor: '#041018', padding: 18, alignItems: 'flex-start', justifyContent: 'flex-end', minHeight: 168, minWidth: 160 },
  modeSolo: { backgroundColor: '#0A66FF' },
  modeHost: { backgroundColor: '#10203A' },
  modeTitle: { fontSize: 20, marginTop: 12, marginBottom: 4 },
  modeTitleOn: { color: '#fff' },
  modeDesc: { fontSize: 14, lineHeight: 20 },
  modeDescOn: { color: '#F7FBFD' },
  joinLabel: { fontSize: 14, marginBottom: 8 },
  joinWrap: { marginBottom: 24, width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 20 },
  joinRow: { gap: 10 },
  joinInput: { width: '100%', borderRadius: 14, paddingHorizontal: 16, minHeight: 56, height: 56, fontSize: 18, letterSpacing: 4, borderWidth: 1 },
  joinBtn: { height: 56, minWidth: 240, width: '100%', paddingHorizontal: 22, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A66FF', borderWidth: 4, borderColor: '#041018' },
  joinBtnText: { fontSize: 15, color: '#fff' },
  errorText: { fontSize: 13, marginTop: 8 },
  codeBox: { borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 24, borderWidth: 1 },
  codeLabel: { fontSize: 13, marginBottom: 6 },
  codeValue: { fontSize: 36, letterSpacing: 8, marginBottom: 4 },
  codeHint: { fontSize: 13 },
  sectionLabel: { fontSize: 14, marginBottom: 10 },
  playerList: { flex: 1, marginBottom: 16 },
  playerRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 12, marginBottom: 8, gap: 12, borderWidth: 1 },
  playerAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  playerInitial: { fontSize: 16 },
  playerName: { flex: 1, fontSize: 15 },
  hostBadge: { fontSize: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  actionBtn: { height: 56, minWidth: 240, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 16, width: '100%', maxWidth: 400, alignSelf: 'center', backgroundColor: '#0A66FF', borderWidth: 4, borderColor: '#041018' },
  startBtnDisabled: { opacity: 0.45 },
  actionBtnText: { fontSize: 15, color: '#fff' },
  waitingWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingBottom: 16, minHeight: 48 },
  waitingText: { fontSize: 14 },
});

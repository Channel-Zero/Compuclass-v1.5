import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { gameRunnerService } from '../services/gameRunnerService';
import { authService } from '../services/authService';
import { getErrorMessage } from '../utils/errorMessages';

const C = {
  bg: '#0B1226', panel: '#141B34', border: '#2A2F55',
  text: '#E7ECF7', muted: '#7C8AAB',
  purple: '#7C3AED', indigo: '#4F46E5', yellow: '#FACC15', hard: '#FF4757',
};

export default function GameRunnerLobbyScreen({ navigation }) {
  const [mode, setMode] = useState(null); // null | 'host' | 'join'
  const [joinCode, setJoinCode] = useState('');
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [myId, setMyId] = useState(null);
  const channelRef = useRef(null);
  const launchedRef = useRef(false);

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

  if (mode === 'host' || mode === 'join') {
    return (
      <SafeAreaView style={s.safe}>
        <LinearGradient colors={[C.bg, '#060A16']} style={s.container}>
          <View style={s.header}>
            <TouchableOpacity onPress={() => { teardownChannel(); setMode(null); setRoom(null); }} style={s.backBtn}>
              <Ionicons name="chevron-back" size={22} color={C.text} />
            </TouchableOpacity>
            <Text style={s.headerTitle}>🏃 WAITING ROOM</Text>
            <View style={{ width: 36 }} />
          </View>

          <View style={s.codeBox}>
            <Text style={s.codeLabel}>ROOM CODE</Text>
            <Text style={s.codeValue}>{room?.code}</Text>
            <Text style={s.codeHint}>Share this code with classmates</Text>
          </View>

          <Text style={s.sectionLabel}>PLAYERS ({players.length})</Text>
          <FlatList
            data={players}
            keyExtractor={p => p.id}
            style={s.playerList}
            renderItem={({ item, index }) => (
              <View style={s.playerRow}>
                <View style={s.playerAvatar}>
                  <Text style={s.playerInitial}>{(item.full_name || '?')[0].toUpperCase()}</Text>
                </View>
                <Text style={s.playerName}>{item.full_name || 'Player'}</Text>
                {index === 0 && <Text style={s.hostBadge}>HOST</Text>}
              </View>
            )}
          />

          {isHost && (
            <TouchableOpacity
              style={[s.startBtn, players.length < 2 && s.startBtnDisabled]}
              onPress={handleStart}
              disabled={players.length < 2}
            >
              <Text style={s.startBtnText}>
                {players.length < 2 ? 'Waiting for players...' : '▶ START RACE'}
              </Text>
            </TouchableOpacity>
          )}
          {!isHost && (
            <View style={s.waitingWrap}>
              <ActivityIndicator color={C.purple} />
              <Text style={s.waitingText}>Waiting for host to start...</Text>
            </View>
          )}
          {error ? <Text style={s.errorText}>{error}</Text> : null}
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <LinearGradient colors={[C.bg, '#060A16']} style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>🏃 COMPURUNNER</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={s.heroWrap}>
          <Text style={s.heroEmoji}>🏃</Text>
          <Text style={s.heroTitle}>CompuRunner</Text>
          <Text style={s.heroSub}>Dodge obstacles, collect PC components{'\n'}and race classmates to the finish!</Text>
        </View>

        <View style={s.modesWrap}>
          <TouchableOpacity style={s.modeCard} onPress={() => navigation.navigate('Game')} activeOpacity={0.85}>
            <LinearGradient colors={['#1E293B', '#0F172A']} style={s.modeGrad}>
              <Text style={s.modeIcon}>🤖</Text>
              <Text style={s.modeTitle}>Solo Run</Text>
              <Text style={s.modeDesc}>Practice alone, chase{'\n'}your high score</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={s.modeCard} onPress={handleHost} activeOpacity={0.85} disabled={loading}>
            <LinearGradient colors={['#3B2A6B', '#1E1447']} style={s.modeGrad}>
              <Text style={s.modeIcon}>📡</Text>
              <Text style={s.modeTitle}>Host Race</Text>
              <Text style={s.modeDesc}>Create a room and invite{'\n'}classmates with a code</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={s.joinWrap}>
          <Text style={s.joinLabel}>JOIN WITH CODE</Text>
          <View style={s.joinRow}>
            <TextInput
              style={s.joinInput}
              value={joinCode}
              onChangeText={t => setJoinCode(t.toUpperCase())}
              placeholder="XXXXXX"
              placeholderTextColor={C.muted}
              maxLength={6}
              autoCapitalize="characters"
            />
            <TouchableOpacity style={s.joinBtn} onPress={handleJoin} disabled={loading}>
              {loading ? <ActivityIndicator color={C.bg} size="small" /> : <Text style={s.joinBtnText}>JOIN</Text>}
            </TouchableOpacity>
          </View>
          {error ? <Text style={s.errorText}>{error}</Text> : null}
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, paddingBottom: 8 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.panel, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '900', color: C.purple, letterSpacing: 2 },
  heroWrap: { alignItems: 'center', paddingVertical: 24 },
  heroEmoji: { fontSize: 56, marginBottom: 8 },
  heroTitle: { fontSize: 26, fontWeight: '900', color: C.text, marginBottom: 8 },
  heroSub: { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 20 },
  modesWrap: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  modeCard: { flex: 1, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: C.border },
  modeGrad: { padding: 18, alignItems: 'center' },
  modeIcon: { fontSize: 32, marginBottom: 8 },
  modeTitle: { fontSize: 14, fontWeight: '900', color: C.text, marginBottom: 4 },
  modeDesc: { fontSize: 11, color: C.muted, textAlign: 'center', lineHeight: 16 },
  joinLabel: { fontSize: 11, fontWeight: '900', color: C.muted, letterSpacing: 2, marginBottom: 8 },
  joinWrap: { marginBottom: 24 },
  joinRow: { flexDirection: 'row', gap: 10 },
  joinInput: { flex: 1, backgroundColor: C.panel, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: C.text, fontSize: 18, fontWeight: '900', letterSpacing: 4, borderWidth: 1, borderColor: C.border },
  joinBtn: { backgroundColor: C.purple, borderRadius: 12, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  joinBtnText: { fontSize: 13, fontWeight: '900', color: C.text },
  errorText: { color: C.hard, fontSize: 12, marginTop: 8 },
  codeBox: { backgroundColor: C.panel, borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: C.purple },
  codeLabel: { fontSize: 10, fontWeight: '900', color: C.muted, letterSpacing: 2, marginBottom: 6 },
  codeValue: { fontSize: 36, fontWeight: '900', color: C.purple, letterSpacing: 8, marginBottom: 4 },
  codeHint: { fontSize: 11, color: C.muted },
  sectionLabel: { fontSize: 11, fontWeight: '900', color: C.muted, letterSpacing: 2, marginBottom: 10 },
  playerList: { flex: 1, marginBottom: 16 },
  playerRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.panel, borderRadius: 12, padding: 12, marginBottom: 8, gap: 12, borderWidth: 1, borderColor: C.border },
  playerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.indigo + '33', alignItems: 'center', justifyContent: 'center' },
  playerInitial: { fontSize: 16, fontWeight: '900', color: C.indigo },
  playerName: { flex: 1, fontSize: 14, fontWeight: '700', color: C.text },
  hostBadge: { fontSize: 9, fontWeight: '900', color: C.yellow, backgroundColor: C.yellow + '22', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, letterSpacing: 1 },
  startBtn: { backgroundColor: C.purple, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 16 },
  startBtnDisabled: { opacity: 0.4 },
  startBtnText: { fontSize: 15, fontWeight: '900', color: C.text, letterSpacing: 2 },
  waitingWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingBottom: 16 },
  waitingText: { fontSize: 13, color: C.muted },
});

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../config/supabase';
import { authService } from '../services/authService';
import { gamificationService } from '../services/gamificationservice';
import { useTheme } from '../context/ThemeContext';
import {
  Page, Heading, Body, Card, Badge, Segmented, Avatar, initials, Skeleton, font, useLayout,
} from '../components/ui/kit';

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

// Rank 1 is the only "top of the board". A tie with the person above used to
// report a gap of 0 and the same sentence for 9th place.
export function positionNote(rank, gap) {
  if (rank === 1) return 'You are at the top of this board.';
  const place = ordinal(Math.max(1, rank - 1));
  if (gap > 0) return `${Number(gap).toLocaleString()} points to reach ${place} place.`;
  return `Tied with ${place} place.`;
}

export default function LeaderboardScreen({ navigation }) {
  const { theme } = useTheme();
  const { laptop } = useLayout();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scope, setScope] = useState('class');
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [rows, setRows] = useState([]);
  const [myId, setMyId] = useState(null);
  const [role, setRole] = useState(null);

  useFocusEffect(useCallback(() => { init(); }, []));

  useEffect(() => {
    if (loading) return;
    loadLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, selectedClassId, loading]);

  const init = async () => {
    try {
      const user = await authService.getCurrentUser();
      setMyId(user?.id || null);
      setRole(user?.profile?.role || null);
      const { data } = await supabase.from('class_students').select('class_id, classes(name)').eq('student_id', user.id);
      const myClasses = (data || []).filter((c) => c.classes).map((c) => ({ id: c.class_id, name: c.classes.name }));
      setClasses(myClasses);
      setSelectedClassId(myClasses[0]?.id || null);
      setScope(myClasses.length > 0 ? 'class' : 'global');
    } catch {
      setScope('global');
    } finally {
      setLoading(false);
    }
  };

  const loadLeaderboard = async () => {
    const classId = scope === 'class' ? selectedClassId : null;
    if (scope === 'class' && !classId) { setRows([]); return; }
    const data = await gamificationService.getLeaderboard(classId);
    setRows(data);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLeaderboard();
    setRefreshing(false);
  };

  const myIndex = rows.findIndex((row) => row.id === myId);
  const myRank = myIndex >= 0 ? myIndex + 1 : null;
  const ahead = myIndex > 0 ? rows[myIndex - 1] : null;
  const gap = ahead && myIndex >= 0 ? Math.max((ahead.xp || 0) - (rows[myIndex].xp || 0), 0) : 0;
  const className = classes.find((c) => c.id === selectedClassId)?.name;
  const top = rows.slice(0, 3);
  const rest = rows.slice(3);
  const podiumOrder = [top[1], top[0], top[2]].filter(Boolean);

  const podium = top.length > 0 && (
    <Card style={{ paddingTop: 24, paddingHorizontal: 12, marginBottom: 24, overflow: 'hidden', backgroundColor: '#F4F8FF' }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 12 }}>
        {podiumOrder.map((row) => {
          const rank = rows.indexOf(row) + 1;
          const first = rank === 1;
          const height = rank === 1 ? 128 : rank === 2 ? 88 : 64;
          return (
            <View key={row.id} style={{ flex: 1, maxWidth: 160, alignItems: 'center' }}>
              <Avatar label={initials(row.full_name)} size={first ? 64 : 52} tone={rank === 2 ? 'teal' : rank === 3 ? 'neutral' : 'blue'} />
              <Text style={[{ marginTop: 8, fontSize: 14, color: theme.text }, font(theme, 'semibold')]} numberOfLines={1}>{(row.full_name || 'Learner').split(' ')[0]}</Text>
              {first ? <Badge label={`${(row.xp || 0).toLocaleString()} pts`} kind="yellowStrong" /> : <Text style={[{ fontSize: 12, color: theme.textSecondary }, font(theme, 'body')]}>{(row.xp || 0).toLocaleString()}</Text>}
              <View style={{ marginTop: 12, width: '100%', height, borderTopLeftRadius: 16, borderTopRightRadius: 16, backgroundColor: first ? theme.primary : '#E6EEF6', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={[{ fontSize: 24, color: first ? '#fff' : theme.textSecondary }, font(theme, 'display')]}>{rank}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </Card>
  );

  const position = myRank && (
    <Card style={{ padding: 20, marginBottom: 24 }}>
      <Text style={[{ fontSize: 14, color: theme.textSecondary }, font(theme, 'semibold')]}>Your position</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginVertical: 8 }}>
        <Text style={[{ fontSize: 32, lineHeight: 40, color: theme.text }, font(theme, 'display')]}>{ordinal(myRank)}</Text>
        <Body variant="small">of {rows.length} learners</Body>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: '#E6EDF4', overflow: 'hidden' }}>
        <View style={{ width: `${Math.max(8, Math.round(((rows.length - myRank + 1) / rows.length) * 100))}%`, height: '100%', backgroundColor: theme.primary }} />
      </View>
      <Body variant="small" style={{ marginTop: 12 }}>
        {positionNote(myRank, gap)}
      </Body>
    </Card>
  );

  const list = (
    <Card>
      {(top.length ? rest : rows).map((row, index) => {
        const rank = top.length ? index + 4 : index + 1;
        const isMe = row.id === myId;
        return (
          <View key={row.id || rank} style={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, minHeight: 72, backgroundColor: isMe ? theme.tint : 'transparent', borderTopWidth: index === 0 ? 0 : 1, borderTopColor: theme.borderLight }}>
            <Text style={[{ width: 28, textAlign: 'center', color: theme.textSecondary, fontSize: 16 }, font(theme, 'display')]}>{rank}</Text>
            <Avatar label={initials(row.full_name)} />
            <View style={{ flex: 1 }}>
              <Text style={[{ color: theme.text }, font(theme, 'h3')]} numberOfLines={1}>
                {row.full_name || 'Learner'}{isMe ? '  ' : ''}
              </Text>
              {isMe ? <Badge label="You" kind="info" /> : null}
            </View>
            <Text style={[{ fontSize: 16, color: isMe ? theme.primaryInk : theme.text }, font(theme, 'display')]}>{(row.xp || 0).toLocaleString()}</Text>
          </View>
        );
      })}
    </Card>
  );

  return (
    <Page refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}>
      <View style={{ marginTop: 8, marginBottom: 8 }}>
        <Heading level={1}>Leaderboard</Heading>
        <Body style={{ marginTop: 4 }}>{scope === 'class' && className ? className : 'Everyone'}{rows.length ? ` · ${rows.length} learners` : ''}</Body>
      </View>
      <View style={{ marginVertical: 16 }}>
        <Segmented
          value={scope}
          onChange={(next) => { if (next === 'class' && classes.length === 0) return; setScope(next); }}
          options={[
            { value: 'class', label: 'My class' },
            { value: 'global', label: 'Everyone' },
          ]}
        />
      </View>
      {!loading && classes.length === 0 && role !== 'lecturer' && (
        <Pressable onPress={() => navigation.navigate('JoinClass')} accessibilityRole="button" accessibilityLabel="Join a class" style={{ alignSelf: 'flex-start', maxWidth: 400, minHeight: 44, justifyContent: 'center', marginBottom: 8, paddingVertical: 8 }}>
          <Text style={[{ color: theme.primary, fontSize: 14 }, font(theme, 'semibold')]}>Join a class to see your class board</Text>
        </Pressable>
      )}
      {scope === 'class' && classes.length > 1 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {classes.map((c) => {
            const on = c.id === selectedClassId;
            return (
              <Pressable key={c.id} onPress={() => setSelectedClassId(c.id)} accessibilityRole="button" style={{ height: 44, paddingHorizontal: 16, borderRadius: 999, justifyContent: 'center', backgroundColor: on ? theme.tint : theme.surface, borderWidth: 1, borderColor: on ? theme.primary : theme.border }}>
                <Text style={[{ color: on ? theme.primary : theme.textSecondary, fontSize: 14 }, font(theme, 'semibold')]}>{c.name}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
      {loading ? (
        <Card style={{ padding: 20, gap: 12 }}><Skeleton height={120} /><Skeleton height={56} /><Skeleton height={56} /></Card>
      ) : rows.length === 0 ? (
        <Card style={{ padding: 32, alignItems: 'center' }}>
          <Heading level={3}>No rankings yet</Heading>
          <Body variant="small" style={{ marginTop: 8, textAlign: 'center' }}>Complete a quiz to appear on the leaderboard.</Body>
        </Card>
      ) : (
        <View style={laptop ? { flexDirection: 'row', gap: 40, alignItems: 'flex-start' } : undefined}>
          <View style={laptop ? { width: 380 } : undefined}>{podium}{position}</View>
          <View style={laptop ? { flex: 1 } : { marginTop: 8 }}>{list}</View>
        </View>
      )}
    </Page>
  );
}

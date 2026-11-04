import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, useWindowDimensions, Pressable, Image,
  Animated, PanResponder, StatusBar, Platform, ScrollView,
} from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PROGRESS_KEYS, progressService } from '../services/progressService';
import { supabase } from '../config/supabase';
import { saveRunnerScore } from '../utils/gameScore';
import { authService } from '../services/authService';
import { gameRunnerService } from '../services/gameRunnerService';
import { font } from '../components/ui/kit';
import { useTheme } from '../context/ThemeContext';
import { runnerArt } from '../assets/runner/art';
import { nextRunnerFact } from '../data/runnerFacts';
import { createRunnerAudio } from '../utils/runnerAudio';
import {
  MAX_LIVES,
  WORLD_STORAGE_KEY,
  answerQuiz,
  createRun,
  factById,
  factForRun,
  keyAction,
  normalizeWorld,
  landscapePlayfield,
  playerCenterFor,
  runnerDisplayName,
  runnerFrame,
  tick,
} from '../utils/runnerEngine';

const MUTE_KEY = 'compurunner_muted';
const SPRITE_W = 80;
const SPRITE_H = 110;
const INK = '#041018';
const FILL = '#0A66FF';
const PANEL = '#10203A';

const KIND_SIZE = {
  virus: { w: 58, h: 58, lift: 0 },
  short: { w: 64, h: 48, lift: 0 },
  cable: { w: 86, h: 40, lift: 0 },
  server: { w: 58, h: 110, lift: 0 },
  bug: { w: 52, h: 52, lift: 0 },
};
const DEFAULT_SIZE = { w: 48, h: 48, lift: 28 };
const pixelStyle = Platform.OS === 'web' ? { imageRendering: 'pixelated' } : null;

function buzz(kind) {
  try {
    if (kind === 'error') Haptics.notificationAsync?.(Haptics.NotificationFeedbackType?.Error);
    else Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle?.Light);
  } catch { /* haptics are optional on web */ }
}

function useCoarsePointer() {
  const [coarse, setCoarse] = useState(Platform.OS !== 'web');
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.matchMedia) return undefined;
    const query = window.matchMedia('(pointer: coarse)');
    const apply = () => setCoarse(query.matches);
    apply();
    query.addEventListener?.('change', apply);
    return () => query.removeEventListener?.('change', apply);
  }, []);
  return coarse;
}

function GameButton({ label, onPress, icon }) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.gameBtn, { opacity: pressed ? 0.88 : 1 }]}
    >
      {icon ? <Image source={icon} style={styles.gameBtnIcon} /> : null}
      <Text style={[styles.gameBtnText, font(theme, 'semibold')]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

function Outlined({ children, size, color = '#fff', align = 'center' }) {
  const { theme } = useTheme();
  const text = [styles.outlined, { fontSize: size, color, textAlign: align }, font(theme, 'display')];
  return (
    <View>
      <Text style={[text, styles.outlinedInk]}>{children}</Text>
      <Text style={text}>{children}</Text>
    </View>
  );
}

function tiledImages(source, nativeW, nativeH, scale, top, width, distance, factor) {
  const tileW = nativeW * scale;
  const tileH = nativeH * scale;
  const shift = -(((distance * factor) % tileW) + tileW) % tileW;
  const cols = Math.ceil(width / tileW) + 2;
  const tiles = [];
  for (let col = 0; col < cols; col += 1) {
    tiles.push(
      <Image
        key={col}
        source={source}
        resizeMode="stretch"
        style={[{ position: 'absolute', left: shift + col * tileW, top, width: tileW, height: tileH }, pixelStyle]}
      />
    );
  }
  return tiles;
}

function Sky({ distance, width, height, groundY, world }) {
  const night = world === 'dark';
  const sky = night ? runnerArt.world.nightSky : runnerArt.world.sky;
  const buildings = night ? runnerArt.world.nightBuildings : runnerArt.world.buildings;
  const skyScale = Math.max(2, Math.ceil(height / 224));
  const buildingScale = groundY >= 129 * 3 ? 3 : 2;
  const buildingH = 129 * buildingScale;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {tiledImages(sky, 112, 224, skyScale, 0, width, distance, 0.12)}
      {tiledImages(buildings, 192, 129, buildingScale, groundY - buildingH, width, distance, 0.42)}
    </View>
  );
}

function Ground({ distance, width, groundY, height }) {
  const plate = 70;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={{ position: 'absolute', left: 0, right: 0, top: groundY + plate, bottom: 0, backgroundColor: '#2A2E33' }} />
      {tiledImages(runnerArt.plate, plate, plate, 1, groundY, width, distance, 1)}
    </View>
  );
}

function entityNode(entity, groundY) {
  const spec = { ...(KIND_SIZE[entity.kind] || DEFAULT_SIZE) };
  if (entity.kind === 'bug' && entity.air) spec.lift = 86;
  const source = runnerArt.icons[entity.kind];
  if (!source) return null;
  return (
    <Image
      key={entity.id}
      source={source}
      resizeMode="contain"
      style={[{
        position: 'absolute',
        left: entity.x,
        top: groundY - spec.h - spec.lift,
        width: spec.w,
        height: spec.h,
      }, pixelStyle]}
    />
  );
}

const POSES = ['run1', 'run2', 'jump', 'duck', 'hurt', 'idle'];

function publicRun(state) {
  if (!state) return state;
  const { quiz, quizBank, ...rest } = state;
  return rest;
}

function formatMultiplier(value) {
  const n = Number(value) || 1;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function RunnerSprite({ pose, center, groundY, lift }) {
  return (
    <View style={{ position: 'absolute', left: center - SPRITE_W / 2, top: groundY - SPRITE_H - lift, width: SPRITE_W, height: SPRITE_H }}>
      {POSES.map((name) => (
        <Image
          key={name}
          source={runnerArt.player[name]}
          resizeMode="contain"
          style={[styles.playerSprite, pixelStyle, { opacity: pose === name ? 1 : 0 }]}
        />
      ))}
    </View>
  );
}

export default function GameScreen({ navigation, route }) {
  const isMulti = route?.params?.multiplayer === true;
  const roomId = route?.params?.roomId || null;
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const coarse = useCoarsePointer();
  const { width, height } = useWindowDimensions();
  const field = landscapePlayfield(width, height, insets.top);
  const groundY = field.groundY;

  const [phase, setPhase] = useState('start');
  const [paused, setPaused] = useState(false);
  const [worldTheme, setWorldTheme] = useState(normalizeWorld(route?.params?.world));
  const [pauseFact, setPauseFact] = useState(null);
  const factIdRef = useRef(null);
  const [count, setCount] = useState(0);
  const [muted, setMuted] = useState(false);
  const [run, setRun] = useState(() => createRun(800));
  const [menuDistance, setMenuDistance] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);
  const [summary, setSummary] = useState(null);
  const [shownScore, setShownScore] = useState(0);
  const [overStep, setOverStep] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [finishRank, setFinishRank] = useState(null);
  const [otherPlayers, setOtherPlayers] = useState([]);
  const [floater, setFloater] = useState(null);
  const [toast, setToast] = useState(null);
  const [quizPrompt, setQuizPrompt] = useState(null);
  const [myName, setMyName] = useState('');
  const [bits, setBits] = useState([]);

  const world = useRef(createRun(field.width || 800));
  const inputRef = useRef({ jump: false, duck: false });
  const audioRef = useRef(null);
  if (!audioRef.current) audioRef.current = createRunnerAudio();
  const phaseRef = useRef(phase);
  const widthRef = useRef(field.width);
  const highRef = useRef(0);
  const overRef = useRef(false);
  const myIdRef = useRef(null);
  const roomChannelRef = useRef(null);
  const lastPushRef = useRef(0);
  const multiRef = useRef(isMulti);
  const roomRef = useRef(roomId);
  const onEventsRef = useRef(() => {});
  const beginRef = useRef(() => {});
  const togglePauseRef = useRef(() => {});
  const toggleMuteRef = useRef(() => {});
  const resumeRef = useRef(false);
  const requestResumeRef = useRef(() => {});
  const answerRef = useRef(() => {});
  const answeringRef = useRef(false);
  const overStepRef = useRef(0);
  const pulse = useRef(new Animated.Value(1)).current;
  phaseRef.current = phase;
  widthRef.current = field.width;
  multiRef.current = isMulti;
  roomRef.current = roomId;
  overStepRef.current = overStep;

  useFocusEffect(useCallback(() => {
    if (Platform.OS === 'web') return undefined;
    let active = true;
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE)
      .then(() => {
        if (!active) return ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        return undefined;
      })
      .catch(() => {});
    return () => {
      active = false;
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []));

  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(WORLD_STORAGE_KEY).then((value) => {
      if (live && value) setWorldTheme(normalizeWorld(value));
    }).catch(() => {});
    return () => { live = false; };
  }, []);

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.4, duration: 680, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 680, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  useEffect(() => {
    if (phase !== 'start') return undefined;
    let raf = 0;
    let last = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const frame = (time) => {
      setMenuDistance((value) => value + Math.min(40, time - last) * 0.12);
      last = time;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  useEffect(() => {
    progressService.get(PROGRESS_KEYS.compuRunner).then(async (saved) => {
      const legacy = await AsyncStorage.getItem('compurunner_highscore');
      const legacyScore = legacy ? parseInt(legacy, 10) : 0;
      const best = Math.max(Number(saved?.highScore) || 0, Number.isNaN(legacyScore) ? 0 : legacyScore);
      if (best) {
        highRef.current = best;
        setHighScore(best);
      }
    });
    AsyncStorage.getItem(MUTE_KEY).then((value) => {
      if (value === '1') {
        audioRef.current.setMuted(true);
        setMuted(true);
      }
    });
    authService.getCurrentUser().then((user) => {
      myIdRef.current = user?.id || null;
      setMyName(user?.profile?.full_name || user?.user_metadata?.full_name || '');
    }).catch(() => {});
    gameRunnerService.getLeaderboard().then(setLeaderboard).catch(() => setLeaderboard([]));
  }, []);

  useEffect(() => {
    if (!isMulti || !roomId) return undefined;
    let cancelled = false;
    const refreshOthers = async () => {
      const players = await gameRunnerService.getRoomPlayers(roomId);
      if (cancelled) return;
      setOtherPlayers(players.filter((player) => player.user_id !== myIdRef.current));
    };
    refreshOthers();
    roomChannelRef.current = gameRunnerService.subscribeToRoom(roomId, refreshOthers, () => {});
    return () => {
      cancelled = true;
      if (roomChannelRef.current) {
        gameRunnerService.unsubscribe(roomChannelRef.current);
        roomChannelRef.current = null;
      }
    };
  }, [isMulti, roomId]);

  const saveScore = useCallback(async (finalScore, chipIds) => {
    try {
      const stored = await AsyncStorage.getItem('compurunner_highscore');
      const prev = stored ? parseInt(stored, 10) : 0;
      const saved = await progressService.get(PROGRESS_KEYS.compuRunner);
      const unlocked = new Set(Array.isArray(saved?.unlockedIds) ? saved.unlockedIds : []);
      (chipIds || []).forEach((id) => { if (id) unlocked.add(id); });
      const best = Math.max(prev, Number(saved?.highScore) || 0, finalScore);
      if (best > prev) {
        await AsyncStorage.setItem('compurunner_highscore', String(best));
        highRef.current = best;
        setHighScore(best);
        const user = await authService.getCurrentUser();
        if (user) {
          const written = await saveRunnerScore(supabase, user.id, best);
          if (!written.saved) console.error('Runner score was not saved');
        }
        const board = await gameRunnerService.getLeaderboard();
        setLeaderboard(board);
      }
      await progressService.set(PROGRESS_KEYS.compuRunner, { highScore: best, unlockedIds: [...unlocked] });
    } catch { /* keep the score on this device if the account write fails */ }
  }, []);

  const finish = useCallback(async (finishedRun, miss = null) => {
    if (overRef.current) return;
    overRef.current = true;
    const fact = factForRun(finishedRun.chips, Math.random);
    setSummary({
      score: finishedRun.score,
      fact,
      chips: finishedRun.chips.slice(),
      bestStreak: finishedRun.bestStreak,
      coins: finishedRun.coinCount || 0,
      miss: miss || null,
    });
    setShownScore(0);
    setOverStep(0);
    setIsNewBest(finishedRun.score > highRef.current && finishedRun.score > 0);
    if (finishedRun.score > highRef.current) {
      highRef.current = finishedRun.score;
      setHighScore(finishedRun.score);
    }
    setPhase('gameover');
    audioRef.current.play('over');
    saveScore(finishedRun.score, finishedRun.chips);
    if (isMulti && roomId && myIdRef.current) {
      try {
        const rank = await gameRunnerService.getFinishRank(roomId);
        setFinishRank(rank);
        await gameRunnerService.pushPlayerState(roomId, myIdRef.current, {
          lane: 1, score: finishedRun.score, lives: finishedRun.lives, finished: true, finishRank: rank,
        });
      } catch { /* rank is optional if the room read fails */ }
    }
  }, [isMulti, roomId, saveScore]);

  useEffect(() => {
    if (phase !== 'gameover' || !summary) return undefined;
    if (shownScore >= summary.score) {
      const timer = setTimeout(() => setOverStep(1), 280);
      return () => clearTimeout(timer);
    }
    const step = Math.max(1, Math.round(summary.score / 24));
    const timer = setTimeout(() => setShownScore((value) => Math.min(summary.score, value + step)), 32);
    return () => clearTimeout(timer);
  }, [phase, summary, shownScore]);

  useEffect(() => {
    if (phase !== 'gameover' || overStep !== 1) return undefined;
    if (isNewBest) {
      setBits(Array.from({ length: 18 }, (_, index) => ({
        id: index,
        left: 12 + ((index * 37) % 76),
        delay: (index % 6) * 40,
        color: ['#FFC83D', '#0A66FF', '#3BB8C4', '#FF3B5C'][index % 4],
      })));
    }
    const timer = setTimeout(() => setOverStep(2), isNewBest ? 700 : 200);
    return () => clearTimeout(timer);
  }, [phase, overStep, isNewBest]);

  useEffect(() => {
    if (phase !== 'gameover' || overStep !== 2) return undefined;
    const timer = setTimeout(() => setOverStep(3), 360);
    return () => clearTimeout(timer);
  }, [phase, overStep]);

  onEventsRef.current = (events) => {
    let miss = null;
    events.forEach((event) => {
      if (event.type === 'jump') {
        audioRef.current.play('jump');
        buzz('jump');
      } else if (event.type === 'duck') {
        audioRef.current.play('duck');
      } else if (event.type === 'hit') {
        audioRef.current.play('hit');
        buzz('error');
      } else if (event.type === 'collect') {
        audioRef.current.play(event.line ? 'chip' : 'coin');
        const label = event.multiplier > 1 ? `+${event.points}  x${event.multiplier}` : `+${event.points}`;
        setFloater({ id: `${event.kind}-${world.current.elapsed}`, text: label, scale: 1 + Math.min(1.2, (event.streak || 1) * 0.12) });
        if (event.line) {
          setToast({ id: world.current.elapsed, title: event.title, line: event.line });
        }
      } else if (event.type === 'power') {
        audioRef.current.play('chip');
        setFloater({ id: `power-${world.current.elapsed}`, text: event.label, scale: 1.1 });
      } else if (event.type === 'block') {
        audioRef.current.play('hit');
        setFloater({ id: `block-${world.current.elapsed}`, text: 'Blocked', scale: 1.05 });
      } else if (event.type === 'revive') {
        audioRef.current.play('chip');
        setToast({ id: world.current.elapsed, title: 'Checkpoint', line: 'The floppy disk brought you back.', plain: true });
      } else if (event.type === 'quiz') {
        setQuizPrompt({
          id: event.id,
          question: event.question,
          options: (event.options || []).slice(),
          part: event.part || null,
          eliminated: event.eliminated,
        });
        setPaused(true);
      } else if (event.type === 'quiz-result') {
        if (event.correct) {
          audioRef.current.play('coin');
          const label = event.multiplier > 1 ? `+${event.points}  x${event.multiplier}` : `+${event.points}`;
          setFloater({ id: `quiz-${world.current.elapsed}`, text: label, scale: 1.15 });
          setToast({ id: world.current.elapsed, title: 'Correct', line: event.explanation, plain: true });
        } else {
          audioRef.current.play('hit');
          buzz('error');
          setFloater(null);
          const answer = event.correctAnswer ? `Answer: ${event.correctAnswer}. ` : '';
          setToast({
            id: world.current.elapsed,
            title: 'Wrong',
            line: `${answer}${event.explanation || ''}`.trim(),
            plain: true,
          });
          miss = { correctAnswer: event.correctAnswer, explanation: event.explanation };
        }
      } else if (event.type === 'dead') {
        finish(world.current, miss);
      }
    });
  };

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 1700);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (phase !== 'playing' || paused) return undefined;
    let raf = 0;
    let last = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const loop = (time) => {
      if (world.current.paused || phaseRef.current !== 'playing') return;
      const dt = time - last;
      last = time;
      const input = inputRef.current;
      inputRef.current = { jump: false, duck: false };
      world.current.viewWidth = widthRef.current || world.current.viewWidth;
      const result = tick(world.current, dt, input, Math.random);
      world.current = result.state;
      if (result.state.phase === 'playing') setRun(publicRun(result.state));
      onEventsRef.current(result.events);
      if (multiRef.current && roomRef.current && myIdRef.current && world.current.phase === 'playing') {
        const nowMs = Date.now();
        if (nowMs - lastPushRef.current > 250) {
          lastPushRef.current = nowMs;
          gameRunnerService.pushPlayerState(roomRef.current, myIdRef.current, {
            lane: 1,
            score: world.current.score,
            lives: world.current.lives,
            finished: false,
          });
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, paused]);

  useEffect(() => {
    if (!resumeRef.current || phase !== 'playing') return undefined;
    if (count <= 0) {
      resumeRef.current = false;
      world.current.paused = false;
      setPaused(false);
      return undefined;
    }
    const timer = setTimeout(() => setCount((value) => value - 1), 650);
    return () => clearTimeout(timer);
  }, [count, phase]);

  const begin = useCallback(() => {
    overRef.current = false;
    resumeRef.current = false;
    answeringRef.current = false;
    const next = createRun(widthRef.current || 800);
    world.current = next;
    setRun(next);
    inputRef.current = { jump: false, duck: false };
    setSummary(null);
    setFinishRank(null);
    setFloater(null);
    setToast(null);
    setQuizPrompt(null);
    setPauseFact(null);
    setBits([]);
    setShownScore(0);
    setOverStep(0);
    setCount(0);
    setPaused(false);
    setPhase('playing');
    audioRef.current.play('click');
  }, []);
  beginRef.current = begin;

  const togglePause = useCallback(() => {
    if (phaseRef.current !== 'playing' || resumeRef.current || world.current.quiz) return;
    setPaused((value) => {
      const next = !value;
      world.current.paused = next;
      if (next) {
        setCount(0);
        const fact = nextRunnerFact(factIdRef.current, Math.random);
        factIdRef.current = fact.id;
        setPauseFact(fact);
      }
      return next;
    });
  }, []);
  togglePauseRef.current = togglePause;

  const requestResume = () => {
    if (!paused || world.current.quiz) return;
    resumeRef.current = true;
    setCount(3);
    audioRef.current.play('click');
  };
  requestResumeRef.current = requestResume;

  const submitAnswer = useCallback((choice) => {
    if (answeringRef.current || !world.current.quiz) return;
    answeringRef.current = true;
    const result = answerQuiz(world.current, choice);
    world.current = result.state;
    setQuizPrompt(null);
    setRun(publicRun(result.state));
    if (result.state.phase === 'playing') setPaused(false);
    onEventsRef.current(result.events);
    answeringRef.current = false;
  }, []);
  answerRef.current = submitAnswer;

  const toggleMute = useCallback(() => {
    const next = audioRef.current.toggleMuted();
    setMuted(next);
    AsyncStorage.setItem(MUTE_KEY, next ? '1' : '0').catch(() => {});
    if (!next) audioRef.current.play('click');
  }, []);
  toggleMuteRef.current = toggleMute;

  const exitToLobby = () => {
    world.current.paused = true;
    audioRef.current.stopAll();
    if (roomChannelRef.current) {
      gameRunnerService.unsubscribe(roomChannelRef.current);
      roomChannelRef.current = null;
    }
    navigation.navigate('GameRunnerLobby');
  };

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const onKey = (event) => {
      if (phaseRef.current === 'playing' && world.current.quiz) {
        const options = world.current.quiz.options || [];
        if (/^[1-9]$/.test(event.key)) {
          const index = Number(event.key) - 1;
          if (index < options.length && index !== world.current.quiz.eliminated) {
            event.preventDefault();
            answerRef.current(index);
          }
          return;
        }
        if (keyAction(event.key) === 'mute') {
          event.preventDefault();
          toggleMuteRef.current();
        }
        event.preventDefault();
        return;
      }
      const action = keyAction(event.key);
      if (!action) return;
      const current = phaseRef.current;
      if (current === 'start' && (action === 'jump' || action === 'confirm')) {
        event.preventDefault();
        beginRef.current();
        return;
      }
      if (current === 'gameover' && overStepRef.current >= 3 && (action === 'confirm' || event.key === 'r' || event.key === 'R')) {
        event.preventDefault();
        beginRef.current();
        return;
      }
      if (current !== 'playing') return;
      if (action === 'pause') {
        event.preventDefault();
        if (resumeRef.current) return;
        if (world.current.paused) requestResumeRef.current();
        else togglePauseRef.current();
        return;
      }
      if (action === 'mute') {
        event.preventDefault();
        toggleMuteRef.current();
        return;
      }
      if (world.current.paused || event.repeat) return;
      event.preventDefault();
      if (action === 'jump') inputRef.current.jump = true;
      if (action === 'duck') inputRef.current.duck = true;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gesture) => (
      phaseRef.current === 'playing' && Math.abs(gesture.dy) > 14
    ),
    onPanResponderRelease: (_, gesture) => {
      if (phaseRef.current !== 'playing' || world.current.paused) return;
      if (gesture.dy < -24) inputRef.current.jump = true;
      else if (gesture.dy > 24) inputRef.current.duck = true;
    },
  })).current;

  const distance = phase === 'playing' || phase === 'gameover' ? run.distance : menuDistance;
  const pose = phase === 'start' ? 'idle' : runnerFrame(run.pose, run.elapsed);
  const lift = phase === 'playing' && run.pose === 'jump' ? run.jumpH : 0;
  const center = playerCenterFor(field.width);
  const frameTop = Math.max(0, (height - field.height) / 2);
  const frameStyle = {
    width: field.width,
    height: field.height,
    marginTop: frameTop,
  };

  const worldView = (
    <View style={[styles.frame, frameStyle]} {...(phase === 'playing' ? panResponder.panHandlers : {})}>
      <Sky distance={distance} width={field.width} height={field.height} groundY={groundY} world={worldTheme} />
      <Ground distance={distance} width={field.width} groundY={groundY} />
      {phase !== 'start' ? run.entities.map((entity) => entityNode(entity, groundY)) : null}
      {phase !== 'start' && isMulti ? otherPlayers.map((player, index) => (
        <View key={player.user_id} style={[styles.ghost, { left: center - 120 - index * 18, top: groundY - 96 }]}>
          <Text style={styles.ghostName}>{(player.full_name || 'Player').split(' ')[0]}</Text>
          <Image source={runnerFrame('run', run.elapsed) === 'run1' ? runnerArt.ghost.run1 : runnerArt.ghost.run2} style={styles.ghostSprite} resizeMode="contain" />
        </View>
      )) : null}
      <RunnerSprite pose={pose} center={center} groundY={groundY} lift={lift} />
      {floater && phase === 'playing' ? (
        <Text style={[styles.floater, { left: center, top: groundY - SPRITE_H - lift - 36, transform: [{ scale: floater.scale || 1 }] }]}>
          {floater.text}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      <StatusBar hidden />
      <Pressable
        style={[styles.exit, { top: Math.max(12, insets.top + 8) }]}
        onPress={exitToLobby}
        accessibilityRole="button"
        accessibilityLabel="Exit to lobby"
      >
        <Text style={styles.exitMark}>X</Text>
      </Pressable>
      {worldView}

      {phase === 'start' ? (
        <Pressable style={styles.menuScrim} onPress={begin} accessibilityRole="button" accessibilityLabel="Start run">
          <Outlined size={42}>COMPURUNNER</Outlined>
          <View style={styles.tipRow}>
            <Image source={runnerArt.ui.up} style={styles.tipIcon} />
            <Text style={[styles.tipText, font(theme, 'semibold')]}>Space or swipe up to jump</Text>
          </View>
          <View style={styles.tipRow}>
            <Image source={runnerArt.ui.down} style={styles.tipIcon} />
            <Text style={[styles.tipText, font(theme, 'semibold')]}>Down or swipe down to duck</Text>
          </View>
          <Text style={[styles.tipText, font(theme, 'semibold')]}>
            Grab a computer part to answer a question. A right answer scores. A wrong one costs a life.
          </Text>
          {highScore > 0 ? <Text style={[styles.bestLine, font(theme, 'semibold')]}>Best {highScore}</Text> : null}
          <Animated.Text style={[styles.pressHint, { opacity: pulse }, font(theme, 'display')]}>
            {coarse ? 'TAP TO RUN' : 'PRESS SPACE'}
          </Animated.Text>
        </Pressable>
      ) : null}

      {phase === 'playing' ? (
        <View style={[styles.hud, { top: frameTop + 16 }]} pointerEvents="box-none">
          <View pointerEvents="none">
            <Outlined size={40} align="left">{run.score}</Outlined>
            <Text style={[styles.hudSub, font(theme, 'semibold')]}>Best {Math.max(highScore, run.score)}</Text>
            <Text style={[styles.hudSub, font(theme, 'semibold')]}>Parts {run.coinCount || 0}</Text>
            <View style={styles.cells}>
              {Array.from({ length: MAX_LIVES }, (_, index) => (
                <View key={index} style={[styles.cell, index < run.lives ? styles.cellOn : styles.cellOff]} />
              ))}
            </View>
            <Text style={[styles.combo, font(theme, 'display')]}>
              {`x${formatMultiplier(run.quizMultiplier)}`}
            </Text>
          </View>
          <View style={styles.hudRight}>
            {quizPrompt ? null : (
              <Pressable onPress={togglePause} style={styles.hudBtn} accessibilityRole="button" accessibilityLabel="Pause">
                <Image source={runnerArt.ui.pause} style={styles.hudGlyph} />
              </Pressable>
            )}
            <Pressable onPress={toggleMute} style={styles.hudBtn} accessibilityRole="button" accessibilityLabel={muted ? 'Unmute' : 'Mute'}>
              <Image source={muted ? runnerArt.ui.audioOff : runnerArt.ui.audioOn} style={styles.hudGlyph} />
            </Pressable>
          </View>
        </View>
      ) : null}

      {toast && phase === 'playing' ? (
        <View style={[styles.toast, { top: frameTop + 108 }]} pointerEvents="none">
          {toast.plain ? null : <Image source={runnerArt.icons.cpu} style={styles.tipIcon} />}
          <View style={{ flex: 1 }}>
            <Text style={[styles.toastTitle, font(theme, 'semibold')]}>{toast.title}</Text>
            <Text style={styles.toastLine}>{toast.line}</Text>
          </View>
        </View>
      ) : null}

      {coarse && phase === 'playing' && !paused ? (
        <View style={[styles.touchRow, { bottom: frameTop + 20 }]} pointerEvents="box-none">
          <Pressable
            onPress={() => { inputRef.current.duck = true; }}
            style={styles.touchCircle}
            accessibilityRole="button"
            accessibilityLabel="Duck"
          >
            <Image source={runnerArt.ui.down} style={styles.touchIcon} />
          </Pressable>
          <Pressable
            onPress={() => { inputRef.current.jump = true; }}
            style={styles.touchCircle}
            accessibilityRole="button"
            accessibilityLabel="Jump"
          >
            <Image source={runnerArt.ui.up} style={styles.touchIcon} />
          </Pressable>
        </View>
      ) : null}

      {quizPrompt && phase === 'playing' ? (
        <View style={styles.quizScrim}>
          <ScrollView style={styles.quizScroll} contentContainerStyle={styles.quizCard}>
            {quizPrompt.part && runnerArt.icons[quizPrompt.part] ? (
              <Image source={runnerArt.icons[quizPrompt.part]} style={styles.quizPart} accessibilityElementsHidden />
            ) : null}
            <Text style={[styles.quizKicker, font(theme, 'semibold')]}>COMPUCLASS</Text>
            <Text style={[styles.quizQuestion, font(theme, 'semibold')]}>{quizPrompt.question}</Text>
            {quizPrompt.options.map((option, index) => {
              const gone = index === quizPrompt.eliminated;
              return (
                <Pressable
                  key={`${quizPrompt.id}-${index}`}
                  onPress={gone ? undefined : () => submitAnswer(index)}
                  disabled={gone}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: gone }}
                  accessibilityLabel={`Answer ${index + 1}: ${option}`}
                  style={({ pressed }) => [styles.quizBtn, { opacity: gone ? 0.35 : (pressed ? 0.88 : 1) }]}
                >
                  <Text style={[styles.quizBtnText, font(theme, 'semibold')]}>{`${index + 1}. ${option}`}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {paused && !quizPrompt && phase === 'playing' ? (
        <View style={styles.menuScrim}>
          {count > 0 ? <Outlined size={96}>{count}</Outlined> : (
            <View style={styles.panel}>
              <Outlined size={32}>Paused</Outlined>
              {pauseFact ? (
                <View style={styles.factCard}>
                  <Text style={[styles.factKicker, font(theme, 'semibold')]}>{pauseFact.label || 'COMPUCLASS'}</Text>
                  <Text style={[styles.factTitle, font(theme, 'h2')]}>{pauseFact.title}</Text>
                  <Text style={styles.factBody}>{pauseFact.body}</Text>
                </View>
              ) : null}
              <GameButton label="Resume" onPress={requestResume} icon={runnerArt.ui.play} />
              <GameButton label="Sound" onPress={toggleMute} icon={muted ? runnerArt.ui.audioOff : runnerArt.ui.audioOn} />
              <GameButton label="Quit to lobby" onPress={exitToLobby} icon={runnerArt.ui.home} />
            </View>
          )}
        </View>
      ) : null}

      {phase === 'gameover' && summary ? (
        <ScrollView style={styles.overLayer} contentContainerStyle={styles.overScroll}>
          <View style={styles.overCard}>
          <Outlined size={18}>RUN OVER</Outlined>
          {finishRank != null ? (
            <Text style={[styles.bestLine, font(theme, 'semibold')]}>
              {['1st', '2nd', '3rd'][finishRank - 1] || `#${finishRank}`} place
            </Text>
          ) : null}
          <Outlined size={72}>{shownScore}</Outlined>
          <Text style={[styles.hudSub, font(theme, 'semibold')]}>SCORE</Text>
          {overStep >= 1 ? (
            <Text style={[styles.bestLine, font(theme, 'semibold')]}>
              {isNewBest ? `New best  ${summary.score}` : `Best ${Math.max(highScore, summary.score)}`}
            </Text>
          ) : null}
          {overStep >= 1 && summary.bestStreak > 1 ? (
            <Text style={[styles.bestLine, font(theme, 'semibold')]}>Best combo x{summary.bestStreak}</Text>
          ) : null}
          {overStep >= 1 && isNewBest ? bits.map((bit) => (
            <View key={bit.id} style={[styles.bit, { left: `${bit.left}%`, backgroundColor: bit.color, top: 80 + bit.delay }]} />
          )) : null}
          {overStep >= 2 && summary.miss ? (
            <View style={styles.factCard}>
              <Text style={[styles.factKicker, font(theme, 'semibold')]}>LAST QUESTION</Text>
              <Text style={[styles.factTitle, font(theme, 'h2')]}>
                {summary.miss.correctAnswer ? `The answer was ${summary.miss.correctAnswer}.` : 'That answer was wrong.'}
              </Text>
              {summary.miss.explanation ? <Text style={styles.factBody}>{summary.miss.explanation}</Text> : null}
            </View>
          ) : null}
          {overStep >= 2 ? (
            <View style={styles.factCard}>
              <Text style={[styles.factKicker, font(theme, 'semibold')]}>HARDWARE FACT</Text>
              <Text style={[styles.factTitle, font(theme, 'h2')]}>{summary.fact.title}</Text>
              <Text style={styles.factBody}>{summary.fact.body}</Text>
            </View>
          ) : null}
          {overStep >= 3 ? (
            <>
              <GameButton label="Play again" onPress={begin} icon={runnerArt.ui.play} />
              <Text style={[styles.restartHint, font(theme, 'semibold')]}>or press R</Text>
              <Pressable onPress={exitToLobby} accessibilityRole="button" accessibilityLabel="Back to lobby">
                <Text style={[styles.textLink, font(theme, 'semibold')]}>Back to lobby</Text>
              </Pressable>
              {leaderboard.length > 0 ? (
                <View style={styles.board}>
                  <Text style={[styles.factKicker, font(theme, 'semibold')]}>LEADERBOARD</Text>
                  {leaderboard.map((entry, index) => {
                    const raw = entry.profiles?.full_name || '';
                    const label = runnerDisplayName(raw, entry.score, index);
                    const mine = (myName && raw === myName) || (!myName && entry.score === summary.score && index === leaderboard.findIndex((row) => row.score === summary.score));
                    return (
                      <View key={`${label}-${index}`} style={[styles.boardRow, mine && styles.boardMine]}>
                        <Text style={[styles.boardRank, font(theme, 'semibold')]}>{index + 1}</Text>
                        <Text style={[styles.boardName, font(theme, 'body')]}>{label}</Text>
                        <Text style={[styles.boardScore, font(theme, 'semibold')]}>{entry.score}</Text>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </>
          ) : null}
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0B1026', alignItems: 'center' },
  frame: { backgroundColor: '#07101C', overflow: 'hidden' },
  span: { position: 'absolute', top: 0, bottom: 0 },
  playerSprite: { position: 'absolute', left: 0, top: 0, width: SPRITE_W, height: SPRITE_H },
  exit: {
    position: 'absolute', top: 16, left: 16, zIndex: 8,
    width: 48, height: 48, borderRadius: 12, backgroundColor: PANEL,
    alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: INK,
  },
  exitMark: { color: '#fff', fontSize: 22, fontWeight: '800' },
  hud: {
    position: 'absolute', left: 76, right: 16, zIndex: 5,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  hudRight: { flexDirection: 'row', gap: 8 },
  hudBtn: {
    width: 48, height: 48, borderRadius: 12, backgroundColor: PANEL,
    alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: INK,
  },
  hudGlyph: { width: 22, height: 22, tintColor: '#fff' },
  hudSub: { color: '#fff', fontSize: 14, marginTop: 2 },
  cells: { flexDirection: 'row', gap: 6, marginTop: 8 },
  cell: { width: 28, height: 14, borderRadius: 3, borderWidth: 2, borderColor: '#fff' },
  cellOn: { backgroundColor: '#39FFB0' },
  cellOff: { backgroundColor: 'transparent' },
  combo: { color: '#FFC83D', marginTop: 6, fontSize: 22 },
  quizScrim: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 6,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(7, 16, 28, 0.72)',
  },
  quizScroll: { width: '100%', maxWidth: 560, maxHeight: '86%' },
  quizCard: {
    width: '100%',
    backgroundColor: PANEL,
    borderRadius: 16,
    borderWidth: 4,
    borderColor: INK,
    padding: 20,
    gap: 10,
  },
  quizPart: { width: 64, height: 64, alignSelf: 'center' },
  quizKicker: { color: '#FFC83D', fontSize: 12, letterSpacing: 1, textAlign: 'center' },
  quizQuestion: { color: '#fff', fontSize: 20, lineHeight: 28, textAlign: 'center', marginBottom: 4 },
  quizBtn: {
    width: '100%',
    minWidth: 240,
    minHeight: 56,
    backgroundColor: FILL,
    borderRadius: 12,
    borderWidth: 4,
    borderColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  quizBtnText: { color: '#fff', fontSize: 16, lineHeight: 22, textAlign: 'center' },
  outlined: { fontWeight: '800', letterSpacing: 0.5 },
  outlinedInk: { position: 'absolute', left: 2, top: 2, color: INK },
  menuScrim: {
    ...StyleSheet.absoluteFillObject, zIndex: 4,
    alignItems: 'center', justifyContent: 'center', padding: 24,
    backgroundColor: 'rgba(7, 16, 28, 0.45)',
  },
  panel: { width: '100%', maxWidth: 420, gap: 12, alignItems: 'stretch' },
  gameBtn: {
    width: '100%', minWidth: 240, minHeight: 56, height: 56,
    backgroundColor: FILL, borderRadius: 12, borderWidth: 4, borderColor: INK,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 16,
  },
  gameBtnIcon: { width: 22, height: 22, tintColor: '#fff' },
  gameBtnText: { color: '#fff', fontSize: 18 },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  tipIcon: { width: 28, height: 28 },
  tipText: { color: '#fff', fontSize: 16 },
  pressHint: { color: '#fff', fontSize: 28, marginTop: 22, letterSpacing: 1 },
  bestLine: { color: '#FFC83D', fontSize: 16, marginTop: 8 },
  floater: { position: 'absolute', color: '#fff', fontSize: 22, fontWeight: '800' },
  toast: {
    position: 'absolute', left: 24, right: 24, zIndex: 5,
    backgroundColor: PANEL, borderRadius: 12, borderWidth: 3, borderColor: '#3BB8C4',
    flexDirection: 'row', gap: 10, padding: 10, alignItems: 'center',
  },
  toastTitle: { color: '#fff', fontSize: 14 },
  toastLine: { color: '#D5E4F2', fontSize: 12, marginTop: 2 },
  touchRow: {
    position: 'absolute', left: 24, right: 24, zIndex: 5,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  touchCircle: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 3, borderColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center', justifyContent: 'center',
  },
  touchIcon: { width: 32, height: 32, tintColor: '#fff' },
  ghost: { position: 'absolute', opacity: 0.45, alignItems: 'center' },
  ghostName: { color: '#fff', fontSize: 10, fontWeight: '800' },
  ghostSprite: { width: 58, height: 80 },
  overLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 7,
    backgroundColor: 'rgba(7, 16, 28, 0.82)',
  },
  overScroll: { alignItems: 'center', paddingTop: 72, paddingBottom: 48, paddingHorizontal: 24 },
  overCard: { width: '100%', maxWidth: 480, alignItems: 'center' },
  factCard: {
    width: '100%', backgroundColor: '#F7FBFD', borderRadius: 16, padding: 16, marginVertical: 14,
  },
  factKicker: { color: '#0A6F79', fontSize: 12, letterSpacing: 1, marginBottom: 6 },
  factTitle: { color: INK, fontSize: 22, marginBottom: 6 },
  factBody: { color: '#24344A', fontSize: 15, lineHeight: 22 },
  restartHint: { color: '#fff', marginTop: 8, marginBottom: 8 },
  textLink: { color: '#fff', fontSize: 16, textDecorationLine: 'underline', paddingVertical: 10 },
  board: { width: '100%', marginTop: 12, backgroundColor: 'rgba(16,32,58,0.9)', borderRadius: 12, padding: 12 },
  boardRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 },
  boardMine: { backgroundColor: 'rgba(10,102,255,0.35)', borderRadius: 8, paddingHorizontal: 6 },
  boardRank: { width: 22, color: '#fff' },
  boardName: { flex: 1, color: '#fff' },
  boardScore: { color: '#FFC83D' },
  bit: { position: 'absolute', width: 10, height: 14, borderRadius: 2 },
});

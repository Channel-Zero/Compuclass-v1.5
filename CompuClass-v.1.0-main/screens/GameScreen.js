import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, useWindowDimensions, TouchableOpacity,
  Animated, PanResponder, TextInput, StatusBar, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';
import { authService } from '../services/authService';
import { gameRunnerService } from '../services/gameRunnerService';

const BLUE = '#2563EB'; const YELLOW = '#FACC15'; const RED = '#EF4444';
const GREEN = '#22C55E'; const WHITE = '#FFFFFF'; const TEXT = '#111827';
const MUTED = '#6B7280'; const BG = '#F3F4F6';
const DARK_BLUE = '#1E3A8A'; const PURPLE = '#7C3AED';
const CYAN = '#22D3EE';

// Office scene tokens — kept separate from the UI palette above so the
// environment can be re-themed without touching HUD/card colors.
const SKY_TOP = '#C7DCFB'; const SKY_MID = '#DCE9FC'; const SKY_LOW = '#EEF4FD';
const WALL_UPPER = '#EEF2F8'; const WALL_LOWER = '#E1E8F2';
const TRIM = '#B9C6DA';
const FLOOR_A = '#DCE4EF'; const FLOOR_B = '#CBD6E6'; const FLOOR_SHADE = '#AEBBD1';
const RACK_BODY = '#334155'; const RACK_TRIM = '#1E293B';
const GLASS = 'rgba(15,23,42,0.72)'; const GLASS_BORDER = 'rgba(255,255,255,0.10)';

const LANE_COUNT = 3;
const PLAYER_W = 48; const PLAYER_H = 56;
const OBSTACLE_SIZE = 50;
const PICKUP_SIZE = 44;
const INITIAL_SPEED = 4;
const GAME_TICK = 16;

const PC_COMPONENTS = [
  { id: 'cpu', emoji: '🖥️', name: 'CPU',         hint: 'Central Processing Unit',  color: BLUE,    points: 50 },
  { id: 'ram', emoji: '💾', name: 'RAM',         hint: 'Random Access Memory',      color: GREEN,   points: 50 },
  { id: 'gpu', emoji: '🎮', name: 'GPU',         hint: 'Graphics Processing Unit',  color: PURPLE,  points: 75 },
  { id: 'psu', emoji: '🔌', name: 'PSU',         hint: 'Power Supply Unit',         color: YELLOW,  points: 50 },
  { id: 'ssd', emoji: '💿', name: 'SSD',         hint: 'Solid State Drive',         color: '#EC4899', points: 60 },
  { id: 'mb',  emoji: '🔧', name: 'Motherboard', hint: 'Main circuit board',        color: '#F97316', points: 75 },
  { id: 'fan', emoji: '🌀', name: 'CPU Fan',     hint: 'Keeps the CPU cool',        color: '#06B6D4', points: 40 },
  { id: 'hdd', emoji: '🗄️', name: 'HDD',         hint: 'Hard Disk Drive',           color: RED,     points: 40 },
];

const OBSTACLES = [
  { emoji: '🪑', label: 'Chair',   type: 'low'  },
  { emoji: '🖥️', label: 'Monitor', type: 'low'  },
  { emoji: '📦', label: 'Box',     type: 'low'  },
  { emoji: '📚', label: 'Books',   type: 'low'  },
  { emoji: '🗑️', label: 'Bin',     type: 'low'  },
  { emoji: '🚧', label: 'Barrier', type: 'low'  },
];

const QUESTIONS = {
  cpu: ['What does CPU stand for?'],
  ram: ['What does RAM stand for?'],
  gpu: ['What does GPU stand for?'],
  psu: ['What does PSU stand for?'],
  ssd: ['What does SSD stand for?'],
  mb:  ['What is the main circuit board called?'],
  fan: ['What component cools the CPU?'],
  hdd: ['What does HDD stand for?'],
};

const MILESTONES = [100, 250, 500, 1000, 2000, 5000];

// ── Parallax Background ───────────────────────────────────────────────────────
function ServerRack({ style }) {
  const blink = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(blink, { toValue: 1, duration: 500 + Math.random() * 400, useNativeDriver: true }),
      Animated.timing(blink, { toValue: 0, duration: 500 + Math.random() * 400, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <View style={[styles.rack, style]}>
      {[0, 1, 2].map(i => (
        <View key={i} style={styles.rackSlot}>
          <Animated.View style={[styles.rackLed, { opacity: blink, backgroundColor: i === 1 ? CYAN : GREEN }]} />
          <View style={styles.rackVent} />
        </View>
      ))}
    </View>
  );
}

function ParallaxBG({ W, H, GROUND_Y, LANE_WIDTH }) {
  const wallBottom = GROUND_Y + PLAYER_H;
  const trimY = wallBottom * 0.5;
  const floorTiles = Array.from({ length: 14 });
  const windowItems = [W * 0.08, W * 0.68];
  const posterItems = [W * 0.32];
  const rackItems = [W * 0.12, W * 0.78];

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Sky gradient */}
      <LinearGradient colors={[SKY_TOP, SKY_MID, SKY_LOW]} style={StyleSheet.absoluteFill} />

      {/* Upper wall */}
      <View style={[styles.bgWall, { top: 0, height: trimY, backgroundColor: WALL_UPPER }]} />
      {/* Lower wall (deeper tone for depth) */}
      <View style={[styles.bgWall, { top: trimY, height: wallBottom - trimY, backgroundColor: WALL_LOWER }]} />
      {/* Trim line + cable run */}
      <View style={[styles.bgTrim, { top: trimY }]}>
        <View style={styles.bgCableDot} />
        <View style={styles.bgCableDot} />
        <View style={styles.bgCableDot} />
      </View>

      {/* Windows */}
      {windowItems.map((x, i) => (
        <View key={i} style={[styles.bgWindow, { left: x, top: trimY * 0.28 }]}>
          <View style={styles.bgWindowPane} />
          <View style={styles.bgWindowCross} />
          <View style={styles.bgWindowCrossH} />
        </View>
      ))}

      {/* Posters on upper wall */}
      {posterItems.map((x, i) => (
        <View key={i} style={[styles.bgPoster, { left: x, top: trimY * 0.62, backgroundColor: [PURPLE][i] + '33' }]}>
          <Text style={styles.bgPosterText}>{['📡'][i]}</Text>
        </View>
      ))}

      {/* Server racks on lower wall — fills what used to be dead space */}
      {rackItems.map((x, i) => (
        <ServerRack key={i} style={{ left: x, top: trimY + (wallBottom - trimY) * 0.14 }} />
      ))}

      {/* Ambient shadow where wall meets floor */}
      <LinearGradient
        colors={['rgba(0,0,0,0)', FLOOR_SHADE + '55']}
        style={[styles.bgGroundShade, { top: wallBottom - 22 }]}
      />

      {/* Floor */}
      <View style={[styles.bgFloor, { top: wallBottom - 4 }]} />

      {/* Floor tiles */}
      <View style={[styles.bgTileRow, { top: wallBottom, height: H * 0.28 }]}>
        {floorTiles.map((_, i) => (
          <View key={i} style={[styles.bgTile, { width: W / 7, backgroundColor: i % 2 === 0 ? FLOOR_A : FLOOR_B }]} />
        ))}
      </View>

      {/* Rug accent, purely decorative */}
      <View style={[styles.bgRug, { top: wallBottom + H * 0.10, left: LANE_WIDTH * 0.15, width: LANE_WIDTH * 0.7 }]} />

      {/* Ceiling strip */}
      <View style={styles.bgCeiling}>
        {[0,1,2,3,4,5,6].map(i => (
          <View key={i} style={styles.bgLight}>
            <View style={styles.bgLightGlow} />
            <View style={styles.bgLightBulb} />
          </View>
        ))}
      </View>

      {/* Lane lines on floor */}
      {[1, 2].map(i => (
        <View key={i} style={[styles.bgLaneLine, { left: LANE_WIDTH * i, top: wallBottom, height: H * 0.28 }]} />
      ))}
    </View>
  );
}

// ── Particle Burst ────────────────────────────────────────────────────────────
function ParticleBurst({ x, y, color, onDone }) {
  const particles = useRef(
    Array.from({ length: 8 }, (_, i) => ({
      anim: new Animated.ValueXY({ x: 0, y: 0 }),
      opacity: new Animated.Value(1),
      angle: (i / 8) * Math.PI * 2,
    }))
  ).current;

  useEffect(() => {
    const anims = particles.map(p => {
      const dist = 40 + Math.random() * 30;
      return Animated.parallel([
        Animated.timing(p.anim, {
          toValue: { x: Math.cos(p.angle) * dist, y: Math.sin(p.angle) * dist },
          duration: 500, useNativeDriver: true,
        }),
        Animated.timing(p.opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]);
    });
    Animated.parallel(anims).start(onDone);
  }, []);

  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
      {particles.map((p, i) => (
        <Animated.View key={i} style={{
          position: 'absolute', left: x, top: y,
          width: 8, height: 8, borderRadius: 4,
          backgroundColor: color,
          opacity: p.opacity,
          transform: [{ translateX: p.anim.x }, { translateY: p.anim.y }],
        }} />
      ))}
    </View>
  );
}

// ── Floating Score Popup ──────────────────────────────────────────────────────
function ScorePopup({ x, y, value, color, onDone }) {
  const anim = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(anim, { toValue: -60, duration: 800, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(400),
        Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    ]).start(onDone);
  }, []);
  return (
    <Animated.Text style={{
      position: 'absolute', left: x - 20, top: y,
      fontSize: 18, fontWeight: '900', color,
      transform: [{ translateY: anim }],
      opacity, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2,
    }}>
      +{value}
    </Animated.Text>
  );
}

// ── Start Screen ──────────────────────────────────────────────────────────────
function StartScreen({ onStart, highScore }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.07, duration: 600, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: -12, duration: 1000, useNativeDriver: true }),
      Animated.timing(float, { toValue: 0, duration: 1000, useNativeDriver: true }),
    ])).start();
  }, []);

  return (
    <LinearGradient colors={['#0B1226', DARK_BLUE, BLUE]} style={styles.fullScreen}>
      <StatusBar hidden />
      {/* Decorative circles */}
      <View style={[styles.decorCircle, { width: 200, height: 200, top: -60, right: -60, backgroundColor: 'rgba(255,255,255,0.06)' }]} />
      <View style={[styles.decorCircle, { width: 140, height: 140, bottom: 80, left: -40, backgroundColor: 'rgba(255,255,255,0.04)' }]} />

      <View style={styles.startContent}>
        <View style={styles.startEmojiWrap}>
          <View style={styles.startEmojiGlow} />
          <Animated.Text style={[styles.startEmoji, { transform: [{ translateY: float }] }]}>🏃</Animated.Text>
        </View>
        <Text style={styles.startTitle}>CompuRunner</Text>
        <Text style={styles.startSub}>Dodge obstacles · Collect components{'\n'}Answer questions · Survive!</Text>

        <View style={styles.startTips}>
          {[
            { icon: '👆', text: 'Swipe UP to jump' },
            { icon: '👇', text: 'Swipe DOWN to slide' },
            { icon: '👈👉', text: 'Swipe LEFT / RIGHT to switch lane' },
            { icon: '💡', text: 'Collect components → answer to earn XP' },
          ].map((t, i) => (
            <View key={i} style={styles.tipRow}>
              <Text style={styles.tipEmoji}>{t.icon}</Text>
              <Text style={styles.tipText}>{t.text}</Text>
            </View>
          ))}
        </View>

        {highScore > 0 && (
          <View style={styles.highScoreBadge}>
            <Text style={styles.highScoreLabel}>🏆  Best Score: {highScore}</Text>
          </View>
        )}

        <Animated.View style={{ transform: [{ scale: pulse }] }}>
          <TouchableOpacity style={styles.startBtn} onPress={onStart} activeOpacity={0.85}>
            <Text style={styles.startBtnText}>▶  TAP TO RUN!</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </LinearGradient>
  );
}

// ── Game Over Screen ──────────────────────────────────────────────────────────
function GameOverScreen({ score, highScore, collected, leaderboard, onRestart, onHome, finishRank }) {
  const slideUp = useRef(new Animated.Value(80)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideUp, { toValue: 0, useNativeDriver: true, speed: 12, bounciness: 6 }),
      Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  const isNewHigh = score > 0 && score >= highScore;

  return (
    <LinearGradient colors={['#0B1226', DARK_BLUE, '#1D4ED8']} style={styles.fullScreen}>
      <StatusBar hidden />
      <Animated.View style={[styles.gameOverCard, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
        <Text style={styles.gameOverEmoji}>{isNewHigh ? '🏆' : '💀'}</Text>
        <Text style={styles.gameOverTitle}>GAME OVER</Text>
        {finishRank != null && (
          <View style={styles.rankBadge}>
            <Text style={styles.rankBadgeText}>{['🥇 1st','🥈 2nd','🥉 3rd'][finishRank - 1] || `#${finishRank}`} place</Text>
          </View>
        )}

        <View style={styles.scoreBox}>
          <Text style={styles.gameOverScore}>{score}</Text>
          <Text style={styles.gameOverScoreLabel}>SCORE</Text>
        </View>

        {isNewHigh && (
          <View style={styles.newHighBadge}>
            <Text style={styles.newHighText}>✨ NEW HIGH SCORE! ✨</Text>
          </View>
        )}
        {!isNewHigh && <Text style={styles.gameOverHigh}>Best: {highScore}</Text>}

        {collected.length > 0 && (
          <View style={styles.collectedRow}>
            <Text style={styles.collectedLabel}>Components collected</Text>
            <View style={styles.collectedEmojis}>
              {[...new Map(collected.map(c => [c.id, c])).values()].map((c, i) => (
                <View key={i} style={[styles.collectedChip, { borderColor: c.color }]}>
                  <Text style={styles.collectedEmoji}>{c.emoji}</Text>
                  <Text style={[styles.collectedName, { color: c.color }]}>{c.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <TouchableOpacity style={styles.restartBtn} onPress={onRestart}>
          <Text style={styles.restartBtnText}>▶  PLAY AGAIN</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.homeBtn} onPress={onHome}>
          <Text style={styles.homeBtnText}>← Back to Dashboard</Text>
        </TouchableOpacity>

        {leaderboard.length > 0 && (
          <View style={styles.leaderboardWrap}>
            <Text style={styles.leaderboardTitle}>🏆 Leaderboard</Text>
            {leaderboard.map((entry, i) => (
              <View key={i} style={styles.leaderboardRow}>
                <Text style={styles.leaderboardRank}>{['🥇','🥈','🥉','4️⃣','5️⃣'][i]}</Text>
                <Text style={styles.leaderboardName}>{entry.profiles?.full_name || 'Player'}</Text>
                <Text style={styles.leaderboardScore}>{entry.score}</Text>
              </View>
            ))}
          </View>
        )}
      </Animated.View>
    </LinearGradient>
  );
}

// ── Main Game ─────────────────────────────────────────────────────────────────
export default function GameScreen({ navigation, route }) {
  const isMulti = route?.params?.multiplayer === true;
  const roomId = route?.params?.roomId || null;
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const LANE_WIDTH = W / LANE_COUNT;
  const LANES = [LANE_WIDTH * 0.5, LANE_WIDTH * 1.5, LANE_WIDTH * 2.5];
  const GROUND_Y = H * 0.70;

  const [phase, setPhase] = useState('start');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [lives, setLives] = useState(3);
  const [energy, setEnergy] = useState(100);
  const [collected, setCollected] = useState([]);
  const [obstacles, setObstacles] = useState([]);
  const [pickups, setPickups] = useState([]);
  const [question, setQuestion] = useState(null);
  const [answerInput, setAnswerInput] = useState('');
  const [answerFeedback, setAnswerFeedback] = useState(null);
  const [particles, setParticles] = useState([]);
  const [scorePopups, setScorePopups] = useState([]);
  const [milestone, setMilestone] = useState(null);
  const [invincibleFlash, setInvincibleFlash] = useState(false);
  const [otherPlayers, setOtherPlayers] = useState([]);
  const [finishRank, setFinishRank] = useState(null);

  const laneRef = useRef(1);
  const isJumping = useRef(false);
  const isSliding = useRef(false);
  const invincible = useRef(false);
  const speedRef = useRef(INITIAL_SPEED);
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const energyRef = useRef(100);
  const gameActive = useRef(false);
  const tickRef = useRef(null);
  const spawnRef = useRef(null);
  const myIdRef = useRef(null);
  const roomChannelRef = useRef(null);
  const lastPushRef = useRef(0);
  const ghostAnimsRef = useRef({});
  const obstaclesRef = useRef([]);
  const pickupsRef = useRef([]);
  const idCounter = useRef(0);
  const nextMilestoneIdx = useRef(0);

  const playSound = () => {};
  const startMusic = () => {};
  const stopMusic = () => {};

  useEffect(() => {
    AsyncStorage.getItem('compurunner_highscore').then(v => { if (v) setHighScore(parseInt(v)); });
    loadLeaderboard();
  }, []);

  // Multiplayer: subscribe to the room and mirror opponents' lane/score/lives.
  useEffect(() => {
    if (!isMulti || !roomId) return;
    let cancelled = false;

    const refreshOthers = async () => {
      const players = await gameRunnerService.getRoomPlayers(roomId);
      if (cancelled) return;
      const others = players.filter(p => p.user_id !== myIdRef.current);
      setOtherPlayers(others);
      others.forEach(p => {
        const targetX = LANES[p.lane] - PLAYER_W / 2;
        if (!ghostAnimsRef.current[p.user_id]) {
          ghostAnimsRef.current[p.user_id] = new Animated.Value(targetX);
        } else {
          Animated.spring(ghostAnimsRef.current[p.user_id], {
            toValue: targetX, useNativeDriver: true, speed: 20, bounciness: 3,
          }).start();
        }
      });
    };

    authService.getCurrentUser().then(u => {
      myIdRef.current = u?.id || null;
      refreshOthers();
    });

    roomChannelRef.current = gameRunnerService.subscribeToRoom(roomId, refreshOthers, () => {});

    return () => {
      cancelled = true;
      if (roomChannelRef.current) {
        gameRunnerService.unsubscribe(roomChannelRef.current);
        roomChannelRef.current = null;
      }
    };
  }, [isMulti, roomId]);

  const loadLeaderboard = async () => {
    try {
      const { data } = await supabase.from('game_scores').select('score, profiles(full_name)').order('score', { ascending: false }).limit(5);
      setLeaderboard(data || []);
    } catch {}
  };

  const saveScore = async (finalScore) => {
    try {
      const stored = await AsyncStorage.getItem('compurunner_highscore');
      const prev = stored ? parseInt(stored) : 0;
      if (finalScore > prev) {
        await AsyncStorage.setItem('compurunner_highscore', String(finalScore));
        setHighScore(finalScore);
        const user = await authService.getCurrentUser();
        if (user) await supabase.from('game_scores').upsert({ user_id: user.id, score: finalScore }, { onConflict: 'user_id' });
        loadLeaderboard();
      }
    } catch {}
  };

  // Animated values
  const playerX = useRef(new Animated.Value(LANES[1] - PLAYER_W / 2)).current;
  const playerY = useRef(new Animated.Value(GROUND_Y)).current;
  const playerScaleY = useRef(new Animated.Value(1)).current;
  const playerScaleX = useRef(new Animated.Value(1)).current;
  const playerRotate = useRef(new Animated.Value(0)).current;
  const playerLean = useRef(new Animated.Value(0)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;
  const energyAnim = useRef(new Animated.Value(100)).current;
  const milestoneAnim = useRef(new Animated.Value(0)).current;
  // Running leg animation
  const legAnim = useRef(new Animated.Value(0)).current;
  const legLoop = useRef(null);
  // Shared idle pulse for pickup glows
  const pickupPulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pickupPulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(pickupPulse, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  const pulseScale = pickupPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  // Shadow shrinks and fades as the player jumps higher off the ground.
  const shadowScale = playerY.interpolate({ inputRange: [GROUND_Y - 120, GROUND_Y], outputRange: [0.45, 1], extrapolate: 'clamp' });
  const shadowOpacity = playerY.interpolate({ inputRange: [GROUND_Y - 120, GROUND_Y], outputRange: [0.3, 1], extrapolate: 'clamp' });

  const startLegAnim = () => {
    legLoop.current = Animated.loop(Animated.sequence([
      Animated.timing(legAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(legAnim, { toValue: -1, duration: 180, useNativeDriver: true }),
    ]));
    legLoop.current.start();
  };

  const stopLegAnim = () => {
    legLoop.current?.stop();
    legAnim.setValue(0);
  };

  const resetGame = () => {
    laneRef.current = 1; isJumping.current = false; isSliding.current = false;
    invincible.current = false; speedRef.current = INITIAL_SPEED;
    scoreRef.current = 0; livesRef.current = 3; energyRef.current = 100;
    obstaclesRef.current = []; pickupsRef.current = [];
    idCounter.current = 0; nextMilestoneIdx.current = 0;
    playerX.setValue(LANES[1] - PLAYER_W / 2); playerY.setValue(GROUND_Y);
    playerScaleY.setValue(1); playerScaleX.setValue(1);
    playerRotate.setValue(0); playerLean.setValue(0);
    energyAnim.setValue(100); flashAnim.setValue(0);
    setScore(0); setLives(3); setEnergy(100);
    setObstacles([]); setPickups([]); setCollected([]);
    setQuestion(null); setAnswerInput(''); setAnswerFeedback(null);
    setParticles([]); setScorePopups([]); setMilestone(null);
    setInvincibleFlash(false);
    setFinishRank(null);
  };

  const doFlash = (color) => {
    flashAnim.setValue(0.5);
    Animated.timing(flashAnim, { toValue: 0, duration: 350, useNativeDriver: true }).start();
  };

  const addParticle = (x, y, color) => {
    const id = Date.now() + Math.random();
    setParticles(prev => [...prev, { id, x, y, color }]);
  };

  const addScorePopup = (x, y, value, color) => {
    const id = Date.now() + Math.random();
    setScorePopups(prev => [...prev, { id, x, y, value, color }]);
  };

  const showMilestone = (val) => {
    setMilestone(val);
    milestoneAnim.setValue(0);
    Animated.sequence([
      Animated.spring(milestoneAnim, { toValue: 1, useNativeDriver: true, speed: 20 }),
      Animated.delay(1200),
      Animated.timing(milestoneAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setMilestone(null));
  };

  const jump = useCallback(() => {
    if (isJumping.current || isSliding.current) return;
    isJumping.current = true;
    stopLegAnim();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    playSound('jump');
    Animated.sequence([
      Animated.parallel([
        Animated.timing(playerY, { toValue: GROUND_Y - 120, duration: 260, useNativeDriver: true }),
        Animated.timing(playerScaleY, { toValue: 1.15, duration: 130, useNativeDriver: true }),
        Animated.timing(playerScaleX, { toValue: 0.88, duration: 130, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(playerY, { toValue: GROUND_Y, duration: 260, useNativeDriver: true }),
        Animated.timing(playerScaleY, { toValue: 0.8, duration: 130, useNativeDriver: true }),
        Animated.timing(playerScaleX, { toValue: 1.1, duration: 130, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(playerScaleY, { toValue: 1, useNativeDriver: true, speed: 30 }),
        Animated.spring(playerScaleX, { toValue: 1, useNativeDriver: true, speed: 30 }),
      ]),
    ]).start(() => { isJumping.current = false; startLegAnim(); });
  }, []);

  const slide = useCallback(() => {
    if (isJumping.current || isSliding.current) return;
    isSliding.current = true;
    stopLegAnim();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    playSound('jump');
    Animated.sequence([
      Animated.timing(playerScaleY, { toValue: 0.42, duration: 120, useNativeDriver: true }),
      Animated.timing(playerScaleX, { toValue: 1.3, duration: 120, useNativeDriver: true }),
      Animated.delay(420),
      Animated.parallel([
        Animated.spring(playerScaleY, { toValue: 1, useNativeDriver: true, speed: 25 }),
        Animated.spring(playerScaleX, { toValue: 1, useNativeDriver: true, speed: 25 }),
      ]),
    ]).start(() => { isSliding.current = false; startLegAnim(); });
  }, []);

  const changeLane = useCallback((dir) => {
    const next = Math.max(0, Math.min(2, laneRef.current + dir));
    if (next === laneRef.current) return;
    laneRef.current = next;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.timing(playerLean, { toValue: dir * 15, duration: 100, useNativeDriver: true }).start(() => {
      Animated.spring(playerLean, { toValue: 0, useNativeDriver: true, speed: 30 }).start();
    });
    Animated.spring(playerX, {
      toValue: LANES[next] - PLAYER_W / 2,
      useNativeDriver: true, speed: 45, bounciness: 3,
    }).start();
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => gameActive.current,
      onMoveShouldSetPanResponder: () => gameActive.current,
      onPanResponderRelease: (_, g) => {
        if (!gameActive.current) return;
        const { dx, dy } = g;
        if (Math.abs(dy) > Math.abs(dx)) {
          if (dy < -25) jump();
          else if (dy > 25) slide();
        } else {
          if (dx > 25) changeLane(1);
          else if (dx < -25) changeLane(-1);
        }
      },
    })
  ).current;

  const hitPlayer = () => {
    if (invincible.current) return;
    invincible.current = true;
    livesRef.current -= 1;
    setLives(livesRef.current);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    playSound('hit');
    doFlash(RED);
    setInvincibleFlash(true);
    Animated.sequence([
      Animated.timing(playerRotate, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(playerRotate, { toValue: -1, duration: 80, useNativeDriver: true }),
      Animated.timing(playerRotate, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(playerRotate, { toValue: 0, duration: 80, useNativeDriver: true }),
    ]).start();
    setTimeout(() => { invincible.current = false; setInvincibleFlash(false); }, 1800);
    if (livesRef.current <= 0) endGame();
  };

  const collectPickup = (pickup) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    playSound('collect');
    const pts = pickup.points;
    scoreRef.current += pts;
    setScore(scoreRef.current);
    energyRef.current = Math.min(100, energyRef.current + 18);
    setEnergy(Math.floor(energyRef.current));
    Animated.timing(energyAnim, { toValue: energyRef.current, duration: 200, useNativeDriver: false }).start();
    setCollected(prev => [...prev, pickup]);
    const px = LANES[pickup.lane];
    const py = GROUND_Y - 40;
    addParticle(px, py, pickup.color);
    addScorePopup(px, py - 20, pts, pickup.color);
    gameActive.current = false;
    const qs = QUESTIONS[pickup.id];
    setQuestion({ component: pickup, question: qs[0], answer: pickup.name.toLowerCase() });
  };

  const submitAnswer = () => {
    if (!question) return;
    const input = answerInput.trim().toLowerCase();
    const correct = input === question.answer.toLowerCase() ||
      input === question.component.hint.toLowerCase() ||
      input === question.component.id.toLowerCase();
    if (correct) {
      scoreRef.current += 100;
      setScore(scoreRef.current);
      setAnswerFeedback('correct');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      playSound('correct');
    } else {
      setAnswerFeedback('wrong');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      playSound('wrong');
    }
    setTimeout(() => {
      setQuestion(null); setAnswerInput(''); setAnswerFeedback(null);
      gameActive.current = true;
    }, 1300);
  };

  const endGame = async () => {
    gameActive.current = false;
    stopLegAnim();
    stopMusic();
    clearInterval(tickRef.current);
    clearInterval(spawnRef.current);
    setHighScore(prev => Math.max(prev, scoreRef.current));
    saveScore(scoreRef.current);

    if (isMulti && roomId && myIdRef.current) {
      const rank = await gameRunnerService.getFinishRank(roomId);
      setFinishRank(rank);
      await gameRunnerService.pushPlayerState(roomId, myIdRef.current, {
        lane: laneRef.current, score: scoreRef.current, lives: livesRef.current,
        finished: true, finishRank: rank,
      });
      if (roomChannelRef.current) {
        gameRunnerService.unsubscribe(roomChannelRef.current);
        roomChannelRef.current = null;
      }
    }

    setTimeout(() => setPhase('gameover'), 400);
  };

  const startGame = () => {
    resetGame();
    setPhase('playing');
    gameActive.current = true;
    startLegAnim();
    startMusic();

    spawnRef.current = setInterval(() => {
      if (!gameActive.current) return;
      const r = Math.random();
      if (r < 0.55) {
        const lane = Math.floor(Math.random() * 3);
        const obs = OBSTACLES[Math.floor(Math.random() * OBSTACLES.length)];
        const id = idCounter.current++;
        const obj = { id, lane, y: -OBSTACLE_SIZE, emoji: obs.emoji, label: obs.label, anim: new Animated.Value(-OBSTACLE_SIZE) };
        obstaclesRef.current = [...obstaclesRef.current, obj];
        setObstacles(prev => [...prev, obj]);
      } else {
        const lane = Math.floor(Math.random() * 3);
        const comp = PC_COMPONENTS[Math.floor(Math.random() * PC_COMPONENTS.length)];
        // comp.id is the component type ('psu', 'cpu', ...), used later for the
        // question lookup — spawnId is this specific pickup instance's identity,
        // since two pickups of the same type can be on screen at once.
        const spawnId = idCounter.current++;
        const obj = { lane, y: -PICKUP_SIZE, ...comp, spawnId, anim: new Animated.Value(-PICKUP_SIZE) };
        pickupsRef.current = [...pickupsRef.current, obj];
        setPickups(prev => [...prev, obj]);
      }
    }, 1300);

    tickRef.current = setInterval(() => {
      if (!gameActive.current) return;
      speedRef.current = INITIAL_SPEED + scoreRef.current / 500;
      energyRef.current = Math.max(0, energyRef.current - 0.12);
      if (scoreRef.current % 30 === 0) {
        setEnergy(Math.floor(energyRef.current));
        Animated.timing(energyAnim, { toValue: energyRef.current, duration: 300, useNativeDriver: false }).start();
      }
      if (energyRef.current <= 0) { endGame(); return; }
      scoreRef.current += 1;
      if (scoreRef.current % 8 === 0) setScore(scoreRef.current);

      // Milestone check
      const mi = nextMilestoneIdx.current;
      if (mi < MILESTONES.length && scoreRef.current >= MILESTONES[mi]) {
        nextMilestoneIdx.current++;
        showMilestone(MILESTONES[mi]);
        playSound('milestone');
      }

      const speed = speedRef.current;
      const playerLane = laneRef.current;
      const jumping = isJumping.current;

      const newObs = [];
      for (const obs of obstaclesRef.current) {
        const newY = obs.y + speed;
        obs.y = newY;
        obs.anim.setValue(newY);
        if (!invincible.current && obs.lane === playerLane && newY > GROUND_Y - 55 && newY < GROUND_Y + 15) {
          if (!jumping) {
            obstaclesRef.current = obstaclesRef.current.filter(o => o.id !== obs.id);
            setObstacles([...obstaclesRef.current]);
            hitPlayer();
            continue;
          }
        }
        if (newY < H + 20) newObs.push(obs);
      }
      obstaclesRef.current = newObs;

      const newPick = [];
      for (const pick of pickupsRef.current) {
        const newY = pick.y + speed;
        pick.y = newY;
        pick.anim.setValue(newY);
        if (pick.lane === playerLane && newY > GROUND_Y - 75 && newY < GROUND_Y + 15) {
          pickupsRef.current = pickupsRef.current.filter(p => p.spawnId !== pick.spawnId);
          setPickups([...pickupsRef.current]);
          collectPickup(pick);
          continue;
        }
        if (newY < H + 20) newPick.push(pick);
      }
      pickupsRef.current = newPick;

      setObstacles([...obstaclesRef.current]);
      setPickups([...pickupsRef.current]);

      if (isMulti && roomId) {
        const now = Date.now();
        if (now - lastPushRef.current > 250) {
          lastPushRef.current = now;
          gameRunnerService.pushPlayerState(roomId, myIdRef.current, {
            lane: laneRef.current, score: scoreRef.current, lives: livesRef.current, finished: false,
          });
        }
      }
    }, GAME_TICK);
  };

  useEffect(() => () => {
    clearInterval(tickRef.current);
    clearInterval(spawnRef.current);
    stopLegAnim();
    stopMusic();
  }, []);

  const rotateInterp = playerRotate.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-20deg', '0deg', '20deg'] });
  const leanInterp = playerLean.interpolate({ inputRange: [-15, 0, 15], outputRange: ['-15deg', '0deg', '15deg'] });
  const legL = legAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: ['20deg', '0deg', '-20deg'] });
  const legR = legAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-20deg', '0deg', '20deg'] });

  if (phase === 'start') return <StartScreen onStart={startGame} highScore={highScore} />;
  if (phase === 'gameover') return (
    <GameOverScreen score={score} highScore={highScore} collected={collected} leaderboard={leaderboard}
      onRestart={startGame} onHome={() => navigation.goBack()} finishRank={isMulti ? finishRank : null} />
  );

  return (
    <View style={styles.gameContainer} {...panResponder.panHandlers}>
      <StatusBar hidden />
      <ParallaxBG W={W} H={H} GROUND_Y={GROUND_Y} LANE_WIDTH={LANE_WIDTH} />

      {/* Obstacles */}
      {obstacles.map(obs => (
        <Animated.View key={obs.id} style={[styles.obstacleWrap, {
          left: LANES[obs.lane] - OBSTACLE_SIZE / 2,
          transform: [{ translateY: obs.anim }],
        }]}>
          <Text style={styles.obstacleEmoji}>{obs.emoji}</Text>
          <View style={styles.obstacleShadow} />
        </Animated.View>
      ))}

      {/* Pickups */}
      {pickups.map(pick => (
        <Animated.View key={pick.spawnId} style={[styles.pickupWrap, {
          left: LANES[pick.lane] - PICKUP_SIZE / 2,
          transform: [{ translateY: pick.anim }],
          backgroundColor: pick.color + '25',
          borderColor: pick.color,
          shadowColor: pick.color,
        }]}>
          <Text style={styles.pickupEmoji}>{pick.emoji}</Text>
          <Animated.View style={[styles.pickupGlow, { backgroundColor: pick.color + '30', transform: [{ scale: pulseScale }] }]} />
        </Animated.View>
      ))}

      {/* Ghost runners — other players in the room */}
      {isMulti && otherPlayers.map(p => {
        const anim = ghostAnimsRef.current[p.user_id] || new Animated.Value(LANES[p.lane] - PLAYER_W / 2);
        ghostAnimsRef.current[p.user_id] = anim;
        return (
          <Animated.View key={p.user_id} style={[styles.ghostWrap, {
            transform: [{ translateX: anim }, { translateY: GROUND_Y }],
          }]}>
            <Text style={styles.ghostName} numberOfLines={1}>{(p.full_name || 'Player').split(' ')[0]}</Text>
            <Text style={styles.ghostEmoji}>{p.finished ? '🏁' : '🧑‍💻'}</Text>
          </Animated.View>
        );
      })}

      {/* Player */}
      <Animated.View style={[styles.playerWrap, {
        transform: [
          { translateX: playerX },
          { translateY: playerY },
          { rotate: rotateInterp },
        ],
        opacity: invincibleFlash ? 0.5 : 1,
      }]}>
        {/* Body */}
        <Animated.View style={[styles.playerBody, {
          transform: [{ scaleY: playerScaleY }, { scaleX: playerScaleX }, { rotate: leanInterp }],
        }]}>
          <Text style={styles.playerEmoji}>🧑‍💻</Text>
        </Animated.View>
        {/* Legs */}
        <View style={styles.legsRow}>
          <Animated.View style={[styles.leg, { transform: [{ rotate: legL }] }]} />
          <Animated.View style={[styles.leg, { transform: [{ rotate: legR }] }]} />
        </View>
        {/* Shadow */}
        <Animated.View style={[styles.playerShadow, { opacity: shadowOpacity, transform: [{ scaleX: shadowScale }] }]} />
      </Animated.View>

      {/* Flash overlay */}
      <Animated.View style={[StyleSheet.absoluteFill, {
        backgroundColor: RED, opacity: flashAnim, pointerEvents: 'none',
      }]} />

      {/* Particles */}
      {particles.map(p => (
        <ParticleBurst key={p.id} x={p.x} y={p.y} color={p.color}
          onDone={() => setParticles(prev => prev.filter(x => x.id !== p.id))} />
      ))}

      {/* Score popups */}
      {scorePopups.map(p => (
        <ScorePopup key={p.id} x={p.x} y={p.y} value={p.value} color={p.color}
          onDone={() => setScorePopups(prev => prev.filter(x => x.id !== p.id))} />
      ))}

      {/* Milestone banner */}
      {milestone && (
        <Animated.View style={[styles.milestoneBanner, { top: H * 0.35,
          transform: [{ scale: milestoneAnim }], opacity: milestoneAnim,
        }]}>
          <Text style={styles.milestoneText}>🎯 {milestone} pts!</Text>
        </Animated.View>
      )}

      {/* HUD */}
      <View style={[styles.hudRow, { top: insets.top + 10 }]} pointerEvents="none">
        <View style={styles.hudCard}>
          <View style={styles.hudScoreWrap}>
            <Text style={styles.hudScore}>{score}</Text>
            <Text style={styles.hudScoreLabel}>SCORE</Text>
          </View>

          <View style={styles.hudDivider} />

          <View style={styles.hudEnergyWrap}>
            <Text style={styles.hudEnergyLabel}>⚡ ENERGY</Text>
            <View style={styles.energyBarBg}>
              <Animated.View style={[styles.energyBarFillWrap, {
                width: energyAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
              }]}>
                <LinearGradient
                  colors={energy > 50 ? [GREEN, CYAN] : energy > 25 ? [YELLOW, GREEN] : [RED, YELLOW]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            </View>
          </View>

          <View style={styles.hudDivider} />

          <View style={styles.hudHearts}>
            {[0,1,2].map(i => (
              <Text key={i} style={{ fontSize: 16, opacity: i < lives ? 1 : 0.25 }}>❤️</Text>
            ))}
          </View>
        </View>

        <View style={styles.speedChip}>
          <Text style={styles.speedText}>x{speedRef.current.toFixed(1)}</Text>
        </View>
      </View>

      {/* Opponents strip */}
      {isMulti && otherPlayers.length > 0 && (
        <View style={[styles.opponentsRow, { top: insets.top + 68 }]} pointerEvents="none">
          {otherPlayers.map(p => (
            <View key={p.user_id} style={styles.opponentChip}>
              <Text style={styles.opponentName} numberOfLines={1}>{(p.full_name || 'Player').split(' ')[0]}</Text>
              <Text style={styles.opponentScore}>{p.finished ? '🏁' : p.score}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Question modal */}
      {question && (
        <View style={styles.questionOverlay}>
          <View style={styles.questionCard}>
            <View style={[styles.questionIconWrap, { backgroundColor: question.component.color + '20', borderColor: question.component.color }]}>
              <Text style={styles.questionEmoji}>{question.component.emoji}</Text>
            </View>
            <View style={styles.questionBonusBadge}>
              <Text style={styles.questionBonusText}>+100 pts for correct answer!</Text>
            </View>
            <Text style={styles.questionText}>{question.question}</Text>
            {answerFeedback === 'correct' && (
              <View style={styles.feedbackBox}>
                <Text style={styles.feedbackCorrect}>✅  Correct! +100 pts</Text>
              </View>
            )}
            {answerFeedback === 'wrong' && (
              <View style={[styles.feedbackBox, { backgroundColor: RED + '15' }]}>
                <Text style={styles.feedbackWrong}>❌  Answer: {question.component.name}</Text>
              </View>
            )}
            {!answerFeedback && (
              <>
                <TextInput
                  style={styles.answerInput}
                  placeholder="Type your answer..."
                  placeholderTextColor={MUTED}
                  value={answerInput}
                  onChangeText={setAnswerInput}
                  autoFocus
                  onSubmitEditing={submitAnswer}
                  returnKeyType="done"
                />
                <View style={styles.questionBtns}>
                  <TouchableOpacity style={styles.submitBtn} onPress={submitAnswer}>
                    <Text style={styles.submitBtnText}>Submit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.skipBtn} onPress={() => {
                    setQuestion(null); setAnswerInput('');
                    gameActive.current = true;
                  }}>
                    <Text style={styles.skipBtnText}>Skip</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.hintText}>💡 {question.component.hint}</Text>
              </>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: { flex: 1 },
  gameContainer: { flex: 1, overflow: 'hidden', backgroundColor: '#DBEAFE' },

  // Decorative
  decorCircle: { position: 'absolute', borderRadius: 999 },

  // Background
  bgWall: { position: 'absolute', left: 0, right: 0 },
  bgTrim: { position: 'absolute', left: 0, right: 0, height: 8, backgroundColor: TRIM, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly' },
  bgCableDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: RACK_TRIM + '90' },
  bgWindow: { position: 'absolute', width: 80, height: 90, backgroundColor: '#BAE6FD', borderRadius: 6, borderWidth: 3, borderColor: '#94A3B8', overflow: 'hidden' },
  bgWindowPane: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#E0F2FE' },
  bgWindowCross: { position: 'absolute', top: 0, bottom: 0, left: '50%', width: 2, backgroundColor: '#94A3B8' },
  bgWindowCrossH: { position: 'absolute', left: 0, right: 0, top: '50%', height: 2, backgroundColor: '#94A3B8' },
  bgPoster: { position: 'absolute', width: 44, height: 56, borderRadius: 4, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' },
  bgPosterText: { fontSize: 22 },
  rack: { position: 'absolute', width: 46, height: 64, backgroundColor: RACK_BODY, borderRadius: 6, borderWidth: 2, borderColor: RACK_TRIM, padding: 5, gap: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 4 },
  rackSlot: { flex: 1, backgroundColor: RACK_TRIM, borderRadius: 3, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 5, gap: 4 },
  rackLed: { width: 5, height: 5, borderRadius: 3 },
  rackVent: { flex: 1, height: 2, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 1 },
  bgGroundShade: { position: 'absolute', left: 0, right: 0, height: 22 },
  bgFloor: { position: 'absolute', left: 0, right: 0, height: 6, backgroundColor: '#94A3B8' },
  bgTileRow: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row' },
  bgTile: { height: '100%' },
  bgRug: { position: 'absolute', height: 16, borderRadius: 8, backgroundColor: '#93C5FD55', borderWidth: 2, borderColor: '#60A5FA55' },
  bgCeiling: { position: 'absolute', top: 0, left: 0, right: 0, height: 36, backgroundColor: '#CBD5E1', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', paddingHorizontal: 10 },
  bgLight: { alignItems: 'center', paddingBottom: 2 },
  bgLightGlow: { width: 28, height: 6, backgroundColor: YELLOW + '60', borderRadius: 3, marginBottom: 1 },
  bgLightBulb: { width: 16, height: 6, backgroundColor: YELLOW, borderRadius: 3 },
  bgLaneLine: { position: 'absolute', width: 2, bottom: 0, backgroundColor: 'rgba(0,0,0,0.08)' },

  // Obstacles
  obstacleWrap: { position: 'absolute', top: 0, width: OBSTACLE_SIZE, alignItems: 'center' },
  obstacleEmoji: { fontSize: OBSTACLE_SIZE - 6 },
  obstacleShadow: { width: OBSTACLE_SIZE * 0.7, height: 6, backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 4, marginTop: -2 },

  // Pickups
  pickupWrap: { position: 'absolute', top: 0, width: PICKUP_SIZE, height: PICKUP_SIZE, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 8, elevation: 6 },
  pickupEmoji: { fontSize: PICKUP_SIZE - 10 },
  pickupGlow: { position: 'absolute', top: -4, left: -4, right: -4, bottom: -4, borderRadius: 18 },

  // Player
  playerWrap: { position: 'absolute', top: 0, width: PLAYER_W, alignItems: 'center' },
  ghostWrap: { position: 'absolute', top: 0, width: PLAYER_W, alignItems: 'center', opacity: 0.55 },
  ghostName: { fontSize: 9, fontWeight: '800', color: TEXT, backgroundColor: WHITE + 'CC', borderRadius: 6, paddingHorizontal: 4, marginBottom: 2, maxWidth: PLAYER_W + 20 },
  ghostEmoji: { fontSize: PLAYER_W - 10 },
  playerBody: { width: PLAYER_W, height: PLAYER_H, alignItems: 'center', justifyContent: 'center' },
  playerEmoji: { fontSize: PLAYER_W - 2 },
  legsRow: { flexDirection: 'row', gap: 6, marginTop: -6 },
  leg: { width: 6, height: 14, backgroundColor: '#1E40AF', borderRadius: 3 },
  playerShadow: { width: PLAYER_W * 0.6, height: 6, backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 4, marginTop: 2 },

  // HUD — floating glass panel, safe-area aware
  hudRow: { position: 'absolute', left: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  hudCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: GLASS, borderRadius: 18, borderWidth: 1, borderColor: GLASS_BORDER,
    paddingHorizontal: 14, paddingVertical: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 10, elevation: 8,
  },
  hudDivider: { width: 1, alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.12)' },
  hudScoreWrap: { width: 56 },
  hudScore: { fontSize: 20, fontWeight: '900', color: WHITE, lineHeight: 22 },
  hudScoreLabel: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.55)', letterSpacing: 1.5 },
  hudEnergyWrap: { flex: 1 },
  hudEnergyLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.65)', marginBottom: 5 },
  energyBarBg: { width: '100%', height: 8, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 4, overflow: 'hidden' },
  energyBarFillWrap: { height: '100%', borderRadius: 4, overflow: 'hidden' },
  hudHearts: { flexDirection: 'row', gap: 2 },
  speedChip: { backgroundColor: GLASS, borderRadius: 12, borderWidth: 1, borderColor: GLASS_BORDER, paddingHorizontal: 10, paddingVertical: 8 },
  opponentsRow: { position: 'absolute', left: 14, right: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  opponentChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: GLASS, borderRadius: 10, borderWidth: 1, borderColor: GLASS_BORDER, paddingHorizontal: 8, paddingVertical: 4 },
  opponentName: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.8)', maxWidth: 70 },
  opponentScore: { fontSize: 10, fontWeight: '900', color: CYAN },
  speedText: { fontSize: 12, fontWeight: '800', color: CYAN },

  // Milestone
  milestoneBanner: { position: 'absolute', alignSelf: 'center', backgroundColor: YELLOW, borderRadius: 16, paddingHorizontal: 24, paddingVertical: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 8 },
  milestoneText: { fontSize: 20, fontWeight: '900', color: TEXT },

  // Start screen
  startContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  startEmojiWrap: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  startEmojiGlow: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: CYAN + '30' },
  startEmoji: { fontSize: 72 },
  startTitle: { fontSize: 44, fontWeight: '900', color: WHITE, letterSpacing: 2, marginBottom: 6 },
  startSub: { fontSize: 14, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  startTips: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 18, padding: 18, width: '100%', marginBottom: 24, gap: 12 },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tipEmoji: { fontSize: 18, width: 40 },
  tipText: { fontSize: 13, color: WHITE, fontWeight: '600', flex: 1 },
  highScoreBadge: { backgroundColor: YELLOW, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 8, marginBottom: 22 },
  highScoreLabel: { fontSize: 15, fontWeight: '900', color: TEXT },
  startBtn: { backgroundColor: YELLOW, paddingHorizontal: 52, paddingVertical: 18, borderRadius: 18, shadowColor: YELLOW, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8 },
  startBtnText: { fontSize: 20, fontWeight: '900', color: TEXT, letterSpacing: 2 },

  // Game over
  gameOverCard: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  gameOverEmoji: { fontSize: 60, marginBottom: 8 },
  gameOverTitle: { fontSize: 34, fontWeight: '900', color: WHITE, letterSpacing: 4, marginBottom: 16 },
  rankBadge: { backgroundColor: PURPLE + '30', borderWidth: 1, borderColor: PURPLE, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 6, marginBottom: 12 },
  rankBadgeText: { fontSize: 13, fontWeight: '900', color: WHITE, letterSpacing: 1 },
  scoreBox: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20, paddingHorizontal: 40, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
  gameOverScore: { fontSize: 76, fontWeight: '900', color: YELLOW, lineHeight: 80 },
  gameOverScoreLabel: { fontSize: 13, color: 'rgba(255,255,255,0.6)', letterSpacing: 4 },
  newHighBadge: { backgroundColor: YELLOW, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 7, marginBottom: 8 },
  newHighText: { fontSize: 14, fontWeight: '900', color: TEXT },
  gameOverHigh: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 20 },
  collectedRow: { alignItems: 'center', marginBottom: 24, width: '100%' },
  collectedLabel: { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: 10, letterSpacing: 1 },
  collectedEmojis: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  collectedChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  collectedEmoji: { fontSize: 18 },
  collectedName: { fontSize: 11, fontWeight: '700' },
  restartBtn: { backgroundColor: YELLOW, paddingHorizontal: 40, paddingVertical: 16, borderRadius: 16, marginBottom: 12, width: '100%', alignItems: 'center', shadowColor: YELLOW, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
  restartBtnText: { fontSize: 18, fontWeight: '900', color: TEXT, letterSpacing: 1 },
  homeBtn: { paddingVertical: 12 },
  homeBtnText: { fontSize: 14, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  leaderboardWrap: { width: '100%', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 16, marginTop: 8 },
  leaderboardTitle: { fontSize: 14, fontWeight: '900', color: WHITE, marginBottom: 12, textAlign: 'center', letterSpacing: 1 },
  leaderboardRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  leaderboardRank: { fontSize: 18, width: 32 },
  leaderboardName: { flex: 1, fontSize: 13, fontWeight: '700', color: WHITE },
  leaderboardScore: { fontSize: 14, fontWeight: '900', color: YELLOW },

  // Question
  questionOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  questionCard: { backgroundColor: WHITE, borderRadius: 24, padding: 24, width: '100%', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 12 },
  questionIconWrap: { width: 72, height: 72, borderRadius: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  questionEmoji: { fontSize: 40 },
  questionBonusBadge: { backgroundColor: BLUE + '15', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 12 },
  questionBonusText: { fontSize: 12, fontWeight: '700', color: BLUE },
  questionText: { fontSize: 18, fontWeight: '800', color: TEXT, textAlign: 'center', marginBottom: 16, lineHeight: 26 },
  answerInput: { width: '100%', backgroundColor: BG, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: TEXT, marginBottom: 12, borderWidth: 2, borderColor: BLUE + '50' },
  questionBtns: { flexDirection: 'row', gap: 10, width: '100%', marginBottom: 10 },
  submitBtn: { flex: 1, backgroundColor: BLUE, borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  submitBtnText: { fontSize: 15, fontWeight: '800', color: WHITE },
  skipBtn: { backgroundColor: BG, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 20 },
  skipBtnText: { fontSize: 14, fontWeight: '600', color: MUTED },
  hintText: { fontSize: 12, color: MUTED, textAlign: 'center' },
  feedbackBox: { backgroundColor: GREEN + '15', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, marginVertical: 10, width: '100%', alignItems: 'center' },
  feedbackCorrect: { fontSize: 17, fontWeight: '900', color: GREEN },
  feedbackWrong: { fontSize: 15, fontWeight: '700', color: RED },
});

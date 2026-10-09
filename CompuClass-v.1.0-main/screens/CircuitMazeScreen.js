import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, Animated, ScrollView, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Line, Circle, Rect, Text as SvgText, G } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LEVELS_BY_TOPIC, LEVEL_THEMES, buildAdjacency, buildDistanceMap, stepBackFrom } from '../data/circuitMazeLayout';
import { getQuestionForLevel, TOPICS } from '../data/circuitMazeQuestions';
import { circuitMazeService } from '../services/circuitMazeService';
import { circuitMazeProgress } from '../services/circuitMazeProgress';
import StageTransition from '../components/StageTransition';
import ReviewScreen from '../components/ReviewScreen';
import MiniMap from '../components/MiniMap';

const { width: SW } = Dimensions.get('window');
const COLS = 11;
const ROWS = 18;
// Capped so the board stays phone-sized on tablets and desktop browsers
// (unchanged on phones, which are narrower than the cap).
const BOARD_MAX_SCREEN_W = 480;
const CELL = Math.floor((Math.min(SW, BOARD_MAX_SCREEN_W) - 24) / COLS);
const BOARD_W = CELL * COLS;
const BOARD_H = CELL * ROWS;
const FINISH_BONUS = 100;
const LEVEL_XP_BOOST = 0.10;
const MAX_HEARTS = 5;
const STREAK_FOR_SHIELD = 3;

// ── Sub-components ────────────────────────────────────────────────────────────

function RobotSprite({ size = 28, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28">
      <Rect x={8}  y={13} width={12} height={10} rx={2} fill={color} />
      <Rect x={9}  y={5}  width={10} height={8}  rx={2} fill={color} />
      <Rect x={13} y={2}  width={2}  height={4}  fill={color} />
      <Circle cx={14} cy={2} r={2} fill="#FFD700" />
      <Rect x={11} y={7}  width={2} height={2} fill="#0A0E1A" />
      <Rect x={15} y={7}  width={2} height={2} fill="#0A0E1A" />
      <Rect x={11} y={11} width={6} height={1} fill="#0A0E1A" />
      <Rect x={9}  y={23} width={3} height={4} rx={1} fill={color} />
      <Rect x={16} y={23} width={3} height={4} rx={1} fill={color} />
      <Rect x={4}  y={14} width={4} height={2} rx={1} fill={color} />
      <Rect x={20} y={14} width={4} height={2} rx={1} fill={color} />
      <Circle cx={14} cy={18} r={2} fill="#FFD700" opacity={0.9} />
    </Svg>
  );
}

function DiceFace({ value, size = 52, rolling, traceColor }) {
  const dots = {
    1:[[0.5,0.5]],
    2:[[0.25,0.25],[0.75,0.75]],
    3:[[0.25,0.25],[0.5,0.5],[0.75,0.75]],
    4:[[0.25,0.25],[0.75,0.25],[0.25,0.75],[0.75,0.75]],
    5:[[0.25,0.25],[0.75,0.25],[0.5,0.5],[0.25,0.75],[0.75,0.75]],
    6:[[0.25,0.2],[0.75,0.2],[0.25,0.5],[0.75,0.5],[0.25,0.8],[0.75,0.8]],
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56">
      <Rect x={2} y={2} width={52} height={52} rx={10} fill="#0F1E30" stroke={traceColor} strokeWidth={2} />
      {(dots[value]||dots[1]).map(([cx,cy],i)=>(
        <Circle key={i} cx={cx*56} cy={cy*56} r={4} fill={rolling?traceColor:'#FFFFFF'} />
      ))}
    </Svg>
  );
}

function DiffBadge({ diff }) {
  const color = diff==='easy'?'#00FF9C':diff==='medium'?'#FACC15':'#FF4757';
  return (
    <View style={[st.diffBadge,{borderColor:color}]}>
      <Text style={[st.diffText,{color}]}>{diff.toUpperCase()}</Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function CircuitMazeScreen({ navigation, route }) {
  const roomId    = route?.params?.roomId || null;
  const isMulti   = route?.params?.multiplayer === true;
  const topic     = route?.params?.topic || 'networking';
  const topicMeta = TOPICS.find(t => t.id === topic) || TOPICS[0];

  // core game state
  const [levelIdx,       setLevelIdx]       = useState(0);
  const [playerPos,      setPlayerPos]      = useState(0);
  const [moveStartPos,   setMoveStartPos]   = useState(0);
  const [hearts,         setHearts]         = useState(MAX_HEARTS);
  const [totalXp,        setTotalXp]        = useState(0);
  const [diceValue,      setDiceValue]      = useState(1);
  const [movesLeft,      setMovesLeft]      = useState(0);
  const [phase,          setPhase]          = useState('roll');
  const [question,       setQuestion]       = useState(null);
  const [usedQIds,       setUsedQIds]       = useState([]);
  const [selectedOpt,    setSelectedOpt]    = useState(null);
  const [answerResult,   setAnswerResult]   = useState(null);
  const [rolling,        setRolling]        = useState(false);
  const [validMoves,     setValidMoves]     = useState([]);
  const [gameLog,        setGameLog]        = useState([]);
  const [showTransition, setShowTransition] = useState(false);
  const [nextLevelIdx,   setNextLevelIdx]   = useState(null);
  const [xpResult,       setXpResult]       = useState(null);
  const [levelsCleared,  setLevelsCleared]  = useState(0);
  const [showDiceNum,    setShowDiceNum]    = useState(false);
  const [pendingLock,    setPendingLock]    = useState(null);
  const [unlockedNodes,  setUnlockedNodes]  = useState([]);

  // spec 1 — review
  const [missedQuestions, setMissedQuestions] = useState([]);
  const [showReview,      setShowReview]      = useState(false);

  // spec 2 — streak / shield / double-or-nothing
  const [streak,          setStreak]          = useState(0);
  const [hasShield,       setHasShield]       = useState(false);
  const [doubleOrNothing, setDoubleOrNothing] = useState(false);

  // spec 3 — adaptive difficulty
  const [perfMap, setPerfMap] = useState(null);

  // spec 4 — multiplayer mini-map
  const [otherPlayers, setOtherPlayers] = useState([]);

  const diceAnim       = useRef(new Animated.Value(1)).current;
  const diceNumScale   = useRef(new Animated.Value(0)).current;
  const diceNumOpacity = useRef(new Animated.Value(0)).current;
  const rollInterval   = useRef(null);
  const channelRef     = useRef(null);

  const theme       = LEVEL_THEMES[levelIdx];
  const topicLevels = LEVELS_BY_TOPIC[topic] || LEVELS_BY_TOPIC.networking;
  const level       = topicLevels[levelIdx];
  const ADJACENCY   = useMemo(() => buildAdjacency(level.edges, level.nodes), [level]);
  const DIST        = useMemo(() => buildDistanceMap(level.edges, level.nodes), [level]);
  const currentNode = level.nodes.find(n => n.id === playerPos);

  // One step towards the start, measured by BFS distance. Node ids are not
  // ordered along the path once a layout branches, so comparing ids sends the
  // player sideways across the board instead of backwards.
  const stepBack = useCallback(
    (fromId) => stepBackFrom(ADJACENCY, DIST, fromId),
    [ADJACENCY, DIST],
  );

  const nodePos = useCallback((node) => ({
    x: node.col * CELL + CELL / 2,
    y: node.row * CELL + CELL / 2,
  }), []);

  // fetch adaptive perf map once on mount
  useEffect(() => {
    circuitMazeService.getTopicPerformance().then(setPerfMap);
  }, []);

  // multiplayer subscription
  useEffect(() => {
    if (!isMulti || !roomId) return;
    circuitMazeService.getRoomPlayers(roomId).then(players => {
      setOtherPlayers(players.filter(p => p.user_id !== route?.params?.myId));
    });
    channelRef.current = circuitMazeService.subscribeToRoom(
      roomId,
      async () => {
        const players = await circuitMazeService.getRoomPlayers(roomId);
        setOtherPlayers(players.filter(p => p.user_id !== route?.params?.myId));
      },
      () => {}
    );
    return () => {
      clearInterval(rollInterval.current);
      circuitMazeService.unsubscribe(channelRef.current);
    };
  }, [roomId, isMulti]);

  useEffect(() => {
    return () => clearInterval(rollInterval.current);
  }, []);

  const addLog = (msg) => setGameLog(prev => [msg, ...prev].slice(0, 5));
  const applyBoost = (base) => Math.round(base * (1 + levelsCleared * LEVEL_XP_BOOST));

  // ── Dice roll ───────────────────────────────────────────────────────────────
  const rollDice = () => {
    if (phase !== 'roll') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRolling(true);
    let ticks = 0;
    rollInterval.current = setInterval(() => {
      setDiceValue(Math.ceil(Math.random() * 6));
      ticks++;
      if (ticks >= 10) {
        clearInterval(rollInterval.current);
        const final = Math.ceil(Math.random() * 6);
        setDiceValue(final);
        setRolling(false);
        diceNumScale.setValue(0);
        diceNumOpacity.setValue(0);
        setShowDiceNum(true);
        Animated.sequence([
          Animated.parallel([
            Animated.spring(diceNumScale,   { toValue: 1, useNativeDriver: true, friction: 4 }),
            Animated.timing(diceNumOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
          ]),
          Animated.delay(700),
          Animated.timing(diceNumOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start(() => {
          setShowDiceNum(false);
          const q = getQuestionForLevel(topic, levelIdx + 1, usedQIds, perfMap);
          setQuestion(q);
          setMovesLeft(final);
          setMoveStartPos(playerPos);
          setSelectedOpt(null);
          setAnswerResult(null);
          setDoubleOrNothing(false);
          setPhase('question');
        });
        Animated.sequence([
          Animated.timing(diceAnim, { toValue: 1.3, duration: 100, useNativeDriver: true }),
          Animated.spring(diceAnim, { toValue: 1, useNativeDriver: true }),
        ]).start();
        addLog(`🎲 Rolled ${final}`);
      }
    }, 80);
  };

  // ── Answer handler (covers normal + double-or-nothing + shield) ─────────────
  const handleAnswer = (idx) => {
    if (selectedOpt !== null) return;
    setSelectedOpt(idx);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const isCorrect = idx === question.answer;
    const isDon     = doubleOrNothing;

    // record for adaptive difficulty
    circuitMazeService.recordAnswerResult(topic, question.difficulty, isCorrect);

    if (isCorrect) {
      const base   = applyBoost(question.xp);
      const earned = isDon ? base * 2 : base;
      setAnswerResult('correct');
      setTotalXp(prev => prev + earned);
      addLog(`✅ +${earned} XP${isDon ? ' 🔥×2' : ''}`);
      setUsedQIds(prev => [...prev, question.id]);
      circuitMazeService.awardXp(earned);

      // streak logic
      setStreak(prev => {
        const next = prev + 1;
        if (next >= STREAK_FOR_SHIELD && !hasShield) {
          setHasShield(true);
          addLog('🛡️ SHIELD earned!');
          return 0;
        }
        return next;
      });

      setTimeout(() => {
        setQuestion(null);
        if (pendingLock !== null) {
          const gate = pendingLock;
          setUnlockedNodes(prev => [...prev, gate]);
          setPendingLock(null);
          addLog('🔓 Gate unlocked!');
          landOn(gate);
        } else {
          setPhase('move');
          setValidMoves(ADJACENCY[playerPos] || []);
        }
      }, 1600);
    } else {
      setAnswerResult('wrong');
      setStreak(0);

      // push to missed list
      setMissedQuestions(prev => [...prev, {
        question:     question.question,
        options:      question.options,
        answer:       question.answer,
        chosenAnswer: idx,
        explanation:  question.explanation,
        difficulty:   question.difficulty,
      }]);

      const heartLoss = isDon ? 2 : 1;
      if (hasShield && !isDon) {
        setHasShield(false);
        addLog('🛡️ Shield absorbed the hit!');
      } else {
        const newHearts = Math.max(0, hearts - heartLoss);
        setHearts(newHearts);
        addLog(`❌ Wrong! -${heartLoss} ❤️`);
        setTimeout(() => {
          const back = stepBack(playerPos);
          if (back !== null) setPlayerPos(back);
          setPendingLock(null);
          if (newHearts <= 0) {
            setPhase('gameover');
          } else {
            setPhase('roll');
          }
          setQuestion(null);
        }, 1600);
        return;
      }

      setTimeout(() => {
        const back = stepBack(playerPos);
        if (back !== null) setPlayerPos(back);
        setPendingLock(null);
        setPhase('roll');
        setQuestion(null);
      }, 1600);
    }
  };

  // ── Landing on a node (shared by a normal move and by opening a gate) ───────
  const landOn = (nodeId) => {
    const target = level.nodes.find(n => n.id === nodeId);

    setPlayerPos(nodeId);
    const remaining = movesLeft - 1;
    setMovesLeft(remaining);

    // push position to multiplayer
    if (isMulti && roomId) {
      circuitMazeService.pushPlayerState(roomId, route?.params?.myId, {
        position: nodeId, hearts, xp: totalXp, finished: false,
      });
    }

    if (target?.type === 'drop') {
      const penalty = target.penalty || 3;
      addLog(`⚠️ DROP ZONE! -${penalty} steps back!`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      let pos = nodeId;
      for (let i = 0; i < penalty; i++) {
        const back = stepBack(pos);
        if (back === null) break;
        pos = back;
      }
      setTimeout(() => setPlayerPos(pos), 400);
      setPhase('roll');
      setValidMoves([]);
      return;
    }

    if (target?.type === 'finish') {
      const bonus = applyBoost(FINISH_BONUS);
      setTotalXp(prev => prev + bonus);
      addLog(`🏆 Level ${levelIdx + 1} done! +${bonus} XP`);
      circuitMazeService.awardXp(bonus);
      // Persist the cleared level so the topic screen can show real progress.
      // Fire-and-forget: the store swallows its own errors.
      circuitMazeProgress.recordLevelCleared(topic, levelIdx + 1);
      if (levelIdx < 9) {
        setNextLevelIdx(levelIdx + 1);
        setShowTransition(true);
      } else {
        setPhase('win');
      }
      return;
    }

    if (remaining <= 0) {
      setPhase('roll');
      setValidMoves([]);
    } else {
      // Unlocking a gate lands the player while the phase is still
      // 'question', so it has to be reset here or the answered question
      // modal stays up and blocks the board.
      setPhase('move');
      setValidMoves(ADJACENCY[nodeId] || []);
    }
  };

  // ── Node press ──────────────────────────────────────────────────────────────
  const handleNodePress = (nodeId) => {
    if (phase !== 'move') return;
    if (!validMoves.includes(nodeId)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const target = level.nodes.find(n => n.id === nodeId);

    // A lock is a gate, not a wall: answer to open it, then step through.
    // Once opened it stays open for the rest of the level.
    if (target?.type === 'lock' && !unlockedNodes.includes(nodeId)) {
      setPendingLock(nodeId);
      const q = getQuestionForLevel(topic, levelIdx + 1, usedQIds, perfMap);
      setQuestion(q);
      setSelectedOpt(null);
      setAnswerResult(null);
      setDoubleOrNothing(false);
      setPhase('question');
      return;
    }

    landOn(nodeId);
  };

  // ── Level transition ────────────────────────────────────────────────────────
  const onTransitionDone = () => {
    setShowTransition(false);
    setLevelsCleared(prev => prev + 1);
    setLevelIdx(nextLevelIdx);
    setPlayerPos(0);
    setMoveStartPos(0);
    setValidMoves([]);
    setPhase('roll');
    setMovesLeft(0);
    setPendingLock(null);
    setUnlockedNodes([]);
  };

  // ── Restart ─────────────────────────────────────────────────────────────────
  const restartGame = () => {
    setLevelIdx(0); setPlayerPos(0); setMoveStartPos(0);
    setHearts(MAX_HEARTS); setTotalXp(0); setDiceValue(1);
    setMovesLeft(0); setPhase('roll'); setQuestion(null);
    setUsedQIds([]); setSelectedOpt(null); setAnswerResult(null);
    setValidMoves([]); setGameLog([]); setLevelsCleared(0);
    setXpResult(null); setPendingLock(null); setUnlockedNodes([]);
    setStreak(0); setHasShield(false); setDoubleOrNothing(false);
    setMissedQuestions([]); setShowReview(false);
  };

  // ── Render: board ───────────────────────────────────────────────────────────
  const renderBoard = () => (
    <View style={{ width: BOARD_W, height: BOARD_H }}>
      <Svg width={BOARD_W} height={BOARD_H} style={StyleSheet.absoluteFill}>
        {Array.from({ length: COLS }).map((_, c) =>
          Array.from({ length: ROWS }).map((_, r) => (
            <Circle key={`${c}-${r}`} cx={c*CELL+CELL/2} cy={r*CELL+CELL/2} r={1.5} fill={theme.traceDim} opacity={0.35} />
          ))
        )}
        {level.edges.map(([a, b], i) => {
          const na = level.nodes.find(n => n.id === a);
          const nb = level.nodes.find(n => n.id === b);
          if (!na || !nb) return null;
          const pa = nodePos(na), pb = nodePos(nb);
          const active = a === playerPos || b === playerPos;
          return <Line key={i} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke={active?theme.trace:theme.traceDim} strokeWidth={active?3:1.5} strokeDasharray={active?undefined:'5 3'} />;
        })}
        {level.nodes.map(node => {
          const p        = nodePos(node);
          const isValid  = validMoves.includes(node.id);
          const isStart  = node.type === 'start';
          const isFinish = node.type === 'finish';
          const isDrop   = node.type === 'drop';
          const isLock   = node.type === 'lock' && !unlockedNodes.includes(node.id);
          const isMoveStart = node.id === moveStartPos && phase === 'move';
          const r    = isStart||isFinish ? 13 : isValid ? 11 : 9;
          const fill = isStart ? theme.trace : isFinish ? theme.finish : isDrop ? theme.drop : isLock ? theme.lock : isMoveStart ? '#FFFFFF' : isValid ? theme.trace : theme.node;
          const stroke = isValid ? theme.trace : isDrop ? theme.drop : isLock ? theme.lock : theme.nodeBorder;
          return (
            <G key={node.id}>
              <Circle cx={p.x} cy={p.y} r={r} fill={fill} stroke={stroke} strokeWidth={2} opacity={isValid?1:0.8} />
              {isStart  && <SvgText x={p.x} y={p.y+4} textAnchor="middle" fontSize={8} fill="#0A0E1A" fontWeight="bold">S</SvgText>}
              {isFinish && <SvgText x={p.x} y={p.y+4} textAnchor="middle" fontSize={8} fill="#0A0E1A" fontWeight="bold">F</SvgText>}
              {isDrop   && <SvgText x={p.x} y={p.y+4} textAnchor="middle" fontSize={7} fill="#FFFFFF" fontWeight="bold">▼</SvgText>}
              {isLock   && <SvgText x={p.x} y={p.y+4} textAnchor="middle" fontSize={7} fill="#0A0E1A" fontWeight="bold">🔒</SvgText>}
              {isValid  && <Circle cx={p.x} cy={p.y} r={r+5} fill="transparent" stroke={theme.trace} strokeWidth={1} opacity={0.4} />}
            </G>
          );
        })}
        {currentNode && (() => {
          const p = nodePos(currentNode);
          return <G x={p.x-14} y={p.y-14}><RobotSprite size={28} color={theme.avatar} /></G>;
        })()}
      </Svg>
      {level.nodes.map(node => {
        const p = nodePos(node);
        const isValid = validMoves.includes(node.id);
        const HIT = 44;
        return (
          <TouchableOpacity key={`t-${node.id}`} onPress={() => handleNodePress(node.id)}
            style={[st.nodeTouchable, {
              left: p.x-HIT/2, top: p.y-HIT/2, width: HIT, height: HIT, borderRadius: HIT/2,
              backgroundColor: isValid && phase==='move' ? theme.trace+'30' : 'transparent',
            }]} activeOpacity={0.6} />
        );
      })}
    </View>
  );

  // ── Render: question modal ──────────────────────────────────────────────────
  const renderQuestion = () => {
    const isHard = question?.difficulty === 'hard';
    return (
      <Modal visible={phase==='question'} transparent animationType="slide">
        <View style={st.modalOverlay}>
          <View style={[st.questionCard, { borderTopColor: theme.trace }]}>
            <View style={st.qHeader}>
              <View style={st.qTitleRow}>
                <Text style={[st.qTitle, { color: theme.trace }]}>⚡ QUESTION</Text>
                <View style={[st.topicPill, { borderColor: topicMeta.color }]}>
                  <Text style={[st.topicPillText, { color: topicMeta.color }]}>{topicMeta.label}</Text>
                </View>
              </View>
              {question && <DiffBadge diff={question.difficulty} />}
            </View>

            <Text style={st.qText}>{question?.question}</Text>

            {/* Double-or-nothing opt-in — hard questions only, before answering */}
            {isHard && selectedOpt === null && (
              <TouchableOpacity
                style={[st.donBtn, doubleOrNothing ? st.donActive : null, { borderColor: theme.trace }]}
                onPress={() => setDoubleOrNothing(d => !d)}
                activeOpacity={0.8}
              >
                <Text style={[st.donText, { color: doubleOrNothing ? '#0A0E1A' : theme.trace }]}>
                  {doubleOrNothing ? '🔥 DOUBLE OR NOTHING ON' : '⚡ Risk it: 2× XP, -2 ❤️ if wrong'}
                </Text>
              </TouchableOpacity>
            )}

            <View style={st.optionsWrap}>
              {question?.options.map((opt, i) => {
                let bg = '#0F1E30', border = '#1A3A5C';
                if (selectedOpt !== null) {
                  if (i === question.answer)  { bg = '#0A3D1A'; border = '#00FF9C'; }
                  else if (i === selectedOpt) { bg = '#3D0A0A'; border = '#FF4757'; }
                }
                return (
                  <TouchableOpacity key={i} style={[st.optBtn, { backgroundColor: bg, borderColor: border }]}
                    onPress={() => handleAnswer(i)} activeOpacity={0.8}>
                    <Text style={st.optLetter}>{['A','B','C','D'][i]}</Text>
                    <Text style={st.optText}>{opt}</Text>
                    {selectedOpt!==null && i===question.answer && <Ionicons name="checkmark-circle" size={18} color="#00FF9C" />}
                    {selectedOpt===i && i!==question.answer    && <Ionicons name="close-circle"     size={18} color="#FF4757" />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Result banner */}
            {answerResult==='correct' && (
              <Text style={[st.resultText,{color:'#00FF9C'}]}>
                ✅ Correct!{doubleOrNothing?' 🔥 Double XP!':''} Move {movesLeft} steps!
              </Text>
            )}
            {answerResult==='wrong' && (
              <Text style={[st.resultText,{color:'#FF4757'}]}>
                ❌ Wrong!{doubleOrNothing?' -2 ❤️':' -1 ❤️'}{hasShield&&!doubleOrNothing?' 🛡️ Shielded!':''} Moving back...
              </Text>
            )}

            {/* Explanation card — shown after answering */}
            {selectedOpt !== null && question?.explanation && (
              <View style={st.explanationCard}>
                <Text style={st.explanationText}>💡 {question.explanation}</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    );
  };

  // ── Render: end modal ───────────────────────────────────────────────────────
  const renderEndModal = () => (
    <Modal visible={(phase==='win'||phase==='gameover') && !showReview} transparent animationType="fade">
      <View style={st.modalOverlay}>
        <LinearGradient colors={phase==='win'?['#0A3D1A','#0D1B2A']:['#3D0A0A','#0D1B2A']} style={st.endCard}>
          <Text style={st.endEmoji}>{phase==='win'?'🏆':'💀'}</Text>
          <Text style={st.endTitle}>{phase==='win'?'ALL LEVELS CLEAR!':'GAME OVER'}</Text>
          <Text style={st.endXp}>Total XP: {totalXp}</Text>
          {xpResult?.leveled_up && <Text style={st.levelUpText}>🎉 LEVEL UP → Level {xpResult.new_level}!</Text>}
          {missedQuestions.length > 0 && (
            <TouchableOpacity style={[st.reviewBtn, { borderColor: theme.trace }]} onPress={() => setShowReview(true)}>
              <Text style={[st.reviewBtnText, { color: theme.trace }]}>📋 Review {missedQuestions.length} missed</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[st.restartBtn,{backgroundColor:theme.trace}]} onPress={restartGame}>
            <Text style={[st.restartText,{color:'#0A0E1A'}]}>▶ PLAY AGAIN</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.exitBtn} onPress={() => navigation.goBack()}>
            <Text style={st.exitText}>← EXIT</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </Modal>
  );

  // ── Render: HUD ─────────────────────────────────────────────────────────────
  const renderHUD = () => (
    <View style={st.hud}>
      <View style={st.hudLeft}>
        {Array.from({length:MAX_HEARTS}).map((_,i)=>(
          <Text key={i} style={{fontSize:15,opacity:i<hearts?1:0.2}}>❤️</Text>
        ))}
      </View>
      {/* Streak indicator */}
      {streak > 0 && (
        <View style={[st.badge,{borderColor:'#FF9F00'}]}>
          <Text style={[st.badgeText,{color:'#FF9F00'}]}>🔥{streak}</Text>
        </View>
      )}
      {/* Shield indicator */}
      {hasShield && (
        <View style={[st.badge,{borderColor:'#00BFFF'}]}>
          <Text style={[st.badgeText,{color:'#00BFFF'}]}>🛡️</Text>
        </View>
      )}
      <View style={[st.badge,{borderColor:theme.trace}]}>
        <Text style={[st.badgeText,{color:theme.trace}]}>⚡{totalXp} XP</Text>
      </View>
      <View style={[st.badge,{borderColor:topicMeta.color}]}>
        <Text style={[st.badgeText,{color:topicMeta.color}]}>Lv {levelIdx+1}/10</Text>
      </View>
      {phase==='move' && (
        <View style={[st.badge,{borderColor:theme.trace}]}>
          <Text style={[st.badgeText,{color:theme.trace}]}>👟{movesLeft}</Text>
        </View>
      )}
    </View>
  );

  // ── Render: bottom panel ────────────────────────────────────────────────────
  const renderBottom = () => (
    <View style={st.bottomPanel}>
      <Animated.View style={{transform:[{scale:diceAnim}]}}>
        <TouchableOpacity onPress={rollDice} disabled={phase!=='roll'} activeOpacity={0.8}>
          <DiceFace value={diceValue} rolling={rolling} traceColor={theme.trace} />
          {phase==='roll' && <Text style={[st.rollHint,{color:theme.trace}]}>TAP TO ROLL</Text>}
        </TouchableOpacity>
      </Animated.View>
      <View style={st.logWrap}>
        {gameLog.map((l,i)=>(
          <Text key={i} style={[st.logLine,{opacity:1-i*0.18}]}>{l}</Text>
        ))}
      </View>
      <View style={st.phaseHint}>
        <Text style={st.phaseText}>
          {phase==='roll'?'🎲 Roll':phase==='move'?`👆 Move (${movesLeft})`:phase==='question'?'❓ Answer':phase==='win'?'🏆 Won!':'💀 Over'}
        </Text>
      </View>
    </View>
  );

  // ── Root render ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[st.safe,{backgroundColor:theme.bg[0]}]}>
      <LinearGradient colors={theme.bg} style={st.container}>
        <View style={st.header}>
          <TouchableOpacity onPress={()=>navigation.goBack()} style={st.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#E0F7FF" />
          </TouchableOpacity>
          <View style={st.headerCenter}>
            <Text style={[st.headerTitle,{color:theme.trace}]}>⚡ {topicMeta.label.toUpperCase()}</Text>
            <Text style={[st.headerSub,{color:theme.nodeBorder}]}>{theme.label}</Text>
          </View>
          <TouchableOpacity onPress={restartGame} style={st.backBtn}>
            <Ionicons name="refresh" size={20} color="#4A7A9B" />
          </TouchableOpacity>
        </View>

        {renderHUD()}

        <ScrollView style={st.boardScroll} contentContainerStyle={st.boardContent} showsVerticalScrollIndicator={false}>
          <View style={[st.boardWrap,{width:BOARD_W,height:BOARD_H,backgroundColor:theme.board}]}>
            {renderBoard()}
          </View>
        </ScrollView>

        {renderBottom()}
        {renderQuestion()}
        {renderEndModal()}

        {/* Dice number overlay */}
        {showDiceNum && (
          <Animated.View style={[st.diceNumOverlay,{opacity:diceNumOpacity,transform:[{scale:diceNumScale}]}]}>
            <Text style={[st.diceNumText,{color:theme.trace}]}>{diceValue}</Text>
          </Animated.View>
        )}

        {showTransition && nextLevelIdx !== null && (
          <StageTransition
            stage={nextLevelIdx + 1}
            theme={LEVEL_THEMES[nextLevelIdx]}
            onDone={onTransitionDone}
          />
        )}

        {/* Review screen overlay */}
        {showReview && (
          <ReviewScreen
            missedQuestions={missedQuestions}
            onDone={() => setShowReview(false)}
            traceColor={theme.trace}
          />
        )}

        {/* Multiplayer mini-map */}
        {isMulti && (
          <MiniMap
            nodes={level.nodes}
            edges={level.edges}
            players={otherPlayers.map(p => ({ id: p.user_id, nodeId: p.position ?? 0, color: '#00BFFF' }))}
            currentPlayerNodeId={playerPos}
            myColor={theme.avatar}
            traceColor={theme.trace}
          />
        )}
      </LinearGradient>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  safe:             { flex: 1 },
  container:        { flex: 1 },
  header:           { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:14, paddingTop:8, paddingBottom:6 },
  backBtn:          { width:36, height:36, borderRadius:10, backgroundColor:'#0F1E30', alignItems:'center', justifyContent:'center' },
  headerCenter:     { alignItems:'center' },
  headerTitle:      { fontSize:14, fontWeight:'900', letterSpacing:2 },
  headerSub:        { fontSize:9, fontWeight:'700', letterSpacing:1, marginTop:1 },
  hud:              { flexDirection:'row', alignItems:'center', paddingHorizontal:14, paddingBottom:6, gap:6, flexWrap:'wrap' },
  hudLeft:          { flexDirection:'row', gap:1 },
  badge:            { borderRadius:10, paddingHorizontal:8, paddingVertical:3, borderWidth:1, backgroundColor:'#0F1E30' },
  badgeText:        { fontSize:10, fontWeight:'900' },
  boardScroll:      { flex:1 },
  boardContent:     { alignItems:'center', paddingVertical:6 },
  boardWrap:        { borderRadius:12, overflow:'hidden', borderWidth:1, borderColor:'#1A3A5C' },
  nodeTouchable:    { position:'absolute' },
  bottomPanel:      { backgroundColor:'#0F1E30', borderTopWidth:1, borderTopColor:'#1A3A5C', paddingHorizontal:14, paddingVertical:10, flexDirection:'row', alignItems:'center', gap:10 },
  rollHint:         { fontSize:8, textAlign:'center', marginTop:2, letterSpacing:1 },
  logWrap:          { flex:1 },
  logLine:          { fontSize:10, color:'#E0F7FF', marginBottom:1 },
  phaseHint:        { alignItems:'flex-end' },
  phaseText:        { fontSize:10, color:'#4A7A9B', textAlign:'right', maxWidth:72 },
  diceNumOverlay:   { position:'absolute', top:0, left:0, right:0, bottom:0, alignItems:'center', justifyContent:'center', pointerEvents:'none' },
  diceNumText:      { fontSize:120, fontWeight:'900', textShadowColor:'rgba(0,0,0,0.8)', textShadowOffset:{width:0,height:4}, textShadowRadius:12 },
  modalOverlay:     { flex:1, backgroundColor:'rgba(0,0,0,0.88)', justifyContent:'flex-end' },
  questionCard:     { backgroundColor:'#0F1E30', borderTopLeftRadius:24, borderTopRightRadius:24, padding:20, borderTopWidth:2 },
  qHeader:          { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:12 },
  qTitleRow:        { flexDirection:'row', alignItems:'center', gap:8 },
  qTitle:           { fontSize:12, fontWeight:'900', letterSpacing:2 },
  topicPill:        { borderWidth:1, borderRadius:6, paddingHorizontal:7, paddingVertical:2 },
  topicPillText:    { fontSize:9, fontWeight:'900' },
  diffBadge:        { borderWidth:1, borderRadius:6, paddingHorizontal:8, paddingVertical:2 },
  diffText:         { fontSize:9, fontWeight:'900', letterSpacing:1 },
  qText:            { fontSize:14, fontWeight:'700', color:'#E0F7FF', marginBottom:14, lineHeight:21 },
  donBtn:           { borderWidth:1, borderRadius:10, paddingHorizontal:12, paddingVertical:8, marginBottom:10, alignItems:'center' },
  donActive:        { backgroundColor:'#FF9F00' },
  donText:          { fontSize:11, fontWeight:'900' },
  optionsWrap:      { gap:8 },
  optBtn:           { flexDirection:'row', alignItems:'center', gap:10, padding:11, borderRadius:10, borderWidth:1 },
  optLetter:        { width:22, height:22, borderRadius:6, backgroundColor:'#1A3A5C', textAlign:'center', lineHeight:22, fontSize:11, fontWeight:'900', color:'#E0F7FF' },
  optText:          { flex:1, fontSize:12, color:'#E0F7FF' },
  resultText:       { marginTop:12, fontSize:12, fontWeight:'700', textAlign:'center' },
  explanationCard:  { marginTop:10, backgroundColor:'#1A2A3A', borderRadius:10, padding:12 },
  explanationText:  { fontSize:11, color:'#A0C4D8', lineHeight:17 },
  endCard:          { margin:28, borderRadius:24, padding:30, alignItems:'center', borderWidth:1, borderColor:'#1A3A5C' },
  endEmoji:         { fontSize:52, marginBottom:8 },
  endTitle:         { fontSize:20, fontWeight:'900', color:'#E0F7FF', letterSpacing:2, marginBottom:6 },
  endXp:            { fontSize:17, fontWeight:'900', color:'#FACC15', marginBottom:4 },
  levelUpText:      { fontSize:12, fontWeight:'900', color:'#FACC15', marginBottom:16, textAlign:'center' },
  reviewBtn:        { borderWidth:1, borderRadius:10, paddingHorizontal:20, paddingVertical:10, marginBottom:10, marginTop:6 },
  reviewBtnText:    { fontSize:12, fontWeight:'900' },
  restartBtn:       { paddingHorizontal:30, paddingVertical:13, borderRadius:12, marginBottom:10, marginTop:4 },
  restartText:      { fontSize:14, fontWeight:'900', letterSpacing:2 },
  exitBtn:          { paddingVertical:8 },
  exitText:         { fontSize:12, color:'#4A7A9B' },
});

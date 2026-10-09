import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, Image, ScrollView, StyleSheet, Animated, PanResponder, TouchableOpacity,
  Vibration, Platform, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

const GREEN = '#22C55E'; const WHITE = '#FFFFFF'; const BG = '#E9EEF4';
const TEXT = '#111827'; const MUTED = '#4B5563'; const BORDER = '#D6DEE8';
const RED = '#EF4444';

const CASE_IMG = require('../assets/pc-assembly/case-open.png');
const CASE_RATIO = 712 / 548; // width / height of case-open.png

// Local to this screen on purpose — PCLabScreen.js's own component cards
// (which open the AR viewers) are a separate feature and are not touched.
//
// `slot` is where the part sits inside the open case, as fractions of the
// case picture (0..1). The CPU and RAM slots line up with the socket and
// DIMM slots on the motherboard picture once it's installed.
const PARTS = [
  { id: 'motherboard', name: 'Motherboard', img: require('../assets/pc-assembly/motherboard.png'),
    slot: { left: 0.14, top: 0.13, width: 0.46, height: 0.51 },
    tip: 'Screw the motherboard onto the standoffs on the back plate of the case.' },
  { id: 'cpu', name: 'CPU', img: require('../assets/pc-assembly/cpu.png'),
    slot: { left: 0.3285, top: 0.25, width: 0.085, height: 0.11 },
    tip: 'Line up the golden triangle and drop the CPU into the socket — no force needed.' },
  { id: 'ram', name: 'RAM', img: require('../assets/pc-assembly/ram.png'), rotate: true,
    slot: { left: 0.466, top: 0.158, width: 0.068, height: 0.30 },
    tip: 'Push the RAM sticks into the DIMM slots beside the CPU until the clips click.' },
  { id: 'gpu', name: 'Graphics Card', img: require('../assets/pc-assembly/gpu.png'),
    slot: { left: 0.05, top: 0.44, width: 0.42, height: 0.24 },
    tip: 'Seat the graphics card in the long PCIe x16 slot and screw it to the rear bracket.' },
  { id: 'storage', name: 'SSD', img: require('../assets/pc-assembly/ssd.png'),
    slot: { left: 0.675, top: 0.30, width: 0.12, height: 0.14 },
    tip: 'Mount the SSD in the drive bay behind the motherboard tray.' },
  { id: 'psu', name: 'Power Supply', img: require('../assets/pc-assembly/psu.png'),
    slot: { left: 0.07, top: 0.72, width: 0.30, height: 0.19 },
    tip: 'Slide the power supply into the bottom shroud, fan facing down.' },
];

const ORDER = PARTS.map(p => p.id);
const PART_BY_ID = Object.fromEntries(PARTS.map(p => [p.id, p]));
const HIT_PAD = 14; // px of forgiveness around small slots like the CPU
// On touch screens the dragged part floats a little above the finger so it
// isn't hidden under it; the drop is judged where the part is, not the finger.
const LIFT = Platform.OS === 'web' ? 0 : 28;

function slotRect(part, caseW, caseH) {
  const s = part.slot;
  return { x: s.left * caseW, y: s.top * caseH, width: s.width * caseW, height: s.height * caseH };
}

// How big the part is while being dragged: its real size in the case, blown
// up just enough that tiny parts (CPU, RAM) are still visible under a finger.
function dragSize(part, caseW, caseH) {
  const r = caseW ? slotRect(part, caseW, caseH) : { width: 100, height: 80 };
  const k = Math.max(1, Math.min(56 / Math.min(r.width, r.height), 160 / Math.max(r.width, r.height)));
  return { w: r.width * k, h: r.height * k, k };
}

// The part's picture, sized to its slot. RAM is drawn upright (rotated 90°)
// because the DIMM slots run vertically on the motherboard.
function PartPicture({ part, width, height, style }) {
  if (part.rotate) {
    return (
      <Image
        source={part.img}
        resizeMode="stretch"
        style={[{
          position: 'absolute', width: height, height: width,
          left: (width - height) / 2, top: (height - width) / 2,
          transform: [{ rotate: '90deg' }],
        }, style]}
      />
    );
  }
  return <Image source={part.img} resizeMode="contain" style={[{ width, height }, style]} />;
}

// ── One slot inside the case picture ────────────────────────────────────────
function CaseSlot({ part, state, caseW, caseH }) {
  // state: 'locked' | 'active' | 'filled'
  const seat = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (state === 'filled') {
      // A small "click into place" once the dragged part lands on the slot.
      seat.setValue(1.06);
      Animated.spring(seat, { toValue: 1, useNativeDriver: true, friction: 5, tension: 160 }).start();
    }
  }, [state, seat]);

  useEffect(() => {
    if (state !== 'active') return undefined;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [state, pulse]);

  if (state === 'locked' || !caseW) return null;
  const r = slotRect(part, caseW, caseH);
  const box = { position: 'absolute', left: r.x, top: r.y, width: r.width, height: r.height };

  if (state === 'filled') {
    return (
      <Animated.View pointerEvents="none" style={[box, { transform: [{ scale: seat }] }]}>
        <PartPicture part={part} width={r.width} height={r.height} />
      </Animated.View>
    );
  }

  // Active: a pulsing outline only — no ghost, the student has to work out
  // which component belongs there.
  const glow = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
  return <Animated.View pointerEvents="none" style={[box, styles.slotOutline, { opacity: glow }]} />;
}

// ── One card in the parts tray ──────────────────────────────────────────────
// The card itself never moves: grabbing it lifts a cut-out copy of the part
// (rendered by the screen) and leaves a faded placeholder behind.
function PartCard({ part, lifted, handlers }) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Don't let the ScrollView steal the drag halfway across the screen.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (_, g) => handlersRef.current.onStart(part.id, g.x0, g.y0),
      onPanResponderMove: (_, g) => handlersRef.current.onMove(g.x0 + g.dx, g.y0 + g.dy),
      onPanResponderRelease: (_, g) => handlersRef.current.onEnd(part.id, g.x0 + g.dx, g.y0 + g.dy),
      onPanResponderTerminate: () => handlersRef.current.onCancel(),
    })
  ).current;

  return (
    <View {...panResponder.panHandlers} style={styles.card}>
      <Image source={part.img} resizeMode="contain" style={[styles.cardImg, lifted && { opacity: 0.2 }]} />
      <View style={styles.cardLabel}>
        <Text style={styles.cardName} numberOfLines={1}>{part.name}</Text>
      </View>
    </View>
  );
}

export default function PCAssemblyScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 700;

  const [installed, setInstalled] = useState([]);
  const [mistakes, setMistakes] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [caseSize, setCaseSize] = useState({ w: 0, h: 0 });
  const [dragId, setDragId] = useState(null);
  const [feedback, setFeedback] = useState(null); // { kind: 'ok' | 'error', text }

  const containerRef = useRef(null);
  const caseRef = useRef(null);
  const containerOffset = useRef({ x: 0, y: 0 });
  const activeDrag = useRef(null); // part id while the finger is down
  const busy = useRef(false);      // true while a drop/return animation runs
  const dragStart = useRef({ x: 0, y: 0 });

  const dragPos = useRef(new Animated.ValueXY()).current;
  const dragScale = useRef(new Animated.Value(1)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const caseShake = useRef(new Animated.Value(0)).current;

  const expectedId = ORDER[installed.length];
  const expected = expectedId ? PART_BY_ID[expectedId] : null;
  const done = installed.length === ORDER.length;

  const zoneState = (id) => {
    if (installed.includes(id)) return 'filled';
    return expectedId === id ? 'active' : 'locked';
  };

  const measureContainer = () => {
    containerRef.current?.measureInWindow((x, y) => { containerOffset.current = { x, y }; });
  };

  // Window coords → position of the floating part's centre inside the screen.
  const toLocal = (x, y) => ({
    x: x - containerOffset.current.x,
    y: y - containerOffset.current.y - LIFT,
  });

  const endDrag = () => {
    busy.current = false;
    setDragId(null);
    dragScale.setValue(1);
  };

  const returnToTray = () => {
    Animated.parallel([
      Animated.spring(dragPos, { toValue: toLocal(dragStart.current.x, dragStart.current.y + LIFT), useNativeDriver: true, speed: 14, bounciness: 4 }),
      Animated.timing(dragScale, { toValue: 0.6, duration: 260, useNativeDriver: true }),
    ]).start(endDrag);
  };

  const signalIncorrect = (text) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    Vibration.vibrate(Platform.OS === 'android' ? [0, 90, 60, 160] : 400);
    setMistakes((m) => m + 1);
    setFeedback({ kind: 'error', text });

    flash.setValue(0);
    Animated.sequence([
      Animated.timing(flash, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.delay(650),
      Animated.timing(flash, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();
    caseShake.setValue(0);
    Animated.sequence([10, -10, 7, -7, 3, 0].map((v) =>
      Animated.timing(caseShake, { toValue: v, duration: 50, useNativeDriver: true }))).start();
  };

  const handlers = {
    onStart: (partId, x, y) => {
      if (busy.current || done) return;
      measureContainer();
      activeDrag.current = partId;
      dragStart.current = { x, y };
      dragPos.setValue(toLocal(x, y));
      dragScale.setValue(0.8);
      Animated.spring(dragScale, { toValue: 1.06, useNativeDriver: true, speed: 30 }).start();
      setDragId(partId);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    },
    onMove: (x, y) => {
      if (activeDrag.current) dragPos.setValue(toLocal(x, y));
    },
    onCancel: () => {
      if (!activeDrag.current) return;
      activeDrag.current = null;
      busy.current = true;
      returnToTray();
    },
    onEnd: (partId, x, y) => {
      if (activeDrag.current !== partId) return;
      activeDrag.current = null;
      busy.current = true;

      // Measure the case at drop time (not on layout) so scrolling can't
      // leave us with stale window coordinates.
      caseRef.current?.measureInWindow((cx, cy, cw, ch) => {
        const px = x - cx;
        const py = y - LIFT - cy;
        const overCase = px >= 0 && px <= cw && py >= 0 && py <= ch;
        if (!overCase) { returnToTray(); return; }

        const target = PART_BY_ID[expectedId];
        const r = slotRect(target, cw, ch);
        const onSlot = px >= r.x - HIT_PAD && px <= r.x + r.width + HIT_PAD &&
          py >= r.y - HIT_PAD && py <= r.y + r.height + HIT_PAD;

        if (partId === expectedId && onSlot) {
          // Glide into the slot and shrink back to its real size, then hand
          // over to the CaseSlot so the part stays put.
          const { k } = dragSize(target, cw, ch);
          const centre = {
            x: cx + r.x + r.width / 2 - containerOffset.current.x,
            y: cy + r.y + r.height / 2 - containerOffset.current.y,
          };
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          Animated.parallel([
            Animated.timing(dragPos, { toValue: centre, duration: 160, useNativeDriver: true }),
            Animated.timing(dragScale, { toValue: 1 / k, duration: 160, useNativeDriver: true }),
          ]).start(() => {
            setInstalled((prev) => [...prev, partId]);
            setShowHint(false);
            setFeedback({ kind: 'ok', text: `Correct! ${target.name} installed.` });
            endDrag();
          });
          return;
        }

        const name = PART_BY_ID[partId].name;
        signalIncorrect(partId !== expectedId
          ? `Incorrect — the ${name} doesn't go in next.`
          : `Incorrect — the ${name} goes in the glowing spot.`);
        const p = toLocal(x, y);
        Animated.sequence([
          ...[12, -12, 8, -8, 0].map((dx) =>
            Animated.timing(dragPos, { toValue: { x: p.x + dx, y: p.y }, duration: 45, useNativeDriver: true })),
        ]).start(returnToTray);
      });
    },
  };

  const reset = () => { setInstalled([]); setMistakes(0); setShowHint(false); setFeedback(null); };
  const remaining = PARTS.filter((p) => !installed.includes(p.id));

  const dragPart = dragId ? PART_BY_ID[dragId] : null;
  const dragBox = dragPart ? dragSize(dragPart, caseSize.w, caseSize.h) : null;

  return (
    <View
      ref={containerRef}
      onLayout={() => requestAnimationFrame(measureContainer)}
      style={styles.container}
    >
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={[styles.floatingBackBtn, { top: insets.top + 12 }]}
        activeOpacity={0.75}
      >
        <Ionicons name="arrow-back" size={22} color={WHITE} />
      </TouchableOpacity>

      <ScrollView
        scrollEnabled={!dragId}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
      >
        <View style={[styles.content, { maxWidth: 1100, width: '100%', alignSelf: 'center', marginTop: insets.top + 64 }]}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>PC Assembly Challenge 🛠️</Text>
              <Text style={styles.subtitle}>Pick the right component for each step and drag it into the case.</Text>
            </View>
            <View style={styles.progressPill}>
              <Text style={styles.progressText}>{installed.length}/{ORDER.length}</Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(installed.length / ORDER.length) * 100}%` }]} />
          </View>

          <View style={[styles.workArea, isWide && styles.workAreaWide]}>
            {/* The open case */}
            <View style={[styles.stage, isWide && styles.stageWide]}>
              <Animated.View
                ref={caseRef}
                onLayout={(e) => setCaseSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
                style={[styles.caseWrap, { aspectRatio: CASE_RATIO, transform: [{ translateX: caseShake }] }]}
              >
                <Image source={CASE_IMG} resizeMode="stretch" style={StyleSheet.absoluteFill} />
                {PARTS.map((part) => (
                  <CaseSlot key={part.id} part={part} state={zoneState(part.id)} caseW={caseSize.w} caseH={caseSize.h} />
                ))}

                {/* "Incorrect" flash */}
                <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.wrongOverlay, { opacity: flash }]}>
                  <View style={styles.wrongBadge}>
                    <Ionicons name="close-circle" size={20} color={WHITE} />
                    <Text style={styles.wrongText}>Incorrect</Text>
                  </View>
                </Animated.View>
              </Animated.View>

              {/* Instruction / feedback strip */}
              {done ? (
                <View style={[styles.infoBox, styles.infoDone]}>
                  <Ionicons name="trophy" size={22} color={GREEN} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoTitle}>Build complete! 🎉</Text>
                    <Text style={styles.infoText}>
                      {mistakes === 0 ? 'Perfect build — no mistakes!' : `Finished with ${mistakes} mistake${mistakes === 1 ? '' : 's'}.`}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.resetBtn} onPress={reset} activeOpacity={0.8}>
                    <Text style={styles.resetText}>New Build</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.infoBox}>
                  {showHint && <Image source={expected.img} resizeMode="contain" style={styles.infoImg} />}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoTitle}>
                      Step {installed.length + 1} of {ORDER.length}{showHint ? `: ${expected.name}` : ''}
                    </Text>
                    <Text style={styles.infoText}>
                      {showHint ? expected.tip : 'Which component goes into the glowing spot?'}
                    </Text>
                    {feedback && (
                      <Text style={[styles.feedback, { color: feedback.kind === 'ok' ? GREEN : RED }]}>
                        {feedback.text}
                      </Text>
                    )}
                  </View>
                  {!showHint && (
                    <TouchableOpacity style={styles.hintBtn} onPress={() => setShowHint(true)} activeOpacity={0.8}>
                      <Ionicons name="bulb-outline" size={16} color={TEXT} />
                      <Text style={styles.hintText}>Hint</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* The parts tray */}
            <View style={[styles.tray, isWide && styles.trayWide]}>
              <Text style={styles.trayTitle}>Drag & Drop Components</Text>
              <View style={styles.trayGrid}>
                {remaining.map((part) => (
                  <PartCard key={part.id} part={part} lifted={dragId === part.id} handlers={handlers} />
                ))}
                {remaining.length === 0 && (
                  <View style={styles.doneRow}>
                    <Ionicons name="checkmark-circle" size={20} color={GREEN} />
                    <Text style={styles.doneText}>All parts installed</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* The part in hand: just the cut-out component, no card behind it. */}
      {dragPart && (
        <Animated.View
          pointerEvents="none"
          style={[styles.dragLayer, {
            left: -dragBox.w / 2, top: -dragBox.h / 2, width: dragBox.w, height: dragBox.h,
            transform: [{ translateX: dragPos.x }, { translateY: dragPos.y }, { scale: dragScale }],
          }]}
        >
          <PartPicture part={dragPart} width={dragBox.w} height={dragBox.h} />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  floatingBackBtn: {
    position: 'absolute', left: 16, zIndex: 10,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(17,24,39,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  content: { paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 20, fontWeight: '800', color: TEXT },
  subtitle: { fontSize: 13, color: MUTED, marginTop: 4 },
  progressPill: { backgroundColor: WHITE, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: BORDER },
  progressText: { fontSize: 13, fontWeight: '800', color: TEXT },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: BORDER, marginTop: 12, marginBottom: 16, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: GREEN },

  workArea: { flexDirection: 'column', gap: 20 },
  workAreaWide: { flexDirection: 'row', alignItems: 'flex-start' },

  stage: { gap: 12 },
  stageWide: { flex: 1.6 },
  caseWrap: { width: '100%', position: 'relative' },

  slotOutline: { borderWidth: 2, borderStyle: 'dashed', borderColor: GREEN, borderRadius: 8, backgroundColor: 'rgba(34,197,94,0.14)' },

  wrongOverlay: {
    borderWidth: 3, borderColor: RED, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.14)',
    alignItems: 'center', justifyContent: 'flex-start', paddingTop: 14,
  },
  wrongBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: RED, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7,
  },
  wrongText: { color: WHITE, fontWeight: '800', fontSize: 15 },

  dragLayer: { position: 'absolute', zIndex: 50, elevation: 50 },

  infoBox: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: WHITE, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: BORDER,
  },
  infoDone: { borderColor: GREEN },
  infoImg: { width: 56, height: 44 },
  infoTitle: { fontSize: 14, fontWeight: '800', color: TEXT },
  infoText: { fontSize: 12, color: MUTED, marginTop: 2 },
  feedback: { fontSize: 12, fontWeight: '700', marginTop: 6 },
  hintBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
  },
  hintText: { fontSize: 12, fontWeight: '700', color: TEXT },
  resetBtn: { backgroundColor: GREEN, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  resetText: { color: WHITE, fontWeight: '800', fontSize: 13 },

  tray: { backgroundColor: '#F4F7FB', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: BORDER },
  trayWide: { flex: 1 },
  trayTitle: { fontSize: 16, fontWeight: '800', color: TEXT, marginBottom: 12, marginLeft: 4 },
  trayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  card: {
    width: '47%', flexGrow: 1, backgroundColor: WHITE, borderRadius: 14, padding: 10, alignItems: 'center',
    borderWidth: 1, borderColor: BORDER,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  cardImg: { width: '100%', height: 70 },
  cardLabel: { marginTop: 8, alignSelf: 'stretch', backgroundColor: '#E8EEF6', borderRadius: 8, paddingVertical: 5 },
  cardName: { fontSize: 12, fontWeight: '700', color: TEXT, textAlign: 'center' },

  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8 },
  doneText: { fontSize: 14, fontWeight: '700', color: GREEN },
});

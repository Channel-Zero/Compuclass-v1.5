// Pure rules for CompuRunner. The screen draws this and plays sounds.
// Units: x is pixels from the left, y is pixels above the ground line.
// One plane: jump the ground hazards, duck the overhead ones.

import { ALL_QUESTIONS } from '../data/circuitMazeQuestions';
import { PART_QUESTIONS } from '../data/runnerPartQuestions';

export const PLAYER_X_RATIO = 0.22;
export const CLEAR_GAP = 200;

export function playerCenterFor(viewWidth) {
  return Math.round((viewWidth || 800) * PLAYER_X_RATIO);
}

export function playerXFor(viewWidth) {
  return playerCenterFor(viewWidth) - 18;
}

export const PLAYER_X = playerXFor(800);

export function playfieldBox(screenW, screenH) {
  const sw = Math.max(1, screenW || 1280);
  const sh = Math.max(1, screenH || 720);
  let width = sw;
  let height = Math.round(width * 9 / 16);
  if (height > sh) {
    height = sh;
    width = Math.round(height * 16 / 9);
  }
  return { width, height, groundY: Math.round(height * 0.8) };
}

// Phones stay portrait until the run locks landscape, and the first layout
// can still report the portrait size. Always measure the playfield from the
// landscape pair so the runner is not letterboxed into a tall strip.
export function landscapePlayfield(screenW, screenH, topInset = 0) {
  const longSide = Math.max(Number(screenW) || 0, Number(screenH) || 0);
  const shortSide = Math.min(Number(screenW) || 0, Number(screenH) || 0);
  const inset = Math.max(0, Number(topInset) || 0);
  return playfieldBox(Math.max(320, longSide), Math.max(180, shortSide - inset));
}

export function runnerDisplayName(name, score, index = 0) {
  const clean = String(name || '').trim();
  if (clean && clean.toLowerCase() !== 'player') return clean;
  const n = Math.abs(Math.round(Number(score) || 0));
  const tag = String(((n * 17) + (index + 1) * 91) % 9000 + 1000);
  return `Player #${tag}`;
}
export const INITIAL_SPEED = 260;
export const MAX_SPEED = 640;
export const SPEED_RAMP_DISTANCE = 14000;
export const JUMP_MS = 560;
export const JUMP_APEX = 108;
export const DUCK_MS = 460;
export const HURT_MS = 280;
export const INVINCIBLE_MS = 1100;
export const COMBO_WINDOW_MS = 1600;
export const MAX_MULTIPLIER = 4;
export const START_LIVES = 3;
export const QUIZ_COOLDOWN_MS = 6500;
export const CPU_QUIZ_CHANCE = 0.34;
export const QUIZ_BASE_POINTS = 20;
export const MAX_LIVES = 5;
export const GPU_MS = 10000;
export const MAGNET_MS = 8000;
export const AUTO_MS = 7000;
export const SPEED_MS = 6000;
export const PLUG_MS = 8000;
export const SPEED_BOOST = 1.35;
export const BONUS_POINTS = 200;
export const WORLD_STORAGE_KEY = 'compurunner_world';

export function normalizeWorld(value) {
  return value === 'dark' ? 'dark' : 'light';
}

export const RUNNER_QUESTIONS = Object.values(ALL_QUESTIONS).flat().concat(PART_QUESTIONS);

const RUN_HIT = { y0: 10, y1: 72, w: 36 };
const DUCK_HIT = { y0: 0, y1: 30, w: 52 };

// Ground hazards are jumped. An air bug is ducked. The server is tall, so only the top of a jump clears it.
// The cable coil is drawn wider than this box so a jump at the opening speed still clears it.
const BUG_AIR = { y0: 86, y1: 148, w: 46, group: 'obstacle', air: true };
const HITBOX = {
  virus: { y0: 0, y1: 44, w: 48, group: 'obstacle', air: false },
  short: { y0: 0, y1: 36, w: 56, group: 'obstacle', air: false },
  cable: { y0: 0, y1: 34, w: 52, group: 'obstacle', air: false },
  server: { y0: 0, y1: 100, w: 36, group: 'obstacle', air: false },
  bug: { y0: 0, y1: 42, w: 46, group: 'obstacle', air: false },
  cpu: { y0: 16, y1: 70, w: 40, group: 'pickup', points: 10 },
  ram: { y0: 16, y1: 70, w: 40, group: 'pickup', points: 15 },
  drive: { y0: 16, y1: 70, w: 40, group: 'pickup', points: 20 },
  usb: { y0: 16, y1: 70, w: 40, group: 'pickup', points: 15 },
  keyboard: { y0: 12, y1: 64, w: 52, group: 'pickup', points: 20 },
  mouse: { y0: 16, y1: 66, w: 36, group: 'pickup', points: 15 },
  database: { y0: 14, y1: 74, w: 42, group: 'pickup', points: 100 },
  code: { y0: 16, y1: 70, w: 40, group: 'pickup', points: 25 },
  braces: { y0: 16, y1: 70, w: 40, group: 'pickup', points: 25 },
  shield: { y0: 16, y1: 74, w: 40, group: 'power' },
  heart: { y0: 18, y1: 70, w: 36, group: 'power' },
  gpu: { y0: 16, y1: 74, w: 40, group: 'power' },
  floppy: { y0: 16, y1: 70, w: 40, group: 'power' },
  router: { y0: 14, y1: 72, w: 44, group: 'power' },
  wifi: { y0: 18, y1: 72, w: 40, group: 'power' },
  plug: { y0: 12, y1: 74, w: 36, group: 'power' },
  battery: { y0: 12, y1: 76, w: 36, group: 'power' },
  cloud: { y0: 20, y1: 70, w: 46, group: 'power' },
  lock: { y0: 14, y1: 74, w: 36, group: 'power' },
  key: { y0: 16, y1: 70, w: 40, group: 'power' },
  magnet: { y0: 16, y1: 72, w: 40, group: 'power' },
  monitor: { y0: 12, y1: 74, w: 46, group: 'power' },
  terminal: { y0: 12, y1: 74, w: 46, group: 'power' },
  bulb: { y0: 10, y1: 74, w: 36, group: 'power' },
};

const POINT_WEIGHTS = {
  cpu: 0.26, ram: 0.22, usb: 0.08, mouse: 0.08, keyboard: 0.08,
  drive: 0.08, code: 0.07, braces: 0.07, database: 0.06,
};
const POWER_KINDS = [
  'shield', 'heart', 'gpu', 'floppy', 'router', 'wifi', 'plug', 'battery',
  'cloud', 'lock', 'key', 'magnet', 'monitor', 'terminal', 'bulb',
];

// A part touch opens a question from this topic. Plain CPU chips only sometimes do.
export const PART_TOPICS = {
  cpu: { topic: 'hardware', keywords: ['cpu', 'processor'], chance: CPU_QUIZ_CHANCE },
  ram: { topic: 'hardware', keywords: ['ram', 'memory'] },
  drive: { topic: 'hardware', keywords: ['ssd', 'hard drive', 'hdd', 'storage'] },
  usb: { topic: 'hardware', keywords: ['usb'] },
  keyboard: { topic: 'hardware', keywords: ['keyboard'] },
  mouse: { topic: 'hardware', keywords: ['mouse', 'pointer'] },
  database: { topic: 'databases', keywords: ['database', 'sql'] },
  code: { topic: 'software', keywords: ['xml', 'markup', 'source code', 'compiler'] },
  braces: { topic: 'software', keywords: ['brace', 'curly'] },
  gpu: { topic: 'hardware', keywords: ['gpu', 'graphics'] },
  floppy: { topic: 'hardware', keywords: ['floppy', 'disk'] },
  router: { topic: 'networking', keywords: ['router'] },
  wifi: { topic: 'networking', keywords: ['wi-fi', 'wifi', 'wireless'] },
  lock: { topic: 'cybersecurity', keywords: ['encrypt', 'https', 'padlock', 'password'] },
  shield: { topic: 'cybersecurity', keywords: ['firewall'] },
  monitor: { topic: 'hardware', keywords: ['monitor', 'display'] },
  terminal: { topic: 'software', keywords: ['terminal', 'command'] },
  bulb: { topic: 'software', keywords: ['program', 'source code'] },
};

export const MILESTONES = [200, 500, 1000, 2000, 4000];

export const HARDWARE_FACTS = [
  {
    id: 'cpu',
    title: 'CPU',
    line: 'The CPU carries out a program one instruction at a time.',
    body: 'The central processing unit follows the program step by step. Cache on the chip keeps the next bits of data close, so the core spends less time waiting.',
  },
  {
    id: 'ram',
    title: 'RAM',
    line: 'RAM holds the work that is open right now.',
    body: 'Random access memory is fast and temporary. Switch the power off and that working copy is gone. Files you want to keep live on a drive, not in RAM.',
  },
  {
    id: 'gpu',
    title: 'GPU',
    line: 'A GPU runs thousands of small tasks side by side.',
    body: 'A graphics processor is built for parallel work. That is why it draws frames, and why some of the same chips also train models.',
  },
  {
    id: 'ssd',
    title: 'SSD',
    line: 'An SSD stores files in flash chips, with no spinning disk.',
    body: 'A solid-state drive has no platter to spin up, so a computer fitted with one starts and opens files faster than the same machine with a hard drive.',
  },
  {
    id: 'board',
    title: 'Motherboard',
    line: 'The motherboard is the main circuit board.',
    body: 'Buses on the motherboard connect the CPU, memory, storage, and cards. If a part is not seated in the right slot, the rest of the machine cannot talk to it.',
  },
  {
    id: 'psu',
    title: 'Power supply',
    line: 'The power supply feeds the chips a steady voltage.',
    body: 'A power supply turns wall current into the low voltages the parts expect. When it is too weak for the load, the PC shuts off instead of running slowly.',
  },
  {
    id: 'bus',
    title: 'Bus',
    line: 'A bus is the shared path data travels on.',
    body: 'Parts share a bus the way lanes share a road. A wider, faster bus moves more data each second between the CPU, memory, and devices.',
  },
  {
    id: 'heat',
    title: 'Cooling',
    line: 'Chips turn some electricity into heat.',
    body: 'A heatsink and fan move that heat into the air. If the CPU gets too hot it slows itself down, which is why a dusty fan makes a computer feel sluggish.',
  },
];

const FACT_BY_ID = Object.fromEntries(HARDWARE_FACTS.map((fact) => [fact.id, fact]));

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function difficultyForDistance(distance) {
  return clamp(distance / SPEED_RAMP_DISTANCE, 0, 1);
}

export function speedForDistance(distance) {
  const t = difficultyForDistance(distance);
  return INITIAL_SPEED + (MAX_SPEED - INITIAL_SPEED) * t;
}

export function spawnIntervalMs(difficulty) {
  return Math.round(1280 - clamp(difficulty, 0, 1) * 620);
}

export function distancePoints(distance) {
  return Math.floor(Math.max(0, distance) / 18);
}

export function jumpHeight(elapsedMs) {
  if (elapsedMs <= 0 || elapsedMs >= JUMP_MS) return 0;
  return Math.sin((elapsedMs / JUMP_MS) * Math.PI) * JUMP_APEX;
}

export function comboMultiplier(streak) {
  if (streak <= 1) return 1;
  return Math.min(MAX_MULTIPLIER, 1 + (streak - 1) * 0.5);
}

export function scorePickup({ points, streak, lastPickupAt, now }) {
  const chained = now - lastPickupAt <= COMBO_WINDOW_MS;
  const nextStreak = chained ? streak + 1 : 1;
  const multiplier = comboMultiplier(nextStreak);
  return {
    gained: Math.round(points * multiplier),
    streak: nextStreak,
    multiplier,
    lastPickupAt: now,
  };
}

export function obstacleWeights(difficulty) {
  const t = clamp(difficulty, 0, 1);
  // A tall server only shows up once the run is fast enough for the top of a jump to clear it.
  const server = t < 0.7 ? 0 : 0.1 + (t - 0.7) * 0.25;
  const cable = 0.12;
  const bug = 0.16 + t * 0.06;
  const short = 0.24;
  const virus = Math.max(0.12, 1 - server - cable - bug - short);
  return { virus, short, bug, cable, server };
}

export function boxFor(entity) {
  if (!entity) return null;
  if (entity.kind === 'bug' && entity.air) return BUG_AIR;
  return HITBOX[entity.kind] || null;
}

export function pickWeighted(weights, rng) {
  let roll = rng() * Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  const entries = Object.entries(weights);
  for (let i = 0; i < entries.length; i += 1) {
    roll -= entries[i][1];
    if (roll <= 0) return entries[i][0];
  }
  return entries[entries.length - 1][0];
}

export function playerHitbox(pose, jumpH) {
  if (pose === 'duck') return DUCK_HIT;
  const lift = pose === 'jump' ? jumpH : 0;
  return { y0: RUN_HIT.y0 + lift, y1: RUN_HIT.y1 + lift, w: RUN_HIT.w };
}

export function entitySpec(kind) {
  return HITBOX[kind];
}

export function overlapsPlayer(state, entity) {
  const player = playerHitbox(state.pose, state.jumpH || 0);
  const box = boxFor(entity);
  if (!box) return false;
  const px = playerXFor(state.viewWidth);
  const xOverlap = px < entity.x + box.w && px + player.w > entity.x;
  const yOverlap = player.y0 < box.y1 && player.y1 > box.y0;
  return xOverlap && yOverlap;
}

export function runnerFrame(pose, elapsedMs) {
  if (pose === 'jump') return 'jump';
  if (pose === 'duck') return 'duck';
  if (pose === 'hurt') return 'hurt';
  return Math.floor(elapsedMs / 110) % 2 === 0 ? 'run1' : 'run2';
}

export function keyAction(key) {
  const name = String(key || '').toLowerCase();
  if (name === ' ' || name === 'spacebar' || name === 'arrowup' || name === 'w') return 'jump';
  if (name === 'arrowdown' || name === 's') return 'duck';
  if (name === 'p' || name === 'escape') return 'pause';
  if (name === 'm') return 'mute';
  if (name === 'enter' || name === 'r') return 'confirm';
  return null;
}

export function factById(id) {
  return FACT_BY_ID[id] || null;
}

export function factForRun(chipIds, rng) {
  const known = (chipIds || []).map((id) => FACT_BY_ID[id]).filter(Boolean);
  const pool = known.length ? known : HARDWARE_FACTS;
  const index = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
  return pool[index];
}

function makeEntity(id, kind, x, factId) {
  const spec = HITBOX[kind];
  return {
    id,
    kind,
    group: spec.group,
    x,
    factId: factId || null,
    points: spec.points || 0,
    resolved: false,
    air: !!spec.air,
  };
}

function snapshotRun(state) {
  return {
    distance: state.distance,
    pickupScore: state.pickupScore,
    score: state.pickupScore + distancePoints(state.distance),
    lives: state.lives,
    quizStreak: state.quizStreak || 0,
    quizMultiplier: state.quizMultiplier || 1,
    coinCount: state.coinCount || 0,
  };
}

function pointScale(state) {
  return state.gpuUntil > state.elapsed ? 2 : 1;
}

export function grantPower(state, kind) {
  let label = kind;
  if (kind === 'shield' || kind === 'lock') {
    state.shield += 1;
    label = 'Shield';
  } else if (kind === 'heart' || kind === 'cloud') {
    state.lives = Math.min(MAX_LIVES, state.lives + 1);
    label = 'Extra life';
  } else if (kind === 'gpu') {
    state.gpuUntil = state.elapsed + GPU_MS;
    label = 'x2 points';
  } else if (kind === 'floppy') {
    state.checkpoint = snapshotRun(state);
    label = 'Checkpoint';
  } else if (kind === 'router' || kind === 'wifi') {
    state.autoUntil = state.elapsed + AUTO_MS;
    label = 'Auto-collect';
  } else if (kind === 'plug') {
    state.nextQuizAt = Math.max(state.nextQuizAt || 0, state.elapsed) + PLUG_MS;
    label = 'Extra time';
  } else if (kind === 'battery') {
    state.speedUntil = state.elapsed + SPEED_MS;
    label = 'Speed boost';
  } else if (kind === 'key') {
    const gained = Math.round(BONUS_POINTS * (state.quizMultiplier || 1) * pointScale(state));
    state.pickupScore += gained;
    state.invincibleUntil = Math.max(state.invincibleUntil || 0, state.elapsed + 2000);
    label = `Bonus +${gained}`;
  } else if (kind === 'magnet') {
    state.magnetUntil = state.elapsed + MAGNET_MS;
    label = 'Magnet';
  } else if (kind === 'monitor' || kind === 'terminal' || kind === 'bulb') {
    state.hints += 1;
    label = 'Hint';
  }
  return label;
}

function reviveFromCheckpoint(state, events) {
  if (!state.checkpoint) return false;
  const saved = state.checkpoint;
  state.lives = Math.max(1, saved.lives || 1);
  state.distance = saved.distance || 0;
  state.pickupScore = saved.pickupScore || 0;
  state.score = saved.score || 0;
  state.quizStreak = saved.quizStreak || 0;
  state.quizMultiplier = saved.quizMultiplier || 1;
  state.coinCount = saved.coinCount || 0;
  state.phase = 'playing';
  state.paused = false;
  state.checkpoint = null;
  state.entities = [];
  state.pose = 'run';
  state.jumpT = 0;
  state.jumpH = 0;
  state.duckT = 0;
  state.hurtT = 0;
  state.invincibleUntil = state.elapsed + INVINCIBLE_MS;
  state.nextQuizAt = state.elapsed + QUIZ_COOLDOWN_MS;
  events.push({ type: 'revive', score: state.score });
  return true;
}

function eliminateWrong(quiz, rng) {
  const wrong = (quiz.options || []).map((_, index) => index).filter((index) => index !== quiz.answer);
  if (!wrong.length) return null;
  const index = Math.min(wrong.length - 1, Math.floor(rng() * wrong.length));
  return wrong[index];
}

function clearSpawnX(existing, x) {
  let next = x;
  for (let guard = 0; guard < 6; guard += 1) {
    const blocked = existing.some((entity) => (
      entity.group === 'obstacle' && Math.abs(entity.x - next) < CLEAR_GAP
    ));
    if (!blocked) return next;
    next += CLEAR_GAP;
  }
  return next;
}

export function planSpawn(state, rng) {
  const difficulty = difficultyForDistance(state.distance);
  const viewWidth = state.viewWidth || 800;
  const baseX = clearSpawnX(state.entities || [], viewWidth + 40);
  let nextId = state.nextId || 1;
  const takeId = () => {
    const id = nextId;
    nextId += 1;
    return id;
  };
  const entities = [];
  if (rng() < 0.4) {
    if (rng() < 0.14) {
      const kind = POWER_KINDS[Math.floor(rng() * POWER_KINDS.length)];
      entities.push(makeEntity(takeId(), kind, baseX));
    } else {
      const kind = pickWeighted(POINT_WEIGHTS, rng);
      if (kind === 'ram' && rng() < 0.7) {
        for (let i = 0; i < 3; i += 1) entities.push(makeEntity(takeId(), 'ram', baseX + i * 78));
      } else if (kind === 'cpu' && rng() < 0.22) {
        const fact = HARDWARE_FACTS[Math.floor(rng() * HARDWARE_FACTS.length)];
        entities.push(makeEntity(takeId(), 'cpu', baseX, fact.id));
      } else {
        entities.push(makeEntity(takeId(), kind, baseX));
      }
    }
  } else {
    const firstKind = pickWeighted(obstacleWeights(difficulty), rng);
    const first = makeEntity(takeId(), firstKind, baseX);
    if (firstKind === 'bug') first.air = rng() < 0.5;
    entities.push(first);
    if (rng() < 0.24 + difficulty * 0.16) {
      let secondKind = first.air ? 'virus' : 'bug';
      if (rng() < 0.28) secondKind = firstKind === 'server' ? 'short' : 'cable';
      const second = makeEntity(takeId(), secondKind, baseX + CLEAR_GAP + 48);
      if (secondKind === 'bug') second.air = !first.air;
      entities.push(second);
    }
  }
  return { entities, nextId };
}

function questionText(question) {
  return `${question.question || ''} ${question.explanation || ''}`.toLowerCase();
}

export function questionsForPart(kind, bank) {
  const injected = Array.isArray(bank) && bank.length ? bank : null;
  const spec = PART_TOPICS[kind];
  if (injected && injected.every((question) => !question || !question.topic)) return injected;
  const source = injected || RUNNER_QUESTIONS;
  if (!spec) return source;
  const byTopic = source.filter((question) => question.topic === spec.topic);
  const pool = byTopic.length ? byTopic : source;
  const matched = pool.filter((question) => (
    (spec.keywords || []).some((word) => questionText(question).includes(word))
  ));
  return matched.length ? matched : pool;
}

function openPartQuiz(state, entity, rng, events) {
  if (state.quiz) return false;
  if (state.elapsed < (state.nextQuizAt || 0)) return false;
  const spec = PART_TOPICS[entity.kind];
  if (!spec) return false;
  if (spec.chance != null && rng() >= spec.chance) return false;
  const question = pickQuiz(state.askedIds, rng, questionsForPart(entity.kind, state.quizBank));
  if (!question) return false;
  const options = Array.isArray(question.options) ? question.options.slice() : [];
  const quiz = {
    id: question.id,
    question: question.question,
    options,
    answer: question.answer,
    explanation: question.explanation || '',
    points: entity.points || question.xp || QUIZ_BASE_POINTS,
    part: entity.kind,
    topic: question.topic || spec.topic,
    eliminated: null,
  };
  let eliminated = null;
  if (state.hints > 0) {
    eliminated = eliminateWrong(quiz, rng);
    if (eliminated != null) {
      state.hints -= 1;
      quiz.eliminated = eliminated;
    }
  }
  state.quiz = quiz;
  state.askedIds = state.askedIds.concat(question.id);
  state.lastQuizId = question.id;
  state.paused = true;
  state.nextQuizAt = Math.max(state.nextQuizAt || 0, state.elapsed + QUIZ_COOLDOWN_MS);
  state.coinCount += 1;
  events.push({
    type: 'quiz',
    id: question.id,
    question: question.question,
    options: options.slice(),
    eliminated,
    part: entity.kind,
    topic: quiz.topic,
  });
  return true;
}

export function pickQuiz(askedIds, rng = Math.random, bank = RUNNER_QUESTIONS) {
  const source = Array.isArray(bank) ? bank.filter(Boolean) : [];
  if (!source.length) return null;
  const used = askedIds || [];
  const fresh = source.filter((question) => question.id && !used.includes(question.id));
  const pool = fresh.length ? fresh : source;
  const index = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
  return pool[index];
}

export function waveIsFair(entities) {
  const obstacles = (entities || []).filter((entity) => entity.group === 'obstacle');
  if (obstacles.filter((entity) => entity.kind === 'server').length > 1) return false;
  for (let i = 0; i < obstacles.length; i += 1) {
    for (let j = i + 1; j < obstacles.length; j += 1) {
      const a = boxFor(obstacles[i]);
      const b = boxFor(obstacles[j]);
      if (!a || !b || !!obstacles[i].air === !!obstacles[j].air) continue;
      if (Math.abs(obstacles[i].x - obstacles[j].x) < CLEAR_GAP) return false;
    }
  }
  return true;
}

export function createRun(viewWidth = 800) {
  return {
    phase: 'playing',
    paused: false,
    viewWidth,
    elapsed: 0,
    distance: 0,
    pickupScore: 0,
    score: 0,
    coinCount: 0,
    lives: START_LIVES,
    lane: 1,
    pose: 'run',
    jumpT: 0,
    jumpH: 0,
    duckT: 0,
    hurtT: 0,
    streak: 0,
    bestStreak: 0,
    multiplier: 1,
    quiz: null,
    quizStreak: 0,
    quizMultiplier: 1,
    nextQuizAt: 0,
    lastQuizId: null,
    askedIds: [],
    shield: 0,
    hints: 0,
    gpuUntil: 0,
    magnetUntil: 0,
    autoUntil: 0,
    speedUntil: 0,
    checkpoint: null,
    lastPickupAt: -100000,
    invincibleUntil: 0,
    entities: [],
    nextSpawnAt: 520,
    nextId: 1,
    chips: [],
    milestonesHit: [],
  };
}

function advancePose(state, dtMs) {
  if (state.pose === 'jump') {
    state.jumpT += dtMs;
    state.jumpH = jumpHeight(state.jumpT);
    if (state.jumpT >= JUMP_MS) {
      state.pose = 'run';
      state.jumpT = 0;
      state.jumpH = 0;
    }
  } else if (state.pose === 'duck') {
    state.duckT += dtMs;
    if (state.duckT >= DUCK_MS) {
      state.pose = 'run';
      state.duckT = 0;
    }
  } else if (state.pose === 'hurt') {
    state.hurtT += dtMs;
    if (state.hurtT >= HURT_MS) {
      state.pose = 'run';
      state.hurtT = 0;
    }
  } else {
    state.jumpH = 0;
  }
}

function applyInput(state, input, events) {
  if (!input) return;
  if (input.jump && state.pose !== 'jump' && state.pose !== 'duck') {
    state.pose = 'jump';
    state.jumpT = 0;
    state.jumpH = 0;
    events.push({ type: 'jump' });
  } else if (input.duck && state.pose !== 'jump' && state.pose !== 'duck') {
    state.pose = 'duck';
    state.duckT = 0;
    events.push({ type: 'duck' });
  }
}

export function tick(prev, dtMs, input = {}, rng = Math.random) {
  if (!prev || prev.phase !== 'playing' || prev.paused) {
    return { state: prev, events: [] };
  }
  const dt = clamp(dtMs, 0, 50);
  const state = {
    ...prev,
    entities: prev.entities.map((entity) => ({ ...entity })),
    chips: prev.chips.slice(),
    milestonesHit: prev.milestonesHit.slice(),
    askedIds: (prev.askedIds || []).slice(),
    checkpoint: prev.checkpoint ? { ...prev.checkpoint } : null,
  };
  const events = [];
  applyInput(state, input, events);
  state.elapsed += dt;
  advancePose(state, dt);

  const speed = speedForDistance(state.distance) * (state.elapsed < state.speedUntil ? SPEED_BOOST : 1);
  state.speed = speed;
  state.distance += speed * (dt / 1000);

  const kept = [];
  let revived = false;
  let quizzed = false;
  const playerX = playerXFor(state.viewWidth);
  for (const entity of state.entities) {
    entity.x -= speed * (dt / 1000);
    if (quizzed) {
      kept.push(entity);
      continue;
    }
    if (state.elapsed < state.magnetUntil && entity.group !== 'obstacle') {
      const pull = 420 * (dt / 1000);
      if (entity.x > playerX) entity.x = Math.max(playerX, entity.x - pull);
      else entity.x = Math.min(playerX, entity.x + pull);
    }
    const spec = boxFor(entity);
    if (entity.x + (spec ? spec.w : 0) < -40) continue;
    const auto = state.elapsed < state.autoUntil && entity.group !== 'obstacle' && Math.abs(entity.x - playerX) < 180;
    if (!entity.resolved && (overlapsPlayer(state, entity) || auto)) {
      entity.resolved = true;
      if (entity.group === 'obstacle') {
        if (state.elapsed < state.invincibleUntil) {
          kept.push(entity);
          continue;
        }
        if (state.shield > 0) {
          state.shield -= 1;
          state.pose = 'hurt';
          state.hurtT = 0;
          state.jumpT = 0;
          state.jumpH = 0;
          state.invincibleUntil = state.elapsed + INVINCIBLE_MS;
          events.push({ type: 'block', kind: entity.kind, shield: state.shield });
          continue;
        }
        state.lives -= 1;
        state.streak = 0;
        state.multiplier = 1;
        state.pose = 'hurt';
        state.hurtT = 0;
        state.jumpT = 0;
        state.jumpH = 0;
        state.invincibleUntil = state.elapsed + INVINCIBLE_MS;
        events.push({ type: 'hit', kind: entity.kind, lives: state.lives });
        if (state.lives <= 0 && !reviveFromCheckpoint(state, events)) {
          state.phase = 'dead';
          events.push({ type: 'dead', score: state.score });
        } else if (state.lives > 0 && state.checkpoint === null && events.some((event) => event.type === 'revive')) {
          revived = true;
          break;
        }
        continue;
      }
      if (entity.group === 'power') {
        const label = grantPower(state, entity.kind);
        events.push({ type: 'power', kind: entity.kind, label });
        if (openPartQuiz(state, entity, rng, events)) quizzed = true;
        continue;
      }
      if (openPartQuiz(state, entity, rng, events)) {
        if (entity.factId && !state.chips.includes(entity.factId)) {
          state.chips = state.chips.concat(entity.factId);
        }
        quizzed = true;
        continue;
      }
      const award = scorePickup({
        points: entity.points,
        streak: state.streak,
        lastPickupAt: state.lastPickupAt,
        now: state.elapsed,
      });
      award.gained = Math.round(award.gained * pointScale(state));
      state.pickupScore += award.gained;
      state.streak = award.streak;
      state.multiplier = award.multiplier;
      state.lastPickupAt = award.lastPickupAt;
      if (entity.group === 'pickup') state.coinCount += 1;
      if (award.streak > state.bestStreak) state.bestStreak = award.streak;
      if (entity.factId && !state.chips.includes(entity.factId)) {
        state.chips = state.chips.concat(entity.factId);
      }
      const fact = entity.factId ? FACT_BY_ID[entity.factId] : null;
      events.push({
        type: 'collect',
        kind: entity.kind,
        points: award.gained,
        streak: award.streak,
        multiplier: award.multiplier * pointScale(state),
        factId: entity.factId,
        title: fact ? fact.title : null,
        line: fact ? fact.line : null,
      });
      continue;
    }
    kept.push(entity);
  }
  state.entities = revived ? [] : kept;

  const previousScore = state.score;
  state.score = state.pickupScore + distancePoints(state.distance);
  if (state.phase === 'playing') {
    MILESTONES.forEach((mark) => {
      if (previousScore < mark && state.score >= mark && !state.milestonesHit.includes(mark)) {
        state.milestonesHit = state.milestonesHit.concat(mark);
        events.push({ type: 'milestone', score: mark });
      }
    });
    if (!state.quiz && state.elapsed >= state.nextSpawnAt) {
      const spawned = planSpawn(state, rng);
      state.entities = state.entities.concat(spawned.entities);
      state.nextId = spawned.nextId;
      state.nextSpawnAt = state.elapsed + spawnIntervalMs(difficultyForDistance(state.distance));
      events.push({ type: 'spawn', count: spawned.entities.length });
    }
  }
  if (state.phase === 'dead') {
    events.forEach((event) => {
      if (event.type === 'dead') event.score = state.score;
    });
  }
  return { state, events };
}

export function answerQuiz(prev, choice) {
  if (!prev || !prev.quiz) return { state: prev, events: [] };
  const quiz = prev.quiz;
  const correct = Number(choice) === quiz.answer;
  const state = {
    ...prev,
    quiz: null,
    paused: false,
    nextQuizAt: Math.max(prev.nextQuizAt || 0, prev.elapsed + QUIZ_COOLDOWN_MS),
    entities: (prev.entities || []).map((entity) => ({ ...entity })),
    chips: (prev.chips || []).slice(),
    milestonesHit: (prev.milestonesHit || []).slice(),
    askedIds: (prev.askedIds || []).slice(),
  };
  const events = [];
  if (correct) {
    const streak = (prev.quizStreak || 0) + 1;
    const multiplier = comboMultiplier(streak);
    const gained = Math.round((quiz.points || QUIZ_BASE_POINTS) * multiplier * pointScale(prev));
    state.quizStreak = streak;
    state.quizMultiplier = multiplier;
    state.pickupScore = (prev.pickupScore || 0) + gained;
    state.score = state.pickupScore + distancePoints(state.distance);
    events.push({
      type: 'quiz-result',
      correct: true,
      points: gained,
      streak,
      multiplier,
      explanation: quiz.explanation || '',
    });
  } else {
    state.quizStreak = 0;
    state.quizMultiplier = 1;
    state.lives = (prev.lives || 0) - 1;
    state.pose = 'hurt';
    state.hurtT = 0;
    state.jumpT = 0;
    state.jumpH = 0;
    state.duckT = 0;
    state.invincibleUntil = prev.elapsed + INVINCIBLE_MS;
    const options = quiz.options || [];
    events.push({
      type: 'quiz-result',
      correct: false,
      lives: state.lives,
      streak: 0,
      multiplier: 1,
      correctAnswer: options[quiz.answer],
      explanation: quiz.explanation || '',
    });
    if (state.lives <= 0 && !reviveFromCheckpoint(state, events)) {
      state.phase = 'dead';
      events.push({ type: 'dead', score: state.score });
    }
  }
  return { state, events };
}

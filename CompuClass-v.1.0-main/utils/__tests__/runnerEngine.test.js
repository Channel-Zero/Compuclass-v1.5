import {
  COMBO_WINDOW_MS,
  HARDWARE_FACTS,
  INITIAL_SPAWN_DISTANCE,
  INITIAL_SPEED,
  JUMP_APEX,
  JUMP_MS,
  MAX_SPEED,
  PLAYER_X,
  SPEED_RAMP_DISTANCE,
  CPU_QUIZ_CHANCE,
  MAX_LIVES,
  PLUG_MS,
  QUIZ_COOLDOWN_MS,
  RUNNER_QUESTIONS,
  SPEED_BOOST,
  START_LIVES,
  answerQuiz,
  comboMultiplier,
  createRun,
  difficultyForDistance,
  distancePoints,
  factForRun,
  jumpHeight,
  keyAction,
  entitySpec,
  normalizeWorld,
  overlapsPlayer,
  planSpawn,
  landscapePlayfield,
  playfieldBox,
  playerCenterFor,
  playerXFor,
  runnerDisplayName,
  runnerFrame,
  scorePickup,
  spawnIntervalMs,
  speedForDistance,
  tick,
  waveIsFair,
} from '../runnerEngine';
import { RUNNER_FACTS, nextRunnerFact } from '../../data/runnerFacts';

const zero = () => 0;

function virusAt(x) {
  return { id: 1, kind: 'virus', group: 'obstacle', x, resolved: false, points: 0, factId: null };
}

function partAt(kind, x, points = 10, group = 'pickup') {
  return { id: kind, kind, group, x, points, factId: null, resolved: false, air: false };
}

describe('runner pace', () => {
  it('starts at the base speed and caps after a long run', () => {
    expect(speedForDistance(0)).toBe(INITIAL_SPEED);
    expect(speedForDistance(SPEED_RAMP_DISTANCE)).toBe(MAX_SPEED);
    expect(speedForDistance(SPEED_RAMP_DISTANCE * 4)).toBe(MAX_SPEED);
    expect(speedForDistance(4000)).toBeGreaterThan(INITIAL_SPEED);
    expect(speedForDistance(4000)).toBeLessThan(speedForDistance(8000));
  });

  it('tightens the spawn gap as difficulty rises', () => {
    expect(spawnIntervalMs(0)).toBeGreaterThan(spawnIntervalMs(1));
    expect(spawnIntervalMs(difficultyForDistance(0))).toBe(spawnIntervalMs(0));
  });

  it('turns distance into a whole-number score', () => {
    expect(distancePoints(0)).toBe(0);
    expect(distancePoints(18)).toBe(1);
    expect(distancePoints(17.9)).toBe(0);
    expect(distancePoints(-10)).toBe(0);
  });
});

describe('jump and duck', () => {
  const runner = { pose: 'run', jumpH: 0, viewWidth: 800 };

  it('raises the runner on a curve and lands again', () => {
    expect(jumpHeight(0)).toBe(0);
    expect(jumpHeight(JUMP_MS / 2)).toBeCloseTo(JUMP_APEX, 5);
    expect(jumpHeight(JUMP_MS)).toBe(0);
    expect(jumpHeight(-5)).toBe(0);
  });

  it('lets a jump clear ground hazards and only a high jump clear a server', () => {
    const virus = virusAt(PLAYER_X);
    const server = { ...virus, kind: 'server' };
    const airBug = { ...virus, kind: 'bug', air: true };
    const groundBug = { ...virus, kind: 'bug', air: false };
    expect(overlapsPlayer(runner, virus)).toBe(true);
    expect(overlapsPlayer({ ...runner, pose: 'duck' }, virus)).toBe(true);
    expect(overlapsPlayer({ ...runner, pose: 'jump', jumpH: JUMP_APEX }, virus)).toBe(false);

    expect(overlapsPlayer(runner, server)).toBe(true);
    expect(overlapsPlayer({ ...runner, pose: 'duck' }, server)).toBe(true);
    expect(overlapsPlayer({ ...runner, pose: 'jump', jumpH: 40 }, server)).toBe(true);
    expect(overlapsPlayer({ ...runner, pose: 'jump', jumpH: JUMP_APEX }, server)).toBe(false);

    expect(overlapsPlayer(runner, airBug)).toBe(false);
    expect(overlapsPlayer({ ...runner, pose: 'duck' }, airBug)).toBe(false);
    expect(overlapsPlayer({ ...runner, pose: 'jump', jumpH: JUMP_APEX }, airBug)).toBe(true);
    expect(overlapsPlayer({ ...runner, pose: 'jump', jumpH: JUMP_APEX }, groundBug)).toBe(false);
  });

  it('anchors the runner at 22 percent of the playfield', () => {
    expect(playerCenterFor(1000)).toBe(220);
    expect(playerCenterFor(800) / 800).toBeCloseTo(0.22, 5);
    const box = playfieldBox(1600, 900);
    expect(box.width / box.height).toBeCloseTo(16 / 9, 2);
    expect(box.groundY).toBe(Math.round(box.height * 0.8));
    const tall = playfieldBox(800, 2000);
    expect(tall.height).toBeLessThanOrEqual(2000);
    expect(tall.width / tall.height).toBeCloseTo(16 / 9, 2);
  });

  it('sizes the runner from landscape dimensions even while the phone is still portrait', () => {
    const portrait = landscapePlayfield(400, 800, 24);
    const landscape = landscapePlayfield(800, 400, 24);
    expect(portrait).toEqual(landscape);
    expect(portrait.width).toBeGreaterThan(portrait.height);
    expect(portrait.width).toBeGreaterThanOrEqual(320);
  });

  it('cycles the run poses and holds jump, duck, and hurt', () => {
    expect(runnerFrame('run', 0)).toBe('run1');
    expect(runnerFrame('run', 110)).toBe('run2');
    expect(runnerFrame('jump', 110)).toBe('jump');
    expect(runnerFrame('duck', 0)).toBe('duck');
    expect(runnerFrame('hurt', 0)).toBe('hurt');
  });
});

describe('collectibles and facts', () => {
  it('builds a combo inside the window and resets after it', () => {
    const first = scorePickup({ points: 10, streak: 0, lastPickupAt: 0, now: 1000 });
    expect(first).toMatchObject({ gained: 10, streak: 1, multiplier: 1 });
    const second = scorePickup({ points: 10, streak: first.streak, lastPickupAt: first.lastPickupAt, now: 1000 + COMBO_WINDOW_MS });
    expect(second.streak).toBe(2);
    expect(second.multiplier).toBe(1.5);
    expect(second.gained).toBe(15);
    const late = scorePickup({ points: 10, streak: 4, lastPickupAt: 0, now: COMBO_WINDOW_MS + 1 });
    expect(late.streak).toBe(1);
    expect(late.multiplier).toBe(1);
  });

  it('caps the combo multiplier', () => {
    expect(comboMultiplier(1)).toBe(1);
    expect(comboMultiplier(7)).toBe(4);
    expect(comboMultiplier(20)).toBe(4);
  });

  it('prefers a fact for a chip the runner actually collected', () => {
    expect(factForRun(['ram'], zero).id).toBe('ram');
    expect(factForRun(['ram', 'ssd'], () => 0.99).id).toBe('ssd');
    const fallback = factForRun([], zero);
    expect(HARDWARE_FACTS.map((fact) => fact.id)).toContain(fallback.id);
  });
});

describe('keyboard', () => {
  it('maps space and arrow up to jump', () => {
    expect(keyAction(' ')).toBe('jump');
    expect(keyAction('ArrowUp')).toBe('jump');
    expect(keyAction('arrowdown')).toBe('duck');
    expect(keyAction('arrowleft')).toBeNull();
    expect(keyAction('p')).toBe('pause');
    expect(keyAction('m')).toBe('mute');
    expect(keyAction('Enter')).toBe('confirm');
    expect(keyAction('q')).toBeNull();
  });
});

describe('the run loop', () => {
  function quietRun() {
    const run = createRun(900);
    run.nextSpawnAt = 1e12;
    return run;
  }

  it('jumps, moves the world, and adds distance score', () => {
    const started = quietRun();
    const result = tick(started, 16, { jump: true, lane: 1 }, zero);
    expect(result.events.map((event) => event.type)).toContain('jump');
    expect(result.state.pose).toBe('jump');
    expect(result.state.lane).toBe(1);
    expect(result.state.distance).toBeGreaterThan(0);
    expect(result.state.score).toBe(distancePoints(result.state.distance));
  });

  it('puts the first wave close enough to reach the player promptly', () => {
    const run = createRun(1920);
    const spawned = planSpawn({ ...run, elapsed: 16 }, () => 0.9);
    expect(spawned.entities[0].x).toBe(playerXFor(1920) + INITIAL_SPAWN_DISTANCE);
  });

  it('does not advance a paused run', () => {
    const paused = quietRun();
    paused.paused = true;
    const result = tick(paused, 40, { jump: true }, zero);
    expect(result.state).toBe(paused);
    expect(result.events).toEqual([]);
    expect(result.state.distance).toBe(0);
  });

  it('collects coins one after another as a combo', () => {
    let state = quietRun();
    state.nextQuizAt = 1e12;
    const streaks = [];
    for (let i = 0; i < 3; i += 1) {
      state = {
        ...state,
        nextQuizAt: 1e12,
        entities: [{
          id: i, kind: 'cpu', group: 'pickup', x: playerXFor(state.viewWidth), points: 10, factId: null, resolved: false,
        }],
      };
      const result = tick(state, 16, {}, zero);
      state = result.state;
      streaks.push(result.events.find((event) => event.type === 'collect').streak);
    }
    expect(streaks).toEqual([1, 2, 3]);
    expect(state.pickupScore).toBe(10 + 15 + 20);
    expect(state.bestStreak).toBe(3);
  });

  it('ends the run on the third hit and ignores hits while invincible', () => {
    let state = quietRun();
    const smack = () => {
      state = { ...state, entities: [virusAt(playerXFor(state.viewWidth))] };
      const result = tick(state, 0, {}, zero);
      state = result.state;
      return result;
    };
    expect(smack().state.lives).toBe(START_LIVES - 1);
    const blocked = smack();
    expect(blocked.state.lives).toBe(START_LIVES - 1);
    expect(blocked.events.some((event) => event.type === 'hit')).toBe(false);
    state = { ...state, elapsed: state.invincibleUntil, entities: [] };
    expect(smack().state.lives).toBe(START_LIVES - 2);
    state = { ...state, elapsed: state.invincibleUntil, entities: [] };
    const last = smack();
    expect(last.state.lives).toBe(0);
    expect(last.state.phase).toBe('dead');
    expect(last.events.some((event) => event.type === 'dead')).toBe(true);
    const after = tick(last.state, 30, { jump: true }, zero);
    expect(after.state).toBe(last.state);
  });

  it('names a blank leaderboard row and keeps real names', () => {
    expect(runnerDisplayName('Lutho Student', 200, 0)).toBe('Lutho Student');
    expect(runnerDisplayName('Player', 2063, 0)).toMatch(/^Player #\d{4}$/);
    expect(runnerDisplayName('', 10, 1)).not.toBe(runnerDisplayName('Player', 10, 0));
  });

  it('leaves a way through every obstacle wave', () => {
    for (let i = 0; i < 240; i += 1) {
      const run = createRun(800);
      run.distance = i * 80;
      const wave = planSpawn(run, Math.random);
      expect(waveIsFair(wave.entities)).toBe(true);
      expect(wave.nextId).toBe(run.nextId + wave.entities.length);
    }
  });

  it('covers more ground in the same tick once the speed ramp is full', () => {
    const early = tick(quietRun(), 16, {}, zero);
    const lateRun = quietRun();
    lateRun.distance = SPEED_RAMP_DISTANCE;
    const late = tick(lateRun, 16, {}, zero);
    expect(late.state.speed).toBe(MAX_SPEED);
    expect(late.state.distance - SPEED_RAMP_DISTANCE).toBeGreaterThan(early.state.distance);
    expect(early.state.quiz).toBeNull();
  });
});

describe('quiz breaks', () => {
  const bank = [
    {
      id: 'hw_e1',
      question: 'What does CPU stand for?',
      options: ['Central Processing Unit', 'Computer Personal Unit'],
      answer: 0,
      xp: 10,
      explanation: 'The CPU executes instructions.',
    },
    {
      id: 'q2',
      question: 'Which part keeps files when the power is off?',
      options: ['RAM', 'SSD'],
      answer: 1,
      xp: 20,
      explanation: 'An SSD keeps its data without power.',
    },
  ];

  function dueRun(points = 10) {
    const run = createRun(900);
    run.nextSpawnAt = 1e12;
    run.quizBank = bank;
    run.nextQuizAt = 0;
    run.entities = [partAt('ram', playerXFor(run.viewWidth), points)];
    return run;
  }

  it('pauses on a part touch and then holds the world still', () => {
    expect(RUNNER_QUESTIONS.some((question) => question.id === 'hw_e1')).toBe(true);
    const opened = tick(dueRun(), 16, { jump: true }, zero);
    const quiz = opened.events.find((event) => event.type === 'quiz');
    expect(opened.state.paused).toBe(true);
    expect(opened.state.quiz.id).toBe('hw_e1');
    expect(opened.state.quiz.part).toBe('ram');
    expect(quiz).toEqual({
      type: 'quiz',
      id: 'hw_e1',
      question: bank[0].question,
      options: bank[0].options.slice(),
      part: 'ram',
      topic: 'hardware',
      eliminated: null,
    });
    expect(quiz.answer).toBeUndefined();
    expect(opened.events.some((event) => event.type === 'spawn')).toBe(false);
    expect(opened.events.some((event) => event.type === 'collect')).toBe(false);
    quiz.options.push('leaked');
    expect(bank[0].options).toEqual(['Central Processing Unit', 'Computer Personal Unit']);
    const frozen = tick(opened.state, 40, { jump: true }, zero);
    expect(frozen.state).toBe(opened.state);
    expect(frozen.events).toEqual([]);
  });

  it('asks a question about the part that was touched', () => {
    const expectPart = (kind, topic, pattern) => {
      const run = createRun(900);
      run.nextSpawnAt = 1e12;
      run.entities = [partAt(kind, playerXFor(run.viewWidth), 10, kind === 'router' || kind === 'lock' ? 'power' : 'pickup')];
      const opened = tick(run, 16, {}, zero);
      const quiz = opened.events.find((event) => event.type === 'quiz');
      const text = `${opened.state.quiz.question} ${opened.state.quiz.explanation}`.toLowerCase();
      expect(quiz.part).toBe(kind);
      expect(quiz.answer).toBeUndefined();
      expect(opened.state.quiz.topic).toBe(topic);
      expect(text).toMatch(pattern);
    };
    expectPart('ram', 'hardware', /ram|memory/);
    expectPart('drive', 'hardware', /ssd|hard drive|hdd|storage/);
    expectPart('database', 'databases', /database|sql/);
    expectPart('router', 'networking', /router/);
    expectPart('lock', 'cybersecurity', /encrypt|https|padlock|password|firewall/);
  });

  it('does not open a question on a timer when nothing is touched', () => {
    const run = createRun(900);
    run.nextSpawnAt = 1e12;
    run.elapsed = QUIZ_COOLDOWN_MS;
    const opened = tick(run, 16, {}, zero);
    expect(opened.state.quiz).toBeNull();
    expect(opened.state.paused).toBe(false);
  });

  it('awards the part points times the streak multiplier', () => {
    const opened = tick(dueRun(10), 16, {}, zero);
    const first = answerQuiz(opened.state, '0');
    expect(first.state.quiz).toBeNull();
    expect(first.state.paused).toBe(false);
    expect(first.state.quizStreak).toBe(1);
    expect(first.state.quizMultiplier).toBe(1);
    expect(first.state.pickupScore).toBe(10);
    expect(first.state.score).toBe(10 + distancePoints(first.state.distance));
    expect(first.events[0]).toMatchObject({ type: 'quiz-result', correct: true, points: 10, streak: 1, multiplier: 1 });

    const again = {
      ...first.state,
      elapsed: first.state.nextQuizAt,
      entities: [partAt('usb', playerXFor(first.state.viewWidth), 20)],
    };
    const secondOpen = tick(again, 16, {}, zero);
    expect(secondOpen.state.quiz.id).toBe('q2');
    const second = answerQuiz(secondOpen.state, 1);
    expect(second.state.quizStreak).toBe(2);
    expect(second.state.quizMultiplier).toBe(1.5);
    expect(second.state.pickupScore).toBe(40);
    expect(second.events[0].points).toBe(30);
    expect(answerQuiz(second.state, 0).state).toBe(second.state);
  });

  it('waits out a cooldown before the next part can ask a question', () => {
    const opened = tick(dueRun(10), 16, {}, zero);
    const answered = answerQuiz(opened.state, 0);
    const early = {
      ...answered.state,
      entities: [partAt('ram', playerXFor(answered.state.viewWidth), 10)],
    };
    const blocked = tick(early, 16, {}, zero);
    expect(blocked.events.some((event) => event.type === 'quiz')).toBe(false);
    expect(blocked.events.some((event) => event.type === 'collect')).toBe(true);
    expect(blocked.state.pickupScore).toBe(20);
    const later = {
      ...blocked.state,
      elapsed: blocked.state.nextQuizAt,
      entities: [partAt('drive', playerXFor(blocked.state.viewWidth), 15)],
    };
    const again = tick(later, 16, {}, zero);
    expect(again.events.some((event) => event.type === 'quiz' && event.part === 'drive')).toBe(true);
  });

  it('asks about a plain cpu chip only sometimes, and does not stack two questions', () => {
    const run = createRun(900);
    run.nextSpawnAt = 1e12;
    run.entities = [partAt('cpu', playerXFor(run.viewWidth), 10)];
    const skipped = tick(run, 16, {}, () => 0.9);
    expect(0.9).toBeGreaterThanOrEqual(CPU_QUIZ_CHANCE);
    expect(skipped.state.quiz).toBeNull();
    expect(skipped.events.some((event) => event.type === 'collect')).toBe(true);

    const asked = tick({ ...run, entities: [partAt('cpu', playerXFor(run.viewWidth), 10)] }, 16, {}, zero);
    expect(asked.events.find((event) => event.type === 'quiz').part).toBe('cpu');

    const stacked = dueRun();
    stacked.entities = [
      partAt('ram', playerXFor(stacked.viewWidth), 10),
      partAt('usb', playerXFor(stacked.viewWidth), 10),
    ];
    const opened = tick(stacked, 16, {}, zero);
    expect(opened.events.filter((event) => event.type === 'quiz')).toHaveLength(1);
    expect(opened.state.entities.some((entity) => entity.kind === 'usb')).toBe(true);
  });

  it('drops a life and clears the streak on a wrong answer', () => {
    const ready = dueRun();
    ready.streak = 3;
    ready.multiplier = 2;
    ready.quizStreak = 2;
    ready.quizMultiplier = 1.5;
    const opened = tick(ready, 16, {}, zero);
    const wrong = answerQuiz(opened.state, 1);
    expect(wrong.state.lives).toBe(START_LIVES - 1);
    expect(wrong.state.quizStreak).toBe(0);
    expect(wrong.state.quizMultiplier).toBe(1);
    expect(wrong.state.streak).toBe(3);
    expect(wrong.state.multiplier).toBe(2);
    expect(wrong.state.paused).toBe(false);
    expect(wrong.state.pose).toBe('hurt');
    expect(wrong.events[0]).toMatchObject({
      type: 'quiz-result',
      correct: false,
      lives: START_LIVES - 1,
      streak: 0,
      multiplier: 1,
      correctAnswer: 'Central Processing Unit',
    });
  });

  it('ends the run when the last life is lost on a question', () => {
    const ready = dueRun();
    ready.lives = 1;
    const opened = tick(ready, 16, {}, zero);
    const dead = answerQuiz(opened.state, 1);
    expect(dead.state.phase).toBe('dead');
    expect(dead.state.lives).toBe(0);
    expect(dead.state.quizStreak).toBe(0);
    expect(dead.events.some((event) => event.type === 'dead' && event.score === dead.state.score)).toBe(true);
  });

  it('keeps the quiz streak when an obstacle hits, and can repeat a used question', () => {
    let state = createRun(900);
    state.nextSpawnAt = 1e12;
    state.quizStreak = 4;
    state.quizMultiplier = 2.5;
    state.entities = [virusAt(playerXFor(state.viewWidth))];
    const hit = tick(state, 0, {}, zero);
    expect(hit.state.lives).toBe(START_LIVES - 1);
    expect(hit.state.streak).toBe(0);
    expect(hit.state.quizStreak).toBe(4);
    expect(hit.state.quizMultiplier).toBe(2.5);

    state = createRun(900);
    state.nextSpawnAt = 1e12;
    state.quizBank = [bank[0]];
    state.askedIds = ['hw_e1'];
    state.entities = [partAt('ram', playerXFor(state.viewWidth), 10)];
    const repeat = tick(state, 16, {}, zero);
    expect(repeat.state.quiz.id).toBe('hw_e1');
    expect(repeat.state.paused).toBe(true);
  });

  it('uses a stored hint to remove one wrong option', () => {
    const ready = dueRun();
    ready.hints = 1;
    const opened = tick(ready, 16, {}, zero);
    expect(opened.state.hints).toBe(0);
    expect(opened.state.quiz.eliminated).toBe(1);
    expect(opened.state.quiz.eliminated).not.toBe(opened.state.quiz.answer);
    expect(opened.events.find((event) => event.type === 'quiz').eliminated).toBe(1);
  });
});

describe('power-ups and parts', () => {
  function quietRun() {
    const run = createRun(900);
    run.nextSpawnAt = 1e12;
    run.nextQuizAt = 1e12;
    return run;
  }

  it('blocks a hit with a shield and caps extra lives', () => {
    const shielded = quietRun();
    shielded.shield = 1;
    shielded.entities = [virusAt(playerXFor(shielded.viewWidth))];
    const blocked = tick(shielded, 0, {}, zero);
    expect(blocked.state.lives).toBe(START_LIVES);
    expect(blocked.state.shield).toBe(0);
    expect(blocked.events.some((event) => event.type === 'block')).toBe(true);

    const full = quietRun();
    full.lives = MAX_LIVES;
    full.entities = [partAt('heart', playerXFor(full.viewWidth), 0, 'power')];
    expect(tick(full, 16, {}, zero).state.lives).toBe(MAX_LIVES);
    const room = quietRun();
    room.lives = MAX_LIVES - 1;
    room.entities = [partAt('cloud', playerXFor(room.viewWidth), 0, 'power')];
    expect(tick(room, 16, {}, zero).state.lives).toBe(MAX_LIVES);
  });

  it('doubles points while a gpu is active and scores a database at 100', () => {
    expect(entitySpec('database').points).toBe(100);
    const doubled = quietRun();
    doubled.gpuUntil = 1e12;
    doubled.entities = [partAt('cpu', playerXFor(doubled.viewWidth), 10)];
    const award = tick(doubled, 16, {}, zero).events.find((event) => event.type === 'collect');
    expect(award.points).toBe(20);

    const database = quietRun();
    database.entities = [partAt('database', playerXFor(database.viewWidth), 100)];
    expect(tick(database, 16, {}, zero).state.pickupScore).toBe(100);
  });

  it('pulls parts with a magnet, auto-collects, boosts speed, and delays the next question', () => {
    const x = playerXFor(900) + 300;
    const base = quietRun();
    base.entities = [partAt('cpu', x, 10)];
    const plain = tick(base, 16, {}, zero);
    const magnet = quietRun();
    magnet.magnetUntil = 1e12;
    magnet.entities = [partAt('cpu', x, 10)];
    const pulled = tick(magnet, 16, {}, zero);
    expect(pulled.state.entities[0].x).toBeLessThan(plain.state.entities[0].x);

    const auto = quietRun();
    auto.autoUntil = 1e12;
    auto.entities = [partAt('cpu', playerXFor(auto.viewWidth) + 150, 10)];
    expect(tick(auto, 16, {}, zero).events.some((event) => event.type === 'collect')).toBe(true);

    const fast = quietRun();
    fast.speedUntil = 1e12;
    const boosted = tick(fast, 16, {}, zero);
    expect(boosted.state.speed).toBeCloseTo(speedForDistance(0) * SPEED_BOOST, 5);

    const plug = quietRun();
    plug.nextQuizAt = 0;
    plug.entities = [partAt('plug', playerXFor(plug.viewWidth), 0, 'power')];
    const charged = tick(plug, 16, {}, zero);
    expect(charged.state.nextQuizAt).toBe(charged.state.elapsed + PLUG_MS);
    expect(charged.state.quiz).toBeNull();
  });

  it('treats a lock as a shield and revives from a floppy checkpoint', () => {
    const lock = createRun(900);
    lock.nextSpawnAt = 1e12;
    lock.entities = [partAt('lock', playerXFor(lock.viewWidth), 0, 'power')];
    const saved = tick(lock, 16, {}, zero);
    expect(saved.state.shield).toBe(1);
    expect(saved.state.quiz.part).toBe('lock');

    let state = quietRun();
    state.entities = [partAt('floppy', playerXFor(state.viewWidth), 0, 'power')];
    state = tick(state, 16, {}, zero).state;
    expect(state.checkpoint.lives).toBe(START_LIVES);
    state = { ...state, lives: 1, entities: [virusAt(playerXFor(state.viewWidth))] };
    const revived = tick(state, 0, {}, zero);
    expect(revived.state.phase).toBe('playing');
    expect(revived.state.lives).toBe(START_LIVES);
    expect(revived.events.some((event) => event.type === 'revive')).toBe(true);
    expect(revived.events.some((event) => event.type === 'dead')).toBe(false);
    expect(revived.state.entities).toEqual([]);
  });

  it('saves tall servers for the part of a run where a high jump can clear them', () => {
    for (let i = 0; i < 80; i += 1) {
      const run = createRun(800);
      run.distance = 2000;
      const wave = planSpawn(run, () => ((i * 13) % 97) / 97);
      expect(wave.entities.some((entity) => entity.kind === 'server')).toBe(false);
    }
    let seen = false;
    for (let i = 0; i < 120; i += 1) {
      const run = createRun(800);
      run.distance = SPEED_RAMP_DISTANCE;
      const wave = planSpawn(run, () => ((i * 17) % 89) / 89);
      if (wave.entities.some((entity) => entity.kind === 'server')) seen = true;
    }
    expect(seen).toBe(true);
  });

  it('keeps obstacle waves fair and power-ups rarer than parts', () => {
    let points = 0;
    let powers = 0;
    for (let i = 0; i < 400; i += 1) {
      const run = createRun(800);
      run.distance = i * 40;
      const wave = planSpawn(run, Math.random);
      expect(waveIsFair(wave.entities)).toBe(true);
      wave.entities.forEach((entity) => {
        if (entity.group === 'pickup') points += 1;
        if (entity.group === 'power') powers += 1;
      });
    }
    expect(points).toBeGreaterThan(powers);
    expect(powers).toBeGreaterThan(0);
  });

  it('stores the night city as dark and anything else as light', () => {
    expect(normalizeWorld('dark')).toBe('dark');
    expect(normalizeWorld('light')).toBe('light');
    expect(normalizeWorld('')).toBe('light');
    expect(normalizeWorld(null)).toBe('light');
  });
});

describe('pause facts', () => {
  it('rotates a curriculum fact without repeating the one just shown', () => {
    expect(RUNNER_FACTS.length).toBeGreaterThanOrEqual(60);
    const topics = new Set(RUNNER_FACTS.map((fact) => fact.topic));
    ['hardware', 'networking', 'software', 'data', 'cybersecurity', 'databases'].forEach((topic) => {
      expect(topics.has(topic)).toBe(true);
    });
    const first = nextRunnerFact(null, zero);
    let previous = first.id;
    const seen = new Set([first.id]);
    for (let i = 0; i < RUNNER_FACTS.length; i += 1) {
      const next = nextRunnerFact(previous, zero);
      expect(next.id).not.toBe(previous);
      seen.add(next.id);
      previous = next.id;
    }
    expect(seen.size).toBeGreaterThan(1);
    expect(nextRunnerFact(RUNNER_FACTS[0].id, () => 0.999).id).not.toBe(RUNNER_FACTS[0].id);
  });
});

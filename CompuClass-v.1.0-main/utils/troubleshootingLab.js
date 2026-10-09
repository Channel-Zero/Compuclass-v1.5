export const SCORE = {
  easy: 100,
  medium: 150,
  hard: 200,
  checkCost: 10,
  hintCost: 25,
  minimumCorrect: 10,
};

export function emptyTroubleshootingProgress() {
  return { scenarios: {}, streak: 0, lastPlayed: null };
}

export function scoreAttempt({ difficulty, checksUsed, hintsTaken, correct }) {
  if (!correct) return 0;
  const base = SCORE[difficulty] || SCORE.easy;
  const checks = Math.max(0, Number(checksUsed) || 0);
  const hints = Math.max(0, Number(hintsTaken) || 0);
  return Math.max(SCORE.minimumCorrect, base - checks * SCORE.checkCost - hints * SCORE.hintCost);
}

export function xpForAttempt(previousBest, score) {
  const prev = Math.max(0, Number(previousBest) || 0);
  return Math.max(0, (Number(score) || 0) - prev);
}

export function startAttempt(scenario) {
  return {
    scenarioId: scenario.id,
    nodeId: scenario.start,
    checksUsed: 0,
    hintsTaken: 0,
    pendingHint: null,
    hintShown: false,
    log: [],
    committed: false,
    diagnosisId: null,
    correct: false,
    score: 0,
  };
}

export function currentNode(scenario, attempt) {
  return scenario?.nodes?.[attempt?.nodeId] || null;
}

export function canCommit(attempt) {
  return !!attempt && attempt.checksUsed > 0 && !attempt.committed;
}

export function applyCheck(scenario, attempt, checkId) {
  if (!attempt || attempt.committed) return attempt;
  const node = currentNode(scenario, attempt);
  const check = node?.checks?.find((item) => item.id === checkId);
  if (!check || !scenario.nodes[check.next]) return attempt;
  return {
    ...attempt,
    nodeId: check.next,
    checksUsed: attempt.checksUsed + 1,
    pendingHint: check.hint || null,
    hintShown: false,
    log: [...attempt.log, { checkId: check.id, label: check.label, feedback: check.feedback }],
  };
}

export function takeHint(attempt) {
  if (!attempt || attempt.committed || !attempt.pendingHint || attempt.hintShown) return attempt;
  return { ...attempt, hintsTaken: attempt.hintsTaken + 1, hintShown: true };
}

export function commitDiagnosis(scenario, attempt, diagnosisId) {
  if (!canCommit(attempt)) return attempt;
  const correct = diagnosisId === scenario.rootCauseId;
  return {
    ...attempt,
    committed: true,
    diagnosisId,
    correct,
    score: scoreAttempt({
      difficulty: scenario.difficulty,
      checksUsed: attempt.checksUsed,
      hintsTaken: attempt.hintsTaken,
      correct,
    }),
  };
}

function rowFrom(value) {
  return {
    completed: !!value?.completed,
    bestScore: Math.max(0, Number(value?.bestScore) || 0),
    lastPlayed: value?.lastPlayed || null,
  };
}

export function mergeTroubleshootingProgress(local, remote) {
  const left = local && typeof local === 'object' ? local : emptyTroubleshootingProgress();
  const right = remote && typeof remote === 'object' ? remote : emptyTroubleshootingProgress();
  const ids = new Set([
    ...Object.keys(left.scenarios || {}),
    ...Object.keys(right.scenarios || {}),
  ]);
  const scenarios = {};
  [...ids].sort().forEach((id) => {
    const a = left.scenarios?.[id];
    const b = right.scenarios?.[id];
    if (!a) {
      scenarios[id] = rowFrom(b);
      return;
    }
    if (!b) {
      scenarios[id] = rowFrom(a);
      return;
    }
    const aTime = Date.parse(a.lastPlayed) || 0;
    const bTime = Date.parse(b.lastPlayed) || 0;
    scenarios[id] = {
      completed: !!(a.completed || b.completed),
      bestScore: Math.max(rowFrom(a).bestScore, rowFrom(b).bestScore),
      lastPlayed: bTime > aTime ? b.lastPlayed : a.lastPlayed,
    };
  });
  const leftTime = Date.parse(left.lastPlayed) || 0;
  const rightTime = Date.parse(right.lastPlayed) || 0;
  const newer = rightTime > leftTime ? right : left;
  return {
    scenarios,
    streak: Math.max(0, Number(newer.streak) || 0),
    lastPlayed: newer.lastPlayed || null,
  };
}

export function filterScenarios(scenarios, { category = 'all', difficulty = 'all' } = {}) {
  return (scenarios || []).filter((item) => (
    (category === 'all' || item.category === category)
    && (difficulty === 'all' || item.difficulty === difficulty)
  ));
}

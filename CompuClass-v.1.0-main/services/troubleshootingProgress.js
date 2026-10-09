import { supabase } from '../config/supabase';
import { PROGRESS_KEYS, progressService } from './progressService';
import { mergeTroubleshootingProgress, xpForAttempt } from '../utils/troubleshootingLab';

// The maze is the game that already awards XP. award_maze_xp is that path.
// This does not insert a maze session or write a stats table directly.
export async function awardTroubleshootingXp(xp) {
  const amount = Math.round(Number(xp) || 0);
  if (amount <= 0) return 0;
  if (process.env.JEST_WORKER_ID && !awardTroubleshootingXp._rpc) return 0;
  try {
    const rpc = awardTroubleshootingXp._rpc || ((name, args) => supabase.rpc(name, args));
    const { error } = await rpc('award_maze_xp', { p_xp: amount });
    if (error) return 0;
    return amount;
  } catch {
    return 0;
  }
}

export async function loadTroubleshootingProgress() {
  try {
    const saved = await progressService.get(PROGRESS_KEYS.troubleshooting);
    return mergeTroubleshootingProgress(saved, null);
  } catch {
    return mergeTroubleshootingProgress(null, null);
  }
}

export async function saveScenarioResult({ scenarioId, correct, score, previous }) {
  const current = previous || await loadTroubleshootingProgress();
  const prev = current.scenarios?.[scenarioId];
  const bestScore = correct ? Math.max(prev?.bestScore || 0, score) : (prev?.bestScore || 0);
  const xpTarget = correct ? xpForAttempt(prev?.bestScore || 0, score) : 0;
  const now = new Date().toISOString();
  const next = {
    scenarios: {
      ...current.scenarios,
      [scenarioId]: {
        completed: !!(prev?.completed || correct),
        bestScore,
        lastPlayed: now,
      },
    },
    streak: correct ? (current.streak || 0) + 1 : 0,
    lastPlayed: now,
  };
  await progressService.set(PROGRESS_KEYS.troubleshooting, next);
  const xpAwarded = await awardTroubleshootingXp(xpTarget);
  return { progress: next, xpAwarded };
}

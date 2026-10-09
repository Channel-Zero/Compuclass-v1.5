import AsyncStorage from '@react-native-async-storage/async-storage';

// Per-topic Circuit Maze progress, stored on the device.
//
// The maze itself only ever kept `levelIdx` in component state, so a run's
// progress died with the screen. This is the smallest durable record that lets
// the topic screen show real numbers: how many levels of each topic the player
// has actually cleared, and when they last played it.
//
// Everything here fails soft — a storage error returns empty progress rather
// than throwing into a render.

const KEY = 'circuitMazeProgress:v1';

export const TOTAL_LEVELS = 10;

export const TOPIC_STATE = {
  NOT_STARTED: 'not-started',
  IN_PROGRESS: 'in-progress',
  COMPLETED:   'completed',
};

const clampLevel = (n) => Math.max(0, Math.min(TOTAL_LEVELS, Math.floor(Number(n) || 0)));

export const circuitMazeProgress = {
  /** @returns {Promise<Object>} { [topicId]: { levelsCleared, lastPlayedAt } } */
  async getAll() {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  },

  /**
   * Record that the player finished `levelNumber` (1-based) of `topicId`.
   * Monotonic: replaying an early level never walks the count backwards.
   */
  async recordLevelCleared(topicId, levelNumber) {
    if (!topicId) return null;
    try {
      const all  = await this.getAll();
      const prev = all[topicId]?.levelsCleared ?? 0;
      const next = {
        ...all,
        [topicId]: {
          levelsCleared: Math.max(clampLevel(prev), clampLevel(levelNumber)),
          lastPlayedAt:  new Date().toISOString(),
        },
      };
      await AsyncStorage.setItem(KEY, JSON.stringify(next));
      return next;
    } catch {
      return null;
    }
  },

  async reset() {
    try {
      await AsyncStorage.removeItem(KEY);
    } catch {
      /* nothing to clean up */
    }
  },
};

/**
 * Normalise one topic's entry into everything the UI needs, including topics
 * that have never been played.
 */
export function topicProgress(progress, topicId) {
  const levelsCleared = clampLevel(progress?.[topicId]?.levelsCleared);
  return {
    levelsCleared,
    total: TOTAL_LEVELS,
    ratio: levelsCleared / TOTAL_LEVELS,
    lastPlayedAt: progress?.[topicId]?.lastPlayedAt ?? null,
    state:
      levelsCleared >= TOTAL_LEVELS ? TOPIC_STATE.COMPLETED
      : levelsCleared > 0           ? TOPIC_STATE.IN_PROGRESS
      : TOPIC_STATE.NOT_STARTED,
  };
}

/**
 * The topic to offer as "continue learning": the most recently played one that
 * is started but not finished. Returns null when there is nothing meaningful
 * to continue, so the card can be hidden rather than filled with placeholders.
 */
export function continueTarget(progress) {
  const candidates = Object.keys(progress || {})
    .map(topicId => ({ topicId, ...topicProgress(progress, topicId) }))
    .filter(t => t.state === TOPIC_STATE.IN_PROGRESS)
    .sort((a, b) => String(b.lastPlayedAt).localeCompare(String(a.lastPlayedAt)));

  return candidates[0] || null;
}

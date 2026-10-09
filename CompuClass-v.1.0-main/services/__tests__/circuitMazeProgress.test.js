import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  circuitMazeProgress,
  topicProgress,
  continueTarget,
  TOTAL_LEVELS,
  TOPIC_STATE,
} from '../circuitMazeProgress';

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('circuitMazeProgress store', () => {
  it('starts empty', async () => {
    expect(await circuitMazeProgress.getAll()).toEqual({});
  });

  it('records a cleared level with a timestamp', async () => {
    await circuitMazeProgress.recordLevelCleared('networking', 3);
    const all = await circuitMazeProgress.getAll();
    expect(all.networking.levelsCleared).toBe(3);
    expect(typeof all.networking.lastPlayedAt).toBe('string');
  });

  it('never walks progress backwards when an early level is replayed', async () => {
    await circuitMazeProgress.recordLevelCleared('hardware', 7);
    await circuitMazeProgress.recordLevelCleared('hardware', 2);
    const all = await circuitMazeProgress.getAll();
    expect(all.hardware.levelsCleared).toBe(7);
  });

  it('keeps topics independent', async () => {
    await circuitMazeProgress.recordLevelCleared('software', 4);
    await circuitMazeProgress.recordLevelCleared('databases', 1);
    const all = await circuitMazeProgress.getAll();
    expect(all.software.levelsCleared).toBe(4);
    expect(all.databases.levelsCleared).toBe(1);
  });

  it('clamps a level outside the real range', async () => {
    await circuitMazeProgress.recordLevelCleared('datasci', 999);
    await circuitMazeProgress.recordLevelCleared('cybersecurity', -5);
    const all = await circuitMazeProgress.getAll();
    expect(all.datasci.levelsCleared).toBe(TOTAL_LEVELS);
    expect(all.cybersecurity.levelsCleared).toBe(0);
  });

  it('ignores a call with no topic', async () => {
    expect(await circuitMazeProgress.recordLevelCleared(null, 3)).toBeNull();
    expect(await circuitMazeProgress.getAll()).toEqual({});
  });

  it('returns empty progress rather than throwing on unreadable storage', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk gone'));
    expect(await circuitMazeProgress.getAll()).toEqual({});
  });

  it('returns empty progress when the stored value is not JSON', async () => {
    await AsyncStorage.setItem('circuitMazeProgress:v1', 'not json');
    expect(await circuitMazeProgress.getAll()).toEqual({});
  });

  it('clears everything on reset', async () => {
    await circuitMazeProgress.recordLevelCleared('networking', 5);
    await circuitMazeProgress.reset();
    expect(await circuitMazeProgress.getAll()).toEqual({});
  });
});

describe('topicProgress', () => {
  it('reports an unplayed topic as not started', () => {
    const p = topicProgress({}, 'networking');
    expect(p).toMatchObject({ levelsCleared: 0, ratio: 0, state: TOPIC_STATE.NOT_STARTED });
  });

  it('reports a partly cleared topic as in progress', () => {
    const p = topicProgress({ networking: { levelsCleared: 4 } }, 'networking');
    expect(p.state).toBe(TOPIC_STATE.IN_PROGRESS);
    expect(p.ratio).toBeCloseTo(0.4);
  });

  it('reports a fully cleared topic as completed', () => {
    const p = topicProgress({ hardware: { levelsCleared: TOTAL_LEVELS } }, 'hardware');
    expect(p.state).toBe(TOPIC_STATE.COMPLETED);
    expect(p.ratio).toBe(1);
  });

  it('survives a malformed entry', () => {
    expect(topicProgress({ software: { levelsCleared: 'banana' } }, 'software').levelsCleared).toBe(0);
    expect(topicProgress(null, 'software').levelsCleared).toBe(0);
  });
});

describe('continueTarget', () => {
  it('is null with no progress at all', () => {
    expect(continueTarget({})).toBeNull();
    expect(continueTarget(null)).toBeNull();
  });

  it('is null when every started topic is finished', () => {
    expect(continueTarget({
      networking: { levelsCleared: TOTAL_LEVELS, lastPlayedAt: '2026-01-01T00:00:00.000Z' },
    })).toBeNull();
  });

  it('picks the most recently played unfinished topic', () => {
    const target = continueTarget({
      networking: { levelsCleared: 4, lastPlayedAt: '2026-01-01T00:00:00.000Z' },
      software:   { levelsCleared: 2, lastPlayedAt: '2026-03-01T00:00:00.000Z' },
      hardware:   { levelsCleared: TOTAL_LEVELS, lastPlayedAt: '2026-06-01T00:00:00.000Z' },
    });
    expect(target.topicId).toBe('software');
    expect(target.levelsCleared).toBe(2);
  });

  it('skips a topic that was opened but never cleared a level', () => {
    expect(continueTarget({
      datasci: { levelsCleared: 0, lastPlayedAt: '2026-05-01T00:00:00.000Z' },
    })).toBeNull();
  });
});

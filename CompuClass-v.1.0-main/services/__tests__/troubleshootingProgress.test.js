import { PROGRESS_KEYS, progressService } from '../progressService';
import { awardTroubleshootingXp, saveScenarioResult } from '../troubleshootingProgress';

jest.mock('../progressService', () => ({
  PROGRESS_KEYS: { troubleshooting: 'troubleshooting_lab' },
  progressService: { get: jest.fn(), set: jest.fn() },
}));

jest.mock('../../config/supabase', () => ({
  supabase: { rpc: jest.fn() },
}));

describe('saveScenarioResult', () => {
  beforeEach(() => {
    progressService.get.mockResolvedValue(null);
    progressService.set.mockResolvedValue(undefined);
    awardTroubleshootingXp._rpc = jest.fn(async () => ({ error: null }));
  });

  afterEach(() => {
    awardTroubleshootingXp._rpc = null;
  });

  it('stores the best score and awards only the improvement', async () => {
    const first = await saveScenarioResult({ scenarioId: 'desktop-no-power', correct: true, score: 80, previous: { scenarios: {}, streak: 0, lastPlayed: null } });
    expect(first.progress.scenarios['desktop-no-power'].bestScore).toBe(80);
    expect(first.progress.scenarios['desktop-no-power'].completed).toBe(true);
    expect(first.progress.streak).toBe(1);
    expect(first.xpAwarded).toBe(80);
    expect(awardTroubleshootingXp._rpc).toHaveBeenCalledWith('award_maze_xp', { p_xp: 80 });
    expect(progressService.set).toHaveBeenCalledWith(PROGRESS_KEYS.troubleshooting, first.progress);

    awardTroubleshootingXp._rpc.mockClear();
    const second = await saveScenarioResult({
      scenarioId: 'desktop-no-power',
      correct: true,
      score: 50,
      previous: first.progress,
    });
    expect(second.progress.scenarios['desktop-no-power'].bestScore).toBe(80);
    expect(second.xpAwarded).toBe(0);
    expect(awardTroubleshootingXp._rpc).not.toHaveBeenCalled();
  });

  it('keeps the saved progress when the XP call fails', async () => {
    awardTroubleshootingXp._rpc.mockResolvedValue({ error: { message: 'offline' } });
    const result = await saveScenarioResult({
      scenarioId: 'beep-ram',
      correct: true,
      score: 90,
      previous: { scenarios: {}, streak: 2, lastPlayed: null },
    });
    expect(result.progress.scenarios['beep-ram'].completed).toBe(true);
    expect(result.xpAwarded).toBe(0);
    expect(progressService.set).toHaveBeenCalled();
  });

  it('resets the streak after a wrong diagnosis and does not award XP', async () => {
    const result = await saveScenarioResult({
      scenarioId: 'dns-fail',
      correct: false,
      score: 0,
      previous: { scenarios: { 'dns-fail': { completed: true, bestScore: 40, lastPlayed: '2026-10-01T00:00:00.000Z' } }, streak: 3, lastPlayed: null },
    });
    expect(result.progress.streak).toBe(0);
    expect(result.progress.scenarios['dns-fail'].bestScore).toBe(40);
    expect(result.progress.scenarios['dns-fail'].completed).toBe(true);
    expect(result.xpAwarded).toBe(0);
  });
});

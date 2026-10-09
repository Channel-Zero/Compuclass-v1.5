import { TROUBLESHOOTING_SCENARIOS, LAB_CATEGORIES, scenarioProblems } from '../../data/troubleshootingScenarios';
import {
  SCORE,
  applyCheck,
  canCommit,
  commitDiagnosis,
  filterScenarios,
  mergeTroubleshootingProgress,
  scoreAttempt,
  startAttempt,
  takeHint,
  xpForAttempt,
} from '../troubleshootingLab';

const sample = {
  id: 'sample',
  difficulty: 'easy',
  start: 'first',
  rootCauseId: 'cord',
  nodes: {
    first: {
      prompt: 'Start',
      checks: [
        { id: 'right', label: 'Check the outlet', feedback: 'The outlet is live.', next: 'second', useful: true },
        { id: 'wrong', label: 'Reseat the RAM', feedback: 'Still dark.', next: 'first', useful: false, hint: 'Look at power first.' },
      ],
    },
    second: {
      prompt: 'Next',
      checks: [
        { id: 'confirm', label: 'Seat the lead', feedback: 'The fans start.', next: 'second', useful: true },
      ],
    },
  },
  diagnoses: [{ id: 'cord', label: 'Loose lead' }, { id: 'board', label: 'Dead board' }],
};

describe('troubleshooting score', () => {
  it('scores a correct diagnosis from checks and hints', () => {
    expect(scoreAttempt({ difficulty: 'easy', checksUsed: 2, hintsTaken: 0, correct: true })).toBe(80);
    expect(scoreAttempt({ difficulty: 'medium', checksUsed: 1, hintsTaken: 1, correct: true })).toBe(115);
    expect(scoreAttempt({ difficulty: 'hard', checksUsed: 30, hintsTaken: 4, correct: true })).toBe(10);
  });

  it('gives a wrong diagnosis no score and awards only a new best', () => {
    expect(scoreAttempt({ difficulty: 'easy', checksUsed: 1, hintsTaken: 0, correct: false })).toBe(0);
    expect(xpForAttempt(40, 80)).toBe(40);
    expect(xpForAttempt(80, 80)).toBe(0);
    expect(xpForAttempt(90, 80)).toBe(0);
  });

  it('charges 25 points for each hint and never awards XP without a better score', () => {
    const plain = scoreAttempt({ difficulty: 'medium', checksUsed: 1, hintsTaken: 0, correct: true });
    const hinted = scoreAttempt({ difficulty: 'medium', checksUsed: 1, hintsTaken: 1, correct: true });
    expect(plain - hinted).toBe(SCORE.hintCost);
    expect(SCORE.hintCost).toBe(25);
    expect(xpForAttempt(hinted, hinted)).toBe(0);
    expect(xpForAttempt(hinted - 1, hinted)).toBe(1);
  });
});

describe('troubleshooting tree', () => {
  it('walks a useful check, offers a hint on a wrong path, and hides the result until commit', () => {
    let attempt = startAttempt(sample);
    expect(canCommit(attempt)).toBe(false);
    attempt = applyCheck(sample, attempt, 'wrong');
    expect(attempt.nodeId).toBe('first');
    expect(attempt.log[0].feedback).toBe('Still dark.');
    expect(attempt.pendingHint).toBe('Look at power first.');
    attempt = takeHint(attempt);
    expect(attempt.hintsTaken).toBe(1);
    attempt = takeHint(attempt);
    expect(attempt.hintsTaken).toBe(1);
    attempt = applyCheck(sample, attempt, 'right');
    expect(attempt.nodeId).toBe('second');
    expect(canCommit(attempt)).toBe(true);
    expect(attempt.committed).toBe(false);
    const wrong = commitDiagnosis(sample, attempt, 'board');
    expect(wrong.correct).toBe(false);
    expect(wrong.score).toBe(0);
    const right = commitDiagnosis(sample, attempt, 'cord');
    expect(right.correct).toBe(true);
    expect(right.score).toBe(scoreAttempt({ difficulty: 'easy', checksUsed: 2, hintsTaken: 1, correct: true }));
  });

  it('ignores a check that is not on the current node', () => {
    const attempt = startAttempt(sample);
    expect(applyCheck(sample, attempt, 'confirm')).toBe(attempt);
  });
});

describe('troubleshooting progress merge', () => {
  it('keeps the better score and a scenario that exists on only one side', () => {
    const merged = mergeTroubleshootingProgress(
      {
        scenarios: { a: { completed: true, bestScore: 40, lastPlayed: '2026-10-01T00:00:00.000Z' } },
        streak: 1,
        lastPlayed: '2026-10-01T00:00:00.000Z',
      },
      {
        scenarios: {
          a: { completed: false, bestScore: 90, lastPlayed: '2026-10-09T00:00:00.000Z' },
          b: { completed: true, bestScore: 70, lastPlayed: '2026-10-08T00:00:00.000Z' },
        },
        streak: 4,
        lastPlayed: '2026-10-09T00:00:00.000Z',
      },
    );
    expect(merged.scenarios.a).toEqual({ completed: true, bestScore: 90, lastPlayed: '2026-10-09T00:00:00.000Z' });
    expect(merged.scenarios.b.completed).toBe(true);
    expect(merged.streak).toBe(4);
  });

  it('keeps the local streak when the local copy was played later', () => {
    const merged = mergeTroubleshootingProgress(
      { scenarios: {}, streak: 3, lastPlayed: '2026-10-10T00:00:00.000Z' },
      { scenarios: {}, streak: 9, lastPlayed: '2026-10-01T00:00:00.000Z' },
    );
    expect(merged.streak).toBe(3);
  });
});

describe('troubleshooting scenario data', () => {
  it('has 12 playable cases across the requested categories and difficulties', () => {
    expect(TROUBLESHOOTING_SCENARIOS.length).toBeGreaterThanOrEqual(12);
    expect(scenarioProblems()).toEqual([]);
    LAB_CATEGORIES.forEach((category) => {
      expect(TROUBLESHOOTING_SCENARIOS.some((item) => item.category === category.id)).toBe(true);
    });
    ['easy', 'medium', 'hard'].forEach((difficulty) => {
      expect(TROUBLESHOOTING_SCENARIOS.some((item) => item.difficulty === difficulty)).toBe(true);
    });
  });

  it('filters by category without dropping the other difficulties by accident', () => {
    const power = filterScenarios(TROUBLESHOOTING_SCENARIOS, { category: 'no-power' });
    expect(power.length).toBeGreaterThan(0);
    expect(power.every((item) => item.category === 'no-power')).toBe(true);
    expect(filterScenarios(power, { difficulty: 'easy' }).every((item) => item.difficulty === 'easy')).toBe(true);
  });
});

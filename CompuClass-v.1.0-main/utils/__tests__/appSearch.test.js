import { findAppScreens, quizResultDestination } from '../appSearch';
import { positionNote } from '../../screens/LeaderboardScreen';

describe('findAppScreens', () => {
  it('finds CompuRunner when the query is runner', () => {
    const hits = findAppScreens('runner');
    expect(hits.map((item) => item.title)).toEqual(['CompuRunner']);
    expect(hits[0].screen).toBe('GameRunnerLobby');
  });

  it('returns nothing for a blank query', () => {
    expect(findAppScreens('  ')).toEqual([]);
  });
});

describe('quizResultDestination', () => {
  it('opens quiz details for a lecturer and the attempt for a student', () => {
    expect(quizResultDestination('lecturer', 'quiz-1')).toEqual({
      name: 'Lecturer',
      params: { screen: 'QuizDetail', params: { quizId: 'quiz-1' } },
    });
    expect(quizResultDestination('student', 'quiz-1')).toEqual({
      name: 'Quiz',
      params: { quizId: 'quiz-1' },
    });
  });
});

describe('positionNote', () => {
  it('reserves the top-of-board line for first place', () => {
    expect(positionNote(1, 0)).toBe('You are at the top of this board.');
    expect(positionNote(9, 0)).toBe('Tied with 8th place.');
    expect(positionNote(9, 40)).toBe('40 points to reach 8th place.');
  });
});

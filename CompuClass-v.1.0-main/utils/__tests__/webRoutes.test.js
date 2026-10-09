import { isUnknownWebPath, linkingConfig } from '../webRoutes';

describe('web routes', () => {
  it('treats real screens as known and everything else as a 404', () => {
    expect(isUnknownWebPath('/')).toBe(false);
    expect(isUnknownWebPath('/quiz')).toBe(false);
    expect(isUnknownWebPath('/profile')).toBe(false);
    expect(isUnknownWebPath('/lecturer/quizzes')).toBe(false);
    expect(isUnknownWebPath('/lecturer/quiz/abc')).toBe(false);
    expect(isUnknownWebPath('/does-not-exist')).toBe(true);
  });

  it('maps the quiz path only after the navigator is showing logged-in screens', () => {
    expect(linkingConfig('student').screens.Quiz).toBe('quiz');
    expect(linkingConfig('student').screens.Profile).toBe('profile');
    expect(linkingConfig('lecturer').screens.Lecturer.screens.QuizCreation).toBe('quizzes');
    expect(linkingConfig('student').screens.Lecturer).toBeUndefined();
  });
});

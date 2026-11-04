import { isUnknownWebPath, linkingConfig, onboardingRedirectPath } from '../webRoutes';

describe('web routes', () => {
  it('treats real screens as known and everything else as a 404', () => {
    expect(isUnknownWebPath('/')).toBe(false);
    expect(isUnknownWebPath('/quiz')).toBe(false);
    expect(isUnknownWebPath('/profile')).toBe(false);
    expect(isUnknownWebPath('/lecturer/quizzes')).toBe(false);
    expect(isUnknownWebPath('/lecturer/analytics')).toBe(false);
    expect(isUnknownWebPath('/lecturer/quiz/abc')).toBe(false);
    expect(isUnknownWebPath('/does-not-exist')).toBe(true);
    expect(isUnknownWebPath('/onboarding')).toBe(false);
  });

  it('shows onboarding at /onboarding until it is finished, then leaves that URL', () => {
    expect(onboardingRedirectPath({ pathname: '/onboarding', onboarded: false, loggedIn: false })).toBeNull();
    expect(onboardingRedirectPath({ pathname: '/quiz', onboarded: false, loggedIn: false })).toBeNull();
    expect(onboardingRedirectPath({ pathname: '/onboarding', onboarded: true, loggedIn: false })).toBe('/');
    expect(onboardingRedirectPath({ pathname: '/onboarding', onboarded: true, loggedIn: true, role: 'student' })).toBe('/dashboard');
    expect(onboardingRedirectPath({ pathname: '/onboarding', onboarded: true, loggedIn: true, role: 'lecturer' })).toBe('/lecturer');
  });

  it('maps the quiz path only after the navigator is showing logged-in screens', () => {
    expect(linkingConfig('student').screens.Quiz).toBe('quiz');
    expect(linkingConfig('student').screens.Profile).toBe('profile');
    expect(linkingConfig('lecturer').screens.Lecturer.screens.QuizCreation).toBe('quizzes');
    expect(linkingConfig('student').screens.Lecturer).toBeUndefined();
  });
});

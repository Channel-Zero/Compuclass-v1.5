import { isRootRoute, leaveScreen, navKeyForRoute, sidebarDestination, tabKeyForRoute } from '../screenNav';

describe('navKeyForRoute', () => {
  it('highlights Home for the dashboard and lecturer pages opened from it', () => {
    expect(navKeyForRoute('Dashboard')).toBe('Home');
    expect(navKeyForRoute('LecturerDashboard')).toBe('Home');
    expect(navKeyForRoute('FolderContent')).toBe('Home');
    expect(navKeyForRoute('ClassManagement')).toBe('Home');
    expect(navKeyForRoute('Search')).toBe('Home');
  });

  it('highlights the matching lab, quiz, and settings items', () => {
    ['Materials', 'Quiz', 'Leaderboard', 'Profile', 'Settings', 'PC Lab', 'PC Assembly', 'Windows 11', 'Troubleshoot', 'Chatbot']
      .forEach((route) => expect(navKeyForRoute(route)).toBe(route));
  });

  it('highlights CompuRunner for the lobby and the run', () => {
    expect(navKeyForRoute('Game')).toBe('GameRunnerLobby');
    expect(navKeyForRoute('GameRunnerLobby')).toBe('GameRunnerLobby');
  });

  it('does not pretend Circuit Maze is one of the sidebar items', () => {
    expect(navKeyForRoute('CircuitMaze')).toBeNull();
    expect(navKeyForRoute('')).toBeNull();
  });

  it('highlights Quizzes for the lecturer quiz pages', () => {
    expect(navKeyForRoute('QuizCreation')).toBe('Quiz');
    expect(navKeyForRoute('QuizDetail')).toBe('Quiz');
    expect(navKeyForRoute('QuizAnalytics')).toBe('Quiz');
  });
});

describe('sidebarDestination', () => {
  it('opens the lecturer quiz list for a lecturer and the assigned list for a student', () => {
    expect(sidebarDestination('Quiz', 'lecturer')).toEqual({ screen: 'Lecturer', params: { screen: 'QuizCreation' } });
    expect(sidebarDestination('Quiz', 'student')).toBe('Quiz');
    expect(sidebarDestination('Materials', 'lecturer')).toBe('Materials');
  });
});

describe('tabKeyForRoute', () => {
  it('maps lecturer home and quiz pages onto the tab names', () => {
    expect(tabKeyForRoute('LecturerDashboard', 'lecturer')).toBe('Lecturer');
    expect(tabKeyForRoute('QuizCreation', 'lecturer')).toBe('Quiz');
    expect(tabKeyForRoute('Dashboard', 'student')).toBe('Dashboard');
    expect(tabKeyForRoute('Settings', 'student')).toBe('Profile');
  });
});

describe('isRootRoute', () => {
  it('treats the main sections as roots and everything else as a page that can go back', () => {
    expect(isRootRoute('Dashboard')).toBe(true);
    expect(isRootRoute('Profile')).toBe(true);
    expect(isRootRoute('Quiz')).toBe(true);
    expect(isRootRoute('Settings')).toBe(false);
    expect(isRootRoute('PC Lab')).toBe(false);
    expect(isRootRoute('JoinClass')).toBe(false);
    expect(isRootRoute('CircuitMaze')).toBe(false);
  });
});

describe('leaveScreen', () => {
  it('goes back when the navigator has history', () => {
    const navigation = { canGoBack: () => true, goBack: jest.fn(), navigate: jest.fn() };
    leaveScreen(navigation);
    expect(navigation.goBack).toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('falls back to Home when there is no history', () => {
    const navigation = { canGoBack: () => false, goBack: jest.fn(), navigate: jest.fn(), getState: () => ({ routeNames: ['Dashboard', 'Quiz'] }) };
    leaveScreen(navigation);
    expect(navigation.navigate).toHaveBeenCalledWith('Dashboard');
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it('falls back to the lecturer home for a lecturer navigator', () => {
    const navigation = { canGoBack: () => false, goBack: jest.fn(), navigate: jest.fn(), getState: () => ({ routeNames: ['Lecturer', 'Materials'] }) };
    leaveScreen(navigation);
    expect(navigation.navigate).toHaveBeenCalledWith('Lecturer', { screen: 'LecturerDashboard' });
  });

  it('still calls goBack when the caller cannot report history', () => {
    const navigation = { goBack: jest.fn() };
    leaveScreen(navigation);
    expect(navigation.goBack).toHaveBeenCalled();
  });
});

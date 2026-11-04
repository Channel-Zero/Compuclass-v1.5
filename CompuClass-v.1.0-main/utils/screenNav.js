// Which signed-in routes are section homes (no back button) and which
// sidebar item should look selected for the route currently on screen.

export const ROOT_ROUTES = new Set([
  'Dashboard',
  'Lecturer',
  'LecturerDashboard',
  'Materials',
  'Quiz',
  'Leaderboard',
  'Profile',
]);

const HOME_ROUTES = new Set([
  'Dashboard',
  'Lecturer',
  'LecturerDashboard',
  'FolderContent',
  'StudentProgress',
  'ClassManagement',
  'ContentUpload',
  'ClassDetail',
  'JoinClass',
  'Search',
]);

const NAV_ROUTES = new Set([
  'Materials',
  'Quiz',
  'Leaderboard',
  'Profile',
  'Settings',
  'PC Lab',
  'PC Assembly',
  'Windows 11',
  'Troubleshoot',
  'Chatbot',
]);

export function isRootRoute(routeName) {
  return ROOT_ROUTES.has(routeName);
}

export function navKeyForRoute(routeName) {
  if (!routeName) return null;
  if (routeName === 'QuizCreation' || routeName === 'QuizDetail' || routeName === 'QuizAnalytics') return 'Quiz';
  if (routeName === 'Game' || routeName === 'GameRunnerLobby') return 'GameRunnerLobby';
  if (HOME_ROUTES.has(routeName)) return 'Home';
  if (NAV_ROUTES.has(routeName)) return routeName;
  return null;
}

// Lecturers manage quizzes. The student Quiz screen is the assigned-quiz list.
export function sidebarDestination(screen, role) {
  if (screen === 'Quiz' && role === 'lecturer') {
    return { screen: 'Lecturer', params: { screen: 'QuizCreation' } };
  }
  return screen;
}

export function tabKeyForRoute(routeName, role) {
  if (routeName === 'Settings') return 'Profile';
  const nav = navKeyForRoute(routeName);
  if (nav === 'Home') return role === 'lecturer' ? 'Lecturer' : 'Dashboard';
  if (nav === 'Quiz') return 'Quiz';
  return routeName;
}

// Previous screen when the navigator has history. Otherwise Home.
// Callers that only pass { goBack } (tests, older screens) still go back.
export function leaveScreen(navigation) {
  if (!navigation) return;
  if (typeof navigation.canGoBack === 'function') {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    const names = navigation.getState?.()?.routeNames || [];
    if (names.includes('Lecturer') && !names.includes('Dashboard')) {
      navigation.navigate('Lecturer', { screen: 'LecturerDashboard' });
      return;
    }
    if (typeof navigation.navigate === 'function') {
      navigation.navigate('Dashboard');
      return;
    }
  }
  if (typeof navigation.goBack === 'function') navigation.goBack();
}

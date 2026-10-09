// Paths the web app understands. Anything else is the 404 screen, including
// when the visitor is logged in. Auth still sits in front of these screens:
// a known path shows login until there is a session, then the navigator
// opens that screen.

export const PUBLIC_WEB_PATHS = ['', '/', '/index.html'];

export const LOGGED_IN_WEB_SCREENS = {
  Quiz: 'quiz',
  Profile: 'profile',
  Search: 'search',
  Dashboard: 'dashboard',
  'PC Lab': 'pc-lab',
  'PC Assembly': 'pc-assembly',
  'Windows 11': 'windows',
  Troubleshoot: 'troubleshoot',
  Leaderboard: 'leaderboard',
  Materials: 'materials',
  Settings: 'settings',
  Chatbot: 'chat',
  CircuitMaze: 'maze',
  CircuitMazeLobby: 'maze-lobby',
  CircuitMazeTopic: 'maze-topic',
  Game: 'runner',
  GameRunnerLobby: 'runner-lobby',
};

export const LECTURER_WEB_SCREENS = {
  LecturerDashboard: '',
  FolderContent: 'folder',
  StudentProgress: 'progress',
  ClassManagement: 'classes',
  ContentUpload: 'upload',
  QuizCreation: 'quizzes',
  QuizDetail: 'quiz/:quizId',
  ClassDetail: 'class/:classId',
};

function knownPaths() {
  const paths = new Set(PUBLIC_WEB_PATHS);
  Object.values(LOGGED_IN_WEB_SCREENS).forEach((path) => paths.add(`/${path}`));
  paths.add('/lecturer');
  Object.values(LECTURER_WEB_SCREENS).forEach((path) => {
    if (!path || path.includes(':')) return;
    paths.add(`/lecturer/${path}`);
  });
  return paths;
}

export function isUnknownWebPath(pathname) {
  const path = pathname || '/';
  if (path.startsWith('/lecturer/quiz/') && path.length > '/lecturer/quiz/'.length) return false;
  if (path.startsWith('/lecturer/class/') && path.length > '/lecturer/class/'.length) return false;
  return !knownPaths().has(path);
}

export function linkingConfig(role) {
  const screens = {};
  Object.entries(LOGGED_IN_WEB_SCREENS).forEach(([name, path]) => {
    if (role === 'lecturer' && name === 'Dashboard') return;
    if (role !== 'lecturer' && name === 'Dashboard') screens[name] = path;
    else if (name !== 'Dashboard') screens[name] = path;
  });
  if (role === 'lecturer') {
    screens.Lecturer = { path: 'lecturer', screens: LECTURER_WEB_SCREENS };
  }
  return { screens };
}

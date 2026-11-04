// Screens the database search cannot see. Matching is on the title and a few
// extra words so "runner" finds CompuRunner.

export const APP_SCREENS = [
  { title: 'CompuRunner', screen: 'GameRunnerLobby', blurb: 'Game', terms: ['runner', 'compurunner', 'game'] },
  { title: 'Circuit Maze', screen: 'CircuitMazeTopic', blurb: 'Game', terms: ['maze', 'circuit'] },
  { title: 'PC Lab', screen: 'PC Lab', blurb: 'Lab', terms: ['pc lab', '3d', 'model'] },
  { title: 'PC Assembly', screen: 'PC Assembly', blurb: 'Lab', terms: ['assembly', 'build a pc'] },
  { title: 'Windows 11', screen: 'Windows 11', blurb: 'Simulator', terms: ['windows', 'simulator'] },
  { title: 'Troubleshooting', screen: 'Troubleshoot', blurb: 'Lab', terms: ['troubleshoot', 'troubleshooting'] },
  { title: 'CompuBot', screen: 'Chatbot', blurb: 'Assistant', terms: ['compubot', 'chatbot', 'bot'] },
];

export function findAppScreens(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  return APP_SCREENS.filter((item) => {
    if (item.title.toLowerCase().includes(q)) return true;
    return item.terms.some((term) => term.includes(q));
  });
}

// Lecturers land on the quiz they wrote. Students land on the attempt.
export function quizResultDestination(role, quizId) {
  if (role === 'lecturer') {
    return { name: 'Lecturer', params: { screen: 'QuizDetail', params: { quizId } } };
  }
  return { name: 'Quiz', params: { quizId } };
}

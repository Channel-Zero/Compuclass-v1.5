import { useEffect } from 'react';
import { Platform } from 'react-native';

// Browser tab titles and meta descriptions for the web build. The app has no
// URL routing, so these are set as the user moves between screens. No-ops on
// native.

const SITE_NAME = 'CompuClass';
export const DEFAULT_DESCRIPTION = 'CompuClass is an interactive computer learning platform: build a PC in a virtual lab, practise Windows 11, take quizzes and track your progress.';

export const PAGE_META = {
  Onboarding: { title: 'Welcome', description: 'Get started with CompuClass, the interactive way to learn computer hardware and software skills.' },
  Login: { title: 'Sign In', description: 'Sign in to CompuClass to continue your computer skills lessons, quizzes and PC Lab progress.' },
  SignUp: { title: 'Create Account', description: 'Create a free CompuClass student or lecturer account and start learning computer skills.' },
  ForgotPassword: { title: 'Reset Password', description: 'Reset your CompuClass password with a one-time code sent to your email.' },
  NotFound: { title: 'Page Not Found', description: 'The page you were looking for does not exist on CompuClass.' },

  Dashboard: { title: 'Home', description: 'Your CompuClass home: continue learning, open the PC Lab, play Circuit Maze and see your progress.' },
  Search: { title: 'Search', description: 'Search CompuClass quizzes and learning documents.' },
  Profile: { title: 'My Profile', description: 'View your CompuClass profile, XP, level, streak and badges.' },
  'PC Lab': { title: 'PC Lab', description: 'Explore 3D computer components and learn how to assemble a PC in the CompuClass virtual lab.' },
  'Windows 11': { title: 'Windows 11 Simulator', description: 'Practise using Windows 11 in a safe, browser-based simulator.' },
  Quiz: { title: 'Quizzes', description: 'Take quizzes assigned by your lecturer and test your computer knowledge.' },
  Troubleshoot: { title: 'Troubleshooting Guide', description: 'Step-by-step guides for diagnosing and fixing common computer problems.' },
  Leaderboard: { title: 'Leaderboard', description: 'See how your XP and streak compare with other CompuClass learners.' },
  Materials: { title: 'Learning Materials', description: 'Download learning materials and open quizzes shared by your lecturers.' },
  Settings: { title: 'Settings', description: 'Manage your CompuClass preferences and export your data.' },
  Chatbot: { title: 'CompuBot AI Assistant', description: 'Ask CompuBot questions about computer hardware, software and troubleshooting.' },
  CircuitMazeTopic: { title: 'Circuit Maze: Choose a Topic', description: 'Pick a computing topic for the Circuit Maze quiz game.' },
  CircuitMazeLobby: { title: 'Circuit Maze Lobby', description: 'Start a solo Circuit Maze run or join a multiplayer room.' },
  CircuitMaze: { title: 'Circuit Maze', description: 'Answer questions to route power through the Circuit Maze.' },
  Game: { title: 'CompuRunner', description: 'Dodge obstacles, collect PC components and answer questions to survive.' },

  Lecturer: { title: 'Lecturer Dashboard', description: 'Manage your CompuClass folders, content, quizzes and classes.' },
  LecturerDashboard: { title: 'Lecturer Dashboard', description: 'Manage your CompuClass folders, content, quizzes and classes.' },
  FolderContent: { title: 'Folder Contents', description: 'Documents and quizzes in this CompuClass folder.' },
  StudentProgress: { title: 'Student Progress', description: 'Track quiz results and activity for your CompuClass students.' },
  ClassManagement: { title: 'Class Management', description: 'Create classes and assign students in CompuClass.' },
  ClassDetail: { title: 'Class Details', description: 'Students enrolled in this CompuClass class.' },
  ContentUpload: { title: 'Upload Content', description: 'Upload learning documents for your CompuClass students.' },
  QuizCreation: { title: 'Create Quiz', description: 'Create quizzes manually or generate them from a document with AI.' },
  QuizDetail: { title: 'Quiz Details', description: 'Review the questions in this CompuClass quiz.' },
};

function setMetaTag(name, content) {
  let tag = document.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

export function formatTitle(pageKey) {
  const page = PAGE_META[pageKey];
  return page ? `${page.title} | ${SITE_NAME}` : SITE_NAME;
}

export function setPageMeta(pageKey) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  document.title = formatTitle(pageKey);
  setMetaTag('description', PAGE_META[pageKey]?.description ?? DEFAULT_DESCRIPTION);
}

export function usePageMeta(pageKey) {
  useEffect(() => { setPageMeta(pageKey); }, [pageKey]);
}

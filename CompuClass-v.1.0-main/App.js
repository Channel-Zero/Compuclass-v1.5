import 'react-native-url-polyfill/auto';
import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { View, Text, TouchableOpacity, PanResponder, Animated, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import DashboardScreen from './screens/DashboardScreen';
import PCLabScreen from './screens/PCLabScreen';
import QuizScreen from './screens/QuizScreen';
import TroubleshootingScreen from './screens/TroubleshootingScreen';
import SearchScreen from './screens/SearchScreen';
import ProfileScreen from './screens/ProfileScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import LoginScreen from './screens/LoginScreen';
import SignUpScreen from './screens/SignUpScreen';
import Windows11SimulatorScreen from './screens/Windows11SimulatorScreen';
import LecturerDashboardScreen from './screens/LecturerDashboardScreen';
import FolderContentScreen from './screens/FolderContentScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import StudentProgressScreen from './screens/StudentProgressScreen';
import ClassManagementScreen from './screens/ClassManagementScreen';
import ClassDetailScreen from './screens/ClassDetailScreen';
import ContentUploadScreen from './screens/ContentUploadScreen';
import QuizCreationScreen from './screens/QuizCreationScreen';
import QuizDetailScreen from './screens/QuizDetailScreen';
import StudentMaterialsScreen from './screens/StudentMaterialsScreen';
import SettingsScreen from './screens/SettingsScreen';
import ChatbotScreen from './screens/ChatbotScreen';
import LeaderboardScreen from './screens/LeaderboardScreen';
import CircuitMazeScreen from './screens/CircuitMazeScreen';
import CircuitMazeLobbyScreen from './screens/CircuitMazeLobbyScreen';
import CircuitMazeTopicScreen from './screens/CircuitMazeTopicScreen';
import GameScreen from './screens/GameScreen';
import GameRunnerLobbyScreen from './screens/GameRunnerLobbyScreen';
import NotFoundScreen from './screens/NotFoundScreen';
import Sidebar, { getSidebarHiddenX } from './components/Sidebar';
import ErrorBoundary from './components/ErrorBoundary';
import { installWebAlert } from './utils/webAlert';
import { setPageMeta } from './utils/pageMeta';

import { authService } from './services/authService';
import { supabase } from './config/supabase';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { useOffline } from './hooks/useOffline';

installWebAlert();

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Web only: the app is served entirely from "/", so any other path is a 404.
const KNOWN_WEB_PATHS = ['', '/', '/index.html'];
const isUnknownWebPath = () =>
  Platform.OS === 'web' && typeof window !== 'undefined' && !KNOWN_WEB_PATHS.includes(window.location.pathname);

const BLUE = '#2563EB'; const YELLOW = '#FACC15'; const WHITE = '#FFFFFF';
const BG = '#F3F4F6'; const TEXT = '#111827'; const MUTED = '#4B5563';

function LecturerStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="LecturerDashboard" component={LecturerDashboardScreen} />
      <Stack.Screen name="FolderContent" component={FolderContentScreen} />
      <Stack.Screen name="StudentProgress" component={StudentProgressScreen} />
      <Stack.Screen name="ClassManagement" component={ClassManagementScreen} />
      <Stack.Screen name="ContentUpload" component={ContentUploadScreen} />
      <Stack.Screen name="QuizCreation" component={QuizCreationScreen} />
      <Stack.Screen name="QuizDetail" component={QuizDetailScreen} />
      <Stack.Screen name="ClassDetail" component={ClassDetailScreen} />
    </Stack.Navigator>
  );
}

const MAZE_ROUTES = ['CircuitMaze', 'CircuitMazeLobby', 'CircuitMazeTopic'];
// Routes that take over the whole screen, so the floating tab bar is hidden.
const FULLSCREEN_ROUTES = [...MAZE_ROUTES, 'Chatbot', 'Game', 'GameRunnerLobby', 'Windows 11', 'PC Lab'];

// Floating pill tab bar
function CustomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const visibleTabs = ['Dashboard', 'Lecturer', 'Quiz', 'Profile'];
  // Hooks must run before the early return below; previously useRef came after
  // it, so entering a Circuit Maze screen changed the hook order and crashed.
  const scaleAnims = useRef(visibleTabs.map(() => new Animated.Value(1))).current;
  const currentRouteName = state.routes[state.index]?.name || '';
  if (FULLSCREEN_ROUTES.includes(currentRouteName)) return null;

  const tabConfig = {
    Dashboard: { icon: 'home',        iconOff: 'home-outline',   label: 'Home'    },
    Lecturer:  { icon: 'home',        iconOff: 'home-outline',   label: 'Lecturer'},
    Quiz:      { icon: 'help-circle', iconOff: 'help-circle-outline', label: 'Quiz'},
    Profile:   { icon: 'person',      iconOff: 'person-outline', label: 'Profile' },
  };

  const visibleRoutes = state.routes.filter(r => visibleTabs.includes(r.name));

  return (
    <View style={[styles.tabBarWrapper, { paddingBottom: insets.bottom + 8 }]}>
      <View style={styles.tabBarPill}>
        {visibleRoutes.map((route, index) => {
          const isFocused = state.index === state.routes.indexOf(route);
          const cfg = tabConfig[route.name] || { icon: 'ellipse', iconOff: 'ellipse-outline', label: route.name };

          const onPress = () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            Animated.sequence([
              Animated.timing(scaleAnims[index], { toValue: 0.85, duration: 80, useNativeDriver: true }),
              Animated.spring(scaleAnims[index], { toValue: 1, useNativeDriver: true }),
            ]).start();
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          return (
            <Animated.View key={route.key} style={[styles.tabItem, { transform: [{ scale: scaleAnims[index] }] }]}>
              <TouchableOpacity onPress={onPress} style={styles.tabTouchable} activeOpacity={1}>
                {isFocused && <View style={styles.tabActivePill} />}
                <Ionicons
                  name={isFocused ? cfg.icon : cfg.iconOff}
                  size={22}
                  color={isFocused ? BLUE : MUTED}
                />
                <Text style={[styles.tabLabel, { color: isFocused ? BLUE : MUTED, fontWeight: isFocused ? '800' : '500' }]}>
                  {cfg.label}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

function CustomHeader({ onMenuPress, onLogoPress }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity
        style={styles.headerLeft}
        onPress={onLogoPress}
        activeOpacity={0.75}
        accessibilityRole="link"
        accessibilityLabel="CompuClass home"
      >
        <LinearGradient colors={[BLUE, '#1D4ED8']} style={styles.headerLogoWrap}>
          <Ionicons name="desktop" size={18} color={WHITE} />
        </LinearGradient>
        <View>
          <Text style={styles.headerAppName}>CompuClass</Text>
          <Text style={styles.headerTagline}>Computer Learning Platform</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onMenuPress(); }}
        style={styles.menuBtn}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Open menu"
      >
        <Ionicons name="menu" size={22} color={BLUE} />
      </TouchableOpacity>
    </View>
  );
}

function AppContent() {
  const { theme } = useTheme();
  const { isOnline } = useOffline();
  const [isFirstLaunch, setIsFirstLaunch] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [notFound] = useState(isUnknownWebPath);
  const navigationRef = useRef(null);
  const { width: windowWidth } = useWindowDimensions();
  const sidebarHiddenX = useRef(getSidebarHiddenX(windowWidth));
  sidebarHiddenX.current = getSidebarHiddenX(windowWidth);
  const sidebarTranslateX = useRef(new Animated.Value(sidebarHiddenX.current)).current;
  // Read through a ref: the pan responder is created once, so reading state
  // directly would always see the initial empty route.
  const currentRouteRef = useRef('');

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => {
        // These screens own the full gesture surface, so the sidebar swipe
        // must not steal drags from them.
        if (currentRouteRef.current === 'PC Lab' || currentRouteRef.current === 'Game') return false;
        return g.dx > 20 && Math.abs(g.dy) < 80;
      },
      onPanResponderMove: (_, g) => {
        sidebarTranslateX.setValue(Math.min(0, sidebarHiddenX.current + g.dx));
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx > 50) {
          Animated.spring(sidebarTranslateX, { toValue: 0, useNativeDriver: true }).start();
          setSidebarVisible(true);
        } else {
          Animated.spring(sidebarTranslateX, { toValue: sidebarHiddenX.current, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  useEffect(() => { checkUser(); }, []);

  const preAuthPage = notFound ? 'NotFound'
    : isFirstLaunch ? 'Onboarding'
    : isLoggedIn ? null
    : showSignUp ? 'SignUp'
    : showForgotPassword ? 'ForgotPassword'
    : 'Login';
  useEffect(() => { if (!loading && preAuthPage) setPageMeta(preAuthPage); }, [loading, preAuthPage]);

  const syncRoute = () => {
    const name = navigationRef.current?.getCurrentRoute()?.name || '';
    currentRouteRef.current = name;
    if (name) setPageMeta(name);
  };

  const goHome = () => {
    try {
      if (userRole === 'lecturer') navigationRef.current?.navigate('Lecturer', { screen: 'LecturerDashboard' });
      else navigationRef.current?.navigate('Dashboard');
    } catch {}
  };

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const user = await authService.getCurrentUser();
        if (user) {
          setUserRole(user.profile?.role || 'student');
          setIsLoggedIn(true);
          setIsFirstLaunch(false);
        }
      } else {
        await authService.signOut();
      }
    } catch (error) {
      await authService.signOut();
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    try {
      const user = await authService.getCurrentUser();
      setUserRole(user?.profile?.role || 'student');
      setIsLoggedIn(true);
    } catch {}
  };

  const handleSignUpSuccess = async () => {
    try {
      const user = await authService.getCurrentUser();
      setUserRole(user?.profile?.role || 'student');
      setShowSignUp(false);
      setIsLoggedIn(true);
    } catch {}
  };

  const handleLogout = async () => {
    try {
      await authService.signOut();
      setIsLoggedIn(false);
      setUserRole(null);
    } catch {}
  };

  const handleNavigate = (screen) => {
    try { navigationRef.current?.navigate(screen); } catch {}
  };

  if (notFound) return <NotFoundScreen onGoHome={() => window.location.replace('/')} />;

  if (loading) return null;

  if (isFirstLaunch) return (
    <>
      <StatusBar style="light" />
      <OnboardingScreen onComplete={() => setIsFirstLaunch(false)} />
    </>
  );

  if (!isLoggedIn) {
    if (showSignUp) return (
      <>
        <StatusBar style="dark" />
        <SignUpScreen onSignUp={handleSignUpSuccess} onBackToLogin={() => setShowSignUp(false)} />
      </>
    );
    if (showForgotPassword) return (
      <>
        <StatusBar style="dark" />
        <ForgotPasswordScreen onBackToLogin={() => setShowForgotPassword(false)} />
      </>
    );
    return (
      <>
        <StatusBar style="dark" />
        <LoginScreen onLogin={handleLogin} onSignUp={() => setShowSignUp(true)} onForgotPassword={() => setShowForgotPassword(true)} />
      </>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: WHITE }} edges={['left', 'right']}>
        <NavigationContainer
          ref={navigationRef}
          documentTitle={{ enabled: false }}
          onReady={syncRoute}
          onStateChange={syncRoute}
        >
          <View style={{ flex: 1 }}>
            <StatusBar style="dark" backgroundColor={WHITE} />
            <Tab.Navigator
              tabBar={props => <CustomTabBar {...props} />}
              screenOptions={({ route }) => ({
                header: () => MAZE_ROUTES.includes(route.name) ? null : (
                  <CustomHeader onMenuPress={() => setSidebarVisible(true)} onLogoPress={goHome} />
                ),
                headerShown: !MAZE_ROUTES.includes(route.name),
              })}
            >
              {userRole === 'lecturer' ? (
                <Tab.Screen name="Lecturer" component={LecturerStack} options={{ tabBarLabel: 'Lecturer' }} />
              ) : (
                <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarLabel: 'Home' }} />
              )}
              <Tab.Screen name="Quiz" component={QuizScreen} options={{ tabBarLabel: 'Quiz' }} />
              <Tab.Screen name="Search" component={SearchScreen} options={{ tabBarButton: () => null }} />
              <Tab.Screen name="Profile" options={{ tabBarLabel: 'Profile' }}>
                {() => <ProfileScreen onLogout={handleLogout} />}
              </Tab.Screen>
              <Tab.Screen name="PC Lab" component={PCLabScreen} options={{ tabBarButton: () => null, headerShown: false }} />
              <Tab.Screen name="Windows 11" component={Windows11SimulatorScreen} options={{ tabBarButton: () => null, headerShown: false }} />
              <Tab.Screen name="Troubleshoot" component={TroubleshootingScreen} options={{ tabBarButton: () => null }} />
              <Tab.Screen name="Leaderboard" component={LeaderboardScreen} options={{ tabBarButton: () => null, headerShown: false }} />
              <Tab.Screen name="Materials" component={StudentMaterialsScreen} options={{ tabBarButton: () => null }} />
              <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarButton: () => null }} />
              <Tab.Screen name="Chatbot" component={ChatbotScreen} options={{ tabBarButton: () => null, headerShown: false }} />
              <Tab.Screen name="CircuitMaze" component={CircuitMazeScreen} options={{ tabBarButton: () => null, headerShown: false }} />
              <Tab.Screen name="CircuitMazeLobby" component={CircuitMazeLobbyScreen} options={{ tabBarButton: () => null, headerShown: false }} />
              <Tab.Screen name="CircuitMazeTopic" component={CircuitMazeTopicScreen} options={{ tabBarButton: () => null, headerShown: false }} />
              <Tab.Screen name="Game" component={GameScreen} options={{ tabBarButton: () => null, headerShown: false }} />
              <Tab.Screen name="GameRunnerLobby" component={GameRunnerLobbyScreen} options={{ tabBarButton: () => null, headerShown: false }} />
            </Tab.Navigator>
          </View>
        </NavigationContainer>
        <Sidebar
          visible={sidebarVisible}
          onClose={() => setSidebarVisible(false)}
          onNavigate={handleNavigate}
          onHomePress={goHome}
          translateX={sidebarTranslateX}
        />
      </SafeAreaView>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  // Floating pill tab bar
  tabBarWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  tabBarPill: {
    flexDirection: 'row',
    backgroundColor: WHITE,
    borderRadius: 32,
    paddingVertical: 8,
    paddingHorizontal: 8,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
  },
  tabItem: { flex: 1 },
  tabTouchable: { alignItems: 'center', justifyContent: 'center', paddingVertical: 6, borderRadius: 24, position: 'relative' },
  tabActivePill: {
    position: 'absolute',
    top: 0, left: 4, right: 4, bottom: 0,
    backgroundColor: BLUE + '12',
    borderRadius: 20,
  },
  tabLabel: { fontSize: 11, marginTop: 3 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: WHITE,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerLogoWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerAppName: { fontSize: 17, fontWeight: '900', color: TEXT },
  headerTagline: { fontSize: 11, color: MUTED, marginTop: 1 },
  menuBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: BLUE + '12', alignItems: 'center', justifyContent: 'center' },
});

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </ErrorBoundary>
  );
}
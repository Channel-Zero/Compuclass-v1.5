import 'react-native-url-polyfill/auto';
import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { View, Text, Pressable, StyleSheet, Platform, useWindowDimensions, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useFonts,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

import DashboardScreen from './screens/DashboardScreen';
import PCLabScreen from './screens/PCLabScreen';
import PCAssemblyScreen from './screens/PCAssemblyScreen';
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
import QuizAnalyticsScreen from './screens/QuizAnalyticsScreen';
import StudentMaterialsScreen from './screens/StudentMaterialsScreen';
import SettingsScreen from './screens/SettingsScreen';
import ChatbotScreen from './screens/ChatbotScreen';
import LeaderboardScreen from './screens/LeaderboardScreen';
import CircuitMazeScreen from './screens/CircuitMazeScreen';
import CircuitMazeLobbyScreen from './screens/CircuitMazeLobbyScreen';
import CircuitMazeTopicScreen from './screens/CircuitMazeTopicScreen';
import GameScreen from './screens/GameScreen';
import GameRunnerLobbyScreen from './screens/GameRunnerLobbyScreen';
import JoinClassScreen from './screens/JoinClassScreen';
import NotFoundScreen from './screens/NotFoundScreen';
import Sidebar from './components/Sidebar';
import HeaderSearch from './components/HeaderSearch';
import { EdgeSwipeCatcher, PhoneMenuButton, usePhoneDrawer } from './components/PhoneDrawer';
import ErrorBoundary from './components/ErrorBoundary';
import { Icon } from './components/ui/Icon';
import {
  installWebStyles, ColourField, Glass, IconButton, Mark, Avatar, initials, Sheet, Body, Heading, font, LAPTOP,
} from './components/ui/kit';
import { installWebAlert } from './utils/webAlert';
import { setPageMeta } from './utils/pageMeta';

import { authService } from './services/authService';
import { supabase } from './config/supabase';
import { missingSupabaseConfigMessage } from './config/supabaseClient';
import { sessionCheckDecision } from './utils/sessionCheck';
import { isUnknownWebPath as pathIsUnknown, linkingConfig, onboardingRedirectPath } from './utils/webRoutes';
import { ThemeProvider, useTheme, appTheme } from './context/ThemeContext';
import { ChromeProvider } from './context/ChromeContext';
import { isRootRoute, leaveScreen, tabKeyForRoute } from './utils/screenNav';
import { classService } from './services/classService';
import { filterByClassScope } from './utils/classScope';
import { isScreenPreview, ScreenPreview } from './preview/ScreenPreview';

installWebAlert();
installWebStyles();

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const ONBOARDING_KEY = 'onboardingComplete';
const isUnknownWebPath = () =>
  Platform.OS === 'web' && typeof window !== 'undefined' && pathIsUnknown(window.location.pathname);

const HIDE_TAB_ROUTES = ['CircuitMaze', 'CircuitMazeLobby', 'CircuitMazeTopic', 'Game', 'GameRunnerLobby'];
const HIDE_TOP_ROUTES = ['CircuitMaze', 'Game', 'Windows 11'];
const TAB_ORDER = ['Dashboard', 'Lecturer', 'Materials', 'Quiz', 'Leaderboard', 'Profile'];
const TAB_META = {
  Dashboard: { icon: 'home', label: 'Home' },
  Lecturer: { icon: 'home', label: 'Home' },
  Materials: { icon: 'book', label: 'Learn' },
  Quiz: { icon: 'quiz', label: 'Quizzes' },
  Leaderboard: { icon: 'trophy', label: 'Ranks' },
  Profile: { icon: 'user', label: 'Profile' },
};

function highlightFor(routeName, role) {
  return tabKeyForRoute(routeName, role);
}

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
      <Stack.Screen name="QuizAnalytics" component={QuizAnalyticsScreen} />
      <Stack.Screen name="ClassDetail" component={ClassDetailScreen} />
    </Stack.Navigator>
  );
}

function PhoneTabBar({ state, navigation, userRole, leafRoute }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const current = state.routes[state.index]?.name || '';
  if (HIDE_TAB_ROUTES.includes(current)) return null;
  const highlighted = highlightFor(leafRoute || current, userRole);
  const visible = TAB_ORDER.map((name) => state.routes.find((r) => r.name === name)).filter(Boolean);

  return (
    <View pointerEvents="box-none" style={[styles.tabWrap, { paddingBottom: 25 + insets.bottom }]}>
      <Glass radius={999} style={styles.tabPill}>
        {visible.map((route) => {
          const on = highlighted === route.name || (route.name === 'Lecturer' && highlighted === 'Lecturer');
          const meta = TAB_META[route.name];
          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityLabel={meta.label}
              accessibilityState={{ selected: on }}
              onPress={() => {
                if (userRole === 'lecturer' && route.name === 'Quiz') {
                  navigation.navigate('Lecturer', { screen: 'QuizCreation' });
                  return;
                }
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!on && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              style={[styles.tab, on && { backgroundColor: theme.tabPill }]}
            >
              <Icon name={meta.icon} size={18} color={on ? theme.tabSelected : theme.tabUnselected} tone={on ? 'rgba(10,102,255,0.18)' : 'rgba(26,26,26,0.12)'} />
              <Text style={[{ fontSize: 10, lineHeight: 12, letterSpacing: -0.1, color: on ? theme.tabSelected : theme.tabUnselected }, font(theme, 'semibold')]}>{meta.label}</Text>
            </Pressable>
          );
        })}
      </Glass>
    </View>
  );
}

function BackBar({ routeName, onBack }) {
  if (!routeName || isRootRoute(routeName)) return null;
  return (
    <View style={styles.backBar}>
      <IconButton name="chevLeft" label="Back" onPress={onBack} />
    </View>
  );
}

function TopBar({ laptop, phone, menuOpen, onMenu, hidden, user, onSearch, onBell, onAvatar, dot }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  if (hidden) return null;
  const name = user?.user_metadata?.full_name || user?.profile?.full_name || '';
  return (
    <View style={[styles.topBar, { height: laptop ? 80 : undefined, paddingTop: laptop ? 0 : Math.max(insets.top, 12), paddingHorizontal: laptop ? 40 : 20 }]}>
      {!laptop && (
        <>
          {phone ? <PhoneMenuButton open={menuOpen} onPress={onMenu} /> : null}
          <Mark size={44} />
          <Text style={[{ flex: 1, fontSize: 14, lineHeight: 20, color: theme.textSecondary }, font(theme, 'h2')]} numberOfLines={1}>Computer Learning Platform</Text>
          <IconButton name="search" label="Search" onPress={onSearch} />
        </>
      )}
      {laptop && (
        <HeaderSearch
          onSubmit={onSearch}
          color={theme.text}
          placeholderColor={theme.textTertiary}
          borderColor={theme.border}
          backgroundColor="rgba(255,255,255,0.8)"
        />
      )}
      <IconButton name="bell" label="Announcements" onPress={onBell} dot={dot} />
      {laptop && (
        <Pressable onPress={onAvatar} accessibilityRole="button" accessibilityLabel="Profile" style={styles.me}>
          <Avatar label={initials(name)} image={user?.user_metadata?.avatar_url} size={40} />
        </Pressable>
      )}
    </View>
  );
}

function AnnouncementSheet({ visible, onClose, items }) {
  const { theme } = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title="Announcements">
      {items.length === 0 ? <Body>Nothing new right now.</Body> : (
        <ScrollView style={{ maxHeight: 360 }}>
          {items.map((a) => (
            <View key={a.id} style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: theme.borderLight }}>
              <Heading level={3}>{a.title}</Heading>
              {a.body ? <Body variant="small" style={{ marginTop: 4 }}>{a.body}</Body> : null}
            </View>
          ))}
        </ScrollView>
      )}
    </Sheet>
  );
}

function AppContent() {
  const { theme } = useTheme();
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [isFirstLaunch, setIsFirstLaunch] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [offlineStartup, setOfflineStartup] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [account, setAccount] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [notFound] = useState(isUnknownWebPath);
  const navigationRef = useRef(null);
  const { width } = useWindowDimensions();
  const laptop = width >= LAPTOP;
  const currentRouteRef = useRef('');
  const [routeName, setRouteName] = useState('');
  const drawer = usePhoneDrawer(width, routeName);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    if (isScreenPreview()) {
      setLoading(false);
      setIsFirstLaunch(false);
      return;
    }
    checkUser();
  }, []);

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
    setRouteName(name);
    if (name) setPageMeta(name);
  };

  const goHome = () => {
    try {
      if (userRole === 'lecturer') navigationRef.current?.navigate('Lecturer', { screen: 'LecturerDashboard' });
      else navigationRef.current?.navigate('Dashboard');
    } catch { /* navigator not ready */ }
  };

  const rememberUser = (user) => {
    setAccount(user || null);
    setUserRole(user?.profile?.role || 'student');
  };

  const checkUser = async () => {
    try {
      const seenOnboarding = await AsyncStorage.getItem(ONBOARDING_KEY);
      if (seenOnboarding === '1') setIsFirstLaunch(false);
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (session) {
        const user = await authService.getCurrentUser();
        if (user) {
          rememberUser(user);
          setIsLoggedIn(true);
          setIsFirstLaunch(false);
          setOfflineStartup(false);
        }
      } else {
        await authService.signOut();
        setIsLoggedIn(false);
        setOfflineStartup(false);
      }
    } catch (error) {
      if (sessionCheckDecision(error) === 'signOut') {
        await authService.signOut();
        setIsLoggedIn(false);
        setOfflineStartup(false);
      } else {
        setOfflineStartup(true);
        const cached = await authService.getOfflineUser();
        if (cached) {
          rememberUser(cached);
          setIsLoggedIn(true);
          setIsFirstLaunch(false);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoggedIn) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(6);
        const scope = await classService.classScopeForCurrentUser();
        if (!cancelled) setAnnouncements(filterByClassScope(data || [], scope));
      } catch { if (!cancelled) setAnnouncements([]); }
    })();
    return () => { cancelled = true; };
  }, [isLoggedIn]);

  const finishOnboarding = async (destination) => {
    try { await AsyncStorage.setItem(ONBOARDING_KEY, '1'); } catch { /* still leave onboarding */ }
    if (destination === 'signup') setShowSignUp(true);
    setIsFirstLaunch(false);
  };

  const handleLogin = async () => {
    try {
      const user = await authService.getCurrentUser();
      rememberUser(user);
      setIsLoggedIn(true);
    } catch { /* session check will retry on next launch */ }
  };

  const handleSignUpSuccess = async () => {
    try {
      const user = await authService.getCurrentUser();
      rememberUser(user);
      setShowSignUp(false);
      setIsLoggedIn(true);
    } catch { /* email confirmation may still be pending */ }
  };

  const handleLogout = async () => {
    try {
      await authService.signOut();
      setIsLoggedIn(false);
      setUserRole(null);
      setAccount(null);
    } catch { /* keep the current session if sign-out fails */ }
  };

  const handleNavigate = (target) => {
    try {
      if (target && typeof target === 'object') {
        navigationRef.current?.navigate(target.screen, target.params);
        return;
      }
      navigationRef.current?.navigate(target);
    } catch { /* navigator not ready */ }
  };

  if (!supabase) {
    const copy = missingSupabaseConfigMessage();
    return (
      <View style={[styles.offlineGate, { backgroundColor: theme.background }]} accessibilityRole="alert">
        <StatusBar style="dark" />
        <Text style={{ color: theme.text, fontSize: 22, lineHeight: 28, fontWeight: '700', textAlign: 'center' }}>{copy.title}</Text>
        <Text style={{ color: theme.textSecondary, fontSize: 16, lineHeight: 24, textAlign: 'center', marginTop: 12 }}>{copy.body}</Text>
      </View>
    );
  }

  if ((!fontsLoaded && !fontError) || loading) {
    return (
      <View style={[styles.boot, { backgroundColor: theme.background }]}>
        <StatusBar style="dark" />
        <Mark size={72} />
      </View>
    );
  }

  if (isScreenPreview()) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <StatusBar style="dark" />
        <ColourField />
        <ScreenPreview />
      </View>
    );
  }

  if (notFound) return <NotFoundScreen onGoHome={() => window.location.replace('/')} />;

  if (!isFirstLaunch && Platform.OS === 'web' && typeof window !== 'undefined') {
    const nextPath = onboardingRedirectPath({
      pathname: window.location.pathname,
      onboarded: true,
      loggedIn: isLoggedIn,
      role: userRole,
    });
    if (nextPath) window.history.replaceState(null, '', nextPath);
  }

  if (offlineStartup && !isLoggedIn) return (
    <View style={[styles.offlineGate, { backgroundColor: theme.background }]}>
      <StatusBar style="dark" />
      <Heading level={2}>You are offline</Heading>
      <Body style={{ textAlign: 'center', marginVertical: 16 }}>We could not check your session. Connect and try again. You have not been signed out.</Body>
      <Pressable style={[styles.offlineBtn, { backgroundColor: theme.primary }]} onPress={() => { setLoading(true); checkUser(); }} accessibilityRole="button">
        <Text style={[{ color: '#fff', fontSize: 16 }, font(theme, 'semibold')]}>Try again</Text>
      </Pressable>
    </View>
  );

  if (isFirstLaunch) return (
    <>
      <StatusBar style="dark" />
      <OnboardingScreen onComplete={() => finishOnboarding('login')} onCreateAccount={() => finishOnboarding('signup')} />
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

  const hideChrome = HIDE_TOP_ROUTES.includes(routeName);
  const runnerTakeover = routeName === 'Game';
  const shellBack = Boolean(routeName) && !isRootRoute(routeName);
  const handleBack = () => {
    if (drawer.open || drawer.dragging) {
      drawer.close();
      return;
    }
    leaveScreen(navigationRef.current);
  };

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <ColourField />
        <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['left', 'right']}>
          <View style={{ flex: 1, flexDirection: 'row', zIndex: 1 }}>
            {laptop && !runnerTakeover && (
              <Sidebar
                docked
                onNavigate={handleNavigate}
                onHomePress={goHome}
                currentScreen={routeName}
                user={account}
              />
            )}
            <View style={{ flex: 1 }}>
              <NavigationContainer
                ref={navigationRef}
                theme={{ ...DefaultTheme, colors: { ...DefaultTheme.colors, background: appTheme.background } }}
                documentTitle={{ enabled: false }}
                linking={{
                  prefixes: [Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : 'compuclass://'],
                  config: linkingConfig(userRole),
                }}
                onReady={syncRoute}
                onStateChange={syncRoute}
              >
                <ChromeProvider value={{ shellBack }}>
                <View style={{ flex: 1 }}>
                  <StatusBar style="dark" />
                  {offlineStartup && (
                    <Text style={[styles.offlineBanner, { backgroundColor: theme.warningWash, color: theme.warningInk }]}>You are offline. Some features need a connection.</Text>
                  )}
                  <TopBar
                    laptop={laptop}
                    phone={drawer.phone}
                    menuOpen={drawer.open}
                    onMenu={drawer.toggle}
                    hidden={hideChrome}
                    user={account}
                    dot={announcements.length > 0}
                    onSearch={(query) => {
                      if (typeof query === 'string' && query.trim()) handleNavigate({ screen: 'Search', params: { query: query.trim() } });
                      else handleNavigate('Search');
                    }}
                    onBell={() => setShowAnnouncements(true)}
                    onAvatar={() => handleNavigate('Profile')}
                  />
                  {runnerTakeover ? null : <BackBar routeName={routeName} onBack={handleBack} />}
                  <View style={styles.stage}>
                  <Tab.Navigator
                    backBehavior="history"
                    tabBar={(props) => (laptop ? null : <PhoneTabBar {...props} userRole={userRole} leafRoute={routeName} />)}
                    screenOptions={{ headerShown: false }}
                  >
                    {userRole === 'lecturer' ? (
                      <Tab.Screen name="Lecturer" component={LecturerStack} />
                    ) : (
                      <Tab.Screen name="Dashboard" component={DashboardScreen} />
                    )}
                    <Tab.Screen name="Materials" component={StudentMaterialsScreen} />
                    <Tab.Screen name="Quiz" component={QuizScreen} />
                    <Tab.Screen name="Leaderboard" component={LeaderboardScreen} />
                    <Tab.Screen name="Profile">
                      {() => <ProfileScreen onLogout={handleLogout} />}
                    </Tab.Screen>
                    <Tab.Screen name="Search" component={SearchScreen} />
                    <Tab.Screen name="PC Lab" component={PCLabScreen} />
                    <Tab.Screen name="PC Assembly" component={PCAssemblyScreen} />
                    <Tab.Screen name="Windows 11" component={Windows11SimulatorScreen} />
                    <Tab.Screen name="Troubleshoot" component={TroubleshootingScreen} />
                    <Tab.Screen name="JoinClass" component={JoinClassScreen} />
                    <Tab.Screen name="Settings">
                      {() => <SettingsScreen onLogout={handleLogout} />}
                    </Tab.Screen>
                    <Tab.Screen name="Chatbot" component={ChatbotScreen} />
                    <Tab.Screen name="CircuitMaze" component={CircuitMazeScreen} />
                    <Tab.Screen name="CircuitMazeLobby" component={CircuitMazeLobbyScreen} />
                    <Tab.Screen name="CircuitMazeTopic" component={CircuitMazeTopicScreen} />
                    <Tab.Screen name="Game" component={GameScreen} options={{ unmountOnBlur: true }} />
                    <Tab.Screen name="GameRunnerLobby" component={GameRunnerLobbyScreen} options={{ unmountOnBlur: true }} />
                  </Tab.Navigator>
                  {drawer.phone && !runnerTakeover && (
                    <Sidebar
                      retain
                      visible={drawer.open || drawer.dragging}
                      suspendAnimation={drawer.dragging}
                      pointerEvents={drawer.dragging ? 'none' : 'auto'}
                      translateX={drawer.translateX}
                      onClose={drawer.close}
                      onNavigate={handleNavigate}
                      onHomePress={goHome}
                      currentScreen={routeName}
                      user={account}
                    />
                  )}
                  <EdgeSwipeCatcher
                    enabled={drawer.edgeEnabled && !drawer.open}
                    onMove={drawer.onEdgeMove}
                    onEnd={drawer.onEdgeEnd}
                  />
                  </View>
                </View>
                </ChromeProvider>
              </NavigationContainer>
            </View>
          </View>
        </SafeAreaView>
        <AnnouncementSheet visible={showAnnouncements} onClose={() => setShowAnnouncements(false)} items={announcements} />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 16, paddingHorizontal: 25, zIndex: 20 },
  tabPill: { flexDirection: 'row', padding: 4, alignItems: 'stretch' },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: 1, paddingTop: 6, paddingBottom: 7, paddingHorizontal: 8, borderRadius: 999 },
  backBar: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 4, zIndex: 6, alignItems: 'flex-start' },
  stage: { flex: 1, overflow: 'hidden', position: 'relative' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, zIndex: 5 },
  me: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  offlineGate: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  offlineBtn: { minHeight: 48, minWidth: 44, paddingHorizontal: 24, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  offlineBanner: { textAlign: 'center', paddingVertical: 8, paddingHorizontal: 12, fontSize: 13, fontWeight: '600' },
});

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

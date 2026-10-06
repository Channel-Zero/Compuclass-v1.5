import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { View, Text, TouchableOpacity, PanResponder, Animated, Dimensions, StyleSheet, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import Sidebar from './components/Sidebar';

import { authService } from './services/authService';
import { supabase } from './config/supabase';
import { ThemeProvider } from './context/ThemeContext';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
const { width } = Dimensions.get('window');

const BLUE = '#2563EB'; const WHITE = '#FFFFFF';
const TEXT = '#111827'; const MUTED = '#4B5563';
const ONBOARDING_KEY = 'hasCompletedOnboarding';

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

// Floating pill tab bar
function CustomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const visibleTabs = ['Dashboard', 'Lecturer', 'Search', 'Profile'];
  const scaleAnims = useRef(visibleTabs.map(() => new Animated.Value(1))).current;

  const tabConfig = {
    Dashboard: { icon: 'home', iconOff: 'home-outline', label: 'Home' },
    Lecturer:  { icon: 'home', iconOff: 'home-outline', label: 'Lecturer' },
    Search:    { icon: 'search', iconOff: 'search-outline', label: 'Search' },
    Profile:   { icon: 'person', iconOff: 'person-outline', label: 'Profile' },
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

function CustomHeader({ onMenuPress }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <View style={styles.headerLeft}>
        <LinearGradient colors={[BLUE, '#1D4ED8']} style={styles.headerLogoWrap}>
          <Ionicons name="desktop" size={18} color={WHITE} />
        </LinearGradient>
        <View>
          <Text style={styles.headerAppName}>CompuClass</Text>
          <Text style={styles.headerTagline}>Computer Learning Platform</Text>
        </View>
      </View>
      <TouchableOpacity
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onMenuPress(); }}
        style={styles.menuBtn}
        activeOpacity={0.75}
      >
        <Ionicons name="menu" size={22} color={BLUE} />
      </TouchableOpacity>
    </View>
  );
}

function AppContent() {
  const [isFirstLaunch, setIsFirstLaunch] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [currentRoute, setCurrentRoute] = useState('');
  const navigationRef = useRef(null);
  const sidebarTranslateX = useRef(new Animated.Value(-width * 0.8)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => {
        if (currentRoute === 'PC Lab') return false;
        return g.dx > 20 && Math.abs(g.dy) < 80;
      },
      onPanResponderMove: (_, g) => {
        sidebarTranslateX.setValue(Math.min(0, -width * 0.8 + g.dx));
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx > 50) {
          Animated.spring(sidebarTranslateX, { toValue: 0, useNativeDriver: true }).start();
          setSidebarVisible(true);
        } else {
          Animated.spring(sidebarTranslateX, { toValue: -width * 0.8, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    checkUser();
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') checkUser();
    });
    const interval = setInterval(checkUser, 60 * 1000);
    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, []);

  const checkUser = async () => {
    try {
      const seen = await AsyncStorage.getItem(ONBOARDING_KEY);
      if (seen === 'true') setIsFirstLaunch(false);
      const { data: { session } } = await supabase.auth.getSession();
      if (session && await authService.isSessionValid()) {
        await authService.touchSession();
        const user = await authService.getCurrentUser();
        if (user) {
          setUserRole(user.profile?.role || 'student');
          setIsLoggedIn(true);
          setIsFirstLaunch(false);
          await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
        }
      } else {
        if (session) await authService.signOut();
        setIsLoggedIn(false);
        setUserRole(null);
      }
    } catch (error) {
      await authService.signOut();
      setIsLoggedIn(false);
      setUserRole(null);
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

  if (loading) return null;

  if (isFirstLaunch) return (
    <>
      <StatusBar style="light" />
      <OnboardingScreen onComplete={async () => {
        await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
        setIsFirstLaunch(false);
      }} />
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
      <SafeAreaView style={{ flex: 1, backgroundColor: WHITE }} edges={['left', 'right']}>
        <NavigationContainer
          ref={navigationRef}
          onStateChange={() => {
            const route = navigationRef.current?.getCurrentRoute();
            setCurrentRoute(route?.name || '');
          }}
        >
          <View style={{ flex: 1 }} {...panResponder.panHandlers}>
            <StatusBar style="dark" backgroundColor={WHITE} />
            <Tab.Navigator
              tabBar={props => <CustomTabBar {...props} />}
              screenOptions={{
                header: () => (
                  <CustomHeader onMenuPress={() => setSidebarVisible(true)} />
                ),
              }}
            >
              {userRole === 'lecturer' ? (
                <Tab.Screen name="Lecturer" component={LecturerStack} options={{ tabBarLabel: 'Lecturer' }} />
              ) : (
                <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarLabel: 'Home' }} />
              )}
              <Tab.Screen name="Search" component={SearchScreen} options={{ tabBarLabel: 'Search', headerShown: false }} />
              <Tab.Screen name="Profile" options={{ tabBarLabel: 'Profile' }}>
                {() => <ProfileScreen onLogout={handleLogout} />}
              </Tab.Screen>
              <Tab.Screen name="PC Lab" component={PCLabScreen} options={{ tabBarButton: () => null, headerShown: false }} />
              <Tab.Screen name="Windows 11" component={Windows11SimulatorScreen} options={{ tabBarButton: () => null, headerShown: false }} />
              <Tab.Screen name="Quiz" component={QuizScreen} options={{ tabBarButton: () => null, headerShown: false }} />
              <Tab.Screen name="Troubleshoot" component={TroubleshootingScreen} options={{ tabBarButton: () => null, headerShown: false }} />
              <Tab.Screen name="Materials" component={StudentMaterialsScreen} options={{ tabBarButton: () => null, headerShown: false }} />
              <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarButton: () => null, headerShown: false }} />
              <Tab.Screen name="Chatbot" component={ChatbotScreen} options={{ tabBarButton: () => null, headerShown: false }} />
            </Tab.Navigator>
          </View>
        </NavigationContainer>
        <Sidebar
          visible={sidebarVisible}
          onClose={() => setSidebarVisible(false)}
          onNavigate={handleNavigate}
          translateX={sidebarTranslateX}
        />
      </SafeAreaView>
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
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

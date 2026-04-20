import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { View, Text, TouchableOpacity, PanResponder, Animated, Dimensions, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

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
import StudentProgressScreen from './screens/StudentProgressScreen';
import ClassManagementScreen from './screens/ClassManagementScreen';
import ClassDetailScreen from './screens/ClassDetailScreen';
import ContentUploadScreen from './screens/ContentUploadScreen';
import QuizCreationScreen from './screens/QuizCreationScreen';
import QuizDetailScreen from './screens/QuizDetailScreen';
import StudentMaterialsScreen from './screens/StudentMaterialsScreen';
import SettingsScreen from './screens/SettingsScreen';
import Sidebar from './components/Sidebar';

import { authService } from './services/authService';
import { supabase } from './config/supabase';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { useOffline } from './hooks/useOffline';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

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

const { width } = Dimensions.get('window');

function CustomTabBar({ state, descriptors, navigation }) {
  const { theme } = useTheme();
  const visibleTabs = ['Dashboard', 'Lecturer', 'Search', 'Profile'];
  
  return (
    <View style={[styles.tabBar, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
      {state.routes.filter(route => visibleTabs.includes(route.name)).map((route, index) => {
        const { options } = descriptors[route.key];
        const label = options.tabBarLabel || route.name;
        const isFocused = state.index === state.routes.indexOf(route);

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        let iconName;
        if (route.name === 'Dashboard' || route.name === 'Lecturer') {
          iconName = isFocused ? 'home' : 'home-outline';
        } else if (route.name === 'Search') {
          iconName = isFocused ? 'search' : 'search-outline';
        } else if (route.name === 'Profile') {
          iconName = isFocused ? 'person' : 'person-outline';
        }

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            style={styles.tabItem}
          >
            <Ionicons
              name={iconName}
              size={28}
              color={isFocused ? theme.primary : theme.textTertiary}
            />
            <Text style={[styles.tabLabel, { color: isFocused ? theme.primary : theme.textTertiary }]}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function CustomHeader({ title, showBadge = false, onMenuPress }) {
  const { theme } = useTheme();
  return (
    <LinearGradient
      colors={theme.headerGradient}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <LinearGradient
          colors={['#10B981', '#059669']}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
        >
          <Ionicons name="desktop" size={20} color="#fff" />
        </LinearGradient>
        <View>
          <Text style={{
            fontSize: 18,
            fontWeight: 'bold',
            color: theme.text,
          }}>
            CompuClass
          </Text>
          <Text style={{
            fontSize: 12,
            color: theme.textSecondary,
          }}>
            Computer Learning Platform
          </Text>
        </View>
      </View>
      
      <TouchableOpacity onPress={onMenuPress} style={{ padding: 8 }}>
        <Ionicons name="menu" size={24} color={theme.primary} />
      </TouchableOpacity>
    </LinearGradient>
  );
}

function AppContent() {
  const { theme } = useTheme();
  const { isOnline } = useOffline();
  const [isFirstLaunch, setIsFirstLaunch] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sidebarVisible, setSidebarVisible] = useState(false);

  const [userRole, setUserRole] = useState(null);
  const [currentRoute, setCurrentRoute] = useState('');
  const navigationRef = useRef(null);

  const sidebarTranslateX = useRef(new Animated.Value(-width * 0.8)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Disable sidebar swipe when in PC Lab
        if (currentRoute === 'PC Lab') return false;
        return gestureState.dx > 20 && Math.abs(gestureState.dy) < 80;
      },
      onPanResponderMove: (_, gestureState) => {
        const newValue = Math.min(0, -width * 0.8 + gestureState.dx);
        sidebarTranslateX.setValue(newValue);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 50) {
          Animated.spring(sidebarTranslateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
          setSidebarVisible(true);
        } else {
          Animated.spring(sidebarTranslateX, {
            toValue: -width * 0.8,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;



  useEffect(() => {
    console.log('🚀 App initializing...');
    checkUser();
  }, []);

  const checkUser = async () => {
    console.log('🔍 Checking user session...');
    try {
      // Force logout all users - remove this after first run
      await supabase.auth.signOut();
      setLoading(false);
      return;
      
      const { data: { session } } = await supabase.auth.getSession();
      console.log('📱 Session status:', session ? 'Active' : 'No session');
      
      if (session) {
        const user = await authService.getCurrentUser();
        console.log('👤 User data:', user ? `${user.email} (${user.profile?.role})` : 'No user');
        
        if (user) {
          setUserRole(user.profile?.role || 'student');
          setIsLoggedIn(true);
          setIsFirstLaunch(false);
          console.log('✅ User authenticated successfully');
        }
      } else {
        console.log('⚠️ No session found, signing out...');
        await authService.signOut();
      }
    } catch (error) {
      console.error('❌ Error checking user:', error);
      console.error('Error details:', error.message);
      await authService.signOut();
    } finally {
      setLoading(false);
      console.log('✅ App initialization complete');
    }
  };

  const handleOnboardingComplete = () => {
    console.log('✅ Onboarding completed');
    setIsFirstLaunch(false);
  };

  const handleLogin = async () => {
    console.log('🔐 Handling login...');
    try {
      const user = await authService.getCurrentUser();
      console.log('👤 Login user:', user ? `${user.email} (${user.profile?.role})` : 'No user');
      setUserRole(user?.profile?.role || 'student');
      setIsLoggedIn(true);
      console.log('✅ Login successful');
    } catch (error) {
      console.error('❌ Login error:', error);
    }
  };

  const handleShowSignUp = () => {
    console.log('📝 Showing sign up screen');
    setShowSignUp(true);
  };

  const handleBackToLogin = () => {
    console.log('🔙 Back to login screen');
    setShowSignUp(false);
  };

  const handleSignUpSuccess = async () => {
    console.log('✅ Sign up successful, logging in...');
    try {
      const user = await authService.getCurrentUser();
      console.log('👤 New user:', user ? `${user.email} (${user.profile?.role})` : 'No user');
      setUserRole(user?.profile?.role || 'student');
      setShowSignUp(false);
      setIsLoggedIn(true);
    } catch (error) {
      console.error('❌ Sign up success handler error:', error);
    }
  };

  const handleLogout = async () => {
    console.log('🚪 Logging out...');
    try {
      await authService.signOut();
      setIsLoggedIn(false);
      setUserRole(null);
      console.log('✅ Logout successful');
    } catch (error) {
      console.error('❌ Logout error:', error);
    }
  };

  const handleNavigate = (screen) => {
    console.log('🧭 Navigating to:', screen);
    try {
      navigationRef.current?.navigate(screen);
    } catch (error) {
      console.error('❌ Navigation error:', error);
    }
  };

  if (loading) {
    console.log('⏳ App loading...');
    return null;
  }

  if (isFirstLaunch) {
    console.log('👋 Showing onboarding screen');
    return (
      <>
        <StatusBar style="light" backgroundColor="#0F172A" />
        <OnboardingScreen onComplete={handleOnboardingComplete} />
      </>
    );
  }

  if (!isLoggedIn) {
    if (showSignUp) {
      console.log('📝 Showing sign up screen');
      return (
        <>
          <StatusBar style="light" backgroundColor="#0F172A" />
          <SignUpScreen onSignUp={handleSignUpSuccess} onBackToLogin={handleBackToLogin} />
        </>
      );
    }
    console.log('🔐 Showing login screen');
    return (
      <>
        <StatusBar style="light" backgroundColor="#0F172A" />
        <LoginScreen onLogin={handleLogin} onSignUp={handleShowSignUp} />
      </>
    );
  }

  console.log('🏠 Rendering main app, user role:', userRole);
  
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface }} edges={['top', 'left', 'right']}>
        <NavigationContainer 
          ref={navigationRef}
          onStateChange={() => {
            const route = navigationRef.current?.getCurrentRoute();
            setCurrentRoute(route?.name || '');
          }}
        >
          <View style={{ flex: 1 }} {...panResponder.panHandlers}>
            <StatusBar style="dark" backgroundColor="#F0FDF4" />
            <Tab.Navigator
              tabBar={props => <CustomTabBar {...props} />}
              screenOptions={({ route }) => ({
                header: ({ route }) => (
                  <CustomHeader 
                    title={route.name} 
                    showBadge={route.name === 'Dashboard'}
                    onMenuPress={() => setSidebarVisible(true)}
                  />
                ),
              })}
            >
              {userRole === 'lecturer' ? (
                <Tab.Screen 
                  name="Lecturer" 
                  component={LecturerStack}
                  options={{ 
                    title: 'Lecturer',
                    tabBarLabel: 'Lecturer'
                  }}
                />
              ) : (
                <Tab.Screen 
                  name="Dashboard" 
                  component={DashboardScreen}
                  options={{ 
                    title: 'Home',
                    tabBarLabel: 'Home'
                  }}
                />
              )}
              <Tab.Screen 
                name="Search" 
                component={SearchScreen}
                options={{ 
                  title: 'Search',
                  tabBarLabel: 'Search'
                }}
              />
              <Tab.Screen 
                name="Profile" 
                options={{ 
                  title: 'Profile',
                  tabBarLabel: 'Profile'
                }}
              >
                {() => <ProfileScreen onLogout={handleLogout} />}
              </Tab.Screen>
              <Tab.Screen 
                name="PC Lab" 
                component={PCLabScreen}
                options={{ 
                  title: 'PC Lab',
                  tabBarButton: () => null,
                  headerShown: false,
                  tabBarStyle: { display: 'none' }
                }}
              />
              <Tab.Screen 
                name="Windows 11" 
                component={Windows11SimulatorScreen}
                options={({ route }) => ({ 
                  title: 'Windows 11',
                  tabBarButton: () => null,
                  headerShown: false,
                  tabBarStyle: { display: 'none' }
                })}
              />
              <Tab.Screen 
                name="Quiz" 
                component={QuizScreen}
                options={{ 
                  title: 'Quiz',
                  tabBarButton: () => null
                }}
              />
              <Tab.Screen 
                name="Troubleshoot" 
                component={TroubleshootingScreen}
                options={{ 
                  title: 'Troubleshoot',
                  tabBarButton: () => null
                }}
              />
              <Tab.Screen 
                name="Materials" 
                component={StudentMaterialsScreen}
                options={{ 
                  title: 'Materials',
                  tabBarButton: () => null
                }}
              />
              <Tab.Screen 
                name="Settings" 
                component={SettingsScreen}
                options={{ 
                  title: 'Settings',
                  tabBarButton: () => null
                }}
              />
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
  tabBar: {
    flexDirection: 'row',
    height: 80,
    borderTopWidth: 1,
    paddingBottom: 15,
    paddingTop: 15,
    paddingHorizontal: 20,
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    zIndex: 1,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 6,
  },
});

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

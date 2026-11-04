import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Animated, PanResponder, useWindowDimensions, Easing, BackHandler, Platform, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { Icon } from './ui/Icon';
import { Glass, Mark, Wordmark, Avatar, initials, font } from './ui/kit';
import { navKeyForRoute, sidebarDestination } from '../utils/screenNav';
import { useReducedMotion } from '../hooks/useReducedMotion';
import {
  claimDrawerClose,
  drawerTransitionMs,
  isDrawerDismissKey,
  shouldCloseFromDrawer,
} from '../utils/drawerGesture';

const SIDEBAR_MAX_WIDTH = 360;
export const DOCKED_SIDEBAR_WIDTH = 256;
export const RAIL_SIDEBAR_WIDTH = 72;
export const SIDEBAR_COLLAPSED_KEY = 'compuclass.sidebarCollapsed';

export const getSidebarWidth = (windowWidth) => Math.min(windowWidth * 0.78, SIDEBAR_MAX_WIDTH);
export const getSidebarHiddenX = (windowWidth) => -(getSidebarWidth(windowWidth) + 24);
export const sidebarWidthFor = (collapsed) => (collapsed ? RAIL_SIDEBAR_WIDTH : DOCKED_SIDEBAR_WIDTH);

export async function readSidebarCollapsed(storage = AsyncStorage) {
  try {
    return (await storage.getItem(SIDEBAR_COLLAPSED_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function writeSidebarCollapsed(storage, collapsed) {
  try {
    await storage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    // The menu still collapses for this session if storage is unavailable.
  }
}

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false);
  const ignoreRead = React.useRef(false);
  useEffect(() => {
    let alive = true;
    readSidebarCollapsed(AsyncStorage).then((value) => {
      if (alive && !ignoreRead.current) setCollapsed(value);
    });
    return () => { alive = false; };
  }, []);
  const toggleCollapsed = useCallback(() => {
    ignoreRead.current = true;
    setCollapsed((current) => {
      const next = !current;
      writeSidebarCollapsed(AsyncStorage, next);
      return next;
    });
  }, []);
  return { collapsed, toggleCollapsed };
}

export const PRIMARY_NAV = [
  { icon: 'home', title: 'Home', screen: 'Home' },
  { icon: 'book', title: 'Learning materials', screen: 'Materials' },
  { icon: 'quiz', title: 'Quizzes', screen: 'Quiz' },
  { icon: 'trophy', title: 'Leaderboard', screen: 'Leaderboard' },
  { icon: 'user', title: 'Profile', screen: 'Profile' },
  { icon: 'sliders', title: 'Settings', screen: 'Settings' },
];

export const EXPLORE_NAV = [
  { icon: 'monitor', title: 'PC Lab', screen: 'PC Lab' },
  { icon: 'cpu', title: 'PC Assembly', screen: 'PC Assembly' },
  { icon: 'windows', title: 'Windows 11', screen: 'Windows 11' },
  { icon: 'wrench', title: 'Troubleshooting', screen: 'Troubleshoot' },
  { icon: 'bot', title: 'CompuBot', screen: 'Chatbot' },
  { icon: 'gamepad', title: 'CompuRunner', screen: 'GameRunnerLobby' },
];

function animateDrawer(value, toValue, reduced, onEnd) {
  value.stopAnimation();
  if (drawerTransitionMs(reduced) === 0) {
    value.setValue(toValue);
    onEnd?.();
    return;
  }
  Animated.timing(value, {
    toValue,
    duration: drawerTransitionMs(reduced),
    easing: Easing.out(Easing.cubic),
    // Android drops a native-driver animation that starts before the drawer
    // view is attached, which leaves the menu and scrim off-screen.
    useNativeDriver: Platform.OS !== 'android',
  }).start(({ finished }) => {
    if (finished) onEnd?.();
  });
}

function NavItem({ item, active, collapsed, onPress, theme }) {
  return (
    <Pressable
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={item.title}
      accessibilityState={{ selected: active }}
      aria-selected={active}
      title={collapsed ? item.title : undefined}
      style={[
        styles.nav,
        collapsed && styles.navRail,
        active && { backgroundColor: '#fff', shadowColor: '#0B1B3A', shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
      ]}
    >
      <Icon name={item.icon} size={20} color={active ? theme.primary : theme.textSecondary} />
      {collapsed ? null : (
        <Text style={[{ flex: 1, fontSize: 14, lineHeight: 20, color: active ? theme.primary : theme.textSecondary }, font(theme, 'semibold')]}>{item.title}</Text>
      )}
    </Pressable>
  );
}

function NavList({ currentScreen, onPress, user, collapsed }) {
  const { theme } = useTheme();
  const name = user?.user_metadata?.full_name || user?.profile?.full_name || 'Learner';
  const points = user?.profile?.xp;
  return (
    <>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {PRIMARY_NAV.map((item) => (
          <NavItem key={item.screen} item={item} active={navKeyForRoute(currentScreen) === item.screen} collapsed={collapsed} onPress={onPress} theme={theme} />
        ))}
        {collapsed ? null : (
          <Text style={[{ fontSize: 12, lineHeight: 16, color: theme.textTertiary, paddingHorizontal: 12, paddingTop: 24, paddingBottom: 8 }, font(theme, 'semibold')]}>Explore</Text>
        )}
        {EXPLORE_NAV.map((item) => (
          <NavItem key={item.screen} item={item} active={navKeyForRoute(currentScreen) === item.screen} collapsed={collapsed} onPress={onPress} theme={theme} />
        ))}
      </ScrollView>
      <Pressable
        onPress={() => onPress({ screen: 'Profile' })}
        accessibilityRole="button"
        accessibilityLabel={collapsed ? `Open profile, ${name}` : 'Open profile'}
        title={collapsed ? name : undefined}
        style={[styles.user, collapsed && styles.userRail, { borderColor: theme.border, backgroundColor: 'rgba(255,255,255,0.7)' }]}
      >
        <Avatar label={initials(name)} size={collapsed ? 36 : 40} />
        {collapsed ? null : (
          <View style={{ flex: 1 }}>
            <Text style={[{ fontSize: 14, color: theme.text }, font(theme, 'semibold')]} numberOfLines={1}>{name}</Text>
            <Text style={[{ fontSize: 12, color: theme.textTertiary }, font(theme, 'body')]} numberOfLines={1}>
              {typeof points === 'number' ? `${points.toLocaleString()} pts` : 'CompuClass'}
            </Text>
          </View>
        )}
      </Pressable>
    </>
  );
}

export default function Sidebar({ visible, docked, collapsed = false, onToggleCollapsed, onClose, onNavigate, onHomePress, translateX: externalTranslateX, suspendAnimation, pointerEvents, retain, currentScreen, user }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const dockedWidth = sidebarWidthFor(collapsed);
  const sidebarWidth = docked ? dockedWidth : getSidebarWidth(windowWidth);
  const dockedWidthAnim = React.useRef(new Animated.Value(dockedWidth)).current;
  const hiddenX = getSidebarHiddenX(windowWidth);
  const hiddenXRef = React.useRef(hiddenX);
  hiddenXRef.current = hiddenX;
  const reducedRef = React.useRef(reduced);
  reducedRef.current = reduced;
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;
  const internalTranslateX = React.useRef(new Animated.Value(hiddenX)).current;
  const translateX = externalTranslateX || internalTranslateX;
  const [shown, setShown] = React.useState(!!visible);
  const shownRef = React.useRef(!!visible);
  const animGen = React.useRef(0);

  React.useEffect(() => {
    if (!docked) return undefined;
    const next = sidebarWidthFor(collapsed);
    if (drawerTransitionMs(reduced) === 0) {
      dockedWidthAnim.setValue(next);
      return undefined;
    }
    Animated.timing(dockedWidthAnim, {
      toValue: next,
      duration: drawerTransitionMs(reduced),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return undefined;
  }, [collapsed, docked, reduced, dockedWidthAnim]);

  React.useEffect(() => {
    if (docked) return undefined;
    if (suspendAnimation) {
      if (visible) {
        shownRef.current = true;
        setShown(true);
      }
      return undefined;
    }
    const gen = ++animGen.current;
    if (visible) {
      shownRef.current = true;
      setShown(true);
      // The shared value is created off-screen. On Android that animation
      // often finishes before any view is listening, so snap it open once
      // the menu is actually being shown.
      if (Platform.OS === 'android') translateX.setValue(0);
      else animateDrawer(translateX, 0, reducedRef.current);
      return undefined;
    }
    if (!shownRef.current) return undefined;
    animateDrawer(translateX, hiddenXRef.current, reducedRef.current, () => {
      if (animGen.current !== gen) return;
      shownRef.current = false;
      setShown(false);
    });
    return undefined;
    // translateX is a stable Animated.Value owned by this drawer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, docked, suspendAnimation, reduced]);

  React.useEffect(() => {
    if (!visible || docked) return undefined;
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return undefined;
    const onKey = (event) => {
      if (!isDrawerDismissKey(event)) return;
      event.preventDefault?.();
      onCloseRef.current?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener?.('keydown', onKey);
  }, [visible, docked]);

  React.useEffect(() => {
    if (!visible || docked || typeof BackHandler.addEventListener !== 'function') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onCloseRef.current?.();
      return true;
    });
    return () => sub?.remove?.();
  }, [visible, docked]);

  const finishCloseSwipe = React.useRef(() => {});
  finishCloseSwipe.current = (gesture) => {
    if (shouldCloseFromDrawer(gesture)) onCloseRef.current?.();
    else animateDrawer(translateX, 0, reducedRef.current);
  };

  const panResponder = React.useRef(PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, gesture) => claimDrawerClose(gesture),
    onMoveShouldSetPanResponder: (_, gesture) => claimDrawerClose(gesture),
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => translateX.stopAnimation(),
    onPanResponderMove: (_, gesture) => {
      const next = gesture.dx < 0 ? Math.max(hiddenXRef.current, gesture.dx) : 0;
      translateX.setValue(next);
    },
    onPanResponderRelease: (_, gesture) => finishCloseSwipe.current(gesture),
    onPanResponderTerminate: () => animateDrawer(translateX, 0, reducedRef.current),
  })).current;

  const onPress = (item) => {
    if (item.screen === 'Home') onHomePress?.();
    else onNavigate?.(sidebarDestination(item.screen, user?.profile?.role));
    onClose?.();
  };

  const body = (
    <View style={{ flex: 1, paddingTop: docked ? 24 : insets.top + 16, paddingHorizontal: collapsed ? 8 : 16, paddingBottom: 16 }}>
      <View style={[styles.brandBlock, collapsed && styles.brandRail]}>
        <Pressable onPress={() => { onHomePress?.(); onClose?.(); }} accessibilityRole="link" accessibilityLabel="CompuClass home">
          <View style={styles.brandMark}>
            <Mark size={collapsed ? 40 : 48} />
            {collapsed ? null : <Wordmark />}
          </View>
        </Pressable>
        {onToggleCollapsed ? (
          <Pressable
            onPress={onToggleCollapsed}
            accessibilityRole="button"
            accessibilityLabel={collapsed ? 'Expand menu' : 'Collapse menu'}
            accessibilityState={{ expanded: !collapsed }}
            title={collapsed ? 'Expand menu' : 'Collapse menu'}
            style={[styles.collapseBtn, { backgroundColor: theme.glassFill, borderColor: theme.glassBorder, alignSelf: collapsed ? 'center' : 'flex-end' }]}
          >
            <Icon name={collapsed ? 'chev' : 'chevLeft'} size={20} color={theme.text} />
          </Pressable>
        ) : null}
      </View>
      <NavList currentScreen={currentScreen} onPress={onPress} user={user} collapsed={collapsed && docked} />
    </View>
  );

  if (docked) {
    return (
      <Animated.View style={{ width: dockedWidthAnim, height: '100%' }}>
        <Glass sidebar radius={0} style={[styles.dock, { width: '100%', borderRightColor: 'rgba(220,230,239,0.9)', backgroundColor: theme.glassSidebar }]}>
          {body}
        </Glass>
      </Animated.View>
    );
  }

  // Closed and not retained: nothing to paint. Retained (the phone shell)
  // keeps the animated views mounted so the shared translateX has a node
  // before the hamburger opens.
  if (!shown && !visible && !retain) return null;

  const interactive = (!!visible || shown) && pointerEvents !== 'none';
  // Android: a native-driver value shared from PhoneDrawer stays at its
  // off-screen start, so the scrim (opacity 0) and the panel never appear.
  // Pin the open menu on screen instead of trusting that value.
  const pinOpen = Platform.OS === 'android' && !!visible && !suspendAnimation;
  const backdropOpacity = translateX.interpolate({
    inputRange: [hiddenX === 0 ? -1 : hiddenX, 0],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const drawerTree = (
    <View
      testID="phone-drawer-overlay"
      pointerEvents={interactive ? 'auto' : 'none'}
      accessibilityViewIsModal={interactive}
      accessibilityElementsHidden={!interactive}
      importantForAccessibility={interactive ? 'auto' : 'no-hide-descendants'}
      collapsable={false}
      style={[styles.overlay, Platform.OS === 'web' ? { userSelect: 'none' } : null]}
    >
      <Animated.View pointerEvents="none" style={[styles.backdrop, { opacity: pinOpen ? 1 : backdropOpacity, backgroundColor: theme.overlay }]} />
      <Pressable
        testID="drawer-backdrop"
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close menu"
      />
      <Animated.View
        testID="phone-drawer"
        style={[
          styles.drawer,
          { width: sidebarWidth, transform: [{ translateX: pinOpen ? 0 : translateX }] },
          Platform.OS === 'web' ? { touchAction: 'pan-y' } : null,
        ]}
        {...panResponder.panHandlers}
      >
        <Glass sidebar radius={0} style={[styles.drawerGlass, { backgroundColor: theme.glassSidebar, borderRightColor: 'rgba(220,230,239,0.9)' }]}>
          {body}
        </Glass>
      </Animated.View>
    </View>
  );

  // A transparent Modal sits above native screens. The in-tree copy is what
  // an edge swipe drives, and what stays mounted while the menu is closed.
  if (Platform.OS === 'android' && !suspendAnimation && (!!visible || shown)) {
    return (
      <Modal
        visible
        transparent
        animationType="none"
        statusBarTranslucent
        hardwareAccelerated
        presentationStyle="overFullScreen"
        onRequestClose={() => onCloseRef.current?.()}
      >
        <View style={[styles.modalFill, { height: windowHeight }]}>{drawerTree}</View>
      </Modal>
    );
  }

  return drawerTree;
}

const styles = StyleSheet.create({
  modalFill: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 30, elevation: 30 },
  backdrop: { ...StyleSheet.absoluteFillObject },
  drawer: { position: 'absolute', left: 0, top: 0, bottom: 0, borderTopRightRadius: 24, borderBottomRightRadius: 24, overflow: 'hidden' },
  drawerGlass: {
    flex: 1,
    height: '100%',
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  dock: { position: 'relative', height: '100%', borderRadius: 0, borderTopWidth: 0, borderBottomWidth: 0, borderLeftWidth: 0, shadowOpacity: 0, elevation: 0 },
  brandBlock: { paddingHorizontal: 8, paddingBottom: 16, gap: 8 },
  brandMark: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  brandRail: { alignItems: 'center', paddingHorizontal: 0 },
  collapseBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 44, paddingHorizontal: 12, borderRadius: 12 },
  navRail: { justifyContent: 'center', paddingHorizontal: 0 },
  user: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, borderWidth: 1, marginTop: 8 },
  userRail: { justifyContent: 'center', padding: 8 },
});

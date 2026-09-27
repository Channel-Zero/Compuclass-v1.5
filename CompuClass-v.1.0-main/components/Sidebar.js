import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Animated, PanResponder, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

// 78% of the screen on phones, capped so it isn't enormous on tablets/desktop web.
const SIDEBAR_MAX_WIDTH = 360;
export const getSidebarWidth = (windowWidth) => Math.min(windowWidth * 0.78, SIDEBAR_MAX_WIDTH);
// Fully off-screen, including the drop shadow.
export const getSidebarHiddenX = (windowWidth) => -(getSidebarWidth(windowWidth) + 24);

const BLUE = '#2563EB'; const YELLOW = '#FACC15'; const RED = '#EF4444';
const GREEN = '#22C55E'; const PURPLE = '#8B5CF6'; const WHITE = '#FFFFFF';
const BG = '#F3F4F6'; const TEXT = '#111827'; const MUTED = '#4B5563';

const menuItems = [
  { icon: 'book',        title: 'Learning Materials', screen: 'Materials',    color: PURPLE },
  { icon: 'desktop',     title: 'PC Lab',             screen: 'PC Lab',       color: GREEN  },
  { icon: 'laptop',      title: 'Windows 11',         screen: 'Windows 11',   color: BLUE   },
  { icon: 'help-circle', title: 'Quiz',               screen: 'Quiz',         color: YELLOW },
  { icon: 'podium',      title: 'Leaderboard',        screen: 'Leaderboard',  color: PURPLE },
  { icon: 'bug',         title: 'Troubleshooting',    screen: 'Troubleshoot', color: RED    },
  { icon: 'settings',    title: 'Settings',           screen: 'Settings',     color: MUTED  },
];

export default function Sidebar({ visible, onClose, onNavigate, onHomePress, translateX: externalTranslateX }) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const sidebarWidth = getSidebarWidth(windowWidth);
  const hiddenX = getSidebarHiddenX(windowWidth);
  const hiddenXRef = React.useRef(hiddenX);
  hiddenXRef.current = hiddenX;
  const internalTranslateX = React.useRef(new Animated.Value(hiddenX)).current;
  const translateX = externalTranslateX || internalTranslateX;
  const [modalVisible, setModalVisible] = React.useState(visible);

  React.useEffect(() => {
    if (visible) {
      setModalVisible(true);
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
    } else {
      Animated.spring(translateX, { toValue: hiddenXRef.current, useNativeDriver: true }).start(() => {
        setModalVisible(false);
      });
    }
    // translateX is a stable Animated.Value ref (internal or external prop); re-running on its identity isn't needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const panResponder = React.useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10,
    onPanResponderMove: (_, g) => { if (g.dx < 0) translateX.setValue(g.dx); },
    onPanResponderRelease: (_, g) => {
      if (g.dx < -50) Animated.spring(translateX, { toValue: hiddenXRef.current, useNativeDriver: true }).start(onClose);
      else Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
    },
  })).current;

  if (!modalVisible) return null;

  return (
    <Modal visible={modalVisible} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} accessibilityLabel="Close menu" />
        <Animated.View style={[styles.sidebar, { width: sidebarWidth, transform: [{ translateX }] }]} {...panResponder.panHandlers}>

          <LinearGradient colors={[BLUE, '#1D4ED8']} style={[styles.header, { paddingTop: insets.top + 16 }]}>
            <TouchableOpacity
              style={styles.headerLeft}
              onPress={() => { onHomePress?.(); onClose(); }}
              activeOpacity={0.8}
              accessibilityRole="link"
              accessibilityLabel="CompuClass home"
            >
              <View style={styles.headerIconWrap}>
                <Ionicons name="desktop" size={22} color={BLUE} />
              </View>
              <Text style={styles.headerTitle}>CompuClass</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel="Close menu">
              <Ionicons name="close" size={24} color={WHITE} />
            </TouchableOpacity>
          </LinearGradient>

          <ScrollView style={styles.menuScroll} contentContainerStyle={styles.menuContent} showsVerticalScrollIndicator={false}>
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.menuItem}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onNavigate(item.screen); onClose(); }}
                activeOpacity={0.75}
              >
                <View style={[styles.menuIconWrap, { backgroundColor: item.color }]}>
                  <Ionicons name={item.icon} size={20} color={item.color === YELLOW ? TEXT : WHITE} />
                </View>
                <Text style={styles.menuTitle}>{item.title}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
            <Text style={styles.footerText}>CompuClass v1.0 · © {new Date().getFullYear()}</Text>
          </View>

        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sidebar: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: WHITE, elevation: 20, shadowColor: '#000', shadowOffset: { width: 4, height: 0 }, shadowOpacity: 0.2, shadowRadius: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 20 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: WHITE, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '900', color: WHITE },
  menuScroll: { flex: 1 },
  menuContent: { paddingTop: 12, paddingHorizontal: 16, paddingBottom: 12 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 14, marginBottom: 4, gap: 14 },
  menuIconWrap: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  menuTitle: { fontSize: 15, fontWeight: '700', color: TEXT },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  footerText: { fontSize: 12, color: MUTED, textAlign: 'center' },
});
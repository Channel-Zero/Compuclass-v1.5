import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions, Animated, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');

const BLUE = '#2563EB'; const YELLOW = '#FACC15'; const RED = '#EF4444';
const GREEN = '#22C55E'; const PURPLE = '#8B5CF6'; const WHITE = '#FFFFFF';
const TEXT = '#111827'; const MUTED = '#4B5563';

const menuItems = [
  { icon: 'book',        title: 'Learning Materials', screen: 'Materials',    color: PURPLE },
  { icon: 'desktop',     title: 'PC Lab',             screen: 'PC Lab',       color: GREEN  },
  { icon: 'laptop',      title: 'Windows 11',         screen: 'Windows 11',   color: BLUE   },
  { icon: 'help-circle', title: 'Quiz',               screen: 'Quiz',         color: YELLOW },
  { icon: 'bug',         title: 'Troubleshooting',    screen: 'Troubleshoot', color: RED    },
  { icon: 'settings',    title: 'Settings',           screen: 'Settings',     color: MUTED  },
];

export default function Sidebar({ visible, onClose, onNavigate }) {
  const insets = useSafeAreaInsets();
  const translateX = React.useRef(new Animated.Value(-width)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 0 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(translateX, { toValue: -width, useNativeDriver: true, bounciness: 0 }),
        Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const panResponder = React.useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dx < -10,
    onPanResponderMove: (_, g) => { if (g.dx < 0) translateX.setValue(g.dx); },
    onPanResponderRelease: (_, g) => {
      if (g.dx < -50) {
        Animated.spring(translateX, { toValue: -width, useNativeDriver: true, bounciness: 0 }).start(onClose);
      } else {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
      }
    },
  })).current;

  if (!visible && translateX._value <= -width + 1) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)', opacity }]} pointerEvents={visible ? 'auto' : 'none'}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      </Animated.View>

      {/* Drawer */}
      <Animated.View
        style={[styles.sidebar, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <LinearGradient colors={[BLUE, '#1D4ED8']} style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIconWrap}>
              <Ionicons name="desktop" size={22} color={BLUE} />
            </View>
            <Text style={styles.headerTitle}>CompuClass</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={24} color={WHITE} />
          </TouchableOpacity>
        </LinearGradient>

        <ScrollView style={styles.menuScroll} showsVerticalScrollIndicator={false}>
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

        <View style={styles.footer}>
          <Text style={styles.footerText}>CompuClass v1.0</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    width: width * 0.78, backgroundColor: WHITE,
    elevation: 20, zIndex: 999,
    shadowColor: '#000', shadowOffset: { width: 4, height: 0 }, shadowOpacity: 0.2, shadowRadius: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 20 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: WHITE, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '900', color: WHITE },
  menuScroll: { flex: 1, paddingTop: 12, paddingHorizontal: 16 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 14, marginBottom: 4, gap: 14 },
  menuIconWrap: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  menuTitle: { fontSize: 15, fontWeight: '700', color: TEXT },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  footerText: { fontSize: 12, color: MUTED, textAlign: 'center' },
});

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Dimensions,
  Animated,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

export default function Sidebar({ visible, onClose, onNavigate, translateX: externalTranslateX }) {
  const { theme } = useTheme();
  const internalTranslateX = React.useRef(new Animated.Value(-width * 0.8)).current;
  const translateX = externalTranslateX || internalTranslateX;

  React.useEffect(() => {
    if (!externalTranslateX) {
      Animated.spring(translateX, {
        toValue: visible ? 0 : -width * 0.8,
        useNativeDriver: true,
      }).start();
    } else if (visible) {
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, externalTranslateX]);

  const panResponder = React.useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 10,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          translateX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -50) {
          Animated.spring(translateX, {
            toValue: -width * 0.8,
            useNativeDriver: true,
          }).start(onClose);
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;
  const menuItems = [
    { icon: 'book', title: 'Learning Materials', screen: 'Materials', color: '#8B5CF6' },
    { icon: 'desktop', title: 'PC Lab', screen: 'PC Lab', color: '#10B981' },
    { icon: 'laptop', title: 'Windows 11', screen: 'Windows 11', color: '#3B82F6' },
    { icon: 'help-circle', title: 'Quiz', screen: 'Quiz', color: '#F59E0B' },
    { icon: 'bug', title: 'Troubleshooting', screen: 'Troubleshoot', color: '#EF4444' },
    { icon: 'settings', title: 'Settings', screen: 'Settings', color: '#6B7280' },
  ];

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: theme.overlay }]}>
        <TouchableOpacity 
          style={StyleSheet.absoluteFill} 
          activeOpacity={1} 
          onPress={onClose}
        />
        <Animated.View style={[styles.sidebar, { backgroundColor: theme.background, transform: [{ translateX }] }]} {...panResponder.panHandlers}>
          <LinearGradient colors={theme.primaryGradient} style={styles.header}>
            <View style={styles.headerContent}>
              <Ionicons name="desktop" size={24} color="#fff" />
              <Text style={styles.headerTitle}>CompuClass</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </LinearGradient>

          <ScrollView style={[styles.menuContainer, { backgroundColor: theme.background }]}>
            {menuItems.slice(0, -1).map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.menuItem, { backgroundColor: theme.surface }]}
                onPress={() => {
                  onNavigate(item.screen);
                  onClose();
                }}
              >
                <View style={[styles.menuIcon, { backgroundColor: item.color + '20' }]}>
                  <Ionicons name={item.icon} size={24} color={item.color} />
                </View>
                <Text style={[styles.menuTitle, { color: theme.text }]}>{item.title}</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          <View style={[styles.bottomMenu, { borderTopColor: theme.border, backgroundColor: theme.background }]}>
            <TouchableOpacity
              style={[styles.menuItem, { backgroundColor: theme.surface }]}
              onPress={() => {
                onNavigate('Settings');
                onClose();
              }}
            >
              <View style={[styles.menuIcon, { backgroundColor: '#6B728020' }]}>
                <Ionicons name="settings" size={24} color="#6B7280" />
              </View>
              <Text style={[styles.menuTitle, { color: theme.text }]}>Settings</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: width * 0.8,
    backgroundColor: '#fff',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 12,
  },
  menuContainer: {
    padding: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginBottom: 12,
  },
  menuIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  menuTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  bottomMenu: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
});

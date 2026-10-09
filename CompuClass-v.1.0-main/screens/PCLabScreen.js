import React, { useState, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Animated, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import RealAR from '../components/RealAR';
import RamAR from '../components/RamAR';
import MotherboardAR from '../components/MotherboardAR';
import StorageAR from '../components/StorageAR';
import CPUAR from '../components/CPUAR';
import GPUAR from '../components/GPUAR';
import PSUAR from '../components/PSUAR';

const GREEN = '#22C55E'; const WHITE = '#FFFFFF'; const BG = '#F3F4F6';
const TEXT = '#111827'; const MUTED = '#4B5563';

const components = [
  { id: 'motherboard', name: 'Motherboard',  icon: 'hardware-chip',    color: '#2563EB' },
  { id: 'cpu',         name: 'CPU',           icon: 'speedometer',      color: '#EF4444' },
  { id: 'ram',         name: 'RAM',           icon: 'albums',           color: '#8B5CF6' },
  { id: 'gpu',         name: 'Graphics Card', icon: 'tv',               color: '#F59E0B' },
  { id: 'storage',     name: 'Storage (SSD)', icon: 'save',             color: '#22C55E' },
  { id: 'psu',         name: 'Power Supply',  icon: 'battery-charging', color: '#EC4899' },
];

const steps = ['Install Motherboard', 'Install CPU', 'Install RAM', 'Install Graphics Card', 'Install Storage', 'Connect Power Supply'];

export default function PCLabScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  // Live width/height so the grid and AR viewer follow window resizes and
  // adapt to tablets/laptops, not just phone-sized viewports.
  const { width, height } = useWindowDimensions();
  const contentWidth = Math.min(width, 960);
  const numColumns = width < 500 ? 2 : width < 900 ? 3 : 4;
  const cardGap = 16;
  const cardWidth = (contentWidth - 32 - cardGap * (numColumns - 1)) / numColumns;
  const arHeight = Math.min(480, Math.max(260, height * 0.4));
  const [selectedComponents, setSelectedComponents] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showMotherboardFullscreen, setShowMotherboardFullscreen] = useState(false);
  const [showCPUFullscreen, setShowCPUFullscreen] = useState(false);
  const [showRAMFullscreen, setShowRAMFullscreen] = useState(false);
  const [showGPUFullscreen, setShowGPUFullscreen] = useState(false);
  const [showStorageFullscreen, setShowStorageFullscreen] = useState(false);
  const [showPSUFullscreen, setShowPSUFullscreen] = useState(false);

  const cardScales = useRef(components.map(() => new Animated.Value(1))).current;

  const animateCard = (index, onDone) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.timing(cardScales[index], { toValue: 0.92, duration: 80, useNativeDriver: true }),
      Animated.spring(cardScales[index], { toValue: 1, useNativeDriver: true }),
    ]).start(onDone);
  };

  const openComponentViewer = (id) => {
    if (id === 'motherboard') setShowMotherboardFullscreen(true);
    else if (id === 'cpu') setShowCPUFullscreen(true);
    else if (id === 'ram') setShowRAMFullscreen(true);
    else if (id === 'gpu') setShowGPUFullscreen(true);
    else if (id === 'storage') setShowStorageFullscreen(true);
    else if (id === 'psu') setShowPSUFullscreen(true);
  };

  const handleComponentPress = (id, index) => {
    animateCard(index, () => {
      if (currentStep >= steps.length) return;
      if (id === components[currentStep].id) {
        setSelectedComponents([...selectedComponents, id]);
        setCurrentStep(currentStep + 1);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (currentStep === steps.length - 1) {
          Alert.alert('Congratulations! 🎉', 'You have successfully assembled your PC!', [
            { text: 'Start New Build', onPress: () => { setSelectedComponents([]); setCurrentStep(0); } },
          ]);
        }
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Wrong Component', `Next step: ${steps[currentStep]}`);
      }
    });
  };

  const FullscreenView = ({ onBack, children }) => (
    <View style={styles.fullscreenContainer}>
      <TouchableOpacity style={[styles.fullscreenBackBtn, { top: insets.top + 10 }]} onPress={onBack}>
        <Ionicons name="arrow-back" size={24} color={WHITE} />
      </TouchableOpacity>
      {children}
    </View>
  );

  if (showMotherboardFullscreen) return <FullscreenView onBack={() => setShowMotherboardFullscreen(false)}><MotherboardAR /></FullscreenView>;
  if (showCPUFullscreen)         return <FullscreenView onBack={() => setShowCPUFullscreen(false)}><CPUAR /></FullscreenView>;
  if (showRAMFullscreen)         return <FullscreenView onBack={() => setShowRAMFullscreen(false)}><RamAR /></FullscreenView>;
  if (showGPUFullscreen)         return <FullscreenView onBack={() => setShowGPUFullscreen(false)}><GPUAR /></FullscreenView>;
  if (showStorageFullscreen)     return <FullscreenView onBack={() => setShowStorageFullscreen(false)}><StorageAR /></FullscreenView>;
  if (showPSUFullscreen)         return <FullscreenView onBack={() => setShowPSUFullscreen(false)}><PSUAR /></FullscreenView>;

  if (isFullscreen) return (
    <View style={styles.fullscreenContainer}>
      <TouchableOpacity style={[styles.fullscreenBackBtn, { top: insets.top + 10 }]} onPress={() => setIsFullscreen(false)}>
        <Ionicons name="arrow-back" size={24} color={WHITE} />
      </TouchableOpacity>
      <RealAR />
      {showInstructions && (
        <View style={styles.instructionsOverlay}>
          <View style={styles.instructionsCard}>
            <View style={styles.instructionsHeader}>
              <Text style={styles.instructionsTitle}>How to Use 3D Viewer</Text>
              <TouchableOpacity onPress={() => setShowInstructions(false)}>
                <Ionicons name="close" size={20} color={TEXT} />
              </TouchableOpacity>
            </View>
            {[
              { icon: 'hand-left', color: '#2563EB', text: 'Drag to rotate the 3D PC model' },
              { icon: 'resize',    color: '#22C55E', text: 'Pinch to zoom in/out' },
              { icon: 'construct', color: '#F59E0B', text: 'Tap components to learn more' },
            ].map((item, i) => (
              <View key={i} style={styles.instructionRow}>
                <Ionicons name={item.icon} size={18} color={item.color} />
                <Text style={styles.instructionText}>{item.text}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={[styles.floatingBackBtn, { top: insets.top + 12 }]}
        activeOpacity={0.75}
      >
        <Ionicons name="arrow-back" size={22} color={WHITE} />
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}>
      <View style={[styles.content, { maxWidth: 960, width: '100%', alignSelf: 'center', marginTop: insets.top + 64 }]}>
        {/* 3D Model */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>3D PC Model</Text>
          <TouchableOpacity
            style={styles.expandBtn}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setIsFullscreen(true); setShowInstructions(true); }}
            activeOpacity={0.75}
          >
            <Ionicons name="expand" size={16} color={GREEN} />
            <Text style={styles.expandText}>Fullscreen</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.arContainer, { height: arHeight }]}><RealAR /></View>

        {/* Components */}
        <Text style={[styles.sectionTitle, { marginTop: 20, marginBottom: 4 }]}>Available Components</Text>
        <Text style={styles.stepHint}>
          {currentStep < steps.length ? `Next step: ${steps[currentStep]}` : 'Build complete'}
        </Text>
        <View style={styles.componentsGrid}>
          {components.map((component, index) => {
            const installed = selectedComponents.includes(component.id);
            return (
              <Animated.View key={component.id} style={{ transform: [{ scale: cardScales[index] }], width: cardWidth }}>
                <TouchableOpacity
                  style={[styles.componentCard, installed && styles.componentInstalled]}
                  onPress={() => handleComponentPress(component.id, index)}
                  disabled={installed}
                  activeOpacity={0.75}
                >
                  <View style={[styles.componentIconWrap, { backgroundColor: installed ? '#E5E7EB' : component.color }]}>
                    <Ionicons name={component.icon} size={26} color={installed ? MUTED : WHITE} />
                  </View>
                  <Text style={[styles.componentName, installed && styles.componentNameInstalled]}>{component.name}</Text>
                  {installed && (
                    <View style={styles.installedBadge}>
                      <Ionicons name="checkmark" size={12} color={WHITE} />
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => openComponentViewer(component.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${component.name} model`}
                  style={styles.viewModelBtn}
                >
                  <Text style={styles.viewModelText}>View model</Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  floatingBackBtn: {
    position: 'absolute', left: 16, zIndex: 10,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(17,24,39,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  content: { paddingHorizontal: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: TEXT },
  expandBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 8, backgroundColor: GREEN + '20', borderRadius: 10 },
  expandText: { fontSize: 12, fontWeight: '700', color: GREEN },
  arContainer: { borderRadius: 16, overflow: 'hidden', borderWidth: 3, borderColor: GREEN },
  componentsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  componentCard: { backgroundColor: WHITE, borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3, position: 'relative' },
  componentInstalled: { opacity: 0.5 },
  componentIconWrap: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  componentName: { fontSize: 13, fontWeight: '700', color: TEXT, textAlign: 'center' },
  stepHint: { fontSize: 14, fontWeight: '700', color: MUTED, marginBottom: 12 },
  viewModelBtn: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  viewModelText: { fontSize: 13, fontWeight: '700', color: '#2563EB' },
  componentNameInstalled: { color: MUTED },
  installedBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: GREEN, borderRadius: 10, width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  fullscreenContainer: { flex: 1, backgroundColor: '#000' },
  fullscreenBackBtn: { position: 'absolute', left: 20, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: 10 },
  instructionsOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 2 },
  instructionsCard: { backgroundColor: WHITE, borderRadius: 20, padding: 24, marginHorizontal: 24, alignSelf: 'stretch', maxWidth: 520 },
  instructionsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  instructionsTitle: { fontSize: 17, fontWeight: '800', color: TEXT },
  instructionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 12 },
  instructionText: { fontSize: 14, color: MUTED, flex: 1 },
});

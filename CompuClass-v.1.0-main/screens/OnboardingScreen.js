import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, FlatList, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const WHITE = '#FFFFFF'; const TEXT = '#111827'; const MUTED = '#4B5563';

const slides = [
  { id: '1', title: 'Learn Computer Skills', subtitle: 'Master essential computer knowledge with interactive lessons', icon: 'desktop', colors: ['#2563EB', '#1D4ED8'] },
  { id: '2', title: 'Practice in PC Lab',    subtitle: 'Hands-on experience with virtual computer environments',    icon: 'hardware-chip', colors: ['#22C55E', '#16A34A'] },
  { id: '3', title: 'Test Your Knowledge',   subtitle: 'Take quizzes and track your progress as you learn',         icon: 'trophy', colors: ['#FACC15', '#EAB308'] },
];

export default function OnboardingScreen({ onComplete }) {
  // Live dimensions: each slide must be exactly one window wide, even after a resize.
  const { width, height } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      const next = currentIndex + 1;
      flatListRef.current?.scrollToIndex({ index: next });
      setCurrentIndex(next);
    } else { onComplete(); }
  };

  const renderItem = ({ item }) => (
    <View style={{ width, height }}>
      <LinearGradient colors={item.colors} style={styles.slideGradient}>
        <View style={[styles.iconWrap, { marginBottom: height * 0.06 }]}>
          <Ionicons name={item.icon} size={64} color={WHITE} />
        </View>
        <Text style={styles.slideTitle}>{item.title}</Text>
        <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
      </LinearGradient>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderItem}
        horizontal pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
        onMomentumScrollEnd={(e) => setCurrentIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
      />

      <View style={styles.bottom}>
        <View style={styles.dotsRow}>
          {slides.map((_, i) => {
            const dotWidth = scrollX.interpolate({ inputRange: [(i - 1) * width, i * width, (i + 1) * width], outputRange: [8, 28, 8], extrapolate: 'clamp' });
            const bg = currentIndex === i ? slides[currentIndex].colors[0] : '#D1D5DB';
            return <Animated.View key={i} style={[styles.dot, { width: dotWidth, backgroundColor: bg }]} />;
          })}
        </View>

        <View style={styles.btnRow}>
          <TouchableOpacity onPress={onComplete} style={styles.skipBtn}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.nextBtn, { backgroundColor: slides[currentIndex].colors[0] }]} onPress={handleNext} activeOpacity={0.85}>
            <Text style={styles.nextText}>{currentIndex === slides.length - 1 ? 'Get Started' : 'Next'}</Text>
            <Ionicons name={currentIndex === slides.length - 1 ? 'checkmark' : 'arrow-forward'} size={18} color={currentIndex === 2 ? TEXT : WHITE} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: WHITE },
  slideGradient: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  iconWrap: { width: 130, height: 130, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  slideTitle: { fontSize: 32, fontWeight: '900', color: WHITE, textAlign: 'center', marginBottom: 16 },
  slideSubtitle: { fontSize: 17, color: 'rgba(255,255,255,0.9)', textAlign: 'center', lineHeight: 26 },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: WHITE, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 28, paddingTop: 24, paddingBottom: 48 },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 24, gap: 6 },
  dot: { height: 8, borderRadius: 4 },
  btnRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  skipBtn: { paddingVertical: 12, paddingHorizontal: 20 },
  skipText: { color: MUTED, fontSize: 15, fontWeight: '600' },
  nextBtn: { flex: 1, marginLeft: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 54, borderRadius: 14, gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  nextText: { fontSize: 16, fontWeight: '800', color: WHITE },
});

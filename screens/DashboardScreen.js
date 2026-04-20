import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

export default function DashboardScreen({ navigation }) {
  const { theme } = useTheme();
  const stats = [
    { title: 'Learning Modules', value: '25+', icon: 'library', color: '#10B981' },
    { title: 'PC Components', value: '50+', icon: 'hardware-chip', color: '#3B82F6' },
    { title: 'Students Learning', value: '1000+', icon: 'people', color: '#8B5CF6' },
    { title: 'Success Rate', value: '95%', icon: 'trophy', color: '#F59E0B' },
  ];

  const learningFeatures = [
    { title: 'Component Learning', icon: 'hardware-chip', color: '#10B981' },
    { title: 'Drag & Drop Assembly', icon: 'construct', color: '#3B82F6' },
    { title: 'Troubleshooting', icon: 'bug', color: '#8B5CF6' },
    { title: 'Interactive Quizzes', icon: 'help-circle', color: '#F59E0B' },
  ];

  const highlights = [
    { title: 'Real-time Assembly', description: 'Drag components into the PC case', icon: 'flash' },
    { title: 'Smart Guidance', description: 'Step-by-step hints and feedback', icon: 'bulb' },
    { title: 'Progress Tracking', description: 'Monitor your learning journey', icon: 'analytics' },
  ];

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.surface }]}>
      {/* Main Action Card */}
      <TouchableOpacity
        style={styles.mainActionCard}
        onPress={() => navigation.navigate('PC Lab')}
      >
        <LinearGradient
          colors={['#10B981', '#059669']}
          style={styles.actionCardGradient}
        >
          <View style={styles.actionCardContent}>
            <View style={styles.actionCardIcon}>
              <Ionicons name="desktop" size={48} color="#fff" />
            </View>
            <Text style={styles.actionCardTitle}>Master PC Hardware</Text>
            <Text style={styles.actionCardSubtitle}>
              Learn computer hardware through interactive simulations, real drag-and-drop assembly, and hands-on troubleshooting challenges
            </Text>
            
            {/* Learning Features Grid */}
            <View style={styles.learningFeaturesGrid}>
              {learningFeatures.map((feature, index) => (
                <View key={index} style={[styles.learningFeatureItem, { backgroundColor: theme.card }]}>
                  <Ionicons name={feature.icon} size={20} color={feature.color} />
                  <Text style={[styles.learningFeatureText, { color: theme.text }]}>{feature.title}</Text>
                </View>
              ))}
            </View>
            
            <View style={[styles.startButton, { backgroundColor: theme.card }]}>
              <Ionicons name="hardware-chip" size={20} color={theme.primary} />
              <Text style={[styles.startButtonText, { color: theme.primary }]}>Start Learning Now</Text>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* Stats Grid */}
      <View style={styles.statsContainer}>
        <View style={styles.statsGrid}>
          {stats.map((stat, index) => (
            <View key={index} style={[styles.statCard, { backgroundColor: theme.card }]}>
              <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
              <Text style={[styles.statTitle, { color: theme.textSecondary }]}>{stat.title}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Feature Highlight */}
      <LinearGradient
        colors={['#10B981', '#3B82F6', '#8B5CF6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.featureHighlight}
      >
        <Text style={styles.highlightTitle}>🚀 Interactive Drag & Drop PC Building!</Text>
        <Text style={styles.highlightSubtitle}>
          Experience the most realistic PC building simulator with true drag-and-drop interaction. Grab components and place them exactly where they belong!
        </Text>
        
        <View style={styles.highlightFeatures}>
          {highlights.map((highlight, index) => (
            <View key={index} style={styles.highlightFeature}>
              <Ionicons name={highlight.icon} size={20} color="#FEF3C7" />
              <Text style={styles.highlightFeatureTitle}>{highlight.title}</Text>
              <Text style={styles.highlightFeatureDesc}>{highlight.description}</Text>
            </View>
          ))}
        </View>
        
        <TouchableOpacity 
          style={[styles.tryButton, { backgroundColor: theme.card }]}
          onPress={() => navigation.navigate('PC Lab')}
        >
          <Ionicons name="hardware-chip" size={20} color={theme.primary} />
          <Text style={[styles.tryButtonText, { color: theme.primary }]}>Try the PC Building Simulator</Text>
        </TouchableOpacity>
      </LinearGradient>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0FDF4',
    paddingTop: 40,
  },
  mainActionCard: {
    marginTop: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  actionCardGradient: {
    borderRadius: 16,
  },
  actionCardContent: {
    padding: 32,
    alignItems: 'center',
  },
  actionCardIcon: {
    width: 96,
    height: 96,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  actionCardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  actionCardSubtitle: {
    fontSize: 16,
    color: '#E5E7EB',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  learningFeaturesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 24,
  },
  learningFeatureItem: {
    width: '48%',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  learningFeatureText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 8,
    textAlign: 'center',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10B981',
    marginLeft: 8,
  },
  statsContainer: {
    margin: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: (width - 48) / 2,
    backgroundColor: 'rgba(255,255,255,0.8)',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  featureHighlight: {
    margin: 16,
    borderRadius: 16,
    padding: 24,
    marginBottom: 32,
  },
  highlightTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
  },
  highlightSubtitle: {
    fontSize: 14,
    color: '#E5E7EB',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  highlightFeatures: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  highlightFeature: {
    alignItems: 'center',
    flex: 1,
  },
  highlightFeatureTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    marginTop: 8,
    textAlign: 'center',
  },
  highlightFeatureDesc: {
    fontSize: 10,
    color: '#E5E7EB',
    textAlign: 'center',
    marginTop: 4,
  },
  tryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  tryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
    marginLeft: 8,
  },
});
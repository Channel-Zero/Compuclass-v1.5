import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const BLUE = '#2563EB'; const WHITE = '#FFFFFF'; const BG = '#F3F4F6';
const TEXT = '#111827'; const MUTED = '#4B5563';

// Catches render-time crashes anywhere below it. The full error and component
// stack go to the console only; the user sees a generic message and a retry.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Unhandled render error:', error, info?.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={styles.container} accessibilityRole="alert">
        <Ionicons name="alert-circle-outline" size={56} color={BLUE} />
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message}>An unexpected error occurred. Please try again.</Text>
        <TouchableOpacity style={styles.button} onPress={() => this.setState({ hasError: false })} activeOpacity={0.85}>
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: BG, padding: 24 },
  title: { fontSize: 20, fontWeight: '900', color: TEXT, marginTop: 16, marginBottom: 8, textAlign: 'center' },
  message: { fontSize: 14, color: MUTED, textAlign: 'center', marginBottom: 24, maxWidth: 320 },
  button: { backgroundColor: BLUE, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32 },
  buttonText: { color: WHITE, fontSize: 16, fontWeight: '800' },
});

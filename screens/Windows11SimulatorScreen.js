import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Text,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import Modal from 'react-native-modal';
import * as ScreenOrientation from 'expo-screen-orientation';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../config/supabase';
import { authService } from '../services/authService';
import { useNavigation } from '@react-navigation/native';

export default function Windows11SimulatorScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState(null);
  const [sessionStart, setSessionStart] = useState(null);
  const [loadTimeout, setLoadTimeout] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    startSession();
    return () => {
      endSession();
      ScreenOrientation.unlockAsync();
    };
  }, []);

  const startSession = async () => {
    try {
      const user = await authService.getCurrentUser();
      if (user) {
        const { data, error } = await supabase
          .from('windows_simulation_sessions')
          .insert({
            user_id: user.id,
            session_start: new Date().toISOString(),
          })
          .select()
          .single();

        if (!error && data) {
          setSessionId(data.id);
          setSessionStart(new Date());
        }
      }
    } catch (error) {
      console.log('Session tracking error:', error);
    }
  };

  const endSession = async () => {
    if (sessionId && sessionStart) {
      try {
        const duration = Math.floor((new Date() - sessionStart) / 1000);
        await supabase
          .from('windows_simulation_sessions')
          .update({
            session_end: new Date().toISOString(),
            duration_seconds: duration,
          })
          .eq('id', sessionId);
      } catch (error) {
        console.log('End session error:', error);
      }
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    if (loadTimeout) clearTimeout(loadTimeout);
    const timeout = setTimeout(() => {
      setLoading(false);
      Alert.alert(
        'Loading Timeout',
        'The simulator is taking too long to load. The service might be down. Try again later or check your internet connection.',
        [{ text: 'OK' }]
      );
    }, 30000);
    setLoadTimeout(timeout);
  };

  const toggleFullscreen = async () => {
    if (!isFullscreen) {
      setIsFullscreen(true);
      setTimeout(async () => {
        try {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        } catch (error) {
          console.log('Orientation lock error:', error);
        }
      }, 100);
    } else {
      try {
        await ScreenOrientation.unlockAsync();
      } catch (error) {
        console.log('Orientation unlock error:', error);
      }
      setIsFullscreen(false);
    }
  };

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        {!isFullscreen && (
          <LinearGradient
            colors={['#0F172A', '#1E293B']}
            style={styles.header}
          >
            <View style={styles.headerContent}>
              <View style={styles.titleContainer}>
                <Ionicons name="desktop" size={24} color="#10B981" />
                <Text style={styles.headerTitle}>Windows 11 Simulator</Text>
              </View>
              <TouchableOpacity onPress={toggleFullscreen} style={styles.refreshButton}>
                <Ionicons name="expand" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.headerSubtitle}>Practice Windows 11 in a safe environment</Text>
          </LinearGradient>
        )}

        <View style={[styles.webviewContainer, isFullscreen && styles.fullscreenContainer]}>
          {isFullscreen && (
            <TouchableOpacity onPress={toggleFullscreen} style={styles.exitFullscreenButton}>
              <Ionicons name="contract" size={20} color="#fff" />
              <Text style={styles.exitFullscreenText}>Exit Fullscreen</Text>
            </TouchableOpacity>
          )}
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#10B981" />
              <Text style={styles.loadingText}>Loading Windows 11...</Text>
            </View>
          )}
          <iframe
            src="https://win11.blueedge.me/"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
            }}
            onLoad={() => setLoading(false)}
          />
        </View>

        {!isFullscreen && (
          <View style={styles.footer}>
            <View style={styles.infoCard}>
              <Ionicons name="information-circle" size={16} color="#10B981" />
              <Text style={styles.infoText}>
                This is a full Windows 11 simulation. Explore and learn!
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  }



  return (
    <>
      <Modal 
        isVisible={isFullscreen} 
        onBackdropPress={toggleFullscreen}
        onBackButtonPress={toggleFullscreen}
        style={{ margin: 0 }}
        animationIn="fadeIn"
        animationOut="fadeOut"
      >
        <View style={styles.fullscreenContainer}>
          <StatusBar hidden />
          <TouchableOpacity onPress={toggleFullscreen} style={styles.exitFullscreenButton}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <WebView
            source={{ uri: 'https://win11.blueedge.me/' }}
            style={styles.webview}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            scalesPageToFit={true}
            scrollEnabled={true}
            bounces={true}
            showsVerticalScrollIndicator={true}
            showsHorizontalScrollIndicator={true}
            contentMode="mobile"
          />
        </View>
      </Modal>
      <View style={styles.container}>
      <StatusBar hidden={false} />
      <LinearGradient
        colors={['#0F172A', '#1E293B']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.titleContainer}>
            <Ionicons name="desktop" size={24} color="#10B981" />
            <Text style={styles.headerTitle}>Windows 11 Simulator</Text>
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
              <Ionicons name="refresh" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleFullscreen} style={styles.refreshButton}>
              <Ionicons name="expand" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.headerSubtitle}>Practice Windows 11 in a safe environment</Text>
      </LinearGradient>

      <View style={styles.webviewContainer}>
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={styles.loadingText}>Loading Windows 11...</Text>
            <Text style={styles.loadingSubtext}>This may take 30-60 seconds</Text>
          </View>
        )}
        <WebView
          source={{ uri: 'https://win11.blueedge.me/' }}
          style={styles.webview}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.log('WebView error:', nativeEvent);
            Alert.alert('Error', `Failed to load: ${nativeEvent.description}`);
            setLoading(false);
          }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowsFullscreenVideo={true}
          mediaPlaybackRequiresUserAction={false}
          scalesPageToFit={true}
          bounces={false}
          scrollEnabled={true}
        />
      </View>

      <View style={styles.footer}>
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={16} color="#10B981" />
          <Text style={styles.infoText}>
            This is a full Windows 11 simulation. Explore and learn!
          </Text>
        </View>
      </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 12,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginLeft: 36,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  exitFullscreenButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  exitFullscreenText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  webviewContainer: {
    flex: 1,
    backgroundColor: '#000',
    zIndex: 1,
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    zIndex: 1,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#94A3B8',
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#64748B',
  },
  footer: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#94A3B8',
    marginLeft: 8,
  },
  messageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#0F172A',
  },
  messageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 24,
    marginBottom: 16,
  },
  messageText: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 24,
  },
});

if (Platform.OS === 'web') {
  const style = document.createElement('style');
  style.textContent = `
    body { margin: 0; overflow: hidden; }
  `;
  document.head.appendChild(style);
}

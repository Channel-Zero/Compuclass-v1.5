import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, TouchableOpacity, Text, Alert, Platform, StatusBar } from 'react-native';
import Modal from 'react-native-modal';
import * as ScreenOrientation from 'expo-screen-orientation';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../config/supabase';
import { authService } from '../services/authService';
import WebFrame from '../components/WebFrame';

const BLUE = '#2563EB'; const WHITE = '#FFFFFF'; const BG = '#F3F4F6';
const TEXT = '#111827'; const MUTED = '#4B5563'; const BORDER = '#E5E7EB';

const SIMULATOR_URL = 'https://win11.blueedge.me/';

export default function Windows11SimulatorScreen() {
  const webViewRef = useRef(null);
  const sessionRef = useRef({ id: null, start: null });
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    startSession();
    return () => { endSession(); ScreenOrientation.unlockAsync(); };
  }, []);

  const startSession = async () => {
    try {
      const user = await authService.getCurrentUser();
      if (user) {
        const { data, error } = await supabase.from('windows_simulation_sessions')
          .insert({ user_id: user.id, session_start: new Date().toISOString() }).select().single();
        if (!error && data) sessionRef.current = { id: data.id, start: new Date() };
      }
    } catch { /* session tracking is optional if the table is not migrated yet */ }
  };

  const endSession = async () => {
    const { id, start } = sessionRef.current;
    if (!id || !start) return;
    sessionRef.current = { id: null, start: null };
    try {
      const duration = Math.floor((Date.now() - start.getTime()) / 1000);
      await supabase.from('windows_simulation_sessions')
        .update({ session_end: new Date().toISOString(), duration_seconds: duration }).eq('id', id);
    } catch { /* ignore */ }
  };

  const handleRefresh = () => { setLoading(true); webViewRef.current?.reload(); };

  const toggleFullscreen = async () => {
    if (!isFullscreen) {
      setIsFullscreen(true);
      setTimeout(async () => {
        try { await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE); } catch {}
      }, 100);
    } else {
      try { await ScreenOrientation.unlockAsync(); } catch {}
      setIsFullscreen(false);
    }
  };

  if (Platform.OS === 'web') return (
    <View style={styles.container}>
      {!isFullscreen && (
        <LinearGradient colors={[BLUE, '#1D4ED8']} style={styles.header}>
          <View style={styles.titleRow}>
            <View style={styles.headerIconWrap}>
              <Ionicons name="desktop" size={20} color={WHITE} />
            </View>
            <View>
              <Text style={styles.headerTitle}>Windows 11 Simulator</Text>
              <Text style={styles.headerSubtitle}>Practice in a safe environment</Text>
            </View>
          </View>
          <TouchableOpacity onPress={toggleFullscreen} style={styles.iconBtn}>
            <Ionicons name="expand-outline" size={18} color={WHITE} />
          </TouchableOpacity>
        </LinearGradient>
      )}
      <View style={[styles.webviewContainer, isFullscreen && styles.fullscreenContainer]}>
        {isFullscreen && (
          <TouchableOpacity onPress={toggleFullscreen} style={styles.exitFullscreenBtn}>
            <Ionicons name="contract-outline" size={18} color={WHITE} />
          </TouchableOpacity>
        )}
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={BLUE} />
            <Text style={styles.loadingText}>Loading Windows 11...</Text>
          </View>
        )}
        <WebFrame src={SIMULATOR_URL} onLoad={() => setLoading(false)} style={{ flex: 1 }} />
      </View>
      {!isFullscreen && (
        <View style={styles.footer}>
          <Ionicons name="information-circle" size={16} color={BLUE} />
          <Text style={styles.footerText}>This is a full Windows 11 simulation. Explore and learn!</Text>
        </View>
      )}
    </View>
  );

  return (
    <>
      <Modal isVisible={isFullscreen} onBackdropPress={toggleFullscreen} onBackButtonPress={toggleFullscreen} style={{ margin: 0 }} animationIn="fadeIn" animationOut="fadeOut">
        <View style={styles.fullscreenContainer}>
          <StatusBar hidden />
          <TouchableOpacity onPress={toggleFullscreen} style={styles.exitFullscreenBtn}>
            <Ionicons name="close" size={22} color={WHITE} />
          </TouchableOpacity>
          <WebView
            source={{ uri: SIMULATOR_URL }}
            style={styles.webview}
            javaScriptEnabled domStorageEnabled scalesPageToFit scrollEnabled bounces
            showsVerticalScrollIndicator showsHorizontalScrollIndicator
            onShouldStartLoadWithRequest={(req) => !req.url.startsWith('about:')}
          />
        </View>
      </Modal>

      <View style={styles.container}>
        <StatusBar hidden={false} />
        <LinearGradient colors={[BLUE, '#1D4ED8']} style={styles.header}>
          <View style={styles.titleRow}>
            <View style={styles.headerIconWrap}>
              <Ionicons name="desktop" size={20} color={WHITE} />
            </View>
            <View>
              <Text style={styles.headerTitle}>Windows 11 Simulator 🖥️</Text>
              <Text style={styles.headerSubtitle}>Practice Windows 11 in a safe environment</Text>
            </View>
          </View>
          <View style={styles.headerBtns}>
            <TouchableOpacity onPress={handleRefresh} style={styles.iconBtn}>
              <Ionicons name="refresh-outline" size={18} color={WHITE} />
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleFullscreen} style={styles.iconBtn}>
              <Ionicons name="expand-outline" size={18} color={WHITE} />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={styles.webviewContainer}>
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={BLUE} />
              <Text style={styles.loadingText}>Loading Windows 11...</Text>
              <Text style={styles.loadingSubtext}>This may take 30–60 seconds</Text>
            </View>
          )}
          <WebView
            ref={webViewRef}
            source={{ uri: SIMULATOR_URL }}
            style={styles.webview}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={(e) => { Alert.alert('Error', `Failed to load: ${e.nativeEvent.description}`); setLoading(false); }}
            onShouldStartLoadWithRequest={(req) => !req.url.startsWith('about:')}
            javaScriptEnabled domStorageEnabled allowsFullscreenVideo
            mediaPlaybackRequiresUserAction={false} scalesPageToFit bounces={false} scrollEnabled
          />
        </View>

        <View style={styles.footer}>
          <Ionicons name="information-circle" size={16} color={BLUE} />
          <Text style={styles.footerText}>This is a full Windows 11 simulation. Explore and learn!</Text>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 52, paddingBottom: 14, paddingHorizontal: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  headerIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 15, fontWeight: '900', color: WHITE },
  headerSubtitle: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  headerBtns: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  webviewContainer: { flex: 1, backgroundColor: '#000' },
  webview: { flex: 1 },
  fullscreenContainer: { flex: 1, backgroundColor: '#000' },
  exitFullscreenBtn: { position: 'absolute', top: 40, right: 20, zIndex: 1000, width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: BG, zIndex: 1 },
  loadingText: { marginTop: 14, fontSize: 15, color: TEXT, fontWeight: '700' },
  loadingSubtext: { marginTop: 6, fontSize: 12, color: MUTED },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: WHITE, borderTopWidth: 1, borderTopColor: BORDER, paddingHorizontal: 16, paddingVertical: 12 },
  footerText: { flex: 1, fontSize: 12, color: MUTED, fontWeight: '500' },
});

if (Platform.OS === 'web') {
  const style = document.createElement('style');
  style.textContent = 'body { margin: 0; overflow: hidden; }';
  document.head.appendChild(style);
}

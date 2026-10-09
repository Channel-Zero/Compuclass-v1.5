import React, { useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import WebView from './WebEmbed';

export default function CPUAR() {
  const sketchfabEmbedUrl = 'https://sketchfab.com/models/a50bafa2d9914caa9bf185cd16e6935f/embed?autostart=1&ui_controls=1&ui_infos=0&ui_inspector=0&ui_stop=0&ui_watermark=0';
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackTitle}>The CPU model didn't load</Text>
        <Text style={styles.fallbackText}>
          Check your connection, then open this view again. You can still finish the PC Lab steps without the 3D model.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: sketchfabEmbedUrl }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        onError={() => setFailed(true)}
        onHttpError={() => setFailed(true)}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading CPU Model...</Text>
          </View>
        )}
      />
      <Text style={styles.hint}>If the model stays blank, it didn't load. Go back and continue the assembly steps.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  fallback: {
    flex: 1,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  fallbackTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  hint: {
    color: '#E5E7EB',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#111827',
  },
  fallbackText: {
    color: '#D1D5DB',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});
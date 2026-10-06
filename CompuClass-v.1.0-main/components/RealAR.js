import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';

const modelModule = require('../assets/models/personal_computer.glb');

function viewerHtml(src) {
  return `<!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <script type="module" src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js"></script>
        <style>
          body { margin: 0; padding: 0; }
          model-viewer { width: 100%; height: 100vh; background-color: #f0f0f0; }
        </style>
      </head>
      <body>
        <model-viewer
          src="${src}"
          alt="Personal Computer 3D Model"
          auto-rotate
          camera-controls
          shadow-intensity="1"
        ></model-viewer>
      </body>
    </html>`;
}

export default function RealAR() {
  const [html, setHtml] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const asset = Asset.fromModule(modelModule);
        if (!asset.localUri && !asset.uri) await asset.downloadAsync();
        const uri = asset.localUri || asset.uri;
        let src = uri;
        if (Platform.OS !== 'web' && uri && !/^https?:/i.test(uri)) {
          const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          src = `data:model/gltf-binary;base64,${base64}`;
        }
        if (!cancelled) setHtml(viewerHtml(src));
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Could not load the 3D model');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.modelInfo}>3D model unavailable</Text>
      </View>
    );
  }

  if (!html) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={styles.glView}
      />
      <View style={styles.overlay}>
        <Text style={styles.modelInfo}>Personal Computer - 3D View</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
  },
  glView: {
    flex: 1,
    width: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.9)',
    padding: 15,
    borderRadius: 10,
  },
  modelInfo: {
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
  },
});

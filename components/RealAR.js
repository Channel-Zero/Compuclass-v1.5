import React, { useRef, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { WebView } from 'react-native-webview';

export default function RealAR() {


  const htmlContent = `
    <!DOCTYPE html>
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
          src="https://raw.githubusercontent.com/Tkumalo-dev/-CompuClass/thabo-and-kamo/ARfeature/assets/models/personal_computer.glb"
          alt="Personal Computer 3D Model"
          auto-rotate
          camera-controls
          shadow-intensity="1"
        ></model-viewer>
      </body>
    </html>
  `;
  
  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={['*']}
        source={{ html: htmlContent }}
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
  },
  glView: {
    flex: 1,
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
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
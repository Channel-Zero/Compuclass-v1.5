import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import sketchfabService from '../services/echo3dService';

export default function SimpleAR() {
  const [modelPlaced, setModelPlaced] = useState(false);
  const [modelPosition, setModelPosition] = useState({ x: 150, y: 200 });
  const [pcModelData, setPcModelData] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const model = await sketchfabService.getModel();
        setPcModelData(model);
      } catch (error) {
        console.error('Failed to load model:', error);
      }
    })();
  }, []);

  const placeModel = (event) => {
    const { locationX, locationY } = event.nativeEvent;
    setModelPosition({ x: locationX, y: locationY });
    setModelPlaced(true);
  };

  return (
    <View style={styles.container}>
      <View style={styles.arBackground}>
        <TouchableOpacity style={styles.arOverlay} onPress={placeModel}>
          <View style={styles.instructions}>
            <Ionicons name="scan" size={24} color="#fff" />
            <Text style={styles.instructionText}>
              Tap to place 3D PC Model from Sketchfab
            </Text>
          </View>

          {modelPlaced && (
            <View 
              style={[
                styles.pcModel3D, 
                { 
                  left: modelPosition.x - 75, 
                  top: modelPosition.y - 75 
                }
              ]}
            >
              <View style={styles.modelContainer}>
                <Ionicons name="desktop" size={60} color="#3B82F6" />
                <Text style={styles.modelLabel}>
                  {pcModelData?.name || 'Personal Computer'}
                </Text>
                <Text style={styles.modelSource}>Sketchfab API</Text>
                <View style={styles.modelShadow} />
              </View>
            </View>
          )}

          <View style={styles.controls}>
            <TouchableOpacity 
              style={styles.resetButton}
              onPress={() => setModelPlaced(false)}
            >
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.resetText}>Reset</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  arBackground: {
    flex: 1,
    backgroundColor: '#0F172A',
    backgroundImage: 'radial-gradient(circle, #1E293B 0%, #0F172A 100%)',
  },
  arOverlay: {
    flex: 1,
  },
  instructions: {
    position: 'absolute',
    top: 50,
    alignSelf: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.8)',
    padding: 15,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  instructionText: {
    color: '#fff',
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '600',
  },
  pcModel3D: {
    position: 'absolute',
    width: 150,
    height: 150,
  },
  modelContainer: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  modelLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 8,
    textAlign: 'center',
  },
  modelSource: {
    fontSize: 10,
    color: '#10B981',
    marginTop: 2,
    fontWeight: '600',
  },
  modelShadow: {
    position: 'absolute',
    bottom: -10,
    width: 100,
    height: 20,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 50,
    transform: [{ scaleY: 0.3 }],
  },
  controls: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
  },
  resetButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 25,
  },
  resetText: {
    color: '#fff',
    marginLeft: 8,
    fontWeight: '600',
  },
});
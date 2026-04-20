import React, { useState, useMemo } from "react";
import { View, StyleSheet, Text } from "react-native";
import { Canvas } from "@react-three/fiber/native";
import { Suspense } from "react";
import ComputerModel from '../components/ComputerModel';

import { PanGestureHandler, PinchGestureHandler } from "react-native-gesture-handler";
import { useAnimatedGestureHandler, useSharedValue } from "react-native-reanimated";

// WebAR Component




export const WebAR = () => {
  return (
    <View style={styles.container}>
      <View style={styles.overlay}>
        <Text style={styles.title}>CompuClass 3D Lab</Text>
        <Text style={styles.subtitle}>Pan to orbit • Pinch to zoom</Text>
     </View>

      <PanGestureHandler onGestureEvent={onPanGestureEvent}>
        <View style={styles.flex}>
          <PinchGestureHandler onGestureEvent={onPinchGestureEvent}>
            <View style={styles.flex}>
              
                <Canvas>
                  <ambientLight intensity={0.6} />
                  <directionalLight position={[2, 2, 2]} intensity={0.8} />

                  <ComputerModel />

                  <perspectiveCamera position={[0, 0, distance]} fov={60} />
                </Canvas>
              

            </View>
          </PinchGestureHandler>
        </View>
      </PanGestureHandler>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  flex: {
    flex: 1,
  },
  overlay: {
    position: "absolute",
    top: 50,
    left: 20,
    right: 20,
    zIndex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: 15,
    borderRadius: 10,
  },
  title: {
    color: "#10B981",
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
  },
  subtitle: {
    color: "#fff",
    fontSize: 14,
    textAlign: "center",
    marginTop: 5,
  },
});

export default WebAR;

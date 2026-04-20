import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Camera } from 'expo-camera';
import RealAR from '../components/RealAR';
import RamAR from '../components/RamAR';
import MotherboardAR from '../components/MotherboardAR';
import StorageAR from '../components/StorageAR';
import CPUAR from '../components/CPUAR';
import GPUAR from '../components/GPUAR';
import PSUAR from '../components/PSUAR';


const { width, height } = Dimensions.get('window');

export default function PCLabScreen({ navigation }) {
  const { theme } = useTheme();
  const [selectedModule, setSelectedModule] = useState(null);
  const [selectedComponents, setSelectedComponents] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showMotherboardFullscreen, setShowMotherboardFullscreen] = useState(false);
  const [showCPUFullscreen, setShowCPUFullscreen] = useState(false);
  const [showRAMFullscreen, setShowRAMFullscreen] = useState(false);
  const [showGPUFullscreen, setShowGPUFullscreen] = useState(false);
  const [showStorageFullscreen, setShowStorageFullscreen] = useState(false);
  const [showPSUFullscreen, setShowPSUFullscreen] = useState(false);
// Define the PC components and assembly steps for the interactive lab
  const components = [
    { id: 'motherboard', name: 'Motherboard', icon: 'hardware-chip' },
    { id: 'cpu', name: 'CPU', icon: 'speedometer' },
    { id: 'ram', name: 'RAM', icon: 'albums' },
    { id: 'gpu', name: 'Graphics Card', icon: 'tv' },
    { id: 'storage', name: 'Storage (SSD)', icon: 'save' },
    { id: 'psu', name: 'Power Supply', icon: 'battery-charging' },
  ];

  const steps = [
    'Install Motherboard',
    'Install CPU',
    'Install RAM',
    'Install Graphics Card',
    'Install Storage',
    'Connect Power Supply',
  ];
// Handle component selection and assembly logic. Check if the selected component matches the expected component for the current step. If correct, move to the next step, if not show an alert. When all steps are completed, show a congratulatory message and option to start a new build.
  const handleComponentPress = (componentId) => {
    if (componentId === 'motherboard') {
      setShowMotherboardFullscreen(true);
      return;
    }
    if (componentId === 'cpu') {
      setShowCPUFullscreen(true);
      return;
    }
    if (componentId === 'ram') {
      setShowRAMFullscreen(true);
      return;
    }
    if (componentId === 'gpu') {
      setShowGPUFullscreen(true);
      return;
    }
    if (componentId === 'storage') {
      setShowStorageFullscreen(true);
      return;
    }
    if (componentId === 'psu') {
      setShowPSUFullscreen(true);
      return;
    }
    
    if (currentStep < steps.length) {
      const expectedComponent = components[currentStep];
      
      if (componentId === expectedComponent.id) {
        setSelectedComponents([...selectedComponents, componentId]);
        setCurrentStep(currentStep + 1);
        
        if (currentStep === steps.length - 1) {
          Alert.alert(
            'Congratulations! 🎉',
            'You have successfully assembled your PC!',
            [{ text: 'Start New Build', onPress: resetBuild }]
          );
        }
      } else {
        Alert.alert(
          'Wrong Component'
        );
      }
    }
  };

  const resetBuild = () => {
    setSelectedComponents([]);
    setCurrentStep(0);
  };

  const getComponentStatus = (componentId) => {
    return selectedComponents.includes(componentId);
  };

  if (showMotherboardFullscreen) {
    return (
      <View style={styles.fullscreenContainer}>
        <TouchableOpacity 
          style={styles.fullscreenBackButton} 
          onPress={() => setShowMotherboardFullscreen(false)}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <MotherboardAR />
      </View>
    );
  }

  if (showCPUFullscreen) {
    return (
      <View style={styles.fullscreenContainer}>
        <TouchableOpacity 
          style={styles.fullscreenBackButton} 
          onPress={() => setShowCPUFullscreen(false)}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <CPUAR />
      </View>
    );
  }

  if (showRAMFullscreen) {
    return (
      <View style={styles.fullscreenContainer}>
        <TouchableOpacity 
          style={styles.fullscreenBackButton} 
          onPress={() => setShowRAMFullscreen(false)}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <RamAR />
      </View>
    );
  }

  if (showGPUFullscreen) {
    return (
      <View style={styles.fullscreenContainer}>
        <TouchableOpacity 
          style={styles.fullscreenBackButton} 
          onPress={() => setShowGPUFullscreen(false)}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <GPUAR />
      </View>
    );
  }

  if (showStorageFullscreen) {
    return (
      <View style={styles.fullscreenContainer}>
        <TouchableOpacity 
          style={styles.fullscreenBackButton} 
          onPress={() => setShowStorageFullscreen(false)}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <StorageAR />
      </View>
    );
  }

  if (showPSUFullscreen) {
    return (
      <View style={styles.fullscreenContainer}>
        <TouchableOpacity 
          style={styles.fullscreenBackButton} 
          onPress={() => setShowPSUFullscreen(false)}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <PSUAR />
      </View>
    );
  }

  if (isFullscreen) {
    return (
      <View style={styles.fullscreenContainer}>
        <TouchableOpacity 
          style={styles.fullscreenBackButton} 
          onPress={() => setIsFullscreen(false)}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <RealAR />
        {showInstructions && (
          <View style={styles.instructionsPopup}>
            <View style={styles.popupContent}>
              <View style={styles.popupHeader}>
                <Text style={styles.popupTitle}>How to Use 3D Viewer</Text>
                <TouchableOpacity 
                  style={styles.popupCloseButton}
                  onPress={() => setShowInstructions(false)}
                >
                  <Ionicons name="close" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={styles.popupInstruction}>
                <Ionicons name="hand-left" size={16} color="#10B981" />
                <Text style={styles.popupText}>Drag to rotate the 3D PC model</Text>
              </View>
              <View style={styles.popupInstruction}>
                <Ionicons name="resize" size={16} color="#3B82F6" />
                <Text style={styles.popupText}>Pinch to zoom in/out</Text>
              </View>
              <View style={styles.popupInstruction}>
                <Ionicons name="construct" size={16} color="#F59E0B" />
                <Text style={styles.popupText}>Tap components to learn more</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color="#10B981" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <View style={styles.headerIcon}>
            <Ionicons name="desktop" size={20} color="#fff" />
          </View>
          <Text style={styles.headerTitle}>Interactive PC Building Lab</Text>
        </View>
      </View>

      {/* PC Case Visualization */}
      <View style={styles.pcCaseSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>3D PC Model</Text>
          <TouchableOpacity 
            style={styles.fullscreenButton} 
            onPress={() => {
              setIsFullscreen(true);
              setShowInstructions(true);
            }}
          >
            <Ionicons name="expand" size={20} color="#3B82F6" />
          </TouchableOpacity>
        </View>
        <View style={styles.realARContainer}>
          <RealAR />
        </View>
      </View>

      {/* Components Section */}
      <View style={styles.componentsSection}>
        <Text style={styles.sectionTitle}>Available Components</Text>
        <View style={styles.componentsGrid}>
          {components.map((component) => (
            <TouchableOpacity
              key={component.id}
              style={[
                styles.componentCard,
                getComponentStatus(component.id) && styles.componentUsed
              ]}
              onPress={() => handleComponentPress(component.id)}
              disabled={getComponentStatus(component.id)}
            >
              <Ionicons 
                name={component.icon} 
                size={32} 
                color={getComponentStatus(component.id) ? '#9CA3AF' : '#3B82F6'} 
              />
              <Text 
                style={[
                  styles.componentName,
                  getComponentStatus(component.id) && styles.componentUsedText
                ]}
              >
                {component.name}
              </Text>
              {getComponentStatus(component.id) && (
                <View style={styles.installedBadge}>
                  <Ionicons name="checkmark" size={16} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0FDF4',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  backText: {
    fontSize: 16,
    color: '#10B981',
    marginLeft: 4,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    width: 32,
    height: 32,
    backgroundColor: '#10B981',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },

  pcCaseSection: {
    margin: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },

  realARContainer: {
    height: 300,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F0F9FF',
    borderWidth: 2,
    borderColor: '#3B82F6',
  },

  componentsSection: {
    margin: 16,
  },
  componentsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  componentCard: {
    width: (width - 56) / 2,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
    minHeight: 100,
  },
  componentUsed: {
    backgroundColor: '#F9FAFB',
    opacity: 0.7,
  },
  componentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 8,
    textAlign: 'center',
  },
  componentUsedText: {
    color: '#9CA3AF',
  },
  installedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#10B981',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Fullscreen Styles
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  fullscreenBackButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  fullscreenButton: {
    padding: 8,
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  // Instructions Popup Styles
  instructionsPopup: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  popupContent: {
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  popupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  popupTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  popupCloseButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 15,
    padding: 3,
    marginLeft:12
  },
  popupInstruction: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  popupText: {
    fontSize: 14,
    color: '#E5E7EB',
    marginLeft: 12,
    flex: 1,
  },
  fullscreen3D: {
    flex: 1,
  },
});
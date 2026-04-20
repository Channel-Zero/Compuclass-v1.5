import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';

const troubleshootingScenarios = [
  {
    id: 1,
    title: "Computer Won't Turn On",
    description: "A user reports their computer completely won't power on. No lights, no fans, nothing.",
    symptoms: ["No power lights", "No fan noise", "No display", "Power button unresponsive"],
    possibleCauses: [
      { cause: "Power supply failure", likelihood: "High", solution: "Replace PSU" },
      { cause: "Loose power cable", likelihood: "Medium", solution: "Check all power connections" },
      { cause: "Faulty power button", likelihood: "Low", solution: "Test with screwdriver on motherboard pins" },
      { cause: "Dead motherboard", likelihood: "Medium", solution: "Professional diagnosis needed" }
    ],
    steps: [
      "Check power cable connections",
      "Test power outlet with another device",
      "Inspect PSU power switch (if present)",
      "Try different power cable",
      "Test PSU with paperclip method",
      "Check motherboard power connections"
    ],
    correctSolution: "Check all power connections first, then test PSU"
  },
  {
    id: 2,
    title: "Blue Screen of Death (BSOD)",
    description: "Computer randomly crashes with blue screen showing error codes.",
    symptoms: ["Random blue screens", "System restarts", "Error codes displayed", "Crashes during use"],
    possibleCauses: [
      { cause: "Faulty RAM", likelihood: "High", solution: "Run memory test, replace bad RAM" },
      { cause: "Driver issues", likelihood: "High", solution: "Update or rollback drivers" },
      { cause: "Overheating", likelihood: "Medium", solution: "Clean fans, check thermal paste" },
      { cause: "Hardware conflict", likelihood: "Low", solution: "Remove recently added hardware" }
    ],
    steps: [
      "Note the error code from BSOD",
      "Boot into Safe Mode",
      "Run Windows Memory Diagnostic",
      "Check Event Viewer for errors",
      "Update graphics and system drivers",
      "Monitor system temperatures"
    ],
    correctSolution: "Run memory diagnostic and check for driver issues"
  },
  {
    id: 3,
    title: "Slow Performance",
    description: "Computer is running very slowly, taking forever to open programs and files.",
    symptoms: ["Slow boot times", "Programs take long to open", "Frequent freezing", "High CPU usage"],
    possibleCauses: [
      { cause: "Too many startup programs", likelihood: "High", solution: "Disable unnecessary startup items" },
      { cause: "Insufficient RAM", likelihood: "Medium", solution: "Add more RAM or close programs" },
      { cause: "Malware infection", likelihood: "Medium", solution: "Run antivirus scan" },
      { cause: "Failing hard drive", likelihood: "Low", solution: "Check disk health, consider SSD upgrade" }
    ],
    steps: [
      "Check Task Manager for high CPU/RAM usage",
      "Disable unnecessary startup programs",
      "Run disk cleanup and defragmentation",
      "Scan for malware",
      "Check available storage space",
      "Monitor system temperatures"
    ],
    correctSolution: "Check startup programs and run system cleanup"
  },
  {
    id: 4,
    title: "No Display Output",
    description: "Computer turns on (fans spinning, lights on) but monitor shows no signal.",
    symptoms: ["Monitor shows 'No Signal'", "Computer fans running", "Power lights on", "No BIOS screen"],
    possibleCauses: [
      { cause: "Loose display cable", likelihood: "High", solution: "Reseat display cables" },
      { cause: "Faulty graphics card", likelihood: "Medium", solution: "Reseat or replace GPU" },
      { cause: "RAM not seated properly", likelihood: "Medium", solution: "Reseat RAM modules" },
      { cause: "Monitor failure", likelihood: "Low", solution: "Test with different monitor" }
    ],
    steps: [
      "Check monitor power and cables",
      "Try different display cable/port",
      "Reseat RAM modules",
      "Reseat graphics card",
      "Try onboard graphics (if available)",
      "Test with different monitor"
    ],
    correctSolution: "Check display connections and reseat components"
  },
  {
    id: 5,
    title: "Overheating Issues",
    description: "Computer shuts down randomly, especially during intensive tasks. System feels very hot.",
    symptoms: ["Random shutdowns", "Very hot case", "Loud fan noise", "Performance throttling"],
    possibleCauses: [
      { cause: "Dust buildup in fans", likelihood: "High", solution: "Clean all fans and heatsinks" },
      { cause: "Thermal paste dried out", likelihood: "Medium", solution: "Replace thermal paste on CPU" },
      { cause: "Fan failure", likelihood: "Medium", solution: "Replace failed fans" },
      { cause: "Poor case ventilation", likelihood: "Low", solution: "Improve case airflow" }
    ],
    steps: [
      "Monitor CPU and GPU temperatures",
      "Clean dust from all fans and heatsinks",
      "Check if all fans are spinning",
      "Reapply thermal paste on CPU",
      "Ensure proper case ventilation",
      "Consider additional case fans"
    ],
    correctSolution: "Clean dust buildup and check thermal paste"
  }
];

export default function TroubleshootingScreen() {
  const { theme } = useTheme();
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [userSolution, setUserSolution] = useState('');
  const [showSolution, setShowSolution] = useState(false);
  const [completedScenarios, setCompletedScenarios] = useState([]);

  const selectScenario = (scenario) => {
    setSelectedScenario(scenario);
    setCurrentStep(0);
    setUserSolution('');
    setShowSolution(false);
  };

  const nextStep = () => {
    if (currentStep < selectedScenario.steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setShowSolution(true);
    }
  };

  const completeScenario = () => {
    if (!completedScenarios.includes(selectedScenario.id)) {
      setCompletedScenarios([...completedScenarios, selectedScenario.id]);
    }
    Alert.alert(
      "Scenario Completed!",
      "Great job working through this troubleshooting scenario. You've gained valuable diagnostic experience!",
      [{ text: "Continue Learning", onPress: () => setSelectedScenario(null) }]
    );
  };

  const resetScenario = () => {
    setCurrentStep(0);
    setShowSolution(false);
  };

  if (!selectedScenario) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: theme.surface }]}>
        <LinearGradient
          colors={['#EF4444', '#DC2626']}
          style={styles.headerGradient}
        >
          <Ionicons name="bug" size={48} color="#fff" />
          <Text style={styles.headerTitle}>Troubleshooting Lab</Text>
          <Text style={styles.headerSubtitle}>
            Practice diagnosing and solving common computer problems
          </Text>
        </LinearGradient>

        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.statNumber, { color: '#EF4444' }]}>{completedScenarios.length}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Completed</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.statNumber, { color: '#EF4444' }]}>{troubleshootingScenarios.length}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Scenarios</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.statNumber, { color: '#EF4444' }]}>
              {Math.round((completedScenarios.length / troubleshootingScenarios.length) * 100)}%
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Progress</Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>Choose a Troubleshooting Scenario</Text>

        {troubleshootingScenarios.map((scenario) => (
          <TouchableOpacity
            key={scenario.id}
            style={[
              styles.scenarioCard,
              { backgroundColor: theme.card },
              completedScenarios.includes(scenario.id) && { borderWidth: 2, borderColor: theme.primary }
            ]}
            onPress={() => selectScenario(scenario)}
          >
            <View style={styles.scenarioHeader}>
              <Text style={[styles.scenarioTitle, { color: theme.text }]}>{scenario.title}</Text>
              {completedScenarios.includes(scenario.id) && (
                <Ionicons name="checkmark-circle" size={24} color="#10B981" />
              )}
            </View>
            <Text style={[styles.scenarioDescription, { color: theme.textSecondary }]}>{scenario.description}</Text>
            
            <View style={styles.symptomsContainer}>
              <Text style={styles.symptomsTitle}>Symptoms:</Text>
              {scenario.symptoms.slice(0, 2).map((symptom, index) => (
                <Text key={index} style={styles.symptom}>• {symptom}</Text>
              ))}
              {scenario.symptoms.length > 2 && (
                <Text style={styles.moreSymptoms}>+{scenario.symptoms.length - 2} more...</Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.surface }]}>
      <View style={[styles.scenarioHeader, { backgroundColor: theme.card }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setSelectedScenario(null)}
        >
          <Ionicons name="arrow-back" size={24} color={theme.primary} />
        </TouchableOpacity>
        <Text style={[styles.scenarioTitle, { color: theme.text }]}>{selectedScenario.title}</Text>
      </View>

      <View style={[styles.progressContainer, { backgroundColor: theme.card }]}>
        <Text style={[styles.progressText, { color: theme.textSecondary }]}>
          Step {currentStep + 1} of {selectedScenario.steps.length}
        </Text>
        <View style={[styles.progressBar, { backgroundColor: theme.borderLight }]}>
          <View 
            style={[
              styles.progressFill, 
              { width: `${((currentStep + 1) / selectedScenario.steps.length) * 100}%` }
            ]} 
          />
        </View>
      </View>

      <View style={[styles.problemDescription, { backgroundColor: theme.card }]}>
        <Text style={[styles.problemTitle, { color: theme.text }]}>Problem Description</Text>
        <Text style={[styles.problemText, { color: theme.textSecondary }]}>{selectedScenario.description}</Text>
      </View>

      <View style={styles.symptomsSection}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Observed Symptoms</Text>
        {selectedScenario.symptoms.map((symptom, index) => (
          <View key={index} style={[styles.symptomItem, { backgroundColor: theme.card }]}>
            <Ionicons name="warning" size={16} color="#F59E0B" />
            <Text style={[styles.symptomText, { color: theme.text }]}>{symptom}</Text>
          </View>
        ))}
      </View>

      <View style={styles.currentStepSection}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Current Troubleshooting Step</Text>
        <View style={[styles.stepCard, { backgroundColor: '#3B82F6' + '20', borderColor: '#3B82F6' }]}>
          <Text style={[styles.stepText, { color: '#1E40AF' }]}>{selectedScenario.steps[currentStep]}</Text>
        </View>
      </View>

      <View style={styles.possibleCausesSection}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Possible Causes</Text>
        {selectedScenario.possibleCauses.map((cause, index) => (
          <View key={index} style={[styles.causeItem, { backgroundColor: theme.card }]}>
            <View style={styles.causeHeader}>
              <Text style={[styles.causeText, { color: theme.text }]}>{cause.cause}</Text>
              <View style={[
                styles.likelihoodBadge,
                { backgroundColor: 
                  cause.likelihood === 'High' ? '#EF4444' :
                  cause.likelihood === 'Medium' ? '#F59E0B' : '#10B981'
                }
              ]}>
                <Text style={styles.likelihoodText}>{cause.likelihood}</Text>
              </View>
            </View>
            <Text style={[styles.solutionText, { color: theme.textSecondary }]}>Solution: {cause.solution}</Text>
          </View>
        ))}
      </View>

      {showSolution ? (
        <View style={styles.solutionSection}>
          <LinearGradient
            colors={['#10B981', '#059669']}
            style={styles.solutionCard}
          >
            <Ionicons name="bulb" size={32} color="#fff" />
            <Text style={styles.solutionTitle}>Recommended Solution</Text>
            <Text style={styles.solutionText}>{selectedScenario.correctSolution}</Text>
            
            <View style={styles.solutionButtons}>
              <TouchableOpacity style={styles.resetButton} onPress={resetScenario}>
                <Ionicons name="refresh" size={20} color="#10B981" />
                <Text style={styles.resetButtonText}>Try Again</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.completeButton} onPress={completeScenario}>
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.completeButtonText}>Complete</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      ) : (
        <TouchableOpacity style={styles.nextStepButton} onPress={nextStep}>
          <Text style={styles.nextStepText}>
            {currentStep === selectedScenario.steps.length - 1 ? 'Show Solution' : 'Next Step'}
          </Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FEF2F2',
  },
  headerGradient: {
    alignItems: 'center',
    padding: 32,
    margin: 16,
    borderRadius: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#FEE2E2',
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    margin: 16,
  },
  statCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#EF4444',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    margin: 16,
    marginBottom: 12,
  },
  scenarioCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  completedCard: {
    borderWidth: 2,
    borderColor: '#10B981',
  },
  scenarioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  scenarioTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    flex: 1,
  },
  scenarioDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    lineHeight: 20,
  },
  symptomsContainer: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
  },
  symptomsTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#92400E',
    marginBottom: 4,
  },
  symptom: {
    fontSize: 12,
    color: '#92400E',
    marginBottom: 2,
  },
  moreSymptoms: {
    fontSize: 12,
    color: '#92400E',
    fontStyle: 'italic',
  },
  backButton: {
    padding: 8,
  },
  progressContainer: {
    margin: 16,
  },
  progressText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#EF4444',
    borderRadius: 2,
  },
  problemDescription: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  problemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  problemText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  symptomsSection: {
    margin: 16,
  },
  symptomItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  symptomText: {
    fontSize: 14,
    color: '#1F2937',
    marginLeft: 8,
    flex: 1,
  },
  currentStepSection: {
    margin: 16,
  },
  stepCard: {
    backgroundColor: '#EBF8FF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  stepText: {
    fontSize: 16,
    color: '#1E40AF',
    fontWeight: '600',
  },
  possibleCausesSection: {
    margin: 16,
  },
  causeItem: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  causeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  causeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  likelihoodBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  likelihoodText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  solutionText: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  solutionSection: {
    margin: 16,
  },
  solutionCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 16,
  },
  solutionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
    marginBottom: 12,
  },
  solutionText: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  solutionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  resetButtonText: {
    color: '#10B981',
    fontWeight: '600',
    marginLeft: 8,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  completeButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  nextStepButton: {
    backgroundColor: '#EF4444',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextStepText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
});
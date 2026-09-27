import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

const BLUE = '#2563EB'; const YELLOW = '#FACC15'; const RED = '#EF4444';
const GREEN = '#22C55E'; const WHITE = '#FFFFFF'; const BG = '#F3F4F6';
const TEXT = '#111827'; const MUTED = '#4B5563'; const BORDER = '#E5E7EB';

const scenarios = [
  {
    id: 1, title: "Computer Won't Turn On",
    description: "A user reports their computer completely won't power on. No lights, no fans, nothing.",
    symptoms: ['No power lights', 'No fan noise', 'No display', 'Power button unresponsive'],
    possibleCauses: [
      { cause: 'Power supply failure', likelihood: 'High', solution: 'Replace PSU' },
      { cause: 'Loose power cable', likelihood: 'Medium', solution: 'Check all power connections' },
      { cause: 'Faulty power button', likelihood: 'Low', solution: 'Test with screwdriver on motherboard pins' },
      { cause: 'Dead motherboard', likelihood: 'Medium', solution: 'Professional diagnosis needed' },
    ],
    steps: ['Check power cable connections', 'Test power outlet with another device', 'Inspect PSU power switch (if present)', 'Try different power cable', 'Test PSU with paperclip method', 'Check motherboard power connections'],
    correctSolution: 'Check all power connections first, then test PSU',
  },
  {
    id: 2, title: 'Blue Screen of Death (BSOD)',
    description: 'Computer randomly crashes with blue screen showing error codes.',
    symptoms: ['Random blue screens', 'System restarts', 'Error codes displayed', 'Crashes during use'],
    possibleCauses: [
      { cause: 'Faulty RAM', likelihood: 'High', solution: 'Run memory test, replace bad RAM' },
      { cause: 'Driver issues', likelihood: 'High', solution: 'Update or rollback drivers' },
      { cause: 'Overheating', likelihood: 'Medium', solution: 'Clean fans, check thermal paste' },
      { cause: 'Hardware conflict', likelihood: 'Low', solution: 'Remove recently added hardware' },
    ],
    steps: ['Note the error code from BSOD', 'Boot into Safe Mode', 'Run Windows Memory Diagnostic', 'Check Event Viewer for errors', 'Update graphics and system drivers', 'Monitor system temperatures'],
    correctSolution: 'Run memory diagnostic and check for driver issues',
  },
  {
    id: 3, title: 'Slow Performance',
    description: 'Computer is running very slowly, taking forever to open programs and files.',
    symptoms: ['Slow boot times', 'Programs take long to open', 'Frequent freezing', 'High CPU usage'],
    possibleCauses: [
      { cause: 'Too many startup programs', likelihood: 'High', solution: 'Disable unnecessary startup items' },
      { cause: 'Insufficient RAM', likelihood: 'Medium', solution: 'Add more RAM or close programs' },
      { cause: 'Malware infection', likelihood: 'Medium', solution: 'Run antivirus scan' },
      { cause: 'Failing hard drive', likelihood: 'Low', solution: 'Check disk health, consider SSD upgrade' },
    ],
    steps: ['Check Task Manager for high CPU/RAM usage', 'Disable unnecessary startup programs', 'Run disk cleanup and defragmentation', 'Scan for malware', 'Check available storage space', 'Monitor system temperatures'],
    correctSolution: 'Check startup programs and run system cleanup',
  },
  {
    id: 4, title: 'No Display Output',
    description: "Computer turns on (fans spinning, lights on) but monitor shows no signal.",
    symptoms: ["Monitor shows 'No Signal'", 'Computer fans running', 'Power lights on', 'No BIOS screen'],
    possibleCauses: [
      { cause: 'Loose display cable', likelihood: 'High', solution: 'Reseat display cables' },
      { cause: 'Faulty graphics card', likelihood: 'Medium', solution: 'Reseat or replace GPU' },
      { cause: 'RAM not seated properly', likelihood: 'Medium', solution: 'Reseat RAM modules' },
      { cause: 'Monitor failure', likelihood: 'Low', solution: 'Test with different monitor' },
    ],
    steps: ['Check monitor power and cables', 'Try different display cable/port', 'Reseat RAM modules', 'Reseat graphics card', 'Try onboard graphics (if available)', 'Test with different monitor'],
    correctSolution: 'Check display connections and reseat components',
  },
  {
    id: 5, title: 'Overheating Issues',
    description: 'Computer shuts down randomly, especially during intensive tasks. System feels very hot.',
    symptoms: ['Random shutdowns', 'Very hot case', 'Loud fan noise', 'Performance throttling'],
    possibleCauses: [
      { cause: 'Dust buildup in fans', likelihood: 'High', solution: 'Clean all fans and heatsinks' },
      { cause: 'Thermal paste dried out', likelihood: 'Medium', solution: 'Replace thermal paste on CPU' },
      { cause: 'Fan failure', likelihood: 'Medium', solution: 'Replace failed fans' },
      { cause: 'Poor case ventilation', likelihood: 'Low', solution: 'Improve case airflow' },
    ],
    steps: ['Monitor CPU and GPU temperatures', 'Clean dust from all fans and heatsinks', 'Check if all fans are spinning', 'Reapply thermal paste on CPU', 'Ensure proper case ventilation', 'Consider additional case fans'],
    correctSolution: 'Clean dust buildup and check thermal paste',
  },
];

const likelihoodColor = (l) => l === 'High' ? RED : l === 'Medium' ? YELLOW : GREEN;

export default function TroubleshootingScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const [completedScenarios, setCompletedScenarios] = useState([]);

  const selectScenario = (scenario) => { setSelectedScenario(scenario); setCurrentStep(0); setShowSolution(false); };

  const nextStep = () => {
    if (currentStep < selectedScenario.steps.length - 1) setCurrentStep(currentStep + 1);
    else setShowSolution(true);
  };

  const completeScenario = () => {
    if (!completedScenarios.includes(selectedScenario.id)) setCompletedScenarios([...completedScenarios, selectedScenario.id]);
    Alert.alert('Scenario Completed!', "Great job! You've gained valuable diagnostic experience.", [{ text: 'Continue Learning', onPress: () => setSelectedScenario(null) }]);
  };

  if (!selectedScenario) return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}>
      <LinearGradient colors={[RED, '#DC2626']} style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <View style={styles.headerIconWrap}>
          <Ionicons name="bug" size={32} color={WHITE} />
        </View>
        <Text style={styles.headerTitle}>Troubleshooting Lab 🔧</Text>
        <Text style={styles.headerSubtitle}>Diagnose and solve real computer problems</Text>
      </LinearGradient>

      <View style={styles.statsRow}>
        {[
          { label: 'Completed', value: completedScenarios.length, color: GREEN },
          { label: 'Total', value: scenarios.length, color: BLUE },
          { label: 'Progress', value: `${Math.round((completedScenarios.length / scenarios.length) * 100)}%`, color: RED },
        ].map((s, i) => (
          <View key={i} style={styles.statCard}>
            <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Choose a Scenario</Text>

      {scenarios.map((scenario) => (
        <TouchableOpacity
          key={scenario.id}
          style={[styles.scenarioCard, completedScenarios.includes(scenario.id) && styles.scenarioCardDone]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); selectScenario(scenario); }}
          activeOpacity={0.75}
        >
          <View style={styles.scenarioTop}>
            <View style={styles.scenarioIconWrap}>
              <Ionicons name="warning" size={20} color={WHITE} />
            </View>
            <Text style={styles.scenarioTitle}>{scenario.title}</Text>
            {completedScenarios.includes(scenario.id) && <Ionicons name="checkmark-circle" size={22} color={GREEN} />}
          </View>
          <Text style={styles.scenarioDesc}>{scenario.description}</Text>
          <View style={styles.symptomsBox}>
            <Text style={styles.symptomsLabel}>Symptoms:</Text>
            {scenario.symptoms.slice(0, 2).map((s, i) => <Text key={i} style={styles.symptomItem}>• {s}</Text>)}
            {scenario.symptoms.length > 2 && <Text style={styles.symptomsMore}>+{scenario.symptoms.length - 2} more</Text>}
          </View>
        </TouchableOpacity>
      ))}
      <View style={{ height: 32 }} />
    </ScrollView>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}>
      <LinearGradient colors={[RED, '#DC2626']} style={[styles.detailHeader, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => setSelectedScenario(null)} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={WHITE} />
        </TouchableOpacity>
        <Text style={styles.detailTitle}>{selectedScenario.title}</Text>
      </LinearGradient>

      <View style={styles.progressWrap}>
        <Text style={styles.progressText}>Step {currentStep + 1} of {selectedScenario.steps.length}</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${((currentStep + 1) / selectedScenario.steps.length) * 100}%` }]} />
        </View>
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Problem Description</Text>
        <Text style={styles.blockText}>{selectedScenario.description}</Text>
      </View>

      <Text style={styles.sectionTitle}>Observed Symptoms</Text>
      {selectedScenario.symptoms.map((s, i) => (
        <View key={i} style={styles.symptomRow}>
          <View style={styles.symptomDot}><Ionicons name="warning" size={12} color={WHITE} /></View>
          <Text style={styles.symptomRowText}>{s}</Text>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Current Step</Text>
      <View style={styles.stepCard}>
        <View style={styles.stepNum}><Text style={styles.stepNumText}>{currentStep + 1}</Text></View>
        <Text style={styles.stepText}>{selectedScenario.steps[currentStep]}</Text>
      </View>

      <Text style={styles.sectionTitle}>Possible Causes</Text>
      {selectedScenario.possibleCauses.map((c, i) => (
        <View key={i} style={styles.causeCard}>
          <View style={styles.causeTop}>
            <Text style={styles.causeText}>{c.cause}</Text>
            <View style={[styles.likelihoodBadge, { backgroundColor: likelihoodColor(c.likelihood) + '20', borderColor: likelihoodColor(c.likelihood) }]}>
              <Text style={[styles.likelihoodText, { color: likelihoodColor(c.likelihood) }]}>{c.likelihood}</Text>
            </View>
          </View>
          <Text style={styles.causeSolution}>→ {c.solution}</Text>
        </View>
      ))}

      {showSolution ? (
        <View style={styles.solutionCard}>
          <View style={styles.solutionIconWrap}><Ionicons name="bulb" size={28} color={WHITE} /></View>
          <Text style={styles.solutionTitle}>Recommended Solution</Text>
          <Text style={styles.solutionText}>{selectedScenario.correctSolution}</Text>
          <View style={styles.solutionBtns}>
            <TouchableOpacity style={styles.resetBtn} onPress={() => { setCurrentStep(0); setShowSolution(false); }} activeOpacity={0.75}>
              <Ionicons name="refresh" size={16} color={BLUE} />
              <Text style={styles.resetBtnText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.completeBtn} onPress={completeScenario} activeOpacity={0.75}>
              <Ionicons name="checkmark" size={16} color={WHITE} />
              <Text style={styles.completeBtnText}>Complete ✓</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.nextStepBtn} onPress={nextStep} activeOpacity={0.75}>
          <Text style={styles.nextStepText}>{currentStep === selectedScenario.steps.length - 1 ? 'Show Solution 💡' : 'Next Step'}</Text>
          <Ionicons name="arrow-forward" size={18} color={WHITE} />
        </TouchableOpacity>
      )}
      <TouchableOpacity style={styles.chatbotBtn} onPress={() => navigation.navigate('Chatbot', { context: `Help me troubleshoot: ${selectedScenario.title}` })} activeOpacity={0.85}>
        <Ionicons name="chatbubbles" size={16} color={RED} />
        <Text style={styles.chatbotBtnText}>Ask CompuBot</Text>
      </TouchableOpacity>
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: { alignItems: 'center', paddingBottom: 32, paddingHorizontal: 20 },
  headerIconWrap: { width: 68, height: 68, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: WHITE, marginBottom: 6 },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.85)', textAlign: 'center' },
  statsRow: { flexDirection: 'row', margin: 16, gap: 10 },
  statCard: { flex: 1, backgroundColor: WHITE, borderRadius: 16, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  statValue: { fontSize: 22, fontWeight: '900' },
  statLabel: { fontSize: 11, color: MUTED, marginTop: 3, fontWeight: '600' },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: MUTED, marginHorizontal: 16, marginTop: 20, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  scenarioCard: { backgroundColor: WHITE, borderRadius: 16, marginHorizontal: 16, marginBottom: 12, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  scenarioCardDone: { borderWidth: 2, borderColor: GREEN },
  scenarioTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 10 },
  scenarioIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: RED, alignItems: 'center', justifyContent: 'center' },
  scenarioTitle: { fontSize: 15, fontWeight: '800', color: TEXT, flex: 1 },
  scenarioDesc: { fontSize: 13, color: MUTED, lineHeight: 19, marginBottom: 12 },
  symptomsBox: { backgroundColor: RED + '10', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: RED + '30' },
  symptomsLabel: { fontSize: 11, fontWeight: '800', color: RED, marginBottom: 4, textTransform: 'uppercase' },
  symptomItem: { fontSize: 12, color: MUTED, marginBottom: 2 },
  symptomsMore: { fontSize: 11, color: RED, fontStyle: 'italic', marginTop: 2 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: 20, paddingHorizontal: 16, gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  detailTitle: { fontSize: 16, fontWeight: '800', color: WHITE, flex: 1 },
  progressWrap: { margin: 16 },
  progressText: { fontSize: 12, color: MUTED, marginBottom: 8, fontWeight: '600' },
  progressBar: { height: 6, backgroundColor: BORDER, borderRadius: 3 },
  progressFill: { height: '100%', backgroundColor: RED, borderRadius: 3 },
  block: { backgroundColor: WHITE, borderRadius: 14, marginHorizontal: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  blockTitle: { fontSize: 13, fontWeight: '800', color: TEXT, marginBottom: 6 },
  blockText: { fontSize: 13, color: MUTED, lineHeight: 20 },
  symptomRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: WHITE, borderRadius: 10, marginHorizontal: 16, marginBottom: 6, padding: 12, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  symptomDot: { width: 24, height: 24, borderRadius: 8, backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center' },
  symptomRowText: { fontSize: 13, color: TEXT, flex: 1, fontWeight: '600' },
  stepCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: BLUE + '10', borderRadius: 14, marginHorizontal: 16, padding: 14, gap: 12, borderWidth: 2, borderColor: BLUE + '40' },
  stepNum: { width: 32, height: 32, borderRadius: 10, backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontSize: 14, fontWeight: '900', color: WHITE },
  stepText: { fontSize: 14, color: BLUE, fontWeight: '700', flex: 1 },
  causeCard: { backgroundColor: WHITE, borderRadius: 14, marginHorizontal: 16, marginBottom: 8, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  causeTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  causeText: { fontSize: 13, fontWeight: '700', color: TEXT, flex: 1 },
  likelihoodBadge: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  likelihoodText: { fontSize: 11, fontWeight: '800' },
  causeSolution: { fontSize: 12, color: MUTED, fontStyle: 'italic' },
  solutionCard: { alignItems: 'center', backgroundColor: WHITE, borderRadius: 16, margin: 16, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
  solutionIconWrap: { width: 56, height: 56, borderRadius: 16, backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  solutionTitle: { fontSize: 18, fontWeight: '900', color: TEXT, marginBottom: 10 },
  solutionText: { fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  solutionBtns: { flexDirection: 'row', gap: 12 },
  resetBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: BLUE, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, gap: 6 },
  resetBtnText: { color: BLUE, fontWeight: '800', fontSize: 13 },
  completeBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: GREEN, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, gap: 6 },
  completeBtnText: { color: WHITE, fontWeight: '800', fontSize: 13 },
  nextStepBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: RED, margin: 16, padding: 16, borderRadius: 14, gap: 8, shadowColor: RED, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  nextStepText: { color: WHITE, fontSize: 15, fontWeight: '900' },
  chatbotBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginHorizontal: 16, marginBottom: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: RED + '12', borderWidth: 1.5, borderColor: RED + '30' },
  chatbotBtnText: { fontSize: 13, fontWeight: '700', color: RED },
});

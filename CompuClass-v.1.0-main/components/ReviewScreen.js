import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * ReviewScreen
 * Props:
 *   missedQuestions: [{ question, options, answer, chosenAnswer, explanation, difficulty }]
 *   onDone: () => void
 *   traceColor: string
 */
export default function ReviewScreen({ missedQuestions, onDone, traceColor = '#00FF9C' }) {
  if (!missedQuestions?.length) {
    return (
      <View style={s.overlay}>
        <LinearGradient colors={['#0A3D1A', '#0D1B2A']} style={s.card}>
          <Text style={s.perfectEmoji}>🏆</Text>
          <Text style={[s.title, { color: traceColor }]}>PERFECT ROUND!</Text>
          <Text style={s.sub}>No missed questions — great work!</Text>
          <TouchableOpacity style={[s.doneBtn, { backgroundColor: traceColor }]} onPress={onDone}>
            <Text style={s.doneBtnText}>CONTINUE</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={s.overlay}>
      <LinearGradient colors={['#0D1B2A', '#0A0E1A']} style={s.card}>
        <View style={s.header}>
          <Text style={[s.title, { color: traceColor }]}>📋 REVIEW</Text>
          <Text style={s.missedCount}>{missedQuestions.length} missed</Text>
        </View>

        <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
          {missedQuestions.map((item, i) => (
            <View key={i} style={s.item}>
              <Text style={s.qText}>{item.question}</Text>

              <View style={s.answerRow}>
                <View style={[s.answerPill, s.wrongPill]}>
                  <Ionicons name="close-circle" size={12} color="#FF4757" />
                  <Text style={[s.answerPillText, { color: '#FF4757' }]}>
                    {['A','B','C','D'][item.chosenAnswer]}. {item.options[item.chosenAnswer]}
                  </Text>
                </View>
              </View>

              <View style={s.answerRow}>
                <View style={[s.answerPill, s.correctPill]}>
                  <Ionicons name="checkmark-circle" size={12} color="#00FF9C" />
                  <Text style={[s.answerPillText, { color: '#00FF9C' }]}>
                    {['A','B','C','D'][item.answer]}. {item.options[item.answer]}
                  </Text>
                </View>
              </View>

              <View style={s.explanationBox}>
                <Text style={s.explanationText}>
                  💡 {item.explanation ?? 'Review this topic in your course notes.'}
                </Text>
              </View>
            </View>
          ))}
          <View style={{ height: 20 }} />
        </ScrollView>

        <TouchableOpacity style={[s.doneBtn, { backgroundColor: traceColor }]} onPress={onDone}>
          <Text style={s.doneBtnText}>DONE</Text>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
}

const s = StyleSheet.create({
  overlay:         { ...StyleSheet.absoluteFillObject, zIndex: 100, justifyContent: 'center', padding: 16 },
  card:            { borderRadius: 20, padding: 20, maxHeight: '90%', borderWidth: 1, borderColor: '#1A3A5C' },
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title:           { fontSize: 16, fontWeight: '900', letterSpacing: 2 },
  missedCount:     { fontSize: 11, color: '#FF4757', fontWeight: '700' },
  perfectEmoji:    { fontSize: 48, textAlign: 'center', marginBottom: 8 },
  sub:             { fontSize: 13, color: '#4A7A9B', textAlign: 'center', marginBottom: 20 },
  list:            { flex: 1 },
  item:            { backgroundColor: '#0F1E30', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#1A3A5C' },
  qText:           { fontSize: 12, fontWeight: '700', color: '#E0F7FF', marginBottom: 10, lineHeight: 18 },
  answerRow:       { marginBottom: 6 },
  answerPill:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, alignSelf: 'flex-start' },
  wrongPill:       { borderColor: '#FF4757', backgroundColor: '#3D0A0A' },
  correctPill:     { borderColor: '#00FF9C', backgroundColor: '#0A3D1A' },
  answerPillText:  { fontSize: 11, fontWeight: '700', flexShrink: 1 },
  explanationBox:  { backgroundColor: '#1A2A3A', borderRadius: 8, padding: 10, marginTop: 6 },
  explanationText: { fontSize: 11, color: '#A0C4D8', lineHeight: 17 },
  doneBtn:         { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  doneBtnText:     { fontSize: 14, fontWeight: '900', color: '#0A0E1A', letterSpacing: 2 },
});

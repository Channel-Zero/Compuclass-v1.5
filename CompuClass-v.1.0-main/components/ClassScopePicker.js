import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';

// Optional class for a folder, document, or announcement. Null means every
// signed-in user, which the form labels "All my classes".
export default function ClassScopePicker({ classes, value, onChange, textColor = '#111827', mutedColor = '#4B5563', accent = '#2563EB' }) {
  const options = [{ id: null, name: 'All my classes' }, ...(classes || []).map((item) => ({ id: item.id, name: item.name }))];
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: mutedColor }]}>Class</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {options.map((item) => {
          const selected = (item.id || null) === (value || null);
          return (
            <TouchableOpacity
              key={item.id || 'all'}
              onPress={() => onChange(item.id)}
              style={[styles.chip, { borderColor: selected ? accent : '#E5E7EB', backgroundColor: selected ? accent : '#FFFFFF' }]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={item.name}
            >
              <Text style={[styles.chipText, { color: selected ? '#FFFFFF' : textColor }]}>{item.name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 8 },
  row: { gap: 8 },
  chip: { borderWidth: 2, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, minHeight: 44, justifyContent: 'center' },
  chipText: { fontSize: 13, fontWeight: '700' },
});

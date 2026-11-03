import React, { useState } from 'react';
import { View, TextInput, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const TEXT = '#111827';
const MUTED = '#4B5563';

// The wide-layout header search is a real text field. A pressable that only
// looked like a field could not be focused, and a click on it did nothing.
export default function HeaderSearch({ onSubmit, color = TEXT, placeholderColor = MUTED, borderColor = '#E5E7EB', backgroundColor = '#F9FAFB' }) {
  const [value, setValue] = useState('');

  const submit = () => {
    const query = value.trim();
    if (!query) return;
    onSubmit?.(query);
  };

  return (
    <View style={[styles.wrap, { borderColor, backgroundColor }]} pointerEvents="auto">
      <Ionicons name="search-outline" size={16} color={placeholderColor} />
      <TextInput
        value={value}
        onChangeText={setValue}
        onSubmitEditing={submit}
        placeholder="Search lessons, quizzes, games"
        placeholderTextColor={placeholderColor}
        style={[styles.input, { color }]}
        accessibilityLabel="Search lessons, quizzes, games"
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        editable
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    maxWidth: 420,
    height: 44,
    marginHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 999,
    paddingHorizontal: 14,
    backgroundColor: '#F9FAFB',
    zIndex: 20,
  },
  input: {
    flex: 1,
    height: 44,
    fontSize: 14,
    color: TEXT,
    paddingVertical: 0,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : null),
  },
});

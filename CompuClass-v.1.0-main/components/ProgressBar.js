import React from 'react';
import { View, StyleSheet } from 'react-native';

/**
 * ProgressBar
 * Props:
 *   ratio    0..1
 *   color    fill colour (topic accent)
 *   segments when set, draws that many discrete cells instead of one bar
 *   height   track height, default 6
 */
function ProgressBar({ ratio = 0, color = '#00FF9C', segments = 0, height = 6, style }) {
  const clamped = Math.max(0, Math.min(1, Number(ratio) || 0));

  if (segments > 0) {
    const filled = Math.round(clamped * segments);
    return (
      <View style={[s.row, style]} accessible={false}>
        {Array.from({ length: segments }).map((_, i) => (
          <View
            key={i}
            style={[
              s.cell,
              { height, backgroundColor: i < filled ? color : 'rgba(255,255,255,0.07)' },
              i < filled && { shadowColor: color },
            ]}
          />
        ))}
      </View>
    );
  }

  return (
    <View style={[s.track, { height }, style]}>
      <View style={[s.fill, { width: `${clamped * 100}%`, backgroundColor: color, height }]} />
    </View>
  );
}

const s = StyleSheet.create({
  row:   { flexDirection: 'row', gap: 2, alignItems: 'center' },
  cell:  { flex: 1, borderRadius: 2, shadowOpacity: 0.5, shadowRadius: 3, shadowOffset: { width: 0, height: 0 } },
  track: { width: '100%', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' },
  fill:  { borderRadius: 999 },
});

export default React.memo(ProgressBar);

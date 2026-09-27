import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect, Line } from 'react-native-svg';

/**
 * CircuitBackdrop
 * A static, non-interactive depth layer: two very faint ambient glows over a
 * circuit-board grid. Drawn once per size and memoised — no animation, so it
 * costs nothing to keep on screen on low-end devices.
 */
function CircuitBackdrop({ width, height, tint = '#00FF9C', accent = '#00BFFF' }) {
  const { cols, rows, step } = useMemo(() => {
    const gridStep = 32;
    return {
      step: gridStep,
      cols: Math.ceil(width / gridStep),
      rows: Math.ceil(height / gridStep),
    };
  }, [width, height]);

  return (
    <Svg
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      width={width}
      height={height}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Defs>
        <RadialGradient id="glowTop" cx="50%" cy="0%" r="70%">
          <Stop offset="0" stopColor={tint} stopOpacity="0.12" />
          <Stop offset="1" stopColor={tint} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="glowBottom" cx="15%" cy="100%" r="65%">
          <Stop offset="0" stopColor={accent} stopOpacity="0.10" />
          <Stop offset="1" stopColor={accent} stopOpacity="0" />
        </RadialGradient>
      </Defs>

      {Array.from({ length: cols + 1 }).map((_, c) => (
        <Line key={`c${c}`} x1={c * step} y1={0} x2={c * step} y2={height}
              stroke="#FFFFFF" strokeOpacity={0.022} strokeWidth={1} />
      ))}
      {Array.from({ length: rows + 1 }).map((_, r) => (
        <Line key={`r${r}`} x1={0} y1={r * step} x2={width} y2={r * step}
              stroke="#FFFFFF" strokeOpacity={0.022} strokeWidth={1} />
      ))}

      <Rect x={0} y={0} width={width} height={height} fill="url(#glowTop)" />
      <Rect x={0} y={0} width={width} height={height} fill="url(#glowBottom)" />
    </Svg>
  );
}

export default React.memo(CircuitBackdrop);

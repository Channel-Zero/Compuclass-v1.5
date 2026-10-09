import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

const MAP_W = 80;
const MAP_H = 80;
const COLS  = 11;
const ROWS  = 18;

function scaleX(col) { return (col / COLS) * MAP_W; }
function scaleY(row) { return (row / ROWS) * MAP_H; }

/**
 * MiniMap
 * Props:
 *   nodes:               level.nodes array
 *   edges:               level.edges array
 *   players:             [{ id, nodeId, color }] — other players
 *   currentPlayerNodeId: number — local player's node id
 *   myColor:             string — local player dot color
 *   traceColor:          string — theme trace color for edges
 */
export default function MiniMap({ nodes, edges, players = [], currentPlayerNodeId, myColor = '#00FF9C', traceColor = '#00FF9C' }) {
  const nodeMap = {};
  nodes.forEach(n => { nodeMap[n.id] = n; });

  return (
    <View style={s.container}>
      <Svg width={MAP_W} height={MAP_H}>
        {/* Edges */}
        {edges.map(([a, b], i) => {
          const na = nodeMap[a], nb = nodeMap[b];
          if (!na || !nb) return null;
          return (
            <Line
              key={i}
              x1={scaleX(na.col)} y1={scaleY(na.row)}
              x2={scaleX(nb.col)} y2={scaleY(nb.row)}
              stroke={traceColor} strokeWidth={0.5} opacity={0.3}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map(n => (
          <Circle
            key={n.id}
            cx={scaleX(n.col)} cy={scaleY(n.row)}
            r={n.type === 'finish' ? 3 : n.type === 'start' ? 2.5 : 1.5}
            fill={n.type === 'finish' ? '#FFD700' : n.type === 'drop' ? '#FF4757' : n.type === 'lock' ? '#FACC15' : '#1A3A5C'}
            opacity={0.7}
          />
        ))}

        {/* Other players */}
        {players.map(p => {
          const n = nodeMap[p.nodeId];
          if (!n) return null;
          return (
            <Circle
              key={p.id}
              cx={scaleX(n.col)} cy={scaleY(n.row)}
              r={4} fill={p.color || '#00BFFF'} opacity={0.9}
              stroke="#0A0E1A" strokeWidth={1}
            />
          );
        })}

        {/* Local player */}
        {(() => {
          const n = nodeMap[currentPlayerNodeId];
          if (!n) return null;
          return (
            <Circle
              cx={scaleX(n.col)} cy={scaleY(n.row)}
              r={4} fill={myColor} opacity={1}
              stroke="#0A0E1A" strokeWidth={1.5}
            />
          );
        })()}
      </Svg>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: MAP_W + 8,
    height: MAP_H + 8,
    backgroundColor: 'rgba(10,14,26,0.85)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1A3A5C',
    padding: 4,
    zIndex: 50,
  },
});

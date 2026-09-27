// circuitMazeLayout.js
// Node types: 'start' | 'finish' | 'drop' | 'lock' | undefined (normal)
// Coordinate space: col 0–10, row 0–17
// LEVELS_BY_TOPIC[topicId][levelIndex] → { nodes, edges }

export const LEVEL_THEMES = [
  { level:1,  label:'BOOT SECTOR',   bg:['#0A0E1A','#0D1B2A'], board:'#0D1B2A', trace:'#00FF9C', traceDim:'#0A3D2B', node:'#1A3A5C', nodeBorder:'#00FF9C', finish:'#FFD700', avatar:'#00BFFF', drop:'#FF4757', lock:'#FACC15' },
  { level:2,  label:'LOGIC GATES',   bg:['#0A1520','#0D2030'], board:'#0D2030', trace:'#00BFFF', traceDim:'#0A2A3D', node:'#1A3040', nodeBorder:'#00BFFF', finish:'#FFD700', avatar:'#00FF9C', drop:'#FF4757', lock:'#FACC15' },
  { level:3,  label:'RAM OVERFLOW',  bg:['#0F0A1A','#150D25'], board:'#150D25', trace:'#BF5FFF', traceDim:'#2A0A3D', node:'#2A1A3A', nodeBorder:'#BF5FFF', finish:'#FFD700', avatar:'#FACC15', drop:'#FF4757', lock:'#00FF9C' },
  { level:4,  label:'KERNEL PANIC',  bg:['#1A0A0A','#2A0D0D'], board:'#2A0D0D', trace:'#FF4757', traceDim:'#3D0A0A', node:'#3A1A1A', nodeBorder:'#FF4757', finish:'#FFD700', avatar:'#00BFFF', drop:'#FACC15', lock:'#BF5FFF' },
  { level:5,  label:'DEEP CACHE',    bg:['#0A1A0A','#0D2A0D'], board:'#0D2A0D', trace:'#22C55E', traceDim:'#0A3D0A', node:'#1A3A1A', nodeBorder:'#22C55E', finish:'#FFD700', avatar:'#FF4757', drop:'#BF5FFF', lock:'#00BFFF' },
  { level:6,  label:'FIREWALL',      bg:['#1A0F0A','#2A180D'], board:'#2A180D', trace:'#FF9F00', traceDim:'#3D2A0A', node:'#3A2A1A', nodeBorder:'#FF9F00', finish:'#FFD700', avatar:'#00FF9C', drop:'#FF4757', lock:'#BF5FFF' },
  { level:7,  label:'DARK NET',      bg:['#0A0A1A','#0D0D2A'], board:'#0D0D2A', trace:'#7C3AED', traceDim:'#1A0A3D', node:'#1A1A3A', nodeBorder:'#7C3AED', finish:'#FFD700', avatar:'#FF9F00', drop:'#FF4757', lock:'#00FF9C' },
  { level:8,  label:'QUANTUM CORE',  bg:['#0A1A1A','#0D2A2A'], board:'#0D2A2A', trace:'#06B6D4', traceDim:'#0A2A2A', node:'#1A3030', nodeBorder:'#06B6D4', finish:'#FFD700', avatar:'#BF5FFF', drop:'#FF4757', lock:'#FACC15' },
  { level:9,  label:'NEURAL GRID',   bg:['#1A0A1A','#2A0D2A'], board:'#2A0D2A', trace:'#EC4899', traceDim:'#3D0A2A', node:'#3A1A30', nodeBorder:'#EC4899', finish:'#FFD700', avatar:'#00BFFF', drop:'#FF4757', lock:'#00FF9C' },
  { level:10, label:'FINAL CIRCUIT', bg:['#1A1A0A','#2A2A0D'], board:'#2A2A0D', trace:'#EAB308', traceDim:'#3D3A0A', node:'#3A3A1A', nodeBorder:'#EAB308', finish:'#FF4757', avatar:'#BF5FFF', drop:'#FF4757', lock:'#00BFFF' },
];

export const buildAdjacency = (edges, nodes) => {
  const map = {};
  nodes.forEach(n => { map[n.id] = []; });
  edges.forEach(([a, b]) => {
    // Both ends must exist, or a typo'd edge leaves a one-way link to a node
    // that was never placed — which the distance map then treats as real.
    if (map[a] === undefined || map[b] === undefined) return;
    map[a].push(b);
    map[b].push(a);
  });
  return map;
};

// BFS hop-count from the start node to every reachable node. This is the only
// reliable notion of "backwards" — node ids are assigned in authoring order,
// not in path order, so they diverge as soon as a layout branches.
export const buildDistanceMap = (edges, nodes) => {
  const adj   = buildAdjacency(edges, nodes);
  const start = nodes.find(n => n.type === 'start') || nodes[0];
  const dist  = {};
  if (!start) return dist;
  dist[start.id] = 0;
  const queue = [start.id];
  while (queue.length) {
    const id = queue.shift();
    for (const nb of (adj[id] || [])) {
      if (dist[nb] === undefined) {
        dist[nb] = dist[id] + 1;
        queue.push(nb);
      }
    }
  }
  return dist;
};

// One step back towards the start: the neighbour with the lowest hop-count.
// Returns null at the start node, or when nothing sits closer.
export const stepBackFrom = (adjacency, distances, fromId) => {
  const here = distances[fromId];
  if (here === undefined || here === 0) return null;
  let best = null;
  for (const nb of (adjacency[fromId] || [])) {
    const d = distances[nb];
    if (d === undefined || d >= here) continue;
    if (best === null || d < distances[best]) best = nb;
  }
  return best;
};

function mk(nodes, edges) { return { nodes, edges }; }

// ─────────────────────────────────────────────────────────────────────────────
// NETWORKING — 10 unique hand-crafted topologies
// L1  Single router, 2 spokes            (tutorial, no obstacles)
// L2  Single router, 3 spokes            (1 drop dead-end spoke)
// L3  Two chained routers                (1 lock gate, 1 drop spoke)
// L4  Star topology                      (1 centre hub, 4 spokes, 1 lock)
// L5  Binary tree                        (root→2 branches→4 leaves, 1 drop)
// L6  Ring topology                      (circular path + 2 shortcuts, 1 drop, 1 lock)
// L7  Dual-ring with bridge              (2 rings joined, 2 drops, 2 locks)
// L8  Partial mesh                       (3 hubs cross-connected, 2 drops, 2 locks)
// L9  Backbone / spine                   (spine + 3 branch routers, 3 drops, 3 locks)
// L10 Full mesh + redundant paths        (4 hubs all-to-all, 3 drops, 3 locks)
// ─────────────────────────────────────────────────────────────────────────────

// L1 — Single router, 2 spokes, no obstacles
const NET_L1 = mk([
  { id:0, col:5, row:16, type:'start' },
  { id:1, col:2, row:13 },
  { id:2, col:8, row:13 },
  { id:3, col:5, row:10 },  // router hub
  { id:4, col:2, row:7  },
  { id:5, col:8, row:7  },
  { id:6, col:5, row:4  },
  { id:7, col:5, row:1,  type:'finish' },
], [
  [0,1],[0,2],[1,3],[2,3],
  [3,4],[3,5],[4,6],[5,6],[6,7],
]);

// L2 — Single router, 3 spokes, 1 drop dead-end
const NET_L2 = mk([
  { id:0, col:5, row:16, type:'start' },
  { id:1, col:2, row:13 },
  { id:2, col:8, row:13 },
  { id:3, col:5, row:10 },  // router hub
  { id:4, col:1, row:7,  type:'drop', penalty:2 },  // dead-end spoke
  { id:5, col:5, row:7  },
  { id:6, col:9, row:7  },
  { id:7, col:3, row:4  },
  { id:8, col:7, row:4  },
  { id:9, col:5, row:1,  type:'finish' },
], [
  [0,1],[0,2],[1,3],[2,3],
  [3,4],[3,5],[3,6],
  [5,7],[5,8],[6,8],
  [7,9],[8,9],
]);

// L3 — Two chained routers, 1 lock gate, 1 drop spoke
const NET_L3 = mk([
  { id:0,  col:5, row:16, type:'start' },
  { id:1,  col:2, row:14 },
  { id:2,  col:8, row:14 },
  { id:3,  col:5, row:12, type:'lock' },  // auth gate to router 1
  { id:4,  col:5, row:10 },               // router 1
  { id:5,  col:1, row:8,  type:'drop', penalty:3 },  // timeout spoke
  { id:6,  col:3, row:8  },
  { id:7,  col:7, row:8  },
  { id:8,  col:9, row:8  },
  { id:9,  col:3, row:5  },
  { id:10, col:7, row:5  },
  { id:11, col:5, row:3  },               // router 2
  { id:12, col:3, row:1  },
  { id:13, col:7, row:1  },
  { id:14, col:5, row:1,  type:'finish' },
], [
  [0,1],[0,2],[1,3],[2,3],[3,4],
  [4,5],[4,6],[4,7],[4,8],
  [6,9],[7,10],[8,10],[9,11],[10,11],
  [11,12],[11,13],[12,14],[13,14],
]);

// L4 — Star topology: 1 centre hub, 4 spokes, 1 lock on entry
const NET_L4 = mk([
  { id:0,  col:5, row:16, type:'start' },
  { id:1,  col:5, row:13 },
  { id:2,  col:5, row:11, type:'lock' },  // auth before hub
  { id:3,  col:5, row:9  },               // centre hub
  { id:4,  col:1, row:9  },               // spoke W
  { id:5,  col:9, row:9  },               // spoke E
  { id:6,  col:5, row:5  },               // spoke N
  { id:7,  col:2, row:6  },               // spoke NW
  { id:8,  col:8, row:6  },               // spoke NE
  { id:9,  col:3, row:3  },
  { id:10, col:7, row:3  },
  { id:11, col:5, row:1,  type:'finish' },
], [
  [0,1],[1,2],[2,3],
  [3,4],[3,5],[3,6],[3,7],[3,8],
  [4,7],[5,8],[6,9],[6,10],[7,9],[8,10],
  [9,11],[10,11],
]);

// L5 — Binary tree: root → 2 branches → 4 leaves, 1 drop on a branch
const NET_L5 = mk([
  { id:0,  col:5, row:16, type:'start' },
  { id:1,  col:5, row:13 },               // root router
  { id:2,  col:2, row:10 },               // branch L
  { id:3,  col:8, row:10 },               // branch R
  { id:4,  col:1, row:7,  type:'drop', penalty:2 },  // dead leaf
  { id:5,  col:3, row:7  },               // leaf L2
  { id:6,  col:7, row:7  },               // leaf R1
  { id:7,  col:9, row:7  },               // leaf R2
  { id:8,  col:2, row:4  },
  { id:9,  col:5, row:4  },
  { id:10, col:8, row:4  },
  { id:11, col:5, row:1,  type:'finish' },
], [
  [0,1],
  [1,2],[1,3],
  [2,4],[2,5],[3,6],[3,7],
  [5,8],[5,9],[6,9],[6,10],[7,10],
  [8,11],[9,11],[10,11],
]);

// L6 — Ring topology: circular path + 2 chord shortcuts, 1 drop, 1 lock
const NET_L6 = mk([
  { id:0,  col:5, row:16, type:'start' },
  { id:1,  col:2, row:14 },               // ring node SW
  { id:2,  col:8, row:14 },               // ring node SE
  { id:3,  col:1, row:10 },               // ring node W
  { id:4,  col:9, row:10 },               // ring node E
  { id:5,  col:2, row:6,  type:'drop', penalty:3 },  // ring node NW — trap
  { id:6,  col:8, row:6  },               // ring node NE
  { id:7,  col:5, row:2  },               // breather before lock
  { id:8,  col:5, row:4,  type:'lock' },  // ring top gate (not adjacent to drop)
  { id:9,  col:3, row:10 },               // chord shortcut W
  { id:10, col:7, row:10 },               // chord shortcut E
  { id:11, col:5, row:1,  type:'finish' },
], [
  // ring
  [0,1],[0,2],[1,3],[2,4],[3,5],[4,6],[5,7],[6,7],
  // chords
  [3,9],[4,10],[9,10],[9,8],[10,8],
  [7,8],[8,11],
]);

// L7 — Dual-ring with bridge: 2 rings joined at bridge nodes, 2 drops, 2 locks
const NET_L7 = mk([
  { id:0,  col:5, row:16, type:'start' },
  { id:1,  col:2, row:14 },
  { id:2,  col:8, row:14 },
  { id:3,  col:1, row:11 },
  { id:4,  col:4, row:11, type:'lock' },  // left ring gate
  { id:5,  col:1, row:9  },               // breather before drop
  { id:6,  col:1, row:7,  type:'drop', penalty:2 },  // not adjacent to lock(4)
  { id:7,  col:4, row:8  },               // bridge node L
  { id:8,  col:6, row:8  },               // bridge node R
  { id:9,  col:9, row:11, type:'lock' },  // right ring gate
  { id:10, col:9, row:9  },               // breather before drop
  { id:11, col:9, row:7,  type:'drop', penalty:2 },  // not adjacent to lock(9)
  { id:12, col:4, row:5  },
  { id:13, col:6, row:5  },
  { id:14, col:2, row:3  },
  { id:15, col:8, row:3  },
  { id:16, col:5, row:1,  type:'finish' },
], [
  [0,1],[0,2],[1,3],[2,9],
  [3,4],[4,5],[5,6],[5,7],[6,7],
  [9,10],[10,11],[10,8],[11,8],
  [7,8],[7,12],[8,13],
  [12,13],[12,14],[13,15],
  [14,16],[15,16],
]);

// L8 — Partial mesh: 3 hubs cross-connected, 2 drops, 2 locks
const NET_L8 = mk([
  { id:0,  col:5, row:16, type:'start' },
  { id:1,  col:2, row:14 },
  { id:2,  col:8, row:14 },
  { id:3,  col:2, row:11, type:'lock' },  // hub A gate
  { id:4,  col:2, row:9  },               // hub A
  { id:5,  col:5, row:11, type:'lock' },  // hub B gate
  { id:6,  col:5, row:9  },               // hub B
  { id:7,  col:8, row:11 },
  { id:8,  col:8, row:9  },               // hub C
  { id:9,  col:1, row:6,  type:'drop', penalty:3 },  // spoke off A
  { id:10, col:3, row:6  },
  { id:11, col:5, row:6  },
  { id:12, col:7, row:6  },
  { id:13, col:9, row:6,  type:'drop', penalty:3 },  // spoke off C
  { id:14, col:3, row:3  },
  { id:15, col:7, row:3  },
  { id:16, col:5, row:1,  type:'finish' },
], [
  [0,1],[0,2],[1,3],[2,7],
  [3,4],[5,6],[7,8],
  // mesh cross-links
  [4,6],[6,8],[4,8],
  [4,9],[4,10],[6,11],[8,12],[8,13],
  [10,14],[11,14],[11,15],[12,15],
  [14,16],[15,16],
]);

// L9 — Backbone/spine: horizontal spine + 3 branch routers, 3 drops, 3 locks
const NET_L9 = mk([
  { id:0,  col:1, row:16, type:'start' },
  { id:1,  col:1, row:13 },               // spine W
  { id:2,  col:4, row:13 },               // spine junction 1
  { id:3,  col:4, row:11, type:'lock' },  // branch 1 gate
  { id:4,  col:4, row:9  },               // branch router 1
  { id:5,  col:2, row:7,  type:'drop', penalty:2 },
  { id:6,  col:6, row:7  },
  { id:7,  col:7, row:13 },               // spine junction 2
  { id:8,  col:7, row:11, type:'lock' },  // branch 2 gate
  { id:9,  col:7, row:9  },               // branch router 2
  { id:10, col:5, row:7  },
  { id:11, col:9, row:7,  type:'drop', penalty:2 },
  { id:12, col:9, row:13 },               // spine E
  { id:13, col:9, row:11, type:'lock' },  // branch 3 gate
  { id:14, col:9, row:9  },               // branch router 3
  { id:15, col:8, row:7  },
  { id:16, col:5, row:4,  type:'drop', penalty:3 },
  { id:17, col:5, row:2  },
  { id:18, col:5, row:1,  type:'finish' },
], [
  [0,1],[1,2],[2,7],[7,12],
  [2,3],[3,4],[4,5],[4,6],
  [7,8],[8,9],[9,10],[9,11],
  [12,13],[13,14],[14,15],
  [6,10],[10,15],[15,17],
  [5,17],[11,17],[16,17],
  [17,18],
]);

// L10 — Full mesh: 4 hubs all-to-all + redundant spokes, 3 drops, 3 locks
const NET_L10 = mk([
  { id:0,  col:5, row:16, type:'start' },
  { id:1,  col:2, row:14 },
  { id:2,  col:8, row:14 },
  { id:3,  col:2, row:11, type:'lock' },  // hub A gate
  { id:4,  col:2, row:9  },               // hub A
  { id:5,  col:8, row:11, type:'lock' },  // hub B gate
  { id:6,  col:8, row:9  },               // hub B
  { id:7,  col:1, row:6,  type:'drop', penalty:3 },
  { id:8,  col:3, row:6  },
  { id:9,  col:5, row:8,  type:'lock' },  // hub C gate
  { id:10, col:5, row:6  },               // hub C
  { id:11, col:7, row:6  },
  { id:12, col:9, row:6,  type:'drop', penalty:3 },
  // full mesh cross-links between A, B, C
  { id:13, col:3, row:4  },
  { id:14, col:7, row:4  },
  { id:15, col:5, row:3,  type:'drop', penalty:2 },
  { id:16, col:2, row:2  },
  { id:17, col:8, row:2  },
  { id:18, col:5, row:1,  type:'finish' },
], [
  [0,1],[0,2],[1,3],[2,5],
  [3,4],[5,6],
  // mesh: A↔B↔C↔A
  [4,6],[4,9],[6,9],
  [4,7],[4,8],[6,11],[6,12],
  [9,10],[10,8],[10,11],
  [8,13],[11,14],[10,15],
  [13,16],[14,17],[13,14],
  [16,18],[17,18],[15,18],
]);

const NET_LEVELS = [
  NET_L1, NET_L2, NET_L3, NET_L4, NET_L5,
  NET_L6, NET_L7, NET_L8, NET_L9, NET_L10,
];

// ─────────────────────────────────────────────────────────────────────────────
// HARDWARE — 10 unique hand-crafted PCB layouts
// L1  Simple bus, 1 socket branch          (tutorial, no obstacles)
// L2  Dual bus lanes, 2 sockets            (1 drop)
// L3  T-shaped PCB, 3 sockets              (1 drop, 1 lock)
// L4  L-shaped trace, 4 sockets            (1 drop, 1 lock)
// L5  H-bridge, 2 parallel buses+crossbar  (2 drops, 1 lock)
// L6  CPU socket layout, 4 pin banks       (2 drops, 2 locks)
// L7  Memory bus, DIMM slots off spine     (2 drops, 2 locks)
// L8  PCI-e lanes, root→4 slots            (3 drops, 2 locks)
// L9  Motherboard trace, 3 buses           (3 drops, 3 locks)
// L10 Full board, all subsystems           (3 drops, 3 locks)
// ─────────────────────────────────────────────────────────────────────────────

// L1 — Simple horizontal bus, 1 socket branch, no obstacles
const HW_L1 = mk([
  { id:0, col:1, row:14, type:'start' },
  { id:1, col:3, row:14 },
  { id:2, col:5, row:14 },  // branch point
  { id:3, col:5, row:11 },  // socket
  { id:4, col:7, row:14 },
  { id:5, col:9, row:14 },
  { id:6, col:9, row:9  },
  { id:7, col:5, row:5  },
  { id:8, col:5, row:1,  type:'finish' },
], [
  [0,1],[1,2],[2,3],[3,4],[2,4],[4,5],[5,6],[6,7],[7,8],
]);

// L2 — Dual bus lanes (top + bottom), 2 sockets, 1 drop
const HW_L2 = mk([
  { id:0,  col:1, row:16, type:'start' },
  { id:1,  col:1, row:13 },               // bus A start
  { id:2,  col:1, row:10 },               // bus B start
  { id:3,  col:4, row:13 },               // bus A mid
  { id:4,  col:4, row:10, type:'drop', penalty:2 },  // short circuit on bus B
  { id:5,  col:4, row:7  },               // socket off bus B safe alt
  { id:6,  col:7, row:13 },               // bus A end
  { id:7,  col:7, row:10 },               // socket off bus B
  { id:8,  col:9, row:13 },
  { id:9,  col:9, row:7  },
  { id:10, col:5, row:4  },
  { id:11, col:5, row:1,  type:'finish' },
], [
  [0,1],[0,2],[1,3],[2,4],[2,5],
  [3,6],[4,7],[5,7],[6,8],[7,9],
  [8,10],[9,10],[10,11],
]);

// L3 — T-shaped PCB: horizontal trunk + vertical stem, 3 sockets, 1 drop, 1 lock
const HW_L3 = mk([
  { id:0,  col:1, row:10, type:'start' },
  { id:1,  col:3, row:10 },               // trunk W
  { id:2,  col:3, row:7,  type:'drop', penalty:3 },  // socket short circuit
  { id:3,  col:3, row:13 },               // safe alt below
  { id:4,  col:5, row:10 },               // trunk centre (T junction)
  { id:5,  col:5, row:7  },               // stem up
  { id:6,  col:5, row:4  },
  { id:7,  col:7, row:10 },               // trunk E
  { id:8,  col:7, row:7,  type:'lock' },  // socket needs driver
  { id:9,  col:9, row:10 },
  { id:10, col:9, row:5  },
  { id:11, col:5, row:2  },
  { id:12, col:5, row:1,  type:'finish' },
], [
  [0,1],[1,2],[1,3],[3,4],[2,4],
  [4,5],[4,7],[5,6],[7,8],[7,9],
  [9,10],[8,10],[6,11],[10,11],[11,12],
]);

// L4 — L-shaped trace: horizontal then vertical turn, 4 sockets, 1 drop, 1 lock
const HW_L4 = mk([
  { id:0,  col:1, row:15, type:'start' },
  { id:1,  col:3, row:15 },
  { id:2,  col:3, row:12, type:'drop', penalty:2 },  // socket short circuit
  { id:3,  col:3, row:16 },               // safe alt
  { id:4,  col:5, row:15 },
  { id:5,  col:5, row:12 },               // socket
  { id:6,  col:7, row:15 },
  { id:7,  col:7, row:12, type:'lock' },  // socket needs driver
  { id:8,  col:9, row:15 },               // corner of L
  { id:9,  col:9, row:11 },
  { id:10, col:9, row:7  },
  { id:11, col:7, row:4  },               // socket on vertical
  { id:12, col:5, row:4  },
  { id:13, col:5, row:1,  type:'finish' },
], [
  [0,1],[1,2],[1,3],[3,4],[2,4],
  [4,5],[4,6],[5,6],[6,7],[6,8],
  [8,9],[9,10],[7,10],[10,11],[10,12],
  [11,12],[12,13],
]);

// L5 — H-bridge: 2 parallel vertical buses + horizontal crossbar, 2 drops, 1 lock
const HW_L5 = mk([
  { id:0,  col:5, row:16, type:'start' },
  { id:1,  col:2, row:14 },               // bus L entry
  { id:2,  col:8, row:14 },               // bus R entry
  { id:3,  col:2, row:11 },               // bus L mid
  { id:4,  col:8, row:11 },               // bus R mid
  { id:5,  col:5, row:11, type:'lock' },  // crossbar gate
  { id:6,  col:2, row:8,  type:'drop', penalty:3 },  // bus L short
  { id:7,  col:8, row:8,  type:'drop', penalty:3 },  // bus R short — fixed below by fixAdjObs if needed
  { id:8,  col:2, row:5  },               // bus L top
  { id:9,  col:8, row:5  },               // bus R top
  { id:10, col:5, row:5  },               // crossbar top
  { id:11, col:3, row:2  },
  { id:12, col:7, row:2  },
  { id:13, col:5, row:1,  type:'finish' },
], [
  [0,1],[0,2],[1,3],[2,4],
  [3,5],[4,5],           // crossbar
  [3,6],[4,7],
  [6,8],[7,9],[5,10],
  [8,10],[9,10],
  [8,11],[9,12],[10,11],[10,12],
  [11,13],[12,13],
]);

// L6 — CPU socket: central chip node, 4 pin banks radiating out, 2 drops, 2 locks
const HW_L6 = mk([
  { id:0,  col:5, row:16, type:'start' },
  { id:1,  col:5, row:13 },               // south pin bank
  { id:2,  col:5, row:11, type:'lock' },  // south socket gate
  { id:3,  col:5, row:9  },               // CPU chip (centre)
  { id:4,  col:2, row:9  },               // west pin bank
  { id:5,  col:8, row:9  },               // east pin bank
  { id:6,  col:1, row:7,  type:'drop', penalty:2 },  // west short
  { id:7,  col:3, row:7  },
  { id:8,  col:7, row:7  },
  { id:9,  col:9, row:7,  type:'drop', penalty:2 },  // east short
  { id:10, col:5, row:7,  type:'lock' },  // north socket gate
  { id:11, col:5, row:5  },               // north pin bank
  { id:12, col:3, row:3  },
  { id:13, col:7, row:3  },
  { id:14, col:5, row:1,  type:'finish' },
], [
  [0,1],[1,2],[2,3],
  [3,4],[3,5],[3,10],
  [4,6],[4,7],[5,8],[5,9],
  [7,10],[8,10],
  [10,11],[11,12],[11,13],
  [12,14],[13,14],
]);

// L7 — Memory bus: horizontal spine, DIMM slots branch above+below, 2 drops, 2 locks
const HW_L7 = mk([
  { id:0,  col:1, row:9,  type:'start' },
  { id:1,  col:3, row:9  },               // spine node 1
  { id:2,  col:3, row:6,  type:'lock' },  // DIMM slot 1 gate
  { id:3,  col:3, row:3  },               // DIMM 1 top
  { id:4,  col:3, row:12, type:'drop', penalty:2 },  // DIMM 1 bottom short
  { id:5,  col:5, row:9  },               // spine node 2
  { id:6,  col:5, row:6  },               // DIMM 2 top
  { id:7,  col:5, row:12 },               // DIMM 2 bottom
  { id:8,  col:7, row:9  },               // spine node 3
  { id:9,  col:7, row:6,  type:'lock' },  // DIMM 3 gate
  { id:10, col:7, row:3  },               // DIMM 3 top
  { id:11, col:7, row:12, type:'drop', penalty:2 },  // DIMM 3 bottom short
  { id:12, col:9, row:9  },               // spine end
  { id:13, col:9, row:5  },
  { id:14, col:7, row:2  },
  { id:15, col:5, row:1,  type:'finish' },
], [
  [0,1],[1,2],[1,4],[2,3],[3,5],
  [1,5],[5,6],[5,7],[6,8],[7,8],
  [8,9],[8,11],[9,10],[10,12],
  [8,12],[12,13],[13,14],[10,14],[14,15],
]);

// L8 — PCI-e lanes: root complex → 4 slots with bifurcation, 3 drops, 2 locks
const HW_L8 = mk([
  { id:0,  col:5, row:16, type:'start' },
  { id:1,  col:5, row:14 },               // root complex
  { id:2,  col:2, row:12 },               // lane split L
  { id:3,  col:8, row:12 },               // lane split R
  { id:4,  col:1, row:9,  type:'drop', penalty:2 },  // slot 1 short
  { id:5,  col:3, row:9,  type:'lock' },  // slot 2 gate
  { id:6,  col:3, row:6  },               // slot 2
  { id:7,  col:7, row:9,  type:'lock' },  // slot 3 gate
  { id:8,  col:7, row:6  },               // slot 3
  { id:9,  col:9, row:9,  type:'drop', penalty:2 },  // slot 4 short
  { id:10, col:2, row:4  },
  { id:11, col:5, row:4,  type:'drop', penalty:3 },  // bifurcation trap
  { id:12, col:8, row:4  },
  { id:13, col:3, row:2  },
  { id:14, col:7, row:2  },
  { id:15, col:5, row:1,  type:'finish' },
], [
  [0,1],[1,2],[1,3],
  [2,4],[2,5],[3,7],[3,9],
  [5,6],[7,8],
  [6,10],[6,11],[8,11],[8,12],
  [10,13],[11,13],[11,14],[12,14],
  [13,15],[14,15],
]);

// L9 — Motherboard trace: power rail + data bus + address bus, 3 drops, 3 locks
const HW_L9 = mk([
  { id:0,  col:1, row:16, type:'start' },
  { id:1,  col:1, row:13 },               // power rail W
  { id:2,  col:4, row:13 },               // power rail mid
  { id:3,  col:4, row:10, type:'lock' },  // data bus gate
  { id:4,  col:4, row:7  },               // data bus node
  { id:5,  col:2, row:7,  type:'drop', penalty:2 },  // data bus short
  { id:6,  col:6, row:7  },
  { id:7,  col:7, row:13 },               // power rail E
  { id:8,  col:7, row:10, type:'lock' },  // address bus gate
  { id:9,  col:7, row:7  },               // address bus node
  { id:10, col:9, row:7,  type:'drop', penalty:2 },  // address bus short
  { id:11, col:9, row:13 },
  { id:12, col:9, row:10, type:'lock' },  // third bus gate
  { id:13, col:9, row:4  },
  { id:14, col:6, row:4,  type:'drop', penalty:3 },  // trace short
  { id:15, col:4, row:2  },
  { id:16, col:7, row:2  },
  { id:17, col:5, row:1,  type:'finish' },
], [
  [0,1],[1,2],[2,7],[7,11],
  [2,3],[3,4],[4,5],[4,6],
  [7,8],[8,9],[9,10],[9,6],
  [11,12],[12,13],[13,14],[13,16],
  [6,15],[14,15],[15,17],[16,17],
]);

// L10 — Full board: power + data + address + control buses, 3 drops, 3 locks
const HW_L10 = mk([
  { id:0,  col:1, row:16, type:'start' },
  { id:1,  col:1, row:13 },               // power rail
  { id:2,  col:3, row:13 },
  { id:3,  col:3, row:10, type:'lock' },  // data bus gate
  { id:4,  col:3, row:7  },               // data bus
  { id:5,  col:1, row:7,  type:'drop', penalty:2 },
  { id:6,  col:5, row:13 },
  { id:7,  col:5, row:10, type:'lock' },  // address bus gate
  { id:8,  col:5, row:7  },               // address bus
  { id:9,  col:5, row:4  },
  { id:10, col:7, row:13 },
  { id:11, col:7, row:10, type:'lock' },  // control bus gate
  { id:12, col:7, row:7  },               // control bus
  { id:13, col:7, row:4,  type:'drop', penalty:3 },
  { id:14, col:9, row:13 },
  { id:15, col:9, row:10 },
  { id:16, col:9, row:7,  type:'drop', penalty:2 },
  { id:17, col:9, row:4  },
  { id:18, col:5, row:2  },
  { id:19, col:5, row:1,  type:'finish' },
], [
  [0,1],[1,2],[2,6],[6,10],[10,14],
  [2,3],[3,4],[4,5],[4,8],
  [6,7],[7,8],[8,9],[8,12],
  [10,11],[11,12],[12,13],[12,15],
  [14,15],[15,16],[15,17],
  [9,18],[13,18],[17,18],[16,17],
  [18,19],
]);

const HW_LEVELS = [
  HW_L1, HW_L2, HW_L3, HW_L4, HW_L5,
  HW_L6, HW_L7, HW_L8, HW_L9, HW_L10,
];

// ─────────────────────────────────────────────────────────────────────────────
// SOFTWARE — 10 unique hand-crafted call-stack / control-flow layouts
// L1  Simple 2-layer call stack          (tutorial, no obstacles)
// L2  3-layer stack                      (1 lock, 1 drop)
// L3  Branching function calls           (2 paths, 1 lock, 1 drop)
// L4  Recursive loop                     (back-edge cycle, 1 lock, 1 drop)
// L5  Try / catch / finally              (3 branches, 2 locks, 1 drop)
// L6  Event-driven listeners             (emitter → 3 listeners, 2 drops, 2 locks)
// L7  Async / await chain                (sequential awaits + timeouts, 2 drops, 2 locks)
// L8  Microservices + API gateway        (3 services, 3 drops, 2 locks)
// L9  Compiler pipeline                  (lex→parse→AST→codegen, 3 drops, 3 locks)
// L10 Full runtime                       (GC+heap+stack+event loop, 3 drops, 3 locks)
// ─────────────────────────────────────────────────────────────────────────────

// L1 — Simple 2-layer call stack, no obstacles
const SW_L1 = mk([
  { id:0, col:5, row:1,  type:'start' },
  { id:1, col:2, row:4  },               // UI layer L
  { id:2, col:8, row:4  },               // UI layer R
  { id:3, col:2, row:9  },               // Logic layer L
  { id:4, col:5, row:9  },               // Logic layer C
  { id:5, col:8, row:9  },               // Logic layer R
  { id:6, col:5, row:13 },               // Data layer
  { id:7, col:5, row:16, type:'finish' },
], [
  [0,1],[0,2],[1,3],[1,4],[2,4],[2,5],
  [3,6],[4,6],[5,6],[6,7],
]);

// L2 — 3-layer stack, 1 lock gate, 1 drop exception
const SW_L2 = mk([
  { id:0,  col:5, row:1,  type:'start' },
  { id:1,  col:2, row:4  },
  { id:2,  col:8, row:4  },
  { id:3,  col:5, row:6,  type:'lock' },  // layer 1→2 gate
  { id:4,  col:2, row:9  },
  { id:5,  col:5, row:9  },
  { id:6,  col:8, row:9  },
  { id:7,  col:8, row:12, type:'drop', penalty:2 },  // exception thrown
  { id:8,  col:2, row:12 },
  { id:9,  col:5, row:12 },
  { id:10, col:5, row:16, type:'finish' },
], [
  [0,1],[0,2],[1,3],[2,3],
  [3,4],[3,5],[3,6],
  [4,8],[5,9],[6,7],
  [7,9],[8,9],[8,10],[9,10],
]);

// L3 — Branching function calls: 2 call paths converge, 1 lock, 1 drop
const SW_L3 = mk([
  { id:0,  col:5, row:1,  type:'start' },
  { id:1,  col:2, row:4  },               // path A entry
  { id:2,  col:8, row:4  },               // path B entry
  { id:3,  col:2, row:7,  type:'lock' },  // path A gate
  { id:4,  col:2, row:10 },               // path A deep
  { id:5,  col:8, row:7  },               // path B mid
  { id:6,  col:8, row:10, type:'drop', penalty:3 },  // path B exception
  { id:7,  col:5, row:10 },               // safe merge
  { id:8,  col:5, row:13 },               // converge
  { id:9,  col:3, row:15 },
  { id:10, col:7, row:15 },
  { id:11, col:5, row:16, type:'finish' },
], [
  [0,1],[0,2],[1,3],[2,5],
  [3,4],[5,6],[5,7],
  [4,8],[7,8],[6,8],
  [8,9],[8,10],[9,11],[10,11],
]);

// L4 — Recursive loop: back-edge from deep node back up, 1 lock, 1 drop
const SW_L4 = mk([
  { id:0,  col:5, row:1,  type:'start' },
  { id:1,  col:5, row:4,  type:'lock' },  // function entry gate
  { id:2,  col:2, row:7  },               // base case branch
  { id:3,  col:5, row:7  },               // recursive call
  { id:4,  col:8, row:7  },
  { id:5,  col:5, row:10 },               // deeper frame
  { id:6,  col:2, row:10, type:'drop', penalty:2 },  // stack overflow trap
  { id:7,  col:8, row:10 },
  { id:8,  col:5, row:13 },               // return point
  { id:9,  col:3, row:15 },
  { id:10, col:7, row:15 },
  { id:11, col:5, row:16, type:'finish' },
], [
  [0,1],[1,2],[1,3],[1,4],
  [3,5],[4,7],[2,6],
  [5,8],[7,8],[6,8],
  // back-edge: recursive return
  [8,3],
  [8,9],[8,10],[9,11],[10,11],
]);

// L5 — Try/catch/finally: 3 branches from try node, 2 locks, 1 drop
const SW_L5 = mk([
  { id:0,  col:5, row:1,  type:'start' },
  { id:1,  col:5, row:4,  type:'lock' },  // try block gate
  { id:2,  col:2, row:7  },               // try body
  { id:3,  col:5, row:7  },
  { id:4,  col:8, row:9,  type:'drop', penalty:2 },  // exception (row 9, not adjacent to lock at row 4)
  { id:5,  col:2, row:10 },               // catch block
  { id:6,  col:5, row:10, type:'lock' },  // finally gate (not adjacent to drop at row 9)
  { id:7,  col:8, row:12 },               // catch handler
  { id:8,  col:2, row:13 },
  { id:9,  col:5, row:13 },               // finally block
  { id:10, col:8, row:13 },
  { id:11, col:5, row:16, type:'finish' },
], [
  [0,1],[1,2],[1,3],
  [3,4],[2,5],[3,6],
  [4,7],[5,8],[6,9],[7,9],[7,10],
  [8,11],[9,11],[10,11],
]);

// L6 — Event-driven: emitter fans to 3 listeners, 2 drops, 2 locks
const SW_L6 = mk([
  { id:0,  col:5, row:1,  type:'start' },
  { id:1,  col:5, row:4  },               // event emitter
  { id:2,  col:1, row:7,  type:'drop', penalty:2 },  // listener 1 timeout
  { id:3,  col:5, row:7,  type:'lock' },  // listener 2 gate
  { id:4,  col:9, row:7  },               // listener 3
  { id:5,  col:3, row:10 },
  { id:6,  col:5, row:10 },               // listener 2 handler
  { id:7,  col:7, row:10, type:'lock' },  // listener 3 gate
  { id:8,  col:9, row:10, type:'drop', penalty:2 },  // listener 3 timeout
  { id:9,  col:3, row:13 },
  { id:10, col:7, row:13 },
  { id:11, col:5, row:15 },
  { id:12, col:5, row:16, type:'finish' },
], [
  [0,1],[1,2],[1,3],[1,4],
  [2,5],[3,6],[4,7],[4,8],
  [5,9],[6,9],[6,10],[7,10],[8,10],
  [9,11],[10,11],[11,12],
]);

// L7 — Async/await chain: sequential awaits with timeout drops, 2 drops, 2 locks
const SW_L7 = mk([
  { id:0,  col:5, row:1,  type:'start' },
  { id:1,  col:5, row:3,  type:'lock' },  // await 1 gate
  { id:2,  col:2, row:6  },               // promise resolve path
  { id:3,  col:5, row:6  },               // breather
  { id:4,  col:8, row:8,  type:'drop', penalty:2 },  // await 1 timeout (row 8, not adjacent to lock row 3)
  { id:5,  col:5, row:10, type:'lock' },  // await 2 gate (row 10, not adjacent to drop row 8)
  { id:6,  col:2, row:12 },               // promise resolve path
  { id:7,  col:5, row:12 },
  { id:8,  col:8, row:13, type:'drop', penalty:2 },  // await 2 timeout (row 13, not adjacent to lock row 10)
  { id:9,  col:2, row:14 },
  { id:10, col:5, row:14 },
  { id:11, col:8, row:15 },
  { id:12, col:5, row:16, type:'finish' },
], [
  [0,1],[1,2],[1,3],
  [3,4],[2,5],[3,5],
  [5,6],[5,7],[4,7],
  [7,8],[6,9],[7,10],[8,11],
  [9,12],[10,12],[11,12],
]);

// L8 — Microservices + API gateway: 3 services, 3 drops, 2 locks.
// The service tier fans back in over three separate approaches to the
// database: a read replica on the left, the connection pool in the middle
// (which can exhaust itself), and a cache layer on the right. The pool used
// to be the only node touching the finish that a centre-lane player could
// see, which read as a mandatory drop right before the level exit.
const SW_L8 = mk([
  { id:0,  col:5, row:1,  type:'start' },
  { id:1,  col:5, row:4,  type:'lock' },  // API gateway auth
  { id:2,  col:1, row:7  },               // service A
  { id:3,  col:5, row:7  },               // service B
  { id:4,  col:9, row:7  },               // service C
  { id:5,  col:1, row:10, type:'drop', penalty:2 },  // service A timeout
  { id:6,  col:3, row:10 },
  { id:7,  col:5, row:10, type:'lock' },  // service B gate
  { id:8,  col:7, row:10 },
  { id:9,  col:9, row:10, type:'drop', penalty:2 },  // service C timeout
  { id:10, col:2, row:12 },               // aggregator L
  { id:11, col:5, row:12 },               // aggregator C
  { id:12, col:8, row:12 },               // aggregator R
  { id:13, col:2, row:14 },               // read replica — clean left approach
  { id:14, col:5, row:14, type:'drop', penalty:3 },  // connection pool exhausted
  { id:15, col:8, row:14 },               // cache layer — clean right approach
  { id:16, col:5, row:16, type:'finish' },
], [
  [0,1],[1,2],[1,3],[1,4],
  [2,5],[2,6],[3,7],[4,8],[4,9],
  [6,10],[7,11],[8,12],[9,12],
  [10,11],[11,12],
  // Every aggregator reaches a clean approach, so the middle lane is a
  // temptation rather than a toll gate.
  [10,13],[11,13],[11,14],[11,15],[12,15],
  [13,16],[14,16],[15,16],
]);

// L9 — Compiler pipeline: lex→parse→AST→codegen, 3 drops, 3 locks
const SW_L9 = mk([
  { id:0,  col:5, row:1,  type:'start' },
  { id:1,  col:5, row:3,  type:'lock' },  // lexer gate
  { id:2,  col:2, row:5  },               // token stream L
  { id:3,  col:5, row:5  },               // token stream C (breather)
  { id:4,  col:8, row:7,  type:'drop', penalty:2 },  // lex error (row 7, not adj to lock row 3)
  { id:5,  col:5, row:9,  type:'lock' },  // parser gate (row 9, not adj to drop row 7)
  { id:6,  col:2, row:11 },               // AST node L
  { id:7,  col:5, row:11 },               // AST root (breather)
  { id:8,  col:8, row:13, type:'drop', penalty:2 },  // parse error (row 13, not adj to lock row 9)
  { id:9,  col:5, row:14, type:'lock' },  // codegen gate (row 14, not adj to drop row 13)
  { id:10, col:2, row:15 },
  { id:11, col:5, row:15 },
  { id:12, col:8, row:16, type:'drop', penalty:3 },  // codegen error
  { id:13, col:5, row:16, type:'finish' },
], [
  [0,1],[1,2],[1,3],
  [3,4],[2,5],[3,5],
  [5,6],[5,7],[4,7],
  [7,8],[6,9],[7,9],
  [9,10],[9,11],[8,11],
  [10,13],[11,13],[12,11],
]);

// L10 — Full runtime: GC + heap + stack + event loop, 3 drops, 3 locks
const SW_L10 = mk([
  { id:0,  col:5, row:1,  type:'start' },
  { id:1,  col:5, row:3,  type:'lock' },  // runtime init gate
  { id:2,  col:1, row:6  },               // GC thread
  { id:3,  col:4, row:6  },               // heap allocator
  { id:4,  col:7, row:6  },               // call stack (breather)
  { id:5,  col:9, row:8,  type:'drop', penalty:2 },  // stack overflow (row 8, not adj to lock row 3)
  { id:6,  col:1, row:10, type:'drop', penalty:2 },  // GC pause trap (row 10, not adj to lock row 3)
  { id:7,  col:4, row:9,  type:'lock' },  // heap gate (row 9, not adj to drops at rows 8/10)
  { id:8,  col:7, row:9  },               // event loop
  { id:9,  col:4, row:12 },               // heap object
  { id:10, col:7, row:12, type:'lock' },  // event loop gate
  { id:11, col:9, row:14, type:'drop', penalty:3 },  // event queue overflow (row 14, not adj to lock row 12)
  { id:12, col:3, row:14 },
  { id:13, col:6, row:14 },
  { id:14, col:5, row:16, type:'finish' },
], [
  [0,1],[1,2],[1,3],[1,4],
  [4,5],[2,6],[3,7],[4,8],
  [7,9],[8,10],[8,11],
  [9,12],[10,13],[11,13],
  [12,14],[13,14],
]);

// A drop bounces the player backwards every time they land on it, so it can
// never be walked *through*. Every level must therefore keep at least one
// route from start to finish that touches no drop at all, or it is unwinnable.
export function hasDropFreeRoute({ nodes, edges }) {
  const adj    = buildAdjacency(edges, nodes);
  const start  = nodes.find(n => n.type === 'start');
  const finish = nodes.find(n => n.type === 'finish');
  if (!start || !finish) return false;
  const blocked = new Set(nodes.filter(n => n.type === 'drop').map(n => n.id));
  const seen = new Set([start.id]);
  const queue = [start.id];
  while (queue.length) {
    const id = queue.shift();
    if (id === finish.id) return true;
    for (const nb of (adj[id] || [])) {
      if (!seen.has(nb) && !blocked.has(nb)) { seen.add(nb); queue.push(nb); }
    }
  }
  return false;
}

// Shared post-processor: no two drop zones may sit next to each other, or a
// single unlucky roll bounces the player backwards twice in one turn.
//
// Locks are deliberately *not* covered. A lock is a gate you answer through,
// so a lock beside a drop (or beside another lock) is a fair difficulty beat —
// and in the layered layouts every node touches a gate, so treating locks as
// obstacles here silently stripped almost every drop off the board.
//
// Runs to a fixed point: clearing one drop can leave a fresh pair behind.
function fixAdjObs({ nodes, edges }) {
  const adj = buildAdjacency(edges, nodes);
  let current = nodes;
  for (;;) {
    const drops = new Set(current.filter(n => n.type === 'drop').map(n => n.id));
    const clash = new Set();
    for (const id of drops) {
      for (const nb of (adj[id] || [])) {
        if (drops.has(nb) && nb > id) clash.add(nb);
      }
    }
    if (clash.size === 0) break;
    current = current.map(n => clash.has(n.id) ? { id: n.id, col: n.col, row: n.row } : n);
  }
  return { nodes: current, edges };
}

const SW_LEVELS = [
  SW_L1, SW_L2, SW_L3, SW_L4, SW_L5,
  SW_L6, SW_L7, SW_L8, SW_L9, SW_L10,
];

// ─────────────────────────────────────────────────────────────────────────────
// DATA SCIENCE — 10 unique hand-crafted pipeline layouts
// L1  Single pipeline source→transform→sink   (tutorial, no obstacles)
// L2  Two-source merge                        (1 drop bad data)
// L3  ETL extract/transform/load              (1 drop, 1 lock)
// L4  Feature engineering wide→narrow         (1 drop, 1 lock)
// L5  Train/test split fork→rejoin            (2 drops, 1 lock)
// L6  Model ensemble 3 models→aggregator      (2 drops, 2 locks)
// L7  Cross-validation 3 parallel folds       (2 drops, 2 locks)
// L8  Data lake raw→curated→serving           (3 drops, 2 locks)
// L9  Streaming Kafka-style partitions        (3 drops, 3 locks)
// L10 Full ML ingest→clean→feature→train→eval  (3 drops, 3 locks)
// ─────────────────────────────────────────────────────────────────────────────

// L1 — Single pipeline: source → transform → sink, no obstacles
const DS_L1 = mk([
  { id:0, col:5, row:1,  type:'start' },
  { id:1, col:5, row:4  },               // ingest
  { id:2, col:2, row:7  },               // transform L
  { id:3, col:8, row:7  },               // transform R
  { id:4, col:5, row:10 },               // merge
  { id:5, col:5, row:13 },               // load
  { id:6, col:5, row:16, type:'finish' },
], [
  [0,1],[1,2],[1,3],[2,4],[3,4],[4,5],[5,6],
]);

// L2 — Two-source merge: left + right streams join, 1 drop on bad data path
const DS_L2 = mk([
  { id:0, col:5, row:1,  type:'start' },
  { id:1, col:2, row:4  },               // source A
  { id:2, col:8, row:4  },               // source B
  { id:3, col:1, row:7,  type:'drop', penalty:2 },  // corrupt record
  { id:4, col:3, row:7  },               // clean A
  { id:5, col:7, row:7  },               // clean B
  { id:6, col:9, row:7  },
  { id:7, col:5, row:10 },               // merge node
  { id:8, col:5, row:13 },
  { id:9, col:5, row:16, type:'finish' },
], [
  [0,1],[0,2],[1,3],[1,4],[2,5],[2,6],
  [4,7],[5,7],[6,7],[3,4],
  [7,8],[8,9],
]);

// L3 — ETL pipeline: extract → transform → load stages, 1 drop, 1 lock
const DS_L3 = mk([
  { id:0,  col:5, row:1,  type:'start' },
  { id:1,  col:2, row:4  },               // extract L
  { id:2,  col:8, row:4  },               // extract R
  { id:3,  col:1, row:7,  type:'drop', penalty:2 },  // bad extract
  { id:4,  col:5, row:7  },               // transform
  { id:5,  col:9, row:7  },
  { id:6,  col:5, row:10, type:'lock' },  // load gate (schema validation)
  { id:7,  col:2, row:13 },               // load target A
  { id:8,  col:8, row:13 },               // load target B
  { id:9,  col:5, row:15 },
  { id:10, col:5, row:16, type:'finish' },
], [
  [0,1],[0,2],[1,3],[1,4],[2,4],[2,5],
  [3,4],[4,6],[5,6],
  [6,7],[6,8],[7,9],[8,9],[9,10],
]);

// L4 — Feature engineering: wide intake narrows to feature vector, 1 drop, 1 lock
const DS_L4 = mk([
  { id:0,  col:5, row:1,  type:'start' },
  { id:1,  col:1, row:4  },               // raw feature 1
  { id:2,  col:4, row:4  },               // raw feature 2
  { id:3,  col:7, row:4  },               // raw feature 3
  { id:4,  col:9, row:4,  type:'drop', penalty:2 },  // noisy feature
  { id:5,  col:2, row:7  },               // engineered A
  { id:6,  col:5, row:7  },               // engineered B
  { id:7,  col:8, row:7  },               // engineered C
  { id:8,  col:5, row:10, type:'lock' },  // feature selection gate
  { id:9,  col:3, row:13 },
  { id:10, col:7, row:13 },
  { id:11, col:5, row:15 },
  { id:12, col:5, row:16, type:'finish' },
], [
  [0,1],[0,2],[0,3],[0,4],
  [1,5],[2,5],[2,6],[3,6],[3,7],[4,7],
  [5,8],[6,8],[7,8],
  [8,9],[8,10],[9,11],[10,11],[11,12],
]);

// L5 — Train/test split: fork into train + test paths then rejoin at eval, 2 drops, 1 lock
const DS_L5 = mk([
  { id:0,  col:5, row:1,  type:'start' },
  { id:1,  col:5, row:4  },               // dataset
  { id:2,  col:2, row:7  },               // train set
  { id:3,  col:8, row:7  },               // test set
  { id:4,  col:1, row:10, type:'drop', penalty:2 },  // data leakage trap
  { id:5,  col:3, row:10 },               // model train
  { id:6,  col:7, row:10 },               // model eval
  { id:7,  col:9, row:10, type:'drop', penalty:2 },  // overfit trap
  { id:8,  col:5, row:12, type:'lock' },  // validation gate
  { id:9,  col:3, row:14 },
  { id:10, col:7, row:14 },
  { id:11, col:5, row:16, type:'finish' },
], [
  [0,1],[1,2],[1,3],
  [2,4],[2,5],[3,6],[3,7],
  [5,8],[6,8],[4,5],[7,6],
  [8,9],[8,10],[9,11],[10,11],
]);

// L6 — Model ensemble: 3 models vote at aggregator, 2 drops, 2 locks
const DS_L6 = mk([
  { id:0,  col:5, row:1,  type:'start' },
  { id:1,  col:5, row:4,  type:'lock' },  // preprocessing gate
  { id:2,  col:1, row:7  },               // model A
  { id:3,  col:5, row:7  },               // model B
  { id:4,  col:9, row:7  },               // model C
  { id:5,  col:1, row:10, type:'drop', penalty:2 },  // model A diverge
  { id:6,  col:3, row:10 },
  { id:7,  col:5, row:10 },
  { id:8,  col:7, row:10 },
  { id:9,  col:9, row:10, type:'drop', penalty:2 },  // model C diverge
  { id:10, col:5, row:12, type:'lock' },  // aggregator gate
  { id:11, col:3, row:14 },
  { id:12, col:7, row:14 },
  { id:13, col:5, row:16, type:'finish' },
], [
  [0,1],[1,2],[1,3],[1,4],
  [2,5],[2,6],[3,7],[4,8],[4,9],
  [6,10],[7,10],[8,10],[5,6],[9,8],
  [10,11],[10,12],[11,13],[12,13],
]);

// L7 — Cross-validation: 3 parallel fold paths converge at scorer, 2 drops, 2 locks
const DS_L7 = mk([
  { id:0,  col:5, row:1,  type:'start' },
  { id:1,  col:5, row:3,  type:'lock' },  // CV splitter gate
  { id:2,  col:1, row:6  },               // fold 1
  { id:3,  col:5, row:6  },               // fold 2
  { id:4,  col:9, row:6  },               // fold 3
  { id:5,  col:1, row:9,  type:'drop', penalty:2 },  // fold 1 bad split
  { id:6,  col:3, row:9  },
  { id:7,  col:5, row:9  },
  { id:8,  col:7, row:9  },
  { id:9,  col:9, row:9,  type:'drop', penalty:2 },  // fold 3 bad split
  { id:10, col:5, row:11, type:'lock' },  // scorer gate
  { id:11, col:3, row:13 },
  { id:12, col:7, row:13 },
  { id:13, col:5, row:15 },
  { id:14, col:5, row:16, type:'finish' },
], [
  [0,1],[1,2],[1,3],[1,4],
  [2,5],[2,6],[3,7],[4,8],[4,9],
  [6,10],[7,10],[8,10],[5,6],[9,8],
  [10,11],[10,12],[11,13],[12,13],[13,14],
]);

// L8 — Data lake: raw zone → curated zone → serving zone, 3 drops, 2 locks
const DS_L8 = mk([
  { id:0,  col:5, row:1,  type:'start' },
  { id:1,  col:2, row:4  },               // raw ingest A
  { id:2,  col:8, row:4  },               // raw ingest B
  { id:3,  col:1, row:7,  type:'drop', penalty:2 },  // raw zone bad file
  { id:4,  col:4, row:7  },               // raw zone clean
  { id:5,  col:6, row:7  },               // raw zone clean
  { id:6,  col:9, row:7,  type:'drop', penalty:2 },  // raw zone bad file
  { id:7,  col:5, row:9,  type:'lock' },  // curated zone gate
  { id:8,  col:2, row:11 },               // curated A
  { id:9,  col:8, row:11 },               // curated B
  { id:10, col:5, row:13, type:'lock' },  // serving zone gate
  { id:11, col:2, row:15, type:'drop', penalty:3 },  // serving schema mismatch
  { id:12, col:5, row:15 },               // serving view   — clean approach
  { id:13, col:8, row:15 },               // serving mirror — clean approach
  { id:14, col:5, row:16, type:'finish' },
], [
  [0,1],[0,2],[1,3],[1,4],[2,5],[2,6],
  [3,4],[4,7],[5,7],[6,5],
  [7,8],[7,9],[8,10],[9,10],
  // Three ways out of the serving gate, two of them clean.
  [10,11],[10,12],[10,13],
  [11,14],[12,14],[13,14],
]);

// L9 — Streaming pipeline: Kafka partitions fan out then merge at consumer, 3 drops, 3 locks
const DS_L9 = mk([
  { id:0,  col:5, row:1,  type:'start' },
  { id:1,  col:5, row:3,  type:'lock' },  // producer gate
  { id:2,  col:1, row:6  },               // partition 1
  { id:3,  col:5, row:6  },               // partition 2
  { id:4,  col:9, row:6  },               // partition 3
  { id:5,  col:1, row:9,  type:'drop', penalty:2 },  // partition 1 lag
  { id:6,  col:3, row:9  },
  { id:7,  col:5, row:9,  type:'lock' },  // consumer group gate
  { id:8,  col:7, row:9  },
  { id:9,  col:9, row:9,  type:'drop', penalty:2 },  // partition 3 lag
  { id:10, col:3, row:12 },
  { id:11, col:7, row:12 },
  { id:12, col:5, row:12, type:'lock' },  // aggregator gate
  { id:13, col:2, row:14, type:'drop', penalty:3 },  // out-of-order event
  { id:14, col:5, row:14 },               // windowed sink — clean approach
  { id:15, col:8, row:14 },               // replay sink   — clean approach
  { id:16, col:5, row:16, type:'finish' },
], [
  [0,1],[1,2],[1,3],[1,4],
  [2,5],[2,6],[3,7],[4,8],[4,9],
  [6,10],[7,12],[8,11],[5,6],[9,8],
  [10,12],[11,12],
  // Three ways out of the aggregator gate, two of them clean.
  [12,13],[12,14],[12,15],
  [13,16],[14,16],[15,16],
]);

// L10 — Full ML pipeline: ingest→clean→feature→train→eval→deploy, 3 drops, 3 locks
const DS_L10 = mk([
  { id:0,  col:5, row:1,  type:'start' },
  { id:1,  col:2, row:3  },               // ingest A
  { id:2,  col:8, row:3  },               // ingest B
  { id:3,  col:1, row:6,  type:'drop', penalty:2 },  // corrupt ingest
  { id:4,  col:5, row:6,  type:'lock' },  // cleaning gate
  { id:5,  col:9, row:6  },
  { id:6,  col:2, row:9  },               // feature eng L
  { id:7,  col:5, row:9  },               // feature eng C
  { id:8,  col:8, row:9,  type:'drop', penalty:2 },  // feature drift
  { id:9,  col:5, row:11, type:'lock' },  // training gate
  { id:10, col:2, row:13 },               // train run
  { id:11, col:8, row:13 },               // eval run
  { id:12, col:5, row:13, type:'lock' },  // eval gate
  { id:13, col:2, row:15, type:'drop', penalty:3 },  // model regression
  { id:14, col:5, row:15 },               // canary deploy  — clean approach
  { id:15, col:8, row:15 },               // shadow deploy  — clean approach
  { id:16, col:5, row:16, type:'finish' },
], [
  [0,1],[0,2],[1,3],[1,4],[2,4],[2,5],
  [3,4],[4,6],[4,7],[5,7],
  [6,9],[7,9],[8,7],
  [9,10],[9,11],[10,12],[11,12],
  // Three ways out of the eval gate, two of them clean.
  [12,13],[12,14],[12,15],
  [13,16],[14,16],[15,16],
]);

const DS_LEVELS = [
  DS_L1, DS_L2, DS_L3, DS_L4, DS_L5,
  DS_L6, DS_L7, DS_L8, DS_L9, DS_L10,
];

// ─────────────────────────────────────────────────────────────────────────────
// CYBERSECURITY — Layered Checkpoints
// L1–L3   hand-crafted firewall chains
// L4–L8   generated rings, each a distinct ring count / width
// L9–L10  hand-crafted defence-in-depth and zero-trust segment meshes
// Every level has its own silhouette — no two share a geometry.
// lock = only way to cross a zone boundary (firewall / gate)
// drop = breach trap → back out; the L9–L10 spurs are honeypot dead-ends
// ─────────────────────────────────────────────────────────────────────────────

const CY_L1 = mk([
  { id:0, col:1, row:8,  type:'start' },
  { id:1, col:3, row:5  },
  { id:2, col:3, row:11 },
  { id:3, col:5, row:8,  type:'lock' },  // firewall
  { id:4, col:7, row:6  },
  { id:5, col:7, row:10 },
  { id:6, col:9, row:8,  type:'finish' },
], [
  [0,1],[0,2],[1,3],[2,3],[3,4],[3,5],[4,6],[5,6],
]);

const CY_L2 = mk([
  { id:0,  col:1, row:8,  type:'start' },
  { id:1,  col:2, row:4,  type:'drop', penalty:2 },
  { id:2,  col:2, row:12 },
  { id:3,  col:3, row:2  },
  { id:4,  col:3, row:14 },
  { id:5,  col:4, row:8,  type:'lock' },  // outer firewall
  { id:6,  col:5, row:5  },
  { id:7,  col:5, row:11 },
  { id:8,  col:7, row:8,  type:'lock' },  // inner firewall
  { id:9,  col:8, row:5  },
  { id:10, col:8, row:11 },
  { id:11, col:9, row:8,  type:'finish' },
], [
  [0,1],[0,2],[1,3],[2,4],[3,5],[4,5],
  [5,6],[5,7],[6,8],[7,8],
  [8,9],[8,10],[9,11],[10,11],
]);

const CY_L3 = mk([
  { id:0,  col:1, row:8,  type:'start' },
  { id:1,  col:2, row:4,  type:'drop', penalty:3 },
  { id:2,  col:2, row:12 },
  { id:3,  col:3, row:2  },
  { id:4,  col:3, row:14 },
  { id:5,  col:4, row:8,  type:'lock' },
  { id:6,  col:5, row:4  },
  { id:7,  col:5, row:12 },
  { id:8,  col:5, row:2  },               // breather — no longer a drop
  { id:9,  col:6, row:8,  type:'lock' },
  { id:10, col:7, row:5  },
  { id:11, col:7, row:11 },
  { id:12, col:8, row:8,  type:'lock' },
  { id:13, col:9, row:7  },
  { id:14, col:9, row:9  },
  { id:15, col:10,row:8,  type:'finish' },
], [
  [0,1],[0,2],[1,3],[2,4],[3,5],[4,5],
  [5,6],[5,7],[6,8],[8,9],[7,9],
  [9,10],[9,11],[10,12],[11,12],
  [12,13],[12,14],[13,15],[14,15],
]);

// Each ring costs exactly two columns — a gate column and a body column — so
// `rings` layers plus the start and the finish fit inside cols 0..10 with no
// two nodes ever landing on the same cell. The perimeter funnels inwards as
// you go deeper, which reads as breaching successive firewall layers.
function buildConcentricRings({ rings, nodesPerRing, drops, locks }) {
  const nodes = [{ id:0, col:0, row:8, type:'start' }];
  const edges = [];
  let id = 1;
  let prevRingIds = [0];

  for (let r = 0; r < rings; r++) {
    const gateCol = 1 + r * 2;
    const bodyCol = gateCol + 1;
    const spread  = Math.max(2, 7 - r * 2);
    const topRow  = 8 - spread;
    const botRow  = 8 + spread;

    // firewall gate at ring entry
    const gateId = id++;
    nodes.push({ id: gateId, col: gateCol, row: 8, ...(r < locks ? { type:'lock' } : {}) });
    prevRingIds.forEach(pid => edges.push([pid, gateId]));

    const ringIds = [];
    const hasMid = nodesPerRing > 2;
    // With a mid node the drop goes there, so the ring still has a clean route
    // over the top or under the bottom; without one it sits on the top arc.
    const topId = id++;
    nodes.push({ id: topId, col: bodyCol, row: topRow, ...(!hasMid && r < drops ? { type:'drop', penalty:3 } : {}) });
    edges.push([gateId, topId]);
    ringIds.push(topId);

    const botId = id++;
    nodes.push({ id: botId, col: bodyCol, row: botRow });
    edges.push([gateId, botId]);
    ringIds.push(botId);

    if (hasMid) {
      const midId = id++;
      nodes.push({ id: midId, col: bodyCol, row: 8, ...(r < drops ? { type:'drop', penalty:3 } : {}) });
      edges.push([topId, midId], [botId, midId]);
      ringIds.push(midId);
    }

    prevRingIds = ringIds;
  }

  const finId = id++;
  nodes.push({ id: finId, col: Math.min(10, 1 + rings * 2), row: 8, type:'finish' });
  prevRingIds.forEach(pid => edges.push([pid, finId]));
  return fixAdjObs({ nodes, edges });
}

// L9 — Defence in depth: three zones, each hanging a honeypot spur off the
// safe route. The spurs are the first dead-ends in this topic, so a bad roll
// finally costs something instead of just re-routing.
const CY_L9 = mk([
  { id:0,  col:0, row:8,  type:'start' },
  { id:1,  col:2, row:5  },
  { id:2,  col:2, row:11 },
  { id:3,  col:1, row:2,  type:'drop', penalty:2 },  // honeypot
  { id:4,  col:1, row:14 },                          // honeypot (empty)
  { id:5,  col:3, row:8,  type:'lock' },             // perimeter firewall
  { id:6,  col:5, row:4  },
  { id:7,  col:5, row:12 },
  { id:8,  col:4, row:1  },                          // honeypot (empty)
  { id:9,  col:6, row:16, type:'drop', penalty:3 },  // honeypot
  { id:10, col:6, row:8  },                          // DMZ hub
  { id:11, col:7, row:8,  type:'lock' },             // segmentation gate
  { id:12, col:8, row:4  },
  { id:13, col:8, row:12 },
  { id:14, col:9, row:1,  type:'drop', penalty:2 },  // honeypot
  { id:15, col:9, row:8,  type:'lock' },             // core gate
  { id:16, col:10,row:5  },
  { id:17, col:10,row:11 },
  { id:18, col:10,row:8,  type:'finish' },
], [
  [0,1],[0,2],
  [1,3],[2,4],
  [1,5],[2,5],
  [5,6],[5,7],
  [6,8],[7,9],
  [6,10],[7,10],
  [10,11],
  [11,12],[11,13],
  [12,14],
  [12,15],[13,15],
  [15,16],[15,17],
  [16,18],[17,18],
]);

// L10 — Zero trust: identity check on entry, then three segments cross-linked
// so no single corridor carries you through. Four gates, three honeypots.
const CY_L10 = mk([
  { id:0,  col:0, row:8,  type:'start' },
  { id:1,  col:1, row:4  },
  { id:2,  col:1, row:12 },
  { id:3,  col:2, row:8,  type:'lock' },             // identity check
  { id:4,  col:3, row:2  },
  { id:5,  col:3, row:8  },
  { id:6,  col:3, row:14 },
  { id:7,  col:4, row:5,  type:'lock' },             // segment A gate
  { id:8,  col:4, row:11, type:'lock' },             // segment B gate
  { id:9,  col:2, row:16, type:'drop', penalty:2 },  // honeypot
  { id:10, col:5, row:2  },
  { id:11, col:5, row:8  },
  { id:12, col:5, row:14 },
  { id:13, col:6, row:5  },
  { id:14, col:6, row:11 },
  { id:15, col:7, row:8,  type:'lock' },             // core gate
  { id:16, col:6, row:1,  type:'drop', penalty:3 },  // honeypot
  { id:17, col:8, row:4  },
  { id:18, col:8, row:12 },
  { id:19, col:9, row:8  },
  { id:20, col:10,row:8,  type:'finish' },
  { id:21, col:9, row:16, type:'drop', penalty:2 },  // honeypot
], [
  [0,1],[0,2],
  [1,3],[2,3],
  [3,4],[3,5],[3,6],
  [6,9],
  [4,7],[5,7],[5,8],[6,8],
  [7,10],[7,11],[8,11],[8,12],
  [10,16],
  [10,13],[11,13],[11,14],[12,14],
  [13,15],[14,15],
  [15,17],[15,18],
  [18,21],
  [17,19],[18,19],
  [19,20],
]);

const CY_LEVELS = [
  CY_L1, CY_L2, CY_L3,
  buildConcentricRings({ rings:2, nodesPerRing:2, drops:1, locks:1 }),
  buildConcentricRings({ rings:2, nodesPerRing:3, drops:2, locks:1 }),
  buildConcentricRings({ rings:3, nodesPerRing:2, drops:2, locks:2 }),
  buildConcentricRings({ rings:3, nodesPerRing:3, drops:2, locks:2 }),
  buildConcentricRings({ rings:4, nodesPerRing:2, drops:3, locks:3 }),
  CY_L9,
  CY_L10,
];

// ─────────────────────────────────────────────────────────────────────────────
// DATABASES — Relational Grid (ERD-style)
// Grid of rows×cols mirroring table rows/columns.
// lock = foreign-key diagonal shortcut (resolve the join), drop = orphaned record
// ─────────────────────────────────────────────────────────────────────────────

const DB_L1 = mk([
  { id:0, col:1, row:3,  type:'start' },
  { id:1, col:5, row:3  },
  { id:2, col:9, row:3  },
  { id:3, col:1, row:9  },
  { id:4, col:5, row:9  },
  { id:5, col:9, row:9  },
  { id:6, col:5, row:14 },
  { id:7, col:5, row:16, type:'finish' },
], [
  [0,1],[1,2],[0,3],[1,4],[2,5],
  [3,4],[4,5],[3,6],[4,6],[5,6],[6,7],
]);

const DB_L2 = mk([
  { id:0,  col:1, row:2,  type:'start' },
  { id:1,  col:4, row:2  },
  { id:2,  col:7, row:2,  type:'drop', penalty:2 },  // orphaned record
  { id:3,  col:9, row:2  },
  { id:4,  col:4, row:5,  type:'lock' },  // FK shortcut
  { id:5,  col:1, row:8  },
  { id:6,  col:4, row:8  },
  { id:7,  col:7, row:8  },
  { id:8,  col:9, row:8,  type:'drop', penalty:2 },
  { id:9,  col:4, row:11, type:'lock' },  // FK shortcut
  { id:10, col:1, row:14 },
  { id:11, col:4, row:14 },
  { id:12, col:7, row:14 },
  { id:13, col:9, row:13 },               // covering index — clean approach
  { id:14, col:9, row:16, type:'finish' },
], [
  [0,1],[1,2],[2,3],[3,4],[4,7],
  [0,5],[1,6],[3,8],
  [5,6],[6,7],[7,8],
  [6,9],[9,11],
  // The orphaned record used to hang straight off the finish; it now feeds
  // the index, which is the second clean approach beside the last table row.
  [5,10],[7,12],[8,13],
  [10,11],[11,12],[12,14],[13,14],
]);

const DB_L3 = mk([
  { id:0,  col:1, row:1,  type:'start' },
  { id:1,  col:4, row:1  },
  { id:2,  col:7, row:1,  type:'drop', penalty:2 },
  { id:3,  col:9, row:1  },
  { id:4,  col:5, row:4,  type:'lock' },
  { id:5,  col:1, row:6  },
  { id:6,  col:4, row:6  },
  { id:7,  col:7, row:6  },
  { id:8,  col:9, row:8,  type:'drop', penalty:3 },  // shifted row to avoid adjacency with lock at row 9
  { id:9,  col:4, row:10, type:'lock' },
  { id:10, col:1, row:11 },
  { id:11, col:4, row:11 },
  { id:12, col:7, row:11 },
  { id:13, col:9, row:13, type:'drop', penalty:2 },  // not adjacent to lock at row 10
  { id:14, col:5, row:14, type:'lock' },
  { id:15, col:1, row:16 },
  { id:16, col:5, row:16 },
  { id:17, col:9, row:15 },               // covering index — clean approach
  { id:18, col:9, row:16, type:'finish' },
], [
  [0,1],[1,2],[2,3],[3,4],[4,7],
  [0,5],[1,6],[3,8],
  [5,6],[6,7],[7,8],
  [6,9],[9,11],
  [5,10],[7,12],
  [10,11],[11,12],[12,13],
  [11,14],[14,16],
  // The orphaned record used to hang straight off the finish; it now feeds
  // the index, which is the second clean approach beside the last table row.
  [10,15],[12,16],[13,17],
  [15,16],[16,18],[17,18],
]);

function buildRelationalGrid({ tableRows, tableCols, drops, locks }) {
  const nodes = [];
  const edges = [];
  let id = 0;
  // Spread the table across the whole canvas rather than bunching it into the
  // top-left corner — cols 1..9, rows 1..16, whatever the table's dimensions.
  const colPositions = Array.from({ length: tableCols }, (_, c) =>
    tableCols === 1 ? 5 : Math.round(1 + (c * 8) / (tableCols - 1)));
  const rowPositions = Array.from({ length: tableRows }, (_, r) =>
    tableRows === 1 ? 8 : Math.round(1 + (r * 15) / (tableRows - 1)));
  const grid = []; // grid[row][col] = nodeId

  for (let r = 0; r < tableRows; r++) {
    grid[r] = [];
    for (let c = 0; c < tableCols; c++) {
      const isStart  = r === 0 && c === 0;
      const isFinish = r === tableRows - 1 && c === tableCols - 1;
      const nid = id++;
      nodes.push({
        id: nid, col: colPositions[c], row: rowPositions[r],
        ...(isStart  ? { type:'start'  } : {}),
        ...(isFinish ? { type:'finish' } : {}),
      });
      grid[r][c] = nid;
    }
  }

  // horizontal edges within each row
  for (let r = 0; r < tableRows; r++) {
    for (let c = 0; c < tableCols - 1; c++) {
      edges.push([grid[r][c], grid[r][c+1]]);
    }
  }

  // vertical edges between rows (safe path)
  for (let r = 0; r < tableRows - 1; r++) {
    for (let c = 0; c < tableCols; c++) {
      edges.push([grid[r][c], grid[r+1][c]]);
    }
  }

  // FK diagonal shortcuts with locks
  let locksPlaced = 0;
  for (let r = 0; r < tableRows - 1 && locksPlaced < locks; r++) {
    for (let c = 0; c < tableCols - 1 && locksPlaced < locks; c++) {
      // diagonal from [r][c+1] to [r+1][c+1] via a lock node
      const fkId = id++;
      const fkRow = Math.round((nodes[grid[r][c+1]].row + nodes[grid[r+1][c+1]].row) / 2);
      nodes.push({ id: fkId, col: colPositions[c+1], row: fkRow, type:'lock' });
      edges.push([grid[r][c+1], fkId], [fkId, grid[r+1][c+1]]);
      locksPlaced++;
    }
  }

  // Scatter the orphaned records instead of stacking them down one column,
  // where every drop would sit next to the previous one and get stripped out.
  // Walking back from the far corner keeps the pressure late in the run.
  // Runs last so the drop-free-route guard sees the finished graph.
  const dropped = new Set();
  let remaining = drops;
  for (let r = tableRows - 1; r >= 0 && remaining > 0; r--) {
    for (let c = tableCols - 1; c >= 0 && remaining > 0; c--) {
      const node = nodes[grid[r][c]];
      if (node.type) continue;                       // start / finish
      const neighbours = [[r-1,c],[r+1,c],[r,c-1],[r,c+1]]
        .map(([rr, cc]) => grid[rr]?.[cc])
        .filter(nid => nid !== undefined);
      if (neighbours.some(nid => dropped.has(nid) || nodes[nid].type === 'finish')) continue;
      node.type = 'drop';
      node.penalty = 3;
      // Back it out if this drop would seal off the last clean route.
      if (!hasDropFreeRoute({ nodes, edges })) { delete node.type; delete node.penalty; continue; }
      dropped.add(node.id);
      remaining--;
    }
  }

  return fixAdjObs({ nodes, edges });
}

const DB_LEVELS = [
  DB_L1, DB_L2, DB_L3,
  buildRelationalGrid({ tableRows:2, tableCols:3, drops:1, locks:1 }),
  buildRelationalGrid({ tableRows:3, tableCols:3, drops:1, locks:1 }),
  buildRelationalGrid({ tableRows:3, tableCols:4, drops:2, locks:2 }),
  buildRelationalGrid({ tableRows:4, tableCols:3, drops:2, locks:2 }),
  buildRelationalGrid({ tableRows:4, tableCols:4, drops:3, locks:2 }),
  buildRelationalGrid({ tableRows:5, tableCols:3, drops:3, locks:3 }),
  buildRelationalGrid({ tableRows:5, tableCols:4, drops:3, locks:3 }),
];

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

// The obstacle rule applies to hand-crafted levels too, not just generated
// ones — it is cheap and idempotent, so run every topic through it.
const sanitise = (levels) => levels.map(lvl => fixAdjObs(lvl));

export const LEVELS_BY_TOPIC = {
  networking:    sanitise(NET_LEVELS),
  hardware:      sanitise(HW_LEVELS),
  software:      sanitise(SW_LEVELS),
  datasci:       sanitise(DS_LEVELS),
  cybersecurity: sanitise(CY_LEVELS),
  databases:     sanitise(DB_LEVELS),
};

// Backwards-compatible default (networking shape) so any code still
// referencing LEVELS[n] doesn't break before being updated.
export const LEVELS = LEVELS_BY_TOPIC.networking;

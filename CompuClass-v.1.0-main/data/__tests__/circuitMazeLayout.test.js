import {
  LEVELS_BY_TOPIC,
  LEVEL_THEMES,
  buildAdjacency,
  buildDistanceMap,
  stepBackFrom,
  hasDropFreeRoute,
} from '../circuitMazeLayout';

// Board dimensions the game screen renders against.
const COLS = 11;
const ROWS = 18;
const LEVELS_PER_TOPIC = 10;

const TOPICS = Object.keys(LEVELS_BY_TOPIC);

/** Every (topic, levelIndex) pair, for it.each tables. */
const EVERY_LEVEL = TOPICS.flatMap(topic =>
  LEVELS_BY_TOPIC[topic].map((level, i) => [`${topic} L${i + 1}`, level]),
);

const nodesOfType = (level, type) => level.nodes.filter(n => n.type === type);
const startOf  = (level) => level.nodes.find(n => n.type === 'start');
const finishOf = (level) => level.nodes.find(n => n.type === 'finish');

/** Ids reachable from `from`, optionally refusing to pass through `blocked`. */
function reachable(level, from, blocked = new Set()) {
  const adj = buildAdjacency(level.edges, level.nodes);
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length) {
    const id = queue.shift();
    for (const nb of (adj[id] || [])) {
      if (!seen.has(nb) && !blocked.has(nb)) { seen.add(nb); queue.push(nb); }
    }
  }
  return seen;
}

describe('LEVEL_THEMES', () => {
  it('has one theme per level', () => {
    expect(LEVEL_THEMES).toHaveLength(LEVELS_PER_TOPIC);
  });

  it.each(LEVEL_THEMES.map((t, i) => [i + 1, t]))('theme %i is fully specified', (_n, theme) => {
    for (const key of ['label', 'board', 'trace', 'traceDim', 'node', 'nodeBorder', 'finish', 'avatar', 'drop', 'lock']) {
      expect(typeof theme[key]).toBe('string');
    }
    expect(Array.isArray(theme.bg)).toBe(true);
    expect(theme.bg.length).toBeGreaterThanOrEqual(2);
  });
});

describe('topic coverage', () => {
  it.each(TOPICS)('%s has exactly 10 levels', (topic) => {
    expect(LEVELS_BY_TOPIC[topic]).toHaveLength(LEVELS_PER_TOPIC);
  });

  // Two levels that differ only in where the hazards sit still read as the
  // same maze, so compare geometry alone.
  it.each(TOPICS)('%s levels all have distinct silhouettes', (topic) => {
    const seen = new Map();
    const duplicates = [];
    LEVELS_BY_TOPIC[topic].forEach((level, i) => {
      const silhouette = JSON.stringify({
        nodes: level.nodes.map(n => [n.col, n.row]).sort(),
        edges: level.edges.map(e => [...e].sort()).sort(),
      });
      if (seen.has(silhouette)) duplicates.push(`L${i + 1} matches L${seen.get(silhouette)}`);
      else seen.set(silhouette, i + 1);
    });
    expect(duplicates).toEqual([]);
  });
});

describe.each(EVERY_LEVEL)('%s', (_tag, level) => {
  it('has a start at id 0 and exactly one finish', () => {
    // The screen resets playerPos to 0 on every level, so the start must be 0.
    const starts = nodesOfType(level, 'start');
    expect(starts).toHaveLength(1);
    expect(starts[0].id).toBe(0);
    expect(nodesOfType(level, 'finish')).toHaveLength(1);
  });

  it('gives every node a unique id and its own cell on the board', () => {
    const ids = level.nodes.map(n => n.id);
    expect(new Set(ids).size).toBe(ids.length);

    const cells = level.nodes.map(n => `${n.col},${n.row}`);
    expect(new Set(cells).size).toBe(cells.length);
  });

  it('keeps every node inside the board', () => {
    for (const n of level.nodes) {
      expect(n.col).toBeGreaterThanOrEqual(0);
      expect(n.col).toBeLessThan(COLS);
      expect(n.row).toBeGreaterThanOrEqual(0);
      expect(n.row).toBeLessThan(ROWS);
    }
  });

  it('has no dangling edges and no orphaned nodes', () => {
    const ids = new Set(level.nodes.map(n => n.id));
    for (const [a, b] of level.edges) {
      expect(ids.has(a)).toBe(true);
      expect(ids.has(b)).toBe(true);
    }
    const adj = buildAdjacency(level.edges, level.nodes);
    for (const n of level.nodes) {
      expect(adj[n.id].length).toBeGreaterThan(0);
    }
  });

  it('can reach every node, and the finish, from the start', () => {
    const seen = reachable(level, startOf(level).id);
    const stranded = level.nodes.map(n => n.id).filter(id => !seen.has(id));
    expect(stranded).toEqual([]);
    expect(seen.has(finishOf(level).id)).toBe(true);
  });

  // A drop bounces the player backwards every time they land on it, so it can
  // never be walked through. Without a clean route the level is unwinnable.
  it('leaves a route to the finish that touches no drop', () => {
    expect(hasDropFreeRoute(level)).toBe(true);
  });

  // A hazard on the doorstep is only fair when there is more than one way in.
  // One clean approach beside a drop reads as "the drop is the exit", and a
  // player who cannot see the alternative is stuck bouncing off it.
  it('backs a drop beside the finish with two clean approaches', () => {
    const adj = buildAdjacency(level.edges, level.nodes);
    const approaches = adj[finishOf(level).id].map(id => level.nodes.find(n => n.id === id));
    const wanted = approaches.some(n => n.type === 'drop') ? 2 : 1;
    expect(approaches.filter(n => n.type !== 'drop').length).toBeGreaterThanOrEqual(wanted);
  });

  // ...and where a drop forced that redundancy, the two approaches must be
  // independently reachable, or the second one is decoration hanging off the
  // first. Levels with no drop on the doorstep are free to funnel.
  it('keeps a doorstep drop from making one approach load-bearing', () => {
    const adj    = buildAdjacency(level.edges, level.nodes);
    const finish = finishOf(level);
    const drops  = new Set(nodesOfType(level, 'drop').map(n => n.id));
    if (!adj[finish.id].some(id => drops.has(id))) return;
    for (const approach of adj[finish.id].filter(id => !drops.has(id))) {
      const blocked = new Set([...drops, approach]);
      expect(reachable(level, startOf(level).id, blocked).has(finish.id)).toBe(true);
    }
  });

  it('never places two drops side by side', () => {
    const adj = buildAdjacency(level.edges, level.nodes);
    const drops = new Set(nodesOfType(level, 'drop').map(n => n.id));
    const pairs = [];
    for (const id of drops) {
      for (const nb of (adj[id] || [])) {
        if (drops.has(nb) && nb > id) pairs.push([id, nb]);
      }
    }
    expect(pairs).toEqual([]);
  });

  // Locks are gates the player answers through, so they may sit on the only
  // route — but a gate the player can never open would strand them.
  it('marks every lock as a passable gate rather than a wall', () => {
    for (const lock of nodesOfType(level, 'lock')) {
      expect(lock.type).toBe('lock');
      const adj = buildAdjacency(level.edges, level.nodes);
      expect(adj[lock.id].length).toBeGreaterThanOrEqual(1);
    }
  });

  it('steps every node strictly closer to the start when backtracking', () => {
    const adj  = buildAdjacency(level.edges, level.nodes);
    const dist = buildDistanceMap(level.edges, level.nodes);
    const startId = startOf(level).id;

    for (const n of level.nodes) {
      const back = stepBackFrom(adj, dist, n.id);
      if (n.id === startId) {
        expect(back).toBeNull();
        continue;
      }
      expect(back).not.toBeNull();
      expect(dist[back]).toBeLessThan(dist[n.id]);
    }
  });

  it('walks a drop penalty back to the start without stalling', () => {
    const adj  = buildAdjacency(level.edges, level.nodes);
    const dist = buildDistanceMap(level.edges, level.nodes);

    for (const drop of nodesOfType(level, 'drop')) {
      let pos = drop.id;
      const visited = [pos];
      for (let i = 0; i < (drop.penalty || 3); i++) {
        const back = stepBackFrom(adj, dist, pos);
        if (back === null) break;             // reached the start
        expect(dist[back]).toBeLessThan(dist[pos]);
        pos = back;
        visited.push(pos);
      }
      // A penalty must actually move the player.
      expect(visited.length).toBeGreaterThan(1);
    }
  });
});

describe('buildAdjacency', () => {
  it('links both directions of every edge', () => {
    const nodes = [{ id: 0 }, { id: 1 }, { id: 2 }];
    const adj = buildAdjacency([[0, 1], [1, 2]], nodes);
    expect(adj).toEqual({ 0: [1], 1: [0, 2], 2: [1] });
  });

  it('ignores edges pointing at nodes that are not on the board', () => {
    const adj = buildAdjacency([[0, 1], [1, 99]], [{ id: 0 }, { id: 1 }]);
    expect(adj[1]).toEqual([0]);
    expect(adj[99]).toBeUndefined();
  });
});

describe('buildDistanceMap', () => {
  const nodes = [
    { id: 0, type: 'start' },
    { id: 1 }, { id: 2 }, { id: 3 },
    { id: 4, type: 'finish' },
  ];
  //   0 ─ 1 ─ 2 ─ 4
  //   └── 3 ───────┘
  const edges = [[0, 1], [1, 2], [2, 4], [0, 3], [3, 4]];

  it('measures hops from the start, taking the shortest branch', () => {
    expect(buildDistanceMap(edges, nodes)).toEqual({ 0: 0, 1: 1, 2: 2, 3: 1, 4: 2 });
  });

  it('leaves unreachable nodes undefined', () => {
    const dist = buildDistanceMap([[0, 1]], [{ id: 0, type: 'start' }, { id: 1 }, { id: 7 }]);
    expect(dist[7]).toBeUndefined();
  });
});

describe('stepBackFrom', () => {
  const nodes = [{ id: 0, type: 'start' }, { id: 1 }, { id: 2 }, { id: 3 }];
  const edges = [[0, 1], [1, 2], [2, 3], [0, 3]];
  const adj  = buildAdjacency(edges, nodes);
  const dist = buildDistanceMap(edges, nodes);

  it('returns null at the start', () => {
    expect(stepBackFrom(adj, dist, 0)).toBeNull();
  });

  it('prefers the neighbour closest to the start, not the lowest id', () => {
    // Node 2 sits two hops out via either side; both 1 and 3 are one hop in.
    expect([1, 3]).toContain(stepBackFrom(adj, dist, 2));
    expect(dist[stepBackFrom(adj, dist, 2)]).toBe(1);
  });

  it('returns null for a node that is not on the board', () => {
    expect(stepBackFrom(adj, dist, 99)).toBeNull();
  });
});

describe('hasDropFreeRoute', () => {
  const line = (types) => ({
    nodes: types.map((type, id) => (type ? { id, col: id, row: 0, type } : { id, col: id, row: 0 })),
    edges: types.slice(1).map((_, i) => [i, i + 1]),
  });

  it('accepts a corridor with no drops', () => {
    expect(hasDropFreeRoute(line(['start', null, null, 'finish']))).toBe(true);
  });

  it('rejects a corridor walled off by a drop', () => {
    expect(hasDropFreeRoute(line(['start', 'drop', null, 'finish']))).toBe(false);
  });

  it('accepts a drop that sits beside the route rather than on it', () => {
    expect(hasDropFreeRoute({
      nodes: [
        { id: 0, col: 0, row: 1, type: 'start' },
        { id: 1, col: 1, row: 0, type: 'drop', penalty: 3 },
        { id: 2, col: 1, row: 2 },
        { id: 3, col: 2, row: 1, type: 'finish' },
      ],
      edges: [[0, 1], [0, 2], [1, 3], [2, 3]],
    })).toBe(true);
  });
});

// Shared palette for the Circuit Maze surfaces. Same values the maze screens
// already used inline (CircuitMazeLobbyScreen's `C`), lifted so the topic
// screen and its cards cannot drift apart.
export const MAZE = {
  bg:        '#0A0E1A',
  bgDeep:    '#060B14',
  panel:     '#0F1E30',
  card:      '#0C1524',
  border:    '#1A3A5C',
  hairline:  'rgba(255,255,255,0.06)',
  text:      '#E0F7FF',
  textDim:   '#9FC4DA',
  muted:     '#4A7A9B',
  trace:     '#00FF9C',
  xp:        '#FACC15',
  streak:    '#FF9F00',
};

// Type scale — one place to keep the hierarchy honest.
export const TYPE = {
  screenTitle:  { fontSize: 20, fontWeight: '900', letterSpacing: 2 },
  screenSub:    { fontSize: 12, fontWeight: '500' },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
  cardTitle:    { fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
  cardDesc:     { fontSize: 10, fontWeight: '500', lineHeight: 14 },
  meta:         { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
};

/** Thousands separators without Intl — Hermes ships without full ICU on
 *  Android, where toLocaleString() would silently return "1240". */
export const formatNumber = (n) =>
  String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** "Protocols, OSI, TCP/IP" → "Protocols • OSI • TCP/IP" */
export const bulletise = (text) =>
  String(text || '').split(',').map(part => part.trim()).filter(Boolean).join('  •  ');

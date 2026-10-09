import { NETWORKING }    from './questions/networking';
import { HARDWARE }      from './questions/hardware';
import { SOFTWARE }      from './questions/software';
import { DATASCI }       from './questions/datasci';
import { CYBERSECURITY } from './questions/cybersecurity';
import { DATABASES }     from './questions/databases';

export const TOPICS = [
  { id: 'networking',    label: 'Networking',     icon: 'wifi',             color: '#00BFFF', desc: 'Protocols, OSI, TCP/IP' },
  { id: 'hardware',      label: 'Hardware',        icon: 'hardware-chip',    color: '#00FF9C', desc: 'Components, assembly, specs' },
  { id: 'software',      label: 'Software',        icon: 'code-slash',       color: '#FACC15', desc: 'OS, apps, programming' },
  { id: 'datasci',       label: 'Data Science',    icon: 'analytics',        color: '#BF5FFF', desc: 'ML, stats, AI' },
  { id: 'cybersecurity', label: 'Cybersecurity',   icon: 'shield-checkmark', color: '#FF4757', desc: 'Threats, encryption, defence' },
  { id: 'databases',     label: 'Databases',       icon: 'server',           color: '#FF9F00', desc: 'SQL, NoSQL, design' },
];

export const ALL_QUESTIONS = {
  networking:    NETWORKING,
  hardware:      HARDWARE,
  software:      SOFTWARE,
  datasci:       DATASCI,
  cybersecurity: CYBERSECURITY,
  databases:     DATABASES,
};

const DIFFICULTY_ORDER = ['easy', 'medium', 'hard'];

function difficultyForLevel(level) {
  return level <= 3 ? 'easy' : level <= 6 ? 'medium' : 'hard';
}

function stepDown(diff) {
  const idx = DIFFICULTY_ORDER.indexOf(diff);
  return DIFFICULTY_ORDER[Math.max(0, idx - 1)];
}

function pickQuestion(topic, difficulty, usedIds) {
  const bank = ALL_QUESTIONS[topic] || NETWORKING;
  const pool = bank.filter(q => q.difficulty === difficulty && !usedIds.includes(q.id));
  const src  = pool.length > 0 ? pool : bank.filter(q => q.difficulty === difficulty);
  return src[Math.floor(Math.random() * src.length)];
}

/**
 * getQuestionForLevel(topic, level, usedIds, performanceMap?)
 *
 * performanceMap shape: { [topic]: { [difficulty]: { correct_count, wrong_count } } }
 * If accuracy on this topic+difficulty is below 60%, steps down difficulty 30% of the time
 * to give the player more reps at a level they can succeed at.
 */
export const getQuestionForLevel = (topic, level, usedIds = [], performanceMap = null) => {
  const baseDiff = difficultyForLevel(level);

  if (performanceMap && baseDiff !== 'easy') {
    const perf = performanceMap?.[topic]?.[baseDiff];
    if (perf) {
      const total = perf.correct_count + perf.wrong_count;
      const accuracy = total > 0 ? perf.correct_count / total : 1;
      if (accuracy < 0.6 && Math.random() < 0.3) {
        return pickQuestion(topic, stepDown(baseDiff), usedIds);
      }
    }
  }

  return pickQuestion(topic, baseDiff, usedIds);
};

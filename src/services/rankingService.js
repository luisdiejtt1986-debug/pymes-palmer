import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase/config.js';

export const RANK_METRICS = [
  { key: 'xp', label: 'XP', field: 'xp', dir: 'desc', fmt: (v) => v },
  { key: 'accuracy', label: 'Precisión', field: 'rankAccuracy', dir: 'desc', fmt: (v) => `${v}%`, hint: 'Con al menos 20 respuestas' },
  { key: 'bestScore', label: 'Mejor puntuación', field: 'bestScore', dir: 'desc', fmt: (v) => v },
  { key: 'streak', label: 'Racha', field: 'bestStreak', dir: 'desc', fmt: (v) => `${v} d` },
  { key: 'progress', label: 'Mayor avance', field: 'progressIndex', dir: 'desc', fmt: (v) => (v > 0 ? `+${v}` : v), hint: 'Índice de avance: premia la mejora (requiere 4+ partidas)' },
  { key: 'games', label: 'Partidas', field: 'gamesPlayed', dir: 'desc', fmt: (v) => v },
  { key: 'time', label: 'Mejor tiempo', field: 'rankAvgTime', dir: 'asc', fmt: (v) => `${v}s`, hint: 'Tiempo promedio por respuesta, con al menos 20 respuestas' },
];

/** Top N por métrica. Solo lee perfiles públicos (nunca datos privados). */
export async function topBy(metricKey, n = 50) {
  const m = RANK_METRICS.find((x) => x.key === metricKey) || RANK_METRICS[0];
  const snap = await getDocs(query(collection(db, 'publicProfiles'), orderBy(m.field, m.dir), limit(n + 10)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => p.status !== 'inactive' && p.gamesPlayed > 0)
    .slice(0, n);
}

/** Líderes de cada categoría para la franja "Quién avanzó más". */
export async function highlights() {
  const [xp, acc, prog, streak, time] = await Promise.all(
    ['xp', 'accuracy', 'progress', 'streak', 'time'].map((k) => topBy(k, 1))
  );
  const pick = (arr, field) => {
    const p = arr[0];
    if (!p) return null;
    if (field === 'rankAccuracy' && !p.rankAccuracy) return null;
    if (field === 'progressIndex' && !(p.progressIndex > 0)) return null;
    if (field === 'rankAvgTime' && p.rankAvgTime >= 9999) return null;
    return p;
  };
  return {
    xp: pick(xp, 'xp'), accuracy: pick(acc, 'rankAccuracy'), progress: pick(prog, 'progressIndex'),
    streak: pick(streak, 'bestStreak'), time: pick(time, 'rankAvgTime'),
  };
}

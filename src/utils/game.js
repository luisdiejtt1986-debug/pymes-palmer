import { DEFAULT_LEVELS, DEFAULT_XP_LADDER } from '../data/defaults.js';

/* ------------------------------------------------------------------ */
/* Utilidades generales                                               */
/* ------------------------------------------------------------------ */

export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
export const mean = (arr) => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0);

/** Fecha local YYYY-MM-DD (no UTC) para las rachas diarias. */
export function localDateISO(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Racha de días consecutivos: si ya jugó hoy no cambia, si jugó ayer suma 1, si no reinicia en 1. */
export function nextStreak(lastDate, currentStreak, today = localDateISO()) {
  if (lastDate === today) return Math.max(1, currentStreak || 1);
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (lastDate === localDateISO(y)) return (currentStreak || 0) + 1;
  return 1;
}

/** Convierte Timestamp de Firestore / Date / número a milisegundos. */
export function toMillis(v) {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (v instanceof Date) return v.getTime();
  if (v.seconds) return v.seconds * 1000;
  return 0;
}

export function fmtDate(v, withTime = true) {
  const ms = toMillis(v);
  if (!ms) return '—';
  const d = new Date(ms);
  return withTime
    ? d.toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' })
    : d.toLocaleDateString('es-EC', { dateStyle: 'medium' });
}

/* ------------------------------------------------------------------ */
/* Niveles y XP (equivalente a computeLevel/levelName del HTML)       */
/* ------------------------------------------------------------------ */

/** XP acumulada necesaria para superar el nivel n (alcanzar n+1). */
export function xpForLevel(n, factor = 220) {
  return factor * n * n;
}

export function levelName(level, levels = DEFAULT_LEVELS) {
  const sorted = [...(levels?.length ? levels : DEFAULT_LEVELS)].sort((a, b) => a.from - b.from);
  let name = sorted[0].name;
  for (const l of sorted) if (level >= l.from) name = l.name;
  return name;
}

export function computeLevel(xp, params = {}) {
  const factor = params.levelFactor || 220;
  let level = 1;
  while (xp >= xpForLevel(level, factor)) level++;
  const prev = level === 1 ? 0 : xpForLevel(level - 1, factor);
  const next = xpForLevel(level, factor);
  const into = xp - prev;
  const span = next - prev;
  return {
    level,
    name: levelName(level, params.levels),
    into,
    span,
    next,
    prev,
    pct: Math.min(100, Math.round((into / span) * 100)),
  };
}

/* ------------------------------------------------------------------ */
/* FÓRMULA DE PUNTUACIÓN (centralizada)                                */
/*                                                                    */
/*   puntos = base + bonoVelocidad + bonoCombo        (nunca < 0)     */
/*   base          = baseXP × (xpLadder[i] / xpLadder[0])             */
/*                   → conserva la escalera del HTML original         */
/*                     (60, 80, 100 … 600 con baseXP = 60).           */
/*   bonoVelocidad = base × 0.5 × (tiempoRestante / tiempoTotal)      */
/*                   (solo si speedBonusEnabled)                      */
/*   bonoCombo     = base × 0.10 × min(combo − 1, 5)                  */
/*                   (solo si comboEnabled; combo = aciertos seguidos */
/*                    incluyendo el actual)                           */
/*   Respuesta incorrecta o timeout = 0 puntos.                       */
/*   XP ganada = suma de puntos de la partida.                        */
/* ------------------------------------------------------------------ */
export function scoreAnswer({ correct, index, timeRemaining, combo, params }) {
  if (!correct) return { points: 0, base: 0, speedBonus: 0, comboBonus: 0 };
  const ladder = params.xpLadder?.length ? params.xpLadder : DEFAULT_XP_LADDER;
  const step = ladder[Math.min(index, ladder.length - 1)];
  const mult = step / ladder[0];
  const base = Math.round((params.baseXP ?? 60) * mult);
  const tpq = params.timePerQuestion || 25;
  const speedBonus = params.speedBonusEnabled
    ? Math.round(base * 0.5 * clamp(timeRemaining / tpq, 0, 1))
    : 0;
  const comboBonus = params.comboEnabled
    ? Math.round(base * 0.1 * clamp(combo - 1, 0, 5))
    : 0;
  return { points: Math.max(0, base + speedBonus + comboBonus), base, speedBonus, comboBonus };
}

/* ------------------------------------------------------------------ */
/* Dominio por tema                                                   */
/* ------------------------------------------------------------------ */

export function masteryLabel(pct) {
  if (pct >= 90) return { label: 'Dominado', tone: 'ok' };
  if (pct >= 75) return { label: 'Buen dominio', tone: 'good' };
  if (pct >= 60) return { label: 'En desarrollo', tone: 'warn' };
  return { label: 'Necesita práctica', tone: 'bad' };
}

export const pct = (correct, total) => (total > 0 ? Math.round((correct / total) * 100) : 0);

/* ------------------------------------------------------------------ */
/* ÍNDICE DE AVANCE (premia la mejora, no solo el XP)                  */
/*                                                                    */
/*  Línea base = primeras 3 partidas del jugador.                     */
/*   accDelta     = precisión reciente − precisión inicial  (pts %)   */
/*   masteryDelta = promedio de (dominio actual − dominio inicial)    */
/*                  de los temas jugados (pts %)                      */
/*   scoreDelta   = variación % del puntaje promedio por partida      */
/*                  (acotada a −100 … +100)                           */
/*   levelGain    = niveles ganados desde la línea base × 5 (0 … 50)  */
/*                                                                    */
/*  índice = 0.35·accDelta + 0.25·masteryDelta + 0.25·scoreDelta      */
/*           + 0.15·levelGain                                         */
/*  Se calcula solo con 4+ partidas (antes es 0).                     */
/* ------------------------------------------------------------------ */
export function computeProgressIndex({
  games,
  recentAccuracy,
  baselineAccuracy,
  recentAvgScore,
  baselineAvgScore,
  levelNow,
  baselineLevel,
  masteryDeltaAvg,
}) {
  if (games < 4) return 0;
  const accDelta = recentAccuracy - baselineAccuracy;
  const scoreDelta = baselineAvgScore > 0
    ? clamp(((recentAvgScore - baselineAvgScore) / baselineAvgScore) * 100, -100, 100)
    : 0;
  const levelGain = clamp((levelNow - baselineLevel) * 5, 0, 50);
  return round1(0.35 * accDelta + 0.25 * (masteryDeltaAvg || 0) + 0.25 * scoreDelta + 0.15 * levelGain);
}

/* ------------------------------------------------------------------ */
/* Evaluación de logros (genérica)                                    */
/* ------------------------------------------------------------------ */

export function metricValue(metric, stats) {
  switch (metric) {
    case 'categoriesCount': return (stats.categoriesPlayed || []).length;
    case 'topicsMastered': return (stats.masteredTopics || []).length;
    case 'accuracy': return stats.accuracy || 0;
    default: return Number(stats[metric]) || 0;
  }
}

export function evaluateAchievements(achievements, stats, unlockedIds = new Set()) {
  return achievements.filter((a) => {
    if (a.active === false || unlockedIds.has(a.id)) return false;
    if (a.metric === 'accuracy' && (stats.totalAnswered || 0) < (a.minAnswered ?? 50)) return false;
    return metricValue(a.metric, stats) >= a.threshold;
  });
}

/** Mensaje personalizado para la pantalla de resultados. */
export function resultMessage(pctCorrect, { leveledUp } = {}) {
  // Textos del HTML original (con un complemento cuando se sube de nivel)
  if (pctCorrect === 100) return { title: '¡Cima alcanzada! 🏔️', sub: 'Respondiste todo correctamente. Eres imparable.' };
  if (pctCorrect >= 70) {
    return {
      title: leveledUp ? '¡Excelente! ¡Subiste de nivel!' : '¡Gran ascenso!',
      sub: 'Estuviste muy cerca de la cima. Tu dominio en este tema está creciendo. Sigue así.',
    };
  }
  if (pctCorrect >= 40) return { title: 'Buen intento', sub: 'Vas tomando ritmo, cada reto te hace más fuerte.' };
  return { title: 'Sigue subiendo', sub: 'Todos empiezan en la base. La práctica te llevará más arriba.' };
}

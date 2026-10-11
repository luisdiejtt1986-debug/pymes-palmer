import { shuffle } from './game.js';

const DIFF_ORDER = { facil: 0, media: 1, dificil: 2 };
const DAY = 864e5;

/**
 * Selección de preguntas para una partida (función pura, probada en tests/).
 *
 * questions : preguntas candidatas ya filtradas por categoría/tema/activas.
 * stats     : { [questionId]: { seen, correct, wrong, streakCorrect, lastSeenAt(ms), lastWrongAt(ms) } }
 * kind      : 'normal' | 'review'
 * difficultyMode : 'normal' | 'progresivo' | 'aleatorio' | 'adaptativo'
 * skill     : 0..1 (precisión histórica del jugador) para el modo adaptativo.
 *
 * Prioridad (kind normal):
 *   + 3     si nunca se respondió
 *   + 2.5 × tasa de error histórica
 *   − 2     si se mostró en las últimas 24 h  (− 0.7 en los últimos 7 días)
 *   − 0.1 × aciertos seguidos recientes
 *   + azar [0, 1.5) para mantener variedad
 *
 * Nunca devuelve preguntas repetidas dentro de la misma partida.
 */
export function pickQuestions({
  questions,
  stats = {},
  count = 10,
  kind = 'normal',
  difficultyMode = 'normal',
  difficulty = '',
  skill = 0.5,
  allowRepeat = true,
  now = Date.now(),
  rng = Math.random,
}) {
  // 1) Quitar duplicados por id
  const seenIds = new Set();
  let pool = questions.filter((q) => (seenIds.has(q.id) ? false : (seenIds.add(q.id), true)));

  // 2) Repaso inteligente
  if (kind === 'review') {
    const wrongPool = pool.filter((q) => {
      const s = stats[q.id];
      return s && s.wrong > 0 && (s.streakCorrect || 0) < 2;
    });
    return wrongPool
      .map((q) => {
        const s = stats[q.id];
        const recent = s.lastWrongAt && now - s.lastWrongAt < 7 * DAY ? 1 : 0;
        return { q, p: s.wrong * 2 - (s.streakCorrect || 0) + recent + rng() };
      })
      .sort((a, b) => b.p - a.p)
      .slice(0, count)
      .map((x) => x.q)
      .sort(() => rng() - 0.5);
  }

  // 3) Filtro de dificultad (solo modo normal)
  if (difficultyMode === 'normal' && difficulty) {
    const filtered = pool.filter((q) => q.difficulty === difficulty);
    if (filtered.length) pool = filtered;
  }

  // 4) Evitar repetidas si se pide y hay suficientes nuevas
  if (!allowRepeat) {
    const unseen = pool.filter((q) => !stats[q.id]?.seen);
    if (unseen.length >= count) pool = unseen;
  }

  const scored = pool.map((q) => {
    const s = stats[q.id];
    let p = rng() * 1.5;
    if (!s || !s.seen) p += 3;
    else {
      p += (s.wrong / Math.max(1, s.seen)) * 2.5;
      const age = now - (s.lastSeenAt || 0);
      if (age < DAY) p -= 2;
      else if (age < 7 * DAY) p -= 0.7;
      p -= (s.streakCorrect || 0) * 0.1;
    }
    return { q, p };
  });
  scored.sort((a, b) => b.p - a.p);

  let chosen;
  if (difficultyMode === 'adaptativo') {
    const share = skill >= 0.8 ? { facil: 0.2, media: 0.3, dificil: 0.5 }
      : skill >= 0.5 ? { facil: 0.3, media: 0.5, dificil: 0.2 }
      : { facil: 0.5, media: 0.4, dificil: 0.1 };
    chosen = [];
    for (const d of ['facil', 'media', 'dificil']) {
      const take = Math.round(count * share[d]);
      chosen.push(...scored.filter((x) => (x.q.difficulty || 'media') === d).slice(0, take));
    }
    const chosenIds = new Set(chosen.map((x) => x.q.id));
    for (const x of scored) {
      if (chosen.length >= count) break;
      if (!chosenIds.has(x.q.id)) { chosen.push(x); chosenIds.add(x.q.id); }
    }
    chosen = chosen.slice(0, count);
  } else {
    chosen = scored.slice(0, count);
  }

  let result = chosen.map((x) => x.q);
  if (difficultyMode === 'progresivo') {
    result = shuffle(result, rng).sort(
      (a, b) => (DIFF_ORDER[a.difficulty] ?? 1) - (DIFF_ORDER[b.difficulty] ?? 1)
    );
  } else {
    result = shuffle(result, rng);
  }
  return result;
}

/** Orden aleatorio de alternativas: devuelve índices de las opciones originales. */
export function shuffledOrder(optionsLength, rng = Math.random) {
  return shuffle([...Array(optionsLength).keys()], rng);
}

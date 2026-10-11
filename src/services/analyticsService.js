import {
  collection, getAggregateFromServer, getCountFromServer, query, sum, where, Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { listAllQuestions, questionAccuracy } from './questionService.js';
import { getCatalog } from './catalog.js';
import { listTopicStats } from './gameService.js';
import { pct } from '../utils/game.js';

/** Indicadores del jugador a partir de su documento de usuario (sin consultas extra). */
export function playerKpis(u) {
  const answered = u.totalAnswered || 0;
  const correct = u.totalCorrect || 0;
  return {
    gamesPlayed: u.gamesPlayed || 0,
    answered,
    correct,
    wrong: Math.max(0, answered - correct),
    accuracy: answered ? Math.round((correct / answered) * 1000) / 10 : 0,
    xp: u.xp || 0,
    level: u.level || 1,
    bestStreak: u.bestStreak || 0,
    bestScore: u.bestScore || 0,
    avgTime: answered ? Math.round(((u.totalTime || 0) / answered) * 10) / 10 : 0,
    mastered: (u.masteredTopics || []).length,
  };
}

/** Dominio real por tema (correctas / respuestas) — nunca inventado: solo temas con respuestas. */
export async function topicMasteryFor(uid) {
  const [stats, catalog] = await Promise.all([listTopicStats(uid), getCatalog()]);
  return stats
    .filter((s) => s.answered > 0)
    .map((s) => ({
      topicId: s.topicId,
      name: catalog.topicMap[s.topicId]?.name || 'Tema',
      categoryName: catalog.catMap[s.categoryId]?.name || '',
      answered: s.answered,
      correct: s.correct,
      pct: pct(s.correct, s.answered),
      basePct: pct(s.baselineCorrect || 0, s.baselineAnswered || 0),
    }))
    .sort((a, b) => a.pct - b.pct);
}

/** Recomendación: el tema con menor dominio (con al menos 3 respuestas). */
export function recommendNext(mastery) {
  const weak = mastery.filter((m) => m.answered >= 3).sort((a, b) => a.pct - b.pct)[0];
  return weak || null;
}

/** Métricas del panel administrativo. Usa agregaciones del servidor (no descarga colecciones). */
export async function adminDashboard() {
  const count = async (q) => (await getCountFromServer(q)).data().count;
  const since = Timestamp.fromMillis(Date.now() - 30 * 864e5);
  const [players, activePlayers, categories, topics, games, answerAgg, questions, catalog] = await Promise.all([
    count(collection(db, 'users')),
    count(query(collection(db, 'users'), where('lastPlayedAt', '>=', since))),
    count(collection(db, 'categories')),
    count(collection(db, 'topics')),
    count(query(collection(db, 'games'), where('completed', '==', true))),
    getAggregateFromServer(collection(db, 'publicProfiles'), { c: sum('totalCorrect'), a: sum('totalAnswered') }),
    listAllQuestions(),
    getCatalog(),
  ]);
  const agg = answerAgg.data();
  const answered = questions.filter((q) => q.timesAnswered >= 5).map((q) => ({ ...q, acc: questionAccuracy(q) }));
  const hardest = [...answered].sort((a, b) => a.acc - b.acc)[0] || null;
  const easiest = [...answered].sort((a, b) => b.acc - a.acc)[0] || null;

  // Tema con menor dominio global (por contadores de preguntas)
  const byTopic = {};
  questions.forEach((q) => {
    const t = (byTopic[q.topicId] ||= { answered: 0, correct: 0 });
    t.answered += q.timesAnswered || 0;
    t.correct += q.timesCorrect || 0;
  });
  const weakTopic = Object.entries(byTopic)
    .filter(([, t]) => t.answered >= 10)
    .map(([id, t]) => ({ id, name: catalog.topicMap[id]?.name || 'Tema', pct: pct(t.correct, t.answered) }))
    .sort((a, b) => a.pct - b.pct)[0] || null;

  return {
    players, activePlayers, categories, topics, games,
    totalQuestions: questions.length,
    activeQuestions: questions.filter((q) => q.active).length,
    avgAccuracy: agg.a ? Math.round((agg.c / agg.a) * 1000) / 10 : 0,
    hardest, easiest, weakTopic,
  };
}

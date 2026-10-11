import {
  collection, deleteDoc, doc, getDoc, getDocs, increment, limit, orderBy, query, runTransaction,
  serverTimestamp, setDoc, startAfter, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { listActiveQuestions, getQuestionsByIds } from './questionService.js';
import { listUnlocked } from './achievementService.js';
import { recordAnswer } from './answerService.js';
import { pickQuestions, shuffledOrder } from '../utils/selection.js';
import {
  computeLevel, computeProgressIndex, evaluateAchievements, localDateISO, mean, nextStreak, pct, round1, toMillis,
} from '../utils/game.js';
import { publicFromUser } from './userService.js';

const clean = (o) => JSON.parse(JSON.stringify(o)); // elimina undefined (Firestore no los admite)

/* ------------------------------------------------------------------ */
/* Selección de preguntas                                             */
/* ------------------------------------------------------------------ */

export async function getQuestionStats(uid) {
  const snap = await getDocs(collection(db, 'users', uid, 'questionStats'));
  const map = {};
  snap.forEach((d) => {
    const s = d.data();
    map[d.id] = { ...s, lastSeenAt: toMillis(s.lastSeenAt), lastWrongAt: toMillis(s.lastWrongAt) };
  });
  return map;
}

const isPlayable = (q) => Array.isArray(q.options) && q.options.length >= 2 && q.options[q.correctAnswer] !== undefined;

/**
 * selectQuestions({ userId, categoryId, topicId, count, difficulty, mode })
 *   mode = 'normal' | 'review'
 * Consulta solo las preguntas activas del filtro (no toda la colección) y el historial del jugador.
 */
export async function selectQuestions({ userId, categoryId = '', topicId = '', count, difficulty = '', mode = 'normal', params, skill = 0.5 }) {
  const [pool, stats] = await Promise.all([
    listActiveQuestions({ categoryId, topicId, max: 500 }),
    getQuestionStats(userId),
  ]);
  return pickQuestions({
    questions: pool.filter(isPlayable),
    stats,
    count,
    kind: mode,
    difficultyMode: params.difficultyMode,
    difficulty,
    skill,
    allowRepeat: params.allowRepeatQuestions !== false,
  });
}

/** Nº de preguntas falladas pendientes de repaso (para mostrar en la pantalla de repaso). */
export async function reviewSummary(uid) {
  const stats = await getQuestionStats(uid);
  const pending = Object.entries(stats).filter(([, s]) => s.wrong > 0 && (s.streakCorrect || 0) < 2);
  return { pendingIds: pending.map(([id]) => id), stats };
}

export async function pickReplacement({ uid, session }) {
  const exclude = new Set(session.items.map((i) => i.qid));
  let pool = (await listActiveQuestions({ categoryId: session.categoryId, topicId: session.topicId, max: 300 }))
    .filter((q) => isPlayable(q) && !exclude.has(q.id));
  if (session.kind === 'review') {
    const stats = await getQuestionStats(uid);
    pool = pool.filter((q) => stats[q.id]?.wrong > 0);
  }
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/* ------------------------------------------------------------------ */
/* Partida activa (sobrevive a refresh)                               */
/* ------------------------------------------------------------------ */

const activeRef = (uid) => doc(db, 'users', uid, 'activeGame', 'current');

export const saveActiveSession = (uid, session) =>
  setDoc(activeRef(uid), { gameId: session.gameId, session: clean(session), updatedAt: serverTimestamp() });

export async function getActiveSession(uid) {
  const s = await getDoc(activeRef(uid));
  return s.exists() ? s.data().session : null;
}

export async function abandonGame(uid, session) {
  try {
    await updateDoc(doc(db, 'games', session.gameId), { abandoned: true, finishedAt: serverTimestamp() });
  } catch { /* la partida pudo no haberse creado; igualmente se libera la partida activa */ }
  await deleteDoc(activeRef(uid));
}

/* ------------------------------------------------------------------ */
/* Inicio de partida                                                  */
/* ------------------------------------------------------------------ */

export async function startGame({ profile, params, kind = 'normal', learning = false, categoryId = '', topicId = '', difficulty = '', challenge = null }) {
  const uid = profile.id;
  let questions;
  let items;
  let tpq = params.timePerQuestion;

  if (kind === 'challenge' && challenge) {
    questions = await getQuestionsByIds(challenge.items.map((i) => i.qid));
    const byId = Object.fromEntries(questions.map((q) => [q.id, q]));
    items = challenge.items.filter((i) => byId[i.qid]);
    categoryId = challenge.categoryId || '';
    topicId = challenge.topicId || '';
    tpq = challenge.timePerQuestion || tpq;
  } else {
    questions = await selectQuestions({
      userId: uid, categoryId, topicId, count: params.questionsPerGame, difficulty,
      mode: kind === 'review' ? 'review' : 'normal', params, skill: (profile.accuracy || 50) / 100,
    });
    items = questions.map((q) => ({ qid: q.id, order: shuffledOrder(q.options.length) }));
  }
  if (!items.length) {
    throw new Error(kind === 'review'
      ? 'No tienes errores pendientes de repaso.'
      : 'No hay preguntas activas disponibles para esta selección. Pide al administrador que cargue contenido.');
  }

  // Copia de cada pregunta dentro de la partida: permite reanudar tras un refresh aunque luego se edite/desactive.
  const qById = Object.fromEntries(questions.map((q) => [q.id, q]));
  items = items.map((i) => {
    const q = qById[i.qid];
    return {
      qid: i.qid, order: i.order,
      q: {
        question: q.question, options: q.options, correctAnswer: q.correctAnswer,
        explanation: q.explanation || '', categoryId: q.categoryId, topicId: q.topicId, difficulty: q.difficulty || 'media',
      },
    };
  });

  const gameRef = doc(collection(db, 'games'));
  const now = Date.now();
  const session = {
    gameId: gameRef.id, kind, learning, categoryId, topicId, difficulty,
    challengeId: challenge?.id || null,
    items, answers: [], combo: 0, bestCombo: 0,
    lifelinesUsed: { fifty: false, audience: false, change: false },
    hidden: [], audience: null,
    timePerQuestion: tpq,
    showExplanation: params.showExplanation !== false,
    endOnFirstMiss: Boolean(params.endOnFirstMiss) && kind !== 'challenge', // en retos 1v1 ambos deben jugar todo
    lifelinesAvailable: params.lifelinesEnabled && kind !== 'challenge'
      ? { fifty: params.lifelines?.fifty !== false, audience: params.lifelines?.audience !== false, change: params.lifelines?.change !== false }
      : { fifty: false, audience: false, change: false },
    scoring: { baseXP: params.baseXP, speedBonusEnabled: params.speedBonusEnabled, comboEnabled: params.comboEnabled, xpLadder: params.xpLadder },
    qStartedAt: now, startedAtMs: now,
  };

  const batch = writeBatch(db);
  batch.set(gameRef, {
    id: gameRef.id, userId: uid, userName: profile.name,
    categoryId, topicId, mode: learning ? 'learning' : 'evaluation', kind, difficulty,
    challengeId: challenge?.id || null,
    startedAt: serverTimestamp(), finishedAt: null,
    questionsCount: items.length, correctCount: 0, wrongCount: 0, timeoutCount: 0,
    score: 0, xpEarned: 0, accuracy: 0, averageTime: 0, bestCombo: 0,
    completed: false, questionIds: items.map((i) => i.qid), timePerQuestion: tpq,
  });
  batch.set(activeRef(uid), { gameId: gameRef.id, session: clean(session), updatedAt: serverTimestamp() });
  await batch.commit();
  return { session, questions };
}

/* ------------------------------------------------------------------ */
/* Finalización IDEMPOTENTE                                           */
/*                                                                    */
/* Todo el cálculo (XP, nivel, racha, dominio, logros) ocurre dentro  */
/* de UNA transacción que primero lee games/{id}: si ya está          */
/* `completed`, no hace nada. Así refrescar o pulsar dos veces no     */
/* duplica XP, logros ni estadísticas. Los logros usan id             */
/* determinista `${uid}_${logro}`.                                    */
/* ------------------------------------------------------------------ */

export function summarizeSession(session) {
  const answers = session.answers;
  const total = session.items.length;
  const correctCount = answers.filter((a) => a.correct).length;
  const timeoutCount = answers.filter((a) => a.timedOut).length;
  const wrongCount = answers.length - correctCount - timeoutCount;
  const score = answers.reduce((s, a) => s + a.points, 0);
  return {
    total, correctCount, timeoutCount, wrongCount, score,
    accuracy: total ? round1((correctCount / total) * 100) : 0,
    averageTime: round1(mean(answers.map((a) => a.timeUsed))),
    totalTime: answers.reduce((s, a) => s + a.timeUsed, 0),
    bestCombo: session.bestCombo,
    usedAnyLifeline: Object.values(session.lifelinesUsed).some(Boolean),
    fast: answers.some((a) => a.correct && a.timeRemaining > 0.8 * session.timePerQuestion),
  };
}

export async function finishGame({ profile, session, params, achievements, savedAnswerIdx = [] }) {
  const uid = profile.id;
  const sum = summarizeSession(session);
  const answers = session.answers;
  const gameRef = doc(db, 'games', session.gameId);
  const userRef = doc(db, 'users', uid);
  const pubRef = doc(db, 'publicProfiles', uid);

  const byTopic = {};
  answers.forEach((a) => {
    const t = (byTopic[a.topicId] ||= { categoryId: a.categoryId, answered: 0, correct: 0 });
    t.answered++;
    if (a.correct) t.correct++;
  });
  const topicIds = Object.keys(byTopic);
  const unlocked = new Set((await listUnlocked(uid)).map((x) => x.achievementId));

  const result = await runTransaction(db, async (tx) => {
    /* ---------- LECTURAS ---------- */
    const gSnap = await tx.get(gameRef);
    if (gSnap.exists() && gSnap.data().completed) return { already: true };
    const uSnap = await tx.get(userRef);
    if (!uSnap.exists()) throw new Error('Perfil no encontrado');
    const tSnaps = await Promise.all(topicIds.map((id) => tx.get(doc(db, 'users', uid, 'topicStats', id))));
    const qSnaps = await Promise.all(answers.map((a) => tx.get(doc(db, 'users', uid, 'questionStats', a.qid))));

    /* ---------- CÁLCULO ---------- */
    const u = uSnap.data();
    const xpBefore = u.xp || 0;
    const newXp = xpBefore + sum.score;
    const lvBefore = computeLevel(xpBefore, params);
    const lv = computeLevel(newXp, params);
    const gamesBefore = u.gamesPlayed || 0;
    const totalAnswered = (u.totalAnswered || 0) + answers.length;
    const totalCorrect = (u.totalCorrect || 0) + sum.correctCount;
    const accuracyAll = totalAnswered ? round1((totalCorrect / totalAnswered) * 100) : 0;

    const todayStr = localDateISO();
    const playDates = Array.from(new Set([...(u.playDates || []), todayStr])).slice(-30);

    let currentStreak = u.currentStreak || 0;
    let bestStreak = u.bestStreak || 0;
    let lastStreakDate = u.lastStreakDate || null;
    if (params.streakEnabled !== false) {
      const today = localDateISO();
      currentStreak = nextStreak(lastStreakDate, currentStreak, today);
      lastStreakDate = today;
      bestStreak = Math.max(bestStreak, currentStreak);
    }

    // Línea base = primeras 3 partidas
    const inBaseline = gamesBefore < 3;
    const baselineGames = (u.baselineGames || 0) + (inBaseline ? 1 : 0);
    const baselineAnswered = (u.baselineAnswered || 0) + (inBaseline ? answers.length : 0);
    const baselineCorrect = (u.baselineCorrect || 0) + (inBaseline ? sum.correctCount : 0);
    const baselineScoreSum = (u.baselineScoreSum || 0) + (inBaseline ? sum.score : 0);
    const baselineAccuracy = baselineAnswered ? (baselineCorrect / baselineAnswered) * 100 : sum.accuracy;
    const baselineAvgScore = baselineGames ? baselineScoreSum / baselineGames : sum.score;
    const baselineLevel = inBaseline ? lv.level : (u.baselineLevel || 1);
    const recentAccuracy = gamesBefore === 0 ? sum.accuracy : round1(0.7 * (u.recentAccuracy || 0) + 0.3 * sum.accuracy);
    const recentAvgScore = gamesBefore === 0 ? sum.score : round1(0.7 * (u.recentAvgScore || 0) + 0.3 * sum.score);

    // Dominio por tema
    const masteryDelta = { ...(u.masteryDelta || {}) };
    const mastered = new Set(u.masteredTopics || []);
    const topicMastery = {};
    const topicWrites = topicIds.map((tid, i) => {
      const old = tSnaps[i].exists() ? tSnaps[i].data() : { answered: 0, correct: 0, baselineAnswered: 0, baselineCorrect: 0 };
      const b = byTopic[tid];
      const answered = old.answered + b.answered;
      const correct = old.correct + b.correct;
      const addBase = (old.baselineAnswered || 0) < 10;
      const bA = (old.baselineAnswered || 0) + (addBase ? b.answered : 0);
      const bC = (old.baselineCorrect || 0) + (addBase ? b.correct : 0);
      const pctNow = pct(correct, answered);
      masteryDelta[tid] = pctNow - pct(bC, bA);
      if (answered >= 10 && pctNow >= 90) mastered.add(tid); else mastered.delete(tid);
      topicMastery[tid] = pctNow;
      return [tid, { topicId: tid, categoryId: b.categoryId, answered, correct, baselineAnswered: bA, baselineCorrect: bC, updatedAt: serverTimestamp() }];
    });
    const deltas = Object.values(masteryDelta);
    const progressIndex = computeProgressIndex({
      games: gamesBefore + 1, recentAccuracy, baselineAccuracy, recentAvgScore, baselineAvgScore,
      levelNow: lv.level, baselineLevel, masteryDeltaAvg: mean(deltas),
    });

    const perfect = sum.total > 0 && sum.correctCount === sum.total;
    const userUpdate = {
      xp: newXp, level: lv.level, levelName: lv.name,
      gamesPlayed: gamesBefore + 1, totalAnswered, totalCorrect, accuracy: accuracyAll,
      perfectRounds: (u.perfectRounds || 0) + (perfect ? 1 : 0),
      currentStreak, bestStreak, lastStreakDate, playDates,
      bestScore: Math.max(u.bestScore || 0, sum.score),
      fastestAnswer: Boolean(u.fastestAnswer) || sum.fast,
      fastAnswers: (u.fastAnswers || 0) + (sum.fast ? 1 : 0),
      noLifelineGames: (u.noLifelineGames || 0) + (sum.usedAnyLifeline ? 0 : 1),
      totalTime: round1((u.totalTime || 0) + sum.totalTime),
      categoriesPlayed: Array.from(new Set([...(u.categoriesPlayed || []), ...Object.values(byTopic).map((t) => t.categoryId).filter(Boolean)])),
      masteredTopics: Array.from(mastered),
      baselineGames, baselineAnswered, baselineCorrect, baselineScoreSum, baselineLevel,
      recentAccuracy, recentAvgScore, masteryDelta, progressIndex,
      lastPlayedAt: serverTimestamp(), updatedAt: serverTimestamp(),
    };

    // Logros: idempotentes por id determinista
    const candidates = evaluateAchievements(achievements, { ...u, ...userUpdate }, unlocked);
    const achSnaps = await Promise.all(candidates.map((a) => tx.get(doc(db, 'userAchievements', `${uid}_${a.id}`))));
    const newAch = candidates.filter((_, i) => !achSnaps[i].exists());

    /* ---------- ESCRITURAS ---------- */
    tx.update(userRef, userUpdate);
    tx.set(pubRef, {
      ...publicFromUser({ ...u, ...userUpdate, id: uid }),
      topicMastery, updatedAt: serverTimestamp(),
    }, { merge: true });
    topicWrites.forEach(([tid, data]) => tx.set(doc(db, 'users', uid, 'topicStats', tid), data));
    answers.forEach((a, i) => {
      const old = qSnaps[i].exists() ? qSnaps[i].data() : {};
      tx.set(doc(db, 'users', uid, 'questionStats', a.qid), {
        questionId: a.qid, topicId: a.topicId, categoryId: a.categoryId,
        seen: (old.seen || 0) + 1,
        correct: (old.correct || 0) + (a.correct ? 1 : 0),
        wrong: (old.wrong || 0) + (a.correct ? 0 : 1),
        timeouts: (old.timeouts || 0) + (a.timedOut ? 1 : 0),
        streakCorrect: a.correct ? (old.streakCorrect || 0) + 1 : 0,
        lastSeenAt: serverTimestamp(),
        lastWrongAt: a.correct ? (old.lastWrongAt || null) : serverTimestamp(),
      });
    });
    newAch.forEach((a) => tx.set(doc(db, 'userAchievements', `${uid}_${a.id}`), {
      userId: uid, achievementId: a.id, gameId: session.gameId, unlockedAt: serverTimestamp(),
    }));

    const gameFinal = {
      id: session.gameId, userId: uid, userName: u.name,
      categoryId: session.categoryId, topicId: session.topicId,
      mode: session.learning ? 'learning' : 'evaluation', kind: session.kind, difficulty: session.difficulty || '',
      challengeId: session.challengeId || null,
      startedAt: gSnap.exists() ? gSnap.data().startedAt : serverTimestamp(),
      finishedAt: serverTimestamp(),
      questionsCount: sum.total, correctCount: sum.correctCount, wrongCount: sum.wrongCount, timeoutCount: sum.timeoutCount,
      score: sum.score, xpEarned: sum.score, accuracy: sum.accuracy, averageTime: sum.averageTime, bestCombo: sum.bestCombo,
      completed: true, questionIds: session.items.map((i) => i.qid), timePerQuestion: session.timePerQuestion,
      usedLifelines: session.lifelinesUsed,
      levelBefore: lvBefore.level, levelAfter: lv.level,
      newAchievements: newAch.map((a) => a.id),
    };
    tx.set(gameRef, gameFinal);
    tx.delete(activeRef(uid));
    return { already: false, game: gameFinal, newAchievements: newAch, levelBefore: lvBefore.level, levelAfter: lv.level };
  });

  if (!result.already) {
    // Tareas "best effort" que no deben bloquear ni duplicarse (solo corren la primera vez que se finaliza).
    await Promise.allSettled([
      ...answers.map((a) => updateDoc(doc(db, 'questions', a.qid), {
        timesShown: increment(1),
        timesAnswered: increment(a.timedOut ? 0 : 1),
        timesCorrect: increment(a.correct ? 1 : 0),
        timesTimeout: increment(a.timedOut ? 1 : 0),
      })),
      ...answers.map((a, i) => (savedAnswerIdx.includes(i) ? null : recordAnswer({ gameId: session.gameId, uid, index: i, answer: a }))).filter(Boolean),
    ]);
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Consultas                                                          */
/* ------------------------------------------------------------------ */

export async function getGame(id) {
  const s = await getDoc(doc(db, 'games', id));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

export async function listGames(uid, { pageSize = 20, after = null } = {}) {
  const c = [where('userId', '==', uid), orderBy('startedAt', 'desc')];
  if (after) c.push(startAfter(after));
  c.push(limit(pageSize));
  const snap = await getDocs(query(collection(db, 'games'), ...c));
  return {
    items: snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((g) => g.completed),
    last: snap.docs[snap.docs.length - 1] || null,
    done: snap.docs.length < pageSize,
  };
}

/** Solo administración. */
export async function listRecentGames(max = 100) {
  const snap = await getDocs(query(collection(db, 'games'), orderBy('startedAt', 'desc'), limit(max)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((g) => g.completed);
}

export async function listTopicStats(uid) {
  const snap = await getDocs(collection(db, 'users', uid, 'topicStats'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

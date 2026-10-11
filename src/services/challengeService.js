import {
  collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, where, arrayUnion,
} from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { selectQuestions } from './gameService.js';
import { shuffledOrder } from '../utils/selection.js';

/**
 * RETO por invitación/código (sin tiempo real, pero la estructura admite evolucionar a online):
 * dos jugadores responden EXACTAMENTE las mismas preguntas (mismo orden de preguntas y alternativas).
 * Gana quien tenga más puntos (desempate: precisión, luego tiempo promedio).
 *
 * challenges/{id}: { code, creatorId, creatorName, opponentId, opponentName, playerIds[],
 *   categoryId, topicId, count, timePerQuestion, items[{qid,order[]}], scores{uid:{...}},
 *   winnerId ('uid' | 'draw' | null), status: open|active|finished, createdAt, finishedAt }
 */

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

export async function createChallenge({ profile, params, categoryId = '', topicId = '' }) {
  const questions = await selectQuestions({
    userId: profile.id, categoryId, topicId, count: params.questionsPerGame, mode: 'normal',
    params: { ...params, difficultyMode: 'aleatorio' },
  });
  if (!questions.length) throw new Error('No hay preguntas activas para crear el reto.');
  const ref = doc(collection(db, 'challenges'));
  const data = {
    id: ref.id, code: makeCode(),
    creatorId: profile.id, creatorName: profile.name, creatorAvatar: profile.avatar || '',
    opponentId: null, opponentName: null,
    playerIds: [profile.id],
    categoryId, topicId, count: questions.length, timePerQuestion: params.timePerQuestion,
    items: questions.map((q) => ({ qid: q.id, order: shuffledOrder(q.options.length) })),
    scores: {}, winnerId: null, status: 'open',
    createdAt: serverTimestamp(),
  };
  await setDoc(ref, data);
  return { ...data, id: ref.id };
}

export async function joinChallengeByCode({ profile, code }) {
  const snap = await getDocs(query(collection(db, 'challenges'), where('code', '==', code.trim().toUpperCase())));
  if (snap.empty) throw new Error('No existe un reto con ese código.');
  const ref = snap.docs[0].ref;
  return runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    const c = s.data();
    if (c.creatorId === profile.id) throw new Error('Este reto lo creaste tú: compártelo con otra persona.');
    if (c.opponentId && c.opponentId !== profile.id) throw new Error('Este reto ya tiene un oponente.');
    if (!c.opponentId) {
      tx.update(ref, { opponentId: profile.id, opponentName: profile.name, playerIds: arrayUnion(profile.id), status: 'active' });
    }
    return { ...c, id: s.id, opponentId: profile.id, opponentName: profile.name, status: 'active' };
  });
}

export async function getChallenge(id) {
  const s = await getDoc(doc(db, 'challenges', id));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

export async function listMyChallenges(uid) {
  const snap = await getDocs(query(collection(db, 'challenges'), where('playerIds', 'array-contains', uid)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

/** Guarda el resultado del jugador y, si ya jugaron ambos, determina el ganador (transacción idempotente). */
export async function submitChallengeScore({ challengeId, uid, game }) {
  const ref = doc(db, 'challenges', challengeId);
  return runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists()) return null;
    const c = s.data();
    if (c.scores?.[uid]) return { id: s.id, ...c };
    const scores = {
      ...(c.scores || {}),
      [uid]: { score: game.score, accuracy: game.accuracy, averageTime: game.averageTime, correct: game.correctCount, gameId: game.id },
    };
    const patch = { scores };
    const ids = c.playerIds || [];
    if (ids.length === 2 && ids.every((i) => scores[i])) {
      const [a, b] = ids;
      const cmp = (x, y) => (x.score !== y.score ? x.score - y.score : x.accuracy !== y.accuracy ? x.accuracy - y.accuracy : y.averageTime - x.averageTime);
      const r = cmp(scores[a], scores[b]);
      patch.winnerId = r > 0 ? a : r < 0 ? b : 'draw';
      patch.status = 'finished';
      patch.finishedAt = serverTimestamp();
    }
    tx.update(ref, patch);
    return { id: s.id, ...c, ...patch };
  });
}

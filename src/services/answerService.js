import { collection, doc, getDocs, query, serverTimestamp, setDoc, where, limit } from 'firebase/firestore';
import { db } from '../firebase/config.js';

/**
 * Una respuesta por (partida, posición): el id determinista evita guardar dos veces la misma
 * respuesta aunque se recargue la página o se repita el envío. Las reglas permiten solo "create".
 */
export const answerId = (gameId, index) => `${gameId}_${index}`;

export async function recordAnswer({ gameId, uid, index, answer }) {
  const ref = doc(db, 'answers', answerId(gameId, index));
  await setDoc(ref, {
    gameId, userId: uid, index,
    questionId: answer.qid,
    categoryId: answer.categoryId, topicId: answer.topicId,
    // instantánea para que el historial sea legible aunque la pregunta se edite o desactive
    questionText: answer.questionText,
    selectedAnswer: answer.selectedText ?? null,
    correctAnswer: answer.correctText,
    explanation: answer.explanation || '',
    correct: answer.correct,
    timedOut: answer.timedOut,
    timeUsed: answer.timeUsed,
    timeRemaining: answer.timeRemaining,
    points: answer.points,
    xp: answer.points,
    combo: answer.combo,
    createdAt: serverTimestamp(),
  });
}

export async function listAnswersByGame(gameId, uid) {
  const snap = await getDocs(query(collection(db, 'answers'), where('gameId', '==', gameId), where('userId', '==', uid)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.index - b.index);
}

/** Solo administración (exportación). */
export async function listAllAnswers(max = 5000) {
  const snap = await getDocs(query(collection(db, 'answers'), limit(max)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

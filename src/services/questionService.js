import {
  collection, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { logAudit } from './auditService.js';
import { normText } from '../utils/importValidation.js';

/* ----------------------------- Jugador ----------------------------- */

/** Preguntas ACTIVAS filtradas por categoría/tema. Las reglas exigen active == true para jugadores. */
export async function listActiveQuestions({ categoryId, topicId, max = 500 } = {}) {
  const c = [where('active', '==', true)];
  if (categoryId) c.push(where('categoryId', '==', categoryId));
  if (topicId) c.push(where('topicId', '==', topicId));
  c.push(limit(max));
  const snap = await getDocs(query(collection(db, 'questions'), ...c));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getQuestionsByIds(ids) {
  const docs = await Promise.all(
    ids.map((id) => getDoc(doc(db, 'questions', id)).then((s) => (s.exists() ? { id: s.id, ...s.data() } : null)).catch(() => null))
  );
  return docs.filter(Boolean);
}

/* --------------------------- Administración --------------------------- */

/** Carga todas las preguntas (hasta `max`) una sola vez; el panel pagina y filtra en el cliente. */
export async function listAllQuestions(max = 2000) {
  const snap = await getDocs(query(collection(db, 'questions'), limit(max)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function validateQuestion(q, all = []) {
  const errors = {};
  if (!q.categoryId) errors.categoryId = 'Selecciona una categoría';
  if (!q.topicId) errors.topicId = 'Selecciona un tema';
  if (!q.question?.trim()) errors.question = 'La pregunta es obligatoria';
  const opts = (q.options || []).map((o) => o.trim()).filter(Boolean);
  if (opts.length < 2) errors.options = 'Se requieren al menos 2 opciones';
  if (new Set(opts.map(normText)).size !== opts.length) errors.options = 'Hay opciones repetidas';
  if (q.correctAnswer === null || q.correctAnswer === undefined || q.correctAnswer === '' || !q.options?.[q.correctAnswer]?.trim()) {
    errors.correctAnswer = 'Elige la respuesta correcta (debe tener texto)';
  }
  const dup = all.find((x) => x.id !== q.id && x.topicId === q.topicId && normText(x.question) === normText(q.question));
  if (dup) errors.question = 'Ya existe una pregunta igual en este tema';
  return errors;
}

function cleanQuestion(q) {
  // Compacta opciones vacías manteniendo el índice correcto
  const raw = q.options.map((o) => o.trim());
  const correctText = raw[q.correctAnswer];
  const options = raw.filter(Boolean);
  return {
    categoryId: q.categoryId,
    topicId: q.topicId,
    question: q.question.trim(),
    options,
    correctAnswer: options.indexOf(correctText),
    explanation: (q.explanation || '').trim(),
    difficulty: q.difficulty || 'media',
    active: q.active !== false,
  };
}

export async function saveQuestion(q, admin) {
  const data = cleanQuestion(q);
  if (!q.id) {
    const ref = doc(collection(db, 'questions'));
    await setDoc(ref, {
      ...data, timesShown: 0, timesAnswered: 0, timesCorrect: 0, timesTimeout: 0, accuracy: 0,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    await logAudit({ user: admin, action: 'CREATE', entity: 'question', entityId: ref.id, after: data });
    return ref.id;
  }
  await updateDoc(doc(db, 'questions', q.id), { ...data, provisional: false, updatedAt: serverTimestamp() });
  await logAudit({ user: admin, action: 'UPDATE', entity: 'question', entityId: q.id, before: q._before || null, after: data });
  return q.id;
}

/** Las preguntas no se eliminan: se desactivan para conservar el histórico. */
export async function setQuestionActive(q, active, admin) {
  await updateDoc(doc(db, 'questions', q.id), { active, updatedAt: serverTimestamp() });
  await logAudit({ user: admin, action: active ? 'ENABLE' : 'DISABLE', entity: 'question', entityId: q.id, before: { active: !active }, after: { active } });
}

/** Inserta preguntas en lotes (importación). Devuelve cantidad creada. */
export async function bulkCreateQuestions(rows, admin) {
  let created = 0;
  for (let i = 0; i < rows.length; i += 400) {
    const batch = writeBatch(db);
    rows.slice(i, i + 400).forEach((r) => {
      const ref = doc(collection(db, 'questions'));
      batch.set(ref, {
        categoryId: r.categoryId, topicId: r.topicId, question: r.question, options: r.options,
        correctAnswer: r.correctAnswer, explanation: r.explanation, difficulty: r.difficulty, active: r.active,
        timesShown: 0, timesAnswered: 0, timesCorrect: 0, timesTimeout: 0, accuracy: 0,
        source: 'import', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      created++;
    });
    await batch.commit();
  }
  await logAudit({ user: admin, action: 'IMPORT', entity: 'question', after: { created } });
  return created;
}

/* ------------------------------ Analítica ------------------------------ */

export const questionAccuracy = (q) => (q.timesAnswered > 0 ? Math.round((q.timesCorrect / q.timesAnswered) * 100) : null);

/**
 * Detección de preguntas potencialmente problemáticas (mal redactadas, clave errónea, etc.).
 * Requiere un mínimo de respuestas para no dar falsos positivos.
 */
export function flagQuestion(q, { minAnswers = 5 } = {}) {
  const acc = questionAccuracy(q);
  const shown = q.timesShown || 0;
  if ((q.timesAnswered || 0) >= minAnswers && acc !== null) {
    if (acc === 0) return '0 % de aciertos';
    if (acc < 20) return `Muy bajo porcentaje de aciertos (${acc} %)`;
    if (q.timesAnswered >= minAnswers * 2 && acc > 98) return `Casi todos aciertan (${acc} %)`;
  }
  if (shown >= minAnswers && (q.timesTimeout || 0) / shown > 0.3) return 'Demasiados timeouts';
  return null;
}

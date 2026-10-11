import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { DEFAULT_PARAMS } from '../data/defaults.js';
import { logAudit } from './auditService.js';

const REF = () => doc(db, 'parameters', 'game');

export const mergeParams = (data) => ({
  ...DEFAULT_PARAMS,
  ...(data || {}),
  lifelines: { ...DEFAULT_PARAMS.lifelines, ...(data?.lifelines || {}) },
});

export async function getParams() {
  const s = await getDoc(REF());
  return mergeParams(s.exists() ? s.data() : null);
}

export function subscribeParams(cb, onError) {
  return onSnapshot(REF(), (s) => cb(mergeParams(s.exists() ? s.data() : null), s.exists()), onError);
}

/** Valida y normaliza parámetros editados desde el panel. */
export function validateParams(p) {
  const errors = {};
  const int = (v) => Number.isInteger(Number(v));
  if (!int(p.questionsAvailablePerTopic) || p.questionsAvailablePerTopic < 1) errors.questionsAvailablePerTopic = 'Entero ≥ 1';
  if (!int(p.questionsPerGame) || p.questionsPerGame < 1 || p.questionsPerGame > 100) errors.questionsPerGame = 'Entero entre 1 y 100';
  if (!int(p.timePerQuestion) || p.timePerQuestion < 5 || p.timePerQuestion > 600) errors.timePerQuestion = 'Entre 5 y 600 segundos';
  if (!(Number(p.baseXP) >= 1)) errors.baseXP = 'Debe ser ≥ 1';
  if (!(Number(p.levelFactor) >= 10)) errors.levelFactor = 'Debe ser ≥ 10';
  return errors;
}

/** Guarda parámetros y registra en auditoría cada valor modificado (quién, qué, antes, después). */
export async function saveParams(next, prev, admin) {
  const clean = {
    ...next,
    questionsAvailablePerTopic: Number(next.questionsAvailablePerTopic),
    questionsPerGame: Number(next.questionsPerGame),
    timePerQuestion: Number(next.timePerQuestion),
    baseXP: Number(next.baseXP),
    levelFactor: Number(next.levelFactor),
  };
  await setDoc(REF(), { ...clean, updatedAt: serverTimestamp(), updatedBy: admin.id }, { merge: true });
  const changed = Object.keys(clean).filter((k) => JSON.stringify(clean[k]) !== JSON.stringify(prev[k]));
  await Promise.all(
    changed.map((k) => logAudit({ user: admin, action: 'PARAMETER_CHANGE', entity: 'parameter', entityId: k, before: prev[k] ?? null, after: clean[k] }))
  );
  return changed;
}

export async function seedParamsIfMissing() {
  const s = await getDoc(REF());
  if (!s.exists()) await setDoc(REF(), { ...DEFAULT_PARAMS, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

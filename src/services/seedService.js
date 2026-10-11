import { collection, doc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { DEFAULT_ACHIEVEMENTS, DEFAULT_PARAMS } from '../data/defaults.js';
import { SEED_CATEGORIES, SEED_QUESTIONS, SEED_TOPICS } from '../data/seedData.js';
import { logAudit } from './auditService.js';
import { invalidateCatalog } from './catalog.js';

/**
 * Siembra inicial (solo administrador, ver reglas). Es SEGURA de repetir:
 * no sobrescribe documentos existentes (no pisa ediciones del administrador).
 */
export async function seedInitialData(admin) {
  const existing = {};
  for (const name of ['categories', 'topics', 'questions', 'achievements', 'parameters']) {
    const snap = await getDocs(collection(db, name));
    existing[name] = new Set(snap.docs.map((d) => d.id));
  }
  const ops = [];
  const ts = () => ({ createdAt: serverTimestamp(), updatedAt: serverTimestamp() });

  if (!existing.parameters.has('game')) ops.push([doc(db, 'parameters', 'game'), { ...DEFAULT_PARAMS, ...ts() }]);
  SEED_CATEGORIES.forEach((c) => { if (!existing.categories.has(c.id)) ops.push([doc(db, 'categories', c.id), { ...c, ...ts() }]); });
  SEED_TOPICS.forEach((t) => { if (!existing.topics.has(t.id)) ops.push([doc(db, 'topics', t.id), { ...t, ...ts() }]); });
  SEED_QUESTIONS.forEach((q) => {
    if (existing.questions.has(q.id)) return;
    const { id, ...rest } = q;
    ops.push([doc(db, 'questions', id), { ...rest, timesShown: 0, timesAnswered: 0, timesCorrect: 0, timesTimeout: 0, accuracy: 0, ...ts() }]);
  });
  DEFAULT_ACHIEVEMENTS.forEach((a, i) => {
    if (existing.achievements.has(a.id)) return;
    const { id, ...rest } = a;
    ops.push([doc(db, 'achievements', id), { ...rest, active: true, order: i + 1, ...ts() }]);
  });

  for (let i = 0; i < ops.length; i += 400) {
    const batch = writeBatch(db);
    ops.slice(i, i + 400).forEach(([ref, data]) => batch.set(ref, data));
    await batch.commit();
  }
  invalidateCatalog();
  await logAudit({ user: admin, action: 'IMPORT', entity: 'seed', after: { documentsCreated: ops.length } });
  return ops.length;
}

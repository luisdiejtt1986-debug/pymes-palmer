import { collection, doc, getDocs, orderBy, query, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { logAudit } from './auditService.js';
import { invalidateCatalog } from './catalog.js';

export async function listTopics() {
  const snap = await getDocs(query(collection(db, 'topics'), orderBy('order', 'asc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

const clean = (t) => ({
  categoryId: t.categoryId,
  name: t.name.trim(),
  description: (t.description || '').trim(),
  icon: t.icon || '📘',
  difficulty: t.difficulty || 'media',
  order: Number(t.order) || 0,
  active: t.active !== false,
});

export async function saveTopic(topic, admin) {
  const isNew = !topic.id;
  const ref = isNew ? doc(collection(db, 'topics')) : doc(db, 'topics', topic.id);
  const data = clean(topic);
  if (isNew) {
    await setDoc(ref, { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    await logAudit({ user: admin, action: 'CREATE', entity: 'topic', entityId: ref.id, after: data });
  } else {
    await updateDoc(ref, { ...data, provisional: false, updatedAt: serverTimestamp() });
    await logAudit({ user: admin, action: 'UPDATE', entity: 'topic', entityId: ref.id, before: topic._before || null, after: data });
  }
  invalidateCatalog();
  return ref.id;
}

export async function setTopicActive(topic, active, admin) {
  await updateDoc(doc(db, 'topics', topic.id), { active, updatedAt: serverTimestamp() });
  await logAudit({ user: admin, action: active ? 'ENABLE' : 'DISABLE', entity: 'topic', entityId: topic.id, before: { active: !active }, after: { active } });
  invalidateCatalog();
}

export async function swapTopicOrder(a, b) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'topics', a.id), { order: b.order, updatedAt: serverTimestamp() });
  batch.update(doc(db, 'topics', b.id), { order: a.order, updatedAt: serverTimestamp() });
  await batch.commit();
  invalidateCatalog();
}

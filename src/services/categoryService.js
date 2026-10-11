import { collection, doc, getDocs, serverTimestamp, setDoc, updateDoc, orderBy, query, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { logAudit } from './auditService.js';
import { invalidateCatalog } from './catalog.js';

export async function listCategories() {
  const snap = await getDocs(query(collection(db, 'categories'), orderBy('order', 'asc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

const clean = (c) => ({
  name: c.name.trim(),
  description: (c.description || '').trim(),
  icon: c.icon || '📘',
  color: c.color || '#7c6cf6',
  order: Number(c.order) || 0,
  active: c.active !== false,
});

export async function saveCategory(category, admin) {
  const ref = category.id ? doc(db, 'categories', category.id) : doc(collection(db, 'categories'));
  const isNew = !category.id;
  const data = clean(category);
  if (isNew) {
    await setDoc(ref, { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    await logAudit({ user: admin, action: 'CREATE', entity: 'category', entityId: ref.id, after: data });
  } else {
    await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
    await logAudit({ user: admin, action: 'UPDATE', entity: 'category', entityId: ref.id, before: category._before || null, after: data });
  }
  invalidateCatalog();
  return ref.id;
}

/** Nunca se borra: se desactiva para conservar el histórico. */
export async function setCategoryActive(category, active, admin) {
  await updateDoc(doc(db, 'categories', category.id), { active, updatedAt: serverTimestamp() });
  await logAudit({ user: admin, action: active ? 'ENABLE' : 'DISABLE', entity: 'category', entityId: category.id, before: { active: !active }, after: { active } });
  invalidateCatalog();
}

/** Intercambia el orden de dos categorías. */
export async function swapCategoryOrder(a, b) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'categories', a.id), { order: b.order, updatedAt: serverTimestamp() });
  batch.update(doc(db, 'categories', b.id), { order: a.order, updatedAt: serverTimestamp() });
  await batch.commit();
  invalidateCatalog();
}

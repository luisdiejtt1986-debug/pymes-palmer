import { collection, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { logAudit } from './auditService.js';

export async function listAchievements({ onlyActive = false } = {}) {
  const snap = await getDocs(collection(db, 'achievements'));
  let items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (onlyActive) items = items.filter((a) => a.active !== false);
  return items.sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name));
}

/** Ids de logros desbloqueados por un jugador (userAchievements/{uid}_{achievementId}). */
export async function listUnlocked(uid) {
  const snap = await getDocs(query(collection(db, 'userAchievements'), where('userId', '==', uid)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function saveAchievement(a, admin) {
  const slug = a.id || a.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const data = {
    name: a.name.trim(), icon: a.icon || '🏅', description: (a.description || '').trim(),
    metric: a.metric, threshold: Number(a.threshold), active: a.active !== false,
    ...(a.metric === 'accuracy' ? { minAnswered: Number(a.minAnswered) || 50 } : {}),
    order: Number(a.order) || 50,
  };
  const ref = doc(db, 'achievements', slug);
  await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
  await logAudit({ user: admin, action: a.id ? 'UPDATE' : 'CREATE', entity: 'achievement', entityId: slug, after: data });
  return slug;
}

export async function setAchievementActive(a, active, admin) {
  await updateDoc(doc(db, 'achievements', a.id), { active, updatedAt: serverTimestamp() });
  await logAudit({ user: admin, action: active ? 'ENABLE' : 'DISABLE', entity: 'achievement', entityId: a.id });
}

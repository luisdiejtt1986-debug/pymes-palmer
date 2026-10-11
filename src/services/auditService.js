import { addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config.js';

/** Acciones: CREATE, UPDATE, DISABLE, ENABLE, DELETE, PARAMETER_CHANGE, IMPORT, SEED */
export async function logAudit({ user, action, entity, entityId = '', before = null, after = null }) {
  try {
    await addDoc(collection(db, 'auditLogs'), {
      userId: user.id || user.uid,
      userName: user.name || user.email || '',
      action,
      entity,
      entityId,
      before: before === undefined ? null : before,
      after: after === undefined ? null : after,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.error('No se pudo registrar la auditoría', e);
  }
}

export async function listAudit(max = 150) {
  const snap = await getDocs(query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'), limit(max)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

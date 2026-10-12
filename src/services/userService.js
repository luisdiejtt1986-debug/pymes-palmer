import {
  collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, updateDoc, writeBatch, startAfter,
} from 'firebase/firestore';
import { db } from '../firebase/config.js';

const nowTs = () => serverTimestamp();

export function newUserDoc(uid, { name, email }) {
  const cleanName = name.trim();
  return {
    id: uid, 
    name: cleanName, 
    nameLower: cleanName.toLowerCase(), // <-- ¡Campo clave para validar nombres únicos sin importar mayúsculas!
    email,
    avatar: '', theme: 'dark',
    role: 'player', status: 'active',
    xp: 0, level: 1, levelName: 'Explorador',
    gamesPlayed: 0, totalAnswered: 0, totalCorrect: 0, accuracy: 0, perfectRounds: 0,
    currentStreak: 0, bestStreak: 0, lastStreakDate: null, playDates: [],
    bestScore: 0, fastestAnswer: false, fastAnswers: 0, noLifelineGames: 0, totalTime: 0,
    categoriesPlayed: [], masteredTopics: [],
    // línea base para el índice de avance
    baselineGames: 0, baselineAnswered: 0, baselineCorrect: 0, baselineScoreSum: 0, baselineLevel: 1,
    recentAccuracy: 0, recentAvgScore: 0, masteryDelta: {}, progressIndex: 0,
    createdAt: nowTs(), updatedAt: nowTs(), lastPlayedAt: null,
  };
}

export function publicFromUser(u) {
  const avgTime = u.totalAnswered ? Math.round((u.totalTime / u.totalAnswered) * 10) / 10 : 0;
  return {
    uid: u.id, 
    name: u.name, 
    nameLower: u.nameLower || u.name.trim().toLowerCase(), 
    avatar: u.avatar || '',
    level: u.level, levelName: u.levelName, xp: u.xp,
    accuracy: u.accuracy, rankAccuracy: u.totalAnswered >= 20 ? u.accuracy : 0,
    gamesPlayed: u.gamesPlayed, totalAnswered: u.totalAnswered, totalCorrect: u.totalCorrect,
    bestScore: u.bestScore, bestStreak: u.bestStreak,
    avgTime, rankAvgTime: avgTime > 0 && u.totalAnswered >= 20 ? avgTime : 9999,
    progressIndex: u.progressIndex, status: u.status,
  };
}

/** Crea perfil privado + perfil público en una sola operación atómica. */
export async function createProfile(uid, { name, email }) {
  const user = newUserDoc(uid, { name, email });
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', uid), user);
  batch.set(doc(db, 'publicProfiles', uid), { ...publicFromUser({ ...user, createdAt: undefined }), topicMastery: {}, updatedAt: nowTs() });
  await batch.commit();
}

export async function getProfile(uid) {
  const s = await getDoc(doc(db, 'users', uid));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

export function subscribeProfile(uid, onData, onError) {
  return onSnapshot(
    doc(db, 'users', uid),
    (s) => onData(s.exists() ? { id: s.id, ...s.data() } : null),
    onError
  );
}

/** El jugador solo puede cambiar nombre, avatar y tema (reforzado en Security Rules). */
export async function updateOwnProfile(uid, { name, avatar, theme }) {
  const patch = { updatedAt: nowTs() };
  if (name !== undefined) {
    patch.name = name.trim();
    patch.nameLower = name.trim().toLowerCase(); // Actualizamos también la versión en minúsculas
  }
  if (avatar !== undefined) patch.avatar = avatar;
  if (theme !== undefined) patch.theme = theme;
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', uid), patch);
  const pub = { updatedAt: nowTs() };
  if (name !== undefined) {
    pub.name = name.trim();
    pub.nameLower = name.trim().toLowerCase();
  }
  if (avatar !== undefined) pub.avatar = avatar;
  if (Object.keys(pub).length > 1) batch.update(doc(db, 'publicProfiles', uid), pub);
  await batch.commit();
}

/* ------------------------- Administración ------------------------- */

export async function listUsers({ pageSize = 25, after = null } = {}) {
  const constraints = [orderBy('createdAt', 'desc')];
  if (after) constraints.push(startAfter(after));
  constraints.push(limit(pageSize));
  const snap = await getDocs(query(collection(db, 'users'), ...constraints));
  return { items: snap.docs.map((d) => ({ id: d.id, ...d.data() })), last: snap.docs[snap.docs.length - 1] || null, done: snap.docs.length < pageSize };
}

export async function setUserStatus(uid, status) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', uid), { status, updatedAt: nowTs() });
  batch.update(doc(db, 'publicProfiles', uid), { status, updatedAt: nowTs() });
  await batch.commit();
}

export const setUserRole = (uid, role) => updateDoc(doc(db, 'users', uid), { role, updatedAt: nowTs() });

/* ------------------------- Perfiles públicos ------------------------- */

export async function listPublicProfiles(max = 200) {
  const snap = await getDocs(query(collection(db, 'publicProfiles'), orderBy('xp', 'desc'), limit(max)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => p.status !== 'inactive');
}

export async function getPublicProfile(uid) {
  const s = await getDoc(doc(db, 'publicProfiles', uid));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

export { setDoc };
/**
 * Pruebas de las Security Rules contra el emulador de Firestore.
 *   npm run test:rules        (requiere Firebase CLI y Java; ver README)
 *
 * IMPORTANTE: estas pruebas fueron escritas pero NO se pudieron ejecutar en el entorno donde se generó
 * el proyecto (sin acceso de red al emulador). Córrelas una vez localmente antes de pasar a producción.
 */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore';

let env;

const baseUser = (id, extra = {}) => ({
  id, name: id, email: `${id}@test.com`, role: 'player', status: 'active', xp: 0, gamesPlayed: 0, totalAnswered: 0, totalCorrect: 0,
  createdAt: new Date(), ...extra,
});

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'pymes-palmer-test',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/alice'), baseUser('alice'));
    await setDoc(doc(db, 'users/bob'), baseUser('bob'));
    await setDoc(doc(db, 'users/root'), baseUser('root', { role: 'admin' }));
    await setDoc(doc(db, 'users/off'), baseUser('off', { status: 'inactive' }));
    await setDoc(doc(db, 'publicProfiles/alice'), { uid: 'alice', xp: 0, gamesPlayed: 0, status: 'active', name: 'alice' });
    await setDoc(doc(db, 'questions/qa'), { active: true, question: 'q', options: ['a', 'b'], correctAnswer: 0, timesShown: 0, timesAnswered: 0, timesCorrect: 0, timesTimeout: 0 });
    await setDoc(doc(db, 'questions/qi'), { active: false, question: 'q', options: ['a', 'b'], correctAnswer: 0 });
    await setDoc(doc(db, 'categories/c1'), { name: 'C', active: true });
  });
});

const as = (uid) => env.authenticatedContext(uid, { email: `${uid}@test.com` }).firestore();

describe('usuarios', () => {
  it('un jugador lee su perfil pero no el de otro', async () => {
    await assertSucceeds(getDoc(doc(as('alice'), 'users/alice')));
    await assertFails(getDoc(doc(as('alice'), 'users/bob')));
  });
  it('el administrador lee cualquier perfil', async () => {
    await assertSucceeds(getDoc(doc(as('root'), 'users/bob')));
  });
  it('un jugador NO puede auto-promoverse ni cambiar su estado ni dar-se XP excesivo', async () => {
    await assertFails(updateDoc(doc(as('alice'), 'users/alice'), { role: 'admin' }));
    await assertFails(updateDoc(doc(as('alice'), 'users/alice'), { status: 'inactive' }));
    await assertFails(updateDoc(doc(as('alice'), 'users/alice'), { xp: 999999 }));
  });
  it('un jugador sí puede cambiar nombre y avatar', async () => {
    await assertSucceeds(updateDoc(doc(as('alice'), 'users/alice'), { name: 'Alicia', avatar: '🦊' }));
  });
  it('no se puede registrar con rol admin', async () => {
    await assertFails(setDoc(doc(as('eve'), 'users/eve'), baseUser('eve', { role: 'admin' })));
    await assertSucceeds(setDoc(doc(as('eve'), 'users/eve'), baseUser('eve')));
  });
  it('nadie borra usuarios', async () => {
    await assertFails(deleteDoc(doc(as('root'), 'users/bob')));
  });
});

describe('contenido', () => {
  it('jugador lee solo preguntas activas', async () => {
    await assertSucceeds(getDoc(doc(as('alice'), 'questions/qa')));
    await assertFails(getDoc(doc(as('alice'), 'questions/qi')));
    await assertSucceeds(getDocs(query(collection(as('alice'), 'questions'), where('active', '==', true))));
    await assertFails(getDocs(collection(as('alice'), 'questions')));
  });
  it('solo el admin crea/edita contenido y nadie lo borra', async () => {
    await assertFails(setDoc(doc(as('alice'), 'categories/c2'), { name: 'X' }));
    await assertSucceeds(setDoc(doc(as('root'), 'categories/c2'), { name: 'X' }));
    await assertFails(deleteDoc(doc(as('root'), 'categories/c1')));
    await assertFails(deleteDoc(doc(as('root'), 'questions/qa')));
  });
  it('un jugador solo puede subir los contadores de la pregunta (de a 1)', async () => {
    await assertSucceeds(updateDoc(doc(as('alice'), 'questions/qa'), { timesShown: 1, timesAnswered: 1 }));
    await assertFails(updateDoc(doc(as('alice'), 'questions/qa'), { correctAnswer: 1 }));
    await assertFails(updateDoc(doc(as('alice'), 'questions/qa'), { timesShown: 50 }));
  });
  it('parámetros: lectura para autenticados, escritura solo admin', async () => {
    await assertFails(setDoc(doc(as('alice'), 'parameters/game'), { timePerQuestion: 1 }));
    await assertSucceeds(setDoc(doc(as('root'), 'parameters/game'), { timePerQuestion: 30 }));
    await assertSucceeds(getDoc(doc(as('alice'), 'parameters/game')));
  });
});

describe('partidas, respuestas y logros', () => {
  it('crea sus propias partidas y no las de otros; usuario inactivo no juega', async () => {
    await assertSucceeds(setDoc(doc(as('alice'), 'games/g1'), { userId: 'alice', completed: false }));
    await assertFails(setDoc(doc(as('alice'), 'games/g2'), { userId: 'bob', completed: false }));
    await assertFails(setDoc(doc(as('off'), 'games/g3'), { userId: 'off', completed: false }));
  });
  it('no lee partidas ajenas; el admin sí', async () => {
    await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'games/gb'), { userId: 'bob', completed: true }));
    await assertFails(getDoc(doc(as('alice'), 'games/gb')));
    await assertSucceeds(getDoc(doc(as('root'), 'games/gb')));
  });
  it('una partida completada es inmutable', async () => {
    await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'games/gc'), { userId: 'alice', completed: true, score: 5 }));
    await assertFails(updateDoc(doc(as('alice'), 'games/gc'), { score: 9999 }));
  });
  it('las respuestas solo se crean con id determinista y no se editan', async () => {
    const ans = { gameId: 'g1', userId: 'alice', index: 0 };
    await assertSucceeds(setDoc(doc(as('alice'), 'answers/g1_0'), ans));
    await assertFails(setDoc(doc(as('alice'), 'answers/otro'), ans));
    await assertFails(setDoc(doc(as('alice'), 'answers/g1_0'), { ...ans, points: 9999 })); // update denegado
  });
  it('un logro no se puede otorgar dos veces ni a otro jugador', async () => {
    const a = { userId: 'alice', achievementId: 'primer_reto' };
    await assertSucceeds(setDoc(doc(as('alice'), 'userAchievements/alice_primer_reto'), a));
    await assertFails(setDoc(doc(as('alice'), 'userAchievements/alice_primer_reto'), a));
    await assertFails(setDoc(doc(as('alice'), 'userAchievements/bob_primer_reto'), { userId: 'bob', achievementId: 'primer_reto' }));
  });
});

describe('ranking y auditoría', () => {
  it('los perfiles públicos los lee cualquier autenticado, no un anónimo', async () => {
    await assertSucceeds(getDoc(doc(as('bob'), 'publicProfiles/alice')));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'publicProfiles/alice')));
  });
  it('auditoría: solo admin lee y escribe; nadie edita', async () => {
    await assertFails(getDocs(collection(as('alice'), 'auditLogs')));
    await assertSucceeds(setDoc(doc(as('root'), 'auditLogs/l1'), { userId: 'root', action: 'CREATE' }));
    await assertFails(updateDoc(doc(as('root'), 'auditLogs/l1'), { action: 'X' }));
  });
});

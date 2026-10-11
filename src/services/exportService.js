import { collection, getDocs, limit, query } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { downloadBlob, toCSV } from '../utils/csv.js';
import { listAllQuestions } from './questionService.js';
import { listAllAnswers } from './answerService.js';
import { getCatalog } from './catalog.js';
import { toMillis } from '../utils/game.js';

const iso = (v) => { const ms = toMillis(v); return ms ? new Date(ms).toISOString() : ''; };

async function all(name, max = 5000) {
  const snap = await getDocs(query(collection(db, name), limit(max)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Devuelve { rows, columns } listos para exportar. */
export async function buildDataset(kind) {
  const catalog = await getCatalog();
  const cat = (id) => catalog.catMap[id]?.name || id || '';
  const top = (id) => catalog.topicMap[id]?.name || id || '';

  if (kind === 'questions') {
    const qs = await listAllQuestions();
    const columns = ['categoria', 'tema', 'pregunta', 'opcion_a', 'opcion_b', 'opcion_c', 'opcion_d', 'respuesta_correcta', 'explicacion', 'dificultad', 'activo', 'veces_mostrada', 'veces_respondida', 'veces_correcta', 'veces_timeout', 'id'];
    return {
      columns,
      rows: qs.map((q) => ({
        categoria: cat(q.categoryId), tema: top(q.topicId), pregunta: q.question,
        opcion_a: q.options?.[0] || '', opcion_b: q.options?.[1] || '', opcion_c: q.options?.[2] || '', opcion_d: q.options?.[3] || '',
        respuesta_correcta: 'ABCD'[q.correctAnswer] || '', explicacion: q.explanation || '', dificultad: q.difficulty,
        activo: q.active ? 'si' : 'no', veces_mostrada: q.timesShown || 0, veces_respondida: q.timesAnswered || 0,
        veces_correcta: q.timesCorrect || 0, veces_timeout: q.timesTimeout || 0, id: q.id,
      })),
    };
  }
  if (kind === 'users') {
    const users = await all('users');
    const columns = ['id', 'nombre', 'correo', 'rol', 'estado', 'nivel', 'xp', 'partidas', 'respondidas', 'correctas', 'precision', 'mejor_racha', 'mejor_puntuacion', 'registro', 'ultima_partida'];
    return {
      columns,
      rows: users.map((u) => ({
        id: u.id, nombre: u.name, correo: u.email, rol: u.role, estado: u.status, nivel: u.level, xp: u.xp,
        partidas: u.gamesPlayed, respondidas: u.totalAnswered, correctas: u.totalCorrect, precision: u.accuracy,
        mejor_racha: u.bestStreak, mejor_puntuacion: u.bestScore, registro: iso(u.createdAt), ultima_partida: iso(u.lastPlayedAt),
      })),
    };
  }
  if (kind === 'games') {
    const games = await all('games');
    const columns = ['id', 'jugador', 'userId', 'fecha', 'categoria', 'tema', 'modo', 'tipo', 'preguntas', 'correctas', 'incorrectas', 'timeouts', 'precision', 'puntos', 'xp', 'tiempo_promedio', 'mejor_combo', 'completada'];
    return {
      columns,
      rows: games.map((g) => ({
        id: g.id, jugador: g.userName, userId: g.userId, fecha: iso(g.startedAt), categoria: cat(g.categoryId), tema: top(g.topicId),
        modo: g.mode, tipo: g.kind, preguntas: g.questionsCount, correctas: g.correctCount, incorrectas: g.wrongCount, timeouts: g.timeoutCount,
        precision: g.accuracy, puntos: g.score, xp: g.xpEarned, tiempo_promedio: g.averageTime, mejor_combo: g.bestCombo, completada: g.completed ? 'si' : 'no',
      })),
    };
  }
  if (kind === 'answers') {
    const answers = await listAllAnswers();
    const columns = ['id', 'partida', 'userId', 'pregunta_id', 'pregunta', 'respuesta_elegida', 'respuesta_correcta', 'acierto', 'timeout', 'tiempo_usado', 'tiempo_restante', 'puntos', 'combo', 'fecha'];
    return {
      columns,
      rows: answers.map((a) => ({
        id: a.id, partida: a.gameId, userId: a.userId, pregunta_id: a.questionId, pregunta: a.questionText,
        respuesta_elegida: a.selectedAnswer ?? '', respuesta_correcta: a.correctAnswer, acierto: a.correct ? 'si' : 'no',
        timeout: a.timedOut ? 'si' : 'no', tiempo_usado: a.timeUsed, tiempo_restante: a.timeRemaining, puntos: a.points, combo: a.combo, fecha: iso(a.createdAt),
      })),
    };
  }
  if (kind === 'stats') {
    const profiles = await all('publicProfiles');
    const columns = ['jugador', 'nivel', 'xp', 'partidas', 'respondidas', 'correctas', 'precision', 'mejor_puntuacion', 'mejor_racha', 'tiempo_promedio', 'indice_avance'];
    return {
      columns,
      rows: profiles.map((p) => ({
        jugador: p.name, nivel: p.level, xp: p.xp, partidas: p.gamesPlayed, respondidas: p.totalAnswered, correctas: p.totalCorrect,
        precision: p.accuracy, mejor_puntuacion: p.bestScore, mejor_racha: p.bestStreak, tiempo_promedio: p.avgTime, indice_avance: p.progressIndex,
      })),
    };
  }
  throw new Error('Tipo de exportación desconocido');
}

export async function exportDataset(kind, format) {
  const { rows, columns } = await buildDataset(kind);
  const stamp = new Date().toISOString().slice(0, 10);
  const base = `pymes-palmer_${kind}_${stamp}`;
  if (format === 'json') {
    downloadBlob(JSON.stringify(rows, null, 2), `${base}.json`, 'application/json');
  } else if (format === 'xlsx') {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(rows, { header: columns });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, kind.slice(0, 31));
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${base}.xlsx`);
  } else {
    downloadBlob(toCSV(rows, columns), `${base}.csv`, 'text/csv;charset=utf-8');
  }
  return rows.length;
}

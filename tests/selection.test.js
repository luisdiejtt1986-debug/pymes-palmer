import { describe, it, expect } from 'vitest';
import { pickQuestions, shuffledOrder } from '../src/utils/selection.js';

const mk = (n) => Array.from({ length: n }, (_, i) => ({ id: `q${i}`, question: `Q${i}`, options: ['a', 'b', 'c', 'd'], correctAnswer: 0, difficulty: ['facil', 'media', 'dificil'][i % 3] }));

describe('pickQuestions', () => {
  it('devuelve N preguntas sin duplicados', () => {
    const r = pickQuestions({ questions: [...mk(30), ...mk(30)], count: 10 });
    expect(r).toHaveLength(10);
    expect(new Set(r.map((q) => q.id)).size).toBe(10);
  });
  it('no siempre devuelve las mismas 10', () => {
    const qs = mk(30);
    const sets = new Set(Array.from({ length: 8 }, () => pickQuestions({ questions: qs, count: 10 }).map((q) => q.id).sort().join(',')));
    expect(sets.size).toBeGreaterThan(1);
  });
  it('si hay menos preguntas que las pedidas devuelve las que existen', () => {
    expect(pickQuestions({ questions: mk(4), count: 10 })).toHaveLength(4);
  });
  it('prioriza preguntas nunca respondidas', () => {
    const qs = mk(20);
    const stats = {};
    qs.slice(0, 10).forEach((q) => { stats[q.id] = { seen: 5, correct: 5, wrong: 0, streakCorrect: 5, lastSeenAt: Date.now() }; });
    const r = pickQuestions({ questions: qs, stats, count: 10 });
    expect(r.every((q) => !stats[q.id])).toBe(true);
  });
  it('prioriza errores cuando todas fueron vistas', () => {
    const qs = mk(12);
    const stats = {};
    qs.forEach((q, i) => { stats[q.id] = { seen: 4, correct: i < 2 ? 0 : 4, wrong: i < 2 ? 4 : 0, streakCorrect: 0, lastSeenAt: Date.now() - 30 * 864e5 }; });
    const r = pickQuestions({ questions: qs, stats, count: 5 });
    expect(r.map((q) => q.id)).toEqual(expect.arrayContaining(['q0', 'q1']));
  });
  it('modo repaso solo usa preguntas falladas pendientes', () => {
    const qs = mk(10);
    const stats = { q1: { seen: 2, correct: 0, wrong: 2, streakCorrect: 0, lastWrongAt: Date.now() }, q2: { seen: 3, correct: 2, wrong: 1, streakCorrect: 2 }, q3: { seen: 1, correct: 0, wrong: 1, streakCorrect: 0 } };
    const r = pickQuestions({ questions: qs, stats, count: 10, kind: 'review' }).map((q) => q.id).sort();
    expect(r).toEqual(['q1', 'q3']);
  });
  it('progresivo ordena de fácil a difícil', () => {
    const r = pickQuestions({ questions: mk(30), count: 9, difficultyMode: 'progresivo' });
    const order = { facil: 0, media: 1, dificil: 2 };
    for (let i = 1; i < r.length; i++) expect(order[r[i].difficulty]).toBeGreaterThanOrEqual(order[r[i - 1].difficulty]);
  });
  it('modo normal filtra por dificultad', () => {
    const r = pickQuestions({ questions: mk(30), count: 5, difficulty: 'dificil' });
    expect(r.every((q) => q.difficulty === 'dificil')).toBe(true);
  });
  it('adaptativo con dominio alto trae más difíciles que con dominio bajo', () => {
    const avg = (skill) => {
      let total = 0;
      for (let i = 0; i < 20; i++) total += pickQuestions({ questions: mk(60), count: 10, difficultyMode: 'adaptativo', skill }).filter((q) => q.difficulty === 'dificil').length;
      return total / 20;
    };
    expect(avg(0.95)).toBeGreaterThan(avg(0.2));
  });
});

describe('shuffledOrder', () => {
  it('es una permutación', () => {
    expect([...shuffledOrder(4)].sort()).toEqual([0, 1, 2, 3]);
  });
});

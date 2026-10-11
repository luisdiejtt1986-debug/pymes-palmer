import { describe, it, expect } from 'vitest';
import { computeLevel, scoreAnswer, masteryLabel, nextStreak, evaluateAchievements, computeProgressIndex, localDateISO } from '../src/utils/game.js';
import { DEFAULT_PARAMS, DEFAULT_ACHIEVEMENTS } from '../src/data/defaults.js';

describe('niveles', () => {
  it('replica la curva del HTML original (220·n²)', () => {
    expect(computeLevel(0, DEFAULT_PARAMS).level).toBe(1);
    expect(computeLevel(219, DEFAULT_PARAMS).level).toBe(1);
    expect(computeLevel(220, DEFAULT_PARAMS).level).toBe(2);
    expect(computeLevel(880, DEFAULT_PARAMS).level).toBe(3);
  });
  it('asigna nombres por tramo', () => {
    expect(computeLevel(0, DEFAULT_PARAMS).name).toBe('Explorador');
    expect(computeLevel(220 * 4 * 4, DEFAULT_PARAMS).name).toBe('Estratega'); // nivel 5
  });
});

describe('puntuación', () => {
  const params = { ...DEFAULT_PARAMS, timePerQuestion: 25 };
  it('incorrecta = 0', () => {
    expect(scoreAnswer({ correct: false, index: 0, timeRemaining: 20, combo: 0, params }).points).toBe(0);
  });
  it('base sigue la escalera original', () => {
    const r = scoreAnswer({ correct: true, index: 0, timeRemaining: 0, combo: 1, params });
    expect(r.base).toBe(60);
    expect(r.points).toBe(60);
    expect(scoreAnswer({ correct: true, index: 9, timeRemaining: 0, combo: 1, params }).base).toBe(600);
  });
  it('bono de velocidad y combo se pueden desactivar', () => {
    const on = scoreAnswer({ correct: true, index: 0, timeRemaining: 25, combo: 4, params });
    expect(on.speedBonus).toBe(30);
    expect(on.comboBonus).toBe(18);
    const off = scoreAnswer({ correct: true, index: 0, timeRemaining: 25, combo: 4, params: { ...params, speedBonusEnabled: false, comboEnabled: false } });
    expect(off.points).toBe(60);
  });
  it('nunca negativa', () => {
    expect(scoreAnswer({ correct: true, index: 0, timeRemaining: -5, combo: -3, params }).points).toBeGreaterThanOrEqual(0);
  });
});

describe('dominio', () => {
  it('clasifica según los rangos pedidos', () => {
    expect(masteryLabel(95).label).toBe('Dominado');
    expect(masteryLabel(80).label).toBe('Buen dominio');
    expect(masteryLabel(65).label).toBe('En desarrollo');
    expect(masteryLabel(10).label).toBe('Necesita práctica');
  });
});

describe('racha diaria', () => {
  it('suma si jugó ayer, reinicia si no', () => {
    const y = new Date(); y.setDate(y.getDate() - 1);
    expect(nextStreak(localDateISO(y), 2)).toBe(3);
    expect(nextStreak('2000-01-01', 5)).toBe(1);
    expect(nextStreak(localDateISO(), 4)).toBe(4);
  });
});

describe('logros', () => {
  it('desbloquea Primer Paso y Cima Perfecta', () => {
    const stats = { gamesPlayed: 1, perfectRounds: 1, totalCorrect: 10, bestStreak: 1, level: 1, categoriesPlayed: ['a'], fastAnswers: 0, masteredTopics: [], totalAnswered: 10, accuracy: 100, noLifelineGames: 1 };
    const ids = evaluateAchievements(DEFAULT_ACHIEVEMENTS, stats).map((a) => a.id);
    expect(ids).toContain('primer_reto');
    expect(ids).toContain('cima_perfecta');
    expect(ids).not.toContain('precision_elite'); // faltan respuestas mínimas
  });
  it('no repite logros ya desbloqueados', () => {
    const stats = { gamesPlayed: 1, perfectRounds: 0, categoriesPlayed: [], masteredTopics: [] };
    expect(evaluateAchievements(DEFAULT_ACHIEVEMENTS, stats, new Set(['primer_reto'])).map((a) => a.id)).not.toContain('primer_reto');
  });
});

describe('índice de avance', () => {
  it('es 0 con menos de 4 partidas y premia la mejora', () => {
    const base = { recentAccuracy: 50, baselineAccuracy: 50, recentAvgScore: 300, baselineAvgScore: 300, levelNow: 1, baselineLevel: 1, masteryDeltaAvg: 0 };
    expect(computeProgressIndex({ ...base, games: 3 })).toBe(0);
    expect(computeProgressIndex({ ...base, games: 6 })).toBe(0);
    expect(computeProgressIndex({ ...base, games: 6, recentAccuracy: 80, recentAvgScore: 450, masteryDeltaAvg: 20 })).toBeGreaterThan(10);
    expect(computeProgressIndex({ ...base, games: 6, recentAccuracy: 30 })).toBeLessThan(0);
  });
});

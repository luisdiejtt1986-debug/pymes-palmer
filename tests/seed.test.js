import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { SEED_CATEGORIES, SEED_QUESTIONS, SEED_TOPICS } from '../src/data/seedData.js';
import { DEFAULT_ACHIEVEMENTS, DEFAULT_LEVELS, DEFAULT_XP_LADDER } from '../src/data/defaults.js';
import { computeLevel } from '../src/utils/game.js';

const html = readFileSync(new URL('../original-Juego_de_preguntas_pymes-palmer.html', import.meta.url), 'utf8');

function extract(name) {
  const start = html.indexOf(`const ${name} =`);
  const end = html.indexOf(';\n', start);
  // eslint-disable-next-line no-new-func
  return new Function(`${html.slice(start, end)}; return ${name};`)();
}

const ORIGINAL = extract('QUESTIONS');
const CAT_NAME = { PYMES: 'pymes', PALMER: 'palmer' };

describe('migración desde el HTML original', () => {
  it('migró TODAS las preguntas, sin perder ninguna', () => {
    expect(ORIGINAL.length).toBe(45);
    expect(SEED_QUESTIONS.length).toBe(ORIGINAL.length);
  });

  it('cada pregunta conserva texto, alternativas y respuesta correcta literalmente', () => {
    ORIGINAL.forEach((o, i) => {
      const s = SEED_QUESTIONS[i];
      expect(s.question).toBe(o.q);
      expect(s.options).toEqual(o.opts);
      expect(s.correctAnswer).toBe(o.correct);
    });
  });

  it('las categorías reales (PYMES, PALMER) conservan su nombre original y las demás van a "demo" desactivada', () => {
    ORIGINAL.forEach((o, i) => {
      const expected = CAT_NAME[o.cat] || 'demo';
      expect(SEED_QUESTIONS[i].categoryId).toBe(expected);
    });
    expect(SEED_CATEGORIES.find((c) => c.id === 'pymes').name).toBe('PYMES');
    expect(SEED_CATEGORIES.find((c) => c.id === 'palmer').name).toBe('PALMER');
    expect(SEED_CATEGORIES.find((c) => c.id === 'demo').active).toBe(false);
  });

  it('todos los temas referenciados existen y pertenecen a la categoría de su pregunta', () => {
    const topics = Object.fromEntries(SEED_TOPICS.map((t) => [t.id, t]));
    SEED_QUESTIONS.forEach((q) => {
      expect(topics[q.topicId], q.id).toBeTruthy();
      expect(topics[q.topicId].categoryId).toBe(q.categoryId);
    });
  });

  it('el contenido provisional (tema, dificultad) está marcado y no se inventaron explicaciones', () => {
    SEED_QUESTIONS.forEach((q) => {
      expect(q.provisional).toBe(true);
      expect(q.explanation).toBe('');
    });
  });

  it('las preguntas de crédito activas son 20 y las de relleno quedan inactivas', () => {
    expect(SEED_QUESTIONS.filter((q) => q.active).length).toBe(20);
    expect(SEED_QUESTIONS.filter((q) => !q.active).length).toBe(25);
  });

  it('IDs únicos', () => {
    expect(new Set(SEED_QUESTIONS.map((q) => q.id)).size).toBe(SEED_QUESTIONS.length);
  });
});

describe('equivalencia con la lógica original', () => {
  it('escalera de XP y niveles', () => {
    expect(DEFAULT_XP_LADDER).toEqual(extract('XP_LADDER'));
    expect(DEFAULT_LEVELS.map((l) => l.name)).toEqual(['Explorador', 'Aprendiz', 'Estratega', 'Sabio', 'Mente Brillante', 'Leyenda de la Cima']);
    // mismos cortes de nombre que levelName() del HTML
    const params = { levelFactor: 220, levels: DEFAULT_LEVELS };
    const nameAt = (level) => computeLevel(level === 1 ? 0 : 220 * (level - 1) ** 2, params).name;
    expect([1, 2, 3, 4, 5, 7, 8, 10, 11, 14, 15].map(nameAt)).toEqual([
      'Explorador', 'Explorador', 'Aprendiz', 'Aprendiz', 'Estratega', 'Estratega', 'Sabio', 'Sabio', 'Mente Brillante', 'Mente Brillante', 'Leyenda de la Cima',
    ]);
  });

  it('los 10 logros originales conservan id, nombre e icono', () => {
    const orig = [...html.matchAll(/\{id:"(\w+)", name:"([^"]+)", icon:"([^"]+)"/g)].map((m) => ({ id: m[1], name: m[2], icon: m[3] }));
    expect(orig.length).toBe(10);
    orig.forEach((o) => {
      const a = DEFAULT_ACHIEVEMENTS.find((x) => x.id === o.id);
      expect(a, o.id).toBeTruthy();
      expect(a.name).toBe(o.name);
      expect(a.icon).toBe(o.icon);
    });
  });
});

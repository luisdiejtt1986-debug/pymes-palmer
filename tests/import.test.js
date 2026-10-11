import { describe, it, expect } from 'vitest';
import { parseCSV, rowsToObjects, toCSV } from '../src/utils/csv.js';
import { validateImportRows } from '../src/utils/importValidation.js';

const categories = [{ id: 'c1', name: 'PYMES' }];
const topics = [{ id: 't1', categoryId: 'c1', name: 'Liquidez' }];

describe('csv', () => {
  it('parsea comillas, comas internas y saltos de línea', () => {
    const rows = parseCSV('a,b\r\n"x, y","l1\nl2"\r\n');
    expect(rows).toEqual([['a', 'b'], ['x, y', 'l1\nl2']]);
  });
  it('detecta punto y coma', () => {
    expect(parseCSV('a;b\n1;2')[1]).toEqual(['1', '2']);
  });
  it('ida y vuelta toCSV → parseCSV', () => {
    const csv = toCSV([{ a: 'hola, "mundo"', b: 2 }], ['a', 'b']);
    expect(rowsToObjects(parseCSV(csv))[0]).toEqual({ a: 'hola, "mundo"', b: '2' });
  });
});

describe('validación de importación', () => {
  const base = { categoria: 'pymes', tema: 'liquidez', pregunta: '¿Q?', opcion_a: 'A1', opcion_b: 'B1', opcion_c: 'C1', opcion_d: 'D1', respuesta_correcta: 'b', dificultad: 'Fácil', activo: 'si' };
  const run = (rows, extra = {}) => validateImportRows(rows, { categories, topics, existing: [], ...extra });

  it('acepta una fila válida', () => {
    const [r] = run([base]);
    expect(r.status).toBe('valid');
    expect(r.data.correctAnswer).toBe(1);
    expect(r.data.difficulty).toBe('facil');
  });
  it('rechaza sin respuesta correcta, con una sola opción o categoría inexistente', () => {
    expect(run([{ ...base, respuesta_correcta: '' }])[0].status).toBe('error');
    expect(run([{ ...base, opcion_b: '', opcion_c: '', opcion_d: '' }])[0].status).toBe('error');
    expect(run([{ ...base, categoria: 'Otra' }])[0].status).toBe('error');
    expect(run([{ ...base, respuesta_correcta: 'D', opcion_d: '' }])[0].status).toBe('error');
  });
  it('permite categorías/temas nuevos con createMissing', () => {
    expect(run([{ ...base, categoria: 'Nueva' }], { createMissing: true })[0].status).toBe('valid');
  });
  it('detecta duplicados dentro del archivo y contra la base', () => {
    const rows = run([base, { ...base }]);
    expect(rows.map((r) => r.status)).toEqual(['valid', 'duplicate']);
    const ex = run([base], { existing: [{ topicId: 't1', question: '¿q?' }] });
    expect(ex[0].status).toBe('duplicate');
  });
  it('acepta la respuesta como texto exacto o número', () => {
    expect(run([{ ...base, respuesta_correcta: 'C1' }])[0].data.correctAnswer).toBe(2);
    expect(run([{ ...base, respuesta_correcta: '4' }])[0].data.correctAnswer).toBe(3);
  });
});

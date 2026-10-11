import { normalizeHeader } from './csv.js';

export const IMPORT_COLUMNS = [
  'categoria', 'tema', 'pregunta', 'opcion_a', 'opcion_b', 'opcion_c', 'opcion_d',
  'respuesta_correcta', 'explicacion', 'dificultad', 'activo',
];

export const normText = (s) =>
  String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

const DIFF_MAP = { facil: 'facil', easy: 'facil', f: 'facil', media: 'media', medio: 'media', medium: 'media', m: 'media', dificil: 'dificil', hard: 'dificil', d: 'dificil' };

function parseBool(v, def = true) {
  if (v === undefined || v === null || String(v).trim() === '') return def;
  return ['1', 'si', 'sí', 'true', 'yes', 'y', 'activo', 'x'].includes(normText(v));
}

/**
 * Valida filas de importación (objetos con claves normalizadas).
 * Devuelve [{ line, status: 'valid'|'error'|'duplicate', errors:[], data }]
 *  - error: no se importa.
 *  - duplicate: la misma pregunta ya existe en el tema (o está repetida en el archivo): no se importa.
 */
export function validateImportRows(rawRows, { categories, topics, existing, createMissing = false }) {
  const catByName = new Map(categories.map((c) => [normText(c.name), c]));
  const topicByKey = new Map(topics.map((t) => [`${t.categoryId}|${normText(t.name)}`, t]));
  const seen = new Set();
  const existingKeys = new Set(existing.map((q) => `${q.topicId}|${normText(q.question)}`));

  return rawRows.map((raw, idx) => {
    const r = {};
    Object.keys(raw).forEach((k) => { r[normalizeHeader(k)] = raw[k]; });
    const errors = [];
    const line = idx + 2; // +1 encabezado, +1 base 1

    const catName = (r.categoria || '').trim();
    const topicName = (r.tema || '').trim();
    const question = (r.pregunta || '').trim();
    if (!catName) errors.push('Falta la categoría');
    if (!topicName) errors.push('Falta el tema');
    if (!question) errors.push('Falta la pregunta');

    const options = ['a', 'b', 'c', 'd'].map((l) => (r[`opcion_${l}`] || '').trim());
    // las opciones no pueden tener huecos intermedios
    let lastFilled = -1;
    options.forEach((o, i) => { if (o) lastFilled = i; });
    const used = options.slice(0, lastFilled + 1);
    if (used.some((o) => !o)) errors.push('Las opciones deben ser consecutivas (A, B, C, D) sin huecos');
    if (used.filter(Boolean).length < 2) errors.push('Se requieren al menos 2 opciones');
    if (new Set(used.map(normText)).size !== used.length) errors.push('Hay opciones repetidas');

    // respuesta correcta: A-D, 1-4 o texto exacto
    let correct = -1;
    const rc = (r.respuesta_correcta || '').trim();
    if (!rc) errors.push('Falta la respuesta correcta');
    else {
      const up = rc.toUpperCase();
      if (/^[A-D]$/.test(up)) correct = 'ABCD'.indexOf(up);
      else if (/^[1-4]$/.test(rc)) correct = Number(rc) - 1;
      else correct = used.findIndex((o) => normText(o) === normText(rc));
      if (correct < 0 || correct >= used.length) { errors.push('La respuesta correcta no coincide con ninguna opción'); correct = -1; }
    }

    const diffRaw = normText(r.dificultad);
    const difficulty = diffRaw ? DIFF_MAP[diffRaw] : 'media';
    if (!difficulty) errors.push('Dificultad inválida (use facil, media o dificil)');

    const category = catByName.get(normText(catName));
    if (catName && !category && !createMissing) errors.push(`La categoría "${catName}" no existe`);
    const topic = category ? topicByKey.get(`${category.id}|${normText(topicName)}`) : null;
    if (topicName && category && !topic && !createMissing) errors.push(`El tema "${topicName}" no existe en "${catName}"`);

    const data = {
      categoryName: catName,
      topicName,
      categoryId: category?.id || null,
      topicId: topic?.id || null,
      question,
      options: used.filter(Boolean),
      correctAnswer: correct,
      explanation: (r.explicacion || '').trim(),
      difficulty: difficulty || 'media',
      active: parseBool(r.activo, true),
    };

    let status = errors.length ? 'error' : 'valid';
    if (status === 'valid') {
      const key = `${data.categoryName.toLowerCase()}|${normText(topicName)}|${normText(question)}`;
      const exKey = topic ? `${topic.id}|${normText(question)}` : null;
      if (seen.has(key) || (exKey && existingKeys.has(exKey))) {
        status = 'duplicate';
        errors.push(seen.has(key) ? 'Repetida dentro del archivo' : 'Ya existe en el tema');
      }
      seen.add(key);
    }
    return { line, status, errors, data };
  });
}

export const IMPORT_TEMPLATE_ROWS = [
  {
    categoria: 'PYMES', tema: 'Liquidez y balance',
    pregunta: '¿Cuál cuenta pertenece al Activo Corriente?',
    opcion_a: 'Edificios', opcion_b: 'Cuentas por cobrar', opcion_c: 'Capital social', opcion_d: 'Préstamo a 5 años',
    respuesta_correcta: 'B', explicacion: 'Las cuentas por cobrar se convierten en efectivo en menos de un año.',
    dificultad: 'facil', activo: 'si',
  },
];

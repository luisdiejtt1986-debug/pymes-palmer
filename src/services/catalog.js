import { listCategories } from './categoryService.js';
import { listTopics } from './topicService.js';

/**
 * Catálogo (categorías + temas) con caché en memoria para no repetir consultas
 * en cada componente. Se invalida cuando el administrador crea/edita contenido.
 */
let cache = null;
let inflight = null;
const TTL = 60_000;

export function invalidateCatalog() {
  cache = null;
  inflight = null;
}

export async function getCatalog(force = false) {
  if (!force && cache && Date.now() - cache.at < TTL) return cache.data;
  if (!force && inflight) return inflight;
  inflight = Promise.all([listCategories(), listTopics()])
    .then(([categories, topics]) => {
      const data = {
        categories,
        topics,
        catMap: Object.fromEntries(categories.map((c) => [c.id, c])),
        topicMap: Object.fromEntries(topics.map((t) => [t.id, t])),
      };
      cache = { at: Date.now(), data };
      inflight = null;
      return data;
    })
    .catch((e) => { inflight = null; throw e; });
  return inflight;
}

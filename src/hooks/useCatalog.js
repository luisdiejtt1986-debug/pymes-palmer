import { getCatalog } from '../services/catalog.js';
import { useAsync } from './useAsync.js';

/** Categorías + temas (con caché). `catalog.data` = { categories, topics, catMap, topicMap }. */
export function useCatalog() {
  return useAsync(() => getCatalog(), []);
}

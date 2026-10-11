import { useAsync } from '../hooks/useAsync.js';
import { listGames } from '../services/gameService.js';
import { LineChart } from './Charts.jsx';
import { Loading, EmptyState } from './Ui.jsx';
import { toMillis } from '../utils/game.js';

/** Gráfica de evolución: precisión de las últimas partidas completadas. */
export default function EvolutionChart({ uid }) {
  const { data, loading, error } = useAsync(() => listGames(uid, { pageSize: 15 }), [uid]);
  if (loading) return <Loading text="Cargando evolución…" />;
  if (error) return <p className="muted small">No se pudo cargar la evolución.</p>;
  const games = [...data.items].reverse();
  if (!games.length) return <EmptyState icon="📈" title="Aún no hay datos" text="Juega tu primer reto para ver tu evolución." />;
  const points = games.map((g) => {
    const d = new Date(toMillis(g.finishedAt || g.startedAt));
    return { label: `${d.getDate()}/${d.getMonth() + 1}`, value: Math.round(g.accuracy) };
  });
  return (
    <>
      <LineChart points={points} unit="%" title="Precisión por partida" />
      <p className="small muted">Precisión (%) de tus últimas {games.length} partidas.</p>
    </>
  );
}

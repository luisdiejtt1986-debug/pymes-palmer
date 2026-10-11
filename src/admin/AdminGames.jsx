import { useMemo, useState } from 'react';
import { useAsync } from '../hooks/useAsync.js';
import { listRecentGames } from '../services/gameService.js';
import { getCatalog } from '../services/catalog.js';
import { Badge, EmptyState, ErrorState, Loading, Modal, Pager } from '../components/Ui.jsx';
import GameDetail from '../components/GameDetail.jsx';
import { fmtDate } from '../utils/game.js';

const PAGE = 20;

export default function AdminGames() {
  const { data, loading, error, reload } = useAsync(async () => {
    const [games, catalog] = await Promise.all([listRecentGames(200), getCatalog()]);
    return { games, catalog };
  }, []);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);

  const rows = useMemo(() => (data?.games || []).filter((g) => (!q.trim() || g.userName?.toLowerCase().includes(q.trim().toLowerCase())) && (!kind || g.kind === kind)), [data, q, kind]);

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const { catalog } = data;
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));

  return (
    <div className="fade-in">
      <div className="toolbar">
        <input className="input" type="search" placeholder="Buscar por jugador…" aria-label="Buscar por jugador" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select className="select" aria-label="Tipo" value={kind} onChange={(e) => { setKind(e.target.value); setPage(1); }} style={{ flex: '0 1 170px' }}>
          <option value="">Todos los tipos</option><option value="normal">Normal</option><option value="review">Repaso</option><option value="challenge">Reto</option>
        </select>
      </div>
      {rows.length === 0 ? <EmptyState icon="🎮" title="No hay partidas" text="Aparecerán cuando los jugadores completen retos." /> : (
        <>
          <div className="table-wrap">
            <table className="tbl" style={{ minWidth: 860 }}>
              <thead><tr><th>Fecha</th><th>Jugador</th><th>Categoría / Tema</th><th>Tipo</th><th className="num">Correctas</th><th className="num">Precisión</th><th className="num">Puntos</th><th className="num">T. prom.</th><th /></tr></thead>
              <tbody>
                {rows.slice((page - 1) * PAGE, page * PAGE).map((g) => (
                  <tr key={g.id}>
                    <td>{fmtDate(g.finishedAt || g.startedAt)}</td>
                    <td>{g.userName}</td>
                    <td><div className="small">{catalog.catMap[g.categoryId]?.name || 'Todas'}</div><div className="li-sub">{catalog.topicMap[g.topicId]?.name || '—'}</div></td>
                    <td><Badge>{g.kind === 'review' ? 'Repaso' : g.kind === 'challenge' ? 'Reto' : 'Normal'}{g.mode === 'learning' ? ' · Aprend.' : ''}</Badge></td>
                    <td className="num">{g.correctCount}/{g.questionsCount}</td><td className="num">{g.accuracy}%</td><td className="num">{g.score}</td><td className="num">{g.averageTime}s</td>
                    <td><button className="btn btn-sm" onClick={() => setOpen(g)}>Detalle</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} pages={pages} onPage={setPage} />
          <p className="small muted center">Se muestran las últimas 200 partidas. Para el histórico completo usa Exportar datos.</p>
        </>
      )}
      {open && <Modal title={`${open.userName} · ${fmtDate(open.finishedAt || open.startedAt)}`} onClose={() => setOpen(null)} big><GameDetail gameId={open.id} uid={open.userId} /></Modal>}
    </div>
  );
}

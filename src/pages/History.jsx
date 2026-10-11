import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCatalog } from '../hooks/useCatalog.js';
import { listGames } from '../services/gameService.js';
import { EmptyState, ErrorState, Loading, Modal, Badge } from '../components/Ui.jsx';
import GameDetail from '../components/GameDetail.jsx';
import { fmtDate } from '../utils/game.js';

const KIND = { normal: 'Normal', review: 'Repaso', challenge: 'Reto' };

export default function History() {
  const { profile } = useAuth();
  const catalog = useCatalog();
  const [rows, setRows] = useState([]);
  const [last, setLast] = useState(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null);

  const load = useCallback(async (after = null) => {
    try {
      const r = await listGames(profile.id, { pageSize: 20, after });
      setRows((prev) => (after ? [...prev, ...r.items] : r.items));
      setLast(r.last);
      setDone(r.done);
      setError(null);
    } catch (e) { console.error(e); setError(e); }
    setLoading(false);
    setMore(false);
  }, [profile.id]);

  useEffect(() => { load(); }, [load]);

  if (loading || catalog.loading) return <div className="page"><Loading /></div>;
  if (error) return <div className="page"><ErrorState error={error} onRetry={() => { setLoading(true); load(); }} /></div>;
  const cm = catalog.data?.catMap || {};
  const tm = catalog.data?.topicMap || {};

  return (
    <div className="page wide fade-in">
      <h1 className="display" style={{ fontSize: 26, marginBottom: 14 }}>Historial de partidas</h1>
      {rows.length === 0 ? (
        <EmptyState icon="🏔️" title="Todavía no tienes partidas" text="¡Juega tu primer reto!" action={<Link className="btn btn-primary" to="/play">Jugar</Link>} />
      ) : (
        <>
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Fecha</th><th>Categoría</th><th>Tema</th><th>Modo</th>
                  <th className="num">Preg.</th><th className="num">✔</th><th className="num">✖</th><th className="num">⏱</th>
                  <th className="num">Precisión</th><th className="num">Puntos</th><th className="num">XP</th><th className="num">T. prom.</th><th />
                </tr>
              </thead>
              <tbody>
                {rows.map((g) => (
                  <tr key={g.id}>
                    <td>{fmtDate(g.finishedAt || g.startedAt)}</td>
                    <td>{cm[g.categoryId]?.name || '—'}</td>
                    <td>{tm[g.topicId]?.name || '—'}</td>
                    <td><Badge tone={g.kind === 'review' ? 'warn' : g.kind === 'challenge' ? 'good' : ''}>{KIND[g.kind] || 'Normal'}{g.mode === 'learning' ? ' · Aprend.' : ''}</Badge></td>
                    <td className="num">{g.questionsCount}</td><td className="num">{g.correctCount}</td><td className="num">{g.wrongCount}</td><td className="num">{g.timeoutCount}</td>
                    <td className="num">{g.accuracy}%</td><td className="num">{g.score}</td><td className="num">{g.xpEarned}</td><td className="num">{g.averageTime}s</td>
                    <td><button className="btn btn-sm" onClick={() => setOpen(g)}>Ver detalle</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!done && (
            <div className="pager">
              <button className="btn" disabled={more} onClick={() => { setMore(true); load(last); }}>{more ? 'Cargando…' : 'Cargar más'}</button>
            </div>
          )}
        </>
      )}
      {open && (
        <Modal title={`Partida del ${fmtDate(open.finishedAt || open.startedAt)}`} onClose={() => setOpen(null)} big>
          <p className="small muted" style={{ marginBottom: 12 }}>{tm[open.topicId]?.name || cm[open.categoryId]?.name || 'Todas las categorías'} · {open.correctCount}/{open.questionsCount} correctas · {open.score} puntos</p>
          <GameDetail gameId={open.id} uid={profile.id} />
        </Modal>
      )}
    </div>
  );
}

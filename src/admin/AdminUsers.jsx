import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { listUsers, setUserStatus } from '../services/userService.js';
import { playerKpis, topicMasteryFor } from '../services/analyticsService.js';
import { listGames } from '../services/gameService.js';
import { logAudit } from '../services/auditService.js';
import { useCatalog } from '../hooks/useCatalog.js';
import { useAsync } from '../hooks/useAsync.js';
import { Avatar, Badge, ConfirmDialog, EmptyState, ErrorState, Loading, Modal } from '../components/Ui.jsx';
import { BarList } from '../components/Charts.jsx';
import GameDetail from '../components/GameDetail.jsx';
import { fmtDate, masteryLabel } from '../utils/game.js';

function UserDetail({ user }) {
  const k = playerKpis(user);
  const { data, loading, error } = useAsync(async () => {
    const [games, mastery] = await Promise.all([listGames(user.id, { pageSize: 10 }), topicMasteryFor(user.id)]);
    return { games: games.items, mastery };
  }, [user.id]);
  const [open, setOpen] = useState(null);

  return (
    <div className="stack">
      <div className="grid4">
        {[['Nivel', `${user.level} · ${user.levelName}`], ['XP', k.xp], ['Partidas', k.gamesPlayed], ['Precisión', `${k.accuracy}%`],
          ['Respondidas', k.answered], ['Mejor racha', `${k.bestStreak} d`], ['Mejor punt.', k.bestScore], ['Avance', user.progressIndex || 0]].map(([l, v]) => (
          <div key={l} className="glass glass-tight rs-card"><div className="num" style={{ fontSize: 15 }}>{v}</div><div className="lbl">{l}</div></div>
        ))}
      </div>
      {loading ? <Loading /> : error ? <ErrorState error={error} /> : (
        <>
          <div className="label">Dominio por tema</div>
          {data.mastery.length ? <BarList rows={data.mastery.map((m) => ({ key: m.topicId, label: `${m.name} · ${masteryLabel(m.pct).label}`, value: m.pct, tone: masteryLabel(m.pct).tone }))} /> : <p className="muted small">Sin respuestas todavía.</p>}
          <div className="label">Últimas partidas</div>
          {data.games.length === 0 ? <p className="muted small">Sin partidas.</p> : (
            <div className="stack-sm">
              {data.games.map((g) => (
                <div key={g.id}>
                  <button className="glass glass-tight list-item" onClick={() => setOpen(open === g.id ? null : g.id)} aria-expanded={open === g.id}>
                    <div className="li-main"><div className="li-title">{fmtDate(g.finishedAt || g.startedAt)}</div><div className="li-sub">{g.correctCount}/{g.questionsCount} correctas · {g.score} pts</div></div>
                    <Badge>{g.accuracy}%</Badge>
                  </button>
                  {open === g.id && <div style={{ marginTop: 8 }}><GameDetail gameId={g.id} uid={user.id} /></div>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function AdminUsers() {
  const { profile: admin } = useAuth();
  const toast = useToast();
  useCatalog();
  const [rows, setRows] = useState([]);
  const [last, setLast] = useState(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [detail, setDetail] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async (after = null) => {
    try {
      const r = await listUsers({ pageSize: 25, after });
      setRows((p) => (after ? [...p, ...r.items] : r.items));
      setLast(r.last); setDone(r.done); setError(null);
    } catch (e) { console.error(e); setError(e); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => rows.filter((u) => {
    if (status && u.status !== status) return false;
    const s = q.trim().toLowerCase();
    return !s || u.name?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s);
  }), [rows, q, status]);

  const toggle = async (u) => {
    const next = u.status === 'active' ? 'inactive' : 'active';
    try {
      await setUserStatus(u.id, next);
      await logAudit({ user: admin, action: next === 'active' ? 'ENABLE' : 'DISABLE', entity: 'user', entityId: u.id, before: { status: u.status }, after: { status: next } });
      setRows((p) => p.map((x) => (x.id === u.id ? { ...x, status: next } : x)));
      toast.success(next === 'active' ? 'Jugador activado' : 'Jugador desactivado (su historial se conserva)');
    } catch (e) { console.error(e); toast.error('No se pudo cambiar el estado'); }
    setConfirm(null);
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={() => { setLoading(true); load(); }} />;

  return (
    <div className="fade-in">
      <div className="toolbar">
        <input className="input" type="search" placeholder="Buscar por nombre o correo…" aria-label="Buscar jugador" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="select" aria-label="Filtrar por estado" value={status} onChange={(e) => setStatus(e.target.value)} style={{ flex: '0 1 170px' }}>
          <option value="">Todos los estados</option><option value="active">Activos</option><option value="inactive">Desactivados</option>
        </select>
      </div>
      {filtered.length === 0 ? <EmptyState icon="👥" title="Sin resultados" text="No hay jugadores que coincidan." /> : (
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Jugador</th><th>Rol</th><th>Estado</th><th className="num">Nivel</th><th className="num">XP</th><th className="num">Partidas</th><th className="num">Precisión</th><th>Última partida</th><th /></tr></thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td><div className="row gap10"><Avatar avatar={u.avatar} name={u.name} size="sm" /><div><div className="li-title">{u.name}</div><div className="li-sub">{u.email}</div></div></div></td>
                  <td><Badge tone={u.role === 'admin' ? 'good' : ''}>{u.role === 'admin' ? 'Admin' : 'Jugador'}</Badge></td>
                  <td><Badge tone={u.status === 'active' ? 'ok' : 'bad'}>{u.status === 'active' ? 'Activo' : 'Desactivado'}</Badge></td>
                  <td className="num">{u.level}</td><td className="num">{u.xp}</td><td className="num">{u.gamesPlayed}</td><td className="num">{u.accuracy}%</td>
                  <td>{fmtDate(u.lastPlayedAt)}</td>
                  <td>
                    <div className="row gap8">
                      <button className="btn btn-sm" onClick={() => setDetail(u)}>Ver</button>
                      {u.id !== admin.id && <button className={`btn btn-sm ${u.status === 'active' ? 'btn-danger' : ''}`} onClick={() => setConfirm(u)}>{u.status === 'active' ? 'Desactivar' : 'Activar'}</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!done && <div className="pager"><button className="btn" onClick={() => load(last)}>Cargar más</button></div>}
      {detail && <Modal title={detail.name} onClose={() => setDetail(null)} big><UserDetail user={detail} /></Modal>}
      {confirm && (
        <ConfirmDialog
          title={confirm.status === 'active' ? 'Desactivar jugador' : 'Activar jugador'}
          message={confirm.status === 'active' ? `${confirm.name} no podrá iniciar partidas ni aparecerá en el ranking. Su historial se conserva y puedes reactivarlo cuando quieras.` : `${confirm.name} volverá a poder jugar.`}
          confirmLabel={confirm.status === 'active' ? 'Desactivar' : 'Activar'} danger={confirm.status === 'active'}
          onConfirm={() => toggle(confirm)} onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

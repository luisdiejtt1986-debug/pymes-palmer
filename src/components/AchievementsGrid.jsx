import { useAsync } from '../hooks/useAsync.js';
import { listAchievements, listUnlocked } from '../services/achievementService.js';
import { Loading } from './Ui.jsx';
import { fmtDate } from '../utils/game.js';

export default function AchievementsGrid({ uid }) {
  const { data, loading, error } = useAsync(async () => {
    const [all, unlocked] = await Promise.all([listAchievements({ onlyActive: true }), listUnlocked(uid)]);
    return { all, map: Object.fromEntries(unlocked.map((u) => [u.achievementId, u])) };
  }, [uid]);
  if (loading) return <Loading text="Cargando logros…" />;
  if (error) return <p className="muted small">No se pudieron cargar los logros.</p>;
  const got = data.all.filter((a) => data.map[a.id]).length;
  return (
    <>
      <p className="small muted">{got} de {data.all.length} logros desbloqueados</p>
      <div className="badges-grid">
        {data.all.map((a) => {
          const u = data.map[a.id];
          return (
            <div key={a.id} className={`glass glass-tight badge-card ${u ? '' : 'locked'}`} title={a.description}>
              <div className="bicon" aria-hidden="true">{u ? a.icon : '🔒'}</div>
              <div className="bname">{a.name}</div>
              <div className="bdesc">{a.description}</div>
              {u && <div className="bdesc" style={{ marginTop: 4, color: 'var(--teal)' }}>{fmtDate(u.unlockedAt, false)}</div>}
            </div>
          );
        })}
      </div>
    </>
  );
}

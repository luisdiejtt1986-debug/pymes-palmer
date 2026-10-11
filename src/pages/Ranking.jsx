import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useParams2 } from '../context/ParamsContext.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { RANK_METRICS, highlights, topBy } from '../services/rankingService.js';
import { Avatar, EmptyState, ErrorState, Loading } from '../components/Ui.jsx';

function Highlights() {
  const { data, loading } = useAsync(() => highlights(), []);
  if (loading || !data) return null;
  const cards = [
    ['🏆', 'Mayor XP', data.xp, (p) => `${p.xp} XP`],
    ['🧠', 'Mejor precisión', data.accuracy, (p) => `${p.accuracy}%`],
    ['📈', 'Mayor avance', data.progress, (p) => `+${p.progressIndex}`],
    ['🔥', 'Mejor racha', data.streak, (p) => `${p.bestStreak} d`],
    ['⚡', 'Mejor tiempo', data.time, (p) => `${p.avgTime}s`],
  ];
  return (
    <>
      <div className="section-label">Quién avanzó más</div>
      <div className="highlight-grid">
        {cards.map(([ico, t, p, f]) => (
          <div className="glass glass-tight highlight" key={t}>
            <div className="hi-t">{ico} {t}</div>
            {p ? (<><Avatar avatar={p.avatar} name={p.name} size="sm" /><div className="hi-n">{p.name}</div><div className="hi-v">{f(p)}</div></>) : <div className="small muted" style={{ padding: '10px 0' }}>Sin datos aún</div>}
          </div>
        ))}
      </div>
    </>
  );
}

export default function Ranking({ embedded = false }) {
  const { profile } = useAuth();
  const { params } = useParams2();
  const [metric, setMetric] = useState('xp');
  const m = RANK_METRICS.find((x) => x.key === metric);
  const { data, loading, error, reload } = useAsync(() => topBy(metric, 50), [metric]);

  if (!params.rankingEnabled && !embedded) {
    return <div className="page"><EmptyState icon="🔒" title="El ranking está desactivado" text="El administrador lo ha desactivado temporalmente." /></div>;
  }

  return (
    <div className={embedded ? '' : 'page wide fade-in'}>
      {!embedded && <h1 className="display" style={{ fontSize: 26, marginBottom: 6 }}>Ranking</h1>}
      {!embedded && <div className="row wrap gap8" style={{ marginBottom: 10 }}><Link to="/compare" className="btn btn-sm">⚖️ Comparar jugadores</Link></div>}
      <Highlights />

      <div className="section-label">Clasificación</div>
      <div className="chip-row" role="group" aria-label="Ordenar por">
        {RANK_METRICS.map((x) => (
          <button key={x.key} className={`chip ${metric === x.key ? 'active' : ''}`} onClick={() => setMetric(x.key)}>{x.label}</button>
        ))}
      </div>
      {m.hint && <p className="small muted" style={{ margin: '4px 2px 10px' }}>{m.hint}</p>}

      {loading ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : data.length === 0 ? (
        <EmptyState icon="🏆" title="Todavía no hay jugadores en el ranking" text="Completa una partida para aparecer aquí." />
      ) : (
        <div className="stack-sm">
          {data.map((p, i) => (
            <div key={p.id} className={`glass glass-tight rank-row ${p.id === profile.id ? 'me' : ''}`}>
              <div className={`rank-pos ${i < 3 ? `p${i + 1}` : ''}`}>{i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</div>
              <Avatar avatar={p.avatar} name={p.name} size="sm" />
              <div className="li-main">
                <div className="li-title">{p.name}{p.id === profile.id ? ' (tú)' : ''}</div>
                <div className="li-sub">Nivel {p.level} · {p.levelName}</div>
              </div>
              <div className="rank-stats">
                <div className={metric === 'xp' ? 'hl' : ''}><b>{p.xp}</b>XP</div>
                <div className={metric === 'accuracy' ? 'hl' : ''}><b>{p.accuracy}%</b>Prec.</div>
                <div className={metric === 'progress' ? 'hl' : ''}><b>{p.progressIndex > 0 ? '+' : ''}{p.progressIndex || 0}</b>Avance</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

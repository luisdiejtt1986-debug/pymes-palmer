import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { getCatalog } from '../services/catalog.js';
import { listPublicProfiles } from '../services/userService.js';
import { Avatar, EmptyState, ErrorState, Field, Loading } from '../components/Ui.jsx';

const ROWS = [
  ['Nivel', 'level'], ['XP', 'xp'], ['Partidas', 'gamesPlayed'], ['Precisión', 'accuracy', '%'],
  ['Mejor puntuación', 'bestScore'], ['Mejor racha', 'bestStreak', ' d'], ['Índice de avance', 'progressIndex'],
];

export default function Compare() {
  const { profile } = useAuth();
  const { data, loading, error, reload } = useAsync(async () => {
    const [players, catalog] = await Promise.all([listPublicProfiles(200), getCatalog()]);
    return { players, catalog };
  }, []);
  const [a, setA] = useState(profile.id);
  const [b, setB] = useState('');

  const pa = useMemo(() => data?.players.find((p) => p.id === a), [data, a]);
  const pb = useMemo(() => data?.players.find((p) => p.id === b), [data, b]);

  if (loading) return <div className="page"><Loading /></div>;
  if (error) return <div className="page"><ErrorState error={error} onRetry={reload} /></div>;

  const opts = data.players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>);
  const topicIds = pa && pb ? Array.from(new Set([...Object.keys(pa.topicMastery || {}), ...Object.keys(pb.topicMastery || {})])) : [];

  return (
    <div className="page mid fade-in">
      <h1 className="display" style={{ fontSize: 26, marginBottom: 14 }}>Comparar jugadores</h1>
      <div className="grid2">
        <Field label="Jugador A" htmlFor="pa"><select id="pa" className="select" value={a} onChange={(e) => setA(e.target.value)}>{opts}</select></Field>
        <Field label="Jugador B" htmlFor="pb">
          <select id="pb" className="select" value={b} onChange={(e) => setB(e.target.value)}><option value="">Elige…</option>{opts}</select>
        </Field>
      </div>

      {!pa || !pb ? (
        <div style={{ marginTop: 16 }}><EmptyState icon="⚖️" title="Elige dos jugadores" text="Verás sus indicadores lado a lado." /></div>
      ) : (
        <div className="glass pad" style={{ marginTop: 16 }}>
          <div className="cmp-row" style={{ borderBottom: '1px solid var(--border-strong)' }}>
            <div className="stack-sm" style={{ alignItems: 'center' }}><Avatar avatar={pa.avatar} name={pa.name} /><b style={{ fontFamily: 'var(--font-body)', fontSize: 13 }}>{pa.name}</b></div>
            <div className="cl">vs</div>
            <div className="stack-sm" style={{ alignItems: 'center' }}><Avatar avatar={pb.avatar} name={pb.name} /><b style={{ fontFamily: 'var(--font-body)', fontSize: 13 }}>{pb.name}</b></div>
          </div>
          {ROWS.map(([label, key, suf = '']) => {
            const x = pa[key] || 0;
            const y = pb[key] || 0;
            return (
              <div className="cmp-row" key={key}>
                <div className={x > y ? 'win' : ''}>{x}{suf}</div>
                <div className="cl">{label}</div>
                <div className={y > x ? 'win' : ''}>{y}{suf}</div>
              </div>
            );
          })}
          {topicIds.length > 0 && (
            <>
              <div className="section-label" style={{ marginTop: 18 }}>Dominio por tema</div>
              {topicIds.map((t) => {
                const x = pa.topicMastery?.[t];
                const y = pb.topicMastery?.[t];
                return (
                  <div className="cmp-row" key={t}>
                    <div className={(x ?? -1) > (y ?? -1) ? 'win' : ''}>{x === undefined ? '—' : `${x}%`}</div>
                    <div className="cl">{data.catalog.topicMap[t]?.name || 'Tema'}</div>
                    <div className={(y ?? -1) > (x ?? -1) ? 'win' : ''}>{y === undefined ? '—' : `${y}%`}</div>
                  </div>
                );
              })}
              <p className="small muted" style={{ marginTop: 8 }}>
                Dominio = correctas ÷ respuestas del tema. En verde, quien lidera cada fila.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

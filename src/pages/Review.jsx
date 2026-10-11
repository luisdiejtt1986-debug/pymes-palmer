import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useParams2 } from '../context/ParamsContext.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { reviewSummary } from '../services/gameService.js';
import { getCatalog } from '../services/catalog.js';
import { EmptyState, ErrorState, Loading, Badge } from '../components/Ui.jsx';

export default function Review() {
  const { profile } = useAuth();
  const { params } = useParams2();
  const nav = useNavigate();
  const { data, loading, error, reload } = useAsync(async () => {
    const [sum, catalog] = await Promise.all([reviewSummary(profile.id), getCatalog()]);
    const byTopic = {};
    sum.pendingIds.forEach((id) => {
      const s = sum.stats[id];
      const t = (byTopic[s.topicId] ||= { topicId: s.topicId, count: 0, wrongs: 0 });
      t.count++;
      t.wrongs += s.wrong;
    });
    const topics = Object.values(byTopic).sort((a, b) => b.wrongs - a.wrongs)
      .map((t) => ({ ...t, name: catalog.topicMap[t.topicId]?.name || 'Tema' }));
    return { pending: sum.pendingIds.length, topics };
  }, [profile.id]);

  if (loading) return <div className="page"><Loading /></div>;
  if (error) return <div className="page"><ErrorState error={error} onRetry={reload} /></div>;

  return (
    <div className="page mid fade-in">
      <h1 className="display" style={{ fontSize: 26, marginBottom: 6 }}>Repasar mis errores</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        Armamos una partida con las preguntas que fallaste varias veces o recientemente. Una pregunta sale del repaso cuando la aciertas 2 veces seguidas.
      </p>
      {data.pending === 0 ? (
        <EmptyState icon="🎉" title="No tienes errores pendientes" text="Cuando falles preguntas aparecerán aquí para repasarlas." action={<Link className="btn btn-primary" to="/play">Jugar</Link>} />
      ) : (
        <>
          <div className="glass pad stack">
            <div className="row gap12">
              <div className="mono display" style={{ fontSize: 36, fontWeight: 700, color: 'var(--gold)' }}>{data.pending}</div>
              <div>pregunta{data.pending === 1 ? '' : 's'} pendiente{data.pending === 1 ? '' : 's'} de repaso<div className="small muted">Se jugarán hasta {params.questionsPerGame} por partida, priorizando las más falladas.</div></div>
            </div>
            <div className="stack-sm">
              {data.topics.map((t) => (
                <div key={t.topicId} className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontWeight: 600 }}>{t.name}</span>
                  <Badge tone="bad">{t.count} pendiente{t.count === 1 ? '' : 's'}</Badge>
                </div>
              ))}
            </div>
          </div>
          <button className="cta-main" onClick={() => nav('/play', { state: { autostart: { kind: 'review', learning: true } } })}>
            <span className="shine" />🧠 Empezar repaso
          </button>
        </>
      )}
    </div>
  );
}

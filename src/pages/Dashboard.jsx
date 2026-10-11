import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useParams2 } from '../context/ParamsContext.jsx';
import { Avatar, EmptyState, ErrorState, Loading, Badge } from '../components/Ui.jsx';
import XpBar from '../components/XpBar.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { getActiveSession, listGames } from '../services/gameService.js';
import { recommendNext, topicMasteryFor } from '../services/analyticsService.js';
import { getCatalog } from '../services/catalog.js';
import { fmtDate } from '../utils/game.js';

export default function Dashboard() {
  const { profile } = useAuth();
  const { paramsExist } = useParams2();
  const nav = useNavigate();

  const { data, loading, error, reload } = useAsync(async () => {
    const [active, games, mastery, catalog] = await Promise.all([
      getActiveSession(profile.id).catch(() => null),
      listGames(profile.id, { pageSize: 3 }),
      topicMasteryFor(profile.id),
      getCatalog(),
    ]);
    return { active, games: games.items, mastery, catalog, reco: recommendNext(mastery) };
  }, [profile.id]);

  if (loading) return <div className="page"><Loading /></div>;
  if (error) return <div className="page"><ErrorState error={error} onRetry={reload} /></div>;
  const { active, games, reco, catalog } = data;
  const hasContent = catalog.categories.some((c) => c.active);

  return (
    <div className="page wide">
      <div className="glass user-card fade-in">
        <div className="user-row">
          <Avatar avatar={profile.avatar} name={profile.name} />
          <div className="user-meta">
            <div className="user-greeting">¡Hola de nuevo!</div>
            <div className="user-name">{profile.name}</div>
            <div className="level-pill"><span className="dot" />Nivel {profile.level} · {profile.levelName}</div>
          </div>
        </div>
        <XpBar xp={profile.xp} />
        <div className="stat-row">
          <div className="stat-chip"><div className="num">{profile.gamesPlayed || 0}</div><div className="lbl">Partidas</div></div>
          <div className="stat-chip"><div className="num">{profile.accuracy || 0}%</div><div className="lbl">Precisión</div></div>
          <div className="stat-chip"><div className="num"><span className="flame" aria-hidden="true">🔥</span>{profile.currentStreak || 0}</div><div className="lbl">Racha (días)</div></div>
        </div>
      </div>

      {!paramsExist && (
        <div className="alert warn" style={{ marginBottom: 14 }}>
          El administrador aún no ha guardado los parámetros del juego; se usan los valores por defecto.
        </div>
      )}

      {active && (
        <div className="glass pad row wrap gap12" style={{ marginBottom: 16, borderColor: 'var(--gold)' }}>
          <div style={{ fontSize: 26 }} aria-hidden="true">⏱️</div>
          <div className="li-main">
            <div className="li-title">Tienes una partida en curso</div>
            <div className="li-sub">Pregunta {active.answers.length + 1} de {active.items.length}</div>
          </div>
          <button className="btn btn-primary" onClick={() => nav('/play')}>Continuar partida</button>
        </div>
      )}

      <button className="cta-main" style={{ marginTop: 0 }} onClick={() => nav('/play')} disabled={!hasContent}>
        <span className="shine" />🎮 Jugar ahora
      </button>
      {!hasContent && <p className="small muted center" style={{ marginTop: 8 }}>Aún no hay categorías activas. Pide al administrador que cargue contenido.</p>}

      <div className="section-label">Atajos</div>
      <div className="quick-row">
        <Link to="/review" className="glass quick-card"><div className="qicon">🧠</div><div className="qtitle">Repasar mis errores</div><div className="qsub">Practica lo que más fallas</div></Link>
        <Link to="/challenge" className="glass quick-card"><div className="qicon">⚔️</div><div className="qtitle">Reto 1 vs 1</div><div className="qsub">Mismas preguntas, un ganador</div></Link>
        <Link to="/ranking" className="glass quick-card"><div className="qicon">🏆</div><div className="qtitle">Ranking</div><div className="qsub">¿Quién avanzó más?</div></Link>
        <Link to="/progress" className="glass quick-card"><div className="qicon">📈</div><div className="qtitle">Mi progreso</div><div className="qsub">Dominio por tema</div></Link>
      </div>

      {reco && (
        <>
          <div className="section-label">Tu siguiente reto recomendado</div>
          <button className="glass list-item" onClick={() => nav('/play', { state: { autostart: { kind: 'normal', topicId: reco.topicId, categoryId: catalog.topicMap[reco.topicId]?.categoryId || '' } } })}>
            <div className="pick-card" style={{ border: 'none', padding: 0 }}><div className="pico">🎯</div></div>
            <div className="li-main">
              <div className="li-title">{reco.name}</div>
              <div className="li-sub">{reco.categoryName} · tu dominio actual es {reco.pct}%</div>
            </div>
            <Badge tone="warn">Practicar</Badge>
          </button>
        </>
      )}

      <div className="section-label">Últimas partidas</div>
      {games.length === 0 ? (
        <EmptyState icon="🏔️" title="Todavía no tienes partidas" text="¡Juega tu primer reto!" action={<button className="btn btn-primary" onClick={() => nav('/play')}>Empezar</button>} />
      ) : (
        <div className="stack-sm">
          {games.map((g) => (
            <Link key={g.id} to={`/results/${g.id}`} className="glass glass-tight list-item">
              <div className="li-main">
                <div className="li-title">{catalog.topicMap[g.topicId]?.name || catalog.catMap[g.categoryId]?.name || (g.kind === 'review' ? 'Repaso de errores' : 'Todas las categorías')}</div>
                <div className="li-sub">{fmtDate(g.finishedAt || g.startedAt)}</div>
              </div>
              <Badge tone={g.accuracy >= 70 ? 'ok' : g.accuracy >= 40 ? 'warn' : 'bad'}>{g.correctCount}/{g.questionsCount}</Badge>
              <span className="mono small">+{g.xpEarned} XP</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { getGame } from '../services/gameService.js';
import { listAchievements } from '../services/achievementService.js';
import { recommendNext, topicMasteryFor } from '../services/analyticsService.js';
import { getCatalog } from '../services/catalog.js';
import { ErrorState, Loading, EmptyState } from '../components/Ui.jsx';
import { ScoreRing } from '../components/Charts.jsx';
import GameDetail from '../components/GameDetail.jsx';
import { fmtDate, resultMessage } from '../utils/game.js';

export default function Results() {
  const { gameId } = useParams();
  const { profile } = useAuth();
  const nav = useNavigate();

  const { data, loading, error, reload } = useAsync(async () => {
    const [game, achievements, mastery, catalog] = await Promise.all([
      getGame(gameId), listAchievements(), topicMasteryFor(profile.id), getCatalog(),
    ]);
    return { game, achievements, catalog, reco: recommendNext(mastery) };
  }, [gameId]);

  if (loading) return <div className="page"><Loading /></div>;
  if (error) return <div className="page"><ErrorState error={error} onRetry={reload} /></div>;
  const { game, achievements, catalog, reco } = data;
  if (!game || game.userId !== profile.id) {
    return <div className="page"><EmptyState icon="🔎" title="No encontramos esa partida" action={<Link className="btn" to="/history">Ir al historial</Link>} /></div>;
  }
  if (!game.completed) {
    return <div className="page"><EmptyState icon="⏳" title="Esta partida aún no está terminada" action={<Link className="btn btn-primary" to="/play">Continuar</Link>} /></div>;
  }

  const leveledUp = (game.levelAfter || 0) > (game.levelBefore || 0);
  const msg = resultMessage(game.accuracy, { leveledUp });
  const newAch = (game.newAchievements || []).map((id) => achievements.find((a) => a.id === id)).filter(Boolean);
  const topicName = catalog.topicMap[game.topicId]?.name || catalog.catMap[game.categoryId]?.name || (game.kind === 'review' ? 'Repaso de errores' : 'Todas las categorías');

  return (
    <div className="page mid fade-in">
      <div className="glass results-hero">
        <ScoreRing pct={game.accuracy} sub={`${game.correctCount} / ${game.questionsCount}`} />
        <div className="results-title">{msg.title}</div>
        <p className="results-sub">{msg.sub}</p>
        <p className="small muted" style={{ marginTop: 10 }}>{topicName} · {game.mode === 'learning' ? 'Aprendizaje' : 'Evaluación'} · {fmtDate(game.finishedAt)}</p>
      </div>

      {leveledUp && (
        <div className="alert ok" style={{ marginTop: 14 }} role="status">
          🎉 ¡Subiste del nivel {game.levelBefore} al nivel {game.levelAfter}!
        </div>
      )}

      <div className="grid4" style={{ marginTop: 14 }}>
        {[
          ['Puntos', game.score], ['XP ganado', `+${game.xpEarned}`], ['Precisión', `${game.accuracy}%`], ['Nivel', game.levelAfter ?? profile.level],
          ['Correctas', game.correctCount], ['Incorrectas', game.wrongCount], ['Timeout', game.timeoutCount], ['Mejor combo', `x${game.bestCombo}`],
        ].map(([l, v]) => (
          <div className="glass glass-tight rs-card" key={l}><div className="num">{v}</div><div className="lbl">{l}</div></div>
        ))}
      </div>
      <p className="small muted center" style={{ marginTop: 8 }}>Tiempo promedio por pregunta: {game.averageTime}s</p>

      {newAch.length > 0 && (
        <>
          <div className="section-label">🎖️ Nuevos logros</div>
          <div className="badge-unlock-row">
            {newAch.map((a, i) => (
              <div key={a.id} className="glass glass-tight badge-card-mini" style={{ animationDelay: `${i * 0.12}s` }}>
                <div className="bicon">{a.icon}</div><div className="bname">{a.name}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="section-label">Recomendación</div>
      <div className="glass reco-box">
        <div className="ricon" aria-hidden="true">🎯</div>
        <p>
          {reco
            ? <>Tu siguiente reto recomendado: <b>{reco.name}</b> — dominio actual <b>{reco.pct}%</b>.</>
            : <>Sigue jugando en distintos temas: con más respuestas te recomendaremos dónde practicar.</>}
        </p>
      </div>

      {game.challengeId && (
        <div className="alert info" style={{ marginTop: 14 }}>⚔️ Era un reto 1 vs 1. <Link to="/challenge" style={{ textDecoration: 'underline' }}>Ver el marcador</Link></div>
      )}

      <div className="results-actions">
        {reco && (
          <button className="btn btn-primary" onClick={() => nav('/play', { state: { autostart: { kind: 'normal', topicId: reco.topicId, categoryId: catalog.topicMap[reco.topicId]?.categoryId || '' } } })}>
            Practicar {reco.name}
          </button>
        )}
        <Link className="btn" to="/play">🎮 Jugar de nuevo</Link>
        {game.wrongCount + game.timeoutCount > 0 && <Link className="btn" to="/review">🧠 Repasar mis errores</Link>}
        <Link className="btn btn-ghost" to="/history">Ver historial</Link>
      </div>

      <div className="section-label">Detalle pregunta por pregunta</div>
      <GameDetail gameId={game.id} uid={profile.id} />
    </div>
  );
}

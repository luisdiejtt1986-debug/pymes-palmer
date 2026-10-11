import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { playerKpis, topicMasteryFor } from '../services/analyticsService.js';
import { BarList } from '../components/Charts.jsx';
import { EmptyState, ErrorState, Loading, Badge } from '../components/Ui.jsx';
import EvolutionChart from '../components/EvolutionChart.jsx';
import AchievementsGrid from '../components/AchievementsGrid.jsx';
import XpBar from '../components/XpBar.jsx';
import { localDateISO, masteryLabel, pct, round1 } from '../utils/game.js';

export default function Progress() {
  const { profile: u } = useAuth();
  const { data, loading, error, reload } = useAsync(() => topicMasteryFor(u.id), [u.id]);
  if (loading) return <div className="page"><Loading /></div>;
  if (error) return <div className="page"><ErrorState error={error} onRetry={reload} /></div>;

  const k = playerKpis(u);
  const baseAcc = u.baselineAnswered ? round1((u.baselineCorrect / u.baselineAnswered) * 100) : null;
  const baseScore = u.baselineGames ? Math.round(u.baselineScoreSum / u.baselineGames) : null;
  const enough = (u.gamesPlayed || 0) >= 4;

  const kpis = [
    ['Partidas', k.gamesPlayed], ['Respondidas', k.answered], ['Correctas', k.correct], ['Incorrectas', k.wrong],
    ['Precisión', `${k.accuracy}%`], ['XP', k.xp], ['Nivel', k.level], ['Mejor racha', `${k.bestStreak} d`],
    ['Mejor puntuación', k.bestScore], ['Tiempo promedio', `${k.avgTime}s`],
  ];

  return (
    <div className="page wide fade-in">
      <h1 className="display" style={{ fontSize: 26, marginBottom: 14 }}>Mi progreso</h1>
      <div className="glass user-card"><XpBar xp={u.xp} /></div>

      <div className="section-label">📅 Esta semana</div>
      <div className="glass pad">
        <div className="week-strip">
          {Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            const iso = localDateISO(d);
            return {
              iso,
              lbl: d.toLocaleDateString('es-ES', { weekday: 'short' }).slice(0, 1).toUpperCase(),
              filled: (u.playDates || []).includes(iso),
            };
          }).map((d) => (
            <div className="week-day" key={d.iso}>
              <div className="wd-lbl">{d.lbl}</div>
              <div className={`wd-dot ${d.filled ? 'filled' : ''}`} aria-label={d.filled ? `Jugaste el ${d.iso}` : `Sin juego el ${d.iso}`}>{d.filled ? '🔥' : ''}</div>
            </div>
          ))}
        </div>
        <p className="small muted">Racha actual: <b>{u.currentStreak || 0}</b> día{(u.currentStreak || 0) === 1 ? '' : 's'} · mejor racha: <b>{u.bestStreak || 0}</b></p>
      </div>

      <div className="section-label">Indicadores</div>
      <div className="grid4" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
        {kpis.map(([l, v]) => <div className="glass glass-tight rs-card" key={l}><div className="num">{v}</div><div className="lbl">{l}</div></div>)}
      </div>

      <div className="section-label">Evolución de la precisión</div>
      <div className="glass pad"><EvolutionChart uid={u.id} /></div>

      <div className="section-label">Índice de avance</div>
      <div className="glass pad stack">
        {!enough ? (
          <p className="muted">Se calcula a partir de tu 4.ª partida: compara tus primeras 3 partidas con tu rendimiento reciente. Llevas {u.gamesPlayed || 0}.</p>
        ) : (
          <>
            <div className="row gap12 wrap">
              <div className="mono display" style={{ fontSize: 34, fontWeight: 700, color: u.progressIndex >= 0 ? 'var(--teal)' : 'var(--coral)' }}>
                {u.progressIndex > 0 ? '+' : ''}{u.progressIndex}
              </div>
              <div className="small muted" style={{ flex: 1, minWidth: 220 }}>
                Premia la <b>mejora</b>, no solo el XP: combina el cambio de precisión (35 %), del dominio por tema (25 %), del puntaje promedio (25 %) y los niveles ganados (15 %).
              </div>
            </div>
            <div className="table-wrap">
              <table className="tbl" style={{ minWidth: 420 }}>
                <thead><tr><th>Indicador</th><th className="num">Inicial</th><th className="num">Actual</th></tr></thead>
                <tbody>
                  <tr><td>Precisión</td><td className="num">{baseAcc ?? '—'}%</td><td className="num">{u.recentAccuracy}%</td></tr>
                  <tr><td>XP</td><td className="num">0</td><td className="num">{u.xp}</td></tr>
                  <tr><td>Nivel</td><td className="num">{u.baselineLevel}</td><td className="num">{u.level}</td></tr>
                  <tr><td>Puntos promedio por partida</td><td className="num">{baseScore ?? '—'}</td><td className="num">{Math.round(u.recentAvgScore)}</td></tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="section-label">Dominio por tema</div>
      {data.length === 0 ? (
        <EmptyState icon="🧭" title="Aún no hay temas con respuestas" text="Tu dominio se calcula como correctas ÷ respuestas de cada tema." action={<Link to="/play" className="btn btn-primary">Jugar</Link>} />
      ) : (
        <div className="glass pad">
          <BarList rows={data.map((m) => {
            const ml = masteryLabel(m.pct);
            return { key: m.topicId, label: `${m.name} · ${ml.label}`, value: m.pct, tone: ml.tone, right: `${m.pct}% (${m.correct}/${m.answered})` };
          })} />
          <div className="row gap8 wrap" style={{ marginTop: 6 }}>
            <Badge tone="ok">90-100 Dominado</Badge><Badge tone="good">75-89 Buen dominio</Badge><Badge tone="warn">60-74 En desarrollo</Badge><Badge tone="bad">0-59 Necesita práctica</Badge>
          </div>
          <p className="small muted" style={{ marginTop: 10 }}>
            {data.some((m) => m.answered >= 10 && pct(m.correct, m.answered) >= 90) ? 'Dominas un tema cuando tienes ≥ 90 % con al menos 10 respuestas.' : 'Dominas un tema con ≥ 90 % y al menos 10 respuestas.'}
          </p>
        </div>
      )}

      <div className="section-label">Logros</div>
      <AchievementsGrid uid={u.id} />
    </div>
  );
}

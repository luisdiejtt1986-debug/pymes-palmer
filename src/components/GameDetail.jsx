import { useAsync } from '../hooks/useAsync.js';
import { listAnswersByGame } from '../services/answerService.js';
import { ErrorState, Loading } from './Ui.jsx';

/** Detalle pregunta por pregunta de una partida (jugador o admin). */
export default function GameDetail({ gameId, uid }) {
  const { data, loading, error, reload } = useAsync(() => listAnswersByGame(gameId, uid), [gameId, uid]);
  if (loading) return <Loading text="Cargando respuestas…" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data.length) return <p className="muted">No hay respuestas registradas para esta partida.</p>;
  return (
    <div className="stack-sm">
      {data.map((a) => (
        <div key={a.id} className="glass glass-tight pad" style={{ padding: 14 }}>
          <div className="row gap8" style={{ alignItems: 'flex-start' }}>
            <span aria-hidden="true">{a.correct ? '✅' : a.timedOut ? '⏱️' : '❌'}</span>
            <div className="li-main">
              <div style={{ fontWeight: 700, fontSize: 14 }}>{a.index + 1}. {a.questionText}</div>
              <div className="small" style={{ marginTop: 4 }}>
                Tu respuesta: <b>{a.timedOut ? 'Sin respuesta (tiempo agotado)' : a.selectedAnswer}</b>
              </div>
              {!a.correct && <div className="small" style={{ color: 'var(--teal)' }}>Correcta: <b>{a.correctAnswer}</b></div>}
              {a.explanation && <div className="small muted" style={{ marginTop: 4 }}>{a.explanation}</div>}
            </div>
            <div className="mono small muted" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
              {a.points ? `+${a.points}` : '0'}<br />{a.timeUsed}s
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

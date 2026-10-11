import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useParams2 } from '../context/ParamsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useCatalog } from '../hooks/useCatalog.js';
import { abandonGame, getActiveSession, startGame } from '../services/gameService.js';
import { ErrorState, Loading, EmptyState } from '../components/Ui.jsx';
import GameRunner from '../components/GameRunner.jsx';
import { DIFFICULTIES, DIFFICULTY_LABEL } from '../data/defaults.js';

export default function Play() {
  const { profile } = useAuth();
  const { params, paramsLoading } = useParams2();
  const nav = useNavigate();
  const loc = useLocation();
  const toast = useToast();
  const catalog = useCatalog();
  const [stage, setStage] = useState('loading'); // loading | resume | select | starting | playing
  const [session, setSession] = useState(null);
  const [saved, setSaved] = useState(null);
  const [sel, setSel] = useState({ categoryId: '', topicId: '', learning: false, difficulty: '' });
  const autostarted = useRef(false);

  const begin = useCallback(async (opts) => {
    setStage('starting');
    try {
      const { session: s } = await startGame({ profile, params, ...opts });
      setSession(s);
      setStage('playing');
    } catch (e) {
      console.error(e);
      toast.error(e.message || 'No se pudo iniciar la partida.');
      setStage('select');
    }
  }, [profile, params, toast]);

  // Al entrar: ¿hay una partida en curso? ¿viene un inicio automático (repaso, reto, recomendado)?
  useEffect(() => {
    if (paramsLoading || catalog.loading || autostarted.current) return;
    autostarted.current = true;
    (async () => {
      const active = await getActiveSession(profile.id).catch(() => null);
      const auto = loc.state?.autostart;
      if (active && !auto) { setSaved(active); setStage('resume'); return; }
      if (active && auto) await abandonGame(profile.id, active).catch(() => {});
      if (auto) {
        nav('/play', { replace: true, state: null });
        begin({ learning: false, ...auto });
      } else setStage('select');
    })();
  }, [paramsLoading, catalog.loading]); // eslint-disable-line react-hooks/exhaustive-deps

  if (paramsLoading || catalog.loading || stage === 'loading') return <div className="page"><Loading text="Preparando el juego…" /></div>;
  if (catalog.error) return <div className="page"><ErrorState error={catalog.error} onRetry={catalog.reload} /></div>;
  if (stage === 'starting') return <div className="page"><Loading text="Seleccionando preguntas…" /></div>;

  const cat = catalog.data;

  if (stage === 'playing' && session) {
    return (
      <GameRunner
        profile={profile} params={params} initial={session} catalog={cat}
        onFinished={(id) => nav(`/results/${id}`, { replace: true })}
        onAbandon={() => { setSession(null); setStage('select'); }}
      />
    );
  }

  if (stage === 'resume' && saved) {
    return (
      <div className="page">
        <div className="glass pad stack fade-in" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 44 }}>⏱️</div>
          <h2 className="display">Tienes una partida sin terminar</h2>
          <p className="muted">Vas por la pregunta {Math.min(saved.answers.length + 1, saved.items.length)} de {saved.items.length}. Puedes continuar justo donde la dejaste (no se duplica ningún resultado).</p>
          <button className="cta-main" style={{ marginTop: 4 }} onClick={() => { setSession({ ...saved, qStartedAt: Date.now() }); setStage('playing'); }}>
            <span className="shine" />Continuar partida
          </button>
          <button className="btn btn-danger" onClick={async () => { await abandonGame(profile.id, saved).catch(() => {}); setSaved(null); setStage('select'); }}>
            Descartar y empezar otra
          </button>
        </div>
      </div>
    );
  }

  const cats = cat.categories.filter((c) => c.active);
  if (!cats.length) {
    return <div className="page"><EmptyState icon="🗂️" title="Aún no hay contenido" text="Un administrador debe crear categorías, temas y preguntas (o cargar los datos iniciales desde el panel)." /></div>;
  }
  const topics = cat.topics.filter((t) => t.active && t.categoryId === sel.categoryId);
  const n = params.questionsPerGame;

  return (
    <div className="page mid fade-in">
      <h1 className="display" style={{ fontSize: 26, marginBottom: 4 }}>Elige tu reto</h1>
      <p className="muted">{n} preguntas · {params.timePerQuestion} s por pregunta{params.lifelinesEnabled ? ' · comodines activos' : ''}</p>

      <div className="step-title"><span className="step-num">1</span>Categoría</div>
      <div className="pick-grid">
        <button className={`glass pick-card ${sel.categoryId === '' ? 'selected' : ''}`} onClick={() => setSel({ ...sel, categoryId: '', topicId: '' })}>
          <div className="pico">🎲</div><div><div className="ptitle">Todas</div><div className="psub">Mezcla de todas las categorías activas</div></div>
        </button>
        {cats.map((c) => (
          <button key={c.id} className={`glass pick-card ${sel.categoryId === c.id ? 'selected' : ''}`} onClick={() => setSel({ ...sel, categoryId: c.id, topicId: '' })}>
            <div className="pico" style={{ background: `${c.color}33` }}>{c.icon}</div>
            <div><div className="ptitle">{c.name}</div><div className="psub">{c.description}</div></div>
          </button>
        ))}
      </div>

      {sel.categoryId && (
        <>
          <div className="step-title"><span className="step-num">2</span>Tema</div>
          <div className="chip-row" role="group" aria-label="Tema">
            <button className={`chip ${sel.topicId === '' ? 'active' : ''}`} onClick={() => setSel({ ...sel, topicId: '' })}>Todos los temas</button>
            {topics.map((t) => (
              <button key={t.id} className={`chip ${sel.topicId === t.id ? 'active' : ''}`} onClick={() => setSel({ ...sel, topicId: t.id })}>{t.name}</button>
            ))}
          </div>
        </>
      )}

      <div className="step-title"><span className="step-num">{sel.categoryId ? 3 : 2}</span>Modo</div>
      <div className="seg" role="group" aria-label="Modo de juego">
        <button className={!sel.learning ? 'active' : ''} onClick={() => setSel({ ...sel, learning: false })}>🎯 Evaluación</button>
        <button className={sel.learning ? 'active' : ''} onClick={() => setSel({ ...sel, learning: true })}>📖 Aprendizaje</button>
      </div>
      <p className="small muted" style={{ marginTop: 8 }}>
        {sel.learning ? 'Después de cada respuesta verás por qué es correcta y avanzas cuando quieras.' : 'Pregunta, respuesta y resultado final con puntaje.'}
      </p>

      {params.difficultyMode === 'normal' && (
        <>
          <div className="step-title"><span className="step-num">{sel.categoryId ? 4 : 3}</span>Dificultad</div>
          <div className="chip-row" role="group" aria-label="Dificultad">
            <button className={`chip ${sel.difficulty === '' ? 'active' : ''}`} onClick={() => setSel({ ...sel, difficulty: '' })}>Todas</button>
            {DIFFICULTIES.map((d) => (
              <button key={d} className={`chip ${sel.difficulty === d ? 'active' : ''}`} onClick={() => setSel({ ...sel, difficulty: d })}>{DIFFICULTY_LABEL[d]}</button>
            ))}
          </div>
        </>
      )}
      {params.difficultyMode !== 'normal' && (
        <p className="small muted" style={{ marginTop: 14 }}>
          Dificultad: {params.difficultyMode === 'progresivo' ? 'progresiva (de fácil a difícil)' : params.difficultyMode === 'adaptativo' ? 'adaptativa a tu nivel' : 'aleatoria'}.
        </p>
      )}

      <button className="cta-main" onClick={() => begin({ kind: 'normal', ...sel })}>
        <span className="shine" />🚀 Comenzar
      </button>
    </div>
  );
}

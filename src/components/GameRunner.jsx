import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TimerRing } from './Charts.jsx';
import { ConfirmDialog, Loading } from './Ui.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { scoreAnswer, round1, shuffle } from '../utils/game.js';
import { shuffledOrder } from '../utils/selection.js';
import { recordAnswer } from '../services/answerService.js';
import { abandonGame, finishGame, getGame, pickReplacement, saveActiveSession } from '../services/gameService.js';
import { listAchievements } from '../services/achievementService.js';
import { submitChallengeScore } from '../services/challengeService.js';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/**
 * Motor de una partida. Toda la configuración (tiempo, XP, comodines…) viene en `initial`
 * (copiada de Firestore al iniciar). La partida se persiste tras cada respuesta para poder
 * continuar después de un refresh; el temporizador se calcula con la hora de inicio de la pregunta.
 */
export default function GameRunner({ profile, params, initial, catalog, onFinished, onAbandon }) {
  const toast = useToast();
  const [session, setSession] = useState(initial);
  const sessionRef = useRef(initial);
  const [cur, setCur] = useState(Math.min(initial.answers.length, initial.items.length - 1));
  const endedEarly = (s) => s.endOnFirstMiss && s.answers.length > 0 && !s.answers[s.answers.length - 1].correct;
  const [phase, setPhase] = useState(initial.answers.length >= initial.items.length || endedEarly(initial) ? 'finishing' : 'question');
  const [picked, setPicked] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [err, setErr] = useState(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const lock = useRef(false);
  const savedIdx = useRef(new Set());
  const finishing = useRef(false);

  const commit = useCallback((next, persist = true) => {
    sessionRef.current = next;
    setSession(next);
    if (persist) saveActiveSession(profile.id, next).catch((e) => console.error('No se pudo guardar la partida activa', e));
  }, [profile.id]);

  const item = session.items[cur];
  const q = item?.q;
  const tpq = session.timePerQuestion;
  const remaining = phase === 'question' ? Math.max(0, tpq - (now - session.qStartedAt) / 1000) : 0;
  const lastAns = session.answers[cur];

  /* ------------------------------ finalizar ------------------------------ */
  const finish = useCallback(async () => {
    if (finishing.current) return;
    finishing.current = true;
    setPhase('finishing');
    setErr(null);
    try {
      const s = sessionRef.current;
      const achievements = await listAchievements({ onlyActive: true });
      const res = await finishGame({ profile, session: s, params, achievements, savedAnswerIdx: [...savedIdx.current] });
      if (s.challengeId) {
        const game = res.game || (await getGame(s.gameId));
        await submitChallengeScore({ challengeId: s.challengeId, uid: profile.id, game }).catch(console.error);
      }
      onFinished(s.gameId);
    } catch (e) {
      console.error(e);
      finishing.current = false;
      setErr(e);
      setPhase('error');
    }
  }, [profile, params, onFinished]);

  useEffect(() => { if (initial.answers.length >= initial.items.length || endedEarly(initial)) finish(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ------------------------------ responder ------------------------------ */
  const submit = useCallback((pos) => {
    if (lock.current) return;
    lock.current = true;
    const s = sessionRef.current;
    const idx = s.answers.length;
    const it = s.items[idx];
    const qq = it.q;
    const limit = s.timePerQuestion;
    const elapsed = Math.min(limit, (Date.now() - s.qStartedAt) / 1000);
    const timedOut = pos === null;
    const selOrig = timedOut ? null : it.order[pos];
    const correct = !timedOut && selOrig === qq.correctAnswer;
    const timeUsed = timedOut ? limit : elapsed;
    const timeRemaining = timedOut ? 0 : Math.max(0, limit - elapsed);
    const combo = correct ? s.combo + 1 : 0;
    const sc = scoreAnswer({ correct, index: idx, timeRemaining, combo, params: { ...s.scoring, timePerQuestion: limit } });
    const ans = {
      qid: it.qid, categoryId: qq.categoryId, topicId: qq.topicId,
      questionText: qq.question,
      selectedText: timedOut ? null : qq.options[selOrig],
      correctText: qq.options[qq.correctAnswer],
      explanation: qq.explanation || '',
      correct, timedOut,
      timeUsed: round1(timeUsed), timeRemaining: round1(timeRemaining),
      points: sc.points, combo,
      base: sc.base, speedBonus: sc.speedBonus, comboBonus: sc.comboBonus,
    };
    const next = {
      ...s, answers: [...s.answers, ans], combo, bestCombo: Math.max(s.bestCombo, combo),
      hidden: [], audience: null,
      qStartedAt: Date.now(), // al reanudar tras un refresh, la siguiente pregunta arranca con tiempo completo
    };
    commit(next);
    setPicked(pos);
    setPhase('feedback');
    recordAnswer({ gameId: s.gameId, uid: profile.id, index: idx, answer: ans })
      .then(() => savedIdx.current.add(idx))
      .catch((e) => console.error('No se pudo guardar la respuesta', e));
  }, [commit, profile.id]);

  // Timeout automático + reloj
  useEffect(() => {
    if (phase !== 'question') return undefined;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase === 'question' && remaining <= 0) submit(null);
  }, [phase, remaining, submit]);

  /* ------------------------------ continuar ------------------------------ */
  const advance = useCallback(() => {
    const s = sessionRef.current;
    if (s.answers.length >= s.items.length || endedEarly(s)) { finish(); return; }
    commit({ ...s, qStartedAt: Date.now() });
    setCur(s.answers.length);
    setPicked(null);
    setNow(Date.now());
    lock.current = false;
    setPhase('question');
  }, [commit, finish]);

  const mustPause = session.learning || (session.showExplanation && Boolean(lastAns?.explanation));
  useEffect(() => {
    if (phase !== 'feedback' || mustPause) return undefined;
    // Igual que el original: 1,3 s tras acertar y 2,2 s tras fallar (para leer la respuesta correcta)
    const t = setTimeout(advance, sessionRef.current.answers[cur]?.correct ? 1300 : 2200);
    return () => clearTimeout(t);
  }, [phase, mustPause, advance, cur]);

  // Teclado: A-D / 1-4 para responder, Enter para continuar
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input,textarea,select,[role="dialog"]')) return;
      if (phase === 'question') {
        const k = e.key.toUpperCase();
        const pos = /^[1-4]$/.test(k) ? Number(k) - 1 : 'ABCD'.indexOf(k);
        if (pos >= 0 && pos < (item?.order.length || 0) && !session.hidden.includes(pos)) submit(pos);
      } else if (phase === 'feedback' && e.key === 'Enter') advance();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, item, session.hidden, submit, advance]);

  /* ------------------------------- comodines ------------------------------ */
  const useLifeline = async (kind) => {
    const s = sessionRef.current;
    if (phase !== 'question' || s.lifelinesUsed[kind] || !s.lifelinesAvailable[kind]) return;
    const it = s.items[cur];
    const used = { ...s.lifelinesUsed, [kind]: true };

    if (kind === 'fifty') {
      const wrong = it.order.map((o, p) => p).filter((p) => it.order[p] !== it.q.correctAnswer);
      if (wrong.length < 2) { toast.info('No hay suficientes opciones para eliminar.'); return; }
      commit({ ...s, lifelinesUsed: used, hidden: shuffle(wrong).slice(0, 2) });
    } else if (kind === 'audience') {
      const visible = it.order.map((o, p) => p).filter((p) => !s.hidden.includes(p));
      const correctPos = it.order.findIndex((o) => o === it.q.correctAnswer);
      const top = 45 + Math.floor(Math.random() * 31); // la "audiencia" acierta entre 45 % y 75 %
      const others = visible.filter((p) => p !== correctPos);
      const weights = others.map(() => Math.random() + 0.2);
      const wsum = weights.reduce((a, b) => a + b, 0) || 1;
      const dist = {};
      let left = 100 - top;
      others.forEach((p, i) => {
        const v = i === others.length - 1 ? left : Math.round(((100 - top) * weights[i]) / wsum);
        dist[p] = Math.max(0, Math.min(left, v));
        left -= dist[p];
      });
      dist[correctPos] = top + (others.length ? 0 : left);
      commit({ ...s, lifelinesUsed: used, audience: dist });
    } else if (kind === 'change') {
      const rep = await pickReplacement({ uid: profile.id, session: s }).catch(() => null);
      if (!rep) { toast.info('No hay otra pregunta disponible para cambiar.'); return; }
      const items = s.items.slice();
      items[cur] = {
        qid: rep.id, order: shuffledOrder(rep.options.length),
        q: { question: rep.question, options: rep.options, correctAnswer: rep.correctAnswer, explanation: rep.explanation || '', categoryId: rep.categoryId, topicId: rep.topicId, difficulty: rep.difficulty || 'media' },
      };
      commit({ ...s, items, lifelinesUsed: used, hidden: [], audience: null, qStartedAt: Date.now() });
      setNow(Date.now());
    }
  };

  const doAbandon = async () => {
    setConfirmExit(false);
    try { await abandonGame(profile.id, sessionRef.current); } catch (e) { console.error(e); }
    onAbandon();
  };

  /* --------------------------------- UI ---------------------------------- */
  if (phase === 'finishing') return <div className="page"><Loading text="Calculando tu resultado, XP y logros…" /></div>;
  if (phase === 'error') {
    return (
      <div className="page">
        <div className="glass empty">
          <div className="e-ico">⚠️</div>
          <h3>No se pudo guardar el resultado</h3>
          <p>{err?.message || 'Error de conexión.'} Tus respuestas están guardadas; puedes reintentar sin perder nada ni duplicar XP.</p>
          <button className="btn btn-primary" onClick={finish}>Reintentar</button>
        </div>
      </div>
    );
  }
  if (!q) return null;

  const total = session.items.length;
  const answered = phase === 'feedback';
  const catName = catalog?.catMap?.[q.categoryId]?.name || 'Reto';
  const topicName = catalog?.topicMap?.[q.topicId]?.name;
  const life = [
    { k: 'fifty', ico: '🎯', label: '50/50' },
    { k: 'audience', ico: '👥', label: 'Público' },
    { k: 'change', ico: '🔁', label: 'Cambiar' },
  ].filter((l) => session.lifelinesAvailable[l.k]);

  return (
    <div className="page mid fade-in">
      <div className="play-top">
        <button className="icon-btn" onClick={() => setConfirmExit(true)} aria-label="Salir de la partida">✕</button>
        <span className="cat-chip" title={topicName || catName}>{topicName || catName}</span>
        <span className="q-progress-text">{session.learning ? '📖 Aprendizaje · ' : ''}{cur + 1} / {total}</span>
      </div>

      <div className="path-strip" aria-hidden="true">
        {session.items.map((_, i) => {
          const a = session.answers[i];
          const cls = a ? (a.correct ? 'done' : 'miss') : i === cur ? 'current' : '';
          return <div key={i} className={`path-node ${cls}`}>{i + 1}</div>;
        })}
      </div>

      <div className="timer-wrap">
        <TimerRing remaining={answered ? Math.max(0, lastAns?.timeRemaining ?? 0) : remaining} total={tpq} />
      </div>

      <div className="glass q-card">
        <div className="row gap8 wrap" style={{ marginBottom: 12 }}>
          {session.combo >= 2 && <span className="combo-pill">🔥 Combo x{session.combo}</span>}
        </div>
        <h2 className="q-text">{q.question}</h2>

        <div className="answers-grid" role="group" aria-label="Alternativas">
          {item.order.map((orig, p) => {
            const isCorrect = orig === q.correctAnswer;
            const hidden = session.hidden.includes(p);
            let cls = '';
            if (answered) {
              if (isCorrect) cls = 'correct';
              else if (p === picked) cls = 'wrong';
              else cls = 'faded';
            } else if (hidden) cls = 'faded';
            return (
              <button
                key={p}
                className={`answer-btn ${cls} ${answered ? 'locked' : ''}`}
                disabled={answered || hidden}
                onClick={() => submit(p)}
                aria-label={`Opción ${LETTERS[p]}: ${q.options[orig]}`}
              >
                <span className="letter">{LETTERS[p]}</span>
                <span>{q.options[orig]}</span>
                {answered && isCorrect && <span className="mark" aria-hidden="true">✓</span>}
                {answered && p === picked && !isCorrect && <span className="mark" aria-hidden="true">✗</span>}
              </button>
            );
          })}
        </div>

        {session.audience && !answered && (
          <div className="glass glass-tight audience-box">
            <div className="label" style={{ marginBottom: 10 }}>👥 La audiencia opina</div>
            {item.order.map((orig, p) => (session.audience[p] === undefined ? null : (
              <div className="audience-row" key={p}>
                <span className="al">{LETTERS[p]}</span>
                <div className="audience-bar-track"><div className="audience-bar-fill" style={{ width: `${session.audience[p]}%` }} /></div>
                <span className="audience-pct">{session.audience[p]}%</span>
              </div>
            )))}
          </div>
        )}

        {life.length > 0 && !answered && (
          <div className="lifelines" aria-label="Comodines">
            {life.map((l) => (
              <button key={l.k} className="life-btn" disabled={session.lifelinesUsed[l.k]} onClick={() => useLifeline(l.k)}>
                <span className="lemo" aria-hidden="true">{l.ico}</span>{l.label}
              </button>
            ))}
          </div>
        )}

        {answered && lastAns && (
          <div className={`feedback-banner ${lastAns.correct ? 'ok' : 'bad'}`} role="status" aria-live="polite">
            <div className="fb-head">
              <span style={{ fontSize: 22 }} aria-hidden="true">{lastAns.correct ? '✅' : lastAns.timedOut ? '⏱️' : '❌'}</span>
              <span>{lastAns.correct ? '¡Correcto!' : lastAns.timedOut ? 'Se acabó el tiempo' : 'Incorrecto'}</span>
              <span className="xp-gain">{lastAns.correct ? `+${lastAns.points} XP` : ''}</span>
            </div>
            {!lastAns.correct && <div className="explain">Respuesta correcta: <b>{lastAns.correctText}</b></div>}
            {(session.learning || session.showExplanation) && lastAns.explanation && <div className="explain">{lastAns.explanation}</div>}
            {session.learning && !lastAns.explanation && <div className="explain muted">Esta pregunta aún no tiene explicación registrada.</div>}
          </div>
        )}
      </div>

      {answered && mustPause && (
        <button className="cta-main" onClick={advance} autoFocus>
          {session.answers.length >= total || endedEarly(session) ? 'Ver resultado' : 'Continuar'} →
        </button>
      )}

      {confirmExit && (
        <ConfirmDialog
          title="¿Salir de la partida?"
          message="Se descartará esta partida sin sumar XP. Si solo quieres pausar, cierra la pestaña: podrás continuarla después."
          confirmLabel="Salir y descartar"
          danger
          onConfirm={doAbandon}
          onCancel={() => setConfirmExit(false)}
        />
      )}
    </div>
  );
}

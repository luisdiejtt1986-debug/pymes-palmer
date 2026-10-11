import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { getParams, saveParams, validateParams } from '../services/parameterService.js';
import { DIFFICULTY_MODES } from '../data/defaults.js';
import { ErrorState, Field, Loading } from '../components/Ui.jsx';

const TIMES = [10, 15, 20, 25, 30, 45, 60];
const BANKS = [20, 30, 40, 50, 100];

function Toggle({ id, label, hint, checked, onChange }) {
  return (
    <div className="field">
      <label className="check" htmlFor={id}><input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />{label}</label>
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

function Form({ initial }) {
  const { profile } = useAuth();
  const toast = useToast();
  const [saved, setSaved] = useState(initial);
  const [p, setP] = useState(initial);
  const [ladder, setLadder] = useState((initial.xpLadder || []).join(', '));
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setP((s) => ({ ...s, [k]: v }));
  const num = (k) => (e) => set(k)(e.target.value === '' ? '' : Number(e.target.value));

  const setLevel = (i, k, v) => setP((s) => ({ ...s, levels: s.levels.map((l, j) => (j === i ? { ...l, [k]: v } : l)) }));

  const submit = async (e) => {
    e.preventDefault();
    const er = validateParams(p);
    const lad = ladder.split(/[,\s]+/).filter(Boolean).map(Number);
    if (!lad.length || lad.some((x) => !(x > 0))) er.xpLadder = 'Lista de números positivos separados por comas';
    if (p.levels.some((l) => !l.name.trim() || !(Number(l.from) >= 1))) er.levels = 'Cada nivel necesita nombre y un nivel de inicio ≥ 1';
    setErrs(er);
    if (Object.keys(er).length) { toast.error('Revisa los campos marcados'); return; }
    setBusy(true);
    try {
      const next = { ...p, xpLadder: lad, levels: p.levels.map((l) => ({ from: Number(l.from), name: l.name.trim() })).sort((a, b) => a.from - b.from) };
      const changed = await saveParams(next, saved, profile);
      setSaved({ ...next });
      toast.success(changed.length ? `Guardado (${changed.length} cambio${changed.length === 1 ? '' : 's'} registrado${changed.length === 1 ? '' : 's'} en auditoría). Aplica a las nuevas partidas.` : 'No había cambios que guardar.');
    } catch (err) { console.error(err); toast.error('No se pudo guardar: ' + (err.message || '')); }
    setBusy(false);
  };

  return (
    <form className="stack fade-in" onSubmit={submit} noValidate>
      <div className="glass pad stack">
        <h2 className="display" style={{ fontSize: 18 }}>Banco de preguntas y partida</h2>
        <div className="form-grid cols2">
          <Field label="Preguntas disponibles por tema (banco recomendado)" htmlFor="pq" error={errs.questionsAvailablePerTopic} hint="Solo advierte en Temas; no bloquea el juego.">
            <input id="pq" className="input" type="number" min="1" list="banks" value={p.questionsAvailablePerTopic} onChange={num('questionsAvailablePerTopic')} />
            <datalist id="banks">{BANKS.map((b) => <option key={b} value={b} />)}</datalist>
          </Field>
          <Field label="Preguntas por partida" htmlFor="ppg" error={errs.questionsPerGame}><input id="ppg" className="input" type="number" min="1" max="100" value={p.questionsPerGame} onChange={num('questionsPerGame')} /></Field>
          <Field label="Tiempo por pregunta (segundos)" htmlFor="tpq" error={errs.timePerQuestion} hint="Aplica a las partidas nuevas.">
            <input id="tpq" className="input" type="number" min="5" max="600" list="times" value={p.timePerQuestion} onChange={num('timePerQuestion')} />
            <datalist id="times">{TIMES.map((t) => <option key={t} value={t} />)}</datalist>
          </Field>
          <Field label="Modo de dificultad" htmlFor="dm">
            <select id="dm" className="select" value={p.difficultyMode} onChange={(e) => set('difficultyMode')(e.target.value)}>{DIFFICULTY_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select>
          </Field>
          <Field label="Modo de juego por defecto" htmlFor="gm">
            <select id="gm" className="select" value={p.gameMode} onChange={(e) => set('gameMode')(e.target.value)}><option value="evaluation">Evaluación</option><option value="learning">Aprendizaje</option></select>
          </Field>
        </div>
        <Toggle id="ar" label="Permitir repetir preguntas ya respondidas" hint="Si se desactiva, se priorizan siempre las nunca vistas cuando hay suficientes." checked={p.allowRepeatQuestions} onChange={set('allowRepeatQuestions')} />
        <Toggle id="se" label="Mostrar explicación después de responder" checked={p.showExplanation} onChange={set('showExplanation')} />
        <Toggle id="eom" label="Terminar la partida al primer error (estilo 'subir la cima' del juego original)" hint="Desactivado: siempre se juegan todas las preguntas. No aplica a los retos 1 vs 1." checked={p.endOnFirstMiss} onChange={set('endOnFirstMiss')} />
      </div>

      <div className="glass pad stack">
        <h2 className="display" style={{ fontSize: 18 }}>Puntuación y XP</h2>
        <div className="form-grid cols2">
          <Field label="XP base por respuesta correcta" htmlFor="bxp" error={errs.baseXP}><input id="bxp" className="input" type="number" min="1" value={p.baseXP} onChange={num('baseXP')} /></Field>
          <Field label="Escalera de XP (por posición de pregunta)" htmlFor="lad" error={errs.xpLadder} hint="Se escala con el XP base. Ej.: 60, 80, 100, 130…">
            <input id="lad" className="input" value={ladder} onChange={(e) => setLadder(e.target.value)} />
          </Field>
          <Field label="Factor de niveles" htmlFor="lf" error={errs.levelFactor} hint="XP acumulada para superar el nivel n = factor × n²">
            <input id="lf" className="input" type="number" min="10" value={p.levelFactor} onChange={num('levelFactor')} />
          </Field>
        </div>
        <Toggle id="sb" label="Bonificación por velocidad" hint="Hasta +50 % del XP base según el tiempo restante." checked={p.speedBonusEnabled} onChange={set('speedBonusEnabled')} />
        <Toggle id="cb" label="Bonificación por combo" hint="+10 % del XP base por cada acierto seguido (máx. +50 %)." checked={p.comboEnabled} onChange={set('comboEnabled')} />
        <Toggle id="st" label="Rachas diarias" checked={p.streakEnabled} onChange={set('streakEnabled')} />
        <Toggle id="rk" label="Ranking habilitado" checked={p.rankingEnabled} onChange={set('rankingEnabled')} />
      </div>

      <div className="glass pad stack">
        <h2 className="display" style={{ fontSize: 18 }}>Comodines</h2>
        <Toggle id="le" label="Comodines habilitados" checked={p.lifelinesEnabled} onChange={set('lifelinesEnabled')} />
        <div className="row wrap gap16">
          {[['fifty', '50/50'], ['audience', 'Pregunta al público'], ['change', 'Cambiar pregunta']].map(([k, l]) => (
            <label className="check" key={k}><input type="checkbox" disabled={!p.lifelinesEnabled} checked={p.lifelines[k]} onChange={(e) => setP((s) => ({ ...s, lifelines: { ...s.lifelines, [k]: e.target.checked } }))} />{l}</label>
          ))}
        </div>
      </div>

      <div className="glass pad stack">
        <h2 className="display" style={{ fontSize: 18 }}>Niveles</h2>
        {errs.levels && <span className="field-error" role="alert">{errs.levels}</span>}
        {p.levels.map((l, i) => (
          <div className="row gap10" key={i}>
            <input className="input" type="number" min="1" aria-label="Desde el nivel" value={l.from} onChange={(e) => setLevel(i, 'from', e.target.value)} style={{ maxWidth: 110 }} />
            <input className="input" aria-label="Nombre del rango" value={l.name} onChange={(e) => setLevel(i, 'name', e.target.value)} />
            <button type="button" className="btn btn-sm btn-danger" aria-label="Quitar rango" disabled={p.levels.length <= 1} onClick={() => setP((s) => ({ ...s, levels: s.levels.filter((_, j) => j !== i) }))}>✕</button>
          </div>
        ))}
        <div><button type="button" className="btn btn-sm" onClick={() => setP((s) => ({ ...s, levels: [...s.levels, { from: (s.levels.at(-1)?.from || 1) + 3, name: 'Nuevo rango' }] }))}>+ Agregar rango</button></div>
      </div>

      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar parámetros'}</button>
      </div>
    </form>
  );
}

export default function AdminParameters() {
  const { data, loading, error, reload } = useAsync(() => getParams(), []);
  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  return <Form initial={data} />;
}

import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { getCatalog } from '../services/catalog.js';
import { flagQuestion, listAllQuestions, questionAccuracy, saveQuestion, setQuestionActive, validateQuestion } from '../services/questionService.js';
import { DIFFICULTIES, DIFFICULTY_LABEL } from '../data/defaults.js';
import { Badge, ConfirmDialog, EmptyState, ErrorState, Field, Loading, Modal, Pager } from '../components/Ui.jsx';

const PAGE = 25;
const LETTERS = ['A', 'B', 'C', 'D'];

function QuestionForm({ initial, catalog, all, onSave, onClose }) {
  const blank = { categoryId: '', topicId: '', difficulty: 'media', question: '', options: ['', '', '', ''], correctAnswer: null, explanation: '', active: true };
  const [f, setF] = useState(() => {
    if (!initial) return blank;
    const options = [...initial.options];
    while (options.length < 4) options.push('');
    return { ...initial, options };
  });
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const topics = catalog.topics.filter((t) => t.categoryId === f.categoryId);
  const setOpt = (i, v) => setF({ ...f, options: f.options.map((o, k) => (k === i ? v : o)) });

  const submit = async (e) => {
    e.preventDefault();
    const er = validateQuestion(f, all);
    setErrs(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    await onSave({ ...f, _before: initial ? { question: initial.question, options: initial.options, correctAnswer: initial.correctAnswer, active: initial.active, difficulty: initial.difficulty } : null });
    setBusy(false);
  };

  return (
    <Modal title={initial ? 'Editar pregunta' : 'Nueva pregunta'} onClose={onClose} big>
      <form className="stack" onSubmit={submit} noValidate>
        <div className="form-grid cols2">
          <Field label="Categoría" htmlFor="qcat" error={errs.categoryId}>
            <select id="qcat" className="select" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value, topicId: '' })}>
              <option value="">Selecciona…</option>{catalog.categories.map((c) => <option key={c.id} value={c.id}>{c.name}{c.active ? '' : ' (inactiva)'}</option>)}
            </select>
          </Field>
          <Field label="Tema" htmlFor="qtopic" error={errs.topicId}>
            <select id="qtopic" className="select" value={f.topicId} disabled={!f.categoryId} onChange={(e) => setF({ ...f, topicId: e.target.value })}>
              <option value="">Selecciona…</option>{topics.map((t) => <option key={t.id} value={t.id}>{t.name}{t.active ? '' : ' (inactivo)'}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Pregunta" htmlFor="qtext" error={errs.question}>
          <textarea id="qtext" className="textarea" value={f.question} onChange={(e) => setF({ ...f, question: e.target.value })} />
        </Field>
        <fieldset style={{ border: 'none' }} className="stack-sm">
          <legend className="label" style={{ marginBottom: 8 }}>Opciones (marca la correcta)</legend>
          {f.options.map((o, i) => (
            <div className="row gap10" key={i}>
              <input type="radio" name="correct" id={`co${i}`} checked={f.correctAnswer === i} onChange={() => setF({ ...f, correctAnswer: i })} style={{ width: 20, height: 20, accentColor: 'var(--teal)' }} aria-label={`Marcar opción ${LETTERS[i]} como correcta`} />
              <input className="input" aria-label={`Opción ${LETTERS[i]}`} placeholder={`Opción ${LETTERS[i]}${i < 2 ? '' : ' (opcional)'}`} value={o} onChange={(e) => setOpt(i, e.target.value)} />
            </div>
          ))}
          {errs.options && <span className="field-error" role="alert">{errs.options}</span>}
          {errs.correctAnswer && <span className="field-error" role="alert">{errs.correctAnswer}</span>}
        </fieldset>
        <Field label="Explicación (se muestra tras responder)" htmlFor="qexp">
          <textarea id="qexp" className="textarea" value={f.explanation} onChange={(e) => setF({ ...f, explanation: e.target.value })} />
        </Field>
        <div className="form-grid cols2">
          <Field label="Dificultad" htmlFor="qdiff">
            <select id="qdiff" className="select" value={f.difficulty} onChange={(e) => setF({ ...f, difficulty: e.target.value })}>{DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFFICULTY_LABEL[d]}</option>)}</select>
          </Field>
          <label className="check" style={{ alignSelf: 'end' }}><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />Activa</label>
        </div>
        <div className="row gap10" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar pregunta'}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function AdminQuestions() {
  const { profile } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(async () => {
    const [questions, catalog] = await Promise.all([listAllQuestions(), getCatalog(true)]);
    return { questions, catalog };
  }, []);
  const [f, setF] = useState({ q: '', cat: '', topic: '', diff: '', state: '', problem: false, sort: 'recent' });
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState(undefined); // undefined = cerrado, null = nueva, objeto = editar
  const [confirm, setConfirm] = useState(null);

  const rows = useMemo(() => {
    if (!data) return [];
    const s = f.q.trim().toLowerCase();
    let r = data.questions.filter((q) => (
      (!s || q.question.toLowerCase().includes(s)) &&
      (!f.cat || q.categoryId === f.cat) && (!f.topic || q.topicId === f.topic) && (!f.diff || q.difficulty === f.diff) &&
      (!f.state || (f.state === 'active' ? q.active : !q.active)) && (!f.problem || flagQuestion(q))
    ));
    const acc = (q) => questionAccuracy(q) ?? 101;
    const sorters = {
      recent: (a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0),
      accuracy: (a, b) => acc(a) - acc(b),
      shown: (a, b) => (b.timesShown || 0) - (a.timesShown || 0),
      alpha: (a, b) => a.question.localeCompare(b.question),
    };
    return r.sort(sorters[f.sort]);
  }, [data, f]);

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const { catalog, questions } = data;
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const view = rows.slice((page - 1) * PAGE, page * PAGE);
  const flagged = questions.filter((q) => flagQuestion(q)).length;
  const set = (k, v) => { setF({ ...f, [k]: v }); setPage(1); };

  const save = async (q) => {
    try { await saveQuestion(q, profile); toast.success('Pregunta guardada'); setEdit(undefined); reload(); } catch (e) { console.error(e); toast.error('No se pudo guardar: ' + (e.message || '')); }
  };
  const toggle = async (q) => {
    try { await setQuestionActive(q, !q.active, profile); toast.success(q.active ? 'Pregunta desactivada (conserva su histórico)' : 'Pregunta activada'); reload(); } catch (e) { console.error(e); toast.error('No se pudo cambiar'); }
    setConfirm(null);
  };

  return (
    <div className="fade-in">
      <div className="toolbar">
        <input className="input" type="search" placeholder="Buscar en el texto…" aria-label="Buscar pregunta" value={f.q} onChange={(e) => set('q', e.target.value)} style={{ flex: '2 1 220px' }} />
        <select className="select" aria-label="Categoría" value={f.cat} onChange={(e) => setF({ ...f, cat: e.target.value, topic: '' })}><option value="">Categoría</option>{catalog.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select className="select" aria-label="Tema" value={f.topic} onChange={(e) => set('topic', e.target.value)}><option value="">Tema</option>{catalog.topics.filter((t) => !f.cat || t.categoryId === f.cat).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        <select className="select" aria-label="Dificultad" value={f.diff} onChange={(e) => set('diff', e.target.value)}><option value="">Dificultad</option>{DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFFICULTY_LABEL[d]}</option>)}</select>
        <select className="select" aria-label="Estado" value={f.state} onChange={(e) => set('state', e.target.value)}><option value="">Estado</option><option value="active">Activas</option><option value="inactive">Inactivas</option></select>
        <select className="select" aria-label="Ordenar" value={f.sort} onChange={(e) => set('sort', e.target.value)}>
          <option value="recent">Más recientes</option><option value="accuracy">Menor % de aciertos</option><option value="shown">Más mostradas</option><option value="alpha">A–Z</option>
        </select>
        <label className="check"><input type="checkbox" checked={f.problem} onChange={(e) => set('problem', e.target.checked)} />Solo problemáticas ({flagged})</label>
        <button className="btn btn-primary" onClick={() => setEdit(null)}>+ Nueva pregunta</button>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon="❓" title={questions.length ? 'Sin resultados' : 'Aún no hay preguntas'} text={questions.length ? 'Prueba con otros filtros.' : 'Crea la primera, impórtalas desde CSV/Excel o carga los datos iniciales desde el Dashboard.'} />
      ) : (
        <>
          <p className="small muted" style={{ marginBottom: 8 }}>{rows.length} pregunta{rows.length === 1 ? '' : 's'}</p>
          <div className="table-wrap">
            <table className="tbl" style={{ minWidth: 900 }}>
              <thead><tr><th>Pregunta</th><th>Categoría / Tema</th><th>Dif.</th><th>Estado</th><th className="num">Mostrada</th><th className="num">% aciertos</th><th /></tr></thead>
              <tbody>
                {view.map((q) => {
                  const flag = flagQuestion(q);
                  const acc = questionAccuracy(q);
                  return (
                    <tr key={q.id}>
                      <td className="q" title={q.question}>
                        {q.question}
                        {flag && <div className="progress-warn">⚠️ Pregunta potencialmente problemática: {flag}</div>}
                        {q.provisional && <Badge tone="warn">Provisional</Badge>}
                      </td>
                      <td><div className="small">{catalog.catMap[q.categoryId]?.name || '—'}</div><div className="li-sub">{catalog.topicMap[q.topicId]?.name || '—'}</div></td>
                      <td>{DIFFICULTY_LABEL[q.difficulty] || q.difficulty}</td>
                      <td><Badge tone={q.active ? 'ok' : 'bad'}>{q.active ? 'Activa' : 'Inactiva'}</Badge></td>
                      <td className="num">{q.timesShown || 0}</td>
                      <td className="num">{acc === null ? '—' : `${acc}%`}</td>
                      <td><div className="row gap8">
                        <button className="btn btn-sm" onClick={() => setEdit(q)}>Editar</button>
                        <button className={`btn btn-sm ${q.active ? 'btn-danger' : ''}`} onClick={() => (q.active ? setConfirm(q) : toggle(q))}>{q.active ? 'Desactivar' : 'Activar'}</button>
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pager page={page} pages={pages} onPage={setPage} />
        </>
      )}
      <p className="small muted" style={{ marginTop: 10 }}>Las preguntas nunca se eliminan: se desactivan para conservar el histórico de respuestas.</p>

      {edit !== undefined && <QuestionForm initial={edit} catalog={catalog} all={questions} onSave={save} onClose={() => setEdit(undefined)} />}
      {confirm && <ConfirmDialog title="Desactivar pregunta" message="Dejará de aparecer en nuevas partidas. Las respuestas ya registradas se conservan." confirmLabel="Desactivar" danger onConfirm={() => toggle(confirm)} onCancel={() => setConfirm(null)} />}
    </div>
  );
}

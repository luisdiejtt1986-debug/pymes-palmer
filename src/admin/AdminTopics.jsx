import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useParams2 } from '../context/ParamsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { listCategories } from '../services/categoryService.js';
import { listTopics, saveTopic, setTopicActive, swapTopicOrder } from '../services/topicService.js';
import { listAllQuestions } from '../services/questionService.js';
import { DIFFICULTIES, DIFFICULTY_LABEL } from '../data/defaults.js';
import { Badge, ConfirmDialog, EmptyState, ErrorState, Field, Loading, Modal } from '../components/Ui.jsx';

function TopicForm({ initial, categories, defaultCategory, nextOrder, onSave, onClose }) {
  const [f, setF] = useState({ name: '', description: '', icon: '📘', difficulty: 'media', active: true, categoryId: defaultCategory || categories[0]?.id || '', order: nextOrder, ...initial });
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    const er = {};
    if (!f.name.trim()) er.name = 'El nombre es obligatorio';
    if (!f.categoryId) er.categoryId = 'Selecciona una categoría';
    setErrs(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    await onSave({ ...f, _before: initial });
    setBusy(false);
  };
  return (
    <Modal title={initial?.id ? 'Editar tema' : 'Nuevo tema'} onClose={onClose}>
      <form className="stack" onSubmit={submit} noValidate>
        <Field label="Categoría" htmlFor="tcat" error={errs.categoryId}>
          <select id="tcat" className="select" value={f.categoryId} onChange={set('categoryId')}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </Field>
        <Field label="Nombre" htmlFor="tname" error={errs.name}><input id="tname" className="input" value={f.name} onChange={set('name')} autoFocus /></Field>
        <Field label="Descripción" htmlFor="tdesc"><textarea id="tdesc" className="textarea" value={f.description} onChange={set('description')} /></Field>
        <div className="form-grid cols2">
          <Field label="Icono (emoji)" htmlFor="ticon"><input id="ticon" className="input" value={f.icon} onChange={set('icon')} maxLength={4} /></Field>
          <Field label="Dificultad base" htmlFor="tdiff">
            <select id="tdiff" className="select" value={f.difficulty} onChange={set('difficulty')}>{DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFFICULTY_LABEL[d]}</option>)}</select>
          </Field>
        </div>
        <label className="check"><input type="checkbox" checked={f.active} onChange={set('active')} />Activo (visible para los jugadores)</label>
        <div className="row gap10" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function AdminTopics() {
  const { profile } = useAuth();
  const { params } = useParams2();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(async () => {
    const [cats, topics, questions] = await Promise.all([listCategories(), listTopics(), listAllQuestions()]);
    const counts = {};
    questions.forEach((q) => { if (q.active) counts[q.topicId] = (counts[q.topicId] || 0) + 1; });
    return { cats, topics, counts };
  }, []);
  const [catFilter, setCatFilter] = useState('');
  const [edit, setEdit] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const topics = useMemo(() => (data?.topics || []).filter((t) => !catFilter || t.categoryId === catFilter).sort((a, b) => a.categoryId.localeCompare(b.categoryId) || a.order - b.order), [data, catFilter]);

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const catName = Object.fromEntries(data.cats.map((c) => [c.id, c.name]));
  const target = params.questionsAvailablePerTopic;

  const save = async (t) => {
    try { await saveTopic(t, profile); toast.success('Tema guardado'); setEdit(null); reload(); } catch (e) { console.error(e); toast.error('No se pudo guardar'); }
  };
  const toggle = async (t) => {
    try { await setTopicActive(t, !t.active, profile); toast.success(t.active ? 'Tema desactivado' : 'Tema activado'); reload(); } catch (e) { console.error(e); toast.error('No se pudo cambiar'); }
    setConfirm(null);
  };
  const move = async (t, dir) => {
    const siblings = data.topics.filter((x) => x.categoryId === t.categoryId).sort((a, b) => a.order - b.order);
    const i = siblings.findIndex((x) => x.id === t.id);
    const other = siblings[i + dir];
    if (!other) return;
    try { await swapTopicOrder(t, other); reload(); } catch (e) { console.error(e); toast.error('No se pudo reordenar'); }
  };

  return (
    <div className="fade-in">
      <div className="toolbar">
        <select className="select" aria-label="Filtrar por categoría" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
          <option value="">Todas las categorías</option>{data.cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <span className="spacer" />
        <button className="btn btn-primary" disabled={!data.cats.length} onClick={() => setEdit({})}>+ Nuevo tema</button>
      </div>
      {topics.length === 0 ? <EmptyState icon="🏷️" title="No hay temas" text={data.cats.length ? 'Crea el primer tema de esta categoría.' : 'Primero crea una categoría.'} /> : (
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Orden</th><th>Tema</th><th>Categoría</th><th>Banco de preguntas activas</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {topics.map((t) => {
                const n = data.counts[t.id] || 0;
                const short = n < target;
                return (
                  <tr key={t.id}>
                    <td><div className="row gap8">
                      <button className="btn btn-sm" aria-label="Subir" onClick={() => move(t, -1)}>↑</button>
                      <button className="btn btn-sm" aria-label="Bajar" onClick={() => move(t, 1)}>↓</button>
                    </div></td>
                    <td>{t.icon} <b>{t.name}</b>{t.provisional && <> <Badge tone="warn">Provisional</Badge></>}</td>
                    <td>{catName[t.categoryId] || '—'}</td>
                    <td>
                      <b className="mono">{n} / {target}</b>
                      {short && <div className="progress-warn">⚠️ Este tema todavía no tiene suficientes preguntas para una partida estándar.</div>}
                    </td>
                    <td><Badge tone={t.active ? 'ok' : 'bad'}>{t.active ? 'Activo' : 'Inactivo'}</Badge></td>
                    <td><div className="row gap8">
                      <button className="btn btn-sm" onClick={() => setEdit(t)}>Editar</button>
                      <button className={`btn btn-sm ${t.active ? 'btn-danger' : ''}`} onClick={() => (t.active ? setConfirm(t) : toggle(t))}>{t.active ? 'Desactivar' : 'Activar'}</button>
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="small muted" style={{ marginTop: 10 }}>
        El banco recomendado es de {target} preguntas por tema (parámetro <code>questionsAvailablePerTopic</code>); es solo una advertencia, nunca bloquea el juego. Los temas se desactivan, no se eliminan.
      </p>
      {edit && <TopicForm initial={edit.id ? edit : null} categories={data.cats} defaultCategory={catFilter} nextOrder={(Math.max(0, ...data.topics.map((t) => t.order || 0))) + 1} onSave={save} onClose={() => setEdit(null)} />}
      {confirm && <ConfirmDialog title="Desactivar tema" message={`"${confirm.name}" dejará de mostrarse a los jugadores. Las preguntas y el historial se conservan.`} confirmLabel="Desactivar" danger onConfirm={() => toggle(confirm)} onCancel={() => setConfirm(null)} />}
    </div>
  );
}

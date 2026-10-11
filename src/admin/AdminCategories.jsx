import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { listCategories, saveCategory, setCategoryActive, swapCategoryOrder } from '../services/categoryService.js';
import { listTopics } from '../services/topicService.js';
import { Badge, ConfirmDialog, EmptyState, ErrorState, Field, Loading, Modal } from '../components/Ui.jsx';

const EMPTY = { name: '', description: '', icon: '📘', color: '#7c6cf6', active: true };

function CategoryForm({ initial, nextOrder, onSave, onClose }) {
  const [f, setF] = useState({ ...EMPTY, order: nextOrder, ...initial });
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    const er = {};
    if (!f.name.trim()) er.name = 'El nombre es obligatorio';
    setErrs(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    await onSave({ ...f, _before: initial });
    setBusy(false);
  };
  return (
    <Modal title={initial?.id ? 'Editar categoría' : 'Nueva categoría'} onClose={onClose}>
      <form className="stack" onSubmit={submit} noValidate>
        <Field label="Nombre" htmlFor="cname" error={errs.name}><input id="cname" className="input" value={f.name} onChange={set('name')} autoFocus /></Field>
        <Field label="Descripción" htmlFor="cdesc"><textarea id="cdesc" className="textarea" value={f.description} onChange={set('description')} /></Field>
        <div className="form-grid cols2">
          <Field label="Icono (emoji)" htmlFor="cicon"><input id="cicon" className="input" value={f.icon} onChange={set('icon')} maxLength={4} /></Field>
          <Field label="Color" htmlFor="ccolor"><input id="ccolor" className="input" type="color" value={f.color} onChange={set('color')} style={{ padding: 4 }} /></Field>
        </div>
        <label className="check"><input type="checkbox" checked={f.active} onChange={set('active')} />Activa (visible para los jugadores)</label>
        <div className="row gap10" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function AdminCategories() {
  const { profile } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(async () => {
    const [cats, topics] = await Promise.all([listCategories(), listTopics()]);
    return { cats, topics };
  }, []);
  const [edit, setEdit] = useState(null);
  const [confirm, setConfirm] = useState(null);

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const { cats, topics } = data;

  const save = async (c) => {
    try { await saveCategory(c, profile); toast.success('Categoría guardada'); setEdit(null); reload(); } catch (e) { console.error(e); toast.error('No se pudo guardar'); }
  };
  const toggle = async (c) => {
    try { await setCategoryActive(c, !c.active, profile); toast.success(c.active ? 'Categoría desactivada' : 'Categoría activada'); reload(); } catch (e) { console.error(e); toast.error('No se pudo cambiar'); }
    setConfirm(null);
  };
  const move = async (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= cats.length) return;
    try { await swapCategoryOrder(cats[i], cats[j]); reload(); } catch (e) { console.error(e); toast.error('No se pudo reordenar'); }
  };

  return (
    <div className="fade-in">
      <div className="toolbar"><span className="spacer" /><button className="btn btn-primary" onClick={() => setEdit({})}>+ Nueva categoría</button></div>
      {cats.length === 0 ? <EmptyState icon="🗂️" title="Aún no hay categorías" text="Crea la primera o carga los datos iniciales desde el Dashboard." /> : (
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Orden</th><th>Categoría</th><th>Descripción</th><th className="num">Temas</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {cats.map((c, i) => (
                <tr key={c.id}>
                  <td><div className="row gap8">
                    <button className="btn btn-sm" aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                    <button className="btn btn-sm" aria-label="Bajar" disabled={i === cats.length - 1} onClick={() => move(i, 1)}>↓</button>
                  </div></td>
                  <td><span className="color-dot" style={{ background: c.color }} /> {c.icon} <b>{c.name}</b></td>
                  <td className="q" title={c.description}>{c.description}</td>
                  <td className="num">{topics.filter((t) => t.categoryId === c.id).length}</td>
                  <td><Badge tone={c.active ? 'ok' : 'bad'}>{c.active ? 'Activa' : 'Inactiva'}</Badge></td>
                  <td><div className="row gap8">
                    <button className="btn btn-sm" onClick={() => setEdit(c)}>Editar</button>
                    <button className={`btn btn-sm ${c.active ? 'btn-danger' : ''}`} onClick={() => (c.active ? setConfirm(c) : toggle(c))}>{c.active ? 'Desactivar' : 'Activar'}</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="small muted" style={{ marginTop: 10 }}>Las categorías no se eliminan: se desactivan para conservar el histórico de partidas.</p>
      {edit && <CategoryForm initial={edit.id ? edit : null} nextOrder={(cats.at(-1)?.order || 0) + 1} onSave={save} onClose={() => setEdit(null)} />}
      {confirm && <ConfirmDialog title="Desactivar categoría" message={`"${confirm.name}" dejará de mostrarse a los jugadores. Sus temas, preguntas e historial se conservan.`} confirmLabel="Desactivar" danger onConfirm={() => toggle(confirm)} onCancel={() => setConfirm(null)} />}
    </div>
  );
}

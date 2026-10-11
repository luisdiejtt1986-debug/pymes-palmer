import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { listAchievements, saveAchievement, setAchievementActive } from '../services/achievementService.js';
import { ACHIEVEMENT_METRICS } from '../data/defaults.js';
import { Badge, EmptyState, ErrorState, Field, Loading, Modal } from '../components/Ui.jsx';

function AchievementForm({ initial, onSave, onClose }) {
  const [f, setF] = useState({ name: '', icon: '🏅', description: '', metric: 'gamesPlayed', threshold: 1, minAnswered: 50, active: true, ...initial });
  const [errs, setErrs] = useState({});
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = (e) => {
    e.preventDefault();
    const er = {};
    if (!f.name.trim()) er.name = 'Obligatorio';
    if (!(Number(f.threshold) > 0)) er.threshold = 'Debe ser mayor que 0';
    setErrs(er);
    if (!Object.keys(er).length) onSave(f);
  };
  return (
    <Modal title={initial?.id ? 'Editar logro' : 'Nuevo logro'} onClose={onClose}>
      <form className="stack" onSubmit={submit} noValidate>
        <div className="form-grid cols2">
          <Field label="Nombre" htmlFor="aname" error={errs.name}><input id="aname" className="input" value={f.name} onChange={set('name')} autoFocus /></Field>
          <Field label="Icono (emoji)" htmlFor="aicon"><input id="aicon" className="input" value={f.icon} onChange={set('icon')} maxLength={4} /></Field>
        </div>
        <Field label="Descripción" htmlFor="adesc"><input id="adesc" className="input" value={f.description} onChange={set('description')} /></Field>
        <div className="form-grid cols2">
          <Field label="Métrica" htmlFor="ametric">
            <select id="ametric" className="select" value={f.metric} onChange={set('metric')}>{ACHIEVEMENT_METRICS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select>
          </Field>
          <Field label="Valor necesario" htmlFor="athr" error={errs.threshold}><input id="athr" className="input" type="number" min="1" value={f.threshold} onChange={set('threshold')} /></Field>
        </div>
        {f.metric === 'accuracy' && <Field label="Mínimo de respuestas" htmlFor="amin" hint="Evita premiar 100 % con 2 respuestas"><input id="amin" className="input" type="number" min="1" value={f.minAnswered} onChange={set('minAnswered')} /></Field>}
        <label className="check"><input type="checkbox" checked={f.active} onChange={set('active')} />Activo</label>
        <div className="row gap10" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary">Guardar</button></div>
      </form>
    </Modal>
  );
}

export default function AdminAchievements() {
  const { profile } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => listAchievements(), []);
  const [edit, setEdit] = useState(undefined);

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const save = async (a) => {
    try { await saveAchievement(a, profile); toast.success('Logro guardado'); setEdit(undefined); reload(); } catch (e) { console.error(e); toast.error('No se pudo guardar'); }
  };
  const toggle = async (a) => {
    try { await setAchievementActive(a, !a.active, profile); reload(); } catch (e) { console.error(e); toast.error('No se pudo cambiar'); }
  };
  const metricLabel = (m) => ACHIEVEMENT_METRICS.find((x) => x.value === m)?.label || m;

  return (
    <div className="fade-in">
      <div className="toolbar"><span className="spacer" /><button className="btn btn-primary" onClick={() => setEdit(null)}>+ Nuevo logro</button></div>
      {data.length === 0 ? <EmptyState icon="🎖️" title="Aún no hay logros" text="Carga los datos iniciales desde el Dashboard o crea uno." /> : (
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Logro</th><th>Condición</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {data.map((a) => (
                <tr key={a.id}>
                  <td>{a.icon} <b>{a.name}</b><div className="li-sub">{a.description}</div></td>
                  <td>{metricLabel(a.metric)} ≥ <b className="mono">{a.threshold}</b></td>
                  <td><Badge tone={a.active !== false ? 'ok' : 'bad'}>{a.active !== false ? 'Activo' : 'Inactivo'}</Badge></td>
                  <td><div className="row gap8"><button className="btn btn-sm" onClick={() => setEdit(a)}>Editar</button><button className="btn btn-sm" onClick={() => toggle(a)}>{a.active !== false ? 'Desactivar' : 'Activar'}</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="small muted" style={{ marginTop: 10 }}>Los logros se evalúan al terminar cada partida. Un logro nuevo se otorga a quien ya cumpla la condición en su próxima partida.</p>
      {edit !== undefined && <AchievementForm initial={edit} onSave={save} onClose={() => setEdit(undefined)} />}
    </div>
  );
}

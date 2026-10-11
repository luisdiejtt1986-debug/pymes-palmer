import { useMemo, useState } from 'react';
import { useAsync } from '../hooks/useAsync.js';
import { listAudit } from '../services/auditService.js';
import { Badge, EmptyState, ErrorState, Loading, Pager } from '../components/Ui.jsx';
import { fmtDate } from '../utils/game.js';

const TONE = { CREATE: 'ok', UPDATE: 'good', ENABLE: 'ok', DISABLE: 'warn', DELETE: 'bad', PARAMETER_CHANGE: 'warn', IMPORT: 'good' };
const PAGE = 25;
const short = (v) => {
  if (v === null || v === undefined) return '—';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return s.length > 160 ? `${s.slice(0, 160)}…` : s;
};

export default function AdminAudit() {
  const { data, loading, error, reload } = useAsync(() => listAudit(300), []);
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [page, setPage] = useState(1);

  const rows = useMemo(() => (data || []).filter((r) => (!action || r.action === action) && (!entity || r.entity === entity)), [data, action, entity]);
  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const entities = Array.from(new Set(data.map((r) => r.entity)));

  return (
    <div className="fade-in">
      <div className="toolbar">
        <select className="select" aria-label="Acción" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
          <option value="">Todas las acciones</option>{Object.keys(TONE).map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className="select" aria-label="Entidad" value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }}>
          <option value="">Todas las entidades</option>{entities.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <button className="btn btn-sm" onClick={reload}>↻ Actualizar</button>
      </div>
      {rows.length === 0 ? <EmptyState icon="🧾" title="Sin registros de auditoría" text="Cada cambio administrativo quedará registrado aquí." /> : (
        <>
          <div className="table-wrap">
            <table className="tbl" style={{ minWidth: 900 }}>
              <thead><tr><th>Fecha</th><th>Administrador</th><th>Acción</th><th>Entidad</th><th>Antes</th><th>Después</th></tr></thead>
              <tbody>
                {rows.slice((page - 1) * PAGE, page * PAGE).map((r) => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.createdAt)}</td>
                    <td>{r.userName}</td>
                    <td><Badge tone={TONE[r.action] || ''}>{r.action}</Badge></td>
                    <td><b>{r.entity}</b><div className="li-sub mono">{r.entityId}</div></td>
                    <td className="small" style={{ maxWidth: 240, wordBreak: 'break-word' }}>{short(r.before)}</td>
                    <td className="small" style={{ maxWidth: 240, wordBreak: 'break-word' }}>{short(r.after)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} pages={pages} onPage={setPage} />
        </>
      )}
    </div>
  );
}

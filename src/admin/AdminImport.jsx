import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { getCatalog } from '../services/catalog.js';
import { listAllQuestions, bulkCreateQuestions } from '../services/questionService.js';
import { saveCategory } from '../services/categoryService.js';
import { saveTopic } from '../services/topicService.js';
import { parseCSV, rowsToObjects, toCSV, downloadBlob } from '../utils/csv.js';
import { IMPORT_COLUMNS, IMPORT_TEMPLATE_ROWS, normText, validateImportRows } from '../utils/importValidation.js';
import { Badge, ConfirmDialog, Kpi, Loading } from '../components/Ui.jsx';

const STATUS = { valid: ['ok', 'Válida'], error: ['bad', 'Error'], duplicate: ['warn', 'Duplicada'] };

export default function AdminImport() {
  const { profile } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [fileName, setFileName] = useState('');
  const [createMissing, setCreateMissing] = useState(false);
  const [raw, setRaw] = useState(null);
  const [ctx, setCtx] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [filter, setFilter] = useState('');

  const validate = (objects, c, cm) => validateImportRows(objects, { categories: c.catalog.categories, topics: c.catalog.topics, existing: c.existing, createMissing: cm });

  const onFile = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      let objects;
      if (/\.xlsx?$/i.test(file.name)) {
        const XLSX = await import('xlsx');
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        objects = rowsToObjects(XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false }));
      } else {
        objects = rowsToObjects(parseCSV(await file.text()));
      }
      if (!objects.length) { toast.error('El archivo no tiene filas de datos.'); setBusy(false); return; }
      const headers = Object.keys(objects[0]);
      const missing = ['categoria', 'tema', 'pregunta', 'respuesta_correcta'].filter((h) => !headers.includes(h));
      if (missing.length) { toast.error(`Faltan columnas obligatorias: ${missing.join(', ')}`); setBusy(false); return; }
      const [catalog, existing] = await Promise.all([getCatalog(true), listAllQuestions()]);
      const c = { catalog, existing };
      setCtx(c); setRaw(objects); setFileName(file.name);
      setRows(validate(objects, c, createMissing));
    } catch (e) { console.error(e); toast.error('No se pudo leer el archivo: ' + (e.message || '')); }
    setBusy(false);
  };

  const toggleCreate = (v) => {
    setCreateMissing(v);
    if (raw && ctx) setRows(validate(raw, ctx, v));
  };

  const counts = useMemo(() => {
    const c = { total: 0, valid: 0, error: 0, duplicate: 0 };
    (rows || []).forEach((r) => { c.total++; c[r.status]++; });
    return c;
  }, [rows]);

  const doImport = async () => {
    setConfirm(false);
    setBusy(true);
    try {
      const good = rows.filter((r) => r.status === 'valid').map((r) => ({ ...r.data }));
      // Crear categorías/temas que falten (solo si se marcó la opción)
      const catIds = Object.fromEntries(ctx.catalog.categories.map((c) => [normText(c.name), c.id]));
      const topicIds = Object.fromEntries(ctx.catalog.topics.map((t) => [`${t.categoryId}|${normText(t.name)}`, t.id]));
      for (const g of good) {
        let cid = g.categoryId || catIds[normText(g.categoryName)];
        if (!cid) {
          cid = await saveCategory({ name: g.categoryName, order: Object.keys(catIds).length + 1, active: true }, profile);
          catIds[normText(g.categoryName)] = cid;
        }
        const tk = `${cid}|${normText(g.topicName)}`;
        let tid = g.topicId || topicIds[tk];
        if (!tid) {
          tid = await saveTopic({ name: g.topicName, categoryId: cid, order: Object.keys(topicIds).length + 1, active: true }, profile);
          topicIds[tk] = tid;
        }
        g.categoryId = cid;
        g.topicId = tid;
      }
      const n = await bulkCreateQuestions(good, profile);
      toast.success(`${n} pregunta${n === 1 ? '' : 's'} importada${n === 1 ? '' : 's'}.`);
      setRows(null); setRaw(null); setFileName('');
    } catch (e) { console.error(e); toast.error('Error al importar: ' + (e.message || '')); }
    setBusy(false);
  };

  const template = () => downloadBlob(toCSV(IMPORT_TEMPLATE_ROWS, IMPORT_COLUMNS), 'plantilla_preguntas.csv', 'text/csv;charset=utf-8');
  const view = (rows || []).filter((r) => !filter || r.status === filter);

  return (
    <div className="stack fade-in">
      <div className="glass pad stack">
        <p className="muted small">
          Columnas: <code>{IMPORT_COLUMNS.join(', ')}</code>. <b>respuesta_correcta</b> acepta A–D, 1–4 o el texto exacto de la opción. <b>dificultad</b>: facil, media o dificil. <b>activo</b>: si/no. Nada se importa hasta que lo confirmes, y las filas inválidas nunca se importan.
        </p>
        <div className="dropzone">
          <input id="file" type="file" accept=".csv,.xlsx,.xls,text/csv" className="sr-only" onChange={(e) => { onFile(e.target.files[0]); e.target.value = ''; }} />
          <label htmlFor="file" className="btn btn-primary" style={{ cursor: 'pointer' }}>📥 Seleccionar archivo CSV / Excel</label>
          {fileName && <p className="small muted" style={{ marginTop: 10 }}>Archivo: <b>{fileName}</b></p>}
        </div>
        <div className="row wrap gap12">
          <label className="check"><input type="checkbox" checked={createMissing} onChange={(e) => toggleCreate(e.target.checked)} />Crear categorías y temas que no existan</label>
          <span className="spacer" />
          <button className="btn btn-sm" onClick={template}>Descargar plantilla CSV</button>
        </div>
      </div>

      {busy && <Loading text="Procesando…" />}

      {rows && !busy && (
        <>
          <div className="grid4">
            <Kpi value={counts.total} label="Total de registros" />
            <Kpi value={counts.valid} label="Registros válidos" />
            <Kpi value={counts.error} label="Con errores" />
            <Kpi value={counts.duplicate} label="Duplicados" />
          </div>
          <div className="toolbar">
            <select className="select" aria-label="Filtrar vista previa" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ flex: '0 1 200px' }}>
              <option value="">Todas las filas</option><option value="valid">Solo válidas</option><option value="error">Solo con errores</option><option value="duplicate">Solo duplicadas</option>
            </select>
            <span className="spacer" />
            <button className="btn btn-primary" disabled={counts.valid === 0} onClick={() => setConfirm(true)}>Importar {counts.valid} válida{counts.valid === 1 ? '' : 's'}</button>
          </div>
          <div className="table-wrap">
            <table className="tbl" style={{ minWidth: 820 }}>
              <thead><tr><th>Fila</th><th>Estado</th><th>Categoría / Tema</th><th>Pregunta</th><th className="num">Opc.</th><th className="num">Corr.</th><th>Observaciones</th></tr></thead>
              <tbody>
                {view.slice(0, 200).map((r) => (
                  <tr key={r.line}>
                    <td className="num">{r.line}</td>
                    <td><Badge tone={STATUS[r.status][0]}>{STATUS[r.status][1]}</Badge></td>
                    <td><div className="small">{r.data.categoryName}</div><div className="li-sub">{r.data.topicName}</div></td>
                    <td className="q" title={r.data.question}>{r.data.question}</td>
                    <td className="num">{r.data.options.length}</td>
                    <td className="num">{r.data.correctAnswer >= 0 ? 'ABCD'[r.data.correctAnswer] : '—'}</td>
                    <td className="small" style={{ color: r.errors.length ? 'var(--coral)' : 'var(--text-2)' }}>{r.errors.join(' · ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {view.length > 200 && <p className="small muted center">Vista previa limitada a 200 filas (se importarán todas las válidas).</p>}
        </>
      )}
      {confirm && <ConfirmDialog title="Importar preguntas" message={`Se crearán ${counts.valid} preguntas. Las ${counts.error + counts.duplicate} filas con errores o duplicadas se omiten.`} confirmLabel="Importar" onConfirm={doImport} onCancel={() => setConfirm(false)} />}
    </div>
  );
}

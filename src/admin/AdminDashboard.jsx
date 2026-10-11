import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { adminDashboard } from '../services/analyticsService.js';
import { seedInitialData } from '../services/seedService.js';
import { ConfirmDialog, ErrorState, Kpi, Loading } from '../components/Ui.jsx';
import { questionAccuracy } from '../services/questionService.js';

export default function AdminDashboard() {
  const { profile } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => adminDashboard(), []);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const seed = async () => {
    setConfirm(false);
    setBusy(true);
    try {
      const n = await seedInitialData(profile);
      toast.success(n ? `Datos iniciales cargados (${n} documentos nuevos).` : 'Todo ya estaba cargado: no se modificó nada.');
      reload();
    } catch (e) { console.error(e); toast.error('No se pudo cargar los datos iniciales: ' + (e.message || e)); }
    setBusy(false);
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const d = data;
  const empty = d.categories === 0 && d.totalQuestions === 0;

  return (
    <div className="stack fade-in">
      {empty && (
        <div className="alert info">
          <span>👋</span>
          <div>
            La base de datos está vacía. Carga los <b>datos iniciales</b>: parámetros, 10 logros, categorías PYMES/PALMER y las 45 preguntas migradas del HTML original (20 de crédito activas; 25 de relleno en una categoría "demo" desactivada).
          </div>
        </div>
      )}
      <div className="grid4">
        <Kpi value={d.players} label="Total jugadores" sub={`${d.activePlayers} activos (30 días)`} />
        <Kpi value={d.totalQuestions} label="Total preguntas" sub={`${d.activeQuestions} activas`} />
        <Kpi value={d.categories} label="Categorías" sub={`${d.topics} temas`} />
        <Kpi value={d.games} label="Partidas" sub={`Precisión media ${d.avgAccuracy}%`} />
      </div>

      <div className="grid2">
        <div className="glass pad">
          <div className="label">Pregunta más difícil</div>
          {d.hardest ? (<><p style={{ margin: '8px 0', fontWeight: 600 }}>{d.hardest.question}</p><span className="badge bad">{questionAccuracy(d.hardest)}% de aciertos · {d.hardest.timesAnswered} respuestas</span></>) : <p className="muted small" style={{ marginTop: 8 }}>Se necesitan al menos 5 respuestas por pregunta.</p>}
        </div>
        <div className="glass pad">
          <div className="label">Pregunta más fácil</div>
          {d.easiest ? (<><p style={{ margin: '8px 0', fontWeight: 600 }}>{d.easiest.question}</p><span className="badge ok">{questionAccuracy(d.easiest)}% de aciertos · {d.easiest.timesAnswered} respuestas</span></>) : <p className="muted small" style={{ marginTop: 8 }}>Se necesitan al menos 5 respuestas por pregunta.</p>}
        </div>
      </div>
      <div className="glass pad">
        <div className="label">Tema con menor dominio</div>
        {d.weakTopic ? <p style={{ marginTop: 8 }}><b>{d.weakTopic.name}</b> — {d.weakTopic.pct}% de aciertos globales</p> : <p className="muted small" style={{ marginTop: 8 }}>Aún no hay suficientes respuestas (mínimo 10 por tema).</p>}
      </div>

      <div className="glass pad stack-sm">
        <div className="label">Datos iniciales</div>
        <p className="muted small">
          Siembra parámetros, logros, categorías, temas y las preguntas migradas del HTML original. Es seguro repetirlo: no sobrescribe lo que ya existe ni lo que hayas editado.
        </p>
        <div><button className="btn btn-primary" disabled={busy} onClick={() => setConfirm(true)}>{busy ? 'Cargando…' : '🌱 Cargar datos iniciales'}</button></div>
      </div>

      {confirm && <ConfirmDialog title="Cargar datos iniciales" message="Se crearán solo los documentos que falten. No se modificará nada existente." confirmLabel="Cargar" onConfirm={seed} onCancel={() => setConfirm(false)} />}
    </div>
  );
}

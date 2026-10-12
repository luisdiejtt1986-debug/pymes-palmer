import { useState } from 'react';
import { useAsync } from '../hooks/useAsync.js';
import { listTrainingFeedbacks } from '../services/userService.js';
import { Avatar, EmptyState, ErrorState, Loading } from '../components/Ui.jsx';
import { fmtDate } from '../utils/game.js';

export default function AdminFeedbacks() {
  const { data: feedbacks, loading, error, reload } = useAsync(() => listTrainingFeedbacks(100), []);
  const [exporting, setExporting] = useState(false);

  if (loading) return <Loading text="Cargando evaluaciones de capacitaciones..." />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!feedbacks || feedbacks.length === 0) {
    return <EmptyState icon="⭐" title="Sin evaluaciones" text="Aún ningún colaborador ha calificado el material de estudio." />;
  }

  const total = feedbacks.length;
  const avgRating = (feedbacks.reduce((acc, f) => acc + (f.rating || 0), 0) / total).toFixed(1);

  // Función para exportar las evaluaciones a Excel (XLSX)
  const exportToExcel = async () => {
    setExporting(true);
    try {
      const XLSX = await import('xlsx');
      
      const dataToExport = feedbacks.map((item, index) => ({
        'N°': index + 1,
        'Colaborador': item.userName,
        'Correo': item.userEmail || '',
        'Calificación (Estrellas)': item.rating,
        'Comentario': item.comment || 'Sin comentario',
        'Fecha y Hora': item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleString() : 'Reciente',
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Evaluaciones');

      XLSX.writeFile(workbook, `evaluaciones_capacitacion_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error('Error al exportar a Excel:', err);
    }
    setExporting(false);
  };

  return (
    <div className="stack fade-in">
      {/* Resumen Promedio y Botón de Exportar */}
      <div className="glass pad row wrap gap12" style={{ alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div className="row gap16" style={{ alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Promedio General de Capacitación</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#ffc107', display: 'flex', alignItems: 'center', gap: 6 }}>
              {avgRating} <span style={{ fontSize: 24 }}>★</span>
            </div>
          </div>
          <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Total Evaluaciones</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{total}</div>
          </div>
        </div>

        <button
          onClick={exportToExcel}
          disabled={exporting}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <span>📊</span> {exporting ? 'Generando Excel...' : 'Exportar a Excel'}
        </button>
      </div>

      {/* Lista detallada de feedbacks */}
      <div className="stack-sm">
        {feedbacks.map((item) => (
          <div key={item.id} className="glass glass-tight list-item" style={{ alignItems: 'flex-start', padding: 14 }}>
            <Avatar avatar={item.userAvatar} name={item.userName} size="sm" />
            <div className="li-main">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <span className="li-title">{item.userName}</span>
                <span className="small muted">{item.createdAt ? fmtDate(item.createdAt) : 'Reciente'}</span>
              </div>
              <div className="small muted" style={{ marginBottom: 6, fontSize: '12px' }}>
                {item.userEmail || 'Sin correo registrado'}
              </div>
              <div style={{ color: '#ffc107', fontSize: 16, marginBottom: 4 }}>
                {'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}
              </div>
              {item.comment ? (
                <p className="small" style={{ margin: 0, fontStyle: 'italic', color: 'var(--text)' }}>
                  "{item.comment}"
                </p>
              ) : (
                <span className="small muted" style={{ fontStyle: 'italic' }}>Sin comentario escrito</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
import { useState } from 'react';
import { useToast } from '../context/ToastContext.jsx';
import { exportDataset } from '../services/exportService.js';

const SETS = [
  ['questions', '❓ Preguntas', 'Banco completo con estadísticas de uso (formato compatible con la importación).'],
  ['users', '👥 Jugadores', 'Perfiles, nivel, XP y estadísticas generales.'],
  ['games', '🎮 Partidas', 'Una fila por partida (hasta 5.000).'],
  ['answers', '✍️ Respuestas', 'Una fila por respuesta (hasta 5.000).'],
  ['stats', '📊 Estadísticas', 'Resumen por jugador del ranking.'],
];

export default function AdminExport() {
  const toast = useToast();
  const [busy, setBusy] = useState('');

  const run = async (kind, format) => {
    setBusy(`${kind}-${format}`);
    try {
      const n = await exportDataset(kind, format);
      toast.success(n ? `${n} registros exportados.` : 'La exportación no tiene registros (archivo vacío).');
    } catch (e) { console.error(e); toast.error('No se pudo exportar: ' + (e.message || '')); }
    setBusy('');
  };

  return (
    <div className="stack fade-in">
      {SETS.map(([k, title, desc]) => (
        <div className="glass pad row wrap gap12" key={k}>
          <div className="li-main"><div className="li-title" style={{ whiteSpace: 'normal' }}>{title}</div><div className="li-sub">{desc}</div></div>
          <div className="row gap8">
            {['csv', 'xlsx', 'json'].map((f) => (
              <button key={f} className="btn btn-sm" disabled={Boolean(busy)} onClick={() => run(k, f)}>{busy === `${k}-${f}` ? '…' : f.toUpperCase()}</button>
            ))}
          </div>
        </div>
      ))}
      <p className="small muted">Los archivos se generan en tu navegador y se descargan directamente; no se almacenan en ningún servidor.</p>
    </div>
  );
}

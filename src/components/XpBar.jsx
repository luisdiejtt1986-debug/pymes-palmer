import { computeLevel } from '../utils/game.js';
import { useParams2 } from '../context/ParamsContext.jsx';

/** Barra de progreso de nivel: nivel actual, XP actual y XP para el siguiente nivel. */
export default function XpBar({ xp }) {
  const { params } = useParams2();
  const lv = computeLevel(xp || 0, params);
  return (
    <div className="xp-block">
      <div className="xp-row">
        <span className="lbl">Nivel {lv.level} · {lv.name}</span>
        <span className="val">{lv.into} / {lv.span} XP</span>
      </div>
      <div className="bar-track" role="progressbar" aria-valuenow={lv.pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progreso al siguiente nivel">
        <div className="bar-fill" style={{ width: `${lv.pct}%` }} />
      </div>
      <div className="xp-row" style={{ marginTop: 6 }}>
        <span className="lbl" style={{ textTransform: 'none' }}>XP total: {xp || 0}</span>
        <span className="val">Siguiente nivel en {Math.max(0, lv.next - (xp || 0))} XP</span>
      </div>
    </div>
  );
}

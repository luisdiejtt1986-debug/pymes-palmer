import { useEffect, useMemo, useState } from 'react';

/** Gráfica de línea simple en SVG (sin dependencias). points: [{ label, value }] */
export function LineChart({ points, max = 100, min = 0, height = 170, unit = '', title = 'Evolución' }) {
  const W = 560;
  const H = height;
  const pad = { l: 34, r: 12, t: 12, b: 24 };
  const geo = useMemo(() => {
    const n = points.length;
    const x = (i) => pad.l + (n === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (n - 1));
    const y = (v) => pad.t + (1 - (v - min) / (max - min || 1)) * (H - pad.t - pad.b);
    const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
    const area = n > 1 ? `${d} L${x(n - 1)},${H - pad.b} L${x(0)},${H - pad.b} Z` : '';
    return { x, y, d, area };
  }, [points, max, min, H]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!points.length) return null;
  const ticks = [min, (min + max) / 2, max];
  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: ${points.map((p) => `${p.label} ${p.value}${unit}`).join(', ')}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="chart-grid" x1={pad.l} x2={W - pad.r} y1={geo.y(t)} y2={geo.y(t)} />
            <text className="chart-label" x={pad.l - 6} y={geo.y(t) + 3} textAnchor="end">{Math.round(t)}{unit}</text>
          </g>
        ))}
        {geo.area && <path className="chart-area" d={geo.area} />}
        <path className="chart-line" d={geo.d} />
        {points.map((p, i) => (
          <g key={i}>
            <circle className="chart-dot" cx={geo.x(i)} cy={geo.y(p.value)} r="4">
              <title>{`${p.label}: ${p.value}${unit}`}</title>
            </circle>
            {(points.length <= 8 || i % Math.ceil(points.length / 8) === 0) && (
              <text className="chart-label" x={geo.x(i)} y={H - 6} textAnchor="middle">{p.label}</text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

/** Lista de barras horizontales. rows: [{ label, value (0-100), right, tone }] */
export function BarList({ rows }) {
  return (
    <div className="bar-list">
      {rows.map((r) => (
        <div className="bl-row" key={r.key || r.label}>
          <div className="bl-head"><span>{r.label}</span><span>{r.right ?? `${r.value}%`}</span></div>
          <div className="bar-track" role="progressbar" aria-valuenow={r.value} aria-valuemin={0} aria-valuemax={100} aria-label={r.label}>
            <div className={`bar-fill ${r.tone || ''}`} style={{ width: `${Math.max(2, Math.min(100, r.value))}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Anillo de resultado (mismos colores del HTML original: dorado 100 %, verde ≥ 50 %, rojo debajo) con animación de entrada. */
export function ScoreRing({ pct, label, sub, color }) {
  const R = 66;
  const C = 2 * Math.PI * R;
  const target = Math.min(100, Math.max(0, pct));
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(target));
    return () => cancelAnimationFrame(raf);
  }, [target]);
  const [num, setNum] = useState(0);
  useEffect(() => {
    let cur = 0;
    const step = Math.max(1, Math.round(target / 30));
    const iv = setInterval(() => {
      cur = Math.min(Math.round(target), cur + step);
      setNum(cur);
      if (cur >= Math.round(target)) clearInterval(iv);
    }, 25);
    return () => clearInterval(iv);
  }, [target]);
  const stroke = color || (target === 100 ? 'var(--gold)' : target >= 50 ? 'var(--teal)' : 'var(--coral)');
  return (
    <div className="score-ring-box" role="img" aria-label={`Resultado: ${Math.round(target)} %`}>
      <svg viewBox="0 0 160 160" aria-hidden="true">
        <circle className="score-ring-bg" cx="80" cy="80" r={R} />
        <circle className="score-ring-fg" cx="80" cy="80" r={R} stroke={stroke} strokeDasharray={C} strokeDashoffset={C - (C * shown) / 100} />
      </svg>
      <div className="score-ring-label">
        <div className="pct">{label ?? `${num}%`}</div>
        {sub && <div className="frac">{sub}</div>}
      </div>
    </div>
  );
}

/** Temporizador circular. Colores como el original: verde → dorado (≤ 48 %) → rojo (≤ 20 %). */
export function TimerRing({ remaining, total }) {
  const R = 31;
  const C = 2 * Math.PI * R;
  const frac = Math.max(0, Math.min(1, remaining / total));
  const low = frac <= 0.2;
  const mid = frac <= 0.48;
  const secs = Math.ceil(remaining);
  return (
    <div className="timer-ring-box" role="timer" aria-label={`${secs} segundos restantes`}>
      <svg viewBox="0 0 74 74" aria-hidden="true">
        <circle className="timer-ring-bg" cx="37" cy="37" r={R} />
        <circle className="timer-ring-fg" cx="37" cy="37" r={R} strokeDasharray={C} strokeDashoffset={C * (1 - frac)} style={{ stroke: low ? 'var(--coral)' : mid ? 'var(--gold)' : 'var(--teal)' }} />
      </svg>
      <div className={`timer-num ${low ? 'low' : ''}`}>{secs}</div>
    </div>
  );
}

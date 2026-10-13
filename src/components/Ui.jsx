import { useEffect, useRef } from 'react';

export function Loading({ text = 'Cargando…' }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}

export function ErrorState({ error, onRetry, text }) {
  const msg = text || error?.message || 'No se pudo cargar la información.';
  const perm = error?.code === 'permission-denied';
  return (
    <div className="empty glass fade-in" role="alert">
      <div className="e-ico">⚠️</div>
      <h3>Algo salió mal</h3>
      <p>{perm ? 'No tienes permiso para ver esta información (o falta desplegar las reglas/índices de Firestore).' : msg}</p>
      {error?.code === 'failed-precondition' && (
        <p className="small">Falta un índice de Firestore. Ejecuta <code>firebase deploy --only firestore:indexes</code>.</p>
      )}
      {onRetry && <button className="btn" onClick={onRetry}>Reintentar</button>}
    </div>
  );
}

export function EmptyState({ icon = '🏔️', title, text, action }) {
  return (
    <div className="empty glass fade-in">
      <div className="e-ico" aria-hidden="true">{icon}</div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function Avatar({ avatar, name = '', size = '' }) {
  const initials = (name || '?').trim().split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('');
  
  // Si tenemos una foto válida en base64 (o URL), mostramos la imagen dentro del avatar
  if (avatar && avatar.startsWith('data:image')) {
    return (
      <div className={`avatar ${size}`} aria-hidden="true" style={{ padding: 0, overflow: 'hidden' }}>
        <img 
          src={avatar} 
          alt={name || 'Avatar'} 
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
        />
      </div>
    );
  }

  // De lo contrario, mostramos las iniciales estándar del usuario
  return <div className={`avatar ${size}`} aria-hidden="true">{initials}</div>;
}

export function Modal({ title, onClose, children, big = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    ref.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`sheet ${big ? 'big' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="sheet-head">
          <h2 className="sheet-title">{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, message, confirmLabel = 'Confirmar', danger = false, onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="muted" style={{ marginBottom: 18 }}>{message}</p>
      <div className="row gap10" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onCancel}>Cancelar</button>
        <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}

export function Pager({ page, pages, onPage }) {
  if (pages <= 1) return null;
  return (
    <div className="pager">
      <button className="btn btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>← Anterior</button>
      <span>Página {page} de {pages}</span>
      <button className="btn btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Siguiente →</button>
    </div>
  );
}

export function Field({ label, error, hint, children, htmlFor }) {
  return (
    <div className="field">
      {label && <label htmlFor={htmlFor}>{label}</label>}
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error" role="alert">{error}</span>}
    </div>
  );
}

export function Badge({ tone = '', children }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function Kpi({ value, label, sub }) {
  return (
    <div className="glass glass-tight kpi">
      <div className="k-num">{value}</div>
      <div className="k-lbl">{label}</div>
      {sub && <div className="k-sub">{sub}</div>}
    </div>
  );
}
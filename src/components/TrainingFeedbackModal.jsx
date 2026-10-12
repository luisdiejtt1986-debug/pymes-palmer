import { useState } from 'react';
import { submitTrainingFeedback } from '../services/userService.js';

export default function TrainingFeedbackModal({ uid, onClose }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) return;
    setBusy(true);
    try {
      await submitTrainingFeedback(uid, { rating, comment });
      setSubmitted(true);
      setTimeout(() => {
        if (onClose) onClose();
      }, 1800);
    } catch (err) {
      console.error('Error al guardar feedback:', err);
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '16px'
    }}>
      <div className="glass auth-card fade-in" style={{ maxWidth: '420px', width: '100%', padding: '24px', position: 'relative' }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: '12px', right: '16px',
            background: 'none', border: 'none', color: 'var(--muted, #aaa)',
            fontSize: '20px', cursor: 'pointer'
          }}
        >
          ✕
        </button>

        {submitted ? (
          <div className="center" style={{ padding: '20px 0' }}>
            <span style={{ fontSize: '48px', display: 'block', marginBottom: '12px' }}>⭐</span>
            <h3 style={{ color: 'var(--teal, #00d2d3)' }}>¡Gracias por tu opinión!</h3>
            <p className="muted" style={{ fontSize: '14px', marginTop: '6px' }}>
              Tu calificación nos ayuda a seguir mejorando las capacitaciones.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="stack">
            <h2 style={{ fontSize: '20px', marginBottom: '4px' }}>Califica la Capacitación</h2>
            <p className="muted" style={{ fontSize: '13px', marginBottom: '16px' }}>
              ¿Qué tan claro y útil te pareció el material de estudio?
            </p>

            {/* Selector de Estrellas */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', margin: '12px 0 20px' }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHover(star)}
                  onMouseLeave={() => setHover(rating)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '32px',
                    color: star <= (hover || rating) ? '#ffc107' : 'rgba(255, 255, 255, 0.2)',
                    transition: 'transform 0.15s, color 0.15s',
                    transform: star <= (hover || rating) ? 'scale(1.15)' : 'scale(1)',
                    padding: 0
                  }}
                  title={`${star} de 5 estrellas`}
                >
                  ★
                </button>
              ))}
            </div>

            <textarea
              className="input"
              placeholder="Escribe un comentario o sugerencia (opcional)..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows="3"
              style={{ resize: 'none', width: '100%', fontSize: '14px' }}
            />

            <button
              className="cta-main"
              type="submit"
              disabled={rating === 0 || busy}
              style={{ marginTop: '12px', opacity: rating === 0 ? 0.5 : 1 }}
            >
              <span className="shine" />
              {busy ? 'Guardando…' : 'Enviar calificación'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
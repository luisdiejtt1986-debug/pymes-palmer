import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Loading } from './Ui.jsx';
import { logout } from '../services/authService.js';

/** Protege rutas: requiere sesión y cuenta activa. Las Security Rules refuerzan esto en el servidor. */
export function RequireAuth({ children }) {
  const { fbUser, loading, disabled, waitingProfile } = useAuth();
  const loc = useLocation();
  if (loading) return <Loading text="Verificando sesión…" />;
  if (!fbUser) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (waitingProfile) return <Loading text="Preparando tu perfil…" />;
  if (disabled) {
    return (
      <div className="auth-wrap">
        <div className="glass auth-card center">
          <div style={{ fontSize: 44 }}>🚫</div>
          <h1>Cuenta desactivada</h1>
          <p className="muted" style={{ margin: '10px 0 18px' }}>Tu cuenta fue desactivada por un administrador. Contacta al equipo responsable.</p>
          <button className="btn" onClick={() => logout()}>Cerrar sesión</button>
        </div>
      </div>
    );
  }
  return children;
}

/** Solo administradores. Un jugador es redirigido al inicio (y las reglas de Firestore igualmente le niegan los datos). */
export function RequireAdmin({ children }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

/** Rutas públicas (login/registro): si ya hay sesión, va al inicio. */
export function PublicOnly({ children }) {
  const { fbUser, loading } = useAuth();
  if (loading) return <Loading text="Cargando…" />;
  if (fbUser) return <Navigate to="/dashboard" replace />;
  return children;
}

import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { logout } from '../services/authService.js';
import { ThemeToggle, BrandMark } from './PlayerLayout.jsx';

const ITEMS = [
  { to: '/admin/dashboard', label: 'Dashboard', ico: '📊' },
  { to: '/admin/users', label: 'Jugadores', ico: '👥' },
  { to: '/admin/categories', label: 'Categorías', ico: '🗂️' },
  { to: '/admin/topics', label: 'Temas', ico: '🏷️' },
  { to: '/admin/questions', label: 'Preguntas', ico: '❓' },
  { to: '/admin/games', label: 'Partidas', ico: '🎮' },
  { to: '/admin/live', label: 'Concurso en Vivo', ico: '🚨' }, // <-- ¡Nuevo ítem para gestionar las salas en vivo tipo Buzzer!
  { to: '/admin/ranking', label: 'Ranking', ico: '🏆' },
  { to: '/admin/achievements', label: 'Logros', ico: '🎖️' },
  { to: '/admin/parameters', label: 'Parámetros', ico: '⚙️' },
  { to: '/admin/feedbacks', label: 'Evaluaciones', ico: '⭐' },
  { to: '/admin/import', label: 'Importar preguntas', ico: '📥' },
  { to: '/admin/export', label: 'Exportar datos', ico: '📤' },
  { to: '/admin/audit', label: 'Auditoría', ico: '🧾' },
];

export default function AdminLayout() {
  const [open, setOpen] = useState(false);
  const { profile } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const current = ITEMS.find((i) => loc.pathname.startsWith(i.to));

  return (
    <div className="admin-shell">
      <a href="#admin-main" className="skip-link">Saltar al contenido</a>
      {open && <div className="admin-backdrop" onClick={() => setOpen(false)} />}
      <aside className={`admin-side ${open ? 'open' : ''}`} aria-label="Menú administrativo">
        <div style={{ marginBottom: 18 }}><BrandMark /></div>
        <div className="small muted" style={{ marginBottom: 12 }}>Panel administrativo</div>
        <nav className="stack-sm" onClick={() => setOpen(false)}>
          {ITEMS.map((i) => (
            <NavLink key={i.to} to={i.to} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>
              <span aria-hidden="true">{i.ico}</span>{i.label}
            </NavLink>
          ))}
        </nav>
        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />
        <NavLink to="/dashboard" className="side-link">← Volver al juego</NavLink>
        <button className="side-link" style={{ width: '100%' }} onClick={async () => { await logout(); nav('/login'); }}>🚪 Cerrar sesión</button>
        <div className="small muted" style={{ marginTop: 14, padding: '0 6px' }}>{profile?.name}<br />{profile?.email}</div>
      </aside>
      <div>
        <div className="admin-main" id="admin-main">
          <div className="admin-bar">
            <button className="icon-btn admin-menu-btn" onClick={() => setOpen(true)} aria-label="Abrir menú">☰</button>
            <h1 className="admin-title display">{current?.label || 'Administración'}</h1>
            <span className="spacer" />
            <ThemeToggle />
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { logout } from '../services/authService.js';
import { Avatar } from '../components/Ui.jsx';

const LINKS = [
  { to: '/dashboard', label: 'Inicio', ico: '🏠' },
  { to: '/play', label: 'Jugar', ico: '🎮' },
  { to: '/progress', label: 'Progreso', ico: '📈' },
  { to: '/ranking', label: 'Ranking', ico: '🏆' },
  { to: '/profile', label: 'Perfil', ico: '👤' },
];
const MORE = [
  { to: '/history', label: 'Historial' },
  { to: '/review', label: 'Repasar' },
  { to: '/challenge', label: 'Reto' },
  { to: '/compare', label: 'Comparar' },
];

export function BrandMark() {
  return (
    <div className="brand">
      <div className="brand-mark" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 19L10 6l4 7 3-4 4 10H3z" fill="#fff" /></svg>
      </div>
      <div className="brand-name">JUEGA CON <span>·</span> CODY</div>
    </div>
  );
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button className="icon-btn" onClick={toggle} aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'} title="Cambiar tema">
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}

export default function PlayerLayout() {
  const { profile, isAdmin } = useAuth();
  const nav = useNavigate();
  const [menu, setMenu] = useState(false);

  return (
    <>
      <a href="#main" className="skip-link">Saltar al contenido</a>
      <header className="topbar">
        <NavLink to="/dashboard" aria-label="Ir al inicio"><BrandMark /></NavLink>
        <nav className="nav-links" aria-label="Principal">
          {[...LINKS, ...MORE].map((l) => (
            <NavLink key={l.to} to={l.to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>{l.label}</NavLink>
          ))}
          {isAdmin && <NavLink to="/admin" className="nav-link">⚙️ Admin</NavLink>}
        </nav>
        <div className="row gap8" style={{ position: 'relative' }}>
          <ThemeToggle />
          <button className="icon-btn" aria-label="Menú de usuario" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
            <Avatar avatar={profile?.avatar} name={profile?.name} size="sm" />
          </button>
          {menu && (
            <div className="glass pad" style={{ position: 'absolute', right: 0, top: 48, zIndex: 60, minWidth: 210, background: 'var(--surface-2)' }} onClick={() => setMenu(false)}>
              <div className="stack-sm">
                <div className="li-title">{profile?.name}</div>
                <div className="small muted" style={{ marginBottom: 6 }}>{profile?.email}</div>
                {MORE.map((l) => <NavLink key={l.to} to={l.to} className="side-link">{l.label}</NavLink>)}
                {isAdmin && <NavLink to="/admin" className="side-link">⚙️ Panel administrativo</NavLink>}
                <button className="side-link" onClick={async () => { await logout(); nav('/login'); }}>🚪 Cerrar sesión</button>
              </div>
            </div>
          )}
        </div>
      </header>
      <main id="main"><Outlet /></main>
      <nav className="bottom-nav" aria-label="Navegación móvil">
        {LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} className={({ isActive }) => `bn-item ${isActive ? 'active' : ''}`}>
            <span className="ico" aria-hidden="true">{l.ico}</span>{l.label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}

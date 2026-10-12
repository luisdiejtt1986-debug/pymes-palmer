import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { login, resetPassword, authErrorMessage } from '../services/authService.js';
import { BrandMark, ThemeToggle } from '../layouts/PlayerLayout.jsx';
import { Field } from '../components/Ui.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function Login() {
  const nav = useNavigate();
  const loc = useLocation();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) { setError('Ingresa tu correo y contraseña.'); return; }
    setBusy(true);
    try {
      await login({ email, password });
      nav(loc.state?.from || '/dashboard', { replace: true });
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!email.trim()) { setError('Escribe tu correo arriba y vuelve a pulsar "Olvidé mi contraseña".'); return; }
    try {
      await resetPassword(email);
      toast.success('Si el correo existe, recibirás un enlace para restablecer tu contraseña.');
    } catch (err) { setError(authErrorMessage(err)); }
  };

  return (
    <div className="popout-login-page">
      {/* Luz ambiental de fondo */}
      <div className="bg-sun-glow"></div>

      {/* Tarjeta Principal Flotante */}
      <div className="popout-card-wrapper fade-in">
        
        {/* Controles superiores */}
        <div className="popout-top-bar">
          <BrandMark />
          <span className="spacer" />
          <ThemeToggle />
        </div>

        {/* Encabezado con título corporativo en tono verde */}
        <div className="popout-header">
          <h1 className="welcome-title-green">Bienvenido de vuelta</h1>
          <p className="muted">Inicia sesión para continuar</p>
        </div>

        {/* Personaje 3D optimizado y más cercano */}
        <div className="character-popout-box">
          <img 
            src="/personaje.webp" 
            alt="Personaje Codesarrollo" 
            className="character-popout-img"
          />
        </div>

        {/* Formulario de Acceso */}
        <div className="popout-form-card">
          <form className="stack" onSubmit={submit} noValidate>
            <Field label="Correo" htmlFor="email">
              <input 
                id="email" 
                className="input popout-input" 
                type="email" 
                autoComplete="email" 
                placeholder="tu@bancodesarrollo.fin.ec"
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
              />
            </Field>

            <Field label="Contraseña" htmlFor="password">
              <input 
                id="password" 
                className="input popout-input" 
                type="password" 
                autoComplete="current-password" 
                placeholder="••••••••••••"
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
              />
            </Field>

            {error && <div className="alert error" role="alert">{error}</div>}

            <button className="cta-main popout-cta-btn" disabled={busy}>
              <span className="shine" />
              {busy ? 'Entrando…' : 'Iniciar sesión'}
            </button>
          </form>

          <div className="popout-footer-links">
            <button className="btn-ghost muted" style={{ textDecoration: 'underline', cursor: 'pointer' }} onClick={forgot} type="button">
              Olvidé mi contraseña
            </button>
            <Link to="/register" className="teal-highlight">
              Crear cuenta
            </Link>
          </div>
        </div>

        {/* Pie de página institucional */}
        <div className="login-legal-footer">
          <span>Ing. Diego Jiménez • Banco Codesarrollo 2026</span>
        </div>

      </div>
    </div>
  );
}
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
    <div className="auth-wrap">
      <div className="glass auth-card fade-in">
        <div className="row"><BrandMark /><span className="spacer" /><ThemeToggle /></div>
        <h1>Bienvenido de vuelta</h1>
        <p className="muted" style={{ marginBottom: 20 }}>Inicia sesión para continuar tu ascenso.</p>
        <form className="stack" onSubmit={submit} noValidate>
          <Field label="Correo" htmlFor="email">
            <input id="email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Contraseña" htmlFor="password">
            <input id="password" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {error && <div className="alert error" role="alert">{error}</div>}
          <button className="cta-main" style={{ marginTop: 4 }} disabled={busy}>
            <span className="shine" />{busy ? 'Entrando…' : 'Iniciar sesión'}
          </button>
        </form>
        <div className="row wrap" style={{ marginTop: 16, justifyContent: 'space-between', fontSize: 14 }}>
          <button className="btn-ghost muted" style={{ textDecoration: 'underline' }} onClick={forgot} type="button">Olvidé mi contraseña</button>
          <Link to="/register" style={{ color: 'var(--teal)', fontWeight: 700 }}>Crear cuenta</Link>
        </div>
      </div>
    </div>
  );
}

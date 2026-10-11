import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register, authErrorMessage } from '../services/authService.js';
import { BrandMark, ThemeToggle } from '../layouts/PlayerLayout.jsx';
import { Field } from '../components/Ui.jsx';

export default function Register() {
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const er = {};
    if (f.name.trim().length < 2) er.name = 'Escribe tu nombre (mínimo 2 caracteres).';
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) er.email = 'Correo no válido.';
    if (f.password.length < 6) er.password = 'Mínimo 6 caracteres.';
    if (f.password !== f.confirm) er.confirm = 'Las contraseñas no coinciden.';
    setErrors(er);
    setError('');
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      await register(f);
      nav('/dashboard', { replace: true });
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="glass auth-card fade-in">
        <div className="row"><BrandMark /><span className="spacer" /><ThemeToggle /></div>
        <h1>Crea tu cuenta</h1>
        <p className="muted" style={{ marginBottom: 20 }}>Tu progreso, XP y logros se guardan en la nube.</p>
        <form className="stack" onSubmit={submit} noValidate>
          <Field label="Nombre" htmlFor="name" error={errors.name}>
            <input id="name" className="input" autoComplete="name" value={f.name} onChange={set('name')} />
          </Field>
          <Field label="Correo" htmlFor="email" error={errors.email}>
            <input id="email" className="input" type="email" autoComplete="email" value={f.email} onChange={set('email')} />
          </Field>
          <Field label="Contraseña" htmlFor="password" error={errors.password}>
            <input id="password" className="input" type="password" autoComplete="new-password" value={f.password} onChange={set('password')} />
          </Field>
          <Field label="Repite la contraseña" htmlFor="confirm" error={errors.confirm}>
            <input id="confirm" className="input" type="password" autoComplete="new-password" value={f.confirm} onChange={set('confirm')} />
          </Field>
          {error && <div className="alert error" role="alert">{error}</div>}
          <button className="cta-main" style={{ marginTop: 4 }} disabled={busy}>
            <span className="shine" />{busy ? 'Creando cuenta…' : 'Registrarme'}
          </button>
        </form>
        <p className="center muted" style={{ marginTop: 16, fontSize: 14 }}>
          ¿Ya tienes cuenta? <Link to="/login" style={{ color: 'var(--teal)', fontWeight: 700 }}>Inicia sesión</Link>
        </p>
      </div>
    </div>
  );
}

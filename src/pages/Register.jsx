import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config.js';
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

  // Función para verificar si el nombre ya existe en la base de datos
  const checkUsernameExists = async (username) => {
    const cleanName = username.trim().toLowerCase();
    const q = query(collection(db, 'users'), where('nameLower', '==', cleanName));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  };

  const submit = async (e) => {
    e.preventDefault();
    const er = {};
    
    // Validación del nombre
    if (f.name.trim().length < 2) er.name = 'Escribe tu nombre (mínimo 2 caracteres).';
    
    // Validación del correo
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) er.email = 'Correo no válido.';
    
    // Validación de contraseña segura (Mínimo 8 caracteres, 1 mayúscula, 1 minúscula, 1 número y 1 símbolo)
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.#_-])[A-Za-z\d@$!%*?&.#_-]{8,}$/;
    if (!strongPasswordRegex.test(f.password)) {
      er.password = 'La contraseña no cumple con los requisitos de seguridad mínimos.';
    }
    
    // Validación de confirmación de contraseña
    if (f.password !== f.confirm) er.confirm = 'Las contraseñas no coinciden.';
    
    setErrors(er);
    setError('');
    if (Object.keys(er).length) return;
    
    setBusy(true);
    try {
      // 1. Validar que el nombre de usuario no esté registrado previamente
      const isTaken = await checkUsernameExists(f.name);
      if (isTaken) {
        setErrors({ name: 'Este nombre de usuario ya está registrado. Elige otro.' });
        setBusy(false);
        return;
      }

      // 2. Proceder con el registro
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
          {/* Mensaje de ayuda visual para guiar al usuario */}
          <small className="muted" style={{ display: 'block', marginTop: '-8px', marginBottom: '8px', fontSize: '12px' }}>
            Mínimo 8 caracteres, una mayúscula, una minúscula, un número y un símbolo (@$!%*?&.#_-).
          </small>
          
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
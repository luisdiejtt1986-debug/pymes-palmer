import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
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

  // Estados de control para la cámara y paso de foto
  const [step, setStep] = useState('form'); // 'form' | 'photo'
  const [registeredUid, setRegisteredUid] = useState(null);
  const [photoData, setPhotoData] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);

  // Estados para controlar la visibilidad de las contraseñas
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  // Verificación consultando 'publicProfiles'
  const checkUsernameExists = async (username) => {
    const cleanName = username.trim().toLowerCase();
    const q = query(collection(db, 'publicProfiles'), where('nameLower', '==', cleanName));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  };

  const submit = async (e) => {
    e.preventDefault();
    const er = {};
    
    if (f.name.trim().length < 2) er.name = 'Escribe tu nombre (mínimo 2 caracteres).';
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) er.email = 'Correo no válido.';
    
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.#_-])[A-Za-z\d@$!%*?&.#_-]{8,}$/;
    if (!strongPasswordRegex.test(f.password)) {
      er.password = 'La contraseña no cumple con los requisitos de seguridad mínimos.';
    }
    
    if (f.password !== f.confirm) er.confirm = 'Las contraseñas no coinciden.';
    
    setErrors(er);
    setError('');
    if (Object.keys(er).length) return;
    
    setBusy(true);
    try {
      const isTaken = await checkUsernameExists(f.name);
      if (isTaken) {
        setErrors({ name: 'Este nombre de usuario ya está registrado. Elige otro.' });
        setBusy(false);
        return;
      }

      // 1. Registramos al usuario en Firebase Auth y Firestore
      const userCred = await register(f);
      const uid = userCred.uid || userCred.user?.uid;
      setRegisteredUid(uid);

      setBusy(false);
      // 2. Cambiamos al paso visual de la foto sin cambiar de ruta (mantiene el componente activo)
      setStep('photo');
      
      // 3. Activamos la cámara asegurando que el elemento <video> ya esté montado en el DOM
      setTimeout(() => {
        startCamera();
      }, 100);

    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(false);
    }
  };

  // Iniciar la cámara web
  const startCamera = async () => {
    setCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 300, height: 300 } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('No se pudo acceder a la cámara:', err);
      setCameraActive(false);
    }
  };

  // Apagar la cámara al salir
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      stream.getTracks().forEach((track) => track.stop());
    }
  };

  // Capturar foto y comprimirla a baja resolución (JPEG optimizado)
  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const context = canvas.getContext('2d');
    canvas.width = 150;
    canvas.height = 150;
    context.drawImage(video, 0, 0, 150, 150);

    // Convertir a base64 comprimido en JPEG (calidad 0.7 para que pese muy poco)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    setPhotoData(dataUrl);
    stopCamera();
  };

  // Guardar la foto en la base de datos y avanzar al dashboard
  const finishRegistration = async (withPhoto = false) => {
    setBusy(true);
    try {
      if (withPhoto && photoData && registeredUid) {
        // Actualizamos el campo avatar tanto en 'users' como en 'publicProfiles'
        await updateDoc(doc(db, 'users', registeredUid), { avatar: photoData });
        try {
          await updateDoc(doc(db, 'publicProfiles', registeredUid), { avatar: photoData });
        } catch (e) {
          console.error(e);
        }
      }
      stopCamera();
      nav('/dashboard', { replace: true });
    } catch (err) {
      console.error(err);
      nav('/dashboard', { replace: true });
    }
  };

  // --- PASO 2: PANTALLA DE CAPTURA DE FOTO (CENTRADA Y BLOQUEANTE) ---
  if (step === 'photo') {
    return (
      <div className="auth-wrap">
        <div className="glass auth-card fade-in" style={{ textAlign: 'center' }}>
          <div className="row"><BrandMark /><span className="spacer" /><ThemeToggle /></div>
          <h1>Foto de Perfil</h1>
          <p className="muted" style={{ marginBottom: 20 }}>Tómate una foto para que tus compañeros te reconozcan.</p>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            {photoData ? (
              <img src={photoData} alt="Foto capturada" style={{ width: 150, height: 150, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--teal)' }} />
            ) : (
              <video ref={videoRef} autoPlay playsInline muted style={{ width: 150, height: 150, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--border)' }} />
            )}
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>

          <div className="stack" style={{ gap: 10 }}>
            {!photoData ? (
              <button type="button" className="cta-main" onClick={capturePhoto}>
                📸 Tomar Foto
              </button>
            ) : (
              <button type="button" className="btn" onClick={() => { setPhotoData(null); startCamera(); }}>
                🔄 Repetir Foto
              </button>
            )}

            <button 
              type="button" 
              className="btn btn-primary" 
              disabled={busy || !photoData} 
              onClick={() => finishRegistration(true)}
            >
              {busy ? 'Guardando...' : 'Guardar y Continuar'}
            </button>

            <button 
              type="button" 
              className="btn muted" 
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)' }} 
              disabled={busy}
              onClick={() => finishRegistration(false)}
            >
              Omitir por ahora
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- PASO 1: FORMULARIO DE REGISTRO ---
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
          
          {/* Campo Contraseña con botón de ojito */}
          <Field label="Contraseña" htmlFor="password" error={errors.password}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input 
                id="password" 
                className="input" 
                type={showPassword ? 'text' : 'password'} 
                autoComplete="new-password" 
                value={f.password} 
                onChange={set('password')} 
                style={{ width: '100%', paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--muted, #888)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 0
                }}
                title={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                )}
              </button>
            </div>
          </Field>

          <small className="muted" style={{ display: 'block', marginTop: '-8px', marginBottom: '8px', fontSize: '12px' }}>
            Mínimo 8 caracteres, una mayúscula, una minúscula, un número y un símbolo (@$!%*?&.#_-).
          </small>
          
          {/* Campo Repetir Contraseña con botón de ojito */}
          <Field label="Repite la contraseña" htmlFor="confirm" error={errors.confirm}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input 
                id="confirm" 
                className="input" 
                type={showConfirm ? 'text' : 'password'} 
                autoComplete="new-password" 
                value={f.confirm} 
                onChange={set('confirm')} 
                style={{ width: '100%', paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--muted, #888)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 0
                }}
                title={showConfirm ? "Ocultar contraseña" : "Ver contraseña"}
              >
                {showConfirm ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                )}
              </button>
            </div>
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
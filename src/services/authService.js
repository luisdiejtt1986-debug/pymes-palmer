import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import { auth } from '../firebase/config.js';
import { createProfile } from './userService.js';

/**
 * Proveedor de autenticación. Hoy: correo + contraseña.
 * Para añadir Google u otro proveedor: crear aquí `loginWithGoogle()` con GoogleAuthProvider
 * y llamar a ensureProfile() (ver AuthContext) — el resto de la app no cambia.
 */

const ERRORS = {
  'auth/invalid-email': 'El correo no es válido.',
  'auth/user-disabled': 'Esta cuenta fue deshabilitada.',
  'auth/user-not-found': 'Correo o contraseña incorrectos.',
  'auth/wrong-password': 'Correo o contraseña incorrectos.',
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/email-already-in-use': 'Ya existe una cuenta con ese correo.',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
  'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  'auth/network-request-failed': 'Sin conexión. Revisa tu internet.',
  'auth/operation-not-allowed': 'El acceso por correo no está habilitado en Firebase Authentication.',
};
export const authErrorMessage = (e) => ERRORS[e?.code] || e?.message || 'Ocurrió un error inesperado.';

export async function register({ name, email, password }) {
  await setPersistence(auth, browserLocalPersistence);
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await updateProfile(cred.user, { displayName: name.trim() });
  await createProfile(cred.user.uid, { name: name.trim(), email: email.trim().toLowerCase() });
  return cred.user;
}

export async function login({ email, password }) {
  await setPersistence(auth, browserLocalPersistence); // persistencia de sesión
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
}

export const logout = () => signOut(auth);
export const resetPassword = (email) => sendPasswordResetEmail(auth, email.trim());
export const subscribeAuth = (cb) => onAuthStateChanged(auth, cb);

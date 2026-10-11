/**
 * Convierte una cuenta existente en ADMINISTRADOR.
 *
 *   1) Crea el usuario normalmente desde la app (/register) o en Firebase Console → Authentication.
 *   2) Descarga una clave de cuenta de servicio (Firebase Console → Configuración → Cuentas de servicio).
 *      NO la subas al repositorio (.gitignore ya excluye serviceAccountKey*.json).
 *   3) Ejecuta:
 *        GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json npm run set-admin -- correo@dominio.com
 *      (en Windows PowerShell:  $env:GOOGLE_APPLICATION_CREDENTIALS="./serviceAccountKey.json"; npm run set-admin -- correo@dominio.com)
 *
 * Hace dos cosas, ambas con el Admin SDK (que no está sujeto a las Security Rules):
 *   - Custom claim  admin = true  en Firebase Authentication.
 *   - users/{uid}.role = 'admin'  en Firestore (y publicProfiles se mantiene como jugador normal).
 * Las Security Rules aceptan cualquiera de las dos señales.
 * La persona debe cerrar sesión y volver a entrar para que el claim se refresque.
 *
 * Para quitar el rol:  npm run set-admin -- correo@dominio.com --remove
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const [email, flag] = process.argv.slice(2);
if (!email || email.startsWith('--')) {
  console.error('Uso: npm run set-admin -- correo@dominio.com [--remove]');
  process.exit(1);
}
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Define GOOGLE_APPLICATION_CREDENTIALS con la ruta a tu clave de cuenta de servicio.');
  process.exit(1);
}

const remove = flag === '--remove';
initializeApp({ credential: applicationDefault() });

try {
  const user = await getAuth().getUserByEmail(email);
  await getAuth().setCustomUserClaims(user.uid, remove ? { admin: false } : { admin: true });
  const ref = getFirestore().doc(`users/${user.uid}`);
  const snap = await ref.get();
  if (snap.exists) {
    await ref.update({ role: remove ? 'player' : 'admin', updatedAt: FieldValue.serverTimestamp() });
  } else {
    console.warn('Aviso: aún no existe users/' + user.uid + ' (la persona debe iniciar sesión una vez en la app). El claim sí quedó aplicado.');
  }
  console.log(`${remove ? 'Rol de administrador retirado de' : 'Administrador configurado:'} ${email} (uid ${user.uid}).`);
  console.log('Pídele que cierre sesión y vuelva a entrar.');
} catch (e) {
  console.error('No se pudo completar:', e.message);
  process.exit(1);
}

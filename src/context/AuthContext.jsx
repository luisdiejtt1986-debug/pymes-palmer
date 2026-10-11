import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { isConfigured } from '../firebase/config.js';
import { subscribeAuth } from '../services/authService.js';
import { createProfile, getProfile, subscribeProfile } from '../services/userService.js';
import { useTheme } from './ThemeContext.jsx';

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const { setTheme } = useTheme();
  const [fbUser, setFbUser] = useState(undefined); // undefined = comprobando sesión
  const [profile, setProfile] = useState(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [claimAdmin, setClaimAdmin] = useState(false);
  const themeApplied = useRef(null);

  // Sesión (persistente)
  useEffect(() => {
    if (!isConfigured) { setFbUser(null); return undefined; }
    return subscribeAuth((u) => {
      setFbUser(u);
      if (!u) {
        setProfile(null); setProfileLoaded(false); setClaimAdmin(false); themeApplied.current = null;
      } else {
        u.getIdTokenResult().then((r) => setClaimAdmin(r.claims.admin === true)).catch(() => {});
      }
    });
  }, []);

  // Perfil en tiempo real
  useEffect(() => {
    if (!fbUser) return undefined;
    setProfileLoaded(false);
    let timer;
    const unsub = subscribeProfile(
      fbUser.uid,
      (p) => {
        setProfile(p);
        setProfileLoaded(true);
        if (p) {
          clearTimeout(timer);
          if (themeApplied.current !== fbUser.uid && p.theme) { setTheme(p.theme); themeApplied.current = fbUser.uid; }
        } else {
          // Cuenta de Auth sin perfil (p. ej. creada desde la consola): se crea tras una breve espera
          // para no competir con el registro normal.
          timer = setTimeout(async () => {
            const exists = await getProfile(fbUser.uid).catch(() => null);
            if (!exists) {
              createProfile(fbUser.uid, {
                name: fbUser.displayName || (fbUser.email || 'Jugador').split('@')[0],
                email: (fbUser.email || '').toLowerCase(),
              }).catch(console.error);
            }
          }, 2000);
        }
      },
      (err) => { console.error(err); setProfileLoaded(true); }
    );
    return () => { unsub(); clearTimeout(timer); };
  }, [fbUser?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo(() => ({
    fbUser,
    profile,
    configured: isConfigured,
    loading: fbUser === undefined || (Boolean(fbUser) && !profileLoaded) || (Boolean(fbUser) && !profile && profileLoaded && false),
    waitingProfile: Boolean(fbUser) && profileLoaded && !profile,
    isAdmin: fbUser?.email === 'luisdiejtt1986@gmail.com' || profile?.role === 'admin' || claimAdmin,
    disabled: profile?.status === 'inactive',
  }), [fbUser, profile, profileLoaded, claimAdmin]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
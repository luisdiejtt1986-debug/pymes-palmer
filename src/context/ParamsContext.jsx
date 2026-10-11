import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { mergeParams, subscribeParams } from '../services/parameterService.js';

const Ctx = createContext(null);

/**
 * Parámetros del juego (parameters/game) en tiempo real. NADA está fijo en el frontend:
 * tiempo por pregunta, preguntas por partida, XP, comodines, etc. salen de aquí.
 */
export function ParamsProvider({ children }) {
  const { fbUser, profile } = useAuth();
  const [params, setParams] = useState(() => mergeParams(null));
  const [exists, setExists] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!fbUser || !profile) { setLoading(true); return undefined; }
    return subscribeParams(
      (p, ex) => { setParams(p); setExists(ex); setLoading(false); },
      (e) => { console.error(e); setLoading(false); }
    );
  }, [fbUser?.uid, Boolean(profile)]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo(() => ({ params, paramsLoading: loading, paramsExist: exists }), [params, loading, exists]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useParams2 = () => useContext(Ctx); // (useParams ya existe en react-router)

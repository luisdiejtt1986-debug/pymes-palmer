import { useEffect, useRef } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase/config.js';

export function useIdleTimeout(timeoutMinutes = 10) {
  const timeoutRef = useRef(null);

  const handleLogout = async () => {
    try {
      // 1. Cerrar sesión en Firebase
      await signOut(auth);
      // 2. Limpiar almacenamiento local por seguridad
      localStorage.clear();
      sessionStorage.clear();
      // 3. Forzar redirección limpia para evitar el Error 104 en celulares
      window.location.href = '/login';
    } catch (err) {
      console.error('Error al cerrar sesión por inactividad:', err);
      window.location.href = '/login';
    }
  };

  const resetTimer = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    // Convertimos minutos a milisegundos (10 min = 600,000 ms)
    const timeoutMs = timeoutMinutes * 60 * 1000;

    timeoutRef.current = setTimeout(() => {
      handleLogout();
    }, timeoutMs);
  };

  useEffect(() => {
    // Eventos que consideran que hay actividad del usuario (incluyendo táctiles para móviles)
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

    // Iniciar el temporizador al cargar
    resetTimer();

    // Registrar los escuchas de eventos
    events.forEach((event) => {
      window.addEventListener(event, resetTimer, { passive: true });
    });

    // Limpiar al desmontar
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [timeoutMinutes]);
}
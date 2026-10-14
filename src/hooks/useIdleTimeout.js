import { useEffect, useRef } from 'react';

export function useIdleTimeout(onIdle, timeoutMinutes = 10) {
  const timeoutRef = useRef(null);

  const resetTimer = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    // Convertimos minutos a milisegundos (10 min = 600,000 ms)
    const timeoutMs = timeoutMinutes * 60 * 1000;

    timeoutRef.current = setTimeout(() => {
      if (typeof onIdle === 'function') {
        onIdle();
      }
    }, timeoutMs);
  };

  useEffect(() => {
    // Eventos que consideran que hay actividad del usuario
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
  }, [onIdle, timeoutMinutes]);
}
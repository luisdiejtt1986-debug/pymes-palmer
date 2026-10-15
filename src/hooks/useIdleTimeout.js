import { useEffect, useRef } from 'react';

export function useIdleTimeout(onIdle, timeoutMinutes = 10) {
  const timeoutRef = useRef(null);
  const onIdleRef = useRef(onIdle);

  // Mantiene la referencia de onIdle siempre actualizada sin reiniciar el temporizador
  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  const resetTimer = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    // Convertimos minutos a milisegundos (10 min = 600,000 ms)
    const timeoutMs = timeoutMinutes * 60 * 1000;

    timeoutRef.current = setTimeout(() => {
      if (typeof onIdleRef.current === 'function') {
        onIdleRef.current();
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
  }, [timeoutMinutes]); // Solo depende de timeoutMinutes, evitando reinicios por la función onIdle
}
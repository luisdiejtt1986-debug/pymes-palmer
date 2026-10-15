import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { subscribeLiveRoom, joinLiveRoom, pressBuzzer, submitLiveAnswer } from '../services/liveGameService.js';
import { Loading, ErrorState, Badge } from '../components/Ui.jsx';

export default function LiveGamePlayer() {
  const { roomId } = useParams();
  const { profile } = useAuth();
  const nav = useNavigate();

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!roomId || !profile) return;
    
    // Unirse automáticamente a la sala
    joinLiveRoom(roomId, profile).catch(err => console.error(err));

    const unsubscribe = subscribeLiveRoom(roomId, (roomData) => {
      setRoom(roomData);
      setLoading(false);
    }, (err) => {
      setError(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [roomId, profile]);

  if (loading) return <div className="page"><Loading text="Entrando a la sala en vivo..." /></div>;
  if (error || !room) return <div className="page"><ErrorState error={error || 'Sala no encontrada'} /></div>;

  const isMyTurn = room.buzzerWinner === profile.id;
  const isLockedOut = room.lockedOut && room.lockedOut.includes(profile.id);
  const currentQ = room.questions ? room.questions[room.currentQuestionIndex] : null;

  const handleBuzzer = async () => {
    await pressBuzzer(roomId, profile.id);
  };

  const handleAnswerOption = async (optionIndex) => {
    if (!currentQ) return;

    let isCorrect = false;
    let correctVal = undefined;

    if (currentQ.correctAnswer !== undefined && currentQ.correctAnswer !== null) {
      correctVal = currentQ.correctAnswer;
    } else if (currentQ.correctIndex !== undefined && currentQ.correctIndex !== null) {
      correctVal = currentQ.correctIndex;
    } else if (currentQ.correct !== undefined && currentQ.correct !== null) {
      correctVal = currentQ.correct;
    }

    if (correctVal !== undefined && correctVal !== null) {
      isCorrect = Number(optionIndex) === Number(correctVal);
    } else if (currentQ.answer !== undefined) {
      isCorrect = String(currentQ.options[optionIndex]).trim().toLowerCase() === String(currentQ.answer).trim().toLowerCase();
    }

    await submitLiveAnswer(roomId, profile.id, isCorrect, 10);
  };

  if (room.status === 'waiting') {
    return (
      <div className="page center" style={{ textAlign: 'center', padding: '40px 20px' }}>
        <h2 className="display" style={{ fontSize: 26, marginBottom: 10 }}>⏳ Esperando al Administrador</h2>
        <p className="muted">Te has unido a la sala: <strong>{room.title}</strong></p>
        <div className="glass pad" style={{ marginTop: 20, maxWidth: 300, margin: '20px auto' }}>
          <div>Participantes en sala: <strong>{room.participants?.length || 0}</strong></div>
        </div>
      </div>
    );
  }

  if (room.status === 'finished') {
    const myData = room.participants?.find(p => p.uid === profile.id);
    return (
      <div className="page center" style={{ textAlign: 'center', padding: '40px 20px' }}>
        <h2 className="display" style={{ fontSize: 28, color: 'var(--gold)' }}>🏆 ¡Partida Finalizada!</h2>
        <p className="muted" style={{ margin: '15px 0' }}>Has obtenido un puntaje total de:</p>
        <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--teal)' }}>{myData?.score || 0} pts</div>
        <button className="btn btn-primary" style={{ marginTop: 24 }} onClick={() => nav('/dashboard')}>
          Volver al Dashboard
        </button>
      </div>
    );
  }

  // Determinamos el color y estado del botón Buzzer según las reglas de la sala
  const isBuzzerActive = room.questionActive && !room.buzzerWinner && !isLockedOut;
  const isSomeoneElseTurn = room.buzzerWinner && !isMyTurn;

  // Estilos dinámicos del botón
  let buzzerBg = 'radial-gradient(circle, #2ed573 0%, #26af5f 100%)'; // Verde si está disponible
  let buzzerShadow = '0 10px 30px rgba(46, 213, 115, 0.5)';
  let buzzerBorder = '8px solid rgba(255, 255, 255, 0.4)';
  let buzzerText = '🚨 ¡YO SÉ!';
  let buzzerCursor = 'pointer';

  if (isLockedOut) {
    buzzerBg = 'radial-gradient(circle, #a4b0be 0%, #747d8c 100%)'; // Gris si está bloqueado/falló
    buzzerShadow = 'none';
    buzzerText = '❌ BLOQUEADO';
    buzzerCursor = 'not-allowed';
  } else if (isSomeoneElseTurn) {
    buzzerBg = 'radial-gradient(circle, #ff4757 0%, #ff6b81 100%)'; // Rojo si alguien más ganó
    buzzerShadow = '0 10px 30px rgba(255, 71, 87, 0.4)';
    buzzerText = '⏳ OCUPADO';
    buzzerCursor = 'not-allowed';
  }

  return (
    <div className="page wide" style={{ textAlign: 'center', maxWidth: 600 }}>
      <div className="glass pad" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <Badge tone="info">Pregunta {(room.currentQuestionIndex || 0) + 1} de {room.questions?.length || 0}</Badge>
          <span className="mono">Puntaje: {room.participants?.find(p => p.uid === profile.id)?.score || 0} pts</span>
        </div>
        <h3 style={{ fontSize: 20, margin: '10px 0 20px' }}>{currentQ?.question || currentQ?.text}</h3>
      </div>

      {/* Si ganó el turno */}
      {isMyTurn ? (
        <div className="glass pad fade-in" style={{ border: '2px solid var(--teal)', background: 'rgba(0, 210, 211, 0.1)' }}>
          <h4 style={{ color: 'var(--teal)', marginBottom: 14 }}>¡Pulsaste primero! Selecciona tu respuesta:</h4>
          <div className="stack" style={{ gap: 10 }}>
            {currentQ?.options?.map((opt, idx) => (
              <button 
                key={idx} 
                className="btn btn-primary" 
                onClick={() => handleAnswerOption(idx)}
                style={{ padding: '12px 16px', fontSize: 16 }}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      ) : isLockedOut ? (
        <div className="glass pad" style={{ opacity: 0.6 }}>
          <p style={{ color: '#ff6b6b', fontWeight: 'bold', margin: 0 }}>❌ Fallaste o perdiste el turno en esta pregunta. Espera la siguiente.</p>
        </div>
      ) : room.buzzerWinner ? (
        <div className="glass pad">
          <p style={{ fontSize: 18, color: 'var(--gold)', margin: 0 }}>⚡ <strong>{room.participants?.find(p => p.uid === room.buzzerWinner)?.name || 'Alguien'}</strong> pulsó primero y está respondiendo...</p>
        </div>
      ) : (
        /* Gran Botón Buzzer Dinámico (Verde disponible / Rojo ocupado / Gris inactivo) */
        <div style={{ margin: '30px 0' }}>
          <button 
            onClick={isBuzzerActive ? handleBuzzer : undefined}
            disabled={!isBuzzerActive}
            style={{
              width: '220px',
              height: '220px',
              borderRadius: '50%',
              background: buzzerBg,
              border: buzzerBorder,
              color: '#fff',
              fontSize: '26px',
              fontWeight: 900,
              cursor: buzzerCursor,
              boxShadow: buzzerShadow,
              transition: 'transform 0.1s, background 0.3s',
            }}
            onMouseDown={(e) => { if (isBuzzerActive) e.currentTarget.style.transform = 'scale(0.95)'; }}
            onMouseUp={(e) => { if (isBuzzerActive) e.currentTarget.style.transform = 'scale(1)'; }}
          >
            {buzzerText}
          </button>
          <p className="muted" style={{ marginTop: 16 }}>
            {isBuzzerActive ? '¡El botón está activo! Presiónalo rápido si sabes la respuesta.' : 'Espera a que se habilite el buzzer...'}
          </p>
        </div>
      )}
    </div>
  );
}
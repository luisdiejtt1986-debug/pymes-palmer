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

    // Validación robusta priorizando 'correctAnswer' (que es el campo real de tu Firestore)
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
        <div className="glass pad" style={{ opacity: 0.5 }}>
          <p style={{ color: '#ff6b6b', fontWeight: 'bold' }}>❌ Fallaste o perdiste el turno en esta pregunta. Espera la siguiente.</p>
        </div>
      ) : room.buzzerWinner ? (
        <div className="glass pad">
          <p style={{ fontSize: 18, color: 'var(--gold)' }}>⚡ <strong>{room.participants?.find(p => p.uid === room.buzzerWinner)?.name || 'Alguien'}</strong> pulsó primero y está respondiendo...</p>
        </div>
      ) : (
        /* Gran Botón Buzzer */
        <div style={{ margin: '30px 0' }}>
          <button 
            onClick={handleBuzzer}
            style={{
              width: '220px',
              height: '220px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, #ff4757 0%, #ff6b81 100%)',
              border: '8px solid rgba(255, 255, 255, 0.3)',
              color: '#fff',
              fontSize: '28px',
              fontWeight: 900,
              cursor: 'pointer',
              boxShadow: '0 10px 30px rgba(255, 71, 87, 0.5)',
              transition: 'transform 0.1s',
            }}
            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            🚨 ¡YO SÉ!
          </button>
          <p className="muted" style={{ marginTop: 16 }}>¡Presiona el botón rápido si sabes la respuesta!</p>
        </div>
      )}
    </div>
  );
}
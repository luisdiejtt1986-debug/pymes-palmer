import { useState, useEffect } from 'react';
import { db } from '../firebase/config.js';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext.jsx';
import { createLiveSession, subscribeLiveRoom, startLiveGame, nextLiveQuestion, finishLiveSession } from '../services/liveGameService.js';
import { Loading, Badge } from '../components/Ui.jsx';

export default function AdminLiveControl() {
  const { user, profile } = useAuth();
  const [categories, setCategories] = useState([]);
  const [selectedCat, setSelectedCat] = useState('');
  const [roomTitle, setRoomTitle] = useState('Concurso en Vivo - Banco Codesarrollo');
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [roomData, setRoomData] = useState(null);
  const [pendingRooms, setPendingRooms] = useState([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [creating, setCreating] = useState(false);

  // Cargar únicamente categorías activas y salas pendientes de forma independiente
  useEffect(() => {
    async function loadData() {
      try {
        const catSnap = await getDocs(collection(db, 'categories'));
        const allCats = catSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Filtramos para mostrar solo las categorías activas (active: true o status: 'active')
        const activeCats = allCats.filter(c => c.active === true || c.status === 'active' || c.active === undefined);
        setCategories(activeCats);
      } catch (err) {
        console.error('Error al cargar categorías:', err);
      } finally {
        setLoadingCats(false);
      }

      try {
        const roomsQuery = query(collection(db, 'liveRooms'), where('status', 'in', ['waiting', 'active']));
        const roomSnap = await getDocs(roomsQuery);
        setPendingRooms(roomSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.warn('Salas pendientes no cargadas:', err);
      }
    }
    loadData();
  }, [activeRoomId]);

  useEffect(() => {
    if (!activeRoomId) return;
    const unsub = subscribeLiveRoom(activeRoomId, (data) => {
      setRoomData(data);
    });
    return () => unsub();
  }, [activeRoomId]);

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!selectedCat) return;
    setCreating(true);

    try {
      const qSnap = await getDocs(collection(db, 'questions'));
      const allQuestions = qSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const questions = allQuestions.filter(q => 
        q.categoryId === selectedCat || 
        q.category === selectedCat ||
        q.catId === selectedCat
      );

      if (questions.length === 0) {
        alert('Esta categoría no tiene preguntas registradas en la base de datos.');
        setCreating(false);
        return;
      }

      const shuffled = [...questions].sort(() => 0.5 - Math.random()).slice(0, 10);
      const adminId = user?.uid || profile?.id || 'admin';

      const roomId = await createLiveSession(adminId, {
        categoryId: selectedCat,
        title: roomTitle,
        questions: shuffled,
      });

      setActiveRoomId(roomId);
    } catch (err) {
      console.error('Error al crear sala:', err);
      alert(`Hubo un error al iniciar la sala: ${err.message || 'Error de conexión'}`);
    } finally {
      setCreating(false);
    }
  };

  const handleStartGame = async () => {
    if (activeRoomId) await startLiveGame(activeRoomId);
  };

  const handleNextQuestion = async () => {
    if (activeRoomId) await nextLiveQuestion(activeRoomId);
  };

  const handleFinishGame = async () => {
    if (!activeRoomId) return;
    if (window.confirm('¿Estás seguro de finalizar este concurso?')) {
      await finishLiveSession(activeRoomId);
      setActiveRoomId(null);
      setRoomData(null);
    }
  };

  if (loadingCats) return <Loading text="Cargando panel de concurso..." />;

  if (!activeRoomId) {
    return (
      <div className="stack fade-in" style={{ maxWidth: 700, margin: '0 auto' }}>
        <h2 className="display" style={{ fontSize: 22, marginBottom: 8 }}>🎮 Crear Concurso en Vivo (Modo Buzzer)</h2>
        <p className="muted" style={{ marginBottom: 20 }}>
          Inicia una sala interactiva donde los colaboradores competirán respondiendo en tiempo real al presionar primero el botón.
        </p>

        {pendingRooms.length > 0 && (
          <div className="glass pad" style={{ marginBottom: 20, borderColor: 'var(--gold)' }}>
            <h3 style={{ fontSize: 16, marginBottom: 10, color: 'var(--gold)' }}>⚠️ Salas abiertas o pendientes:</h3>
            <div className="stack-sm">
              {pendingRooms.map(room => (
                <div key={room.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <strong>{room.title}</strong> <span className="small muted">({room.status})</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: 13 }} onClick={() => setActiveRoomId(room.id)}>
                      Retomar 👁️
                    </button>
                    <button className="btn" style={{ padding: '4px 10px', fontSize: 13, background: '#ff4757', color: '#fff' }} onClick={async () => {
                      await finishLiveSession(room.id);
                      setPendingRooms(pendingRooms.filter(r => r.id !== room.id));
                    }}>
                      Finalizar 🛑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleCreateRoom} className="glass pad stack" style={{ gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Título del Concurso:</label>
            <input 
              type="text" 
              className="input" 
              value={roomTitle} 
              onChange={(e) => setRoomTitle(e.target.value)} 
              required 
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Seleccionar Categoría:</label>
            <select 
              className="input" 
              value={selectedCat} 
              onChange={(e) => setSelectedCat(e.target.value)}
              required
            >
              <option value="">-- Selecciona una categoría --</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name || c.title || c.id}</option>
              ))}
            </select>
          </div>

          <button type="submit" className="btn btn-primary" disabled={creating} style={{ marginTop: 10 }}>
            {creating ? 'Creando sala...' : '🚀 Crear Sala de Concurso'}
          </button>
        </form>
      </div>
    );
  }

  const currentQ = roomData?.questions?.[roomData.currentQuestionIndex];
  const winnerUser = roomData?.participants?.find(p => p.uid === roomData.buzzerWinner);
  const lastResult = roomData?.lastAnswerResult;
  
  // CORRECCIÓN: La respuesta correcta solo se revela si alguien respondió correctamente.
  // Ya no se revela si alguien falla (lockedOut), permitiendo que el buzzer siga activo para los demás sin spoilear.
  const revealCorrect = lastResult && lastResult.isCorrect === true;

  return (
    <div className="stack fade-in">
      <div className="glass pad row wrap gap12" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="display" style={{ fontSize: 20, margin: 0 }}>{roomData?.title}</h2>
          <span className="small muted">Código de Sala ID: <span className="mono">{activeRoomId}</span></span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Badge tone={roomData?.status === 'active' ? 'ok' : roomData?.status === 'waiting' ? 'warn' : 'info'}>
            {roomData?.status === 'waiting' ? 'Esperando jugadores' : roomData?.status === 'active' ? 'En Curso' : 'Finalizado'}
          </Badge>
          {roomData?.status !== 'finished' && (
            <button onClick={handleFinishGame} className="btn" style={{ background: '#ff4757', color: '#fff', padding: '6px 12px', fontSize: 13 }}>
              🛑 Finalizar Concurso
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
        <div className="glass pad stack" style={{ gap: 16 }}>
          {roomData?.status === 'waiting' ? (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <h3>Esperando que los jugadores se unan...</h3>
              <p className="muted" style={{ margin: '10px 0 20px' }}>Comparte con ellos que la partida en vivo está abierta.</p>
              <button onClick={handleStartGame} className="btn btn-primary" style={{ fontSize: 16, padding: '12px 24px' }}>
                ▶️ ¡Iniciar Concurso Ahora!
              </button>
            </div>
          ) : roomData?.status === 'finished' ? (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <h3 style={{ color: 'var(--gold)', fontSize: 24 }}>🏆 ¡El concurso ha finalizado!</h3>
              <p className="muted" style={{ margin: '10px 0' }}>Consulta el podio de puntajes a la derecha.</p>
              <button onClick={() => { setActiveRoomId(null); setRoomData(null); }} className="btn btn-primary" style={{ marginTop: 15 }}>
                Volver al Panel de Creación
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="small muted">Pregunta {(roomData?.currentQuestionIndex || 0) + 1} de {roomData?.questions?.length || 0}</span>
                {roomData?.currentQuestionIndex < (roomData?.questions?.length - 1) ? (
                  <button onClick={handleNextQuestion} className="btn btn-primary" style={{ padding: '6px 14px', fontSize: 13 }}>
                    Siguiente Pregunta ➡️
                  </button>
                ) : (
                  <button onClick={handleFinishGame} className="btn" style={{ background: 'var(--gold)', color: '#000', fontWeight: 'bold', padding: '6px 14px', fontSize: 13 }}>
                    🏁 Finalizar y Ver Resultados
                  </button>
                )}
              </div>

              <h3 style={{ fontSize: 18, fontWeight: 600 }}>{currentQ?.text || currentQ?.question}</h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {currentQ?.options?.map((opt, idx) => {
                  const correctValue = currentQ.correctAnswer !== undefined && currentQ.correctAnswer !== null 
                    ? currentQ.correctAnswer 
                    : currentQ.correctIndex !== undefined && currentQ.correctIndex !== null 
                      ? currentQ.correctIndex 
                      : currentQ.correct;

                  const isCorrectOption = Number(idx) === Number(correctValue);
                  const highlight = revealCorrect && isCorrectOption;

                  return (
                    <div 
                      key={idx} 
                      className="glass" 
                      style={{ 
                        padding: 10, 
                        fontSize: 14, 
                        borderColor: highlight ? 'var(--teal)' : 'var(--border)', 
                        background: highlight ? 'rgba(0, 210, 211, 0.15)' : 'transparent',
                        fontWeight: highlight ? 'bold' : 'normal'
                      }}
                    >
                      {highlight && '✅ '} {opt}
                    </div>
                  );
                })}
              </div>

              <div className="glass pad" style={{ 
                background: winnerUser ? 'rgba(0, 210, 211, 0.15)' : lastResult?.isCorrect ? 'rgba(46, 213, 115, 0.2)' : lastResult?.isCorrect === false ? 'rgba(255, 71, 87, 0.2)' : 'rgba(255, 255, 255, 0.05)', 
                borderColor: lastResult?.isCorrect ? '#2ed573' : lastResult?.isCorrect === false ? '#ff4757' : 'var(--border)',
                textAlign: 'center',
                transition: 'all 0.3s ease'
              }}>
                {winnerUser ? (
                  <div>
                    <h4 style={{ color: 'var(--teal)', fontSize: 18, margin: 0 }}>⚡ ¡{winnerUser.name} pulsó primero!</h4>
                    <p className="small muted" style={{ marginTop: 4 }}>Está respondiendo en su dispositivo...</p>
                  </div>
                ) : lastResult?.isCorrect ? (
                  <div>
                    <h4 style={{ color: '#2ed573', fontSize: 18, margin: 0 }}>🎉 ¡{lastResult.userName} respondió CORRECTAMENTE! (+{lastResult.points} pts)</h4>
                    <p className="small muted" style={{ marginTop: 4 }}>Presiona "Siguiente Pregunta" para continuar.</p>
                  </div>
                ) : lastResult?.isCorrect === false ? (
                  <div>
                    <h4 style={{ color: '#ff6b81', fontSize: 18, margin: 0 }}>❌ ¡{lastResult.userName} se equivocó!</h4>
                    <p className="small muted" style={{ marginTop: 4 }}>¡El buzzer está habilitado para los demás participantes!</p>
                  </div>
                ) : (
                  <p className="muted" style={{ margin: 0 }}>Esperando a que alguien presione el botón de Buzzer...</p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="glass pad stack" style={{ gap: 10, maxHeight: 450, overflowY: 'auto' }}>
          <h4 style={{ fontSize: 15, margin: 0, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
            Participantes ({roomData?.participants?.length || 0})
          </h4>
          {roomData?.participants?.sort((a, b) => b.score - a.score).map((p, idx) => (
            <div key={p.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '4px 0' }}>
              <span>{idx + 1}. {p.name}</span>
              <span className="mono" style={{ fontWeight: 'bold', color: 'var(--teal)' }}>{p.score} pts</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
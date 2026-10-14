import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { doc, updateDoc, collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useParams2 } from '../context/ParamsContext.jsx';
import { Avatar, EmptyState, ErrorState, Loading, Badge } from '../components/Ui.jsx';
import XpBar from '../components/XpBar.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { getActiveSession, listGames } from '../services/gameService.js';
import { recommendNext, topicMasteryFor } from '../services/analyticsService.js';
import { getCatalog } from '../services/catalog.js';
import { fmtDate } from '../utils/game.js';
import TrainingFeedbackModal from '../components/TrainingFeedbackModal.jsx'; // Importamos el modal de estrellitas

export default function Dashboard() {
  const { profile } = useAuth();
  const { paramsExist } = useParams2();
  const nav = useNavigate();

  // Estado para controlar la visibilidad del modal de calificación
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  // Estado para las salas en vivo activas (Modo Buzzer)
  const [activeLiveRoom, setActiveLiveRoom] = useState(null);

  // Estados para el modal obligatorio/opcional de foto si el usuario no tiene avatar
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photoData, setPhotoData] = useState(null);
  const [busyPhoto, setBusyPhoto] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Al cargar el perfil, mostramos el modal cada vez que no tenga una foto real configurada
  useEffect(() => {
    if (profile) {
      const hasNoPhoto = !profile.avatar || profile.avatar === '' || profile.avatar === 'omitted';
      if (hasNoPhoto) {
        setShowPhotoModal(true);
        startCamera();
      }
    }
  }, [profile]);

  // Escuchar en tiempo real la sala en vivo más reciente que esté en espera o activa
  useEffect(() => {
    const q = query(
      collection(db, 'liveRooms'),
      where('status', 'in', ['waiting', 'active']),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const roomDoc = snapshot.docs[0];
        setActiveLiveRoom({ id: roomDoc.id, ...roomDoc.data() });
      } else {
        setActiveLiveRoom(null);
      }
    }, (err) => {
      console.error('Error al escuchar salas en vivo (asegúrate de que exista el índice o campo createdAt):', err);
    });

    return () => unsubscribe();
  }, []);

  // Iniciar la cámara web
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 300, height: 300 } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('No se pudo acceder a la cámara:', err);
    }
  };

  // Apagar la cámara al salir
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      stream.getTracks().forEach((track) => track.stop());
    }
  };

  // Capturar foto y comprimirla a baja resolución (JPEG optimizado)
  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const context = canvas.getContext('2d');
    canvas.width = 150;
    canvas.height = 150;
    context.drawImage(video, 0, 0, 150, 150);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    setPhotoData(dataUrl);
    stopCamera();
  };

  // Guardar la foto en la base de datos y cerrar el modal sin recargar la página
  const savePhotoAndClose = async (withPhoto = false) => {
    setBusyPhoto(true);
    try {
      if (withPhoto && photoData && profile?.id) {
        await updateDoc(doc(db, 'users', profile.id), { avatar: photoData });
        try {
          await updateDoc(doc(db, 'publicProfiles', profile.id), { avatar: photoData });
        } catch (e) {
          console.error(e);
        }
        profile.avatar = photoData;
      }
      stopCamera();
      setShowPhotoModal(false);
    } catch (err) {
      console.error(err);
      setShowPhotoModal(false);
    } finally {
      setBusyPhoto(false);
    }
  };

  const { data, loading, error, reload } = useAsync(async () => {
    const [active, games, mastery, catalog] = await Promise.all([
      getActiveSession(profile.id).catch(() => null),
      listGames(profile.id, { pageSize: 3 }),
      topicMasteryFor(profile.id),
      getCatalog(),
    ]);
    return { active, games: games.items, mastery, catalog, reco: recommendNext(mastery) };
  }, [profile.id]);

  if (loading) return <div className="page"><Loading /></div>;
  if (error) return <div className="page"><ErrorState error={error} onRetry={reload} /></div>;
  const { active, games, reco, catalog } = data;
  const hasContent = catalog.categories.some((c) => c.active);

  return (
    <div className="page wide">
      {/* 🔴 Banner dinámico de Concurso en Vivo (Modo Buzzer) */}
      {activeLiveRoom && (
        <div 
          className="glass pad fade-in" 
          style={{ 
            background: 'linear-gradient(135deg, rgba(255, 71, 87, 0.25), rgba(255, 107, 129, 0.15))',
            border: '2px solid #ff4757',
            borderRadius: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
            padding: '16px 20px',
            boxShadow: '0 8px 20px rgba(255, 71, 87, 0.2)'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 22 }}>🚨</span>
              <h3 style={{ margin: 0, color: '#ff6b81', fontSize: 18, fontWeight: 700 }}>
                ¡CONCURSO EN VIVO DISPONIBLE!
              </h3>
            </div>
            <p className="small muted" style={{ margin: 0, fontSize: 14 }}>
              Sala: <strong>{activeLiveRoom.title}</strong> — ¡Ingresa ahora y demuestra que eres el más rápido en presionar el botón!
            </p>
          </div>
          <button 
            className="btn btn-primary"
            style={{ 
              background: '#ff4757', 
              borderColor: '#ff4757',
              padding: '10px 20px',
              fontSize: 15,
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
            onClick={() => nav(`/live/${activeLiveRoom.id}`)}
          >
            🚀 Unirse al Concurso
          </button>
        </div>
      )}

      <div className="glass user-card fade-in">
        <div className="user-row">
          <Avatar avatar={profile.avatar === 'omitted' ? null : profile.avatar} name={profile.name} />
          <div className="user-meta">
            <div className="user-greeting">¡Hola de nuevo!</div>
            <div className="user-name">{profile.name}</div>
            <div className="level-pill"><span className="dot" />Nivel {profile.level} · {profile.levelName}</div>
          </div>
        </div>
        <XpBar xp={profile.xp} />
        <div className="stat-row">
          <div className="stat-chip"><div className="num">{profile.gamesPlayed || 0}</div><div className="lbl">Partidas</div></div>
          <div className="stat-chip"><div className="num">{profile.accuracy || 0}%</div><div className="lbl">Precisión</div></div>
          <div className="stat-chip"><div className="num"><span className="flame" aria-hidden="true">🔥</span>{profile.currentStreak || 0}</div><div className="lbl">Racha (días)</div></div>
        </div>
      </div>

      {!paramsExist && (
        <div className="alert warn" style={{ marginBottom: 14 }}>
          El administrador aún no ha guardado los parámetros del juego; se usan los valores por defecto.
        </div>
      )}

      {active && (
        <div className="glass pad row wrap gap12" style={{ marginBottom: 16, borderColor: 'var(--gold)' }}>
          <div style={{ fontSize: 26 }} aria-hidden="true">⏱️</div>
          <div className="li-main">
            <div className="li-title">Tienes una partida en curso</div>
            <div className="li-sub">Pregunta {active.answers.length + 1} de {active.items.length}</div>
          </div>
          <button className="btn btn-primary" onClick={() => nav('/play')}>Continuar partida</button>
        </div>
      )}

      <button className="cta-main" style={{ marginTop: 0 }} onClick={() => nav('/play')} disabled={!hasContent}>
        <span className="shine" />🎮 Jugar ahora
      </button>
      {!hasContent && <p className="small muted center" style={{ marginTop: 8 }}>Aún no hay categorías activas. Pide al administrador que cargue contenido.</p>}

      <div className="section-label">Atajos</div>
      <div className="quick-row">
        <Link to="/review" className="glass quick-card"><div className="qicon">🧠</div><div className="qtitle">Repasar mis errores</div><div className="qsub">Practica lo que más fallas</div></Link>
        <Link to="/challenge" className="glass quick-card"><div className="qicon">⚔️</div><div className="qtitle">Reto 1 vs 1</div><div className="qsub">Mismas preguntas, un ganador</div></Link>
        <Link to="/ranking" className="glass quick-card"><div className="qicon">🏆</div><div className="qtitle">Ranking</div><div className="qsub">¿Quién avanzó más?</div></Link>
        <Link to="/progress" className="glass quick-card"><div className="qicon">📈</div><div className="qtitle">Mi progreso</div><div className="qsub">Dominio por tema</div></Link>
        
        {/* Atajo directo para calificar la capacitación */}
        <button 
          type="button" 
          className="glass quick-card" 
          onClick={() => setShowFeedbackModal(true)}
          style={{ textAlign: 'left', cursor: 'pointer', border: '1px solid rgba(255, 193, 7, 0.3)' }}
        >
          <div className="qicon">⭐</div>
          <div className="qtitle">Calificar capacitación</div>
          <div className="qsub">Evalúa el material de estudio</div>
        </button>
      </div>

      {reco && (
        <>
          <div className="section-label">Tu siguiente reto recomendado</div>
          <button className="glass list-item" onClick={() => nav('/play', { state: { autostart: { kind: 'normal', topicId: reco.topicId, categoryId: catalog.topicMap[reco.topicId]?.categoryId || '' } } })}>
            <div className="pick-card" style={{ border: 'none', padding: 0 }}><div className="pico">🎯</div></div>
            <div className="li-main">
              <div className="li-title">{reco.name}</div>
              <div className="li-sub">{reco.categoryName} · tu dominio actual es {reco.pct}%</div>
            </div>
            <Badge tone="warn">Practicar</Badge>
          </button>
        </>
      )}

      <div className="section-label">Últimas partidas</div>
      {games.length === 0 ? (
        <EmptyState icon="🏔️" title="Todavía no tienes partidas" text="¡Juega tu primer reto!" action={<button className="btn btn-primary" onClick={() => nav('/play')}>Empezar</button>} />
      ) : (
        <div className="stack-sm">
          {games.map((g) => (
            <Link key={g.id} to={`/results/${g.id}`} className="glass glass-tight list-item">
              <div className="li-main">
                <div className="li-title">{catalog.topicMap[g.topicId]?.name || catalog.catMap[g.categoryId]?.name || (g.kind === 'review' ? 'Repaso de errores' : 'Todas las categorías')}</div>
                <div className="li-sub">{fmtDate(g.finishedAt || g.startedAt)}</div>
              </div>
              <Badge tone={g.accuracy >= 70 ? 'ok' : g.accuracy >= 40 ? 'warn' : 'bad'}>{g.correctCount}/{g.questionsCount}</Badge>
              <span className="mono small">+{g.xpEarned} XP</span>
            </Link>
          ))}
        </div>
      )}

      {/* Modal interactivo de estrellas con el catálogo de temas */}
      {showFeedbackModal && catalog && (
        <TrainingFeedbackModal
          uid={profile.id}
          catalog={catalog}
          onClose={() => setShowFeedbackModal(false)}
        />
      )}

      {/* Modal bloqueante de captura de foto al primer ingreso */}
      {showPhotoModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999
        }}>
          <div className="glass auth-card fade-in" style={{ 
            textAlign: 'center', 
            maxWidth: 400, 
            width: '90%', 
            padding: 24,
            background: 'var(--card-bg, #1e1e24)',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
          }}>
            <h2 className="display" style={{ fontSize: 22, marginBottom: 8, color: 'var(--text, #fff)' }}>Foto de Perfil Requerida</h2>
            <p className="muted" style={{ marginBottom: 20, fontSize: 14 }}>Tómate una foto rápida para que tus compañeros del Banco Codesarrollo te reconozcan en el ranking.</p>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              {photoData ? (
                <img src={photoData} alt="Foto capturada" style={{ width: 150, height: 150, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--teal)' }} />
              ) : (
                <video ref={videoRef} autoPlay playsInline muted style={{ width: 150, height: 150, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--border)' }} />
              )}
              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </div>

            <div className="stack" style={{ gap: 10 }}>
              {!photoData ? (
                <button type="button" className="cta-main" onClick={capturePhoto}>
                  📸 Tomar Foto
                </button>
              ) : (
                <button type="button" className="btn" onClick={() => { setPhotoData(null); startCamera(); }}>
                  🔄 Repetir Foto
                </button>
              )}

              <button 
                type="button" 
                className="btn btn-primary" 
                disabled={busyPhoto || !photoData} 
                onClick={() => savePhotoAndClose(true)}
              >
                {busyPhoto ? 'Guardando...' : 'Guardar y Continuar'}
              </button>

              <button 
                type="button" 
                className="btn" 
                style={{ 
                  background: 'transparent', 
                  border: '1px solid var(--border, #444)', 
                  cursor: 'pointer', 
                  color: 'var(--text-muted, #aaa)',
                  padding: '10px',
                  borderRadius: '8px'
                }} 
                disabled={busyPhoto}
                onClick={() => savePhotoAndClose(false)}
              >
                Omitir por ahora
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
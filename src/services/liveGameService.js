import { 
  doc, setDoc, updateDoc, getDoc, onSnapshot, collection, serverTimestamp, arrayUnion 
} from 'firebase/firestore';
import { db } from '../firebase/config.js';

// Crear una sala en vivo por el administrador (normalizando preguntas e índices con compatibilidad total)
export async function createLiveSession(adminId, { categoryId, title, questions }) {
  const roomId = `live_${Date.now()}`;
  const roomRef = doc(db, 'liveRooms', roomId);

  // Normalizar las preguntas para asegurar que la respuesta correcta sea un número de índice exacto
  const normalizedQuestions = (questions || []).map((q) => {
    let correctIndex = 0;
    
    if (q.correctIndex !== undefined && q.correctIndex !== null) {
      correctIndex = Number(q.correctIndex);
    } else if (q.correctAnswer !== undefined && q.correctAnswer !== null) {
      correctIndex = Number(q.correctAnswer);
    } else if (q.correct !== undefined && q.correct !== null) {
      correctIndex = typeof q.correct === 'number' ? q.correct : Number(q.correct);
    } else if (q.answer !== undefined && q.answer !== null) {
      const textAns = String(q.answer).trim().toLowerCase();
      const foundIdx = (q.options || []).findIndex(opt => String(opt).trim().toLowerCase() === textAns);
      correctIndex = foundIdx !== -1 ? foundIdx : 0;
    } else if (q.correctOption !== undefined && q.correctOption !== null) {
      correctIndex = Number(q.correctOption);
    }

    return {
      ...q,
      correctIndex: isNaN(correctIndex) ? 0 : correctIndex,
    };
  });

  await setDoc(roomRef, {
    id: roomId,
    adminId,
    title: title || 'Concurso en Vivo',
    categoryId,
    status: 'waiting', // waiting, active, finished
    currentQuestionIndex: 0,
    questions: normalizedQuestions,
    participants: [],
    buzzerWinner: null, // UID del jugador que presionó primero
    lockedOut: [],      // Lista de UIDs que fallaron y están bloqueados en la pregunta actual
    lastAnswerResult: null, // Guardará el resultado de la última respuesta para el Admin
    questionActive: false,
    createdAt: serverTimestamp(),
  });

  return roomId;
}

// Suscribirse a los cambios de la sala en vivo (para jugadores y admin)
export function subscribeLiveRoom(roomId, onData, onError) {
  return onSnapshot(doc(db, 'liveRooms', roomId), (docSnap) => {
    if (docSnap.exists()) {
      onData({ id: docSnap.id, ...docSnap.data() });
    } else {
      onData(null);
    }
  }, onError);
}

// Unirse a la sala como jugador
export async function joinLiveRoom(roomId, user) {
  const roomRef = doc(db, 'liveRooms', roomId);
  const snap = await getDoc(roomRef);
  if (!snap.exists()) throw new Error('La sala no existe');

  const participants = snap.data().participants || [];
  const exists = participants.find((p) => p.uid === user.id);

  if (!exists) {
    await updateDoc(roomRef, {
      participants: arrayUnion({
        uid: user.id,
        name: user.name,
        avatar: user.avatar || '',
        score: 0,
      })
    });
  }
}

// Iniciar la partida (Admin)
export async function startLiveGame(roomId) {
  const roomRef = doc(db, 'liveRooms', roomId);
  await updateDoc(roomRef, {
    status: 'active',
    currentQuestionIndex: 0,
    buzzerWinner: null,
    lockedOut: [],
    lastAnswerResult: null,
    questionActive: true,
  });
}

// Presionar el Buzzer (Jugador) - ¡El primero en escribir su UID gana el turno!
export async function pressBuzzer(roomId, uid) {
  const roomRef = doc(db, 'liveRooms', roomId);
  const snap = await getDoc(roomRef);
  if (!snap.exists()) return false;

  const data = snap.data();
  // Si ya hay un ganador o la pregunta no está activa, o el usuario está bloqueado, no hace nada
  if (!data.questionActive || data.buzzerWinner || (data.lockedOut && data.lockedOut.includes(uid))) {
    return false;
  }

  // Reclamar el buzzer
  await updateDoc(roomRef, {
    buzzerWinner: uid,
    questionActive: false, // Pausamos la pregunta para que responda el ganador
  });

  return true;
}

// Responder (El ganador del buzzer responde)
export async function submitLiveAnswer(roomId, uid, isCorrect, points = 10) {
  const roomRef = doc(db, 'liveRooms', roomId);
  const snap = await getDoc(roomRef);
  if (!snap.exists()) return;

  const data = snap.data();
  const participants = data.participants || [];
  const userObj = participants.find(p => p.uid === uid);
  const userName = userObj ? userObj.name : 'Un jugador';

  if (isCorrect) {
    // Sumamos puntos al participante y registramos el acierto
    const updatedParticipants = participants.map((p) => 
      p.uid === uid ? { ...p, score: p.score + points } : p
    );
    await updateDoc(roomRef, {
      participants: updatedParticipants,
      buzzerWinner: null,
      questionActive: false,
      lastAnswerResult: {
        uid,
        userName,
        isCorrect: true,
        points,
      }
    });
  } else {
    // Si falló, bloqueamos a este usuario y registramos el fallo
    await updateDoc(roomRef, {
      lockedOut: arrayUnion(uid),
      buzzerWinner: null,
      questionActive: true, // Se reactiva el buzzer para los demás
      lastAnswerResult: {
        uid,
        userName,
        isCorrect: false,
        points: 0,
      }
    });
  }
}

// Avanzar a la siguiente pregunta (Admin)
export async function nextLiveQuestion(roomId) {
  const roomRef = doc(db, 'liveRooms', roomId);
  const snap = await getDoc(roomRef);
  if (!snap.exists()) return;

  const data = snap.data();
  const nextIndex = data.currentQuestionIndex + 1;

  if (nextIndex >= data.questions.length) {
    await updateDoc(roomRef, { status: 'finished', questionActive: false });
  } else {
    await updateDoc(roomRef, {
      currentQuestionIndex: nextIndex,
      buzzerWinner: null,
      lockedOut: [],
      lastAnswerResult: null, // Limpiamos el resultado para la nueva pregunta
      questionActive: true,
    });
  }
}

// 🛑 Finalizar la sala en cualquier momento (Admin)
export async function finishLiveSession(roomId) {
  const roomRef = doc(db, 'liveRooms', roomId);
  await updateDoc(roomRef, {
    status: 'finished',
    questionActive: false,
  });
}
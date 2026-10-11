import { initializeApp } from 'firebase/app';
import { getFirestore, doc, writeBatch } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

const firebaseConfig = {
  apiKey: "AIzaSyCKPeLs7l822ZoVg7L3JWjfj584A9dZMwc",
  authDomain: "pymes-palmer-pruebas.firebaseapp.com",
  projectId: "pymes-palmer-pruebas",
  storageBucket: "pymes-palmer-pruebas.firebasestorage.app",
  messagingSenderId: "240638641650",
  appId: "1:240638641650:web:f77df0a0c8bace2a1d976b"
};

const app = initializeApp(firebaseConfig);
// Apuntamos a la base de datos "default" que ya tienes creada
const db = getFirestore(app, "default");

async function importCSV() {
  const filePath = path.resolve('plantilla_preguntas.csv');
  if (!fs.existsSync(filePath)) {
    console.error("❌ No se encontró el archivo 'plantilla_preguntas.csv' en la raíz del proyecto.");
    process.exit(1);
  }

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const lines = fileContent.split('\n').filter(line => line.trim() !== '');
  const rows = lines.slice(1);

  console.log(`🚀 Iniciando importación de ${rows.length} preguntas en Firestore...`);

  const batch = writeBatch(db);
  let count = 0;

  for (let i = 0; i < rows.length; i++) {
    const cols = rows[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || rows[i].split(',');
    const cleanCols = cols.map(c => c.replace(/^"|"$/g, '').trim());
    
    const [categoria, tema, pregunta, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta, explicacion, dificultad, activo] = cleanCols;

    if (!pregunta) continue;

    let correctIdx = 0;
    const rc = (respuesta_correcta || 'A').toUpperCase();
    if (rc === 'B' || rc === '2') correctIdx = 1;
    else if (rc === 'C' || rc === '3') correctIdx = 2;
    else if (rc === 'D' || rc === '4') correctIdx = 3;

    const questionId = `seed_q_${String(i + 1).padStart(3, '0')}`;
    const docRef = doc(db, 'questions', questionId);

    batch.set(docRef, {
      id: questionId,
      categoryId: categoria || 'pymes',
      topicId: tema || 'general',
      question: pregunta,
      options: [opcion_a, opcion_b, opcion_c, opcion_d],
      correctAnswer: correctIdx,
      explanation: explicacion || '',
      difficulty: dificultad || 'media',
      active: (activo || 'si').toLowerCase() === 'si',
      createdAt: new Date()
    });
    count++;
  }

  await batch.commit();
  console.log(`✅ ¡Éxito! Se han importado ${count} preguntas correctamente a Firestore.`);
  process.exit(0);
}

importCSV().catch(err => {
  console.error("❌ Error durante la importación:", err);
  process.exit(1);
});
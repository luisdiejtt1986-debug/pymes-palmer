/**
 * Valores por defecto. Se usan SOLO como semilla inicial y como respaldo si el
 * documento `parameters/game` aún no existe. El juego lee siempre los valores
 * reales desde Firestore (ParamsContext).
 */

export const DEFAULT_XP_LADDER = [60, 80, 100, 130, 170, 220, 280, 350, 450, 600];

// Mismos tramos del HTML original: <=2 Explorador, <=4 Aprendiz, <=7 Estratega, <=10 Sabio, <=14 Mente Brillante, 15+ Leyenda
export const DEFAULT_LEVELS = [
  { from: 1, name: 'Explorador' },
  { from: 3, name: 'Aprendiz' },
  { from: 5, name: 'Estratega' },
  { from: 8, name: 'Sabio' },
  { from: 11, name: 'Mente Brillante' },
  { from: 15, name: 'Leyenda de la Cima' },
];

export const DEFAULT_PARAMS = {
  questionsAvailablePerTopic: 20,
  questionsPerGame: 10,
  timePerQuestion: 25,
  baseXP: 60,
  speedBonusEnabled: true,
  comboEnabled: true,
  showExplanation: true,
  allowRepeatQuestions: true,
  difficultyMode: 'normal', // normal | progresivo | aleatorio | adaptativo
  gameMode: 'evaluation', // modo por defecto: evaluation | learning
  lifelinesEnabled: true,
  lifelines: { fifty: true, audience: true, change: true },
  rankingEnabled: true,
  streakEnabled: true,
  // El HTML original terminaba la ronda al primer error ("subir la cima"). Aquí es opcional:
  // false = se juegan siempre todas las preguntas (por defecto, según el prompt maestro).
  endOnFirstMiss: false,
  levelFactor: 220, // XP acumulada para alcanzar el nivel n+1 = levelFactor * n^2
  levels: DEFAULT_LEVELS,
  xpLadder: DEFAULT_XP_LADDER,
};

export const DIFFICULTIES = ['facil', 'media', 'dificil'];
export const DIFFICULTY_LABEL = { facil: 'Fácil', media: 'Media', dificil: 'Difícil' };
export const DIFFICULTY_MODES = [
  { value: 'normal', label: 'Normal (filtra por la dificultad elegida)' },
  { value: 'progresivo', label: 'Progresivo (de fácil a difícil)' },
  { value: 'aleatorio', label: 'Aleatorio (ignora dificultad)' },
  { value: 'adaptativo', label: 'Adaptativo (según el nivel del jugador)' },
];

export const AVATARS = ['🦊', '🐼', '🦁', '🐯', '🦉', '🐙', '🚀', '🏔️', '⚡', '🧠', '🎯', '🌟'];

/** Logros: los 10 originales del HTML + algunos adicionales. Se siembran en Firestore y son editables. */
export const ACHIEVEMENT_METRICS = [
  { value: 'gamesPlayed', label: 'Partidas jugadas' },
  { value: 'perfectRounds', label: 'Partidas perfectas' },
  { value: 'totalCorrect', label: 'Respuestas correctas acumuladas' },
  { value: 'bestStreak', label: 'Mejor racha (días seguidos)' },
  { value: 'level', label: 'Nivel alcanzado' },
  { value: 'categoriesCount', label: 'Categorías distintas jugadas' },
  { value: 'fastAnswers', label: 'Respuestas rápidas correctas' },
  { value: 'accuracy', label: 'Precisión global (%) (mín. respuestas en minAnswered)' },
  { value: 'noLifelineGames', label: 'Partidas sin usar comodines' },
  { value: 'topicsMastered', label: 'Temas dominados (≥90 % con ≥10 respuestas)' },
];

export const DEFAULT_ACHIEVEMENTS = [
  { id: 'primer_reto', name: 'Primer Paso', icon: '🥾', description: 'Completa tu primer reto.', metric: 'gamesPlayed', threshold: 1 },
  { id: 'cima_perfecta', name: 'Cima Perfecta', icon: '🏔️', description: 'Acierta todas las preguntas de una partida.', metric: 'perfectRounds', threshold: 1 },
  { id: 'racha3', name: 'Constancia', icon: '🔥', description: 'Juega 3 días seguidos.', metric: 'bestStreak', threshold: 3 },
  { id: 'racha7', name: 'Inquebrantable', icon: '⚡', description: 'Juega 7 días seguidos.', metric: 'bestStreak', threshold: 7 },
  { id: 'erudito', name: 'Erudito', icon: '📚', description: 'Acumula 100 respuestas correctas.', metric: 'totalCorrect', threshold: 100 },
  { id: 'explorador', name: 'Explorador', icon: '🧭', description: 'Juega en 5 categorías distintas.', metric: 'categoriesCount', threshold: 5 },
  { id: 'nivel5', name: 'Mente en Ascenso', icon: '⛰️', description: 'Alcanza el nivel 5.', metric: 'level', threshold: 5 },
  { id: 'nivel10', name: 'Leyenda de la Cima', icon: '👑', description: 'Alcanza el nivel 10.', metric: 'level', threshold: 10 },
  { id: 'veterano', name: 'Veterano', icon: '🎖️', description: 'Completa 20 retos.', metric: 'gamesPlayed', threshold: 20 },
  { id: 'rayo', name: 'Reflejos de Rayo', icon: '💨', description: 'Responde correctamente con más del 80 % del tiempo restante.', metric: 'fastAnswers', threshold: 1 },
  // Adicionales
  { id: 'diez_retos', name: 'Diez Retos', icon: '🔟', description: 'Completa 10 partidas.', metric: 'gamesPlayed', threshold: 10 },
  { id: 'cinco_cimas', name: 'Cinco Cimas', icon: '🏆', description: 'Logra 5 partidas perfectas.', metric: 'perfectRounds', threshold: 5 },
  { id: 'sin_ayudas', name: 'Sin Ayudas', icon: '🛡️', description: 'Completa 3 partidas sin usar comodines.', metric: 'noLifelineGames', threshold: 3 },
  { id: 'precision_elite', name: 'Precisión de Élite', icon: '🎯', description: '90 % de precisión global con al menos 50 respuestas.', metric: 'accuracy', threshold: 90, minAnswered: 50 },
  { id: 'maestro_tema', name: 'Maestro del Tema', icon: '🎓', description: 'Domina un tema (≥90 % con ≥10 respuestas).', metric: 'topicsMastered', threshold: 1 },
];

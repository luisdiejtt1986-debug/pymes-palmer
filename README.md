# PYMES – PALMER

Plataforma de aprendizaje gamificada (trivia de crédito PYMES y metodología PALMER) construida a partir del archivo
`Juego de preguntas pymes-palmer.html`. Pasó de ser un juego local de un solo jugador a una aplicación web con
**cuentas, base de datos en la nube, ranking, progreso, repaso de errores y panel administrativo**.

- **Frontend:** React 18 + Vite (JavaScript), React Router.
- **Backend:** Firebase — Authentication (correo + contraseña), Cloud Firestore y Hosting. Sin servidor propio.
- **Diseño:** el del HTML original (glassmorphism, gradientes violeta/turquesa, Space Grotesk/Inter/JetBrains Mono, modo oscuro/claro).

---

## 1. Qué incluye

| Área | Funciones |
|---|---|
| **Jugador** | Registro/login/recuperar contraseña (sesión persistente), elegir categoría → tema → modo (Evaluación / Aprendizaje) → dificultad, partida con temporizador, comodines (50/50, Público, Cambiar), combos y bono de velocidad, XP, niveles, logros, resultados con recomendación, **continuar partida tras refrescar**, historial con detalle pregunta por pregunta, progreso (evolución, dominio por tema, índice de avance, semana), perfil (avatar, nombre, tema), **repaso inteligente de errores**, ranking con 7 criterios, comparar jugadores, retos 1 vs 1 por código. |
| **Administrador** | Dashboard, jugadores (activar/desactivar, ver progreso e historial), categorías, temas (con aviso "n / 20 preguntas"), preguntas (crear, editar, activar/desactivar, buscar, filtrar, ordenar, estadísticas y detección de problemáticas), partidas, ranking, logros, **parámetros del juego**, importar CSV/Excel con vista previa, exportar CSV/JSON/XLSX, auditoría. |
| **Seguridad** | `firestore.rules` valida el rol en el servidor; nada se confía al frontend. Categorías, temas y preguntas **nunca se borran** (se desactivan) para conservar el histórico. |

Todo valor de juego (tiempo, preguntas por partida, XP, comodines…) sale de Firestore (`parameters/game`), **nada está fijo en el código**.

---

## 2. Requisitos

- Node.js 18 o superior (probado con Node 22) y npm.
- Una cuenta de Google para crear un proyecto de Firebase (el plan gratuito *Spark* basta para empezar).
- Firebase CLI para desplegar: `npm install -g firebase-tools`.

## 3. Instalación

```bash
cd pymes-palmer
npm install
```

## 4. Configurar Firebase (una sola vez)

1. En <https://console.firebase.google.com> crea un proyecto.
2. **Authentication → Sign-in method →** habilita **Correo electrónico/contraseña**.
   (Para añadir Google u otros proveedores después, ver `src/services/authService.js`.)
3. **Firestore Database → Crear base de datos** (modo producción; elige la región más cercana a tus usuarios).
4. **Configuración del proyecto → Tus apps → Web (`</>`)**: registra la app y copia la configuración del SDK.
5. Crea tu `.env`:

   ```bash
   cp .env.example .env
   ```

   y pega los valores en las variables `VITE_FIREBASE_*`. Estos valores identifican el proyecto y no son secretos;
   **la seguridad real la dan las Security Rules**. No subas `.env` ni claves de cuenta de servicio al repositorio
   (`.gitignore` ya los excluye).
6. Enlaza el proyecto con la CLI:

   ```bash
   firebase login
   cp .firebaserc.example .firebaserc      # y edita "TU-PROYECTO-FIREBASE" con tu ID de proyecto
   # (alternativa: firebase use --add)
   ```

   `firebase.json` ya está configurado (Hosting, reglas e índices): **no necesitas `firebase init`**.
   Si lo ejecutas, responde *No* cuando pregunte si sobrescribe `firestore.rules`, `firestore.indexes.json` o `firebase.json`.

## 5. Reglas e índices de Firestore (obligatorio antes de usar la app)

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

Sin esto verás errores `permission-denied` o `failed-precondition` (falta un índice).
Los índices pueden tardar unos minutos en construirse.

## 6. Ejecutar en local

```bash
npm run dev          # http://localhost:5173
```

Si falta el `.env`, la app muestra una pantalla indicando cómo configurarlo.

## 7. Crear el primer administrador

No hay contraseñas de administrador en el código. Procedimiento:

1. Regístrate en la app (`/register`) con el correo que será administrador (o créalo en *Authentication → Users*).
2. Convierte esa cuenta en administrador con **una** de estas dos opciones:

   **Opción A – Script (recomendada, aplica custom claim + rol):**
   1. Firebase Console → Configuración del proyecto → *Cuentas de servicio* → *Generar nueva clave privada*. Guárdala como `serviceAccountKey.json` (fuera del repo).
   2. ```bash
      GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json npm run set-admin -- tu@correo.com
      ```
      (PowerShell: `$env:GOOGLE_APPLICATION_CREDENTIALS="./serviceAccountKey.json"; npm run set-admin -- tu@correo.com`)
   3. Para retirar el rol: añade `--remove`.

   **Opción B – A mano en la consola:** Firestore → colección `users` → documento de esa persona (su UID) → cambia `role` de `player` a `admin`.
   (La consola no está sujeta a las reglas.)
3. Cierra sesión y vuelve a entrar. Aparecerá el acceso **⚙️ Admin**.

Las reglas aceptan el rol `admin` guardado en `users/{uid}` **o** el custom claim `admin: true`. Un jugador no puede modificar su propio rol (lo impide la regla, no solo la interfaz).

## 8. Cargar los datos iniciales

Con la cuenta de administrador: **Admin → Dashboard → "Cargar datos iniciales"**. Crea:

- Parámetros (`parameters/game`): 20 preguntas por banco, 10 por partida, 25 s, 60 XP base, bono de velocidad, combo, explicación, comodines, ranking y rachas activos.
- Los 10 logros originales + 5 adicionales.
- Categorías **PYMES** y **PALMER** con sus temas, y las **45 preguntas del HTML original**.

Es seguro repetirlo: no sobrescribe nada existente ni tus ediciones.

### Sobre la migración de preguntas

- El **texto, las 4 alternativas y la respuesta correcta** de las 45 preguntas se copiaron tal cual; una prueba automática (`tests/seed.test.js`) las compara con el HTML original.
- El HTML original **no tenía** tema, dificultad ni explicación, así que **no se inventaron**: cada pregunta migrada queda con tema asignado por afinidad temática y dificultad `media`, marcadas `provisional: true` (etiqueta "Provisional" en el panel) y **sin explicación**. Edítalas desde *Admin → Preguntas*.
- Las 25 preguntas de relleno (Prueba 1–4, Naturaleza, Tecnología) van a la categoría **"Cultura general (demo)"**, sembrada **desactivada** para no mezclarlas con el contenido de crédito. Actívala si la quieres.

## 9. Probar

```bash
npm test             # 38 pruebas unitarias: puntuación, niveles, selección, importación, migración
npm run test:rules   # pruebas de Security Rules (requiere Java + Firebase CLI; levanta el emulador)
```

> ⚠️ `npm run test:rules` **no se pudo ejecutar** donde se generó el proyecto (sin acceso de red al emulador).
> Córrelo una vez localmente antes de producción.

## 10. Compilar y desplegar

```bash
npm run build
firebase deploy                       # reglas + índices + hosting
# o por partes:
firebase deploy --only hosting
```

Hosting reescribe todas las rutas a `index.html` (SPA) y cachea los assets con hash.

---

## 11. Parámetros (Admin → Parámetros)

| Parámetro | Valor inicial | Efecto |
|---|---|---|
| `questionsAvailablePerTopic` | 20 | Tamaño **recomendado** del banco por tema. Solo genera la advertencia "n / 20"; nunca bloquea el juego. |
| `questionsPerGame` | 10 | Preguntas por partida. |
| `timePerQuestion` | 25 | Segundos por pregunta (se copia a cada partida al iniciarla). |
| `baseXP`, `xpLadder`, `levelFactor`, `levels` | 60, escalera original, 220, 6 rangos | Puntuación y niveles. |
| `speedBonusEnabled`, `comboEnabled` | activos | Bonos de puntuación. |
| `showExplanation` | sí | Muestra la explicación tras responder. |
| `allowRepeatQuestions` | sí | Si no, se priorizan siempre las nunca vistas. |
| `difficultyMode` | normal | normal · progresivo · aleatorio · adaptativo. |
| `lifelinesEnabled` + 3 individuales | activos | 50/50, Público, Cambiar. |
| `rankingEnabled`, `streakEnabled` | activos | |
| `endOnFirstMiss` | no | Si se activa, la partida termina al primer error (como el HTML original). |

Cada cambio se guarda en `auditLogs` con quién, qué, valor anterior, valor nuevo y fecha.

## 12. Reglas de juego (centralizadas en `src/utils/game.js`)

**Puntos por respuesta correcta** (nunca negativos; incorrecta o timeout = 0):

```
base          = baseXP × (xpLadder[i] / xpLadder[0])      → con 60 reproduce 60, 80, 100 … 600 del original
bonoVelocidad = base × 0.5 × (tiempoRestante / tiempoTotal)  (si speedBonusEnabled)
bonoCombo     = base × 0.10 × min(combo − 1, 5)              (si comboEnabled)
puntos = base + bonoVelocidad + bonoCombo        XP ganada = suma de puntos
```

Con ambos bonos desactivados el puntaje es idéntico al del HTML original.

**Nivel:** XP acumulada necesaria para superar el nivel *n* = `levelFactor × n²` (220·n², igual que el original).

**Dominio por tema:** correctas ÷ respuestas → 90-100 *Dominado* · 75-89 *Buen dominio* · 60-74 *En desarrollo* · 0-59 *Necesita práctica*. Solo se muestran temas con respuestas reales.

**Índice de avance** (premia la mejora, no solo el XP; se calcula desde la 4.ª partida): compara las primeras 3 partidas con el rendimiento reciente → `0.35·Δprecisión + 0.25·Δdominio por tema + 0.25·Δpuntaje promedio + 0.15·niveles ganados`.

**Selección de preguntas** (`src/utils/selection.js`): activas → filtros → historial del jugador → prioridad (+3 nunca vista, +2.5×tasa de error, −2 si se mostró en 24 h, azar) → N distintas → se mezclan preguntas y alternativas. **Repaso:** solo falladas que no se han acertado 2 veces seguidas, las más falladas primero. **Adaptativo:** más difíciles si el jugador acierta ≥ 80 %.

**Idempotencia:** finalizar una partida es una transacción que primero comprueba `completed`; las respuestas y logros usan IDs deterministas (`gameId_n`, `uid_logro`) y las reglas solo permiten crearlos. Refrescar o pulsar dos veces no duplica XP, logros ni estadísticas.

## 13. Importar preguntas

*Admin → Importar preguntas* (CSV o Excel). Columnas:

`categoria, tema, pregunta, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta, explicacion, dificultad, activo`

- `respuesta_correcta`: `A`–`D`, `1`–`4` o el texto exacto de la opción.
- `dificultad`: `facil`, `media` o `dificil`. `activo`: `si`/`no`.
- Muestra vista previa, total, válidas, errores y duplicados; **solo se importan las válidas**, tras confirmar.
- Opción "Crear categorías y temas que no existan". Hay una plantilla descargable.

## 14. Modelo de datos (Firestore)

```
users/{uid}                 perfil privado (+ subcolecciones topicStats, questionStats, activeGame)
publicProfiles/{uid}        datos mínimos para ranking/comparar (sin correo)
categories, topics          contenido (active=false en lugar de borrar)
questions                   con contadores timesShown/Answered/Correct/Timeout
games, answers              historial (answers/{gameId_n} con copia del texto de la pregunta)
parameters/game            configuración central
achievements, userAchievements/{uid_logro}
challenges                  retos 1 vs 1 por código
auditLogs                   acciones administrativas
```

## 15. Estructura del proyecto

```
src/
  admin/        pantallas del panel administrativo (carga diferida)
  components/   Ui, Charts (SVG), GameRunner, XpBar, Guards…
  context/      Auth, Params (Firestore en tiempo real), Theme, Toast
  data/         defaults.js y seedData.js (migrado del HTML)
  firebase/     config.js (variables de entorno)
  hooks/        useAsync, useCatalog
  layouts/      PlayerLayout, AdminLayout
  pages/        pantallas del jugador
  services/     auth, user, category, topic, question, game, answer, parameter,
                achievement, ranking, analytics, challenge, audit, seed, export
  styles/       global.css (tokens del HTML original)
  utils/        game.js (fórmulas), selection.js, csv.js, importValidation.js
scripts/set-admin.mjs · tests/ · tests-rules/
firestore.rules · firestore.indexes.json · firebase.json · .env.example
original-Juego_de_preguntas_pymes-palmer.html   (archivo fuente, solo referencia/pruebas)
```

Rutas: `/login /register /dashboard /play /results/:id /profile /history /progress /ranking /review /challenge /compare`
y `/admin/{dashboard,users,categories,topics,questions,games,ranking,achievements,parameters,import,export,audit}`.

---

## 16. Decisiones y diferencias respecto al HTML original

- **Fin de partida:** el original terminaba la ronda al primer error. Como el prompt pide 10 preguntas por partida con conteo de incorrectas/timeouts y modo aprendizaje, la opción por defecto es jugar **todas** las preguntas; el comportamiento original está disponible con `endOnFirstMiss`.
- **Contraste en modo claro:** se oscurecieron ligeramente `--text-2`, `--teal`, `--gold` y `--coral` del tema claro para cumplir accesibilidad (contraste). El resto de tokens es idéntico.
- **Racha:** usa la fecha **local** del jugador (el original usaba UTC, lo que podía romper rachas de noche).
- **"Reflejos de Rayo":** el original pedía "más de 20 s restantes" (con 25 s). Ahora es "más del 80 % del tiempo", equivalente y válido si cambias el tiempo.

## 17. Limitaciones conocidas (leer antes de producción)

1. **El XP/nivel/logros se calculan en el navegador** (dentro de una transacción). Las reglas acotan los incrementos por partida, impiden cambiar rol/estado y bloquean duplicados, pero un usuario técnico podría falsear su propio puntaje dentro de esos márgenes. Para competencias con premios, mueve `finishGame` a una **Cloud Function** (requiere plan Blaze). La arquitectura ya está separada en `services/gameService.js` para facilitarlo.
2. **Las reglas de seguridad no se ejecutaron** en el entorno de desarrollo (ver §9). Hay una batería lista en `tests-rules/`.
3. **El flujo con Firebase real no se probó de extremo a extremo** (no había proyecto ni credenciales): se verificó compilación, 38 pruebas unitarias, renderizado de acceso/registro, protección de rutas y diseño móvil/escritorio en un navegador real. Haz una pasada completa tras configurar tu proyecto: registrar → jugar → ver resultado → entrar como admin.
4. Los retos 1 vs 1 son **asincrónicos por código** (no tiempo real); la estructura admite evolucionar a tiempo real.
5. Las listas administrativas cargan hasta 2.000 preguntas / 200 partidas y paginan en el cliente; para volúmenes mayores conviene paginar en servidor.
6. El código de Excel (`xlsx`) se carga solo al importar/exportar (chunk aparte de ~430 KB).

## 18. Solución de problemas

| Síntoma | Causa / solución |
|---|---|
| `Missing or insufficient permissions` | Falta desplegar `firestore.rules`, o la cuenta está desactivada. |
| `The query requires an index` | `firebase deploy --only firestore:indexes` y espera a que termine de construirse. |
| No aparece el menú Admin | Cierra sesión y vuelve a entrar tras asignar el rol; revisa `users/{uid}.role`. |
| "No hay preguntas activas" al jugar | Carga los datos iniciales (§8) o crea contenido; revisa que categoría/tema/pregunta estén activos. |
| Pantalla "Falta configurar Firebase" | Falta `.env`; reinicia `npm run dev` tras crearlo. |

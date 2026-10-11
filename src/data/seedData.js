/**
 * Datos migrados desde "Juego de preguntas pymes-palmer.html".
 *
 * Qué viene del archivo original:
 *   - El texto de cada pregunta, sus 4 alternativas y cuál es la correcta (campos cat/q/opts/correct).
 *   - Las categorías PYMES y PALMER.
 *
 * Qué es PROVISIONAL (el HTML original no lo traía) — marcado con `provisional: true`
 * y editable desde el panel de administración:
 *   - El tema (topic) de cada pregunta.
 *   - La dificultad ("media" para todas).
 *   - La explicación (vacía: no se inventa contenido).
 *   - Las 25 preguntas de relleno (Prueba 1-4, Naturaleza, Tecnología) se agrupan en la categoría
 *     "Cultura general (demo)", que se siembra DESACTIVADA para que no mezcle con el contenido de crédito.
 */

export const SEED_CATEGORIES = [
  { id: 'pymes', name: 'PYMES', description: 'Crédito productivo PYMES: segmentos, análisis financiero y flujo de caja.', icon: '🏢', color: '#7c6cf6', order: 1, active: true },
  { id: 'palmer', name: 'PALMER', description: 'Metodología PALMER: módulos, indicadores y estructuras de información.', icon: '📊', color: '#22e0c4', order: 2, active: true },
  { id: 'demo', name: 'Cultura general (demo)', description: 'Preguntas de relleno del HTML original (Prueba 1-4, Naturaleza, Tecnología). Desactivada por defecto.', icon: '🎲', color: '#ffc861', order: 99, active: false },
];

export const SEED_TOPICS = [
  { id: 'segmentos-cartera', categoryId: 'pymes', name: 'Segmentos y clasificación de cartera', order: 1 },
  { id: 'evaluacion-productivo', categoryId: 'pymes', name: 'Evaluación del crédito productivo', order: 2 },
  { id: 'liquidez', categoryId: 'pymes', name: 'Liquidez y balance', order: 3 },
  { id: 'endeudamiento', categoryId: 'pymes', name: 'Endeudamiento', order: 4 },
  { id: 'flujo-caja', categoryId: 'pymes', name: 'Flujo de caja y capacidad de pago', order: 5 },
  { id: 'modulos-palmer', categoryId: 'palmer', name: 'Módulos e indicadores PALMER', order: 1 },
  { id: 'estructuras-informacion', categoryId: 'palmer', name: 'Estructuras de información (C01, C02, S01, D01)', order: 2 },
  { id: 'solvencia-apr', categoryId: 'palmer', name: 'Solvencia y activos ponderados por riesgo', order: 3 },
  { id: 'prueba-1', categoryId: 'demo', name: 'Prueba 1', order: 1, active: false },
  { id: 'prueba-2', categoryId: 'demo', name: 'Prueba 2', order: 2, active: false },
  { id: 'prueba-3', categoryId: 'demo', name: 'Prueba 3', order: 3, active: false },
  { id: 'prueba-4', categoryId: 'demo', name: 'Prueba 4', order: 4, active: false },
  { id: 'naturaleza', categoryId: 'demo', name: 'Naturaleza', order: 5, active: false },
  { id: 'tecnologia', categoryId: 'demo', name: 'Tecnología', order: 6, active: false },
].map((t) => ({
  description: 'Tema provisional asignado durante la migración del HTML original.',
  icon: '📘',
  difficulty: 'media',
  active: true,
  provisional: true,
  ...t,
}));

// [categoryId, topicId, pregunta, opciones, índice correcto]  (texto tomado literalmente del HTML)
const RAW = [
  ['pymes', 'segmentos-cartera', '¿En cuántos segmentos se clasifica la cartera de crédito de las entidades de los sectores financiero público y privado?', ['5 segmentos', '6 segmentos', '7 segmentos', '8 segmentos'], 2],
  ['pymes', 'segmentos-cartera', '¿Cuál de las siguientes opciones corresponde a los segmentos en los que se divide la cartera de crédito?', ['Productivo, consumo, comercial, vivienda, microcrédito, educativo y inversión pública.', 'Productivo, consumo, inmobiliario, vivienda de interés social y público, microcrédito, educativo e inversión pública.', 'Productivo, consumo, hipotecario, comercial, microcrédito, educativo e inversión pública.', 'Productivo, comercial, vivienda, microempresa, educativo, inversión pública y empresarial.'], 1],
  ['pymes', 'segmentos-cartera', '¿Cuál de las siguientes condiciones corresponde a un Crédito Productivo?', ['Personas naturales o jurídicas con ventas anuales de hasta USD 300.000.', 'Personas naturales o jurídicas con ventas anuales superiores a USD 300.000, destinado a actividades productivas y comerciales.', 'Personas naturales o jurídicas con ventas anuales superiores a USD 1.500.000.', 'Únicamente personas jurídicas con ventas superiores a USD 7.000.000.'], 1],
  ['pymes', 'segmentos-cartera', 'Una empresa registra ventas anuales de USD 1.200.000 y solicita un crédito destinado a una actividad productiva. ¿En qué subsegmento de crédito productivo debería clasificarse?', ['Productivo Corporativo', 'Productivo Empresarial', 'Productivo PYMES', 'Crédito de Consumo'], 2],
  ['pymes', 'evaluacion-productivo', '¿Cuáles son los principales elementos que se deben analizar para evaluar un crédito productivo?', ['Capacidad de producción, nivel de ventas y garantías ofrecidas.', 'Capacidad de pago y situación financiera del deudor, experiencia de pago y riesgo de entorno económico.', 'Historial de ventas, patrimonio y referencias comerciales.', 'Garantías, nivel de endeudamiento y destino del crédito.'], 1],
  ['pymes', 'liquidez', 'Una empresa presenta Activo Corriente de USD 180.000 y Pasivo Corriente de USD 120.000. ¿Cuál es su Ratio de Liquidez y qué indica este resultado?', ['0,67; la empresa no puede cubrir sus obligaciones de corto plazo.', '1,50; la empresa dispone de USD 1,50 de activos corrientes por cada USD 1,00 de pasivo corriente.', '2,50; existe exceso de endeudamiento.', '0,50; la empresa tiene alta rentabilidad.'], 1],
  ['pymes', 'liquidez', '¿Cuál de las siguientes cuentas forma parte del Activo Corriente de una empresa?', ['Maquinaria y equipo.', 'Edificios.', 'Cuentas por cobrar e inventarios.', 'Préstamos bancarios de largo plazo.'], 2],
  ['pymes', 'endeudamiento', 'Una empresa registra Activos Totales por USD 1.000.000 y Pasivos Totales por USD 600.000. ¿Cuál es su Razón de Endeudamiento y cómo debería interpretarse?', ['40%; la empresa no tiene endeudamiento significativo.', '60%; el 60% de los activos está financiado mediante pasivos, representando un nivel elevado de endeudamiento.', '60%; significa que el 60% de los activos corresponde al patrimonio.', '40%; significa que el 40% de los activos está financiado por terceros.'], 1],
  ['pymes', 'flujo-caja', '¿Cuál es el principal objetivo de analizar el flujo de caja de una empresa al evaluar una solicitud de crédito?', ['Determinar únicamente el nivel de ventas de la empresa.', 'Conocer exclusivamente la utilidad contable del negocio.', 'Determinar si la empresa genera suficientes recursos de efectivo para cubrir sus obligaciones y el pago del crédito.', 'Determinar únicamente el valor de los activos fijos de la empresa.'], 2],
  ['pymes', 'flujo-caja', '¿Qué indica una razón cuota elevada dentro del análisis del flujo de caja?', ['Que la empresa tiene mayor liquidez.', 'Que la empresa genera mayores utilidades.', 'Que una mayor proporción del flujo disponible está comprometida con el pago de la cuota, lo que puede aumentar el riesgo de incumplimiento.', 'Que la empresa tiene un mayor nivel de patrimonio.'], 2],
  ['palmer', 'modulos-palmer', '¿Cuál de las siguientes opciones representa correctamente los componentes-módulos evaluados por la metodología PALMER?', ['Patrimonio, Activos, Liquidez, Manejo Administrativo, Manejo Financiero y Rentabilidad.', 'Patrimonio, Administración, Liquidez, Mercado, Endeudamiento y Riesgo.', 'Activos, Pasivos, Patrimonio, Ingresos, Gastos y Rentabilidad.', 'Liquidez, Solvencia, Morosidad, Rentabilidad, Gobernanza y Riesgo.'], 0],
  ['palmer', 'modulos-palmer', '¿Cuál de los siguientes indicadores pertenece al módulo de Patrimonio de la metodología PALMER?', ['Índice de Liquidez General', 'Rentabilidad sobre el Patrimonio', 'Solvencia', 'Dependencia de Spread'], 2],
  ['palmer', 'modulos-palmer', '¿Qué módulo de PALMER analiza aspectos como la morosidad, cobertura de cartera improductiva y proporción de activos improductivos?', ['Patrimonio', 'Activos', 'Liquidez', 'Rentabilidad'], 1],
  ['palmer', 'modulos-palmer', "Según la metodología PALMER, ¿a qué módulo pertenece el indicador 'Eficiencia Institucional'?", ['Patrimonio', 'Liquidez', 'Manejo Administrativo', 'Rentabilidad'], 2],
  ['palmer', 'estructuras-informacion', '¿Cuál es la principal diferencia entre las estructuras C01 y C02?', ['C01 corresponde a depósitos y C02 a socios.', 'C01 presenta la cartera otorgada en el período, mientras C02 permite analizar la cartera acumulada.', 'C01 corresponde a patrimonio y C02 a liquidez.', 'No existe diferencia entre ambas estructuras.'], 1],
  ['palmer', 'estructuras-informacion', '¿Qué información proporciona principalmente la estructura S01?', ['Información sobre la cartera de crédito.', 'Información sobre los depósitos.', 'Información relacionada con la estructura y composición de los socios.', 'Información sobre los activos ponderados por riesgo.'], 2],
  ['palmer', 'estructuras-informacion', '¿Qué información proporciona principalmente la estructura D01?', ['La estructura de depósitos de la cooperativa.', 'La cartera acumulada.', 'La estructura de socios.', 'La rentabilidad institucional.'], 0],
  ['palmer', 'estructuras-informacion', 'Para analizar indicadores relacionados con la calidad, composición y comportamiento de la cartera de crédito dentro de la metodología PALMER, ¿qué estructura constituye una fuente importante de información?', ['S01', 'D01', 'C02', 'Formulario de Solvencia'], 2],
  ['palmer', 'solvencia-apr', '¿Qué información o reporte debería utilizarse principalmente para analizar el nivel de solvencia de una cooperativa?', ['Estructura S01', 'Estructura C01', 'Formulario de Solvencia e información relacionada con los activos ponderados por riesgo.', 'Estructura D01 exclusivamente.'], 2],
  ['palmer', 'solvencia-apr', '¿Cuál es la finalidad principal del informe de Activos Ponderados por Riesgo dentro del análisis financiero de una cooperativa?', ['Determinar la cantidad de socios activos.', 'Determinar la cartera otorgada durante el mes.', 'Proporcionar información para evaluar la exposición al riesgo de los activos y su relación con la solvencia.', 'Determinar el monto de depósitos a plazo.'], 2],
  // ---- Relleno del HTML original (categoría demo, desactivada) ----
  ['demo', 'prueba-1', '¿Cuál es el hueso más largo del cuerpo humano?', ['Húmero', 'Fémur', 'Tibia', 'Radio'], 1],
  ['demo', 'prueba-1', "¿Qué planeta es conocido como el 'planeta rojo'?", ['Júpiter', 'Venus', 'Marte', 'Saturno'], 2],
  ['demo', 'prueba-1', '¿Cuál es el elemento químico más abundante en el universo?', ['Oxígeno', 'Hidrógeno', 'Carbono', 'Helio'], 1],
  ['demo', 'prueba-1', '¿Qué órgano produce la insulina?', ['Hígado', 'Riñón', 'Páncreas', 'Bazo'], 2],
  ['demo', 'prueba-1', '¿A qué velocidad viaja la luz aproximadamente?', ['300.000 km/s', '150.000 km/s', '1.000.000 km/s', '30.000 km/s'], 0],
  ['demo', 'prueba-2', "¿Quién pintó 'La noche estrellada'?", ['Monet', 'Van Gogh', 'Dalí', 'Picasso'], 1],
  ['demo', 'prueba-2', '¿De qué país es originario el tango?', ['España', 'México', 'Argentina', 'Brasil'], 2],
  ['demo', 'prueba-2', "¿Quién compuso 'Las cuatro estaciones'?", ['Mozart', 'Bach', 'Vivaldi', 'Beethoven'], 2],
  ['demo', 'prueba-2', '¿Qué movimiento artístico fundó Salvador Dalí junto a otros?', ['Cubismo', 'Surrealismo', 'Impresionismo', 'Futurismo'], 1],
  ['demo', 'prueba-3', '¿Cada cuántos años se celebran los Juegos Olímpicos de verano?', ['2', '3', '4', '5'], 2],
  ['demo', 'prueba-3', "¿En qué deporte se usa el término 'jaque mate'?", ['Damas', 'Ajedrez', 'Go', 'Backgammon'], 1],
  ['demo', 'prueba-3', '¿Cuántos jugadores tiene un equipo de fútbol en cancha?', ['9', '10', '11', '12'], 2],
  ['demo', 'prueba-3', '¿En qué país nació el baloncesto?', ['Estados Unidos', 'Canadá', 'Reino Unido', 'Francia'], 0],
  ['demo', 'prueba-4', '¿Qué instrumento toca tradicionalmente un mariachi como melodía principal?', ['Trompeta', 'Violín', 'Guitarrón', 'Vihuela'], 1],
  ['demo', 'prueba-4', '¿Cuál es el museo de animación más conocido fundado por Hayao Miyazaki?', ['Studio Ghibli', 'Pixar', 'Toei Animation', 'Aardman'], 0],
  ['demo', 'prueba-4', '¿Qué premio reconoce lo mejor del cine cada año en EE.UU.?', ['Grammy', 'Óscar', 'Emmy', 'Tony'], 1],
  ['demo', 'prueba-4', '¿Cuál es el instrumento principal de un cuarteto de cuerdas?', ['Violín', 'Piano', 'Flauta', 'Trompeta'], 0],
  ['demo', 'naturaleza', '¿Cuál es el animal terrestre más grande del mundo?', ['Jirafa', 'Elefante africano', 'Rinoceronte', 'Hipopótamo'], 1],
  ['demo', 'naturaleza', '¿Qué porcentaje aproximado de la superficie terrestre cubre el agua?', ['50%', '60%', '71%', '85%'], 2],
  ['demo', 'naturaleza', '¿Cuál es el ave más rápida en vuelo en picado?', ['Águila real', 'Halcón peregrino', 'Cóndor', 'Colibrí'], 1],
  ['demo', 'naturaleza', "¿Qué selva es considerada el 'pulmón del planeta'?", ['Selva del Congo', 'Amazonía', 'Selva Negra', 'Daintree'], 1],
  ['demo', 'tecnologia', "¿Qué significa la sigla 'CPU'?", ['Central Process Unit', 'Central Processing Unit', 'Computer Personal Unit', 'Core Processing Unit'], 1],
  ['demo', 'tecnologia', '¿Quién es considerado cofundador de Apple junto a Steve Jobs?', ['Bill Gates', 'Steve Wozniak', 'Elon Musk', 'Larry Page'], 1],
  ['demo', 'tecnologia', '¿Qué lenguaje se usa principalmente para dar estilo a páginas web?', ['HTML', 'CSS', 'SQL', 'JSON'], 1],
  ['demo', 'tecnologia', "¿Qué significa 'IA' en tecnología?", ['Internet Avanzado', 'Inteligencia Artificial', 'Interfaz Automática', 'Información Aplicada'], 1],
];

export const SEED_QUESTIONS = RAW.map(([categoryId, topicId, question, options, correctAnswer], i) => ({
  id: `seed_q_${String(i + 1).padStart(3, '0')}`,
  categoryId,
  topicId,
  question,
  options,
  correctAnswer,
  explanation: '', // el HTML original no traía explicaciones
  difficulty: 'media', // PROVISIONAL
  active: categoryId !== 'demo',
  provisional: true,
  source: 'html-original',
}));

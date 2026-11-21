/*
  sensor_agua.ino - Indicador de temblores (maqueta) con sensor de nivel de agua.

  Idea: el agua cubre un poco el sensor. Al temblar, el agua sube y baja por el sensor.
  El sketch mide la VARIACION de la lectura en una ventana de tiempo corta
  (maximo - minimo en los ultimos 0.6 s). No necesita "base":
    - agua quieta            -> variacion ~0-3  -> todo apagado
    - movimiento constante   -> variacion alta todo el tiempo -> sigue detectando
    - el agua queda mas alta o mas baja despues -> no importa
  Ademas suma los cambios entre lecturas seguidas ("actividad"), para que siga
  midiendo bien despues del primer golpe, cuando el sensor ya esta mojado y la
  lectura cambia menos aunque el agua se mueva igual o mas.

  Niveles segun la VARIACION (solo se prende el LED de ese nivel):
    0: quieto, todo apagado        3: LED3
    1: LED1                        4: LED4
    2: LED2                        5: LED4 + BUZZER (alarma)

  - Mide ~50 veces por segundo, retiene el nivel maximo unos segundos y luego baja.
  - Cuenta oscilaciones (vaivenes del agua), mide la duracion de cada temblor
    e imprime un resumen al final.

  Conexiones:
    Sensor  S (blanco) -> A0   |  + (rojo) -> 5V  |  - (naranja) -> GND
    LEDs con resistencia de 220 ohm, catodo (pata corta) a GND
    Buzzer: pin indicado abajo, la otra pata a GND

  Comandos por Monitor Serie (9600 baudios):
    1..5 -> usa la variacion maxima del ULTIMO temblor como umbral de ese nivel
            (haz un temblor de la intensidad deseada, espera el resumen y escribe el numero)
    v    -> muestra los umbrales
    r    -> restaura los umbrales por defecto
    s    -> muestra el resumen del ultimo temblor
    p    -> prueba de pines: cada salida parpadea tantas veces como su numero de pin
    h    -> muestra la ayuda
    d    -> modo datos (para el panel web): envia una linea compacta por cada lectura
    t    -> vuelve al modo texto
    u10,16,23,31,40 + Enter -> fija los 5 umbrales de una vez
    m    -> la alarma toca la melodia (se guarda en la EEPROM)
    b    -> la alarma hace el pitido continuo (por defecto)

  Protocolo del modo datos (una linea por mensaje):
    D<lectura>,<variacion>,<nivel>,<flags>   cada 20 ms (flags: bit0 = buzzer, bit1 = temblor en curso)
    E1                                       empieza un temblor
    E0,<duracion ms>,<oscilaciones>,<nivel max>,<variacion max>,<lectura min>,<lectura max>
    U<n1>,<n2>,<n3>,<n4>,<n5>,<histeresis>,<ventana ms>
    S<0|1>                                   sonido de la alarma: 0 = pitido, 1 = melodia
    Cualquier otra linea es texto informativo.
*/

#include <EEPROM.h>

// ----------------- CONFIGURACION (cambia aqui) -----------------
const uint8_t PIN_SENSOR = A0;
const uint8_t PINES_LED[4] = {13, 12, 11, 10};  // LED nivel 1, 2, 3, 4
const uint8_t PIN_BUZZER   = 9;                // suena en el nivel 5 (alarma maxima)

// true  = buzzer pasivo (necesita frecuencia, usa tone()).
// false = buzzer activo (suena solo con 5V, usa digitalWrite()).
const bool     BUZZER_PASIVO  = true;
const uint16_t BUZZER_FREQ_HZ = 2000;   // tono del pitido continuo (opcion por defecto)

// Melodia opcional de la alarma (se activa con el comando 'm' o desde el panel web).
// Necesita buzzer pasivo; con uno activo solo suena un pitido continuo.
const uint8_t  NIVEL_ALARMA     = 5;    // nivel desde el que suena el buzzer
// Notas: D4 = 294, G4 = 392, A4 = 440, B4 = 494, C5 = 523, E5 = 659 Hz
const uint8_t  NOTAS_MELODIA    = 33;
const uint16_t MELODIA_HZ[NOTAS_MELODIA] = {
  294, 440, 523, 523, 523, 659, 440, 440, 440, 494,  // frase 1: D4 A4 C5 C5 C5 E5 A4 A4 A4 B4
  392, 392, 392, 494, 523, 494, 494, 440,            // frase 2: G4 G4 G4 B4 C5 B4 B4 A4
  523, 523, 523, 659, 440, 440, 440, 494,            // frase 3: C5 C5 C5 E5 A4 A4 A4 B4
  392, 392, 494, 523, 494, 494, 440                  // frase 4: G4 G4 B4 C5 B4 B4 A4
};
const uint16_t MELODIA_MS[NOTAS_MELODIA] = {    // duracion de cada nota
  144, 144, 130, 130, 144, 288, 130, 130, 144, 577,
  130, 130, 144, 288, 288, 130, 144, 577,
  130, 130, 144, 288, 130, 130, 144, 577,
  130, 144, 288, 288, 130, 144, 577
};
const uint16_t DESCANSO_MS[NOTAS_MELODIA] = {   // silencio despues de cada nota
    0,   0,  14,  14,   0,   0,  14,  14,   0, 144,
   14,  14,   0,   0,   0,  14,   0, 144,
   14,  14,   0,   0,  14,  14,   0, 144,
   14,   0,   0,   0,  14,   0,   0
};
const uint16_t PAUSA_MELODIA_MS  = 500; // pausa antes de repetir la melodia

// Variacion (maximo - minimo en la ventana) para cada nivel. En reposo es ~0-3.
const int      UMBRALES_DEFECTO[5] = {10, 16, 22, 28, 34};
const int      HISTERESIS      = 3;    // puntos por debajo del umbral para apagar
const float    FACTOR_CALIB    = 0.8;  // al calibrar: umbral = 80% de la variacion maxima

// Medicion con mucho movimiento (sensor ya mojado):
const int      RUIDO            = 4;    // cambios entre lecturas <= a esto se ignoran
const float    FACTOR_ACTIVIDAD = 0.6;  // peso de la "actividad" (sube si aun mide poco, baja si mide de mas)

// Tiempos
const unsigned long MUESTREO_MS   = 20;    // lectura cada 20 ms (~50 por segundo)
const uint8_t       MUESTRAS_RAP  = 8;     // promedio de cada lectura (mas = menos ruido)
const uint8_t       VENTANA       = 30;    // lecturas en la ventana (30 x 20 ms = 0.6 s)
const unsigned long RETENCION_MS  = 2500;  // cuanto tiempo se mantiene el nivel maximo
const unsigned long BAJADA_MS     = 400;   // luego baja un nivel cada este tiempo
const unsigned long FIN_SISMO_MS  = 3000;  // quieto durante este tiempo = fin del temblor
const unsigned long ALARMA_MIN_MS = 3000;  // el buzzer suena al menos este tiempo
const unsigned long IMPRIMIR_MS   = 300;   // cada cuanto se imprime el estado
// ---------------------------------------------------------------

const uint8_t NIVELES = 5;

// Datos guardados en EEPROM (formato nuevo: umbrales de variacion)
const uint16_t EEPROM_MAGIC = 0xA9E1;
const int      EEPROM_DIR   = 0;
struct Config {
  uint16_t magic;
  int umbral[NIVELES];
};
Config cfg;
const int      EEPROM_DIR_SONIDO = 32;   // 1 byte: 1 = melodia; cualquier otro valor = pitido
bool usarMelodia = false;

// Ventana de lecturas recientes
int  buf[VENTANA];
uint8_t bufPos = 0;
bool bufLleno = false;

// Estado de la medicion
int  lectura = 0;
int  variacion = 0;
bool activo[NIVELES] = {false, false, false, false, false};
uint8_t nivelMostrado = 0;
unsigned long msNivelMostrado = 0;
unsigned long msAlarma = 0;

// Conteo de oscilaciones (picos del agua)
bool subiendo = true;
int  extremo = 0;   // maximo (si sube) o minimo (si baja) desde el ultimo cambio

// Estado del temblor actual
bool enSismo = false;
unsigned long msInicioSismo = 0;
unsigned long msUltimoMovimiento = 0;
uint16_t oscilaciones = 0;
uint8_t nivelMaxSismo = 0;
int variacionMaxSismo = 0;
int lecturaMaxSismo = 0;
int lecturaMinSismo = 1023;

// Resumen del ultimo temblor
struct Resumen {
  bool valido;
  unsigned long duracionMs;
  uint16_t oscilaciones;
  uint8_t nivelMax;
  int variacionMax;
  int lecturaMax;
  int lecturaMin;
};
Resumen ultimo = {false, 0, 0, 0, 0, 0, 0};
uint16_t numSismo = 0;

unsigned long msUltimaLectura = 0;
unsigned long msUltimaImpresion = 0;

// Modo datos (panel web) y lectura del comando 'u'
bool modoDatos = false;
bool leyendoU = false;
char lineaU[40];
uint8_t lenU = 0;

// ----------------- Lecturas -----------------
int leerPromedio(uint8_t n) {
  long suma = 0;
  for (uint8_t i = 0; i < n; i++) {
    suma += analogRead(PIN_SENSOR);
    delayMicroseconds(200);
  }
  return (int)(suma / n);
}

// Variacion = el mayor de dos indicadores:
//   - rango:     maximo - minimo en la ventana (bueno para el primer golpe de agua)
//   - actividad: suma de los cambios entre lecturas seguidas / 2 (sigue detectando
//                cuando el sensor ya esta mojado y el rango se queda "comprimido",
//                y sube cuando hay muchos vaivenes seguidos)
// Los cambios pequenos (<= RUIDO) no cuentan, asi el ruido y el agua que escurre
// lentamente por el sensor no disparan falsas alarmas.
int calcularVariacion() {
  uint8_t n = bufLleno ? VENTANA : bufPos;
  if (n < 2) return 0;
  uint8_t inicio = bufLleno ? bufPos : 0;   // lectura mas antigua
  int mn = 1023, mx = 0;
  long recorrido = 0;
  int previa = buf[inicio];
  for (uint8_t i = 0; i < n; i++) {
    int v = buf[(inicio + i) % VENTANA];
    if (v < mn) mn = v;
    if (v > mx) mx = v;
    if (i > 0) {
      int d = abs(v - previa);
      if (d > RUIDO) recorrido += d - RUIDO;
    }
    previa = v;
  }
  long rango = mx - mn;
  long actividad = (long)(recorrido * FACTOR_ACTIVIDAD / 2);
  long r = max(rango, actividad);
  return (int)min(r, 1023L);
}

// ----------------- EEPROM -----------------
void guardarConfig() {
  cfg.magic = EEPROM_MAGIC;
  EEPROM.put(EEPROM_DIR, cfg);
}

void restaurarDefecto() {
  for (uint8_t i = 0; i < NIVELES; i++) cfg.umbral[i] = UMBRALES_DEFECTO[i];
  guardarConfig();
}

bool configValida(const Config &c) {
  if (c.magic != EEPROM_MAGIC) return false;
  for (uint8_t i = 0; i < NIVELES; i++) {
    if (c.umbral[i] < 1 || c.umbral[i] > 1023) return false;
  }
  return true;
}

void cargarConfig() {
  EEPROM.get(EEPROM_DIR, cfg);
  if (configValida(cfg)) {
    Serial.println(F("Umbrales cargados desde EEPROM."));
  } else {
    Serial.println(F("EEPROM sin datos validos: usando umbrales por defecto."));
    restaurarDefecto();
  }
  usarMelodia = (EEPROM.read(EEPROM_DIR_SONIDO) == 1);
}

// ----------------- Mensajes -----------------
void mostrarUmbrales() {
  if (modoDatos) {
    Serial.print('U');
    for (uint8_t i = 0; i < NIVELES; i++) { Serial.print(cfg.umbral[i]); Serial.print(','); }
    Serial.print(HISTERESIS); Serial.print(',');
    Serial.println((unsigned long)VENTANA * MUESTREO_MS);
    return;
  }
  Serial.print(F("Umbrales de variacion ->"));
  for (uint8_t i = 0; i < NIVELES; i++) {
    Serial.print(F("  N")); Serial.print(i + 1);
    Serial.print(F(": ")); Serial.print(cfg.umbral[i]);
  }
  Serial.println();
}

void mostrarSonido() {
  if (modoDatos) {
    Serial.print('S');
    Serial.println(usarMelodia ? 1 : 0);
    return;
  }
  Serial.print(F("Sonido de la alarma: "));
  Serial.println(usarMelodia ? F("melodia") : F("pitido continuo"));
}

void verificarOrden() {
  for (uint8_t i = 0; i + 1 < NIVELES; i++) {
    if (cfg.umbral[i] >= cfg.umbral[i + 1]) {
      Serial.println(F("AVISO: los umbrales no estan en orden 1 < 2 < 3 < 4 < 5. Recalibra."));
      return;
    }
  }
}

void mostrarAyuda() {
  Serial.println(F("--- Indicador de temblores (5 niveles) ---"));
  Serial.println(F(" 1..5 : usar la variacion maxima del ultimo temblor como umbral de ese nivel"));
  Serial.println(F(" v    : ver umbrales"));
  Serial.println(F(" r    : restaurar umbrales por defecto"));
  Serial.println(F(" s    : resumen del ultimo temblor"));
  Serial.println(F(" p    : prueba de pines (cada salida parpadea N veces = pin DN)"));
  Serial.println(F(" d / t: modo datos (panel web) / modo texto"));
  Serial.println(F(" u10,16,23,31,40 : fijar los 5 umbrales de una vez"));
  Serial.println(F(" m / b: alarma con melodia / con pitido continuo"));
  Serial.println(F(" h    : mostrar esta ayuda"));
}

void imprimirSegundos(unsigned long ms) {
  Serial.print(ms / 1000);
  Serial.print('.');
  Serial.print((ms % 1000) / 100);
  Serial.print(F(" s"));
}

const __FlashStringHelper* nombreIntensidad(uint8_t n) {
  switch (n) {
    case 1: return F("muy leve");
    case 2: return F("leve");
    case 3: return F("moderado");
    case 4: return F("fuerte");
    case 5: return F("MUY FUERTE");
    default: return F("sin movimiento");
  }
}

void mostrarResumen() {
  if (!ultimo.valido) {
    Serial.println(F("Todavia no se ha registrado ningun temblor."));
    return;
  }
  Serial.println(F("========== RESUMEN DEL TEMBLOR =========="));
  Serial.print(F(" Temblor #"));            Serial.println(numSismo);
  Serial.print(F(" Duracion:            "));  imprimirSegundos(ultimo.duracionMs); Serial.println();
  Serial.print(F(" Oscilaciones:        "));  Serial.println(ultimo.oscilaciones);
  if (ultimo.duracionMs > 0) {
    Serial.print(F(" Oscilaciones/seg:    "));
    Serial.println((float)ultimo.oscilaciones * 1000.0 / ultimo.duracionMs, 1);
  }
  Serial.print(F(" Nivel maximo:        "));  Serial.print(ultimo.nivelMax);
  Serial.print(F(" ("));                     Serial.print(nombreIntensidad(ultimo.nivelMax));
  Serial.println(F(")"));
  Serial.print(F(" Variacion maxima:    "));  Serial.println(ultimo.variacionMax);
  Serial.print(F(" Lectura min / max:   "));
  Serial.print(ultimo.lecturaMin); Serial.print(F(" / ")); Serial.println(ultimo.lecturaMax);
  Serial.println(F(" (para usar este temblor como umbral, escribe 1..5)"));
  Serial.println(F("========================================="));
}

// ----------------- Salidas -----------------
// El buzzer hace un pitido continuo o, si usarMelodia = true, toca la melodia en bucle
// sin bloquear el programa: cada nota suena MELODIA_MS y luego espera DESCANSO_MS.
bool    buzzerSonando = false;
bool    alarmaSonora = false;  // lo decide aplicarSalidas(); loop() actualiza el buzzer
uint8_t notaActual = 0;        // 0..NOTAS_MELODIA-1 = nota; NOTAS_MELODIA = pausa antes de repetir
unsigned long msNota = 0;

void tocarNota(uint8_t n) {
  tone(PIN_BUZZER, MELODIA_HZ[n], MELODIA_MS[n]);
}

void buzzer(bool encender, unsigned long ahora) {
  if (!BUZZER_PASIVO) {                       // buzzer activo: no puede hacer notas
    digitalWrite(PIN_BUZZER, encender ? HIGH : LOW);
    return;
  }
  if (!encender) {
    if (buzzerSonando) { noTone(PIN_BUZZER); buzzerSonando = false; }
    return;
  }
  if (!usarMelodia) {                         // pitido continuo
    if (!buzzerSonando) { tone(PIN_BUZZER, BUZZER_FREQ_HZ); buzzerSonando = true; }
    return;
  }
  if (!buzzerSonando) {                       // la melodia empieza desde la primera nota
    buzzerSonando = true;
    notaActual = 0;
    msNota = ahora;
    tocarNota(0);
    return;
  }
  unsigned long dur = (notaActual < NOTAS_MELODIA)
                        ? (unsigned long)MELODIA_MS[notaActual] + DESCANSO_MS[notaActual]
                        : PAUSA_MELODIA_MS;
  if (ahora - msNota >= dur) {
    notaActual = (notaActual >= NOTAS_MELODIA) ? 0 : notaActual + 1;
    msNota = ahora;
    if (notaActual < NOTAS_MELODIA) tocarNota(notaActual);
  }
}

void aplicarSalidas(unsigned long ahora) {
  for (uint8_t i = 0; i < 4; i++) digitalWrite(PINES_LED[i], (min(nivelMostrado, 4) == i + 1) ? HIGH : LOW);
  bool alarma = (nivelMostrado >= 5) || (msAlarma != 0 && ahora - msAlarma < ALARMA_MIN_MS);
  if (!alarma) msAlarma = 0;
  alarmaSonora = alarma || nivelMostrado >= NIVEL_ALARMA;
  buzzer(alarmaSonora, ahora);
}

// Cambia entre pitido y melodia, lo guarda en la EEPROM y lo informa.
void elegirSonido(bool melodia) {
  if (buzzerSonando) { noTone(PIN_BUZZER); buzzerSonando = false; }  // reinicia con el sonido nuevo
  usarMelodia = melodia;
  EEPROM.update(EEPROM_DIR_SONIDO, melodia ? 1 : 0);
  mostrarSonido();
}

// ----------------- Logica del sismografo -----------------
uint8_t nivelInstantaneo(int v) {
  uint8_t n = 0;
  for (uint8_t i = 0; i < NIVELES; i++) {
    if (!activo[i] && v >= cfg.umbral[i])                 activo[i] = true;
    else if (activo[i] && v < cfg.umbral[i] - HISTERESIS)  activo[i] = false;
    if (activo[i]) n = i + 1;
  }
  return n;
}

// Cuenta un vaiven cada vez que el agua sube y luego baja mas de medio umbral del nivel 1.
void contarOscilaciones(int v) {
  int h = cfg.umbral[0] / 2;
  if (h < 2) h = 2;
  if (subiendo) {
    if (v > extremo) extremo = v;
    else if (v < extremo - h) {          // llego a un pico y empezo a bajar
      if (enSismo) oscilaciones++;
      subiendo = false;
      extremo = v;
    }
  } else {
    if (v < extremo) extremo = v;
    else if (v > extremo + h) {          // llego a un valle y empezo a subir
      subiendo = true;
      extremo = v;
    }
  }
}

void terminarSismo() {
  numSismo++;
  ultimo.valido       = true;
  ultimo.duracionMs   = msUltimoMovimiento - msInicioSismo;
  ultimo.oscilaciones = oscilaciones;
  ultimo.nivelMax     = nivelMaxSismo;
  ultimo.variacionMax = variacionMaxSismo;
  ultimo.lecturaMax   = lecturaMaxSismo;
  ultimo.lecturaMin   = lecturaMinSismo;
  enSismo = false;
  if (modoDatos) {
    Serial.print(F("E0,"));
    Serial.print(ultimo.duracionMs);   Serial.print(',');
    Serial.print(ultimo.oscilaciones); Serial.print(',');
    Serial.print(ultimo.nivelMax);     Serial.print(',');
    Serial.print(ultimo.variacionMax); Serial.print(',');
    Serial.print(ultimo.lecturaMin);   Serial.print(',');
    Serial.println(ultimo.lecturaMax);
  } else {
    mostrarResumen();
  }
}

void procesarLectura(unsigned long ahora) {
  lectura = leerPromedio(MUESTRAS_RAP);
  buf[bufPos] = lectura;
  bufPos++;
  if (bufPos >= VENTANA) { bufPos = 0; bufLleno = true; }

  variacion = calcularVariacion();
  uint8_t inst = nivelInstantaneo(variacion);
  bool moviendo = activo[0];

  if (moviendo) {
    if (!enSismo) {
      enSismo = true;
      msInicioSismo = ahora;
      oscilaciones = 0;
      nivelMaxSismo = 0;
      variacionMaxSismo = 0;
      lecturaMaxSismo = 0;
      lecturaMinSismo = 1023;
      if (modoDatos) Serial.println(F("E1"));
      else           Serial.println(F(">>> TEMBLOR DETECTADO"));
    }
    msUltimoMovimiento = ahora;
  }
  contarOscilaciones(lectura);

  if (enSismo) {
    if (inst > nivelMaxSismo) nivelMaxSismo = inst;
    if (variacion > variacionMaxSismo) variacionMaxSismo = variacion;
    if (lectura > lecturaMaxSismo) lecturaMaxSismo = lectura;
    if (lectura < lecturaMinSismo) lecturaMinSismo = lectura;
    if (!moviendo && ahora - msUltimoMovimiento >= FIN_SISMO_MS) terminarSismo();
  }

  // --- Retencion del nivel maximo (como un sismografo) ---
  if (inst >= nivelMostrado) {
    if (inst >= 5 && nivelMostrado < 5) msAlarma = ahora;
    nivelMostrado = inst;
    msNivelMostrado = ahora;
  } else if (ahora - msNivelMostrado >= RETENCION_MS) {
    nivelMostrado--;
    msNivelMostrado = ahora - RETENCION_MS + BAJADA_MS;  // la siguiente bajada llega en BAJADA_MS
    if (nivelMostrado < inst) nivelMostrado = inst;
  }
  aplicarSalidas(ahora);

  if (modoDatos) {
    uint8_t flags = ((nivelMostrado >= 5 || msAlarma != 0) ? 1 : 0) | (enSismo ? 2 : 0);
    Serial.print('D');
    Serial.print(lectura);       Serial.print(',');
    Serial.print(variacion);     Serial.print(',');
    Serial.print(nivelMostrado); Serial.print(',');
    Serial.println(flags);
  }
}

void imprimirEstado(unsigned long ahora) {
  Serial.print(F("Lectura: "));      Serial.print(lectura);
  Serial.print(F("  | Variacion: ")); Serial.print(variacion);
  Serial.print(F("  | Nivel: "));    Serial.print(nivelMostrado);
  Serial.print(F("  | LEDs: "));
  for (uint8_t i = 0; i < 4; i++) Serial.print(min(nivelMostrado, 4) == i + 1 ? '1' : '0');
  if (nivelMostrado >= 5 || msAlarma != 0) Serial.print(F("  | BUZZER"));
  if (enSismo) {
    Serial.print(F("  | Temblor: "));
    imprimirSegundos(ahora - msInicioSismo);
    Serial.print(F(", oscilaciones: "));
    Serial.print(oscilaciones);
  }
  Serial.println();
}

// Cada salida parpadea tantas veces como su numero de pin (2 ciclos).
void pruebaPines() {
  buzzer(false, millis());
  uint8_t pines[5] = {PINES_LED[0], PINES_LED[1], PINES_LED[2], PINES_LED[3], PIN_BUZZER};
  Serial.println(F("Prueba de pines: cuenta los parpadeos de cada LED / pitidos del buzzer."));
  for (uint8_t ciclo = 0; ciclo < 2; ciclo++) {
    for (uint8_t k = 1; k <= 13; k++) {
      for (uint8_t j = 0; j < 5; j++) digitalWrite(pines[j], (k <= pines[j]) ? HIGH : LOW);
      delay(300);
      for (uint8_t j = 0; j < 5; j++) digitalWrite(pines[j], LOW);
      delay(400);
    }
    delay(2500);
  }
  nivelMostrado = 0;
  msAlarma = 0;
  bufPos = 0;
  bufLleno = false;
  Serial.println(F("Prueba terminada."));
}

// "u10,16,23,31,40": fija los 5 umbrales (deben ir de menor a mayor, 1..1023).
void aplicarUmbralesTexto(const char *s) {
  int v[NIVELES];
  uint8_t n = 0;
  long acc = -1;
  for (const char *p = s; ; p++) {
    if (*p >= '0' && *p <= '9') {
      acc = (acc < 0 ? 0 : acc) * 10 + (*p - '0');
    } else {
      if (acc >= 0) { if (n < NIVELES) v[n] = (int)min(acc, 9999L); n++; acc = -1; }
      if (*p == 0) break;
    }
  }
  if (n != NIVELES) {
    Serial.println(F("Error: se esperan 5 umbrales, ejemplo: u10,16,23,31,40"));
    return;
  }
  for (uint8_t i = 0; i < NIVELES; i++) {
    if (v[i] < 1 || v[i] > 1023 || (i > 0 && v[i] <= v[i - 1])) {
      Serial.println(F("Error: umbrales fuera de rango (1-1023) o no van de menor a mayor."));
      return;
    }
  }
  for (uint8_t i = 0; i < NIVELES; i++) cfg.umbral[i] = v[i];
  guardarConfig();
  Serial.println(F("Umbrales actualizados."));
  mostrarUmbrales();
}

void procesarCaracter(char c) {
  if (leyendoU) {
    if (c == '\n' || c == '\r') {
      lineaU[lenU] = 0;
      leyendoU = false;
      aplicarUmbralesTexto(lineaU);
    } else if (lenU < sizeof(lineaU) - 1) {
      lineaU[lenU++] = c;
    }
    return;
  }
  if (c == 'u' || c == 'U') { leyendoU = true; lenU = 0; return; }
  procesarComando(c);
}

void procesarComando(char c) {
  if (c >= '1' && c <= '0' + NIVELES) {
    uint8_t n = c - '1';
    if (!ultimo.valido) {
      Serial.println(F("Primero haz un temblor de esa intensidad y espera el resumen."));
      return;
    }
    int u = (int)(ultimo.variacionMax * FACTOR_CALIB);
    if (u < HISTERESIS + 3) u = HISTERESIS + 3;
    cfg.umbral[n] = u;
    guardarConfig();
    Serial.print(F("Nivel ")); Serial.print(n + 1);
    Serial.print(F(" calibrado con el ultimo temblor (variacion maxima "));
    Serial.print(ultimo.variacionMax);
    Serial.print(F(") -> umbral ")); Serial.println(u);
    mostrarUmbrales();
    verificarOrden();
    return;
  }
  switch (c) {
    case 'v': case 'V': mostrarUmbrales(); verificarOrden(); mostrarSonido(); break;
    case 'm': case 'M': elegirSonido(true);  break;
    case 'b': case 'B': elegirSonido(false); break;
    case 'r': case 'R':
      restaurarDefecto();
      Serial.println(F("Umbrales por defecto restaurados."));
      mostrarUmbrales();
      break;
    case 's': case 'S': mostrarResumen(); break;
    case 'p': case 'P': pruebaPines(); break;
    case 'd': case 'D':
      modoDatos = true;
      mostrarUmbrales();
      mostrarSonido();
      break;
    case 't': case 'T':
      modoDatos = false;
      Serial.println(F("Modo texto."));
      break;
    case 'h': case 'H': case '?': mostrarAyuda(); break;
    case '\r': case '\n': case ' ': break;
    default:
      Serial.print(F("Comando desconocido: '")); Serial.print(c);
      Serial.println(F("'. Escribe h para ver la ayuda."));
  }
}

// ----------------- Programa principal -----------------
void setup() {
  for (uint8_t i = 0; i < 4; i++) {
    pinMode(PINES_LED[i], OUTPUT);
    digitalWrite(PINES_LED[i], LOW);
  }
  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_BUZZER, LOW);

  Serial.begin(9600);
  Serial.println();
  Serial.println(F("=== Indicador de temblores (sensor de agua) ==="));
  cargarConfig();
  mostrarUmbrales();
  verificarOrden();
  mostrarSonido();
  mostrarAyuda();
  extremo = leerPromedio(MUESTRAS_RAP);
}

void loop() {
  while (Serial.available() > 0) {
    procesarCaracter((char)Serial.read());
  }

  unsigned long ahora = millis();
  if (ahora - msUltimaLectura >= MUESTREO_MS) {
    msUltimaLectura = ahora;
    procesarLectura(ahora);
  }
  buzzer(alarmaSonora, ahora);   // avanza la melodia con precision de milisegundos
  if (!modoDatos && ahora - msUltimaImpresion >= IMPRIMIR_MS) {
    msUltimaImpresion = ahora;
    imprimirEstado(ahora);
  }
}

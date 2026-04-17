# Copilot Instructions — Pagos App

## Descripción del proyecto

PWA de registro de partidos y gestión de pagos para un club deportivo, alojada en **GitHub Pages** con backend en **Google Apps Script** conectado a **Google Sheets**.

- **Frontend**: `pagos_app.html` — app SPA completa en HTML/CSS/JS vanilla, sin frameworks.
- **Backend**: `apps_script.js` — Google Apps Script deployado como Web App pública.
- **Service Worker**: `sw.js` — estrategia cache-first para el app shell. Nunca cachea llamadas a GAS/Sheets.
- **Manifest**: `manifest.json` — configuración PWA.

---

## Funcionalidades

### Pantalla Registro (tab activo por defecto)
- El usuario selecciona un partido de un dropdown (precargados desde hoja Partidos_Pagos).
- Se verifica si ya hay datos registrados para ese partido.
- Se muestra la lista de jugadores con:
  - **Nombre** y **posición** (Jugador/Arquero)
  - Botones de estado: **T** (Titular), **S c/m** (Suplente con minutos), **S** (Suplente), **N/C** (No convocado)
  - Contador de **goles** (botones +/-)
  - Toggle de **valla invicta** (solo para arqueros)
- Al guardar, se envía al backend con `overwrite: true`.

### Pantalla Pagos
- Lista de jugadores con badge de tipo de contratación.
- Al seleccionar un jugador, se abre el detalle:
  - Checkboxes para seleccionar qué partidos pagar
  - Cálculo automático según tipo de contratación:
    - **Por partido**: Montos diferentes para T, S c/min, S
    - **Quincena**: Monto fijo cada 2 partidos (pares completos)
    - **Mensual**: Monto fijo mensual
  - Bonificaciones por goles y valla invicta
  - Sección de descuentos (agregar/quitar items con descripción y monto)
  - Total neto
  - Botón "Confirmar Pago" guarda en hoja Historial_Pagos

### Pantalla Resumen
- Seleccionar partidos con checkboxes
- Tabla resumen de todos los jugadores con:
  - Base, goles, valla, total por jugador
  - Gran total de todos los jugadores
- Cards con estadísticas: partidos seleccionados, jugadores, total a pagar

### Pantalla Configuración
- Campo para URL del Web App de Google Apps Script
- Lista de jugadores (solo lectura, cargados desde Sheet)

---

## REGLA CRÍTICA: Versión del Service Worker

> **Cada vez que se modifique cualquier archivo, se DEBE incrementar el número de versión en `sw.js`.**

```js
// sw.js — línea 1
const CACHE_NAME = 'pagos-v1'; // <- incrementar este número
```

---

## Estructura de Google Sheets

### Hoja: Jugadores_Pagos
| Columna | Descripción |
|---------|-------------|
| Nombre | Nombre y apellido |
| Posicion | Jugador / Arquero |
| Tipo_Contratacion | Por partido / Quincena / Mensual / N/A |
| Monto_Titular | Monto cuando juega de titular (solo "Por partido") |
| Monto_Suplente | Monto cuando es suplente sin minutos (solo "Por partido") |
| Monto_Suplente_Min | Monto cuando entra como suplente con minutos (solo "Por partido") |
| Monto_Quincena | Monto fijo cada 2 partidos (solo "Quincena") |
| Monto_Mensual | Monto fijo mensual (solo "Mensual") |
| Fecha_Cobro | Fecha de cobro mensual (solo "Mensual") |
| Monto_Gol | Bonificación por gol |
| Monto_Valla | Bonificación por valla invicta (solo arqueros) |

### Hoja: Partidos_Pagos
| Columna | Descripción |
|---------|-------------|
| Rival | Nombre del equipo rival |

Cada fila = un partido. El row index (menos header) es el ID del partido.

### Hoja: Registro_Pagos
| Columna | Descripción |
|---------|-------------|
| Timestamp | Fecha/hora de registro |
| Partido_ID | ID del partido (row index en Partidos_Pagos) |
| Partido_Rival | Nombre del rival (para referencia) |
| Jugador | Nombre del jugador |
| Estado | T / S c/min / S / N/C |
| Goles | Cantidad de goles |
| Valla_Invicta | Sí / No |

### Hoja: Historial_Pagos
| Columna | Descripción |
|---------|-------------|
| Timestamp | Fecha/hora del pago |
| Jugador | Nombre del jugador |
| Partidos | Lista de partidos incluidos |
| Monto_Bruto | Total antes de descuentos |
| Descuentos | Detalle de descuentos (texto) |
| Monto_Neto | Total después de descuentos |

---

## Endpoints de Google Apps Script

| Método | action | Descripción |
|--------|--------|-------------|
| GET | `getPlayers` | Lista de jugadores con todos sus datos |
| GET | `getPartidos` | Lista de partidos (rival + ID) |
| GET | `getRegistro&partidoId=N` | Registro de un partido específico |
| GET | `getAllRegistro` | Todos los registros de partidos |
| GET | `getRegisteredPartidos` | IDs de partidos que tienen datos |
| GET | `getPagos` | Historial de pagos |
| POST | `saveRegistro` | Guardar registro de partido (con overwrite) |
| POST | `savePago` | Guardar un pago |

---

## Variables de estado (frontend)

```js
let players = [];          // Jugadores desde Sheets, cacheados en localStorage
let partidos = [];         // Partidos desde Sheets, cacheados en localStorage
let scriptUrl = '';        // URL del Web App GAS
let allRegistro = [];      // Todos los registros de partidos
let cachedRegistro = {};   // {partidoId: records[]} — caché en memoria
let registeredIds = Set;   // IDs de partidos con datos
let currentPagoPlayer;     // Jugador actual en detalle de pago
let currentPagoDiscounts;  // Descuentos del pago actual
```

---

## Lógica de cálculo de pagos

### Por partido
- T → `montoTitular`
- S c/min → `montoSuplenteMin`
- S → `montoSuplente`
- N/C → $0

### Quincena
- Se paga cada 2 partidos jugados
- `pares = floor(partidosJugados / 2)`
- Monto = `pares * montoQuincena`
- Si queda 1 partido suelto, no se cobra

### Mensual
- Monto fijo = `montoMensual` (independiente de cuántos partidos)

### Bonificaciones (aplica a todos)
- Goles: `cantidadGoles * montoGol`
- Valla invicta (solo arqueros): `cantidadVallas * montoValla`

### Descuentos
- Se agregan manualmente en la pantalla de pago
- Cada descuento tiene descripción y monto
- Total neto = bruto - suma(descuentos)

---

## Arquitectura Google Apps Script

### Restricciones conocidas de GAS
- `ContentService.TextOutput` **NO soporta** `.setHeader()` — lanza TypeError.
- GAS maneja CORS automáticamente cuando está deployado como "Anyone".
- Fechas en Sheets se deserializan como `Date`, no strings. Siempre normalizar con `instanceof Date`.
- Cada cambio requiere **nuevo deployment** (no alcanza con guardar).
- Deploy como: **Ejecutar como: tu cuenta** / **Acceso: Cualquier persona**.
- Límites: 6 min ejecución, 20k llamadas/día (cuenta gratuita).

---

## Checklist de setup

1. Crear Google Sheet con las 4 hojas (ver estructura arriba)
2. Anotar el `SHEET_ID` (de la URL del Sheet)
3. Reemplazar `SHEET_ID` en `apps_script.js`
4. Crear proyecto en script.google.com, pegar el código, deployar como Web App
5. Copiar la URL del deployment y pegarla en Configuración de la app
6. Activar GitHub Pages en el repo
7. Verificar: SW se instala, manifest válido, llamadas al backend funcionan

---

## Patrones de desarrollo

### Llamadas al backend
```js
const res = await fetch(`${scriptUrl}?action=getPlayers`);
const json = await res.json();
if (json.status !== 'success') throw new Error(json.message);
```

### POST a GAS
```js
await fetch(scriptUrl, {
  method: 'POST', mode: 'no-cors',
  headers: { 'Content-Type': 'text/plain' },
  body: JSON.stringify({ action: 'saveRegistro', data: records, overwrite: true })
});
```

### Service Worker cache
- Incrementar `CACHE_NAME` en cada cambio
- Nunca cachear URLs de GAS/Sheets

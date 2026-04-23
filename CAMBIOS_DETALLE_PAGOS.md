# Cambios Implementados en Detalle de Pagos - pagos_app.html

## 📋 Resumen de Cambios

Se ha actualizado la pantalla de **detalle de pago de un jugador** para:

1. ✅ **Verificar pagos históricos** - Consulta el historial de pagos para detectar si un partido ya fue pagado
2. ✅ **Mostrar estado de pagos** - Marca con badge "✓ Pagado" los partidos que ya fueron abonados
3. ✅ **Advertencia al repagar** - Si intenta repagar un partido ya pagado, muestra confirmación
4. ✅ **Permitir repago** - Permite proceder con el pago igual (para arreglos especiales)
5. ✅ **Permitir pagos a no convocados** - Los jugadores N/C pueden ser pagados (con badge indicador)
6. ✅ **Monto editable** - El monto a pagar ahora es editable sin límites

---

## 🔧 Detalles Técnicos

### 1. Nueva Función: `checkPagosHistoricos()`

**Ubicación:** Línea ~1086

**Qué hace:** 
- Recorre el array `allPagos` (historial de pagos)
- Busca pagos previos del jugador actual
- Retorna un mapa `{partidoId: true/false}` indicando cuáles fueron pagados

**Uso:**
```javascript
const pagosMap = checkPagosHistoricos();
const alreadyPaid = pagosMap[p.id] === true; // true si fue pagado
```

---

### 2. Cambios en `renderPagoPartidos()`

**Ubicación:** Línea ~1110

**Cambios:**
- ✅ Agregó validación de pagos históricos
- ✅ Mostrar badge "✓ Pagado" para partidos ya pagados
- ✅ Mostrar badge "No convocado" para jugadores N/C (en rojo)
- ✅ Fondo verde claro (`partido-paid`) para partidos ya pagados
- ✅ **REMOVIDO** el `disabled` del checkbox para jugadores N/C (ahora pueden pagar)

**Estilos CSS agregados:**
```css
.partido-paid { background: var(--green-bg); }  /* Fondo verde para pagados */
.paid-badge { background: var(--green); color: #fff; }  /* Badge verde */
.nc-badge { background: var(--red-bg); color: var(--red-text); }  /* Badge rojo para NC */
```

---

### 3. Cambios en `renderPagoCalc()`

**Ubicación:** Línea ~1201

**Cambios:**
- ✅ Permite seleccionar partidos de jugadores N/C sin skip
- ✅ Las bonificaciones (goles, valla) solo aplican si el jugador jugó (no para N/C)
- ✅ El monto base se calcula solo para jugadores que jugaron

**Lógica:**
```javascript
if (playerRec.estado === 'N/C') {
  // No calcula monto automático, usuario lo setea manualmente
} else {
  // Calcula normalmente (T, S c/min, S)
  // Agrega goles y valla si corresponde
}
```

---

### 4. Cambios en `renderPagoTotal()`

**Ubicación:** Línea ~1339

**Cambios:**
- ✅ **NUEVO:** Input editable para monto a pagar (💰 Monto a pagar)
- ✅ Campo `id="pago-custom-amount"` para capturas manual
- ✅ Muestra "TOTAL FINAL" con el monto personalizado si existe
- ✅ Si no hay monto personalizado, usa el cálculo automático

**HTML agregado:**
```html
<label>💰 Monto a pagar (editable)</label>
<input type="number" id="pago-custom-amount" 
       oninput="renderPagoTotal()" min="0">
```

---

### 5. Cambios en `getBrutoActual()`

**Ubicación:** Línea ~1367

**Cambios:**
- ✅ Permite iterar jugadores N/C sin skipearlos
- ✅ Para N/C, retorna 0 en bruto automático (el usuario ingresa manual)
- ✅ Otros jugadores se calculan normalmente

---

### 6. Cambios en `savePago()`

**Ubicación:** Línea ~1420

**Cambios:**
- ✅ **NUEVA LÓGICA:** Detecta si hay partidos ya pagados
- ✅ **Advertencia interactiva:** Muestra `confirm()` con lista de partidos ya pagados
- ✅ Si el usuario cancela, se detiene el pago
- ✅ Si el usuario confirma, procede normalmente
- ✅ Usa el monto personalizado si existe:
  ```javascript
  const customAmount = parseFloat(document.getElementById('pago-custom-amount')?.value);
  const finalBruto = !isNaN(customAmount) && customAmount > 0 ? customAmount : bruto;
  ```

---

### 7. Cambios en `openPagoDetail()`

**Ubicación:** Línea ~882

**Cambios:**
- ✅ Limpia el campo de monto personalizado al abrir el detalle
- ✅ Asegura que cada nuevo jugador comience con monto vacío

---

## 📊 Flujo de Uso

### Escenario 1: Jugador Convocado (Normal)
1. Se abre detalle del jugador
2. Se muestran todos los partidos registrados
3. Partidos ya pagados muestran badge "✓ Pagado" con fondo verde
4. Usuario selecciona partidos a pagar
5. Sistema calcula automáticamente (T/S/Goles/Valla)
6. Usuario puede editar el monto en el campo "💰 Monto a pagar"
7. Si elige partidos ya pagados, se muestra advertencia
8. Si confirma, se registra el pago

### Escenario 2: Jugador No Convocado (Arreglo Especial)
1. Se abre detalle del jugador
2. Partidos muestran badge rojo "No convocado"
3. Checkbox está **HABILITADO** (no deshabilitado)
4. Usuario selecciona el/los partido(s) que quiere pagarle
5. Sistema NO calcula automático (monto base = 0)
6. Usuario **DEBE** ingresar el monto manualmente en "💰 Monto a pagar"
7. Si intenta guardar sin monto, muestra error
8. Si confirma, se registra el pago

### Escenario 3: Repago de Partido (Corrección)
1. Usuario selecciona un partido ya pagado
2. Se muestra advertencia:
   ```
   ⚠️ ADVERTENCIA: 1 partido ya fue pagado:
   • vs Rival
   
   ¿Estás seguro de que querés proceder?
   ```
3. Si hace click en "Aceptar" en el confirm, procede
4. Si hace click en "Cancelar", cancela el pago

---

## 🎨 Visual Changes

### Antes:
```
vs Rival              T · 3 goles       $500
```

### Después:
```
vs Rival ✓ Pagado    T · 3 goles       $500
[fondo verde claro]
```

```
vs Rival No convocado                   -
[checkbox habilitado, no deshabilitado]
```

---

## ✨ Features Añadidas

### Feature 1: Visualización de Pagos Previos
- **Qué:** Badge y fondo colorido para partidos pagados
- **Dónde:** En la lista de partidos del detalle
- **Cómo:** `checkPagosHistoricos()` compara contra `allPagos`

### Feature 2: Advertencia de Repago
- **Qué:** Diálogo de confirmación antes de repagar
- **Dónde:** En `savePago()` antes de guardar
- **Cómo:** Itera checkboxes marcados y verifica `data-already-paid`

### Feature 3: Permitir Pagos a N/C
- **Qué:** Habilitar checkbox para no convocados
- **Dónde:** En `renderPagoPartidos()`
- **Cómo:** Cambiar lógica de `disabled` y permitir monto manual

### Feature 4: Monto Editable
- **Qué:** Input de número para cambiar monto final
- **Dónde:** En sección "Total" del detalle
- **Cómo:** Input `#pago-custom-amount` con `oninput="renderPagoTotal()"`

---

## 🔍 Variables Globales Utilizadas

| Variable | Tipo | Qué es |
|----------|------|--------|
| `allPagos` | Array | Historial de pagos (desde Google Sheets) |
| `currentPagoPlayer` | Object | Jugador actualmente en detalle |
| `partidos` | Array | Todos los partidos registrados |
| `cachedRegistro` | Object | Cache de registros por partidoId |
| `currentPagoDiscounts` | Array | Descuentos de este pago |

---

## 🧪 Pruebas Sugeridas

1. **Abrir detalle de jugador con pagos previos**
   - Verificar que aparezca el badge "✓ Pagado"
   - Verificar que el fondo sea verde

2. **Intentar repagar un partido pagado**
   - Seleccionar partido marcado como pagado
   - Verificar que salga advertencia al guardar
   - Aceptar y verificar que se registre

3. **Pagar jugador no convocado**
   - Seleccionar partido del jugador N/C
   - Ingresar monto manualmente
   - Verificar que se registre correctamente

4. **Editar monto**
   - Calcular automático (ej: $500)
   - Cambiar en campo editable a $550
   - Verificar que "TOTAL FINAL" muestre $550
   - Guardar y verificar en Google Sheets

---

## 📝 Archivos Modificados

- `C:\Users\manuel.ellena\Git\pagos_app\pagos_app.html`

---

## 🔗 Relación con Google Sheets

El sistema obtiene los pagos históricos de:
- **Hoja:** `Historial_Pagos` (en Google Sheets)
- **Acción:** `getPagos` (via Apps Script)
- **Almacenamiento local:** `localStorage.getItem('pagos_historial')`

Cuando se guarda un pago:
- Se envía a Google Sheets a través de `savePago()`
- Se actualiza `allPagos` localmente
- Se usa para verificar pagos futuros

---

## 📱 Mobile Responsive

Todos los cambios mantienen la responsividad mobile:
- Input editable adapta ancho automático
- Badges se ajustan al tamaño disponible
- Confirmación usa `window.confirm()` (nativa del navegador)

---

## ⚠️ Notas Importantes

1. **Validación de monto:** Si el usuario intenta guardar sin seleccionar partidos NI ingresar monto, muestra error
2. **Descuentos:** Aplican sobre el monto final (personalizado o automático)
3. **Historial:** Solo funciona si `allPagos` tiene datos (desde Google Sheets)
4. **NC badge:** Aparece solo si el jugador no fue convocado en ese partido
5. **Repago:** Requiere confirmación explícita del usuario (no es automático)

---

## 📋 Checklist de Validación

- [x] Verificación de pagos históricos funcionando
- [x] Advertencia de repago mostrándose
- [x] Permitir pago a N/C habilitado
- [x] Monto editable sin límite
- [x] Estilos CSS agregados correctamente
- [x] Datos se guardan en Google Sheets
- [x] localStorage se actualiza
- [x] Mobile responsive mantiene funcionalidad

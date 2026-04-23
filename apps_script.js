// Google Apps Script for Pagos App
// Deploy this as a web app (Execute as: your account, Who has access: Anyone)

const SHEET_ID = '1utDeHhXEOPm94GNPV72WKJ8RbCo_aS5tpKKgaV4dlbw'; // Reemplazar con el ID de tu Google Sheet
const JUGADORES_SHEET = 'Jugadores_Pagos';
const PARTIDOS_SHEET = 'Partidos_Pagos';
const REGISTRO_SHEET = 'Registro_Pagos';
const PAGOS_SHEET = 'Historial_Pagos';

// ======================== GET ========================
function doGet(e) {
  const action = e.parameter.action || 'default';
  try {
    let response = {};
    switch (action) {
      case 'getPlayers':
        response = getPlayersData();
        break;
      case 'getPartidos':
        response = getPartidosData();
        break;
      case 'getRegistro':
        response = getRegistroData(e.parameter.partidoId);
        break;
      case 'getAllRegistro':
        response = getAllRegistroData();
        break;
      case 'getRegisteredPartidos':
        response = getRegisteredPartidosData();
        break;
      case 'getPagos':
        response = getPagosData();
        break;
      default:
        response = { status: 'ok', message: 'Pagos App Script is running' };
    }
    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error', message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ======================== POST ========================
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    let response = {};
    switch (action) {
      case 'saveRegistro':
        response = saveRegistroData(data.data, data.partidoId, data.partidoRival, data.overwrite === true);
        break;
      case 'savePago':
        response = savePagoData(data.data);
        break;
      default:
        response = { status: 'error', message: 'Unknown action' };
    }
    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error', message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ======================== GET HANDLERS ========================

/**
 * Get all players with their full data from Jugadores_Pagos sheet
 * Columns: Nombre | Posicion | Tipo_Contratacion | Monto_Titular | Monto_Suplente |
 *          Monto_Suplente_Min | Monto_Quincena | Monto_Mensual | Fecha_Cobro |
 *          Monto_Gol | Monto_Valla
 */

/**
 * Normalize tipoContratacion to a canonical form so the frontend
 * can use exact string comparisons regardless of how the user typed
 * the value in the sheet (e.g. "por_partido", "Por Partido", "POR PARTIDO").
 * Canonical values: "Por partido", "Quincena", "Mensual", "N/A".
 */
function normalizeTipoContratacion(raw) {
  if (raw === undefined || raw === null || raw === '') return 'N/A';
  // lowercase, replace underscores and multiple spaces, trim
  const s = raw.toString().toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  if (s === 'por partido' || s === 'porpartido' || s === 'partido' || s === 'por-partido') return 'Por partido';
  if (s === 'quincena' || s === 'quincenal') return 'Quincena';
  if (s === 'mensual' || s === 'mes' || s === 'mensualmente') return 'Mensual';
  if (s === 'n/a' || s === 'na' || s === 'ninguno' || s === 'sin contrato') return 'N/A';
  // Fallback: return the original trimmed value so it at least surfaces visibly
  return raw.toString().trim();
}

function getPlayersData() {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const sheet = spreadsheet.getSheetByName(JUGADORES_SHEET);
    if (!sheet) return { status: 'success', players: [] };

    const values = sheet.getDataRange().getValues();
    const players = [];

    for (let i = 1; i < values.length; i++) {
      const nombre = (values[i][0] || '').toString().trim();
      if (!nombre) continue;

      // Fecha_Cobro_Mensual (col 11): día del mes (1-31)
      // Fall back to old Fecha_Cobro (col 8) for backwards compatibility
      let diaCobro = '';
      const rawDiaCobro = values[i][11] !== undefined && values[i][11] !== '' ? values[i][11] : values[i][8];
      if (rawDiaCobro !== undefined && rawDiaCobro !== '') {
        diaCobro = rawDiaCobro.toString().trim();
      }

      // Fecha_Ultimo_Pago (col 12): YYYY-MM-DD
      let fechaUltimoPago = '';
      if (values[i][12] !== undefined && values[i][12] !== '') {
        fechaUltimoPago = values[i][12] instanceof Date
          ? values[i][12].toISOString().split('T')[0]
          : values[i][12].toString().trim();
      }

      players.push({
        nombre: nombre,
        posicion: (values[i][1] || 'Jugador').toString().trim(),
        tipoContratacion: normalizeTipoContratacion(values[i][2]),
        montoTitular: parseFloat(values[i][3]) || 0,
        montoSuplente: parseFloat(values[i][4]) || 0,
        montoSuplenteMin: parseFloat(values[i][5]) || 0,
        montoQuincena: parseFloat(values[i][6]) || 0,
        montoMensual: parseFloat(values[i][7]) || 0,
        fechaCobro: values[i][8] ? (values[i][8] instanceof Date
          ? values[i][8].toISOString().split('T')[0]
          : values[i][8].toString().trim()) : '',
        montoGol: parseFloat(values[i][9]) || 0,
        montoValla: parseFloat(values[i][10]) || 0,
        diaCobroMensual: diaCobro,
        fechaUltimoPago: fechaUltimoPago
      });
    }

    return { status: 'success', count: players.length, players: players };
  } catch (error) {
    return { status: 'error', message: error.toString() };
  }
}

/**
 * Get all matches from Partidos_Pagos sheet
 * Columns: Rival
 * Row index (minus header) = match ID
 */
function getPartidosData() {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const sheet = spreadsheet.getSheetByName(PARTIDOS_SHEET);
    if (!sheet) return { status: 'success', partidos: [] };

    const values = sheet.getDataRange().getValues();
    const partidos = [];

    for (let i = 1; i < values.length; i++) {
      const rival = (values[i][0] || '').toString().trim();
      if (!rival) continue;
      partidos.push({
        id: i,  // Row index as ID (1-based, skipping header)
        rival: rival
      });
    }

    return { status: 'success', count: partidos.length, partidos: partidos };
  } catch (error) {
    return { status: 'error', message: error.toString() };
  }
}

/**
 * Get registration data for a specific match
 */
function getRegistroData(partidoId) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const sheet = spreadsheet.getSheetByName(REGISTRO_SHEET);
    if (!sheet) return { status: 'success', data: [] };

    const values = sheet.getDataRange().getValues();
    const records = [];
    const pid = parseInt(partidoId);

    for (let i = 1; i < values.length; i++) {
      const cellId = parseInt(values[i][1]);
      if (cellId === pid) {
        records.push({
          timestamp: values[i][0] ? values[i][0].toString() : '',
          partidoId: cellId,
          partidoRival: (values[i][2] || '').toString().trim(),
          jugador: (values[i][3] || '').toString().trim(),
          estado: (values[i][4] || '').toString().trim(),
          goles: parseInt(values[i][5]) || 0,
          vallaInvicta: (values[i][6] || '').toString().trim()
        });
      }
    }

    return { status: 'success', count: records.length, data: records };
  } catch (error) {
    return { status: 'error', message: error.toString() };
  }
}

/**
 * Get ALL registration records
 */
function getAllRegistroData() {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const sheet = spreadsheet.getSheetByName(REGISTRO_SHEET);
    if (!sheet) return { status: 'success', data: [] };

    const values = sheet.getDataRange().getValues();
    const records = [];

    for (let i = 1; i < values.length; i++) {
      if (!values[i][0]) continue;
      records.push({
        timestamp: values[i][0] ? values[i][0].toString() : '',
        partidoId: parseInt(values[i][1]) || 0,
        partidoRival: (values[i][2] || '').toString().trim(),
        jugador: (values[i][3] || '').toString().trim(),
        estado: (values[i][4] || '').toString().trim(),
        goles: parseInt(values[i][5]) || 0,
        vallaInvicta: (values[i][6] || '').toString().trim()
      });
    }

    return { status: 'success', count: records.length, data: records };
  } catch (error) {
    return { status: 'error', message: error.toString() };
  }
}

/**
 * Get unique partido IDs that have registration data
 */
function getRegisteredPartidosData() {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const sheet = spreadsheet.getSheetByName(REGISTRO_SHEET);
    if (!sheet) return { status: 'success', ids: [] };

    const values = sheet.getDataRange().getValues();
    const idsSet = new Set();

    for (let i = 1; i < values.length; i++) {
      const pid = parseInt(values[i][1]);
      if (pid) idsSet.add(pid);
    }

    return { status: 'success', ids: [...idsSet].sort((a, b) => a - b) };
  } catch (error) {
    return { status: 'error', message: error.toString() };
  }
}

/**
 * Get all payment history records
 */
function getPagosData() {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const sheet = spreadsheet.getSheetByName(PAGOS_SHEET);
    if (!sheet) return { status: 'success', data: [] };

    const values = sheet.getDataRange().getValues();
    const records = [];

    for (let i = 1; i < values.length; i++) {
      if (!values[i][0]) continue;
      records.push({
        timestamp: values[i][0] ? values[i][0].toString() : '',
        jugador: (values[i][1] || '').toString().trim(),
        partidos: (values[i][2] || '').toString().trim(),
        montoBruto: parseFloat(values[i][3]) || 0,
        descuentos: (values[i][4] || '').toString().trim(),
        montoNeto: parseFloat(values[i][5]) || 0
      });
    }

    return { status: 'success', count: records.length, data: records };
  } catch (error) {
    return { status: 'error', message: error.toString() };
  }
}

// ======================== POST HANDLERS ========================

/**
 * Save match registration data
 * Overwrites existing data for the same partidoId if overwrite=true
 */
function saveRegistroData(records, partidoId, partidoRival, overwrite) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    let sheet = spreadsheet.getSheetByName(REGISTRO_SHEET);

    if (!sheet) {
      sheet = spreadsheet.insertSheet(REGISTRO_SHEET);
      sheet.appendRow(['Timestamp', 'Partido_ID', 'Partido_Rival', 'Jugador', 'Estado', 'Goles', 'Valla_Invicta']);
    }

    // If overwrite: delete existing rows for this partidoId
    if (overwrite && partidoId) {
      const pid = parseInt(partidoId);
      const values = sheet.getDataRange().getValues();
      for (let i = values.length - 1; i >= 1; i--) {
        if (parseInt(values[i][1]) === pid) {
          sheet.deleteRow(i + 1);
        }
      }
    }

    // Append new records
    records.forEach(record => {
      sheet.appendRow([
        record.timestamp,
        record.partidoId,
        record.partidoRival,
        record.jugador,
        record.estado,
        record.goles || 0,
        record.vallaInvicta || 'No'
      ]);
    });

    return {
      status: 'success',
      message: `${records.length} registros guardados para partido vs ${partidoRival}`,
      count: records.length
    };
  } catch (error) {
    return { status: 'error', message: error.toString() };
  }
}

/**
 * Save a payment record AND update Fecha_Ultimo_Pago in Jugadores sheet
 */
function savePagoData(record) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    let sheet = spreadsheet.getSheetByName(PAGOS_SHEET);

    if (!sheet) {
      sheet = spreadsheet.insertSheet(PAGOS_SHEET);
      sheet.appendRow(['Timestamp', 'Jugador', 'Partidos', 'Monto_Bruto', 'Descuentos', 'Monto_Neto']);
    }

    sheet.appendRow([
      record.timestamp,
      record.jugador,
      record.partidos,
      record.montoBruto,
      record.descuentos,
      record.montoNeto
    ]);

    // Update Fecha_Ultimo_Pago in Jugadores_Pagos sheet (column 13, index 12)
    const fechaPago = (record.timestamp || '').split('T')[0] || new Date().toISOString().split('T')[0];
    updateFechaUltimoPago(record.jugador, fechaPago);

    return {
      status: 'success',
      message: `Pago registrado para ${record.jugador}`
    };
  } catch (error) {
    return { status: 'error', message: error.toString() };
  }
}

/**
 * Update the Fecha_Ultimo_Pago column for a specific player
 * Column M (index 12) in Jugadores_Pagos sheet
 */
function updateFechaUltimoPago(jugadorNombre, fecha) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const sheet = spreadsheet.getSheetByName(JUGADORES_SHEET);
    if (!sheet) return;

    const values = sheet.getDataRange().getValues();
    const nameLower = jugadorNombre.toLowerCase().trim();

    for (let i = 1; i < values.length; i++) {
      const cellName = (values[i][0] || '').toString().trim().toLowerCase();
      if (cellName === nameLower) {
        // Column M = index 12 (1-based column 13)
        sheet.getRange(i + 1, 13).setValue(fecha);
        return;
      }
    }
  } catch (error) {
    Logger.log('Error updating Fecha_Ultimo_Pago: ' + error.toString());
  }
}

// ======================== INITIALIZE ========================

/**
 * Run this once to create the initial sheet structure
 */
function initializeSheets() {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);

    // Jugadores_Pagos
    let jSheet = spreadsheet.getSheetByName(JUGADORES_SHEET);
    if (!jSheet) {
      jSheet = spreadsheet.insertSheet(JUGADORES_SHEET);
      jSheet.appendRow([
        'Nombre', 'Posicion', 'Tipo_Contratacion',
        'Monto_Titular', 'Monto_Suplente', 'Monto_Suplente_Min',
        'Monto_Quincena', 'Monto_Mensual', 'Fecha_Cobro',
        'Monto_Gol', 'Monto_Valla',
        'Fecha_Cobro_Mensual', 'Fecha_Ultimo_Pago'
      ]);
    }

    // Partidos_Pagos
    let pSheet = spreadsheet.getSheetByName(PARTIDOS_SHEET);
    if (!pSheet) {
      pSheet = spreadsheet.insertSheet(PARTIDOS_SHEET);
      pSheet.appendRow(['Rival']);
    }

    // Registro_Pagos
    let rSheet = spreadsheet.getSheetByName(REGISTRO_SHEET);
    if (!rSheet) {
      rSheet = spreadsheet.insertSheet(REGISTRO_SHEET);
      rSheet.appendRow(['Timestamp', 'Partido_ID', 'Partido_Rival', 'Jugador', 'Estado', 'Goles', 'Valla_Invicta']);
    }

    // Historial_Pagos
    let hSheet = spreadsheet.getSheetByName(PAGOS_SHEET);
    if (!hSheet) {
      hSheet = spreadsheet.insertSheet(PAGOS_SHEET);
      hSheet.appendRow(['Timestamp', 'Jugador', 'Partidos', 'Monto_Bruto', 'Descuentos', 'Monto_Neto']);
    }

    Logger.log('All sheets initialized successfully');
  } catch (error) {
    Logger.log('Error initializing sheets: ' + error.toString());
  }
}

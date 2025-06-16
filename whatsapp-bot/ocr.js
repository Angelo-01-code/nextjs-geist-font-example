const { createWorker } = require('tesseract.js');
const moment = require('moment');
const fs = require('fs-extra');
const path = require('path');
const config = require('./config');

async function logResult(contact, result) {
  const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
  const logEntry = `
Fecha: ${timestamp}
Contacto: ${contact}
Resultado: ${result.aceptado ? 'Aceptado' : 'Rechazado'}
Motivo: ${result.motivo}
-------------------------------
`;

  const logFile = path.join(config.logsPath, `${moment().format('YYYY-MM-DD')}.txt`);
  await fs.appendFile(logFile, logEntry);
}

async function validateText(text) {
  // Validate name
  if (!text.toLowerCase().includes(config.validName.toLowerCase())) {
    return { aceptado: false, motivo: "Falta nombre" };
  }

  // Validate operation number
  const operacionRegex = /operación\s*[:\-]?\s*([\w\d]{5,})/i;
  if (!operacionRegex.test(text)) {
    return { aceptado: false, motivo: "No se encontró número de operación válido" };
  }

  // Validate amount (reject if ~500 is found)
  const montoRegex = /\b500(?:\.00)?\b|S\/\s*500/i;
  if (montoRegex.test(text)) {
    return { aceptado: false, motivo: "El comprobante contiene monto cercano a 500" };
  }

  // Validate date
  const fechaRegex = /\b\d{1,2}\/\d{1,2}\/\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/;
  const fechaMatch = text.match(fechaRegex);
  
  if (!fechaMatch) {
    return { aceptado: false, motivo: "No se encontró fecha válida" };
  }

  const fecha = moment(fechaMatch[0], ['DD/MM/YYYY', 'YYYY-MM-DD']);
  const ahora = moment();
  const diferenciaDias = Math.abs(fecha.diff(ahora, 'days'));

  if (!fecha.isValid() || diferenciaDias > config.maxDateDifference) {
    return { aceptado: false, motivo: "Fecha inválida o fuera del rango permitido" };
  }

  return { aceptado: true, motivo: "Comprobante aceptado" };
}

async function processImage(imagePath, contact) {
  try {
    const worker = await createWorker('spa');
    
    const { data: { text } } = await worker.recognize(imagePath);
    await worker.terminate();

    const result = await validateText(text);
    await logResult(contact, result);
    
    return result;
  } catch (error) {
    const errorResult = { 
      aceptado: false, 
      motivo: `Error en procesamiento OCR: ${error.message}` 
    };
    await logResult(contact, errorResult);
    return errorResult;
  }
}

module.exports = {
  processImage
};

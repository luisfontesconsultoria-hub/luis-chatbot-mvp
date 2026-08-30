const { runCaptureStation } = require('./google-maps-station');
const { mapSpreadsheetRows } = require('./capture-spreadsheet');

function runGoogleMapsCapture(places, options = {}) {
  return runCaptureStation(Array.isArray(places) ? places : [], options);
}

function runSpreadsheetCapture(rows, options = {}) {
  return runCaptureStation(mapSpreadsheetRows(rows), options);
}

module.exports = { runGoogleMapsCapture, runSpreadsheetCapture };

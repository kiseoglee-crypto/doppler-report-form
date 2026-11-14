/**
 * Doppler Report Form -> Google Sheet receiver (Apps Script web app, bound to the spreadsheet "Doppler Report Data").
 *
 * Deploy: Deploy > New deployment > Web app
 *   Execute as: Me            (writes to YOUR sheet with your permissions)
 *   Who has access: Anyone    (required: the page on GitHub Pages calls this URL cross-origin without Google cookies)
 * Protection: every request must carry the shared SECRET stored in Script Properties (run setup() once, see the log).
 * The endpoint can only: ping, check whether a (reg_no, exam_date, exam_type) row exists, and append/overwrite a row.
 * It never returns stored patient data.
 */
var TABS = ['Arterial', 'Venous', 'DVT'];
var KEY_COLS = ['reg_no', 'exam_date', 'exam_type'];
var MAX_CELL = 49000; // Sheets cell limit is 50,000 characters

/** Run once from the editor (select "setup" > Run). Creates the 3 tabs and a random secret; read it in View > Logs / Execution log. */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  TABS.forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, 3).setValues([['case_uid', 'saved_at', 'app_version']]);
    sh.setFrozenRows(1);
  });
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('SECRET');
  if (!secret) {
    secret = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    props.setProperty('SECRET', secret);
  }
  Logger.log('SECRET (paste into the web page > Google Drive settings): ' + secret);
  return secret;
}

/** Run to create a NEW secret (old one stops working immediately). */
function rotateSecret() {
  PropertiesService.getScriptProperties().deleteProperty('SECRET');
  return setup();
}

function doGet() {
  return json_({ ok: true, info: 'Doppler report endpoint. POST only.' });
}

function doPost(e) {
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var secret = PropertiesService.getScriptProperties().getProperty('SECRET');
    if (!secret) return json_({ ok: false, error: 'Server not set up: run setup() in the Apps Script editor.' });
    if (!safeEqual_(String(req.secret || ''), secret)) return json_({ ok: false, error: 'Invalid secret.' });
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (req.action === 'ping') {
      return json_({ ok: true, spreadsheet: ss.getName(), sheets: ss.getSheets().map(function (s) { return s.getName(); }) });
    }
    if (TABS.indexOf(req.sheet) < 0) return json_({ ok: false, error: 'Unknown sheet: ' + req.sheet });
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var sh = ss.getSheetByName(req.sheet) || ss.insertSheet(req.sheet);
      if (req.action === 'check') {
        var m = findRows_(sh, req.key || {});
        return json_({ ok: true, count: m.rows.length, saved_at: m.savedAt });
      }
      if (req.action === 'save') return json_(save_(sh, req));
      return json_({ ok: false, error: 'Unknown action.' });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function save_(sh, req) {
  var cols = req.columns, vals = req.values;
  if (!Array.isArray(cols) || !Array.isArray(vals) || cols.length !== vals.length || !cols.length) return { ok: false, error: 'Bad payload.' };
  var key = req.key || {};
  if (!String(key.reg_no || '').trim() || !key.exam_date) return { ok: false, error: 'reg_no and exam_date are required.' };
  if (cols.some(function (c) { return /(^|_)(name|dob|birth|birthdate)(_|$)/i.test(String(c)); })) return { ok: false, error: 'Identifier columns (name/DOB) are not accepted.' };
  var header = ensureHeader_(sh, cols);
  var row = header.map(function () { return ''; });
  cols.forEach(function (c, i) {
    var v = vals[i] == null ? '' : String(vals[i]);
    if (v.length > MAX_CELL) v = v.slice(0, MAX_CELL) + ' [TRUNCATED]';
    row[header.indexOf(c)] = v;
  });
  var m = findRows_(sh, key);
  var mode = req.mode;
  if (m.rows.length && mode !== 'overwrite' && mode !== 'append') return { ok: false, duplicate: true, error: 'Record exists; choose overwrite or append.' };
  var target, used;
  if (m.rows.length && mode === 'overwrite') { target = m.rows[m.rows.length - 1]; used = 'overwrite'; }
  else { target = sh.getLastRow() + 1; used = 'append'; }
  var rng = sh.getRange(target, 1, 1, header.length);
  rng.setNumberFormat('@'); // keep reg_no leading zeros, dates as typed
  rng.setValues([row]);
  return { ok: true, row: target, mode: used };
}

/** Header row = union of existing and incoming columns (new ones appended at the right). */
function ensureHeader_(sh, cols) {
  var lastCol = sh.getLastColumn();
  var header = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
  while (header.length && header[header.length - 1] === '') header.pop();
  var add = cols.filter(function (c) { return header.indexOf(c) < 0; });
  if (add.length) {
    sh.getRange(1, header.length + 1, 1, add.length).setValues([add]);
    header = header.concat(add);
    sh.setFrozenRows(1);
  }
  return header;
}

function findRows_(sh, key) {
  var out = { rows: [], savedAt: [] };
  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (lastRow < 2 || !lastCol) return out;
  var header = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  var idx = KEY_COLS.map(function (k) { return header.indexOf(k); });
  if (idx.some(function (i) { return i < 0; })) return out;
  var sa = header.indexOf('saved_at');
  var data = sh.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();
  var want = [String(key.reg_no || '').trim(), String(key.exam_date || ''), String(key.exam_type || sh.getName())];
  data.forEach(function (r, i) {
    if (idx.every(function (ci, j) { return String(r[ci]).trim() === want[j]; })) {
      out.rows.push(i + 2);
      out.savedAt.push(sa >= 0 ? r[sa] : '');
    }
  });
  return out;
}

function safeEqual_(a, b) {
  if (a.length !== b.length) return false;
  var d = 0;
  for (var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

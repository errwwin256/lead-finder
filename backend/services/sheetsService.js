// backend/services/sheetsService.js
const { google } = require("googleapis");

/**
 * Builds GoogleAuth using service account JSON stored in ENV.
 * Required env vars:
 * - SHEET_ID
 * - GOOGLE_SERVICE_ACCOUNT_JSON  (the whole JSON string)
 */
function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_JSON in env");
  }

  let creds;
  try {
    creds = JSON.parse(raw);
  } catch (e) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON");
  }

  // Render often stores private_key with escaped newlines
  if (creds.private_key) {
    creds.private_key = creds.private_key.replace(/\\n/g, "\n");
  }

  return new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function getSheetsClient(auth) {
  return google.sheets({ version: "v4", auth });
}

async function appendRowsToResults(rows) {
  const sheetId = process.env.SHEET_ID;
  if (!sheetId) throw new Error("Missing SHEET_ID in env");

  const auth = getAuth();
  const sheets = getSheetsClient(auth);

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: "RESULTS!A1",
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows },
  });
}

async function readInputRows() {
  const sheetId = process.env.SHEET_ID;
  if (!sheetId) throw new Error("Missing SHEET_ID in env");

  const auth = getAuth();
  const sheets = getSheetsClient(auth);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "INPUT!A1:F",
  });

  const values = res.data.values || [];
  if (values.length < 2) return [];

  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const r = values[i] || [];
    rows.push({
      rowNumber: i + 1,
      profession: r[0] || "",
      city: r[1] || "",
      country: r[2] || "",
      status: (r[3] || "").toUpperCase(),
      last_run: r[4] || "",
      note: r[5] || "",
    });
  }
  return rows;
}

async function updateInputRow({ rowNumber, status, note }) {
  const sheetId = process.env.SHEET_ID;
  if (!sheetId) throw new Error("Missing SHEET_ID in env");

  const auth = getAuth();
  const sheets = getSheetsClient(auth);
  const now = new Date().toISOString();

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `INPUT!D${rowNumber}:F${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[status, now, note || ""]] },
  });
}

/**
 * Read existing place_ids from RESULTS for dedupe.
 * Assumes place_id is the LAST column (A2:N => last is N).
 */
async function readExistingPlaceIds() {
  const sheetId = process.env.SHEET_ID;
  if (!sheetId) throw new Error("Missing SHEET_ID in env");

  const auth = getAuth();
  const sheets = getSheetsClient(auth);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "RESULTS!A2:N",
  });

  const values = res.data.values || [];
  const set = new Set();

  for (const row of values) {
    const pid = (row[row.length - 1] || "").trim();
    if (pid) set.add(pid);
  }
  return set;
}

async function appendInputRows(rows) {
  const sheetId = process.env.SHEET_ID;
  if (!sheetId) throw new Error("Missing SHEET_ID in env");

  const auth = getAuth();
  const sheets = getSheetsClient(auth);

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: "INPUT!A1",
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows },
  });
}

module.exports = {
  appendRowsToResults,
  readInputRows,
  updateInputRow,
  readExistingPlaceIds,
  appendInputRows,
};

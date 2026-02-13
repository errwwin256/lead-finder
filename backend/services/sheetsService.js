const { google } = require("googleapis");
const path = require("path");

function getAuth() {
  const keyFilePath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH;
  if (!keyFilePath)
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_PATH in .env");

  return new google.auth.GoogleAuth({
    keyFile: path.resolve(process.cwd(), keyFilePath),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function getSheetsClient(auth) {
  return google.sheets({ version: "v4", auth });
}

async function appendRowsToResults(rows) {
  const sheetId = process.env.SHEET_ID;
  if (!sheetId) throw new Error("Missing SHEET_ID in .env");

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
  if (!sheetId) throw new Error("Missing SHEET_ID in .env");

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
  if (!sheetId) throw new Error("Missing SHEET_ID in .env");

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
 * Assumes place_id is the LAST column (example: N column).
 * If your sheet has different layout, tell me and I’ll adjust the range.
 */
async function readExistingPlaceIds() {
  const sheetId = process.env.SHEET_ID;
  if (!sheetId) throw new Error("Missing SHEET_ID in .env");

  const auth = getAuth();
  const sheets = getSheetsClient(auth);

  // read full rows (A:N) then take last cell as place_id
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "RESULTS!A2:N",
  });

  const values = res.data.values || [];
  const set = new Set();

  for (const row of values) {
    const pid = (row[row.length - 1] || "").trim(); // last column
    if (pid) set.add(pid);
  }
  return set;
}

/**
 * Append new INPUT rows (profession/city/country/status).
 */
async function appendInputRows(rows) {
  const sheetId = process.env.SHEET_ID;
  if (!sheetId) throw new Error("Missing SHEET_ID in .env");

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

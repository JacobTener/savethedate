const ADDRESS_SHEET = "Addresses";
const GUEST_SHEET = "Guest List";
const SHEET_ID_KEY = "SHEET_ID";

const ADDRESS_HEADERS = [
  "Submitted",
  "Names",
  "Household",
  "Type",
  "Attending",
  "Declining",
  "Plus one",
  "Plus one name",
  "Address 1",
  "Address 2",
  "City",
  "State",
  "ZIP",
  "Country",
  "Email",
  "Notes",
];

const GUEST_HEADERS = ["Household", "Lookup names", "Type", "Members", "Plus one"];

const EXAMPLE_GUESTS = [
  [
    "The Example Family",
    "Example Family, Example",
    "family",
    "Alex Example; Jordan Example; Sam Example",
    "no",
  ],
  ["Taylor Reed", "Taylor, Reed", "plus_one", "Taylor Reed", "yes"],
  ["Riley Chen", "Riley, Avery, Chen", "plus_one", "Riley Chen; Avery Chen", "yes"],
  ["Casey Morgan", "Casey, Morgan", "individual", "Casey Morgan", "no"],
];

function doPost(e) {
  const params = (e && e.parameter) || {};

  if (params.company) {
    return json_({ ok: true });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    getAddressSheet_().appendRow([
      new Date(),
      params.names || "",
      params.household || "",
      params.type || "",
      params.attending || "",
      params.declining || "",
      params.plusOne || "",
      params.plusOneName || "",
      params.address1 || "",
      params.address2 || "",
      params.city || "",
      params.state || "",
      params.zip || "",
      params.country || "",
      params.email || "",
      params.notes || "",
    ]);
    return json_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

function setup() {
  getGuestSheet_();
  getAddressSheet_();
}

function doGet(e) {
  const params = (e && e.parameter) || {};

  if (params.action === "lookup") {
    const result = lookupGuests_(params.name || "");

    if (params.embed === "1") {
      return embedLookup_(result);
    }

    return json_(result, params.callback);
  }

  return json_({ ok: true }, params.callback);
}

function embedLookup_(result) {
  const payload = JSON.stringify({
    source: "hannah-jake-lookup",
    result: result,
  }).replace(/</g, "\\u003c");

  const html = HtmlService.createHtmlOutput(
    "<script>window.top.postMessage(" + payload + ", \"*\");</script>"
  );
  html.setTitle("Guest lookup");
  html.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  return html;
}

function lookupGuests_(rawName) {
  const query = String(rawName || "").trim();

  if (!query) {
    return { matches: [] };
  }

  const rows = getGuestSheet_().getDataRange().getValues();
  const matches = [];

  for (let i = 1; i < rows.length; i += 1) {
    const household = String(rows[i][0] || "").trim();
    const lookupNames = splitNames_(rows[i][1], ",");
    const type = normalizeType_(rows[i][2]);
    const members = splitNames_(rows[i][3], ";");
    const plusOne = isYes_(rows[i][4]) || type === "plus_one";

    if (!household && !members.length) {
      continue;
    }

    if (!lookupNames.some(function (name) { return nameMatches_(query, name); })) {
      continue;
    }

    matches.push({
      id: String(i + 1),
      household: household || members[0] || "Guest",
      type: type,
      members: members,
      plusOne: type === "family" ? false : plusOne,
      lookupNames: lookupNames,
    });

    if (matches.length >= 8) {
      break;
    }
  }

  return { matches: matches };
}

function nameMatches_(query, candidate) {
  const normalizedQuery = normalizeName_(query);
  const normalizedCandidate = normalizeName_(candidate);

  return Boolean(normalizedQuery) && normalizedQuery === normalizedCandidate;
}

function normalizeName_(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeType_(value) {
  const type = String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .trim();

  if (type === "family") {
    return "family";
  }

  if (type === "plus_one" || type === "plusone") {
    return "plus_one";
  }

  return "individual";
}

function isYes_(value) {
  return /^(yes|y|true|1)$/i.test(String(value || "").trim());
}

function splitNames_(value, delimiter) {
  return String(value || "")
    .split(delimiter)
    .map(function (part) { return part.trim(); })
    .filter(Boolean);
}

function getSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  let sheetId = props.getProperty(SHEET_ID_KEY);
  const spreadsheet = sheetId
    ? SpreadsheetApp.openById(sheetId)
    : SpreadsheetApp.create("Wedding Guest Addresses");

  if (!sheetId) {
    props.setProperty(SHEET_ID_KEY, spreadsheet.getId());
  }

  return spreadsheet;
}

function getAddressSheet_() {
  return ensureSheet_(ADDRESS_SHEET, ADDRESS_HEADERS, []);
}

function getGuestSheet_() {
  return ensureSheet_(GUEST_SHEET, GUEST_HEADERS, EXAMPLE_GUESTS);
}

function ensureSheet_(name, headers, seedRows) {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(name);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }

  const existing = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  if (existing.join("|") !== headers.join("|")) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }

  if (sheet.getLastRow() < 2 && seedRows.length) {
    sheet.getRange(2, 1, seedRows.length, headers.length).setValues(seedRows);
  }

  return sheet;
}

function json_(payload, callback) {
  const body = JSON.stringify(payload);

  if (callback && /^[A-Za-z_$][\w$]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + "(" + body + ")").setMimeType(
      ContentService.MimeType.JAVASCRIPT
    );
  }

  return ContentService.createTextOutput(body).setMimeType(
    ContentService.MimeType.JSON
  );
}

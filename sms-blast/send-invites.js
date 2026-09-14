/**
 * Send save-the-date texts from a CSV of names and numbers.
 *
 * Setup
 *   1. Copy guests.example.csv to guests.csv and paste your list.
 *      Columns can be name / first / first name and phone / mobile / cell.
 *   2. Copy .env.example to .env and add your Twilio credentials.
 *   3. Preview:  node send-invites.js
 *   4. Test one: node send-invites.js --send --limit 1 --to +15551234567
 *   5. Blast:    node send-invites.js --send
 *
 * Placeholders in the message: {name}  {first}
 */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const ENV_PATH = path.join(ROOT, ".env");
const DEFAULT_CSV = path.join(ROOT, "guests.csv");
const LOG_PATH = path.join(ROOT, "sent-log.json");
const SITE_URL = "https://hannahandjake2027.com";
const DEFAULT_MESSAGE =
  "Hi {first}! Hannah & Jake are getting married Saturday, August 14, 2027 in Chicago. Please save the date and send your mailing address: " +
  SITE_URL;

const NAME_HEADERS = ["name", "full name", "guest", "guest name", "names"];
const FIRST_HEADERS = ["first", "first name", "firstname", "given name"];
const PHONE_HEADERS = [
  "phone",
  "phone number",
  "phonenumber",
  "mobile",
  "cell",
  "cell phone",
  "number",
  "tel",
  "telephone",
];

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      continue;
    }

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function parseArgs(argv) {
  const args = {
    csv: DEFAULT_CSV,
    send: false,
    limit: Infinity,
    to: "",
    delayMs: 1100,
    message: DEFAULT_MESSAGE,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const next = argv[i + 1];

    if (flag === "--send") {
      args.send = true;
    } else if (flag === "--csv" && next) {
      args.csv = path.resolve(next);
      i += 1;
    } else if (flag === "--limit" && next) {
      args.limit = Number(next);
      i += 1;
    } else if (flag === "--to" && next) {
      args.to = next;
      i += 1;
    } else if (flag === "--delay" && next) {
      args.delayMs = Number(next);
      i += 1;
    } else if (flag === "--message" && next) {
      args.message = next;
      i += 1;
    } else if (flag === "--help" || flag === "-h") {
      args.help = true;
    }
  }

  return args;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(field);
      if (row.some((value) => String(value).trim())) {
        rows.push(row);
      }
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  if (field || row.length) {
    row.push(field);
    if (row.some((value) => String(value).trim())) {
      rows.push(row);
    }
  }

  return rows;
}

function headerKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findColumn(headers, aliases) {
  return headers.findIndex((header) => aliases.includes(header));
}

function firstNameFrom(fullName) {
  const cleaned = String(fullName || "").trim();
  if (!cleaned) {
    return "there";
  }

  return cleaned.split(/\s+/)[0].replace(/,+$/, "") || "there";
}

function normalizePhone(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) {
    return "+1" + digits;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return "+" + digits;
  }
  if (raw.startsWith("+") && digits.length >= 10) {
    return "+" + digits;
  }

  return "";
}

function loadGuests(csvPath) {
  if (!fs.existsSync(csvPath)) {
    throw new Error(
      "CSV not found. Copy guests.example.csv to guests.csv, or pass --csv path\\to\\file.csv"
    );
  }

  const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
  if (rows.length < 2) {
    throw new Error("CSV needs a header row and at least one guest.");
  }

  const headers = rows[0].map(headerKey);
  const nameIndex = findColumn(headers, NAME_HEADERS);
  const firstIndex = findColumn(headers, FIRST_HEADERS);
  const phoneIndex = findColumn(headers, PHONE_HEADERS);

  if (phoneIndex === -1) {
    throw new Error(
      "Could not find a phone column. Use a header like phone, mobile, or cell."
    );
  }

  if (nameIndex === -1 && firstIndex === -1) {
    throw new Error(
      "Could not find a name column. Use a header like name or first."
    );
  }

  const guests = [];
  const seen = new Set();

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const fullName = nameIndex === -1 ? "" : String(row[nameIndex] || "").trim();
    const first =
      firstIndex === -1
        ? firstNameFrom(fullName)
        : String(row[firstIndex] || "").trim() || firstNameFrom(fullName);
    const phone = normalizePhone(row[phoneIndex]);

    if (!phone) {
      console.warn("Skipping row " + (i + 1) + ": missing or invalid number.");
      continue;
    }

    if (seen.has(phone)) {
      console.warn("Skipping duplicate number: " + phone);
      continue;
    }

    seen.add(phone);
    guests.push({
      name: fullName || first,
      first,
      phone,
    });
  }

  return guests;
}

function renderMessage(template, guest) {
  return template
    .replaceAll("{name}", guest.name)
    .replaceAll("{first}", guest.first)
    .trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendSms(sid, token, from, to, body) {
  const auth = Buffer.from(sid + ":" + token).toString("base64");
  const response = await fetch(
    "https://api.twilio.com/2010-04-01/Accounts/" + sid + "/Messages.json",
    {
      method: "POST",
      headers: {
        Authorization: "Basic " + auth,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: from,
        To: to,
        Body: body,
      }),
    }
  );

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.message || "Twilio rejected the message.");
  }

  return result.sid;
}

function appendLog(entry) {
  const existing = fs.existsSync(LOG_PATH)
    ? JSON.parse(fs.readFileSync(LOG_PATH, "utf8"))
    : [];
  existing.push(entry);
  fs.writeFileSync(LOG_PATH, JSON.stringify(existing, null, 2));
}

async function main() {
  loadEnv(ENV_PATH);
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(`Usage:
  node send-invites.js                  Preview everyone
  node send-invites.js --send           Send to the CSV
  node send-invites.js --send --limit 1 Send the first row only
  node send-invites.js --csv file.csv   Use another CSV
  node send-invites.js --to +1555...    Override the destination (for a test)
  node send-invites.js --message "Hi {first}! ..."
`);
    return;
  }

  const guests = loadGuests(args.csv).slice(
    0,
    Number.isFinite(args.limit) ? args.limit : undefined
  );

  if (!guests.length) {
    throw new Error("No valid guests found in the CSV.");
  }

  console.log(
    (args.send ? "Sending" : "Previewing") +
      " " +
      guests.length +
      " message" +
      (guests.length === 1 ? "" : "s") +
      " from " +
      path.basename(args.csv) +
      "\n"
  );

  for (const guest of guests) {
    const to = args.to ? normalizePhone(args.to) || args.to : guest.phone;
    const body = renderMessage(args.message, guest);
    console.log(guest.name + "  " + to);
    console.log("  " + body + "\n");
  }

  if (!args.send) {
    console.log("Dry run only. Add --send when you are ready to text people.");
    return;
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!sid || !token || !from) {
    throw new Error(
      "Missing Twilio settings. Copy .env.example to .env and fill in TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER."
    );
  }

  console.log("Sending in 5 seconds. Press Ctrl+C to cancel.\n");
  await sleep(5000);

  let sent = 0;
  let failed = 0;

  for (const guest of guests) {
    const to = args.to ? normalizePhone(args.to) || args.to : guest.phone;
    const body = renderMessage(args.message, guest);

    try {
      const messageSid = await sendSms(sid, token, from, to, body);
      sent += 1;
      console.log("Sent  " + guest.name + "  " + to);
      appendLog({
        at: new Date().toISOString(),
        name: guest.name,
        phone: to,
        sid: messageSid,
        ok: true,
      });
    } catch (error) {
      failed += 1;
      console.error("Failed  " + guest.name + "  " + to + "  " + error.message);
      appendLog({
        at: new Date().toISOString(),
        name: guest.name,
        phone: to,
        error: error.message,
        ok: false,
      });
    }

    await sleep(args.delayMs);
  }

  console.log("\nDone. Sent " + sent + ", failed " + failed + ".");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

const eventDetails = {
  // Update these values with your real wedding details.
  title: "Hannah Forrestal & Jacob Tener Wedding",
  description:
    "Save the date for the wedding of Hannah Forrestal and Jacob Tener. Invitation to follow.",
  location: "Chicago, Illinois",
  start: "2027-08-14T16:00:00-05:00",
  end: "2027-08-14T23:00:00-05:00",
  timeZone: "America/Chicago",
  icsFileName: "save-the-date.ics",
};

function toUtcDateStamp(dateString) {
  const date = new Date(dateString);
  const parts = [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
    "T",
    String(date.getUTCHours()).padStart(2, "0"),
    String(date.getUTCMinutes()).padStart(2, "0"),
    String(date.getUTCSeconds()).padStart(2, "0"),
    "Z",
  ];

  return parts.join("");
}

function escapeIcsText(value) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
    .replace(/\n/g, "\\n");
}

function buildGoogleCalendarUrl(details) {
  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", details.title);
  url.searchParams.set(
    "dates",
    `${toUtcDateStamp(details.start)}/${toUtcDateStamp(details.end)}`
  );
  url.searchParams.set("details", details.description);
  url.searchParams.set("location", details.location);
  url.searchParams.set("ctz", details.timeZone);
  return url.toString();
}

function buildIcsContent(details) {
  const nowStamp = toUtcDateStamp(new Date().toISOString());

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SaveTheDate//Wedding Event//EN",
    "BEGIN:VEVENT",
    `UID:${crypto.randomUUID()}@savethedate.local`,
    `DTSTAMP:${nowStamp}`,
    `DTSTART:${toUtcDateStamp(details.start)}`,
    `DTEND:${toUtcDateStamp(details.end)}`,
    `SUMMARY:${escapeIcsText(details.title)}`,
    `DESCRIPTION:${escapeIcsText(details.description)}`,
    `LOCATION:${escapeIcsText(details.location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function buildAppleCalendarUrl(details) {
  const content = buildIcsContent(details);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  return URL.createObjectURL(blob);
}

const googleLink = document.getElementById("google-calendar-link");
const appleLink = document.getElementById("apple-calendar-link");

googleLink.href = buildGoogleCalendarUrl(eventDetails);
appleLink.href = buildAppleCalendarUrl(eventDetails);
appleLink.download = eventDetails.icsFileName;

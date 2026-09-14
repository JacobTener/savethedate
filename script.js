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

function isAppleMobile() {
  const userAgent = navigator.userAgent || "";
  return (
    /iPad|iPhone|iPod/.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

const googleLink = document.getElementById("google-calendar-link");
const appleLink = document.getElementById("apple-calendar-link");

googleLink.href = buildGoogleCalendarUrl(eventDetails);
appleLink.href = "/save-the-date.ics";

if (!isAppleMobile()) {
  appleLink.setAttribute("download", eventDetails.icsFileName);
}

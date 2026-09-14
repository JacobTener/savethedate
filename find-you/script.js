// Paste the Google Apps Script web app URL after deploying find-you/Code.gs.
// The Guest List sheet is the source of truth for plus-ones and family members.
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwAGqlW1hT_Tyq4AaOg1ufZgT8Ml_HGkT90rzKVcsZhkbidlvcc_pJW_aotANGRxp5blQ/exec";

// Used only before the Google Sheet is connected, so the page can be tried locally.
const LOCAL_GUEST_LIST = [
  {
    id: "example-family",
    household: "The Example Family",
    type: "family",
    members: ["Alex Example", "Jordan Example", "Sam Example"],
    plusOne: false,
    lookupNames: ["Example Family", "Example"],
  },
  {
    id: "example-plus",
    household: "Taylor Reed",
    type: "plus_one",
    members: ["Taylor Reed"],
    plusOne: true,
    lookupNames: ["Taylor", "Reed"],
  },
  {
    id: "example-named-plus",
    household: "Riley Chen",
    type: "plus_one",
    members: ["Riley Chen", "Avery Chen"],
    plusOne: true,
    lookupNames: ["Riley", "Avery", "Chen"],
  },
  {
    id: "example-solo",
    household: "Casey Morgan",
    type: "individual",
    members: ["Casey Morgan"],
    plusOne: false,
    lookupNames: ["Casey", "Morgan"],
  },
];

const US_STATES = [
  ["AL", "Alabama"],
  ["AK", "Alaska"],
  ["AZ", "Arizona"],
  ["AR", "Arkansas"],
  ["CA", "California"],
  ["CO", "Colorado"],
  ["CT", "Connecticut"],
  ["DE", "Delaware"],
  ["DC", "District of Columbia"],
  ["FL", "Florida"],
  ["GA", "Georgia"],
  ["HI", "Hawaii"],
  ["ID", "Idaho"],
  ["IL", "Illinois"],
  ["IN", "Indiana"],
  ["IA", "Iowa"],
  ["KS", "Kansas"],
  ["KY", "Kentucky"],
  ["LA", "Louisiana"],
  ["ME", "Maine"],
  ["MD", "Maryland"],
  ["MA", "Massachusetts"],
  ["MI", "Michigan"],
  ["MN", "Minnesota"],
  ["MS", "Mississippi"],
  ["MO", "Missouri"],
  ["MT", "Montana"],
  ["NE", "Nebraska"],
  ["NV", "Nevada"],
  ["NH", "New Hampshire"],
  ["NJ", "New Jersey"],
  ["NM", "New Mexico"],
  ["NY", "New York"],
  ["NC", "North Carolina"],
  ["ND", "North Dakota"],
  ["OH", "Ohio"],
  ["OK", "Oklahoma"],
  ["OR", "Oregon"],
  ["PA", "Pennsylvania"],
  ["RI", "Rhode Island"],
  ["SC", "South Carolina"],
  ["SD", "South Dakota"],
  ["TN", "Tennessee"],
  ["TX", "Texas"],
  ["UT", "Utah"],
  ["VT", "Vermont"],
  ["VA", "Virginia"],
  ["WA", "Washington"],
  ["WV", "West Virginia"],
  ["WI", "Wisconsin"],
  ["WY", "Wyoming"],
];

const form = document.getElementById("address-form");
const formPanel = document.getElementById("form-panel");
const successPanel = document.getElementById("success-panel");
const errorEl = document.getElementById("form-error");
const submitButton = document.getElementById("submit-button");
const countryEl = document.getElementById("country");
const stateField = document.getElementById("state-field");
const lookupNameEl = document.getElementById("lookup-name");
const lookupButton = document.getElementById("lookup-button");
const lookupStatus = document.getElementById("lookup-status");
const matchChoices = document.getElementById("match-choices");
const partyPanel = document.getElementById("party-panel");
const addressSection = document.getElementById("address-section");

let selectedMatch = null;

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function nameMatches(query, candidate) {
  const normalizedQuery = normalizeName(query);
  const normalizedCandidate = normalizeName(candidate);

  return Boolean(normalizedQuery) && normalizedQuery === normalizedCandidate;
}

function householdMatches(query, household) {
  return (household.lookupNames || []).some((candidate) => nameMatches(query, candidate));
}

function populateUsStates() {
  const select = document.createElement("select");
  select.className = "field-input";
  select.id = "state";
  select.name = "state";
  select.autocomplete = "address-level1";
  select.required = true;
  select.innerHTML = `<option value="" disabled selected>Select</option>`;

  for (const [value, label] of US_STATES) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  }

  return select;
}

function populateRegionInput() {
  const input = document.createElement("input");
  input.className = "field-input";
  input.id = "state";
  input.name = "state";
  input.type = "text";
  input.autocomplete = "address-level1";
  input.maxLength = 80;
  input.required = true;
  return input;
}

function syncRegionField() {
  const current = document.getElementById("state");
  const isUnitedStates = countryEl.value === "United States";
  const label = stateField.querySelector(".field-label");
  const next = isUnitedStates ? populateUsStates() : populateRegionInput();

  label.textContent = isUnitedStates ? "State" : "State / Region";
  current.replaceWith(next);
}

function showError(message) {
  errorEl.hidden = !message;
  errorEl.textContent = message;
}

function setLookupStatus(message) {
  lookupStatus.hidden = !message;
  lookupStatus.textContent = message;
}

function getTrimmedValue(name) {
  const field = form.elements.namedItem(name);
  return field && "value" in field ? field.value.trim() : "";
}

function resetMatchState() {
  selectedMatch = null;
  matchChoices.hidden = true;
  matchChoices.replaceChildren();
  partyPanel.hidden = true;
  partyPanel.replaceChildren();
  addressSection.hidden = true;
}

function createChoice(type, name, value, label, checked) {
  const choice = document.createElement("label");
  choice.className = "choice-card";

  const input = document.createElement("input");
  input.type = type;
  input.name = name;
  input.value = value;
  input.checked = Boolean(checked);

  const text = document.createElement("span");
  text.textContent = label;

  choice.append(input, text);
  return choice;
}

function renderMatchChoices(matches) {
  matchChoices.replaceChildren();

  if (matches.length < 2) {
    matchChoices.hidden = true;
    return;
  }

  const heading = document.createElement("p");
  heading.className = "choice-heading";
  heading.textContent = "A few households matched. Choose yours:";
  matchChoices.append(heading);

  for (const match of matches) {
    const choice = createChoice("radio", "household-choice", match.id, match.household);
    choice.querySelector("input").addEventListener("change", () => {
      selectedMatch = match;
      renderPartyPanel(match);
    });
    matchChoices.append(choice);
  }

  matchChoices.hidden = false;
}

function getInviteMembers(match) {
  const members = (match.members || []).map((member) => member.trim()).filter(Boolean);

  if (members.length) {
    return members;
  }

  return match.household ? [match.household] : [];
}

function hasPlusOne(match) {
  return Boolean(match.plusOne || match.type === "plus_one") && getInviteMembers(match).length < 2;
}

function renderInviteList(members) {
  const list = document.createElement("ul");
  list.className = "invite-list";

  for (const member of members) {
    const item = document.createElement("li");
    item.textContent = member;
    list.append(item);
  }

  return list;
}

function renderPartyPanel(match) {
  partyPanel.replaceChildren();
  selectedMatch = match;

  const members = getInviteMembers(match);
  const heading = document.createElement("p");
  heading.className = "party-heading";
  heading.textContent = match.household;

  const summary = document.createElement("p");
  summary.className = "party-summary";

  const searchAgain = document.createElement("button");
  searchAgain.type = "button";
  searchAgain.className = "search-again";
  searchAgain.textContent = "Search a different name";
  searchAgain.addEventListener("click", () => {
    resetMatchState();
    setLookupStatus("");
    showError("");
    lookupNameEl.focus();
  });

  partyPanel.append(heading);

  if (members.length > 1) {
    summary.textContent = "Everyone included on this save the date:";
    partyPanel.append(summary, renderInviteList(members));
  } else {
    summary.textContent = hasPlusOne(match)
      ? "This save the date includes a plus one."
      : "This save the date does not include a plus one.";
    partyPanel.append(summary);

    if (members.length === 1) {
      partyPanel.append(renderInviteList(members));
    }
  }

  partyPanel.append(searchAgain);
  partyPanel.hidden = false;
  addressSection.hidden = false;
}

function logLookup(step, extra) {
  if (extra !== undefined) {
    console.info("[find-you]", step, extra);
    return;
  }

  console.info("[find-you]", step);
}

function isAppsScriptOrigin(origin) {
  try {
    const host = new URL(origin).hostname;
    return host === "script.google.com" || host.endsWith(".googleusercontent.com");
  } catch (error) {
    return false;
  }
}

function queryGuestList(name) {
  if (!APPS_SCRIPT_URL) {
    const matches = LOCAL_GUEST_LIST.filter((household) => householdMatches(name, household));
    logLookup("local lookup", { name, matchCount: matches.length });
    return Promise.resolve({ matches });
  }

  return new Promise((resolve, reject) => {
    const url = new URL(APPS_SCRIPT_URL);
    url.searchParams.set("action", "lookup");
    url.searchParams.set("name", name);
    url.searchParams.set("embed", "1");

    const iframe = document.createElement("iframe");
    iframe.hidden = true;
    iframe.title = "Guest list lookup";
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText = "position:absolute;width:0;height:0;border:0;visibility:hidden";

    let settled = false;
    const timeout = window.setTimeout(() => {
      finish(() => reject(new Error("The guest list took too long to respond.")));
    }, 20000);

    function finish(action) {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
      iframe.remove();
      action();
    }

    function onMessage(event) {
      if (!isAppsScriptOrigin(event.origin)) {
        logLookup("ignored message origin", event.origin);
        return;
      }

      const data = event.data;
      if (!data || data.source !== "hannah-jake-lookup") {
        return;
      }

      logLookup("lookup response", {
        name,
        matchCount: Array.isArray(data.result && data.result.matches)
          ? data.result.matches.length
          : 0,
      });
      finish(() =>
        resolve(data.result && typeof data.result === "object" ? data.result : { matches: [] })
      );
    }

    window.addEventListener("message", onMessage);
    iframe.src = url.toString();
    logLookup("lookup request", { name, url: url.toString() });
    document.body.appendChild(iframe);
  });
}

async function lookupGuest() {
  const name = lookupNameEl.value.trim();
  showError("");
  resetMatchState();

  if (name.length < 1) {
    setLookupStatus("Enter a lookup name from your invitation.");
    return;
  }

  lookupButton.disabled = true;
  lookupButton.textContent = "Finding…";
  setLookupStatus("Looking up your invitation…");
  logLookup("find clicked", name);

  try {
    const result = await queryGuestList(name);
    const matches = result.matches || [];

    if (!matches.length) {
      logLookup("no matches", name);
      setLookupStatus(
        `We could not find “${name}” on the guest list. Enter a lookup name exactly as listed.`
      );
      return;
    }

    logLookup(
      "matches",
      matches.map((match) => match.household)
    );

    if (matches.length === 1) {
      setLookupStatus("We found your invitation.");
      renderPartyPanel(matches[0]);
      return;
    }

    setLookupStatus("");
    renderMatchChoices(matches);
  } catch (error) {
    console.error("[find-you] lookup failed", error);
    setLookupStatus("");
    showError(error.message || "We could not look up that name right now. Please try again.");
  } finally {
    lookupButton.disabled = false;
    lookupButton.textContent = "Find";
  }
}

function validateForm() {
  if (!selectedMatch) {
    return "Please find your name on the guest list first.";
  }

  for (const name of ["address1", "city", "state", "zip", "country"]) {
    if (!getTrimmedValue(name)) {
      return "Please complete every required address field.";
    }
  }

  const email = getTrimmedValue("email");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Please enter a valid email, or leave that field blank.";
  }

  return "";
}

async function submitAddress(event) {
  event.preventDefault();
  showError("");

  if (getTrimmedValue("company")) {
    formPanel.hidden = true;
    successPanel.hidden = false;
    return;
  }

  const validationError = validateForm();
  if (validationError) {
    showError(validationError);
    return;
  }

  const payload = {
    names: lookupNameEl.value.trim(),
    household: selectedMatch.household,
    householdId: selectedMatch.id,
    type: selectedMatch.type,
    attending: getInviteMembers(selectedMatch).join("; "),
    declining: "",
    plusOne: hasPlusOne(selectedMatch) ? "yes" : "no",
    plusOneName: "",
    address1: getTrimmedValue("address1"),
    address2: getTrimmedValue("address2"),
    city: getTrimmedValue("city"),
    state: getTrimmedValue("state"),
    zip: getTrimmedValue("zip"),
    country: getTrimmedValue("country"),
    email: getTrimmedValue("email"),
    notes: getTrimmedValue("notes"),
  };

  if (!APPS_SCRIPT_URL) {
    formPanel.hidden = true;
    successPanel.hidden = false;
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Sending…";

  try {
    await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(payload),
    });

    formPanel.hidden = true;
    successPanel.hidden = false;
  } catch (error) {
    showError("Something went wrong. Please try again in a moment.");
    submitButton.disabled = false;
    submitButton.textContent = "Send address";
  }
}

lookupButton.addEventListener("click", lookupGuest);
lookupNameEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    lookupGuest();
  }
});
countryEl.addEventListener("change", syncRegionField);
form.addEventListener("submit", submitAddress);
syncRegionField();

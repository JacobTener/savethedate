// Paste the Google Apps Script web app URL after deploying find-you/Code.gs.
// The Guest List sheet is the source of truth for plus-ones and family members.
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzd2rxSD9FqgsH8PrmO61jeIRnOQq1zUpIKvl_KZVRFh3zxjZv2kMvOo1KxO1nllIcjxQ/exec";

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

function nameTokens(value) {
  return normalizeName(value).split(" ").filter(Boolean);
}

function nameMatches(query, candidate) {
  const normalizedQuery = normalizeName(query);
  const normalizedCandidate = normalizeName(candidate);

  if (normalizedQuery.length < 3 || !normalizedCandidate) {
    return false;
  }

  if (normalizedCandidate === normalizedQuery) {
    return true;
  }

  const queryTokens = nameTokens(query);
  const candidateTokens = nameTokens(candidate);

  return queryTokens.every((queryToken) =>
    candidateTokens.some(
      (candidateToken) =>
        candidateToken === queryToken ||
        (queryToken.length >= 3 && candidateToken.startsWith(queryToken))
    )
  );
}

function householdMatches(query, household) {
  const candidates = [
    household.household,
    ...(household.lookupNames || []),
    ...(household.members || []),
  ];

  return candidates.some((candidate) => nameMatches(query, candidate));
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

function renderPartyPanel(match) {
  partyPanel.replaceChildren();
  selectedMatch = match;

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

  if (match.type === "family") {
    summary.textContent = "Who will attend?";
    partyPanel.append(heading, summary);

    const none = createChoice("checkbox", "none-attending", "none", "None of us will attend");
    const noneInput = none.querySelector("input");

    for (const member of match.members) {
      const choice = createChoice("checkbox", "attending-member", member, member, true);
      const input = choice.querySelector("input");
      input.addEventListener("change", () => {
        if (input.checked) {
          noneInput.checked = false;
        }
      });
      partyPanel.append(choice);
    }

    noneInput.addEventListener("change", () => {
      if (!noneInput.checked) {
        return;
      }

      for (const input of partyPanel.querySelectorAll('input[name="attending-member"]')) {
        input.checked = false;
      }
    });

    partyPanel.append(none);
  } else if (match.plusOne || match.type === "plus_one") {
    summary.textContent = "You are invited with a plus one.";
    partyPanel.append(heading, summary);
    partyPanel.append(createChoice("radio", "plus-one", "no", "Just me", true));
    partyPanel.append(createChoice("radio", "plus-one", "yes", "I will bring a guest"));

    const guestField = document.createElement("div");
    guestField.className = "field plus-one-name";
    guestField.hidden = true;

    const guestLabel = document.createElement("label");
    guestLabel.className = "field-label";
    guestLabel.htmlFor = "plus-one-name";
    guestLabel.textContent = "Guest name";

    const guestInput = document.createElement("input");
    guestInput.className = "field-input";
    guestInput.id = "plus-one-name";
    guestInput.name = "plusOneName";
    guestInput.type = "text";
    guestInput.maxLength = 120;
    guestInput.autocomplete = "off";

    guestField.append(guestLabel, guestInput);
    partyPanel.append(guestField);

    for (const input of partyPanel.querySelectorAll('input[name="plus-one"]')) {
      input.addEventListener("change", () => {
        guestField.hidden = getTrimmedValue("plus-one") !== "yes";
        if (guestField.hidden) {
          guestInput.value = "";
        } else {
          guestInput.focus();
        }
      });
    }
  } else {
    summary.textContent = "This invitation does not include a plus one.";
    partyPanel.append(heading, summary);
  }

  partyPanel.append(searchAgain);
  partyPanel.hidden = false;
  addressSection.hidden = false;
}

function queryGuestList(name) {
  if (!APPS_SCRIPT_URL) {
    return Promise.resolve({
      matches: LOCAL_GUEST_LIST.filter((household) => householdMatches(name, household)),
    });
  }

  return new Promise((resolve, reject) => {
    const callbackName = "guestLookup_" + Math.random().toString(36).slice(2);
    const url = new URL(APPS_SCRIPT_URL);
    url.searchParams.set("action", "lookup");
    url.searchParams.set("name", name);
    url.searchParams.set("callback", callbackName);

    const script = document.createElement("script");
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("lookup timed out"));
    }, 15000);

    function cleanup() {
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (data) => {
      cleanup();
      resolve(data);
    };

    script.src = url.toString();
    script.onerror = () => {
      cleanup();
      reject(new Error("lookup failed"));
    };
    document.head.appendChild(script);
  });
}

async function lookupGuest() {
  const name = lookupNameEl.value.trim();
  showError("");
  resetMatchState();

  if (name.length < 3) {
    setLookupStatus("Enter at least 3 letters of a name.");
    return;
  }

  lookupButton.disabled = true;
  lookupButton.textContent = "Finding…";
  setLookupStatus("Looking up your invitation…");

  try {
    const result = await queryGuestList(name);
    const matches = result.matches || [];

    if (!matches.length) {
      setLookupStatus("We could not find that name. Try another name from your household.");
      return;
    }

    if (matches.length === 1) {
      setLookupStatus("We found your invitation.");
      renderPartyPanel(matches[0]);
      return;
    }

    setLookupStatus("");
    renderMatchChoices(matches);
  } catch (error) {
    setLookupStatus("");
    showError("We could not look up that name right now. Please try again.");
  } finally {
    lookupButton.disabled = false;
    lookupButton.textContent = "Find";
  }
}

function getAttendingMembers() {
  if (!selectedMatch) {
    return [];
  }

  if (selectedMatch.type === "family") {
    if (form.elements.namedItem("none-attending")?.checked) {
      return [];
    }

    return Array.from(form.querySelectorAll('input[name="attending-member"]:checked')).map(
      (input) => input.value
    );
  }

  return selectedMatch.members.slice();
}

function validateForm() {
  if (!selectedMatch) {
    return "Please find your name on the guest list first.";
  }

  if (selectedMatch.type === "family") {
    const noneAttending = Boolean(form.elements.namedItem("none-attending")?.checked);
    if (!noneAttending && getAttendingMembers().length === 0) {
      return "Please choose who will attend, or select none of us will attend.";
    }
  }

  if ((selectedMatch.plusOne || selectedMatch.type === "plus_one") && getTrimmedValue("plus-one") === "yes") {
    if (!getTrimmedValue("plusOneName")) {
      return "Please enter your guest’s name.";
    }
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

  const attending = getAttendingMembers();
  const bringingPlusOne =
    (selectedMatch.plusOne || selectedMatch.type === "plus_one") &&
    getTrimmedValue("plus-one") === "yes";

  const payload = {
    names: lookupNameEl.value.trim(),
    household: selectedMatch.household,
    householdId: selectedMatch.id,
    type: selectedMatch.type,
    attending: attending.join("; "),
    plusOne: bringingPlusOne ? "yes" : "no",
    plusOneName: bringingPlusOne ? getTrimmedValue("plusOneName") : "",
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

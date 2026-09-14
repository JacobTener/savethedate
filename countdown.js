const TARGET_DATE = new Date("2027-08-14T16:00:00-05:00");

const countdownEl = document.getElementById("countdown");
const arrivedEl = document.getElementById("countdown-arrived");
const valueEls = {
  days: document.querySelector('[data-unit="days"]'),
  hours: document.querySelector('[data-unit="hours"]'),
  minutes: document.querySelector('[data-unit="minutes"]'),
  seconds: document.querySelector('[data-unit="seconds"]'),
};

function pad(value) {
  return String(value).padStart(2, "0");
}

function getRemaining(now) {
  const diff = TARGET_DATE.getTime() - now.getTime();

  if (diff <= 0) {
    return null;
  }

  const totalSeconds = Math.floor(diff / 1000);

  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

function renderCountdown() {
  const remaining = getRemaining(new Date());

  if (!remaining) {
    countdownEl.hidden = true;
    arrivedEl.hidden = false;
    return;
  }

  valueEls.days.textContent = String(remaining.days);
  valueEls.hours.textContent = pad(remaining.hours);
  valueEls.minutes.textContent = pad(remaining.minutes);
  valueEls.seconds.textContent = pad(remaining.seconds);
}

renderCountdown();
setInterval(renderCountdown, 1000);

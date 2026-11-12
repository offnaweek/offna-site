// Renders window.DROP (from drop.js) into the page.
const d = window.DROP || {};
const $ = (id) => document.getElementById(id);

// Drawn arrow: the ↗ character turns into an emoji on iPhone
const ARROW = '<svg class="arrow" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 9.5 9.5 2.5M3.5 2.5h6v6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"/></svg>';

const start = d.start ? new Date(d.start) : null;
const tz = { timeZone: "Asia/Jerusalem" };
const pad = (n) => String(n).padStart(2, "0");

// 12.11.2026 / 13:00, written like the card
const dateText = start
  ? new Intl.DateTimeFormat("en-GB", { ...tz, day: "2-digit", month: "2-digit", year: "numeric" })
      .format(start).replace(/\//g, ".")
  : "";
const timeText = start
  ? new Intl.DateTimeFormat("en-GB", { ...tz, hour: "2-digit", minute: "2-digit" }).format(start)
  : "";

const fill = (id, text) => {
  const el = $(id);
  if (!el) return;
  if (text) el.textContent = text;
  else el.hidden = true;
};

// Screen 1
fill("d-kicker", d.kicker);
fill("d-date", dateText);
fill("d-time", timeText);
$("d-num").textContent = d.number || "";
document.querySelectorAll("[data-num]").forEach((el) => (el.textContent = d.number || ""));
if (d.image) {
  $("d-image").src = d.image;
  $("d-image").alt = d.imageAlt || "";
} else {
  $("d-image").hidden = true;
}

// Screen 2
fill("d-title", d.title);
fill("d-text", d.text);
document.title = `${d.title ? d.title + " — " : ""}OFF/NA Members Club`;

const fact = (id, text, href) => {
  const row = $(id);
  if (!text) return (row.hidden = true);
  const dd = row.querySelector("dd");
  if (href) {
    const a = document.createElement("a");
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener";
    // last word + arrow wrapped together so the arrow never sits alone on a line
    const words = text.split(" ");
    const tail = document.createElement("span");
    tail.style.whiteSpace = "nowrap";
    tail.textContent = words.pop() + "\u00a0";
    tail.insertAdjacentHTML("beforeend", ARROW);
    a.append(words.length ? words.join(" ") + " " : "", tail);
    dd.append(a);
  } else dd.textContent = text;
};
fact("f-date", dateText);
fact("f-time", timeText);
fact("f-place", d.place, d.map);

// Countdown / ended state
const countdown = () => {
  const el = $("d-countdown");
  if (!start) return (el.hidden = true);
  const end = new Date(start.getTime() + (d.hours || 2) * 3600e3);
  const now = Date.now();
  if (now > end) {
    el.textContent = "Ended";
    document.body.classList.add("ended");
  } else if (now >= start) {
    el.textContent = "● Live now";
  } else {
    const s = Math.floor((start - now) / 1000);
    const days = Math.floor(s / 86400);
    const h = pad(Math.floor((s % 86400) / 3600));
    const m = pad(Math.floor((s % 3600) / 60));
    el.textContent = days > 0 ? `T–${days}D ${h}:${m}` : `T–${h}:${m}:${pad(s % 60)}`;
  }
};
countdown();
setInterval(countdown, 1000);

// Calendar: Google Calendar on Android, an .ics file everywhere else (iPhone opens it in Calendar)
const utc = (date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const addToCalendar = () => {
  const end = new Date(start.getTime() + (d.hours || 2) * 3600e3);
  const title = d.title || "OFF/NA Members Club";
  if (/Android/i.test(navigator.userAgent)) {
    const q = new URLSearchParams({
      action: "TEMPLATE", text: title, dates: `${utc(start)}/${utc(end)}`,
      location: d.place || "", details: d.text || "",
    });
    window.open(`https://calendar.google.com/calendar/render?${q}`, "_blank");
    return;
  }
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//OFFNA//Club//EN", "BEGIN:VEVENT",
    `UID:offna-drop-${d.number || "x"}@offna`, `DTSTAMP:${utc(new Date())}`,
    `DTSTART:${utc(start)}`, `DTEND:${utc(end)}`,
    `SUMMARY:${title}`, `LOCATION:${(d.place || "").replace(/,/g, "\\,")}`,
    `DESCRIPTION:${(d.text || "").replace(/,/g, "\\,")}`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  a.download = `offna-drop-${d.number || "event"}.ics`;
  a.click();
};

// Buttons
const nav = $("d-links");
(d.links || []).forEach((l) => {
  if (l.type === "calendar" && !start) return;
  const el = document.createElement(l.type === "calendar" ? "button" : "a");
  el.className = "btn";
  el.innerHTML = `<span></span><span>${l.type === "calendar" ? "+" : ARROW}</span>`;
  el.firstChild.textContent = l.label;
  if (l.type === "calendar") el.addEventListener("click", addToCalendar);
  else Object.assign(el, { href: l.href, target: "_blank", rel: "noopener" });
  nav.append(el);
});
if (!nav.children.length) nav.hidden = true;

// Logo, inlined so it takes the surrounding colour
fetch("../assets/logo.svg")
  .then((r) => r.text())
  .then((svg) => document.querySelectorAll("[data-logo]").forEach((el) => (el.innerHTML = svg)))
  .catch(() => {
    document.querySelectorAll("[data-logo]").forEach((el) => (el.textContent = "OFF/NA"));
  });

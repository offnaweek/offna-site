// Logo, inlined so it takes the surrounding colour (falls back to the word OFF/NA)
fetch("assets/logo.svg")
  .then((r) => r.text())
  .then((svg) => document.querySelectorAll("[data-logo]").forEach((el) => (el.innerHTML = svg)))
  .catch(() => {});

// Tel Aviv clock
const clock = document.getElementById("clock");
const tick = () => {
  const t = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit",
  }).format(new Date());
  if (clock) clock.textContent = `TLV ${t}`;
};
tick();
setInterval(tick, 10000);

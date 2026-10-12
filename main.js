// Inline the logo SVG so it takes the current text color (works when served, e.g. on Vercel)
fetch("assets/logo.svg")
  .then((r) => r.text())
  .then((svg) => {
    const el = document.getElementById("logo-fallback");
    if (el) el.outerHTML = svg;
  })
  .catch(() => {}); // opened as a local file: the <img> stays

// Tel Aviv clock
const clock = document.getElementById("clock");
const tick = () => {
  const t = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit",
  }).format(new Date());
  clock.textContent = `TLV ${t}`;
};
tick();
setInterval(tick, 10000);

// Click the logo to invert paper/ink
document.querySelector(".logo").addEventListener("click", () => {
  document.body.classList.toggle("inverted");
});

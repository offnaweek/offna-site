// The fanzine reader on the home page.
// Pages and the position of every credit/figure come from fanzine/pages.json
// (made by the InDesign export script). Brand links come from fanzine/brands.js.
(function () {
  const root = document.getElementById("fanzine");
  if (!root) return;
  const base = root.dataset.src || "fanzine/";
  const cover = root.dataset.cover || "";            // optional: a single cover page shown first

  const ARROW = '<svg class="arrow" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 9.5 9.5 2.5M3.5 2.5h6v6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"/></svg>';
  const BRANDS = window.BRANDS || {};
  const ALIAS = window.BRAND_ALIASES || {};

  // "Dress & Skirt — KATZ" → { item: "Dress & Skirt", brand: "KATZ", url }
  const names = Object.keys(BRANDS).concat(Object.keys(ALIAS)).sort((a, b) => b.length - a.length);
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  function parse(text) {
    const m = text.match(/^(.*?)\s*[—–-]\s+(.*)$/);
    const item = m ? m[1] : "", who = m ? m[2] : text;
    for (const n of names) {
      if (new RegExp("(^|[^A-Z])" + esc(n) + "(?![A-Z])", "i").test(who)) {
        const brand = ALIAS[n.toUpperCase()] || n.toUpperCase();
        return { item, who, brand, url: BRANDS[brand] || "" };
      }
    }
    return { item, who, brand: "", url: "" };
  }

  const stage = root.querySelector(".fz-stage");
  const prev = root.querySelector(".fz-prev");
  const next = root.querySelector(".fz-next");
  const count = document.getElementById("fz-count");
  const pop = root.querySelector(".fz-pop");
  const narrow = window.matchMedia("(max-width: 760px)");

  let pages = [], views = [], at = 0, aspect = 148 / 210;

  fetch(base + "pages.json", { cache: "no-cache" })
    .then((r) => r.json())
    .then((data) => {
      if (data.pageSize) aspect = data.pageSize[0] / data.pageSize[1];
      pages = data.pages.map((p) => ({ ...p, file: base + p.file }));
      if (cover) pages.unshift({ file: cover, look: "", figure: null, credits: [], cover: true });
      root.style.setProperty("--page-ratio", aspect);
      layout();
      const h = parseInt((location.hash.match(/^#p(\d+)$/) || [])[1], 10);
      if (h) at = Math.max(0, views.findIndex((v) => v.includes(h - 1)));
      show();
    })
    .catch(() => { stage.textContent = "The fanzine couldn't load."; });

  // Desktop: cover alone, then the spreads exactly as in InDesign. Phone: one page at a time.
  function layout() {
    const keep = views.length ? views[at][0] : 0;
    views = [];
    if (narrow.matches) pages.forEach((_, i) => views.push([i]));
    else {
      let i = 0;
      if (pages[0] && pages[0].cover) views.push([i++]);
      for (; i < pages.length; i += 2) views.push(pages[i + 1] ? [i, i + 1] : [i]);
    }
    at = Math.max(0, views.findIndex((v) => v.includes(keep)));
    root.classList.toggle("is-single", narrow.matches);
  }

  function pageEl(i) {
    const p = pages[i];
    const fig = document.createElement("figure");
    fig.className = "fz-page";
    const img = document.createElement("img");
    img.src = p.file;
    img.alt = p.cover ? "OFF/NA fanzine, cover" : p.look ? `Look ${p.look}` : "OFF/NA fanzine, opening page";
    img.decoding = "async";
    img.draggable = false;
    fig.appendChild(img);

    const pct = (b) => `left:${b[0] * 100}%;top:${b[1] * 100}%;width:${(b[2] - b[0]) * 100}%;height:${(b[3] - b[1]) * 100}%`;
    const shop = p.credits.map((c) => ({ ...c, ...parse(c.text) }));

    // each credit line: an invisible link right over the printed line
    shop.forEach((c) => {
      if (!c.url) return;
      const a = document.createElement("a");
      a.className = "fz-hot fz-credit";
      a.href = c.url;
      a.target = "_blank";
      a.rel = "noopener";
      a.style.cssText = pct(c.box);
      a.setAttribute("aria-label", `${c.item ? c.item + " by " : ""}${c.who}, opens the designer's site`);
      fig.appendChild(a);
    });

    // the figure: opens the list of pieces in this look
    if (p.figure && shop.some((c) => c.url)) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "fz-hot fz-figure";
      b.style.cssText = pct(p.figure);
      b.setAttribute("aria-label", `Shop look ${p.look}`);
      b.addEventListener("click", (e) => { e.stopPropagation(); openPop(p, shop, b); });
      fig.appendChild(b);
    }
    return fig;
  }

  function openPop(p, shop, anchor) {
    pop.innerHTML = "";
    const head = document.createElement("p");
    head.className = "fz-pop__head";
    head.innerHTML = `<span>Look ${p.look}</span>`;
    const x = document.createElement("button");
    x.type = "button";
    x.className = "fz-pop__close";
    x.setAttribute("aria-label", "Close");
    x.textContent = "Close";
    x.addEventListener("click", closePop);
    head.appendChild(x);
    pop.appendChild(head);
    const ul = document.createElement("ul");
    shop.forEach((c) => {
      const li = document.createElement("li");
      if (c.url) {
        li.innerHTML = `<a href="${c.url}" target="_blank" rel="noopener"><span class="fz-pop__item"></span><span class="fz-pop__brand"></span>${ARROW}</a>`;
      } else {
        li.innerHTML = `<span class="fz-pop__row"><span class="fz-pop__item"></span><span class="fz-pop__brand"></span></span>`;
      }
      li.querySelector(".fz-pop__item").textContent = c.item;
      li.querySelector(".fz-pop__brand").textContent = c.who;
      ul.appendChild(li);
    });
    pop.appendChild(ul);
    // place it beside the figure, inside the reader
    const s = root.getBoundingClientRect(), r = anchor.getBoundingClientRect();
    pop.hidden = false;
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    let left = r.right - s.left + 12;
    if (left + pw > s.width) left = r.left - s.left - pw - 12;
    left = Math.max(8, Math.min(left, s.width - pw - 8));
    const top = Math.max(8, Math.min(r.top - s.top + r.height * 0.25, s.height - ph - 8));
    pop.style.left = left + "px";
    pop.style.top = top + "px";
    pop.querySelector("a, button").focus({ preventScroll: true });
  }
  function closePop() { pop.hidden = true; }
  document.addEventListener("click", (e) => { if (!pop.hidden && !pop.contains(e.target)) closePop(); });

  function show() {
    closePop();
    const v = views[at];
    stage.replaceChildren(...v.map(pageEl));
    stage.classList.toggle("is-spread", v.length === 2);
    stage.classList.toggle("is-cover", !!pages[v[0]].cover);
    prev.disabled = at === 0;
    next.disabled = at === views.length - 1;
    if (count) count.textContent = `${String(at + 1).padStart(2, "0")} / ${String(views.length).padStart(2, "0")}`;
    history.replaceState(null, "", at ? `#p${v[0] + 1}` : location.pathname + location.search);
    // preload the next and previous views
    [views[at + 1], views[at - 1]].forEach((w) => w && w.forEach((i) => { new Image().src = pages[i].file; }));
  }
  const go = (d) => { const n = Math.max(0, Math.min(views.length - 1, at + d)); if (n !== at) { at = n; show(); } };

  prev.addEventListener("click", () => go(-1));
  next.addEventListener("click", () => go(1));
  document.addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea")) return;
    if (e.key === "ArrowRight") go(1);
    else if (e.key === "ArrowLeft") go(-1);
    else if (e.key === "Escape") closePop();
  });
  // swipe on touch screens
  let sx = null, sy = 0;
  stage.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  stage.addEventListener("touchend", (e) => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
    sx = null;
  });
  narrow.addEventListener("change", () => { if (pages.length) { layout(); show(); } });
})();

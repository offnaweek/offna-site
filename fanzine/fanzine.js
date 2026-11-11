// The fanzine reader on the home page — a tumble deck.
// The spreads stand on edge one behind the other. Scroll (or drag) and the front
// spread tips forward on its bottom edge, lands flat with a small bounce, and the
// deck slides up to the line. The page scroll drives it, so the reader never traps
// the scroll: past the last spread the page simply carries on.
//
// Pages and the position of every credit/figure come from fanzine/pages.json
// (made by the InDesign export script). Brand links come from fanzine/brands.js.
(function () {
  const root = document.getElementById("fanzine");
  const section = document.getElementById("fanzine-section");
  if (!root || !section) return;
  const base = root.dataset.src || "fanzine/";
  const cover = root.dataset.cover || "";            // optional: a single cover page shown first

  const ARROW = '<svg class="arrow" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 9.5 9.5 2.5M3.5 2.5h6v6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"/></svg>';
  const BRANDS = window.BRANDS || {};
  const ALIAS = window.BRAND_ALIASES || {};
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const narrow = window.matchMedia("(max-width: 760px)");

  // ── credits → brand links ───────────────────────────────
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

  // ── the motion (same curves as the tumble deck) ─────────
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  // hinge angle of a card t of the way through its fall: gravity in, one kick off the floor
  function fallAngle(t) {
    const u = clamp01(t), land = 0.78;
    if (u <= land) { const k = u / land; return -90 * k * k * k; }
    const k = (u - land) / (1 - land);
    return -90 + 6 * Math.sin(Math.PI * k) * (1 - k);
  }
  // how far the deck has slid forward, in card gaps
  function deckAdvance(pos) {
    const i = Math.floor(pos), f = pos - i, k = clamp01((f - 0.28) / 0.6);
    return i + k * k * (3 - 2 * k);
  }
  function cardPose(k, pos, depth) {
    const t = pos - k;
    const lift = (k - Math.floor(pos) + 3) * 0.6;
    if (t >= 1) return { angle: -90, z: 0, lift, opacity: t < 3 ? 1 : 0, flat: true };
    if (t > 0) return { angle: fallAngle(t), z: 0, lift, opacity: 1, flat: false };
    const rel = k - deckAdvance(pos);
    return { angle: 0, z: -Math.max(rel, 0), lift: 0, opacity: clamp01(depth + 1 - rel), flat: false };
  }

  const stage = root.querySelector(".fz-stage");
  const prev = root.querySelector(".fz-prev");
  const next = root.querySelector(".fz-next");
  const count = document.getElementById("fz-count");
  const strip = document.getElementById("fz-strip");
  const pop = root.querySelector(".fz-pop");
  const start = root.querySelector(".fz-start");

  const DEPTH = 4;
  let pages = [], views = [], ratio = 148 / 210;
  let cards = [], slotK = [];
  const s = { pos: 0, target: 0 };
  const geo = { h: 300, gap: 70, per: 600 };

  fetch(base + "pages.json", { cache: "no-cache" })
    .then((r) => r.json())
    .then((data) => {
      if (data.pageSize) ratio = data.pageSize[0] / data.pageSize[1];
      pages = data.pages.map((p) => ({ ...p, file: base + p.file }));
      if (cover) pages.unshift({ file: cover, look: "", figure: null, credits: [], cover: true });
      root.style.setProperty("--page-ratio", ratio);
      build();
      const h = parseInt((location.hash.match(/^#p(\d+)$/) || [])[1], 10);
      if (h) { const k = views.findIndex((v) => v.includes(h - 1)); if (k > 0) requestAnimationFrame(() => go(k, false)); }
    })
    .catch(() => { stage.textContent = "The fanzine couldn't load."; });

  // Desktop: the spreads as in InDesign. Phone: one page at a time.
  function layout() {
    views = [];
    if (narrow.matches) pages.forEach((_, i) => views.push([i]));
    else {
      let i = 0;
      if (pages[0] && pages[0].cover) views.push([i++]);
      for (; i < pages.length; i += 2) views.push(pages[i + 1] ? [i, i + 1] : [i]);
    }
    root.classList.toggle("is-single", narrow.matches);
  }

  // ── one page: the image plus invisible links on top ────
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
    shop.forEach((c) => {
      if (!c.url) return;
      const a = document.createElement("a");
      a.className = "fz-hot fz-credit";
      a.href = c.url;
      a.target = "_blank";
      a.rel = "noopener";
      a.draggable = false;
      a.style.cssText = pct(c.box);
      a.setAttribute("aria-label", `${c.item ? c.item + " by " : ""}${c.who}, opens the designer's site`);
      fig.appendChild(a);
    });
    if (p.figure && shop.some((c) => c.url)) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "fz-hot fz-figure";
      b.style.cssText = pct(p.figure);
      b.setAttribute("aria-label", `Shop look ${p.look}`);
      b.addEventListener("click", (e) => { e.stopPropagation(); if (!dragged) openPop(p, shop, b); });
      fig.appendChild(b);
    }
    return fig;
  }

  // ── the deck ────────────────────────────────────────────
  function build() {
    layout();
    const pool = Math.min(views.length, DEPTH + 5);
    cards = [];
    slotK = [];
    const scene = document.createElement("div");
    scene.className = "fz-scene";
    for (let j = 0; j < pool; j++) {
      const c = document.createElement("div");
      c.className = "fz-card";
      scene.appendChild(c);
      cards.push(c);
    }
    stage.replaceChildren(scene);
    buildStrip();
    fit();
    s.pos = s.target = progress();
    paint(true);
  }

  // fit the deck into the stage; the section is as tall as the scroll the deck needs
  function fit() {
    const W0 = stage.clientWidth, H0 = stage.clientHeight;
    const aspect = ratio * (narrow.matches ? 1 : 2);
    // big enough to read the credits; the deck rises above it and the fallen spread spills below
    const h = Math.max(120, Math.min((W0 * (narrow.matches ? 0.84 : 0.8)) / aspect, H0 * 0.66));
    const w = h * aspect;
    const top = Math.max(0.2 * h + 8, (H0 - h) * 0.42);
    geo.h = h;
    geo.gap = 0.2 * h;
    geo.per = Math.max(280, window.innerHeight * 0.6);       // scroll for one spread
    const scene = stage.firstChild;
    if (scene) {
      scene.style.perspective = `${6 * h}px`;
      scene.style.perspectiveOrigin = `50% ${top - 1.66 * h}px`;
    }
    root.style.setProperty("--fz-w", `${w}px`);
    root.style.setProperty("--fz-pw", `${h * ratio}px`);     // one page wide (the cover)
    root.style.setProperty("--fz-h", `${h}px`);
    root.style.setProperty("--fz-top", `${top}px`);
    section.style.height = `calc(${Math.max(0, views.length - 1) * geo.per}px + 100svh)`;
  }

  function paint(force) {
    const pos = s.pos, n = views.length, pool = cards.length;
    const baseK = Math.floor(pos) - 2;
    const front = Math.round(pos);
    cards.forEach((el, j) => {
      const k = baseK + (((j - baseK) % pool) + pool) % pool;
      if (k < 0 || k >= n) { el.style.visibility = "hidden"; slotK[j] = k; return; }
      if (slotK[j] !== k || force) {
        slotK[j] = k;
        el.replaceChildren(...views[k].map(pageEl));
        el.style.setProperty("--n", views[k].length);
        el.classList.toggle("is-cover", !!pages[views[k][0]].cover);
        const sh = document.createElement("div"); sh.className = "fz-card__shade"; el.appendChild(sh);
      }
      const p = cardPose(k, pos, DEPTH);
      el.style.transform = `translate3d(0, ${-p.lift}px, ${p.z * geo.gap}px) rotateX(${p.angle}deg)`;
      el.style.opacity = p.opacity;
      el.style.visibility = p.opacity > 0 ? "visible" : "hidden";
      el.style.setProperty("--shade", p.flat ? 0.15 : (-p.angle / 90) * 0.3);
      el.style.zIndex = String(1000 - Math.round((k - pos) * 10));
      // only the standing front spread takes clicks, and only when it's still
      const live = k === front && Math.abs(pos - front) < 0.04;
      el.classList.toggle("is-front", live);
      el.inert = !live;
    });
    const at = Math.max(0, Math.min(n - 1, front));
    if (start) start.classList.toggle("is-gone", pos > 0.15);
    prev.disabled = s.target <= 0.01;
    next.disabled = s.target >= n - 1.01;
    if (count) count.textContent = `${String(at + 1).padStart(2, "0")} / ${String(n).padStart(2, "0")}`;
    if (strip) [...strip.children].forEach((b, k) => b.setAttribute("aria-current", k === at ? "true" : "false"));
  }

  // ── scroll drives the deck; it eases after the scroll and settles on a whole spread ──
  const sectionTop = () => section.getBoundingClientRect().top + window.scrollY - headH();
  const headH = () => { const h = document.querySelector(".site-head"); return h ? h.offsetHeight : 0; };
  const progress = () => Math.max(0, Math.min(views.length - 1, (window.scrollY - sectionTop()) / geo.per));

  let running = false, idle;
  function follow() {
    const d = s.target - s.pos;
    s.pos += d * (reduce ? 1 : 0.16);
    if (Math.abs(d) < 0.002) { s.pos = s.target; running = false; paint(); return; }
    paint();
    requestAnimationFrame(follow);
  }
  function kick() { if (!running) { running = true; requestAnimationFrame(follow); } }

  window.addEventListener("scroll", () => {
    if (!views.length) return;
    closePop();
    s.target = progress();
    kick();
    clearTimeout(idle);
    idle = setTimeout(settle, 160);
  }, { passive: true });

  // nothing is left half-fallen: once the scroll goes quiet, finish to the nearest spread
  let lastDir = 0, lastY = window.scrollY;
  window.addEventListener("scroll", () => { lastDir = Math.sign(window.scrollY - lastY) || lastDir; lastY = window.scrollY; }, { passive: true });
  function settle() {
    const p = progress();
    if (p <= 0 || p >= views.length - 1) return;
    const f = p - Math.floor(p);
    if (f < 0.01 || f > 0.99) return;
    const k = lastDir > 0 ? Math.floor(p + 0.7) : lastDir < 0 ? Math.ceil(p - 0.7) : Math.round(p);
    go(k);
  }
  function go(k, smooth = true) {
    k = Math.max(0, Math.min(views.length - 1, k));
    window.scrollTo({ top: sectionTop() + k * geo.per + 1, behavior: smooth && !reduce ? "smooth" : "auto" });
    if (k > 0) history.replaceState(null, "", `#p${views[k][0] + 1}`);
    else history.replaceState(null, "", location.pathname + location.search);
  }
  const step = (dir) => go(Math.round(s.target) + dir);

  // ── drag the deck (mouse or finger): up/left = on, down/right = back ──
  let drag = null, dragged = false;
  stage.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.pointerType === "touch") return;     // touch scrolls the page natively
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, travel: 0 };
    dragged = false;
  });
  stage.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    drag.travel += Math.abs(dx) + Math.abs(dy);
    if (drag.travel > 6 && !dragged) { dragged = true; try { stage.setPointerCapture(e.pointerId); } catch (_) {} }
    if (dragged) window.scrollBy(0, (-(Math.abs(dx) > Math.abs(dy) ? dx : dy) * geo.per) / (geo.h * 1.1));
  });
  const up = (e) => { if (drag && e.pointerId === drag.id) { drag = null; setTimeout(() => (dragged = false), 0); } };
  stage.addEventListener("pointerup", up);
  stage.addEventListener("pointercancel", up);
  stage.addEventListener("click", (e) => {
    if (dragged) { e.preventDefault(); e.stopPropagation(); return; }
    // a click on the spread (not on a link) tips it over
    if (!e.target.closest(".fz-hot") && e.target.closest(".fz-card")) step(1);
  }, true);

  // ── strip of spreads: jump anywhere ─────────────────────
  function buildStrip() {
    if (!strip) return;
    strip.replaceChildren(...views.map((v, k) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "fz-tick";
      const looks = v.map((i) => pages[i].look).filter(Boolean);
      const label = pages[v[0]].cover ? "Cover" : looks.length ? "Look " + [...new Set(looks)].join(" / ") : "Opening";
      b.setAttribute("aria-label", label);
      b.dataset.label = label;
      const th = document.createElement("span");
      th.className = "fz-tick__thumb";
      th.style.setProperty("--n", v.length);
      v.forEach((i) => { const im = document.createElement("img"); im.alt = ""; im.loading = "lazy"; im.src = pages[i].file; th.appendChild(im); });
      b.appendChild(th);
      b.addEventListener("click", () => go(k));
      return b;
    }));
  }

  // ── the list of pieces when a figure is clicked ─────────
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
      li.innerHTML = c.url
        ? `<a href="${c.url}" target="_blank" rel="noopener"><span class="fz-pop__item"></span><span class="fz-pop__brand"></span>${ARROW}</a>`
        : `<span class="fz-pop__row"><span class="fz-pop__item"></span><span class="fz-pop__brand"></span></span>`;
      li.querySelector(".fz-pop__item").textContent = c.item;
      li.querySelector(".fz-pop__brand").textContent = c.who;
      ul.appendChild(li);
    });
    pop.appendChild(ul);
    const r0 = root.getBoundingClientRect(), r = anchor.getBoundingClientRect();
    pop.hidden = false;
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    let left = r.right - r0.left + 12;
    if (left + pw > r0.width) left = r.left - r0.left - pw - 12;
    left = Math.max(8, Math.min(left, r0.width - pw - 8));
    const top = Math.max(8, Math.min(r.top - r0.top + r.height * 0.25, r0.height - ph - 8));
    pop.style.left = left + "px";
    pop.style.top = top + "px";
    pop.querySelector("a, button").focus({ preventScroll: true });
  }
  function closePop() { if (!pop.hidden) pop.hidden = true; }
  document.addEventListener("click", (e) => { if (!pop.hidden && !pop.contains(e.target)) closePop(); });

  // ── buttons and keys ─────────────────────────────────────
  if (start) start.addEventListener("click", () => step(1));
  prev.addEventListener("click", () => step(-1));
  next.addEventListener("click", () => step(1));
  document.addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea") || !views.length) return;
    const r = section.getBoundingClientRect();
    if (r.top > window.innerHeight * 0.5 || r.bottom < window.innerHeight * 0.5) return;   // only while the fanzine is on screen
    if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
    else if (e.key === "Escape") closePop();
  });

  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { if (views.length) { fit(); s.target = progress(); paint(); } }, 120); });
  narrow.addEventListener("change", () => { if (pages.length) build(); });
})();

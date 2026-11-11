// The fanzine reader on the home page.
// Pages and the position of every credit/figure come from fanzine/pages.json
// (made by the InDesign export script). Brand links come from fanzine/brands.js.
//
// One spread at a time, starting from the cover. The page turn borrows the tumble-deck motion:
// the page lifts slowly, gathers speed like it's falling, lands on the other side with one small
// kick, and the book settles. Turn by dragging a page (mouse or finger), clicking the page edges,
// the arrows, the ← → keys, or jump with the strip of spreads under the book.
(function () {
  const root = document.getElementById("fanzine");
  if (!root) return;
  const base = root.dataset.src || "fanzine/";
  const cover = root.dataset.cover || "";            // optional: a single cover page shown first

  const ARROW = '<svg class="arrow" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 9.5 9.5 2.5M3.5 2.5h6v6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"/></svg>';
  const BRANDS = window.BRANDS || {};
  const ALIAS = window.BRAND_ALIASES || {};
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  // where a turning page is (0 → 1) t of the way through its turn: gravity eases it in,
  // it lands at 78%, kicks back up once and settles
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  function fall(t, from = 0) {
    const u = clamp01(t), land = 0.78;
    if (u <= land) { const k = u / land; return from + (1 - from) * k * k * (1.6 - 0.6 * k); }
    const k = (u - land) / (1 - land);
    return 1 - 0.045 * Math.sin(Math.PI * k) * (1 - k);
  }

  // "Dress & Skirt — KATZ" → { item: "Dress & Skirt", who: "KATZ", brand, url }
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
  const strip = document.getElementById("fz-strip");
  const pop = root.querySelector(".fz-pop");
  const start = root.querySelector(".fz-start");
  const narrow = window.matchMedia("(max-width: 760px)");

  let pages = [], views = [], at = 0, aspect = 148 / 210;
  let busy = false;          // a page is turning
  let book = null;           // the element holding the pages of the current view

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
      buildStrip();
      show();
    })
    .catch(() => { stage.textContent = "The fanzine couldn't load."; });

  // Desktop: the cover alone on the right, like a closed book, then the spreads as in InDesign.
  // Phone: one page at a time. -1 is an empty side.
  function layout() {
    const keep = views.length ? views[at].find((i) => i >= 0) : 0;
    views = [];
    if (narrow.matches) pages.forEach((_, i) => views.push([i]));
    else {
      let i = 0;
      if (pages[0] && pages[0].cover) views.push([-1, i++]);
      for (; i < pages.length; i += 2) views.push([i, pages[i + 1] ? i + 1 : -1]);
    }
    at = Math.max(0, views.findIndex((v) => v.includes(keep)));
    root.classList.toggle("is-single", narrow.matches);
  }

  // ── one page: the image plus invisible links on top ──────────────
  function pageEl(i, live = true) {
    const fig = document.createElement("figure");
    fig.className = "fz-page";
    if (i < 0) { fig.classList.add("fz-page--none"); return fig; }
    const p = pages[i];
    const img = document.createElement("img");
    img.src = p.file;
    img.alt = p.cover ? "OFF/NA fanzine, cover" : p.look ? `Look ${p.look}` : "OFF/NA fanzine, opening page";
    img.decoding = "async";
    img.draggable = false;
    fig.appendChild(img);
    if (!live) return fig;

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

  // ── the book: slots for the pages of one view ────────────────────
  function bookEl(n) {
    const b = document.createElement("div");
    b.className = "fz-book";
    b.style.setProperty("--n", n);
    return b;
  }
  function slot(side, content) {
    const s = document.createElement("div");
    s.className = "fz-slot fz-slot--" + side;
    if (content) s.appendChild(content);
    const sh = document.createElement("div");
    sh.className = "fz-cast";
    s.appendChild(sh);
    return s;
  }
  const sideOf = (v, k) => (v.length === 1 ? "solo" : k === 0 ? "l" : "r");
  const shift = (v) => (v.length === 2 && v[0] === -1 ? -25 : v.length === 2 && v[1] === -1 ? 25 : 0);   // a closed book sits centred

  function show() {
    closePop();
    const v = views[at];
    book = bookEl(v.length);
    book.style.transform = `translateX(${shift(v)}%)`;
    v.forEach((i, k) => book.appendChild(slot(sideOf(v, k), pageEl(i))));
    // page edges: hover to lift the corner, click to turn
    if (at > 0) book.appendChild(edge(-1));
    if (at < views.length - 1) book.appendChild(edge(1));
    stage.replaceChildren(book);
    prev.disabled = at === 0;
    next.disabled = at === views.length - 1;
    if (start) start.classList.toggle("is-gone", at !== 0);
    if (count) count.textContent = `${String(at + 1).padStart(2, "0")} / ${String(views.length).padStart(2, "0")}`;
    if (strip) [...strip.children].forEach((b, k) => b.setAttribute("aria-current", k === at ? "true" : "false"));
    history.replaceState(null, "", at ? `#p${v.find((i) => i >= 0) + 1}` : location.pathname + location.search);
    [views[at + 1], views[at - 1]].forEach((w) => w && w.forEach((i) => { if (i >= 0) new Image().src = pages[i].file; }));
  }

  function edge(dir) {
    const e = document.createElement("button");
    e.type = "button";
    e.className = "fz-edge fz-edge--" + (dir > 0 ? "next" : "prev");
    e.tabIndex = -1;
    e.setAttribute("aria-hidden", "true");
    // lift the corner only for a real mouse (on touch the hover would stick after a tap)
    e.addEventListener("pointerenter", (ev) => { if (ev.pointerType === "mouse" && book) book.classList.add(dir > 0 ? "peek-next" : "peek-prev"); });
    e.addEventListener("pointerleave", () => book && book.classList.remove("peek-next", "peek-prev"));
    e.addEventListener("click", () => { if (!dragged) turn(dir); });
    return e;
  }

  // ── turning a page ────────────────────────────────────────────────
  // Builds the turn: the pages underneath, and a "leaf" with a front and a back that rotates on the spine.
  function setupTurn(dir) {
    const target = at + dir;
    if (busy || target < 0 || target >= views.length) return null;
    const cur = views[at], nxt = views[target];
    closePop();
    if (start) start.classList.add("is-gone");
    const b = bookEl(Math.max(cur.length, nxt.length));
    let leaf, under, swing;
    const faces = (front, back) => {
      const l = document.createElement("div");
      l.className = "fz-leaf";
      const f = document.createElement("div"); f.className = "fz-face fz-face--front"; f.appendChild(front);
      const k = document.createElement("div"); k.className = "fz-face fz-face--back"; k.appendChild(back);
      [f, k].forEach((x) => { const s = document.createElement("div"); s.className = "fz-shade"; x.appendChild(s); });
      l.append(f, k);
      return l;
    };
    const blank = () => { const d = document.createElement("div"); d.className = "fz-page fz-page--blank"; return d; };

    if (cur.length === 2 && nxt.length === 2) {
      // a spread: the outer page swings over the spine
      if (dir > 0) {
        b.append(slot("l", pageEl(cur[0], false)), under = slot("r", pageEl(nxt[1], false)));
        leaf = faces(pageEl(cur[1], false), pageEl(nxt[0], false));
        leaf.classList.add("fz-leaf--r");
        swing = (p) => `rotateY(${-180 * p}deg)`;
      } else {
        b.append(under = slot("l", pageEl(nxt[0], false)), slot("r", pageEl(cur[1], false)));
        leaf = faces(pageEl(cur[0], false), pageEl(nxt[1], false));
        leaf.classList.add("fz-leaf--l");
        swing = (p) => `rotateY(${180 * p}deg)`;
      }
    } else if (cur.length === 1 && nxt.length === 1) {
      // one page at a time (phones): the page turns away on its left edge
      if (dir > 0) {
        b.append(under = slot("solo", pageEl(nxt[0], false)));
        leaf = faces(pageEl(cur[0], false), blank());
        swing = (p) => `rotateY(${-180 * p}deg)`;
      } else {
        b.append(under = slot("solo", pageEl(cur[0], false)));
        leaf = faces(pageEl(nxt[0], false), blank());
        swing = (p) => `rotateY(${-180 * (1 - p)}deg)`;
      }
      leaf.classList.add("fz-leaf--solo");
    } else return null;     // cover ↔ first spread: handled as a jump
    b.appendChild(leaf);
    stage.replaceChildren(b);
    book = b;
    busy = true;
    const cast = under.querySelector(".fz-cast");
    const shades = leaf.querySelectorAll(".fz-shade");
    const forward = dir > 0 || cur.length === 2;
    const x0 = shift(cur), x1 = shift(nxt);
    return {
      target,
      set(a, dip = 0) {
        const p = clamp01(a);
        leaf.style.transform = swing(a);
        // the book glides to centre on the cover, and dips a hair when the page lands
        b.style.transform = `translateX(${x0 + (x1 - x0) * p}%) translateY(${dip}px)`;
        const light = Math.sin(Math.PI * p);
        shades[0].style.opacity = (forward ? p : 1 - p) * 0.55 + light * 0.1;
        shades[1].style.opacity = (forward ? 1 - p : p) * 0.55;
        if (cast) cast.style.opacity = light * 0.5;
      },
      done(ok) {
        busy = false;
        if (ok) at = this.target;
        show();
      },
    };
  }

  // a turn in time: gravity in, land, kick, settle — or, let go too early, it sinks back
  function play(t, from, ok, ms, cb) {
    if (reduced.matches) { t.set(ok ? 1 : 0); return cb(); }
    const t0 = performance.now();
    const step = (now) => {
      const x = Math.min(1, (now - t0) / ms);
      if (ok) t.set(fall(x, from), x > 0.78 ? 3 * Math.sin((Math.PI * (x - 0.78)) / 0.22) : 0);
      else t.set(from * Math.pow(1 - x, 3));
      if (x < 1) requestAnimationFrame(step); else cb();
    };
    requestAnimationFrame(step);
  }

  function turn(dir) {
    if (busy) return;
    const k = at + dir;
    if (k < 0 || k >= views.length) return;
    if (views[k].length !== views[at].length) return jump(k);
    const t = setupTurn(dir);
    if (!t) return;
    t.set(0);
    play(t, 0, true, 950, () => t.done(true));
  }

  // ── drag to turn ──────────────────────────────────────────────────
  let drag = null, dragged = false;
  stage.addEventListener("pointerdown", (e) => {
    if (busy || e.button !== 0) return;
    dragged = false;
    drag = { x: e.clientX, y: e.clientY, id: e.pointerId, t: null, lastX: e.clientX, lastT: performance.now(), v: 0 };
  });
  stage.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.t) {
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy)) return;
      drag.dir = dx < 0 ? 1 : -1;
      drag.t = setupTurn(drag.dir);
      if (!drag.t) { drag = null; return; }
      dragged = true;
      try { stage.setPointerCapture(e.pointerId); } catch (_) {}
      const w = book.getBoundingClientRect().width;
      drag.span = views[at].length === 2 ? w : w * 1.2;
    }
    const now = performance.now();
    drag.v = (e.clientX - drag.lastX) / Math.max(1, now - drag.lastT);
    drag.lastX = e.clientX; drag.lastT = now;
    drag.p = Math.max(0, Math.min(1, (-drag.dir * dx) / drag.span));
    drag.t.set(drag.p);
  });
  const release = (e) => {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    const d = drag; drag = null;
    if (!d.t) return;
    const ok = d.p > 0.3 || -d.dir * d.v > 0.5;
    play(d.t, d.p, ok, ok ? 650 : 320, () => d.t.done(ok));
    setTimeout(() => { dragged = false; }, 0);
  };
  stage.addEventListener("pointerup", release);
  stage.addEventListener("pointercancel", release);
  // a drag that turned the page must not also click a link
  stage.addEventListener("click", (e) => { if (dragged) { e.preventDefault(); e.stopPropagation(); } }, true);

  // ── the strip of spreads (jump anywhere) ─────────────────────────
  function buildStrip() {
    if (!strip) return;
    strip.replaceChildren(...views.map((v, k) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "fz-tick";
      const real = v.filter((i) => i >= 0);
      const looks = real.map((i) => pages[i].look).filter(Boolean);
      const label = pages[real[0]].cover ? "Cover" : looks.length ? "Look " + [...new Set(looks)].join(" / ") : "Opening";
      b.setAttribute("aria-label", label);
      b.dataset.label = label;
      const th = document.createElement("span");
      th.className = "fz-tick__thumb";
      th.style.setProperty("--n", real.length);
      real.forEach((i) => { const im = document.createElement("img"); im.alt = ""; im.loading = "lazy"; im.src = pages[i].file; th.appendChild(im); });
      b.appendChild(th);
      b.addEventListener("click", () => jump(k));
      return b;
    }));
  }
  function jump(k) {
    if (busy || k === at) return;
    if (Math.abs(k - at) === 1 && views[k].length === views[at].length) return turn(k - at);
    at = k;
    stage.classList.add("is-jumping");
    show();
    requestAnimationFrame(() => requestAnimationFrame(() => stage.classList.remove("is-jumping")));
  }

  // ── the list of pieces when a figure is clicked ──────────────────
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

  // ── buttons and keys ──────────────────────────────────────────────
  if (start) start.addEventListener("click", () => turn(1));
  prev.addEventListener("click", () => turn(-1));
  next.addEventListener("click", () => turn(1));
  document.addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea")) return;
    const r = root.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return;   // only while the fanzine is on screen
    if (e.key === "ArrowRight") turn(1);
    else if (e.key === "ArrowLeft") turn(-1);
    else if (e.key === "Escape") closePop();
  });
  narrow.addEventListener("change", () => { if (pages.length && !busy) { layout(); buildStrip(); show(); } });
})();

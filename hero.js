// Liquid hero logo: it pours in on load, then the cursor (or a finger) stirs it like liquid.
// WebGL draws the logo through a displacement field; without WebGL the plain logo shows.
(function () {
  const hero = document.querySelector(".hero");
  const logoEl = document.querySelector(".hero__logo");
  if (!hero || !logoEl) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const canvas = document.createElement("canvas");
  canvas.className = "hero__liquid";
  canvas.setAttribute("aria-hidden", "true");
  const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false });
  if (!gl) return;
  hero.insertBefore(canvas, hero.firstChild);

  const VOLT = getComputedStyle(document.documentElement).getPropertyValue("--volt").trim() || "#deff00";

  // ── shader ────────────────────────────────────────────
  const vs = `attribute vec2 p; varying vec2 uv;
    void main(){ uv = p * 0.5 + 0.5; uv.y = 1.0 - uv.y; gl_Position = vec4(p, 0.0, 1.0); }`;
  const fs = `precision mediump float;
    varying vec2 uv;
    uniform sampler2D logo, flow;
    uniform float t, intro, aspect;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
      return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
    float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int k = 0; k < 4; k++){ v += a*n(p); p *= 2.03; a *= 0.5; } return v; }
    void main(){
      vec2 q = vec2(uv.x * aspect, uv.y);
      vec2 w = vec2(fbm(q*2.2 + vec2(t*0.15, 0.0)), fbm(q*2.2 + vec2(5.2, t*0.12))) - 0.5;
      vec2 f = texture2D(flow, uv).rg - 0.5;
      // intro: big melting warp that settles; always: a slow breathing wobble; cursor: the flow field
      vec2 d = w * (0.006 + intro * 0.75) + f * 0.34;
      d.y += intro * intro * 0.18 * (fbm(vec2(uv.x * 6.0, t)) - 0.2);   // drips down while it pours in
      vec4 c = texture2D(logo, uv - d);
      float a = c.a * smoothstep(1.0, 0.7, intro);
      gl_FragColor = vec4(c.rgb * a, a);
    }`;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); return; }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = (n) => gl.getUniformLocation(prog, n);
  const uT = U("t"), uIntro = U("intro"), uAspect = U("aspect");
  gl.uniform1i(U("logo"), 0);
  gl.uniform1i(U("flow"), 1);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const tex = (unit) => {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  const logoTex = tex(0), flowTex = tex(1);

  // ── the flow field: a small canvas the cursor paints velocity into, which relaxes back ──
  const FW = 96, FH = 54;
  const flow = document.createElement("canvas");
  flow.width = FW; flow.height = FH;
  const fx = flow.getContext("2d");
  fx.fillStyle = "rgb(128,128,0)";
  fx.fillRect(0, 0, FW, FH);

  // ── the logo, drawn where the HTML logo sits ──────────
  const logoCanvas = document.createElement("canvas");
  const lx = logoCanvas.getContext("2d");
  let svgText = null, ready = false;
  fetch("assets/logo.svg").then((r) => r.text()).then((t) => { svgText = t; size(); }).catch(() => canvas.remove());

  function size() {
    const r = hero.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform1f(uAspect, r.width / r.height);
    if (!svgText) return;
    const box = logoEl.getBoundingClientRect();
    const src = svgText.replace(/currentColor/g, VOLT).replace("<svg ", `<svg width="${Math.round(box.width * dpr)}" height="${Math.round(box.height * dpr)}" preserveAspectRatio="xMidYMid meet" `);
    const img = new Image();
    img.onload = () => {
      logoCanvas.width = canvas.width;
      logoCanvas.height = canvas.height;
      lx.clearRect(0, 0, logoCanvas.width, logoCanvas.height);
      lx.drawImage(img, (box.left - r.left) * dpr, (box.top - r.top) * dpr, box.width * dpr, box.height * dpr);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, logoTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, logoCanvas);
      if (!ready) { ready = true; hero.classList.add("is-liquid"); start = performance.now(); requestAnimationFrame(frame); }
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(src);
  }
  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(size, 150); });

  // ── stirring ──────────────────────────────────────────
  let last = null;
  const stir = (e) => {
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    if (last) {
      const vx = Math.max(-1, Math.min(1, (x - last.x) * 18));
      const vy = Math.max(-1, Math.min(1, (y - last.y) * 18));
      const g = fx.createRadialGradient(x * FW, y * FH, 0, x * FW, y * FH, 9);
      const col = `${Math.round(128 + vx * 127)},${Math.round(128 + vy * 127)},0`;
      g.addColorStop(0, `rgba(${col},0.9)`);
      g.addColorStop(1, `rgba(${col},0)`);
      fx.fillStyle = g;
      fx.fillRect(0, 0, FW, FH);
    }
    last = { x, y };
  };
  hero.addEventListener("pointermove", stir);
  hero.addEventListener("pointerleave", () => { last = null; });

  // ── frame loop (pauses when the hero is off screen) ──
  let start = 0, visible = true, running = false;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && ready && !running) requestAnimationFrame(frame); }).observe(hero);

  function frame(now) {
    running = visible;
    if (!visible) return;
    const t = (now - start) / 1000;
    const k = Math.min(1, t / 3.0);
    const intro = Math.pow(1 - k, 2.4);                 // 1 → 0, eased
    // the liquid settles: fade the field back to rest and soften it
    fx.globalCompositeOperation = "source-over";
    fx.fillStyle = "rgba(128,128,0,0.045)";
    fx.fillRect(0, 0, FW, FH);
    fx.filter = "blur(1px)";
    fx.drawImage(flow, 0, 0);
    fx.filter = "none";
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, flowTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, flow);
    gl.uniform1f(uT, t);
    gl.uniform1f(uIntro, intro);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(frame);
  }
})();

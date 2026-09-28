/*
 * Wadduwage Lab hero: a pixel-art optical bench.
 * Coherent light leaves a point source, passes a stack of learned diffractive
 * layers, and is focused onto a pixel detector. Rendered on a low-resolution
 * canvas with ordered (Bayer) dithering, then scaled up with crisp pixels.
 * Colours come from CSS variables so the art follows the site theme:
 *   --hero-bg, --hero-c1 (faint), --hero-c2 (light / accent), --hero-c3 (peak / ink)
 */
(function () {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const band = canvas.parentElement;

  const PX = 4;                       // CSS pixels per art pixel
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0, H = 0, img = null, pal = null, masks = [], pointerY = null, srcY = 0.5;

  function hexToRgb(h) {
    h = h.trim().replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function readPalette() {
    const cs = getComputedStyle(document.documentElement);
    const get = (v, d) => hexToRgb((cs.getPropertyValue(v) || d).trim() || d);
    pal = [get('--hero-bg', '#fbf9f6'), get('--hero-c1', '#efe6dc'), get('--hero-c2', '#d97757'), get('--hero-c3', '#252525')];
  }

  // Learned phase masks: one column of phase blocks per layer, 3 art-px tall each.
  function makeMasks() {
    masks = [0, 1, 2].map(() => Array.from({ length: Math.ceil(H / 3) + 1 }, () => Math.random() * Math.PI * 2));
  }

  function resize() {
    W = Math.max(80, Math.floor(band.clientWidth / PX));
    H = Math.max(40, Math.floor(band.clientHeight / PX));
    canvas.width = W; canvas.height = H;
    img = ctx.createImageData(W, H);
    readPalette(); makeMasks();
  }

  function frame(t) {
    const time = t * 0.001;
    // the source drifts gently, or follows the pointer
    const targetY = pointerY !== null ? pointerY : 0.5 + 0.18 * Math.sin(time * 0.35);
    srcY += (targetY - srcY) * 0.04;

    const sx = W * 0.03, sy = H * srcY;
    const L = [0.36, 0.44, 0.52].map(f => Math.round(W * f));
    const fx = W * 0.80, fy = H * 0.5;
    const detX = Math.round(W * 0.93);
    const k = (2 * Math.PI) / 7, w = time * 5.0;
    const d = img.data;

    // "training": occasionally nudge a mask block
    if (!reduce && Math.random() < 0.25) {
      const m = masks[(Math.random() * 3) | 0];
      m[(Math.random() * m.length) | 0] += (Math.random() - 0.5) * 1.6;
    }

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let I;
        if (x < L[0]) {                                   // diverging wave from the source
          const dx = x - sx, dy = y - sy, r = Math.hypot(dx, dy);
          const spread = 1.5 + 0.55 * Math.max(dx, 0);
          const env = dx < 0 ? 0 : Math.exp(-Math.pow(dy / spread, 2));
          I = env * (0.30 + 0.70 * (0.5 + 0.5 * Math.cos(k * r - w)));
        } else if (x < L[2] + 2) {                        // scrambled by the learned layers
          let ph = 0;
          for (let j = 0; j < 3; j++) if (x >= L[j]) ph += masks[j][(y / 3) | 0];
          const env = Math.exp(-Math.pow((y - H / 2) / (0.46 * H), 6));
          I = env * (0.18 + 0.62 * (0.5 + 0.5 * Math.cos(k * x - w + ph)));
        } else {                                          // converging to a focus, then diverging
          const dx = x - fx, dy = y - fy, r = Math.hypot(dx, dy);
          const spread = 1.2 + 0.62 * Math.abs(dx);
          const env = Math.exp(-Math.pow(dy / spread, 2));
          const phase = dx < 0 ? -k * r - w : k * r - w;
          const spot = Math.exp(-(dx * dx + dy * dy) / 6);
          I = Math.min(1, env * (0.30 + 0.70 * (0.5 + 0.5 * Math.cos(phase))) + 0.9 * spot);
        }

        // background: faint pixel grid
        const grid = (x % 8 === 0 && y % 8 === 0) ? 0.22 : 0.0;
        I = Math.max(I, grid);

        // hardware: layers and detector drawn as solid pixels
        let forced = -1;
        for (let j = 0; j < 3; j++) {
          if (x === L[j] || x === L[j] + 1) {
            const v = 0.5 + 0.5 * Math.cos(masks[j][(y / 3) | 0]);
            forced = v > 0.66 ? 3 : v > 0.33 ? 2 : 1;
          }
        }
        if (x >= detX && x <= detX + 2) {
          const cell = ((y / 3) | 0) % 2 === 0 ? 1 : 0;
          const lit = Math.exp(-Math.pow((y - fy) / (0.10 * H), 2));
          forced = lit > 0.5 ? 3 : lit > 0.15 ? 2 : 1 + cell * 0;
        }
        if (x < 3 && Math.abs(y - sy) < 3) forced = 3;    // the source

        let idx;
        if (forced >= 0) idx = forced;
        else {
          const th = BAYER[(y & 3) * 4 + (x & 3)];
          const q = I * 3;                                  // 0..3
          idx = Math.min(3, Math.floor(q) + (q - Math.floor(q) > th ? 1 : 0));
        }
        const c = pal[idx], o = (y * W + x) * 4;
        d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    if (!reduce) requestAnimationFrame(frame);
  }

  band.addEventListener('pointermove', e => {
    const r = band.getBoundingClientRect();
    pointerY = Math.min(0.85, Math.max(0.15, (e.clientY - r.top) / r.height));
  });
  band.addEventListener('pointerleave', () => { pointerY = null; });
  window.addEventListener('resize', resize);
  // re-read colours if the theme changes (e.g. dark mode)
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', readPalette);

  resize();
  requestAnimationFrame(frame);
})();

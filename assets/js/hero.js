/* Wadduwage Lab hero: tissue scatters light -> learned optics -> focus -> sharp image.
 * Art in a stage right of the title column; 4x4 Bayer dither into --hero-bg/c1/c2/c3. */
(function () {
  const cv = document.getElementById('hero-canvas');
  if (!cv) return;
  const ctx = cv.getContext('2d'), band = cv.parentElement, M = Math;
  const content = band.parentElement.querySelector('.hero-content'), labels = [...band.querySelectorAll('.hero-label')];
  const PX = 4, TAU = M.PI * 2, rnd = M.random, E = M.exp, hyp = M.hypot, rd = M.round;
  const BY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16), bay = (x, y) => BY[(y & 3) * 4 + (x & 3)];
  const reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const cl = (v, a, b) => v < a ? a : v > b ? b : v, ss = (a, b, v) => (v = cl((v - a) / (b - a), 0, 1), v * v * (3 - 2 * v));
  const NEU = '44 46 30 30 22 14 18 4|30 30 12 24 4 26|22 14 32 6|44 46 20 52 6 62|20 52 10 44|44 46 38 70 26 86 20 96|38 70 50 88|44 46 60 28 64 10|60 28 80 22 92 12|44 46 64 58 78 70 96 78|78 70 86 90'
    .split('|').map(s => s.split(' ').map(Number));
  let W, H, img, pal, I, F, N, L, cells, pts, mk, nim, ord, hal, tot, kb, nS = 0, ph = 0, pt = 0, T = 0, prev = 0, raf = 0, on = true;
  let pX = .5, pXs = .5, pY = null, srcY = 0;

  function readPal() {
    const cs = getComputedStyle(document.documentElement);
    pal = [['--hero-bg', 'eef0ff'], ['--hero-c1', 'cdd3ff'], ['--hero-c2', '2a3cff'], ['--hero-c3', '0b0b0b']].map(([v, d]) => {
      let h = (cs.getPropertyValue(v).trim() || d).replace('#', '');
      if (h.length === 3) h = h.replace(/./g, '$&$&');
      const n = parseInt(h, 16);
      return [n >> 16 & 255, n >> 8 & 255, n & 255];
    });
  }
  function noise() {
    const r = Float32Array.from({ length: 4096 }, rnd), o = new Float32Array(4096);
    for (let i = 0; i < 4096; i++) { let s = 0; for (let j = -1; j < 2; j++) for (let k = -1; k < 2; k++) s += r[((i >> 6) + j & 63) * 64 + ((i & 63) + k & 63)]; o[i] = s / 9; }
    return o;
  }
  const spawn = (p, st) => Object.assign(p, { x: L.x0 + 4 - rnd() * (st ? L.sw : 20), y: srcY, s: 0, a: 0, tr: [] });
  const cell = (d, r) => ({ d, r, x: L.tcx + (rnd() * 2 - 1) * L.trx * .8, y: L.cy + (rnd() * 2 - 1) * L.tr * .8, o: rnd() * TAU });

  function layout() {
    const br = band.getBoundingClientRect();
    W = M.max(60, M.floor(br.width / PX)); H = M.max(40, M.floor(br.height / PX));
    cv.width = W; cv.height = H; img = ctx.createImageData(W, H); I = new Float32Array(W * H); F = new Int8Array(W * H);
    let x0 = 1, x1 = W - 3;
    if (content) {
      const r = content.getBoundingClientRect();
      if (r.top < br.bottom - 40) { let m = 0; for (const c of content.children) m = M.max(m, c.getBoundingClientRect().right); x0 = M.ceil((m - br.left) / PX) + 12; x1 = M.min(x1, M.ceil((r.right - br.left) / PX) + 30); }
    }
    let sw = x1 - x0;
    if (sw < 70) { x0 = 1; sw = W - 4; }
    if (sw > 240) { x0 += (sw - 240) >> 1; sw = 240; }
    const S = M.max(20, M.min(rd(sw * .27), rd(H * .5), 64)) & ~1, cy = (H - 6) >> 1, f = v => rd(x0 + sw * v);
    const tcx = f(.16), trx = rd(sw * .09) + 2, lx = [.31, .36, .41].map(f), dx = x0 + sw - S - 2;
    L = { x0, sw, S, cy, tcx, trx, tr: M.min(rd(S * .7), cy - 4), lx, dx, dy: cy - (S >> 1), pw: S < 32 ? 1 : 2, lh: rd(S * .62),
      xe: tcx - trx, xc: tcx + trx, fx: rd(lx[2] + (dx - lx[2]) * .6) };
    srcY = srcY || cy; N = noise();
    mk = lx.map(() => Array.from({ length: H }, () => rnd() * .5));
    const sc = M.max(.6, S / 44);
    cells = [];
    [[6, 1.6, 2.4], [5, 2.4, 3.2], [4, 3.4, 4.8]].forEach(([n, a, b], d) => { for (let i = 0; i < n; i++) cells.push(cell(d, (a + rnd() * (b - a)) * sc)); });
    nim = new Uint8Array(S * S);
    const put = (x, y, v) => { x = rd(x); y = rd(y); if (x >= 0 && y >= 0 && x < S && y < S && nim[y * S + x] < v) nim[y * S + x] = v; };
    const k = (S - 1) / 100, rs = 9 * k;
    for (const p of NEU) for (let i = 0; i + 3 < p.length; i += 2) {
      const ax = p[i] * k, ay = p[i + 1] * k, bx = p[i + 2] * k, by = p[i + 3] * k, n = M.ceil(hyp(bx - ax, by - ay) * 2) + 1, th = !i && p[0] === 44 && S >= 32;
      for (let s = 0; s <= n; s++) { const x = ax + (bx - ax) * s / n, y = ay + (by - ay) * s / n; put(x, y, 2); if (th) put(x + 1, y, 2); }
    }
    for (let y = -rs; y <= rs; y++) for (let x = -rs; x <= rs; x++) if (x * x + y * y <= rs * rs + rs * .6) put(44 * k + x, 46 * k + y, 3);
    ord = []; hal = [];
    for (let i = 0; i < S * S; i++) {
      const x = i % S, y = i / S | 0;
      if (nim[i] > 1) ord.push([i, hyp(x - 44 * k, y - 46 * k) + rnd() * S * .25]);
      else if ([i - 1, i + 1, i - S, i + S].some(j => nim[j] > 1)) hal.push(i);
    }
    ord = ord.sort((a, b) => a[1] - b[1]).map(a => a[0]); tot = ord.length; kb = M.max(1, M.ceil(tot / 70)); nS = tot * .45 | 0; ph = 0;
    pts = Array.from({ length: M.max(8, rd(sw / 8)) }, () => spawn({}, 1));
    placeLabels(br);
  }

  function placeLabels(br) {
    const sc = br.width / W, ly = (L.cy + M.max(L.lh + 1, (L.S >> 1) + 4, L.tr) + 4) * sc, lo = L.x0 * sc, hi = (L.x0 + L.sw + 2) * sc, GP = 34;
    const cx = [L.tcx, L.lx[1] + 1, L.fx, L.dx + L.S / 2];
    let bx;
    for (const md of [0, 1, 2, 3]) {
      const vis = labels.filter(el => {
        el.dataset.l = el.dataset.l || el.textContent;
        el.textContent = md > 1 && el.dataset.s ? el.dataset.s : el.dataset.l;
        el.classList.toggle('is-off', md & 1 && 'o' in el.dataset);
        return !el.classList.contains('is-off');
      });
      bx = vis.map(el => { const w = el.offsetWidth; return [cx[labels.indexOf(el)] * sc - w / 2, w, el]; });
      bx.forEach((b, k) => { b[0] = M.max(b[0], k ? bx[k - 1][0] + bx[k - 1][1] + GP : lo); });
      for (let k = bx.length - 1; k >= 0; k--) bx[k][0] = M.min(bx[k][0], k < bx.length - 1 ? bx[k + 1][0] - GP - bx[k][1] : hi - bx[k][1]);
      if (bx[0][0] >= lo - 2 || md > 2) break;
    }
    bx.forEach(([x, , el]) => Object.assign(el.style, { left: M.max(4, x) + 'px', top: ly + 'px', right: 'auto', transform: 'none' }));
    L.ar = bx.slice(1).map((b, i) => [M.ceil((bx[i][0] + bx[i][1] + 4) / sc), M.floor((b[0] - 5) / sc), rd((ly + b[2].offsetHeight / 2) / sc)]);
    band.classList.add('is-ready');
  }

  function step(dt) {
    const { x0, xe, xc, lx, fx, cy, tr, dx, dy, S } = L;
    T += dt; pt += dt;
    srcY += ((pY !== null ? cy + (pY - .5) * tr * .7 : cy + tr * .22 * M.sin(T * .006)) - srcY) * .05 * dt;
    pXs += (pX - pXs) * .05 * dt;
    for (const c of cells) { c.y -= (.015 + .02 * c.d) * dt; if (c.y < cy - tr - c.r) Object.assign(c, cell(c.d, c.r), { y: cy + tr + c.r }); }
    if (rnd() < .2 * dt) mk[rnd() * 3 | 0][rnd() * H | 0] = rnd() * .5;
    for (const p of pts) {
      if (p.x >= x0 + 4) { p.tr.unshift(p.x, p.y); p.tr.length = M.min(p.tr.length, 10); }
      if (p.s === 0) { p.x += 1.4 * dt; p.y = srcY; if (p.x >= xe) p.s = 1; }
      else if (p.s === 1) {
        p.a = cl(p.a + (rnd() - .5) * 1.6 * dt, -1.3, 1.3);
        if (M.abs(p.y - srcY) > 1 + tr * .6 * cl((p.x - xe) / (xc - xe), 0, 1)) p.a = -M.sign(p.y - srcY) * .8;
        if (M.abs(p.y - cy) > L.lh - 3) p.a = -M.sign(p.y - cy) * .8;
        p.x += M.cos(p.a) * dt; p.y += M.sin(p.a) * dt;
        if (p.x >= lx[0]) { p.s = 2; aim(p, fx, cy); }
      } else {
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.s === 2 && p.x >= fx) {
          const j = ord[M.min(tot - 1, nS + (rnd() * kb * 5 | 0))];
          p.s = 3; aim(p, dx + j % S, dy + (j / S | 0));
        } else if (p.s === 3 && p.x >= p.tx) {
          if (!ph && (nS = M.min(tot, nS + kb)) === tot) { ph = 1; pt = 0; }
          spawn(p, 0);
        }
      }
    }
    if (ph === 1 && pt > 160) { ph = 2; pt = 0; }
    if (ph === 2 && pt > 50) { ph = 0; nS = 0; }
  }
  function aim(p, x, y) { const n = hyp(x - p.x, y - p.y) || 1; p.vx = (x - p.x) / n * 1.6; p.vy = (y - p.y) / n * 1.6; p.tx = x; }

  function draw() {
    const { x0, sw, S, cy, tcx, trx, tr, lx, dx, dy, pw, lh, xe, xc, fx } = L;
    const tm = T / 60, k = TAU / 6, w = tm * 5, hw0 = lh * .8, sd = tr * .55, xs = x0 + sw + 3, L2 = lx[2] + pw, d = img.data;
    const set = (x, y, v) => { x = rd(x); y = rd(y); if (x >= 0 && y >= 0 && x < W && y < H) F[y * W + x] = v; };
    F.fill(-1);
    for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {
      let b = !(x & 7) && !(y & 7) ? 1 : 0, l = 0;
      if (x >= x0 && x < xs) {
        const n = N[(y & 63) * 64 + (x & 63)], dfx = x - fx, dfy = y - cy, rb2 = dfx * dfx + dfy * dfy;
        b = M.max(b, .5 * E(-rb2 / (S * S * .12)));
        const ex = (x - tcx - (pXs - .5) * 2) / trx, ey = (y - cy) / tr, e = ex * ex + ey * ey + (N[(y >> 1 & 63) * 64 + (x >> 1 & 63)] - .5) * .3;
        if (e < 1) b = e > .86 ? 1 : .1 + .3 * N[(y >> 2 & 63) * 64 + (x >> 2 & 63)] + .3 * ss(-.3, 1, ex * .5 + ey * .8);
        if (x >= x0 + 4 && x < dx - 1) {
          const dy2 = (y - srcY) ** 2, sp = .5 + .5 * M.sin(n * 40 + tm * 3);
          if (x < xe) l = 2 * E(-dy2 / .5);
          else if (x < L2) {
            const p = cl((x - xe) / (xc - xe), 0, 1), q = cl((x - lx[0]) / (L2 - lx[0]), 0, 1), sg = .8 + p * sd;
            l = 2 * E(-3.5 * p) * E(-dy2 / .5) + (1 - q) * 2.1 * (1 - E(-4 * p)) * E(-dy2 / (sg * sg)) * sp * sp * sp * ss(lh, lh - 6, M.abs(dfy));
            if (M.abs(dfy) < hw0) l += q * .35;
          } else {
            const pre = x <= fx, hw = pre ? hw0 * (fx - x) / (fx - L2) + .6 : .6 + S * .45 * (x - fx) / (dx - fx), u = M.abs(dfy) / hw, r = M.sqrt(rb2);
            if (u < 1) { const wv = M.max(0, M.cos(pre ? k * r + w : k * r - w)); l = (pre ? 1 : .7) * (.3 + .25 * (1 - u) + 1.2 * wv ** 6); }
            l += (pre ? 1.1 : .7) * ss(2, 8, M.abs(dfx)) * E(-(u - 1) * (u - 1) * hw * hw * 2);
            l *= .3 + .7 * ss(4, 10, r);
          }
          l += E(-rb2 / 18) * (.85 + .15 * M.sin(tm * 4));
        }
      }
      I[i] = b + l;
    }
    for (const c of cells) {
      const px = c.x + (pXs - .5) * (1 + 3 * c.d), R = c.r;
      for (let y = M.floor(c.y - R - 1); y <= c.y + R + 1; y++) for (let x = M.floor(px - R - 1); x <= px + R + 1; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const ex = (x - tcx) / trx, ey = (y - cy) / tr, m = ss(1, .7, ex * ex + ey * ey);
        if (m <= 0) continue;
        const i = y * W + x, r = hyp(x - px, y - c.y), lit = cl(I[i] - .8, 0, 2);
        if (!c.d) { if (r < R) I[i] += m * .45 * (1 - r / R); }
        else if (c.d < 2) { if (M.abs(r - R) < .7) I[i] = M.max(I[i], m * (1.25 + .4 * lit)); }
        else if (r < R + .7) {
          const rn = hyp(x - px - M.cos(c.o) * R * .3, y - c.y - M.sin(c.o) * R * .3);
          I[i] = I[i] * (1 - m) + m * (r > R - .7 ? 1.7 + .4 * lit : rn < R * .35 ? 1.3 + .5 * lit : I[i] * .5 + .2);
        }
      }
    }
    const sy = rd(srcY);
    for (let x = x0; x < x0 + 4; x++) for (let y = -3; y <= 3; y++) set(x, sy + y, 3);
    set(x0 + 3, sy, 2);
    lx.forEach((X, j) => {
      for (let y = cy - lh; y <= cy + lh; y++) {
        const s = X + rd((cy - y) * .08), cap = M.abs(y - cy) >= lh - 1;
        const v = ((y - cy) ** 2 / (lh * 2) + mk[j][y >> 1] + j * .2) % 1, c = cap ? 3 : v < .55 ? 1 : v < .95 ? 2 : 3;
        for (let a = 0; a < pw; a++) set(s + a, y, c);
        set(s - 1, y, cap ? 3 : 2); set(s + pw, y, cap ? 3 : 2);
      }
    });
    const lock = ph === 1, fd = ph === 2 ? pt / 50 : 0, prog = ph ? 1 - fd : nS / tot;
    for (let y = dy - 2; y <= dy + S + 1; y++) for (let x = dx - 2; x <= dx + S + 1; x++)
      set(x, y, y === dy - 2 || y === dy + S + 1 || x === dx - 2 || x === dx + S + 1 ? lock ? 3 : 2 : (x - dx) % 3 === 1 && (y - dy) % 3 === 1 ? 1 : 0);
    const bn = lock && pt < 40 && M.sin(pt * .5) > 0 ? 2 : 0, bl = M.max(4, S >> 3);
    for (const [a, b, u, v] of [[dx - 4, dy - 4, 1, 1], [dx + S + 3, dy - 4, -1, 1], [dx - 4, dy + S + 3, 1, -1], [dx + S + 3, dy + S + 3, -1, -1]])
      for (let s = 0; s < bl; s++) { set(a - u * bn + u * s, b - v * bn, 3); set(a - u * bn, b - v * bn + v * s, 3); }
    for (const i of hal) { const x = dx + i % S, y = dy + (i / S | 0); if (prog * .9 > bay(x, y)) set(x, y, 1); }
    ord.forEach((i, j) => {
      const x = dx + i % S, y = dy + (i / S | 0), g = bay(x, y);
      if ((ph || j < nS) && g >= fd) set(x, y, nim[i]); else if (g < .2) set(x, y, 1);
    });
    for (const p of pts) {
      if (p.x < x0 + 4) continue;
      const t = p.s === 1 ? 1 : 2;
      for (let j = 2; j < p.tr.length; j += 2) set(p.tr[j], p.tr[j + 1], t);
      set(p.x, p.y, t + 1);
    }
    const pu = M.sin(tm * 3), q = S < 32 ? .6 : 1, g = rd((7 + 2 * pu) * q);
    for (let b = -5; b <= 5; b++) for (let a = -5; a <= 5; a++) { const r = hyp(a, b) / q; if (r < 5) set(fx + a, cy + b, r < 1.6 + .3 * pu ? 3 : r < 3.2 ? 2 : r < 4.2 ? 1 : 0); }
    for (let j = rd(3 * q); j <= g; j++) for (const [a, b] of [[j, 0], [-j, 0], [0, j], [0, -j]]) set(fx + a, cy + b, j < 6 * q ? 3 : j < g ? 2 : 1);
    for (const [a, e, y] of L.ar) if (e - a > 3) {
      for (let x = a; x <= e; x++) set(x, y, 2);
      for (let s = 1; s < 3; s++) { set(e - s, y - s, 2); set(e - s, y + s, 2); }
    }
    for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {
      let c = F[i];
      if (c < 0) { const v = cl(I[i], 0, 3), f = v | 0; c = M.min(3, f + (v - f > bay(x, y))); }
      const o = i * 4, col = pal[c];
      d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  function still() { for (let i = 0; i < 400; i++) step(1); nS = tot; ph = 1; pt = 100; draw(); }
  function loop(now) { raf = 0; const dt = prev ? M.min(3, (now - prev) / 16.7) : 1; prev = now; step(dt); draw(); kick(); }
  function kick() { if (!raf && !reduce && on && !document.hidden) raf = requestAnimationFrame(loop); else if (!raf) prev = 0; }
  function resize() { layout(); if (reduce) still(); }
  addEventListener('resize', resize);
  document.addEventListener('visibilitychange', kick);
  band.addEventListener('pointermove', e => {
    const r = band.getBoundingClientRect();
    pY = cl((e.clientY - r.top) / r.height, .15, .85); pX = cl((e.clientX - r.left) / r.width, 0, 1);
  });
  band.addEventListener('pointerleave', () => { pY = null; pX = .5; });
  if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { readPal(); if (reduce) draw(); });
  if ('IntersectionObserver' in window) new IntersectionObserver(e => { on = e[0].isIntersecting; kick(); }).observe(band);
  readPal(); resize();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize);
  kick();
})();

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// The page loads this script as app.js?v=<build time>; reuse that stamp for data files so a new deploy never mixes with cached old files.
const V = new URL(import.meta.url).search;

// ---------- ideas chart (numbers from the project's recorded results) ----------
const IDEAS = [
  { lever: 'B', name: 'float32 head + fast tracer', x: 3.23, v: 'ok', kind: 'per step', why: 'The float32-head network with the bookkeeping on the GPU: 5.96 vs 19.27 ms per step. Traces bitwise identical to the float32-head network, so its 2% verdict carries over.' },
  { lever: 'B', name: 'Fast tracer (float32)', x: 1.12, v: 'ok', kind: 'per step', why: 'Image, canvas, input assembly and move selection on the GPU. Bitwise identical on all 312 float32 traces (300 fresh and 12 benchmark seeds).' },
  { lever: 'B', name: 'float16 + float32 output head', x: 2.19, v: 'ok', kind: 'per step', why: 'Fresh 300 seeds: 5 new merges (1.7%, all dendrites) and 3 early stops. Passes the owner\'s 2% rule, set after this result; fails the earlier 1% rule.' },
  { lever: 'B', name: 'Direct network call', x: 1.10, v: 'ok', kind: 'per step', why: 'Same arithmetic, less framework overhead. Output bitwise identical on all 12 seeds.' },
  { lever: 'B', name: 'float16 network', x: 2.19, v: 'warn', kind: 'per step', why: 'Passed the 12 benchmark seeds, then failed on more: two large merges on the held-out crop, and 10 early stops on the 300-seed rule.' },
  { lever: 'B', name: 'bfloat16 network', x: 1.33, v: 'bad', kind: 'per step', why: 'New large merge on one benchmark dendrite (931 → 4,357 steps).' },
  { lever: 'A', name: 'Postpone + drop enclosed moves', x: 1.52, v: 'bad', kind: 'fewer steps', why: '34% fewer steps, but mostly by avoiding one existing false merge; per-seed recall losses.' },
  { lever: 'A', name: 'Postpone low-yield moves', x: 1.36, v: 'bad', kind: 'fewer steps', why: 'Two seeds lose 1.5–2.4 recall points.' },
  { lever: 'A', name: 'Skip enclosed moves', x: 1.09, v: 'bad', kind: 'fewer steps', why: 'One dendrite loses 1.21 recall points (limit 1.0).' },
  { lever: 'B', name: 'Drop 1 of 20 residual blocks', x: null, v: 'bad', kind: '', why: 'Mean recall −3.4 points. Every block matters: the best single drop already flips 1.2% of decisions.' },
  { lever: 'B', name: 'Drop 2 residual blocks', x: null, v: 'bad', kind: '', why: 'Mean recall −10.5 points.' },
];
const XMAX = 3.4, FILL = 0.62;  // bars use at most 62% of the row so labels fit on phones
const ideas = document.getElementById('ideas');
const pad = () => { const e = document.createElement('div'); e.className = 'pad'; return e; };
for (const d of IDEAS) {
  const name = document.createElement('div'); name.className = 'name';
  name.innerHTML = `<span class="ffn-lever">${d.lever}</span>${d.name}`;
  const cell = document.createElement('div'); cell.className = 'bar-row';
  if (d.x) {
    const pct = (d.x - 1) / (XMAX - 1) * 100 * FILL;
    cell.innerHTML = `<div class="bar v-${d.v}" style="width:${Math.max(pct, 2)}%"></div><span class="val">${d.x.toFixed(2)}× <i>${d.kind}</i></span>`;
  } else {
    cell.innerHTML = `<span class="val" style="margin-left:0">fails <i>on accuracy; speed not measured</i></span>`;
  }
  const why = document.createElement('div'); why.className = 'why'; why.textContent = d.why;
  ideas.append(name, cell, pad(), why);
}
{
  const axis = document.createElement('div'); axis.className = 'axis';
  for (const t of [1, 2, 3]) {
    const s = document.createElement('span'); s.style.left = ((t - 1) / (XMAX - 1) * 100 * FILL) + '%'; s.textContent = t + '×'; axis.append(s);
  }
  ideas.append(pad(), axis);
}

// ---------- step-time profiles: before (profiled float16 step) and after (fast tracer, float32 head) ----------
function drawProfile(stackId, legendId, parts) {
  const total = parts.reduce((a, p) => a + p[1], 0);
  const stack = document.getElementById(stackId), leg = document.getElementById(legendId);
  for (const [n, ms, bg, fg] of parts) {
    const d = document.createElement('div'); d.style.width = (ms / total * 100) + '%'; d.style.background = bg; d.style.color = fg;
    d.title = `${n}: ${ms} ms`; if (ms >= 1.3) d.textContent = ms.toFixed(1); stack.append(d);
    const l = document.createElement('span'); l.innerHTML = `<i class="ffn-sw" style="background:${bg}"></i>${n} ${ms.toFixed(1)} ms`; leg.append(l);
  }
}
drawProfile('profile', 'profile-legend', [
  ['network', 4.0, 'var(--accent)', '#fff'], ['canvas update', 2.0, '#cdd3ff', '#000'], ['input assembly', 1.7, '#eef0ff', '#000'],
  ['thread hand-off', 1.5, '#cdd3ff', '#000'], ['copy back', 0.7, '#eef0ff', '#000'], ['movement', 0.3, '#cdd3ff', '#000'],
]);
{  // the fast tracer's step: 5.96 ms in total, the network measured at about 4.6 ms per call; the bar is drawn to the same scale as 10.2 ms
  const parts = [['network', 4.6, 'var(--accent)', '#fff'], ['everything else', 1.36, '#ffd84d', '#000']];
  drawProfile('profile-after', 'profile-after-legend', parts);
  document.getElementById('profile-after').style.width = (5.96 / 10.2 * 100) + '%';
  const lab = document.createElement('span'); lab.innerHTML = '<b>after: fast tracer, float32 head, 5.96 ms</b>';
  document.getElementById('profile-after-legend').prepend(lab);
  const lab0 = document.createElement('span'); lab0.innerHTML = '<b>before: profiled float16 step, 10.2 ms</b>';
  document.getElementById('profile-legend').prepend(lab0);
}

// ---------- affinity-to-segment example: merge-threshold slider (segment counts from data/affinity-example/meta.json) ----------
{
  const T = [[0.95, 1830], [0.90, 1589], [0.85, 1436], [0.80, 1321], [0.70, 1149], [0.60, 969], [0.50, 711], [0.40, 482], [0.30, 296], [0.20, 198]];
  const img = document.getElementById('affex-seg'), slider = document.getElementById('affex-t');
  if (img && slider) {
    const base = img.getAttribute('src').replace(/segments_[0-9.]+\.png.*$/, '');
    for (const [t] of T) { const pre = new Image(); pre.src = `${base}segments_${t.toFixed(2)}.png${V}`; }  // no flicker while sliding
    const show = () => {
      const [t, n] = T[+slider.value];
      img.src = `${base}segments_${t.toFixed(2)}.png${V}`;
      document.getElementById('affex-tv').textContent = t.toFixed(2);
      document.getElementById('affex-n').textContent = n.toLocaleString('en-US');
    };
    slider.addEventListener('input', show);
    show();
  }
}

// ---------- review outcomes, in the order they happened (from the project's check records) ----------
{
  const SEQ = 'BACAACAACAAAACACACAAAAAACAAAABAAACBFACCAACABAAAAAAAAAC';  // F = tests failed  // C = checked, A = needs attention, B = blocked
  const el = document.getElementById('checks');
  for (const c of SEQ) { const i = document.createElement('i'); i.className = 'c-' + c; el.append(i); }
}

// ---------- 3D viewers ----------
// Two viewers share this code: FFN traces (data/manifest.json) and ViT segments of crop 12 (data/vit12/scenes.json).
// Scene stats come from those files, built from the recorded runs.
const COLORS = { fp32: 0x2a3cff, fp16: 0xf26a00, true: 0x8a8a8a, neighbour: 0xa070ff,
  vit: 0x2a3cff, ffn: 0xf26a00, piece0: 0x1a9e5c, piece1: 0xd1007a, piece2: 0xc9a400, piece3: 0x00a3c4 };
const hex = c => '#' + COLORS[c].toString(16).padStart(6, '0');
const pct = v => (v * 100).toFixed(1) + '%';

const cache = new Map();
async function loadMesh(file, scale) {
  if (cache.has(file)) return cache.get(file);
  const buf = await (await fetch('data/' + file + V)).arrayBuffer();
  const [nv, nf] = new Uint32Array(buf, 0, 2);
  const q = new Uint16Array(buf.slice(8, 8 + nv * 6));
  const idx = new Uint32Array(buf.slice(8 + nv * 6, 8 + nv * 6 + nf * 12));
  const pos = new Float32Array(nv * 3);
  for (let i = 0; i < q.length; i++) pos[i] = q[i] / 65535 * scale;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  cache.set(file, g); return g;
}

function material(layer) {
  if (layer.kind === 'proofread') {
    const isTrue = layer.role === 'true';
    return new THREE.MeshStandardMaterial({ color: COLORS[layer.role], transparent: true,
      opacity: isTrue ? 0.35 : 0.2, depthWrite: false, roughness: 0.8, side: THREE.DoubleSide });
  }
  const see = layer.role === 'fp16' || layer.role === 'ffn';  // drawn see-through over the other trace
  return new THREE.MeshStandardMaterial({ color: COLORS[layer.role], roughness: 0.55, metalness: 0.05,
    transparent: see, opacity: see ? 0.6 : 1, depthWrite: !see });
}

// cfg: { ids: {canvas, stage, select, layers, facts, loading, all, seed}, url, groups, notes, names,
//        layerText(layer), factsHtml(scene), focus(layer, mode), firstFrame(scene), query }
function viewer(cfg) {
  const $ = k => document.getElementById(cfg.ids[k]);
  const canvas = $('canvas'), stage = $('stage');
  if (!canvas) return;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xffffff);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 200);
  const controls = new OrbitControls(camera, canvas); controls.enableDamping = true;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8088a0, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); camera.add(sun); sun.position.set(1, 1, 2); scene.add(camera);
  const group = new THREE.Group(); scene.add(group);
  const resize = () => {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(stage);
  // render only while on screen, so two viewers do not both draw all the time
  let onScreen = false;
  new IntersectionObserver(es => { onScreen = es[0].isIntersecting; }).observe(stage);
  renderer.setAnimationLoop(() => { if (onScreen) { controls.update(); renderer.render(scene, camera); } });

  let manifest, current = [];
  const frame = mode => {
    const box = new THREE.Box3();
    for (const [layer, m] of current) if (cfg.focus(layer, mode)) box.expandByObject(m);
    if (box.isEmpty()) for (const [, m] of current) box.expandByObject(m);  // e.g. a seed in predicted background
    const c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() / 2;
    controls.target.copy(c);
    camera.position.copy(c).add(new THREE.Vector3(0.9, 0.5, 1.2).normalize().multiplyScalar(r * 2.7));
    camera.near = r / 100; camera.far = r * 30; camera.updateProjectionMatrix();
  };
  $('all').onclick = () => frame('all');
  $('seed').onclick = () => frame('seed');

  const loading = $('loading');
  async function show(key) {
    const sc = manifest.scenes.find(s => s.key === key);
    loading.hidden = false;
    const geoms = await Promise.all(sc.layers.map(l => loadMesh(l.file, manifest.scale_um)));
    group.clear();
    const layersEl = $('layers'); layersEl.innerHTML = '';
    const meshes = [];
    sc.layers.forEach((layer, i) => {
      const m = new THREE.Mesh(geoms[i], material(layer));
      m.renderOrder = layer.kind === 'proofread' ? 2 : (layer.role === 'fp16' || layer.role === 'ffn' ? 1 : 0);
      group.add(m); meshes.push([layer, m]);
      const lab = document.createElement('label');
      lab.innerHTML = `<input type="checkbox" checked><i class="ffn-sw" style="background:${hex(layer.role)}"></i>${cfg.layerText(layer)}`;
      const box = lab.querySelector('input');
      if (layer.role === 'neighbour') { box.checked = false; m.visible = false; }  // toggle on to show the merge partner
      box.onchange = e => { m.visible = e.target.checked; };
      layersEl.append(lab);
    });
    current = meshes; frame(cfg.firstFrame(sc));
    $('facts').innerHTML = `<span class="note">${cfg.notes[key]}</span>` + cfg.factsHtml(sc);
    loading.hidden = true;
  }
  const fail = e => {
    console.error(e);
    loading.hidden = false; loading.textContent = 'Could not load the 3D view. Please reload the page.';
  };
  (async () => {
    manifest = await (await fetch(cfg.url + V)).json();
    const sel = $('select');
    for (const [g, label] of Object.entries(cfg.groups)) {
      const og = document.createElement('optgroup'); og.label = label;
      for (const s of manifest.scenes.filter(s => s.group === g)) {
        const o = document.createElement('option'); o.value = s.key; o.textContent = cfg.names(s); og.append(o);
      }
      sel.append(og);
    }
    sel.onchange = () => show(sel.value).catch(fail);
    resize();
    const want = cfg.query && new URLSearchParams(location.search).get(cfg.query);  // e.g. ?scene=notebook
    const first = manifest.scenes.some(s => s.key === want) ? want : manifest.scenes[0].key;
    sel.value = first;
    await show(first);
  })().catch(fail);
}

// FFN traces: float32 against float16
const SCENES = {
  heldout250842: { name: 'Held-out dendrite 250842', note: 'float32 stops at the right place after 79 steps. float16 crosses into neighbour 245232 and keeps going for 2,266 steps.' },
  heldout245099: { name: 'Held-out dendrite 245099', note: 'float32 only touches neighbour 245232 (2,571 voxels). float16 crosses over into it.' },
  bench1525:     { name: 'Benchmark dendrite 1525 (reverse)', note: 'The reverse: here float32 makes the false merge (into 97123) and float16 avoids it. Same knife edge, other side.' },
  notebook:      { name: "Authors' notebook example", note: "The authors' own example seed, reproduced bitwise from their notebook before any change." },
  bench13395:    { name: 'Benchmark axon 13395', note: 'A long axon traced almost completely; float16 agrees closely.' },
  bench56789:    { name: 'Benchmark dendrite 56789', note: 'A long dendrite traced almost completely; float16 agrees closely.' },
  bench99141:    { name: 'Benchmark dendrite 99141', note: 'A typical dendrite: float16 and float32 agree closely.' },
  heldout176723: { name: 'Held-out axon 176723', note: 'Held-out crop: traced almost completely, float16 agrees closely.' },
  heldout151289: { name: 'Held-out axon 151289', note: 'Held-out crop: float16 agrees closely.' },
};
viewer({
  ids: { canvas: 'gl', stage: 'stage', select: 'scene', layers: 'layers', facts: 'facts', loading: 'loading', all: 'view-all', seed: 'view-seed' },
  url: 'data/manifest.json', query: 'scene',
  groups: { merge: 'Merge flips (float16 vs float32)', ok: 'Tracing working as intended' },
  notes: Object.fromEntries(Object.entries(SCENES).map(([k, s]) => [k, s.note])),
  names: s => SCENES[s.key].name,
  layerText: l => l.kind === 'trace' ? (l.role === 'fp32' ? 'float32 trace (reference)' : 'float16 trace')
    : (l.role === 'true' ? `proofread: true object (${l.id})` : `proofread: neighbour (${l.id})`),
  focus: (l, mode) => mode === 'all' ? l.role !== 'neighbour' : (l.role === 'fp32' || l.role === 'true'),
  firstFrame: sc => sc.group === 'merge' ? 'all' : 'seed',
  factsHtml: sc => {
    const st = sc.stats;
    return `<span></span><span class="hd">float32 / float16</span>
    <span>steps</span><span>${st.steps.map(v => v.toLocaleString('en-US')).join(' / ')}</span>
    <span>recall</span><span>${st.recall.map(pct).join(' / ')}</span>
    <span>precision</span><span>${st.precision.map(pct).join(' / ')}</span>
    <span>mask overlap</span><span>IoU ${st.iou.toFixed(2)}</span>
    <span>crop</span><span>${sc.crop === 'cropB' ? 'held-out' : 'benchmark'}</span>`;
  },
});

// ViT segments of crop 12 (the tuning crop), step-66,000 model, merge threshold 0.5
const VIT_NAMES = { p90: 'A good case (90th percentile)', p50: 'A typical case (median)', p10: 'A poor case (10th percentile)',
  ffn346093: 'Dendrite 346093: ViT and FFN' };
const VIT_NOTES = {
  p90: 'Ranked by F1 among the 457 crop-12 neurons and picked by rank, not by eye. A good case: the seed\'s segment holds 91% of the neuron, with a few small pieces split off.',
  p50: 'The median neuron. Nothing wrong is joined (precision 100%), but the neuron is broken into 11 pieces and the seed\'s segment holds only 39% of it.',
  p10: 'One of the worst tenth. The seed lands in a small piece holding 4% of the neuron; the largest piece (green) holds 43%.',
  ffn346093: 'The only crop-12 neuron with a recorded FFN trace (orange, see-through). FFN recovers 77% of it with almost nothing wrong; the ViT\'s segment recovers 52% and includes parts of other neurons.',
};
viewer({
  ids: { canvas: 'vit-gl', stage: 'vit-stage', select: 'vit-scene', layers: 'vit-layers', facts: 'vit-facts', loading: 'vit-loading', all: 'vit-view-all', seed: 'vit-view-seed' },
  url: 'data/vit12/scenes.json', query: 'vit',
  groups: { vit: 'Crop 12 neurons, picked by F1 rank' },
  notes: Object.fromEntries(Object.entries(VIT_NOTES).map(([k, n]) => ['vit12_' + k, n])),
  names: s => VIT_NAMES[s.key.replace('vit12_', '')],
  layerText: l => l.role === 'true' ? `proofread neuron (${l.id})`
    : l.role === 'vit' ? 'ViT segment holding the seed'
    : l.role === 'ffn' ? 'FFN trace (float16, float32 head)'
    : `another ViT segment: ${l.object_voxels_in_piece.toLocaleString('en-US')} voxels of this neuron`,
  focus: (l, mode) => l.role === (mode === 'all' ? 'true' : 'vit'),
  firstFrame: () => 'all',
  factsHtml: sc => {
    const st = sc.stats, ffn = st.ffn_recall !== undefined;
    return `<span></span><span class="hd">${ffn ? 'ViT / FFN' : 'ViT'}</span>
    <span>recall</span><span>${pct(st.vit_recall)}${ffn ? ' / ' + pct(st.ffn_recall) : ''}</span>
    <span>precision</span><span>${pct(st.vit_precision)}${ffn ? ' / ' + pct(st.ffn_precision) : ''}</span>
    <span>F1</span><span>${st.vit_f1.toFixed(2)}${ffn ? ' / ' + (2 * st.ffn_recall * st.ffn_precision / (st.ffn_recall + st.ffn_precision)).toFixed(2) : ''}</span>
    <span>F1 rank</span><span>${st.f1_rank_of_457} of 457 (1 = worst)</span>
    <span>ViT pieces</span><span>${st.pieces_over_1pct} holding &ge;1% of the neuron</span>
    <span>background</span><span>${pct(st.lost_to_background)} of the neuron called background</span>
    <span>size</span><span>${st.object_voxels.toLocaleString('en-US')} voxels</span>`;
  },
});

// ---------- hero: four crop-A FFN traces together, slowly turning ----------
{
  const canvas = document.getElementById('hero-gl'), stage = document.getElementById('hero-stage');
  if (canvas) {
    const HERO = [['notebook_fp32.bin', 0x2a3cff], ['bench13395_fp32.bin', 0xf26a00],
                  ['bench56789_fp32.bin', 0x1a9e5c], ['bench99141_fp32.bin', 0xd1007a]];
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 200);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true; controls.enableZoom = false;  // scroll moves the page, not the camera
    canvas.style.touchAction = 'pan-y';  // a vertical swipe on a phone scrolls the page
    controls.autoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    controls.autoRotateSpeed = 1.2;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8088a0, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5); camera.add(sun); sun.position.set(1, 1, 2); scene.add(camera);
    const group = new THREE.Group(); scene.add(group);
    const resize = () => {
      const w = stage.clientWidth, h = stage.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false); camera.aspect = w / h;
      // on wide screens, draw the neurons right of the overlaid results
      if (w > 760) camera.setViewOffset(w, h, -0.16 * w, 0, w, h); else camera.clearViewOffset();
      camera.updateProjectionMatrix();
    };
    new ResizeObserver(resize).observe(stage);
    let onScreen = false;
    new IntersectionObserver(es => { onScreen = es[0].isIntersecting; }).observe(stage);
    renderer.setAnimationLoop(() => { if (onScreen) { controls.update(); renderer.render(scene, camera); } });
    const loading = document.getElementById('hero-loading');
    (async () => {
      const manifest = await (await fetch('data/manifest.json' + V)).json();
      const geoms = await Promise.all(HERO.map(([f]) => loadMesh(f, manifest.scale_um)));
      geoms.forEach((g, i) => group.add(new THREE.Mesh(g,
        new THREE.MeshStandardMaterial({ color: HERO[i][1], roughness: 0.5, metalness: 0.05 }))));
      const box = new THREE.Box3().setFromObject(group);
      const c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() / 2;
      controls.target.copy(c);
      camera.position.copy(c).add(new THREE.Vector3(1.0, 0.35, 0.6).normalize().multiplyScalar(r * 2.2));
      camera.near = r / 100; camera.far = r * 30; camera.updateProjectionMatrix();
      resize(); loading.hidden = true;
    })().catch(e => { console.error(e); loading.textContent = 'Could not load the 3D view.'; });
  }
}

// ---------- the slice example's block in 3D: every object, ViT segments or proofread labels (data/block3d) ----------
{
  const canvas = document.getElementById('b3-gl'), stage = document.getElementById('b3-stage');
  if (canvas) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0xffffff);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
    camera.up.set(0, 0, 1);  // z (the slice axis) up; set before the controls read it
    const controls = new OrbitControls(camera, canvas); controls.enableDamping = true;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8088a0, 1.4));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6); camera.add(sun); sun.position.set(1, 1, 2); scene.add(camera);
    const group = new THREE.Group(); scene.add(group);
    const resize = () => {
      const w = stage.clientWidth, h = stage.clientHeight;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    new ResizeObserver(resize).observe(stage);
    let onScreen = false;
    new IntersectionObserver(es => { onScreen = es[0].isIntersecting; }).observe(stage);
    renderer.setAnimationLoop(() => { if (onScreen) { controls.update(); renderer.render(scene, camera); } });
    const loading = document.getElementById('b3-loading'), list = document.getElementById('b3-list');
    const count = document.getElementById('b3-count');
    let meta, sets = {}, current = [];

    async function loadSet(name) {  // one mesh per object, cut from the set's concatenated buffer
      if (sets[name]) return sets[name];
      const buf = await (await fetch(`data/block3d/${name}.bin${V}`)).arrayBuffer();
      const [nv, nf] = new Uint32Array(buf, 0, 2);
      const q = new Uint16Array(buf, 8, nv * 3);
      const idx = new Uint32Array(buf.slice(8 + nv * 6, 8 + nv * 6 + nf * 12));
      const objs = meta[name].objects.map(o => {
        const pos = new Float32Array(o.nv * 3);
        for (let i = 0; i < pos.length; i++) pos[i] = q[o.v0 * 3 + i] / 65535 * meta.scale_um;
        const f = new Uint32Array(o.nf * 3);
        for (let i = 0; i < f.length; i++) f[i] = idx[o.f0 * 3 + i] - o.v0;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setIndex(new THREE.BufferAttribute(f, 1));
        g.computeVertexNormals();
        const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: o.colour, roughness: 0.6, metalness: 0.05 }));
        m.userData = o;
        return m;
      });
      return (sets[name] = objs);
    }

    // the image slice of panel 1, at its depth in the block
    const [sz, sy, sx] = [0.024, 0.018, 0.018];  // um per voxel, as block3d.json spacing_um_zyx
    const img = document.querySelector('.ffn-affex img');
    const tex = new THREE.TextureLoader().load(img ? img.getAttribute('src') : '');
    tex.flipY = false; tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.NearestFilter;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(256 * sx, 256 * sy),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    plane.position.set(127.5 * sx, 127.5 * sy, 32 * sz); plane.visible = false; scene.add(plane);
    document.getElementById('b3-slice').onchange = e => { plane.visible = e.target.checked; };

    const total = name => name === 'vit'
      ? `of ${meta.vit.segments_total} segments in the block; ${meta.vit.segments_total - meta.vit.objects.length} under 100 voxels left out`
      : `of ${meta.labels.neurons_total} labelled neurons in the block; ${meta.labels.neurons_total - meta.labels.objects.length} under 100 voxels left out`;
    const updateCount = () => {
      const n = current.filter(m => m.visible).length;
      count.textContent = `${n} shown (${total(document.getElementById('b3-set').value)})`;
    };
    async function show(name) {
      loading.hidden = false;
      const objs = await loadSet(name);
      group.clear(); list.innerHTML = '';
      for (const m of objs) {
        group.add(m);
        const o = m.userData, lab = document.createElement('label');
        lab.innerHTML = `<input type="checkbox"${m.visible ? ' checked' : ''}><i class="ffn-sw" style="background:${o.colour}"></i>${name === 'vit' ? 'segment' : 'neuron'} ${o.id} &middot; ${o.voxels.toLocaleString('en-US')} voxels`;
        const box = lab.querySelector('input');
        box.onchange = () => { m.visible = box.checked; updateCount(); };
        m.userData.row = lab; m.userData.box = box;
        list.append(lab);
      }
      current = objs; updateCount(); loading.hidden = true;
    }
    const setAll = pred => { current.forEach((m, i) => { m.visible = pred(i); m.userData.box.checked = m.visible; }); updateCount(); };
    document.getElementById('b3-all').onclick = () => setAll(() => true);
    document.getElementById('b3-none').onclick = () => setAll(() => false);
    document.getElementById('b3-top').onclick = () => setAll(i => i < 10);  // the list is sorted by size
    document.getElementById('b3-set').onchange = e => show(e.target.value).catch(fail);

    // click a surface: highlight its row in the list
    const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
    let down = null;
    canvas.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
    canvas.addEventListener('pointerup', e => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return;  // a drag, not a click
      const r = canvas.getBoundingClientRect();
      ptr.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
      ray.setFromCamera(ptr, camera);
      const hit = ray.intersectObjects(current.filter(m => m.visible))[0];
      list.querySelectorAll('label.hit').forEach(l => l.classList.remove('hit'));
      if (hit) { const row = hit.object.userData.row; row.classList.add('hit'); row.scrollIntoView({ block: 'nearest' }); }
    });

    const fail = e => { console.error(e); loading.hidden = false; loading.textContent = 'Could not load the 3D view. Please reload the page.'; };
    (async () => {
      meta = await (await fetch('data/block3d/block3d.json' + V)).json();
      resize();
      await show('vit');
      const c = new THREE.Vector3(128 * sx, 128 * sy, 32 * sz);
      controls.target.copy(c);
      camera.position.copy(c).add(new THREE.Vector3(0.6, -1.0, 1.1).normalize().multiplyScalar(10));
      controls.update();
    })().catch(fail);
  }
}

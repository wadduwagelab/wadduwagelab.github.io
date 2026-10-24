import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// The page loads this script as app.js?v=<build time>; reuse that stamp for data files so a new deploy never mixes with cached old files.
const V = new URL(import.meta.url).search;

// ---------- ideas chart (numbers from the project's recorded results) ----------
const IDEAS = [
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
const XMAX = 2.4, FILL = 0.62;  // bars use at most 62% of the row so labels fit on phones
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
  for (const t of [1, 1.5, 2]) {
    const s = document.createElement('span'); s.style.left = ((t - 1) / (XMAX - 1) * 100 * FILL) + '%'; s.textContent = t + '×'; axis.append(s);
  }
  ideas.append(pad(), axis);
}

// ---------- step-time profile ----------
const PROFILE = [
  ['network', 4.0, 'var(--accent)', '#fff'], ['canvas update', 2.0, '#cdd3ff', '#000'], ['input assembly', 1.7, '#eef0ff', '#000'],
  ['thread hand-off', 1.5, '#cdd3ff', '#000'], ['copy back', 0.7, '#eef0ff', '#000'], ['movement', 0.3, '#cdd3ff', '#000'],
];
const total = PROFILE.reduce((a, p) => a + p[1], 0);
const stack = document.getElementById('profile'), pleg = document.getElementById('profile-legend');
for (const [n, ms, bg, fg] of PROFILE) {
  const d = document.createElement('div'); d.style.width = (ms / total * 100) + '%'; d.style.background = bg; d.style.color = fg;
  d.title = `${n}: ${ms} ms`; if (ms >= 1.4) d.textContent = ms.toFixed(1); stack.append(d);
  const l = document.createElement('span'); l.innerHTML = `<i class="ffn-sw" style="background:${bg}"></i>${n} ${ms.toFixed(1)} ms`; pleg.append(l);
}

// ---------- review outcomes, in the order they happened (from the project's check records) ----------
{
  const SEQ = 'BACAACAACAAAACACACAAAAAACAAAABAAACBFACC';  // F = tests failed  // C = checked, A = needs attention, B = blocked
  const el = document.getElementById('checks');
  for (const c of SEQ) { const i = document.createElement('i'); i.className = 'c-' + c; el.append(i); }
}

// ---------- 3D viewer ----------
// Scene stats (steps, recall, precision, IoU) come from data/manifest.json, built from the recorded runs.
const COLORS = { fp32: 0x2a3cff, fp16: 0xf26a00, true: 0x8a8a8a, neighbour: 0xa070ff };
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
const GROUPS = { merge: 'Merge flips (float16 vs float32)', ok: 'Tracing working as intended' };

const canvas = document.getElementById('gl'), stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xffffff);
const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 200);
const controls = new OrbitControls(camera, canvas); controls.enableDamping = true;
scene.add(new THREE.HemisphereLight(0xffffff, 0x8088a0, 1.4));
const sun = new THREE.DirectionalLight(0xffffff, 1.6); camera.add(sun); sun.position.set(1, 1, 2); scene.add(camera);
const group = new THREE.Group(); scene.add(group);

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });

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
  const fp16 = layer.role === 'fp16';
  return new THREE.MeshStandardMaterial({ color: COLORS[layer.role], roughness: 0.55, metalness: 0.05,
    transparent: fp16, opacity: fp16 ? 0.6 : 1, depthWrite: !fp16 });
}
const layerText = l => l.kind === 'trace' ? (l.role === 'fp32' ? 'float32 trace (reference)' : 'float16 trace')
  : (l.role === 'true' ? `proofread: true object (${l.id})` : `proofread: neighbour (${l.id})`);

let manifest, current = [];
function frame(mode) {
  const box = new THREE.Box3();
  for (const [layer, m] of current)
    if (mode === 'all' ? layer.role !== 'neighbour' : (layer.role === 'fp32' || layer.role === 'true')) box.expandByObject(m);
  const c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() / 2;
  controls.target.copy(c);
  camera.position.copy(c).add(new THREE.Vector3(0.9, 0.5, 1.2).normalize().multiplyScalar(r * 2.7));
  camera.near = r / 100; camera.far = r * 30; camera.updateProjectionMatrix();
}
document.getElementById('view-all').onclick = () => frame('all');
document.getElementById('view-seed').onclick = () => frame('seed');

const pct = v => (v * 100).toFixed(1) + '%';
async function show(key) {
  const sc = manifest.scenes.find(s => s.key === key);
  document.getElementById('loading').hidden = false;
  const meshes = [];
  const geoms = await Promise.all(sc.layers.map(l => loadMesh(l.file, manifest.scale_um)));
  group.clear();
  const layersEl = document.getElementById('layers'); layersEl.innerHTML = '';
  sc.layers.forEach((layer, i) => {
    const m = new THREE.Mesh(geoms[i], material(layer));
    m.renderOrder = layer.kind === 'proofread' ? 2 : (layer.role === 'fp16' ? 1 : 0);
    group.add(m); meshes.push([layer, m]);
    const lab = document.createElement('label');
    lab.innerHTML = `<input type="checkbox" checked><i class="ffn-sw" style="background:#${COLORS[layer.role].toString(16).padStart(6, '0')}"></i>${layerText(layer)}`;
    const box = lab.querySelector('input');
    if (layer.role === 'neighbour') { box.checked = false; m.visible = false; }  // toggle on to show the merge partner
    box.onchange = e => { m.visible = e.target.checked; };
    layersEl.append(lab);
  });
  current = meshes; frame(sc.group === 'merge' ? 'all' : 'seed');
  const st = sc.stats;
  document.getElementById('facts').innerHTML = `<span class="note">${SCENES[key].note}</span>
    <span></span><span class="hd">float32 / float16</span>
    <span>steps</span><span>${st.steps.map(v => v.toLocaleString('en-US')).join(' / ')}</span>
    <span>recall</span><span>${st.recall.map(pct).join(' / ')}</span>
    <span>precision</span><span>${st.precision.map(pct).join(' / ')}</span>
    <span>mask overlap</span><span>IoU ${st.iou.toFixed(2)}</span>
    <span>crop</span><span>${sc.crop === 'cropB' ? 'held-out' : 'benchmark'}</span>`;
  document.getElementById('loading').hidden = true;
}

function fail(e) {
  console.error(e);
  const el = document.getElementById('loading'); el.hidden = false;
  el.textContent = 'Could not load the 3D view. Please reload the page.';
}

(async () => {
  manifest = await (await fetch('data/manifest.json' + V)).json();
  const sel = document.getElementById('scene');
  for (const [g, label] of Object.entries(GROUPS)) {
    const og = document.createElement('optgroup'); og.label = label;
    for (const s of manifest.scenes.filter(s => s.group === g)) {
      const o = document.createElement('option'); o.value = s.key; o.textContent = SCENES[s.key].name; og.append(o);
    }
    sel.append(og);
  }
  sel.onchange = () => show(sel.value).catch(fail);
  resize();
  const want = new URLSearchParams(location.search).get('scene');  // e.g. ?scene=notebook
  const first = manifest.scenes.some(s => s.key === want) ? want : manifest.scenes[0].key;
  sel.value = first;
  await show(first);
})().catch(fail);

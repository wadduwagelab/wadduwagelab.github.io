import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ---------- ideas chart (numbers from the project's recorded results) ----------
const IDEAS = [
  { lever: 'B', name: 'Direct network call', x: 1.10, v: 'ok', kind: 'per step', why: 'Same arithmetic, less framework overhead. Output bitwise identical on all 12 seeds.' },
  { lever: 'B', name: 'float16 network', x: 2.19, v: 'warn', kind: 'per step', why: 'Passed the 12 benchmark seeds. Held-out crop: two dendrites merged into a neighbour (precision −93 and −75 points).' },
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

// ---------- 3D viewer ----------
const COLORS = { fp32: 0x2a3cff, fp16: 0xf26a00, true: 0x8a8a8a, neighbour: 0xa070ff };
const FACTS = {
  heldout250842: { note: 'Held-out crop. float16 crosses into neighbour 245232.',
    rows: [['steps fp32 / fp16', '79 / 2,266'], ['mask overlap (IoU)', '0.07'], ['precision change', '−93.2 pts'], ['recall change', '−2.25 pts']] },
  heldout245099: { note: 'Held-out crop. float32 already touches 245232 slightly; float16 crosses over.',
    rows: [['steps fp32 / fp16', '727 / 2,866'], ['mask overlap (IoU)', '0.23'], ['precision change', '−74.8 pts'], ['recall change', '−5.0 pts']] },
  bench99141: { note: 'Benchmark crop. A typical seed: float16 and float32 agree closely.',
    rows: [['steps fp32', '959'], ['mask overlap (IoU)', '0.96'], ['verdict', 'within tolerance']] },
};
const SCENE_NAMES = { heldout250842: 'Held-out dendrite A (merge)', heldout245099: 'Held-out dendrite B (merge)', bench99141: 'Benchmark dendrite (no merge)' };

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
  const buf = await (await fetch('data/' + file)).arrayBuffer();
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
    const isTrue = layer.label.startsWith('true');
    return new THREE.MeshStandardMaterial({ color: isTrue ? COLORS.true : COLORS.neighbour, transparent: true,
      opacity: isTrue ? 0.35 : 0.2, depthWrite: false, roughness: 0.8, side: THREE.DoubleSide });
  }
  return new THREE.MeshStandardMaterial({ color: COLORS[layer.label], roughness: 0.55, metalness: 0.05,
    transparent: layer.label === 'fp16', opacity: layer.label === 'fp16' ? 0.6 : 1, depthWrite: layer.label !== 'fp16' });
}
const LAYER_TEXT = { fp32: 'float32 trace (reference)', fp16: 'float16 trace' };

let manifest, current = [];
function frame(mode) {
  const box = new THREE.Box3();
  for (const [layer, m] of current)
    if (mode === 'all' ? layer.label !== 'neighbour' && !layer.label.startsWith('neighbour') : (layer.label === 'fp32' || layer.label.startsWith('true'))) box.expandByObject(m);
  const c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() / 2;
  controls.target.copy(c);
  camera.position.copy(c).add(new THREE.Vector3(0.9, 0.5, 1.2).normalize().multiplyScalar(r * 2.7));
  camera.near = r / 100; camera.far = r * 30; camera.updateProjectionMatrix();
}
document.getElementById('view-all').onclick = () => frame('all');
document.getElementById('view-seed').onclick = () => frame('seed');
async function show(key) {
  const sc = manifest.scenes.find(s => s.key === key);
  document.getElementById('loading').hidden = false;
  group.clear();
  const layersEl = document.getElementById('layers'); layersEl.innerHTML = '';
  const meshes = [];
  for (const layer of sc.layers) {
    const g = await loadMesh(layer.file, manifest.scale_um);
    const m = new THREE.Mesh(g, material(layer));
    m.renderOrder = layer.kind === 'proofread' ? 2 : (layer.label === 'fp16' ? 1 : 0);
    group.add(m); meshes.push([layer, m]);
    const col = layer.kind === 'proofread' ? (layer.label.startsWith('true') ? COLORS.true : COLORS.neighbour) : COLORS[layer.label];
    const lab = document.createElement('label');
    lab.innerHTML = `<input type="checkbox" checked><i class="ffn-sw" style="background:#${col.toString(16).padStart(6, '0')}"></i>${layer.kind === 'proofread' ? 'proofread: ' + layer.label : LAYER_TEXT[layer.label]}`;
    const box = lab.querySelector('input');
    if (layer.label.startsWith('neighbour')) { box.checked = false; m.visible = false; }  // toggle on to show where fp16 went
    box.onchange = e => { m.visible = e.target.checked; };
    layersEl.append(lab);
  }
  current = meshes; frame('all');
  const f = FACTS[key];
  document.getElementById('facts').innerHTML = `<span class="note">${f.note}</span>` +
    f.rows.map(([k, v]) => `<span>${k}</span><span>${v}</span>`).join('');
  document.getElementById('loading').hidden = true;
}

(async () => {
  manifest = await (await fetch('data/manifest.json')).json();
  const sel = document.getElementById('scene');
  for (const s of manifest.scenes) { const o = document.createElement('option'); o.value = s.key; o.textContent = SCENE_NAMES[s.key]; sel.append(o); }
  sel.onchange = () => show(sel.value);
  resize();
  await show(manifest.scenes[0].key);
})();

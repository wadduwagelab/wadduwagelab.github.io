// RIPPLE agent demo: interactive overlay of the tracks. Data in data/tracks.json
// (video frames as JPEG, one track per target for each method). No dependencies.
(async function () {
const base = document.currentScript ? document.currentScript.src.replace(/app\.js.*$/, "") : "";
const D = await fetch(base + "data/tracks.json").then(r => r.json());
const METHODS = [
 {k:"human", name:"Reference: the annotator's manual track", color:"#f5f5f5", shape:"c"},
 {k:"llm",   name:"Claude Opus", color:"#ffb000", shape:"s"},
 {k:"haiku", name:"Claude Haiku", color:"#a3e635", shape:"s"},
 {k:"rule",  name:"Rule-based controller", color:"#22d3ee", shape:"s"},
 {k:"flow",  name:"Optical flow alone, one click", color:"#f472b6", shape:"x"},
 {k:"ripple", name:"The annotator's track made with RIPPLE", color:"#60a5fa", shape:"c"}];
const on = {human:true, llm:true, haiku:false, rule:false, flow:true, ripple:false};
const S = D.scale, T = D.frames.length, cv = document.getElementById("view"), cx = cv.getContext("2d");
let focus = "Track1", V = {x0:D.x0, y0:D.y0, w:D.w, h:D.h, s:S};
function setView(){
  const tr = D.tracks.find(q => q.id == focus);
  if (!tr) V = {x0:D.x0, y0:D.y0, w:D.w, h:D.h, s:S};
  else { const w = Math.min(72, D.w, D.h), c = tr.human[t];
    V = {x0: Math.max(D.x0, Math.min(D.x0+D.w-w, Math.round(c[0]-w/2))), y0: Math.max(D.y0, Math.min(D.y0+D.h-w, Math.round(c[1]-w/2))), w:w, h:w, s:8}; }
  if (cv.width != V.w*V.s || cv.height != V.h*V.s){ cv.width = V.w*V.s; cv.height = V.h*V.s; }
  document.querySelector('.ra-grid').style.gridTemplateColumns = V.w > 1.3*V.h ? '1fr' : '';
}
const imgs = D.frames.map(b => {const i = new Image(); i.src = "data:image/jpeg;base64,"+b; return i;});
let t = 0, playing = false, timer = null;
const px = p => [(p[0]-V.x0+0.5)*V.s, (p[1]-V.y0+0.5)*V.s];

function mark(m, p, r){
  const [x,y] = px(p); cx.strokeStyle = m.color; cx.lineWidth = 2;
  cx.beginPath();
  if (m.shape=="c") cx.arc(x,y,r,0,7);
  else if (m.shape=="s") cx.rect(x-r,y-r,2*r,2*r);
  else {cx.moveTo(x-r,y-r);cx.lineTo(x+r,y+r);cx.moveTo(x+r,y-r);cx.lineTo(x-r,y+r);}
  cx.stroke();
}
function draw(){
  cx.imageSmoothingEnabled = false;
  setView(); cx.imageSmoothingEnabled = false;
  if (imgs[t].complete) cx.drawImage(imgs[t],V.x0-D.x0,V.y0-D.y0,V.w,V.h,0,0,cv.width,cv.height);
  const trail = document.getElementById("trail").checked, links = document.getElementById("links").checked,
        anch = document.getElementById("anch").checked;
  for (const tr of D.tracks){
    if (focus && tr.id != focus && Math.hypot(tr.human[t][0]-V.x0-V.w/2, tr.human[t][1]-V.y0-V.h/2) > V.w) continue;
    for (const m of METHODS){
      if (!on[m.k]) continue;
      const P = tr[m.k];
      if (trail){cx.strokeStyle = m.color; cx.globalAlpha = .45; cx.lineWidth = 1.2; cx.beginPath();
        for (let i=Math.max(0,t-40);i<=t;i++){const [x,y]=px(P[i]); i==Math.max(0,t-40)?cx.moveTo(x,y):cx.lineTo(x,y);} cx.stroke(); cx.globalAlpha = 1;}
      if (links && m.k!="human" && on.human){cx.strokeStyle = m.color; cx.lineWidth = 1; cx.beginPath();
        cx.moveTo(...px(P[t])); cx.lineTo(...px(tr.human[t])); cx.stroke();}
      mark(m, P[t], m.k=="human"?9:7);
    }
    if (anch && on.llm) for (const a of tr.anchors){
      const dt = Math.abs(a.frame - t); if (dt > 4) continue;
      const [x,y] = px(dt==0 ? [a.x,a.y] : tr.llm[t]); cx.strokeStyle = "#ffb000"; cx.lineWidth = 2.5; cx.globalAlpha = 1-dt/6;
      cx.setLineDash(a.by=="human"?[5,4]:[]); cx.beginPath(); cx.arc(x,y,15+dt*2,0,7); cx.stroke(); cx.setLineDash([]); cx.globalAlpha = 1;
    }
    const [lx,ly] = px(tr.human[t]); cx.font = "600 13px system-ui"; cx.fillStyle = "#fff";
    cx.strokeStyle = "#000"; cx.lineWidth = 3; cx.strokeText(tr.id, lx+13, ly-11); cx.fillText(tr.id, lx+13, ly-11);
  }
  document.getElementById("num").textContent = `frame ${t} / ${T-1}`;
  document.getElementById("frame").value = t;
  charts();
}
const dist = (a,b) => Math.hypot(a[0]-b[0], a[1]-b[1]);
function charts(){
  for (const tr of D.tracks){
    const c = document.getElementById("c_"+tr.id), r = devicePixelRatio||1, W = c.clientWidth, H = c.clientHeight;
    c.width = W*r; c.height = H*r; const g = c.getContext("2d"); g.scale(r,r);
    const css = getComputedStyle(document.documentElement), ymax = tr.ymax, X = i => 4+(W-8)*i/(T-1), Y = v => H-14-(H-22)*Math.min(v,ymax)/ymax;
    g.strokeStyle = css.getPropertyValue("--line"); g.lineWidth = 1; g.beginPath(); g.moveTo(4,Y(0)); g.lineTo(W-4,Y(0)); g.moveTo(4,Y(4)); g.lineTo(W-4,Y(4)); g.stroke();
    g.fillStyle = css.getPropertyValue("--muted") || "#555"; g.font = "10px system-ui"; g.fillText("4 px", 6, Y(4)-2); g.fillText(ymax.toFixed(0)+" px", 6, 9);
    for (const m of METHODS.slice(1)){ if (!on[m.k]) continue;
      g.strokeStyle = m.color=="#f5f5f5"?"#888":m.color; g.lineWidth = 1.4; g.beginPath();
      tr[m.k].forEach((p,i) => {const y = Y(dist(p,tr.human[i])); i?g.lineTo(X(i),y):g.moveTo(X(i),y);}); g.stroke(); }
    if (on.llm) for (const a of tr.anchors){ g.fillStyle = "#ffb000"; if (a.by=="human"){g.fillRect(X(a.frame)-3,H-10,6,6);} else {g.beginPath(); g.arc(X(a.frame),H-7,2.6,0,7); g.fill();} }
    g.strokeStyle = css.getPropertyValue("--ink"); g.beginPath(); g.moveTo(X(t),0); g.lineTo(X(t),H); g.stroke();
  }
}
function setT(v){ t = Math.max(0, Math.min(T-1, v)); draw(); }
function toggle(){ playing = !playing; document.getElementById("play").textContent = playing?"Pause":"Play";
  clearInterval(timer); if (playing) timer = setInterval(() => setT(t==T-1?0:t+1), 60); }
document.getElementById("play").onclick = toggle;
document.getElementById("frame").max = T-1;
document.getElementById("frame").oninput = e => setT(+e.target.value);
for (const id of ["trail","links","anch"]) document.getElementById(id).onchange = draw;
addEventListener("keydown", e => { if (e.key=="ArrowRight") setT(t+1); else if (e.key=="ArrowLeft") setT(t-1); else if (e.key==" "){e.preventDefault(); toggle();} });
addEventListener("resize", charts);
const F = document.getElementById("focus");
F.innerHTML = '<option value="">all tracks</option>' + D.tracks.map(q => `<option value="${q.id}">follow ${q.id}</option>`).join("");
F.value = focus;
F.onchange = e => { focus = e.target.value; draw(); };
const L = document.getElementById("legend");
for (const m of METHODS){ const l = document.createElement("label"); 
  l.innerHTML = `<input type="checkbox" ${on[m.k]?"checked":""}><span class="sw ${m.shape}" style="border-color:${m.color};color:${m.color};background:#222">${m.shape=="x"?"×":""}</span>${m.name}`;
  l.firstChild.onchange = e => {on[m.k] = e.target.checked; draw();}; L.appendChild(l); }
const C = document.getElementById("charts");
for (const tr of D.tracks){ const d = document.createElement("div"); d.className = "tr";
  const sel = tr.anchors.filter(a=>a.by=="llm").length, def = tr.anchors.filter(a=>a.by=="human").length;
  d.innerHTML = `<b style="cursor:pointer" title="Follow this track">${tr.id}</b> <span>· Opus placed ${sel}, deferred ${def}</span><canvas class="chart" id="c_${tr.id}"></canvas>`;
  C.appendChild(d);
  d.querySelector('b').onclick = () => { focus = tr.id; F.value = tr.id; draw(); };
  d.querySelector("canvas").onclick = e => { const r = e.target.getBoundingClientRect(); setT(Math.round((e.clientX-r.left-4)/(r.width-8)*(T-1))); }; }
Promise.all(imgs.slice(0,1).map(i => i.decode())).then(draw);
})();

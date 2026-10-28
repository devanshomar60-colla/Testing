/* Resume Coach — PWA front end (no build step, no dependencies).
 *
 * DATA LAYER: everything the UI shows lives in `sessions` (saved in localStorage).
 * Demo mode: questions + scoring below (`QUESTIONS`, `mockScore`) run in the browser.
 * To connect your FastAPI backend, replace ONLY those two things:
 *   Engine.start(role)  -> POST /api/interview/start   { session_id, role, language }
 *   Engine.answer(text) -> POST /api/interview/answer  { session_id, answer }
 * and keep saving the finished result in the same `session` shape (see seed()).
 */
(() => {
"use strict";

/* ====================== helpers ====================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;
const DIMS = [["relevance", "Relevance"], ["depth", "Depth"], ["structure", "Structure"], ["communication", "Communication"]];
const cls = (n) => (n >= 70 ? "good" : n >= 50 ? "warn" : "bad");
const fmtDate = (iso) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const fmtMonth = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" });
const fmtDur = (s) => (s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m` : `${Math.max(1, Math.round(s / 60))} min`);
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2600);
}

/* ====================== icons ====================== */
const IC = {
  home: '<path d="M3 11l9-8 9 8M5 10v10h14V10"/>',
  mic: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>',
  history: '<path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  doc: '<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
  speaker: '<path d="M11 5L6 9H3v6h3l5 4zM15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13"/>',
  arrow: '<path d="M9 6l6 6-6 6"/>',
};
const svg = (n, extra = "") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra} aria-hidden="true">${IC[n]}</svg>`;

/* ====================== data ====================== */
const KEY = "rc.sessions.v1";
let sessions = [];
function save() { try { localStorage.setItem(KEY, JSON.stringify(sessions)); } catch (e) { /* private mode: keep in memory */ } }
function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw); } catch (e) { /* ignore */ }
  return null;
}

const TIPS = {
  relevance: "Answer the exact question first, then add context.",
  depth: "Add one concrete number or trade-off: what you measured, chose or gave up.",
  structure: "Use a clear order: situation, what you did, result.",
  communication: "Aim for 45 to 100 words: long enough to show depth, short enough to stay sharp.",
};

function questionsFor(role) {
  const r = (role || "").toLowerCase();
  const tech = /data|ml|machine|ai\b/.test(r)
    ? "Explain overfitting and how you would detect it in a model you trained."
    : /front|web|react|ui/.test(r)
      ? "What happens in the browser between typing a URL and seeing the page?"
      : "How would you design a rate limiter for a public API?";
  return [
    { tag: "Introduction", text: `Give me a 60-second introduction. Who are you, and why ${role || "this role"}?` },
    { tag: "Project depth", text: "Pick the project on your resume you are proudest of. What problem did it solve, and what exactly did you build yourself?" },
    { tag: "Project depth", text: "What was the hardest technical decision in that project, and what trade-off did you accept?" },
    { tag: "Project depth", text: "If that project had 100 times more users tomorrow, what would break first?" },
    { tag: "Role technical", text: tech },
    { tag: "Behavioural", text: "Tell me about a time a team deadline was at risk. What was the situation, what did you do, and what was the result?" },
  ];
}

/* Demo scorer: rough heuristics so the UI is testable offline. NOT a real evaluation. */
function mockScore(q, a) {
  const words = a.trim().split(/\s+/).filter(Boolean);
  const n = words.length, low = a.toLowerCase();
  const struct = (low.match(/\b(first|then|because|so that|result|situation|task|action|finally|however|trade-?off)\b/g) || []).length;
  const qw = new Set(q.toLowerCase().match(/[a-z]{5,}/g) || []);
  const overlap = words.filter((w) => qw.has(w.toLowerCase().replace(/[^a-z]/g, ""))).length;
  const r = (v) => clamp(Math.round(v), 1, 5);
  return {
    relevance: r(1.5 + Math.min(overlap, 4) * 0.6 + Math.min(n, 40) / 40),
    depth: r(1 + Math.min(n, 90) / 30 + (/\d/.test(a) ? 1 : 0)),
    structure: r(1 + Math.min(struct, 4) * 0.8 + (n > 25 ? 0.8 : 0)),
    communication: r(n < 8 ? 1.2 : n < 20 ? 2.4 : n <= 140 ? 3.6 + (n > 45 && n < 110 ? 0.9 : 0) : 3),
  };
}
const tipFor = (sc) => TIPS[DIMS.map(([k]) => k).sort((a, b) => sc[a] - sc[b])[0]];

function summarize(qa) {
  const dims = {};
  DIMS.forEach(([k]) => (dims[k] = +avg(qa.map((x) => x.scores[k])).toFixed(1)));
  return { dims, overall: Math.round(avg(Object.values(dims)) * 20) }; // same rule as the backend: avg x 20
}

function seed() {
  const WEAK = [
    "I am a student. I like coding and I want this job because it is good for my career.",
    "My project was a website for attendance. I made the frontend and some backend.",
    "I had to choose a database. I used MongoDB because it was easy.",
    "Maybe the server would be slow. We can add more servers.",
    "Overfitting is when the model does too well on training data.",
    "Once we had an exam and project together. We managed somehow and submitted on time.",
  ];
  const STRONG = [
    "I am a third-year B.Tech student who builds practical AI tools. I want a backend internship because I enjoy turning messy data into reliable APIs, and my attendance project taught me that.",
    "My Smart Attendance project removed paper roll calls for 120 students. I built the face-matching API myself: first the capture flow, then embedding storage, and the result was marking a class in under 40 seconds.",
    "The hardest decision was storing embeddings in MongoDB instead of a vector database. I accepted slower search because the dataset was small, and that kept hosting free.",
    "The matching loop would break first because it scans every embedding. I would add an index, cache recent lookups and move image work to a queue so requests stay under one second.",
    "Overfitting is when a model memorises training data. I detect it by comparing training and validation loss, and then fix it with early stopping or more data; on my last model it cut the gap from 18 to 4 points.",
    "Situation: our demo was three days away and the camera module failed. My action was to split the work, I rebuilt the capture step in a day, and the result was a clean demo that our mentor praised.",
  ];
  const roles = ["Backend Developer Intern", "Backend Developer Intern", "Data Analyst Intern", "Backend Developer Intern", "Software Engineer Intern", "Software Engineer Intern", "Backend Developer Intern", "Software Engineer Intern"];
  const base = [2.4, 2.65, 2.55, 3.0, 3.2, 3.35, 3.6, 3.85];
  const days = [34, 29, 23, 18, 12, 8, 4, 1];
  const off = { relevance: 0.35, depth: -0.5, structure: -0.1, communication: 0.3 };
  const out = base.map((b, si) => {
    const qs = questionsFor(roles[si]);
    const qa = qs.map((q, qi) => {
      const scores = {};
      DIMS.forEach(([k], ki) => (scores[k] = clamp(Math.round(b + off[k] + (((qi + ki + si) % 3) - 1) * 0.45), 1, 5)));
      return { q: q.text, tag: q.tag, a: b > 3.1 ? STRONG[qi] : WEAK[qi], scores, tip: tipFor(scores) };
    });
    const d = new Date(Date.now() - days[si] * 864e5); d.setHours(18, 10 + si * 7, 0, 0);
    return { id: "demo-i" + si, type: "interview", role: roles[si], date: d.toISOString(), durationSec: 540 + si * 55, demo: true, qa, ...summarize(qa) };
  });
  const rd = (n, h) => { const d = new Date(Date.now() - n * 864e5); d.setHours(h, 5, 0, 0); return d.toISOString(); };
  out.push(
    { id: "demo-r0", type: "resume", role: "Software Engineer Intern", date: rd(15, 11), before: 52, after: 78, demo: true,
      fixes: [
        { from: "Worked on a website for attendance", to: "Built a face-recognition attendance web app used by [N students], cutting roll-call time by [X%]" },
        { from: "Helped with backend APIs", to: "Developed 6 FastAPI endpoints with session handling and rule-based fallbacks" },
        { from: "Did testing of the project", to: "Wrote 19 automated tests (pytest) covering upload, scoring and error paths" },
      ] },
    { id: "demo-r1", type: "resume", role: "Data Analyst Intern", date: rd(26, 16), before: 44, after: 69, demo: true,
      fixes: [
        { from: "Made charts in Excel", to: "Built [N] dashboards in Excel and Power BI to track [metric], used weekly by [team]" },
        { from: "Responsible for cleaning data", to: "Cleaned a [N-row] dataset and removed [X%] duplicate records before analysis" },
      ] },
  );
  return out.sort((a, b) => new Date(a.date) - new Date(b.date));
}

const interviews = () => sessions.filter((s) => s.type === "interview").sort((a, b) => new Date(a.date) - new Date(b.date));
const byId = (id) => sessions.find((s) => s.id === id);

/* ====================== orb (animated ring) ====================== */
class Orb {
  constructor(canvas, ring = 0.3) {
    this.c = canvas; this.x = canvas.getContext("2d"); this.mode = "idle"; this.e = 0.25; this.ring = ring;
    this.t0 = performance.now(); this.stopped = false;
    this.onResize = () => this.resize(); addEventListener("resize", this.onResize);
    this.resize(); this.loop = this.loop.bind(this); this.loop(this.t0);
  }
  resize() {
    const d = Math.min(devicePixelRatio || 1, 1.5), r = this.c.getBoundingClientRect();
    this.w = Math.max(2, r.width); this.h = Math.max(2, r.height);
    this.c.width = this.w * d; this.c.height = this.h * d; this.x.setTransform(d, 0, 0, d, 0, 0);
  }
  set(m) { this.mode = m; }
  stop() { this.stopped = true; cancelAnimationFrame(this.raf); removeEventListener("resize", this.onResize); }
  loop(now) {
    if (this.stopped) return;
    const target = { idle: 0.25, speak: 0.85, think: 1, listen: 0.6 }[this.mode];
    this.e += (target - this.e) * 0.05;
    this.draw(now - this.t0);
    if (!REDUCE) this.raf = requestAnimationFrame(this.loop);
  }
  draw(t) {
    const { x, w, h } = this, cx = w / 2, cy = h / 2, R = Math.min(w, h) * this.ring;
    const pulse = this.mode === "think" ? Math.sin(t / 260) * 0.02 : this.mode === "listen" ? Math.sin(t / 170) * 0.015 : 0;
    x.clearRect(0, 0, w, h); x.globalCompositeOperation = "lighter"; x.lineJoin = "round";
    const LAYERS = [ // [index, lineWidth, alpha, blurBoost]
      [0, 34, 0.05, 1], [1, 20, 0.08, 1], [2, 10, 0.17, 1], [3, 5, 0.38, 1], [4, 2.6, 0.85, 1], [5, 1.4, 1, 1], [6, 1, 1, 1]];
    for (const [L, lw, alpha, boost] of LAYERS) {
      const k = L / 6, spread = (5 + this.e * 15) * (0.6 + k * 1.0);
      x.beginPath();
      for (let i = 0; i <= 240; i++) {
        const a = (i / 240) * Math.PI * 2;
        const n = Math.sin(a * 3 + t * 0.0007 * (1 + k * 0.4) + L * 1.7) * 0.5 + Math.sin(a * 7 - t * 0.0011 * (1 + k * 0.3) + L * 2.3) * 0.3 + Math.sin(a * 12 + t * 0.0018 + L) * 0.2;
        const r = R * (1 + pulse) + n * spread + (k - 0.5) * 12;
        const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
        i ? x.lineTo(px, py) : x.moveTo(px, py);
      }
      x.closePath();
      let g;
      if (x.createConicGradient) g = x.createConicGradient(t * 0.00018 + L * 0.35, cx, cy);
      else g = x.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
      [[0, "#c04bff"], [0.2, "#2fd4ff"], [0.4, "#3d7bff"], [0.58, "#7a4bff"], [0.72, "#ff3d5a"], [0.86, "#ff8a3d"], [1, "#c04bff"]].forEach(([st, c]) => g.addColorStop(st, c));
      x.strokeStyle = g; x.lineWidth = lw; x.globalAlpha = alpha;
      x.stroke();
    }
    x.globalAlpha = 1; x.shadowBlur = 0; x.globalCompositeOperation = "source-over";
  }
}

/* ====================== small components ====================== */
function ring(value, size = 120, label = "", sub = "") {
  const r = size / 2 - 9, len = 2 * Math.PI * r, id = "rg" + Math.random().toString(36).slice(2, 7);
  return `<div class="ringbox" style="width:${size}px;height:${size}px;position:relative;flex:none">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(label || "Score")} ${value} out of 100">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff6a3d"/><stop offset=".5" stop-color="#c04bff"/><stop offset="1" stop-color="#2fd4ff"/></linearGradient></defs>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="9"/>
      <circle class="arc" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="url(#${id})" stroke-width="9" stroke-linecap="round"
        stroke-dasharray="${len}" stroke-dashoffset="${len * (1 - clamp(value, 0, 100) / 100)}" style="--len:${len}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    </svg>
    <div style="position:absolute;inset:0;display:grid;place-content:center;text-align:center">
      <b style="font:700 ${size * 0.27}px var(--display);letter-spacing:-.02em" data-count="${value}">${value}</b>
      ${sub ? `<span class="muted" style="font-size:11px;margin-top:-2px">${esc(sub)}</span>` : ""}
    </div></div>`;
}

function bars(dims, max = 5) {
  const weakest = Object.keys(dims).sort((a, b) => dims[a] - dims[b])[0];
  return DIMS.map(([k, l]) => `<div class="bar"><div class="row"><span>${l}</span><b>${dims[k].toFixed(1)}<span class="muted">/${max}</span></b></div>
    <div class="track"><div class="fill ${k === weakest ? "weak" : ""}" data-w="${(dims[k] / max) * 100}"></div></div></div>`).join("");
}

function lineChart(list) {
  if (list.length < 2) return `<div class="empty"><b>Not enough data yet</b>Finish two interviews to see your trend.</div>`;
  const W = 600, H = 280, P = { l: 34, r: 14, t: 14, b: 30 };
  const xs = (i) => P.l + (i / (list.length - 1)) * (W - P.l - P.r);
  const ys = (v) => P.t + (1 - v / 100) * (H - P.t - P.b);
  const pts = list.map((s, i) => [xs(i), ys(s.overall)]);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = `${line} L${pts.at(-1)[0]} ${H - P.b} L${pts[0][0]} ${H - P.b} Z`;
  const grid = [0, 25, 50, 75, 100].map((v) => `<line class="grid-l" x1="${P.l}" x2="${W - P.r}" y1="${ys(v)}" y2="${ys(v)}"/><text class="axis" x="${P.l - 8}" y="${ys(v) + 4}" text-anchor="end">${v}</text>`).join("");
  const step = Math.ceil(list.length / 6);
  const labels = list.map((s, i) => (i % step === 0 || i === list.length - 1 ? `<text class="axis" x="${xs(i)}" y="${H - 8}" text-anchor="middle">${fmtDate(s.date)}</text>` : "")).join("");
  const dots = list.map((s, i) => `<a href="#/report/${s.id}"><circle cx="${pts[i][0]}" cy="${pts[i][1]}" r="5" fill="#0b0d1c" stroke="url(#lg)" stroke-width="2.5"><title>${fmtDate(s.date)}: ${s.overall}/100 (${esc(s.role)})</title></circle></a>`).join("");
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Overall score over time, from ${list[0].overall} to ${list.at(-1).overall}">
    <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff6a3d"/><stop offset=".5" stop-color="#c04bff"/><stop offset="1" stop-color="#2fd4ff"/></linearGradient>
    <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c04bff" stop-opacity=".35"/><stop offset="1" stop-color="#c04bff" stop-opacity="0"/></linearGradient></defs>
    ${grid}<path d="${area}" fill="url(#ag)"/><path d="${line}" fill="none" stroke="url(#lg)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${dots}${labels}</svg></div>`;
}

function heatmap() {
  const counts = {};
  sessions.forEach((s) => { const k = new Date(s.date).toDateString(); counts[k] = (counts[k] || 0) + 1; });
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(today); // Monday of the week 11 weeks ago, so columns are Mon-Sun weeks
  start.setDate(today.getDate() - (11 * 7 + ((today.getDay() + 6) % 7)));
  let html = "";
  for (let i = 0; i < 12 * 7; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    if (d > today) { html += `<i style="opacity:0"></i>`; continue; }
    const c = counts[d.toDateString()] || 0;
    html += `<i class="${c ? "l" + Math.min(c, 3) : ""}" title="${d.toDateString()}: ${c} session${c === 1 ? "" : "s"}"></i>`;
  }
  return `<div class="heat" role="img" aria-label="Practice activity over the last 12 weeks">${html}</div>`;
}

const sessionItem = (s) => {
  const isI = s.type === "interview", score = isI ? s.overall : s.after;
  return `<a class="item" href="#/report/${s.id}">
    <div class="mini ${isI ? cls(score) : "res"}">${isI ? score : "CV"}</div>
    <div><div class="t">${isI ? "Mock interview" : "Resume enhanced"} · ${esc(s.role)}</div>
    <div class="s">${fmtDate(s.date)} · ${isI ? `${s.qa.length} questions · ${fmtDur(s.durationSec)}` : `score ${s.before} → ${s.after}`}${s.demo ? " · sample" : ""}</div></div>
    <span class="arrow">${svg("arrow", 'width="20" height="20"')}</span></a>`;
};

/* ====================== pages ====================== */
function pageDashboard() {
  const list = interviews(), last3 = list.slice(-3), first3 = list.slice(0, 3);
  const readiness = last3.length ? Math.round(avg(last3.map((s) => s.overall))) : 0;
  const delta = list.length >= 4 ? Math.round(avg(last3.map((s) => s.overall)) - avg(first3.map((s) => s.overall))) : null;
  const best = list.length ? Math.max(...list.map((s) => s.overall)) : 0;
  const total = list.reduce((a, s) => a + s.durationSec, 0);
  const dimAvg = {}; DIMS.forEach(([k]) => (dimAvg[k] = last3.length ? avg(last3.map((s) => s.dims[k])) : 0));
  const weakest = DIMS.map(([k, l]) => [k, l]).sort((a, b) => dimAvg[a[0]] - dimAvg[b[0]])[0];
  const recent = [...sessions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 4);

  return `
  <section class="hero">
    <div>
      <div class="eyebrow">Your interview readiness</div>
      <h1 style="margin-top:10px">Practice until it <span class="grad-text">feels natural.</span></h1>
      <p class="muted" style="margin-top:10px;max-width:44ch">An AI interviewer asks questions from your own resume, scores every answer, and shows exactly what to fix next.</p>
      <div class="cta"><a class="btn primary" href="#/interview">Start new interview</a><a class="btn" href="#/resume">Enhance my resume</a></div>
    </div>
    <div class="ready"><canvas id="heroOrb" aria-hidden="true"></canvas>${ring(readiness, 132, "Readiness", "readiness")}
      <div><b style="font:600 16px var(--display)">${list.length ? (readiness >= 70 ? "Interview-ready" : readiness >= 50 ? "Getting there" : "Keep practising") : "No interviews yet"}</b>
      <div class="muted" style="font-size:13px;margin-top:4px">Average of your last ${last3.length || 0} interview${last3.length === 1 ? "" : "s"}.</div></div></div>
  </section>

  <section class="stats">
    <div class="card stat"><div class="v" data-count="${list.length}">${list.length}</div><div class="l">Interviews completed</div>${delta === null ? "" : `<div class="d ${delta >= 0 ? "up" : "down"}">${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta)} pts since you started</div>`}</div>
    <div class="card stat"><div class="v">${list.length ? Math.round(avg(list.map((s) => s.overall))) : "–"}<span class="muted" style="font-size:16px">/100</span></div><div class="l">Average score</div></div>
    <div class="card stat"><div class="v">${best || "–"}<span class="muted" style="font-size:16px">/100</span></div><div class="l">Best score</div></div>
    <div class="card stat"><div class="v">${total ? fmtDur(total) : "–"}</div><div class="l">Time practised</div></div>
  </section>

  <section class="cols two">
    <div class="card"><header><h2>Score trend</h2><span class="chip">${list.length} interviews</span></header>${lineChart(list)}</div>
    <div class="card"><header><h2>Skill breakdown</h2><span class="chip">last 3</span></header>
      ${last3.length ? bars(dimAvg) + `<div class="insight"><b>Focus next: ${weakest[1]}.</b> ${TIPS[weakest[0]]}</div>` : `<div class="empty">Complete an interview to see skills.</div>`}
    </div>
  </section>

  <section class="cols two-eq">
    <div class="card"><header><h2>Recent activity</h2><a class="btn small ghost" href="#/history">View all</a></header>
      <div class="list">${recent.length ? recent.map(sessionItem).join("") : `<div class="empty"><b>Nothing yet</b>Your interviews and resume reports will appear here.</div>`}</div></div>
    <div class="card"><header><h2>Consistency</h2><span class="chip">12 weeks</span></header>${heatmap()}
      <p class="muted" style="font-size:12.5px;margin-top:12px">Brighter squares mean more sessions that day. Short daily practice beats one long session.</p></div>
  </section>`;
}

function pageHistory(params) {
  const q = params.q || "", f = params.f || "all";
  let list = [...sessions].sort((a, b) => new Date(b.date) - new Date(a.date));
  if (f !== "all") list = list.filter((s) => s.type === f);
  if (q) list = list.filter((s) => (s.role + " " + (s.qa || []).map((x) => x.q + " " + x.a).join(" ")).toLowerCase().includes(q.toLowerCase()));
  let html = "", month = "";
  list.forEach((s) => { const m = fmtMonth(s.date); if (m !== month) { month = m; html += `<h3 class="month muted">${m}</h3>`; } html += sessionItem(s).replace('class="item"', 'class="item" style="margin-bottom:10px"'); });
  const chip = (v, l) => `<button class="chip pick ${f === v ? "on" : ""}" data-f="${v}">${l}</button>`;
  return `<div class="head"><div><div class="eyebrow">Everything you've practised</div><h1>History</h1></div>
    <span class="chip">${sessions.length} total</span></div>
    <div class="tools"><label class="search">${svg("search")}<span class="sr">Search history</span><input id="q" type="search" placeholder="Search by role, question or answer" value="${esc(q)}"></label>
    ${chip("all", "All")}${chip("interview", "Interviews")}${chip("resume", "Resume")}</div>
    <div id="histList">${html || `<div class="empty"><b>No matches</b>Try a different search or filter.</div>`}</div>`;
}

function pageReport(id) {
  const s = byId(id);
  if (!s) return `<div class="empty"><b>Report not found</b><a class="btn" href="#/history" style="margin-top:14px">Back to history</a></div>`;
  const back = `<a class="btn small ghost" href="#/history">← History</a>`;
  const del = `<button class="btn small ghost" id="del">Delete</button>`;
  if (s.type === "resume") {
    return `<div class="head"><div>${back}<h1 style="margin-top:14px">Resume report</h1><p class="muted">${esc(s.role)} · ${fmtDate(s.date)}${s.demo ? " · sample" : ""}</p></div>${del}</div>
    <div class="card rep-top" style="margin-bottom:14px">
      <div style="display:flex;gap:18px;align-items:center">${ring(s.before, 104, "Before", "before")}<span class="muted" style="font-size:22px">→</span>${ring(s.after, 124, "After", "after")}</div>
      <div><h2>+${s.after - s.before} points after enhancement</h2><p class="muted" style="margin-top:6px">Placeholders like <b>[X%]</b> mark numbers only you know. Fill them with real figures; never invent metrics.</p></div></div>
    <div class="card"><header><h2>Suggested rewrites</h2><span class="chip">${s.fixes.length}</span></header>
      ${s.fixes.map((f) => `<div class="diff"><div class="from">${esc(f.from)}</div><div class="to">${esc(f.to)}</div></div>`).join("")}</div>`;
  }
  const dims = s.dims, order = Object.keys(dims).sort((a, b) => dims[b] - dims[a]);
  const nm = Object.fromEntries(DIMS);
  const verdict = s.overall >= 70 ? "Strong performance" : s.overall >= 50 ? "Solid, with clear gaps" : "Needs more practice";
  return `<div class="head"><div>${back}<h1 style="margin-top:14px">Interview report</h1><p class="muted">${esc(s.role)} · ${fmtDate(s.date)} · ${fmtDur(s.durationSec)}${s.demo ? " · sample" : ""}</p></div>
    <div style="display:flex;gap:8px"><button class="btn small" id="retake">Retake this role</button>${del}</div></div>
  <section class="card rep-top" style="margin-bottom:14px">${ring(s.overall, 150, "Overall", "overall")}
    <div><h2>${verdict}</h2><div style="margin-top:14px">${bars(dims)}</div></div></section>
  <section class="sw" style="margin-bottom:14px">
    <div class="card"><h2 class="up">What worked</h2><ul><li><b>${nm[order[0]]}</b> was your best skill (${dims[order[0]].toFixed(1)}/5).</li><li><b>${nm[order[1]]}</b> was also solid (${dims[order[1]].toFixed(1)}/5).</li></ul></div>
    <div class="card"><h2 style="color:var(--warn)">Fix first</h2><ul><li><b>${nm[order.at(-1)]}</b> (${dims[order.at(-1)].toFixed(1)}/5): ${TIPS[order.at(-1)]}</li></ul></div>
  </section>
  <section class="card"><header><h2>Question by question</h2><span class="chip">${s.qa.length} questions</span></header>
    ${s.qa.map((x, i) => `<details class="qa" ${i === 0 ? "open" : ""}><summary><span class="n">${i + 1}</span><span><b>${esc(x.q)}</b><br><span class="muted" style="font-size:12px">${esc(x.tag)}</span></span>
      <span class="chip ${cls(avg(Object.values(x.scores)) * 20)}">${Math.round(avg(Object.values(x.scores)) * 20)}</span></summary>
      <div class="body"><div class="bubble ai"><small>Interviewer</small>${esc(x.q)}</div><div class="bubble me"><small>Your answer</small>${esc(x.a)}</div>
      <div class="scorechips">${DIMS.map(([k, l]) => `<span class="chip ${x.scores[k] >= 4 ? "good" : x.scores[k] >= 3 ? "warn" : "bad"}">${l} ${x.scores[k]}/5</span>`).join("")}</div>
      <div class="tip">Tip: ${esc(x.tip)}</div></div></details>`).join("")}</section>`;
}

function pageResume() {
  const past = sessions.filter((s) => s.type === "resume").sort((a, b) => new Date(b.date) - new Date(a.date));
  return `<div class="head"><div><div class="eyebrow">AI resume enhancer</div><h1>Make every line count</h1><p class="muted">Paste your resume text or upload a .txt. We rewrite weak bullets and leave placeholders for numbers only you know.</p></div></div>
  <div class="demo-bar"><b>Demo mode</b><span class="muted">Rewrites run in your browser with simple rules. Connect the backend for real AI analysis.</span></div>
  <section class="cols two">
    <div class="card stack"><div><label class="lbl" for="role">Target role</label><input class="field" id="role" value="Software Engineer Intern"></div>
      <label class="drop" id="drop" for="file"><b>Drop a .txt resume here</b><span class="muted" style="font-size:13px">or tap to choose a file (PDF and DOCX are parsed by the backend)</span></label>
      <input type="file" id="file" accept=".txt,text/plain" class="sr">
      <div><label class="lbl" for="rtext">Resume text</label><textarea class="field" id="rtext" rows="9" placeholder="Worked on a website for attendance&#10;Helped with backend APIs&#10;Did testing of the project"></textarea></div>
      <button class="btn primary" id="analyze">Analyse and enhance</button></div>
    <div class="card"><header><h2>Past analyses</h2><span class="chip">${past.length}</span></header>
      <div class="list">${past.length ? past.map(sessionItem).join("") : `<div class="empty">No resume reports yet.</div>`}</div></div>
  </section>`;
}

function mockEnhance(text) {
  const VERBS = [[/^(worked on|working on)\s+/i, "Built "], [/^(helped (with|in)|assisted (with|in))\s+/i, "Supported "], [/^(responsible for)\s+/i, "Owned "], [/^(did|made)\s+/i, "Delivered "], [/^(was part of)\s+/i, "Contributed to "]];
  const lines = text.split(/\n+/).map((l) => l.replace(/^[\s•\-*]+/, "").trim()).filter((l) => l.length > 18 && !/^[A-Za-z ]{2,24}:/.test(l)).slice(0, 4);
  const fixes = lines.map((from) => {
    let to = from; VERBS.some(([re, v]) => re.test(to) && (to = to.replace(re, v)));
    if (!/\d/.test(to)) to += " [add a real number: %, users or time saved]";
    return { from, to };
  });
  const before = clamp(38 + Math.min(text.length / 40, 14) + (/\d/.test(text) ? 8 : 0), 0, 70) | 0;
  return { fixes, before, after: clamp(before + 14 + fixes.length * 3, 0, 94) };
}

function pageInterview() {
  const roles = ["Backend Developer Intern", "Data Analyst Intern", "Software Engineer Intern", "Frontend Developer Intern", "ML Engineer Intern"];
  return `<div class="setup"><div class="head"><div><div class="eyebrow">AI interview coach</div><h1>Which role are you <span class="grad-text">interviewing for?</span></h1></div></div>
    <div class="card stack">
      <div><label class="lbl">Pick a role</label><div style="display:flex;flex-wrap:wrap;gap:8px" id="roles">${roles.map((r, i) => `<button class="chip pick ${i === 0 ? "on" : ""}" data-r="${r}">${r}</button>`).join("")}</div></div>
      <div><label class="lbl" for="custom">Or type your own</label><input class="field" id="custom" placeholder="e.g. DevOps Intern"></div>
      <div class="muted" style="font-size:13px">6 questions · about 10 minutes · type or speak your answers. Scores appear after each answer.</div>
      <button class="btn primary" id="begin">Begin live interview</button></div></div>`;
}

/* ---- live interview ---- */
let cleanup = null;
function startLive(role) {
  const qs = questionsFor(role);
  const stage = document.createElement("div");
  stage.className = "stage";
  stage.innerHTML = `<canvas class="orb" id="orb" aria-hidden="true"></canvas>
    <div class="stage-top"><button class="pill" id="quit">✕ End</button><div class="progress" aria-hidden="true">${qs.map(() => "<i></i>").join("")}</div><span class="pill" id="timer">00:00</span></div>
    <div class="center"><div class="eyebrow" id="eb" style="color:rgba(255,255,255,.6)"></div>
      <div class="qtext" aria-live="polite"><span id="q" class="caret"></span></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center"><button class="pill" id="hear">🔊 Hear it</button><button class="pill" id="skip">Skip →</button></div>
      <div class="status" id="st"></div></div>
    <div><form class="composer" id="form"><textarea id="ans" rows="1" placeholder="Type your answer…" aria-label="Your answer" disabled></textarea>
      <button type="button" class="round" id="mic" aria-label="Speak your answer">${svg("mic")}</button>
      <button type="submit" class="round send" id="send" aria-label="Send answer" disabled>${svg("send")}</button></form>
      <div class="kbd">Enter to send · Shift+Enter for a new line</div></div><div class="fbwrap" id="fb"></div>`;
  document.body.appendChild(stage); document.body.classList.add("immersive");
  const orb = new Orb($("#orb", stage), 0.34);
  const el = { q: $("#q", stage), st: $("#st", stage), fb: $("#fb", stage), eb: $("#eb", stage), ans: $("#ans", stage), send: $("#send", stage), mic: $("#mic", stage), bars: $$(".progress i", stage) };
  let i = 0, token = 0, qa = [], elapsed = 0, rec = null, done = false;
  const timer = setInterval(() => { elapsed++; $("#timer", stage).textContent = mmss(elapsed); }, 1000);

  async function typeText(text, tk) {
    el.q.classList.add("caret"); el.q.textContent = "";
    if (REDUCE) { el.q.textContent = text; el.q.classList.remove("caret"); return; }
    for (let c = 1; c <= text.length; c++) {
      if (tk !== token) return;
      el.q.textContent = text.slice(0, c);
      await sleep(/[.,?]/.test(text[c - 1]) ? 120 : 24);
    }
    el.q.classList.remove("caret");
  }
  async function ask() {
    const tk = ++token, q = qs[i];
    el.fb.innerHTML = ""; el.ans.value = ""; el.ans.placeholder = "Type your answer…"; el.ans.disabled = el.send.disabled = true;
    el.bars.forEach((b, n) => (b.className = n < i ? "done" : n === i ? "cur" : ""));
    el.eb.textContent = `Question ${i + 1} of ${qs.length} · ${q.tag}`;
    el.st.textContent = "Interviewer is asking"; orb.set("speak");
    await typeText(q.text, tk); if (tk !== token) return;
    orb.set("idle"); el.st.textContent = "Your turn · type or speak";
    el.ans.disabled = false; el.ans.focus(); updateSend();
  }
  const updateSend = () => (el.send.disabled = el.ans.disabled || !el.ans.value.trim());
  el.ans.addEventListener("input", () => { updateSend(); el.ans.style.height = "auto"; el.ans.style.height = Math.min(el.ans.scrollHeight, 140) + "px"; });
  el.ans.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#form", stage).requestSubmit(); } });

  async function submit(text, skipped = false) {
    if (done) return; stopRec(); el.ans.value = ""; el.ans.style.height = "auto"; el.ans.placeholder = "Press Next to continue";
    el.ans.disabled = el.send.disabled = true; token++;
    el.st.textContent = "Analysing your answer"; orb.set("think");
    const scores = skipped ? { relevance: 1, depth: 1, structure: 1, communication: 1 } : mockScore(qs[i].text, text);
    await sleep(REDUCE ? 0 : 1100);
    const tip = skipped ? "Even a short attempt earns more than a skip." : tipFor(scores);
    qa.push({ q: qs[i].text, tag: qs[i].tag, a: skipped ? "(skipped)" : text, scores, tip });
    orb.set("idle"); el.st.textContent = "";
    const last = i === qs.length - 1;
    el.fb.innerHTML = `<div class="feedback"><div class="fg">${DIMS.map(([k, l]) => `<div><b>${scores[k]}/5</b>${l}</div>`).join("")}</div>
      <div class="tip" style="margin-bottom:12px">Tip: ${esc(tip)}</div>
      <button class="btn primary small" id="next">${last ? "Finish and view report" : "Next question →"}</button></div>`;
    $("#next", stage).focus();
    $("#next", stage).onclick = () => (last ? finish() : (i++, ask()));
  }
  $("#form", stage).addEventListener("submit", (e) => { e.preventDefault(); const t = el.ans.value.trim(); if (t) submit(t); });
  $("#skip", stage).onclick = () => { if (!el.fb.innerHTML && !done) submit("", true); };
  $("#hear", stage).onclick = () => { if ("speechSynthesis" in window) { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(qs[i].text); u.lang = "en-IN"; speechSynthesis.speak(u); } else toast("Speech playback is not supported in this browser."); };

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  function stopRec() { if (rec) { try { rec.stop(); } catch (e) { /* already stopped */ } rec = null; el.mic.classList.remove("rec"); if (!done) orb.set("idle"); } }
  el.mic.onclick = () => {
    if (!SR) return toast("Voice input is not supported in this browser. Please type.");
    if (rec) return stopRec(); if (el.ans.disabled) return;
    rec = new SR(); rec.lang = "en-IN"; rec.interimResults = false; rec.continuous = true;
    rec.onresult = (ev) => { const t = [...ev.results].map((r) => r[0].transcript).join(" "); el.ans.value = (el.ans.value + " " + t).trim(); updateSend(); };
    rec.onerror = () => { toast("Could not hear you. Please try again or type."); stopRec(); };
    rec.onend = () => { rec = null; el.mic.classList.remove("rec"); };
    rec.start(); el.mic.classList.add("rec"); orb.set("listen"); el.st.textContent = "Listening…";
  };

  function end() { done = true; token++; clearInterval(timer); stopRec(); orb.stop(); stage.remove(); document.body.classList.remove("immersive"); speechSynthesis?.cancel?.(); }
  function finish() {
    const s = { id: "s" + Date.now(), type: "interview", role, date: new Date().toISOString(), durationSec: Math.max(elapsed, 30), qa, ...summarize(qa) };
    end(); sessions.push(s); save(); cleanup = null; toast("Interview saved to your history"); location.hash = "#/report/" + s.id;
  }
  $("#quit", stage).onclick = () => { if (confirm("End this interview? Your answers will not be saved.")) { end(); cleanup = null; location.hash = "#/"; } };
  cleanup = end; ask();
}

function pageSettings() {
  const demoCount = sessions.filter((s) => s.demo).length;
  return `<div class="head"><div><div class="eyebrow">Preferences</div><h1>Settings</h1></div></div>
  <div class="card">
    <div class="row2"><div><b>Install on your phone</b><div class="muted" style="font-size:13px">Add Resume Coach to your home screen for a full-screen app.</div></div><button class="btn small" id="install">Install app</button></div>
    <div class="row2"><div><b>Sample data</b><div class="muted" style="font-size:13px">${demoCount} sample sessions are filling your charts.</div></div><button class="btn small" id="rmdemo" ${demoCount ? "" : "disabled"}>Remove samples</button></div>
    <div class="row2"><div><b>Export your history</b><div class="muted" style="font-size:13px">Download everything as a JSON file.</div></div><button class="btn small" id="export">Export</button></div>
    <div class="row2"><div><b>Reset everything</b><div class="muted" style="font-size:13px">Delete all sessions and restore the sample data.</div></div><button class="btn small" id="reset" style="color:var(--bad)">Reset</button></div>
    <div class="row2"><div><b>Backend</b><div class="muted" style="font-size:13px">Not connected. The app runs in demo mode in your browser.</div></div><span class="chip warn">Demo mode</span></div>
  </div>`;
}

/* ====================== shell + router ====================== */
const NAV = [["#/", "Home", "home"], ["#/history", "History", "history"], ["#/interview", "Interview", "mic"], ["#/resume", "Resume", "doc"], ["#/settings", "Settings", "gear"]];
function renderNav(active) {
  const on = (h) => (h === active ? "on" : "");
  $("#sidebar").innerHTML = `<div class="brand"><img src="icons/icon-192.png" alt="">Resume Coach</div>` +
    NAV.map(([h, l, i]) => `<a class="navlink ${on(h)}" href="${h}" ${on(h) ? 'aria-current="page"' : ""}>${svg(i)}${l}</a>`).join("") +
    `<div class="side-foot">Practice daily. Small wins add up.</div>`;
  const order = [NAV[0], NAV[1], NAV[2], NAV[3], NAV[4]];
  $("#tabbar").innerHTML = order.map(([h, l, i]) => h === "#/interview"
    ? `<a class="tab go" href="${h}" aria-label="New interview"><span class="orbbtn">${svg(i)}</span><span>${l}</span></a>`
    : `<a class="tab ${on(h)}" href="${h}" ${on(h) ? 'aria-current="page"' : ""}>${svg(i)}<span>${l}</span></a>`).join("");
}

function afterRender() {
  requestAnimationFrame(() => $$(".fill[data-w]").forEach((f) => (f.style.width = f.dataset.w + "%")));
  if (!REDUCE) $$("[data-count]").forEach((n) => {
    const to = +n.dataset.count, t0 = performance.now();
    const step = (t) => { const p = Math.min(1, (t - t0) / 900); n.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}

function route() {
  cleanup && cleanup(); cleanup = null; speechSynthesis?.cancel?.();
  document.body.classList.remove("immersive"); $$(".stage").forEach((n) => n.remove());
  const raw = location.hash.slice(1) || "/", [path, qs] = raw.split("?"), [, page = "", arg] = path.split("/");
  const params = Object.fromEntries(new URLSearchParams(qs || ""));
  const main = $("#main");
  let html = "", active = "#/";
  if (page === "history") { html = pageHistory(params); active = "#/history"; }
  else if (page === "report") { html = pageReport(arg); active = "#/history"; }
  else if (page === "resume") { html = pageResume(); active = "#/resume"; }
  else if (page === "interview") { html = pageInterview(); active = "#/interview"; }
  else if (page === "settings") { html = pageSettings(); active = "#/settings"; }
  else html = pageDashboard();
  main.innerHTML = html; renderNav(active);
  main.style.animation = "none"; void main.offsetWidth; main.style.animation = ""; scrollTo(0, 0);
  bind(page, arg, params); afterRender();
  document.title = "Resume Coach" + (page ? " · " + page[0].toUpperCase() + page.slice(1) : "");
}

function bind(page, arg, params) {
  if (!page) { const c = $("#heroOrb"); if (c) { const o = new Orb(c, 0.27); cleanup = () => o.stop(); } }
  if (page === "history") {
    let t; $("#q").addEventListener("input", (e) => { clearTimeout(t); t = setTimeout(() => { const p = new URLSearchParams({ f: params.f || "all", q: e.target.value }); location.hash = "#/history?" + p; }, 250); });
    $$("[data-f]").forEach((b) => (b.onclick = () => (location.hash = "#/history?" + new URLSearchParams({ f: b.dataset.f, q: params.q || "" }))));
    const i = $("#q"); if (i && params.q) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  }
  if (page === "report") {
    const s = byId(arg);
    $("#del")?.addEventListener("click", () => { if (confirm("Delete this report?")) { sessions = sessions.filter((x) => x.id !== arg); save(); toast("Report deleted"); location.hash = "#/history"; } });
    $("#retake")?.addEventListener("click", () => startLive(s.role));
  }
  if (page === "interview") {
    let role = "Backend Developer Intern";
    $$("#roles .chip").forEach((b) => (b.onclick = () => { $$("#roles .chip").forEach((x) => x.classList.remove("on")); b.classList.add("on"); role = b.dataset.r; $("#custom").value = ""; }));
    $("#custom").addEventListener("input", (e) => { if (e.target.value.trim()) $$("#roles .chip").forEach((x) => x.classList.remove("on")); });
    $("#begin").onclick = () => startLive($("#custom").value.trim() || role);
  }
  if (page === "resume") {
    const drop = $("#drop"), file = $("#file"), text = $("#rtext");
    const read = (f) => { if (!f) return; if (!/\.txt$/i.test(f.name)) return toast("Only .txt works in demo mode. The backend parses PDF and DOCX."); f.text().then((t) => (text.value = t)); };
    file.onchange = () => read(file.files[0]);
    ["dragover", "dragenter"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
    ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); if (ev === "drop") read(e.dataTransfer.files[0]); }));
    $("#analyze").onclick = () => {
      if (text.value.trim().length < 30) return toast("Paste a few lines of your resume first.");
      const r = mockEnhance(text.value);
      if (!r.fixes.length) return toast("No bullet lines found. Put each achievement on its own line.");
      const s = { id: "r" + Date.now(), type: "resume", role: $("#role").value.trim() || "Target role", date: new Date().toISOString(), ...r };
      sessions.push(s); save(); location.hash = "#/report/" + s.id;
    };
  }
  if (page === "settings") {
    let deferred = window.__bip;
    $("#install").onclick = async () => { if (deferred) { deferred.prompt(); deferred = null; } else toast("Use your browser menu: Add to Home screen."); };
    $("#rmdemo").onclick = () => { sessions = sessions.filter((s) => !s.demo); save(); toast("Sample data removed"); route(); };
    $("#reset").onclick = () => { if (confirm("Delete all sessions and restore sample data?")) { sessions = seed(); save(); toast("Reset complete"); route(); } };
    $("#export").onclick = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(sessions, null, 2)], { type: "application/json" })); a.download = "resume-coach-history.json"; a.click(); URL.revokeObjectURL(a.href); };
  }
}

/* ====================== boot ====================== */
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); window.__bip = e; });
document.body.insertAdjacentHTML("afterbegin", '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff6a3d"/><stop offset=".5" stop-color="#c04bff"/><stop offset="1" stop-color="#2fd4ff"/></linearGradient></defs></svg>');
sessions = load() || (() => { const s = seed(); try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* memory only */ } return s; })();
addEventListener("hashchange", route);
route();
if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();

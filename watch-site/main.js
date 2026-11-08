// The mechanical watch as an interactive page (entry watch-site), made 2026-11-08 from the film's pieces: the same
// watch, stage, page and cameras (../watch-shared), driven by the visitor instead of a script.
//   - a pill opens its part under its own camera and holds it open until another pill is pressed;
//     Teardown explodes the whole watch on a slow turntable and pressing it again puts it back together;
//     Hero closes everything and returns to the still's view
//   - drag turns the camera round the watch, the wheel zooms, a double click resets the view
//   - keys: 1-4 the parts, E the teardown, H the hero view
//   - Films (top right) opens a player with the film and the 10-second short, served next to the page from videos/
//     (watch-film.mp4, watch-demo.mp4 and a poster .jpg each); the 3D view stops drawing while it is open
// The movement runs on the page's own clock (performance.now), so this page is live, not frame-steppable like the films.
import {runSim} from 'cutaway-kit/runtime.js';
import {makeWatchScene} from '../watch-shared/sim.js';
import {ACTS, LABELS, makeCams, OPENS} from '../watch-shared/tour.js';

const D2R = Math.PI / 180;
const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const ss = (a, b, t) => smoother((t - a) / (b - a));
const PILLS = ['crystal_dial', 'escapement', 'case_flank', 'crown_winding', 'exploded', 'hero'];
const NAME = {crystal_dial: 'Crystal off', escapement: 'Escapement out', case_flank: 'Movement lifted', crown_winding: 'Winding', exploded: 'Taken apart'};

const CSS = `
.vp .pill{pointer-events:auto;cursor:pointer;user-select:none}
.vp .pill:hover{border-color:#16b364}
.vp .hint{position:absolute;left:0;right:0;top:842px;text-align:center;font:500 12px/1 'Inter',sans-serif;color:#94a3b8;letter-spacing:.2px}
#app canvas{cursor:grab}
.vp .films{position:absolute;right:170px;top:20px;height:32px;padding:0 14px;border:1px solid #16b364;border-radius:16px;display:flex;align-items:center;gap:8px;font:600 13px/1 'Inter',sans-serif;background:#effbf4;color:#0b7a43;pointer-events:auto;cursor:pointer;user-select:none}
.vp .films:hover{background:#dcf7e8}
.vp .films i{width:0;height:0;border-left:7px solid #16b364;border-top:4.5px solid transparent;border-bottom:4.5px solid transparent;display:block}
.fm{position:fixed;inset:0;z-index:50;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(15,23,42,.55);font-family:'Inter',system-ui,sans-serif}
.fm.on{display:flex}
.fm .box{position:relative;width:min(1100px,100%);max-height:calc(100vh - 32px);overflow:auto;background:#fff;border-radius:18px;padding:22px;box-shadow:0 20px 60px rgba(15,23,42,.35)}
.fm h2{margin:0 0 4px;font:800 22px/1.2 'Inter',sans-serif;color:#0f172a;letter-spacing:-.3px}
.fm p{margin:0 0 16px;font:500 14px/1.4 'Inter',sans-serif;color:#64748b}
.fm .tabs{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap}
.fm .tab{height:34px;padding:0 15px;border:1px solid #e2e8f0;border-radius:17px;background:#fff;font:600 13px/1 'Inter',sans-serif;color:#334155;cursor:pointer}
.fm .tab.on{border-color:#16b364;background:#effbf4;color:#0b7a43}
.fm video{display:block;width:100%;aspect-ratio:16/9;border-radius:12px;background:#0f172a}
.fm .row{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:12px;flex-wrap:wrap;font:500 13px/1.4 'Inter',sans-serif;color:#64748b}
.fm .row a{color:#0b7a43;font-weight:600;text-decoration:none}
.fm .x{position:absolute;right:14px;top:14px;width:34px;height:34px;border:1px solid #e2e8f0;border-radius:17px;background:#fff;font:600 18px/1 'Inter',sans-serif;color:#334155;cursor:pointer}
#app canvas.drag{cursor:grabbing}`;

runSim({duration: 3600, fps: 60, theme: 'light', hud: {enabled: false, title: 'watch-site', subtitle: ''}, director: {enabled: false}, watermark: ''}, async ({canvas, capture}) => {
  const {w, st, holder, C, A, ui, labels, resize, frame} = makeWatchScene({canvas, capture, pills: PILLS});
  const CAM = makeCams({...A, asm: 99});
  // ---------------------------------------------------------------- adaptive quality
  // The page starts with the film's full studio look and steps down a tier at a time while it runs under 24 fps
  // (measured over 1 s windows), never back up, so it settles instead of flickering between looks. On this project's
  // Intel UHD 600 the full look runs at ~2 fps and the last tier at ~20.
  let pr = 1;
  const doResize = () => {
    resize();
    if (pr !== 1) st.resize(1600, 900, Math.min(devicePixelRatio || 1, 2) * pr);
  };
  const cheapGlass = () => {
    for (const [m, op] of [[w.M.glass, 0.08], [w.M.sapphire, 0.06], [w.M.jade, 0.75]]) {
      m.transmission = 0;
      m.transparent = true;
      m.opacity = op;
      m.depthWrite = false;
      m.needsUpdate = true;
    }
  };
  const TIERS = [
    () => st.setQuality({ao: false}),
    () => st.setQuality({samples: 0, self: false, floor: 'quarter'}),
    cheapGlass,
    () => {
      pr = 0.75;
      doResize();
    },
  ];
  let tier = 0;
  let win = {t: performance.now(), n: 0};
  const adapt = () => {
    if (capture || tier >= TIERS.length) return;
    win.n++;
    const ms = performance.now() - win.t;
    if (ms < 1000) return;
    if ((win.n * 1000) / ms < 24) TIERS[tier++]();
    win = {t: performance.now(), n: 0};
  };

  // ---------------------------------------------------------------- what is open
  const clock = () => performance.now() / 1000;
  // each pill: when it opened, when it closed (OPEN, far in the future, while open: never Infinity, whose
  // Infinity - Infinity in the easing is NaN and would send every part to NaN)
  const OPEN = 1e9;
  const S = Object.fromEntries([...ACTS, 'exploded'].map((k) => [k, {t0: -99, t1: -98}]));
  let sel = null;
  let turnFrom = 0;
  const openOf = (k, now) => ss(S[k].t0 + 0.1, S[k].t0 + 1.1, now) * (1 - ss(S[k].t1, S[k].t1 + 0.5, now));
  const explodeOf = (now) => ss(S.exploded.t0 + 0.1, S.exploded.t0 + 1.5, now) * (1 - ss(S.exploded.t1, S.exploded.t1 + 1.0, now));
  const turnOf = (now) => {
    const e = S.exploded;
    // 22°/s, eased in over the first second
    const spin = (t) => {
      const x = Math.max(0, t - e.t0 - 0.3);
      return x < 1 ? 11 * x * x : 22 * (x - 0.5);
    };
    if (now < e.t1) return spin(now);
    // after it closes the turntable eases to the nearest whole turn, so the watch lands in its hero pose
    const a0 = spin(e.t1);
    return a0 + (Math.round(a0 / 360) * 360 - a0) * ss(e.t1, e.t1 + 1.4, now);
  };
  const press = (k) => {
    const now = clock();
    const prev = sel;
    if (prev) S[prev].t1 = now;
    if (k === 'hero' || k === prev) {
      sel = null;
      if (k === 'hero') view.reset();
      return;
    }
    // a new part waits for the last one to close, so two never move through each other
    const wait = prev ? (prev === 'exploded' ? 1.0 : 0.5) : 0;
    S[k] = {t0: now + wait, t1: OPEN};
    sel = k;
  };
  for (const [k, el] of Object.entries(ui.pills)) el.addEventListener('click', () => press(k));
  addEventListener('keydown', (e) => {
    if (films.open) {
      if (e.key === 'Escape') films.close();
      return;
    }
    const k = {1: 'crystal_dial', 2: 'escapement', 3: 'case_flank', 4: 'crown_winding', e: 'exploded', h: 'hero'}[e.key.toLowerCase()];
    if (k) press(k);
  });

  // ---------------------------------------------------------------- the visitor's camera on top of the act's
  const view = {
    az: 0,
    el: 0,
    zoom: 1,
    reset() {
      this.az = 0;
      this.el = 0;
      this.zoom = 1;
    },
  };
  let drag = null;
  canvas.style.pointerEvents = 'auto';
  canvas.addEventListener('pointerdown', (e) => {
    drag = {x: e.clientX, y: e.clientY};
    canvas.classList.add('drag');
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    view.az -= (e.clientX - drag.x) * 0.3;
    view.el = Math.max(-25, Math.min(45, view.el + (e.clientY - drag.y) * 0.2));
    drag = {x: e.clientX, y: e.clientY};
  });
  const end = () => {
    drag = null;
    canvas.classList.remove('drag');
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    view.zoom = Math.max(0.55, Math.min(1.7, view.zoom * Math.exp(e.deltaY * 0.0012)));
  }, {passive: false});
  canvas.addEventListener('dblclick', () => view.reset());

  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const hint = document.createElement('div');
  hint.className = 'hint';
  hint.textContent = 'Press a part to open it · drag to turn · scroll to zoom · double-click to reset';
  ui.root.appendChild(hint);

  // ---------------------------------------------------------------- the films
  const FILMS = [
    {k: 'film', name: 'Full film', src: 'videos/watch-film.mp4', poster: 'videos/watch-film.jpg', note: '21 s · every part opened under its own camera, the teardown, the hero view · with sound'},
    {k: 'demo', name: '10-second short', src: 'videos/watch-demo.mp4', poster: 'videos/watch-demo.jpg', note: '10 s · the escapement, the teardown and back · with sound'},
  ];
  const films = (() => {
    const btn = document.createElement('div');
    btn.className = 'films';
    btn.innerHTML = '<i></i>Films';
    ui.root.appendChild(btn);
    const fm = document.createElement('div');
    fm.className = 'fm';
    fm.innerHTML = `<div class="box" role="dialog" aria-label="Films"><button class="x" aria-label="Close">×</button>
      <h2>The watch on film</h2><p>Rendered frame by frame from this page's code, with a score built on the same timeline.</p>
      <div class="tabs">${FILMS.map((f) => `<button class="tab" data-f="${f.k}">${f.name}</button>`).join('')}</div>
      <video controls playsinline preload="metadata"></video>
      <div class="row"><span class="note"></span><a class="dl" download>Download MP4</a></div></div>`;
    document.body.appendChild(fm);
    const video = fm.querySelector('video');
    const pick = (k) => {
      const f = FILMS.find((x) => x.k === k);
      fm.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.f === k));
      video.pause();
      video.poster = f.poster;
      video.src = f.src;
      fm.querySelector('.note').textContent = f.note;
      fm.querySelector('.dl').href = f.src;
    };
    const api = {
      open: false,
      show() {
        api.open = true;
        fm.classList.add('on');
        if (!video.src) pick('film');
      },
      close() {
        api.open = false;
        video.pause();
        fm.classList.remove('on');
      },
    };
    btn.addEventListener('click', () => api.show());
    fm.querySelector('.x').addEventListener('click', () => api.close());
    fm.addEventListener('click', (e) => e.target === fm && api.close());
    fm.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => pick(t.dataset.f)));
    return api;
  })();

  // the camera eases toward its target every frame (a live page may carry state between frames)
  let cam = null;
  let last = clock();
  const T_LOAD = clock();
  window.WATCH = {w, st, holder, press, view, S, tier: () => tier};

  return {
    resize: doResize,
    render() {
      // the player has the screen: leave the last 3D frame up and give the GPU to the video
      if (films.open) {
        // and restart the frame-rate window, so the paused time doesn't read as a slow frame
        win = {t: performance.now(), n: 0};
        return {};
      }
      adapt();
      const now = clock();
      const dt = Math.min(0.1, now - last);
      last = now;
      const ex = explodeOf(now);
      const open = {};
      for (const a of ACTS) {
        const o = openOf(a, now);
        for (const [k, v] of Object.entries(OPENS[a])) open[k] = Math.max(open[k] ?? 0, v * o);
      }
      // the crown keeps winding while it hangs out
      const cw = S.crown_winding;
      const wind = 1.4 * Math.max(0, Math.min(now, cw.t1) - cw.t0 - 1.0);
      w.pose({t: now - T_LOAD, wind, open, explode: ex});
      holder.rotation.y = turnOf(now) * D2R;
      holder.position.set(C.x, C.y + 1.1 * ex, C.z);

      // the target: the open part's own camera (held once it has pushed in), else the hero view
      const live = sel && now >= S[sel].t0 ? sel : null;
      const u = live ? Math.min(3.2, now - S[live].t0) : 0;
      const o = live === 'exploded' ? CAM.exploded(Math.min(2.8, u)) : live ? CAM[live](u) : CAM.hero(3.4);
      const tgt = {az: o[0] + view.az, el: Math.max(2, Math.min(80, o[1] + view.el)), d: o[2] * view.zoom, tx: o[3], ty: o[4], tz: o[5], sy: o[6] ?? 0};
      if (!cam) cam = {...tgt};
      const k = 1 - Math.exp(-dt * 3.2);
      const dAz = ((tgt.az - cam.az + 540) % 360) - 180;
      cam.az += dAz * k;
      for (const key of ['el', 'd', 'tx', 'ty', 'tz', 'sy']) cam[key] += (tgt[key] - cam[key]) * k;
      const act = sel ?? null;
      const ao = act === 'exploded' ? ex : act ? openOf(act, now) : 0;
      frame(cam, 0.45 + 0.55 * Math.min(1, ex * 2.5 + ao));

      // the page: cards, status, labels for the open part
      const wave = [];
      for (let i = 0; i <= 90; i++) wave.push(Math.sin(2 * Math.PI * 4 * (now - 1 + i / 90)));
      const free = ex > 0.04;
      const wheels = [0.32, 0.46, 0.58, 0.7, 0.86, 0.95].map((b, i) => (free ? 0.04 : Math.max(0, Math.min(1, b + 0.05 * Math.sin(now * 8 * Math.PI + i * 1.3)))));
      const reserve = Math.min(1, 0.71 + 0.02 * wind);
      ui.update({
        time: (now - T_LOAD) % 60,
        dur: 1e9,
        status: act && ao > 0.05 ? NAME[act] : 'Running',
        cards: [{v: '4.0', wave}, {v: Math.round(reserve * 100), bar: reserve}, {bars: wheels}, {v: free ? '—' : Math.round(272 + 6 * Math.sin(now * 0.7)), bar: free ? 0 : 0.82 + 0.02 * Math.sin(now * 0.7)}],
        apart: Math.round(ao * 100),
        view: act ?? 'overview',
        callouts: labels(act ? {set: LABELS[act], o: ss(0.5, 0.9, ao)} : {set: [], o: 0}),
        cursor: null,
      });
      return {};
    },
  };
});

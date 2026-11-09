// The mechanical watch on the green page, shared by the film (watch-film) and the 10-second short (watch-demo), made
// 2026-11-08: the piranha's approved tour ported
// beat for beat (../watch-shared/tour.js) with the watch of round 2 of its still (../watch-shared/watch.js), posed as the
// still was (out/r2/cam.json: lean x 75 / z 15, roll -25 about the hero line). The watch rests on the floor with its
// movement running; each button opens one part under its own camera; the explode spins it once on a turntable.
// render(t) is a pure function of film time.
import * as THREE from 'three';
import {runSim} from 'cutaway-kit/runtime.js';
import {createConsole} from 'cutaway-kit/../green/console.js';
import {makeCursor, makeLabels, PAPER_GREEN, SHIFT} from 'cutaway-kit/../green/look.js';
import {buildWatch} from './watch.js';
import {createStage, PAPER} from './stage.js';
import {makeTour} from './tour.js';

const D2R = Math.PI / 180;
Object.assign(PAPER, PAPER_GREEN);

// the still's pose and hero camera (round 2)
const LEAN = {x: 75, y: 0, z: 15};
const ROLL = -25;
const HERO = {az: 50, el: 30, d: 12.2};

export const ACTS_UI = [['crystal_dial', 'Dial'], ['escapement', 'Escapement'], ['case_flank', 'Movement'], ['crown_winding', 'Crown'], ['exploded', 'Teardown'], ['hero', 'Hero']];
const PAGE = {
  name: 'Verdant',
  code: 'MW-1',
  title: 'Mechanical Watch, Taken Apart',
  date: '2026-11-8',
  sub: {
    overview: ['Skeleton movement, 4 Hz', 'White ceramic, green accents'],
    crystal_dial: ['Sapphire crystal lifts off', 'Hands and chapter ring rise'],
    escapement: ['Balance at 4 Hz, ±220°', 'Escape wheel, 15 teeth'],
    case_flank: ['Movement lifts out', '3 chrome pistons a side'],
    crown_winding: ['Crown draws out', 'Winds 3 turns, ratchet steps'],
    exploded: ['Every part apart', 'Turntable 360°'],
    hero: ['Back together', 'Running'],
  },
  cards: [{k: 'Balance', kind: 'wave', unit: 'Hz'}, {k: 'Power reserve', kind: 'bar', unit: '%'}, {k: 'Wheel train', kind: 'bars', n: 6}, {k: 'Amplitude', kind: 'bar', unit: '°'}],
};

/** The watch in its still pose on the green page: the holder (the turntable's pivot), the stage, the cameras' rest
 *  points A, the page with the given pills, labels, resize. Shared by the films and the interactive page. */
export function makeWatchScene({canvas, capture, pills, layout}) {
  const app = document.getElementById('app');
  const w = buildWatch();
  w.pose({t: 0});
  // the rest pose: lean, then roll about the level line toward the hero camera
  const base = new THREE.Quaternion().setFromEuler(new THREE.Euler(LEAN.x * D2R, LEAN.y * D2R, LEAN.z * D2R));
  base.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(Math.sin(HERO.az * D2R), 0, Math.cos(HERO.az * D2R)), ROLL * D2R));
  w.root.quaternion.copy(base);
  w.root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(w.root);
  const C = box.getCenter(new THREE.Vector3());
  // the holder turns about the watch's middle (the turntable) and lifts it while it is apart
  const holder = new THREE.Group();
  holder.position.copy(C);
  w.root.position.sub(C);
  holder.add(w.root);
  holder.updateMatrixWorld(true);
  const st = createStage({canvas, floorY: box.min.y, span: 3.6});
  st.addBody({root: holder, clear: w.clear, M: w.M});
  // the watch's axes and parts in the world at rest, for the cameras
  const ax = (x, y, z) => new THREE.Vector3(x, y, z).applyQuaternion(base).toArray();
  const wp = (k) => w.anchors[k].obj.localToWorld(w.anchors[k].at.clone()).toArray();
  const A = {
    C: C.toArray(),
    N: ax(0, 1, 0),
    X: ax(1, 0, 0),
    Z: ax(0, 0, -1),
    heroDir: [Math.cos(HERO.el * D2R) * Math.sin(HERO.az * D2R), Math.sin(HERO.el * D2R), Math.cos(HERO.el * D2R) * Math.cos(HERO.az * D2R)],
    D0: HERO.d,
    dial: wp('dialFace'),
    esc: wp('balance'),
    crown: wp('crown'),
  };
  const used = new Set(pills);
  const acts = ACTS_UI.filter(([k]) => used.has(k));
  const ui = createConsole(app, {...PAGE, nav: [['overview', 'Overview'], ...acts], pills: acts});
  const labels = makeLabels(st, w.anchors);
  // The page's layout: the film's fixed 1600 x 900 page scaled to fit, unless layout() (the site on a small screen)
  // returns its own: {w, h} the page in CSS px, scale, the screen shift sx/sy that centres the watch, k the camera
  // distance factor and f the size of the watch on screen relative to the 1600 x 900 page.
  const FILM_LAYOUT = () => ({w: 1600, h: 900, scale: Math.min(innerWidth / 1600, innerHeight / 900), sx: SHIFT[0], sy: SHIFT[1] - 24, k: 1, f: 1});
  const L = FILM_LAYOUT();
  const resize = (prk = 1) => {
    Object.assign(L, layout?.() ?? FILM_LAYOUT());
    app.style.transform = `scale(${L.scale})`;
    st.resize(L.w, L.h, (capture ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, 2)) * prk);
  };
  resize();
  /** Draw the camera c = {az, el (degrees), d, tx, ty, tz, sy} into the page's 3D window. */
  const frame = (c, guides) => st.frame({...c, d: c.d * L.k, az: c.az * D2R, el: c.el * D2R, sx: L.sx, sy: L.sy + (c.sy ?? 0) * L.f}, {guides});
  return {app, w, st, holder, C, A, ui, labels, resize, frame, HERO};
}

// TL.film (seconds of film) shorter than TL.duration (seconds of scene) plays the scene faster, as the piranha's demo
export const runWatchFilm = (TL, title = 'watch-film') => {
  const FILM = TL.film ?? TL.duration;
  const SPEED = TL.duration / FILM;
  return runSim({duration: FILM, fps: 60, theme: 'light', hud: {enabled: false, title, subtitle: ''}, director: {enabled: false}, watermark: ''}, async ({canvas, capture}) => {
    const {w, st, holder, C, A, ui, labels, resize, frame} = makeWatchScene({canvas, capture, pills: TL.pills});
    const T = makeTour(TL, A);
    const cursorAt = makeCursor(ui, T.SCRIPT);
    window.WATCH = {w, st, T, A, holder};
    return {
      resize,
      render(tf) {
        const t = tf * SPEED;
        const s = T.stateAt(t);
        w.pose({t, wind: s.wind, open: s.open, explode: s.explode});
        holder.rotation.y = s.turn * D2R;
        holder.position.set(C.x, C.y + s.lift, C.z);
        frame(s.cam, s.guides);
        const tel = T.telemetry(t, s);
        ui.update({
          time: tf,
          dur: FILM,
          status: tel.status,
          cards: tel.cards,
          apart: tel.apart,
          view: s.view === 'intro' ? 'overview' : s.view,
          callouts: labels(tel.labelSet),
          cursor: cursorAt(t),
        });
        return {};
      },
    };
  });
};

// The mechanical watch's film as functions of time, ported 1:1 from the piranha's tour (cutaway sims/piranha-shared/
// tour_bee.js): the same beat times in the same order, each act's own clock (open, hold, close), the same push-ins and
// blends between views, the explode with a turntable and the fast reassembly. Only the body changes: the watch does not
// swim, it rests on the floor in the still's hero pose with its movement running, and the piranha's lunge becomes the
// watch settling back into the hero view.
// The acts map beat for beat: optics -> crystal_dial (the crystal lifts, the hands and chapter rise off the movement),
// leg -> escapement (the regulating organ rises with its bridges, the balance beating at 4 Hz), thorax -> case_flank
// (the movement lifts out of the case between the flank pistons), abdomen -> crown_winding (the crown draws out and
// winds, the ratchet stepping).
// Cameras follow the brief: every beat its own camera, aimed at its part from its own side, height and distance, and
// pushing in while the part hangs open. Directions are worked out from the watch's own axes in the world (the dial
// normal N, the crown axis X, the 12 o'clock axis Z), so each close-up looks at its part, not at a guessed angle.
// Script: {duration, script: [{t, act}]}. Everything is a pure function of film time t.
import * as THREE from 'three';

const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const ss = (a, b, t) => smoother((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const R2D = 180 / Math.PI;

export const ACTS = ['crystal_dial', 'escapement', 'case_flank', 'crown_winding'];
// each act's own clock (seconds after its button), the piranha's
const ACT = {
  crystal_dial: {open: [0.35, 1.5], close: [2.2, 2.65]},
  escapement: {open: [0.35, 1.45], close: [2.15, 2.55]},
  case_flank: {open: [0.3, 1.4], close: [2.1, 2.6]},
  crown_winding: {open: [0.3, 1.3], close: [2.0, 2.45]},
};
// how far each part travels in each act, as a share of its explode direction (watch.js stacks them so nothing passes
// through anything: escapement < bridges < chapter < hands < crystal)
export const OPENS = {
  crystal_dial: {crystal: 0.6, hands: 0.55, chapter: 0.3},
  escapement: {crystal: 0.6, hands: 1, chapter: 1, bridges: 1, escapement: 1},
  case_flank: {crystal: 0.6, bezel: 0.45, dial: 1},
  crown_winding: {crown: 0.28},
};
// the crown winds 3 turns while it hangs out
const WIND = [1.25, 2.0];

// label sets per act: [anchor, NAME, NOTE]
export const LABELS = {
  crystal_dial: [['crystal', 'SAPPHIRE CRYSTAL', 'DOMED · LIFTS OFF'], ['hands', 'HANDS', 'SKELETON · GREEN LUME'], ['chapter', 'CHAPTER RING', '12 INDICES · 60 TICKS']],
  escapement: [['balance', 'BALANCE WHEEL', '4 HZ · ±220°'], ['bridges', 'BRIDGES', '11 ARMS · JEWELLED'], ['escWheel', 'ESCAPE WHEEL', '15 TEETH · 12° A BEAT']],
  case_flank: [['movement', 'MOVEMENT', 'LIFTED OUT'], ['piston', 'FLANK PISTONS', '3 PER SIDE · CHROME'], ['bezel', 'BEZEL', 'GREEN RIM · 6 SCREWS']],
  crown_winding: [['crown', 'CROWN', 'KNURLED · GREEN RING'], ['crown2', 'SECOND CROWN', 'SETTING'], ['barrel', 'MAINSPRING BARREL', 'RATCHET STEPS']],
  exploded: [['crystal', 'CRYSTAL', 'SAPPHIRE'], ['hands', 'HANDS', ''], ['balance', 'BALANCE', '4 HZ'], ['crown', 'CROWN', 'WINDING STEM'], ['link4', 'BRACELET', '18 LINKS']],
};
/** A world direction to [az, el] in degrees, the stage's convention (az from +z toward +x). */
const azEl = (v) => {
  const n = v.clone().normalize();
  return [Math.atan2(n.x, n.z) * R2D, Math.asin(Math.max(-1, Math.min(1, n.y))) * R2D];
};

// ------------------------------------------------------------ cameras: [az, el, d, tx, ty, tz], u = seconds into the act
// A: the watch's rest pose in the world: C (its middle), N, X, Z (its axes), the parts' points, H (the hero camera).
export function makeCams(A) {
  const V = (a) => new THREE.Vector3(...a);
  const N = V(A.N);
  const X = V(A.X);
  const Z = V(A.Z);
  const hero = V(A.heroDir);
  const C = A.C;
  const add = (p, v, k = 1) => [p[0] + v.x * k, p[1] + v.y * k, p[2] + v.z * k];
  const push = (a, b, u) => lerp(a, b, ss(0, 2.5, u));
  const D0 = A.D0;
  // each close-up: a direction made of the watch's axes, a drift in az (so a hold never parks), a push-in
  // sy: an extra screen drop in px, for the close-ups whose case would otherwise ride up under the title
  const view = (dir, drift, d0, d1, target, sy = 0) => {
    const [az, el] = azEl(dir);
    return (u) => [az + drift * u, Math.max(6, Math.min(72, el)), push(d0, d1, u), ...target, sy];
  };
  // the dial and hands: close macro from above at an angle, over the lifting crystal
  const dial = add(A.dial, N, 0.45);
  const vDial = view(N.clone().multiplyScalar(1.1).addScaledVector(hero, 0.7), 7, 8.8, 7.4, dial);
  // the escapement: extreme macro over the 7 o'clock side, from the 6 o'clock edge, steeper
  const esc = add(A.esc, N, 0.95);
  const vEsc = view(N.clone().multiplyScalar(0.9).addScaledVector(Z, 0.45).addScaledVector(hero, 0.8), -6, 9.0, 7.6, esc, 70);
  // the gear train and flank: a close three-quarter view through the open case from the crown side, low
  const flank = add(add(A.dial, N, 0.1), X, 0.55);
  const vFlank = view(X.clone().multiplyScalar(1.0).addScaledVector(N, 0.45).addScaledVector(Z, -0.35).addScaledVector(hero, 0.2), 9, 9.2, 7.8, flank);
  // the crown: a side macro down its axis, a little from the 12 o'clock side to see the winding stem
  const crown = add(A.crown, X, 0.25);
  const vCrown = view(X.clone().multiplyScalar(1.0).addScaledVector(Z, -0.55).addScaledVector(N, 0.3), -8, 7.4, 6.4, crown, 60);
  const [hAz, hEl] = azEl(hero);
  return {
    // frame 0 is the still's hero view, drifting a few degrees and settling in
    intro: (u) => [hAz - 6 + 6 * ss(0, 3, u), hEl + 2 - 2 * ss(0, 3, u), lerp(D0 * 1.06, D0, ss(0, 3, u)), ...C, 0],
    crystal_dial: vDial,
    escapement: vEsc,
    case_flank: vFlank,
    crown_winding: vCrown,
    // the explode: while the parts fly the camera swings 40° round and drops low to look along the stack, then
    // through the reassembly swings back onto the hero side, rises and pushes in
    exploded: (u) => {
      const go = ss(0.3, 2.8, u);
      const back = ss(A.asm, A.asm + 1.5, u);
      return [hAz + 40 * go - 40 * back, lerp(hEl, 12, go) + (hEl - 12) * back, lerp(lerp(D0 * 1.15, D0 * 1.7, go), D0, ss(A.asm + 0.1, A.asm + 1.2, u)), ...add(C, N, 1.3 * go * (1 - back)), 0];
    },
    hero: (u) => [hAz - 7 + 7 * ss(0, 3.4, u), hEl + 3 - 3 * ss(0, 3.4, u), D0 * lerp(1.03, 1, ss(0, 3.4, u)), ...C, 0],
  };
}

export function makeTour(TL, A) {
  const SCRIPT = [...TL.script].sort((a, b) => a.t - b.t);
  const DURATION = TL.duration;
  const AT = {};
  for (const e of SCRIPT) (AT[e.act] ??= []).push(e.t);
  const at = (act) => AT[act] ?? [];
  const T_EXP = at('exploded')[0] ?? 999;
  const T_ASM = at('assemble')[0] ?? 999;
  const T_END = at('hero')[0] ?? 999;
  const CAM = makeCams({...A, asm: T_ASM - T_EXP});
  const win = (W, t0, t) => ss(t0 + W.open[0], t0 + W.open[1], t) * (1 - ss(t0 + W.close[0], t0 + W.close[1], t));
  const openOf = (act, t) => Math.max(0, ...at(act).map((t0) => win(ACT[act], t0, t)));
  // the full explode: out 0.2-1.8 s after EXPLODED, home 0-1.0 s after ASSEMBLE (fast, it snaps)
  const explodeAt = (t) => ss(T_EXP + 0.2, T_EXP + 1.8, t) * (1 - ss(T_ASM, T_ASM + 1.0, t));
  // the turntable: a full turn from the explode to just after the watch is whole again, eased at both ends
  const TT = [T_EXP + 0.2, T_ASM + 1.5];
  const turnAt = (t) => {
    const [a, b] = TT;
    if (t <= a) return 0;
    const R = 0.6;
    const span = b - a;
    const v = 360 / (span - R);
    const x = Math.min(t, b) - a;
    if (x < R) return (v * x * x) / (2 * R);
    if (x < span - R) return v * (x - R / 2);
    const y = x - (span - R);
    return v * (span - 1.5 * R) + v * y - (v * y * y) / (2 * R);
  };
  const windAt = (t) => Math.max(0, ...at('crown_winding').map((t0) => 3 * ss(t0 + WIND[0], t0 + WIND[1], t)));

  // the camera: each act's view, blended over 0.85 s with a short dolly out (the piranha's)
  const VIEWS = [{t: -1, key: 'intro'}, ...SCRIPT.map((e) => ({t: e.t, key: e.act === 'assemble' ? 'exploded' : e.act}))];
  const viewIdx = (t) => {
    let i = 0;
    while (i < VIEWS.length - 1 && VIEWS[i + 1].t <= t) i++;
    return i;
  };
  const camFn = (V, t) => CAM[V.key](t - (V.key === 'intro' ? 0 : V.t));
  const runOf = (j) => {
    while (j > 0 && VIEWS[j].key === 'exploded' && VIEWS[j - 1].key === 'exploded') j--;
    return VIEWS[j];
  };
  const camAt = (t) => {
    const i = viewIdx(t);
    let o = camFn(runOf(i), t);
    if (i > 0 && runOf(i) === VIEWS[i]) {
      const k = ss(VIEWS[i].t, VIEWS[i].t + 0.85, t);
      if (k < 1) {
        const a = camFn(runOf(i - 1), t);
        const dAz = ((o[0] - a[0] + 540) % 360) - 180;
        const b = o.map((v, j) => lerp(a[j], v, k));
        b[0] = a[0] + dAz * k;
        b[2] += 0.9 * Math.sin(Math.PI * k);
        o = b;
      }
    }
    return {az: o[0], el: o[1], d: o[2], tx: o[3], ty: o[4], tz: o[5], sy: o[6] ?? 0};
  };
  const viewAt = (t) => VIEWS[viewIdx(t)].key;

  const stateAt = (t) => {
    const ex = explodeAt(t);
    const acts = Object.fromEntries(ACTS.map((a) => [a, openOf(a, t)]));
    const open = {};
    for (const a of ACTS) for (const [k, v] of Object.entries(OPENS[a])) open[k] = Math.max(open[k] ?? 0, v * acts[a]);
    const view = viewAt(t);
    const activity = Math.max(ex, ...Object.values(acts));
    return {t, explode: ex, open, acts, wind: windAt(t), turn: turnAt(t), lift: 1.1 * ex, cam: camAt(t), view, guides: 0.45 + 0.55 * Math.min(1, ex * 2.5 + activity)};
  };

  // labels: only while a part hangs open (LABELS, module level, shared with the interactive page)

  const labelAt = (t, s) => {
    const v = s.view;
    if (ACT[v]) {
      const t0 = at(v).filter((x) => x <= t).pop();
      const W = ACT[v];
      return {set: LABELS[v], o: ss(t0 + W.open[0] + 0.1, t0 + W.open[0] + 0.45, t) * (1 - ss(t0 + W.close[0] - 0.25, t0 + W.close[0], t))};
    }
    if (v === 'exploded') return {set: LABELS.exploded, o: ss(T_EXP + 0.6, T_EXP + 1.0, t) * (1 - ss(T_EXP + 2.5, T_EXP + 2.8, t))};
    return {set: [], o: 0};
  };

  const NAME = {crystal_dial: 'Crystal off', escapement: 'Escapement out', case_flank: 'Movement lifted', crown_winding: 'Winding'};
  const telemetry = (t, s) => {
    // the balance's swing over the last second (4 beats of 2), the train's wheels as load bars
    const wave = [];
    for (let i = 0; i <= 90; i++) wave.push(Math.sin(2 * Math.PI * 4 * (t - 1 + i / 90)));
    const free = s.explode > 0.04;
    const wheels = [0.32, 0.46, 0.58, 0.7, 0.86, 0.95].map((b, i) => (free ? 0.04 : Math.max(0, Math.min(1, b + 0.05 * Math.sin(t * 8 * Math.PI + i * 1.3)))));
    const reserve = Math.min(1, 0.71 + 0.06 * s.wind / 3);
    let status = 'Running';
    const v = s.view;
    if (ACT[v] && s.acts[v] > 0.05) status = NAME[v];
    if (v === 'exploded') status = t < T_ASM ? 'Teardown' : s.explode > 0.04 ? 'Reassembly' : 'Running';
    if (t > T_END) status = 'Running';
    const apart = ACT[v] ? s.acts[v] : s.explode;
    return {
      status,
      cards: [{v: '4.0', wave}, {v: Math.round(reserve * 100), bar: reserve}, {bars: wheels}, {v: free ? '—' : Math.round(272 + 6 * Math.sin(t * 0.7)), bar: free ? 0 : 0.82 + 0.02 * Math.sin(t * 0.7)}],
      apart: Math.round(apart * 100),
      labelSet: labelAt(t, s),
    };
  };

  return {SCRIPT, DURATION, stateAt, telemetry, camAt};
}

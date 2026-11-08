// The still loop's entry: the watch alone in the near-white studio, posed and framed like the reference.
// A capture --config may override the camera: {"cam": {"az": .., "el": .., "d": .., "tx": .., "ty": .., "tz": ..}}.
import * as THREE from 'three';
import {runSim} from 'cutaway-kit/runtime.js';
import {buildWatch} from '../watch-shared/watch.js';
import {createStage, PAPER} from '../watch-shared/stage.js';

Object.assign(PAPER, {top: '#ffffff', mid: '#fdfdfd', low: '#f4f4f3', shadow: '#b9bbb8'});

// the hero camera: front three-quarter from the crown side, slightly above
export const HERO = {az: 80, el: 30, d: 11.5, sx: 0, sy: 0};
// the watch leans a little on its bracelet, as in the picture
export const LEAN = {x: 45, y: 0, z: 0};

runSim({duration: 20, fps: 60, theme: 'light', hud: {enabled: false, title: 'watch-still', subtitle: ''}, director: {enabled: false}}, async ({cfg, canvas, capture}) => {
  const w = buildWatch();
  Object.assign(LEAN, cfg.lean || {});
  w.pose({t: 0});
  const D2R = Math.PI / 180;
  w.root.rotation.set(LEAN.x * D2R, LEAN.y * D2R, LEAN.z * D2R);
  // roll: turn the watch about the level line toward the camera, so its 12-6 axis runs diagonally across the frame
  const camAz = ((cfg.cam && cfg.cam.az) ?? HERO.az) * D2R;
  if (cfg.roll) w.root.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(Math.sin(camAz), 0, Math.cos(camAz)), cfg.roll * D2R));
  w.root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(w.root);
  const st = createStage({canvas, floorY: box.min.y, span: 3.4});
  st.addBody(w);
  window.WATCH = {w, st, box, small: w.small()};
  const resize = () => st.resize(1600, 900, capture ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, 2));
  resize();
  // aim at the middle of the watch's box; the config may nudge the target
  const ctr = box.getCenter(new THREE.Vector3());
  const cam = {...HERO, tx: ctr.x, ty: ctr.y, tz: ctr.z, ...(cfg.cam || {})};
  return {
    resize,
    render(t) {
      w.pose({t});
      st.frame({...cam, az: cam.az * D2R, el: cam.el * D2R}, {guides: 0});
      return {};
    },
  };
});

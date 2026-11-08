// The mechanical watch's 10-second short (2026-11-08), its own script on the piranha demo's beats: the hero view, the
// escapement rising with the balance beating at 4 Hz, the explode on its turntable, the reassembly and the hero view
// again. 11.2 s of scene played at 1.12x. Code: ../watch-shared/sim.js.
import {runWatchFilm} from '../watch-shared/sim.js';
import TL from './timeline.json';

runWatchFilm(TL, 'watch-demo');

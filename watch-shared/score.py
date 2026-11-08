"""Score for the mechanical watch's film (entry watch-film, tour.js), built like the piranha's (cutaway
sims/piranha-shared/score.py): a bed in A minor (Am9, Fmaj7, Cmaj7, G6 at 92 bpm: e-piano, bass, soft drums and a pad on
the same changes) at one level the whole way, a quiet click on every button press, and for every act short quiet
accents on its own moves: a lift of air and thread ticks as the crystal comes off and seats again, a short run of
escapement ticks at the balance's 8 beats a second while the regulating organ hangs open, a cascade of clicks and
three rising blips as the movement lifts out of the case and a seat click as it drops back, a ratchet run as the crown
winds 3 turns and a click as it pushes home, a whoosh into the explode and three clicks as the watch seats again, a
soft air into the hero view. No drones; the running movement itself stays silent.

    TL=watch-film/timeline.json OUT=out/watch-score.wav python run_sfx.py watch-shared/score.py

Every cue comes from the script in the timeline, with the offsets inside each act taken from tour.js (the ACT clocks,
WIND 1.25-2.0 s, the explode out 0.2-1.8 s and home 0-1.0 s).
"""

import os

from sfx.score_kit import airy, bed, chords, hz, thud  # noqa: E402
from sfx.synth import blip, click, envelope, pad  # noqa: E402

TIMELINE = os.environ.get("TL", "../watch-film/timeline.json")
OUT = os.environ.get("OUT", os.path.join(os.environ.get("CUTAWAY_OUT", "out"), "watch-score.wav"))
TARGET_LUFS = -14.0
SEED = 1108

CHORDS = chords("Am9:A2 C3 E3 G3 B3/A1", "Fmaj7:F2 A2 C3 E3 A3/F1", "Cmaj7:C3 E3 G3 B3 E4/C2", "G6:G2 B2 D3 E3 B3/G1")
MOTIF = [(0.5, hz("E5")), (1.5, hz("C5")), (2.5, hz("B4"))]
WIND = (1.25, 2.0)


def seat(mix, t, level=0.055, pan=0.0):
    """A part dropping home: a short click on a soft low knock."""
    mix.put(t, click(1700, 0.03), level, pan=pan)
    mix.put(t, thud(120, 0.06, 0.25), level * 0.45, pan=pan)


def score(mix, tl):
    dur = tl["duration"]
    left, right, low, drums = bed(dur, 92, CHORDS, MOTIF, motif_voice="blip", kicks=(0, 2.5), snares=(1, 3), hats=8, swing=0.08, keys_vel=0.75, keys_lp=3600)
    mix.put_stereo(0, left, right, 0.13)
    mix.put(0, low, 0.13)
    mix.put(0, drums, 0.05)
    bar = 4 * 60 / 92
    changes = [(0.12 + b * bar, [f for f in CHORDS[b % len(CHORDS)][0][:4]]) for b in range(int(dur / bar) + 1)]
    pl, pr = pad(dur, changes, volume=envelope([(0, 0), (1.0, 1), (dur - 1.6, 1), (dur, 0)]), detune=0.8, tremolo=0.18, xfade=0.5)
    mix.put_stereo(0, pl, pr, 0.07)

    for e in tl["script"]:
        t, act = e["t"], e["act"]
        # the button press
        mix.put(t, click(2400, 0.025), 0.055, pan=0.45)
        if act == "crystal_dial":
            mix.put(t + 0.35, airy(0.9, 900, 2600, 0.5), 0.016, pan=-0.15)
            for i, dt in enumerate((0.45, 0.6, 0.75, 0.9)):
                mix.put(t + dt, click(3100 - 160 * i, 0.018), 0.03, pan=-0.1)
            mix.put(t + 2.2, airy(0.45, 2200, 900, 0.5), 0.012, pan=-0.15)
            seat(mix, t + 2.62, 0.05, pan=-0.1)
        elif act == "escapement":
            mix.put(t + 0.35, airy(0.7, 800, 2200, 0.5), 0.012, pan=0.2)
            # the escapement's own beat, 8 a second, only while it hangs open
            k = 0
            while 0.9 + k / 8 < 2.05:
                tick = k % 2 == 0
                mix.put(t + 0.9 + k / 8, click(4200 if tick else 3600, 0.01), 0.022 if tick else 0.017, pan=0.25)
                k += 1
            seat(mix, t + 2.52, 0.045, pan=0.2)
        elif act == "case_flank":
            for i in range(5):
                mix.put(t + 0.3 + 0.07 * i, click(2300 - 90 * i, 0.022), 0.032, pan=0.1)
            for i, dt in enumerate((0.6, 0.85, 1.1)):
                mix.put(t + dt, blip(hz("E5") * 2 ** (i / 6), 0.18, 0.06), 0.016)
            mix.put(t + 2.1, airy(0.45, 1600, 800, 0.5), 0.011)
            seat(mix, t + 2.58, 0.055)
        elif act == "crown_winding":
            mix.put(t + 0.3, airy(0.5, 1200, 2000, 0.5), 0.012, pan=0.35)
            mix.put(t + 0.32, click(2000, 0.02), 0.03, pan=0.35)
            # the ratchet: 18 steps over the 3 turns, quiet and dry
            for j in range(18):
                mix.put(t + WIND[0] + (WIND[1] - WIND[0]) * j / 18, click(3800 + 40 * (j % 3), 0.008), 0.02, pan=0.4)
            seat(mix, t + 2.42, 0.05, pan=0.35)
        elif act == "exploded":
            mix.put(t + 0.2, airy(1.4, 450, 2400, 0.7), 0.032, pan=-0.15)
            mix.put(t + 0.25, blip(hz("E6"), 0.3, 0.1), 0.025)
        elif act == "assemble":
            mix.put(t, airy(1.0, 2200, 600, 0.5), 0.02, pan=0.15)
            for i, dt in enumerate((0.6, 0.8, 1.0)):
                mix.put(t + dt, click(2000 + 300 * i, 0.03), 0.05, pan=-0.3 + 0.3 * i)
            mix.put(t + 0.9, airy(0.6, 400, 1300, 0.6), 0.016)
        elif act == "hero":
            mix.put(t + 0.1, airy(1.6, 500, 1500, 0.5), 0.016, pan=0.2)
            mix.put(t + 0.4, blip(hz("A5"), 0.5, 0.2), 0.014)

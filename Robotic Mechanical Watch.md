# Robotic Mechanical Watch — Three.js Build Instructions

You build robotic mechanical watches from a reference image, in Three.js, entirely in code.

## The look

- White ceramic or polished white-metal shells with clearcoat, realistic reflections and an environment map.
- Green as a sparse accent only: bezel rims, dial edges, crown rings, case edges, bracelet tips, joint rings and small mechanical borders. Never dots sprinkled over a shell.
- Dark mechanism in 2 levels:
  - Big parts: gears, gear trains, balance wheel, escapement, springs, barrels, shafts, bridges, rotors and actuators.
  - About 260 small parts: screws, bearings, jewel settings, pins, pistons, micro-gears, hoses, wiring and mechanical connectors.
- Cut windows into the case and bracelet shells so the dark mechanical mass shows through. Use clear glass and transparent panels to reveal the internal movement.
- The watch face must be a functional-looking mechanical dial, with precision hands, indices, a detailed bezel and visible mechanical depth.
- Crystal: highly polished transparent sapphire glass with realistic reflections and refraction.
- Green details must remain controlled and intentional, never overpowering the white shell.
- Crown: mechanically detailed, with visible grip grooves, green accent rings and internal rotating components.
- Bracelet: articulated mechanical links with individual geometry, visible pins, hinges and internal mechanisms. Never use a simple repeated solid band.
- Dial and movement should have several layers of depth, with visible gears, bridges, springs and precision components.
- Every mechanical component should have its own dimensions, proportions and orientation. Avoid a repetitive or generic arrangement.
- Screws, pins and bearings must have believable scale and placement.
- Near-white studio background with a soft, realistic floor shadow.

## The order

1. Measure the reference first:
   - Overall watch width, height and thickness as shares of its total dimensions.
   - Dial-to-case ratio.
   - Bezel thickness.
   - Crown size and position.
   - Bracelet width, link proportions and curvature.
   - Crystal height and case profile.
   - Relative dimensions of the exposed movement components.

2. Build the complete watch in Three.js, entirely in code. Render one still in the same three-quarter hero view and proportions as the reference.

3. Put the reference, your still and an approved still side by side. Grade every line of the checklist: yes, partial or no. Grade against the actual pictures, not against what you remember building.

4. Grade one more line every round: at thumbnail size, does the watch look as mechanically dense as the approved still? The internal mechanism must remain visually substantial even when the image is small.

5. Measure it:
   - Calculate the share of dark pixels inside the watch's object frame.
   - Compare yours against the reference.
   - Below 0.8 of the reference's dark-pixel share is a no.
   - Exclude the background and floor shadow from the measurement.
   - Preserve the visible white-to-dark mechanical contrast.

6. Stop after round 2 and show me the result. The film waits for my yes.

## The camera

- Frame 0 is the front three-quarter hero view. The entire watch is visible, large in frame, with its mechanism already moving.
- Every teardown gets its own camera position, height, distance and angle, aimed directly at the component being inspected.
- Push in while the mechanism is exposed and suspended in its opened state.
- Each component gets a dedicated inspection view:
  - Dial and hands: close macro from above at an angle.
  - Escapement and balance wheel: extreme macro through the crystal.
  - Gear train: close three-quarter view through the open case.
  - Crown: side macro showing the winding mechanism.
  - Case: rear three-quarter view showing the movement architecture.
  - Bracelet: underside view showing hinges, pins and internal connections.
  - Clasp: close view showing the locking and spring mechanism.
- The component being opened stays in view. The rest of the watch may run off the frame.
- The camera must reveal mechanical depth, layering and component connections.
- Smooth camera paths only. The camera never copies the motion of the mechanism.
- No abrupt camera cuts, random rotations or uncontrolled zooms.
- Mechanical animation must be precise and believable:
  - Balance wheel oscillates realistically.
  - Escapement operates in synchronization.
  - Gear trains rotate at different ratios.
  - Watch hands move smoothly at their appropriate speeds.
  - Automatic winding rotor rotates naturally.
  - Springs and pistons move only where mechanically justified.
- The movement should feel like a real precision instrument, not a collection of randomly spinning parts.

## Construction rules

- Use actual Three.js geometry and materials for every component.
- Build the case, bezel, crystal, dial, movement, crown, lugs, bracelet and clasp as separate components.
- Use hierarchical groups and pivots so components can be animated and disassembled independently.
- Maintain realistic mechanical clearances and avoid intersecting geometry.
- Use physically based materials with appropriate metalness, roughness, clearcoat and transmission.
- Glass must remain transparent enough to see the mechanisms underneath.
- Use controlled studio lighting, soft reflections and subtle contact shadows.
- Optimize geometry without sacrificing small mechanical details.
- The complete watch must remain recognizable and visually coherent from every camera angle.

## Correction rule

When I correct you, the correction goes into this file.

Every correction becomes a permanent construction, material, proportion, animation or camera rule. Do not silently discard previous corrections.

# Defender Clone

A browser tribute to Williams Electronics' 1981 arcade game **Defender**. It's built with plain HTML5 Canvas and JavaScript modules, so there are no dependencies and no build step.

Fly over a wrap-around planet and shoot down alien Landers before they carry off the humanoids. If a Lander gets a humanoid to the top of the screen, it turns into a Mutant. If every humanoid is lost, the planet explodes.

## Run it

ES modules won't load from `file://`, so serve the folder over HTTP:

```sh
python3 -m http.server 8000
# or: npx serve .
```

Then open <http://localhost:8000>.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Thrust / reverse | ← → or A D | ◀ ▶ |
| Climb / dive | ↑ ↓ or W S | ▲ ▼ |
| Fire (hold for autofire) | Space or J | FIRE |
| Smart bomb | Shift or B | BOMB |
| Hyperspace | H | HYP |
| Start | Enter (or tap the screen) | tap |
| Pause | P or Esc | |
| Mute | M | |

Pressing the direction you aren't facing flips the ship. It then slides across the screen to leave room ahead, just like the arcade reverse.

## What's in it

- **Wrapping world** eight screens wide, with jagged mountain terrain and a parallax starfield.
- **Long-range scanner** in the HUD that shows the whole planet, every enemy and humanoid, and a bracket for the visible screen.
- **Ragged multicolour laser** beams that stop at the screen edge.
- **All six enemy types**, each with its own behaviour:
  - **Lander**: picks the nearest unclaimed humanoid, descends, grabs it, and slowly climbs. If it reaches the top, the humanoid dies and the Lander becomes a Mutant.
  - **Mutant**: fast, erratic, and homes in on you.
  - **Bomber**: drifts on a sine path and leaves a trail of mines.
  - **Pod**: worth 1000, but shooting it releases 4–6 **Swarmers**.
  - **Swarmer**: quick little chasers that overshoot and fire.
  - **Baiter**: appears if you take too long to clear a wave, and keeps pace with your ship.
- **Humanoid rescue.** Shoot a Lander that's carrying a humanoid and the humanoid falls. Catch it for 500, then set it down on the ground for another 500. A short fall it survives on its own scores 250. A long fall kills it.
- **Planet destruction.** Losing the last humanoid blows up the planet: the terrain disappears and every Lander, current and future, becomes a Mutant. The planet and all 10 humanoids are restored after every 5th wave (at the start of waves 6, 11, 16, …).
- **Waves** of 20 Landers that arrive in groups of five, plus Bombers and Pods. Difficulty rises each wave. The end-of-wave bonus is 100 × wave per surviving humanoid, capped at 500 each.
- **Smart bombs** destroy everything on screen. **Hyperspace** drops you somewhere random and has an 18% chance of killing you.
- **A bonus ship and smart bomb every 10,000 points.**
- **Synthesised sound** made with the Web Audio API (no audio files). The high score and mute setting are saved in `localStorage`.
- **Touch controls** appear automatically on phones and tablets. Landscape works best.

### Scoring

| Target | Points |
| --- | --- |
| Lander | 150 |
| Mutant | 150 |
| Bomber | 250 |
| Pod | 1000 |
| Swarmer | 150 |
| Baiter | 200 |
| Catch a falling humanoid | 500 |
| Return a humanoid to the ground | 500 |
| Humanoid survives a fall on its own | 250 |

## Project layout

```
index.html        page shell, touch buttons, font
style.css         4:3 pixelated scaling and touch layout
src/main.js       boot, fixed 60 Hz loop, audio unlock
src/game.js       game state machine, entities, AI, collisions, rendering, HUD
src/terrain.js    wrap-around mountain generation and drawing
src/sprites.js    pixel-art bitmaps (text grids) cached to offscreen canvases
src/audio.js      Web Audio sound effects
src/input.js      keyboard and touch input
src/config.js     tunables: world size, ship physics, scoring
src/util.js       random helpers and wrap-around maths
```

The game logic runs at a fixed 1/60 s timestep, independent of the display's refresh rate. World x positions wrap at `WORLD_W`, and `dxWrap()` returns the shortest signed distance between two points on the loop. Every collision and AI decision uses it, which is what makes the seam invisible.

From the browser console, `window.__defender` exposes the live `Game` instance, which is useful for poking at state while tuning.

## Differences from the arcade original

- Controls use direction keys instead of the original's separate Reverse and Thrust buttons.
- Bombers, Pods, Swarmers and Baiters don't carry over between waves.
- When you lose a ship, enemies near you warp away and rematerialise elsewhere instead of the wave restarting.

## Notes

This is a non-commercial fan project made for fun and learning. *Defender* is a trademark of its respective owners, and this project is not affiliated with or endorsed by them. All code, pixel art and sound in this repository are original.

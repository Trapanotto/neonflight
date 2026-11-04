# NEON SKYWAYS

A synthwave arcade flight racer built with Three.js and Vite.

Fly a neon jet through a rain-soaked night metropolis, thread 30 glowing rings in
order, and beat your best time. Missing a ring does not end the run: the next
ring becomes active, and every 6th checkpoint still refills your boost.

## Controls

| Action | Keyboard |
| --- | --- |
| Throttle up / down | `W` / `S` |
| Pitch up / down | `Arrow Up` / `Arrow Down` |
| Roll / turn | `Arrow Left` / `Arrow Right` |
| Boost | `Shift` |
| Pause / resume | `Escape` or `P` |
| Restart | `R` |
| Mute | `M` |

Gamepad: left stick for pitch/roll, `RT`/`LT` for throttle, `A` or right
shoulder for boost, and `Start` to pause. Touch controls appear automatically
on coarse-pointer devices.

## Development

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

Tests:

```bash
npm test
```

## Tech

- Three.js (WebGL) with instanced city geometry and procedural neon signage
- `EffectComposer` + `UnrealBloomPass` for the neon glow
- Web Audio API for the engine, wind, UI chimes, and a procedural synthwave loop
- Seeded procedural course, so best times are comparable between runs
- Fixed 120 Hz simulation with frame-rate-independent race timing
- Spatial building collision index and swept collision checks
- Versioned local profile for settings, records, sector splits and PB ghosts
- Three course definitions with per-course tuning and medal targets

## Gameplay updates

- Race timer pauses with the game and no longer slows down on low frame rates.
- Missing a ring no longer blocks progress: the next ring activates automatically.
- Crashes add a two-second penalty and no longer refill boost.
- Checkpoints report the delta to the best sector split.
- Runs are graded with Bronze, Silver, Gold and Neon medal targets.
- The next ring is highlighted; an off-screen guide points back to it.
- Three selectable courses with distinct routing, pacing and medal targets.
- The course generator uses stronger S-curves, climbs, dives and varied ring sizes.
- Records are versioned by course and physics version. The previous local best
  is migrated automatically.
- A local personal-best ghost can be replayed and switched off in the settings.
- Gamepad support for flight, boost, throttle and pause.
- Settings cover music/effects volume, bloom intensity, flashing and ghosts.
  Reduced flashing is the default and disables lightning.
- Shareable challenge links select a course and show a target time to beat.
- The result screen supports native sharing with clipboard fallback.

## Challenge links

`SHARE RUN` creates a link such as:

```text
https://trapanotto.github.io/neonflight/?course=storm-circuit&target=62.500
```

Opening it selects the course and displays the target in the main menu.

See [KONZEPT.md](KONZEPT.md) for the longer-term product and technical roadmap.

## Deployment

Pushes to `main` are built by GitHub Actions and published to GitHub Pages.
Pull requests and `main` pushes also run tests and a production build.

## License

MIT

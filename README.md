# NEON SKYWAYS

A synthwave arcade flight racer built with Three.js and Vite.

Fly a neon jet through a rain-soaked night metropolis, thread 30 glowing rings in
order, and beat your best time. Passing every 6th ring refills your boost.

## Controls

| Action | Keyboard |
| --- | --- |
| Throttle up / down | `W` / `S` |
| Pitch up / down | `Arrow Up` / `Arrow Down` |
| Roll / turn | `Arrow Left` / `Arrow Right` |
| Boost | `Shift` |
| Restart | `R` |
| Mute | `M` |

Touch controls appear automatically on coarse-pointer devices.

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

## Tech

- Three.js (WebGL) with instanced city geometry and procedural neon signage
- `EffectComposer` + `UnrealBloomPass` for the neon glow
- Web Audio API for the engine, wind, UI chimes, and a procedural synthwave loop
- Seeded procedural course, so best times are comparable between runs

## Deployment

Pushes to `main` are built by GitHub Actions and published to GitHub Pages.

## License

MIT

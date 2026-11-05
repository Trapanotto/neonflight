# Changelog

## Unreleased

- Replaced the finite ground plane with an infinite world-space neon grid that
  follows the camera and fades into the fog, so the map edge is never visible.
- Added procedural lit-window patterns to building facades.
- Reworked rooftop neon into edge frames instead of glowing roof slabs.
- Moved facade trim off the building surfaces and added polygon offsets.
- Raised the camera near plane for better depth precision in the distance.
- Added a moon, horizon haze and a subtler ring guide.

## 0.4.0 – Share & Challenge

- Shareable result links with course and target time.
- Friend challenge banner in the main menu.
- Challenge success/failure feedback on the result screen.
- Native Web Share support with clipboard fallback.
- 35 automated tests across course, collision, race, ghost, sharing and storage.

## 0.3.0 – Mastery & Content

- Three courses with distinct routing, tuning and medal targets.
- Course selection with per-course records.
- Local personal-best ghost with interpolation and on/off setting.
- Gamepad support for flight, boost, throttle and pause.
- City generated once for all course layouts.
- 31 automated tests.

## 0.2.0 – Fair & Fluid

- Fixed 120 Hz simulation and frame-rate-independent race timing.
- Pause flow and automatic pause on focus loss.
- Spatial building collision index and swept collision checks.
- Missed rings no longer block progress.
- Sector deltas, medal targets and expanded result screen.
- Versioned local profile and legacy best-time migration.
- Stronger curves, climbs, dives and variable ring sizes.
- Bloom, flashing, audio and ghost settings.
- 25 automated tests.

## 0.1.0 – Initial release

- Synthwave arcade flight racer with seeded city and 30-ring course.
- Boost, checkpoints, crashes, best time and procedural audio.

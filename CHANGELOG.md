# Changelog

## Unreleased — Determinism & Replay Upgrade

Determinism is now a verified, CI-enforced property of the engine. Given the
same `(seed, configVersion, inputLog)`, the simulation produces a bit-identical
state hash on any platform.

### Added

- **Seeded `RandomService`** (mulberry32) — the single source of randomness,
  with named forks, `shuffle`/`pick`, and `getState`/`setState`. `Math.random`
  is now banned in `src/` (ESLint-enforced).
- **`SimulationClock`** — integer tick + derived `simTimeMs`; default 30 tps.
- **Fixed-timestep stepping** — `world.step()`/`stepN()`,
  `engine.step()`/`stepN()`, accumulator-based real-time loop, and
  `engine.getInterpolationAlpha()` for render interpolation.
- **`InputQueue` + command model** — tick-stamped, quantized, coalesced input;
  `engine.enqueueInput(...)` is the only mutation path into the simulation.
- **`PlayerControllerComponent` / `PlayerControllerSystem`** — map MOVE commands
  to velocity inside the deterministic boundary.
- **Replay system** — `ReplayRecorder`, `ReplayPlayer`, `ReplaySerializer`
  (compact varint + base64url, URL-safe), with `configVersion`/engine-major
  gating and `finalStateHash` verification.
- **`StateHasher`** — canonical 64-bit FNV-1a world fingerprint; folds in PRNG
  stream states. `engine.computeStateHash()` and `engine.enableHashTrace(n)`.
- **`DMath`** — cross-engine-consistent `sin`/`cos`/`atan2`/`sqrt`; plus
  `Vector2Math.rotateD`/`angleD`/`angleBetweenD`.
- **`npm run simulate`** — headless seed-validation CLI (`--seed --ticks --bot`).
- **CI workflow** — determinism lint, typecheck, tests, determinism suite, and a
  seed-validation simulate run.
- Docs: `docs/DETERMINISM.md`, `docs/REPLAY_FORMAT.md`; updated README,
  ARCHITECTURE_OVERVIEW (system order), and FRONTEND_INTEGRATION (input/loop).

### Changed

- `EngineConfig` gains `seed`, `tickRate`, and `configVersion`.
- `SystemUpdateContext` carries `tick`, `simTimeMs`, and `inputCommands`.
- Entity ids now come from a **per-world** counter (was a process-global
  static), so the same simulation always assigns the same ids.
- Combat crits, spawner rolls, economy drops, and skill procs draw from injected
  seeded streams instead of `Math.random`.

### Notes

- Cross-environment (WebKit/JSC vs V8) CI verification is scaffolded but not yet
  wired (needs Playwright browser binaries). The Node-side guarantee and CLI
  seed-validation are in place.

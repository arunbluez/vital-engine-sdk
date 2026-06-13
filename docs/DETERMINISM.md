# Determinism

The core invariant of the Vital Engine SDK is:

> `f(seed, configVersion, inputLog) → worldState` — pure, total, and
> platform-independent.

Given the same seed and inputs, the simulation produces **bit-identical** world
state on any platform (Node/V8, Chrome/Android WebView, Safari/iOS
JavaScriptCore). This enables shareable replay URLs, daily-seed fairness,
server-side seed validation, and anti-cheat verification.

This document covers the deterministic architecture that ships today: seeded
RNG, the simulation clock, fixed-timestep stepping, the input command queue,
the replay system, state hashing, and the deterministic math layer. The one
item still marked _(planned)_ is the cross-environment (WebKit/JSC vs V8) CI
proof; the Node-side guarantee and CLI seed-validation are in place.

## The primitives

### `RandomService` — seeded PRNG

The single source of randomness for the simulation. `Math.random()` is **banned
in `src/`** (enforced by ESLint) because it is unseedable.

```ts
const rng = engine.getRandom()            // root stream
const combat = engine.getRandom('combat') // memoized independent child stream

rng.next()            // float in [0, 1) — mulberry32
rng.nextInt(1, 6)     // inclusive integer
rng.nextRange(0, 10)  // float in [min, max)
rng.chance(0.25)      // true with probability p
rng.pick(items)       // uniform pick
rng.shuffle(items)    // deterministic Fisher-Yates (returns a new array)
rng.getState() / rng.setState(s) // snapshot / restore
```

**Forked streams** (`fork(streamId)`) decouple consumption order between
domains: an extra crit roll in `'combat'` never shifts the `'spawn'` sequence.
Forks are derived from the root seed and are independent of how much any stream
has been consumed. Recommended streams: `'spawn'`, `'combat'`, `'loot'`,
`'skills'`, `'ai'`.

Implementation: **mulberry32**, using only operations (`Math.imul`, integer
XOR/shift) that are bit-identical across JS engines. Zero dependencies.

### `SimulationClock` — deterministic time

All game-logic timing derives from the integer `tick` counter, never
wall-clock time.

```ts
const clock = engine.getClock()
clock.tick        // current tick (integer)
clock.simTimeMs   // tick * fixedDeltaMs — derived, never accumulated
clock.fixedDeltaMs
```

`SystemUpdateContext` now carries `tick` and `simTimeMs`; systems should use
these instead of `Date.now()` / `performance.now()`. Default tick rate is
**30 ticks/sec**.

### `DMath` — deterministic math

IEEE-754 guarantees bit-exact `+ - * /` and `sqrt`, but **not**
`sin/cos/atan2/pow/exp/log` — engines can differ in the last bit, and that drift
compounds over thousands of ticks. `DMath` reimplements the transcendental
functions using only guaranteed-exact operations (polynomial range reduction),
so they are bit-identical everywhere. Accuracy is ~1e-4 — consistency matters
far more than accuracy here.

```ts
DMath.sin(x)  DMath.cos(x)  DMath.atan2(y, x)  DMath.sqrt(x)
Vector2Math.rotateD(v, angle)  Vector2Math.angleD(v)  Vector2Math.angleBetweenD(a, b)
```

### Fixed-timestep stepping

The simulation advances in fixed ticks (default 30/sec); rendering can run
faster and interpolate.

```ts
world.step()           // advance exactly one tick
world.stepN(2700)      // headless: 90s in Node, no browser APIs

engine.step()          // flush input for this tick, apply, step the world
engine.stepN(2700)     // headless convenience
engine.getInterpolationAlpha() // [0,1) — render interpolation factor
```

The browser loop (`engine.start()`) uses the accumulator pattern: it adds real
frame time and steps while the accumulator exceeds `fixedDeltaMs`, exposing the
leftover as the interpolation alpha. Systems run in a stable, documented order
(see ARCHITECTURE_OVERVIEW.md) and entities iterate in deterministic id order.

### `InputQueue` — the only mutation path

Frontends enqueue tick-stamped commands instead of mutating component state.
Analog inputs are quantized (1/127 steps) and coalesced (one MOVE per tick).

```ts
engine.enqueueInput({ type: 'MOVE', dx, dy })   // applied at the next tick
engine.enqueueInput({ type: 'SKILL_PICK', optionIndex: 0 })
```

A built-in `PlayerControllerSystem` consumes MOVE commands and applies velocity
to entities tagged with `PlayerControllerComponent`, keeping the
command→state mapping inside the deterministic boundary.

### Replay system

Record a run, serialize it compactly for a URL, and replay/verify it headlessly.
See [REPLAY_FORMAT.md](./REPLAY_FORMAT.md).

```ts
const recorder = new ReplayRecorder(engine); recorder.start()
// ...drive engine.step()...
const replay = recorder.stop()
const url = ReplaySerializer.encode(replay)
const { verified } = new ReplayPlayer(freshEngine, ReplaySerializer.decode(url)).runToEnd()
```

### `StateHasher` — world fingerprinting

Cheap canonical hash for replay verification and desync detection.

```ts
StateHasher.hash(world)                          // 64-bit FNV-1a, hex string
StateHasher.hash(world, [rng.getState()])        // fold in PRNG stream state
```

Entities are sorted by id and components by type, and numeric fields are hashed
as exact float64 bit patterns (no `JSON.stringify` float ambiguity). A single
1-ULP change anywhere yields a different hash.

## The rules

To keep a game built on the SDK deterministic:

1. **No `Math.random()`.** Use an injected `RandomService` stream.
   ESLint-enforced in `src/`.
2. **No wall-clock time in logic.** Use `context.tick` / `context.simTimeMs`,
   not `Date.now()` / `performance.now()` / `setTimeout` / `setInterval`.
3. **Route transcendental math through `DMath`** in simulation paths.
4. **Deterministic iteration / entity ids.** Entity ids come from a per-world
   counter (not a global static, not UUIDs), so the same simulation always
   assigns the same ids.
5. **Route all input through the `InputQueue`** (analog inputs are quantized
   for you). Never mutate component state from input handlers directly.

## Verifying determinism

- `tests/integration/Determinism.test.ts` — same seed twice through the combat
  stack → identical final hash **and** identical hash traces.
- `tests/integration/DeterminismFuzz.test.ts` — 50 random `(seed, inputLog)`
  pairs, each run twice → identical hashes (the failing seed is reported for
  reproduction).
- `tests/integration/Replay.test.ts` — record → encode → decode → `runToEnd` →
  `verified`, plus scrubbing, configVersion gating, and hash-trace divergence
  localization.
- Unit suites cover PRNG reproducibility/fork independence, clock derivation,
  DMath cross-call stability, hash sensitivity, input quantization/coalescing,
  serializer round-trips, and component serialize/deserialize round-trips.

Run it yourself — the same seed prints the same hash anywhere:

```
npm run simulate -- --seed 42 --ticks 2700 --bot random
```

CI (`.github/workflows/ci.yml`) runs the determinism lint (fails on any new
`Math.random` in `src/`), typecheck, the full test suite, the determinism
suite, and a seed-validation simulate run.

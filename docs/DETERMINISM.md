# Determinism

The core invariant of the Vital Engine SDK is:

> `f(seed, configVersion, inputLog) → worldState` — pure, total, and
> platform-independent.

Given the same seed and inputs, the simulation produces **bit-identical** world
state on any platform (Node/V8, Chrome/Android WebView, Safari/iOS
JavaScriptCore). This enables shareable replay URLs, daily-seed fairness,
server-side seed validation, and anti-cheat verification.

This document covers the **deterministic foundation** that ships today. Items
marked _(planned)_ are tracked for later work packages (input queue, replay
recording/serialization, full transcendental migration, CI cross-env proof).

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
5. **Quantize analog inputs** before feeding them to the simulation _(planned —
   InputQueue)_.

## Verifying determinism

`tests/integration/Determinism.test.ts` runs the same seed twice through the
combat stack and asserts identical final hashes **and** identical hash traces at
intervals. The unit suites cover the PRNG sequence reproducibility, fork
independence, clock derivation, DMath cross-call stability, and hash
sensitivity.

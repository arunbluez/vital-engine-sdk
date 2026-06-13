# Replay Format

A replay is the minimal information needed to reproduce a run bit-for-bit:
`(seed, configVersion, inputLog)`. The engine re-simulates from it and verifies
against a recorded state hash.

## ReplayData

```ts
interface ReplayData {
  version: number          // replay format version (REPLAY_FORMAT_VERSION)
  engineVersion: string    // SDK semver — mismatched majors are refused
  configVersion: string    // game balance identifier — see "configVersion contract"
  seed: number             // simulation seed
  tickRate: number         // ticks per second
  durationTicks: number    // length of the run
  commands: InputCommand[] // ordered, ticks relative to start
  finalStateHash: string   // 64-bit FNV-1a hex — the verification target
  metadata?: object        // display-only (score, kills); never simulated/trusted
}
```

## Recording, playback, verification

```ts
const recorder = new ReplayRecorder(engine)
recorder.start()
// ... drive engine.step() while the player provides input ...
const replay = recorder.stop({ score })

const encoded = ReplaySerializer.encode(replay)   // base64url string for a URL
const decoded = ReplaySerializer.decode(encoded)

// Headless verification (anti-cheat): build a fresh engine with the same seed
// and systems, then re-simulate.
const player = new ReplayPlayer(freshEngine, decoded)
const { stateHash, verified } = player.runToEnd()
// `verified` is true only if the re-simulation reproduces finalStateHash.
```

`ReplayPlayer.stepTo(tick)` scrubs forward (rebuild a fresh engine to scrub
backward).

## Binary layout

`ReplaySerializer` packs the replay into bytes, then base64url-encodes them
(URL-safe, no `+`, `/`, or `=`). Integers use unsigned LEB128 varints; command
ticks are stored as deltas (commands are sorted by tick).

```
u8    format version
u32   seed
u16   tickRate
var   durationTicks
str   engineVersion          (varint length + UTF-8 bytes)
str   configVersion
8B    finalStateHash          (16 hex chars -> 8 bytes)
var   command count
repeat for each command (sorted by tick):
  var   tick delta from previous command
  u8    type code             (MOVE=0, SKILL_PICK=1, PAUSE=2, RESUME=3)
  payload:
    MOVE        -> i8 dx*127, i8 dy*127   (quantized axes)
    SKILL_PICK  -> u8 optionIndex
    PAUSE/RESUME-> (none)
u8    hasMetadata
str   metadata JSON           (only if hasMetadata == 1)
```

### Size budget

A 90s run (2700 ticks at 30tps) with ~2 direction changes/sec is ~180 MOVE
commands at ~4 bytes each — well under 1KB encoded, comfortably URL-safe.

## Versioning policy

- **`version`** — the binary format version. Decoders should support the
  current and previous (`N-1`) format versions so shared links keep working
  across an SDK update.
- **`engineVersion`** — the SDK semver. `ReplayPlayer` refuses to verify a
  replay whose **major** differs from the running SDK (behaviour may have
  changed incompatibly); it emits a `REPLAY_MISMATCH` event.

## configVersion contract

Determinism is `f(seed, configVersion, inputs)`. If a game update changes any
balance value that the simulation reads (enemy HP, skill damage, drop rates,
spawn tables…), **bump `configVersion`**. Old replays recorded under a previous
`configVersion` will not reproduce — `ReplayPlayer` detects the mismatch
(`isCompatible() === false`, emits `REPLAY_MISMATCH`) and reports
`verified: false` rather than silently diverging.

`metadata` is explicitly **not** part of the hash. Tampering with
`metadata.score` cannot make a replay verify a score the simulation did not
produce — the state hash is recomputed from the simulation alone.

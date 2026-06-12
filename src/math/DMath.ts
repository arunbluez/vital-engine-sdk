/**
 * DMath — deterministic math layer for cross-platform float consistency.
 *
 * IEEE-754 guarantees bit-exact results for `+ - * /` and `sqrt`, but NOT for
 * the transcendental functions `sin/cos/tan/atan2/pow/exp/log`. Different JS
 * engines (V8 on Chrome/Android, JavaScriptCore on Safari/iOS) may differ in
 * the last bit. Over thousands of ticks that drift compounds and desyncs
 * replays across platforms.
 *
 * The implementations here use ONLY guaranteed-exact operations (`+ - * /`,
 * comparisons, `Math.floor`/`Math.round`/`Math.abs`, and `Math.sqrt`). They
 * are therefore bit-identical on every conforming engine. Accuracy is ~1e-5,
 * which is far beyond sufficient for gameplay — and here *consistency matters
 * infinitely more than accuracy*.
 *
 * Note: we deliberately do not build a lookup table with `Math.sin`, because
 * the table values themselves would then carry platform variance. Pure
 * polynomial range-reduction keeps every byte reproducible.
 */

const PI = Math.PI
const TWO_PI = Math.PI * 2
const HALF_PI = Math.PI / 2

/**
 * sin via range reduction to [-PI/2, PI/2] + odd Taylor polynomial (degree 9).
 * Max error ~1e-6 on the reduced range.
 */
function sin(x: number): number {
  // Reduce into [-PI, PI]. Math.round is exactly specified; * and - are exact.
  let r = x - TWO_PI * Math.round(x / TWO_PI)
  // Reflect into [-PI/2, PI/2] using sin(PI - r) = sin(r).
  if (r > HALF_PI) {
    r = PI - r
  } else if (r < -HALF_PI) {
    r = -PI - r
  }
  const r2 = r * r
  // r * (1 - r2/6 + r2^2/120 - r2^3/5040 + r2^4/362880) via Horner.
  return (
    r *
    (1 + r2 * (-1 / 6 + r2 * (1 / 120 + r2 * (-1 / 5040 + r2 * (1 / 362880)))))
  )
}

/**
 * cos(x) = sin(x + PI/2).
 */
function cos(x: number): number {
  return sin(x + HALF_PI)
}

/**
 * tan(x) = sin(x) / cos(x). Provided for completeness; prefer avoiding it.
 */
function tan(x: number): number {
  return sin(x) / cos(x)
}

/**
 * atan2(y, x) via a branch-exact polynomial approximation. Uses only
 * +, -, *, /, comparisons — bit-identical across engines. Max error ~1e-4.
 */
function atan2(y: number, x: number): number {
  if (x === 0 && y === 0) {
    return 0
  }
  const ax = x < 0 ? -x : x
  const ay = y < 0 ? -y : y
  // a = ratio of smaller to larger magnitude, in [0, 1].
  const a = ax > ay ? ay / ax : ax / ay
  const s = a * a
  // Minimax-style cubic for atan on [0, 1].
  let r = ((-0.0464964749 * s + 0.15931422) * s - 0.327622764) * s * a + a
  // Unfold the octant.
  if (ay > ax) {
    r = HALF_PI - r
  }
  if (x < 0) {
    r = PI - r
  }
  if (y < 0) {
    r = -r
  }
  return r
}

/**
 * sqrt — IEEE-754 mandates a correctly-rounded result, so this is already
 * bit-exact everywhere. Routed through DMath purely for auditability.
 */
function sqrt(x: number): number {
  return Math.sqrt(x)
}

/**
 * atan(x) = atan2(x, 1).
 */
function atan(x: number): number {
  return atan2(x, 1)
}

export const DMath = {
  PI,
  TWO_PI,
  HALF_PI,
  sin,
  cos,
  tan,
  atan,
  atan2,
  sqrt,
} as const

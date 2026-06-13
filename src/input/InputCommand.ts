/**
 * InputCommand — the only mutation path into the simulation.
 *
 * Every external input is captured as a tick-stamped command and applied at a
 * deterministic tick boundary (never mid-frame). This is what makes replays
 * reproducible: the input log plus the seed fully determines the run.
 *
 * The discriminated union is intentionally compact and serialization-friendly
 * (see ReplaySerializer). Extend it by adding new variants.
 */

/** Normalized, quantized movement direction (each component in [-1, 1]). */
export interface MoveCommand {
  tick: number
  type: 'MOVE'
  dx: number
  dy: number
}

/** Player picked one of the offered skill options. */
export interface SkillPickCommand {
  tick: number
  type: 'SKILL_PICK'
  optionIndex: 0 | 1 | 2
}

export interface PauseCommand {
  tick: number
  type: 'PAUSE'
}

export interface ResumeCommand {
  tick: number
  type: 'RESUME'
}

export type InputCommand =
  | MoveCommand
  | SkillPickCommand
  | PauseCommand
  | ResumeCommand

export type InputCommandType = InputCommand['type']

/** A command before it has been stamped with the tick it applies on. */
export type UnstampedInputCommand =
  | Omit<MoveCommand, 'tick'>
  | Omit<SkillPickCommand, 'tick'>
  | Omit<PauseCommand, 'tick'>
  | Omit<ResumeCommand, 'tick'>

/** Quantization resolution for analog inputs: 1/127 steps (fits in an int8). */
export const INPUT_QUANTIZATION = 127

/**
 * Quantizes an analog axis value to the nearest 1/127 step in [-1, 1]. Touch
 * and joystick floats are device noise; quantizing makes the input log compact
 * and reproduction exact.
 */
export function quantizeAxis(value: number): number {
  const clamped = value < -1 ? -1 : value > 1 ? 1 : value
  return Math.round(clamped * INPUT_QUANTIZATION) / INPUT_QUANTIZATION
}

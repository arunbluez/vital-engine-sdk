import { SimulationClock } from '../../src/core/SimulationClock'

describe('SimulationClock', () => {
  it('defaults to 30 ticks/sec', () => {
    const clock = new SimulationClock()
    expect(clock.tickRate).toBe(30)
    expect(clock.fixedDeltaMs).toBeCloseTo(1000 / 30, 10)
  })

  it('derives fixedDeltaMs exactly as 1000 / tickRate', () => {
    expect(new SimulationClock(60).fixedDeltaMs).toBe(1000 / 60)
    expect(new SimulationClock(20).fixedDeltaMs).toBe(1000 / 20)
  })

  it('starts at tick 0 with simTimeMs 0', () => {
    const clock = new SimulationClock(30)
    expect(clock.tick).toBe(0)
    expect(clock.simTimeMs).toBe(0)
  })

  it('advance increments the tick', () => {
    const clock = new SimulationClock(30)
    clock.advance()
    clock.advance()
    expect(clock.tick).toBe(2)
  })

  it('derives simTimeMs as tick * fixedDeltaMs (never accumulated)', () => {
    const clock = new SimulationClock(30)
    for (let i = 0; i < 100; i++) clock.advance()
    expect(clock.simTimeMs).toBe(100 * (1000 / 30))
  })

  it('simTimeMs is exact and reproducible for large tick counts', () => {
    const a = new SimulationClock(30)
    const b = new SimulationClock(30)
    for (let i = 0; i < 5000; i++) {
      a.advance()
      b.advance()
    }
    expect(a.simTimeMs).toBe(b.simTimeMs)
  })

  it('reset returns to tick 0', () => {
    const clock = new SimulationClock(30)
    clock.advance()
    clock.advance()
    clock.reset()
    expect(clock.tick).toBe(0)
    expect(clock.simTimeMs).toBe(0)
  })

  it('rejects non-positive tick rates', () => {
    expect(() => new SimulationClock(0)).toThrow()
    expect(() => new SimulationClock(-5)).toThrow()
  })
})

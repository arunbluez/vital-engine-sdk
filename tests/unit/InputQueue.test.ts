import { InputQueue } from '../../src/input/InputQueue'
import { quantizeAxis } from '../../src/input/InputCommand'

describe('InputQueue', () => {
  let queue: InputQueue

  beforeEach(() => {
    queue = new InputQueue()
  })

  it('stamps enqueued commands with the current stamp tick', () => {
    queue.advanceStampTo(5)
    queue.enqueue({ type: 'PAUSE' })
    expect(queue.flush(5)).toEqual([{ tick: 5, type: 'PAUSE' }])
  })

  it('does not release commands for a different tick', () => {
    queue.advanceStampTo(3)
    queue.enqueue({ type: 'PAUSE' })
    expect(queue.flush(2)).toEqual([])
    expect(queue.flush(4)).toEqual([])
    expect(queue.flush(3)).toHaveLength(1)
  })

  it('commands enqueued after advancing apply only at the next tick', () => {
    queue.advanceStampTo(0)
    queue.enqueue({ type: 'MOVE', dx: 1, dy: 0 })
    // Simulate stepping tick 0, then advancing to tick 1.
    expect(queue.flush(0)).toHaveLength(1)
    queue.advanceStampTo(1)
    queue.enqueue({ type: 'MOVE', dx: 0, dy: 1 })
    // Tick 0 is now empty; the new command is only visible at tick 1.
    expect(queue.flush(0)).toEqual([])
    expect(queue.flush(1)).toHaveLength(1)
  })

  it('quantizes analog MOVE inputs to 1/127 steps', () => {
    queue.enqueue({ type: 'MOVE', dx: 0.123456, dy: -0.987654 })
    const [cmd] = queue.flush(0)
    expect(cmd).toEqual({
      tick: 0,
      type: 'MOVE',
      dx: quantizeAxis(0.123456),
      dy: quantizeAxis(-0.987654),
    })
  })

  it('coalesces multiple MOVEs in a tick to the last one', () => {
    queue.enqueue({ type: 'MOVE', dx: 1, dy: 0 })
    queue.enqueue({ type: 'MOVE', dx: 0, dy: 1 })
    queue.enqueue({ type: 'MOVE', dx: -1, dy: 0 })
    const commands = queue.flush(0)
    const moves = commands.filter((c) => c.type === 'MOVE')
    expect(moves).toHaveLength(1)
    expect(moves[0]).toMatchObject({ dx: -1, dy: 0 })
  })

  it('keeps non-MOVE commands alongside a coalesced MOVE', () => {
    queue.enqueue({ type: 'MOVE', dx: 1, dy: 0 })
    queue.enqueue({ type: 'SKILL_PICK', optionIndex: 1 })
    queue.enqueue({ type: 'MOVE', dx: 0, dy: 1 })
    const commands = queue.flush(0)
    expect(commands.filter((c) => c.type === 'MOVE')).toHaveLength(1)
    expect(commands.filter((c) => c.type === 'SKILL_PICK')).toHaveLength(1)
  })

  it('identical gestures produce byte-identical logs', () => {
    const gesture = [
      { dx: 0.5012, dy: 0.5031 },
      { dx: 0.71, dy: 0.69 },
      { dx: -0.33, dy: 0.12 },
    ]
    const build = (): InputQueue => {
      const q = new InputQueue()
      gesture.forEach((g, i) => {
        q.advanceStampTo(i)
        q.enqueue({ type: 'MOVE', ...g })
        q.flush(i)
      })
      return q
    }
    expect(build().getLog()).toEqual(build().getLog())
  })

  it('getLog returns flushed commands in order', () => {
    queue.advanceStampTo(0)
    queue.enqueue({ type: 'PAUSE' })
    queue.flush(0)
    queue.advanceStampTo(1)
    queue.enqueue({ type: 'RESUME' })
    queue.flush(1)
    expect(queue.getLog()).toEqual([
      { tick: 0, type: 'PAUSE' },
      { tick: 1, type: 'RESUME' },
    ])
  })

  it('inject places a fully-stamped command without re-quantizing', () => {
    queue.inject({ tick: 7, type: 'MOVE', dx: 0.5, dy: 0.5 })
    expect(queue.flush(7)).toEqual([
      { tick: 7, type: 'MOVE', dx: 0.5, dy: 0.5 },
    ])
  })

  it('clear resets pending, log, and stamp tick', () => {
    queue.advanceStampTo(4)
    queue.enqueue({ type: 'PAUSE' })
    queue.flush(4)
    queue.clear()
    expect(queue.getLog()).toEqual([])
    expect(queue.getStampTick()).toBe(0)
  })
})

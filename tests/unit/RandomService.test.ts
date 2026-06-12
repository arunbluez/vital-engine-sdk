import { RandomService } from '../../src/core/RandomService'

describe('RandomService', () => {
  it('produces identical sequences for identical seeds', () => {
    const a = new RandomService(42)
    const b = new RandomService(42)
    const seqA: number[] = []
    const seqB: number[] = []
    for (let i = 0; i < 10000; i++) {
      seqA.push(a.next())
      seqB.push(b.next())
    }
    expect(seqA).toEqual(seqB)
  })

  it('produces different sequences for different seeds', () => {
    const a = new RandomService(1)
    const b = new RandomService(2)
    let differences = 0
    for (let i = 0; i < 1000; i++) {
      if (a.next() !== b.next()) differences++
    }
    expect(differences).toBeGreaterThan(990)
  })

  it('next() returns values in [0, 1)', () => {
    const r = new RandomService(123)
    for (let i = 0; i < 10000; i++) {
      const v = r.next()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('is reasonably uniformly distributed', () => {
    const r = new RandomService(7)
    const buckets = new Array(10).fill(0)
    const n = 100000
    for (let i = 0; i < n; i++) {
      buckets[Math.floor(r.next() * 10)]++
    }
    // Each bucket should be near n/10; allow generous tolerance.
    for (const count of buckets) {
      expect(count).toBeGreaterThan(n / 10 - n / 50)
      expect(count).toBeLessThan(n / 10 + n / 50)
    }
  })

  it('nextInt returns inclusive integers within range', () => {
    const r = new RandomService(99)
    let min = Infinity
    let max = -Infinity
    for (let i = 0; i < 10000; i++) {
      const v = r.nextInt(3, 8)
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(3)
      expect(v).toBeLessThanOrEqual(8)
      min = Math.min(min, v)
      max = Math.max(max, v)
    }
    expect(min).toBe(3)
    expect(max).toBe(8)
  })

  it('chance(0) is never true and chance(1) is always true', () => {
    const r = new RandomService(5)
    for (let i = 0; i < 1000; i++) {
      expect(r.chance(0)).toBe(false)
      expect(r.chance(1)).toBe(true)
    }
  })

  it('pick returns elements from the array', () => {
    const r = new RandomService(11)
    const items = ['a', 'b', 'c', 'd']
    for (let i = 0; i < 1000; i++) {
      expect(items).toContain(r.pick(items))
    }
  })

  it('shuffle is a permutation and does not mutate input', () => {
    const r = new RandomService(33)
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const original = input.slice()
    const shuffled = r.shuffle(input)
    expect(input).toEqual(original) // input untouched
    expect(shuffled.slice().sort((a, b) => a - b)).toEqual(original)
  })

  it('shuffle is deterministic for a fixed seed', () => {
    const a = new RandomService(8).shuffle([1, 2, 3, 4, 5])
    const b = new RandomService(8).shuffle([1, 2, 3, 4, 5])
    expect(a).toEqual(b)
  })

  describe('fork', () => {
    it('returns a memoized, stable child stream', () => {
      const r = new RandomService(42)
      expect(r.fork('combat')).toBe(r.fork('combat'))
    })

    it('different stream ids produce different sequences', () => {
      const r = new RandomService(42)
      const a = r.fork('spawn')
      const b = r.fork('loot')
      let differences = 0
      for (let i = 0; i < 1000; i++) {
        if (a.next() !== b.next()) differences++
      }
      expect(differences).toBeGreaterThan(990)
    })

    it('forked streams are independent: draining one does not affect another', () => {
      const r1 = new RandomService(42)
      const aFirst = r1.fork('a').next()

      const r2 = new RandomService(42)
      // Drain fork('b') heavily before touching fork('a').
      const b = r2.fork('b')
      for (let i = 0; i < 1000; i++) b.next()
      const aFirstAfterDrain = r2.fork('a').next()

      expect(aFirstAfterDrain).toBe(aFirst)
    })

    it('forks are stable regardless of parent consumption', () => {
      const r1 = new RandomService(100)
      const fromFresh = r1.fork('x').next()

      const r2 = new RandomService(100)
      for (let i = 0; i < 500; i++) r2.next() // consume parent
      const fromConsumed = r2.fork('x').next()

      expect(fromConsumed).toBe(fromFresh)
    })
  })

  describe('getState / setState', () => {
    it('round-trips mid-sequence', () => {
      const r = new RandomService(77)
      for (let i = 0; i < 50; i++) r.next()
      const state = r.getState()
      const expected = [r.next(), r.next(), r.next()]

      r.setState(state)
      const actual = [r.next(), r.next(), r.next()]
      expect(actual).toEqual(expected)
    })

    it('restoring state on a different instance reproduces the sequence', () => {
      const a = new RandomService(1)
      for (let i = 0; i < 20; i++) a.next()
      const snapshot = a.getState()

      const b = new RandomService(999)
      b.setState(snapshot)
      expect(b.next()).toBe(a.next())
    })
  })
})

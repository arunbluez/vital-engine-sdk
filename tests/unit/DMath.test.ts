import { DMath } from '../../src/math/DMath'

describe('DMath', () => {
  describe('sin', () => {
    it('approximates Math.sin within 1e-4 across the range', () => {
      for (let x = -20; x <= 20; x += 0.013) {
        expect(Math.abs(DMath.sin(x) - Math.sin(x))).toBeLessThan(1e-4)
      }
    })

    it('hits known exact-ish values', () => {
      expect(DMath.sin(0)).toBeCloseTo(0, 5)
      expect(DMath.sin(Math.PI / 2)).toBeCloseTo(1, 4)
      expect(DMath.sin(Math.PI)).toBeCloseTo(0, 4)
      expect(DMath.sin(-Math.PI / 2)).toBeCloseTo(-1, 4)
    })

    it('is deterministic (pure function of input)', () => {
      expect(DMath.sin(1.2345)).toBe(DMath.sin(1.2345))
    })

    it('only uses IEEE-exact ops, so repeated calls are bit-identical', () => {
      const first = DMath.sin(0.7)
      for (let i = 0; i < 100; i++) {
        expect(DMath.sin(0.7)).toBe(first)
      }
    })
  })

  describe('cos', () => {
    it('approximates Math.cos within 1e-4 across the range', () => {
      for (let x = -20; x <= 20; x += 0.013) {
        expect(Math.abs(DMath.cos(x) - Math.cos(x))).toBeLessThan(1e-4)
      }
    })

    it('hits known values', () => {
      expect(DMath.cos(0)).toBeCloseTo(1, 4)
      expect(DMath.cos(Math.PI)).toBeCloseTo(-1, 4)
    })
  })

  describe('atan2', () => {
    it('approximates Math.atan2 within 1e-3 across quadrants', () => {
      const coords = [-3, -2, -1, -0.5, 0.5, 1, 2, 3]
      for (const y of coords) {
        for (const x of coords) {
          expect(Math.abs(DMath.atan2(y, x) - Math.atan2(y, x))).toBeLessThan(
            1e-3
          )
        }
      }
    })

    it('returns 0 at the origin', () => {
      expect(DMath.atan2(0, 0)).toBe(0)
    })

    it('matches axis directions', () => {
      expect(DMath.atan2(1, 0)).toBeCloseTo(Math.PI / 2, 3)
      expect(DMath.atan2(0, 1)).toBeCloseTo(0, 3)
      expect(DMath.atan2(-1, 0)).toBeCloseTo(-Math.PI / 2, 3)
    })
  })

  describe('sqrt', () => {
    it('matches Math.sqrt exactly (IEEE-754 correctly rounded)', () => {
      for (let x = 0; x < 1000; x += 0.7) {
        expect(DMath.sqrt(x)).toBe(Math.sqrt(x))
      }
    })
  })
})

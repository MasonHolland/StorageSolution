import { describe, expect, it } from 'vitest'
import { nextCode } from './codes'

describe('nextCode', () => {
  it('starts at 001', () => expect(nextCode([])).toBe('B-001'))
  it('follows the highest existing number', () => expect(nextCode(['B-001', 'B-009', 'B-003'])).toBe('B-010'))
  it('ignores other prefixes and junk', () => expect(nextCode(['K-050', 'hello', 'B-2'], 'B')).toBe('B-003'))
  it('grows past 999', () => expect(nextCode(['B-999'])).toBe('B-1000'))
  it('uses a custom prefix', () => expect(nextCode(['K-1'], 'K')).toBe('K-002'))
})

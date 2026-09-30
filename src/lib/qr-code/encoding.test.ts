import { describe, expect, it } from 'vitest'
import {
  findNonAlphanumericChars,
  isAlphanumericData,
  isNumericData,
  payloadBits,
  resolveEncodingMode
} from './encoding'
import { buildMatrix } from './matrix'
import { fromLegacyOptions } from './legacy-adapter'

describe('alphanumeric charset checks', () => {
  it('accepts the full 45-char set', () => {
    expect(isAlphanumericData('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:')).toBe(true)
  })

  it('rejects lowercase, query chars, and empty input', () => {
    expect(isAlphanumericData('HTTPS://EXAMPLE.COM')).toBe(true)
    expect(isAlphanumericData('https://example.com')).toBe(false)
    expect(isAlphanumericData('HTTPS://A.COM/?Q=1')).toBe(false)
    expect(isAlphanumericData('')).toBe(false)
  })

  it('lists offending characters once, in order, counting emoji as one', () => {
    expect(findNonAlphanumericChars('A?b_?👋b')).toEqual(['?', 'b', '_', '👋'])
    expect(findNonAlphanumericChars('HELLO')).toEqual([])
  })

  it('detects digit-only data', () => {
    expect(isNumericData('0042')).toBe(true)
    expect(isNumericData('42 ')).toBe(false)
  })
})

describe('resolveEncodingMode', () => {
  it('keeps Byte when nothing compact was requested', () => {
    expect(resolveEncodingMode('HELLO')).toBe('Byte')
    expect(resolveEncodingMode('HELLO', 'Byte')).toBe('Byte')
  })

  it('uses Alphanumeric when the data fits, Byte when it does not', () => {
    expect(resolveEncodingMode('HTTPS://EXAMPLE.COM', 'Alphanumeric')).toBe('Alphanumeric')
    expect(resolveEncodingMode('https://example.com', 'Alphanumeric')).toBe('Byte')
  })

  it('upgrades digit-only data to Numeric', () => {
    expect(resolveEncodingMode('5551234', 'Alphanumeric')).toBe('Numeric')
    expect(resolveEncodingMode('5551234', 'Numeric')).toBe('Numeric')
  })

  it('falls back to Byte for a Numeric request with non-digits', () => {
    expect(resolveEncodingMode('555-1234', 'Numeric')).toBe('Byte')
  })
})

describe('payloadBits', () => {
  it('matches the ISO/IEC 18004 packing', () => {
    expect(payloadBits('AB', 'Alphanumeric')).toBe(11)
    expect(payloadBits('ABC', 'Alphanumeric')).toBe(17)
    expect(payloadBits('123', 'Numeric')).toBe(10)
    expect(payloadBits('12345', 'Numeric')).toBe(17)
    expect(payloadBits('é', 'Byte')).toBe(16)
  })
})

describe('buildMatrix with a compact mode', () => {
  it('reports the mode it actually used', () => {
    expect(buildMatrix('HTTPS://EXAMPLE.COM', 'H', 'Alphanumeric').mode).toBe('Alphanumeric')
    expect(buildMatrix('https://example.com', 'H', 'Alphanumeric').mode).toBe('Byte')
    expect(buildMatrix('https://example.com', 'H').mode).toBe('Byte')
  })

  it('produces a smaller symbol than Byte once the data is long enough', () => {
    const data = 'HTTPS://EXAMPLE.COM/SOME/LONGER/PATH/THAT/NEEDS/ROOM'
    const byte = buildMatrix(data, 'Q', 'Byte')
    const compact = buildMatrix(data, 'Q', 'Alphanumeric')
    expect(compact.version).toBeLessThan(byte.version)
    expect(compact.count).toBe(17 + 4 * compact.version)
  })
})

describe('fromLegacyOptions mode mapping', () => {
  it('passes qrOptions.mode through and treats Kanji as Byte', () => {
    expect(fromLegacyOptions({ data: 'A', qrOptions: { mode: 'Alphanumeric' } }).mode).toBe(
      'Alphanumeric'
    )
    expect(fromLegacyOptions({ data: 'A', qrOptions: { mode: 'Kanji' } }).mode).toBeUndefined()
    expect(fromLegacyOptions({ data: 'A' }).mode).toBeUndefined()
  })
})

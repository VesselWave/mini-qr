import { describe, expect, it } from 'vitest'
import {
  analyzeCompactEncoding,
  describeChar,
  caseSensitiveUrlPath,
  symbolSize,
  uppercaseAscii
} from './compactEncoding'

describe('analyzeCompactEncoding', () => {
  it('flags empty input', () => {
    expect(analyzeCompactEncoding('')).toEqual({ kind: 'empty' })
  })

  it('accepts text that already fits', () => {
    expect(analyzeCompactEncoding('HTTPS://EXAMPLE.COM')).toEqual({
      kind: 'compatible',
      mode: 'Alphanumeric'
    })
    expect(analyzeCompactEncoding('0123')).toEqual({ kind: 'compatible', mode: 'Numeric' })
  })

  it('offers uppercasing when only a–z stand in the way', () => {
    expect(analyzeCompactEncoding('https://example.com')).toEqual({
      kind: 'uppercasable',
      uppercased: 'HTTPS://EXAMPLE.COM',
      caseSensitivePath: null
    })
  })

  it('warns when uppercasing would touch a URL path', () => {
    const result = analyzeCompactEncoding('https://example.com/Events')
    expect(result).toMatchObject({ kind: 'uppercasable', caseSensitivePath: '/Events' })
  })

  it('lists blockers after uppercasing, so letters never show up as blockers', () => {
    expect(analyzeCompactEncoding('https://a.com/?q=b_c')).toEqual({
      kind: 'blocked',
      chars: ['?', '=', '_']
    })
  })

  it('does not treat ß as uppercasable', () => {
    expect(analyzeCompactEncoding('straße')).toEqual({ kind: 'blocked', chars: ['ß'] })
  })
})

describe('helpers', () => {
  it('uppercases ASCII letters only', () => {
    expect(uppercaseAscii('abc ßé')).toBe('ABC ßé')
  })

  it('detects case-sensitive URL paths', () => {
    expect(caseSensitiveUrlPath('https://example.com')).toBeNull()
    expect(caseSensitiveUrlPath('https://example.com/')).toBeNull()
    expect(caseSensitiveUrlPath('https://example.com/join')).toBe('/join')
    expect(caseSensitiveUrlPath('hello world')).toBeNull()
  })

  it('renders invisible characters visibly', () => {
    expect(describeChar('\n')).toBe('↵')
    expect(describeChar('\t')).toBe('⇥')
    expect(describeChar('?')).toBe('?')
  })

  it('reports a smaller symbol for compact data and null for empty input', () => {
    const data = 'HTTPS://EXAMPLE.COM/SOME/LONGER/PATH/THAT/NEEDS/ROOM'
    expect(symbolSize(data, 'Q', 'Alphanumeric')!).toBeLessThan(symbolSize(data, 'Q', 'Byte')!)
    expect(symbolSize('', 'Q', 'Byte')).toBeNull()
  })
})

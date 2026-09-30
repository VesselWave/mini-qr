import { utf8StringToBytes } from './utf8'

/**
 * QR data-segment modes this library emits. Kanji is intentionally absent —
 * the UTF-8 Byte path already covers it without Shift-JIS tables.
 */
export type EncodingMode = 'Numeric' | 'Alphanumeric' | 'Byte'

/**
 * The 45-character set QR's Alphanumeric mode can encode (ISO/IEC 18004
 * table 5). Anything outside it — lowercase letters included — needs Byte.
 */
export const ALPHANUMERIC_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:'
const ALPHANUMERIC_SET = new Set(ALPHANUMERIC_CHARSET)

export function isNumericData(data: string): boolean {
  return /^[0-9]+$/.test(data)
}

export function isAlphanumericData(data: string): boolean {
  if (!data) return false
  for (const ch of data) if (!ALPHANUMERIC_SET.has(ch)) return false
  return true
}

/**
 * Unique characters in `data` that Alphanumeric mode can't encode, in order
 * of first appearance. Iterates code points so emoji count as one character.
 */
export function findNonAlphanumericChars(data: string): string[] {
  const seen = new Set<string>()
  for (const ch of data) if (!ALPHANUMERIC_SET.has(ch)) seen.add(ch)
  return [...seen]
}

/**
 * Pick the mode actually used to encode `data`. A compact request
 * ('Alphanumeric' or 'Numeric') is a preference, not a guarantee: data the
 * mode can't hold silently falls back to Byte so a batch row or a mid-edit
 * string still renders. Digit-only data under an Alphanumeric request is
 * upgraded to Numeric — its charset is a subset and it packs tighter.
 */
export function resolveEncodingMode(data: string, preferred?: EncodingMode): EncodingMode {
  if (!preferred || preferred === 'Byte') return 'Byte'
  if (isNumericData(data)) return 'Numeric'
  if (preferred === 'Alphanumeric' && isAlphanumericData(data)) return 'Alphanumeric'
  return 'Byte'
}

/**
 * Payload size in bits for `data` in `mode`, excluding the mode indicator and
 * character-count header (those are identical-ish across modes and version
 * dependent). Good enough for "how much smaller" UI copy.
 */
export function payloadBits(data: string, mode: EncodingMode): number {
  if (mode === 'Numeric') {
    const n = data.length
    const rem = n % 3
    return Math.floor(n / 3) * 10 + (rem === 2 ? 7 : rem === 1 ? 4 : 0)
  }
  if (mode === 'Alphanumeric') {
    const n = data.length
    return Math.floor(n / 2) * 11 + (n % 2) * 6
  }
  return utf8StringToBytes(data).length * 8
}

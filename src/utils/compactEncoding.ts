import {
  buildMatrix,
  findNonAlphanumericChars,
  isAlphanumericData,
  isNumericData,
  type ECLevel,
  type EncodingMode
} from '@/lib/qr-code'

/** 'auto' = compact whenever the data fits; 'off' = the user opted out. */
export type CompactEncodingPreference = 'auto' | 'off'

/**
 * Where a piece of text stands relative to QR's compact (Alphanumeric /
 * Numeric) modes, driving the "Alphanumeric mode" toggle under the data box:
 *
 * - `empty`        nothing to encode yet
 * - `compatible`   fits as typed
 * - `uppercasable` fits once its a–z letters are uppercased
 * - `blocked`      has characters no casing change can fix
 */
export type CompactAnalysis =
  | { kind: 'empty' }
  | { kind: 'compatible'; mode: Exclude<EncodingMode, 'Byte'> }
  | { kind: 'uppercasable'; uppercased: string; caseSensitivePath: string | null }
  | { kind: 'blocked'; chars: string[] }

/**
 * Uppercase ASCII a–z only. String#toUpperCase would also turn 'ß' into 'SS'
 * or 'ﬁ' into 'FI' — rewriting content rather than just its case — so those
 * stay put and correctly count as blockers.
 */
export function uppercaseAscii(data: string): string {
  return data.replace(/[a-z]+/g, (m) => m.toUpperCase())
}

/**
 * The path of a URL whose path has lowercase letters, else null. Scheme and
 * host are case-insensitive, but most servers treat /Promo and /PROMO as
 * different pages, so uppercasing those is worth a heads-up.
 */
export function caseSensitiveUrlPath(data: string): string | null {
  const match = /^[a-z][a-z0-9+.-]*:\/\/[^/]*(\/.*)?$/is.exec(data.trim())
  const path = match?.[1]
  return path && /[a-z]/.test(path) ? path : null
}

export function analyzeCompactEncoding(data: string): CompactAnalysis {
  if (!data) return { kind: 'empty' }
  if (isNumericData(data)) return { kind: 'compatible', mode: 'Numeric' }
  if (isAlphanumericData(data)) return { kind: 'compatible', mode: 'Alphanumeric' }
  const uppercased = uppercaseAscii(data)
  if (isAlphanumericData(uppercased)) {
    return {
      kind: 'uppercasable',
      uppercased,
      caseSensitivePath: caseSensitiveUrlPath(data)
    }
  }
  return { kind: 'blocked', chars: findNonAlphanumericChars(uppercased) }
}

/** Readable stand-ins for invisible offenders in the blocker chips. */
export function describeChar(ch: string): string {
  switch (ch) {
    case '\n':
    case '\r':
      return '↵'
    case '\t':
      return '⇥'
    case ' ':
      return 'nbsp'
    default:
      return ch
  }
}

/** Side length in modules, or null when the data doesn't fit any version. */
export function symbolSize(data: string, ecLevel: ECLevel, mode: EncodingMode): number | null {
  if (!data) return null
  try {
    return buildMatrix(data, ecLevel, mode).count
  } catch {
    return null
  }
}

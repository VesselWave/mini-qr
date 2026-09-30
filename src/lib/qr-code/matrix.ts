import qrcode from 'qrcode-generator'
import { resolveEncodingMode, type EncodingMode } from './encoding'
import type { ECLevel } from './types'
import { utf8StringToBytes } from './utf8'

let overrideInstalled = false

function ensureUtf8Override(): void {
  if (overrideInstalled) return
  const factory = qrcode as unknown as {
    stringToBytes: (s: string) => number[]
    stringToBytesFuncs?: Record<string, (s: string) => number[]>
  }
  factory.stringToBytes = utf8StringToBytes
  // v1.x exposed `stringToBytesFuncs`; v2.x dropped it. Keep both paths so
  // future SJIS callers still get UTF-8 for Byte mode.
  if (factory.stringToBytesFuncs) {
    factory.stringToBytesFuncs['UTF-8'] = utf8StringToBytes
  }
  overrideInstalled = true
}

export interface QRMatrix {
  matrix: boolean[][]
  count: number
  /** Mode the data was actually encoded in (after any Byte fallback). */
  mode: EncodingMode
  /** QR version 1–40 (count = 17 + 4 × version). */
  version: number
}

/**
 * @param mode preferred data mode — see resolveEncodingMode for the fallback
 *   rules. Defaults to Byte, the historical behaviour.
 */
export function buildMatrix(data: string, ecLevel: ECLevel, mode?: EncodingMode): QRMatrix {
  if (!data) {
    throw new Error('QR code data must be a non-empty string')
  }
  ensureUtf8Override()
  const resolvedMode = resolveEncodingMode(data, mode)
  const qr = qrcode(0, ecLevel)
  try {
    qr.addData(data, resolvedMode)
    qr.make()
  } catch (err) {
    throw new Error(
      `Failed to build QR matrix for input of byte-length ${
        utf8StringToBytes(data).length
      } at EC level ${ecLevel} in ${resolvedMode} mode: ${(err as Error).message}`
    )
  }
  const count = qr.getModuleCount()
  const matrix: boolean[][] = []
  for (let r = 0; r < count; r++) {
    const row: boolean[] = []
    for (let c = 0; c < count; c++) row.push(qr.isDark(r, c))
    matrix.push(row)
  }
  return { matrix, count, mode: resolvedMode, version: (count - 17) / 4 }
}

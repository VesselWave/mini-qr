<script setup lang="ts">
import { payloadBits, type ECLevel } from '@/lib/qr-code'
import {
  analyzeCompactEncoding,
  describeChar,
  caseSensitiveUrlPath,
  uppercaseAscii,
  symbolSize,
  type CompactEncodingPreference
} from '@/utils/compactEncoding'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  /** Error-correction level the renderer will actually use (logo boost applied). */
  ecLevel: ECLevel
}>()

const data = defineModel<string>({ required: true })
const preference = defineModel<CompactEncodingPreference>('preference', { required: true })

const { t } = useI18n()

const MAX_BLOCKER_CHIPS = 8
const MAX_PATH_PREVIEW = 24
// Human-readable ALPHANUMERIC_CHARSET for the label tooltip.
const CHARSET_LABEL = '0–9 A–Z space $ % * + - . / :'

const analysis = computed(() => analyzeCompactEncoding(data.value))

const isOn = computed(() => analysis.value.kind === 'compatible' && preference.value === 'auto')
const isDisabled = computed(
  () => analysis.value.kind === 'empty' || analysis.value.kind === 'blocked'
)

/**
 * Remembered so turning the mode back off (or hitting Undo) restores the
 * user's original casing — as long as they haven't edited the text since.
 */
const uppercaseUndo = ref<{ original: string; uppercased: string } | null>(null)
const canUndoUppercase = computed(
  () => uppercaseUndo.value !== null && data.value === uppercaseUndo.value.uppercased
)

watch(data, (value) => {
  if (uppercaseUndo.value && value !== uppercaseUndo.value.uppercased) {
    uppercaseUndo.value = null
  }
  // An opt-out sticks while the text still fits; once the user moves on to
  // text that doesn't, go back to auto so the next compatible text is compact.
  if (preference.value === 'off' && analysis.value.kind !== 'compatible') {
    preference.value = 'auto'
  }
})

/** The string compact mode would encode: the text as-is, or its uppercased form. */
const compactTarget = computed(() => {
  const a = analysis.value
  if (a.kind === 'compatible') return data.value
  if (a.kind === 'uppercasable') return a.uppercased
  return null
})

const compactMode = computed(() => {
  const a = analysis.value
  if (a.kind === 'compatible') return a.mode
  return 'Alphanumeric' as const
})

const byteSize = computed(() => symbolSize(data.value, props.ecLevel, 'Byte'))
const compactSize = computed(() =>
  compactTarget.value ? symbolSize(compactTarget.value, props.ecLevel, compactMode.value) : null
)
const shrinksSymbol = computed(
  () => byteSize.value !== null && compactSize.value !== null && compactSize.value < byteSize.value
)
const bitsSavedPercent = computed(() => {
  if (!compactTarget.value) return 0
  const byteBits = payloadBits(data.value, 'Byte')
  const compactBits = payloadBits(compactTarget.value, compactMode.value)
  return byteBits > 0 ? Math.round((1 - compactBits / byteBits) * 100) : 0
})

const blockers = computed(() => (analysis.value.kind === 'blocked' ? analysis.value.chars : []))
const visibleBlockers = computed(() => blockers.value.slice(0, MAX_BLOCKER_CHIPS))
const hiddenBlockerCount = computed(() => blockers.value.length - visibleBlockers.value.length)

/**
 * The lowercase URL path to quote in the heads-up — shown before uppercasing,
 * and after it for as long as Undo is still on offer.
 */
const warnedPath = computed(() => {
  const a = analysis.value
  const path =
    a.kind === 'uppercasable'
      ? a.caseSensitivePath
      : canUndoUppercase.value
        ? caseSensitiveUrlPath(uppercaseUndo.value!.original)
        : null
  if (!path) return null
  return path.length > MAX_PATH_PREVIEW ? `${path.slice(0, MAX_PATH_PREVIEW - 1)}…` : path
})

const statusText = computed(() => {
  const a = analysis.value
  const size = `${compactSize.value}×${compactSize.value}`
  switch (a.kind) {
    case 'empty':
      return t('Encodes 0–9, A–Z, space and $ % * + - . / : more compactly than bytes.')
    case 'blocked':
      return t('Needs byte mode because of')
    case 'uppercasable':
      return shrinksSymbol.value
        ? t('Turn on to uppercase your text and shrink the code to {size}.', { size })
        : t('Turn on to uppercase your text for compact encoding.')
    case 'compatible':
      if (!isOn.value) {
        return shrinksSymbol.value
          ? t('Off — encoding as bytes. Turn on to shrink to {size}.', { size })
          : t('Off — encoding as bytes.')
      }
      if (a.mode === 'Numeric') {
        return t('Digits only — packed in Numeric mode, the tightest QR encoding.')
      }
      return shrinksSymbol.value
        ? t('Smaller code: {n} fewer modules per side than byte mode.', {
            n: byteSize.value! - compactSize.value!
          })
        : t(
            'Same size at this length, with {pct}% fewer data bits — the gap grows with longer text.',
            { pct: bitsSavedPercent.value }
          )
  }
  return ''
})

function setOn(on: boolean) {
  const a = analysis.value
  if (on) {
    if (a.kind === 'uppercasable') {
      uppercaseUndo.value = { original: data.value, uppercased: a.uppercased }
      data.value = a.uppercased
    }
    preference.value = 'auto'
    return
  }
  if (canUndoUppercase.value) {
    undoUppercase()
    return
  }
  preference.value = 'off'
}

function onChange(event: Event) {
  const input = event.target as HTMLInputElement
  setOn(input.checked)
  // The checked state is derived from the text; if nothing could change
  // (e.g. a blocked string), snap the native control back to the truth.
  input.checked = isOn.value
}

function undoUppercase() {
  if (!uppercaseUndo.value) return
  const { original } = uppercaseUndo.value
  uppercaseUndo.value = null
  data.value = original
}
</script>

<template>
  <div class="compact-encoding flex min-w-0 flex-col gap-1" data-testid="compact-encoding">
    <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
      <input
        id="compact-encoding"
        type="checkbox"
        :checked="isOn"
        :disabled="isDisabled"
        aria-describedby="compact-encoding-hint"
        @change="onChange"
      />
      <label
        for="compact-encoding"
        class="!self-center text-sm font-medium text-zinc-800 dark:text-zinc-100"
        :class="
          isDisabled ? 'cursor-not-allowed text-zinc-500 dark:text-zinc-400' : 'cursor-pointer'
        "
        :title="t('Compact charset: {charset}', { charset: CHARSET_LABEL })"
      >
        {{ t('Alphanumeric mode') }}
      </label>
      <span
        v-if="isOn && compactMode === 'Numeric'"
        class="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
      >
        {{ t('Numeric') }}
      </span>
      <span
        v-if="isOn && byteSize && compactSize"
        class="compact-size inline-flex items-baseline gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs tabular-nums text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
        :aria-label="
          shrinksSymbol
            ? t('{compact} modules instead of {byte}', {
                compact: `${compactSize}×${compactSize}`,
                byte: `${byteSize}×${byteSize}`
              })
            : undefined
        "
      >
        <span class="font-medium">{{ compactSize }}×{{ compactSize }}</span>
        <s v-if="shrinksSymbol" class="text-zinc-400 dark:text-zinc-400"
          >{{ byteSize }}×{{ byteSize }}</s
        >
      </span>
    </div>

    <div id="compact-encoding-hint" class="compact-hint ms-7" aria-live="polite">
      <p :class="{ 'flex flex-wrap items-center gap-1': analysis.kind === 'blocked' }">
        <span>{{ statusText }}</span>
        <template v-if="analysis.kind === 'blocked'">
          <code
            v-for="ch in visibleBlockers"
            :key="ch"
            class="compact-chip"
            :title="`U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`"
            >{{ describeChar(ch) }}</code
          >
          <span v-if="hiddenBlockerCount > 0">{{ t('+{n} more', { n: hiddenBlockerCount }) }}</span>
        </template>
      </p>
      <p v-if="canUndoUppercase">
        {{ t('Uppercased to fit.') }}
        <button type="button" class="compact-link" @click="undoUppercase">
          {{ t('Undo') }}
        </button>
      </p>
      <p v-if="warnedPath" class="compact-warning">
        {{
          t(
            'Heads-up: the URL path is case-sensitive on many sites — {path} and {upper} may be different pages.',
            {
              path: warnedPath,
              upper: uppercaseAscii(warnedPath)
            }
          )
        }}
      </p>
    </div>
  </div>
</template>

<style scoped>
/* The global checkbox rule outranks utility classes, so style disabled here. */
#compact-encoding:disabled {
  @apply cursor-not-allowed border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900;
}

/* Beat the global `p { text-lg font-semibold }` rule. */
.compact-hint p {
  @apply text-xs font-normal leading-relaxed text-zinc-500 dark:text-zinc-400;
}

.compact-hint p.compact-warning {
  @apply mt-0.5 text-amber-700 dark:text-amber-400;
}

.compact-link {
  @apply rounded-sm font-medium text-zinc-800 underline underline-offset-2 outline-none hover:text-zinc-950 focus-visible:ring-1 focus-visible:ring-zinc-700 dark:text-zinc-100 dark:hover:text-white dark:focus-visible:ring-zinc-200;
}

.compact-chip {
  @apply inline-grid min-w-[1.5rem] place-items-center rounded border border-zinc-200 bg-white px-1 font-mono text-[11px] leading-5 text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100;
}
</style>

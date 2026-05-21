<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useEditorStore } from '../store'
import type { IRNode } from '@shared/ir-types'

// A visual builder for Pace conditions used in $if/$ifelse.
// Conditions follow the pattern:  {field} operator value
// or compound:  condition1 && condition2  /  condition1 || condition2
//
// This component edits the FIRST argument (condition) of an $if/$ifelse node.
// It parses the existing raw text into parts and presents dropdowns/inputs.

const props = defineProps<{
  nodes: IRNode[]
  onChange: (next: IRNode[]) => void
}>()

const store = useEditorStore()

// Serialize nodes back to a raw condition string for display
function nodesToText(nodes: IRNode[]): string {
  return nodes.map((n) => {
    if (n.kind === 'text') return n.value
    if (n.kind === 'field') return `{${n.raw}}`
    return ''
  }).join('')
}

// Parse a simple condition string into parts
interface ConditionPart {
  left: string       // field ref or literal
  operator: string   // ==, !=, >, <, >=, <=
  right: string      // value to compare against
}

const OPERATORS = ['==', '!=', '>=', '<=', '>', '<'] as const

function parseCondition(text: string): ConditionPart | null {
  // Try to match:  '{...}' operator 'value'  or  {field} operator value
  for (const op of OPERATORS) {
    const idx = text.indexOf(` ${op} `)
    if (idx >= 0) {
      return {
        left: text.slice(0, idx).trim(),
        operator: op,
        right: text.slice(idx + op.length + 2).trim(),
      }
    }
    // Also without spaces
    const idx2 = text.indexOf(op)
    if (idx2 > 0 && !OPERATORS.some((o) => o !== op && o.length > op.length && text.includes(o))) {
      return {
        left: text.slice(0, idx2).trim(),
        operator: op,
        right: text.slice(idx2 + op.length).trim(),
      }
    }
  }
  return null
}

const rawText = computed(() => nodesToText(props.nodes))
const parsed = computed(() => parseCondition(rawText.value))

// Editable state
const useVisual = ref(parsed.value !== null)
const leftField = ref(parsed.value?.left ?? '')
const operator = ref(parsed.value?.operator ?? '==')
const rightValue = ref(parsed.value?.right ?? '')
const rawEdit = ref(rawText.value)

// Sync when props change externally
watch(() => rawText.value, (newText) => {
  const p = parseCondition(newText)
  if (p) {
    leftField.value = p.left
    operator.value = p.operator
    rightValue.value = p.right
  }
  rawEdit.value = newText
})

function applyVisual(): void {
  const text = `${leftField.value} ${operator.value} ${rightValue.value}`
  props.onChange([{ kind: 'text', value: text }])
}

function applyRaw(): void {
  props.onChange([{ kind: 'text', value: rawEdit.value }])
}

function setLeftFromCatalog(raw: string): void {
  // Wrap in quotes + braces to match Pace convention for string comparisons
  leftField.value = `'{${raw}}'`
  applyVisual()
}
</script>

<template>
  <div class="space-y-1.5">
    <div class="flex items-center gap-1 text-[10px]">
      <button
        class="rounded px-1.5 py-0.5"
        :class="useVisual ? 'bg-blue-100 text-blue-800 font-semibold' : 'text-slate-500 hover:bg-slate-100'"
        @click="useVisual = true"
      >Visueel</button>
      <button
        class="rounded px-1.5 py-0.5"
        :class="!useVisual ? 'bg-blue-100 text-blue-800 font-semibold' : 'text-slate-500 hover:bg-slate-100'"
        @click="useVisual = false"
      >Handmatig</button>
    </div>

    <template v-if="useVisual">
      <div class="flex flex-wrap items-center gap-1">
        <!-- Left side: field or expression -->
        <div class="flex-1 min-w-0">
          <input
            v-model="leftField"
            class="mono w-full rounded border border-slate-300 px-1.5 py-1 text-xs"
            placeholder="bijv. {471: id} of '{803: Method}'"
            @change="applyVisual"
          />
        </div>

        <!-- Operator -->
        <select
          v-model="operator"
          class="rounded border border-slate-300 px-1 py-1 text-xs font-semibold"
          @change="applyVisual"
        >
          <option v-for="op in OPERATORS" :key="op" :value="op">{{ op }}</option>
        </select>

        <!-- Right side: value -->
        <div class="flex-1 min-w-0">
          <input
            v-model="rightValue"
            class="mono w-full rounded border border-slate-300 px-1.5 py-1 text-xs"
            placeholder="bijv. 'door-to-door' of 1"
            @change="applyVisual"
          />
        </div>
      </div>

      <!-- Quick field picker from catalog -->
      <div v-if="store.catalog.length > 0" class="flex flex-wrap gap-0.5">
        <button
          v-for="entry in store.catalog.slice(0, 12)"
          :key="entry.raw"
          class="rounded bg-emerald-50 px-1 py-0.5 text-[10px] text-emerald-800 hover:bg-emerald-100"
          :title="entry.raw"
          @click="setLeftFromCatalog(entry.raw)"
        >{{ entry.id }}</button>
      </div>

      <div class="text-[10px] text-slate-400 mono">
        {{ rawText || '(leeg)' }}
      </div>
    </template>

    <template v-else>
      <input
        v-model="rawEdit"
        class="mono w-full rounded border border-slate-300 px-1.5 py-1 text-xs"
        placeholder="conditie, bijv. {471: id} == 1"
        @change="applyRaw"
      />
    </template>
  </div>
</template>

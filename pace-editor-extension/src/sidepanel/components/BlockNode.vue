<script setup lang="ts">
import type { IRNode, FuncArg } from '@shared/ir-types'
import BlockTree from './BlockTree.vue'
import FieldPicker from './FieldPicker.vue'
import ConditionBuilder from './ConditionBuilder.vue'

const props = defineProps<{
  node: IRNode
  index: number
  last: boolean
  onReplace: (next: IRNode | null) => void
  onInsertAfter: (next: IRNode) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDragStart: (ev: DragEvent) => void
  onDragEnd: () => void
}>()

const FUNCTION_NAMES = [
  '$if', '$ifelse', '$concat', '$var', '$date', '$storevar',
  '$substr', '$replace', '$strtolower', '$strtoupper', '$trim',
  '$strlen', '$pad', '$count', '$linebreak', '$tab', '$semicolon',
  '$rem', '$query', '$getuuid',
] as const

// User-friendly labels for function arguments
const ARG_LABELS: Record<string, string[]> = {
  $if: ['Conditie', 'Dan'],
  $ifelse: ['Conditie', 'Dan', 'Anders'],
  $date: ['Bron (leeg = vandaag)', 'Formaat (bijv. %d-%m-%Y)'],
  $substr: ['Tekst', 'Start, lengte'],
  $replace: ['Zoeken', 'Vervangen door', 'In tekst'],
  $pad: ['Tekst', 'Lengte', 'Teken', 'Richting (left/right)'],
  $var: ['Naam', 'Waarde (leeg = lezen)'],
  $storevar: ['Naam'],
  $concat: ['Deel 1', 'Deel 2', 'Deel 3', 'Deel 4'],
  $strtolower: ['Tekst'],
  $strtoupper: ['Tekst'],
  $trim: ['Tekst'],
  $strlen: ['Tekst'],
  $rem: ['Opmerking'],
  $query: ['SQL query'],
}

// Functions whose first arg is a condition (should use ConditionBuilder)
const CONDITION_FUNCS = new Set(['$if', '$ifelse'])

// User-friendly names
const FUNC_DISPLAY: Record<string, string> = {
  $if: 'Als',
  $ifelse: 'Als / Anders',
  $date: 'Datum',
  $substr: 'Substring',
  $replace: 'Vervangen',
  $var: 'Variabele',
  $storevar: 'Opslaan var',
  $concat: 'Samenvoegen',
  $strtolower: 'Kleine letters',
  $strtoupper: 'Hoofdletters',
  $trim: 'Trim',
  $strlen: 'Lengte',
  $pad: 'Opvullen',
  $count: 'Teller',
  $linebreak: 'Regelafbreking',
  $tab: 'Tab',
  $semicolon: 'Puntkomma',
  $rem: 'Opmerking',
  $query: 'SQL query',
  $getuuid: 'UUID',
}

// Color scheme per function for visual clarity
function funcColor(name: string): string {
  if (name === '$if' || name === '$ifelse') return 'bg-amber-100 text-amber-900 border-amber-200'
  if (name === '$var' || name === '$storevar') return 'bg-sky-100 text-sky-900 border-sky-200'
  if (name === '$date') return 'bg-purple-100 text-purple-900 border-purple-200'
  if (name === '$replace' || name === '$substr') return 'bg-orange-100 text-orange-900 border-orange-200'
  if (name === '$rem') return 'bg-slate-100 text-slate-500 border-slate-200'
  return 'bg-violet-100 text-violet-800 border-violet-200'
}

function argLabel(funcName: string, argIndex: number): string {
  return ARG_LABELS[funcName]?.[argIndex] ?? `Argument ${argIndex + 1}`
}

function updateText(value: string): void {
  props.onReplace({ kind: 'text', value })
}

function updateField(raw: string): void {
  props.onReplace({ kind: 'field', raw })
}

function renameFunc(name: string): void {
  if (props.node.kind !== 'func') return
  // When switching function type, adjust arg count to match expected
  const expectedArgs = ARG_LABELS[name]?.length
  let args = props.node.args
  if (args && expectedArgs && args.length < expectedArgs) {
    args = [...args]
    while (args.length < expectedArgs) args.push({ nodes: [] })
  }
  props.onReplace({ kind: 'func', name, args })
}

function updateFuncArg(argIndex: number, nextNodes: IRNode[]): void {
  if (props.node.kind !== 'func' || !props.node.args) return
  const args = props.node.args.map((a, i) =>
    i === argIndex ? { ...a, nodes: nextNodes } : a,
  )
  props.onReplace({ ...props.node, args })
}

function addArg(): void {
  if (props.node.kind !== 'func') return
  const next: FuncArg = { nodes: [] }
  const args = props.node.args ? [...props.node.args, next] : [next]
  props.onReplace({ ...props.node, args })
}

function removeArg(argIndex: number): void {
  if (props.node.kind !== 'func' || !props.node.args) return
  const args = props.node.args.slice()
  args.splice(argIndex, 1)
  props.onReplace({ ...props.node, args })
}

function toggleBrackets(): void {
  if (props.node.kind !== 'func') return
  if (props.node.args === null) {
    props.onReplace({ ...props.node, args: [] })
  } else {
    props.onReplace({ ...props.node, args: null })
  }
}

function isConditionArg(funcName: string, argIndex: number): boolean {
  return CONDITION_FUNCS.has(funcName) && argIndex === 0
}
</script>

<template>
  <div class="rounded border" :class="node.kind === 'func' ? funcColor(node.kind === 'func' ? node.name : '') : 'border-slate-200 bg-slate-50/50'">
    <header class="flex items-center gap-2 border-b px-2 py-1"
      :class="node.kind === 'func' ? 'border-inherit bg-white/60' : 'border-slate-200 bg-white'">
      <span
        draggable="true"
        class="cursor-grab select-none rounded px-1 text-slate-400 hover:bg-slate-100 active:cursor-grabbing"
        title="Versleep om te verplaatsen"
        @dragstart.stop="(ev: DragEvent) => onDragStart(ev)"
        @dragend.stop="onDragEnd"
      >&#x22EE;&#x22EE;</span>

      <!-- Type badge -->
      <span
        v-if="node.kind === 'text'"
        class="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-700"
      >Tekst</span>
      <span
        v-else-if="node.kind === 'field'"
        class="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-800"
      >Veld</span>

      <!-- Function selector with friendly name -->
      <template v-if="node.kind === 'func'">
        <select
          class="rounded border border-slate-300 bg-white px-1 py-0.5 text-xs"
          :value="node.name"
          @change="(e) => renameFunc((e.target as HTMLSelectElement).value)"
        >
          <option v-for="n in FUNCTION_NAMES" :key="n" :value="n">
            {{ FUNC_DISPLAY[n] ?? n }}
          </option>
          <option
            v-if="!FUNCTION_NAMES.includes(node.name as typeof FUNCTION_NAMES[number])"
            :value="node.name"
          >{{ node.name }}</option>
        </select>
        <code class="text-[10px] text-slate-400">{{ node.name }}</code>
      </template>

      <div class="ml-auto flex items-center gap-0.5 text-[11px] text-slate-500">
        <button
          v-if="node.kind === 'func'"
          class="rounded px-1 hover:bg-slate-100"
          :title="node.args === null ? 'Argumenten toevoegen' : 'Argumenten verwijderen'"
          @click="toggleBrackets"
        >[ ]</button>
        <button
          class="rounded px-1 hover:bg-slate-100"
          :disabled="index === 0"
          :class="{ 'opacity-30': index === 0 }"
          @click="onMoveUp"
        >&uarr;</button>
        <button
          class="rounded px-1 hover:bg-slate-100"
          :disabled="last"
          :class="{ 'opacity-30': last }"
          @click="onMoveDown"
        >&darr;</button>
        <button
          class="rounded px-1 text-rose-700 hover:bg-rose-50"
          title="Verwijderen"
          @click="onReplace(null)"
        >&times;</button>
      </div>
    </header>

    <div class="p-2">
      <!-- TEXT node -->
      <textarea
        v-if="node.kind === 'text'"
        class="mono w-full rounded border border-slate-300 p-1.5 text-xs"
        :value="node.value"
        rows="1"
        spellcheck="false"
        @input="(e) => updateText((e.target as HTMLTextAreaElement).value)"
      />

      <!-- FIELD node -->
      <FieldPicker
        v-else-if="node.kind === 'field'"
        :raw="node.raw"
        :on-change="updateField"
      />

      <!-- FUNC node -->
      <div v-else-if="node.kind === 'func'">
        <p
          v-if="node.args === null"
          class="text-xs italic text-slate-500"
        >Geen argumenten (standalone functie)</p>
        <div v-else class="space-y-2">
          <div
            v-for="(arg, ai) in node.args"
            :key="ai"
            class="rounded border bg-white"
            :class="isConditionArg(node.name, ai) ? 'border-amber-200' : 'border-slate-200'"
          >
            <div class="flex items-center gap-1 border-b bg-slate-50 px-1.5 py-0.5 text-[11px]"
              :class="isConditionArg(node.name, ai) ? 'border-amber-200 bg-amber-50' : 'border-slate-100'">
              <span class="font-semibold" :class="isConditionArg(node.name, ai) ? 'text-amber-800' : 'text-slate-600'">
                {{ argLabel(node.name, ai) }}
              </span>
              <button
                class="ml-auto rounded px-1 text-rose-700 hover:bg-rose-50"
                @click="removeArg(ai)"
              >&times;</button>
            </div>
            <div class="p-2">
              <!-- Use ConditionBuilder for condition arguments -->
              <ConditionBuilder
                v-if="isConditionArg(node.name, ai)"
                :nodes="arg.nodes"
                :on-change="(next: IRNode[]) => updateFuncArg(ai, next)"
              />
              <!-- Use recursive BlockTree for other arguments -->
              <BlockTree
                v-else
                :nodes="arg.nodes"
                :on-change="(next: IRNode[]) => updateFuncArg(ai, next)"
              />
            </div>
          </div>
          <button
            class="rounded border border-dashed border-slate-300 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
            @click="addArg"
          >+ argument</button>
        </div>
      </div>
    </div>
  </div>
</template>

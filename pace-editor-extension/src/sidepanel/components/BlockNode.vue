<script setup lang="ts">
import type { IRNode, FuncArg } from '@shared/ir-types'
import BlockTree from './BlockTree.vue'
import FieldPicker from './FieldPicker.vue'

const props = defineProps<{
  node: IRNode
  index: number
  last: boolean
  onReplace: (next: IRNode | null) => void
  onInsertAfter: (next: IRNode) => void
  onMoveUp: () => void
  onMoveDown: () => void
}>()

const FUNCTION_NAMES = [
  '$if', '$ifelse', '$concat', '$var', '$storevar', '$date',
  '$substr', '$replace', '$strtolower', '$strtoupper', '$trim',
  '$strlen', '$pad', '$count', '$linebreak', '$tab', '$semicolon',
] as const

const ARG_HINTS: Record<string, string[]> = {
  $if: ['condition', 'then', 'else'],
  $ifelse: ['value', 'then', 'else'],
  $date: ['format', 'sourceDate?'],
  $substr: ['string', 'start', 'length?'],
  $replace: ['search', 'replace', 'subject'],
  $pad: ['string', 'length', 'padChar?', 'direction?'],
  $storevar: ['name', 'value'],
  $var: ['name'],
}

function updateText(value: string): void {
  props.onReplace({ kind: 'text', value })
}

function updateField(raw: string): void {
  props.onReplace({ kind: 'field', raw })
}

function renameFunc(name: string): void {
  if (props.node.kind !== 'func') return
  props.onReplace({ kind: 'func', name, args: props.node.args })
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
  const next: FuncArg = { prefix: ' ', nodes: [] }
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
</script>

<template>
  <div class="rounded border border-slate-200 bg-slate-50/50">
    <header class="flex items-center gap-2 border-b border-slate-200 bg-white px-2 py-1">
      <span
        class="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
        :class="{
          'bg-slate-200 text-slate-700': node.kind === 'text',
          'bg-emerald-100 text-emerald-800': node.kind === 'field',
          'bg-violet-100 text-violet-800': node.kind === 'func',
        }"
      >{{ node.kind }}</span>
      <select
        v-if="node.kind === 'func'"
        class="rounded border border-slate-300 px-1 py-0.5 text-xs"
        :value="node.name"
        @change="(e) => renameFunc((e.target as HTMLSelectElement).value)"
      >
        <option v-for="n in FUNCTION_NAMES" :key="n" :value="n">{{ n }}</option>
        <option v-if="!FUNCTION_NAMES.includes(node.name as typeof FUNCTION_NAMES[number])" :value="node.name">{{ node.name }}</option>
      </select>
      <span v-else-if="node.kind === 'field'" class="text-xs text-slate-500">{ … }</span>
      <span v-else class="text-xs text-slate-500">literal</span>

      <div class="ml-auto flex items-center gap-0.5 text-[11px] text-slate-500">
        <button
          v-if="node.kind === 'func'"
          class="rounded px-1 hover:bg-slate-100"
          :title="node.args === null ? 'Add brackets' : 'Remove brackets'"
          @click="toggleBrackets"
        >[ ]</button>
        <button
          class="rounded px-1 hover:bg-slate-100"
          :disabled="index === 0"
          :class="{ 'opacity-30': index === 0 }"
          @click="onMoveUp"
        >↑</button>
        <button
          class="rounded px-1 hover:bg-slate-100"
          :disabled="last"
          :class="{ 'opacity-30': last }"
          @click="onMoveDown"
        >↓</button>
        <button
          class="rounded px-1 text-rose-700 hover:bg-rose-50"
          title="Verwijderen"
          @click="onReplace(null)"
        >×</button>
      </div>
    </header>

    <div class="p-2">
      <textarea
        v-if="node.kind === 'text'"
        class="mono w-full rounded border border-slate-300 p-1.5"
        :value="node.value"
        rows="1"
        spellcheck="false"
        @input="(e) => updateText((e.target as HTMLTextAreaElement).value)"
      />

      <FieldPicker
        v-else-if="node.kind === 'field'"
        :raw="node.raw"
        :on-change="updateField"
      />

      <div v-else-if="node.kind === 'func'">
        <p
          v-if="node.args === null"
          class="text-xs italic text-slate-500"
        >Geen argumenten (zonder haakjes)</p>
        <div v-else class="space-y-2">
          <div
            v-for="(arg, ai) in node.args"
            :key="ai"
            class="rounded border border-slate-200 bg-white"
          >
            <div class="flex items-center gap-1 border-b border-slate-100 bg-slate-50 px-1.5 py-0.5 text-[11px]">
              <span class="font-semibold text-slate-600">arg {{ ai + 1 }}</span>
              <span class="text-slate-400">{{ ARG_HINTS[node.name]?.[ai] ?? '' }}</span>
              <button
                class="ml-auto rounded px-1 text-rose-700 hover:bg-rose-50"
                @click="removeArg(ai)"
              >×</button>
            </div>
            <div class="p-2">
              <BlockTree
                :nodes="arg.nodes"
                :on-change="(next: IRNode[]) => updateFuncArg(ai, next)"
              />
            </div>
          </div>
          <button
            class="rounded border border-dashed border-slate-300 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
            @click="addArg"
          >+ arg</button>
        </div>
      </div>
    </div>
  </div>
</template>

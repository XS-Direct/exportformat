<script setup lang="ts">
import type { IRNode, IRTree } from '@shared/ir-types'
import BlockNode from './BlockNode.vue'

const props = defineProps<{
  nodes: IRTree
  onChange: (next: IRTree) => void
}>()

function replaceAt(index: number, replacement: IRNode | null): void {
  const copy = props.nodes.slice()
  if (replacement === null) copy.splice(index, 1)
  else copy[index] = replacement
  props.onChange(copy)
}

function insertAfter(index: number, node: IRNode): void {
  const copy = props.nodes.slice()
  copy.splice(index + 1, 0, node)
  props.onChange(copy)
}

function moveUp(index: number): void {
  if (index === 0) return
  const copy = props.nodes.slice()
  ;[copy[index - 1], copy[index]] = [copy[index], copy[index - 1]]
  props.onChange(copy)
}

function moveDown(index: number): void {
  if (index >= props.nodes.length - 1) return
  const copy = props.nodes.slice()
  ;[copy[index + 1], copy[index]] = [copy[index], copy[index + 1]]
  props.onChange(copy)
}

function appendNew(kind: IRNode['kind']): void {
  const copy = props.nodes.slice()
  if (kind === 'text') copy.push({ kind: 'text', value: '' })
  else if (kind === 'field') copy.push({ kind: 'field', raw: '471: id' })
  else copy.push({ kind: 'func', name: '$ifelse', args: [
    { prefix: '', nodes: [] },
    { prefix: ' ', nodes: [] },
    { prefix: ' ', nodes: [] },
  ] })
  props.onChange(copy)
}
</script>

<template>
  <div class="space-y-1">
    <BlockNode
      v-for="(node, i) in nodes"
      :key="i"
      :node="node"
      :index="i"
      :last="i === nodes.length - 1"
      :on-replace="(n) => replaceAt(i, n)"
      :on-insert-after="(n) => insertAfter(i, n)"
      :on-move-up="() => moveUp(i)"
      :on-move-down="() => moveDown(i)"
    />
    <div class="flex gap-1 pt-1">
      <button
        class="rounded border border-dashed border-slate-300 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
        @click="appendNew('text')"
      >+ Tekst</button>
      <button
        class="rounded border border-dashed border-slate-300 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
        @click="appendNew('field')"
      >+ Veld</button>
      <button
        class="rounded border border-dashed border-slate-300 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
        @click="appendNew('func')"
      >+ Functie</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
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
    { nodes: [] },
    { nodes: [] },
    { nodes: [] },
  ] })
  props.onChange(copy)
}

// Drag-drop within the current sibling list only. Cross-array drag (eg.
// dragging a child of $if's then-branch into the else-branch) is out of
// scope — each BlockTree owns its own drag state, so dragging out of one
// list just cancels at the boundary.
//
// Drag handles live in BlockNode's header; the entire BlockNode is *not*
// itself draggable. That keeps textareas, selects and inputs interactive
// without the browser pre-empting clicks as drag starts.
const dragIndex = ref<number | null>(null)
const dropIndex = ref<number | null>(null)

function onDragStart(index: number, ev: DragEvent): void {
  dragIndex.value = index
  if (ev.dataTransfer) {
    ev.dataTransfer.effectAllowed = 'move'
    ev.dataTransfer.setData('text/plain', String(index))
  }
}

function onDragOver(index: number, ev: DragEvent): void {
  if (dragIndex.value === null) return
  ev.preventDefault()
  if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move'
  dropIndex.value = index
}

function onDrop(index: number, ev: DragEvent): void {
  ev.preventDefault()
  const from = dragIndex.value
  dragIndex.value = null
  dropIndex.value = null
  if (from === null || from === index || from === index - 1) return
  const copy = props.nodes.slice()
  const [moved] = copy.splice(from, 1)
  const target = index > from ? index - 1 : index
  copy.splice(target, 0, moved)
  props.onChange(copy)
}

function onDragEnd(): void {
  dragIndex.value = null
  dropIndex.value = null
}
</script>

<template>
  <div class="space-y-1">
    <template v-for="(node, i) in nodes" :key="i">
      <div
        class="h-1 -my-0.5 rounded transition-colors"
        :class="dropIndex === i && dragIndex !== null ? 'bg-blue-400' : 'bg-transparent'"
        @dragover.stop="(ev: DragEvent) => onDragOver(i, ev)"
        @drop.stop="(ev: DragEvent) => onDrop(i, ev)"
      />
      <div
        class="transition-opacity"
        :class="{ 'opacity-50': dragIndex === i }"
        @dragover.stop="(ev: DragEvent) => onDragOver(i, ev)"
        @drop.stop="(ev: DragEvent) => onDrop(i, ev)"
      >
        <BlockNode
          :node="node"
          :index="i"
          :last="i === nodes.length - 1"
          :on-replace="(n: IRNode | null) => replaceAt(i, n)"
          :on-insert-after="(n: IRNode) => insertAfter(i, n)"
          :on-move-up="() => moveUp(i)"
          :on-move-down="() => moveDown(i)"
          :on-drag-start="(ev: DragEvent) => onDragStart(i, ev)"
          :on-drag-end="onDragEnd"
        />
      </div>
    </template>
    <div
      class="h-1 rounded transition-colors"
      :class="dropIndex === nodes.length && dragIndex !== null ? 'bg-blue-400' : 'bg-transparent'"
      @dragover.stop="(ev: DragEvent) => onDragOver(nodes.length, ev)"
      @drop.stop="(ev: DragEvent) => onDrop(nodes.length, ev)"
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

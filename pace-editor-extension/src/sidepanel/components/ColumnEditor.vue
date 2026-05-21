<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEditorStore } from '../store'
import { parse } from '@shared/parser'
import { serialize } from '@shared/serializer'
import { evaluate, createContext } from '@shared/evaluator'
import { buildAutoFixtures } from '@shared/auto-fixtures'
import type { IRNode, IRTree } from '@shared/ir-types'

const store = useEditorStore()

// The Pace repeating code is columns separated by &#9; (tab entity).
// We split the IR tree into column segments at &#9; boundaries.

interface Column {
  nodes: IRNode[]       // IR nodes for this column
  code: string          // serialized Pace code
  preview: string       // evaluated with sample data
  headerName: string    // column name from Code before header
}

// Try to extract header names from Code Before.
// Only map if the Code Before uses the SAME separator (&#9;) as the repeating code
// and the column count matches.
const headerNames = computed(() => {
  const raw = store.codeBefore
  if (!raw) return []
  // Strip $var/$storevar/$rem calls
  const cleaned = raw.replace(/\$(?:var|storevar|rem)\[[^\]]*\](?:\[[^\]]*\])?/g, '').trim()
  // Only use header names if Code Before uses &#9; (same as repeating code)
  if (!cleaned.includes('&#9;') && !cleaned.includes('\t')) return []
  const names = cleaned.split(/&#9;|\t/).map((s) => s.replace(/"/g, '').trim()).filter(Boolean)
  // Only map if column count is close enough
  const colCount = (store.repeatingCode.match(/&#9;/g) || []).length + 1
  if (Math.abs(names.length - colCount) > 2) return [] // too different, don't map
  return names
})

// Split IR tree into columns by &#9; separator
function splitIntoColumns(tree: IRTree): IRNode[][] {
  const columns: IRNode[][] = [[]]
  for (const node of tree) {
    if (node.kind === 'text' && node.value.includes('&#9;')) {
      // Split this text node at tab boundaries
      const parts = node.value.split('&#9;')
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) columns.push([]) // new column
        if (parts[i]) {
          columns[columns.length - 1].push({ kind: 'text', value: parts[i] })
        }
      }
    } else {
      columns[columns.length - 1].push(node)
    }
  }
  return columns
}

// Rejoin columns back into a flat IR tree with &#9; separators
function joinColumns(cols: IRNode[][]): IRTree {
  const tree: IRNode[] = []
  for (let i = 0; i < cols.length; i++) {
    if (i > 0) tree.push({ kind: 'text', value: '&#9;' })
    tree.push(...cols[i])
  }
  return tree
}

// Generate sample data for preview
const sampleFields = computed(() => {
  const fixture = buildAutoFixtures(store.snapshot?.title ?? '', store.codeBefore, store.repeatingCode, store.codeAfter)
  if (fixture.scenarios.length === 0) return new Map<string, string>()
  return new Map(Object.entries(fixture.scenarios[0].record.fields))
})

function previewColumn(nodes: IRNode[]): string {
  try {
    const ctx = createContext(sampleFields.value, 0)
    // Seed common vars
    ctx.vars.set('count', '1')
    ctx.vars.set('amount', '10')
    return evaluate(nodes, ctx)
  } catch {
    return '(fout)'
  }
}

const columns = computed<Column[]>(() => {
  const tree = store.parsed.tree
  const cols = splitIntoColumns(tree)
  return cols.map((nodes, i) => ({
    nodes,
    code: serialize(nodes),
    preview: previewColumn(nodes),
    headerName: headerNames.value[i] ?? columnTitle(nodes, i, ''),
  }))
})

// Parse Code Before header for the CSV preview table
// Detect which separator is used and split accordingly
const codeBeforeHeaders = computed(() => {
  const raw = store.codeBefore
  if (!raw) return []
  const cleaned = raw.replace(/\$(?:var|storevar|rem)\[[^\]]*\](?:\[[^\]]*\])?/g, '').trim()
  if (!cleaned) return []
  // Detect separator: &#9;/tab first, then ;, then ,
  let sep: string | RegExp
  if (cleaned.includes('&#9;') || cleaned.includes('\t')) {
    sep = /&#9;|\t/
  } else if (cleaned.includes(';')) {
    sep = ';'
  } else if (cleaned.includes(',')) {
    sep = ','
  } else {
    return [cleaned]
  }
  return cleaned.split(sep).map((s) => s.replace(/"/g, '').trim()).filter(Boolean)
})

// Describe what a column contains in plain language
function describeColumn(nodes: IRNode[]): string {
  if (nodes.length === 0) return '(leeg)'
  // Collect all meaningful parts
  const parts: string[] = []
  collectDescriptions(nodes, parts)
  if (parts.length === 0) return `${nodes.length} elementen`
  return parts.slice(0, 3).join(', ') + (parts.length > 3 ? '...' : '')
}

function collectDescriptions(nodes: IRNode[], out: string[]): void {
  for (const n of nodes) {
    if (n.kind === 'field') {
      const colon = n.raw.indexOf(':')
      out.push(colon >= 0 ? n.raw.slice(colon + 1).trim() : n.raw)
    } else if (n.kind === 'text' && n.value.trim()) {
      const v = n.value.trim()
      if (v.length <= 20) out.push(`"${v}"`)
    } else if (n.kind === 'func') {
      if (n.name === '$var' || n.name === '$storevar' || n.name === '$rem') continue
      if (n.name === '$ifelse' || n.name === '$if') {
        // Look inside branches for field refs
        if (n.args) {
          for (const arg of n.args.slice(1)) { // skip condition
            collectDescriptions(arg.nodes, out)
          }
        }
      } else if (n.name === '$date') {
        out.push('Datum')
      } else if (n.name === '$substr') {
        if (n.args?.[0]) collectDescriptions(n.args[0].nodes, out)
      } else if (n.name === '$replace') {
        if (n.args?.[2]) collectDescriptions(n.args[2].nodes, out)
      } else {
        out.push(n.name)
      }
    }
  }
}

// Generate a short title for the column based on its primary field
function columnTitle(nodes: IRNode[], index: number, headerName: string): string {
  if (headerName) return headerName
  // Try to find the primary field
  const fields: string[] = []
  collectFieldLabels(nodes, fields)
  if (fields.length > 0) return fields[0]
  // Check for text literals
  for (const n of nodes) {
    if (n.kind === 'text' && n.value.trim()) return `"${n.value.trim().slice(0, 20)}"`
  }
  return `Kolom ${index + 1}`
}

function collectFieldLabels(nodes: IRNode[], out: string[]): void {
  for (const n of nodes) {
    if (n.kind === 'field') {
      const colon = n.raw.indexOf(':')
      out.push(colon >= 0 ? n.raw.slice(colon + 1).trim().split(':').pop()!.trim() : n.raw)
    } else if (n.kind === 'func' && n.args) {
      for (const arg of n.args) collectFieldLabels(arg.nodes, out)
    }
  }
}

function applyChanges(newCols: IRNode[][]): void {
  store.repeatingCode = serialize(joinColumns(newCols))
}

// Editing state
const editingIndex = ref<number | null>(null)
const editCode = ref('')

function startEdit(index: number): void {
  editingIndex.value = index
  editCode.value = columns.value[index].code
}

function saveEdit(): void {
  if (editingIndex.value === null) return
  const i = editingIndex.value
  const cols = splitIntoColumns(store.parsed.tree)
  cols[i] = parse(editCode.value).tree
  applyChanges(cols)
  editingIndex.value = null
}

function cancelEdit(): void {
  editingIndex.value = null
}

function removeColumn(index: number): void {
  const cols = splitIntoColumns(store.parsed.tree)
  cols.splice(index, 1)
  applyChanges(cols)
}

function addColumn(): void {
  const cols = splitIntoColumns(store.parsed.tree)
  cols.push([{ kind: 'text', value: '' }])
  applyChanges(cols)
}

function insertFieldColumn(raw: string): void {
  const cols = splitIntoColumns(store.parsed.tree)
  cols.push([{ kind: 'field', raw }])
  applyChanges(cols)
}

// Drag and drop
const dragIndex = ref<number | null>(null)
const dropTarget = ref<number | null>(null)

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
  dropTarget.value = index
}

function onDrop(index: number, ev: DragEvent): void {
  ev.preventDefault()
  const from = dragIndex.value
  dragIndex.value = null
  dropTarget.value = null
  if (from === null || from === index) return
  const cols = splitIntoColumns(store.parsed.tree)
  const [moved] = cols.splice(from, 1)
  cols.splice(index > from ? index - 1 : index, 0, moved)
  applyChanges(cols)
}

function onDragEnd(): void {
  dragIndex.value = null
  dropTarget.value = null
}
</script>

<template>
  <div class="space-y-2">
    <!-- Column cards as a visual spreadsheet row -->
    <div class="flex flex-wrap gap-1.5">
      <div
        v-for="(col, i) in columns"
        :key="i"
        class="group relative flex w-full cursor-pointer flex-col rounded border transition-all"
        :class="[
          dropTarget === i && dragIndex !== null ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-300',
          editingIndex === i ? 'ring-2 ring-blue-400' : '',
          dragIndex === i ? 'opacity-40' : '',
        ]"
        @dragover.prevent="(ev) => onDragOver(i, ev)"
        @drop="(ev) => onDrop(i, ev)"
      >
        <!-- Column header -->
        <div class="flex items-center gap-1 border-b border-slate-100 px-2 py-1">
          <span
            draggable="true"
            class="cursor-grab text-slate-300 hover:text-slate-500 active:cursor-grabbing"
            @dragstart="(ev) => onDragStart(i, ev)"
            @dragend="onDragEnd"
          >&#x2630;</span>
          <span class="text-[10px] font-bold text-slate-400">{{ i + 1 }}</span>
          <span class="truncate text-[11px] font-semibold text-slate-700">{{ col.headerName }}</span>
          <button
            class="ml-auto hidden rounded px-1 text-[11px] text-rose-500 hover:bg-rose-50 group-hover:block"
            title="Verwijder kolom"
            @click.stop="removeColumn(i)"
          >&times;</button>
        </div>

        <!-- Column content (view mode) -->
        <div v-if="editingIndex !== i" class="px-2 py-1.5" @click="startEdit(i)">
          <div class="text-[11px] text-slate-500">{{ describeColumn(col.nodes) }}</div>
          <div class="mono mt-0.5 truncate text-xs font-medium text-slate-800">
            {{ col.preview || '(leeg)' }}
          </div>
        </div>

        <!-- Column content (edit mode) -->
        <div v-else class="space-y-1.5 p-2" @click.stop>
          <textarea
            v-model="editCode"
            class="mono w-full rounded border border-blue-300 bg-blue-50/30 p-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
            rows="3"
            spellcheck="false"
            @keydown.enter.ctrl="saveEdit"
            @keydown.escape="cancelEdit"
          />
          <!-- Quick field insert -->
          <div v-if="store.catalog.length > 0" class="flex flex-wrap gap-0.5">
            <button
              v-for="entry in store.catalog.slice(0, 8)"
              :key="entry.raw"
              class="rounded bg-emerald-50 px-1 py-0.5 text-[9px] text-emerald-800 hover:bg-emerald-100"
              :title="entry.raw"
              @click="editCode += `{${entry.raw}}`"
            >{{ entry.label || entry.id }}</button>
          </div>
          <div class="flex gap-1">
            <button
              class="rounded bg-blue-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-blue-700"
              @click="saveEdit"
            >Opslaan</button>
            <button
              class="rounded border border-slate-300 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100"
              @click="cancelEdit"
            >Annuleer</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add column actions -->
    <div class="flex flex-wrap gap-1 pt-1">
      <button
        class="rounded border border-dashed border-slate-300 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
        @click="addColumn"
      >+ Kolom</button>
      <!-- Quick-add from catalog -->
      <button
        v-for="entry in store.catalog.slice(0, 6)"
        :key="entry.raw"
        class="rounded border border-dashed border-emerald-300 bg-emerald-50/50 px-2 py-1 text-[10px] text-emerald-700 hover:bg-emerald-100"
        :title="`Voeg {${entry.raw}} toe als kolom`"
        @click="insertFieldColumn(entry.raw)"
      >+ {{ entry.label || entry.id }}</button>
    </div>

    <!-- Live CSV preview -->
    <div class="mt-3 rounded border border-slate-200 bg-slate-900 p-2">
      <div class="mb-1 text-[10px] font-semibold uppercase text-slate-400">CSV Preview (rij 1)</div>
      <div class="mono overflow-x-auto text-[11px] text-slate-100">
        <table class="border-collapse">
          <thead v-if="codeBeforeHeaders.length > 0">
            <tr>
              <th
                v-for="(name, i) in codeBeforeHeaders"
                :key="'h'+i"
                class="border border-slate-700 bg-slate-800 px-2 py-0.5 text-left text-[10px] font-medium text-slate-300"
              >{{ name }}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td
                v-for="(col, i) in columns"
                :key="'v'+i"
                class="border border-slate-700 px-2 py-0.5 text-slate-200"
              >{{ col.preview || '' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="codeBeforeHeaders.length > 0 && codeBeforeHeaders.length !== columns.length" class="mt-1 text-[10px] text-amber-400">
        Let op: header heeft {{ codeBeforeHeaders.length }} kolommen, data heeft {{ columns.length }} kolommen
      </div>
    </div>
  </div>
</template>

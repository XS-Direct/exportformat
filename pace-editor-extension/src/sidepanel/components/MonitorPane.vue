<script setup lang="ts">
import { ref, computed } from 'vue'
import { useEditorStore } from '../store'
import { parse } from '@shared/parser'
import type { PaceModelInfo, ExtensionMessage } from '@shared/messages'

const store = useEditorStore()
const loading = ref(false)
const results = ref<ClientCheck[]>([])
const filter = ref('')

interface Issue {
  severity: 'error' | 'warning' | 'info'
  message: string
}

interface ModelCheck {
  model: PaceModelInfo
  codeBefore: string
  repeatingCode: string
  codeAfter: string
  headerCount: number
  dataColCount: number
  parseErrors: string[]
  issues: Issue[]
}

interface ClientCheck {
  client: string
  download: ModelCheck | null
  export_: ModelCheck | null
  differences: Issue[]
}

async function loadModelData(model: PaceModelInfo): Promise<ModelCheck> {
  const reply = await chrome.runtime.sendMessage<ExtensionMessage>({
    type: 'PACE_REQUEST_SNAPSHOT_BY_ID',
    blockId: model.id,
  })
  const snap = reply?.snapshot ?? { codeBefore: '', repeatingCode: '', codeAfter: '' }

  // Parse and validate
  const parsed = parse(snap.repeatingCode || '')
  const parseErrors = parsed.diagnostics.errors.map(
    (e) => `Regel ${e.line}, kol ${e.column}: ${e.message}`,
  )

  // Count header columns
  const cleanedHeader = (snap.codeBefore || '')
    .replace(/\$(?:var|storevar|rem)\[[^\]]*\](?:\[[^\]]*\])?/g, '')
    .trim()
  let headerCount = 0
  if (cleanedHeader) {
    if (cleanedHeader.includes('&#9;') || cleanedHeader.includes('\t')) {
      headerCount = cleanedHeader.split(/&#9;|\t/).filter(Boolean).length
    } else if (cleanedHeader.includes(';')) {
      headerCount = cleanedHeader.split(';').filter(Boolean).length
    } else if (cleanedHeader.includes(',')) {
      headerCount = cleanedHeader.split(',').filter(Boolean).length
    }
  }

  // Count data columns
  const tabCount = (snap.repeatingCode || '').split('&#9;').length - 1
  const semiTextCount = parsed.tree
    .filter((n) => n.kind === 'text')
    .reduce((c, n) => c + (n.value.match(/;/g) || []).length, 0)
  const dataColCount = tabCount > semiTextCount ? tabCount + 1 : semiTextCount + 1

  // Detect issues
  const issues: Issue[] = []

  if (parseErrors.length > 0) {
    issues.push({ severity: 'error', message: `${parseErrors.length} parse-fout(en)` })
  }

  if (headerCount > 0 && dataColCount > 0 && headerCount !== dataColCount) {
    issues.push({
      severity: 'warning',
      message: `Header: ${headerCount} kolommen, Data: ${dataColCount} kolommen`,
    })
  }

  if (!snap.repeatingCode || snap.repeatingCode.trim() === '') {
    issues.push({ severity: 'warning', message: 'Repeating code is leeg' })
  }

  if (!snap.codeBefore || snap.codeBefore.trim() === '') {
    issues.push({ severity: 'info', message: 'Geen Code Before (header)' })
  }

  return {
    model,
    codeBefore: snap.codeBefore || '',
    repeatingCode: snap.repeatingCode || '',
    codeAfter: snap.codeAfter || '',
    headerCount,
    dataColCount,
    parseErrors,
    issues,
  }
}

function compareModels(download: ModelCheck, export_: ModelCheck): Issue[] {
  const diffs: Issue[] = []

  // Compare column counts
  if (download.dataColCount !== export_.dataColCount) {
    diffs.push({
      severity: 'warning',
      message: `Kolom-aantal verschilt: Download ${download.dataColCount}, Export ${export_.dataColCount}`,
    })
  }

  // Compare headers
  if (download.codeBefore !== export_.codeBefore) {
    diffs.push({
      severity: 'info',
      message: 'Code Before (header) verschilt',
    })
  }

  // Compare repeating code length (big difference = suspicious)
  const lenDiff = Math.abs(download.repeatingCode.length - export_.repeatingCode.length)
  const avgLen = (download.repeatingCode.length + export_.repeatingCode.length) / 2
  if (avgLen > 0 && lenDiff / avgLen > 0.1) {
    diffs.push({
      severity: 'warning',
      message: `Repeating code verschilt significant (${download.repeatingCode.length} vs ${export_.repeatingCode.length} tekens)`,
    })
  } else if (download.repeatingCode !== export_.repeatingCode) {
    diffs.push({
      severity: 'info',
      message: 'Repeating code verschilt (kleine wijzigingen)',
    })
  }

  // Check Code After differences
  if (download.codeAfter !== export_.codeAfter) {
    diffs.push({
      severity: 'info',
      message: 'Code After verschilt',
    })
  }

  // If repeating codes are identical
  if (download.repeatingCode === export_.repeatingCode &&
      download.codeBefore === export_.codeBefore &&
      download.codeAfter === export_.codeAfter) {
    diffs.push({
      severity: 'info',
      message: 'Download en Export zijn identiek',
    })
  }

  return diffs
}

async function runCheck(): Promise<void> {
  loading.value = true
  results.value = []

  await store.loadModels()
  const models = store.models

  // Group by client
  const groups = new Map<string, PaceModelInfo[]>()
  for (const m of models) {
    const g = groups.get(m.client) ?? []
    g.push(m)
    groups.set(m.client, g)
  }

  for (const [client, group] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const downloadModel = group.find((m) => m.type === 'download')
    const exportModel = group.find((m) => m.type === 'export')

    let download: ModelCheck | null = null
    let export_: ModelCheck | null = null
    let differences: Issue[] = []

    try {
      if (downloadModel) download = await loadModelData(downloadModel)
      if (exportModel) export_ = await loadModelData(exportModel)

      if (download && export_) {
        differences = compareModels(download, export_)
      } else if (!downloadModel) {
        differences.push({ severity: 'info', message: 'Geen Download model' })
      } else if (!exportModel) {
        differences.push({ severity: 'warning', message: 'Geen Export model' })
      }
    } catch (err) {
      differences.push({ severity: 'error', message: (err as Error).message })
    }

    results.value.push({ client, download, export_: export_, differences })
  }

  loading.value = false
}

const filtered = computed(() => {
  const q = filter.value.trim().toLowerCase()
  if (!q) return results.value
  return results.value.filter((r) => r.client.toLowerCase().includes(q))
})

const errorCount = computed(() =>
  results.value.reduce((n, r) => {
    const all = [...(r.download?.issues ?? []), ...(r.export_?.issues ?? []), ...r.differences]
    return n + all.filter((i) => i.severity === 'error').length
  }, 0),
)

const warningCount = computed(() =>
  results.value.reduce((n, r) => {
    const all = [...(r.download?.issues ?? []), ...(r.export_?.issues ?? []), ...r.differences]
    return n + all.filter((i) => i.severity === 'warning').length
  }, 0),
)

function severityColor(s: string): string {
  if (s === 'error') return 'bg-rose-100 text-rose-800'
  if (s === 'warning') return 'bg-amber-100 text-amber-800'
  return 'bg-slate-100 text-slate-600'
}

function severityIcon(s: string): string {
  if (s === 'error') return 'X'
  if (s === 'warning') return '!'
  return 'i'
}
</script>

<template>
  <section class="space-y-3 p-3">
    <div class="flex items-center justify-between">
      <h2 class="text-sm font-semibold text-slate-700">Monitor</h2>
      <button
        class="rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        :disabled="loading"
        @click="runCheck"
      >{{ loading ? 'Checken...' : 'Check alle exports' }}</button>
    </div>

    <div v-if="results.length > 0" class="flex gap-3 text-xs">
      <span v-if="errorCount > 0" class="font-semibold text-rose-700">{{ errorCount }} fouten</span>
      <span v-if="warningCount > 0" class="font-semibold text-amber-700">{{ warningCount }} waarschuwingen</span>
      <span v-if="errorCount === 0 && warningCount === 0" class="text-emerald-700 font-semibold">Geen problemen</span>
      <input
        v-model="filter"
        class="ml-auto rounded border border-slate-300 px-2 py-0.5 text-xs"
        placeholder="Filter..."
      />
    </div>

    <div v-if="loading" class="text-center text-sm text-slate-400 py-8">
      Alle exports worden gecheckt...
    </div>

    <div v-for="r in filtered" :key="r.client" class="rounded border border-slate-200 bg-white">
      <div class="flex items-center gap-2 border-b border-slate-100 px-3 py-1.5">
        <span class="text-xs font-semibold text-slate-800">{{ r.client }}</span>
        <span
          v-if="r.download"
          class="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] text-sky-800"
        >Download #{{ r.download.model.id }}</span>
        <span
          v-if="r.export_"
          class="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-800"
        >Export #{{ r.export_.model.id }}</span>
      </div>

      <div class="space-y-0.5 px-3 py-1.5">
        <!-- Download issues -->
        <div v-for="(issue, i) in (r.download?.issues ?? [])" :key="'d'+i" class="flex items-start gap-1.5 text-[11px]">
          <span class="mt-0.5 rounded px-1 py-0 text-[9px] font-bold" :class="severityColor(issue.severity)">{{ severityIcon(issue.severity) }}</span>
          <span class="text-slate-600"><span class="font-medium text-sky-700">Download:</span> {{ issue.message }}</span>
        </div>

        <!-- Export issues -->
        <div v-for="(issue, i) in (r.export_?.issues ?? [])" :key="'e'+i" class="flex items-start gap-1.5 text-[11px]">
          <span class="mt-0.5 rounded px-1 py-0 text-[9px] font-bold" :class="severityColor(issue.severity)">{{ severityIcon(issue.severity) }}</span>
          <span class="text-slate-600"><span class="font-medium text-emerald-700">Export:</span> {{ issue.message }}</span>
        </div>

        <!-- Differences -->
        <div v-for="(issue, i) in r.differences" :key="'c'+i" class="flex items-start gap-1.5 text-[11px]">
          <span class="mt-0.5 rounded px-1 py-0 text-[9px] font-bold" :class="severityColor(issue.severity)">{{ severityIcon(issue.severity) }}</span>
          <span class="text-slate-600">{{ issue.message }}</span>
        </div>

        <div v-if="(r.download?.issues.length ?? 0) + (r.export_?.issues.length ?? 0) + r.differences.length === 0" class="text-[11px] text-emerald-600">
          Geen problemen gevonden
        </div>
      </div>
    </div>
  </section>
</template>

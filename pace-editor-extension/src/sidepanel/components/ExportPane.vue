<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useEditorStore } from '../store'
import {
  DATABRIDGE_BASE,
  DATABRIDGE_ENDPOINTS,
  DEFAULT_MAX_PERIOD_DAYS,
  RPHP_BASE,
  daysBetween,
  encParam,
  validatePeriod,
  type DbEndpoint,
} from '@shared/databridge'

const store = useEditorStore()

// --- Token ------------------------------------------------------------------
const token = ref('')
const tokenStored = computed(() => token.value.length > 0)

// --- Period (shared by r.php toggle and date-ranged endpoints) ---------------
const period = reactive({ start: '', end: '' })
const maxPeriodDays = ref(DEFAULT_MAX_PERIOD_DAYS)

// Row cap: limits how many data rows are pulled. 0 = no limit. Enforced two
// ways — `_limit` is sent to the server (only honoured when the filter has
// filter_limitmodel=1), and a hard client-side cap stops reading the stream
// after N rows regardless, so the download never blows up.
const maxRows = ref(100)

const periodSpan = computed(() =>
  period.start && period.end ? daysBetween(period.start, period.end) : null,
)
const periodError = computed(() => validatePeriod(period.start, period.end, maxPeriodDays.value))

function setPreset(days: number): void {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - days)
  period.end = end.toISOString().slice(0, 10)
  period.start = start.toISOString().slice(0, 10)
}

function setThisMonth(): void {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  period.start = first.toISOString().slice(0, 10)
  period.end = now.toISOString().slice(0, 10)
}

// --- DataBridge endpoint selection ------------------------------------------
const groups = computed(() => {
  const map = new Map<string, DbEndpoint[]>()
  for (const ep of DATABRIDGE_ENDPOINTS) {
    if (!map.has(ep.group)) map.set(ep.group, [])
    map.get(ep.group)!.push(ep)
  }
  return [...map.entries()]
})

const selectedId = ref<string>(DATABRIDGE_ENDPOINTS[0].id)
const selectedEndpoint = computed(() =>
  DATABRIDGE_ENDPOINTS.find((e) => e.id === selectedId.value) ?? null,
)
// Param values for the selected endpoint (date params are driven by `period`).
const paramValues = reactive<Record<string, string>>({})

watch(
  selectedEndpoint,
  (ep) => {
    for (const k of Object.keys(paramValues)) delete paramValues[k]
    if (!ep) return
    for (const p of ep.params) {
      if (p.kind === 'dateStart' || p.kind === 'dateEnd') continue
      paramValues[p.name] = p.example
    }
  },
  { immediate: true },
)

const editableParams = computed(
  () => selectedEndpoint.value?.params.filter((p) => p.kind === 'text' || p.kind === 'number') ?? [],
)

// --- Run state machine ------------------------------------------------------
type Step = 'idle' | 'validating' | 'requesting' | 'downloading' | 'parsing' | 'done' | 'error' | 'aborted'
const STEPS: { key: Step; label: string }[] = [
  { key: 'validating', label: 'Valideren' },
  { key: 'requesting', label: 'Aanvragen' },
  { key: 'downloading', label: 'Downloaden' },
  { key: 'parsing', label: 'Verwerken' },
  { key: 'done', label: 'Klaar' },
]

const run = reactive({
  step: 'idle' as Step,
  bytes: 0,
  ms: 0,
  error: '',
  label: '',
})
const running = computed(() => ['validating', 'requesting', 'downloading', 'parsing'].includes(run.step))
const stepIndex = computed(() => STEPS.findIndex((s) => s.key === run.step))
let abort: AbortController | null = null

// --- Debug log --------------------------------------------------------------
interface LogLine { ts: string; text: string; level: 'info' | 'ok' | 'warn' | 'err' }
const log = ref<LogLine[]>([])
const showLog = ref(true)

function addLog(text: string, level: LogLine['level'] = 'info'): void {
  log.value.push({ ts: new Date().toLocaleTimeString(), text, level })
  // Mirror to the console too so it shows up in the side-panel devtools.
  const tag = '[pace-editor][export]'
  if (level === 'err') console.error(tag, text)
  else if (level === 'warn') console.warn(tag, text)
  else console.log(tag, text)
}

function clearLog(): void {
  log.value = []
}

async function copyLog(): Promise<void> {
  const text = log.value.map((l) => `${l.ts}  ${l.text}`).join('\n')
  try {
    await navigator.clipboard.writeText(text)
    addLog('Log gekopieerd naar clipboard.', 'ok')
  } catch {
    addLog('Kopiëren mislukt.', 'warn')
  }
}

// --- Result -----------------------------------------------------------------
const result = reactive({
  text: '',
  filename: '',
  rowCount: 0,
  columns: [] as string[],
  rows: [] as string[][],
  limited: false,
})

function detectDelimiter(text: string): string {
  const sample = text.split('\n').slice(0, 5).join('\n')
  const tab = (sample.match(/\t/g) || []).length
  const semi = (sample.match(/;/g) || []).length
  const comma = (sample.match(/,/g) || []).length
  if (tab >= semi && tab >= comma && tab > 0) return '\t'
  if (semi >= comma && semi > 0) return ';'
  if (comma > 0) return ','
  return '\t'
}

function parseResult(text: string): void {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.length > 0)
  result.rowCount = lines.length
  const delim = detectDelimiter(text)
  const split = (l: string) => l.split(delim)
  result.columns = lines.length ? split(lines[0]) : []
  // Cap the on-screen preview; the full payload stays in result.text for download.
  result.rows = lines.slice(0, 200).map(split)
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

function resetRun(label: string): void {
  run.step = 'idle'
  run.bytes = 0
  run.ms = 0
  run.error = ''
  run.label = label
  result.text = ''
  result.filename = ''
  result.rowCount = 0
  result.columns = []
  result.rows = []
  result.limited = false
}

function fail(msg: string): void {
  run.step = 'error'
  run.error = msg
  addLog(`✗ ${msg}`, 'err')
}

/** Core request runner: streams the response so progress reflects real bytes. */
async function doRun(url: string, filename: string, label: string): Promise<void> {
  if (running.value) return
  resetRun(label)
  showLog.value = true

  run.step = 'validating'
  addLog(`▶ ${label}`, 'info')
  if (!tokenStored.value) {
    fail('Geen X-Token. Stel deze in bij Instellingen → Pace API Token.')
    return
  }
  addLog(`  URL: ${url}`)
  addLog('  X-Token: ••• (header gezet)')

  abort = new AbortController()
  run.step = 'requesting'
  const t0 = performance.now()
  try {
    const resp = await fetch(url, {
      headers: { 'X-Token': token.value },
      signal: abort.signal,
    })
    addLog(`← HTTP ${resp.status} ${resp.statusText}`, resp.ok ? 'ok' : 'err')
    const ct = resp.headers.get('content-type')
    if (ct) addLog(`  Content-Type: ${ct}`)
    if (!resp.ok) {
      fail(`HTTP ${resp.status}: ${resp.statusText}`)
      return
    }

    run.step = 'downloading'
    // Hard client-side cap: stop after header + maxRows data lines.
    const cap = maxRows.value > 0 ? maxRows.value + 1 : Infinity
    const reader = resp.body?.getReader()
    const decoder = new TextDecoder()
    let text = ''
    let received = 0
    let limited = false
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          received += value.length
          run.bytes = received
          text += decoder.decode(value, { stream: true })
          if (cap !== Infinity && (text.match(/\n/g)?.length ?? 0) >= cap) {
            limited = true
            await reader.cancel()
            break
          }
        }
      }
      if (!limited) text += decoder.decode()
    } else {
      const buf = await resp.arrayBuffer()
      received = buf.byteLength
      run.bytes = received
      text = new TextDecoder().decode(buf)
    }
    // Trim to the cap so a partial final line is dropped.
    if (limited) {
      text = text.split('\n').slice(0, cap).join('\n') + '\n'
    }
    run.ms = Math.round(performance.now() - t0)
    addLog(`✓ Ontvangen: ${formatBytes(received)} in ${run.ms} ms${limited ? ` (afgekapt op ${maxRows.value} regels)` : ''}`, 'ok')

    run.step = 'parsing'
    result.text = text
    result.filename = filename
    result.limited = limited
    parseResult(text)
    addLog(`  Regels: ${result.rowCount}, kolommen: ${result.columns.length}`, 'info')
    run.step = 'done'
  } catch (err) {
    if (abort?.signal.aborted) {
      run.step = 'aborted'
      addLog('■ Afgebroken door gebruiker', 'warn')
    } else {
      fail((err as Error).message)
    }
  } finally {
    abort = null
  }
}

function stop(): void {
  if (abort) {
    addLog('Stoppen aangevraagd…', 'warn')
    abort.abort()
  }
}

// --- r.php: run any download/export model by id ------------------------------
// r.php takes `_id` (numeric model id) OR `_name` (title) and authenticates with
// the X-Token header. It does NOT take dateStart/dateEnd — these models scope
// their own data through their configured Pace filter.
const selectedModelId = ref('')

watch(
  () => store.models,
  (m) => {
    if (selectedModelId.value && m.some((x) => x.id === selectedModelId.value)) return
    if (!m.length) return
    // Default to the model currently open in the editor, else the first one.
    const cur = store.snapshot?.title ? m.find((x) => x.title === store.snapshot!.title) : null
    selectedModelId.value = cur?.id ?? m[0].id
  },
  { immediate: true },
)

async function runModelExport(): Promise<void> {
  const model = store.models.find((m) => m.id === selectedModelId.value)
  if (!model) {
    resetRun('Export')
    fail('Kies een model.')
    return
  }
  let url = `${RPHP_BASE}?_id=${encParam(model.id)}`
  if (maxRows.value > 0) url += `&_limit=0,${maxRows.value}`
  await doRun(url, `${model.title}.csv`, `Export: ${model.title} (id ${model.id})`)
}

// --- DataBridge: run the selected endpoint -----------------------------------
async function runEndpoint(): Promise<void> {
  const ep = selectedEndpoint.value
  if (!ep) return
  resetRun(ep.label)

  // Validate required non-date params.
  for (const p of ep.params) {
    if (p.kind === 'dateStart' || p.kind === 'dateEnd') continue
    if (p.required && !paramValues[p.name]?.trim()) {
      fail(`Verplicht veld ontbreekt: ${p.name}`)
      return
    }
  }
  // Validate the period when the endpoint uses one.
  if (ep.hasPeriod) {
    const err = periodError.value
    if (err) {
      fail(err)
      return
    }
  }

  const parts: string[] = []
  for (const p of ep.params) {
    let v = ''
    if (p.kind === 'dateStart') v = period.start
    else if (p.kind === 'dateEnd') v = period.end
    else v = paramValues[p.name] ?? ''
    if (v !== '') parts.push(`${p.name}=${encParam(v)}`)
  }
  let url = `${DATABRIDGE_BASE}/${ep.id}?${parts.join('&')}`
  if (maxRows.value > 0 && !ep.params.some((p) => p.name === '_limit')) {
    url += `&_limit=0,${maxRows.value}`
  }
  await doRun(url, `${ep.id}.csv`, `DataBridge: ${ep.label}`)
}

// --- Download ---------------------------------------------------------------
function download(): void {
  if (!result.text) return
  const blob = new Blob([result.text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = result.filename || 'export.csv'
  a.click()
  URL.revokeObjectURL(url)
  addLog(`⤓ Gedownload: ${result.filename}`, 'ok')
}

// --- Persistence ------------------------------------------------------------
onMounted(async () => {
  const data = await chrome.storage.local.get([
    'pace.apiToken',
    'pace.export.period',
    'pace.export.maxPeriodDays',
    'pace.export.maxRows',
  ])
  if (data['pace.apiToken']) token.value = data['pace.apiToken']
  if (data['pace.export.maxPeriodDays']) maxPeriodDays.value = data['pace.export.maxPeriodDays']
  if (data['pace.export.maxRows'] !== undefined) maxRows.value = data['pace.export.maxRows']
  const p = data['pace.export.period']
  if (p?.start && p?.end) {
    period.start = p.start
    period.end = p.end
  } else {
    setPreset(7)
  }
  if (!store.models.length) void store.loadModels()
})

watch(maxPeriodDays, (v) => {
  void chrome.storage.local.set({ 'pace.export.maxPeriodDays': v })
})
watch(maxRows, (v) => {
  void chrome.storage.local.set({ 'pace.export.maxRows': v })
})
watch(period, (p) => {
  void chrome.storage.local.set({ 'pace.export.period': { start: p.start, end: p.end } })
})

function openSettings(): void {
  store.tab = 'settings'
}

const maxCols = computed(() =>
  Math.max(result.columns.length, ...result.rows.map((r) => r.length), 0),
)
</script>

<template>
  <section class="space-y-3 p-3 text-sm">
    <header>
      <h2 class="text-sm font-semibold text-slate-700">Export draaien</h2>
      <p class="text-[11px] text-slate-500">
        Draait echte exports via de Pace-API met je X-Token. Requests gaan vanaf
        jouw (gewhiteliste) IP.
      </p>
    </header>

    <!-- Token banner -->
    <div
      v-if="!tokenStored"
      class="rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900"
    >
      Geen X-Token ingesteld.
      <button class="font-semibold underline" @click="openSettings">Naar Instellingen →</button>
    </div>

    <!-- Period + max guard -->
    <section class="space-y-2 rounded border border-slate-200 bg-white p-2">
      <div class="flex items-center justify-between">
        <h3 class="text-xs font-semibold text-slate-700">Periode</h3>
        <div class="flex gap-1">
          <button class="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] hover:bg-slate-100" @click="setPreset(7)">7d</button>
          <button class="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] hover:bg-slate-100" @click="setPreset(30)">30d</button>
          <button class="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] hover:bg-slate-100" @click="setThisMonth">Deze maand</button>
        </div>
      </div>
      <div class="flex flex-wrap items-end gap-2">
        <label class="text-[11px] text-slate-600">
          Van
          <input v-model="period.start" type="date" class="block rounded border border-slate-300 px-1.5 py-0.5 text-xs" />
        </label>
        <label class="text-[11px] text-slate-600">
          Tot
          <input v-model="period.end" type="date" class="block rounded border border-slate-300 px-1.5 py-0.5 text-xs" />
        </label>
        <label class="text-[11px] text-slate-600">
          Max dagen
          <input v-model.number="maxPeriodDays" type="number" min="1" class="block w-20 rounded border border-slate-300 px-1.5 py-0.5 text-xs" />
        </label>
        <span v-if="periodSpan !== null && !periodError" class="pb-0.5 text-[11px] text-slate-500">
          = {{ periodSpan }} dagen
        </span>
      </div>
      <p v-if="periodError" class="text-[11px] font-medium text-rose-700">{{ periodError }}</p>
    </section>

    <!-- Row cap -->
    <section class="flex items-center gap-2 rounded border border-slate-200 bg-white p-2">
      <label class="text-xs font-semibold text-slate-700">Max regels</label>
      <input
        v-model.number="maxRows"
        type="number"
        min="0"
        class="w-24 rounded border border-slate-300 px-1.5 py-0.5 text-xs"
      />
      <span class="text-[11px] text-slate-500">
        {{ maxRows > 0 ? `download stopt na ${maxRows} regels` : 'geen limiet (alles)' }}
      </span>
    </section>

    <!-- Export model via r.php -->
    <section class="space-y-2 rounded border border-emerald-200 bg-emerald-50/40 p-2">
      <h3 class="text-xs font-semibold text-slate-700">Export-model draaien (r.php)</h3>
      <p class="text-[11px] text-slate-600">
        Kies een download/export-model en draai het direct via
        <code class="rounded bg-white px-1">r.php?_id=…</code>.
      </p>
      <select v-model="selectedModelId" class="w-full rounded border border-slate-300 px-2 py-1 text-xs">
        <option v-if="!store.models.length" value="">Geen modellen — open de Pace-modellenpagina en klik “Lezen”</option>
        <option v-for="m in store.models" :key="m.id" :value="m.id">
          {{ m.title }} (id {{ m.id }})
        </option>
      </select>
      <p class="text-[10px] italic text-slate-500">
        Deze modellen bepalen hun eigen datum-/databereik via hun Pace-filter. De periode-instelling
        hierboven geldt alleen voor de DataBridge-endpoints.
      </p>
      <button
        class="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        :disabled="running || !selectedModelId"
        @click="runModelExport"
      >Draai export</button>
    </section>

    <!-- DataBridge endpoint runner -->
    <section class="space-y-2 rounded border border-slate-200 bg-white p-2">
      <h3 class="text-xs font-semibold text-slate-700">DataBridge endpoint</h3>
      <select v-model="selectedId" class="w-full rounded border border-slate-300 px-2 py-1 text-xs">
        <optgroup v-for="[g, eps] in groups" :key="g" :label="g">
          <option v-for="ep in eps" :key="ep.id" :value="ep.id">{{ ep.label }}</option>
        </optgroup>
      </select>

      <div v-if="selectedEndpoint" class="space-y-1.5">
        <div
          v-for="p in editableParams"
          :key="p.name"
          class="flex items-center gap-2"
        >
          <label class="w-32 shrink-0 text-[11px] text-slate-600">
            {{ p.name }}<span v-if="p.required" class="text-rose-500">*</span>
          </label>
          <input
            v-model="paramValues[p.name]"
            :type="p.kind === 'number' ? 'text' : 'text'"
            :placeholder="p.example"
            class="flex-1 rounded border border-slate-300 px-2 py-0.5 font-mono text-xs"
          />
        </div>
        <p v-if="selectedEndpoint.hasPeriod" class="text-[11px] italic text-slate-500">
          dateStart/dateEnd komen uit de periode-instelling hierboven.
        </p>
      </div>

      <button
        class="rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        :disabled="running"
        @click="runEndpoint"
      >Draai endpoint</button>
    </section>

    <!-- Progress -->
    <section
      v-if="run.step !== 'idle'"
      class="space-y-2 rounded border border-slate-200 bg-white p-2"
    >
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold text-slate-700">{{ run.label }}</span>
        <button
          v-if="running"
          class="rounded border border-rose-300 px-2 py-0.5 text-[10px] font-medium text-rose-700 hover:bg-rose-50"
          @click="stop"
        >Stop</button>
      </div>

      <!-- Stepper -->
      <div class="flex items-center gap-1">
        <template v-for="(s, i) in STEPS" :key="s.key">
          <div
            class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium"
            :class="run.step === 'error'
              ? (i <= stepIndex ? 'bg-slate-100 text-slate-400' : 'text-slate-300')
              : i < stepIndex || run.step === 'done'
                ? 'bg-emerald-100 text-emerald-800'
                : i === stepIndex
                  ? 'bg-blue-100 text-blue-800'
                  : 'text-slate-300'"
          >
            <span
              v-if="i === stepIndex && running"
              class="inline-block h-2 w-2 animate-spin rounded-full border border-blue-500 border-t-transparent"
            ></span>
            {{ s.label }}
          </div>
          <span v-if="i < STEPS.length - 1" class="text-slate-300">›</span>
        </template>
      </div>

      <div class="flex gap-3 text-[11px] text-slate-500">
        <span>{{ formatBytes(run.bytes) }}</span>
        <span v-if="run.ms">{{ run.ms }} ms</span>
      </div>

      <p v-if="run.step === 'error'" class="rounded bg-rose-50 px-2 py-1 text-[11px] text-rose-700">{{ run.error }}</p>
      <p v-else-if="run.step === 'aborted'" class="rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800">Afgebroken.</p>
    </section>

    <!-- Result -->
    <section
      v-if="run.step === 'done'"
      class="space-y-2 rounded border border-slate-200 bg-white p-2"
    >
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold text-slate-700">
          Resultaat — {{ result.rowCount }} regels
          <span v-if="result.limited" class="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">afgekapt op {{ maxRows }}</span>
        </span>
        <button
          class="rounded bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-slate-900"
          @click="download"
        >⤓ Download CSV</button>
      </div>
      <p v-if="result.rows.length > 200 || result.rowCount > 200" class="text-[10px] italic text-slate-400">
        Preview toont eerste 200 regels — download bevat alles.
      </p>
      <div v-if="result.rows.length" class="max-h-72 overflow-auto rounded border border-slate-200">
        <table class="w-full border-collapse text-[11px]">
          <tbody>
            <tr
              v-for="(row, ri) in result.rows"
              :key="ri"
              :class="ri === 0 ? 'bg-slate-100 font-semibold' : ri % 2 ? 'bg-slate-50' : 'bg-white'"
            >
              <td
                v-for="ci in maxCols"
                :key="ci"
                class="whitespace-nowrap border border-slate-200 px-2 py-0.5 text-slate-800"
              >{{ row[ci - 1] ?? '' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Debug log -->
    <section class="rounded border border-slate-200 bg-white">
      <div class="flex items-center justify-between border-b border-slate-100 px-2 py-1">
        <button class="text-xs font-semibold text-slate-700" @click="showLog = !showLog">
          {{ showLog ? '▾' : '▸' }} Debug-log ({{ log.length }})
        </button>
        <div class="flex gap-2">
          <button class="text-[11px] text-slate-500 hover:underline" @click="copyLog">Kopieer</button>
          <button class="text-[11px] text-slate-500 hover:underline" @click="clearLog">Wis</button>
        </div>
      </div>
      <div v-if="showLog" class="mono max-h-48 overflow-auto bg-slate-900 p-2 text-[10px] leading-relaxed">
        <p v-if="!log.length" class="italic text-slate-500">Nog geen log. Draai een export.</p>
        <div
          v-for="(l, i) in log"
          :key="i"
          class="whitespace-pre-wrap break-all"
          :class="{
            'text-slate-400': l.level === 'info',
            'text-emerald-300': l.level === 'ok',
            'text-amber-300': l.level === 'warn',
            'text-rose-300': l.level === 'err',
          }"
        ><span class="text-slate-600">{{ l.ts }}</span> {{ l.text }}</div>
      </div>
    </section>
  </section>
</template>

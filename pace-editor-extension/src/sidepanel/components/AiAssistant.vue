<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useEditorStore } from '../store'
import { runSimulation } from '@shared/simulator'
import { buildAutoFixtures } from '@shared/auto-fixtures'

const store = useEditorStore()

const apiKey = ref('')
const apiKeyStored = ref(false)
const instruction = ref('')
const loading = ref(false)
const error = ref('')
const proposedCode = ref('')
const showDiff = ref(false)

// Version history
interface HistoryEntry {
  timestamp: number
  label: string
  repeatingCode: string
  codeBefore: string
  codeAfter: string
}
const history = ref<HistoryEntry[]>([])
const showHistory = ref(false)

onMounted(async () => {
  const data = await chrome.storage.local.get('pace.anthropicKey')
  if (data['pace.anthropicKey']) {
    apiKey.value = data['pace.anthropicKey']
    apiKeyStored.value = true
  }
})

async function saveApiKey(): Promise<void> {
  await chrome.storage.local.set({ 'pace.anthropicKey': apiKey.value })
  apiKeyStored.value = true
}

async function clearApiKey(): Promise<void> {
  await chrome.storage.local.remove('pace.anthropicKey')
  apiKey.value = ''
  apiKeyStored.value = false
}

// Is the current model an export? (title starts with "export")
const isExportModel = computed(() =>
  (store.snapshot?.title ?? '').toLowerCase().startsWith('export'),
)

const systemPrompt = computed(() => `Je bent een expert in Pace export-template syntax. Je helpt gebruikers met het aanpassen van export-templates voor het Pace CRM systeem van XS Direct.

PACE TEMPLATE SYNTAX:
- Veldverwijzingen: {471: id}, {34-445: Person: Sex}, {var:count}
- Functies: $if[conditie][dan], $ifelse[conditie][dan][anders]
- Variabelen: $var[naam][waarde] (toekennen), {var:naam} (lezen), $storevar[naam] (bewaren)
- Datum: $date[bron][%d-%m-%Y]
- Tekst: $substr[tekst][start,lengte], $replace[zoek][vervang][tekst], $trim[tekst]
- Kolom-separator: &#9; (tab entity) of ; (puntkomma)
- $storevar[count] en $var[count][0] produceren GEEN output
- $rem[commentaar] is een commentaar (geen output)

REGELS:
- Geef ALLEEN de gewijzigde repeating code terug, geen uitleg
- Behoud de exacte syntax en structuur
- Gebruik dezelfde kolom-separator als het huidige template
- Behoud alle bestaande kolommen tenzij de opdracht zegt ze te verwijderen
- De repeating code MOET eindigen met een newline
${isExportModel.value ? '- Dit is een EXPORT model: de code MOET eindigen met $storevar[count]\\n<<exportedId={471: id}>>\\n' : '- Dit is een DOWNLOAD model: GEEN <<exportedId>> toevoegen'}
- Wrap je antwoord in <template> tags`)

async function generate(): Promise<void> {
  if (!apiKey.value || !instruction.value.trim()) return

  loading.value = true
  error.value = ''
  proposedCode.value = ''

  const userMessage = `HUIDIG MODEL: ${store.snapshot?.title ?? 'onbekend'} (${isExportModel.value ? 'EXPORT' : 'DOWNLOAD'})

Code before:
${store.codeBefore}

Repeating code:
${store.repeatingCode}

Code after:
${store.codeAfter}

Beschikbare velden:
${store.catalog.map((e) => `{${e.raw}}`).join(', ')}

---

OPDRACHT:
${instruction.value}

---

Geef de aangepaste REPEATING CODE in <template> tags.`

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey.value,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        system: systemPrompt.value,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!resp.ok) {
      const body = await resp.text()
      error.value = `API fout (${resp.status}): ${body.slice(0, 200)}`
      return
    }

    const data = await resp.json()
    const text = data.content?.[0]?.text ?? ''

    const match = text.match(/<template>([\s\S]*?)<\/template>/)
    let code = match ? match[1].trim() : text.trim()

    // Auto-fix: ensure export models have <<exportedId>> and newline
    if (isExportModel.value) {
      if (!code.endsWith('\n')) code += '\n'
      if (!code.includes('<<exportedId=')) {
        code += '<<exportedId={471: id}>>\n'
      }
    }

    proposedCode.value = code
    showDiff.value = true
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    loading.value = false
  }
}

// Preview the proposed code with simulated data
const proposedPreview = computed(() => {
  if (!proposedCode.value) return null
  const fixture = buildAutoFixtures(
    store.snapshot?.title ?? '',
    store.codeBefore,
    proposedCode.value,
    store.codeAfter,
  )
  try {
    return runSimulation({
      codeBefore: store.codeBefore,
      repeatingCode: proposedCode.value,
      codeAfter: store.codeAfter,
      bundle: fixture,
    })
  } catch { return null }
})

// Split preview rows by detected delimiter
const previewRows = computed(() => {
  if (!proposedPreview.value) return []
  return proposedPreview.value.rows.map((r) => {
    const raw = r.raw.replace(/&#9;/g, '\t')
    const delim = raw.includes('\t') ? '\t' : raw.includes(';') ? ';' : '\t'
    return raw.split(delim).map((s) => s.replace(/^"|"$/g, '').trim())
  })
})

function applyProposal(): void {
  if (!proposedCode.value) return
  // Save current state to history
  history.value.unshift({
    timestamp: Date.now(),
    label: instruction.value.slice(0, 50) || 'Handmatig',
    repeatingCode: store.repeatingCode,
    codeBefore: store.codeBefore,
    codeAfter: store.codeAfter,
  })
  // Keep max 20 entries
  if (history.value.length > 20) history.value.pop()

  store.repeatingCode = proposedCode.value
  showDiff.value = false
  proposedCode.value = ''
  instruction.value = ''
}

function rejectProposal(): void {
  showDiff.value = false
  proposedCode.value = ''
}

function restoreVersion(entry: HistoryEntry): void {
  // Save current state first
  history.value.unshift({
    timestamp: Date.now(),
    label: 'Voor herstel',
    repeatingCode: store.repeatingCode,
    codeBefore: store.codeBefore,
    codeAfter: store.codeAfter,
  })
  store.repeatingCode = entry.repeatingCode
  store.codeBefore = entry.codeBefore
  store.codeAfter = entry.codeAfter
  showHistory.value = false
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <section class="space-y-3 p-3">
    <!-- API Key setup -->
    <div v-if="!apiKeyStored" class="rounded border border-blue-200 bg-blue-50 p-3">
      <h3 class="text-xs font-semibold text-blue-900">Claude API Key</h3>
      <p class="mt-1 text-[11px] text-blue-800">
        Voer je Anthropic API key in. Wordt lokaal opgeslagen.
      </p>
      <div class="mt-2 flex gap-1">
        <input
          v-model="apiKey"
          type="password"
          class="flex-1 rounded border border-blue-300 px-2 py-1 text-xs"
          placeholder="sk-ant-..."
        />
        <button
          class="rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
          :disabled="!apiKey"
          @click="saveApiKey"
        >Opslaan</button>
      </div>
    </div>

    <div v-else>
      <div class="mb-2 flex items-center justify-between">
        <h3 class="text-sm font-semibold text-slate-700">AI Assistent</h3>
        <div class="flex gap-1">
          <button
            v-if="history.length > 0"
            class="rounded border border-slate-300 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100"
            @click="showHistory = !showHistory"
          >Geschiedenis ({{ history.length }})</button>
          <button
            class="text-[10px] text-slate-400 hover:text-rose-600"
            @click="clearApiKey"
          >Key wissen</button>
        </div>
      </div>

      <!-- Version history -->
      <div v-if="showHistory" class="rounded border border-slate-200 bg-white p-2 space-y-1">
        <p class="text-[11px] font-semibold text-slate-600">Eerdere versies</p>
        <div
          v-for="(entry, i) in history"
          :key="i"
          class="flex items-center gap-2 rounded px-2 py-1 text-[11px] hover:bg-slate-50"
        >
          <span class="text-slate-400">{{ formatTime(entry.timestamp) }}</span>
          <span class="flex-1 truncate text-slate-700">{{ entry.label }}</span>
          <button
            class="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-800 hover:bg-violet-200"
            @click="restoreVersion(entry)"
          >Herstel</button>
        </div>
      </div>

      <p class="mb-2 text-[11px] text-slate-500">
        Plak een opdracht of e-mail en Claude past het template aan.
        <span v-if="isExportModel" class="font-medium text-emerald-700">Export model — &lt;&lt;exportedId&gt;&gt; wordt automatisch toegevoegd.</span>
      </p>

      <textarea
        v-model="instruction"
        class="w-full rounded border border-slate-300 p-2 text-xs"
        rows="6"
        placeholder="Bijv: Wijzig de marketingcodes voor de indexeringspilot..."
        :disabled="loading"
      />

      <div class="mt-2">
        <button
          class="rounded bg-violet-600 px-3 py-1 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          :disabled="loading || !instruction.trim()"
          @click="generate"
        >{{ loading ? 'Bezig...' : 'Genereer voorstel' }}</button>
      </div>

      <p v-if="error" class="mt-2 text-xs text-rose-700">{{ error }}</p>
    </div>

    <!-- Proposal with CSV preview -->
    <div v-if="showDiff && proposedCode" class="space-y-2">
      <div class="rounded border border-emerald-200 bg-emerald-50 p-2">
        <h4 class="text-xs font-semibold text-emerald-900">Voorstel van Claude</h4>
      </div>

      <!-- CSV Preview of proposed code -->
      <div v-if="previewRows.length > 0" class="overflow-x-auto rounded border border-blue-200">
        <div class="bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-800">
          Preview met voorgestelde code ({{ previewRows.length }} rijen)
        </div>
        <table class="w-full border-collapse text-[11px]">
          <tbody>
            <tr
              v-for="(row, ri) in previewRows.slice(0, 2)"
              :key="ri"
              :class="ri % 2 === 0 ? 'bg-white' : 'bg-slate-50'"
            >
              <td
                v-for="(cell, ci) in row"
                :key="ci"
                class="whitespace-nowrap border border-slate-200 px-1.5 py-0.5 text-slate-800"
              >{{ cell || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Proposed code -->
      <details class="rounded border border-slate-200">
        <summary class="cursor-pointer bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">
          Voorgestelde code
        </summary>
        <pre class="mono max-h-48 overflow-auto bg-slate-900 p-2 text-[11px] text-slate-100 whitespace-pre-wrap break-all">{{ proposedCode }}</pre>
      </details>

      <!-- Current code -->
      <details class="rounded border border-slate-200">
        <summary class="cursor-pointer bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500">
          Huidige code (vergelijking)
        </summary>
        <pre class="mono max-h-32 overflow-auto bg-slate-800 p-2 text-[11px] text-slate-400 whitespace-pre-wrap break-all">{{ store.repeatingCode }}</pre>
      </details>

      <div class="flex gap-2">
        <button
          class="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
          @click="applyProposal"
        >Toepassen</button>
        <button
          class="rounded border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100"
          @click="rejectProposal"
        >Afwijzen</button>
      </div>
    </div>
  </section>
</template>

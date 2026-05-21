<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useEditorStore } from '../store'

const store = useEditorStore()

const apiKey = ref('')
const apiKeyStored = ref(false)
const instruction = ref('')
const loading = ref(false)
const error = ref('')
const proposedCode = ref('')
const showDiff = ref(false)

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

const systemPrompt = `Je bent een expert in Pace export-template syntax. Je helpt gebruikers met het aanpassen van export-templates voor het Pace CRM systeem van XS Direct.

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
- Gebruik &#9; als kolom-separator (tenzij het huidige template ; gebruikt)
- Behoud alle bestaande kolommen tenzij de opdracht zegt ze te verwijderen
- Wrap je antwoord in <template> tags`;

async function generate(): Promise<void> {
  if (!apiKey.value || !instruction.value.trim()) return

  loading.value = true
  error.value = ''
  proposedCode.value = ''

  const userMessage = `HUIDIGE TEMPLATE:

Code before:
${store.codeBefore}

Repeating code:
${store.repeatingCode}

Code after:
${store.codeAfter}

Beschikbare velden (catalog):
${store.catalog.map((e) => `{${e.raw}}`).join(', ')}

---

OPDRACHT VAN DE GEBRUIKER:
${instruction.value}

---

Geef de aangepaste REPEATING CODE terug in <template> tags. Alleen de repeating code, geen uitleg.`

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
        system: systemPrompt,
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

    // Extract content between <template> tags
    const match = text.match(/<template>([\s\S]*?)<\/template>/)
    if (match) {
      proposedCode.value = match[1].trim()
    } else {
      // Fallback: use the entire response
      proposedCode.value = text.trim()
    }
    showDiff.value = true
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    loading.value = false
  }
}

function applyProposal(): void {
  if (!proposedCode.value) return
  store.repeatingCode = proposedCode.value
  showDiff.value = false
  proposedCode.value = ''
  instruction.value = ''
}

function rejectProposal(): void {
  showDiff.value = false
  proposedCode.value = ''
}

</script>

<template>
  <section class="space-y-3 p-3">
    <!-- API Key setup -->
    <div v-if="!apiKeyStored" class="rounded border border-blue-200 bg-blue-50 p-3">
      <h3 class="text-xs font-semibold text-blue-900">Claude API Key</h3>
      <p class="mt-1 text-[11px] text-blue-800">
        Voer je Anthropic API key in om de AI-assistent te gebruiken.
        De key wordt lokaal opgeslagen in je browser.
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

    <!-- Instruction input -->
    <div v-else>
      <div class="mb-2 flex items-center justify-between">
        <h3 class="text-sm font-semibold text-slate-700">AI Assistent</h3>
        <button
          class="text-[10px] text-slate-400 hover:text-rose-600"
          @click="clearApiKey"
        >API key wissen</button>
      </div>

      <p class="mb-2 text-[11px] text-slate-500">
        Plak een opdracht of e-mail en Claude past het template aan.
      </p>

      <textarea
        v-model="instruction"
        class="w-full rounded border border-slate-300 p-2 text-xs"
        rows="6"
        placeholder="Bijv: Wijzig de marketingcodes voor de indexeringspilot. De nieuwe codes zijn..."
        :disabled="loading"
      />

      <div class="mt-2 flex gap-1">
        <button
          class="rounded bg-violet-600 px-3 py-1 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          :disabled="loading || !instruction.trim()"
          @click="generate"
        >
          {{ loading ? 'Bezig...' : 'Genereer voorstel' }}
        </button>
      </div>

      <p v-if="error" class="mt-2 text-xs text-rose-700">{{ error }}</p>
    </div>

    <!-- Proposal diff -->
    <div v-if="showDiff && proposedCode" class="space-y-2">
      <div class="rounded border border-emerald-200 bg-emerald-50 p-2">
        <h4 class="text-xs font-semibold text-emerald-900">Voorstel van Claude</h4>
        <p class="mt-0.5 text-[11px] text-emerald-700">
          Bekijk het voorstel hieronder. Klik "Toepassen" om het over te nemen,
          of "Afwijzen" om het te negeren.
        </p>
      </div>

      <!-- Show the proposed code -->
      <details open class="rounded border border-slate-200">
        <summary class="cursor-pointer bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">
          Voorgestelde repeating code
        </summary>
        <pre class="mono max-h-64 overflow-auto bg-slate-900 p-2 text-[11px] text-slate-100 whitespace-pre-wrap break-all">{{ proposedCode }}</pre>
      </details>

      <!-- Show current code for comparison -->
      <details class="rounded border border-slate-200">
        <summary class="cursor-pointer bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500">
          Huidige repeating code (ter vergelijking)
        </summary>
        <pre class="mono max-h-48 overflow-auto bg-slate-800 p-2 text-[11px] text-slate-400 whitespace-pre-wrap break-all">{{ store.repeatingCode }}</pre>
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

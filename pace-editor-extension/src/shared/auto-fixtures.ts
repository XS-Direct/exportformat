// Auto-generate fixture scenarios from the fields used in a template.
// Inspects field labels to produce plausible synthetic data so the simulator
// works without hand-written fixtures for every export model.

import { parse } from './parser'
import type { IRNode } from './ir-types'
import type { FixtureBundle, Scenario, ScenarioRecord } from './fixtures/types'

// ---------------------------------------------------------------------------
// 1. Extract all unique field references from template code
// ---------------------------------------------------------------------------

function collectFields(nodes: IRNode[], out: Set<string>): void {
  for (const node of nodes) {
    if (node.kind === 'field') {
      // Skip var references — they're internal variables, not input fields
      if (!node.raw.startsWith('var:') && !node.raw.startsWith('curdate')) {
        out.add(node.raw)
      }
    } else if (node.kind === 'func' && node.args) {
      for (const arg of node.args) {
        collectFields(arg.nodes, out)
      }
    }
  }
}

export function extractFieldRefs(code: string): string[] {
  const tree = parse(code).tree
  const fields = new Set<string>()
  collectFields(tree, fields)
  return [...fields]
}

export function extractAllFieldRefs(codeBefore: string, repeatingCode: string, codeAfter: string): string[] {
  const all = new Set<string>()
  for (const code of [codeBefore, repeatingCode, codeAfter]) {
    for (const f of extractFieldRefs(code)) all.add(f)
  }
  return [...all]
}

// ---------------------------------------------------------------------------
// 2. Map field labels to synthetic data generators
// ---------------------------------------------------------------------------

interface FieldGenerator {
  pattern: RegExp
  generate: (index: number) => string
}

const FIRST_NAMES_M = ['Jan', 'Pieter', 'Mohammed', 'Thomas', 'Willem', 'David', 'Lucas']
const FIRST_NAMES_F = ['Anna', 'Sophie', 'Maria', 'Emma', 'Lisa', 'Sara', 'Julia']
const LAST_NAMES = ['de Vries', 'Jansen', 'van den Berg', 'Bakker', 'Visser', 'Smit', 'Meijer']
const STREETS = ['Keizersgracht', 'Prinsengracht', 'Dorpsstraat', 'Hoofdweg', 'Laan van Meerdervoort']
const CITIES = ['Amsterdam', 'Rotterdam', 'Utrecht', 'Den Haag', 'Eindhoven', 'Groningen']
const POSTAL_CODES = ['1012AB', '3011CD', '3500EF', '2500GH', '5600IJ', '9700KL']

function pick<T>(arr: T[], index: number): T {
  return arr[index % arr.length]
}

// Generate a date string in various formats. Default: ISO-ish YYYY-MM-DD.
function fakeDate(index: number): string {
  const day = ((index * 7 + 3) % 28) + 1
  const month = (index % 12) + 1
  return `2025-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// Each generator matches field labels (case-insensitive) and produces data.
const GENERATORS: FieldGenerator[] = [
  // Identity
  { pattern: /\bid\b/i, generate: (i) => String(10000 + i) },

  // Sex / Gender
  { pattern: /\bsex\b|\bgender\b|\bgeslacht\b/i, generate: (i) => i % 2 === 0 ? 'male' : 'female' },

  // Name fields
  { pattern: /\bfirst\s*name\b|\bvoornaam\b/i, generate: (i) => i % 2 === 0 ? pick(FIRST_NAMES_M, i) : pick(FIRST_NAMES_F, i) },
  { pattern: /\binitials?\b|\bvoorletters?\b/i, generate: (i) => i % 2 === 0 ? pick(FIRST_NAMES_M, i)[0] + '.' : pick(FIRST_NAMES_F, i)[0] + '.' },
  { pattern: /\blast\s*name\b|\bachternaam\b/i, generate: (i) => pick(LAST_NAMES, i) },
  { pattern: /\bprefix\b|\btussenvoegsel\b|\bmiddle\b/i, generate: (i) => i % 3 === 0 ? 'van' : i % 3 === 1 ? 'de' : '' },
  { pattern: /\bfull\s*name\b/i, generate: (i) => `${pick(FIRST_NAMES_M, i)} ${pick(LAST_NAMES, i)}` },
  { pattern: /\bsalutation\b|\baanhef\b/i, generate: (i) => i % 2 === 0 ? 'Dhr.' : 'Mevr.' },

  // Address
  { pattern: /\bstreet\b|\bstraat\b/i, generate: (i) => pick(STREETS, i) },
  { pattern: /\bhouse\s*number\s*add/i, generate: (i) => i % 3 === 0 ? 'A' : '' },
  { pattern: /\bhouse\s*number\b|\bhuisnummer\b/i, generate: (i) => String(10 + i * 7) },
  { pattern: /\bpostal\s*code\b|\bpostcode\b/i, generate: (i) => pick(POSTAL_CODES, i) },
  { pattern: /\bcity\b|\bplaats\b|\bwoonplaats\b/i, generate: (i) => pick(CITIES, i) },
  { pattern: /\bcountry\s*code\b|\bland(code)?\b/i, generate: () => 'NL' },

  // Contact
  { pattern: /\bemail\b|\be-?mail\b/i, generate: (i) => `test${i + 1}@example.com` },
  { pattern: /\bphone\b|\btelefoon\b|\bmobiel\b|\bmain\s*number\b/i, generate: (i) => `06${String(12345670 + i).padStart(8, '0')}` },
  { pattern: /\bphone.*status\b/i, generate: () => 'valid' },

  // Financial
  { pattern: /\bamount\b|\bbedrag\b/i, generate: (i) => String(5 + i * 2.5) },
  { pattern: /\biban\b|\bbank\s*account\b/i, generate: (i) => `NL${String(10 + i).padStart(2, '0')}INGB0001234${String(i).padStart(3, '0')}` },
  { pattern: /\bfrequen(cy|tie)\b/i, generate: (i) => i % 3 === 0 ? 'month' : i % 3 === 1 ? 'single' : 'month' },

  // Date fields
  { pattern: /\bdate\s*of\s*birth\b|\bgeboortedatum\b/i, generate: (i) => `19${70 + (i % 30)}-${String((i % 12) + 1).padStart(2, '0')}-15` },
  { pattern: /\bdate\b|\bdatum\b/i, generate: fakeDate },

  // Status
  { pattern: /\bstatus\b/i, generate: () => 'valid' },
  { pattern: /\bopt\s*in\b/i, generate: (i) => i % 2 === 0 ? '1' : '0' },
  { pattern: /\bwelcome\s*call\b/i, generate: (i) => i % 2 === 0 ? '1' : '0' },

  // Project / Method
  { pattern: /\bproject.*id\b/i, generate: (i) => String(200 + (i % 10)) },
  { pattern: /\bmethod\s*override\s*export\b/i, generate: (i) => i % 2 === 0 ? '1' : '0' },
  { pattern: /\bmethod\s*override\b|\bmethod\}?$/i, generate: (i) => i % 3 === 0 ? 'door-to-door' : i % 3 === 1 ? 'face-to-face' : 'event' },
  { pattern: /\bshift.*method\b|\bmethod\b/i, generate: (i) => i % 3 === 0 ? 'door-to-door' : i % 3 === 1 ? 'face-to-face' : 'event' },

  // Company / Employee
  { pattern: /\bcompany.*id\b/i, generate: (i) => String(12000 + i) },
  { pattern: /\bcompany.*name\b/i, generate: (i) => i % 2 === 0 ? 'SaleslinQ' : 'People Marketing' },
  { pattern: /\bemployee.*id\b/i, generate: (i) => String(5000 + i) },

  // Block name
  { pattern: /\bblock\s*name\b/i, generate: () => 'main' },

  // Week
  { pattern: /\bweek\b/i, generate: (i) => String((i % 52) + 1) },
]

function generateFieldValue(raw: string, index: number): string {
  // The raw is like "34-445: Person: Sex" — use the label part after the first colon
  const colonPos = raw.indexOf(':')
  const label = colonPos >= 0 ? raw.slice(colonPos + 1).trim() : raw

  for (const gen of GENERATORS) {
    if (gen.pattern.test(label) || gen.pattern.test(raw)) {
      return gen.generate(index)
    }
  }

  // Fallback: return a generic placeholder using the label
  return `test-${label.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-${index + 1}`
}

// ---------------------------------------------------------------------------
// 3. Build a dynamic FixtureBundle
// ---------------------------------------------------------------------------

const SCENARIO_COUNT = 4

export function buildAutoFixtures(
  modelTitle: string,
  codeBefore: string,
  repeatingCode: string,
  codeAfter: string,
): FixtureBundle {
  const fieldRefs = extractAllFieldRefs(codeBefore, repeatingCode, codeAfter)

  const scenarios: Scenario[] = []
  for (let i = 0; i < SCENARIO_COUNT; i++) {
    const fields: Record<string, string> = {}
    for (const ref of fieldRefs) {
      fields[ref] = generateFieldValue(ref, i)
    }

    scenarios.push({
      id: `auto-${i + 1}`,
      description: `Auto-gegenereerd scenario ${i + 1} (${fieldRefs.length} velden)`,
      record: { fields } as ScenarioRecord,
      // No expected columns — we just show what the template produces
    })
  }

  return {
    id: `auto-${modelTitle || 'unknown'}`,
    name: `${modelTitle || 'Huidig model'} (auto)`,
    modelTitle: modelTitle || '',
    scenarios,
  }
}

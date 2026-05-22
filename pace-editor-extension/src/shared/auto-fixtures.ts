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

// Generators are matched in ORDER — more specific patterns MUST come first.
const GENERATORS: FieldGenerator[] = [
  // --- Specific compound patterns first (before generic ones) ---

  // Method override export (boolean flag) — before "method" and "export"
  { pattern: /method\s*override\s*export/i, generate: (i) => i % 2 === 0 ? '1' : '0' },
  // Method override (string) — before generic "method"
  { pattern: /method\s*override/i, generate: (i) => ['door-to-door', 'face-to-face', 'event'][i % 3] },
  // Shift Method — before generic "method"
  { pattern: /shift.*method|method/i, generate: (i) => ['door-to-door', 'face-to-face', 'event'][i % 3] },

  // Phone: Status — before generic "phone" and "status"
  { pattern: /phone.*status/i, generate: () => 'valid' },
  // Phone: Opt in — before generic "phone" and "opt in"
  { pattern: /phone.*opt\s*in/i, generate: (i) => i % 2 === 0 ? '1' : '0' },
  // Phone: Main number — before generic "phone"
  { pattern: /main\s*number|phone.*number|telefoon|mobiel/i, generate: (i) => `06${String(12345670 + i).padStart(8, '0')}` },

  // Email: Opt in — before generic "email" and "opt in"
  { pattern: /email.*opt\s*in/i, generate: (i) => i % 2 === 0 ? '1' : '0' },
  // Email: Address — before generic "email"
  { pattern: /email.*address|emailadres|e-?mail/i, generate: (i) => `test${i + 1}@example.com` },

  // Date of birth — before generic "date"
  { pattern: /date\s*of\s*birth|geboortedatum|birth/i, generate: (i) => `19${70 + (i % 30)}-${String((i % 12) + 1).padStart(2, '0')}-15` },
  // Export date — before generic "date"
  { pattern: /export\s*date|call\s*lock\s*date/i, generate: fakeDate },

  // House number addition — before generic "house number"
  { pattern: /house\s*number\s*add|huisnummer.*toevoeging/i, generate: (i) => i % 3 === 0 ? 'A' : '' },

  // Company: id — before generic "id"
  { pattern: /company.*id/i, generate: (i) => String(12000 + i) },
  // Company: Name
  { pattern: /company.*name/i, generate: (i) => i % 2 === 0 ? 'SaleslinQ' : 'People Marketing' },
  // Employee: id — before generic "id"
  { pattern: /employee.*id/i, generate: (i) => String(5000 + i) },
  // Project: id — before generic "id"
  { pattern: /project.*id/i, generate: (i) => [60, 88, 141, 204, 205, 206, 207, 208][i % 8] + '' },

  // Bank account: IBAN — before generic patterns
  { pattern: /iban|bank\s*account/i, generate: (i) => `NL${String(10 + i).padStart(2, '0')}INGB0001234${String(i).padStart(3, '0')}` },

  // Country code — before generic "land"
  { pattern: /country\s*code|landcode/i, generate: () => 'NL' },

  // Full name — before "name"
  { pattern: /full\s*name/i, generate: (i) => `${pick(FIRST_NAMES_M, i)} ${pick(LAST_NAMES, i)}` },

  // --- Generic patterns ---

  // Identity (only match if "id" is the LAST segment, e.g. "471: id" or "employee: id")
  { pattern: /:\s*id\}?$|\bid\}?$/i, generate: (i) => String(10000 + i) },

  // Sex / Gender
  { pattern: /\bsex\b|\bgender\b|\bgeslacht\b/i, generate: (i) => i % 2 === 0 ? 'male' : 'female' },

  // Name fields
  { pattern: /first\s*name|voornaam/i, generate: (i) => i % 2 === 0 ? pick(FIRST_NAMES_M, i) : pick(FIRST_NAMES_F, i) },
  { pattern: /initials?|voorletters?/i, generate: (i) => i % 2 === 0 ? pick(FIRST_NAMES_M, i)[0] + '.' : pick(FIRST_NAMES_F, i)[0] + '.' },
  { pattern: /last\s*name|achternaam/i, generate: (i) => pick(LAST_NAMES, i) },
  { pattern: /\bprefix\b|tussenvoegsel|middle/i, generate: (i) => i % 3 === 0 ? 'van' : i % 3 === 1 ? 'de' : '' },
  { pattern: /salutation|aanhef|title/i, generate: (i) => i % 2 === 0 ? 'Dhr.' : 'Mevr.' },

  // Address
  { pattern: /street|straat/i, generate: (i) => pick(STREETS, i) },
  { pattern: /house\s*number|huisnummer/i, generate: (i) => String(10 + i * 7) },
  { pattern: /postal\s*code|postcode/i, generate: (i) => pick(POSTAL_CODES, i) },
  { pattern: /\bcity\b|plaats|woonplaats/i, generate: (i) => pick(CITIES, i) },
  { pattern: /\bland\b|country/i, generate: () => 'NL' },

  // Financial
  { pattern: /amount|bedrag/i, generate: (i) => (5 + i * 2.5).toFixed(2).replace('.', ',') },
  { pattern: /frequen(cy|tie)/i, generate: (i) => i % 3 === 0 ? 'month' : i % 3 === 1 ? 'single' : 'month' },

  // Date (generic — after specific date patterns)
  { pattern: /\bdate\b|datum/i, generate: fakeDate },

  // Status / Flags
  { pattern: /\bstatus\b/i, generate: () => 'valid' },
  { pattern: /\bexported\b/i, generate: () => '0' },
  { pattern: /\bexport\s*skip\b/i, generate: () => '0' },
  { pattern: /opt\s*in/i, generate: (i) => i % 2 === 0 ? '1' : '0' },
  { pattern: /welcome\s*call/i, generate: (i) => i % 2 === 0 ? '1' : '0' },
  { pattern: /\bflagged\b/i, generate: () => '0' },
  { pattern: /cancel\s*reason|quality\s*reason|status\s*note/i, generate: () => '' },
  { pattern: /flag\s*note/i, generate: () => '' },
  { pattern: /extra\s*field\s*one/i, generate: () => '' },

  // Block / Work ticket
  { pattern: /block\s*name/i, generate: () => 'main' },
  { pattern: /\bweek\b/i, generate: (i) => String((i % 52) + 1) },
  { pattern: /call\s*count/i, generate: () => '1' },
  { pattern: /call\s*user/i, generate: (i) => String(100 + i) },
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

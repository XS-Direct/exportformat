import type { FixtureBundle } from './types'

// Synthetic fixtures only — no real donor data. The numeric ids match the
// shapes seen in the doc ({471: id}, {34-445: Person: Sex}). Swap in real
// templates by exporting them from Pace and editing this file.
export const alzheimerNlFixtures: FixtureBundle = {
  id: 'alzheimer-nl',
  name: 'Alzheimer NL — Testproject HK',
  modelTitle: 'downloadAlzheimer',
  scenarios: [
    {
      id: 'project-204-hk',
      description: 'Project 204 routes to WV26063 (Testproject HK branch).',
      record: {
        fields: {
          '471': 'A0001',
          '34-445': 'M',
          '12-100': 'Alzheimer NL',
          '99-7': '204',
          '50-1': 'Jan',
          '50-2': 'Janssen',
        },
      },
      expected: {
        columns: ['A0001', 'M', 'Alzheimer NL', 'WV26063', 'Jan', 'Janssen'],
      },
    },
    {
      id: 'project-other',
      description: 'Any other project keeps its raw code (no rewrite).',
      record: {
        fields: {
          '471': 'A0002',
          '34-445': 'V',
          '12-100': 'Alzheimer NL',
          '99-7': '301',
          '50-1': 'Anna',
          '50-2': 'de Vries',
        },
      },
      expected: {
        columns: ['A0002', 'V', 'Alzheimer NL', '301', 'Anna', 'de Vries'],
      },
    },
  ],
}

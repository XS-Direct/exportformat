// Scenario fixtures for the simulator. A scenario describes one synthetic
// record (field values + optional vars) and the columns the generated row
// should contain after evaluating the template against that record.

export interface ScenarioRecord {
  // Field values keyed by either the raw ref or the bare id.
  fields: Record<string, string>
  // Pre-populated $var values (eg. set in codeBefore in real templates).
  vars?: Record<string, string>
}

export interface ScenarioExpectation {
  // Each entry corresponds to one TAB-separated column in the generated row.
  // null skips the column (eg. for fields that are output-format-specific).
  columns: (string | null)[]
}

export interface Scenario {
  id: string
  description: string
  record: ScenarioRecord
  expected?: ScenarioExpectation
}

export interface FixtureBundle {
  id: string
  name: string
  // Reference to the export model this bundle is exercising.
  modelTitle: string
  scenarios: Scenario[]
}

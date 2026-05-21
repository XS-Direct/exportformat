import { aidsfondsFixtures } from './aidsfonds'
import { alzheimerNlFixtures } from './alzheimer-nl'
import { amnestyFixtures } from './amnesty'
import { amrefFixtures } from './amref'
import type { FixtureBundle } from './types'

export const BUILTIN_FIXTURES: FixtureBundle[] = [
  alzheimerNlFixtures,
  aidsfondsFixtures,
  amnestyFixtures,
  amrefFixtures,
]

export type { FixtureBundle, Scenario, ScenarioRecord, ScenarioExpectation } from './types'

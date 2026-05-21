import { aidsfondsFixtures } from './aidsfonds'
import { alzheimerNlFixtures } from './alzheimer-nl'
import type { FixtureBundle } from './types'

export const BUILTIN_FIXTURES: FixtureBundle[] = [alzheimerNlFixtures, aidsfondsFixtures]

export type { FixtureBundle, Scenario, ScenarioRecord, ScenarioExpectation } from './types'

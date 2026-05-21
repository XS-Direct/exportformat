import type { FixtureBundle } from './types'

// Production downloadAlzheimerNederland model from Pace. Columns are
// semicolon-separated, each value double-quoted. Routing in the first
// column resolves a campaign-proposition code based on a cascade of
// project / method / company-domain / donation-date conditions.
export const ALZHEIMER_NL_CODE_BEFORE =
  `"Campagnepropositiecode";"Is organisatie";"Geslacht";"Voornaam";"Voorletters";` +
  `"Tussenvoegsel";"Achternaam";"Geboortedatum";"Straat";"Huisnummer";` +
  `"Huisnummer toevoeging";"Postcode";"Plaats";"Landcode";"Emailadres";` +
  `"Telefoonnummer";"Mobiel nummer";"Type overeenkomst";"Periode";"Bedrag";` +
  `"Betaalfrequentie";"Betaalwijze";"IBAN";"Datum machtiging";"Startdatum";` +
  `"Einddatum";"Contactdatum";"Responsecode";"Opmerkingen";"Magazine selectie";` +
  `"Opt-in nieuwsbrief AN";"Bereikt welkomstcall D2D";"Betrokkenheid omgeving";` +
  `"Betrokkenheid verleden";"Betrokkenheid werk";"Betrokkenheid geen"`

export const ALZHEIMER_NL_REPEATING_CODE =
  `$var[count][{var:count} + 1]` +
  `"$ifelse[{22-326: Project: id} == 204][WV26063]` +
  `[$ifelse[{39-46-44-716: Work ticket: Shift subscription: Shift: Method} == event][WV25209]` +
  `[$ifelse[{39-46-40-41-1411: Work ticket: Shift subscription: Company employee: Company: Domain} == genz][WV23034]` +
  `[$ifelse[$date[{476: Date}][%Y%m%d] > 20260301][WV26016][WV20136]]]]";` +
  `"N";` +
  `"$if[{34-445: Person: Sex} == male][M]` +
  `$if[{34-445: Person: Sex} == female][V]` +
  `$if['{34-445: Person: Sex}' == 'non-binary'][X]` +
  `$if[{34-445: Person: Sex} == unknown || {34-445: Person: Sex} == other][O]";` +
  `"{34-447: Person: First name}";` +
  `"{34-446: Person: Initials}";` +
  `"{34-448: Person: Prefix}";` +
  `"{34-449: Person: Last name}";` +
  `"$date[{34-450: Person: Date of birth}][%Y%m%d]";` +
  `"{34-51-707: Person: Address: Street}";` +
  `"{34-51-708: Person: Address: House number}";` +
  `"{34-51-709: Person: Address: House number addition}";` +
  `"$substr[{34-51-710: Person: Address: Postal code}][0, 4] $substr[{34-51-710: Person: Address: Postal code}][-2]";` +
  `"$upper[{34-51-711: Person: Address: City}]";` +
  `"NL";` +
  `"{34-36-463: Person: Email: Address}";` +
  `"$if[$substr[{34-37-587: Person: Phone: Main number}][0, 2] != 06 && {34-37-812: Person: Phone: Status} == valid][{34-37-587: Person: Phone: Main number}]";` +
  `"$if[$substr[{34-37-587: Person: Phone: Main number}][0, 2] == 06 && {34-37-812: Person: Phone: Status} == valid][{34-37-587: Person: Phone: Main number}]";` +
  `"{478: Amount}";` +
  `"$ifelse[{477: Frequency} == single][E][M]";` +
  `"I";` +
  `"{34-35-456: Person: Bank account: IBAN}";` +
  `"$date[{476: Date}][%Y%m%d]";` +
  `"$ifelse[$date[][%d] > 24 || $date[][%m%d] == 0624]` +
  `[$date[$strtotime[first day of next month]][%Y%m%d]]` +
  `[$date[{476: Date}][%Y%m%d]]";` +
  `"";` +
  `"$date[{476: Date}][%Y%m%d]";` +
  `"RS10";` +
  `"";` +
  `"$if[{34-37-1386: Person: Phone: Opt in} == 0][N]";` +
  `"$if[{34-36-810: Person: Email: Opt in} == 1][J]";` +
  `"$ifelse[{801: Welcome call} == 1][J][]";` +
  `"$if[{1377: Extra field one} == Omgeving][J]";` +
  `"$if[{1377: Extra field one} == Verleden][J]";` +
  `"$if[{1377: Extra field one} == Werk][J]";` +
  `"$if[{1377: Extra field one} == Geen][J]$storevar[count]\n` +
  `<<exportedId={471: id}>>`

// Scenarios pin the campaign-proposition routing only — the rest of the
// row is a pass-through of field values and would make per-column
// expectations brittle. Tests assert by substring against the row output.
export const alzheimerNlFixtures: FixtureBundle = {
  id: 'alzheimer-nl',
  name: 'Alzheimer NL — Repeating code (productie)',
  modelTitle: 'downloadAlzheimerNederland',
  scenarios: [
    {
      id: 'project-204',
      description: 'Project 204 → WV26063 ongeacht andere kenmerken.',
      record: {
        fields: {
          '22-326': '204',
          '34-445': 'female',
          '476': '2025-09-01',
          '477': 'single',
        },
      },
    },
    {
      id: 'method-event',
      description: 'Project ≠ 204, shift-method event → WV25209.',
      record: {
        fields: {
          '22-326': '300',
          '39-46-44-716': 'event',
          '34-445': 'male',
        },
      },
    },
    {
      id: 'company-domain-genz',
      description: 'Geen project/method match, maar company-domain "genz" → WV23034.',
      record: {
        fields: {
          '22-326': '300',
          '39-46-44-716': 'door-to-door',
          '39-46-40-41-1411': 'genz',
          '34-445': 'female',
        },
      },
    },
    {
      id: 'date-post-2026-march',
      description: 'Datum ná 2026-03-01 zonder andere matches → WV26016.',
      record: {
        fields: {
          '22-326': '300',
          '39-46-44-716': 'door-to-door',
          '476': '2026-04-15',
          '34-445': 'male',
        },
      },
    },
    {
      id: 'default-fallback',
      description: 'Geen enkele match → WV20136 (default-tak).',
      record: {
        fields: {
          '22-326': '300',
          '39-46-44-716': 'door-to-door',
          '476': '2025-01-15',
          '34-445': 'male',
        },
      },
    },
    {
      id: 'non-binary-sex',
      description: 'Sex non-binary → kolom 3 wordt "X".',
      record: {
        fields: {
          '22-326': '204',
          '34-445': 'non-binary',
        },
      },
    },
  ],
}

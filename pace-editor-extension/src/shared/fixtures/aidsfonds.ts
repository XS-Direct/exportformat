import type { FixtureBundle } from './types'

// Real Aidsfonds Repeating-code template as exported from Pace. Stored
// verbatim so the round-trip identity test exercises the parser against
// production syntax — any change to parser/serializer that breaks this
// constant breaks CI.
export const AIDSFONDS_REPEATING_CODE =
  `$var[count][{var:count} + 1]$var[amount][$replace[,][.][{478: Amount}]]` +
  `$ifelse[$date[{476: Date}][%Y%m%d] > 20260104]` +
  `[$ifelse[{22-326: Project: id} == 205 || {22-326: Project: id} == 206 || {22-326: Project: id} == 207]` +
  `[$ifelse[{1418: Method override export} == 1]` +
  `[$if['{803: Method override}' == 'door-to-door'][23580]` +
  `$if['{803: Method override}' == 'face-to-face'][23578]` +
  `$if['{803: Method override}' == 'event'][22698]]` +
  `[$if['{39-46-44-716: Work ticket: Shift subscription: Shift: Method}' == 'door-to-door'][23580]` +
  `$if['{39-46-44-716: Work ticket: Shift subscription: Shift: Method}' == 'face-to-face'][23578]` +
  `$if['{39-46-44-716: Work ticket: Shift subscription: Shift: Method}' == 'event'][22698]]]` +
  `[$ifelse[{22-326: Project: id} == 208 || {22-326: Project: id} == 209 || {22-326: Project: id} == 210]` +
  `[$ifelse[{1418: Method override export} == 1]` +
  `[$if['{803: Method override}' == 'door-to-door'][23581]` +
  `$if['{803: Method override}' == 'face-to-face'][23579]` +
  `$if['{803: Method override}' == 'event'][22698]]` +
  `[$if['{39-46-44-716: Work ticket: Shift subscription: Shift: Method}' == 'door-to-door'][23581]` +
  `$if['{39-46-44-716: Work ticket: Shift subscription: Shift: Method}' == 'face-to-face'][23579]` +
  `$if['{39-46-44-716: Work ticket: Shift subscription: Shift: Method}' == 'event'][22698]]]` +
  `[$ifelse[{22-326: Project: id} == 60 || {22-326: Project: id} == 88 || {22-326: Project: id} == 141]` +
  `[$ifelse[{1418: Method override export} == 1]` +
  `[$if['{803: Method override}' == 'door-to-door'][23495]` +
  `$if['{803: Method override}' == 'face-to-face'][23497]` +
  `$if['{803: Method override}' == 'event'][22698]]` +
  `[$if['{39-46-44-716: Work ticket: Shift subscription: Shift: Method}' == 'door-to-door'][23495]` +
  `$if['{39-46-44-716: Work ticket: Shift subscription: Shift: Method}' == 'face-to-face'][23497]` +
  `$if['{39-46-44-716: Work ticket: Shift subscription: Shift: Method}' == 'event'][22698]]]` +
  `[$ifelse[{1418: Method override export} == 1]` +
  `[$if['{803: Method override}' == 'door-to-door'][23494]` +
  `$if['{803: Method override}' == 'face-to-face'][23496]` +
  `$if['{803: Method override}' == 'event'][22698]]` +
  `[$if['{39-46-44-716: Work ticket: Shift subscription: Shift: Method}' == 'door-to-door'][23494]` +
  `$if['{39-46-44-716: Work ticket: Shift subscription: Shift: Method}' == 'face-to-face'][23496]` +
  `$if['{39-46-44-716: Work ticket: Shift subscription: Shift: Method}' == 'event'][22698]]]]]]` +
  `[$ifelse[{22-326: Project: id} == 60 || {22-326: Project: id} == 88 || {22-326: Project: id} == 141]` +
  `[$ifelse[{1418: Method override export} == 1]` +
  `[$if['{803: Method override}' == 'door-to-door'][22550]` +
  `$if['{803: Method override}' == 'face-to-face'][22551]` +
  `$if['{803: Method override}' == 'event'][22698]]` +
  `[$if['{39-46-44-716: Work ticket: Shift subscription: Shift: Method}' == 'door-to-door'][22550]` +
  `$if['{39-46-44-716: Work ticket: Shift subscription: Shift: Method}' == 'face-to-face'][22551]` +
  `$if['{39-46-44-716: Work ticket: Shift subscription: Shift: Method}' == 'event'][22698]]]` +
  `[$ifelse[{1418: Method override export} == 1]` +
  `[$if['{803: Method override}' == 'door-to-door'][20334]` +
  `$if['{803: Method override}' == 'face-to-face'][21770]` +
  `$if['{803: Method override}' == 'event'][22698]]` +
  `[$if['{39-46-44-716: Work ticket: Shift subscription: Shift: Method}' == 'door-to-door'][20334]` +
  `$if['{39-46-44-716: Work ticket: Shift subscription: Shift: Method}' == 'face-to-face'][21770]` +
  `$if['{39-46-44-716: Work ticket: Shift subscription: Shift: Method}' == 'event'][22698]]]]` +
  `&#9;Maken&#9;Maken&#9;NL37INGB0000008957&#9;Automatische incasso` +
  `&#9;$ifelse[{34-445: Person: Sex} == female][V][M]` +
  `&#9;{34-446: Person: Initials}&#9;{34-447: Person: First name}&#9;{34-448: Person: Prefix}&#9;{34-449: Person: Last name}` +
  `&#9;{34-51-707: Person: Address: Street}&#9;{34-51-708: Person: Address: House number}&#9;{34-51-709: Person: Address: House number addition}` +
  `&#9;$substr[{34-51-710: Person: Address: Postal code}][0, 4] $substr[{34-51-710: Person: Address: Postal code}][-2]` +
  `&#9;{34-51-711: Person: Address: City}&#9;{34-51-712: Person: Address: Country code}` +
  `&#9;$if[$substr[{34-37-587: Person: Phone: Main number}][0,2] != 06 && {34-37-812: Person: Phone: Status} == valid][{34-37-587: Person: Phone: Main number}]` +
  `&#9;$if[$substr[{34-37-587: Person: Phone: Main number}][0,2] == 06 && {34-37-812: Person: Phone: Status} == valid][{34-37-587: Person: Phone: Main number}]` +
  `&#9;$date[{34-450: Person: Date of birth}][%d-%m-%Y]` +
  `&#9;{34-35-456: Person: Bank account: IBAN}&#9;{478: Amount}` +
  `&#9;$if[{477: Frequency} == month][M]$if[{477: Frequency} == single][E]` +
  `&#9;$date[{476: Date}][%d-%m-%Y]&#9;{34-36-463: Person: Email: Address}&#9;2000` +
  `&#9;$date[{476: Date}][%d-%m-%Y]` +
  `&#9;$ifelse[{801: Welcome call} == 1][$date[{760: Call lock date}][%d-%m-%Y]][$date[][%d-%m-%Y]]` +
  `&#9;$ifelse[{801: Welcome call} == 1][AFG][$ifelse[{34-37-812: Person: Phone: Status} == invalid][ANF][ANB]]` +
  `&#9;{39-46-40-492: Work ticket: Shift subscription: Company employee: id}` +
  `&#9;$replace[People Marketing ][][$ifelse[{39-46-40-41-500: Work ticket: Shift subscription: Company employee: Company: id} == 12041][SaleslinQ][{39-46-40-41-506: Work ticket: Shift subscription: Company employee: Company: Name}]]` +
  `&#9;XSD&#9;0&#9;` +
  `&#9;{471: id}` +
  `&#9;$ifelse[{34-36-810: Person: Email: Opt in} == 1][Ja][Nee]` +
  `&#9;$if[{34-36-810: Person: Email: Opt in} == 1][Ik blijf graag maandelijks op de hoogte van de aidsbestrijding. Afmelden kan bij elke e-mail.]` +
  `&#9;$ifelse[{34-37-1386: Person: Phone: Opt in} == 1][Ja][Nee]` +
  `&#9;$if[{34-37-1386: Person: Phone: Opt in} == 1][Ja, Aidsfonds mag mij telefonisch informeren over hun aanpak, projecten en hoe ik kan bijdragen.]` +
  `$storevar[count]`

// Field-value records that exercise distinct branches of the project /
// method-override routing. Column expectations check the resolved product
// id only — the rest of the columns just pass through field values, which
// would make expectations noisy and brittle.
export const aidsfondsFixtures: FixtureBundle = {
  id: 'aidsfonds',
  name: 'Aidsfonds — Repeating code (productie)',
  modelTitle: 'downloadAidsfonds',
  scenarios: [
    {
      id: 'pre-2026-project-60-d2d-override',
      description: 'Donatie vóór 2026-01-04, project 60, method-override door-to-door → 22550.',
      record: {
        fields: {
          '476': '2025-12-01',
          '22-326': '60',
          '1418': '1',
          '803': 'door-to-door',
          '34-445': 'female',
          '477': 'month',
          '478': '15,00',
          '801': '0',
          '34-37-812': 'valid',
          '39-46-40-41-500': '12041',
        },
      },
      expected: {
        columns: [
          '22550',
          'Maken',
          'Maken',
          'NL37INGB0000008957',
          'Automatische incasso',
          'V',
        ],
      },
    },
    {
      id: 'pre-2026-shift-event',
      description: 'Donatie vóór 2026-01-04, shift-method event → 22698 (alle projecten gelijk).',
      record: {
        fields: {
          '476': '2025-06-01',
          '22-326': '141',
          '1418': '0',
          '39-46-44-716': 'event',
          '34-445': 'male',
        },
      },
      expected: {
        columns: ['22698', 'Maken', 'Maken', 'NL37INGB0000008957', 'Automatische incasso', 'M'],
      },
    },
    {
      id: 'post-2026-project-205-d2d',
      description: 'Donatie ná 2026-01-04, project 205, shift-method door-to-door → 23580.',
      record: {
        fields: {
          '476': '2026-03-15',
          '22-326': '205',
          '1418': '0',
          '39-46-44-716': 'door-to-door',
          '34-445': 'female',
        },
      },
      expected: {
        columns: ['23580', 'Maken', 'Maken', 'NL37INGB0000008957', 'Automatische incasso', 'V'],
      },
    },
    {
      id: 'post-2026-project-208-face-override',
      description: 'Donatie ná 2026-01-04, project 209, override face-to-face → 23579.',
      record: {
        fields: {
          '476': '2026-04-01',
          '22-326': '209',
          '1418': '1',
          '803': 'face-to-face',
          '34-445': 'female',
        },
      },
      expected: {
        columns: ['23579', 'Maken', 'Maken', 'NL37INGB0000008957', 'Automatische incasso', 'V'],
      },
    },
    {
      id: 'post-2026-other-project-d2d',
      description: 'Donatie ná 2026-01-04, project 999 (fallback), shift-method door-to-door → 23494.',
      record: {
        fields: {
          '476': '2026-04-01',
          '22-326': '999',
          '1418': '0',
          '39-46-44-716': 'door-to-door',
          '34-445': 'male',
        },
      },
      expected: {
        columns: ['23494', 'Maken', 'Maken', 'NL37INGB0000008957', 'Automatische incasso', 'M'],
      },
    },
  ],
}

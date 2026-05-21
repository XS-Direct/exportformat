import type { FixtureBundle } from './types'

// Production downloadAmnestyInternational model from Pace. Columns are
// comma-separated CSV, no quoting (assumes values are well-behaved).
// The repeating-code body is one big row that contains a nested
// $ifelse[welcome-call][block-A][block-B] — the two blocks are
// near-duplicates of the same column list but with a few differences
// (eg. "Direct Debit" vs "Direct debit"), reflecting how welcome-call
// scheduling changes the surrounding metadata columns.
export const AMNESTY_CODE_BEFORE =
  `SW ID,Mailkey,Date contact,Gender,First Name,Initials,Middle name,Surname,` +
  `Street,House number,House number suffix,Postal Code,City,Country,Emailadres,` +
  `Email Opt-in,Phone number,Phone number 2,Date of birth,Date start,Amount,` +
  `Frequency,Bank`

// First half (welcome-call == 1 branch) — kept as a const so the test
// fixture below can stitch the full repeating code together without
// blowing past TypeScript template-literal length limits.
const AMNESTY_ROW_BODY =
  `$ifelse['{39-46-44-716: Work ticket: Shift subscription: Shift: Method}' == 'door-to-door'][XS Direct 2018 D2D,7011p000000OUde][XS Direct 2018 straatwerving,7011p000000Udj]` +
  `,Koud,,$ucfirst[{34-445: Person: Sex}],{34-446: Person: Initials},{34-447: Person: First name},` +
  `$if[{34-448: Person: Prefix} !=][{34-448: Person: Prefix} ]{34-449: Person: Last name},` +
  `{34-51-707: Person: Address: Street},{34-51-708: Person: Address: House number},` +
  `{34-51-709: Person: Address: House number addition},` +
  `$substr[{34-51-710: Person: Address: Postal code}][0, 4] $substr[{34-51-710: Person: Address: Postal code}][-2],` +
  `$upper[{34-51-711: Person: Address: City}],Nederland,` +
  `$if[$substr[{34-37-587: Person: Phone: Main number}][0,2] != 06 && {34-37-812: Person: Phone: Status} == valid]` +
  `[+31$substr[{34-37-587: Person: Phone: Main number}][1]],` +
  `$if[$substr[{34-37-587: Person: Phone: Main number}][0,2] == 06 && {34-37-812: Person: Phone: Status} == valid]` +
  `[+31$substr[{34-37-587: Person: Phone: Main number}][1]],` +
  `{34-36-463: Person: Email: Address},{34-450: Person: Date of birth},N,N,N,N,{476: Date},` +
  `$ifelse[{477: Frequency} == single][0][12]`

export const AMNESTY_REPEATING_CODE =
  AMNESTY_ROW_BODY +
  `,Direct Debit,,$replace[,][.][{478: Amount}],` +
  `$if[$date[][%d] >= 15][$date[$strtotime[first day of next month]][%Y-%m-%d]],,,,` +
  `{34-35-456: Person: Bank account: IBAN},,,,,` +
  `$ifelse[{477: Frequency} == single]` +
  `[$ifelse[{801: Welcome call} == 1][Eenmalige gift met servicecall][Eenmalige gift zonder servicecall]]` +
  `[$ifelse[{801: Welcome call} == 1][Nieuw lid met servicecall][Nieuw lid zonder servicecall]]` +
  `,,,{471: id},,$ifelse[{801: Welcome call} == 1][1,N,` +
  `{39-46-40-492: Work ticket: Shift subscription: Company employee: id},` +
  `{39-46-40-497: Work ticket: Shift subscription: Company employee: First name},` +
  `$if[{39-46-40-498: Work ticket: Shift subscription: Company employee: Prefix} !=]` +
  `[{39-46-40-498: Work ticket: Shift subscription: Company employee: Prefix} ]` +
  `{39-46-40-499: Work ticket: Shift subscription: Company employee: Last name},` +
  `$ifelse[{39-46-40-624: Work ticket: Shift subscription: Company employee: Sex} == male][M][F],` +
  `$ifelse['{39-46-44-716: Work ticket: Shift subscription: Shift: Method}' == 'door-to-door']` +
  `[$upper[{34-51-711: Person: Address: City}]][STRAAT],` +
  `$date[{472: Created (UTC)}][%Y-%m-%d]\n` +
  AMNESTY_ROW_BODY +
  `,Direct debit,,$replace[,][.][{478: Amount}],` +
  `$if[$date[][%d] >= 15][$date[$strtotime[first day of next month]][%Y-%m-%d]],,,,` +
  `{34-35-456: Person: Bank account: IBAN},,,,,` +
  `$ifelse[{477: Frequency} == single]` +
  `[$ifelse[{801: Welcome call} == 1][Eenmalige gift met servicecall][Eenmalige gift zonder servicecall]]` +
  `[$ifelse[{801: Welcome call} == 1][Nieuw lid met servicecall][Nieuw lid zonder servicecall]]` +
  `,,,{471: id},,2,N,,,,,HILLEGOM,$date[{473: Updated (UTC)}][%Y-%m-%d]][3,N,,,,,]`

export const amnestyFixtures: FixtureBundle = {
  id: 'amnesty',
  name: 'Amnesty International — Repeating code (productie)',
  modelTitle: 'downloadAmnestyInternational',
  scenarios: [
    {
      id: 'd2d-recurring-welcome-call',
      description: 'Donor door-to-door, maandelijks, met welcome call.',
      record: {
        fields: {
          '39-46-44-716': 'door-to-door',
          '34-445': 'male',
          '477': 'month',
          '801': '1',
          '478': '15,00',
          '471': 'AM001',
        },
      },
    },
    {
      id: 'street-single-no-welcome',
      description: 'Donor street-werving, eenmalig, zonder welcome call.',
      record: {
        fields: {
          '39-46-44-716': 'street',
          '34-445': 'female',
          '477': 'single',
          '801': '0',
          '478': '50,00',
          '471': 'AM002',
        },
      },
    },
  ],
}

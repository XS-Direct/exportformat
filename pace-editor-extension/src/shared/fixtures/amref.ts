import type { FixtureBundle } from './types'

// Production downloadAmref model from Pace. Semicolon-separated CSV
// with a long country-code switch in the Country column and an inline
// SQL $query at the back of the row to look up the call-centre answer
// that drives the "intentie / resultaat / Geen" columns.
//
// IMPORTANT: $query is intentionally not executed by the simulator
// (Pace's database isn't reachable from a browser extension). The
// fixture is therefore only used for the round-trip property — the
// scenarios pass through field values verbatim, no expected columns.

export const AMREF_CODE_BEFORE =
  `IMP Uniek Idnummer;IMP Geslacht;IMP Voorletters;IMP Voornaam;IMP Tussenvoegsel;` +
  `IMP Achternaam;Bedrijfsnaam;IMP Straat;IMP Huisnummer;IMP Huisnummer_rest;` +
  `IMP Postcode;IMP Woonplaats;IMP Land;IMP IBAN;IMP Telefoonnummer;IMP Mobiel nummer;` +
  `IMP E-mail adres;IMP Geboortedatum;IMP Wervingsonderwerp;IMP Machtiging bedrag;` +
  `IMP Machtiging frequentie;IMP Machtiging ingangsdatum ;IMP Machtiging einddatum;` +
  `IMP Contactdatum ;IMP Werverscode;IMP Bereikt bij nabellen ;Vestiging;IMP Type Wervng;` +
  `IMP Telefoon SOFT Opt-In;IMP Email SOFT Opt-in;IMP Intentie score;` +
  `IMP Resultaat bij nabellen;IMP KBO-/KVK nummer;IMP CallCentre agent code;` +
  `Geboortejaar;Short Shifts;filler1;filler2;filler3;filler4;filler5` +
  `$var[count][0]$storevar[count]`

export const AMREF_REPEATING_CODE =
  `$var[count][{var:count} + 1]` +
  `{471: id};` +
  `$ifelse[{34-445: Person: Sex} == male][M][$ifelse[{34-445: Person: Sex} == female][V][X]];` +
  `{34-446: Person: Initials};{34-447: Person: First name};{34-448: Person: Prefix};` +
  `{34-449: Person: Last name};;` +
  `{34-51-707: Person: Address: Street};{34-51-708: Person: Address: House number};` +
  `$if[{34-51-709: Person: Address: House number addition} != && '$substr[{34-51-709: Person: Address: House number addition}][0, 1]' != '-']` +
  `[-]{34-51-709: Person: Address: House number addition};` +
  `{34-51-710: Person: Address: Postal code};{34-51-711: Person: Address: City};` +
  `$if[{34-51-712: Person: Address: Country code} == NL][Nederland]` +
  `$if[{34-51-712: Person: Address: Country code} == BE][België]` +
  `$if[{34-51-712: Person: Address: Country code} == CH][Zwitserland]` +
  `$if[{34-51-712: Person: Address: Country code} == FR][Frankrijk]` +
  `$if[{34-51-712: Person: Address: Country code} == DE][Duitsland]` +
  `$if[{34-51-712: Person: Address: Country code} == GB][Verenigd Koninkrijk]` +
  `$if[{34-51-712: Person: Address: Country code} == IT][Italië]` +
  `$if[{34-51-712: Person: Address: Country code} == PL][Polen]` +
  `$if[{34-51-712: Person: Address: Country code} == NO][Noorwegen]` +
  `$if[{34-51-712: Person: Address: Country code} == PT][Portugal]` +
  `$if[{34-51-712: Person: Address: Country code} == RO][Roemenië]` +
  `$if[{34-51-712: Person: Address: Country code} == ZA][Zuid-Afrika]` +
  `$if[{34-51-712: Person: Address: Country code} == NG][Nigeria]` +
  `$if[{34-51-712: Person: Address: Country code} == CZ][Tsjechië];` +
  `{34-35-456: Person: Bank account: IBAN};` +
  `$if[$substr[{34-37-587: Person: Phone: Main number}][0, 2] != 06 && {34-37-812: Person: Phone: Status} == valid]` +
  `[{34-37-587: Person: Phone: Main number}];` +
  `$if[$substr[{34-37-587: Person: Phone: Main number}][0, 2] == 06 && {34-37-812: Person: Phone: Status} == valid]` +
  `[{34-37-587: Person: Phone: Main number}];` +
  `{34-36-463: Person: Email: Address};` +
  `$date[{34-450: Person: Date of birth}][%d-%m-%Y];` +
  `MLML;` +
  `$replace[.][,][{478: Amount}];` +
  `$ifelse[{477: Frequency} == single][-1][12];` +
  `$date[{476: Date}][01-%m-%Y];;` +
  `$date[{476: Date}][%d-%m-%Y];` +
  `{39-46-40-492: Work ticket: Shift subscription: Company employee: id};` +
  `$ifelse[{801: Welcome call} == 1][ja][nee];` +
  `$ifelse[{39-46-40-41-500: Work ticket: Shift subscription: Company employee: Company: id} == 12041]` +
  `[12029][{39-46-40-41-500: Work ticket: Shift subscription: Company employee: Company: id}];` +
  `$ifelse['{39-46-44-716: Work ticket: Shift subscription: Shift: Method}' == 'door-to-door'][D2D][Straat];` +
  `$ifelse[{34-37-1386: Person: Phone: Opt in} == 1][Opt-in][Opt-out];` +
  `$ifelse[{34-36-810: Person: Email: Opt in} == 1][Opt-in][Opt-out];` +
  `$trim[$query[SELECT CASE WHEN \`answer\` = 'Ja' THEN 10 WHEN \`answer\` = 'Nee' THEN 1 ELSE \`answer\` END AS answer FROM vw_call_interview_data WHERE \`48_38_id\` = '{471: id}' AND \`question\` LIKE '%intentie%' AND \`answer\` != 'Geen' ORDER BY \`create_dattim\` DESC LIMIT 1;]];` +
  `$ifelse[{477: Frequency} == single][Omgezet]` +
  `[$ifelse[$replace[,][.][{478: Amount}] < 8][Downgrade]` +
  `[$if[{801: Welcome call} == 1][Bevestigd]]];` +
  `$ifelse[{801: Welcome call} == 1]` +
  `[{39-46-40-492: Work ticket: Shift subscription: Company employee: id}][];` +
  `$date[{34-450: Person: Date of birth}][%Y];;;;;;` +
  `$storevar[count]`

export const amrefFixtures: FixtureBundle = {
  id: 'amref',
  name: 'Amref — Repeating code (productie, met $query)',
  modelTitle: 'downloadAmref',
  scenarios: [
    {
      id: 'nl-d2d-recurring',
      description: 'Donor Nederland, door-to-door, maandelijks.',
      record: {
        fields: {
          '471': 'AR001',
          '34-445': 'female',
          '34-51-712': 'NL',
          '39-46-44-716': 'door-to-door',
          '477': 'month',
          '801': '1',
          '478': '15,00',
        },
      },
    },
    {
      id: 'be-street-single',
      description: 'Donor België, straat, eenmalig.',
      record: {
        fields: {
          '471': 'AR002',
          '34-445': 'male',
          '34-51-712': 'BE',
          '39-46-44-716': 'street',
          '477': 'single',
          '801': '0',
          '478': '50,00',
        },
      },
    },
  ],
}

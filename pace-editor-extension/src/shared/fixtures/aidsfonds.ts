import type { FixtureBundle } from './types'

export const aidsfondsFixtures: FixtureBundle = {
  id: 'aidsfonds',
  name: 'Aidsfonds — IP-pilot uitbreiding',
  modelTitle: 'downloadAidsfonds',
  scenarios: [
    {
      id: 'standard-donor',
      description: 'Reguliere donor zonder IP-pilot kenmerk.',
      record: {
        fields: {
          '471': 'AF001',
          '34-445': 'V',
          '12-100': 'Aidsfonds',
          '60-12': 'standard',
        },
      },
      expected: {
        columns: ['AF001', 'V', 'Aidsfonds', 'standard'],
      },
    },
    {
      id: 'ip-pilot',
      description: 'IP-pilot donor krijgt afwijkende kolomvolgorde.',
      record: {
        fields: {
          '471': 'AF002',
          '34-445': 'M',
          '12-100': 'Aidsfonds',
          '60-12': 'ip-pilot',
        },
      },
      expected: {
        columns: ['AF002', 'M', 'Aidsfonds', 'ip-pilot'],
      },
    },
  ],
}

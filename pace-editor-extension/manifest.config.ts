import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

export default defineManifest({
  manifest_version: 3,
  name: 'Pace Visual Template Editor',
  version: pkg.version,
  description: pkg.description,
  permissions: ['activeTab', 'sidePanel', 'storage', 'scripting'],
  host_permissions: ['https://pace-bp.xsdirect.nl/*'],
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['https://pace-bp.xsdirect.nl/*'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
    },
  ],
  side_panel: { default_path: 'src/sidepanel/index.html' },
  action: { default_title: 'Open Pace Editor' },
  options_page: 'src/options/index.html',
  icons: {
    '16': 'public/icons/16.png',
    '48': 'public/icons/48.png',
    '128': 'public/icons/128.png',
  },
})

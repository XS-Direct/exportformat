# Pace Visual Template Editor

Chromium Manifest V3-extensie die op `https://pace-bp.xsdirect.nl/*` een visuele
editor activeert voor de `Repeating code` van Pace-export-modellen. De extensie
voorkomt onleesbare geneste `$ifelse`-ketens door alleen subtrees via UI te
laten manipuleren — schrijven naar Pace gebeurt expliciet via "Send to Pace",
de gebruiker drukt zelf op Pace's eigen save-knop.

## Stack

- Manifest V3 + side panel API (Chrome 114+)
- Vue 3 + Pinia + Vite + `@crxjs/vite-plugin`
- TypeScript + Vitest + jsdom
- TailwindCSS voor styling
- Geen externe netwerk-calls, geen telemetry, alleen `chrome.storage.local`

## Mappenstructuur

```
pace-editor-extension/
├── manifest.config.ts         # MV3 manifest (gegenereerd door @crxjs)
├── vite.config.ts
├── src/
│   ├── content/               # injectie + Pace DOM-adapter
│   ├── background/            # service worker (msg-routing, side panel open)
│   ├── sidepanel/             # Vue-app: editor, preview, simulator, settings
│   ├── options/               # options-page (catalog-beheer)
│   └── shared/                # parser, serializer, evaluator, IR, fixtures
└── tests/                     # vitest (parser, round-trip, evaluator, DOM)
```

## Ontwikkelen

```bash
npm install
npm run dev         # Vite dev-server met HMR voor side panel + options
npm test            # alle vitest-suites
npm run typecheck   # vue-tsc strict mode
npm run build       # productie-bundel in dist/
npm run package     # bundel + zip naar pace-editor-extension.zip
```

## Installeren als unpacked extensie

1. `npm run build`
2. Open `chrome://extensions` → enable Developer mode
3. Klik **Load unpacked** → kies de `dist/` map
4. Open `https://pace-bp.xsdirect.nl/#…&show=modelEdit`
5. Boven de **Repeating code**-textarea verschijnt `✎ Open visual editor`

Zie [`docs/install.md`](docs/install.md) voor uitgebreidere instructies.

## Round-trip-garantie

De parser produceert een Intermediate Representation (`src/shared/ir-types.ts`)
waarvan `serialize(parse(x)) === x` geldt voor elke template die de parser
accepteert. Zie `tests/roundtrip.test.ts` voor de corpus die deze property
afdwingt. Voeg producti-templates toe en CI dwingt af dat geen wijziging die
identiteit breekt.

## Beveiliging

| Maatregel | Details |
| --- | --- |
| Host-restricted | Alleen `pace-bp.xsdirect.nl` in `host_permissions` |
| Geen netwerk-calls | Parsing & evaluatie volledig in de browser |
| Geen telemetry | Geen analytics, geen error-reporting |
| Geen `tabs` permission | Kan geen andere tabs lezen |
| Geen automatische save | Repeating code wordt pas geschreven na klik op "Send to Pace" |
| Geen donor-data | Alleen IR (templates) + synthetische fixtures in storage |
| CSP | `script-src 'self'`, geen `unsafe-eval` |

## Acceptatie

Zie het oorspronkelijke hand-off-document voor de acceptatiecriteria (a–g).
De testsuite in `tests/` dekt:

- parser correctness (`parser.test.ts`)
- round-trip identity (`roundtrip.test.ts`)
- evaluator semantics (`evaluator.test.ts`)
- scenario rerouting (`scenarios.test.ts`)
- Pace-DOM detectie + textarea-write (`pace-dom.test.ts`)

Vervang de placeholder-fixtures in `src/shared/fixtures/` door de echte
Aidsfonds- en Alzheimer NL-templates zodra je die uit Pace exporteert.

## Roadmap

- Phase 0 – shared package + tests **(klaar)**
- Phase 1 – content script + read-only side panel **(klaar)**
- Phase 2 – visuele node-editor met add/remove/edit **(klaar)**
- Phase 3 – simulator + CSV/TSV-download **(klaar)**
- Phase 4 – UX-polish: drag-drop, undo/redo, multi-host config (open)

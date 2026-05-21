# Pace Visual Template Editor

Chrome-extensie voor het visueel bewerken en monitoren van Pace export-templates op `pace-bp.xsdirect.nl`.

## Installeren

### Vereisten

- Google Chrome of Brave browser
- [Node.js](https://nodejs.org/) 18 of hoger
- Git

### Stap 1 — Repository klonen

```bash
git clone https://github.com/XS-Direct/exportformat.git
cd exportformat/pace-editor-extension
```

### Stap 2 — Bouwen

```bash
npm install
npm run build
```

### Stap 3 — Laden in Chrome

1. Ga naar `chrome://extensions/`
2. Zet **Developer mode** aan (schakelaar rechtsboven)
3. Klik **Load unpacked**
4. Selecteer de map `pace-editor-extension/dist`
5. De extensie verschijnt als puzzelstukje in de toolbar — pin hem voor makkelijk toegang

### Stap 4 — Gebruiken

1. Ga naar [Pace](https://pace-bp.xsdirect.nl/) en open de **Model** tab
2. Klik op het extensie-icoon in de toolbar
3. Het side panel opent met de **klant-picker** — kies een klant en klik op **Download** of **Export**

## Updaten

De extensie checkt automatisch op updates. Als er een nieuwe versie beschikbaar is verschijnt er een melding in de Instellingen tab.

```bash
cd exportformat/pace-editor-extension
git pull
npm install
npm run build
```

Daarna in Chrome: `chrome://extensions/` → klik het **reload-icoon** bij de extensie.

## Functies

### Klant-picker
Startscherm met alle klanten. Per klant zie je de **Download** (blauw) en **Export** (groen) modellen. Zoek op klantnaam om snel te vinden.

### Editor
- **Kolommen-view** — elke kolom als kaartje met drag-and-drop
- **Blokken-view** — visuele boomstructuur van $if/$ifelse, velden en functies
- **Raw-view** — directe toegang tot de Pace-code
- **Send to Pace** — schrijf wijzigingen terug naar het Pace-formulier

### Preview
- **Simulatie-tabel** — zie hoe het exportbestand eruitziet met automatisch gegenereerde testdata
- **Sim CSV** — download de gesimuleerde preview als CSV
- **Echte CSV** — download de echte export via de Pace API (vereist API token, zie Instellingen)
- **Raw-view** — bekijk de ruwe output

### AI Assistent
Plak een e-mail of opdracht (bijv. "wijzig de marketingcodes") en Claude past het template automatisch aan. Vereist een Anthropic API key (in te stellen bij Instellingen).

### Monitor
Scan alle exports in een klik. Signaleert:
- Parse-fouten in templates
- Kolom-mismatches tussen header en data
- Verschillen tussen Download en Export versies
- Ontbrekende modellen

### Simulator
Test de template met automatisch gegenereerde data per veld. Toont het resultaat als spreadsheet.

## Instellingen

### Pace API Token
Voor het downloaden van echte exports via de Pace API (`r.php`). Gebruik hetzelfde token als in Bruno. Stel in bij **Instellingen** → **Pace API Token**.

### Claude API Key
Voor de AI Assistent. Maak een key aan op [console.anthropic.com](https://console.anthropic.com/) en voer in bij de **AI** tab.

## Sneltoetsen

| Toets | Actie |
| --- | --- |
| `Ctrl/Cmd + Z` | Ongedaan maken |
| `Ctrl/Cmd + Shift + Z` | Opnieuw |

## Problemen?

| Probleem | Oplossing |
| --- | --- |
| "Kon Pace niet uitlezen" | Open een export model in Pace, klik dan **Lezen** |
| Verkeerd model geladen | Klik **Lezen** of gebruik de klant-picker (pijl terug) |
| Extensie reageert niet | Reload op `chrome://extensions/` |
| Echte CSV geeft fout | Controleer je Pace API token bij Instellingen |
| AI geeft fout | Controleer je Anthropic API key bij de AI tab |

## Ontwikkelen

```bash
npm run dev         # Dev-server met hot reload
npm run test        # Tests draaien
npm run build       # Productie-build
npm run package     # Build + ZIP voor distributie
```

## Architectuur

```
pace-editor-extension/
├── src/
│   ├── content/        # Leest en schrijft de Pace DOM
│   ├── background/     # Service worker (message routing, update check)
│   ├── sidepanel/      # Vue-app met alle UI-componenten
│   │   └── components/ # ClientPicker, Editor, Preview, Simulator, AI, Monitor
│   ├── options/        # Options-pagina (extra hosts)
│   └── shared/         # Parser, evaluator, serializer, auto-fixtures
└── tests/              # Vitest test suite
```
